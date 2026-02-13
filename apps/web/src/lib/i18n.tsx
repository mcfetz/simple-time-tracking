import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Lang = 'en' | 'de'

const STORAGE_KEY = 'stt_lang_v1'

type Dict = Record<string, string>

const EN: Dict = {
  'app.name.short': 'STT',
  'app.name.long': 'Simple Time Tracking',

  'nav.today': 'Today',
  'nav.history': 'History',
  'nav.reports': 'Reports',
  'nav.absences': 'Abs.',
  'nav.settings': 'Settings',

  'auth.login.title': 'Please sign in.',
  'auth.login.email': 'Email',
  'auth.login.password': 'Password',
  'auth.login.submit': 'Login',
  'auth.login.noAccount': 'No account?',
  'auth.login.register': 'Register',

  'auth.register.title': 'Create account.',
  'auth.register.email': 'Email',
  'auth.register.password': 'Password (min. 8 chars)',
  'auth.register.submit': 'Create account',
  'auth.register.hasAccount': 'Already registered?',
  'auth.register.toLogin': 'Go to login',

  'common.close': 'Close',
}

const DE: Dict = {
  'app.name.short': 'STT',
  'app.name.long': 'Simple Time Tracking',

  'nav.today': 'Heute',
  'nav.history': 'History',
  'nav.reports': 'Reports',
  'nav.absences': 'Abw.',
  'nav.settings': 'Settings',

  'auth.login.title': 'Bitte anmelden.',
  'auth.login.email': 'E-Mail',
  'auth.login.password': 'Passwort',
  'auth.login.submit': 'Login',
  'auth.login.noAccount': 'Kein Account?',
  'auth.login.register': 'Registrieren',

  'auth.register.title': 'Account erstellen.',
  'auth.register.email': 'E-Mail',
  'auth.register.password': 'Passwort (min. 8 Zeichen)',
  'auth.register.submit': 'Account erstellen',
  'auth.register.hasAccount': 'Schon registriert?',
  'auth.register.toLogin': 'Zum Login',

  'common.close': 'Schließen',
}

function detectInitialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'de' || stored === 'en') return stored

  const navLang = (navigator.language || 'en').toLowerCase()
  const initial: Lang = navLang.startsWith('de') ? 'de' : 'en'
  localStorage.setItem(STORAGE_KEY, initial)
  return initial
}

type I18nContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider(props: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => detectInitialLang())

  const dict = lang === 'de' ? DE : EN

  const t = useMemo(() => {
    return (key: string) => dict[key] ?? key
  }, [dict])

  const setLang = (next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, t])
  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('I18nProvider missing')
  return ctx
}
