import axios from 'axios'

const baseURL = '/api'

const createApiInstance = (apiKey) => {
  return axios.create({
    baseURL,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    }
  })
}

export const api = {
  // Auth endpoints
  validateApiKey: async (apiKey) => {
    const response = await axios.post(`${baseURL}/auth/validate`, { apiKey })
    return response.data
  },

  generateApiKey: async (apiKey, deviceId, permissions, expiresInHours) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.post('/auth/api-key', {
      deviceId,
      permissions,
      expiresInHours
    })
    return response.data
  },

  listApiKeys: async (apiKey) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.get('/auth/api-keys')
    return response.data
  },

  revokeApiKey: async (apiKey, keyId) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.delete(`/auth/api-keys/${keyId}`)
    return response.data
  },

  // File endpoints
  listFiles: async (apiKey, params = {}) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.get('/files', { params })
    return response.data
  },

  uploadFile: async (apiKey, file, deviceId, deviceName, expiresInMinutes) => {
    const apiInstance = createApiInstance(apiKey)
    const formData = new FormData()
    formData.append('file', file)
    if (deviceId) formData.append('deviceId', deviceId)
    if (deviceName) formData.append('deviceName', deviceName)
    if (expiresInMinutes) formData.append('expiresInMinutes', expiresInMinutes)

    const response = await apiInstance.post('/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  },

  downloadFile: async (apiKey, fileId) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.get(`/files/${fileId}`, {
      responseType: 'blob'
    })
    return response
  },

  getFileInfo: async (apiKey, fileId) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.get(`/files/${fileId}/info`)
    return response.data
  },

  deleteFile: async (apiKey, fileId) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.delete(`/files/${fileId}`)
    return response.data
  },

  cleanupFiles: async (apiKey) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.post('/files/cleanup')
    return response.data
  },

  // Device endpoints
  listDevices: async (apiKey) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.get('/devices')
    return response.data
  },

  getCurrentDevice: async (apiKey) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.get('/devices/me')
    return response.data
  },

  getDevice: async (apiKey, deviceId) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.get(`/devices/${deviceId}`)
    return response.data
  },

  updateDevice: async (apiKey, deviceId, name) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.put(`/devices/${deviceId}`, { name })
    return response.data
  },

  trustDevice: async (apiKey, deviceId) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.post(`/devices/${deviceId}/trust`)
    return response.data
  },

  untrustDevice: async (apiKey, deviceId) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.post(`/devices/${deviceId}/untrust`)
    return response.data
  },

  deleteDevice: async (apiKey, deviceId) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.delete(`/devices/${deviceId}`)
    return response.data
  },

  getDeviceStats: async (apiKey, deviceId) => {
    const apiInstance = createApiInstance(apiKey)
    const response = await apiInstance.get(`/devices/${deviceId}/stats`)
    return response.data
  },

  registerDevice: async (deviceName, publicKey, ipAddress) => {
    const response = await axios.post(`${baseURL}/devices/register`, {
      deviceName,
      publicKey,
      ipAddress
    })
    return response.data
  },

  discoverDevice: async () => {
    const response = await axios.get(`${baseURL}/devices/discover`)
    return response.data
  }
}

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}