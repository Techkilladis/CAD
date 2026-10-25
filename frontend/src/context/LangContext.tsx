import { createContext, useContext } from 'react';

export type Lang = 'en' | 'ta';
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
];

export const KEY = 'shelterLang';

/** Small label dictionary for the public shelter panels. Shelter content itself comes from the shelter translations table. */
export const DICT: Record<Lang, Record<string, string>> = {
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

export interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

export const LangContext = createContext<LangContextType | undefined>(undefined);

export const read = (): Lang => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ta' ? 'ta' : 'en';
  } catch {
    return 'en';
  }
};

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within a LangProvider');
  return ctx;
};