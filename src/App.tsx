import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { CloudSnow, Users, Target, Clock } from '@phosphor-icons/react'
import { EnhancedPredictionView } from '@/components/EnhancedPredictionView'
import { CrowdView } from '@/components/CrowdView'
import { AccuracyView } from '@/components/AccuracyView'
import { HistoryView } from '@/components/HistoryView'
import { ThemeToggle } from '@/components/ThemeToggle'

function App() {
  const [activeTab, setActiveTab] = useState("prediction")

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
            Community-powered snow day forecasting for Rockford, Michigan
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6 sm:mb-8 h-auto p-1">
            <TabsTrigger value="prediction" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2 text-xs sm:text-sm min-h-[60px] sm:min-h-[44px]">
              <CloudSnow size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden sm:inline">Today's Forecast</span>
              <span className="sm:hidden text-center leading-tight">Today</span>
            </TabsTrigger>
            <TabsTrigger value="crowd" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2 text-xs sm:text-sm min-h-[60px] sm:min-h-[44px]">
              <Users size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden sm:inline">Community</span>
              <span className="sm:hidden text-center leading-tight">Crowd</span>
            </TabsTrigger>
            <TabsTrigger value="accuracy" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2 text-xs sm:text-sm min-h-[60px] sm:min-h-[44px]">
              <Target size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="text-center leading-tight">Accuracy</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2 text-xs sm:text-sm min-h-[60px] sm:min-h-[44px]">
              <Clock size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="text-center leading-tight">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="prediction">
            <EnhancedPredictionView />
          </TabsContent>
          
          <TabsContent value="crowd">
            <CrowdView />
          </TabsContent>
          
          <TabsContent value="accuracy">
            <AccuracyView />
          </TabsContent>
          
          <TabsContent value="history">
            <HistoryView />
          </TabsContent>
        </Tabs>
      </div>
      
      <Toaster position="top-right" />
    </div>
  )
}

export default App