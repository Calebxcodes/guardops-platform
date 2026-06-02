import { useEffect, useState, useCallback } from 'react'
import { UserCheck, UserX, Mail, Phone, Calendar, Loader, RefreshCw } from 'lucide-react'
import { guardsApi } from '../../api'
import { format, parseISO } from 'date-fns'

type PendingGuard = {
  id: number
  first_name: string
  last_name: string
  email: string
  phone?: string
  date_of_birth?: string
  created_at: string
}

export default function PendingApprovals() {
  const [guards,  setGuards]  = useState<PendingGuard[]>([])
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    guardsApi.listPending()
      .then(d => setGuards(d.pending || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleActivate = async (id: number) => {
    setActing(id)
    try {
      await guardsApi.activate(id)
      setGuards(g => g.filter(x => x.id !== id))
    } finally { setActing(null) }
  }

  const handleReject = async (id: number) => {
    setActing(id)
    try {
      await guardsApi.reject(id)
      setGuards(g => g.filter(x => x.id !== id))
    } finally { setActing(null) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={20} className="animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Pending Approvals
            {guards.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-6 h-6 text-xs font-bold bg-amber-500 text-white rounded-full">
                {guards.length}
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Guards who have signed up and are awaiting activation
          </p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <RefreshCw size={16} />
        </button>
      </div>

      {guards.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <UserCheck size={36} className="mx-auto mb-3 opacity-30" />
          <p>No pending approvals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {guards.map(guard => (
            <div
              key={guard.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {guard.first_name} {guard.last_name}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <Mail size={13} /> {guard.email}
                  </div>
                  {guard.phone && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                      <Phone size={13} /> {guard.phone}
                    </div>
                  )}
                  {guard.date_of_birth && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                      <Calendar size={13} /> DOB: {guard.date_of_birth}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Applied {format(new Date(guard.created_at), 'dd MMM yyyy HH:mm')}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleActivate(guard.id)}
                  disabled={acting === guard.id}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {acting === guard.id ? <Loader size={14} className="animate-spin" /> : <UserCheck size={14} />}
                  Approve
                </button>
                <button
                  onClick={() => handleReject(guard.id)}
                  disabled={acting === guard.id}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-red-900/30 text-slate-700 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400 text-sm font-medium rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                >
                  {acting === guard.id ? <Loader size={14} className="animate-spin" /> : <UserX size={14} />}
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
