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
    <main
      className={`s99-splash ${exiting ? 's99-splash-exit' : ''}`}
      role="img"
      aria-label="School99 — Smart Schools. Better Tomorrow."
    >
      <span className="s99-aura s99-aura-1" aria-hidden="true" />
      <span className="s99-aura s99-aura-2" aria-hidden="true" />

      <div className="s99-brand">
        <div className="s99-logo-shell">
          <div className="s99-logo-tile">
            {/*
              Placeholder wordmark. To use the real School99 logo, replace this
              whole <svg> with:
                <img className="s99-wordmark" src="/school99-logo.png" alt="School99" />
              Keep the logo's own aspect ratio — the tile sizes it automatically.
            */}
            <svg
              className="s99-wordmark"
              viewBox="0 0 300 108"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <g fontFamily="-apple-system, 'Segoe UI', Roboto, system-ui, sans-serif" fontWeight="800">
                <text x="150" y="58" textAnchor="middle" fontSize="52" letterSpacing="-1.5" fill="#0C1220">
                  School<tspan fill="#E4322B">99</tspan>
                </text>
                <rect x="93" y="76" width="114" height="5" rx="2.5" fill="#E4322B" />
                <text x="150" y="99" textAnchor="middle" fontSize="12.5" fontWeight="600" letterSpacing="4" fill="#5A6478">
                  E R P
                </text>
              </g>
            </svg>
          </div>
        </div>

        <p className="s99-tagline">Smart Schools. <b>Better Tomorrow.</b></p>
      </div>

      <div className="s99-loader" aria-hidden="true">
        <div className="s99-bar"><span /></div>
        <small>Loading</small>
      </div>
    </main>
  )
}
