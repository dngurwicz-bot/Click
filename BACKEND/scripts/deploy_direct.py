#!/usr/bin/env python3
"""
Deploy organizational structure schema to Supabase using direct database connection
"""
import os
import psycopg2
from psycopg2 import sql

# Database connection string from Supabase
DATABASE_URL = "postgresql://postgres:SpniTeva2025!@db.ighrmrvhtgihhsaztmma.supabase.co:5432/postgres"

def read_sql_file(filepath):
    """Read SQL file content"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def execute_sql(conn, sql_content, description):
    """Execute SQL via psycopg2"""
    print(f"\n{'='*60}")
    print(f"Executing: {description}")
    print(f"{'='*60}")
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql_content)
        conn.commit()
        cursor.close()
        print(f"✅ Success: {description}")
        return True
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        conn.rollback()
        return False

def main():
    """Main deployment function"""
    print("🚀 Starting Supabase Schema Deployment via Direct Connection")
    
    # SQL files to execute in order
    sql_files = [
        ('/home/codespace/Click-2/BACKEND/scripts/01_organizational_structure.sql', 'Organizational Structure Tables'),
        ('/home/codespace/Click-2/BACKEND/scripts/02_organizational_structure_rls.sql', 'RLS Policies'),
    ]
    
    try:
        # Connect to database
        print("Connecting to database...")
        conn = psycopg2.connect(DATABASE_URL)
        print("✅ Connected successfully!\n")
        
        success_count = 0
        total_count = len(sql_files)
        
        for filepath, description in sql_files:
            if not os.path.exists(filepath):
                print(f"❌ File not found: {filepath}")
                continue
            
            sql_content = read_sql_file(filepath)
            
            if execute_sql(conn, sql_content, description):
                success_count += 1
        
        conn.close()
        
        print(f"\n{'='*60}")
        print(f"Deployment Summary: {success_count}/{total_count} successful")
        print(f"{'='*60}")
        
        if success_count == total_count:
            print("✅ All migrations deployed successfully!")
        else:
            print("⚠️  Some migrations failed. Please check the errors above.")
    
    except Exception as e:
        print(f"❌ Connection Error: {str(e)}")
        print("\nPlease update the DATABASE_URL with the correct password from Supabase Dashboard")

if __name__ == '__main__':
    main()
