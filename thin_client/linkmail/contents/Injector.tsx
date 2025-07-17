import type { PlasmoCSConfig, PlasmoGetInlineAnchorList, PlasmoGetStyle } from "plasmo"
import React, { useEffect, useState } from "react"

import MainWrapper from "~components/MainWrapper"
import styleText from "data-text:~styles/core.css"
import { scrapeProfileDataWithWait, isProfilePage, getProfileIdFromUrl, type ProfileData } from "./scraper"

// Configure where this content script runs
export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/*"],
  all_frames: false
}

// Inject CSS
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = styleText
  return style
}

// Use PlasmoGetInlineAnchorList for better control
export const getInlineAnchorList: PlasmoGetInlineAnchorList = async () => {
  const aside = document.querySelector('aside.scaffold-layout__aside')
  if (!aside) return []
  
  return [
    {
      element: aside,
      insertPosition: "afterbegin" // This will insert as the first child
    }
  ]
}

const Injector = () => {
  const [isProfilePageState, setIsProfilePageState] = useState(false)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Function to perform full scraping
  const performFullScrape = async () => {
    try {
      setIsLoading(true)
      const data = await scrapeProfileDataWithWait(true) // Force email lookup
      setProfileData(data)
      console.log('Full profile data scraped:', data)
    } catch (error) {
      console.error('Error scraping full profile data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Function to refresh profile data
  const refreshProfileData = async () => {
    await performFullScrape()
  }

  useEffect(() => {
    // Check if we're on a LinkedIn profile page
    const checkProfilePage = async () => {
      const profileId = getProfileIdFromUrl()
      const isProfile = isProfilePage()
      
      setIsProfilePageState(isProfile)
      
      if (isProfile && profileId !== currentProfileId) {
        setCurrentProfileId(profileId)
        
        // Always perform full scrape
        await performFullScrape()
      }
    }

    checkProfilePage()
    
    // Listen for navigation changes
    const observer = new MutationObserver(checkProfilePage)
    observer.observe(document.body, { childList: true, subtree: true })
    
    // Listen for URL changes
    window.addEventListener('popstate', checkProfilePage)
    
    return () => {
      observer.disconnect()
      window.removeEventListener('popstate', checkProfilePage)
    }
  }, [currentProfileId])

  if (!isProfilePageState) return null

  return (
    <div className="linkmail">
      <MainWrapper 
        profileData={profileData} 
        isLoading={isLoading}
        onRefreshProfile={refreshProfileData}
        hasAttemptedEmailLookup={true}
      />
    </div>
  )
}

export default Injector
