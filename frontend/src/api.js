import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/',
})

// Auto-logout on 401 (expired/invalid token during an active session)
api.interceptors.response.use(
  r => r,
  err => {
    if (
      err.response?.status === 401 &&
      localStorage.getItem('token') &&
      !window.location.pathname.includes('/join')
    ) {
      localStorage.removeItem('token')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/join'
    }
    return Promise.reject(err)
  }
)

export default api
