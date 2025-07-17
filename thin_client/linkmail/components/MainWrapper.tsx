import React, { useState, useEffect } from "react"

import AuthView from "~components/AuthView"
import SplashView from "~components/SplashView"
import EditorView from "~components/EditorView"
import SuccessView from "~components/SuccessView"
import AccountDropdown from "~components/AccountDropdown"

interface ProfileData {
  name: string
  headline: string
  about: string
}

interface MainWrapperProps {
  profileData: ProfileData | null
  isLoading?: boolean
  onRefreshProfile?: (forceEmailLookup?: boolean) => Promise<void>
  hasAttemptedEmailLookup?: boolean
}

type ViewType = 'signin' | 'splash' | 'editor' | 'success'

const MainWrapper: React.FC<MainWrapperProps> = ({ profileData }) => {
  const [currentView, setCurrentView] = useState<ViewType>('signin')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userData, setUserData] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [emailData, setEmailData] = useState({ subject: '', content: '', recipientEmail: '' })

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'checkAuthStatus' 
      })
      
      if (response.isAuthenticated) {
        setIsAuthenticated(true)
        setUserData(response.userData)
        setCurrentView('splash')
      } else {
        setIsAuthenticated(false)
        setCurrentView('signin')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setCurrentView('signin')
    }
  }

  const handleSignIn = async (email: string, passkey: string) => {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'signInWithEmail',
        email,
        passkey
      })
      
      if (response.success) {
        setIsAuthenticated(true)
        setUserData(response.userData)
        setCurrentView('splash')
      } else {
        throw new Error(response.error || 'Authentication failed')
      }
    } catch (error) {
      console.error('Sign in failed:', error)
      throw error
    }
  }

  const handleSignOut = async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'logout' })
      setIsAuthenticated(false)
      setUserData(null)
      setCurrentView('signin')
      setSelectedTemplate(null)
      setEmailData({ subject: '', content: '', recipientEmail: '' })
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  const handleGenerate = () => {
    setCurrentView('editor')
  }

  const handleEmailSent = () => {
    setCurrentView('success')
    // Reset form data
    setEmailData({ subject: '', content: '', recipientEmail: '' })
  }

  const handleBackToSplash = () => {
    setCurrentView('splash')
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'signin':
        return <AuthView onSignIn={handleSignIn} />
      
      case 'splash':
        return (
          <SplashView 
            profileData={profileData}
            selectedTemplate={selectedTemplate}
            onTemplateSelect={setSelectedTemplate}
            onGenerate={handleGenerate}
            userData={userData}
          />
        )
      
      case 'editor':
        return (
          <EditorView
            profileData={profileData}
            selectedTemplate={selectedTemplate}
            userData={userData}
            emailData={emailData}
            onEmailDataChange={setEmailData}
            onEmailSent={handleEmailSent}
            onBack={handleBackToSplash}
          />
        )
      
      case 'success':
        return <SuccessView onBackToSplash={handleBackToSplash} />
      
      default:
        return <AuthView onSignIn={handleSignIn} />
    }
  }

  return (
    <div className="linkmail-container">
      {/* Logo */}
      <div style={{ display: 'flex' }}>
        <img 
          src={chrome.runtime.getURL("assets/icon.png")}
          style={{ width: '50px', margin: '20px auto' }} 
          alt="LinkMail Logo"
        />
      </div>

      {/* Main Content */}
      {renderCurrentView()}

      {/* Account Dropdown - only show when authenticated */}
      {isAuthenticated && userData && (
        <AccountDropdown 
          userEmail={userData.email}
          onSignOut={handleSignOut}
          onEditProfile={() => {
            // Handle edit profile
            const bioSetupUrl = chrome.runtime.getURL(`dashboard.html?email=${encodeURIComponent(userData.email)}&mode=edit`)
            chrome.runtime.sendMessage({
              action: 'openBioSetupPage',
              url: bioSetupUrl
            })
          }}
        />
      )}
    </div>
  )
}

export default MainWrapper
