import axios from "axios";
import { apiRetry } from "../utils/apiRetry";

const DEFAULT_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000/api";

export const api = axios.create({
  baseURL: DEFAULT_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add cache-busting headers for analytics endpoints
  if (config.url && config.url.includes('/analytics/')) {
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';
  }
  
  return config;
});

// Add retry logic for rate limiting
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429) {
      // Rate limited - retry with exponential backoff
      return apiRetry(() => api.request(error.config), 3, 1000);
    }
    return Promise.reject(error);
  }
);

export const setApiBaseURL = (url) => {
  api.defaults.baseURL = url || DEFAULT_BASE_URL;
};

export const openCsv = (pathWithQuery) => {
  const url = `${api.defaults.baseURL}${pathWithQuery.startsWith("/") ? pathWithQuery : `/${pathWithQuery}`}`;
  window.open(url, "_blank");
};

export default api;