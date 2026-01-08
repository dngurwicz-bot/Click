
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
    
    print("Checking columns for 'organizations' table:")
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'organizations';
    """)
    
    columns = cursor.fetchall()
    if not columns:
        print("Table 'organizations' not found!")
    else:
        for col in columns:
            print(f"- {col[0]} ({col[1]})")
            
    cursor.close()
    connection.close()

except Exception as e:
    print(f"Error: {e}")
