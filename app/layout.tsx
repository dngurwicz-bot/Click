import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Click HR - ניהול משאבי אנוש',
  description: 'מערכת SAAS לניהול משאבי אנוש',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
