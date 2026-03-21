import { useCallback, useEffect, useMemo, useState } from 'react'

const PREVIEW_STORAGE_KEY = 'blizzard:season:preview-enabled'
const INACTIVE_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled'])

function isBlizzardRepoActive(value: string | undefined) {
  if (!value) return true
  return !INACTIVE_VALUES.has(value.trim().toLowerCase())
}

function getStoredPreviewState() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(PREVIEW_STORAGE_KEY) === 'true'
}

export function useSeasonMode(isAdmin: boolean) {
  const isRepoActive = useMemo(() => isBlizzardRepoActive(import.meta.env?.VITE_BLIZZARD_ACTIVE), [])
  const [previewEnabled, setPreviewEnabled] = useState<boolean>(() => getStoredPreviewState())

  useEffect(() => {
    setPreviewEnabled(getStoredPreviewState())
  }, [])

  useEffect(() => {
    if (isAdmin) return

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PREVIEW_STORAGE_KEY)
    }
    setPreviewEnabled(false)
  }, [isAdmin])

  const activatePreviewOverride = useCallback(() => {
    if (isRepoActive) return

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, 'true')
    }
    setPreviewEnabled(true)
  }, [isRepoActive])

  const disablePreviewOverride = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PREVIEW_STORAGE_KEY)
    }
    setPreviewEnabled(false)
  }, [])

  const isOffSeason = !isRepoActive
  const isPreviewMode = isOffSeason && isAdmin && previewEnabled
  const shouldRenderBlizzard = isRepoActive || isPreviewMode

  return {
    isRepoActive,
    isOffSeason,
    isPreviewMode,
    shouldRenderBlizzard,
    activatePreviewOverride,
    disablePreviewOverride,
  }
}
