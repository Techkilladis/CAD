import type { ReactNode } from 'react';
import { LangContext, read, KEY, DICT } from './LangContext';
import type { Lang, LangContextType } from './LangContext';
import { useCallback, useMemo, useState } from 'react';

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
  const value = useMemo<LangContextType>(() => ({ lang, setLang, t: (k: string) => DICT[lang][k] ?? DICT.en[k] ?? k }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}