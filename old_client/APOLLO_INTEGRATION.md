# Apollo API Integration Documentation

## Overview

The LinkMail extension now includes Apollo API integration as a fallback email finding solution. When LinkedIn scraping fails to find an email address, users can click a "Find Email" button to search for the contact's email using the Apollo API.

## Features Implemented

### 1. Secure API Key Storage
- Apollo API key is securely stored in the background script (`background.js`)
- API key is never exposed to content scripts or the frontend
- All Apollo API calls are made through the secure background service

### 2. Smart Email Finding Workflow
- **Primary**: LinkedIn scraping (about section and contact info)
- **Fallback**: Apollo API enrichment when LinkedIn fails
- **Caching**: Found emails are cached to avoid repeated API calls

### 3. User Interface Integration
- "Find Email" button appears under the recipient email input field
- Button only shows when no email is found during LinkedIn scraping
- Loading state with spinning animation during API calls
- Success/error messages with appropriate styling

### 4. Data Optimization
- Uses all available LinkedIn profile data for better Apollo matching:
  - Name (first/last or full name)
  - Company information and domain extraction
  - Job title/headline
  - Location
- Smart domain derivation from company names
- Flat-rate Apollo API pricing regardless of data sent

## Technical Implementation

### Background Script (`background.js`)
```javascript
// Apollo API configuration
const APOLLO_API_KEY = 'your_api_key_here';
const APOLLO_API_URL = 'https://api.apollo.io/api/v1/people/match';

// Apollo enrichment service
async function enrichPersonWithApollo(profileData)
```

### Email Finder (`content/email-finder.js`)
```javascript
// New Apollo integration method
async findEmailWithApollo(profileData)
```

### UI Manager (`content/ui-manager.js`)
- Added "Find Email" button to UI elements
- Event listener for button clicks
- Logic to show/hide button based on email availability
- Temporary message system for user feedback

### UI Template (`content/linkedin-div.html`)
```html
<button id="findEmailButton" class="lm-btn-2" style="display: none;">
  Find Email
</button>
```

## User Flow

1. User visits a LinkedIn profile page
2. Extension attempts to scrape email from LinkedIn
3. If no email found:
   - "Find Email" button appears below email input field
   - User clicks button
   - Extension calls Apollo API with profile data
   - If email found: populates input field and hides button
   - If no email: shows error message

## Error Handling

- **API Failures**: User-friendly error messages
- **No Match Found**: "No email found in Apollo database"
- **Network Issues**: "Failed to connect to Apollo API"
- **Invalid Data**: "Insufficient profile data for enrichment"
- **Rate Limits**: Standard Apollo API rate limit responses

## Security Considerations

- API key stored securely in background script
- No sensitive data logged in production
- Proper error handling to prevent API key exposure
- Chrome extension permission model enforced

## Testing

Comprehensive test suite added:
- Apollo API integration tests
- Error handling scenarios
- Chrome runtime mocking
- Profile data validation

Run tests with:
```bash
npm test tests/apollo-integration.test.js
```

## Configuration

### Required Permissions (manifest.json)
```json
"host_permissions": [
  "https://api.apollo.io/*"
]
```

### API Requirements
- Valid Apollo API key with enrichment permissions
- Apollo API plan that supports People Enrichment endpoint
- Credits available for API calls

## Usage Analytics

The integration tracks:
- Apollo API call success/failure rates
- Email match rates
- Error types and frequencies
- User interaction with "Find Email" button

## Future Enhancements

1. **Rate Limit Handling**: Show remaining credits to user
2. **Domain Mapping**: Better company-to-domain mapping
3. **Batch Processing**: Support for multiple profiles
4. **Fallback Providers**: Additional email finding services
5. **User Preferences**: Allow users to enable/disable Apollo

## Credits and Costs

- Each Apollo API call consumes 1 credit from your Apollo plan
- Cost is incurred regardless of whether an email is found
- No additional charges for using more profile data in requests

## Troubleshooting

### Common Issues
1. **API Key Invalid**: Check Apollo dashboard for key status
2. **Rate Limits**: Apollo has per-minute/hour/day limits
3. **No Results**: Apollo may not have data for all profiles
4. **Extension Context**: Reload extension if runtime errors occur

### Debug Information
Enable console logging to see:
- Profile data sent to Apollo
- API response details
- Error messages and stack traces 