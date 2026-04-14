export interface GuardUser {
  id: number
  first_name: string
  last_name: string
  email: string
  phone?: string
  address?: string
  status: string
  employment_type: string
  hourly_rate: number
  certifications: { name: string; expiry: string; licence_number?: string }[]
  skills: string[]
  avatar_url?: string
  created_at?: string
  has_face_id?: boolean
}

export interface GuardShift {
  id: number
  site_id: number
  guard_id: number
  site_name: string
  site_address?: string
  client_name?: string
  site_phone?: string
  lat?: number
  lng?: number
  requirements?: string
  post_orders?: string
  start_time: string
  end_time: string
  status: 'unassigned' | 'assigned' | 'active' | 'completed' | 'cancelled'
  hourly_rate: number
  break_minutes: number
  notes?: string
}

export interface ClockEvent {
  id: number
  guard_id: number
  shift_id: number
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'
  lat?: number
  lng?: number
  accuracy?: number
  photo_url?: string
  notes?: string
  face_verified?: number
  created_at: string
}

export interface GuardTimesheet {
  id: number
  guard_id: number
  shift_id?: number
  site_name?: string
  period_start: string
  period_end: string
  regular_hours: number
  overtime_hours: number
  total_hours: number
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  source: string
  guard_notes?: string
  manager_notes?: string
  submitted_at?: string
  approved_at?: string
  created_at: string
}

export interface Message {
  id: number
  from_guard_id?: number
  to_guard_id?: number
  from_first?: string
  from_last?: string
  body: string
  is_emergency: number
  read_at?: string
  created_at: string
}

export interface Incident {
  id: number
  site_id?: number
  site_name?: string
  type: string
  severity: 'minor' | 'major' | 'critical'
  description?: string
  resolved: number
  created_at: string
}

export interface RouteCheckpoint {
  id: number
  site_id: number
  name: string
  lat: number
  lng: number
  order_num: number
  instructions?: string
  checked_in?: boolean
  checked_in_at?: string
}

export interface PayRecord {
  id: number
  period_start: string
  period_end: string
  regular_hours: number
  overtime_hours: number
  gross_pay: number
  net_pay: number
  status: string
  processed_at?: string
}
