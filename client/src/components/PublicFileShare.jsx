import React, { useState, useEffect } from 'react'
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'react-hot-toast'
import { 
  CloudArrowUpIcon, 
  DocumentIcon, 
  ArrowDownTrayIcon,
  ShareIcon,
  QrCodeIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { api, formatFileSize, downloadBlob } from '../utils/api'
import clsx from 'clsx'

function PublicFileShare() {
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadingFiles, setUploadingFiles] = useState(new Set())
  const [sharedLinks, setSharedLinks] = useState({})

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      const response = await fetch('/api/files')
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Load files error:', error)
      toast.error('Failed to load files')
    } finally {
      setIsLoading(false)
    }
  }

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      const fileId = `${file.name}-${file.size}-${file.lastModified}`
      setUploadingFiles(prev => new Set([...prev, fileId]))
      
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('deviceName', navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop')
        formData.append('expiresInMinutes', '1440') // 24 hours default
        
        const response = await fetch('/api/files', {
          method: 'POST',
          body: formData
        })
        
        if (!response.ok) {
          throw new Error('Upload failed')
        }
        
        const result = await response.json()
        toast.success(`${file.name} uploaded successfully`)
        await loadFiles() // Refresh file list
        
        // Generate share link
        const shareLink = `${window.location.origin}/#/share/${result.fileId}`
        setSharedLinks(prev => ({
          ...prev,
          [result.fileId]: shareLink
        }))
        
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
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 500 * 1024 * 1024 // 500MB
  })

  const handleDownload = async (file) => {
    try {
      const response = await fetch(`/api/files/${file.id}`)
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      downloadBlob(blob, file.filename)
      toast.success(`${file.filename} downloaded`)
      await loadFiles() // Update download count
    } catch (error) {
      console.error('Download error:', error)
      toast.error(`Failed to download ${file.filename}`)
    }
  }

  const generateShareLink = (fileId) => {
    const shareLink = `${window.location.origin}/#/share/${fileId}`
    setSharedLinks(prev => ({
      ...prev,
      [fileId]: shareLink
    }))
    return shareLink
  }

  const copyShareLink = (fileId) => {
    const link = sharedLinks[fileId] || generateShareLink(fileId)
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Share link copied to clipboard!')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }

  const generateQRCode = (fileId) => {
    const link = sharedLinks[fileId] || generateShareLink(fileId)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}`
    
    // Open QR code in new window
    const qrWindow = window.open('', '_blank', 'width=250,height=250')
    qrWindow.document.write(`
      <html>
        <head><title>QR Code - Share File</title></head>
        <body style="margin:0; padding:20px; text-align:center; font-family:sans-serif;">
          <h3>Scan to Download</h3>
          <img src="${qrUrl}" alt="QR Code" style="border:1px solid #ddd; border-radius:8px;">
          <p style="font-size:12px; color:#666; margin-top:15px;">
            Scan with your phone camera
          </p>
        </body>
      </html>
    `)
    qrWindow.document.close()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Loading files...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">
            🔒 Secure File Share
          </h1>
          <p className="text-purple-200 text-sm sm:text-lg max-w-2xl mx-auto px-4">
            Share files securely across your devices. End-to-end encrypted, no account required.
          </p>
        </div>

        {/* Upload Area */}
        <div className="max-w-4xl mx-auto mb-6 sm:mb-8">
          <div
            {...getRootProps()}
            className={clsx(
              'border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center cursor-pointer transition-all duration-300',
              isDragActive
                ? 'border-pink-400 bg-pink-500/10 scale-105'
                : 'border-purple-400 bg-white/5 hover:bg-white/10 hover:border-pink-300'
            )}
          >
            <input {...getInputProps()} />
            <CloudArrowUpIcon className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-purple-300 mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-2xl font-semibold text-white mb-2">
              {isDragActive ? 'Drop files here' : 'Drop files to share'}
            </h3>
            <p className="text-purple-200 text-sm sm:text-lg px-2">
              or click to select files (max 500MB each)
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4 mt-4 sm:mt-6">
              <div className="flex items-center space-x-2 text-green-300">
                <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm sm:text-base">Encrypted</span>
              </div>
              <div className="flex items-center space-x-2 text-blue-300">
                <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm sm:text-base">No Registration</span>
              </div>
              <div className="flex items-center space-x-2 text-purple-300">
                <CheckCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm sm:text-base">Auto-Expires</span>
              </div>
            </div>
          </div>
        </div>

        {/* Uploading Files */}
        {uploadingFiles.size > 0 && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-6">
              <h3 className="font-medium text-blue-200 mb-4 flex items-center">
                <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                Uploading files...
              </h3>
              <div className="space-y-2">
                {Array.from(uploadingFiles).map(fileId => (
                  <div key={fileId} className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                    <span className="text-blue-100 text-sm">{fileId.split('-')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Files List */}
        <div className="max-w-4xl mx-auto">
          {files.length === 0 ? (
            <div className="text-center py-12">
              <DocumentIcon className="mx-auto h-16 w-16 text-purple-400 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">No files shared yet</h3>
              <p className="text-purple-200">
                Upload some files to start sharing them across your devices
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-4 sm:mb-6 flex items-center">
                <DocumentIcon className="h-5 w-5 sm:h-6 sm:w-6 mr-2" />
                Shared Files ({files.length})
              </h2>
              
              {files.map((file) => (
                <div key={file.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20">
                  {/* Mobile Layout: Stack everything vertically */}
                  <div className="sm:hidden space-y-4">
                    {/* File Info */}
                    <div className="flex items-start space-x-3">
                      <DocumentIcon className="h-8 w-8 text-purple-300 flex-shrink-0 mt-1" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-medium text-white break-words leading-tight">
                          {file.filename}
                        </h3>
                        <div className="mt-2 space-y-1 text-xs text-purple-200">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{formatFileSize(file.size)}</span>
                            <span>•</span>
                            <span>{file.deviceName || 'Unknown Device'}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span>{format(new Date(file.uploadTime), 'MMM d, HH:mm')}</span>
                            {file.downloadCount > 0 && (
                              <>
                                <span>•</span>
                                <span>{file.downloadCount} downloads</span>
                              </>
                            )}
                          </div>
                          {file.expiresAt && (
                            <div className="text-amber-300 font-medium">
                              Expires {format(new Date(file.expiresAt), 'MMM d, HH:mm')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleDownload(file)}
                        className="flex flex-col items-center justify-center p-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors"
                      >
                        <ArrowDownTrayIcon className="h-5 w-5 mb-1" />
                        <span className="text-xs">Download</span>
                      </button>
                      <button
                        onClick={() => copyShareLink(file.id)}
                        className="flex flex-col items-center justify-center p-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
                      >
                        <ShareIcon className="h-5 w-5 mb-1" />
                        <span className="text-xs">Share</span>
                      </button>
                      <button
                        onClick={() => generateQRCode(file.id)}
                        className="flex flex-col items-center justify-center p-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors"
                      >
                        <QrCodeIcon className="h-5 w-5 mb-1" />
                        <span className="text-xs">QR Code</span>
                      </button>
                    </div>
                  </div>

                  {/* Desktop Layout: Keep original horizontal layout */}
                  <div className="hidden sm:block">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <DocumentIcon className="h-10 w-10 text-purple-300 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-medium text-white truncate">
                            {file.filename}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-purple-200 mt-1">
                            <span>{formatFileSize(file.size)}</span>
                            <span>•</span>
                            <span>{file.deviceName || 'Unknown Device'}</span>
                            <span>•</span>
                            <span>{format(new Date(file.uploadTime), 'MMM d, HH:mm')}</span>
                            {file.downloadCount > 0 && (
                              <>
                                <span>•</span>
                                <span>{file.downloadCount} downloads</span>
                              </>
                            )}
                          </div>
                          {file.expiresAt && (
                            <p className="text-xs text-amber-300 mt-1">
                              Expires {format(new Date(file.expiresAt), 'MMM d, HH:mm')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => copyShareLink(file.id)}
                          className="p-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors"
                          title="Copy share link"
                        >
                          <ShareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => generateQRCode(file.id)}
                          className="p-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors"
                          title="Show QR code"
                        >
                          <QrCodeIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Share Link Display */}
                  {sharedLinks[file.id] && (
                    <div className="mt-4 p-3 bg-black/20 rounded-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                        <code className="text-xs sm:text-sm text-green-300 font-mono break-all sm:truncate flex-1 sm:mr-4">
                          {sharedLinks[file.id]}
                        </code>
                        <button
                          onClick={() => copyShareLink(file.id)}
                          className="flex items-center justify-center sm:justify-start space-x-1 text-green-300 hover:text-green-200 text-sm py-2 sm:py-0"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4" />
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/20">
          <p className="text-purple-300 text-xs sm:text-sm mb-4 px-4 leading-relaxed">
            🔒 All files are encrypted end-to-end
            <span className="hidden sm:inline"> • Files auto-expire in 24 hours • No data stored externally</span>
          </p>
          <p className="text-purple-300 text-xs mb-4 sm:hidden px-4">
            Files auto-expire in 24 hours • No data stored externally
          </p>
          
          {/* Admin Panel Link */}
          <div className="mt-4 sm:mt-6">
            <a 
              href="/admin"
              className="inline-flex items-center space-x-2 px-3 sm:px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white rounded-lg transition-colors text-xs sm:text-sm border border-gray-600/50"
            >
              <svg className="h-3 w-3 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Admin Panel</span>
            </a>
            <p className="text-xs text-gray-400 mt-2 px-4">
              Advanced device management and file analytics
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PublicFileShare