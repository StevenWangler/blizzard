import { motion, useReducedMotion } from 'framer-motion'

interface EnhancedHeaderProps {
  title?: string
  subtitle?: string
}

export function EnhancedHeader({ 
  title = "Blizzard",
  subtitle = "Rockford, Michigan"
}: EnhancedHeaderProps) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div 
      className="min-w-0 flex-1"
      initial={reduceMotion ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="broadcast-mark">
          <img
            src={`${import.meta.env.BASE_URL}images/rockford-rams-mark.png`}
            alt=""
            aria-hidden="true"
            className="size-7 object-contain"
            draggable={false}
          />
        </div>
        <div className="min-w-0">
          <motion.h1
            className="broadcast-wordmark"
            initial={reduceMotion ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.1 }}
          >
            {title}
          </motion.h1>
          <p className="broadcast-location">{subtitle}</p>
        </div>
      </div>
    </motion.div>
  )
}
