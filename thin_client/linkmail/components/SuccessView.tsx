import React from "react"

interface Props {
  onBackToSplash: () => void
}

const SuccessView: React.FC<Props> = ({ onBackToSplash }) => {
  return (
    <div id="linkmail-success">
      <h2 className="linkmail-header">Email sent successfully!</h2>
      <br />
      <a 
        className="lm-btn" 
        href="https://mail.google.com/mail/u/0/#sent" 
        target="_blank" 
        style={{ 
          width: 'fit-content', 
          color: 'white !important', 
          textDecoration: 'none !important',
          marginBottom: '12px'
        }}
      >
        Check in Gmail
      </a>
      <button className="lm-btn-2" onClick={onBackToSplash}>
        Send Another Email
      </button>
    </div>
  )
}

export default SuccessView
