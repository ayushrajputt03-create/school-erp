import { createContext, useContext, useEffect } from 'react'

// Student photos are stored outside the students node (studentPhotos/{schoolId}/{studentId}) so
// the hot read paths stay small - see App.jsx ensureStudentPhotos. Any screen that actually
// renders a photo declares which students it needs and the loader fetches those on demand,
// merging the bytes back into the shared students state as photoUrl.
//
// This lives in its own module rather than App.jsx so the document managers can import it
// without creating a circular import (App.jsx already imports all of them).
export const StudentPhotoContext = createContext(null)

/**
 * Declare which students this screen needs photos for. Safe to call with ids that have no photo,
 * or with staff ids - misses are cached so they are only ever requested once.
 * @param {Array<string|number|null|undefined>} ids
 */
export function useStudentPhotos(ids) {
  const ensure = useContext(StudentPhotoContext)
  // Depend on a joined string, not the array: callers build a fresh array every render, which
  // would otherwise re-run this effect forever.
  const key = (ids || []).filter(Boolean).map(String).join(',')
  useEffect(() => {
    if (ensure && key) ensure(key.split(','))
  }, [ensure, key])
}
