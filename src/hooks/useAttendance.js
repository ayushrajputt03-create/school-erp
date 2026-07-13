import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function useAttendance(studentId, month, year) {
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!studentId || !db || !month || !year) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const mm = String(month).padStart(2, '0')
    const startDate = `${year}-${mm}-01`
    const endDate = `${year}-${mm}-31`

    const q = query(
      collection(db, 'attendance'),
      where('studentId', '==', studentId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    )

    const unsub = onSnapshot(
      q,
      snap => {
        const map = {}
        snap.docs.forEach(d => {
          const rec = d.data()
          map[rec.date] = rec.status
        })
        setData(map)
        setLoading(false)
      },
      err => {
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsub()
  }, [studentId, month, year])

  return { data, loading, error }
}
