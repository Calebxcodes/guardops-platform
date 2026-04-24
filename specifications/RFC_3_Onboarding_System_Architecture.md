# RFC #3: ONBOARDING SYSTEM ARCHITECTURE

**Title:** Video-Based Tutorial System with Feature Flag Controls  
**Status:** Approved  
**Last Updated:** April 21, 2026  
**Owner:** Strondis Engineering Team

---

## ABSTRACT

This RFC documents the onboarding tutorial system for new Strondis users:

1. **Dismissible tutorials** (no forced friction)
2. **Video support** (with feature flag for gradual rollout)
3. **Strondis-branded** (not custom per tenant)
4. **Progressive disclosure** (recommended sequence, but user-navigable)

---

## DECISION: MANDATORY vs. OPTIONAL ONBOARDING

### Option A: Optional, Dismissible Onboarding (CHOSEN)

**User Flow:**

```
User logs in for first time
│
├─ Show dashboard (fully functional)
├─ Display optional tutorials banner
│  ├─ "New to Strondis? Take a 5-min tour"
│  └─ [Start Tour] [Dismiss] [Help Docs]
│
└─ User can:
   ├─ Start tutorials (show modals)
   ├─ Dismiss forever
   ├─ Continue using platform immediately
   └─ Access tutorials later from Help menu
```

**Pros:**
- ✅ No friction (user isn't blocked)
- ✅ Builds goodwill (not intrusive)
- ✅ Higher activation rate (can try before learning)
- ✅ Flexible (users choose their own path)

**Cons:**
- ❌ Some users skip (less onboarding completion)

### Option B: Mandatory, Multi-Step Onboarding

**User Flow:**
```
User logs in → Onboarding wizard (3–5 steps, must complete)
├─ Step 1: Dashboard tour
├─ Step 2: Add first guard
├─ Step 3: Create first shift
├─ Step 4: Configure settings
└─ Then access full dashboard
```

**Pros:**
- ✅ High engagement (forced to learn)

**Cons:**
- ❌ High friction (users drop out)
- ❌ Slows activation
- ❌ Users get frustrated with mandatory steps

### **Decision: Option A (Optional, Dismissible)**

**Why:** For B2B SaaS, users are motivated (they're paying or in free trial). Mandatory steps create churn. Optional onboarding is discovered by users who want it; others skip and get value immediately.

---

## TUTORIAL SEQUENCE

### Recommended Order (No Forced Path)

```
Tutorial 1: Dashboard Overview
├─ What: Overview of main dashboard layout
├─ Key Features: 
│  • Active guards summary
│  • Upcoming shifts
│  • Recent incidents
│  • Quick navigation
└─ Duration: 1–2 minutes

Tutorial 2: Adding Your First Guard
├─ What: How to add a security guard to the system
├─ Steps:
│  1. Navigate to Guards > Add Guard
│  2. Fill in SIA license, name, email, phone
│  3. Assign to team (optional)
│  4. Click Save
└─ Duration: 2–3 minutes

Tutorial 3: Creating & Publishing Shifts
├─ What: Schedule guards for assignments
├─ Steps:
│  1. Go to Scheduling > New Shift
│  2. Select guard(s) and date/time
│  3. Add location and client
│  4. Publish
└─ Duration: 2–3 minutes

Tutorial 4: Real-Time GPS Tracking
├─ What: Monitor guard locations
├─ Steps:
│  1. Open Map view from sidebar
│  2. See live locations
│  3. Click guard to view shift
│  4. Check check-in/check-out status
└─ Duration: 1–2 minutes

Tutorial 5: Incident Reporting
├─ What: Log and track incidents
├─ Steps:
│  1. Go to Incidents > Report Incident
│  2. Select involved guard(s)
│  3. Add description and photos
│  4. Auto-generate report or edit
└─ Duration: 2–3 minutes
```

---

## BACKEND ARCHITECTURE

### Feature Flag for Videos

**Environment Variable:**

```bash
FEATURE_ONBOARDING_VIDEOS=false  # Disabled initially (enable via master admin)
```

### Feature Flags Endpoint

**Endpoint:** `GET /api/feature-flags`

**Response:**
```json
{
  "onboarding_videos_enabled": false,
  "stripe_payments_enabled": true,
  "multi_tenancy_enabled": true
}
```

**Implementation:**

```typescript
// backend/src/routes/featureFlags.ts

import express from 'express';
import { FeatureFlagManager } from '../services/featureFlagManager';

const router = express.Router();

router.get('/feature-flags', async (req, res) => {
  try {
    const tenantId = req.tenant?.tenantId;
    
    if (tenantId) {
      // Tenant-specific flags (can override global)
      const flags = await FeatureFlagManager.getTenantFlags(tenantId);
      return res.json(flags);
    }
    
    // Global flags (for master admin, landing page, etc.)
    const flags = await FeatureFlagManager.getGlobalFlags();
    res.json(flags);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

export default router;
```

---

## FRONTEND ARCHITECTURE

### Tutorial State Management

**File:** `frontend/src/hooks/useOnboarding.ts`

```typescript
import { useEffect, useState } from 'react';
import { featureFlagsApi } from '../api';

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  steps: string[];
  order: number;
  estimatedMinutes: number;
  completed: boolean;
}

export function useOnboarding() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [videosEnabled, setVideosEnabled] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('completedTutorials') || '[]'))
  );
  
  useEffect(() => {
    loadOnboarding();
  }, []);
  
  async function loadOnboarding() {
    try {
      // Fetch feature flags from backend
      const response = await fetch('/api/feature-flags');
      const flags = await response.json();
      setVideosEnabled(flags.onboarding_videos_enabled);
      
      // Define tutorials
      const tutorialSequence: Tutorial[] = [
        {
          id: 'dashboard-overview',
          title: 'Dashboard Overview',
          description: 'Learn the basics of your admin dashboard',
          videoUrl: videosEnabled ? 'https://cdn.strondis.com/videos/dashboard-overview.mp4' : undefined,
          steps: [
            'The Dashboard shows your team at a glance',
            'Use the sidebar to navigate between sections',
            'Click on any guard to view details',
            'See upcoming shifts in the calendar',
          ],
          order: 1,
          estimatedMinutes: 2,
          completed: completedTutorials.has('dashboard-overview'),
        },
        {
          id: 'add-guard',
          title: 'Adding Your First Guard',
          description: 'How to register a security guard in the system',
          videoUrl: videosEnabled ? 'https://cdn.strondis.com/videos/add-guard.mp4' : undefined,
          steps: [
            'Click Guards in the sidebar',
            'Click Add Guard button',
            'Fill in SIA license number, name, email, phone',
            'Click Save to register',
          ],
          order: 2,
          estimatedMinutes: 3,
          completed: completedTutorials.has('add-guard'),
        },
        {
          id: 'create-shift',
          title: 'Creating & Publishing Shifts',
          description: 'Schedule your guards for assignments',
          videoUrl: videosEnabled ? 'https://cdn.strondis.com/videos/create-shift.mp4' : undefined,
          steps: [
            'Go to Scheduling > New Shift',
            'Select one or more guards',
            'Pick date, start time, and end time',
            'Add location and client name',
            'Click Publish',
          ],
          order: 3,
          estimatedMinutes: 3,
          completed: completedTutorials.has('create-shift'),
        },
        {
          id: 'gps-tracking',
          title: 'Real-Time GPS Tracking',
          description: 'Monitor guard locations in real-time',
          videoUrl: videosEnabled ? 'https://cdn.strondis.com/videos/gps-tracking.mp4' : undefined,
          steps: [
            'Open the Map view from the sidebar',
            'See live locations of all active guards',
            'Click a guard pin to view their details',
            'Check their current shift and check-in status',
          ],
          order: 4,
          estimatedMinutes: 2,
          completed: completedTutorials.has('gps-tracking'),
        },
        {
          id: 'incident-reporting',
          title: 'Incident Reporting',
          description: 'Log and track security incidents',
          videoUrl: videosEnabled ? 'https://cdn.strondis.com/videos/incident-reporting.mp4' : undefined,
          steps: [
            'Go to Incidents > Report Incident',
            'Select the involved guard(s)',
            'Write a description of what happened',
            'Upload any photos or videos',
            'Click Auto-Generate Report (uses AI) or Save',
          ],
          order: 5,
          estimatedMinutes: 3,
          completed: completedTutorials.has('incident-reporting'),
        },
      ];
      
      // Sort by recommended order
      tutorialSequence.sort((a, b) => a.order - b.order);
      setTutorials(tutorialSequence);
    } catch (error) {
      console.error('Failed to load onboarding:', error);
    }
  }
  
  function markTutorialComplete(tutorialId: string) {
    setCompletedTutorials(prev => {
      const updated = new Set(prev);
      updated.add(tutorialId);
      
      // Persist to localStorage
      localStorage.setItem('completedTutorials', JSON.stringify(Array.from(updated)));
      
      // Update state
      setTutorials(prev =>
        prev.map(t =>
          t.id === tutorialId ? { ...t, completed: true } : t
        )
      );
      
      return updated;
    });
  }
  
  function dismissOnboarding() {
    localStorage.setItem('onboardingDismissed', 'true');
  }
  
  const isOnboardingDismissed = localStorage.getItem('onboardingDismissed') === 'true';
  const completionPercentage = Math.round((completedTutorials.size / tutorials.length) * 100);
  
  return {
    tutorials,
    videosEnabled,
    activeModule,
    setActiveModule,
    completedTutorials,
    markTutorialComplete,
    dismissOnboarding,
    isOnboardingDismissed,
    completionPercentage,
  };
}
```

### Onboarding Banner Component

**File:** `frontend/src/components/OnboardingBanner.tsx`

```typescript
import React from 'react';
import { useOnboarding } from '../hooks/useOnboarding';

interface Props {
  onStartTutorial: (tutorialId: string) => void;
}

export function OnboardingBanner({ onStartTutorial }: Props) {
  const { tutorials, isOnboardingDismissed, completionPercentage, dismissOnboarding } = useOnboarding();
  
  if (isOnboardingDismissed || tutorials.length === 0) {
    return null;
  }
  
  const nextTutorial = tutorials.find(t => !t.completed);
  
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-blue-900">
            Welcome to Strondis! 👋
          </h3>
          <p className="text-sm text-blue-700 mt-1">
            Learn the basics with our quick tutorials ({completionPercentage}% complete)
          </p>
          
          {nextTutorial && (
            <p className="text-xs text-blue-600 mt-2">
              Next: {nextTutorial.title} ({nextTutorial.estimatedMinutes} min)
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          {nextTutorial && (
            <button
              onClick={() => onStartTutorial(nextTutorial.id)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Start Tutorial
            </button>
          )}
          <button
            onClick={dismissOnboarding}
            className="px-3 py-1 text-blue-700 text-sm hover:bg-blue-100 rounded"
          >
            Dismiss
          </button>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-3 bg-blue-200 rounded-full h-1 overflow-hidden">
        <div
          className="bg-blue-600 h-full transition-all duration-300"
          style={{ width: `${completionPercentage}%` }}
        />
      </div>
    </div>
  );
}
```

### Tutorial Modal Component

**File:** `frontend/src/components/TutorialModal.tsx`

```typescript
import React, { useState } from 'react';
import { Tutorial } from '../hooks/useOnboarding';

interface Props {
  tutorial: Tutorial;
  onComplete: () => void;
  onSkip: () => void;
  onNext?: () => void;
  hasNext?: boolean;
  videosEnabled: boolean;
}

export function TutorialModal({
  tutorial,
  onComplete,
  onSkip,
  onNext,
  hasNext,
  videosEnabled,
}: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
        {/* Strondis branding */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-blue-600">Strondis</h1>
          <button
            onClick={onSkip}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        
        {/* Video (if enabled) */}
        {videosEnabled && tutorial.videoUrl && (
          <div className="mb-6">
            <video
              className="w-full rounded-lg shadow-md"
              controls
              controlsList="nodownload"
              src={tutorial.videoUrl}
            >
              Your browser doesn't support video.
            </video>
            <p className="text-xs text-gray-500 mt-2">
              Strondis training video
            </p>
          </div>
        )}
        
        {/* Tutorial content */}
        <h2 className="text-2xl font-bold mb-2">{tutorial.title}</h2>
        <p className="text-gray-600 mb-6">{tutorial.description}</p>
        
        {/* Steps */}
        <div className="space-y-4 mb-8">
          {tutorial.steps.map((step, idx) => (
            <div
              key={idx}
              className={`flex items-start p-3 rounded-lg transition-all ${
                idx === currentStep
                  ? 'bg-blue-100 border-l-4 border-blue-600'
                  : idx < currentStep
                  ? 'bg-green-50 opacity-70'
                  : 'bg-gray-50 opacity-50'
              }`}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                {idx + 1}
              </div>
              <p className="text-gray-800 mt-1">{step}</p>
              {idx < currentStep && (
                <span className="ml-auto text-green-600 font-bold">✓</span>
              )}
            </div>
          ))}
        </div>
        
        {/* Navigation */}
        <div className="flex gap-3 justify-between">
          <div className="flex gap-3">
            <button
              onClick={onSkip}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Skip All
            </button>
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ← Previous
            </button>
          </div>
          
          <div className="flex gap-3">
            {currentStep < tutorial.steps.length - 1 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next →
              </button>
            ) : (
              <>
                <button
                  onClick={onComplete}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Mark Complete
                </button>
                {hasNext && onNext && (
                  <button
                    onClick={() => {
                      onComplete();
                      onNext();
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Next Tutorial →
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Progress indicator */}
        <div className="mt-6 text-center text-xs text-gray-500">
          Step {currentStep + 1} of {tutorial.steps.length}
        </div>
      </div>
    </div>
  );
}
```

### Integration in Dashboard

**File:** `frontend/src/pages/Dashboard/index.tsx`

```typescript
import React, { useState } from 'react';
import { useOnboarding } from '../../hooks/useOnboarding';
import { OnboardingBanner } from '../../components/OnboardingBanner';
import { TutorialModal } from '../../components/TutorialModal';

export default function Dashboard() {
  const { tutorials, videosEnabled, markTutorialComplete } = useOnboarding();
  const [activeTutorial, setActiveTutorial] = useState<string | null>(null);
  
  const currentTutorial = tutorials.find(t => t.id === activeTutorial);
  const currentIndex = tutorials.findIndex(t => t.id === activeTutorial);
  const nextTutorial = currentIndex >= 0 ? tutorials[currentIndex + 1] : null;
  
  return (
    <div className="p-6">
      {/* Onboarding banner */}
      <OnboardingBanner onStartTutorial={setActiveTutorial} />
      
      {/* Dashboard content */}
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      {/* Dashboard widgets, charts, etc. */}
      <div className="grid grid-cols-4 gap-4">
        {/* Your dashboard cards here */}
      </div>
      
      {/* Tutorial modal */}
      {currentTutorial && (
        <TutorialModal
          tutorial={currentTutorial}
          videosEnabled={videosEnabled}
          onComplete={() => {
            markTutorialComplete(activeTutorial!);
            setActiveTutorial(null);
          }}
          onSkip={() => setActiveTutorial(null)}
          onNext={() => {
            markTutorialComplete(activeTutorial!);
            if (nextTutorial) {
              setActiveTutorial(nextTutorial.id);
            } else {
              setActiveTutorial(null);
            }
          }}
          hasNext={!!nextTutorial}
        />
      )}
    </div>
  );
}
```

---

## VIDEO GENERATION STRATEGY

### Phase 1 (MVP): Text-Only Tutorials

**Status:** Live on day 1

**Content:** Step-by-step text + screenshots (static)

**Video URL:** `undefined` (feature flag disabled)

---

### Phase 2 (Post-Launch): AI-Generated Videos

**Timeline:** Once app is stable (May–June 2026)

**Video Provider Options:**

1. **Synthesia** (AI video generation)
   - ✅ Text-to-video (script → video)
   - ✅ Avatar-based (professional presenter)
   - ✅ Multi-language support
   - ❌ $$$

2. **Pictory** (auto-generates from scripts)
   - ✅ Affordable
   - ✅ Customizable branding
   - ❌ Less professional

3. **Your Own Recordings** (manual)
   - ✅ Full control
   - ✅ Cheapest
   - ❌ Time-consuming

**Recommendation:** Start with **text-only** (MVP), then upgrade to **Synthesia** (Phase 2) once you have budget.

---

### Enabling Videos for a Tenant

**Via Master Admin:**

```
1. Go to Master Admin Dashboard
2. Find tenant "Allied Security Ltd"
3. Click "Feature Flags"
4. Toggle "Onboarding Videos" to ON
5. Save

Next time tenant logs in, tutorials show videos.
```

---

## DATA & ANALYTICS

### Tracking Tutorial Completion

**Store in localStorage** (client-side):

```typescript
localStorage.setItem('completedTutorials', JSON.stringify(['dashboard-overview', 'add-guard']));
```

### Optional: Server-Side Tracking

**Endpoint:** `POST /api/telemetry/tutorial-completed`

```typescript
router.post('/telemetry/tutorial-completed', async (req, res) => {
  const { tutorialId } = req.body;
  const { tenantId } = req.tenant;
  
  // Log for analytics
  console.log(`[Telemetry] Tenant ${tenantId} completed ${tutorialId}`);
  
  // Optional: Store in database for dashboard analytics
  // ...
  
  res.json({ received: true });
});
```

---

## TESTING

### Test Scenario 1: Videos Disabled (MVP)

```typescript
it('should show text-only tutorials when videos disabled', async () => {
  // Videos disabled
  // Load tutorials
  const tutorials = useOnboarding();
  
  // Verify no video URLs
  tutorials.forEach(t => {
    expect(t.videoUrl).toBeUndefined();
  });
});
```

### Test Scenario 2: Videos Enabled

```typescript
it('should show video tutorials when enabled', async () => {
  // Enable videos via master admin
  // Load tutorials
  const tutorials = useOnboarding();
  
  // Verify video URLs present
  tutorials.forEach(t => {
    expect(t.videoUrl).toBeDefined();
    expect(t.videoUrl).toMatch(/\.mp4$/);
  });
});
```

### Test Scenario 3: Tutorial Progress

```typescript
it('should track tutorial completion', async () => {
  const { markTutorialComplete, completionPercentage } = useOnboarding();
  
  expect(completionPercentage).toBe(0);
  
  markTutorialComplete('dashboard-overview');
  expect(completionPercentage).toBe(20);  // 1 of 5
  
  markTutorialComplete('add-guard');
  expect(completionPercentage).toBe(40);  // 2 of 5
});
```

---

## CONCLUSION

This RFC specifies:

✅ Optional, dismissible onboarding (no friction)  
✅ Video support (disabled initially, enable via feature flag)  
✅ Strondis-branded tutorials (not custom)  
✅ Progressive disclosure (recommended order)  
✅ Client-side progress tracking (localStorage)  
✅ Gradual video rollout (Phase 2)  

Implementation should follow exactly as specified in `MASTER_SPECIFICATION_v1.md` Section 7.

---

**END OF RFC #3**
