import React, { useState, useEffect } from "react"

interface Props {
  profileData: any
  selectedTemplate: any
  userData: any
  emailData: { subject: string; content: string; recipientEmail: string }
  onEmailDataChange: (data: any) => void
  onEmailSent: () => void
  onBack: () => void
}

const EditorView: React.FC<Props> = ({
  profileData,
  selectedTemplate,
  userData,
  emailData,
  onEmailDataChange,
  onEmailSent,
  onBack
}) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showFindEmail, setShowFindEmail] = useState(false)

  useEffect(() => {
    generateEmail()
  }, [])

  const generateEmail = async () => {
    setIsGenerating(true)
    try {
      // First, save profile data to backend
      if (userData?.email) {
        try {
          const saveResponse = await chrome.runtime.sendMessage({
            action: 'saveProfileData',
            profileData
          })

          if (saveResponse.success) {
            console.log('Profile data saved successfully')
          } else {
            console.warn('Failed to save profile data to backend:', saveResponse.error)
          }
        } catch (saveError) {
          console.warn('Error saving profile data:', saveError)
          // Continue with email generation even if saving fails
        }
      }

      // Call your email generation API
      const response = await chrome.runtime.sendMessage({
        action: 'generateEmail',
        profileData,
        templateData: selectedTemplate,
        userData
      })

      if (response.success) {
        onEmailDataChange({
          subject: response.subject,
          content: response.email,
          recipientEmail: profileData.email || ''
        })
        
        setShowFindEmail(!profileData.email)
      }
    } catch (error) {
      console.error('Email generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSendEmail = async () => {
    if (!emailData.recipientEmail || !emailData.subject || !emailData.content) {
      alert('Please fill in all fields')
      return
    }

    setIsSending(true)
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'sendEmail',
        to: emailData.recipientEmail,
        subject: emailData.subject,
        body: emailData.content,
        attachments: selectedTemplate?.attachments || []
      })

      if (response.success) {
        onEmailSent()
      }
    } catch (error) {
      console.error('Failed to send email:', error)
      alert('Failed to send email. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(emailData.content)
    // You could add a toast notification here
  }

  const handleFindEmail = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'findEmailWithApollo',
        profileData
      })

      if (response.success && response.email) {
        onEmailDataChange({
          ...emailData,
          recipientEmail: response.email
        })
        setShowFindEmail(false)
      } else {
        alert('No email found in Apollo database')
      }
    } catch (error) {
      console.error('Email finding failed:', error)
      alert('Failed to find email. Please try again.')
    }
  }

  if (isGenerating) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
        <p>Generating your email...</p>
      </div>
    )
  }

  return (
    <div id="linkmail-editor">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ position: 'relative' }}>
          <input
            className="lm-input"
            placeholder="Recipient Email"
            style={{ fontSize: '10pt' }}
            value={emailData.recipientEmail}
            onChange={(e) => onEmailDataChange({ ...emailData, recipientEmail: e.target.value })}
          />
          {showFindEmail && (
            <button
              className="lm-btn-2"
              onClick={handleFindEmail}
              style={{ display: 'block', marginTop: '4px', fontSize: '9pt', padding: '4px 8px' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              Find Email
            </button>
          )}
        </div>

        <input
          className="lm-input"
          placeholder="Empty Subject"
          style={{ fontSize: '10pt' }}
          value={emailData.subject}
          onChange={(e) => onEmailDataChange({ ...emailData, subject: e.target.value })}
        />

        <div style={{ position: 'relative' }}>
          <textarea
            className="lm-textarea"
            style={{ fontSize: '10pt', minHeight: '120px' }}
            value={emailData.content}
            onChange={(e) => onEmailDataChange({ ...emailData, content: e.target.value })}
          />
        </div>

        {/* Attachments */}
        {selectedTemplate?.attachments && selectedTemplate.attachments.length > 0 && (
          <div className="email-attachments">
            <div className="attachments-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.47"/>
              </svg>
              <span>Attachments</span>
            </div>
            <div className="email-attachments-list">
              {selectedTemplate.attachments.map((attachment, index) => (
                <div key={index} className="email-attachment-item">
                  <div className="attachment-info">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div>
                      <p className="attachment-name">{attachment.name}</p>
                      <p className="attachment-size">{Math.round(attachment.size / 1024)} KB</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between', padding: '0px' }}>
          <button className="lm-btn-2" onClick={handleCopy}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            Copy
          </button>
          <button 
            className="lm-btn" 
            onClick={handleSendEmail}
            disabled={isSending}
          >
            {isSending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditorView
