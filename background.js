// background.js

// Backend authentication state management
let backendAuthState = {
  isAuthenticated: false,
  userData: null,
  token: null
};

// Apollo People Search integration for finding similar people
async function findSimilarPeopleWithApollo(contactedPersonData, options = {}) {
  try {
    console.log('Finding similar people with Apollo People Search API (service worker context):', contactedPersonData);

    // Extract company domain and job title for searching
    const companyDomain = extractCompanyDomain(contactedPersonData.company);
    const jobTitle = normalizeJobTitle(contactedPersonData.headline);

    console.log('=== APOLLO PEOPLE SEARCH DEBUG ===');
    console.log('Input data:', contactedPersonData);
    console.log('Extracted company domain:', companyDomain);
    console.log('Extracted job title:', jobTitle);
    console.log('Original company name:', contactedPersonData.company);
    console.log('Original headline:', contactedPersonData.headline);

    // Skip access test to save 1 API call per search - will fail gracefully if no access
    console.log('🔐 Skipping access test to save Apollo credits - will fail gracefully if no access');

    // Quick test: Let's try multiple Apollo API calls to understand the issue
    // Removed test calls to reduce Apollo API usage

    const similarPeople = [];
    const maxResults = typeof options.maxResults === 'number' && options.maxResults > 0 ? options.maxResults : 3;
    const perPageForSearch = maxResults === 1 ? 1 : 5;
    let foundSameCompanyAndRole = [];
    let foundSameCompanyOnly = [];
    let foundSameRoleOnly = [];

    // 1. PRIORITY 1: Same company AND same role (highest similarity)
    if (companyDomain && jobTitle) {
      console.log(`\n🎯 PRIORITY 1: Searching for same company (${companyDomain}) AND same role (${jobTitle})`);
      
      // For major companies, add additional filters to narrow results under Apollo's 50k limit
      const isMajorCompany = ['google.com', 'microsoft.com', 'apple.com', 'meta.com', 'amazon.com'].includes(companyDomain?.toLowerCase());
      
      const normalizedCompanyName = normalizeCompanyName(contactedPersonData.company);

      const searchParams = {
        q_organization_domains_list: [companyDomain],
        organization_name: normalizedCompanyName || undefined,
        person_titles: [jobTitle],
        include_similar_titles: true,
        per_page: perPageForSearch,
        page: 1
      };
      
      // Add additional filters for major companies to narrow results
      if (isMajorCompany) {
        console.log(`🔍 Major company detected (${companyDomain}) - adding filters to narrow search`);
        
        // Add location filters (major tech hubs)
        searchParams.person_locations = ['california', 'washington', 'new york', 'texas'];
        
        // Add seniority filters (exclude very senior roles to get more contacts)
        searchParams.person_seniorities = ['senior', 'entry', 'manager'];
        
        // Reduce similar titles for more precise matching
        searchParams.include_similar_titles = false;
        
        console.log('🔍 Added major company filters:', {
          locations: searchParams.person_locations,
          seniorities: searchParams.person_seniorities,
          similar_titles: searchParams.include_similar_titles
        });
      }
      
      console.log('Search parameters:', JSON.stringify(searchParams, null, 2));
      
      foundSameCompanyAndRole = await searchPeopleWithCriteria(searchParams);
      
      console.log(`Raw API response: ${foundSameCompanyAndRole.length} people found`);
      
      // Log first few API results to understand what we're getting
      if (foundSameCompanyAndRole.length > 0) {
        console.log('📋 First few API results:');
        foundSameCompanyAndRole.slice(0, 3).forEach((person, index) => {
          console.log(`  ${index + 1}. ${person.name} - ${person.title} at ${person.organization?.name || person.organization_name}`);
          console.log(`     Domain: ${person.organization?.primary_domain || 'N/A'}`);
          console.log(`     LinkedIn: ${person.linkedin_url || 'N/A'}`);
        });
        
        // Filter out the original contacted person
        const filtered = foundSameCompanyAndRole.filter(person => {
          const isSame = isSameLinkedInProfile(person.linkedin_url, contactedPersonData.linkedinUrl);
          if (isSame) {
            console.log(`  ❌ Filtered out original person: ${person.name}`);
          }
          return !isSame;
        });
        
        console.log(`After filtering original person: ${filtered.length} people remain`);
        
        const neededCountP1 = Math.max(0, maxResults - similarPeople.length);
        const toAdd = filtered.slice(0, neededCountP1);
        similarPeople.push(...toAdd.map(person => ({
          ...person,
          similarity_reason: 'same_company_and_role',
          similarity_score: 3
        })));
        
        console.log(`✅ Added ${toAdd.length} people with same company and role`);
        toAdd.forEach((person, index) => {
          console.log(`  ${index + 1}. ${person.name} - ${person.title} at ${person.organization?.name || person.organization_name}`);
        });
      } else {
        console.log(`❌ No people found with same company and role for domain: ${companyDomain}`);
        console.log(`❌ This suggests either:`);
        console.log(`   1. Apollo has no employees for domain "${companyDomain}"`);
        console.log(`   2. The API request failed silently`);
        console.log(`   3. The search parameters are incorrect`);
        console.log(`   4. Apollo plan restricts access to major company employees`);
      }
    } else {
      console.log(`❌ Skipping priority 1 search - missing companyDomain (${companyDomain}) or jobTitle (${jobTitle})`);
    }

    // Early exit if we have enough results after Priority 1
    if (similarPeople.length >= maxResults) {
      console.log(`✅ Early exit: Found ${similarPeople.length} results after Priority 1, skipping remaining searches to save Apollo credits`);
    } else {
      // 2. PRIORITY 2: Same company only (if we need more suggestions)
      if (companyDomain && similarPeople.length < maxResults) {
      console.log(`Searching for people with same company only (${companyDomain})...`);
      
      const normalizedCompanyNameP2 = normalizeCompanyName(contactedPersonData.company);

      const searchParams = {
        q_organization_domains_list: [companyDomain],
        organization_name: normalizedCompanyNameP2 || undefined,
        per_page: perPageForSearch,
        page: 1
      };
      
      // Add additional filters for major companies to narrow results
      const isMajorCompany = ['google.com', 'microsoft.com', 'apple.com', 'meta.com', 'amazon.com'].includes(companyDomain?.toLowerCase());
      if (isMajorCompany) {
        console.log(`🔍 Major company detected (${companyDomain}) - adding filters for P2 search`);
        
        // Add location and seniority filters
        searchParams.person_locations = ['california', 'washington', 'new york', 'texas'];
        searchParams.person_seniorities = ['senior', 'entry', 'manager', 'director'];
        
        console.log('🔍 Added P2 major company filters');
      }
      
      foundSameCompanyOnly = await searchPeopleWithCriteria(searchParams);

      console.log(`Found ${foundSameCompanyOnly.length} people at same company`);

      // Filter out people with the same job title (already found above) and original person
      const filtered = foundSameCompanyOnly.filter(person => {
        // Exclude the original contacted person
        if (isSameLinkedInProfile(person.linkedin_url, contactedPersonData.linkedinUrl)) {
          return false;
        }
        
        // Exclude people with the same job title that we already found
        if (jobTitle && person.title) {
          const personTitleLower = person.title.toLowerCase();
          const jobTitleLower = jobTitle.toLowerCase();
          // More sophisticated title matching
          if (personTitleLower.includes(jobTitleLower) || jobTitleLower.includes(personTitleLower)) {
            return false;
          }
        }
        
        return true;
      });

      const neededCount = Math.max(0, maxResults - similarPeople.length);
      if (filtered.length > 0 && neededCount > 0) {
        similarPeople.push(...filtered.slice(0, neededCount).map(person => ({
          ...person,
          similarity_reason: 'same_company',
          similarity_score: 2
        })));
        
        console.log(`Added ${Math.min(filtered.length, neededCount)} people with same company only`);
      }
      }

      // 3. PRIORITY 3: Same role only (if we still need more suggestions)
      if (jobTitle && similarPeople.length < maxResults) {
      console.log(`Searching for people with same role only (${jobTitle})...`);
      foundSameRoleOnly = await searchPeopleWithCriteria({
        person_titles: [jobTitle],
        include_similar_titles: true,
        per_page: perPageForSearch,
        page: 1
      });

      console.log(`Found ${foundSameRoleOnly.length} people with same role`);

      // Filter out people from the same company (already found above) and original person
      const filtered = foundSameRoleOnly.filter(person => {
        // Exclude the original contacted person
        if (isSameLinkedInProfile(person.linkedin_url, contactedPersonData.linkedinUrl)) {
          return false;
        }
        
        // Exclude people from the same company (already found above)
        if (companyDomain && person.organization && person.organization.primary_domain) {
          if (person.organization.primary_domain.toLowerCase() === companyDomain.toLowerCase()) {
            return false;
          }
        }
        
        // Also check organization_name for broader company matching
        if (companyDomain && person.organization_name) {
          const personCompanyLower = person.organization_name.toLowerCase();
          const contactedCompanyLower = (contactedPersonData.company || '').toLowerCase();
          if (personCompanyLower === contactedCompanyLower) {
            return false;
          }
        }
        
        return true;
      });

      const neededCount = Math.max(0, maxResults - similarPeople.length);
      if (filtered.length > 0 && neededCount > 0) {
        similarPeople.push(...filtered.slice(0, neededCount).map(person => ({
          ...person,
          similarity_reason: 'same_role',
          similarity_score: 1
        })));
        
        console.log(`Added ${Math.min(filtered.length, neededCount)} people with same role only`);
      }
      }
    }

    // Final deduplication (just in case)
    const uniquePeople = deduplicateAndSort(similarPeople, contactedPersonData.linkedinUrl);
    
    // Return the top suggestion with detailed logging
    const topSuggestion = uniquePeople.length > 0 ? uniquePeople[0] : null;
    
    console.log('=== FINAL SIMILARITY RESULTS ===');
    console.log(`Total unique suggestions: ${uniquePeople.length}`);
    uniquePeople.forEach((person, index) => {
      console.log(`${index + 1}. ${person.name} - ${person.title} at ${person.organization?.name || person.organization_name} (${person.similarity_reason})`);
    });

    console.log('Found similar people:', uniquePeople.length, 'Top suggestion:', topSuggestion);

    // Create debug info to send back to UI
    const debugInfo = {
      originalCompany: contactedPersonData.company,
      extractedDomain: companyDomain,
      originalJobTitle: contactedPersonData.headline,
      normalizedJobTitle: jobTitle,
      searchResults: {
        sameCompanyAndRole: foundSameCompanyAndRole.length,
        sameCompanyOnly: foundSameCompanyOnly.length,
        sameRoleOnly: foundSameRoleOnly.length
      },
      finalSuggestions: uniquePeople.map(p => ({
        name: p.name,
        title: p.title,
        company: p.organization?.name || p.organization_name,
        reason: p.similarity_reason
      }))
    };

    // Check if we applied special filtering for major companies
    const majorCompanies = ['google.com', 'microsoft.com', 'apple.com', 'meta.com', 'amazon.com', 'alphabet.com'];
    const isMajorCompany = majorCompanies.includes(companyDomain?.toLowerCase());
    
    if (isMajorCompany) {
      console.log(`📊 Applied major company filtering for: ${companyDomain}`);
      debugInfo.majorCompanyFiltering = {
        applied: true,
        company: companyDomain,
        reason: 'Added location and seniority filters to narrow Apollo search results'
      };
    }

    return {
      success: true,
      suggestion: topSuggestion,
      allSuggestions: uniquePeople.slice(0, 3),
      source: 'apollo_people_search',
      debug: debugInfo
    };

  } catch (error) {
    console.error('Apollo People Search error:', error);
    return {
      success: false,
      error: error.message || 'Failed to find similar people',
      source: 'apollo_people_search'
    };
  }
}

// Helper function to test if API key has access to People Search endpoint
async function testPeopleSearchAccess() {
  try {
    console.log('🧪 Testing People Search API access...');
    
    // Make a minimal test request to check access
    const testParams = {
      per_page: 1,
      page: 1
    };

    console.log('🧪 Test request params:', testParams);

    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': 'Z8v_SYe2ByFcVLF3H1bfiA',
        'Accept': 'application/json'
      },
      body: JSON.stringify(testParams)
    });

    console.log(`🧪 Test response status: ${response.status} ${response.statusText}`);

    // Read response text once
    const responseText = await response.text();
    console.log('🧪 Test response preview:', responseText.substring(0, 200));

    // Check if we get a 403 access denied error
    if (response.status === 403) {
      try {
        const errorData = JSON.parse(responseText);
        console.log('🧪 403 error data:', errorData);
        if (errorData.error && errorData.error.includes('not accessible with this api_key')) {
          console.log('❌ People Search API access denied - requires paid plan');
          return false;
        }
      } catch (e) {
        console.log('🧪 Could not parse 403 error response as JSON');
      }
    }

    // If we get here, we have access (200, or other non-403 error)
    console.log('✅ People Search API access confirmed');
    return true;

  } catch (error) {
    console.error('❌ Error testing People Search API access:', error);
    // On network error, assume we don't have access to be safe
    return false;
  }
}

// Helper function to search people with specific criteria
async function searchPeopleWithCriteria(searchParams) {
  try {
    console.log('🔍 Making Apollo API request...');
    console.log('URL: https://api.apollo.io/api/v1/mixed_people/search');
    console.log('Headers: Content-Type: application/json, x-api-key: Z8v_S... (truncated)');
    console.log('Body:', JSON.stringify(searchParams, null, 2));
    
    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': 'Z8v_SYe2ByFcVLF3H1bfiA',
        'Accept': 'application/json'
      },
      body: JSON.stringify(searchParams)
    });

    console.log(`📡 Apollo API response status: ${response.status} ${response.statusText}`);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Read response text once to avoid stream consumption issues
    const responseText = await response.text();
    console.log('📄 Raw response text length:', responseText.length);
    console.log('📄 Raw response preview:', responseText.substring(0, 200) + '...');

    if (!response.ok) {
      let errorText;
      try {
        const errorData = JSON.parse(responseText);
        errorText = JSON.stringify(errorData, null, 2);
        console.error('❌ Apollo API error response (JSON):', errorData);
      } catch (e) {
        errorText = responseText;
        console.error('❌ Apollo API error response (text):', errorText);
      }
      throw new Error(`Apollo People Search API failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✅ Successfully parsed JSON response');
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response:', parseError);
      console.error('❌ Raw response text:', responseText);
      throw new Error(`Failed to parse Apollo API response as JSON: ${parseError.message}`);
    }

    const people = Array.isArray(data.people) ? data.people : [];
    const contacts = Array.isArray(data.contacts) ? data.contacts : [];
    const combined = [...people, ...contacts];
    console.log(`📊 Apollo API returned ${people.length} global people and ${contacts.length} saved contacts (combined: ${combined.length})`);
    console.log('Response structure:', {
      hasPeople: !!data.people,
      peopleLength: people.length,
      hasContacts: !!data.contacts,
      contactsLength: contacts.length,
      hasPagination: !!data.pagination,
      totalEntries: data.pagination?.total_entries,
      keys: Object.keys(data)
    });

    return combined;

  } catch (error) {
    console.error('❌ Error in searchPeopleWithCriteria:', error);
    console.error('❌ Error stack:', error.stack);
    return [];
  }
}

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

// Helper to normalize raw company string to a clean organization_name for Apollo
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

// Apollo API integration - delegate to ApolloClient module
// Note: In a real backend migration, this would be moved to linkmail-web
async function enrichPersonWithApollo(profileData) {
  // Delegate to the ApolloClient module if available
  if (typeof window !== 'undefined' && window.ApolloClient) {
    return await window.ApolloClient.enrichPerson(profileData);
  } else {
    // Fallback implementation for service worker context
    // This code will eventually be moved to linkmail-web backend
    try {
      console.log('Enriching person with Apollo API (service worker context):', profileData);

      const requestBody = {};

      // Use name data
      if (profileData.firstName && profileData.lastName) {
        requestBody.first_name = profileData.firstName;
        requestBody.last_name = profileData.lastName;
      } else if (profileData.name) {
        requestBody.name = profileData.name;
      }

      // Add LinkedIn profile URL for better matching if available
      if (profileData.linkedinUrl) {
        requestBody.linkedin_url = profileData.linkedinUrl.split('?')[0]; // Remove query parameters
      }

      // Use company data to improve matching
      if (profileData.company) {
        const companyName = profileData.company.toLowerCase();
        let domain = '';
        if (companyName.includes('.com') || companyName.includes('.org') || companyName.includes('.net')) {
          const domainMatch = companyName.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (domainMatch) {
            domain = domainMatch[1];
          }
        } else {
          const cleanCompany = companyName
            .replace(/\s+(inc|inc\.|llc|ltd|limited|corp|corporation|company|co\.).*$/i, '')
            .replace(/[^a-zA-Z0-9]/g, '');
          if (cleanCompany) {
            domain = `${cleanCompany}.com`;
          }
        }

        if (domain) {
          requestBody.domain = domain;
        }
        requestBody.organization_name = profileData.company;
      }

      if (profileData.location) {
        requestBody.location = profileData.location;
      }

      if (profileData.headline) {
        requestBody.title = profileData.headline;
      }

      requestBody.reveal_personal_emails = true;
      requestBody.reveal_phone_number = false;

      const response = await fetch('https://api.apollo.io/api/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': 'Z8v_SYe2ByFcVLF3H1bfiA',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = errorData.message || errorData.error || JSON.stringify(errorData);
        } catch (e) {
          errorText = await response.text();
        }
        throw new Error(`Apollo API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.person && data.person.email) {
        return {
          success: true,
          email: data.person.email,
          source: 'apollo',
          person: data.person
        };
      } else {
        return {
          success: false,
          error: 'No email found in Apollo database',
          source: 'apollo'
        };
      }

    } catch (error) {
      console.error('Apollo API error:', error);
      return {
        success: false,
        error: error.message || 'Failed to enrich person data',
        source: 'apollo'
      };
    }
  }
}

// Test Apollo API key functionality - delegate to ApolloClient module
async function testApolloAPIKey() {
  // Delegate to the ApolloClient module if available
  if (typeof window !== 'undefined' && window.ApolloClient) {
    return await window.ApolloClient.testApiKey();
  } else {
    // Fallback test for service worker context
    try {
      const testProfile = {
        firstName: 'John',
        lastName: 'Doe',
        company: 'Google'
      };
      
      const result = await enrichPersonWithApollo(testProfile);
      console.log('Apollo API test result:', result);
      return result.success !== false; // Return true unless explicitly failed
    } catch (error) {
      console.error('Apollo API test failed:', error);
      return false;
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Email Scraper Extension installed.');
  // Test Apollo API on installation
  testApolloAPIKey();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started.');
  // Test Apollo API on startup
  testApolloAPIKey();
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

  // Handle Apollo API enrichment
  else if (request.action === 'enrichWithApollo') {
    enrichPersonWithApollo(request.profileData)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('Error in Apollo enrichment:', error);
        sendResponse({
          success: false,
          error: 'Failed to enrich person data',
          source: 'apollo'
        });
      });
    return true; // Required for async response
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

  // Test Apollo API key
  else if (request.action === 'testApolloAPI') {
    testApolloAPIKey()
      .then(result => {
        sendResponse({ success: result });
      })
      .catch(error => {
        console.error('Error testing Apollo API:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }

  // Handle Apollo People Search for finding similar people
  else if (request.action === 'findSimilarPeople') {
    findSimilarPeopleWithApollo(request.contactedPersonData, request.options || {})
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        console.error('Error in finding similar people:', error);
        sendResponse({
          success: false,
          error: 'Failed to find similar people',
          source: 'apollo_people_search'
        });
      });
    return true; // Required for async response
  }
});
