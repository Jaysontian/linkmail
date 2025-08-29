# LinkMail - LinkedIn to Gmail Bridge

## Overview

LinkMail is a Chrome extension that integrates with LinkedIn to find and send personalized emails to professionals. It uses AI-powered email generation; third-party people search integrations have been removed.

**⚠️ Important**: This extension now uses a backend service for OAuth and email sending to comply with Chrome Web Store policies and avoid Tier 2 CASA assessment requirements.

## Quick Start

### For Users
1. Install the Chrome extension
2. Visit any LinkedIn profile
3. Click the LinkMail icon to authenticate
4. Start sending personalized emails!

### For Developers
1. Deploy the backend service (see [BACKEND_MIGRATION_GUIDE.md](BACKEND_MIGRATION_GUIDE.md))
2. Update extension configuration with your backend URL
3. Load extension in Chrome for testing

## Architecture

```
Extension → LinkMail Backend → Gmail API
```

This architecture ensures:
- ✅ Chrome Web Store compliance
- ✅ Secure OAuth handling
- ✅ Scalable email management
- ✅ Cross-device synchronization

## Documentation

- [Backend Migration Guide](BACKEND_MIGRATION_GUIDE.md) - Complete deployment instructions
- [Testing Guide](TESTING.md) - How to test the extension
- [Backend Service README](backend-service/README.md) - Backend-specific documentation

## Features

- 🎯 **Smart Email Discovery** - Find professional email addresses
- ✍️ **AI Email Generation** - Personalized message creation
- 📧 **Gmail Integration** - Send emails directly from LinkedIn
- 📊 **Email History** - Track your outreach efforts
- 🔒 **Secure Authentication** - Backend-managed OAuth flow

## Getting Started

See [BACKEND_MIGRATION_GUIDE.md](BACKEND_MIGRATION_GUIDE.md) for complete setup instructions.
