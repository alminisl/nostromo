import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { 
  ArrowDownTrayIcon,
  DocumentIcon,
  ShareIcon,
  QrCodeIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { formatFileSize, downloadBlob } from '../utils/api'

function SharePage() {
  const { fileId } = useParams()
  const [file, setFile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState(null)
  const [autoDownloadTriggered, setAutoDownloadTriggered] = useState(false)

  useEffect(() => {
    loadFileInfo()
  }, [fileId])

  // Auto-download when file is loaded (unless it's expired)
  useEffect(() => {
    if (file && !autoDownloadTriggered && !error) {
      const isExpired = file.expiresAt && new Date() > new Date(file.expiresAt)
      if (!isExpired) {
        setAutoDownloadTriggered(true)
        // Delay auto-download slightly to show the interface
        setTimeout(() => {
          handleDownload(true) // true flag indicates auto-download
        }, 1000)
      }
    }
  }, [file, autoDownloadTriggered, error])

  const loadFileInfo = async () => {
    try {
      const response = await fetch(`/api/files/${fileId}/info`)
      if (!response.ok) {
        if (response.status === 404) {
          setError('File not found or has expired')
        } else if (response.status === 410) {
          setError('File has expired')
        } else {
          throw new Error('Failed to load file info')
        }
        return
      }
      
      const data = await response.json()
      setFile(data)
    } catch (error) {
      console.error('Load file error:', error)
      setError('Failed to load file information')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (isAutoDownload = false) => {
    if (!file) return
    
    setIsDownloading(true)
    try {
      const response = await fetch(`/api/files/${fileId}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('File not found')
        } else if (response.status === 410) {
          throw new Error('File has expired')
        } else {
          throw new Error('Download failed')
        }
      }
      
      const blob = await response.blob()
      downloadBlob(blob, file.filename)
      
      if (isAutoDownload) {
        toast.success(`${file.filename} download started automatically!`, {
          duration: 3000,
          icon: '⬇️',
        })
      } else {
        toast.success(`${file.filename} downloaded successfully!`)
      }
      
      // Refresh file info to update download count
      await loadFileInfo()
    } catch (error) {
      console.error('Download error:', error)
      if (isAutoDownload) {
        toast.error(`Auto-download failed: ${error.message}`, { duration: 5000 })
      } else {
        toast.error(error.message || 'Failed to download file')
      }
      if (error.message.includes('expired') || error.message.includes('not found')) {
        setError(error.message)
      }
    } finally {
      setIsDownloading(false)
    }
  }

  const copyShareLink = () => {
    const shareLink = window.location.href
    navigator.clipboard.writeText(shareLink).then(() => {
      toast.success('Share link copied to clipboard!')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }

  const generateQRCode = () => {
    const shareLink = window.location.href
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareLink)}`
    
    // Open QR code in new window
    const qrWindow = window.open('', '_blank', 'width=350,height=400')
    qrWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${file?.filename || 'Shared File'}</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              text-align: center; 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }
            .qr-container {
              background: white;
              padding: 20px;
              border-radius: 16px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            h3 { margin-top: 0; color: #333; }
            img { border-radius: 8px; }
            p { font-size: 14px; color: #666; margin: 15px 0 0 0; max-width: 250px; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h3>Scan to Download</h3>
            <img src="${qrUrl}" alt="QR Code">
            <p>Scan with your phone camera to download:<br><strong>${file?.filename || 'Shared File'}</strong></p>
          </div>
        </body>
      </html>
    `)
    qrWindow.document.close()
  }

  const shareFile = async () => {
    if (navigator.share && file) {
      try {
        await navigator.share({
          title: `Download: ${file.filename}`,
          text: `Someone shared "${file.filename}" with you via Secure File Share`,
          url: window.location.href
        })
      } catch (error) {
        if (error.name !== 'AbortError') {
          copyShareLink()
        }
      }
    } else {
      copyShareLink()
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white text-lg">Loading file...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-8">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">File Not Available</h1>
          <p className="text-purple-200 mb-8">{error}</p>
          <a 
            href="/"
            className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            Share New File
          </a>
        </div>
      </div>
    )
  }

  if (!file) {
    return null
  }

  const isExpired = file.expiresAt && new Date() > new Date(file.expiresAt)
  const timeUntilExpiry = file.expiresAt ? new Date(file.expiresAt) - new Date() : null
  const hoursUntilExpiry = timeUntilExpiry ? Math.ceil(timeUntilExpiry / (1000 * 60 * 60)) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            {autoDownloadTriggered && !isDownloading && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-400/30 rounded-lg">
                <p className="text-green-200 text-sm flex items-center justify-center space-x-2">
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  <span>Download started automatically!</span>
                </p>
              </div>
            )}
            <h1 className="text-2xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-300 mb-4">
              Your file is ready to share!
            </h1>
            <p className="text-white text-base sm:text-lg">
              Copy the link to share your file
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-8 border border-white/20 mb-6 sm:mb-8">
            {/* File Info */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6 sm:mb-8">
              <div className="p-3 sm:p-4 bg-purple-500/20 rounded-xl self-start">
                <DocumentIcon className="h-8 w-8 sm:h-12 sm:w-12 text-purple-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-semibold text-white break-words mb-2">
                  {file.filename}
                </h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-purple-200 text-sm">
                  <span>{formatFileSize(file.size)}</span>
                  <span className="hidden sm:inline">•</span>
                  <span className="flex items-center space-x-1">
                    <DevicePhoneMobileIcon className="h-4 w-4" />
                    <span className="truncate">{file.deviceName || 'Unknown Device'}</span>
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span>{format(new Date(file.uploadTime), 'MMM d, HH:mm')}</span>
                </div>
                {file.downloadCount > 0 && (
                  <p className="text-green-300 text-sm mt-2">
                    Downloaded {file.downloadCount} time{file.downloadCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            </div>

            {/* Share Link */}
            <div className="mb-6 sm:mb-8">
              <label className="block text-white font-medium mb-3 text-sm sm:text-base">
                Copy the link to share your file
              </label>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <div className="flex-1 p-3 sm:p-4 bg-black/30 rounded-xl border border-white/20">
                  <code className="text-purple-200 font-mono text-xs sm:text-sm break-all">
                    {window.location.href}
                  </code>
                </div>
                <button
                  onClick={copyShareLink}
                  className="px-4 sm:px-6 py-3 sm:py-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                >
                  <ClipboardDocumentIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base">Copy link</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button
                onClick={shareFile}
                className="flex items-center justify-center space-x-2 p-3 sm:p-4 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl transition-colors text-sm sm:text-base"
              >
                <ShareIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Share</span>
              </button>
              <button
                onClick={generateQRCode}
                className="flex items-center justify-center space-x-2 p-3 sm:p-4 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl transition-colors text-sm sm:text-base"
              >
                <QrCodeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Show QR code</span>
              </button>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading || isExpired}
              className={`w-full flex items-center justify-center space-x-3 p-4 sm:p-6 rounded-xl font-semibold text-base sm:text-lg transition-all ${
                isExpired
                  ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white hover:scale-105'
              }`}
            >
              <ArrowDownTrayIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              <span>
                {isDownloading ? 'Downloading...' : isExpired ? 'File Expired' : 'Download File'}
              </span>
            </button>

            {/* Expiry Info */}
            <div className="mt-4 sm:mt-6 text-center">
              {file.expiresAt && (
                <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 text-xs sm:text-sm">
                  <div className="flex items-center space-x-2">
                    <ClockIcon className="h-4 w-4 text-amber-400" />
                    <span className="text-amber-300">
                      Your file will be deleted{' '}
                      {isExpired ? (
                        'has expired'
                      ) : hoursUntilExpiry <= 1 ? (
                        'in less than 1 hour'
                      ) : (
                        `in ${hoursUntilExpiry} hours`
                      )}
                    </span>
                  </div>
                  <span className="text-amber-300 hidden sm:inline">or after 100 downloads</span>
                  <span className="text-amber-300 sm:hidden text-center">or after 100 downloads</span>
                </div>
              )}
            </div>
          </div>

          {/* Security Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="flex items-center space-x-3 text-green-300">
              <CheckCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm sm:text-base">Encrypted</h3>
                <p className="text-xs sm:text-sm text-green-400">End-to-end encrypted</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 text-blue-300">
              <CheckCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm sm:text-base">Uploaded</h3>
                <p className="text-xs sm:text-sm text-blue-400">You can close this page now</p>
              </div>
            </div>
          </div>

          {/* Back to Home */}
          <div className="text-center mt-6 sm:mt-8">
            <a 
              href="/"
              className="text-purple-300 hover:text-purple-200 underline text-sm sm:text-base"
            >
              ← Share another file
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SharePage