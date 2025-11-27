import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { CloudSnow, Target, Clock, ListChecks, LockSimple, UsersThree, Trophy } from '@phosphor-icons/react'
import { EnhancedPredictionView } from '@/components/EnhancedPredictionView'
import { AccuracyView } from '@/components/AccuracyView'
import { HistoryView } from '@/components/HistoryView'
import { AgentsView } from '@/components/AgentsView'
import { CompetitionView } from '@/components/CompetitionView'
import { ThemeToggle } from '@/components/ThemeToggle'
import { OutcomeRecorder } from '@/components/OutcomeRecorder'
import { NotificationSettings } from '@/components/NotificationSettings'
import { EnhancedHeader } from '@/components/EnhancedHeader'
import { WeatherAtmosphere } from '@/components/WeatherAtmosphere'
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
  const { isAdmin, unlock, lock } = useAdminAccess()

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

  const handleLock = () => {
    lock()
    setActiveTab('prediction')
    toast.success('Admin tools locked')
  }

  const tabGridCols = isAdmin ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-3 sm:grid-cols-5'

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background transition-colors relative overflow-hidden">
      {/* Weather Atmosphere Effects */}
      <WeatherAtmosphere />
      
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/5 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-cyan-300/5 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-300/5 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob delay-4000"></div>
      </div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-6xl relative z-10">
        <EnhancedHeader />
        
        {/* Settings positioned in top right */}
        <div className="absolute top-6 sm:top-10 right-4 sm:right-6 lg:right-8 flex gap-2 z-20">
          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleLock}
              title="Lock admin tools"
            >
              <LockSimple size={18} weight="duotone" />
            </Button>
          )}
          <NotificationSettings />
          <ThemeToggle />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${tabGridCols} mb-8 sm:mb-10 h-auto p-1.5 bg-background/50 backdrop-blur-sm`}>
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
            <TabsTrigger value="agents" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2 text-xs sm:text-sm min-h-[60px] sm:min-h-[44px]">
              <UsersThree size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="text-center leading-tight">Agents</span>
            </TabsTrigger>
            <TabsTrigger value="competition" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2 text-xs sm:text-sm min-h-[60px] sm:min-h-[44px]">
              <Trophy size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="text-center leading-tight">Competition</span>
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

          <TabsContent value="agents">
            <AgentsView />
          </TabsContent>

          <TabsContent value="competition">
            <CompetitionView />
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
