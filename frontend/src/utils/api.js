import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor - attach JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('lms_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('lms_token');
      localStorage.removeItem('lms_admin');
      window.location.href = '/login';
    }
    const message = error.response?.data?.message || 'Something went wrong';
    if (error.response?.status !== 401) toast.error(message);
    return Promise.reject(error);
  }
);

export default api;
