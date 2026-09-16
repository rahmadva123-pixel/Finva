import { db } from '@/lib/firebase';
import { collection, doc, getDocs, query, where, setDoc, serverTimestamp, getDoc, deleteDoc, writeBatch, runTransaction, updateDoc } from 'firebase/firestore';

const QUALIFICATION_MIN = 495;
const REVOCATION_WINDOW_DAYS = 60;

export async function ensureQualificationForUser(referredUserId: string) {
  if (!db || !referredUserId) return;

  // compute completed deposit total for user
  const depositsSnap = await getDocs(query(collection(db, 'deposits'), where('userId', '==', referredUserId)));
  const completedTotal = depositsSnap.docs.reduce((sum, d) => {
    const data = d.data();
    const status = String(data.status || '').toLowerCase();
    if (status !== 'completed' && status !== 'approved') return sum;
    return sum + Number(data.amount || 0);
  }, 0);

  if (completedTotal < QUALIFICATION_MIN) return;

  const qualRef = doc(db, 'referralQualifications', referredUserId);
  const qualSnap = await getDoc(qualRef);
  if (qualSnap.exists()) return; // already qualified

  // find referrer
  const userRef = doc(db, 'users', referredUserId);
  const userSnap = await getDoc(userRef);
  const referrerId = userSnap.exists() ? userSnap.data()?.referredBy : null;
  if (!referrerId) return;

  await setDoc(qualRef, {
    referredUserId,
    referrerId,
    qualifiedAt: serverTimestamp(),
    qualifiedAmount: completedTotal,
  });
}

export async function revokeQualificationIfNeeded(referredUserId: string, triggerWithdrawalId?: string) {
  if (!db || !referredUserId) return;

  const qualRef = doc(db, 'referralQualifications', referredUserId);
  const qualSnap = await getDoc(qualRef);
  if (!qualSnap.exists()) return;

  const qualData: any = qualSnap.data();
  const qualifiedAt = qualData.qualifiedAt?.seconds ? new Date(qualData.qualifiedAt.seconds * 1000) : null;
  if (!qualifiedAt) return;

  const windowMs = REVOCATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - qualifiedAt.getTime() > windowMs) return; // outside revocation window

  // recompute completed deposit total (all time)
  const depositsSnap = await getDocs(query(collection(db, 'deposits'), where('userId', '==', referredUserId)));
  const completedTotal = depositsSnap.docs.reduce((sum, d) => {
    const data = d.data();
    const status = String(data.status || '').toLowerCase();
    if (status !== 'completed' && status !== 'approved') return sum;
    return sum + Number(data.amount || 0);
  }, 0);

  if (completedTotal >= QUALIFICATION_MIN) return; // still qualified

  // Need to reverse referral commissions for this referred user (if not already reversed)
  const compsSnap = await getDocs(query(collection(db, 'referralCommissions'), where('referredUserId', '==', referredUserId)));
  const toReverseByReferrer = new Map<string, { refs: any[]; amount: number }>();
  const commissionDocsToUpdate: any[] = [];

  compsSnap.docs.forEach((cd) => {
    const data: any = cd.data();
    if (data.reversed === true) return;
    if (data.clawedBack === true) return;
    const referrerId = String(data.referrerId || '');
    const amt = Number(data.amount || 0);
    if (!referrerId || amt <= 0) return;
    commissionDocsToUpdate.push({ ref: cd.ref, referrerId, amount: amt });
    const prev = toReverseByReferrer.get(referrerId) || { refs: [], amount: 0 };
    prev.refs.push(cd.ref);
    prev.amount += amt;
    toReverseByReferrer.set(referrerId, prev);
  });

  if (commissionDocsToUpdate.length === 0) {
    // simply delete qualification
    await deleteDoc(qualRef);
    return;
  }

  // For each referrer, attempt auto-deduction if funds available, else mark pending
  for (const [referrerId, { refs, amount }] of toReverseByReferrer.entries()) {
    try {
      await runTransaction(db, async (tx) => {
        const referrerRef = doc(db, 'users', referrerId);
        const refSnap = await tx.get(referrerRef);
        if (!refSnap.exists()) {
          // mark pending
          const revRef = doc(collection(db, 'referralReversals'));
          tx.set(revRef, { referrerId, referredUserId, amount, status: 'pending_admin', refs, createdAt: serverTimestamp(), triggerWithdrawalId });
          return;
        }

        const balance = Number(refSnap.data()?.balance || 0);
        if (balance >= amount) {
          tx.update(referrerRef, { balance: balance - amount, totalEarning: Math.max(0, Number(refSnap.data()?.totalEarning || 0) - amount) });
          // mark commissions reversed
          refs.forEach((r: any) => tx.update(r, { reversed: true, reversedAt: serverTimestamp(), reversedBy: 'system', reversalTriggerWithdrawalId: triggerWithdrawalId }));
          const revRef = doc(collection(db, 'referralReversals'));
          tx.set(revRef, { referrerId, referredUserId, amount, status: 'auto_reversed', refs, createdAt: serverTimestamp(), reversedAt: serverTimestamp(), triggerWithdrawalId });

          // notify referrer inside transaction
          const notifRef = doc(collection(db, 'notifications'));
          tx.set(notifRef, {
            userId: referrerId,
            title: 'Referral reward deducted',
            description: `${amount.toFixed(2)} was deducted from your account due to a referred user's early principal withdrawal.`,
            isRead: false,
            createdAt: serverTimestamp(),
            link: '/admin/referral-reversals',
            type: 'referralReversal'
          });
        } else {
          const revRef = doc(collection(db, 'referralReversals'));
          tx.set(revRef, { referrerId, referredUserId, amount, status: 'pending_admin', refs, createdAt: serverTimestamp(), triggerWithdrawalId });
          // mark commissions as pending reversal
          refs.forEach((r: any) => tx.update(r, { reversalPending: true, reversalRequestedAt: serverTimestamp(), reversalTriggerWithdrawalId: triggerWithdrawalId }));
          // notify referrer that reversal is pending admin action
          const notifRef = doc(collection(db, 'notifications'));
          tx.set(notifRef, {
            userId: referrerId,
            title: 'Referral reversal pending',
            description: `A reversal of ${amount.toFixed(2)} is pending because your referred user withdrew principal within ${REVOCATION_WINDOW_DAYS} days. An admin will review.`,
            isRead: false,
            createdAt: serverTimestamp(),
            link: '/admin/referral-reversals',
            type: 'referralReversalPending'
          });
        }
      });
    } catch (err) {
      console.error('Failed to process reversal for referrer', referrerId, err);
    }
  }

  // Finally delete qualification record
  await deleteDoc(qualRef);

  // Notify the referred user that their qualification was revoked
  try {
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
      userId: referredUserId,
      title: 'Referral qualification revoked',
      description: `Your referral qualification was revoked because your completed deposits dropped below $${QUALIFICATION_MIN}. The referrer may have been deducted.`,
      isRead: false,
      createdAt: serverTimestamp(),
      link: '/dashboard/referral',
      type: 'referralQualificationRevoked'
    });
  } catch (e) {
    console.warn('Failed to create referred user notification', e);
  }
}

export default null;
