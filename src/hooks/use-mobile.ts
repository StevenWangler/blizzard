import { useEffect, useState, useMemo } from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

/**
 * Detects device performance tier for optimizing animations/effects
 * Returns a multiplier: 1.0 = full quality, 0.4 = minimal quality
 */
export function useDevicePerformance() {
  const isMobile = useIsMobile()

  const performanceMultiplier = useMemo(() => {
    // Check for data saver mode
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (connection?.saveData) {
      return 0.2 // Minimal particles for data saver
    }

    // Check for slow connection (2g, slow-2g)
    if (connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') {
      return 0.3
    }

    // Check CPU cores - low-end devices typically have 4 or fewer
    const cores = navigator.hardwareConcurrency || 4
    if (cores <= 2) {
      return 0.3 // Very low-end device
    }
    if (cores <= 4) {
      return isMobile ? 0.4 : 0.6 // Low-end device
    }

    // Mobile devices get reduced particles even with good hardware
    // to preserve battery life
    if (isMobile) {
      return 0.5
    }

    // Desktop with good hardware
    return 1.0
  }, [isMobile])

  return {
    performanceMultiplier,
    isLowEnd: performanceMultiplier < 0.5,
    isMobile
  }
}
