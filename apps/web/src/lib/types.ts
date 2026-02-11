export type AuthResponse = {
  token: {
    access_token: string
    token_type: string
  }
  user: {
    id: number
    email: string
    timezone: string
  }
}

export type DailyStatusResponse = {
  date_local: string
  timezone: string

  state: 'OFF' | 'WORKING' | 'BREAK'
  worked_minutes: number
  target_minutes: number
  remaining_work_minutes: number

  break_minutes: number
  required_break_minutes: number
  remaining_break_minutes: number

  required_continuous_break_minutes: number
  max_continuous_break_minutes: number
  remaining_continuous_break_minutes: number

  last_event_type: string | null
  last_event_ts_utc: string | null

  max_daily_work_exceeded: boolean
  rest_period_minutes: number | null
  rest_period_violation: boolean
}

export type UserSettings = {
  daily_target_minutes: number
  home_office_target_ratio: number
}

export type CreateClockEventRequest = {
  type: 'COME' | 'GO' | 'BREAK_START' | 'BREAK_END'
  location?: 'HOME' | 'OFFICE'
  geo?: { lat: number; lng: number; accuracy_m?: number | null }
  ts_utc?: string
  client_event_id?: string
}

export type ClockEvent = {
  id: number
  ts_utc: string
  type: 'COME' | 'GO' | 'BREAK_START' | 'BREAK_END'
  location: 'HOME' | 'OFFICE' | null
  geo: { lat: number; lng: number; accuracy_m?: number | null } | null
  client_event_id: string | null
}

export type ReportDay = {
  date_local: string
  worked_minutes: number
  break_minutes: number
  required_break_minutes: number
  break_compliant_total: boolean
  required_continuous_break_minutes: number
  max_continuous_break_minutes: number
  break_compliant_continuous: boolean
  has_open_interval: boolean
  home_minutes: number
  office_minutes: number
  max_daily_work_exceeded: boolean
  rest_period_minutes: number | null
  rest_period_violation: boolean
}

export type WeekReport = {
  week_start_local: string
  week_end_local_exclusive: string
  timezone: string
  total_worked_minutes: number
  total_break_minutes: number
  days: ReportDay[]
}

export type MonthReport = {
  month_start_local: string
  month_end_local_exclusive: string
  timezone: string
  total_worked_minutes: number
  total_break_minutes: number
  worked_days: number
  home_office_days: number
  home_office_ratio: number
  home_office_target_ratio: number
  days: ReportDay[]
}
