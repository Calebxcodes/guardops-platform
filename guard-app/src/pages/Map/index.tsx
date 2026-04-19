import { useEffect, useState, useRef, useCallback } from 'react'
import { MapPin, Navigation, CheckCircle, AlertTriangle, Route, Loader, RefreshCw } from 'lucide-react'
import { useShiftStore } from '../../store/shiftStore'
import { shiftsApi } from '../../api'
import Card from '../../components/ui/Card'
import { format } from 'date-fns'

interface Position { lat: number; lng: number; accuracy: number }

interface Checkpoint {
  id: number
  name: string
  instructions?: string
  order_num: number
  scanned: boolean
  scanned_at?: string
}

export default function MapPage() {
  const todayShift = useShiftStore(s => s.todayShift)

  const [position, setPosition]       = useState<Position | null>(null)
  const [watching, setWatching]       = useState(false)
  const [geoError, setGeoError]       = useState('')
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [loadingCps, setLoadingCps]   = useState(false)
  const [scanning, setScanning]       = useState<number | null>(null) // checkpoint id being scanned
  const [scanError, setScanError]     = useState('')
  const watchId = useRef<number | null>(null)

  // Load today's shift if not in store
  useEffect(() => {
    if (!todayShift) shiftsApi.today().then(s => useShiftStore.getState().setTodayShift(s))
  }, [])

  const loadCheckpoints = useCallback(async () => {
    if (!todayShift?.id) return
    setLoadingCps(true)
    try {
      const data = await shiftsApi.getCheckpoints(todayShift.id)
      setCheckpoints(data)
    } catch { /* no checkpoints configured */ }
    finally { setLoadingCps(false) }
  }, [todayShift?.id])

  useEffect(() => { loadCheckpoints() }, [loadCheckpoints])

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

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
  }, [])

  const distanceToSite = () => {
    if (!position || !todayShift?.lat || !todayShift?.lng) return null
    const R = 6371000
    const dLat = (todayShift.lat - position.lat) * Math.PI / 180
    const dLng = (todayShift.lng - position.lng) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(position.lat * Math.PI / 180) * Math.cos(todayShift.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  const scanCheckpoint = async (cp: Checkpoint) => {
    if (!todayShift?.id || cp.scanned) return
    setScanning(cp.id)
    setScanError('')
    try {
      await shiftsApi.scanCheckpoint(
        todayShift.id,
        cp.id,
        position ? { lat: position.lat, lng: position.lng } : undefined
      )
      setCheckpoints(prev => prev.map(c =>
        c.id === cp.id ? { ...c, scanned: true, scanned_at: new Date().toISOString() } : c
      ))
    } catch {
      setScanError(`Failed to scan "${cp.name}" — please try again.`)
    } finally {
      setScanning(null)
    }
  }

  const dist    = distanceToSite()
  const atSite  = dist !== null && dist < 200
  const scanned = checkpoints.filter(c => c.scanned).length
  const total   = checkpoints.length
  const isActive = todayShift?.status === 'active'

  return (
    <div className="min-h-screen bg-surface px-4 pt-14 pb-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Map & Patrol</h1>
        {total > 0 && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            scanned === total ? 'bg-green-600/20 text-green-400' : 'bg-brand-600/20 text-brand-400'
          }`}>
            {scanned}/{total} scanned
          </span>
        )}
      </div>

      {/* GPS status */}
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
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3.5 rounded-2xl flex items-center justify-center gap-2"
        >
          <Navigation size={18} /> Enable Location
        </button>
      )}

      {geoError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle size={16} /> {geoError}
        </div>
      )}

      {/* Site card */}
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
            <div className={`mt-3 rounded-xl px-4 py-2 text-center text-sm font-medium ${atSite ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
              {atSite ? <><CheckCircle size={14} className="inline mr-1" />You are at the site</> : `${dist}m from site`}
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

      {/* Patrol checkpoints */}
      {todayShift && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Route size={16} className="text-brand-400" />
              <span className="text-white font-semibold">Patrol Route</span>
            </div>
            <button onClick={loadCheckpoints} className="text-white/30 hover:text-white/60 p-1">
              <RefreshCw size={14} className={loadingCps ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingCps ? (
            <div className="flex justify-center py-6">
              <Loader size={20} className="text-white/20 animate-spin" />
            </div>
          ) : total === 0 ? (
            <Card className="p-5 text-center">
              <Route size={28} className="text-white/10 mx-auto mb-2" />
              <p className="text-white/30 text-sm">No patrol checkpoints configured for this site</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {scanError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={14} /> {scanError}
                </div>
              )}

              {/* Progress bar */}
              <div className="bg-surface-elevated rounded-full h-1.5 overflow-hidden mb-4">
                <div
                  className="h-full bg-brand-500 transition-all duration-500"
                  style={{ width: total > 0 ? `${(scanned / total) * 100}%` : '0%' }}
                />
              </div>

              {checkpoints.map((cp, i) => (
                <div
                  key={cp.id}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    cp.scanned
                      ? 'bg-green-900/20 border-green-700/40'
                      : 'bg-surface-elevated border-white/10'
                  }`}
                >
                  {/* Step number / check indicator */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                    cp.scanned ? 'bg-green-600' : 'bg-white/10 text-white/40'
                  }`}>
                    {cp.scanned ? <CheckCircle size={16} className="text-white" /> : i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${cp.scanned ? 'text-green-300' : 'text-white/80'}`}>
                      {cp.name}
                    </p>
                    {cp.instructions && !cp.scanned && (
                      <p className="text-white/30 text-xs mt-0.5 truncate">{cp.instructions}</p>
                    )}
                    {cp.scanned && cp.scanned_at && (
                      <p className="text-green-400/60 text-xs mt-0.5">
                        Scanned at {format(new Date(cp.scanned_at), 'h:mm a')}
                      </p>
                    )}
                  </div>

                  {/* Scan button */}
                  {!cp.scanned && isActive && (
                    <button
                      onClick={() => scanCheckpoint(cp)}
                      disabled={scanning === cp.id}
                      className="shrink-0 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5"
                    >
                      {scanning === cp.id ? <Loader size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      Scan
                    </button>
                  )}
                  {!cp.scanned && !isActive && (
                    <span className="text-white/20 text-xs shrink-0">Not active</span>
                  )}
                </div>
              ))}

              {scanned === total && total > 0 && (
                <div className="bg-green-900/20 border border-green-700/40 rounded-2xl p-4 text-center mt-2">
                  <CheckCircle size={24} className="text-green-400 mx-auto mb-1.5" />
                  <p className="text-green-300 font-semibold text-sm">Patrol complete!</p>
                  <p className="text-green-400/60 text-xs mt-0.5">All {total} checkpoints scanned</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
