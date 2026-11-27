import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'blizzard:admin:unlocked'

const getStoredState = () => {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === 'true'
}

interface UnlockResult {
  success: boolean
  message?: string
}

export function useAdminAccess() {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return getStoredState()
  })

  useEffect(() => {
    setIsAdmin(getStoredState())
  }, [])

  const unlock = useCallback((): UnlockResult => {
    // This only reveals local maintenance UI. It is deliberately not treated as
    // authorization: real writes are performed by GitHub Actions and require
    // the operator's authenticated GitHub CLI session.
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'true')
    }
    setIsAdmin(true)
    return { success: true }
  }, [])

  const lock = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    setIsAdmin(false)
  }, [])

  return {
    isAdmin,
    unlock,
    lock
  }
}
