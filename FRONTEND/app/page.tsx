import Link from 'next/link'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { CardHeader, CardContent } from '@/components/ui/Card'
import { Users, Building2, FileText, Settings } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40" style={{ borderColor: 'var(--border-color)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo size="md" />
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="outline">דשבורד</Button>
              </Link>
              <Link href="/login">
                <Button variant="primary">התחברות</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Click HR
          </h1>
          <p className="text-xl mb-8" style={{ color: 'var(--text-secondary)' }}>
            מערכת SAAS מקצועית לניהול משאבי אנוש
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/dashboard">
              <Button variant="primary" size="lg">
                התחל עכשיו
              </Button>
            </Link>
            <Link href="/employees">
              <Button variant="outline" size="lg">
                עובדים
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <Card variant="elevated">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg" style={{ background: 'var(--accent-teal-light)' }}>
                  <Users size={24} style={{ color: 'var(--accent-teal)' }} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  ניהול עובדים
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                תיק עובד חכם עם פרופיל 360 מלא, פרטים אישיים, פרטי בנק ומשפחה
              </p>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg" style={{ background: 'var(--accent-teal-light)' }}>
                  <FileText size={24} style={{ color: 'var(--accent-teal)' }} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  מערכת אירועים
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                כל שינוי הוא אירוע עם היסטוריה מלאה וציר זמן מפורט
              </p>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg" style={{ background: 'var(--accent-teal-light)' }}>
                  <Building2 size={24} style={{ color: 'var(--accent-teal)' }} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  מבנה ארגוני
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                ניהול היררכיה, כפיפויות, אגפים ומחלקות
              </p>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg" style={{ background: 'var(--accent-teal-light)' }}>
                  <Settings size={24} style={{ color: 'var(--accent-teal)' }} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  מודולרי
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                מערכת מודולרית עם אפשרות להוסיף מודולים נוספים
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
