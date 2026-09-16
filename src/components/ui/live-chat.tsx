
"use client";

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export function LiveChat() {
  const [scriptContent, setScriptContent] = useState('');

  useEffect(() => {
    const fetchScript = async () => {
      if (db) {
        try {
          const docRef = doc(db, 'template', 'landingPage');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().tawkToScript) {
            let script = docSnap.data().tawkToScript as string;
            
            // Remove HTML comments
            script = script.replace(/<!--[\s\S]*?-->/g, '');

            // Ensure the widget is positioned correctly
            if (!script.includes('Tawk_API.onLoad')) {
                script = script.replace(/(var Tawk_API\s*=\s*Tawk_API\s*\|\|\s*{)\s*(,)/, '$1, Tawk_API.onLoad = function(){ Tawk_API.setWidgetPosition("bottom-left"); };$2');
            } else if (!script.includes('setWidgetPosition')) {
                 script = script.replace(/(Tawk_API\.onLoad\s*=\s*function\(\)\s*{)/g, '$1 Tawk_API.setWidgetPosition("bottom-left");');
            }
            
            // Extract content from inside the <script> tags
            const scriptTagRegex = /<script.*?>([\s\S]*?)<\/script>/i;
            const match = script.match(scriptTagRegex);

            if (match && match[1]) {
                setScriptContent(match[1]);
            } else {
                // Fallback for just the script content without tags
                setScriptContent(script);
            }
          }
        } catch (error) {
          console.error("Failed to load Tawk.to script from Firestore:", error);
        }
      }
    };
    fetchScript();
  }, []);

  if (!scriptContent) {
    return null;
  }

  return (
    <Script
      id="tawk-to-script"
      strategy="lazyOnload"
      dangerouslySetInnerHTML={{
        __html: scriptContent,
      }}
    />
  );
}
