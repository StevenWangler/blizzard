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
import { Separator } from '@/components/ui/separator'
import { Sun, Moon, CloudSnow, Snowflake } from '@phosphor-icons/react'
import { useWeatherTheme } from '@/hooks/useWeatherTheme'
import { useIsMobile } from '@/hooks/use-mobile'

interface ThemeMenuItemsProps {
  isDarkMode: boolean
  currentThemeName: string
  isRotationEnabled: boolean
  onToggleDarkMode: () => void
  onToggleRotation: () => void
  onSetLiveTheme: () => void
}

function ThemeMenuItems({
  isDarkMode,
  currentThemeName,
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
      <DropdownMenuItem disabled className="text-xs text-muted-foreground">
        Current: {currentThemeName}
      </DropdownMenuItem>
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
      <DropdownMenuItem onClick={onSetLiveTheme} className="flex items-center gap-2 min-h-[44px]">
        <CloudSnow className="h-4 w-4" />
        Return to live weather
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled className="text-xs text-muted-foreground justify-center">
        <Snowflake className="h-3 w-3 mr-1" />
        Colors adapt to snow conditions
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
    setManualTheme
  } = useWeatherTheme()
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const currentTheme = getCurrentTheme()

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
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Theme Settings</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
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
              onClick={() => closeAndRun(() => setManualTheme(null))}
              className="w-full justify-start min-h-[44px]"
            >
              <CloudSnow className="h-4 w-4 mr-2" />
              Return to live weather
            </Button>
            <Separator />
            <p className="text-xs text-muted-foreground text-center">
              Colors adapt to snow conditions
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <ThemeMenuItems
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
