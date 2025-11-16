import { Bell, BellSlash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Slider } from '@/components/ui/slider'
import { useNotifications } from '@/hooks/useNotifications'

export function NotificationSettings() {
  const { 
    preferences, 
    permission, 
    isSupported,
    requestPermission, 
    updateThreshold, 
    toggleEnabled 
  } = useNotifications()

  if (!isSupported) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {preferences.enabled ? (
            <>
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
            </>
          ) : (
            <BellSlash size={20} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Smart Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <Button
              variant={preferences.enabled ? "default" : "outline"}
              size="sm"
              onClick={toggleEnabled}
            >
              {preferences.enabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {permission !== 'granted' && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              Permission needed to send notifications
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Alert threshold</span>
              <span className="text-sm text-muted-foreground">{preferences.threshold}%</span>
            </div>
            <Slider
              value={[preferences.threshold]}
              onValueChange={([value]: number[]) => updateThreshold(value)}
              min={30}
              max={90}
              step={10}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Get notified when probability is ≥ {preferences.threshold}%
            </p>
          </div>

          <div className="text-xs text-muted-foreground border-t pt-2">
            💡 You'll receive one notification per day when conditions meet your threshold
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
