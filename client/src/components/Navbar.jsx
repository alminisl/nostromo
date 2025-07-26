import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  DocumentArrowDownIcon, 
  DevicePhoneMobileIcon, 
  KeyIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

function Navbar({ currentDevice, onLogout, apiKey }) {
  const location = useLocation()

  const navigation = [
    { name: 'Overview', href: '/admin', icon: ChartBarIcon },
    { name: 'Files', href: '/admin/files', icon: DocumentArrowDownIcon },
    { name: 'Devices', href: '/admin/devices', icon: DevicePhoneMobileIcon },
    { name: 'API Keys', href: '/admin/api-keys', icon: KeyIcon },
  ]

  return (
    <nav className="bg-white shadow">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <DocumentArrowDownIcon className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">
                Secure File Share
              </span>
            </Link>
            
            <div className="hidden md:flex space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {currentDevice && (
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                <DevicePhoneMobileIcon className="h-4 w-4" />
                <span>{currentDevice.name}</span>
                <span className="text-gray-400">•</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                  {currentDevice.ipAddress}
                </span>
              </div>
            )}
            
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden border-t border-gray-200">
          <div className="flex space-x-1 py-2">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar