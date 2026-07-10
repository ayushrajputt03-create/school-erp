import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function useStudentData(studentId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!studentId || !db) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsub = onSnapshot(
      doc(db, 'students', studentId),
      snap => {
        setData(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      },
      err => {
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [studentId])

  return { data, loading, error }
}
