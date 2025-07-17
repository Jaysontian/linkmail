import React, { useState } from "react"

interface Props {
  onSignIn: (email: string, passkey: string) => void
}

const AuthView: React.FC<Props> = ({ onSignIn }) => {
  const [email, setEmail] = useState("")
  const [passkey, setPasskey] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !passkey) {
      setError("Please fill in both email and passkey")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      await onSignIn(email, passkey)
    } catch (error) {
      setError("Authentication failed. Please check your credentials.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div id="linkmail-signin">
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '20px 0px' }}>
          <h2 className="linkmail-header">Personalized Emails with AI</h2>
          <p>Sign in to generate and send personalized emails straight from LinkedIn</p>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            className="lm-input"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
          />
          
          <input
            type="password"
            className="lm-input"
            placeholder="Passkey"
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
            disabled={isLoading}
            required
          />
          
          {error && (
            <div style={{ color: '#e74c3c', fontSize: '12px', textAlign: 'center' }}>
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className="lm-btn" 
            disabled={isLoading}
            style={{ opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading ? (
              <>
                <div style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: '8px' }}>⏳</div>
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AuthView
