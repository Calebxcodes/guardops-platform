import { useRef, useEffect, useState, useCallback } from 'react'
import * as faceapi from 'face-api.js'
import { Loader } from 'lucide-react'

const MODEL_URL = '/models'

// Module-level cache so models load only once per session
let _modelsReady = false
let _modelsPromise: Promise<void> | null = null

function ensureModels(): Promise<void> {
  if (_modelsReady) return Promise.resolve()
  if (_modelsPromise) return _modelsPromise
  _modelsPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]).then(() => { _modelsReady = true })
  return _modelsPromise
}

export type FaceCaptureMode = 'enroll' | 'verify'

interface Props {
  mode: FaceCaptureMode
  referenceDescriptor?: number[] | null  // required for verify mode
  onSuccess: (descriptor: number[]) => void
  onFail?: (reason: string) => void
  onCancel: () => void
}

type Status = 'loading_models' | 'starting_camera' | 'scanning' | 'verified' | 'no_match' | 'no_face' | 'camera_error' | 'model_error'

const THRESHOLD = 0.55 // euclidean distance; lower = stricter

export default function FaceCapture({ mode, referenceDescriptor, onSuccess, onFail, onCancel }: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  const [status, setStatus]   = useState<Status>('loading_models')
  const [progress, setProgress] = useState(0)

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      runningRef.current = false
    }
  }, [])

  const startCamera = useCallback(async () => {
    setStatus('starting_camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      runDetection()
    } catch {
      setStatus('camera_error')
    }
  }, []) // eslint-disable-line

  // Load models then start camera
  useEffect(() => {
    ensureModels()
      .then(startCamera)
      .catch(() => setStatus('model_error'))
  }, [startCamera])

  const runDetection = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setStatus('scanning')

    const MAX_ATTEMPTS = 25
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (!runningRef.current) return
      setProgress(Math.round((i / MAX_ATTEMPTS) * 100))
      await new Promise(r => setTimeout(r, 300))

      if (!videoRef.current) break
      let det: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> | undefined
      try {
        det = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor()
      } catch {
        continue
      }

      if (!det) continue

      const liveDesc: number[] = Array.from(det.descriptor) as number[]

      if (mode === 'enroll') {
        setStatus('verified')
        streamRef.current?.getTracks().forEach(t => t.stop())
        setTimeout(() => onSuccess(liveDesc), 600)
        runningRef.current = false
        return
      }

      // verify mode
      if (!referenceDescriptor) continue
      const ref: number[] = referenceDescriptor
      const dist = faceapi.euclideanDistance(
        new Float32Array(ref),
        new Float32Array(liveDesc)
      )
      if (dist < THRESHOLD) {
        setStatus('verified')
        streamRef.current?.getTracks().forEach(t => t.stop())
        setTimeout(() => onSuccess(liveDesc), 600)
        runningRef.current = false
        return
      }
    }

    // Exhausted attempts
    runningRef.current = false
    if (mode === 'verify') {
      setStatus('no_match')
      onFail?.('Face not recognised. Please try again or contact your manager.')
    } else {
      setStatus('no_face')
    }
  }, [mode, referenceDescriptor, onSuccess, onFail])

  const retry = () => {
    runningRef.current = false
    setProgress(0)
    setStatus('scanning')
    setTimeout(runDetection, 100)
  }

  const ovalColor =
    status === 'verified'  ? 'border-green-400 shadow-green-400/30' :
    status === 'scanning'  ? 'border-brand-400 animate-pulse' :
    status === 'no_match'  ? 'border-red-400' :
                             'border-white/20'

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Camera viewport */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover scale-x-[-1]" /* mirror for selfie */
          playsInline
          muted
        />

        {/* Oval face guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`w-44 h-52 rounded-full border-4 shadow-lg transition-all duration-300 ${ovalColor}`} />
        </div>

        {/* Loading overlay */}
        {(status === 'loading_models' || status === 'starting_camera') && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
            <Loader size={32} className="animate-spin text-brand-400" />
            <p className="text-white/70 text-sm">
              {status === 'loading_models' ? 'Loading face detection…' : 'Starting camera…'}
            </p>
          </div>
        )}

        {/* Verified tick */}
        {status === 'verified' && (
          <div className="absolute inset-0 bg-green-900/60 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-2xl">
              <span className="text-white text-4xl font-bold">✓</span>
            </div>
          </div>
        )}
      </div>

      {/* Scanning progress bar */}
      {status === 'scanning' && (
        <div className="w-full bg-white/10 rounded-full h-1">
          <div
            className="bg-brand-500 h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Status text */}
      <div className="text-center min-h-[48px]">
        {status === 'scanning' && (
          <>
            <p className="text-brand-300 font-medium text-sm">
              {mode === 'enroll' ? 'Look directly at the camera' : 'Verifying your identity…'}
            </p>
            <p className="text-white/30 text-xs mt-0.5">Centre your face in the oval</p>
          </>
        )}
        {status === 'verified' && (
          <p className="text-green-400 font-semibold text-sm">
            {mode === 'enroll' ? 'Face captured!' : 'Identity verified ✓'}
          </p>
        )}
        {status === 'no_face' && (
          <>
            <p className="text-yellow-400 text-sm">No face detected — make sure you're well lit</p>
            <button onClick={retry} className="text-brand-400 text-sm mt-1 underline">Try again</button>
          </>
        )}
        {status === 'no_match' && (
          <>
            <p className="text-red-400 text-sm font-medium">Face not recognised</p>
            <button onClick={retry} className="text-brand-400 text-sm mt-1 underline">Try again</button>
          </>
        )}
        {(status === 'camera_error') && (
          <p className="text-red-400 text-sm">Camera access denied. Please allow camera permission and refresh.</p>
        )}
        {status === 'model_error' && (
          <p className="text-red-400 text-sm">Failed to load face detection. Check your connection.</p>
        )}
      </div>

      <button onClick={onCancel} className="text-white/30 hover:text-white/60 text-sm transition-colors">
        Cancel
      </button>
    </div>
  )
}
