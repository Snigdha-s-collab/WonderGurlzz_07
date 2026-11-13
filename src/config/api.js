// Centralized backend API configuration
export const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  'http://127.0.0.1:8000'
).replace(/\/+$/, '');

