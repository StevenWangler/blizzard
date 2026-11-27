import { lazy, Suspense, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { House, MagnifyingGlass, Clock, DotsThree, Info, Target, ListChecks, LockSimple, UsersThree, Trophy, X } from '@phosphor-icons/react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { HeroView } from '@/components/HeroView'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationSettings } from '@/components/NotificationSettings'
import { EnhancedHeader } from '@/components/EnhancedHeader'
import { ForecastMusicControl } from '@/components/ForecastMusicControl'
import { ForecastTicker } from '@/components/ForecastTicker'
import { useSavedForecast } from '@/hooks/useSavedForecast'
import { SeasonalLandingPage } from '@/components/SeasonalLandingPage'
import { useAdminAccess } from '@/hooks/useAdminAccess'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSeasonMode } from '@/hooks/useSeasonMode'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const DetailsView = lazy(() => import('@/components/DetailsView').then(module => ({ default: module.DetailsView })))
const AccuracyView = lazy(() => import('@/components/AccuracyView').then(module => ({ default: module.AccuracyView })))
const HistoryView = lazy(() => import('@/components/HistoryView').then(module => ({ default: module.HistoryView })))
const AgentsView = lazy(() => import('@/components/AgentsView').then(module => ({ default: module.AgentsView })))
const CompetitionView = lazy(() => import('@/components/CompetitionView').then(module => ({ default: module.CompetitionView })))
const AboutView = lazy(() => import('@/components/AboutView').then(module => ({ default: module.AboutView })))
const OutcomeRecorder = lazy(() => import('@/components/OutcomeRecorder').then(module => ({ default: module.OutcomeRecorder })))

const tabHashes: Record<string, string> = {
  home: '#today', details: '#forecast', history: '#past-calls',
  accuracy: '#accuracy', agents: '#how-it-works', competition: '#competition',
  about: '#about', outcomes: '#outcomes',
}

const primaryTabs = [
  { id: 'home', label: 'Today', icon: House },
  { id: 'details', label: 'Forecast', icon: MagnifyingGlass },
  { id: 'history', label: 'Past calls', icon: Clock },
  { id: 'about', label: 'About', icon: Info },
]

const morePages = [
  { id: 'accuracy', label: 'Accuracy', description: 'See how past forecasts did', icon: Target },
  { id: 'agents', label: 'How it works', description: 'How Blizzard makes its call', icon: UsersThree },
  { id: 'competition', label: 'Competition', description: 'Compare Blizzard and RHS calls', icon: Trophy },
]

const aboutPage = { id: 'about', label: 'About Blizzard', description: 'Schedule, scoring, and music credits', icon: Info }
const outcomesPage = { id: 'outcomes', label: 'Record outcomes', description: 'Log school-day results', icon: ListChecks }

function tabFromLocation() {
  return Object.keys(tabHashes).find(tab => tabHashes[tab] === window.location.hash) ?? 'home'
}

function App() {
  const [activeTab, setActiveTab] = useState(tabFromLocation)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false)
  const { isAdmin, unlock, lock } = useAdminAccess()
  const isMobile = useIsMobile()
  const {
    isOffSeason,
    isPreviewMode,
    shouldRenderBlizzard,
    activatePreviewOverride,
    disablePreviewOverride,
  } = useSeasonMode(isAdmin)
  const forecast = useSavedForecast(shouldRenderBlizzard)

  useEffect(() => {
    // Establish this page's first entry so Back returns through visited screens.
    window.history.replaceState(null, '', tabHashes[tabFromLocation()])
    const restorePage = () => setActiveTab(tabFromLocation())
    window.addEventListener('popstate', restorePage)
    window.addEventListener('hashchange', restorePage)
    return () => {
      window.removeEventListener('popstate', restorePage)
      window.removeEventListener('hashchange', restorePage)
    }
  }, [])

  useEffect(() => {
    const hash = tabHashes[activeTab]
    if (window.location.hash !== hash) window.history.pushState(null, '', hash)
    // A tab is a new page: don't carry a long report's scroll position into it.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [activeTab])

  useEffect(() => {
    if ((!isAdmin && activeTab === 'outcomes') || (!shouldRenderBlizzard && activeTab !== 'home')) {
      setActiveTab('home')
    }
  }, [isAdmin, activeTab, shouldRenderBlizzard])

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
    const result = unlock()
    if (result.success) {
      if (isOffSeason) {
        activatePreviewOverride()
      }

      setUnlockOpen(false)
      toast.success(isOffSeason ? 'Maintainer preview enabled' : 'Admin tools unlocked')
      setActiveTab(isOffSeason ? 'home' : 'outcomes')
    } else {
      toast.error(result.message || 'Unable to open maintainer tools')
    }
  }

  const handleDialogChange = (open: boolean) => {
    setUnlockOpen(open)
  }

  const handleLock = () => {
    if (isPreviewMode) {
      disablePreviewOverride()
    }

    lock()
    setActiveTab('home')
    toast.success(isPreviewMode ? 'Maintainer preview closed' : 'Admin tools locked')
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

  const desktopMorePages = isAdmin ? [...morePages, outcomesPage] : morePages
  const mobileMorePages = isAdmin ? [...morePages, aboutPage, outcomesPage] : [...morePages, aboutPage]

  const pageBackground = shouldRenderBlizzard
    ? 'winter-workspace station-workspace'
    : 'bg-[#071625]'

  return (
    <div className={`min-h-screen ${pageBackground} transition-colors relative overflow-hidden`}>
      <div className={`${shouldRenderBlizzard ? 'blizzard-shell station-shell' : 'min-h-screen'} relative z-10`}>
        <div
          className={`flex flex-wrap items-center gap-2 z-20 ${
            !shouldRenderBlizzard
              ? 'absolute right-4 top-4 sm:right-8 sm:top-5'
              : 'broadcast-header station-masthead justify-between'
          }`}
        >
          {shouldRenderBlizzard && <EnhancedHeader />}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
            {isPreviewMode && (
              <Badge variant="secondary" className="min-h-[36px] px-3 py-1.5">
                Off-season preview
              </Badge>
            )}
            {isAdmin && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleLock}
                title={isPreviewMode ? 'Close maintainer preview' : 'Lock admin tools'}
                aria-label={isPreviewMode ? 'Close maintainer preview' : 'Lock admin tools'}
                className="h-11 w-11 min-h-[44px] min-w-[44px]"
              >
                <LockSimple size={18} weight="duotone" />
              </Button>
            )}
            {shouldRenderBlizzard && <ForecastMusicControl navigationKey={activeTab} />}
            {shouldRenderBlizzard && <NotificationSettings />}
            <ThemeToggle />
          </div>
        </div>

        {shouldRenderBlizzard ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList aria-label="Main navigation" className="station-nav station-nav-desktop">
              {primaryTabs.map(({ id, label }) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" data-section-active={desktopMorePages.some(page => page.id === activeTab)}>More</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="station-more-dropdown">
                  {desktopMorePages.map(({ id, label, icon: Icon }) => (
                    <DropdownMenuItem key={id} onClick={() => setActiveTab(id)}>
                      <Icon size={16} className="mr-2" aria-hidden="true" />
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </TabsList>
            {!isMobile && activeTab !== 'home' && <ForecastTicker prediction={forecast.prediction} loading={forecast.loading} error={!!forecast.error} suspended={moreDrawerOpen || unlockOpen} />}

            <Suspense fallback={<p className="min-h-40 py-12 text-center text-sm text-muted-foreground" role="status">Loading this page…</p>}>
              <TabsContent value="home" className="station-home">
                <HeroView forecast={forecast} onNavigateToDetails={handleNavigateToDetails} onNavigateToHistory={() => setActiveTab('history')} />
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
                <AgentsView forecast={forecast} />
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
            </Suspense>
          </Tabs>
        ) : (
          <SeasonalLandingPage />
        )}

        {shouldRenderBlizzard && isMobile && (
          <nav aria-label="Main navigation" className="station-nav station-nav-mobile">
            {primaryTabs.filter(({ id }) => id !== 'about').map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}>
                <Icon size={18} weight={activeTab === id ? 'fill' : 'regular'} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
            <Drawer open={moreDrawerOpen} onOpenChange={setMoreDrawerOpen}>
              <DrawerTrigger asChild>
                <button type="button" aria-label="Open More menu" aria-expanded={moreDrawerOpen} aria-current={mobileMorePages.some(page => page.id === activeTab) ? 'page' : undefined}>
                  <DotsThree size={21} weight="bold" aria-hidden="true" />
                  <span>More</span>
                </button>
              </DrawerTrigger>
              <DrawerContent className="station-directory">
                <DrawerHeader className="flex-row items-center justify-between">
                  <div>
                    <DrawerTitle>More</DrawerTitle>
                    <DrawerDescription className="sr-only">Explore Blizzard and its past forecasts.</DrawerDescription>
                  </div>
                  <DrawerClose asChild>
                    <Button variant="ghost" size="icon" className="size-11" aria-label="Close More menu"><X size={20} /></Button>
                  </DrawerClose>
                </DrawerHeader>
                <div className="station-directory-links">
                  {mobileMorePages.map(({ id, label, description, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => handleDrawerTabSelect(id)} aria-current={activeTab === id ? 'page' : undefined}>
                      <Icon size={22} aria-hidden="true" />
                      <span><strong>{label}</strong><small>{description}</small></span>
                      <span className="station-directory-chevron" aria-hidden="true">»</span>
                    </button>
                  ))}
                </div>
              </DrawerContent>
            </Drawer>
          </nav>
        )}
      </div>

      <Dialog open={unlockOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Maintainer tools</DialogTitle>
            <DialogDescription>
              {isOffSeason
                ? 'Open the local preview and maintenance tools during the off-season.'
                : 'Open local maintenance tools. Recording an outcome still requires an authenticated GitHub CLI session.'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleUnlock()
            }}
            className="space-y-4"
          >
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Open tools</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Toaster position="top-right" />
    </div>
  )
}

export default App
