/**
 * API retry utility with exponential backoff
 */
export const apiRetry = async (apiCall, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      // If it's a 429 error and we have retries left, wait and retry
      if (error.response?.status === 429 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000; // Add jitter
        console.warn(`Rate limited. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If it's not a 429 error or we've exhausted retries, throw the error
      throw error;
    }
  }
};

/**
 * Request deduplication cache
 */
const requestCache = new Map();
const CACHE_DURATION = 0; // Disable caching for analytics data to ensure fresh data

export const deduplicateRequest = (key, apiCall) => {
  const now = Date.now();
  
  // Check if we have a recent request for this key
  if (requestCache.has(key)) {
    const cached = requestCache.get(key);
    if (now - cached.timestamp < CACHE_DURATION) {
      console.log(`Using cached request for ${key}`);
      return cached.promise;
    }
  }
  
  // Create new request
  const promise = apiCall();
  requestCache.set(key, {
    promise,
    timestamp: now
  });
  
  // Clean up old entries
  setTimeout(() => {
    requestCache.delete(key);
  }, CACHE_DURATION);
  
  return promise;
};

/**
 * Clear request cache
 */
export const clearRequestCache = () => {
  requestCache.clear();
  console.log('Request cache cleared');
};

/**
 * Force refresh by bypassing cache
 */
export const forceRefresh = (key, apiCall) => {
  requestCache.delete(key);
  return apiCall();
};
