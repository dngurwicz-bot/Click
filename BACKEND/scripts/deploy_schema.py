#!/usr/bin/env python3
"""
Script to deploy organizational structure schema to Supabase
"""
import os
from supabase import create_client, Client

# Supabase credentials from environment
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://ighrmrvhtgihhsaztmma.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

def read_sql_file(filepath):
    """Read SQL file content"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def execute_sql(supabase: Client, sql_content, description):
    """Execute SQL via Supabase REST API"""
    print(f"\n{'='*60}")
    print(f"Executing: {description}")
    print(f"{'='*60}")
    
    try:
        # Use the Supabase RPC to execute raw SQL
        result = supabase.rpc('exec_sql', {'query': sql_content}).execute()
        print(f"✅ Success: {description}")
        return True
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    """Main deployment function"""
    print("🚀 Starting Supabase Schema Deployment")
    print(f"Target: {SUPABASE_URL}")
    
    if not SUPABASE_SERVICE_KEY:
        print("❌ Error: SUPABASE_SERVICE_ROLE_KEY not set")
        print("Please set the environment variable or update the script")
        return
    
    # Initialize Supabase client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    # SQL files to execute in order
    sql_files = [
        ('BACKEND/scripts/01_organizational_structure.sql', 'Organizational Structure Tables'),
        ('BACKEND/scripts/02_organizational_structure_rls.sql', 'RLS Policies'),
    ]
    
    success_count = 0
    total_count = len(sql_files)
    
    for filepath, description in sql_files:
        full_path = os.path.join('/home/codespace/Click-2', filepath)
        
        if not os.path.exists(full_path):
            print(f"❌ File not found: {full_path}")
            continue
        
        sql_content = read_sql_file(full_path)
        
        if execute_sql(supabase, sql_content, description):
            success_count += 1
    
    print(f"\n{'='*60}")
    print(f"Deployment Summary: {success_count}/{total_count} successful")
    print(f"{'='*60}")
    
    if success_count == total_count:
        print("✅ All migrations deployed successfully!")
    else:
        print("⚠️  Some migrations failed. Please check the errors above.")

if __name__ == '__main__':
    main()
