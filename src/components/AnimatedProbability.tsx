import { useEffect, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedProbabilityProps {
  /** Target probability value (0-100) */
  value: number
  /** Duration of animation in seconds */
  duration?: number
  /** Custom className for text styling */
  className?: string
}

export function AnimatedProbability({ 
  value, 
  duration = 1.5,
  className = 'text-6xl font-bold text-primary'
}: AnimatedProbabilityProps) {
  const [displayValue, setDisplayValue] = useState(0)
  
  // Create spring animation for smooth counting
  const spring = useSpring(0, {
    duration: duration * 1000,
    bounce: 0
  })

  // Transform spring value to integer for display
  useEffect(() => {
    spring.set(value)
    
    const unsubscribe = spring.on('change', (latest) => {
      setDisplayValue(Math.round(latest))
    })

    return () => unsubscribe()
  }, [value, spring])

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        type: 'spring',
        stiffness: 200,
        damping: 20,
        delay: 0.2
      }}
      className={className}
    >
      <motion.span
        animate={value >= 70 ? {
          textShadow: [
            "0 0 20px rgba(59, 130, 246, 0.5)",
            "0 0 30px rgba(59, 130, 246, 0.8)",
            "0 0 20px rgba(59, 130, 246, 0.5)",
          ]
        } : {}}
        transition={value >= 70 ? {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        } : {}}
      >
        {displayValue}%
      </motion.span>
    </motion.div>
  )
}
