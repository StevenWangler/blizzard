import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface NotificationPreferences {
  enabled: boolean
  threshold: number // Probability percentage (0-100)
  lastNotificationDate: string | null
}

const STORAGE_KEY = 'snowday_notification_prefs'
const DEFAULT_PREFS: NotificationPreferences = {
  enabled: false,
  threshold: 70,
  lastNotificationDate: null
}

export function useNotifications() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : DEFAULT_PREFS
  })

  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences])

  const requestPermission = async (): Promise<boolean> => {
    if (typeof Notification === 'undefined') {
      toast.error('Notifications not supported in this browser')
      return false
    }

    if (permission === 'granted') {
      return true
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      
      if (result === 'granted') {
        toast.success('Notifications enabled')
        setPreferences(prev => ({ ...prev, enabled: true }))
        return true
      } else {
        toast.error('Notification permission denied')
        return false
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      toast.error('Failed to request notification permission')
      return false
    }
  }

  const updateThreshold = (threshold: number) => {
    setPreferences(prev => ({ ...prev, threshold }))
  }

  const toggleEnabled = async () => {
    if (!preferences.enabled && permission !== 'granted') {
      const granted = await requestPermission()
      if (!granted) return
    }
    
    setPreferences(prev => ({ ...prev, enabled: !prev.enabled }))
  }

  const checkAndNotify = (probability: number, location: string = 'Rockford, MI') => {
    // Skip if notifications disabled or permission not granted
    if (!preferences.enabled || permission !== 'granted') {
      return
    }

    // Skip if probability doesn't meet threshold
    if (probability < preferences.threshold) {
      return
    }

    // Check if we already notified today
    const today = new Date().toDateString()
    if (preferences.lastNotificationDate === today) {
      return
    }

    // Send notification
    try {
      const notification = new Notification('Snow Day Alert!', {
        body: `${probability}% chance of snow day in ${location}. Check for official announcements.`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'snow-day-alert',
        requireInteraction: false,
        silent: false
      })

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000)

      // Update last notification date
      setPreferences(prev => ({
        ...prev,
        lastNotificationDate: today
      }))

      // Also show toast for in-app feedback
      toast.success(`${probability}% snow day probability - check for updates!`)
    } catch (error) {
      console.error('Error showing notification:', error)
    }
  }

  const isSupported = typeof Notification !== 'undefined'

  return {
    preferences,
    permission,
    isSupported,
    requestPermission,
    updateThreshold,
    toggleEnabled,
    checkAndNotify
  }
}
