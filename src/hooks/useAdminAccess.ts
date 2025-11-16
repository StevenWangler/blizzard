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

  const unlock = useCallback((passphrase: string): UnlockResult => {
    const secret = (import.meta.env.VITE_OUTCOME_ADMIN_SECRET || '').trim()

    // Debug logging removed to avoid exposing sensitive information

    if (!secret) {
      return {
        success: false,
        message: 'Admin secret not configured in environment.'
      }
    }

    if (passphrase.trim() !== secret) {
      return {
        success: false,
        message: 'Incorrect passphrase.'
      }
    }

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
