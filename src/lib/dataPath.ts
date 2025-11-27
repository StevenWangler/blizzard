/**
 * Data Path Utility
 * 
 * Determines the correct data path based on environment.
 * In development mode, looks for local data first, then falls back to production data.
 * In production mode, always uses the production data.
 */

// Vite sets import.meta.env.DEV to true in development mode
const isDevelopment: boolean = !!(import.meta.env?.DEV)

/**
 * Base paths for data files
 */
export const DATA_PATHS = {
  local: '/data/local',
  production: '/data'
} as const

/**
 * Get the appropriate data file path for the current environment.
 * In development, tries local first and falls back to production.
 * In production, always uses the production path.
 * 
 * @param filename - The data file name (e.g., 'prediction.json')
 * @returns The full path to the data file
 */
export function getDataPath(filename: string): string {
  if (isDevelopment) {
    return `${DATA_PATHS.local}/${filename}`
  }
  return `${DATA_PATHS.production}/${filename}`
}

/**
 * Get the fallback data file path (always production)
 * 
 * @param filename - The data file name (e.g., 'prediction.json')
 * @returns The production path to the data file
 */
export function getProductionDataPath(filename: string): string {
  return `${DATA_PATHS.production}/${filename}`
}

/**
 * Fetch data with automatic fallback from local to production in development.
 * This allows developers to work with local test data without affecting production files.
 * 
 * @param filename - The data file name (e.g., 'prediction.json')
 * @param options - Optional fetch options
 * @returns The fetched data as JSON
 */
export async function fetchData<T>(filename: string, options?: RequestInit): Promise<T> {
  if (isDevelopment) {
    // In development, try local first
    const localPath = `${DATA_PATHS.local}/${filename}`
    try {
      const localResponse = await fetch(localPath, options)
      if (localResponse.ok) {
        console.log(`[DataPath] Using local data: ${localPath}`)
        return localResponse.json()
      }
    } catch {
      // Local file doesn't exist, fall through to production
    }
    console.log(`[DataPath] Local data not found, falling back to production: ${DATA_PATHS.production}/${filename}`)
  }
  
  // Use production data
  const prodPath = `${DATA_PATHS.production}/${filename}`
  const response = await fetch(prodPath, options)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${prodPath}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

/**
 * Check if we're running in development mode
 */
export function isDevMode(): boolean {
  return isDevelopment
}
