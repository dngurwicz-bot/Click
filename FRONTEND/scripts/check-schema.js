
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkColumns() {
    console.log('Checking columns for "updates" table...')

    // Method 1: Try to insert/select with the column
    const { data, error } = await supabase
        .from('updates')
        .select('is_global')
        .limit(1)

    if (error) {
        console.error('❌ Error selecting is_global:', error.message)
        console.log('   This confirms the column likely does NOT exist.')
    } else {
        console.log('✅ Successfully selected is_global column.')
    }

    // Method 2: RPC call (if exec_sql existed, but we can't rely on it)
    // Instead, let's just try to infer from the error above.
}

checkColumns()
