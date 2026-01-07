'use client'

import { useEffect, useState } from 'react'

export default function Home() {
  const [apiStatus, setApiStatus] = useState<string>('בודק...')
  const [backendUrl, setBackendUrl] = useState<string>('')

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        setBackendUrl(apiUrl)
        
        const response = await fetch(`${apiUrl}/health`)
        if (response.ok) {
          setApiStatus('✅ Backend מחובר')
        } else {
          setApiStatus('❌ Backend לא זמין')
        }
      } catch (error) {
        setApiStatus('❌ Backend לא זמין')
      }
    }
    
    checkBackend()
  }, [])

  return (
    <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#1a1a1a' }}>
          Click HR - ניהול משאבי אנוש
        </h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: '#666' }}>
          ברוכים הבאים למערכת ניהול משאבי אנוש
        </p>
        
        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px', marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>סטטוס המערכת</h2>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>Frontend:</strong> ✅ רץ על http://localhost:3000
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>Backend:</strong> {apiStatus}
          </div>
          {backendUrl && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
              Backend URL: {backendUrl}
            </div>
          )}
        </div>
        
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#1976d2' }}>
            💡 אם אתה לא רואה את הדף, ודא ש-Port Forwarding מוגדר ב-Cursor עבור פורט 3000
          </p>
        </div>
      </div>
    </div>
  )
}
