
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs, Transaction, writeBatch, DocumentSnapshot, setDoc, DocumentReference, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

interface EarningPowerLedgerEntry {
    id: string;
    amount: number;
    used: number;
    status: 'active' | 'expired';
    source: string; // The ID of the investment/stake/pool that generated this power
    date: any;
}

// Function to get total available earning power for a user
export async function getAvailableEarningPower(userId: string): Promise<number> {
    if (!db) return 0;
    const ledgerQuery = query(
        collection(db, "earningPowerLedger"),
        where("userId", "==", userId),
        where("status", "==", "active")
    );

    const snapshot = await getDocs(ledgerQuery);
    
    let totalAvailablePower = 0;
    snapshot.forEach(doc => {
        const entry = doc.data() as Omit<EarningPowerLedgerEntry, 'id'>;
        totalAvailablePower += (entry.amount - entry.used);
    });
    return totalAvailablePower;
}

// Centralized function to add earnings and consume earning power
export async function addEarning(
    transaction: Transaction,
    userId: string,
    earningAmount: number,
    userDoc: DocumentSnapshot | null, // Now accepts a snapshot
    earningRulesDoc: DocumentSnapshot | null, // Now accepts a snapshot
    capitalToReturn: number = 0
): Promise<void> {
     if (!db || (earningAmount <= 0 && capitalToReturn <= 0)) return;

    const userRef = doc(db, 'users', userId);
    
    if (!userDoc || !userDoc.exists()) return;

    const earningRules = earningRulesDoc?.exists() ? earningRulesDoc.data() : null;
    
    let currentBalance = userDoc.data()?.balance || 0;
    let currentTotalEarning = userDoc.data()?.totalEarning || 0;
    let userTokenBalance = userDoc.data()?.tokenBalance || 0;

    // If earning power system is disabled, just add the balance
    if (!earningRules || !earningRules.isEnabled) {
        transaction.update(userRef, { 
            balance: currentBalance + earningAmount + capitalToReturn,
            totalEarning: currentTotalEarning + earningAmount,
         });
         
        return;
    }
    
    // --- START READ PHASE ---
    const ledgerQuery = query(
        collection(db, "earningPowerLedger"),
        where("userId", "==", userId),
        where("status", "==", "active"),
        orderBy("date", "asc")
    );
    const ledgerSnapshot = await getDocs(ledgerQuery);
    const ledgerEntries = ledgerSnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() } as EarningPowerLedgerEntry));

    const tokenTransactionsMap = new Map<string, { ref: DocumentReference, data: any }>();
    if (earningRules.expireTokensOnPowerUsed && ledgerEntries.length > 0) {
        const sourceIds = ledgerEntries.map((entry: any) => entry.source).filter((id: any) => id); // Filter out undefined/null ids
        if(sourceIds.length > 0) {
            // Firestore 'in' query is limited to 30 values per query.
            const sourceIdChunks = [];
            for (let i = 0; i < sourceIds.length; i += 30) {
                sourceIdChunks.push(sourceIds.slice(i, i + 30));
            }
            
            for (const chunk of sourceIdChunks) {
                const tokenTxQuery = query(
                    collection(db, 'tokenTransactions'),
                    where('userId', '==', userId),
                    where('source', 'in', chunk)
                );
                const tokenTxSnapshot = await getDocs(tokenTxQuery);
                tokenTxSnapshot.forEach((doc: any) => {
                    const data = doc.data();
                    tokenTransactionsMap.set(data.source, { ref: doc.ref, data: data });
                });
            }
        }
    }
    // --- END READ PHASE ---

    // --- START WRITE PHASE ---
    let remainingEarningToProcess = earningAmount;
    let actualEarningCapped = 0;
    let totalTokensToExpire = 0;
    
    for (const entry of ledgerEntries) {
        if (remainingEarningToProcess <= 0) break;

        const availablePowerInEntry = entry.amount - entry.used;
        const amountToConsume = Math.min(remainingEarningToProcess, availablePowerInEntry);
        
        actualEarningCapped += amountToConsume;
        remainingEarningToProcess -= amountToConsume;

        const entryRef = doc(db, "earningPowerLedger", entry.id);
        const newUsedAmount = entry.used + amountToConsume;
        const isExpired = newUsedAmount >= entry.amount;

        transaction.update(entryRef, {
            used: newUsedAmount,
            status: isExpired ? 'expired' : 'active'
        });

        if (isExpired && earningRules.expireTokensOnPowerUsed) {
            const tokenTx = tokenTransactionsMap.get(entry.source);
            if (tokenTx && tokenTx.data.status !== 'expired') {
                transaction.update(tokenTx.ref, { status: 'expired' });
                totalTokensToExpire += tokenTx.data.amount || 0;
            }
        }
    }

    const finalUserUpdate: any = {
        balance: currentBalance + actualEarningCapped + capitalToReturn,
        totalEarning: currentTotalEarning + actualEarningCapped
    };
    
    if (totalTokensToExpire > 0) {
        finalUserUpdate.tokenBalance = Math.max(0, userTokenBalance - totalTokensToExpire);
    }
    
    transaction.update(userRef, finalUserUpdate);
    // --- END WRITE PHASE ---
}
