
'use client'

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

const fetchTranslations = async (language: string) => {
    if (!db) return {};
    try {
        const docRef = doc(db, 'settings', 'languages');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.translations?.[language] || {};
        }
        return {};
    } catch (error) {
        console.error("Could not fetch translations for language:", language, error);
        return {};
    }
};


i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, 
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    resources: {
        en: {
            translation: {} 
        }
    }
  });
  
// Dynamically load translations
i18n.on('languageChanged', async (lng: string) => {
    if (!i18n.hasResourceBundle(lng, 'translation')) {
        const translations = await fetchTranslations(lng);
        i18n.addResourceBundle(lng, 'translation', translations);
        i18n.changeLanguage(lng); // Rerender with new translations
    }
});

// Load initial language
if (i18n.language && !i18n.hasResourceBundle(i18n.language, 'translation')) {
    fetchTranslations(i18n.language).then(translations => {
        i18n.addResourceBundle(i18n.language, 'translation', translations);
        i18n.changeLanguage(i18n.language);
    });
}


export default i18n;
