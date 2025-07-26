import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import PublicFileShare from './components/PublicFileShare'
import AdminInterface from './components/AdminInterface'
import SharePage from './components/SharePage'

function App() {
  return (
    <Routes>
      {/* Public file sharing interface (no API key required) */}
      <Route path="/" element={<PublicFileShare />} />
      
      {/* Individual file share page */}
      <Route path="/share/:fileId" element={<SharePage />} />
      
      {/* Admin interface (requires API key) */}
      <Route path="/admin/*" element={<AdminInterface />} />
      
      {/* Redirect unknown routes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App