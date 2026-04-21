import { useEffect, useState, useCallback } from 'react'

export interface Tutorial {
  id: string
  title: string
  description: string
  videoUrl?: string
  steps: string[]
  order: number
  estimatedMinutes: number
  completed: boolean
}

const TUTORIAL_DEFINITIONS: Omit<Tutorial, 'completed'>[] = [
  {
    id: 'dashboard-overview',
    title: 'Dashboard Overview',
    description: 'Learn the basics of your admin dashboard',
    videoUrl: 'https://cdn.strondis.com/videos/dashboard-overview.mp4',
    steps: [
      'The Dashboard shows your team at a glance',
      'Use the sidebar to navigate between sections',
      'Click on any guard to view their details',
      'See upcoming shifts in the calendar widget',
    ],
    order: 1,
    estimatedMinutes: 2,
  },
  {
    id: 'add-guard',
    title: 'Adding Your First Guard',
    description: 'How to register a security guard in the system',
    videoUrl: 'https://cdn.strondis.com/videos/add-guard.mp4',
    steps: [
      'Click Guards in the sidebar',
      'Click the Add Guard button',
      'Fill in SIA licence number, name, email, and phone',
      'Click Save to register the guard',
    ],
    order: 2,
    estimatedMinutes: 3,
  },
  {
    id: 'create-shift',
    title: 'Creating & Publishing Shifts',
    description: 'Schedule your guards for assignments',
    videoUrl: 'https://cdn.strondis.com/videos/create-shift.mp4',
    steps: [
      'Go to Scheduling > New Shift',
      'Select one or more guards',
      'Pick the date, start time, and end time',
      'Add the location and client name',
      'Click Publish to assign the shift',
    ],
    order: 3,
    estimatedMinutes: 3,
  },
  {
    id: 'gps-tracking',
    title: 'Real-Time GPS Tracking',
    description: 'Monitor guard locations in real-time',
    videoUrl: 'https://cdn.strondis.com/videos/gps-tracking.mp4',
    steps: [
      'Open the Map view from the sidebar',
      'See live locations of all active guards',
      'Click a guard pin to view their details',
      'Check their current shift and clock-in status',
    ],
    order: 4,
    estimatedMinutes: 2,
  },
  {
    id: 'incident-reporting',
    title: 'Incident Reporting',
    description: 'Log and track security incidents with AI reports',
    videoUrl: 'https://cdn.strondis.com/videos/incident-reporting.mp4',
    steps: [
      'Go to Incidents > Report Incident',
      'Select the involved guard(s)',
      'Write a description of what happened',
      'Upload any photos or supporting files',
      'Click Auto-Generate Report for AI-written summary, or Save manually',
    ],
    order: 5,
    estimatedMinutes: 3,
  },
]

function getCompleted(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem('strondis_completed_tutorials') ?? '[]'))
  } catch {
    return new Set()
  }
}

export function useOnboarding() {
  const [videosEnabled, setVideosEnabled] = useState(false)
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(getCompleted)
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('strondis_onboarding_dismissed') === 'true'
  )

  useEffect(() => {
    fetch('/api/feature-flags')
      .then(r => r.json())
      .then(flags => setVideosEnabled(!!flags.onboarding_videos_enabled))
      .catch(() => {})
  }, [])

  const tutorials: Tutorial[] = TUTORIAL_DEFINITIONS.map(t => ({
    ...t,
    videoUrl: videosEnabled ? t.videoUrl : undefined,
    completed: completedTutorials.has(t.id),
  })).sort((a, b) => a.order - b.order)

  const markTutorialComplete = useCallback((id: string) => {
    setCompletedTutorials(prev => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('strondis_completed_tutorials', JSON.stringify([...next]))
      return next
    })
  }, [])

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem('strondis_onboarding_dismissed', 'true')
    setDismissed(true)
  }, [])

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem('strondis_onboarding_dismissed')
    localStorage.removeItem('strondis_completed_tutorials')
    setDismissed(false)
    setCompletedTutorials(new Set())
  }, [])

  const completionPercentage = tutorials.length
    ? Math.round((completedTutorials.size / tutorials.length) * 100)
    : 0

  return {
    tutorials,
    videosEnabled,
    activeModule,
    setActiveModule,
    completedTutorials,
    markTutorialComplete,
    dismissOnboarding,
    resetOnboarding,
    isOnboardingDismissed: dismissed,
    completionPercentage,
  }
}
