import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Function to check if we're on a mobile device (by width or touch capability)
    const checkMobile = () => {
      // Check for touch capability (most mobile devices are touch-enabled)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      // Check if it's a small screen (width less than breakpoint)
      const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT
      
      // Check if it's a mobile device in landscape mode
      // In landscape, height is smaller than width, and height is usually < 900px on mobile devices
      const isLandscapeMobile = window.innerWidth > window.innerHeight && 
                                window.innerHeight < 900 && 
                                isTouchDevice
      
      return isSmallScreen || isLandscapeMobile
    }

    // Main media query for width changes
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    // Second media query for orientation changes
    const orientationMql = window.matchMedia(`(orientation: landscape)`)
    
    const onChange = () => {
      setIsMobile(checkMobile())
    }
    
    // Listen to both media query changes
    mql.addEventListener("change", onChange)
    orientationMql.addEventListener("change", onChange)
    
    // Initial check
    setIsMobile(checkMobile())
    
    // Cleanup
    return () => {
      mql.removeEventListener("change", onChange)
      orientationMql.removeEventListener("change", onChange)
    }
  }, [])

  return !!isMobile
}
