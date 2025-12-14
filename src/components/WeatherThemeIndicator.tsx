import { 
  CloudSnow, 
  Sun, 
  Snowflake, 
  Lightning,
  Cloud,
  CloudRain,
  Drop,
  Moon,
  Sparkle,
  Wind
} from '@phosphor-icons/react'
import { useWeatherTheme } from '../hooks/useWeatherTheme'
import { Badge } from './ui/badge'

export function WeatherThemeIndicator() {
  const { getCurrentTheme, currentTheme, isDarkMode } = useWeatherTheme()
  const theme = getCurrentTheme()

  const getWeatherIcon = () => {
    const iconClass = "transition-all duration-300"
    
    switch (currentTheme) {
      case 'clear':
        return isDarkMode 
          ? <Moon size={16} weight="fill" className={`${iconClass} text-amber-300`} />
          : <Sun size={16} weight="fill" className={`${iconClass} text-amber-500`} />
      case 'partly_cloudy':
        return <Cloud size={16} weight="fill" className={`${iconClass} text-slate-400`} />
      case 'overcast':
        return <Cloud size={16} weight="fill" className={`${iconClass} text-slate-500`} />
      case 'light_snow':
        return <CloudSnow size={16} weight="fill" className={`${iconClass} text-blue-400`} />
      case 'snow_flurries':
        return <Snowflake size={16} weight="fill" className={`${iconClass} text-cyan-400 animate-pulse`} />
      case 'heavy_snow':
        return <Snowflake size={16} weight="fill" className={`${iconClass} text-blue-500`} />
      case 'blizzard':
        return <Wind size={16} weight="fill" className={`${iconClass} text-purple-500 animate-pulse`} />
      case 'ice_storm':
        return <Lightning size={16} weight="fill" className={`${iconClass} text-cyan-500`} />
      case 'freezing_rain':
        return <CloudRain size={16} weight="fill" className={`${iconClass} text-blue-400`} />
      case 'sleet':
        return <Drop size={16} weight="fill" className={`${iconClass} text-slate-400`} />
      case 'whiteout':
        return <Snowflake size={16} weight="fill" className={`${iconClass} text-white animate-pulse`} />
      case 'aurora':
        return <Sparkle size={16} weight="fill" className={`${iconClass} text-emerald-400 animate-pulse`} />
      case 'polar_dawn':
        return <Sun size={16} weight="fill" className={`${iconClass} text-amber-400`} />
      case 'frosted_pine':
        return <CloudSnow size={16} weight="fill" className={`${iconClass} text-emerald-400`} />
      case 'glacial_lagoon':
        return <CloudSnow size={16} weight="fill" className={`${iconClass} text-cyan-400`} />
      case 'cabin_glow':
        return <Sun size={16} weight="fill" className={`${iconClass} text-amber-500`} />
      case 'ice_palace':
        return <Sparkle size={16} weight="fill" className={`${iconClass} text-purple-400 animate-pulse`} />
      default:
        return <CloudSnow size={16} className={`${iconClass} text-primary`} />
    }
  }

  if (!theme) return null

  return (
    <Badge 
      variant="outline" 
      className="flex items-center gap-2 text-xs backdrop-blur-sm bg-background/80 border-border/50 transition-all duration-500 hover:scale-105"
    >
      <span className="text-sm">{theme.emoji}</span>
      {getWeatherIcon()}
      <span className="font-medium">{theme.name}</span>
    </Badge>
  )
}
