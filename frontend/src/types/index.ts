export interface Guard {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  address?: string
  date_of_birth?: string
  employment_type: 'full-time' | 'part-time' | 'on-call' | 'contractor'
  status: 'on-duty' | 'off-duty' | 'on-leave' | 'inactive'
  hourly_rate: number
  certifications: Certification[]
  skills: string[]
  bank_account?: string
  bank_routing?: string
  notes?: string
  active: number
  created_at: string
  active_shifts?: number
}

export interface Certification {
  name: string
  expiry: string
}

export interface Client {
  id: number
  name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  notes?: string
  active: number
  created_at: string
  site_count?: number
}

export interface Site {
  id: number
  client_id: number
  client_name?: string
  name: string
  address?: string
  lat?: number
  lng?: number
  requirements?: string
  post_orders?: string
  guards_required: number
  hourly_rate: number
  active: number
  created_at: string
  active_shifts?: number
  assigned_guards?: number
}

export interface Shift {
  id: number
  site_id: number
  guard_id?: number
  site_name?: string
  client_name?: string
  first_name?: string
  last_name?: string
  start_time: string
  end_time: string
  status: 'unassigned' | 'assigned' | 'active' | 'completed' | 'cancelled'
  hourly_rate: number
  break_minutes: number
  notes?: string
  created_at: string
}

export interface Timesheet {
  id: number
  guard_id: number
  shift_id?: number
  first_name?: string
  last_name?: string
  period_start: string
  period_end: string
  regular_hours: number
  overtime_hours: number
  total_hours: number
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  source: 'mobile' | 'manual' | 'ocr'
  manager_notes?: string
  guard_notes?: string
  submitted_at?: string
  approved_at?: string
  created_at: string
}

export interface PayrollRecord {
  id: number
  guard_id: number
  first_name?: string
  last_name?: string
  hourly_rate?: number
  period_start: string
  period_end: string
  regular_hours: number
  overtime_hours: number
  regular_pay: number
  overtime_pay: number
  bonuses: number
  deductions: number
  gross_pay: number
  net_pay: number
  status: 'pending' | 'approved' | 'paid'
  processed_at?: string
  created_at: string
}

export interface Incident {
  id: number
  site_id: number
  guard_id?: number
  shift_id?: number
  site_name?: string
  first_name?: string
  last_name?: string
  type: string
  severity: 'minor' | 'major' | 'critical'
  description?: string
  resolved: number
  resolved_at?: string
  created_at: string
}

export interface DashboardMetrics {
  guards_on_duty: number
  total_guards: number
  uncovered_shifts: number
  today_shifts: number
  pending_timesheets: number
  revenue_this_month: number
  payroll_cost_this_month: number
  today_shift_list: Shift[]
  recent_incidents: Incident[]
}

export interface FinancialData {
  monthlyRevenue: { month: string; revenue: number; shift_count: number }[]
  revenueByClient: { name: string; revenue: number }[]
  monthlyPayroll: { month: string; cost: number }[]
  guardUtilization: { name: string; hours_worked: number }[]
}
