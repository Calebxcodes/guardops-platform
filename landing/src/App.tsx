import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  Shield, ShieldCheck, ShieldAlert, Users, MapPin, Clock,
  ChevronDown, ArrowRight, Check, X, MessageSquare, Send,
  Phone, Mail, Star, Zap, Lock, Eye, Radio, BarChart3,
  CalendarCheck, FileText, ExternalLink, Menu
} from 'lucide-react'
import './index.css'

// ─── Config ────────────────────────────────────────────────────────────────
const ADMIN_URL     = (import.meta as any).env?.VITE_ADMIN_URL  || 'https://your-admin-crm.vercel.app'
const GUARD_URL     = (import.meta as any).env?.VITE_GUARD_URL  || 'https://your-guard-app.vercel.app'
const CONTACT_EMAIL = 'info@strondis.com'
const CONTACT_PHONE = '+44 20 0000 0000'

// ─── Fade-up animation variant ─────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
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

// ─── Navbar ─────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const links = [
    { label: 'Services', href: '#services' },
    { label: 'Plans',    href: '#plans'    },
    { label: 'Mission',  href: '#mission'  },
    { label: 'Clients',  href: '#clients'  },
    { label: 'Contact',  href: '#contact'  },
  ]

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#060811]/90 backdrop-blur-xl border-b border-white/5 shadow-xl shadow-black/30' : ''}`}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40">
            <Shield size={18} className="text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Strondis</span>
        </a>

        <nav className="hidden md:flex items-center gap-7">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-white/50 hover:text-white text-sm font-medium transition-colors">{l.label}</a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a href={GUARD_URL} target="_blank" rel="noreferrer" className="text-white/60 hover:text-white text-sm font-medium transition-colors">Officer Login</a>
          <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-600/30">Client Portal</a>
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
                <a href={GUARD_URL} target="_blank" rel="noreferrer" className="text-center border border-white/10 text-white/70 text-sm font-medium py-2.5 rounded-lg hover:bg-white/5 transition-colors">Officer Login</a>
                <a href={ADMIN_URL} target="_blank" rel="noreferrer" className="text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">Client Portal →</a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 pt-16">
      <div className="orb w-[600px] h-[600px] bg-blue-600/20 -top-40 -left-40" style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div className="orb w-[500px] h-[500px] bg-blue-900/30 top-1/3 -right-60" style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div className="orb w-[300px] h-[300px] bg-indigo-600/15 bottom-20 left-1/3" style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <span className="text-blue-300 text-sm font-medium">Professional Security Solutions</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, type: 'spring', bounce: 0.4 }}
          className="flex justify-center mb-8">
          <div className="relative animate-float">
            <div className="absolute inset-0 bg-blue-600/30 rounded-3xl blur-2xl scale-150" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-600/50">
              <Shield size={44} className="text-white" />
            </div>
          </div>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.08] tracking-tight text-white mb-6">
          Security You Can{' '}
          <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">Trust.</span>
          <br />
          Operations You Can{' '}
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Rely On.</span>
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
          className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          Strondis delivers professional security guarding, mobile patrols and full-site management — powered by real-time technology that keeps your premises, people and assets safe 24/7.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="#contact" className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-4 rounded-xl shadow-xl shadow-blue-600/40 transition-all hover:scale-[1.02] active:scale-[0.98] text-base">
            Get a Free Quote <ArrowRight size={18} />
          </a>
          <a href="#services" className="inline-flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/8 text-white font-semibold px-7 py-4 rounded-xl transition-all text-base">
            Our Services <ChevronDown size={18} />
          </a>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 flex flex-wrap justify-center gap-6 text-white/30 text-sm">
          {['SIA Licensed', 'Fully Insured', 'DBS Checked', '24/7 Response'].map(b => (
            <span key={b} className="flex items-center gap-1.5"><Check size={14} className="text-blue-400" />{b}</span>
          ))}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <span className="text-white/20 text-xs tracking-widest uppercase">Scroll</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <ChevronDown size={18} className="text-white/20" />
        </motion.div>
      </motion.div>
    </section>
  )
}

// ─── Stats ───────────────────────────────────────────────────────────────────
function Stats() {
  const stats = [
    { value: '200+', label: 'Officers Deployed'  },
    { value: '50+',  label: 'Sites Protected'    },
    { value: '24/7', label: 'Operations Cover'   },
    { value: '100%', label: 'SIA Compliant'      },
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

// ─── Services ────────────────────────────────────────────────────────────────
function Services() {
  const services = [
    {
      Icon: ShieldCheck,
      title: 'Static Guarding',
      desc: 'Trained, uniformed SIA-licensed officers stationed at your premises — providing visible deterrence, access control and rapid incident response.',
      features: ['SIA-licensed officers', 'Access control & visitor management', 'CCTV monitoring', 'Incident reporting'],
      grad: 'from-blue-600/20 to-blue-800/10',
      ic: 'text-blue-400', ib: 'bg-blue-600/15',
    },
    {
      Icon: Radio,
      title: 'Mobile Patrols',
      desc: 'Flexible, cost-effective patrol solutions covering multiple sites — with GPS-tracked officers, keyholding and alarm response.',
      features: ['GPS-tracked patrol routes', 'Keyholding & alarm response', 'Multi-site coverage', 'Detailed patrol reports'],
      grad: 'from-indigo-600/20 to-indigo-800/10',
      ic: 'text-indigo-400', ib: 'bg-indigo-600/15',
    },
    {
      Icon: BarChart3,
      title: 'Security Management',
      desc: 'End-to-end security management with real-time dashboards, officer scheduling, compliance tracking and client reporting — all in one platform.',
      features: ['Live operations dashboard', 'Officer scheduling & payroll', 'SIA compliance tracking', 'Client portal access'],
      grad: 'from-cyan-600/20 to-cyan-800/10',
      ic: 'text-cyan-400', ib: 'bg-cyan-600/15',
    },
  ]

  return (
    <section id="services" className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">What We Do</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mt-3 tracking-tight">Comprehensive Security Services</h2>
          <p className="text-white/40 mt-4 text-lg max-w-xl mx-auto">From a single officer to full-site operations management, we tailor every engagement to your specific needs.</p>
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <FadeIn key={s.title} delay={i * 0.12}>
              <div className={`h-full bg-gradient-to-br ${s.grad} border border-white/8 rounded-2xl p-7 hover:border-white/15 transition-all hover:-translate-y-0.5`}>
                <div className={`w-12 h-12 ${s.ib} rounded-xl flex items-center justify-center mb-5`}>
                  <s.Icon size={22} className={s.ic} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed mb-5">{s.desc}</p>
                <ul className="space-y-2">
                  {s.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/55">
                      <Check size={13} className={s.ic} />{f}
                    </li>
                  ))}
                </ul>
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
      name: 'Essential Guard', sub: 'Single-site protection',
      badge: null, grad: 'from-slate-400 to-slate-600',
      btn: 'bg-white/10 hover:bg-white/15 text-white border border-white/10',
      features: [
        { l: '1 Static Guard Post',       ok: true  },
        { l: 'SIA-licensed Officers',      ok: true  },
        { l: 'Daily Incident Reports',     ok: true  },
        { l: 'Access Control',             ok: true  },
        { l: 'Mobile Patrol Add-on',       ok: false },
        { l: 'Client Portal Access',       ok: false },
        { l: 'Dedicated Account Manager', ok: false },
      ],
      cta: 'Get Started',
    },
    {
      name: 'SecureOps', sub: 'Multi-site & patrol coverage',
      badge: 'Most Popular', grad: 'from-blue-500 to-blue-700',
      btn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/40',
      features: [
        { l: 'Up to 5 Guard Posts',        ok: true  },
        { l: 'SIA-licensed Officers',       ok: true  },
        { l: 'Real-time Incident Reports', ok: true  },
        { l: 'Mobile Patrol Rounds',       ok: true  },
        { l: 'GPS Patrol Tracking',        ok: true  },
        { l: 'Client Portal Access',       ok: true  },
        { l: 'Dedicated Account Manager',  ok: false },
      ],
      cta: 'Get Started',
    },
    {
      name: 'Elite Shield', sub: 'Full security management',
      badge: null, grad: 'from-indigo-500 to-purple-700',
      btn: 'bg-white/10 hover:bg-white/15 text-white border border-white/10',
      features: [
        { l: 'Unlimited Guard Posts',       ok: true },
        { l: 'SIA-licensed Officers',       ok: true },
        { l: 'AI-Powered Ops Dashboard',    ok: true },
        { l: 'Mobile Patrols + Keyholding', ok: true },
        { l: 'GPS & Face ID Verification',  ok: true },
        { l: 'Client Portal Access',        ok: true },
        { l: 'Dedicated Account Manager',   ok: true },
      ],
      cta: 'Contact Us',
    },
  ]

  return (
    <section id="plans" className="py-24 px-5 relative">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      <div className="max-w-6xl mx-auto relative z-10">
        <FadeIn className="text-center mb-16">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Service Tiers</span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mt-3 tracking-tight">Choose Your Protection Level</h2>
          <p className="text-white/40 mt-4 text-lg max-w-xl mx-auto">Flexible packages for businesses of all sizes. All quotes are bespoke — contact us for pricing.</p>
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
          <p className="text-white/30 text-sm">All pricing is bespoke. <a href="#contact" className="text-blue-400 hover:underline">Contact us for a free site survey.</a></p>
        </FadeIn>
      </div>
    </section>
  )
}

// ─── Mission ─────────────────────────────────────────────────────────────────
function Mission() {
  const values = [
    { Icon: ShieldCheck,    title: 'Integrity First',    desc: "We operate with honesty and transparency — no hidden costs, no shortcuts in every engagement." },
    { Icon: Users,          title: 'People-Centred',     desc: 'Our officers are our greatest asset. Highly trained, well supported and proud to wear the Strondis badge.' },
    { Icon: Zap,            title: 'Rapid Response',     desc: 'When seconds matter, our team is ready. Every site is backed by 24/7 control room support.' },
    { Icon: Lock,           title: 'Compliance Driven',  desc: "SIA licensing, DBS checks, GDPR-compliant reporting — we set the standard so you don't have to." },
    { Icon: Eye,            title: 'Always Vigilant',    desc: 'Proactive security means identifying risks before incidents occur. Prevention is our first line of defence.' },
    { Icon: CalendarCheck,  title: 'Reliable Always',    desc: 'No call-outs, no gaps in cover. Our scheduling system ensures your site is never left unprotected.' },
  ]

  return (
    <section id="mission" className="py-24 px-5 relative overflow-hidden">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-80 h-80 bg-blue-700/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="max-w-6xl mx-auto relative z-10">
        <FadeIn className="text-center mb-20">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Our Mission</span>
          <div className="mt-6 max-w-3xl mx-auto">
            <blockquote className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight">
              "To provide{' '}
              <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">world-class security</span>
              {' '}that empowers businesses to operate with complete confidence — knowing their people, premises and assets are in safe hands."
            </blockquote>
            <p className="text-white/40 mt-6 text-base leading-relaxed max-w-2xl mx-auto">
              Founded in the UK with a commitment to professionalism, Strondis combines licensed security expertise with modern operational technology to deliver a service that is transparent, reliable and built around you.
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
    { Icon: Phone,       title: 'Free Consultation',     desc: "Tell us about your site, requirements and budget. We'll assess the risks and recommend the right solution." },
    { Icon: FileText,    title: 'Bespoke Proposal',      desc: 'Receive a detailed, transparent proposal tailored to your site — with clear pricing and service levels.' },
    { Icon: ShieldAlert, title: 'Deployment & Go-Live',  desc: 'Our team deploys swiftly with full handover, briefings and immediate access to the client operations portal.' },
  ]
  return (
    <section className="py-24 px-5 border-y border-white/5 bg-white/[0.015]">
      <div className="max-w-5xl mx-auto">
        <FadeIn className="text-center mb-16">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">How It Works</span>
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

// ─── Clients / Portals ────────────────────────────────────────────────────────
function Clients() {
  return (
    <section id="clients" className="py-24 px-5 relative">
      <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-900/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="max-w-5xl mx-auto relative z-10">
        <FadeIn className="text-center mb-16">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Platform Access</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Your Operations, At Your Fingertips</h2>
          <p className="text-white/40 mt-4 text-lg max-w-xl mx-auto">Every Strondis client and officer has dedicated portal access — real-time visibility into everything that matters.</p>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-6">
          <FadeIn>
            <div className="group rounded-3xl p-[2px] bg-gradient-to-br from-blue-500/50 to-blue-800/20 hover:from-blue-500/70 transition-all duration-300">
              <div className="rounded-[22px] bg-[#080d1a] p-8 h-full">
                <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <BarChart3 size={26} className="text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Client Operations Portal</h3>
                <p className="text-white/45 text-sm leading-relaxed mb-6">Full visibility into your security operations. View live timesheets, incident reports, guard schedules, payroll summaries and SIA compliance — all in one professional dashboard.</p>
                <ul className="space-y-2 mb-8">
                  {['Live guard timesheets & GPS', 'Incident reports in real time', 'Schedule & payroll management', 'SIA licence compliance', 'AI-powered incident summaries'].map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/55"><Check size={13} className="text-blue-400 flex-shrink-0" />{f}</li>
                  ))}
                </ul>
                <a href={ADMIN_URL} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30">
                  Access Client Portal <ExternalLink size={15} />
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
                <h3 className="text-2xl font-bold text-white mb-3">Officer Mobile App</h3>
                <p className="text-white/45 text-sm leading-relaxed mb-6">Our officers use a dedicated mobile app to clock in/out with geofencing and Face ID, log incidents, view schedules, and stay connected — all verified in real time.</p>
                <ul className="space-y-2 mb-8">
                  {['GPS geofence clock-in/out', 'Face ID biometric verification', 'Shift schedule & assignments', 'Incident reporting on the go', 'Secure messaging'].map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/55"><Check size={13} className="text-white/30 flex-shrink-0" />{f}</li>
                  ))}
                </ul>
                <a href={GUARD_URL} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all">
                  Officer Login <ExternalLink size={15} />
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
    { quote: "Strondis transformed how we manage security across our three retail sites. The client portal gives me complete visibility without chasing anyone.", name: 'Sarah M.', role: 'Operations Director', stars: 5 },
    { quote: "Response times are exceptional. Live reporting gives our board real confidence that cover is where it needs to be, when it needs to be.", name: 'James T.', role: 'Facilities Manager', stars: 5 },
    { quote: "Switching to Strondis was the best decision we made. Professional, compliant, and the tech platform is genuinely impressive.", name: 'Priya K.', role: 'Site Manager', stars: 5 },
  ]
  return (
    <section className="py-24 px-5 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-14">
          <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">Testimonials</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Trusted by businesses across the UK</h2>
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
  const [form, setForm]     = useState({ name: '', email: '', company: '', message: '' })
  const [sent, setSent]     = useState(false)
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
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Start Your Free Site Survey</h2>
          <p className="text-white/40 mt-4 text-lg max-w-xl mx-auto">No obligation. One of our consultants will be in touch within 24 hours.</p>
        </FadeIn>

        <div className="grid md:grid-cols-2 gap-10">
          <FadeIn className="space-y-6">
            {[
              { Icon: Phone, title: 'Call Us', sub: CONTACT_PHONE, note: 'Mon–Fri, 8am–6pm GMT', href: `tel:${CONTACT_PHONE}` },
              { Icon: Mail,  title: 'Email Us', sub: CONTACT_EMAIL, note: 'We reply within 24 hours', href: `mailto:${CONTACT_EMAIL}` },
              { Icon: MapPin, title: 'Based in the UK', sub: 'Operating nationally across England, Wales & Scotland', note: null, href: null },
              { Icon: Clock,  title: 'Emergency Line', sub: '24/7 control room for active clients', note: null, href: null },
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
                <h4 className="text-xl font-bold text-white">Message Received!</h4>
                <p className="text-white/45 text-sm">A Strondis consultant will be in touch within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/50 text-xs font-medium block mb-1.5">Full Name</label>
                    <input required value={form.name} onChange={set('name')} placeholder="John Smith" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-white/50 text-xs font-medium block mb-1.5">Email Address</label>
                    <input required type="email" value={form.email} onChange={set('email')} placeholder="john@company.com" className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">Company / Organisation</label>
                  <input value={form.company} onChange={set('company')} placeholder="Your company name" className={inputCls} />
                </div>
                <div>
                  <label className="text-white/50 text-xs font-medium block mb-1.5">How can we help?</label>
                  <textarea required rows={4} value={form.message} onChange={set('message')}
                    placeholder="Tell us about your site, number of locations, and what you're looking for..."
                    className={`${inputCls} resize-none`} />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/30">
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Send size={16} /> Send Enquiry</>
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
                <Shield size={15} className="text-white" />
              </div>
              <span className="font-bold text-white text-base">Strondis</span>
            </div>
            <p className="text-white/35 text-sm leading-relaxed">Professional security services backed by modern technology. SIA licensed, fully insured and compliant.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <div>
              <h5 className="text-white font-semibold mb-3">Services</h5>
              <ul className="space-y-2 text-white/35">
                <li><a href="#services" className="hover:text-white transition-colors">Static Guarding</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">Mobile Patrols</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">Security Management</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-3">Platform</h5>
              <ul className="space-y-2 text-white/35">
                <li><a href={ADMIN_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Client Portal</a></li>
                <li><a href={GUARD_URL} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Officer App</a></li>
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
          <span>SIA Approved Contractor · Fully Insured · DBS Checked</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Chat Widget ──────────────────────────────────────────────────────────────
function ChatWidget() {
  const [open, setOpen]       = useState(false)
  const [input, setInput]     = useState('')
  const [messages, setMessages] = useState([
    { from: 'bot', text: '👋 Welcome to Strondis! Are you looking for security services, or do you have a question about our platform?' },
  ])
  const [typing, setTyping]   = useState(false)
  const bottomRef             = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  const CANNED: Record<string, string> = {
    price: "Our pricing is bespoke and based on your specific requirements. Fill in the contact form and we'll prepare a free no-obligation quote.",
    quote: "Our pricing is bespoke and based on your specific requirements. Fill in the contact form and we'll prepare a free no-obligation quote.",
    portal: `Access the Client Portal at: ${ADMIN_URL} — or the Officer App at: ${GUARD_URL}. Contact us if you need credentials.`,
    login: `Access the Client Portal at: ${ADMIN_URL} — or the Officer App at: ${GUARD_URL}. Contact us if you need credentials.`,
    default: `Thanks for reaching out! Email us at ${CONTACT_EMAIL} or call ${CONTACT_PHONE}. A consultant will get back to you within 24 hours.`,
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
            {/* Header */}
            <div className="bg-blue-700 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
                  <Shield size={17} className="text-white" />
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

            {/* Quick CTAs */}
            <div className="px-4 pt-3 pb-1 flex gap-2 flex-wrap">
              {['Get a quote', 'Portal access', 'Our services'].map(q => (
                <button key={q} onClick={() => { setInput(q) }}
                  className="text-xs text-blue-400 border border-blue-500/20 bg-blue-600/5 hover:bg-blue-600/15 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">
                  {q}
                </button>
              ))}
            </div>

            {/* Messages */}
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

            {/* Input */}
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
            ? <motion.div key="x"   initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90,  opacity: 0 }} transition={{ duration: 0.2 }}><X size={22} /></motion.div>
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
      <Services />
      <Plans />
      <Mission />
      <HowItWorks />
      <Clients />
      <Testimonials />
      <Contact />
      <Footer />
      <ChatWidget />
    </div>
  )
}
