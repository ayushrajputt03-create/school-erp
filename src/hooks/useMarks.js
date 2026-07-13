import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function useMarks(studentId) {
  const [data, setData] = useState([])
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
      collection(db, 'marks', studentId, 'subjects'),
      snap => {
        const subjects = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setData(subjects)
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
