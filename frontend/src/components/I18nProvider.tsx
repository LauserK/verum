'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from '../messages/en.json';
import es from '../messages/es.json';

type Translations = typeof en;
type Language = 'en' | 'es';

const dictionaries: Record<Language, Translations> = { en, es };

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const savedLang = localStorage.getItem('verum-lang') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'es')) {
      setLanguageState(savedLang);
    } else {
      const browserLang = navigator.language.startsWith('es') ? 'es' : 'en';
      setLanguageState(browserLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('verum-lang', lang);
    document.documentElement.lang = lang;
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = dictionaries[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Fallback to key if not found
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    let text = value;
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        text = text.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      });
    }

    return text;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslations(namespace?: keyof Translations) {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslations must be used within an I18nProvider');
  }

  const { t, language, setLanguage } = context;

  const scopedT = (key: string, params?: Record<string, string | number>) => {
    // If namespace is provided AND it's not an empty string, use it. Otherwise use the key as is.
    const fullKey = namespace && namespace !== '' ? `${namespace}.${key}` : key;
    return t(fullKey, params);
  };

  return { t: scopedT, language, setLanguage };
}
