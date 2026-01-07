#!/bin/bash

echo "🔧 עזרה בעדכון משתני הסביבה"
echo ""
echo "1. פתח את Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/ighrmrvhtgihhsaztmma/settings/api"
echo ""
echo "2. מצא את ה-'anon public' key (לא service_role!)"
echo ""
echo "3. העתק את המפתח"
echo ""
read -p "4. הדבק את המפתח כאן: " SUPABASE_KEY

if [ -z "$SUPABASE_KEY" ]; then
    echo "❌ לא הוזן מפתח. ביטול."
    exit 1
fi

# Update .env.local
cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ighrmrvhtgihhsaztmma.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF

echo ""
echo "✅ הקובץ .env.local עודכן!"
echo ""
echo "הרץ: npm run dev"
echo ""
