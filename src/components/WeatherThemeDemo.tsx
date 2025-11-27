import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { useWeatherTheme, weatherThemes, darkWeatherThemes } from '../hooks/useWeatherTheme'

export function WeatherThemeDemo() {
  const { updateWeatherConditions, isDarkMode, toggleDarkMode, getCurrentTheme, currentTheme } = useWeatherTheme()
  
  const testScenarios = [
    { name: 'Clear', emoji: '☀️', snowfall: 0, windSpeed: 3, visibility: 10, description: 'Sunny skies' },
    { name: 'Partly Cloudy', emoji: '⛅', snowfall: 0, windSpeed: 5, visibility: 7, description: 'Some clouds' },
    { name: 'Overcast', emoji: '☁️', snowfall: 0, windSpeed: 5, visibility: 5, description: 'Gray skies' },
    { name: 'Light Snow', emoji: '🌨️', snowfall: 1, windSpeed: 8, visibility: 4, description: 'Gentle flakes' },
    { name: 'Flurries', emoji: '❄️', snowfall: 0.5, windSpeed: 12, visibility: 4, description: 'Dancing snow' },
    { name: 'Heavy Snow', emoji: '🌨️', snowfall: 4, windSpeed: 15, visibility: 1.5, description: 'Accumulating' },
    { name: 'Blizzard', emoji: '🌀', snowfall: 8, windSpeed: 35, visibility: 0.2, description: 'Severe storm' },
    { name: 'Ice Storm', emoji: '🧊', snowfall: 1, windSpeed: 20, visibility: 1.5, description: 'Freezing conditions' },
    { name: 'Freezing Rain', emoji: '🌧️', snowfall: 0.5, windSpeed: 12, visibility: 2.5, description: 'Icy drizzle' },
    { name: 'Sleet', emoji: '🌨️', snowfall: 0.8, windSpeed: 10, visibility: 3, description: 'Mixed precip' },
    { name: 'Whiteout', emoji: '⬜', snowfall: 6, windSpeed: 40, visibility: 0.05, description: 'Zero visibility' },
    { name: 'Aurora', emoji: '🌌', snowfall: 0, windSpeed: 2, visibility: 10, description: 'Northern lights' },
  ]

  const currentThemeData = getCurrentTheme()
  const allThemes = isDarkMode ? darkWeatherThemes : weatherThemes

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{currentThemeData?.emoji}</span>
            Weather Theme Demo
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleDarkMode}
            className="transition-all duration-300 hover:scale-105"
          >
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Experience {Object.keys(allThemes).length} unique weather themes
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Theme buttons grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {testScenarios.map((scenario) => (
            <Button
              key={scenario.name}
              variant={currentTheme === scenario.name.toLowerCase().replace(' ', '_') ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateWeatherConditions(scenario.snowfall, scenario.windSpeed, scenario.visibility)}
              className="flex flex-col items-center gap-1 h-auto py-2 transition-all duration-300 hover:scale-105"
            >
              <span className="text-lg">{scenario.emoji}</span>
              <span className="text-xs font-medium">{scenario.name}</span>
            </Button>
          ))}
        </div>

        {/* Current theme display */}
        {currentThemeData && (
          <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentThemeData.emoji}</span>
              <div>
                <h4 className="font-semibold text-lg">{currentThemeData.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {testScenarios.find(s => s.name.toLowerCase().replace(' ', '_') === currentTheme)?.description || 'Custom conditions'}
                </p>
              </div>
            </div>
            
            {/* Color palette preview */}
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <div 
                  className="w-full h-8 rounded-lg border shadow-sm transition-colors duration-500" 
                  style={{backgroundColor: currentThemeData.primary}}
                />
                <p className="text-[10px] text-center text-muted-foreground">Primary</p>
              </div>
              <div className="space-y-1">
                <div 
                  className="w-full h-8 rounded-lg border shadow-sm transition-colors duration-500" 
                  style={{backgroundColor: currentThemeData.accent}}
                />
                <p className="text-[10px] text-center text-muted-foreground">Accent</p>
              </div>
              <div className="space-y-1">
                <div 
                  className="w-full h-8 rounded-lg border shadow-sm transition-colors duration-500" 
                  style={{backgroundColor: currentThemeData.secondary}}
                />
                <p className="text-[10px] text-center text-muted-foreground">Secondary</p>
              </div>
              <div className="space-y-1">
                <div 
                  className="w-full h-8 rounded-lg border shadow-sm transition-colors duration-500" 
                  style={{backgroundColor: currentThemeData.background}}
                />
                <p className="text-[10px] text-center text-muted-foreground">Background</p>
              </div>
            </div>

            {/* Atmospheric properties */}
            {(currentThemeData.shimmer || currentThemeData.gradient) && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {currentThemeData.shimmer && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    ✨ Shimmer Effect
                  </span>
                )}
                {currentThemeData.atmosphereIntensity && currentThemeData.atmosphereIntensity > 0.3 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground">
                    🌫️ Atmospheric
                  </span>
                )}
                {currentThemeData.pulseSpeed === 'fast' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground">
                    ⚡ Intense
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}