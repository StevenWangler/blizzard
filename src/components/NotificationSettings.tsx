import { Bell, BellSlash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Slider } from '@/components/ui/slider'
import { useNotifications } from '@/hooks/useNotifications'
import { useIsMobile } from '@/hooks/use-mobile'

function NotificationContent({ 
  preferences, 
  permission, 
  toggleEnabled, 
  updateThreshold,
  isMobile = false
}: {
  preferences: { enabled: boolean; threshold: number }
  permission: NotificationPermission | 'default'
  toggleEnabled: () => void
  updateThreshold: (value: number) => void
  isMobile?: boolean
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Status</span>
        <Button
          variant={preferences.enabled ? "default" : "outline"}
          size={isMobile ? "default" : "sm"}
          className={isMobile ? 'min-h-[44px] px-4' : undefined}
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
  )
}

export function NotificationSettings() {
  const { 
    preferences, 
    permission, 
    isSupported,
    updateThreshold, 
    toggleEnabled 
  } = useNotifications()
  const isMobile = useIsMobile()

  if (!isSupported) {
    return null
  }

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-11 w-11 min-h-[44px] min-w-[44px]"
      aria-label="Notification settings"
    >
      {preferences.enabled ? (
        <>
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
        </>
      ) : (
        <BellSlash size={20} />
      )}
    </Button>
  )

  // Use Drawer on mobile for better touch experience
  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>
          {triggerButton}
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Smart Notifications</DrawerTitle>
          </DrawerHeader>
          <NotificationContent 
            preferences={preferences}
            permission={permission}
            toggleEnabled={toggleEnabled}
            updateThreshold={updateThreshold}
            isMobile={true}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  // Use Dropdown on desktop
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {triggerButton}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Smart Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <NotificationContent 
          preferences={preferences}
          permission={permission}
          toggleEnabled={toggleEnabled}
          updateThreshold={updateThreshold}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
