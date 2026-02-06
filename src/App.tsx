import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { House, MagnifyingGlass, Target, Clock, ListChecks, LockSimple, UsersThree, Trophy, Info, DotsThree } from '@phosphor-icons/react'
import { HeroView } from '@/components/HeroView'
import { DetailsView } from '@/components/DetailsView'
import { AccuracyView } from '@/components/AccuracyView'
import { HistoryView } from '@/components/HistoryView'
import { AgentsView } from '@/components/AgentsView'
import { CompetitionView } from '@/components/CompetitionView'
import { AboutView } from '@/components/AboutView'
import { ThemeToggle } from '@/components/ThemeToggle'
import { OutcomeRecorder } from '@/components/OutcomeRecorder'
import { NotificationSettings } from '@/components/NotificationSettings'
import { EnhancedHeader } from '@/components/EnhancedHeader'
import { WeatherAtmosphere } from '@/components/WeatherAtmosphere'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useIsMobile } from '@/hooks/use-mobile'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

function App() {
  const [activeTab, setActiveTab] = useState("home")
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false)
  const { isAdmin, unlock, lock } = useAdminAccess()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!isAdmin && activeTab === 'outcomes') {
      setActiveTab('home')
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
    setActiveTab('home')
    toast.success('Admin tools locked')
  }

  // Navigate to details tab (used by HeroView CTA)
  const handleNavigateToDetails = () => {
    setActiveTab('details')
  }

  // Handle tab selection from drawer menu
  const handleDrawerTabSelect = (tab: string) => {
    setActiveTab(tab)
    setMoreDrawerOpen(false)
  }

  // Overflow tabs shown in "More" drawer on mobile
  const overflowTabs = ['agents', 'competition', 'about', ...(isAdmin ? ['outcomes'] : [])]

  const tabGridCols = isAdmin ? 'grid-cols-4 sm:grid-cols-8' : 'grid-cols-4 sm:grid-cols-7'

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background transition-colors relative overflow-hidden">
      {/* Weather Atmosphere Effects */}
      <WeatherAtmosphere />
      
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/5 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-cyan-300/5 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-300/5 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob delay-4000"></div>
      </div>
      
      <div className={`container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-6xl relative z-10 ${isMobile ? 'mb-bottom-nav' : ''}`}>
        <EnhancedHeader />
        
        {/* Settings stay in flow on mobile to avoid overlap with header */}
        <div
          className={`flex gap-2 z-20 ${
            isMobile
              ? 'mb-4 justify-end'
              : 'absolute top-6 sm:top-10 right-4 sm:right-6 lg:right-8'
          }`}
        >
          {isAdmin && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleLock}
              title="Lock admin tools"
              aria-label="Lock admin tools"
              className="h-11 w-11 min-h-[44px] min-w-[44px]"
            >
              <LockSimple size={18} weight="duotone" />
            </Button>
          )}
          <NotificationSettings />
          <ThemeToggle />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Desktop Navigation - traditional tab list */}
          <TabsList className={`hidden md:grid w-full ${tabGridCols} mb-8 sm:mb-10 h-auto p-1.5 bg-background/50 backdrop-blur-sm`}>
            <TabsTrigger value="home" className="flex flex-row items-center gap-2 py-2 text-sm min-h-[44px]">
              <House size={18} />
              <span>Home</span>
            </TabsTrigger>
            <TabsTrigger value="details" className="flex flex-row items-center gap-2 py-2 text-sm min-h-[44px]">
              <MagnifyingGlass size={18} />
              <span>Details</span>
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="flex flex-row items-center gap-2 py-2 text-sm min-h-[44px]">
              <Target size={18} />
              <span>Accuracy</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex flex-row items-center gap-2 py-2 text-sm min-h-[44px]">
              <Clock size={18} />
              <span>History</span>
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex flex-row items-center gap-2 py-2 text-sm min-h-[44px]">
              <UsersThree size={18} />
              <span>Agents</span>
            </TabsTrigger>
            <TabsTrigger value="competition" className="flex flex-row items-center gap-2 py-2 text-sm min-h-[44px]">
              <Trophy size={18} />
              <span>Competition</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="flex flex-row items-center gap-2 py-2 text-sm min-h-[44px]">
              <Info size={18} />
              <span>About</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="outcomes" className="flex flex-row items-center gap-2 py-2 text-sm min-h-[44px]">
                <ListChecks size={18} />
                <span>Outcomes</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="home">
            <HeroView onNavigateToDetails={handleNavigateToDetails} />
          </TabsContent>

          <TabsContent value="details">
            <DetailsView onBack={() => setActiveTab('home')} />
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

          <TabsContent value="about">
            <AboutView />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="outcomes">
              <OutcomeRecorder />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Mobile Bottom Navigation - fixed at bottom with safe area padding */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border pb-safe">
          <div className="grid grid-cols-5 h-16">
            {/* Primary nav items */}
            <button
              onClick={() => setActiveTab('home')}
              aria-label="Go to Home tab"
              aria-current={activeTab === 'home' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors min-h-[44px] ${
                activeTab === 'home' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <House size={22} weight={activeTab === 'home' ? 'fill' : 'regular'} />
              <span>Home</span>
            </button>
            
            <button
              onClick={() => setActiveTab('details')}
              aria-label="Go to Details tab"
              aria-current={activeTab === 'details' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors min-h-[44px] ${
                activeTab === 'details' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MagnifyingGlass size={22} weight={activeTab === 'details' ? 'bold' : 'regular'} />
              <span>Details</span>
            </button>
            
            <button
              onClick={() => setActiveTab('accuracy')}
              aria-label="Go to Accuracy tab"
              aria-current={activeTab === 'accuracy' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors min-h-[44px] ${
                activeTab === 'accuracy' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target size={22} weight={activeTab === 'accuracy' ? 'fill' : 'regular'} />
              <span>Accuracy</span>
            </button>
            
            <button
              onClick={() => setActiveTab('history')}
              aria-label="Go to History tab"
              aria-current={activeTab === 'history' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors min-h-[44px] ${
                activeTab === 'history' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock size={22} weight={activeTab === 'history' ? 'fill' : 'regular'} />
              <span>History</span>
            </button>
            
            {/* More menu with Drawer */}
            <Drawer open={moreDrawerOpen} onOpenChange={setMoreDrawerOpen}>
              <DrawerTrigger asChild>
                <button
                  aria-label="Open More menu"
                  aria-expanded={moreDrawerOpen}
                  aria-current={overflowTabs.includes(activeTab) ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors min-h-[44px] ${
                    overflowTabs.includes(activeTab) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <DotsThree size={22} weight={overflowTabs.includes(activeTab) ? 'bold' : 'regular'} />
                  <span>More</span>
                </button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>More Options</DrawerTitle>
                </DrawerHeader>
                <div className="p-4 pb-8 space-y-2">
                  <button
                    onClick={() => handleDrawerTabSelect('agents')}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg transition-colors min-h-[56px] ${
                      activeTab === 'agents' 
                        ? 'bg-primary/10 text-primary' 
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <UsersThree size={24} weight={activeTab === 'agents' ? 'fill' : 'regular'} />
                    <div className="text-left">
                      <div className="font-medium">Agents</div>
                      <div className="text-sm text-muted-foreground">AI agent details</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleDrawerTabSelect('competition')}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg transition-colors min-h-[56px] ${
                      activeTab === 'competition' 
                        ? 'bg-primary/10 text-primary' 
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <Trophy size={24} weight={activeTab === 'competition' ? 'fill' : 'regular'} />
                    <div className="text-left">
                      <div className="font-medium">Competition</div>
                      <div className="text-sm text-muted-foreground">Agent performance rankings</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleDrawerTabSelect('about')}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg transition-colors min-h-[56px] ${
                      activeTab === 'about' 
                        ? 'bg-primary/10 text-primary' 
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <Info size={24} weight={activeTab === 'about' ? 'fill' : 'regular'} />
                    <div className="text-left">
                      <div className="font-medium">About</div>
                      <div className="text-sm text-muted-foreground">How predictions work</div>
                    </div>
                  </button>
                  
                  {isAdmin && (
                    <button
                      onClick={() => handleDrawerTabSelect('outcomes')}
                      className={`w-full flex items-center gap-3 p-4 rounded-lg transition-colors min-h-[56px] ${
                        activeTab === 'outcomes' 
                          ? 'bg-primary/10 text-primary' 
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <ListChecks size={24} weight={activeTab === 'outcomes' ? 'fill' : 'regular'} />
                      <div className="text-left">
                        <div className="font-medium">Outcomes</div>
                        <div className="text-sm text-muted-foreground">Record prediction results</div>
                      </div>
                    </button>
                  )}
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </nav>
      )}

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
