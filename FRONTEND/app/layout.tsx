import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Click HR - ניהול משאבי אנוש',
  description: 'מערכת SAAS מקצועית לניהול משאבי אנוש',
  keywords: ['HR', 'משאבי אנוש', 'ניהול עובדים', 'SAAS'],
  authors: [{ name: 'Click HR' }],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
