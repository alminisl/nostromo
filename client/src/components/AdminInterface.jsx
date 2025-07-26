import React, { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import Navbar from './Navbar'
import DeviceFileView from './DeviceFileView'
import FileList from './FileList'
import DeviceList from './DeviceList'
import ApiKeyManager from './ApiKeyManager'
import { api } from '../utils/api'

function AdminInterface() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('adminApiKey') || '')
  const [currentDevice, setCurrentDevice] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (apiKey) {
      initializeApp()
    } else {
      setIsLoading(false)
    }
  }, [apiKey])

  const initializeApp = async () => {
    try {
      // Validate API key and get device info
      const validation = await api.validateApiKey(apiKey)
      if (validation.valid) {
        const deviceInfo = await api.getCurrentDevice(apiKey)
        setCurrentDevice(deviceInfo.device)
      } else {
        handleLogout()
        toast.error('Invalid or expired API key')
      }
    } catch (error) {
      console.error('Initialization error:', error)
      handleLogout()
      toast.error('Failed to initialize admin interface')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApiKeySubmit = (newApiKey) => {
    localStorage.setItem('adminApiKey', newApiKey)
    setApiKey(newApiKey)
    toast.success('API key saved successfully')
  }

  const handleLogout = () => {
    localStorage.removeItem('adminApiKey')
    setApiKey('')
    setCurrentDevice(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin interface...</p>
        </div>
      </div>
    )
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Admin Interface
              </h1>
              <p className="text-gray-600">
                Enter your admin API key to manage the file sharing system
              </p>
            </div>
            
            <ApiKeySetup onSubmit={handleApiKeySubmit} />
            
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Regular Users</h3>
              <p className="text-sm text-blue-800 mb-2">
                For simple file sharing without admin access:
              </p>
              <a 
                href="/"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Go to Public File Share →
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar 
        currentDevice={currentDevice} 
        onLogout={handleLogout}
        apiKey={apiKey}
      />
      
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route 
            path="/admin" 
            element={<DeviceFileView apiKey={apiKey} />} 
          />
          <Route 
            path="/admin/files" 
            element={<FileList apiKey={apiKey} currentDevice={currentDevice} />} 
          />
          <Route 
            path="/admin/devices" 
            element={<DeviceList apiKey={apiKey} />} 
          />
          <Route 
            path="/admin/api-keys" 
            element={<ApiKeyManager apiKey={apiKey} />} 
          />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function ApiKeySetup({ onSubmit }) {
  const [apiKey, setApiKey] = useState('')
  const [isValidating, setIsValidating] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!apiKey.trim()) return

    setIsValidating(true)
    try {
      const validation = await api.validateApiKey(apiKey.trim())
      if (validation.valid) {
        onSubmit(apiKey.trim())
      } else {
        toast.error('Invalid API key')
      }
    } catch (error) {
      toast.error('Failed to validate API key')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
          Admin API Key
        </label>
        <input
          type="password"
          id="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your admin API key"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
          required
        />
      </div>
      
      <button
        type="submit"
        disabled={isValidating}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
      >
        {isValidating ? 'Validating...' : 'Access Admin Interface'}
      </button>
    </form>
  )
}

export default AdminInterface