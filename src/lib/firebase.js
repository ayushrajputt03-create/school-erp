import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getFirestore } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean)

// One transient websocket failure makes the RTDB SDK write this flag and switch to
// long-polling PERMANENTLY for the browser. On networks where the JSONP long-poll
// endpoint is blocked (observed 503s on .lp while websockets work fine), that leaves
// every live listener silently dead - students, admissions and leave queues all render
// empty while REST reads still succeed. Clear the poisoned flag on every startup so the
// SDK always retries websockets first.
try { localStorage.removeItem('firebase:previous_websocket_failure') } catch { /* storage unavailable */ }

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null
export const storage = app ? getStorage(app) : null
export const db = app ? getFirestore(app) : null
export const rtdb = (() => {
  if (!app || !firebaseConfig.databaseURL) return null
  try { return getDatabase(app) } catch { return null }
})()

export { app as firebaseApp }
