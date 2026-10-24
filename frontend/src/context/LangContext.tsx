import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ta';
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
];

const KEY = 'shelterLang';

/** Small label dictionary for the public shelter panels. Shelter content itself comes from the shelter translations table. */
const DICT: Record<Lang, Record<string, string>> = {
  en: {
    findShelter: 'Find a shelter',
    bedsFree: 'beds free',
    registerFamily: 'Register family',
    viewDetails: 'View details',
    supplies: 'Supplies',
    contact: 'Contact',
    instructions: 'Arrival instructions',
    medicalSupport: 'Medical support',
    fallbackNote: 'This shelter has no Tamil translation yet — showing English.',
  },
  ta: {
    findShelter: 'தங்குமிடத்தைத் தேடுங்கள்',
    bedsFree: 'படுக்கைகள் காலி',
    registerFamily: 'குடும்பத்தைப் பதிவு செய்',
    viewDetails: 'விவரங்கள்',
    supplies: 'பொருட்கள்',
    contact: 'தொடர்பு',
    instructions: 'வருகை வழிமுறைகள்',
    medicalSupport: 'மருத்துவ உதவி',
    fallbackNote: 'இந்த தங்குமிடத்திற்கு தமிழ் மொழிபெயர்ப்பு இன்னும் இல்லை — ஆங்கிலத்தில் காட்டப்படுகிறது.',
  },
};

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType | undefined>(undefined);

const read = (): Lang => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ta' ? 'ta' : 'en';
  } catch {
    return 'en';
  }
};

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(read);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }, []);
  const value = useMemo<LangContextType>(() => ({ lang, setLang, t: (k) => DICT[lang][k] ?? DICT.en[k] ?? k }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within a LangProvider');
  return ctx;
};
