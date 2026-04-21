import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, CheckCircle2, Shield } from 'lucide-react'
import type { Tutorial } from '../hooks/useOnboarding'

interface Props {
  tutorial: Tutorial
  videosEnabled: boolean
  hasNext?: boolean
  onComplete: () => void
  onNext?: () => void
  onSkip: () => void
}

export function TutorialModal({ tutorial, videosEnabled, hasNext, onComplete, onNext, onSkip }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const isLastStep = currentStep === tutorial.steps.length - 1

  function handleNext() {
    if (isLastStep) {
      onComplete()
    } else {
      setCurrentStep(s => s + 1)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2 text-blue-400">
            <Shield size={18} />
            <span className="text-sm font-bold tracking-wide">Strondis</span>
          </div>
          <button onClick={onSkip} className="text-gray-500 hover:text-gray-300 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Video */}
          {videosEnabled && tutorial.videoUrl && (
            <div className="mb-5">
              <video
                className="w-full rounded-xl shadow-lg bg-black"
                controls
                controlsList="nodownload"
                src={tutorial.videoUrl}
              >
                Your browser does not support video.
              </video>
              <p className="text-xs text-gray-600 mt-1">Strondis training video</p>
            </div>
          )}

          {/* Title */}
          <h2 className="text-xl font-bold text-white mb-1">{tutorial.title}</h2>
          <p className="text-sm text-gray-400 mb-5">{tutorial.description}</p>

          {/* Steps */}
          <div className="space-y-2 mb-6">
            {tutorial.steps.map((step, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  idx === currentStep
                    ? 'bg-blue-900/50 border border-blue-700'
                    : idx < currentStep
                    ? 'bg-green-900/20 border border-green-900/30 opacity-70'
                    : 'bg-gray-800/50 border border-gray-800 opacity-50'
                }`}
              >
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx < currentStep ? 'bg-green-600 text-white' :
                  idx === currentStep ? 'bg-blue-600 text-white' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {idx < currentStep ? <CheckCircle2 size={14} /> : idx + 1}
                </div>
                <p className="text-sm text-gray-200 pt-0.5 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>

          {/* Step progress indicator */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {tutorial.steps.map((_, idx) => (
              <div
                key={idx}
                className={`rounded-full transition-all ${
                  idx === currentStep ? 'w-4 h-2 bg-blue-500' :
                  idx < currentStep  ? 'w-2 h-2 bg-green-500' :
                  'w-2 h-2 bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
              Back
            </button>

            <div className="flex gap-2">
              <button
                onClick={onSkip}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isLastStep ? (
                  <>
                    <CheckCircle2 size={15} />
                    {hasNext ? 'Complete & Next' : 'Complete'}
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight size={15} />
                  </>
                )}
              </button>
              {isLastStep && hasNext && onNext && (
                <button
                  onClick={onNext}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                >
                  Next Tutorial
                  <ChevronRight size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
