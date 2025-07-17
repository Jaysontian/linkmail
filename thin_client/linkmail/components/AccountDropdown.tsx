import React, { useState } from "react"

interface Props {
  userEmail: string
  onSignOut: () => void
  onEditProfile: () => void
}

const AccountDropdown: React.FC<Props> = ({ userEmail, onSignOut, onEditProfile }) => {
  const [isOpen, setIsOpen] = useState(false)

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
  }

  const handleItemClick = (action: () => void) => {
    action()
    setIsOpen(false)
  }

  return (
    <div className="account-dropdown linkmail-account-info">
      <div className="account-dropdown-con">
        <p className="account-email">{userEmail}</p>
        <div className="dropdown-container">
          <button className="menu-toggle-btn" onClick={toggleDropdown}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="black" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1"/>
              <circle cx="19" cy="12" r="1"/>
              <circle cx="5" cy="12" r="1"/>
            </svg>
          </button>
          <div className={`dropdown-menu ${isOpen ? 'active' : ''}`}>
            <div className="dropdown-item" onClick={() => handleItemClick(onEditProfile)}>
              Edit Profile
            </div>
            <div className="dropdown-item" onClick={() => handleItemClick(onSignOut)}>
              Sign Out
            </div>
            <div className="dropdown-item">
              Settings
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountDropdown
