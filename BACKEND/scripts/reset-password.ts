import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolve } from 'path'

// טען משתני סביבה
config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ משתני סביבה חסרים!')
  process.exit(1)
}

// נשתמש ב-service role key כדי לאפס סיסמה
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function resetPassword() {
  const email = 'dngurwicz@gmail.com'
  const newPassword = 'Spni2025!'

  console.log(`🔐 מאפס סיסמה עבור: ${email}\n`)

  try {
    // דרך 1: ננסה לעדכן את הסיסמה ישירות דרך Admin API
    // Supabase Admin API מאפשר לעדכן סיסמה ישירות
    
    const { data, error } = await supabase.auth.admin.updateUserById(
      '4c1b9735-1016-4a27-b037-761a6f15ae64',
      { password: newPassword }
    )

    if (error) {
      console.error('❌ שגיאה:', error.message)
      
      // ננסה דרך אחרת - ליצור משתמש חדש
      console.log('\n🔄 מנסה ליצור משתמש חדש...')
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: newPassword,
        email_confirm: true
      })

      if (createError) {
        console.error('❌ שגיאה ביצירת משתמש:', createError.message)
        console.log('\n💡 פתרון:')
        console.log('1. פתח Supabase Dashboard > Authentication > Users')
        console.log(`2. מצא את המשתמש ${email}`)
        console.log('3. לחץ על "Reset Password" או "Send Password Reset Email"')
        console.log('4. או עדכן את הסיסמה ישירות')
        return
      }

      console.log('✅ משתמש חדש נוצר:', newUser.user?.id)
      
      // קשר את המשתמש החדש לארגון
      const { error: linkError } = await supabase
        .from('users')
        .upsert({
          id: newUser.user!.id,
          organization_id: 'a3efec45-e005-493f-b27e-d3e709ed4de4',
          email: email,
          role: 'super_admin',
          full_name: 'מנהל מערכת'
        })

      if (linkError) {
        console.error('⚠️  שגיאה בקישור לארגון:', linkError.message)
      } else {
        console.log('✅ המשתמש קושר לארגון')
      }

    } else {
      console.log('✅ הסיסמה עודכנה בהצלחה!')
      console.log('\n📧 פרטי התחברות:')
      console.log(`   אימייל: ${email}`)
      console.log(`   סיסמה: ${newPassword}`)
    }

  } catch (error: any) {
    console.error('❌ שגיאה:', error.message)
    console.log('\n💡 פתרון ידני:')
    console.log('1. פתח: https://supabase.com/dashboard/project/ighrmrvhtgihhsaztmma/auth/users')
    console.log(`2. מצא את המשתמש ${email}`)
    console.log('3. לחץ על "..." > "Reset Password"')
    console.log(`4. הגדר סיסמה חדשה: ${newPassword}`)
  }
}

resetPassword()
