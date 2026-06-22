import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './SplashScreen.css'

const SPLASH_DURATION = 3400
const EXIT_DURATION = 500

export default function SplashScreen({ onComplete, persistent = false }) {
  const navigate = useNavigate()
  const completeRef = useRef(onComplete)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (persistent) return undefined
    const exitTimer = window.setTimeout(() => setExiting(true), SPLASH_DURATION - EXIT_DURATION)
    const finishTimer = window.setTimeout(() => {
      navigate('/dashboard', { replace: true })
      completeRef.current?.()
    }, SPLASH_DURATION)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(finishTimer)
    }
  }, [navigate, persistent])

  return (
    <main className={`nxt-splash ${exiting ? 'nxt-splash-exit' : ''}`} aria-label="NXT Elevata Media loading">
      <img className="nxt-splash-mobile-artwork" src="/nxt-workspace-splash.jpeg" alt="NXT Eleveta Media" />
      <section className="nxt-splash-wide-artwork" aria-hidden="true">
        <img className="nxt-splash-mark" src="/nxt-splash-mark.png" alt="" />
        <div className="nxt-splash-brand">
          <span>from</span>
          <strong>NXT ELEVETA MEDIA</strong>
          <i />
        </div>
      </section>
      <div className="nxt-splash-progress" aria-hidden="true"><span /></div>
    </main>
  )
}
