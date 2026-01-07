import psycopg2
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

USER = os.getenv("user")
PASSWORD = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")

try:
    connection = psycopg2.connect(
        user=USER,
        password=PASSWORD,
        host=HOST,
        port=PORT,
        dbname=DBNAME
    )
    print("✅ Connected successfully!")
    
    cursor = connection.cursor()
    
    # Check existing tables
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'organization_settings',
            'divisions',
            'departments',
            'positions',
            'position_levels',
            'employee_assignments'
        )
        ORDER BY table_name;
    """)
    
    existing_tables = cursor.fetchall()
    
    if existing_tables:
        print("\n⚠️  Found existing tables:")
        for table in existing_tables:
            print(f"  - {table[0]}")
        
        print("\n🗑️  Dropping existing tables...")
        
        # Drop tables in correct order (reverse dependency)
        drop_tables = [
            'employee_assignments',
            'position_levels',
            'positions',
            'departments',
            'divisions',
            'organization_settings'
        ]
        
        for table in drop_tables:
            try:
                cursor.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
                print(f"  ✓ Dropped {table}")
            except Exception as e:
                print(f"  ✗ Error dropping {table}: {e}")
        
        connection.commit()
        print("\n✅ All tables dropped successfully!")
    else:
        print("\n✅ No existing tables found. Ready for fresh migration.")
    
    cursor.close()
    connection.close()
    print("\n✅ Connection closed.")
    print("\nNow run: python3 run_migrations.py")

except Exception as e:
    print(f"❌ Error: {e}")
