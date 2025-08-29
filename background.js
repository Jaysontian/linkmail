// background.js

// Backend authentication state management
let backendAuthState = {
  isAuthenticated: false,
  userData: null,
  token: null
};

// Similar People Search (external API) - disabled
async function findSimilarPeopleWithApollo(contactedPersonData, options = {}) {
  console.log('Similar People Search is disabled.');
  return { success: false, error: 'Similar people search disabled', source: 'similar_people' };
}

// Helper function to check if two job titles are similar
function haveSimilarTitles(title1, title2) {
  if (!title1 || !title2) return false;
  
  const t1 = title1.toLowerCase();
  const t2 = title2.toLowerCase();
  
  // Common title synonyms
  const synonyms = {
    'engineer': ['developer', 'programmer', 'coder'],
    'developer': ['engineer', 'programmer', 'coder'],
    'manager': ['lead', 'director', 'head'],
    'lead': ['manager', 'senior', 'principal'],
    'senior': ['lead', 'principal'],
    'principal': ['senior', 'lead', 'staff'],
    'product': ['pm', 'product manager'],
    'marketing': ['mktg', 'growth'],
    'sales': ['business development', 'account executive', 'bd']
  };
  
  // Check for synonym matches
  for (const [key, values] of Object.entries(synonyms)) {
    if (t1.includes(key) && values.some(v => t2.includes(v))) return true;
    if (t2.includes(key) && values.some(v => t1.includes(v))) return true;
  }
  
  return false;
}

// Helper function to test if API key has access to People Search endpoint
async function testPeopleSearchAccess() { return false; }

// Helper function to search people with specific criteria
async function searchPeopleWithCriteria() { return []; }

// Helper function to extract company domain
function extractCompanyDomain(companyName) {
  if (!companyName) return '';

  let cleanCompany = companyName.toLowerCase().trim();
  
  // Fix common LinkedIn scraping issues
  console.log(`🔧 Before cleanup: "${cleanCompany}"`);
  
  // Remove "· Full-time", "· Part-time", etc.
  cleanCompany = cleanCompany.replace(/\s*·\s*(full-time|part-time|contract|freelance|internship)/gi, '');
  console.log(`🔧 After removing employment type: "${cleanCompany}"`);
  
  // Handle the specific case of concatenated duplicate company names (e.g., "GoogleGoogle" -> "Google")
  // First, try to split by common patterns that might separate duplicates
  let cleanedWords = cleanCompany.split(/\s+/).filter(word => word.length > 0);
  console.log(`🔧 Split into words:`, cleanedWords);
  
  // Check for the pattern where the same word appears consecutively (including concatenated)
  const finalWords = [];
  for (let i = 0; i < cleanedWords.length; i++) {
    const currentWord = cleanedWords[i];
    
    // Check if this word contains a repeated pattern (e.g., "GoogleGoogle")
    if (currentWord.length > 6) { // Only check longer words
      const half = Math.floor(currentWord.length / 2);
      const firstHalf = currentWord.substring(0, half);
      const secondHalf = currentWord.substring(half);
      
      if (firstHalf.toLowerCase() === secondHalf.toLowerCase() && firstHalf.length > 2) {
        console.log(`🔧 Found repeated pattern in "${currentWord}": "${firstHalf}" + "${secondHalf}" -> using "${firstHalf}"`);
        finalWords.push(firstHalf);
        continue;
      }
    }
    
    // Also check if the current word is the same as the previous word
    if (finalWords.length > 0 && finalWords[finalWords.length - 1].toLowerCase() === currentWord.toLowerCase()) {
      console.log(`🔧 Skipping duplicate word: "${currentWord}"`);
      continue;
    }
    
    finalWords.push(currentWord);
  }
  
  cleanCompany = finalWords.join(' ').trim();
  console.log(`🔧 After deduplication: "${cleanCompany}"`);

  // Collapse exact duplicated halves (e.g., "bain capital venturesbain capital ventures")
  if (cleanCompany.length % 2 === 0) {
    const halfLen = cleanCompany.length / 2;
    const firstHalf = cleanCompany.substring(0, halfLen);
    const secondHalf = cleanCompany.substring(halfLen);
    if (firstHalf === secondHalf) {
      cleanCompany = firstHalf.trim();
      console.log(`🔧 Collapsed duplicated halves to: "${cleanCompany}"`);
    }
  }

  // Known company domain mappings for major companies
  const companyDomainMap = {
    'google': 'google.com',
    'alphabet': 'google.com',
    'alphabet inc': 'google.com',
    'alphabet inc.': 'google.com',
    'google llc': 'google.com',
    'microsoft': 'microsoft.com',
    'microsoft corporation': 'microsoft.com',
    'apple': 'apple.com',
    'apple inc': 'apple.com',
    'apple inc.': 'apple.com',
    'amazon': 'amazon.com',
    'amazon.com': 'amazon.com',
    'amazon web services': 'amazon.com',
    'aws': 'amazon.com',
    'meta': 'meta.com',
    'facebook': 'meta.com',
    'meta platforms': 'meta.com',
    'netflix': 'netflix.com',
    'tesla': 'tesla.com',
    'tesla inc': 'tesla.com',
    'salesforce': 'salesforce.com',
    'adobe': 'adobe.com',
    'oracle': 'oracle.com',
    'ibm': 'ibm.com',
    'uber': 'uber.com',
    'airbnb': 'airbnb.com',
    'linkedin': 'linkedin.com',
    'twitter': 'twitter.com',
    'x corp': 'twitter.com',
    'spotify': 'spotify.com',
    'slack': 'slack.com',
    'zoom': 'zoom.us',
    'dropbox': 'dropbox.com',
    'shopify': 'shopify.com',
    'square': 'squareup.com',
    'stripe': 'stripe.com',
    'atlassian': 'atlassian.com',
    'github': 'github.com',
    'gitlab': 'gitlab.com',
    'docker': 'docker.com',
    'redis': 'redis.com',
    'mongodb': 'mongodb.com'
  };
  // Additional mappings for VC firms and others
  companyDomainMap['bain capital ventures'] = 'baincapitalventures.com';

  // First check if it's a known company
  const companyKey = cleanCompany.replace(/\s+(inc|inc\.|llc|ltd|limited|corp|corporation|company|co\.|gmbh|ag|sa).*$/i, '').trim();
  console.log(`🏢 Company domain extraction for: "${companyName}"`);
  console.log(`🏢 Cleaned company: "${cleanCompany}"`);
  console.log(`🏢 Company key: "${companyKey}"`);
  console.log(`🏢 Available mappings:`, Object.keys(companyDomainMap).slice(0, 10));
  
  if (companyDomainMap[companyKey]) {
    console.log(`✅ Found known company domain mapping: ${companyKey} -> ${companyDomainMap[companyKey]}`);
    return companyDomainMap[companyKey];
  } else {
    console.log(`❌ No mapping found for company key: "${companyKey}"`);
  }

  // If company name already contains domain info
  if (cleanCompany.includes('.com') || cleanCompany.includes('.org') || cleanCompany.includes('.net') || cleanCompany.includes('.io')) {
    const domainMatch = cleanCompany.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (domainMatch) {
      console.log(`Extracted domain from company name: ${domainMatch[1]}`);
      return domainMatch[1];
    }
  }

  // Try common patterns for domain derivation
  const normalizedCompany = cleanCompany
    .replace(/\s+(inc|inc\.|llc|ltd|limited|corp|corporation|company|co\.|gmbh|ag|sa).*$/i, '')
    .replace(/[^a-zA-Z0-9]/g, '');

  if (normalizedCompany && normalizedCompany.length > 1) {
    const derivedDomain = `${normalizedCompany}.com`;
    console.log(`Derived domain for ${companyName}: ${derivedDomain}`);
    return derivedDomain;
  }

  console.log(`Could not extract domain for company: ${companyName}`);
  return '';
}

// Helper function to normalize job title
function normalizeJobTitle(headline) {
  if (!headline) return '';

  let title = headline;
  // Remove company information (typically after "at" or "@")
  title = title.split(' at ')[0];
  title = title.split(' @ ')[0];
  title = title.split('|')[0]; // Remove secondary info after pipe

  // Clean up and normalize
  title = title.trim();

  // Normalize common title variations to improve matching
  const titleNormalizations = {
    // Software Engineering variations
    'software engineer': ['software engineer', 'software developer', 'swe', 'developer', 'engineer'],
    'software developer': ['software engineer', 'software developer', 'swe', 'developer', 'engineer'],
    'senior software engineer': ['senior software engineer', 'senior software developer', 'senior swe', 'sr software engineer', 'sr. software engineer'],
    'senior software developer': ['senior software engineer', 'senior software developer', 'senior swe', 'sr software engineer', 'sr. software engineer'],
    'frontend engineer': ['frontend engineer', 'frontend developer', 'front-end engineer', 'front-end developer', 'fe engineer'],
    'backend engineer': ['backend engineer', 'backend developer', 'back-end engineer', 'back-end developer', 'be engineer'],
    'full stack engineer': ['full stack engineer', 'full stack developer', 'fullstack engineer', 'fullstack developer'],
    
    // Product Management variations
    'product manager': ['product manager', 'pm', 'product mgr'],
    'senior product manager': ['senior product manager', 'senior pm', 'sr product manager', 'sr. product manager'],
    'principal product manager': ['principal product manager', 'principal pm', 'staff product manager'],
    
    // Data Science variations
    'data scientist': ['data scientist', 'data analyst', 'data engineer', 'ml engineer'],
    'senior data scientist': ['senior data scientist', 'senior data analyst', 'senior data engineer', 'sr data scientist'],
    
    // Marketing variations
    'marketing manager': ['marketing manager', 'marketing mgr', 'mktg manager', 'marketing lead'],
    'product marketing manager': ['product marketing manager', 'pmm', 'product marketing mgr'],
    
    // Sales variations
    'sales manager': ['sales manager', 'sales mgr', 'account manager', 'sales lead'],
    'account executive': ['account executive', 'ae', 'sales executive'],
    
    // Design variations
    'ux designer': ['ux designer', 'user experience designer', 'product designer', 'ui/ux designer'],
    'ui designer': ['ui designer', 'user interface designer', 'visual designer'],
    'product designer': ['product designer', 'ux designer', 'ui/ux designer'],
    
    // Business Development
    'business development': ['business development', 'bd', 'biz dev', 'business dev'],
    
    // Operations
    'operations manager': ['operations manager', 'ops manager', 'operations mgr'],
    'devops engineer': ['devops engineer', 'devops', 'platform engineer', 'infrastructure engineer']
  };

  const titleLower = title.toLowerCase();
  
  // Find the best normalized title
  for (const [canonical, variations] of Object.entries(titleNormalizations)) {
    if (variations.some(variation => 
      titleLower.includes(variation) || variation.includes(titleLower)
    )) {
      console.log(`💼 Normalized job title: "${title}" -> "${canonical}"`);
      return canonical;
    }
  }

  console.log(`💼 Using original job title: "${title}"`);
  return title;
}

// Helper to normalize raw company string to a clean organization_name
function normalizeCompanyName(companyName) {
  if (!companyName) return '';
  let cleaned = companyName.toLowerCase();
  // Remove employment type artifacts and extra whitespace
  cleaned = cleaned.replace(/\s*·\s*(full-time|part-time|contract|freelance|internship)/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // Collapse duplicated halves like "acme corpacme corp"
  if (cleaned.length % 2 === 0) {
    const half = cleaned.length / 2;
    const a = cleaned.substring(0, half);
    const b = cleaned.substring(half);
    if (a === b) cleaned = a.trim();
  }
  // Remove corporate suffixes
  cleaned = cleaned.replace(/\s+(inc|inc\.|llc|ltd|limited|corp|corporation|company|co\.|gmbh|ag|sa)$/i, '').trim();
  // Title case back for nicer matching
  cleaned = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return cleaned;
}

// Helper function to deduplicate and sort people
function deduplicateAndSort(people, excludeLinkedInUrl) {
  // Filter out the originally contacted person
  const filtered = people.filter(person => {
    if (excludeLinkedInUrl && person.linkedin_url) {
      return !isSameLinkedInProfile(person.linkedin_url, excludeLinkedInUrl);
    }
    return true;
  });

  // Remove duplicates based on LinkedIn URL
  const seen = new Set();
  const unique = filtered.filter(person => {
    const key = person.linkedin_url || person.id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  // Sort by similarity score (highest first), then by name
  return unique.sort((a, b) => {
    if (a.similarity_score !== b.similarity_score) {
      return b.similarity_score - a.similarity_score;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

// Helper function to check if two LinkedIn URLs are the same
function isSameLinkedInProfile(url1, url2) {
  if (!url1 || !url2) return false;

  const extractProfileId = (url) => {
    const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/i);
    return match ? match[1].toLowerCase() : null;
  };

  const id1 = extractProfileId(url1);
  const id2 = extractProfileId(url2);

  return id1 && id2 && id1 === id2;
}

// Apollo enrichment removed
async function enrichPersonWithApollo() {
  return { success: false, error: 'Apollo removed' };
}

// Apollo API key test removed
async function testApolloAPIKey() { return false; }

chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Email Scraper Extension installed.');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuthStatus') {
    // Check backend auth status
    chrome.storage.local.get(['backendToken', 'backendUserData'], (result) => {
      sendResponse({
        isAuthenticated: !!result.backendToken,
        userData: result.backendUserData
      });
    });
    return true;
  }

  else if (request.action === 'openAuthPage') {
    // Open the backend authentication page
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  }

  else if (request.action === 'completeBackendAuth') {
    // Store backend authentication data
    const { token, userData } = request;
    chrome.storage.local.set({
      backendToken: token,
      backendUserData: userData
    }, () => {
      backendAuthState.isAuthenticated = true;
      backendAuthState.userData = userData;
      backendAuthState.token = token;
      
      sendResponse({ success: true });
    });
    return true;
  }

  // Apollo enrichment removed
  else if (request.action === 'enrichWithApollo') {
    sendResponse({ success: false, error: 'Apollo removed' });
    return true;
  }

  // Backend logout functionality
  else if (request.action === 'logout') {
    // Clear backend auth data
    chrome.storage.local.remove(['backendToken', 'backendUserData'], () => {
      backendAuthState.isAuthenticated = false;
      backendAuthState.userData = null;
      backendAuthState.token = null;
      sendResponse({ success: true });
    });
    return true;
  }

  // Handle opening the bio setup page
  else if (request.action === 'openBioSetupPage') {
    chrome.tabs.create({ url: request.url }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true; // Required for async response
  }

  // Apollo API test removed
  else if (request.action === 'testApolloAPI') {
    sendResponse({ success: false });
    return true;
  }

  // Similar people search removed
  else if (request.action === 'findSimilarPeople') {
    sendResponse({ success: false, error: 'Similar people search disabled' });
    return true;
  }
});
