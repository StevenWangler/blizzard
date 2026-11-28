import { lazy, Suspense, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { House, MagnifyingGlass, Clock, DotsThree, Info, Target, LockSimple, UsersThree, Trophy, X } from '@phosphor-icons/react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CompetitionScoreboard } from '@/components/CompetitionScoreboard'
import { useCompetitionStandings } from '@/hooks/useCompetitionStandings'
import { HeroView } from '@/components/HeroView'
import { WeatherThemeProvider } from '@/hooks/useWeatherTheme'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NotificationSettings } from '@/components/NotificationSettings'
import { EnhancedHeader } from '@/components/EnhancedHeader'
import { ForecastMusicControl } from '@/components/ForecastMusicControl'
import { ForecastTicker } from '@/components/ForecastTicker'
import { useSavedForecast } from '@/hooks/useSavedForecast'
import { SeasonalLandingPage } from '@/components/SeasonalLandingPage'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSeasonMode } from '@/hooks/useSeasonMode'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

const DetailsView = lazy(() => import('@/components/DetailsView').then(module => ({ default: module.DetailsView })))
const AccuracyView = lazy(() => import('@/components/AccuracyView').then(module => ({ default: module.AccuracyView })))
const HistoryView = lazy(() => import('@/components/HistoryView').then(module => ({ default: module.HistoryView })))
const AgentsView = lazy(() => import('@/components/AgentsView').then(module => ({ default: module.AgentsView })))
const CompetitionView = lazy(() => import('@/components/CompetitionView').then(module => ({ default: module.CompetitionView })))
const AboutView = lazy(() => import('@/components/AboutView').then(module => ({ default: module.AboutView })))

const tabHashes: Record<string, string> = {
  home: '#today', details: '#forecast', history: '#past-calls',
  accuracy: '#accuracy', agents: '#how-it-works', competition: '#competition',
  about: '#about',
}

const primaryTabs = [
  { id: 'home', label: 'Today', icon: House },
  { id: 'details', label: 'Forecast', icon: MagnifyingGlass },
  { id: 'competition', label: 'Face-off', icon: Trophy },
  { id: 'history', label: 'Past calls', icon: Clock },
  { id: 'about', label: 'About', icon: Info },
]

const morePages = [
  { id: 'accuracy', label: 'Accuracy', description: 'See how past forecasts did', icon: Target },
  { id: 'agents', label: 'How it works', description: 'How Blizzard makes its call', icon: UsersThree },
]

const aboutPage = { id: 'about', label: 'About Blizzard', description: 'Schedule, scoring, and music credits', icon: Info }

function tabFromLocation() {
  return Object.keys(tabHashes).find(tab => tabHashes[tab] === window.location.hash) ?? 'home'
}

function App() {
  const [activeTab, setActiveTab] = useState(tabFromLocation)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const {
    isOffSeason,
    isPreviewMode,
    shouldRenderBlizzard,
    activatePreviewOverride,
    disablePreviewOverride,
  } = useSeasonMode()
  const forecast = useSavedForecast(shouldRenderBlizzard)
  const standings = useCompetitionStandings(shouldRenderBlizzard && (activeTab === 'home' || activeTab === 'competition'))

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
    if (!shouldRenderBlizzard && activeTab !== 'home') {
      setActiveTab('home')
    }
  }, [activeTab, shouldRenderBlizzard])

  useEffect(() => {
    if (!isOffSeason || isPreviewMode) return
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        setPreviewDialogOpen(true)
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [isOffSeason, isPreviewMode])

  // Navigate to details tab (used by HeroView CTA)
  const handleNavigateToDetails = () => {
    setActiveTab('details')
  }

  // Handle tab selection from drawer menu
  const handleDrawerTabSelect = (tab: string) => {
    setActiveTab(tab)
    setMoreDrawerOpen(false)
  }

  const mobileMorePages = [...morePages, aboutPage]

  const pageBackground = shouldRenderBlizzard
    ? 'winter-workspace station-workspace'
    : 'bg-[#071625]'

  return (
    <WeatherThemeProvider prediction={forecast.prediction}>
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
            {isPreviewMode && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => { disablePreviewOverride(); setActiveTab('home') }}
                title="Close off-season preview"
                aria-label="Close off-season preview"
                className="h-11 w-11 min-h-[44px] min-w-[44px]"
              >
                <LockSimple size={18} weight="duotone" />
              </Button>
            )}
            {shouldRenderBlizzard && <ForecastMusicControl />}
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
                  <Button variant="ghost" size="sm" data-section-active={morePages.some(page => page.id === activeTab)}>More</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="station-overlay">
                  {morePages.map(({ id, label, icon: Icon }) => (
                    <DropdownMenuItem key={id} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}>
                      <Icon size={16} className="mr-2" aria-hidden="true" />
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </TabsList>
            {!isMobile && activeTab !== 'home' && <ForecastTicker prediction={forecast.prediction} loading={forecast.loading} error={!!forecast.error} suspended={moreDrawerOpen || previewDialogOpen} />}

            <Suspense fallback={<p className="min-h-40 py-12 text-center text-sm text-muted-foreground" role="status">Loading this page…</p>}>
              <TabsContent value="home" className="station-home">
                <HeroView forecast={forecast} onNavigateToDetails={handleNavigateToDetails} onNavigateToHistory={() => setActiveTab('history')}>
                  <CompetitionScoreboard compact standings={standings} />
                </HeroView>
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
                <CompetitionView standings={standings} />
              </TabsContent>

              <TabsContent value="about">
                <AboutView />
              </TabsContent>

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
              <DrawerContent className="station-overlay station-directory">
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

      {isOffSeason && <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="station-overlay">
          <DialogHeader>
            <DialogTitle>Off-season preview</DialogTitle>
            <DialogDescription>View the forecast site on this device during the off-season.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { activatePreviewOverride(); setPreviewDialogOpen(false) }}>Open preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

      <Toaster position="top-right" />
    </div>
    </WeatherThemeProvider>
  )
}

export default App
