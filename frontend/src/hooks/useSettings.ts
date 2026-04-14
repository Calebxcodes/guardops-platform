const STORAGE_KEY = 'strondis_settings'

export interface AppSettings {
  company_name: string
  email: string
  phone: string
  timezone: string
  currency: string
  currency_symbol: string
  pay_frequency: string
  overtime_threshold: number
  overtime_multiplier: number
  tax_rate: number
  max_hours_day: number
  max_hours_week: number
  min_break_hours: number
  max_consecutive_days: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  company_name: 'Strondis Security',
  email: 'admin@strondis.com',
  phone: '',
  timezone: 'Europe/London',
  currency: 'GBP',
  currency_symbol: '£',
  pay_frequency: 'bi-weekly',
  overtime_threshold: 40,
  overtime_multiplier: 1.5,
  tax_rate: 20,
  max_hours_day: 12,
  max_hours_week: 60,
  min_break_hours: 8,
  max_consecutive_days: 6,
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function formatCurrency(amount: number): string {
  const settings = loadSettings()
  return `${settings.currency_symbol}${amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
