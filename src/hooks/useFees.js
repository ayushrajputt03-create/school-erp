import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function useFees(studentId) {
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

    const q = query(
      collection(db, 'fees'),
      where('studentId', '==', studentId),
      orderBy('dueDate', 'desc')
    )

    const unsub = onSnapshot(
      q,
      snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setData(items)
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
