// Quick script to check if environment variables are set correctly
require('dotenv').config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('\n🔍 בדיקת משתני סביבה:\n')
console.log('URL:', url || '❌ לא מוגדר')
console.log('Key exists:', key ? '✅ כן' : '❌ לא')
console.log('Key length:', key?.length || 0, 'תווים')
console.log('Key starts with:', key?.substring(0, 10) || 'N/A')

if (!key || key === 'your-anon-key-here') {
  console.log('\n⚠️  שגיאה: המפתח לא עודכן!')
  console.log('ערוך את הקובץ .env.local והחלף את המפתח.')
} else if (key.length < 100) {
  console.log('\n⚠️  אזהרה: המפתח נראה קצר מדי. ודא שהעתקת את כל המפתח.')
} else {
  console.log('\n✅ המפתח נראה תקין!')
}

console.log('\n')
