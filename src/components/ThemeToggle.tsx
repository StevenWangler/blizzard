import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer'
import { Sun, Moon, CloudSnow, Snowflake } from '@phosphor-icons/react'
import { useWeatherTheme } from '@/hooks/useWeatherTheme'
import { useIsMobile } from '@/hooks/use-mobile'

interface ThemeMenuItemsProps {
  isDarkMode: boolean
  followingForecast: boolean
  currentThemeName: string
  isRotationEnabled: boolean
  onToggleDarkMode: () => void
  onToggleRotation: () => void
  onSetLiveTheme: () => void
}

function ThemeMenuItems({
  isDarkMode,
  currentThemeName,
  followingForecast,
  isRotationEnabled,
  onToggleDarkMode,
  onToggleRotation,
  onSetLiveTheme
}: ThemeMenuItemsProps) {
  return (
    <>
      <DropdownMenuLabel className="flex items-center gap-2">
        <CloudSnow className="h-4 w-4" />
        Weather Theme
      </DropdownMenuLabel>
      <div className="px-2 py-1.5 text-xs text-muted-foreground">
        Current: {currentThemeName}
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onToggleDarkMode} className="flex items-center gap-2 min-h-[44px]">
        {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        <span className="ml-auto text-xs">{isDarkMode ? 'Light' : 'Dark'}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onToggleRotation} className="flex items-center gap-2 min-h-[44px]">
        <Snowflake className="h-4 w-4" />
        {isRotationEnabled ? 'Pause winter rotation' : 'Rotate winter moods'}
        <span className="ml-auto text-xs">{isRotationEnabled ? 'On' : 'Off'}</span>
      </DropdownMenuItem>
      <DropdownMenuItem disabled={followingForecast} onClick={onSetLiveTheme} className="flex items-center gap-2 min-h-[44px]">
        <CloudSnow className="h-4 w-4" />
        {followingForecast ? 'Following forecast weather' : 'Use forecast weather'}
      </DropdownMenuItem>
    </>
  )
}

export function ThemeToggle() {
  const {
    isDarkMode,
    toggleDarkMode,
    getCurrentTheme,
    isRotationEnabled,
    toggleRotation,
    manualThemeKey,
    setManualTheme
  } = useWeatherTheme()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const currentTheme = getCurrentTheme()

  const followingForecast = !isRotationEnabled && !manualThemeKey

  const closeAndRun = (action: () => void) => {
    action()
    setDrawerOpen(false)
  }

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className="h-11 w-11 min-h-[44px] min-w-[44px] p-0"
      aria-label="Theme settings"
    >
      {isDarkMode ? (
        <Sun className="h-4 w-4 transition-all" />
      ) : (
        <Moon className="h-4 w-4 transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )

  if (isMobile) {
    return (
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent className="station-overlay">
          <DrawerHeader>
            <DrawerTitle>Theme Settings</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 space-y-3">
            <div className="text-xs text-muted-foreground">
              Current: {currentTheme?.name || 'Clear Skies'}
            </div>
            <Button
              variant="outline"
              onClick={() => closeAndRun(toggleDarkMode)}
              className="w-full justify-between min-h-[44px]"
            >
              <span className="flex items-center gap-2">
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              </span>
              <span className="text-xs text-muted-foreground">{isDarkMode ? 'Light' : 'Dark'}</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => closeAndRun(toggleRotation)}
              className="w-full justify-between min-h-[44px]"
            >
              <span className="flex items-center gap-2">
                <Snowflake className="h-4 w-4" />
                {isRotationEnabled ? 'Pause winter rotation' : 'Rotate winter moods'}
              </span>
              <span className="text-xs text-muted-foreground">{isRotationEnabled ? 'On' : 'Off'}</span>
            </Button>
            <Button
              variant="outline"
              disabled={followingForecast}
              onClick={() => closeAndRun(() => setManualTheme(null))}
              className="w-full justify-start min-h-[44px]"
            >
              <CloudSnow className="h-4 w-4 mr-2" />
              {followingForecast ? 'Following forecast weather' : 'Use forecast weather'}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="station-overlay w-56">
        <ThemeMenuItems
          followingForecast={followingForecast}
          isDarkMode={isDarkMode}
          currentThemeName={currentTheme?.name || 'Clear Skies'}
          isRotationEnabled={isRotationEnabled}
          onToggleDarkMode={toggleDarkMode}
          onToggleRotation={toggleRotation}
          onSetLiveTheme={() => setManualTheme(null)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
