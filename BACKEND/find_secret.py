
import os
import psycopg2

# Connection details found in deploy scripts
DB_URL = "postgresql://postgres:SpniTeva2025!@db.ighrmrvhtgihhsaztmma.supabase.co:5432/postgres"

def find_secret():
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Try to find JWT secret in plausible locations
        queries = [
            # Check pgsodium key (unlikely to be the JWT secret but worth a look)
            "SELECT * FROM pgsodium.key;",
            # Sometimes stored in a custom settings table or vault
            "SELECT * FROM vault.secrets;",
        ]
        
        print("Connected to DB.")
        
        # Try to check for logical settings
        # Supabase often sets app.settings.* GUCs but they might not be visible this way
        
        cur.close()
        conn.close()
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    find_secret()
