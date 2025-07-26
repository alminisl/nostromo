import React, { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { 
  DevicePhoneMobileIcon, 
  DocumentIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ClockIcon,
  ChartBarIcon,
  WifiIcon,
  ComputerDesktopIcon,
  DeviceTabletIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { api, formatFileSize, downloadBlob } from '../utils/api'
import clsx from 'clsx'

function DeviceFileView({ apiKey }) {
  const [devicesWithFiles, setDevicesWithFiles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedDevices, setExpandedDevices] = useState(new Set())

  useEffect(() => {
    loadDevicesWithFiles()
  }, [apiKey])

  const loadDevicesWithFiles = async () => {
    try {
      // Load devices and files in parallel
      const [devicesResponse, filesResponse] = await Promise.all([
        api.listDevices(apiKey),
        api.listFiles(apiKey, { limit: 1000 })
      ])

      const devices = devicesResponse.devices
      const files = filesResponse.files

      // Group files by device
      const deviceFileMap = new Map()
      
      // Initialize all devices
      devices.forEach(device => {
        deviceFileMap.set(device.id, {
          device,
          files: [],
          stats: {
            totalFiles: 0,
            totalSize: 0,
            totalDownloads: 0,
            activeFiles: 0
          }
        })
      })

      // Add files to devices
      files.forEach(file => {
        if (deviceFileMap.has(file.deviceId)) {
          const deviceData = deviceFileMap.get(file.deviceId)
          deviceData.files.push(file)
          deviceData.stats.totalFiles++
          deviceData.stats.totalSize += file.size
          deviceData.stats.totalDownloads += file.downloadCount
          
          // Check if file is active (not expired)
          if (!file.expiresAt || new Date(file.expiresAt) > new Date()) {
            deviceData.stats.activeFiles++
          }
        }
      })

      // Convert to array and sort by activity
      const devicesArray = Array.from(deviceFileMap.values())
        .sort((a, b) => {
          // Sort by: files count, then by last seen
          if (a.stats.totalFiles !== b.stats.totalFiles) {
            return b.stats.totalFiles - a.stats.totalFiles
          }
          return new Date(b.device.lastSeen) - new Date(a.device.lastSeen)
        })

      setDevicesWithFiles(devicesArray)
    } catch (error) {
      console.error('Load devices with files error:', error)
      toast.error('Failed to load device data')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleDeviceExpansion = (deviceId) => {
    setExpandedDevices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId)
      } else {
        newSet.add(deviceId)
      }
      return newSet
    })
  }

  const handleDownload = async (file) => {
    try {
      const response = await api.downloadFile(apiKey, file.id)
      downloadBlob(response.data, file.filename)
      toast.success(`${file.filename} downloaded`)
      await loadDevicesWithFiles() // Refresh to update download count
    } catch (error) {
      console.error('Download error:', error)
      toast.error(`Failed to download ${file.filename}`)
    }
  }

  const handleDelete = async (file) => {
    if (!confirm(`Are you sure you want to delete ${file.filename}?`)) {
      return
    }

    try {
      await api.deleteFile(apiKey, file.id)
      toast.success(`${file.filename} deleted`)
      await loadDevicesWithFiles()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(`Failed to delete ${file.filename}`)
    }
  }

  const getDeviceIcon = (deviceName) => {
    const name = deviceName?.toLowerCase() || ''
    if (name.includes('mobile') || name.includes('phone') || name.includes('android') || name.includes('ios')) {
      return DevicePhoneMobileIcon
    }
    if (name.includes('tablet') || name.includes('ipad')) {
      return DeviceTabletIcon
    }
    return ComputerDesktopIcon
  }

  const getDeviceTypeColor = (deviceName) => {
    const name = deviceName?.toLowerCase() || ''
    if (name.includes('mobile') || name.includes('phone') || name.includes('android') || name.includes('ios')) {
      return 'text-green-600 bg-green-100'
    }
    if (name.includes('tablet') || name.includes('ipad')) {
      return 'text-purple-600 bg-purple-100'
    }
    return 'text-blue-600 bg-blue-100'
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
          <h1 className="text-2xl font-bold text-gray-900">Device & File Overview</h1>
          <p className="mt-1 text-sm text-gray-600">
            See which devices are sharing which files
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0">
          <button
            onClick={loadDevicesWithFiles}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <WifiIcon className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DevicePhoneMobileIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Devices</dt>
                  <dd className="text-lg font-medium text-gray-900">{devicesWithFiles.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Files</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {devicesWithFiles.reduce((sum, d) => sum + d.stats.totalFiles, 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Size</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatFileSize(devicesWithFiles.reduce((sum, d) => sum + d.stats.totalSize, 0))}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowDownTrayIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Downloads</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {devicesWithFiles.reduce((sum, d) => sum + d.stats.totalDownloads, 0)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Devices with Files */}
      <div className="space-y-4">
        {devicesWithFiles.map((deviceData) => {
          const { device, files, stats } = deviceData
          const isExpanded = expandedDevices.has(device.id)
          const DeviceIcon = getDeviceIcon(device.name)
          const statusColor = getStatusColor(device)
          const deviceTypeColor = getDeviceTypeColor(device.name)

          return (
            <div key={device.id} className="bg-white shadow rounded-lg overflow-hidden">
              {/* Device Header */}
              <div 
                className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleDeviceExpansion(device.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={clsx('p-2 rounded-lg', deviceTypeColor)}>
                      <DeviceIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900">
                          {device.name}
                        </h3>
                        {device.isSelf && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            This Device
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>{device.ipAddress}</span>
                        <span className={statusColor}>
                          Last seen {format(new Date(device.lastSeen), 'MMM d, HH:mm')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">{stats.totalFiles}</div>
                      <div className="text-xs text-gray-500">Files</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">{formatFileSize(stats.totalSize)}</div>
                      <div className="text-xs text-gray-500">Size</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">{stats.totalDownloads}</div>
                      <div className="text-xs text-gray-500">Downloads</div>
                    </div>
                    <div className="text-primary-600">
                      <svg 
                        className={clsx('h-5 w-5 transition-transform', isExpanded && 'rotate-180')}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Files List */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50">
                  {files.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <DocumentIcon className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">No files shared from this device</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {files.map((file) => {
                        const isExpired = file.expiresAt && new Date(file.expiresAt) < new Date()
                        
                        return (
                          <div key={file.id} className="px-6 py-4 flex items-center justify-between hover:bg-white transition-colors">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <DocumentIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {file.filename}
                                </p>
                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                  <span>{formatFileSize(file.size)}</span>
                                  <span>{format(new Date(file.uploadTime), 'MMM d, HH:mm')}</span>
                                  {file.downloadCount > 0 && (
                                    <span>{file.downloadCount} downloads</span>
                                  )}
                                  {isExpired && (
                                    <span className="text-red-600 font-medium">Expired</span>
                                  )}
                                  {file.expiresAt && !isExpired && (
                                    <span className="flex items-center space-x-1 text-amber-600">
                                      <ClockIcon className="h-3 w-3" />
                                      <span>Expires {format(new Date(file.expiresAt), 'MMM d, HH:mm')}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDownload(file)
                                }}
                                className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                                title="Download"
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(file)
                                }}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {devicesWithFiles.length === 0 && (
        <div className="text-center py-12">
          <DevicePhoneMobileIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">No devices found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Devices will appear here when they upload files
          </p>
        </div>
      )}
    </div>
  )
}

export default DeviceFileView