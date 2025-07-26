import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { 
  DevicePhoneMobileIcon, 
  ShieldCheckIcon, 
  ShieldExclamationIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  SignalIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { api } from '../utils/api'
import clsx from 'clsx'

function DeviceList({ apiKey }) {
  const [devices, setDevices] = useState([])
  const [deviceStats, setDeviceStats] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [editingDevice, setEditingDevice] = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadDevices()
  }, [apiKey])

  const loadDevices = async () => {
    try {
      const response = await api.listDevices(apiKey)
      setDevices(response.devices)
      
      // Load stats for each device
      const stats = {}
      for (const device of response.devices) {
        try {
          const deviceStats = await api.getDeviceStats(apiKey, device.id)
          stats[device.id] = deviceStats.stats
        } catch (error) {
          console.warn(`Failed to load stats for device ${device.id}:`, error)
        }
      }
      setDeviceStats(stats)
    } catch (error) {
      console.error('Load devices error:', error)
      toast.error('Failed to load devices')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTrustDevice = async (deviceId, trust) => {
    try {
      if (trust) {
        await api.trustDevice(apiKey, deviceId)
        toast.success('Device trusted')
      } else {
        await api.untrustDevice(apiKey, deviceId)
        toast.success('Device untrusted')
      }
      await loadDevices()
    } catch (error) {
      console.error('Trust device error:', error)
      toast.error(`Failed to ${trust ? 'trust' : 'untrust'} device`)
    }
  }

  const handleDeleteDevice = async (device) => {
    if (device.isSelf) {
      toast.error('Cannot delete own device')
      return
    }

    if (!confirm(`Are you sure you want to delete ${device.name}?`)) {
      return
    }

    try {
      await api.deleteDevice(apiKey, device.id)
      toast.success('Device deleted')
      await loadDevices()
    } catch (error) {
      console.error('Delete device error:', error)
      toast.error('Failed to delete device')
    }
  }

  const startEditing = (device) => {
    setEditingDevice(device.id)
    setEditName(device.name)
  }

  const cancelEditing = () => {
    setEditingDevice(null)
    setEditName('')
  }

  const saveDeviceName = async (deviceId) => {
    if (!editName.trim()) {
      toast.error('Device name cannot be empty')
      return
    }

    try {
      await api.updateDevice(apiKey, deviceId, editName.trim())
      toast.success('Device name updated')
      await loadDevices()
      setEditingDevice(null)
      setEditName('')
    } catch (error) {
      console.error('Update device error:', error)
      toast.error('Failed to update device name')
    }
  }

  const getStatusColor = (device) => {
    if (!device.isTrusted) return 'text-red-600'
    
    const lastSeen = new Date(device.lastSeen)
    const now = new Date()
    const minutesAgo = (now - lastSeen) / (1000 * 60)
    
    if (minutesAgo < 5) return 'text-green-600'
    if (minutesAgo < 60) return 'text-yellow-600'
    return 'text-gray-600'
  }

  const getStatusText = (device) => {
    if (!device.isTrusted) return 'Untrusted'
    
    const lastSeen = new Date(device.lastSeen)
    const now = new Date()
    const minutesAgo = (now - lastSeen) / (1000 * 60)
    
    if (minutesAgo < 1) return 'Active now'
    if (minutesAgo < 60) return `Active ${Math.floor(minutesAgo)}m ago`
    if (minutesAgo < 1440) return `Active ${Math.floor(minutesAgo / 60)}h ago`
    return `Active ${Math.floor(minutesAgo / 1440)}d ago`
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
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage devices connected to your file sharing network
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0">
          <button
            onClick={loadDevices}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <SignalIcon className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-12">
          <DevicePhoneMobileIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No devices found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Devices will appear here when they connect to the network
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <ul className="divide-y divide-gray-200">
            {devices.map((device) => {
              const stats = deviceStats[device.id] || {}
              const statusColor = getStatusColor(device)
              
              return (
                <li key={device.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <DevicePhoneMobileIcon 
                          className={clsx('h-8 w-8', statusColor)}
                        />
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          {editingDevice === device.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="text-sm font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 focus:ring-primary-500 focus:border-primary-500"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') saveDeviceName(device.id)
                                  if (e.key === 'Escape') cancelEditing()
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => saveDeviceName(device.id)}
                                className="p-1 text-green-600 hover:text-green-800"
                              >
                                <CheckIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="p-1 text-gray-400 hover:text-gray-600"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {device.name}
                                {device.isSelf && (
                                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    This Device
                                  </span>
                                )}
                              </p>
                              {!device.isSelf && (
                                <button
                                  onClick={() => startEditing(device)}
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="font-mono">{device.ipAddress}</span>
                          <span className={statusColor}>
                            {getStatusText(device)}
                          </span>
                          {device.fingerprint && (
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                              {device.fingerprint}
                            </span>
                          )}
                        </div>
                        
                        {Object.keys(stats).length > 0 && (
                          <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                            <span>{stats.totalFiles || 0} files</span>
                            <span>{stats.activeFiles || 0} active</span>
                            <span>{stats.totalDownloads || 0} downloads</span>
                            {stats.lastUpload && (
                              <span>
                                Last upload: {format(new Date(stats.lastUpload), 'MMM d')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {device.isTrusted ? (
                        <button
                          onClick={() => handleTrustDevice(device.id, false)}
                          className="p-2 text-green-600 hover:text-green-800 transition-colors"
                          title="Trusted - Click to untrust"
                        >
                          <ShieldCheckIcon className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTrustDevice(device.id, true)}
                          className="p-2 text-red-600 hover:text-red-800 transition-colors"
                          title="Untrusted - Click to trust"
                        >
                          <ShieldExclamationIcon className="h-5 w-5" />
                        </button>
                      )}
                      
                      {!device.isSelf && (
                        <button
                          onClick={() => handleDeleteDevice(device)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete device"
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
    </div>
  )
}

export default DeviceList