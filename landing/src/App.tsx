import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  Shield, ShieldCheck, Users, MapPin, Clock,
  ChevronDown, ArrowRight, Check, X, MessageSquare, Send,
  Phone, Mail, Star, Zap, Lock, Eye, BarChart3,
  CalendarCheck, FileText, ExternalLink, Menu, Layers,
  CreditCard, Bell, TrendingUp, Activity
} from 'lucide-react'
import './index.css'

const ADMIN_URL     = (import.meta as any).env?.VITE_ADMIN_URL  || 'https://your-admin-crm.vercel.app'
const GUARD_URL     = (import.meta as any).env?.VITE_GUARD_URL  || 'https://your-guard-app.vercel.app'
const CONTACT_EMAIL = 'info@strondis.com'
const CONTACT_PHONE = '+44 20 0000 0000'

const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any, delay: i * 0.1 },
  }),
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref    = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} custom={delay} variants={fadeUp} className={className}>
      {children}
    </motion.div>
  )
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'Plans',    href: '#plans'    },
    { label: 'Mission',  href: '#mission'  },
    { label: 'Platform', href: '#platform' },
    { label: 'Contact',  href: '#contact'  },
  ]

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#060811]/90 backdrop-blur-xl border-b border-white/5 shadow-xl shadow-black/30' : ''}`}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40">
            <span className="text-white font-black text-base leading-none">S</span>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Strondis</span>
        </a>

        <nav className="hidden md:flex items-center gap-7">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-white/50 hover:text-white text-sm font-medium transition-colors">{l.label}</a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a href={GUARD_URL} target="_blank" rel="noreferrer" className="text-white/60 hover:text-white text-sm font-medium transition-colors">Guard App</a>
          <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-600/30">Sign In</a>
        </div>

        <button onClick={() => setOpen(v => !v)} className="md:hidden text-white/60 hover:text-white p-1">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#060811]/95 backdrop-blur-xl border-b border-white/5 overflow-hidden">
            <div className="px-5 py-4 flex flex-col gap-4">
              {links.map(l => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-base font-medium transition-colors">{l.label}</a>
              ))}
              <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                <a href={GUARD_URL} target="_blank" rel="noreferrer" className="text-center border border-white/10 text-white/70 text-sm font-medium py-2.5 rounded-lg hover:bg-white/5 transition-colors">Guard App</a>
                <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">Sign In →</a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ─── Dashboard Mockup ────────────────────────────────────────────────────────
function DashboardMockup() {
  const stats = [
    { label: 'Guards On Duty', value: '24', change: '+2', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    { label: 'Sites Active',   value: '12', change: '100%', color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/20'  },
    { label: 'SIA Compliant',  value: '98%', change: '↑',  color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { label: 'Incidents Today', value: '1',  change: '↓3', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  ]
  const guards = [
    { name: 'James O.',  site: 'Canary Wharf HQ', status: 'On Duty',  dot: 'bg-green-400' },
    { name: 'Priya K.',  site: 'Westfield Mall',  status: 'On Duty',  dot: 'bg-green-400' },
    { name: 'Mark T.',   site: 'City Airport',    status: 'Break',    dot: 'bg-yellow-400' },
    { name: 'Sarah M.',  site: 'Camden Office',   status: 'On Duty',  dot: 'bg-green-400' },
  ]
  return (
    <div className="relative w-full max-w-3xl mx-auto mt-14 px-4">
      {/* Glow */}
      <div className="absolute inset-0 bg-blue-600/10 rounded-3xl blur-3xl scale-110 pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl bg-[#0c1220] border border-white/10 shadow-2xl shadow-black/60 overflow-hidden"
      >
        {/* Window bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-white/5 border border-white/8 rounded-md px-4 py-1 text-white/30 text-xs font-mono">
              app.strondis.com/dashboard
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map(s => (
              <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-3`}>
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-white/40 text-xs mt-1 leading-tight">{s.label}</div>
                <div className={`text-xs font-semibold mt-1 ${s.color}`}>{s.change}</div>
              </div>
            ))}
          </div>

          {/* Guard list */}
          <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
              <span className="text-white/60 text-xs font-semibold uppercase tracking-wide">Live Guard Status</span>
              <span className="text-blue-400 text-xs">View all →</span>
            </div>
            {guards.map((g, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center text-xs text-blue-300 font-bold">
                    {g.name[0]}
                  </div>
                  <div>
                    <div className="text-white/80 text-xs font-medium">{g.name}</div>
                    <div className="text-white/30 text-[10px]">{g.site}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${g.dot}`} />
                  <span className="text-white/40 text-xs">{g.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden px-5 pt-28 pb-16">
      <div className="absolute w-[600px] h-[600px] bg-blue-600/20 rounded-full -top-40 -left-40 blur-[80px] pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] bg-blue-900/30 rounded-full top-1/3 -right-60 blur-[80px] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <span className="text-blue-300 text-sm font-medium">The operating system for security companies</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.08] tracking-tight text-white mb-6">
          Run your security{' '}
          <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">company smarter.</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          Strondis is the all-in-one platform built for security businesses — guard scheduling, GPS tracking, payroll, SIA compliance and client reporting in one place.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="#contact" className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-4 rounded-xl shadow-xl shadow-blue-600/40 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
            Book a Demo <ArrowRight size={18} />
          </a>
          <a href="#platform" className="inline-flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/8 text-white font-semibold px-7 py-4 rounded-xl transition-all text-base">
            See the Platform <ChevronDown size={18} />
          </a>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-10 flex flex-wrap justify-center gap-6 text-white/30 text-sm">
          {['No per-guard fees', 'Unlimited sites', 'GDPR compliant', 'UK-based support'].map(b => (
            <span key={b} className="flex items-center gap-1.5"><Check size={14} className="text-blue-400" />{b}</span>
          ))}
        </motion.div>
      </div>

      <DashboardMockup />
    </section>
  )
}

// ─── Stats ───────────────────────────────────────────────────────────────────
function Stats() {
  const stats = [
    { value: '500+', label: 'Guards Managed'     },
    { value: '80+',  label: 'Security Companies' },
    { value: '99.9%', label: 'Platform Uptime'   },
    { value: '24/7', label: 'Support Coverage'   },
  ]
  return (
    <section className="py-12 border-y border-white/5 bg-white/[0.02]">
      <div className="max-w-5xl mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s, i) => (
          <FadeIn key={s.label} delay={i * 0.1} className="text-center">
            <div className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">{s.value}</div>
            <div className="text-white/40 text-sm mt-1 font-medium">{s.label}</div>
          </FadeIn>
        ))}
      </div>
    </section>
  )
}

// ─── Features ────────────────────────────────────────────────────────────────
function Features() {
  const features = [
    {
      Icon: CalendarCheck, title: 'Guard Scheduling & Rostering',
      desc: 'Drag-and-drop shift builder with conflict detection, automatic notifications and real-time availability tracking across all your sites.',
      grad: 'from-blue-600/20 to-blue-800/10', ic: 'text-blue-400', ib: 'bg-blue-600/15',
    },
    {
      Icon: MapPin, title: 'GPS Tracking & Geofencing',
      desc: 'Live map view of every officer. Geofenced clock-in and clock-out with face-ID verification so you know guards are where they need to be.',
      grad: 'from-cyan-600/20 to-cyan-800/10', ic: 'text-cyan-400', ib: 'bg-cyan-600/15',
    },
    {
      Icon: CreditCard, title: 'Payroll & Timesheets',
      desc: 'Automatic timesheet generation from verified clock records. Export-ready payroll summaries with overtime, deductions and pay period reports.',
      grad: 'from-green-600/20 to-green-800/10', ic: 'text-green-400', ib: 'bg-green-600/15',
    },
    {
      Icon: ShieldCheck, title: 'SIA Compliance Management',
      desc: 'Track SIA licence expiry dates, DBS checks and certifications across your whole workforce. Automated alerts before anything lapses.',
      grad: 'from-purple-600/20 to-purple-800/10', ic: 'text-purple-400', ib: 'bg-purple-600/15',
    },
    {
      Icon: FileText, title: 'Incident Reporting',
      desc: 'Officers log incidents directly from the mobile app. AI-generated summaries, photo attachments and automatic escalation to relevant clients.',
      grad: 'from-orange-600/20 to-orange-800/10', ic: 'text-orange-400', ib: 'bg-orange-600/15',
    },
    {
      Icon: BarChart3, title: 'Client Portal & Reporting',
      desc: 'Give your clients a branded portal with live dashboards, guard activity, compliance status and downloadable reports — no chasing emails.',
      grad: 'from-indigo-600/20 to-indigo-800/10', ic: 'text-indigo-400', ib: 'bg-indigo-600/15',
    },
  ]

  return (
    <section id="features" className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Platform Features</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mt-3 tracking-tight">Everything your security business needs</h2>
          <p className="text-white/40 mt-4 text-lg max-w-2xl mx-auto">One platform to replace the spreadsheets, WhatsApp groups and disconnected tools your team relies on today.</p>
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.08}>
              <div className={`h-full bg-gradient-to-br ${f.grad} border border-white/8 rounded-2xl p-7 hover:border-white/15 transition-all hover:-translate-y-0.5`}>
                <div className={`w-12 h-12 ${f.ib} rounded-xl flex items-center justify-center mb-5`}>
                  <f.Icon size={22} className={f.ic} />
                </div>
                <h3 className="text-lg font-bold text-white mb-3">{f.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Plans ───────────────────────────────────────────────────────────────────
function Plans() {
  const plans = [
    {
      name: 'Starter', sub: 'Up to 25 guards',
      badge: null, grad: 'from-slate-400 to-slate-600',
      btn: 'bg-white/10 hover:bg-white/15 text-white border border-white/10',
      features: [
        { l: 'Up to 25 guards',             ok: true  },
        { l: 'Guard scheduling & rostering', ok: true  },
        { l: 'GPS clock-in / geofencing',   ok: true  },
        { l: 'Timesheets & basic payroll',  ok: true  },
        { l: 'SIA compliance tracking',     ok: false },
        { l: 'Client portal access',        ok: false },
        { l: 'Dedicated account manager',   ok: false },
      ],
      cta: 'Get Started',
    },
    {
      name: 'Professional', sub: 'Up to 100 guards',
      badge: 'Most Popular', grad: 'from-blue-500 to-blue-700',
      btn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/40',
      features: [
        { l: 'Up to 100 guards',            ok: true  },
        { l: 'Guard scheduling & rostering', ok: true  },
        { l: 'GPS clock-in / geofencing',   ok: true  },
        { l: 'Full payroll & timesheets',   ok: true  },
        { l: 'SIA compliance tracking',     ok: true  },
        { l: 'Client portal access',        ok: true  },
        { l: 'Dedicated account manager',   ok: false },
      ],
      cta: 'Get Started',
    },
    {
      name: 'Enterprise', sub: 'Unlimited guards',
      badge: null, grad: 'from-indigo-500 to-purple-700',
      btn: 'bg-white/10 hover:bg-white/15 text-white border border-white/10',
      features: [
        { l: 'Unlimited guards & sites',    ok: true },
        { l: 'Guard scheduling & rostering', ok: true },
        { l: 'GPS + Face-ID verification',  ok: true },
        { l: 'Full payroll & timesheets',   ok: true },
        { l: 'SIA compliance tracking',     ok: true },
        { l: 'Client portal access',        ok: true },
        { l: 'Dedicated account manager',   ok: true },
      ],
      cta: 'Contact Us',
    },
  ]

  return (
    <section id="plans" className="py-24 px-5 relative">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      <div className="max-w-6xl mx-auto relative z-10">
        <FadeIn className="text-center mb-16">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Pricing</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mt-3 tracking-tight">Simple, transparent pricing</h2>
          <p className="text-white/40 mt-4 text-lg max-w-xl mx-auto">Scale as your workforce grows. No per-guard fees, no hidden costs.</p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6 items-center">
          {plans.map((p, i) => (
            <FadeIn key={p.name} delay={i * 0.12}>
              <div className={`relative rounded-3xl p-[2px] bg-gradient-to-b ${p.grad} ${p.badge ? 'md:scale-105 z-10 shadow-2xl' : ''}`}>
                <div className="rounded-[22px] bg-[#0c1220] px-7 py-8 h-full">
                  {p.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">{p.badge}</span>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-white">{p.name}</h3>
                    <p className="text-white/40 text-sm mt-1">{p.sub}</p>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {p.features.map(f => (
                      <li key={f.l} className="flex items-center gap-3 text-sm">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${f.ok ? 'bg-blue-600/20 ring-1 ring-blue-500/30' : 'bg-white/5 ring-1 ring-white/10'}`}>
                          {f.ok ? <Check size={11} className="text-blue-400" /> : <X size={11} className="text-white/25" />}
                        </span>
                        <span className={f.ok ? 'text-white/75' : 'text-white/25'}>{f.l}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="#contact" className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all ${p.btn}`}>
                    {p.cta} <ArrowRight size={15} />
                  </a>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.4} className="text-center mt-8">
          <p className="text-white/30 text-sm">All plans billed annually. <a href="#contact" className="text-blue-400 hover:underline">Talk to us about monthly options.</a></p>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Mission ─────────────────────────────────────────────────────────────────
function Mission() {
  const values = [
    { Icon: ShieldCheck,   title: 'Built for the industry',  desc: "Designed from the ground up for security operations — not adapted from generic workforce software." },
    { Icon: Users,         title: 'Guards First',            desc: 'The officer mobile app is intuitive, fast and works offline — so your team actually uses it.' },
    { Icon: Zap,           title: 'Real-time everything',    desc: 'From clock-ins to incidents, everything happens live. No sync delays, no stale data.' },
    { Icon: Lock,          title: 'Compliance by default',   desc: "SIA checks, GDPR-compliant audit logs and automated alerts mean you're always covered." },
    { Icon: Eye,           title: 'Full transparency',       desc: 'Your clients see exactly what they pay for — live dashboards, not monthly PDF reports.' },
    { Icon: CalendarCheck, title: 'Scales with you',         desc: 'Whether you run 10 guards or 1,000, Strondis grows with your business without re-onboarding.' },
  ]

  return (
    <section id="mission" className="py-24 px-5 relative overflow-hidden">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-80 h-80 bg-blue-700/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="max-w-6xl mx-auto relative z-10">
        <FadeIn className="text-center mb-20">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Our Mission</span>
          <div className="mt-6 max-w-3xl mx-auto">
            <blockquote className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight">
              "To give every security company — regardless of size — the{' '}
              <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">same operational edge</span>
              {' '}as the largest firms in the industry."
            </blockquote>
            <p className="text-white/40 mt-6 text-base leading-relaxed max-w-2xl mx-auto">
              Security companies deserve better than spreadsheets and WhatsApp groups. Strondis brings enterprise-grade operations management to businesses of every size — affordable, intuitive and purpose-built for the UK security industry.
            </p>
          </div>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {values.map((v, i) => (
            <FadeIn key={v.title} delay={i * 0.08}>
              <div className="bg-white/[0.03] border border-white/7 rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/12 transition-all">
                <div className="w-10 h-10 bg-blue-600/15 rounded-xl flex items-center justify-center mb-4">
                  <v.Icon size={19} className="text-blue-400" />
                </div>
                <h4 className="text-white font-semibold mb-2">{v.title}</h4>
                <p className="text-white/40 text-sm leading-relaxed">{v.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { Icon: Phone,      title: 'Book a Demo',       desc: "See Strondis in action. We'll walk you through the platform with your own data and workflows in mind." },
    { Icon: Layers,     title: 'We onboard your team', desc: 'We import your guards, sites and schedules. Your team is up and running in days, not months.' },
    { Icon: TrendingUp, title: 'Grow with confidence', desc: 'Full visibility across your operations from day one. Add sites, guards and clients as your business scales.' },
  ]
  return (
    <section className="py-24 px-5 border-y border-white/5 bg-white/[0.015]">
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-16">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Getting Started</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Up and running in 3 steps</h2>
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-10">
          {steps.map((s, i) => (
            <FadeIn key={s.title} delay={i * 0.15} className="text-center">
              <div className="relative inline-flex mb-5">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600/30 to-blue-800/20 border border-blue-500/20 rounded-2xl flex items-center justify-center">
                  <s.Icon size={26} className="text-blue-400" />
                </div>
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
              </div>
              <h4 className="text-white font-bold text-lg mb-2">{s.title}</h4>
              <p className="text-white/40 text-sm leading-relaxed">{s.desc}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Platform ────────────────────────────────────────────────────────────────
function Platform() {
  return (
    <section id="platform" className="py-24 px-5 relative">
      <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-900/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn className="text-center mb-16">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Two Apps, One Platform</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Built for your whole operation</h2>
          <p className="text-white/40 mt-4 text-lg max-w-xl mx-auto">Your operations team and your guards each get a purpose-built interface — seamlessly connected in real time.</p>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-6">
          <FadeIn>
            <div className="group rounded-3xl p-[2px] bg-gradient-to-br from-blue-500/50 to-blue-800/20 hover:from-blue-500/70 transition-all duration-300">
              <div className="rounded-[22px] bg-[#080d1a] p-8 h-full">
                <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <BarChart3 size={26} className="text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Operations Dashboard</h3>
                <p className="text-white/45 text-sm leading-relaxed mb-6">Your command centre. Manage guards, sites, schedules, payroll and compliance — with a live client portal your customers can log into any time.</p>
                <ul className="space-y-2 mb-8">
                  {['Live guard status & GPS map', 'Shift scheduling & rostering', 'Payroll & timesheet management', 'SIA compliance monitoring', 'AI-assisted incident summaries', 'Client portal with branded reports'].map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/55"><Check size={13} className="text-blue-400 flex-shrink-0" />{f}</li>
                  ))}
                </ul>
                <a href={ADMIN_URL} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30">
                  Open Dashboard <ExternalLink size={15} />
                </a>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.12}>
            <div className="group rounded-3xl p-[2px] bg-gradient-to-br from-slate-500/30 to-slate-800/20 hover:from-slate-500/50 transition-all duration-300">
              <div className="rounded-[22px] bg-[#080d1a] p-8 h-full">
                <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6">
                  <Shield size={26} className="text-white/60" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Guard Mobile App</h3>
                <p className="text-white/45 text-sm leading-relaxed mb-6">A PWA your officers install on any phone. Fast, offline-capable and built around the way guards actually work on site.</p>
                <ul className="space-y-2 mb-8">
                  {['GPS geofence clock-in / clock-out', 'Face-ID biometric verification', 'Shift schedule & site briefings', 'Incident reporting with photos', 'Secure messaging with ops team', 'Works offline, syncs when connected'].map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/55"><Check size={13} className="text-white/30 flex-shrink-0" />{f}</li>
                  ))}
                </ul>
                <a href={GUARD_URL} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all">
                  Guard Login <ExternalLink size={15} />
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
function Testimonials() {
  const items = [
    { quote: "We replaced three separate tools with Strondis. Scheduling, payroll and compliance are now one workflow — it saves us hours every week.", name: 'Daniel R.', role: 'MD, Delta Security Group', stars: 5 },
    { quote: "The client portal alone has transformed our client relationships. They can see live guard status without calling us. Retention has gone up.", name: 'Claire H.', role: 'Operations Director, SafeWatch UK', stars: 5 },
    { quote: "Onboarding was fast and the team actually supported us. Our guards picked up the app in a day. The SIA compliance tracker is a game changer.", name: 'Marcus A.', role: 'CEO, Apex Guard Services', stars: 5 },
  ]
  return (
    <section className="py-24 px-5 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">What Our Clients Say</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Trusted by security companies across the UK</h2>
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <FadeIn key={t.name} delay={i * 0.12}>
              <div className="bg-white/[0.03] border border-white/7 rounded-2xl p-7 flex flex-col gap-4 h-full">
                <div className="flex gap-1">{Array.from({ length: t.stars }).map((_, j) => <Star key={j} size={14} className="text-yellow-400 fill-yellow-400" />)}</div>
                <p className="text-white/60 text-sm leading-relaxed flex-1">"{t.quote}"</p>
                <div>
                  <div className="font-semibold text-white text-sm">{t.name}</div>
                  <div className="text-white/30 text-xs mt-0.5">{t.role}</div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Contact ──────────────────────────────────────────────────────────────────
function Contact() {
  const [form, setForm]       = useState({ name: '', email: '', company: '', message: '' })
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setLoading(false); setSent(true) }, 1200)
  }

  const inputCls = "w-full bg-white/5 border border-white/8 rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"

  return (
    <section id="contact" className="py-24 px-5 relative overflow-hidden">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-80 h-80 bg-blue-800/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn className="text-center mb-14">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Get in Touch</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Book a free demo</h2>
          <p className="text-white/40 mt-4 text-lg max-w-xl mx-auto">See Strondis in action with your data. No obligation — we'll be in touch within 24 hours.</p>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-10">
          <FadeIn className="space-y-6">
            {[
              { Icon: Phone,  title: 'Call Us',        sub: CONTACT_PHONE,  note: 'Mon–Fri, 8am–6pm GMT',       href: `tel:${CONTACT_PHONE}` },
              { Icon: Mail,   title: 'Email Us',       sub: CONTACT_EMAIL,  note: 'We reply within 24 hours',   href: `mailto:${CONTACT_EMAIL}` },
              { Icon: MapPin, title: 'Based in the UK', sub: 'Serving security companies across England, Wales & Scotland', note: null, href: null },
              { Icon: Clock,  title: 'Live Support',   sub: 'In-app chat and phone support for active accounts', note: null, href: null },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-4">
                <div className="w-11 h-11 bg-blue-600/15 rounded-xl flex items-center justify-center flex-shrink-0">
                  <item.Icon size={18} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-white font-semibold mb-0.5 text-sm">{item.title}</div>
                  {item.href
                    ? <a href={item.href} className="text-white/50 hover:text-white transition-colors text-sm">{item.sub}</a>
                    : <p className="text-white/50 text-sm">{item.sub}</p>
                  }
                  {item.note && <p className="text-white/30 text-xs mt-0.5">{item.note}</p>}
                </div>
              </div>
            ))}
          </FadeIn>

          <FadeIn delay={0.1}>
            {sent ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 bg-green-500/5 border border-green-500/15 rounded-2xl p-10">
                <div className="w-16 h-16 bg-green-500/15 rounded-2xl flex items-center justify-center">
                  <Check size={28} className="text-green-400" />
                </div>
                <h4 className="text-xl font-bold text-white">Request Received!</h4>
                <p className="text-white/45 text-sm">A Strondis team member will be in touch within 24 hours to arrange your demo.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 text-xs font-medium block mb-1.5">Full Name</label>
                    <input required value={form.name} onChange={set('name')} placeholder="John Smith" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs font-medium block mb-1.5">Work Email</label>
                    <input required type="email" value={form.email} onChange={set('email')} placeholder="john@securityco.com" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">Company Name</label>
                  <input value={form.company} onChange={set('company')} placeholder="Your security company" className={inputCls} />
                </div>
                <div>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">How many guards do you manage?</label>
                  <textarea required rows={3} value={form.message} onChange={set('message')}
                    placeholder="Tell us about your team size, current tools and what you're looking to improve..."
                    className={`${inputCls} resize-none`} />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/30">
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Send size={16} /> Book a Demo</>
                  }
                </button>
              </form>
            )}
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-10 mb-10">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm leading-none">S</span>
              </div>
              <span className="font-bold text-white text-base">Strondis</span>
            </div>
            <p className="text-white/35 text-sm leading-relaxed">The all-in-one operations platform for security companies. Scheduling, compliance, payroll and client management — all in one place.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <div>
              <h5 className="text-white font-semibold mb-3">Product</h5>
              <ul className="space-y-2 text-white/35">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#plans" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#platform" className="hover:text-white transition-colors">Platform</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-3">Apps</h5>
              <ul className="space-y-2 text-white/35">
                <li><a href={ADMIN_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Operations Dashboard</a></li>
                <li><a href={GUARD_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Guard Mobile App</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-3">Company</h5>
              <ul className="space-y-2 text-white/35">
                <li><a href="#mission" className="hover:text-white transition-colors">Our Mission</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact Us</a></li>
                <li><a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition-colors">{CONTACT_EMAIL}</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row justify-between gap-3 text-white/25 text-xs">
          <span>© {new Date().getFullYear()} Strondis Ltd. All rights reserved.</span>
          <span>B2B SaaS · UK-based · GDPR Compliant</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Chat Widget ──────────────────────────────────────────────────────────────
function ChatWidget() {
  const [open, setOpen]         = useState(false)
  const [input, setInput]       = useState('')
  const [messages, setMessages] = useState([
    { from: 'bot', text: '👋 Hi! I\'m here to help. Are you looking to manage your security company with Strondis, or do you have a question about the platform?' },
  ])
  const [typing, setTyping]     = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  const CANNED: Record<string, string> = {
    price:    "Our pricing depends on the number of guards you manage. Book a demo and we'll walk you through a plan that fits your business.",
    pricing:  "Our pricing depends on the number of guards you manage. Book a demo and we'll walk you through a plan that fits your business.",
    demo:     "Absolutely! Fill in the contact form below and we'll arrange a live walkthrough of the platform tailored to your business.",
    trial:    "We offer a guided demo and onboarding period. Get in touch via the contact form and we'll get you set up.",
    login:    `You can access the Operations Dashboard at: ${ADMIN_URL} — or the Guard App at: ${GUARD_URL}. Contact us if you need credentials.`,
    guard:    `The Guard App is available at: ${GUARD_URL}. It works as a PWA on any mobile browser — no app store required.`,
    feature:  "Strondis covers guard scheduling, GPS tracking, payroll, SIA compliance, incident reporting and a client portal. See the Features section for the full list.",
    compliance: "We track SIA licence expiry, DBS checks and certifications with automated alerts. Everything is logged and auditable.",
    default:  `Thanks for your message! Email us at ${CONTACT_EMAIL} or call ${CONTACT_PHONE}. We'll get back to you within 24 hours.`,
  }

  const reply = (text: string) => {
    const lower = text.toLowerCase()
    for (const key of Object.keys(CANNED).filter(k => k !== 'default')) {
      if (lower.includes(key)) return CANNED[key]
    }
    return CANNED.default
  }

  const send = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    setMessages(m => [...m, { from: 'user', text }])
    setTyping(true)
    setTimeout(() => { setTyping(false); setMessages(m => [...m, { from: 'bot', text: reply(text) }]) }, 1200)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
            className="w-[340px] max-w-[calc(100vw-24px)] bg-[#0c1220] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col">
            <div className="bg-blue-700 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
                  <span className="text-white font-black text-base">S</span>
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">Strondis Support</div>
                  <div className="flex items-center gap-1.5 text-blue-200 text-xs">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    Typically replies instantly
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white p-1"><X size={18} /></button>
            </div>

            <div className="px-4 pt-3 pb-1 flex gap-2 flex-wrap">
              {['Book a demo', 'Pricing', 'Guard App access'].map(q => (
                <button key={q} onClick={() => setInput(q)}
                  className="text-xs text-blue-400 border border-blue-500/20 bg-blue-600/5 hover:bg-blue-600/15 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">
                  {q}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-64">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${m.from === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white/8 text-white/80 rounded-bl-sm'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-white/8 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                    {[0, 1, 2].map(d => (
                      <motion.span key={d} className="w-1.5 h-1.5 bg-white/40 rounded-full"
                        animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.15 }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-4 pb-4">
              <div className="flex gap-2 items-center bg-white/5 border border-white/8 rounded-xl px-3 py-2">
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Ask us anything..."
                  className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none" />
                <button onClick={send} disabled={!input.trim()}
                  className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg flex items-center justify-center transition-colors flex-shrink-0">
                  <Send size={14} className="text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button onClick={() => setOpen(v => !v)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
        className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/50 relative">
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="x"   initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}><X size={22} /></motion.div>
            : <motion.div key="msg" initial={{ rotate: 90,  opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}><MessageSquare size={22} /></motion.div>
          }
        </AnimatePresence>
        {!open && <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-[#060811]" />}
      </motion.button>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="relative bg-[#060811] min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <Plans />
      <Mission />
      <HowItWorks />
      <Platform />
      <Testimonials />
      <Contact />
      <Footer />
      <ChatWidget />
    </div>
  )
}
