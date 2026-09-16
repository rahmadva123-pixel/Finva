
"use client";

import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function OneSignalInitializer() {
  useEffect(() => {
    const initOneSignal = async () => {
      // 1. Fetch the App ID from Firestore
      if (!db) return;
      let appId = "";
      try {
        const docRef = doc(db, 'settings', 'pushNotifications');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          appId = docSnap.data().oneSignalAppId;
        }
      } catch (error) {
        console.error("Failed to fetch OneSignal App ID:", error);
      }

      if (!appId) {
        console.log("OneSignal App ID not found in settings. Aborting initialization.");
        return;
      }

      // 2. Add the main SDK script to the page
      const sdkScript = document.createElement('script');
      sdkScript.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      sdkScript.defer = true;
      document.head.appendChild(sdkScript);

      // 3. Add the initialization script using the OneSignalDeferred array
      sdkScript.onload = () => {
        (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
        (window as any).OneSignalDeferred.push(function(OneSignal: any) {
          OneSignal.init({
            appId: appId,
          });
        });
      };
    };

    // Ensure this runs only once on the client
    if (typeof window !== 'undefined') {
      initOneSignal();
    }
  }, []);

  return null; // This component does not render anything itself
}
