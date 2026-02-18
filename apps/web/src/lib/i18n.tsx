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

  'common.loading': '...',
  'common.refresh': 'Refresh',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.cancel': 'Cancel',
  'common.note': 'Note',

  'errors.generic': 'Error',
  'errors.offlineQueued': 'Offline: action queued',
  'errors.pushNotSupported': 'Push notifications are not supported in this browser.',
  'errors.pushPermissionDenied': 'Notification permission was denied.',
  'errors.pushMissingVapidKey': 'Missing VAPID public key from backend.',
  'errors.pushNoServiceWorker': 'Service worker not ready. Reload the page and try again.',

  'confirm.deleteEntry': 'Delete entry?',
  'confirm.deleteAbsence': 'Delete absence?',
  'confirm.deleteReason': 'Delete reason?',

  'dashboard.today': 'Today',
  'dashboard.actions': 'Actions',
  'dashboard.month': 'Month',
  'dashboard.status': 'Status',
  'dashboard.worked': 'Worked',
  'dashboard.remaining': 'Remaining',
  'dashboard.break': 'Break',
  'dashboard.breakRemaining': 'Break remaining',
  'dashboard.warningOver10h': 'Warning: worked > 10h',
  'dashboard.warningRest11h': 'Warning: rest period < 11h',
  'dashboard.geolocation': 'Geolocation',
  'dashboard.comeOffice': 'Arrive (office)',
  'dashboard.comeHome': 'Arrive (home office)',
  'dashboard.go': 'Leave',
  'dashboard.breakStart': 'Start break',
  'dashboard.breakEnd': 'End break',
  'dashboard.notePlaceholder': 'Note (multiline)',
  'dashboard.logout': 'Logout',
  'dashboard.absenceFullDay': 'Full-day absence',
  'dashboard.offlineBanner': 'Offline — actions will be queued.',
  'dashboard.queue': 'Queue',
  'dashboard.sync': 'Sync',
  'dashboard.overtimeBalanceToDate': 'Overtime balance (to date)',
  'dashboard.heatmap.beforeOvertimeStart': 'before overtime start date',
  'dashboard.heatmap.absence': 'absence',
  'dashboard.heatmap.note': 'note',

  'auth.sessionExpired': 'Session expired. Please sign in again.',

  'reports.title': 'Reports',
  'reports.week': 'Week',
  'reports.month': 'Month',
  'reports.period': 'Period',
  'reports.work': 'Work',
  'reports.break': 'Break',
  'reports.homeOffice': 'Home office',
  'reports.target': 'Target',
  'reports.warningOver10h': '>10h',
  'reports.warningRest11h': 'Rest<11h',
  'reports.warningBreak': 'Break',

  'history.title': 'History',
  'history.entries': 'entries',
  'history.editEntry': 'Edit entry',
  'history.timeUtc': 'Time (UTC)',
  'history.type': 'Type',
  'history.location': 'Location',
  'history.actions': 'Actions',
  'history.edit': 'Edit',
  'history.delete': 'Delete',

  'absences.title': 'Absences',
  'absences.new': 'New',
  'absences.start': 'Start',
  'absences.end': 'End',
  'absences.reason': 'Reason',
  'absences.create': 'Create',
  'absences.list': 'List',
  'absences.none': 'No absences.',
  'absences.selectPlaceholder': 'Please select',
  'absences.createHint': 'Note: If time entries exist in the range, creation will be rejected.',
  'absences.reasonNew': '+ New reason…',
  'absences.reasonManage': 'Manage reasons…',
  'absences.reasonModalTitle': 'New absence reason',
  'absences.reasonName': 'Name',
  'absences.reasonCreateExample': 'e.g. Vacation',
  'absences.manageReasonsTitle': 'Manage absence reasons',
  'absences.reasonDeleteHint': 'Note: Delete fails if the reason is still used by absences.',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.appLanguage': 'App language',
  'settings.dailyTarget': 'Daily target (minutes)',
  'settings.homeOfficeTarget': 'Home-office target (0..1)',
  'settings.overtimeStart': 'Overtime start date',
  'settings.pushNotifications': 'Push notifications',
  'settings.pushEnable': 'Enable push',
  'settings.pushDisable': 'Disable push',
  'settings.pushTest': 'Test push',
  'settings.pushWorkMinutes': 'Work thresholds (minutes)',
  'settings.pushBreakMinutes': 'Break thresholds (minutes)',
  'settings.pushWorkMinutesHint': 'Comma-separated, e.g. 30, 60, 120',
  'settings.pushBreakMinutesHint': 'Comma-separated, e.g. 10, 20, 30',
  'settings.pushEnabled': 'Enabled',
  'settings.pushDisabled': 'Disabled',
  'settings.saved': 'Saved.',
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

  'common.loading': '...',
  'common.refresh': 'Aktualisieren',
  'common.save': 'Speichern',
  'common.delete': 'Löschen',
  'common.cancel': 'Abbrechen',
  'common.note': 'Notiz',

  'errors.generic': 'Fehler',
  'errors.offlineQueued': 'Offline: Aktion wurde in Queue gespeichert',
  'errors.pushNotSupported': 'Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.',
  'errors.pushPermissionDenied': 'Benachrichtigungs-Berechtigung wurde abgelehnt.',
  'errors.pushMissingVapidKey': 'Fehlender VAPID Public Key vom Backend.',
  'errors.pushNoServiceWorker': 'Service Worker ist nicht bereit. Bitte Seite neu laden und erneut versuchen.',

  'confirm.deleteEntry': 'Eintrag wirklich löschen?',
  'confirm.deleteAbsence': 'Abwesenheit wirklich löschen?',
  'confirm.deleteReason': 'Grund wirklich löschen?',

  'dashboard.today': 'Heute',
  'dashboard.actions': 'Aktionen',
  'dashboard.month': 'Monat',
  'dashboard.status': 'Status',
  'dashboard.worked': 'Gearbeitet',
  'dashboard.remaining': 'Noch',
  'dashboard.break': 'Pause',
  'dashboard.breakRemaining': 'Pause noch',
  'dashboard.warningOver10h': 'Warnung: > 10h gearbeitet',
  'dashboard.warningRest11h': 'Warnung: Ruhezeit < 11h',
  'dashboard.geolocation': 'Geolocation',
  'dashboard.comeOffice': 'Kommen Büro',
  'dashboard.comeHome': 'Kommen Home Office',
  'dashboard.go': 'Gehen',
  'dashboard.breakStart': 'Pause Beginn',
  'dashboard.breakEnd': 'Pause Ende',
  'dashboard.notePlaceholder': 'Notiz (mehrzeilig)',
  'dashboard.logout': 'Abmelden',
  'dashboard.absenceFullDay': 'Ganztägige Abwesenheit',
  'dashboard.offlineBanner': 'Offline – Aktionen werden zwischengespeichert.',
  'dashboard.queue': 'Queue',
  'dashboard.sync': 'Sync',
  'dashboard.overtimeBalanceToDate': 'Stundenkonto (bis heute)',
  'dashboard.heatmap.beforeOvertimeStart': 'vor Startdatum Stundenkonto',
  'dashboard.heatmap.absence': 'Abwesenheit',
  'dashboard.heatmap.note': 'Notiz',

  'auth.sessionExpired': 'Session abgelaufen. Bitte erneut anmelden.',

  'reports.title': 'Reports',
  'reports.week': 'Woche',
  'reports.month': 'Monat',
  'reports.period': 'Zeitraum',
  'reports.work': 'Arbeit',
  'reports.break': 'Pause',
  'reports.homeOffice': 'Home Office',
  'reports.target': 'Ziel',
  'reports.warningOver10h': '>10h',
  'reports.warningRest11h': 'Ruhezeit<11h',
  'reports.warningBreak': 'Pause',

  'history.title': 'History',
  'history.entries': 'Einträge',
  'history.editEntry': 'Eintrag bearbeiten',
  'history.timeUtc': 'Zeit (UTC)',
  'history.type': 'Typ',
  'history.location': 'Location',
  'history.actions': 'Aktionen',
  'history.edit': 'Bearbeiten',
  'history.delete': 'Löschen',

  'absences.title': 'Abwesenheiten',
  'absences.new': 'Neu',
  'absences.start': 'Start',
  'absences.end': 'Ende',
  'absences.reason': 'Grund',
  'absences.create': 'Anlegen',
  'absences.list': 'Liste',
  'absences.none': 'Keine Abwesenheiten.',
  'absences.selectPlaceholder': 'Bitte wählen',
  'absences.createHint': 'Hinweis: Wenn bereits Zeitbuchungen im Zeitraum existieren, wird das Anlegen abgelehnt.',
  'absences.reasonNew': '+ Neuer Grund…',
  'absences.reasonManage': 'Gründe verwalten…',
  'absences.reasonModalTitle': 'Neuer Abwesenheitsgrund',
  'absences.reasonName': 'Name',
  'absences.reasonCreateExample': 'z.B. Urlaub',
  'absences.manageReasonsTitle': 'Abwesenheitsgründe verwalten',
  'absences.reasonDeleteHint': 'Hinweis: Löschen schlägt fehl, wenn der Grund noch von Abwesenheiten verwendet wird.',
  'absences.noReasons': 'Keine Gründe.',

  'settings.title': 'Einstellungen',
  'settings.language': 'Sprache',
  'settings.appLanguage': 'App Sprache',
  'settings.dailyTarget': 'Sollarbeitszeit pro Tag (Minuten)',
  'settings.homeOfficeTarget': 'Home-Office Ziel (0..1)',
  'settings.overtimeStart': 'Startdatum Stundenkonto',
  'settings.pushNotifications': 'Push-Benachrichtigungen',
  'settings.pushEnable': 'Push aktivieren',
  'settings.pushDisable': 'Push deaktivieren',
  'settings.pushTest': 'Test push',
  'settings.pushWorkMinutes': 'Schwellen Arbeit (Minuten)',
  'settings.pushBreakMinutes': 'Schwellen Pause (Minuten)',
  'settings.pushWorkMinutesHint': 'Kommagetrennt, z.B. 30, 60, 120',
  'settings.pushBreakMinutesHint': 'Kommagetrennt, z.B. 10, 20, 30',
  'settings.pushEnabled': 'Aktiv',
  'settings.pushDisabled': 'Inaktiv',
  'settings.saved': 'Gespeichert.',
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
