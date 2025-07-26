import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { 
  KeyIcon, 
  PlusIcon, 
  TrashIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { api } from '../utils/api'
import clsx from 'clsx'

function ApiKeyManager({ apiKey }) {
  const [apiKeys, setApiKeys] = useState([])
  const [devices, setDevices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showNewKeyForm, setShowNewKeyForm] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState(new Set())
  const [newKeyData, setNewKeyData] = useState({
    deviceId: '',
    permissions: ['read', 'write'],
    expiresInHours: ''
  })

  useEffect(() => {
    loadApiKeys()
    loadDevices()
  }, [apiKey])

  const loadApiKeys = async () => {
    try {
      const response = await api.listApiKeys(apiKey)
      setApiKeys(response.apiKeys)
    } catch (error) {
      console.error('Load API keys error:', error)
      toast.error('Failed to load API keys')
    } finally {
      setIsLoading(false)
    }
  }

  const loadDevices = async () => {
    try {
      const response = await api.listDevices(apiKey)
      setDevices(response.devices)
    } catch (error) {
      console.error('Load devices error:', error)
    }
  }

  const handleCreateApiKey = async (e) => {
    e.preventDefault()
    
    try {
      const response = await api.generateApiKey(
        apiKey,
        newKeyData.deviceId || undefined,
        newKeyData.permissions.join(','),
        newKeyData.expiresInHours ? parseInt(newKeyData.expiresInHours) : undefined
      )
      
      toast.success('API key generated successfully')
      
      // Show the generated key
      const keyInfo = {
        id: response.keyId,
        deviceId: newKeyData.deviceId || null,
        deviceName: newKeyData.deviceId 
          ? devices.find(d => d.id === newKeyData.deviceId)?.name || 'Unknown Device'
          : 'Default Device',
        permissions: response.permissions,
        createdAt: new Date().toISOString(),
        expiresAt: response.expiresAt,
        isActive: true,
        generatedKey: response.apiKey // This will only be shown once
      }
      
      setApiKeys(prev => [keyInfo, ...prev])
      setShowNewKeyForm(false)
      setNewKeyData({
        deviceId: '',
        permissions: ['read', 'write'],
        expiresInHours: ''
      })
      
      // Auto-show the new key
      setVisibleKeys(prev => new Set([...prev, keyInfo.id]))
      
    } catch (error) {
      console.error('Create API key error:', error)
      toast.error('Failed to generate API key')
    }
  }

  const handleRevokeApiKey = async (keyId, deviceName) => {
    if (!confirm(`Are you sure you want to revoke the API key for ${deviceName}?`)) {
      return
    }

    try {
      await api.revokeApiKey(apiKey, keyId)
      toast.success('API key revoked')
      await loadApiKeys()
    } catch (error) {
      console.error('Revoke API key error:', error)
      toast.error('Failed to revoke API key')
    }
  }

  const toggleKeyVisibility = (keyId) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy to clipboard')
    })
  }

  const handlePermissionChange = (permission) => {
    setNewKeyData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage API keys for programmatic access to the file sharing system
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowNewKeyForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Generate API Key
          </button>
        </div>
      </div>

      {/* New API Key Form */}
      {showNewKeyForm && (
        <div className="bg-white shadow sm:rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Generate New API Key</h3>
          
          <form onSubmit={handleCreateApiKey} className="space-y-4">
            <div>
              <label htmlFor="deviceId" className="block text-sm font-medium text-gray-700 mb-2">
                Device (optional)
              </label>
              <select
                id="deviceId"
                value={newKeyData.deviceId}
                onChange={(e) => setNewKeyData(prev => ({ ...prev, deviceId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Default Device</option>
                {devices.map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Permissions
              </label>
              <div className="space-y-2">
                {['read', 'write'].map(permission => (
                  <label key={permission} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newKeyData.permissions.includes(permission)}
                      onChange={() => handlePermissionChange(permission)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">
                      {permission}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="expiresInHours" className="block text-sm font-medium text-gray-700 mb-2">
                Expires in hours (optional)
              </label>
              <input
                type="number"
                id="expiresInHours"
                value={newKeyData.expiresInHours}
                onChange={(e) => setNewKeyData(prev => ({ ...prev, expiresInHours: e.target.value }))}
                placeholder="Leave empty for no expiration"
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowNewKeyForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={newKeyData.permissions.length === 0}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                Generate Key
              </button>
            </div>
          </form>
        </div>
      )}

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <div className="text-center py-12">
          <KeyIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No API keys</h3>
          <p className="mt-1 text-sm text-gray-500">
            Generate an API key to enable programmatic access
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <ul className="divide-y divide-gray-200">
            {apiKeys.map((key) => {
              const isVisible = visibleKeys.has(key.id)
              const isExpired = key.expiresAt && new Date() > new Date(key.expiresAt)
              
              return (
                <li key={key.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <KeyIcon className={clsx(
                        'h-8 w-8 flex-shrink-0',
                        isExpired ? 'text-red-400' : 'text-gray-400'
                      )} />
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900">
                            {key.deviceName}
                          </p>
                          {isExpired && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Expired
                            </span>
                          )}
                          {!key.isActive && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Revoked
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Permissions: {key.permissions.join(', ')}</span>
                          <span>Created {format(new Date(key.createdAt), 'MMM d, yyyy')}</span>
                          {key.expiresAt && (
                            <span>
                              Expires {format(new Date(key.expiresAt), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                        
                        {key.generatedKey && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-600 mb-1">
                                  Generated API Key (save this - it won't be shown again):
                                </p>
                                <code className={clsx(
                                  'text-sm font-mono text-gray-900 break-all',
                                  !isVisible && 'blur-sm select-none'
                                )}>
                                  {isVisible ? key.generatedKey : '•'.repeat(key.generatedKey.length)}
                                </code>
                              </div>
                              <div className="flex items-center space-x-2 ml-4">
                                <button
                                  onClick={() => toggleKeyVisibility(key.id)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  title={isVisible ? 'Hide key' : 'Show key'}
                                >
                                  {isVisible ? (
                                    <EyeSlashIcon className="h-4 w-4" />
                                  ) : (
                                    <EyeIcon className="h-4 w-4" />
                                  )}
                                </button>
                                {isVisible && (
                                  <button
                                    onClick={() => copyToClipboard(key.generatedKey)}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                    title="Copy to clipboard"
                                  >
                                    <ClipboardDocumentIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {key.isActive && !isExpired && (
                        <button
                          onClick={() => handleRevokeApiKey(key.id, key.deviceName)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Revoke API key"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Usage Examples */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Examples</h3>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Upload a file:</h4>
            <code className="block text-sm bg-white p-3 rounded border font-mono text-gray-900">
              curl -X POST -H "X-API-Key: YOUR_API_KEY" -F "file=@example.txt" {window.location.origin}/api/files
            </code>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">List files:</h4>
            <code className="block text-sm bg-white p-3 rounded border font-mono text-gray-900">
              curl -H "X-API-Key: YOUR_API_KEY" {window.location.origin}/api/files
            </code>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Download a file:</h4>
            <code className="block text-sm bg-white p-3 rounded border font-mono text-gray-900">
              curl -H "X-API-Key: YOUR_API_KEY" {window.location.origin}/api/files/FILE_ID -o downloaded_file
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiKeyManager