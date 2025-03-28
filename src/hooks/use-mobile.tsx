
import * as React from "react"

const DEFAULT_MOBILE_BREAKPOINT = 768

export function useIsMobile(breakpoint = DEFAULT_MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    mql.addEventListener("change", handleResize)
    handleResize() // Initial check
    
    return () => mql.removeEventListener("change", handleResize)
  }, [breakpoint])

  return !!isMobile
}
