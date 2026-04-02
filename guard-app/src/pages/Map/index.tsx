import { useEffect, useState, useRef } from 'react'
import { MapPin, Navigation, CheckCircle, AlertTriangle } from 'lucide-react'
import { useShiftStore } from '../../store/shiftStore'
import { shiftsApi } from '../../api'
import Card from '../../components/ui/Card'

interface Position { lat: number; lng: number; accuracy: number }

export default function MapPage() {
  const todayShift = useShiftStore(s => s.todayShift)
  const [position, setPosition] = useState<Position | null>(null)
  const [watching, setWatching] = useState(false)
  const [geoError, setGeoError] = useState('')
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    // Load today's shift if not in store
    if (!todayShift) shiftsApi.today().then(s => useShiftStore.getState().setTodayShift(s))
  }, [])

  const startTracking = () => {
    setGeoError('')
    if (!navigator.geolocation) { setGeoError('Geolocation not supported on this device'); return }
    setWatching(true)
    watchId.current = navigator.geolocation.watchPosition(
      pos => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => { setGeoError(err.message); setWatching(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const stopTracking = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    setWatching(false)
  }

  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current) }, [])

  const distanceToSite = () => {
    if (!position || !todayShift?.lat || !todayShift?.lng) return null
    const R = 6371000
    const dLat = (todayShift.lat - position.lat) * Math.PI / 180
    const dLng = (todayShift.lng - position.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(position.lat * Math.PI / 180) * Math.cos(todayShift.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  const dist = distanceToSite()
  const atSite = dist !== null && dist < 200

  return (
    <div className="min-h-screen bg-surface px-4 pt-14 pb-4 space-y-5">
      <h1 className="text-2xl font-bold text-white">Map & Route</h1>

      {/* Status */}
      {watching && position ? (
        <Card className="p-4 border-green-500/20">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            <div>
              <p className="text-green-400 font-medium text-sm">Location Active</p>
              <p className="text-white/40 text-xs">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)} · ±{Math.round(position.accuracy)}m
              </p>
            </div>
            <button onClick={stopTracking} className="ml-auto text-white/40 text-xs border border-white/10 px-3 py-1.5 rounded-lg">Stop</button>
          </div>
        </Card>
      ) : (
        <button
          onClick={startTracking}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2"
        >
          <Navigation size={18} /> Start Location Tracking
        </button>
      )}

      {geoError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle size={16} /> {geoError}
        </div>
      )}

      {/* Site info */}
      {todayShift ? (
        <Card className="p-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Today's Site</p>
          <h3 className="font-semibold text-white">{todayShift.site_name}</h3>
          {todayShift.site_address && (
            <div className="flex items-center gap-2 mt-2 text-white/50 text-sm">
              <MapPin size={14} className="text-brand-400" />
              {todayShift.site_address}
            </div>
          )}

          {dist !== null && (
            <div className={`mt-3 rounded-xl px-4 py-2.5 text-center text-sm font-medium ${atSite ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
              {atSite ? <><CheckCircle size={14} className="inline mr-1" /> You are at the site</> : `${dist}m from site`}
            </div>
          )}

          {todayShift.site_address && (
            <button
              className="mt-3 w-full text-brand-400 text-sm font-medium border border-brand-800/50 rounded-xl py-2.5"
              onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(todayShift.site_address!)}`, '_blank')}
            >
              Open in Google Maps
            </button>
          )}
        </Card>
      ) : (
        <Card className="p-5 text-center">
          <MapPin size={32} className="text-white/10 mx-auto mb-2" />
          <p className="text-white/30">No active shift today</p>
        </Card>
      )}

      {/* Map placeholder */}
      <Card className="overflow-hidden">
        <div className="h-64 bg-gradient-to-br from-surface-elevated to-surface flex flex-col items-center justify-center">
          <MapPin size={40} className="text-brand-400/30 mb-3" />
          <p className="text-white/20 text-sm">Interactive map</p>
          <p className="text-white/10 text-xs mt-1">Requires Google Maps API key</p>
          {position && (
            <div className="mt-4 bg-surface-card rounded-xl px-4 py-2.5 text-center">
              <p className="text-white/50 text-xs">Your location</p>
              <p className="text-white/70 text-sm font-mono">{position.lat.toFixed(4)}, {position.lng.toFixed(4)}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Post orders */}
      {todayShift?.post_orders && (
        <Card className="p-4">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Post Orders</p>
          <p className="text-white/70 text-sm leading-relaxed">{todayShift.post_orders}</p>
        </Card>
      )}
    </div>
  )
}
