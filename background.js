// background.js

// Backend authentication state management
let backendAuthState = {
  isAuthenticated: false,
  userData: null,
  token: null
};

// Apollo People Search integration for finding similar people - OPTIMIZED FOR SINGLE API CALL
async function findSimilarPeopleWithApollo(contactedPersonData, options = {}) {
  try {
    console.log('🚀 OPTIMIZED Apollo People Search - Finding similar people with SINGLE API call:', contactedPersonData);

    // Extract company domain and job title for searching
    const companyDomain = extractCompanyDomain(contactedPersonData.company);
    const jobTitle = normalizeJobTitle(contactedPersonData.headline);
    const normalizedCompanyName = normalizeCompanyName(contactedPersonData.company);

    console.log('=== OPTIMIZED APOLLO SEARCH DEBUG ===');
    console.log('Input data:', contactedPersonData);
    console.log('Extracted company domain:', companyDomain);
    console.log('Extracted job title:', jobTitle);
    console.log('Normalized company name:', normalizedCompanyName);

    const maxResults = typeof options.maxResults === 'number' && options.maxResults > 0 ? options.maxResults : 3;
    // Request more results in single call to increase chances of finding good matches
    const perPageForSearch = Math.max(10, maxResults * 3);

    // 🎯 SINGLE OPTIMIZED API CALL STRATEGY:
    // Instead of multiple API calls, make one smart call with broader criteria
    // then rank and filter results on client side to save Apollo credits
    
    let searchParams;
    let searchStrategy = 'unknown';
    
    if (companyDomain && jobTitle) {
      // Strategy 1: Company-focused search with broader title matching
      searchStrategy = 'company_focused';
      searchParams = {
        q_organization_domains_list: [companyDomain],
        organization_name: normalizedCompanyName || undefined,
        person_titles: [jobTitle], 
        include_similar_titles: true, // Cast wider net for similar roles
        per_page: perPageForSearch,
        page: 1
      };
      
      console.log(`🎯 Using COMPANY-FOCUSED strategy for domain: ${companyDomain}`);
      
    } else if (jobTitle) {
      // Strategy 2: Role-focused search (no company info available)
      searchStrategy = 'role_focused';
      searchParams = {
        person_titles: [jobTitle],
        include_similar_titles: true,
        per_page: perPageForSearch,
        page: 1
      };
      
      console.log(`🎯 Using ROLE-FOCUSED strategy for title: ${jobTitle}`);
      
    } else if (companyDomain) {
      // Strategy 3: Company-only search (no job title available)
      searchStrategy = 'company_only';
      searchParams = {
        q_organization_domains_list: [companyDomain],
        organization_name: normalizedCompanyName || undefined,
        per_page: perPageForSearch,
        page: 1
      };
      
      console.log(`🎯 Using COMPANY-ONLY strategy for domain: ${companyDomain}`);
      
    } else {
      // Strategy 4: Fallback - search by location or other criteria
      searchStrategy = 'fallback';
      console.log('❌ Insufficient data for targeted search - using fallback strategy');
      return {
        success: false,
        error: 'Insufficient profile data for finding similar people',
        source: 'apollo_people_search'
      };
    }
    
    // For major companies, add location filters to narrow results under Apollo's 50k limit
    const majorCompanies = ['google.com', 'microsoft.com', 'apple.com', 'meta.com', 'amazon.com', 'alphabet.com'];
    const isMajorCompany = majorCompanies.includes(companyDomain?.toLowerCase());
    
    if (isMajorCompany && (searchStrategy === 'company_focused' || searchStrategy === 'company_only')) {
      console.log(`🔍 Major company detected (${companyDomain}) - adding filters to narrow search`);
      
      // Add location filters to reduce result set size
      searchParams.person_locations = ['california', 'washington', 'new york', 'texas', 'massachusetts'];
      searchParams.person_seniorities = ['senior', 'entry', 'manager', 'director'];
      
      console.log('🔍 Applied major company filters to avoid 50k+ result limits');
    }

    console.log(`🔍 SINGLE API CALL with strategy "${searchStrategy}":`, JSON.stringify(searchParams, null, 2));
    
    // 🚀 MAKE SINGLE OPTIMIZED APOLLO API CALL
    const allResults = await searchPeopleWithCriteria(searchParams);
    
    console.log(`📡 Single API call returned ${allResults.length} total results`);

    // 🧠 CLIENT-SIDE INTELLIGENT RANKING AND FILTERING
    // Now rank all results by similarity instead of making multiple API calls
    
    // Filter out the original contacted person first
    const filteredResults = allResults.filter(person => {
      const isSame = isSameLinkedInProfile(person.linkedin_url, contactedPersonData.linkedinUrl);
      if (isSame) {
        console.log(`  ❌ Filtered out original person: ${person.name}`);
      }
      return !isSame;
    });
    
    console.log(`After filtering original person: ${filteredResults.length} results remain`);
    
    // Rank results by similarity score (client-side ranking instead of multiple API calls)
    const rankedResults = filteredResults.map(person => {
      let similarityScore = 0;
      let similarityReason = 'basic_match';
      
      const personCompanyDomain = person.organization?.primary_domain?.toLowerCase();
      const personCompanyName = person.organization?.name?.toLowerCase() || person.organization_name?.toLowerCase() || '';
      const personTitle = person.title?.toLowerCase() || '';
      const contactedCompanyLower = (contactedPersonData.company || '').toLowerCase();
      const jobTitleLower = (jobTitle || '').toLowerCase();
      
      // Highest priority: Same company AND similar role
      if (companyDomain && jobTitle) {
        const sameCompany = personCompanyDomain === companyDomain.toLowerCase() || 
                          personCompanyName.includes(contactedCompanyLower.split(' ')[0]) ||
                          contactedCompanyLower.includes(personCompanyName.split(' ')[0]);
        
        const similarRole = personTitle.includes(jobTitleLower) || 
                          jobTitleLower.includes(personTitle) ||
                          haveSimilarTitles(personTitle, jobTitleLower);
        
        if (sameCompany && similarRole) {
          similarityScore = 3;
          similarityReason = 'same_company_and_role';
        } else if (sameCompany) {
          similarityScore = 2;
          similarityReason = 'same_company';
        } else if (similarRole) {
          similarityScore = 1;
          similarityReason = 'same_role';
        }
      } else if (companyDomain) {
        // Company-only matching
        const sameCompany = personCompanyDomain === companyDomain.toLowerCase() || 
                          personCompanyName.includes(contactedCompanyLower.split(' ')[0]);
        if (sameCompany) {
          similarityScore = 2;
          similarityReason = 'same_company';
        }
      } else if (jobTitle) {
        // Role-only matching
        const similarRole = personTitle.includes(jobTitleLower) || 
                          jobTitleLower.includes(personTitle);
        if (similarRole) {
          similarityScore = 1;
          similarityReason = 'same_role';
        }
      }
      
      return {
        ...person,
        similarity_score: similarityScore,
        similarity_reason: similarityReason
      };
    });
    
    // Sort by similarity score (highest first), then by relevance
    const sortedResults = rankedResults
      .filter(person => person.similarity_score > 0) // Only include matches
      .sort((a, b) => {
        if (a.similarity_score !== b.similarity_score) {
          return b.similarity_score - a.similarity_score;
        }
        // Secondary sort by name for consistency
        return (a.name || '').localeCompare(b.name || '');
      });
    
    // Take top results based on maxResults
    const finalResults = sortedResults.slice(0, maxResults);
    
    console.log(`🏆 CLIENT-SIDE RANKING: ${sortedResults.length} valid matches, taking top ${finalResults.length}`);
    finalResults.forEach((person, index) => {
      console.log(`  ${index + 1}. ${person.name} - ${person.title} at ${person.organization?.name || person.organization_name} (${person.similarity_reason})`);
    });

    // Return the top suggestion with detailed logging
    const topSuggestion = finalResults.length > 0 ? finalResults[0] : null;
    
    console.log('=== FINAL OPTIMIZED RESULTS ===');
    console.log(`🎯 Single API call strategy: ${searchStrategy}`);
    console.log(`📊 Total API results: ${allResults.length}`);
    console.log(`🔍 Valid matches: ${sortedResults.length}`);
    console.log(`🏆 Final suggestions: ${finalResults.length}`);
    console.log(`💰 Apollo credits saved: ~${2}` + (isMajorCompany ? ' (major company filters applied)' : ''));

    // Create debug info to send back to UI  
    const debugInfo = {
      originalCompany: contactedPersonData.company,
      extractedDomain: companyDomain,
      originalJobTitle: contactedPersonData.headline,
      normalizedJobTitle: jobTitle,
      searchStrategy: searchStrategy,
      singleAPICall: {
        totalResults: allResults.length,
        validMatches: sortedResults.length,
        creditsSaved: '~2 API calls',
        optimization: 'Client-side ranking instead of multiple API calls'
      },
      finalSuggestions: finalResults.map(p => ({
        name: p.name,
        title: p.title,
        company: p.organization?.name || p.organization_name,
        reason: p.similarity_reason,
        score: p.similarity_score
      }))
    };

    // Check if we applied special filtering for major companies
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
      allSuggestions: finalResults.slice(0, 3),
      source: 'apollo_people_search',
      debug: debugInfo
    };

  } catch (error) {
    console.error('🚀 OPTIMIZED Apollo People Search error:', error);
    return {
      success: false,
      error: error.message || 'Failed to find similar people',
      source: 'apollo_people_search'
    };
  }
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
