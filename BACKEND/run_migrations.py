import psycopg2
from dotenv import load_dotenv
import os

# Load environment variables from .env
load_dotenv()

# Fetch variables
USER = os.getenv("user")
PASSWORD = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")

def read_sql_file(filepath):
    """Read SQL file content"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def run_migration(cursor, connection, filepath, description):
    """Run a single migration file"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"{'='*60}")
    
    try:
        sql_content = read_sql_file(filepath)
        cursor.execute(sql_content)
        connection.commit()
        print(f"✅ Success: {description}")
        return True
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        connection.rollback()
        return False

# Connect to the database
try:
    print("🚀 Connecting to Supabase via Transaction Pooler...")
    connection = psycopg2.connect(
        user=USER,
        password=PASSWORD,
        host=HOST,
        port=PORT,
        dbname=DBNAME
    )
    print("✅ Connection successful!")
    print(f"Connected to: {HOST}:{PORT}")
    
    # Create a cursor to execute SQL queries
    cursor = connection.cursor()
    
    # Test query
    cursor.execute("SELECT NOW();")
    result = cursor.fetchone()
    print(f"Current Time: {result[0]}")
    
    # Run migrations
    print("\n" + "="*60)
    print("Starting Database Migrations")
    print("="*60)
    
    migrations = [
        ('scripts/01_organizational_structure_simple.sql', 'Organizational Structure Tables'),
        ('scripts/02_organizational_structure_rls.sql', 'RLS Policies'),
        ('scripts/05_add_organization_details.sql', 'Add Organization Details'),
        ('scripts/06_add_organization_insert_policy.sql', 'Add Organization Insert Policy'),
    ]
    
    success_count = 0
    for filepath, description in migrations:
        if run_migration(cursor, connection, filepath, description):
            success_count += 1
    
    print(f"\n{'='*60}")
    print(f"Migration Summary: {success_count}/{len(migrations)} successful")
    print(f"{'='*60}")
    
    if success_count == len(migrations):
        print("\n🎉 All migrations completed successfully!")
    else:
        print("\n⚠️  Some migrations failed. Check errors above.")

    # Close the cursor and connection
    cursor.close()
    connection.close()
    print("\n✅ Connection closed.")

except Exception as e:
    print(f"❌ Failed to connect: {e}")
