import { useState, useRef, useEffect } from 'react'
import { Site, Client } from '../../types'
import { MapPin, CheckCircle, AlertCircle, Loader, RefreshCw } from 'lucide-react'

interface Props { site: Site | null; clients: Client[]; onSave: (d: any) => void; onCancel: () => void }

type GeoStatus = 'idle' | 'loading' | 'found' | 'error'

export default function SiteForm({ site, clients, onSave, onCancel }: Props) {
  const [form, setForm] = useState({
    client_id:       site?.client_id     || '',
    name:            site?.name          || '',
    address:         site?.address       || '',
    lat:             site?.lat           ?? null as number | null,
    lng:             site?.lng           ?? null as number | null,
    geofence_radius: site?.geofence_radius ?? 183,
    requirements:    site?.requirements  || '',
    post_orders:     site?.post_orders   || '',
    guards_required: site?.guards_required || 1,
    hourly_rate:     site?.hourly_rate   || 0,
  })
  const [geoStatus, setGeoStatus] = useState<GeoStatus>(
    site?.lat && site?.lng ? 'found' : 'idle'
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // When editing an existing site: re-geocode the address to refresh/fix any stale coordinates
  useEffect(() => {
    if (site?.address && !(site?.lat && site?.lng)) {
      geocodeAddress(site.address)
    }
  }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const geocodeAddress = async (address: string) => {
    if (!address.trim()) { setGeoStatus('idle'); return }
    setGeoStatus('loading')
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en-GB,en' } }
      )
      const data = await res.json()
      if (data[0]) {
        setForm(f => ({ ...f, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }))
        setGeoStatus('found')
      } else {
        setForm(f => ({ ...f, lat: null, lng: null }))
        setGeoStatus('error')
      }
    } catch {
      setGeoStatus('error')
    }
  }

  const handleAddressChange = (value: string) => {
    set('address', value)
    // Debounce geocoding — fire 800ms after user stops typing
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setGeoStatus('loading')
    debounceRef.current = setTimeout(() => geocodeAddress(value), 800)
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div>
        <label className="label">Client *</label>
        <select className="input" required value={form.client_id} onChange={e => set('client_id', e.target.value)}>
          <option value="">Select client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="label">Site Name *</label>
        <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} />
      </div>

      <div>
        <label className="label">Address</label>
        <div className="relative">
          <input
            className="input pr-8"
            value={form.address}
            onChange={e => handleAddressChange(e.target.value)}
            placeholder="Start typing an address to auto-locate..."
          />
          {/* Geocode status icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {geoStatus === 'loading' && <Loader size={14} className="animate-spin text-gray-400" />}
            {geoStatus === 'found'   && <CheckCircle size={14} className="text-green-500" />}
            {geoStatus === 'error'   && <AlertCircle size={14} className="text-orange-400" />}
            {geoStatus !== 'loading' && form.address && (
              <button
                type="button"
                title="Re-geocode address"
                onClick={() => geocodeAddress(form.address)}
                className="text-gray-400 hover:text-gray-600 pointer-events-auto"
              >
                <RefreshCw size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Location feedback */}
        {geoStatus === 'found' && form.lat != null && (
          <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
            <MapPin size={11} />
            Location found: {form.lat.toFixed(5)}, {form.lng?.toFixed(5)} — geofencing enabled
          </p>
        )}

        {/* Geofence radius — only shown when site has coordinates */}
        {geoStatus === 'found' && form.lat != null && (
          <div className="mt-3">
            <label className="label">Geofence Radius (metres)</label>
            <div className="flex items-center gap-3">
              <input
                className="input w-28"
                type="number"
                min="50"
                max="5000"
                step="10"
                value={form.geofence_radius}
                onChange={e => set('geofence_radius', parseInt(e.target.value) || 183)}
              />
              <span className="text-xs text-gray-400">
                ≈ {Math.round(form.geofence_radius * 1.09361)} yards — guards must be within this distance to clock in/out
              </span>
            </div>
          </div>
        )}
        {geoStatus === 'error' && (
          <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
            <AlertCircle size={11} />
            Address not found — guards can still clock in but geofencing will be disabled for this site
          </p>
        )}
        {geoStatus === 'idle' && (
          <p className="text-xs text-gray-400 mt-1">
            Enter a full address to automatically enable GPS geofencing for clock-in/out
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Guards Required</label>
          <input className="input" type="number" min="1" value={form.guards_required} onChange={e => set('guards_required', parseInt(e.target.value))} />
        </div>
        <div>
          <label className="label">Client Billing Rate (£/hr)</label>
          <input className="input" type="number" min="0" step="0.5" value={form.hourly_rate} onChange={e => set('hourly_rate', parseFloat(e.target.value))} />
        </div>
      </div>

      <div>
        <label className="label">Security Requirements</label>
        <textarea className="input" rows={2} value={form.requirements} onChange={e => set('requirements', e.target.value)} placeholder="e.g. Armed guard, FOID required" />
      </div>
      <div>
        <label className="label">Post Orders</label>
        <textarea className="input" rows={3} value={form.post_orders} onChange={e => set('post_orders', e.target.value)} placeholder="Detailed instructions for guards at this site" />
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{site ? 'Save Changes' : 'Add Site'}</button>
      </div>
    </form>
  )
}
