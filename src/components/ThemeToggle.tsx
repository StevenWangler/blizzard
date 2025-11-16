import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { Sun, Moon, CloudSnow, Snowflake } from '@phosphor-icons/react'
import { useWeatherTheme } from '@/hooks/useWeatherTheme'

export function ThemeToggle() {
  const { isDarkMode, toggleDarkMode, getCurrentTheme } = useWeatherTheme()
  const currentTheme = getCurrentTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-9 sm:w-9 p-0">
          {isDarkMode ? (
            <Moon className="h-4 w-4 transition-all" />
          ) : (
            <Sun className="h-4 w-4 transition-all" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <CloudSnow className="h-4 w-4" />
          Weather Theme
        </DropdownMenuLabel>
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          Current: {currentTheme?.name || 'Clear Skies'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleDarkMode} className="flex items-center gap-2">
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          {!isDarkMode && <span className="ml-auto text-xs">🌙</span>}
          {isDarkMode && <span className="ml-auto text-xs">☀️</span>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground justify-center">
          <Snowflake className="h-3 w-3 mr-1" />
          Colors adapt to snow conditions
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}