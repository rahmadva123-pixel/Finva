"use client";

import React, { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReferralSettingsPage() {
  // Legacy referral settings removed; keep unlock controls only
  const [loading, setLoading] = useState(true);
  const [targetUids, setTargetUids] = useState<string>('');
  const [globalAllow, setGlobalAllow] = useState<boolean>(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Load referral settings doc (contains global allow toggle)
        const docRef = doc(db, 'settings', 'referral');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data: any = snap.data();
          setGlobalAllow(!!data.allowWithdrawalsWithoutReferral);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    try {
      // Save global allow toggle to settings/referral
      const ref = doc(db, 'settings', 'referral');
      await setDoc(ref, { allowWithdrawalsWithoutReferral: !!globalAllow }, { merge: true });
      alert('Saved');
    } catch (e) {
      console.error(e);
      alert('Failed to save');
    }
  };

  const handleSetUnlock = async (unlock: boolean) => {
    if (!targetUids) return alert('Enter one or more UIDs (comma-separated)');
    const uids = targetUids.split(',').map(s => s.trim()).filter(Boolean);
    if (uids.length === 0) return alert('No valid UIDs');
    setProcessing(true);
    try {
      for (const uid of uids) {
        const userRef = doc(db, 'users', uid);
        const payload: any = {};
        if (unlock) {
          payload.legacyRequiresReferralToWithdraw = false;
          payload.legacyReferralRequirementUnlockedByAdminAt = serverTimestamp();
        } else {
          payload.legacyRequiresReferralToWithdraw = true;
          payload.legacyReferralRequirementSetAt = serverTimestamp();
        }
        await setDoc(userRef, payload, { merge: true });
      }
      alert('Updated');
    } catch (e) {
      console.error(e);
      alert('Failed to update users');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Referral Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="pt-2">
              <Button onClick={handleSave} disabled={loading}>Save</Button>
            </div>
            <div className="pt-6">
              <Label>Unlock / Lock specific users</Label>
              <Input placeholder="Comma-separated UIDs" value={targetUids} onChange={e => setTargetUids(e.target.value)} />
              <div className="flex gap-2 pt-2">
                <Button onClick={() => handleSetUnlock(true)} disabled={processing}>Unlock</Button>
                <Button variant="destructive" onClick={() => handleSetUnlock(false)} disabled={processing}>Lock</Button>
              </div>
              <p className="text-xs text-muted-foreground pt-2">Use Unlock to allow withdraw without new referral. Lock will re-enable requirement and set requirement timestamp.</p>
            </div>
            <div className="pt-6">
              <Label>Global Allow Withdrawals</Label>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={globalAllow} onChange={e => setGlobalAllow(e.target.checked)} />
                <span className="text-sm">Allow all users to withdraw without referral</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">When enabled, referral requirement is ignored for all users. Use carefully.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
