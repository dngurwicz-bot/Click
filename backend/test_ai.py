import asyncio
import os
import sys

# Append the current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

def test_ai():
    print("Testing AI Assistant Endpoint...")
    client = TestClient(app)
    
    payload = {
        "messages": [
            {"role": "user", "content": "שלום! איך קוראים לך?"}
        ]
    }
    
    response = client.post("/api/ai/chat", json=payload)
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Response received successfully!")
        print("Assistant says:")
        print(response.json()["content"])
    else:
        print("Error:")
        try:
            print(response.json())
        except:
            print(response.text)

if __name__ == "__main__":
    test_ai()
