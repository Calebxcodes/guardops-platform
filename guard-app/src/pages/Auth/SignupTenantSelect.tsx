import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Search, Building2, Loader, AlertCircle } from 'lucide-react'
import { guardSignupApi } from '../../api'

type Tenant = { id: number; name: string; slug: string }

export default function SignupTenantSelect() {
  const navigate = useNavigate()
  const [tenants, setTenants]   = useState<Tenant[]>([])
  const [search,  setSearch]    = useState('')
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState('')

  useEffect(() => {
    guardSignupApi.listTenants()
      .then(data => setTenants(data.tenants))
      .catch(() => setError('Could not load companies. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (tenant: Tenant) => {
    // Pass tenantId via state so signup page can use it without needing slug redirect
    navigate('/signup/guard', { state: { tenantId: tenant.id, tenantName: tenant.name, tenantSlug: tenant.slug } })
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center px-6 py-12">
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 bg-brand-900 border-2 border-brand-600 rounded-3xl flex items-center justify-center mb-4 shadow-2xl shadow-brand-900/50">
          <Shield size={40} className="text-brand-400" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Join Strondis</h1>
        <p className="text-white/40 text-sm mt-1">Select your company to sign up</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
            <AlertCircle size={16} className="shrink-0" />{error}
          </div>
        )}

        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company..."
            className="w-full bg-surface-card border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-white/20 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader size={24} className="animate-spin text-brand-400" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-white/30 py-8">No companies found</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className="w-full flex items-center gap-3 bg-surface-card hover:bg-white/5 border border-white/5 hover:border-brand-500/30 rounded-xl px-4 py-3.5 transition-all text-left"
              >
                <div className="w-9 h-9 bg-brand-900/60 rounded-xl flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-brand-400" />
                </div>
                <span className="text-white font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-white/30 text-xs pt-2">
          Already have an account?{' '}
          <a href="/login" className="text-brand-400 hover:text-brand-300">Sign in</a>
        </p>
      </div>
    </div>
  )
}
