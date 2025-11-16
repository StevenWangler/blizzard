import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { CloudSnow, Target, Clock, ListChecks } from '@phosphor-icons/react'
import { EnhancedPredictionView } from '@/components/EnhancedPredictionView'
import { AccuracyView } from '@/components/AccuracyView'
import { HistoryView } from '@/components/HistoryView'
import { ThemeToggle } from '@/components/ThemeToggle'
import { OutcomeRecorder } from '@/components/OutcomeRecorder'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

function App() {
  const [activeTab, setActiveTab] = useState("prediction")
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const { isAdmin, unlock } = useAdminAccess()

  useEffect(() => {
    if (!isAdmin && activeTab === 'outcomes') {
      setActiveTab('prediction')
    }
  }, [isAdmin, activeTab])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        setUnlockOpen(true)
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [])

  const handleUnlock = () => {
    const result = unlock(passphrase)
    if (result.success) {
      setUnlockOpen(false)
      setPassphrase('')
      setUnlockError(null)
      toast.success('Admin tools unlocked')
      setActiveTab('outcomes')
    } else {
      setUnlockError(result.message || 'Unable to unlock admin tools')
      toast.error(result.message || 'Incorrect passphrase')
    }
  }

  const handleDialogChange = (open: boolean) => {
    setUnlockOpen(open)
    if (!open) {
      setPassphrase('')
      setUnlockError(null)
    }
  }

  const tabGridCols = isAdmin ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background transition-colors">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        <header className="text-center mb-6 sm:mb-8 relative">
          {/* Weather theme toggle positioned in top right */}
          <div className="absolute top-0 right-0">
            <ThemeToggle />
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <CloudSnow size={40} className="text-primary sm:w-12 sm:h-12" weight="duotone" />
            <h1 className="text-2xl sm:text-4xl font-bold text-foreground leading-tight">Blizzard</h1>
          </div>
          <p className="text-muted-foreground text-base sm:text-lg px-4">
            AI-powered snow day forecasting for Rockford, Michigan
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${tabGridCols} mb-6 sm:mb-8 h-auto p-1`}>
            <TabsTrigger value="prediction" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2 text-xs sm:text-sm min-h-[60px] sm:min-h-[44px]">
              <CloudSnow size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden sm:inline">Today's Forecast</span>
              <span className="sm:hidden text-center leading-tight">Today</span>
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2 text-xs sm:text-sm min-h-[60px] sm:min-h-[44px]">
              <Target size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="text-center leading-tight">Accuracy</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2 text-xs sm:text-sm min-h-[60px] sm:min-h-[44px]">
              <Clock size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="text-center leading-tight">History</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="outcomes" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2 text-xs sm:text-sm min-h-[60px] sm:min-h-[44px]">
                <ListChecks size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="text-center leading-tight">Outcomes</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="prediction">
            <EnhancedPredictionView />
          </TabsContent>
          
          <TabsContent value="accuracy">
            <AccuracyView />
          </TabsContent>
          
          <TabsContent value="history">
            <HistoryView />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="outcomes">
              <OutcomeRecorder />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <Dialog open={unlockOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Access</DialogTitle>
            <DialogDescription>
              Enter the passphrase to unlock internal tooling. This shortcut is limited to maintainers.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleUnlock()
            }}
            className="space-y-4"
          >
            <Input
              type="password"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              autoFocus
            />
            {unlockError && (
              <p className="text-sm text-destructive">{unlockError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Unlock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Toaster position="top-right" />
    </div>
  )
}

export default App
