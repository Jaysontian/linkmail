import React, { useState, useEffect } from "react"
import TemplateSelector from "~components/TemplateSelector"

interface Props {
  profileData: any
  selectedTemplate: any
  onTemplateSelect: (template: any) => void
  onGenerate: () => void
  userData?: any
}

const SplashView: React.FC<Props> = ({ 
  profileData, 
  selectedTemplate, 
  onTemplateSelect, 
  onGenerate,
  userData
}) => {
  const [lastEmailStatus, setLastEmailStatus] = useState('')

  useEffect(() => {
    // Check last email sent status
    checkLastEmailSent()
  }, [profileData])

  const checkLastEmailSent = async () => {
    // Implementation for checking last email sent
    // This would check chrome.storage for email history
    setLastEmailStatus('No Email Sent Yet')
  }

  const getTitle = () => {
    if (profileData?.name) {
      const firstName = profileData.name.split(' ')[0]
      return `Draft an email to ${firstName}`
    }
    return 'Draft an email'
  }

  return (
    <div id="linkmail-splash" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 className="linkmail-header">{getTitle()}</h2>
      
      {/* Profile Card - Dev Testing */}
      {/* {profileData && (
        <div style={{
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '16px',
          margin: '16px 0',
          backgroundColor: '#f9f9f9',
          width: '100%',
          maxWidth: '300px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            {profileData.profilePicUrl ? (
              <img 
                src={profileData.profilePicUrl} 
                alt="Profile" 
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginRight: '12px'
                }}
              />
            ) : (
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: '#0077b5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold',
                marginRight: '12px'
              }}>
                {profileData.name ? profileData.name.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <div>
              <div style={{ 
                fontWeight: 'bold', 
                fontSize: '16px',
                color: '#333'
              }}>
                {profileData.name || 'Unknown Name'}
              </div>
              {profileData.headline && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666',
                  marginTop: '2px'
                }}>
                  {profileData.headline}
                </div>
              )}
            </div>
          </div>
          
          {profileData.email && (
            <div style={{
              fontSize: '14px',
              color: '#0077b5',
              wordBreak: 'break-all',
              padding: '8px',
              backgroundColor: 'white',
              borderRadius: '4px',
              border: '1px solid #e0e0e0'
            }}>
              📧 {profileData.email}
            </div>
          )}
          
          {profileData.company && (
            <div style={{
              fontSize: '12px',
              color: '#666',
              marginTop: '8px'
            }}>
              🏢 {profileData.company}
            </div>
          )}
        </div>
      )} */}
      
      {lastEmailStatus && (
        <div className="linkmail-last-email-status">
          {lastEmailStatus}
        </div>
      )}
      
      <br />
      
      <div className="linkmail-template-select" style={{ marginBottom: '20px', width: '100%' }}>
        <TemplateSelector 
          selectedTemplate={selectedTemplate}
          onTemplateSelect={onTemplateSelect}
          userData={userData}
        />
      </div>

      <button 
        className="lm-btn" 
        onClick={onGenerate}
        disabled={!selectedTemplate}
        style={{ animation: 'lm-pulse 2s infinite' }}
      >
        Generate
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/>
          <path d="M6 12h16"/>
        </svg>
      </button>
    </div>
  )
}

export default SplashView
