import { useState } from 'react'
import { useOnboarding } from '../hooks/useOnboarding'
import { BookOpen, X, ChevronRight, CheckCircle2 } from 'lucide-react'
import { TutorialModal } from './TutorialModal'

export function OnboardingBanner() {
  const {
    tutorials,
    videosEnabled,
    isOnboardingDismissed,
    completionPercentage,
    dismissOnboarding,
    markTutorialComplete,
  } = useOnboarding()

  const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null)

  if (isOnboardingDismissed || tutorials.length === 0) return null

  const allDone = completionPercentage === 100
  if (allDone) return null

  const nextTutorial = tutorials.find(t => !t.completed)
  const activeTutorial = tutorials.find(t => t.id === activeTutorialId) ?? null
  const activeTutorialIdx = activeTutorial ? tutorials.indexOf(activeTutorial) : -1
  const nextAfterActive = tutorials[activeTutorialIdx + 1] ?? null

  return (
    <>
      <div className="bg-blue-950/60 border border-blue-800 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <BookOpen size={16} className="text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-white">Welcome to Strondis</span>
              <span className="text-xs text-blue-400">{completionPercentage}% complete</span>
            </div>

            {nextTutorial && (
              <p className="text-xs text-blue-300 mb-2">
                Next: <span className="font-medium">{nextTutorial.title}</span> — {nextTutorial.estimatedMinutes} min
              </p>
            )}

            {/* Progress bar */}
            <div className="bg-blue-900 rounded-full h-1 w-full mb-3">
              <div
                className="bg-blue-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>

            {/* Tutorial chips */}
            <div className="flex flex-wrap gap-2">
              {tutorials.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTutorialId(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    t.completed
                      ? 'bg-green-900/50 text-green-400 cursor-default'
                      : 'bg-blue-900 hover:bg-blue-800 text-blue-200'
                  }`}
                >
                  {t.completed
                    ? <CheckCircle2 size={11} />
                    : <ChevronRight size={11} />
                  }
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={dismissOnboarding}
            className="text-blue-500 hover:text-blue-300 p-1 flex-shrink-0"
            aria-label="Dismiss onboarding"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {activeTutorial && (
        <TutorialModal
          tutorial={activeTutorial}
          videosEnabled={videosEnabled}
          hasNext={!!nextAfterActive}
          onComplete={() => {
            markTutorialComplete(activeTutorial.id)
            setActiveTutorialId(null)
          }}
          onNext={() => {
            markTutorialComplete(activeTutorial.id)
            setActiveTutorialId(nextAfterActive?.id ?? null)
          }}
          onSkip={() => setActiveTutorialId(null)}
        />
      )}
    </>
  )
}
