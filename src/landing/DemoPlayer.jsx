/**
 * Landing page ka "Watch Demo" — asli app ke screenshots ka auto-playing tour.
 *
 * Pehle ye nakli recreations dikhata tha (hath se banaye hue div/bar). Wo dekhne
 * me theek tha par wo product nahi tha, isliye ab `public/screens/*.jpg` lagti
 * hain — jo `scripts/capture-screens.mjs` se asli app se li jaati hain.
 *
 * Screenshots DEMO MODE se aati hain, kisi asli school se nahi. Landing page
 * public hai; wahan asli dashboard lagane ka matlab hota 240 bachchon ke naam,
 * admission number aur fees ek marketing page par daal dena. Demo mode wahi
 * asli UI chalata hai par banaye hue data ke saath.
 *
 * Yahan koi network call nahi hoti — images `public/` se aati hain, isliye
 * database/egress par iska koi asar nahi.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  CalendarCheck, LayoutDashboard, Pause, Play, Users, Wallet, X,
} from 'lucide-react'
import './demo.css'

// 4 scene × 7.5s = 30 second, jitna landing page ka CTA kehta hai.
const SCENE_MS = 7500

const SCENES = [
  {
    id: 'dashboard', icon: LayoutDashboard, label: 'Command Center',
    src: '/screens/dashboard.jpg',
    caption: 'Attendance, fee collection aur staff — sab ek screen par, live.',
  },
  {
    id: 'students', icon: Users, label: 'Students',
    src: '/screens/students.jpg',
    caption: 'Poora student record — class, admission number, guardian aur fee status.',
  },
  {
    id: 'attendance', icon: CalendarCheck, label: 'Attendance',
    src: '/screens/attendance.jpg',
    caption: 'Poori class ki haaziri seconds me. Bache sirf exception mark karte hain.',
  },
  {
    id: 'fees', icon: Wallet, label: 'Fee Collection',
    src: '/screens/fees.jpg',
    caption: 'Har receipt ka register — number, amount aur status ke saath.',
  },
]

export default function DemoPlayer({ open, onClose }) {
  const [scene, setScene] = useState(0)
  const [playing, setPlaying] = useState(true)
  const closeRef = useRef(null)

  // Jinhone motion kam karne ko kaha hai unke liye auto-advance band; wo khud
  // sidebar se scene chunte hain.
  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const go = useCallback((index) => {
    setScene(((index % SCENES.length) + SCENES.length) % SCENES.length)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    setScene(0)
    setPlaying(!reduced)
    closeRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setScene(s => (s + 1) % SCENES.length)
      if (e.key === 'ArrowLeft') setScene(s => (s - 1 + SCENES.length) % SCENES.length)
    }
    document.addEventListener('keydown', onKey)
    // modal khule to peeche ka page scroll na ho
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, reduced, onClose])

  // agla scene
  useEffect(() => {
    if (!open || !playing || reduced) return undefined
    const id = setTimeout(() => go(scene + 1), SCENE_MS)
    return () => clearTimeout(id)
  }, [open, playing, reduced, scene, go])

  if (!open) return null
  const current = SCENES[scene]

  return <div className="dm-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="SCHOOL99 product demo">
    <div className="dm-shell" onClick={e => e.stopPropagation()}>

      <div className="dm-topbar">
        <div className="dm-brand">
          <span className="dm-dot" /><span className="dm-dot" /><span className="dm-dot" />
          <b>SCHOOL99</b><span className="dm-sep">/</span><span>{current.label}</span>
        </div>
        <div className="dm-topbar-actions">
          {!reduced && <button type="button" className="dm-icon" onClick={() => setPlaying(p => !p)}
            aria-label={playing ? 'Pause demo' : 'Play demo'}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>}
          <button type="button" className="dm-icon" ref={closeRef} onClick={onClose} aria-label="Close demo">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="dm-body">
        <nav className="dm-side" aria-label="Demo sections">
          {SCENES.map((s, i) => <button key={s.id} type="button"
            className={`dm-side-item ${i === scene ? 'on' : ''}`} onClick={() => go(i)}>
            <s.icon size={16} /><span>{s.label}</span>
          </button>)}
        </nav>

        <div className="dm-stage">
          <div className="dm-shot">
            {SCENES.map((s, i) => <img
              key={s.id}
              src={s.src}
              alt={`SCHOOL99 ${s.label} screen`}
              className={i === scene ? 'on' : ''}
              // Pehli screen turant. Baaki lazy — saari ek dusre ke upar rakhi
              // hain, to modal khulte hi browser unhe apne aap le aata hai;
              // landing page par ye 700 KB pehle se download nahi hota.
              loading={i === 0 ? 'eager' : 'lazy'}
            />)}
          </div>
          <p className="dm-caption">{current.caption}</p>
        </div>
      </div>

      <div className="dm-progress">
        {SCENES.map((s, i) => <span key={s.id} className={i === scene ? 'on' : i < scene ? 'done' : ''}>
          <i style={{ animationDuration: `${SCENE_MS}ms`, animationPlayState: playing && !reduced ? 'running' : 'paused' }} />
        </span>)}
      </div>

      <p className="dm-note">Actual product screens. Sample data — not a real school record.</p>
    </div>
  </div>
}
