import { CloudSnow } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface EnhancedHeaderProps {
  title?: string
  subtitle?: string
}

export function EnhancedHeader({ 
  title = "Blizzard",
  subtitle = "AI-powered snow day forecasting for Rockford, Michigan"
}: EnhancedHeaderProps) {
  return (
    <motion.div 
      className="text-center mb-6 sm:mb-8 relative"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <motion.div
          animate={{ 
            rotate: [0, -5, 5, -5, 0],
            scale: [1, 1.05, 1]
          }}
          transition={{ 
            duration: 3,
            repeat: Infinity,
            repeatDelay: 5,
            ease: "easeInOut"
          }}
        >
          <CloudSnow 
            size={40} 
            className="text-primary sm:w-12 sm:h-12 drop-shadow-lg" 
            weight="duotone" 
          />
        </motion.div>
        
        <motion.h1 
          className="text-2xl sm:text-5xl font-bold text-foreground leading-tight bg-gradient-to-r from-primary via-blue-600 to-cyan-600 bg-clip-text text-transparent"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {title}
        </motion.h1>
      </div>
      
      <motion.p 
        className="text-muted-foreground text-base sm:text-lg px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        {subtitle}
      </motion.p>
      
      {/* Decorative gradient line */}
      <motion.div 
        className="mt-4 h-1 w-32 mx-auto rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 0.6 }}
        transition={{ duration: 1, delay: 0.6 }}
      />
    </motion.div>
  )
}
