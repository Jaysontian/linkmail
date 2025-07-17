import { Storage } from "@plasmohq/storage"

const storage = new Storage()

// API base URL
const API_BASE_URL = "https://linkmail-api.vercel.app"

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse)
  return true // Keep the message channel open for async response
})

async function handleMessage(request: any, sender: any, sendResponse: any) {
  try {
    switch (request.action) {
      case 'checkAuthStatus':
        await handleCheckAuthStatus(sendResponse)
        break
      
      case 'signInWithEmail':
        await handleSignInWithEmail(request.email, request.passkey, sendResponse)
        break
      
      case 'logout':
        await handleLogout(sendResponse)
        break
      
      case 'generateEmail':
        await handleGenerateEmail(request, sendResponse)
        break
      
      case 'sendEmail':
        await handleSendEmail(request, sendResponse)
        break
      
      case 'findEmailWithApollo':
        await handleFindEmailWithApollo(request, sendResponse)
        break
      
      case 'saveProfileData':
        await handleSaveProfileData(request, sendResponse)
        break
      
      case 'openBioSetupPage':
        await handleOpenBioSetupPage(request, sendResponse)
        break
      
      default:
        sendResponse({ success: false, error: 'Unknown action' })
    }
  } catch (error) {
    console.error('Background script error:', error)
    sendResponse({ success: false, error: error.message })
  }
}

async function handleCheckAuthStatus(sendResponse: any) {
  try {
    const sessionKey = await storage.get("sessionKey")
    
    if (!sessionKey) {
      sendResponse({ isAuthenticated: false })
      return
    }

    // Validate session key with API
    const response = await fetch(`${API_BASE_URL}/api/user/session?session_key=${sessionKey}`)
    const data = await response.json()

    if (data.valid) {
      const userData = await storage.get("userData")
      sendResponse({ 
        isAuthenticated: true, 
        userData: userData || { email: data.email }
      })
    } else {
      // Clear invalid session
      await storage.remove("sessionKey")
      await storage.remove("userData")
      sendResponse({ isAuthenticated: false })
    }
  } catch (error) {
    console.error('Auth status check failed:', error)
    sendResponse({ isAuthenticated: false })
  }
}

async function handleSignInWithEmail(email: string, passkey: string, sendResponse: any) {
  try {
    // Call the session generation API
    const response = await fetch(`${API_BASE_URL}/api/user/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        passcode: passkey
      })
    })

    const data = await response.json()

    if (response.ok && data.session_key) {
      // Store session key and user data
      await storage.set("sessionKey", data.session_key)
      await storage.set("userData", { 
        email: email,
        sessionExpiresAt: data.expires_at
      })
      
      sendResponse({ 
        success: true, 
        userData: { email: email }
      })
    } else {
      sendResponse({ 
        success: false, 
        error: data.error || 'Authentication failed'
      })
    }
  } catch (error) {
    console.error('Sign in failed:', error)
    sendResponse({ 
      success: false, 
      error: 'Network error. Please try again.'
    })
  }
}

async function handleLogout(sendResponse: any) {
  try {
    const sessionKey = await storage.get("sessionKey")
    
    if (sessionKey) {
      // Invalidate session on server
      try {
        await fetch(`${API_BASE_URL}/api/user/session?session_key=${sessionKey}`, {
          method: 'DELETE'
        })
      } catch (error) {
        console.error('Failed to invalidate session on server:', error)
      }
    }

    // Clear local storage
    await storage.remove("sessionKey")
    await storage.remove("userData")
    
    sendResponse({ success: true })
  } catch (error) {
    console.error('Logout failed:', error)
    sendResponse({ success: false, error: error.message })
  }
}

async function handleGenerateEmail(request: any, sendResponse: any) {
  try {
    const sessionKey = await storage.get("sessionKey")
    
    if (!sessionKey) {
      sendResponse({ success: false, error: 'Not authenticated' })
      return
    }

    // Call the email generation API
    const response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `Generate a professional email for ${request.profileData.name || 'a LinkedIn contact'} based on their profile: ${request.profileData.headline || ''}. ${request.profileData.about || ''}. Use the template: ${request.templateData.content}`,
        systemPrompt: "You are a professional email assistant. Generate personalized, professional emails that are concise and engaging."
      })
    })

    const data = await response.json()

    if (response.ok && data.result) {
      sendResponse({ 
        success: true, 
        email: data.result,
        subject: request.templateData.subjectLine || 'Professional Inquiry'
      })
    } else {
      sendResponse({ 
        success: false, 
        error: data.error || 'Failed to generate email'
      })
    }
  } catch (error) {
    console.error('Email generation failed:', error)
    sendResponse({ 
      success: false, 
      error: 'Failed to generate email. Please try again.'
    })
  }
}

async function handleSendEmail(request: any, sendResponse: any) {
  try {
    const sessionKey = await storage.get("sessionKey")
    
    if (!sessionKey) {
      sendResponse({ success: false, error: 'Not authenticated' })
      return
    }

    // Call the email sending API
    const response = await fetch(`${API_BASE_URL}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_key: sessionKey,
        to: request.to,
        subject: request.subject,
        body: request.body,
        attachments: request.attachments || []
      })
    })

    const data = await response.json()

    if (response.ok && data.success) {
      sendResponse({ 
        success: true, 
        message_id: data.message_id,
        thread_id: data.thread_id
      })
    } else {
      sendResponse({ 
        success: false, 
        error: data.error || 'Failed to send email'
      })
    }
  } catch (error) {
    console.error('Email sending failed:', error)
    sendResponse({ 
      success: false, 
      error: 'Failed to send email. Please try again.'
    })
  }
}

async function handleFindEmailWithApollo(request: any, sendResponse: any) {
  // This is a placeholder - you would implement Apollo API integration here
  sendResponse({ 
    success: false, 
    error: 'Apollo integration not implemented'
  })
}

async function handleSaveProfileData(request: any, sendResponse: any) {
  try {

    console.log("Saving user data");

    const sessionKey = await storage.get("sessionKey")
    const userData = await storage.get("userData")
    
    if (!sessionKey) {
      sendResponse({ success: false, error: 'Not authenticated' })
      return
    }

    // Get user email from stored userData
    const userEmail = (userData as any)?.email || null

    if (!userEmail) {
      sendResponse({ success: false, error: 'User email not found' })
      return
    }

    // Call the profile data saving API
    const response = await fetch(`${API_BASE_URL}/api/people`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profile_data: request.profileData,
        user_email: userEmail,
        session_key: sessionKey
      })
    })

    const data = await response.json()

    if (response.ok && data.success) {
      sendResponse({ success: true })
    } else {
      sendResponse({ 
        success: false, 
        error: data.error || 'Failed to save profile data'
      })
    }
  } catch (error) {
    console.error('Profile data saving failed:', error)
    sendResponse({ 
      success: false, 
      error: 'Failed to save profile data. Please try again.'
    })
  }
}

async function handleOpenBioSetupPage(request: any, sendResponse: any) {
  try {
    await chrome.tabs.create({ url: request.url })
    sendResponse({ success: true })
  } catch (error) {
    console.error('Failed to open bio setup page:', error)
    sendResponse({ success: false, error: error.message })
  }
} 