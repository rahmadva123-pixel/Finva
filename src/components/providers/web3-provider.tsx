
"use client";

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// This is a dummy provider that does nothing.
// It's here to prevent errors in components that might still be
// expecting it, but all WalletConnect functionality has been removed.
export function Web3Provider({ children }: { children: React.ReactNode }) {
    const [isEnabled, setIsEnabled] = useState(false);

    useEffect(() => {
        const checkWalletConnectStatus = async () => {
            if (!db) return;
            try {
                const docRef = doc(db, 'settings', 'walletconnect');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().isEnabled) {
                    setIsEnabled(true);
                } else {
                    setIsEnabled(false);
                }
            } catch (error) {
                console.error("Could not verify WalletConnect status:", error);
                setIsEnabled(false);
            }
        };

        checkWalletConnectStatus();
    }, []);

    // If you ever re-enable WalletConnect, you'll need a real provider here.
    // For now, we just render the children.
    return <>{children}</>;
}
