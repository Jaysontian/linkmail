// Content script for scraping LinkedIn profile data
// This script runs in the context of LinkedIn pages to extract profile information

export interface ProfileData {
  name: string
  firstName: string
  lastName: string
  headline: string
  about: string
  location?: string
  company?: string
  email?: string
  profilePicUrl?: string
  url?: string
  experience?: Array<{
    content: string
  }>
}

// Enhanced selectors for current LinkedIn structure
const SELECTORS = {
  name: 'h1.ewzUOnzlFWttZcdeMfcHHOcqrTSjsLqEZtQw, h1',
  headline: '.text-body-medium[data-generated-suggestion-target], .text-body-medium',
  about: '#about .inline-show-more-text--is-collapsed span[aria-hidden="true"], #about span[aria-hidden="true"]',
  location: '.text-body-small.inline.t-black--light.break-words, .pv-text-details__left-panel .text-body-small',
  profilePic: '.pv-top-card-profile-picture__image--show, .pv-top-card__photo img',
  contactInfo: 'a[href*="contact-info"]',
  experienceSection: '#experience',
  experienceItems: '.pvs-entity, li.artdeco-list__item'
}

// Email finder utility
class EmailFinder {
  private static _lastFoundEmail: string | null = null
  private static _lastProfileUrl: string | null = null

  // Enhanced email regex - more comprehensive
  private static readonly EMAIL_REGEX = /\b[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}\b/g

  static extractEmail(text: string): string | null {
    if (!text) return null
    
    const matches = text.match(this.EMAIL_REGEX)
    if (matches && matches.length > 0) {
      // Filter out common false positives
      const validEmail = matches.find(email => 
        !email.includes('example.com') && 
        !email.includes('test.com') &&
        !email.includes('placeholder')
      )
      
      if (validEmail) {
        console.log('Email found:', validEmail)
        return validEmail
      }
    }
    
    return null
  }

  static checkAboutSection(): string | null {
    const aboutElement = document.querySelector(SELECTORS.about)
    if (aboutElement) {
      return this.extractEmail(aboutElement.textContent || '')
    }
    return null
  }

  static async checkContactInfoModal(): Promise<string | null> {
    const contactButton = document.querySelector(SELECTORS.contactInfo) as HTMLElement
    if (!contactButton) return null

    // Hide modal with visibility: hidden and pointer-events: none to prevent interaction
    const hideModalStyle = document.createElement('style')
    hideModalStyle.id = 'linkmail-hide-modal-style'
    hideModalStyle.textContent = `
      /* Hide all modal elements with visibility: hidden and prevent interaction */
      .artdeco-modal-overlay,
      .artdeco-modal,
      .artdeco-modal__content,
      .artdeco-modal__header,
      .artdeco-modal__dismiss,
      [data-test-modal-container],
      [data-test-modal],
      [role="dialog"],
      #artdeco-modal-outlet {
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `
    document.head.appendChild(hideModalStyle)

    // Click to open modal
    contactButton.click()

    let email: string | null = null
    
    // Wait for modal and check for email
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 800))
      
      const modalSelectors = [
        '.artdeco-modal__content',
        '[aria-label*="Contact info"]',
        '.pv-contact-info',
        '.pv-contact-info__contact-type',
        '.XRpFiHajaNzYjdCILtAPWTVclloyI'
      ]
      
      for (const selector of modalSelectors) {
        const modalContent = document.querySelector(selector)
        if (modalContent) {
          email = this.extractEmail(modalContent.textContent || '')
          if (email) break
        }
      }
      
      if (email) break
    }

    // Close modal
    const closeButton = document.querySelector('button[aria-label*="Dismiss"], .artdeco-modal__dismiss') as HTMLElement
    if (closeButton) closeButton.click()

    // Restore modal visibility and interaction after scraping
    const restoreModalStyle = document.createElement('style')
    restoreModalStyle.id = 'linkmail-restore-modal-style'
    restoreModalStyle.textContent = `
      /* Restore modal elements to visible and interactive */
      .artdeco-modal-overlay,
      .artdeco-modal,
      .artdeco-modal__content,
      .artdeco-modal__header,
      .artdeco-modal__dismiss,
      [data-test-modal-container],
      [data-test-modal],
      [role="dialog"],
      #artdeco-modal-outlet {
        visibility: visible !important;
        pointer-events: auto !important;
      }
    `
    document.head.appendChild(restoreModalStyle)

    // Remove hiding style
    const styleElement = document.getElementById('linkmail-hide-modal-style')
    if (styleElement) styleElement.remove()

    return email
  }

  static checkFullPageRegex(): string | null {
    // Regex search entire page content as fallback
    const pageText = document.body.textContent || ''
    return this.extractEmail(pageText)
  }

  static async findLinkedInEmail(useCache = true): Promise<string | null> {
    // Check cache
    if (useCache && this._lastFoundEmail && this._lastProfileUrl === window.location.href) {
      console.log('Using cached email:', this._lastFoundEmail)
      return this._lastFoundEmail
    }

    // 1. Check about section first (fastest)
    let email = this.checkAboutSection()
    if (email) {
      this._lastFoundEmail = email
      this._lastProfileUrl = window.location.href
      return email
    }

    // 2. Check contact info modal
    email = await this.checkContactInfoModal()
    if (email) {
      this._lastFoundEmail = email
      this._lastProfileUrl = window.location.href
      return email
    }

    // 3. Fallback: regex search entire page
    email = this.checkFullPageRegex()
    if (email) {
      this._lastFoundEmail = email
      this._lastProfileUrl = window.location.href
      return email
    }

    return null
  }

  static clearCachedEmail(): void {
    this._lastFoundEmail = null
    this._lastProfileUrl = null
  }
}

// Profile scraper utility
class ProfileScraper {
  static extractBasicInfo(): { name: string; firstName: string; lastName: string; headline: string } {
    const nameElement = document.querySelector(SELECTORS.name)
    const name = nameElement?.textContent?.trim() || ''
    
    const nameParts = name.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
    
    const headlineElement = document.querySelector(SELECTORS.headline)
    const headline = headlineElement?.textContent?.trim() || ''
    
    return { name, firstName, lastName, headline }
  }

  static extractAbout(): string {
    const aboutElement = document.querySelector(SELECTORS.about)
    return aboutElement?.textContent?.trim() || ''
  }

  static extractLocation(): string {
    const locationElement = document.querySelector(SELECTORS.location)
    const location = locationElement?.textContent?.trim() || ''
    
    // Filter out non-location text
    if (location && !location.includes('Contact info') && !location.includes('connections')) {
      return location
    }
    
    return ''
  }

  static extractCompany(): string {
    const { headline } = this.extractBasicInfo()
    
    // Try to extract from headline
    if (headline.includes(' at ')) {
      const company = headline.split(' at ').pop()?.trim() || ''
      if (company) return company
    }

    // Try first experience item
    const experienceSection = document.querySelector(SELECTORS.experienceSection)
    if (experienceSection) {
      const firstExperience = experienceSection.closest('section')?.querySelector('.pvs-entity')
      if (firstExperience) {
        const companyElement = firstExperience.querySelector('.t-14.t-normal span[aria-hidden="true"]')
        return companyElement?.textContent?.trim() || ''
      }
    }

    return ''
  }

  static extractProfilePicUrl(): string {
    const imgElement = document.querySelector(SELECTORS.profilePic) as HTMLImageElement
    return imgElement?.src || ''
  }

  static extractExperience(): Array<{ content: string }> {
    const experienceSection = document.querySelector(SELECTORS.experienceSection)
    if (!experienceSection) return []

    const listContainer = experienceSection.closest('section')?.querySelector('.pvs-list__container')
    if (!listContainer) return []

    const experienceItems = Array.from(listContainer.querySelectorAll('.pvs-entity'))
    
    return experienceItems.map(item => {
      // Extract job title
      const titleElement = item.querySelector('.mr1.hoverable-link-text.t-bold span[aria-hidden="true"], .t-bold span[aria-hidden="true"]')
      const title = titleElement?.textContent?.trim() || ''
      
      // Extract company
      const companyElement = item.querySelector('.t-14.t-normal span[aria-hidden="true"]')
      const company = companyElement?.textContent?.trim() || ''
      
      // Extract duration
      const durationElement = item.querySelector('.pvs-entity__caption-wrapper span[aria-hidden="true"]')
      const duration = durationElement?.textContent?.trim() || ''
      
      // Extract location (usually second t-black--light element)
      const locationElements = item.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]')
      const location = locationElements.length > 1 ? locationElements[1]?.textContent?.trim() || '' : ''
      
      const content = [title, company, duration, location].filter(text => text).join(' · ')
      return { content }
    }).filter(item => item.content !== '')
  }

  static async scrapeBasicProfileData(): Promise<ProfileData> {
    console.log('ProfileScraper: Starting basic profile data scraping')

    const { name, firstName, lastName, headline } = this.extractBasicInfo()
    const about = this.extractAbout()
    const location = this.extractLocation()
    const company = this.extractCompany()
    const profilePicUrl = this.extractProfilePicUrl()
    const experience = this.extractExperience()

    // Check for email in about section
    const emailFromAbout = EmailFinder.extractEmail(about)

    const result: ProfileData = {
      name,
      firstName,
      lastName,
      headline,
      about,
      location,
      company,
      profilePicUrl,
      experience,
      email: emailFromAbout || undefined,
      url: window.location.href
    }

    console.log('ProfileScraper: Basic profile data scraping complete')
    return result
  }

  static async scrapeProfileData(forceEmailLookup = false): Promise<ProfileData> {
    console.log('ProfileScraper: Starting full profile data scraping')

    // Get basic data first
    const basicData = await this.scrapeBasicProfileData()

    // Only do intensive email lookup if requested and not found in basic data
    if (forceEmailLookup && !basicData.email) {
      console.log('ProfileScraper: Looking up email via EmailFinder')
      const foundEmail = await EmailFinder.findLinkedInEmail()
      
      if (foundEmail) {
        basicData.email = foundEmail
        console.log('ProfileScraper: Email found:', foundEmail)
      }
    }

    console.log('ProfileScraper: Full profile data scraping complete')
    return basicData
  }
}

// Main scraping functions
export const scrapeProfileData = async (forceEmailLookup = false): Promise<ProfileData> => {
  return await ProfileScraper.scrapeProfileData(forceEmailLookup)
}

export const scrapeBasicProfileData = async (): Promise<ProfileData> => {
  return await ProfileScraper.scrapeBasicProfileData()
}

// Utility functions
export const isProfilePage = (): boolean => {
  const url = window.location.href
  return /linkedin\.com\/in\/([^\/]+)/.test(url)
}

export const getProfileIdFromUrl = (): string | null => {
  const url = window.location.href
  const match = url.match(/linkedin\.com\/in\/([^\/]+)/)
  return match ? match[1] : null
}

export const waitForContent = (selector: string, timeout: number = 5000): Promise<Element | null> => {
  return new Promise((resolve) => {
    const element = document.querySelector(selector)
    if (element) {
      resolve(element)
      return
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element) {
        observer.disconnect()
        resolve(element)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

// Enhanced scraping with content waiting
export const scrapeProfileDataWithWait = async (forceEmailLookup = false): Promise<ProfileData> => {
  await waitForContent('h1', 3000)
  await waitForContent('.text-body-medium', 2000)
  return await scrapeProfileData(forceEmailLookup)
}

// Export for use in other content scripts
export default {
  scrapeProfileData,
  scrapeBasicProfileData,
  scrapeProfileDataWithWait,
  isProfilePage,
  getProfileIdFromUrl,
  waitForContent,
  EmailFinder,
  ProfileScraper
}
