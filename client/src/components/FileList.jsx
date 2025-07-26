import React, { useState, useEffect } from 'react'
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-hot-toast'
import { 
  CloudArrowUpIcon, 
  DocumentIcon, 
  TrashIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  DevicePhoneMobileIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { api, formatFileSize, downloadBlob } from '../utils/api'
import clsx from 'clsx'

function FileList({ apiKey, currentDevice }) {
  const [files, setFiles] = useState([])
  const [devices, setDevices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadingFiles, setUploadingFiles] = useState(new Set())
  const [filter, setFilter] = useState({ deviceId: '', search: '' })

  useEffect(() => {
    loadFiles()
    loadDevices()
  }, [apiKey])

  const loadFiles = async () => {
    try {
      const response = await api.listFiles(apiKey, filter.deviceId ? { deviceId: filter.deviceId } : {})
      setFiles(response.files)
    } catch (error) {
      console.error('Load files error:', error)
      toast.error('Failed to load files')
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

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      const fileId = `${file.name}-${file.size}-${file.lastModified}`
      setUploadingFiles(prev => new Set([...prev, fileId]))
      
      try {
        const result = await api.uploadFile(apiKey, file, currentDevice?.id, currentDevice?.name)
        toast.success(`${file.name} uploaded successfully`)
        await loadFiles() // Refresh file list
      } catch (error) {
        console.error('Upload error:', error)
        toast.error(`Failed to upload ${file.name}`)
      } finally {
        setUploadingFiles(prev => {
          const newSet = new Set(prev)
          newSet.delete(fileId)
          return newSet
        })
      }
    }
  }, [apiKey, currentDevice])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 500 * 1024 * 1024 // 500MB
  })

  const handleDownload = async (file) => {
    try {
      const response = await api.downloadFile(apiKey, file.id)
      downloadBlob(response.data, file.filename)
      toast.success(`${file.filename} downloaded`)
      await loadFiles() // Refresh to update download count
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
      await loadFiles()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(`Failed to delete ${file.filename}`)
    }
  }

  const handleCleanup = async () => {
    try {
      const result = await api.cleanupFiles(apiKey)
      toast.success(`Cleaned up ${result.cleanedFiles} expired files`)
      await loadFiles()
    } catch (error) {
      console.error('Cleanup error:', error)
      toast.error('Failed to cleanup files')
    }
  }

  const filteredFiles = files.filter(file => {
    if (filter.deviceId && file.deviceId !== filter.deviceId) return false
    if (filter.search && !file.filename.toLowerCase().includes(filter.search.toLowerCase())) return false
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-lg font-medium text-gray-900">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-gray-600">
          or click to select files (max 500MB each)
        </p>
      </div>

      {/* Uploading Files */}
      {uploadingFiles.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Uploading files...</h3>
          <div className="space-y-1">
            {Array.from(uploadingFiles).map(fileId => (
              <div key={fileId} className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-blue-800">{fileId.split('-')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search files..."
            value={filter.search}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={filter.deviceId}
            onChange={(e) => setFilter(prev => ({ ...prev, deviceId: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All devices</option>
            {devices.map(device => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCleanup}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Cleanup Expired
        </button>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No files</h3>
          <p className="mt-1 text-sm text-gray-500">
            {files.length === 0 ? 'Upload some files to get started' : 'No files match your filters'}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredFiles.map((file) => (
              <li key={file.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <DocumentIcon className="h-8 w-8 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.filename}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>{formatFileSize(file.size)}</span>
                        <span className="flex items-center space-x-1">
                          <DevicePhoneMobileIcon className="h-4 w-4" />
                          <span>{file.deviceName || 'Unknown Device'}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <ClockIcon className="h-4 w-4" />
                          <span>{format(new Date(file.uploadTime), 'MMM d, yyyy HH:mm')}</span>
                        </span>
                        {file.downloadCount > 0 && (
                          <span>{file.downloadCount} downloads</span>
                        )}
                      </div>
                      {file.expiresAt && (
                        <p className="text-xs text-amber-600">
                          Expires {format(new Date(file.expiresAt), 'MMM d, yyyy HH:mm')}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDownload(file)}
                      className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      title="Download"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(file)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default FileList