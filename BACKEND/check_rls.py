
import psycopg2
from dotenv import load_dotenv
import os

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
    cursor = connection.cursor()
    
    # Check if RLS is enabled
    print("Checking if RLS is enabled on 'organizations':")
    cursor.execute("""
        SELECT relname, relrowsecurity 
        FROM pg_class 
        WHERE relname = 'organizations';
    """)
    rls_status = cursor.fetchone()
    if rls_status:
        print(f"Table: {rls_status[0]}, RLS Enabled: {rls_status[1]}")
    else:
        print("Table 'organizations' not found.")

    # List policies
    print("\nExisting Policies on 'organizations':")
    cursor.execute("""
        SELECT policyname, roles, cmd, qual, with_check 
        FROM pg_policies 
        WHERE tablename = 'organizations';
    """)
    policies = cursor.fetchall()
    if not policies:
        print("No policies found.")
    else:
        for p in policies:
            print(f"- Name: {p[0]}")
            print(f"  Roles: {p[1]}")
            print(f"  Command: {p[2]}")
            print(f"  Qual: {p[3]}")
            print(f"  With Check: {p[4]}")
            print("-" * 20)
            
    cursor.close()
    connection.close()

except Exception as e:
    print(f"Error: {e}")
