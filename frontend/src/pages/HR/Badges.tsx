import { useState, useEffect } from 'react'
import { ShieldCheck, Search, ArrowLeft, Clock, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { badgesApi } from '../../api'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

interface GuardBadgeRow {
  id: number
  first_name: string
  last_name: string
  email: string
  status: string
  badge_id: number | null
  sia_license_number: string | null
  sia_expiry_date: string | null
  badge_number: string | null
  card_type: string | null
  photo_url: string | null
  badge_status: string | null
  badge_uploaded_at: string | null
}

interface BadgeDetail {
  current: any
  history: any[]
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysLeft(expiry: string): number {
  return Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
}

function getBadgeStatus(row: GuardBadgeRow) {
  if (!row.badge_id) return { label: 'No Badge', colour: 'text-gray-400', bg: 'bg-gray-700/50', icon: X }
  const d = row.sia_expiry_date ? daysLeft(row.sia_expiry_date) : null
  if (d === null) return { label: 'Unknown Expiry', colour: 'text-gray-400', bg: 'bg-gray-700/50', icon: AlertTriangle }
  if (d < 0)   return { label: 'Expired', colour: 'text-red-400', bg: 'bg-red-400/10', icon: X }
  if (d <= 30) return { label: `Expires in ${d}d`, colour: 'text-amber-400', bg: 'bg-amber-400/10', icon: Clock }
  return { label: 'Valid', colour: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle2 }
}

function initials(first: string, last: string) {
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase()
}

export default function GuardBadges() {
  const navigate = useNavigate()
  const [guards, setGuards] = useState<GuardBadgeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'none' | 'expired' | 'expiring' | 'valid'>('all')
  const [selected, setSelected] = useState<GuardBadgeRow | null>(null)
  const [detail, setDetail] = useState<BadgeDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    badgesApi.list()
      .then(setGuards)
      .finally(() => setLoading(false))
  }, [])

  const selectGuard = async (g: GuardBadgeRow) => {
    setSelected(g)
    setDetailLoading(true)
    try {
      const data = await badgesApi.guardBadges(g.id)
      setDetail(data)
    } finally {
      setDetailLoading(false)
    }
  }

  const filtered = guards.filter(g => {
    const name = `${g.first_name} ${g.last_name}`.toLowerCase()
    const matchSearch = name.includes(search.toLowerCase()) || (g.email || '').toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    const d = g.sia_expiry_date ? daysLeft(g.sia_expiry_date) : null
    if (filter === 'none')    return !g.badge_id
    if (filter === 'expired') return g.badge_id && d !== null && d < 0
    if (filter === 'expiring') return g.badge_id && d !== null && d >= 0 && d <= 30
    if (filter === 'valid')   return g.badge_id && d !== null && d > 30
    return true
  })

  const counts = {
    none:     guards.filter(g => !g.badge_id).length,
    expired:  guards.filter(g => g.badge_id && g.sia_expiry_date && daysLeft(g.sia_expiry_date) < 0).length,
    expiring: guards.filter(g => g.badge_id && g.sia_expiry_date && daysLeft(g.sia_expiry_date) >= 0 && daysLeft(g.sia_expiry_date) <= 30).length,
    valid:    guards.filter(g => g.badge_id && g.sia_expiry_date && daysLeft(g.sia_expiry_date) > 30).length,
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/hr')} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guard Badge Verification</h1>
          <p className="text-gray-500 text-sm mt-0.5">SIA badge status across all officers</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Valid',        count: counts.valid,    colour: 'border-emerald-200 bg-emerald-50 text-emerald-700', key: 'valid' as const },
          { label: 'Expiring Soon', count: counts.expiring, colour: 'border-amber-200 bg-amber-50 text-amber-700', key: 'expiring' as const },
          { label: 'Expired',      count: counts.expired,  colour: 'border-red-200 bg-red-50 text-red-700', key: 'expired' as const },
          { label: 'No Badge',     count: counts.none,     colour: 'border-gray-200 bg-gray-50 text-gray-700', key: 'none' as const },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(f => f === s.key ? 'all' : s.key)}
            className={clsx(
              'border rounded-xl p-4 text-left transition-all',
              s.colour,
              filter === s.key ? 'ring-2 ring-offset-1 ring-current' : 'hover:shadow-sm'
            )}
          >
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-4 lg:gap-6">
        {/* Guard list */}
        <div className={clsx('flex-1 min-w-0', selected ? 'hidden lg:block lg:max-w-sm' : '')}>
          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search officers..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">No officers match this filter.</div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(g => {
                const bs = getBadgeStatus(g)
                const StatusIcon = bs.icon
                return (
                  <button
                    key={g.id}
                    onClick={() => selectGuard(g)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors',
                      selected?.id === g.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm shrink-0">
                      {initials(g.first_name, g.last_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-medium text-sm truncate">{g.first_name} {g.last_name}</p>
                      <p className="text-gray-400 text-xs truncate">{g.email}</p>
                    </div>
                    <span className={clsx('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0', bs.bg, bs.colour)}>
                      <StatusIcon size={10} />
                      {bs.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Badge detail panel */}
        {selected && (
          <div className="flex-1 min-w-0">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelected(null)} className="lg:hidden text-gray-400 hover:text-gray-600 mr-1">
                    <ArrowLeft size={18} />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                    {initials(selected.first_name, selected.last_name)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selected.first_name} {selected.last_name}</p>
                    <p className="text-gray-400 text-xs">{selected.email}</p>
                  </div>
                </div>
                <ShieldCheck size={20} className="text-blue-500" />
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : detail?.current ? (
                <div className="space-y-4">
                  {detail.current.photo_url && (
                    <img
                      src={detail.current.photo_url}
                      alt="Badge"
                      className="w-full rounded-xl object-contain bg-gray-50 border border-gray-100 max-h-48"
                    />
                  )}

                  {(() => {
                    const bs = getBadgeStatus(selected)
                    const StatusIcon = bs.icon
                    const d = detail.current.sia_expiry_date ? daysLeft(detail.current.sia_expiry_date) : null
                    return (
                      <div className={clsx('rounded-xl px-4 py-3 flex items-center gap-2', bs.bg)}>
                        <StatusIcon size={16} className={bs.colour} />
                        <span className={clsx('text-sm font-semibold', bs.colour)}>
                          {d !== null && d < 0 ? `Expired ${Math.abs(d)} days ago` :
                           d !== null && d <= 30 ? `Expires in ${d} days` :
                           d !== null ? `Valid — ${d} days remaining` : 'Status unknown'}
                        </span>
                      </div>
                    )
                  })()}

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'SIA License', value: detail.current.sia_license_number },
                      { label: 'Expiry Date', value: detail.current.sia_expiry_date ? fmt(detail.current.sia_expiry_date) : null },
                      { label: 'Badge Number', value: detail.current.badge_number },
                      { label: 'Card Type', value: detail.current.card_type },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                        <p className="text-gray-400 text-xs">{label}</p>
                        <p className="text-gray-900 font-medium text-sm mt-0.5">{value || '—'}</p>
                      </div>
                    ))}
                  </div>

                  {detail.history.length > 1 && (
                    <div>
                      <p className="text-gray-500 text-sm font-medium mb-2">Badge History</p>
                      <div className="space-y-1.5">
                        {detail.history.filter((b: any) => !b.is_current).map((b: any) => (
                          <div key={b.id} className="bg-gray-50 rounded-xl px-3 py-2 flex items-center justify-between">
                            <div>
                              <p className="text-gray-700 text-sm">{b.sia_license_number || 'Unknown'}</p>
                              <p className="text-gray-400 text-xs">
                                Expiry: {b.sia_expiry_date ? fmt(b.sia_expiry_date) : '—'}
                              </p>
                            </div>
                            <p className="text-gray-400 text-xs">{fmt(b.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center gap-3 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                    <ShieldCheck size={24} className="text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">No badge uploaded</p>
                  <p className="text-gray-400 text-sm">This officer has not yet uploaded their SIA badge.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
