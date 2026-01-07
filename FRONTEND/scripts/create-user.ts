import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env.local')
console.log('Loading env from:', envPath)
dotenv.config({ path: envPath })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Note: In a real scenario we need the service role key to admin update users.
// If the user only provided the ANON key in .env.local, we might be limited.
// However, the user claimed "Invalid login credentials", implying they tried to log in.
// If we only have the anon key, we can try to SignUp a new user (which might fail if email exists) or just log it.

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables!')
    console.log('URL:', supabaseUrl)
    console.log('Key length:', supabaseServiceKey?.length)
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function createOrUpdateUser() {
    const email = 'dngurwicz@gmail.com'
    const password = 'Spni2025!'

    console.log(`🔐 Processing user: ${email}`)

    try {
        // 1. Try to sign in first to see if user exists and password works
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (!signInError && signInData.user) {
            console.log('✅ User already exists and password is correct.')
            return
        }

        console.log('⚠️ Login failed or user does not exist. Attempting to create/update...')

        // 2. Since we might not have the Service Role Key (user only put Anon key in .env.local usually),
        // we can try to just SignUp.
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
        })

        if (signUpError) {
            console.error('❌ Sign up error:', signUpError.message)
            // If user already registered, signUp returns specific error or just a user with identities
            if (signUpError.message.includes('already registered')) {
                console.log('💡 User exists. Since we cannot reset password without Service Role Key (unless we use the reset flow), please check if you know the password.')
            }
        } else {
            console.log('✅ User signed up successfully (or confirmation email sent).')
            console.log('User ID:', signUpData.user?.id)
        }

    } catch (error: any) {
        console.error('❌ Unexpected error:', error.message)
    }
}

createOrUpdateUser()
