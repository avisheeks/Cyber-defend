import requests
import json
import time
import uuid
import sys
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:8000"
TEST_ITERATIONS = 1  # How many test cycles to run

def print_header(message):
    print("\n" + "="*70)
    print(f" {message}")
    print("="*70)

def print_result(success, message):
    if success:
        print(f"✅ {message}")
    else:
        print(f"❌ {message}")

def test_backend_availability():
    print_header("Testing Backend Availability")
    try:
        response = requests.get(f"{BACKEND_URL}/")
        success = response.status_code == 200
        print_result(success, f"Backend is {'available' if success else 'unavailable'} at {BACKEND_URL}")
        return success
    except Exception as e:
        print_result(False, f"Error connecting to backend: {e}")
        return False

def test_create_alert():
    print_header("Testing Alert Creation")
    try:
        # Create a test alert
        test_alert = {
            "id": str(uuid.uuid4()),
            "threat_type": "Test Alert",
            "severity": "high",
            "timestamp": datetime.now().isoformat(),
            "status": "open",
            "device_id": "test-device",
            "description": f"This is a test alert created at {datetime.now().isoformat()}",
            "metrics": {
                "confidence": 0.95,
                "top_features": ["test1", "test2", "test3"]
            }
        }
        
        response = requests.post(f"{BACKEND_URL}/api/alert", json=test_alert)
        success = response.status_code == 200
        print_result(success, f"Alert creation API returned: {response.status_code}")
        
        if success:
            print(f"Alert details: {json.dumps(test_alert, indent=2)}")
            print("If your frontend is connected to the WebSocket, you should see this alert appear now.")
        
        return success
    except Exception as e:
        print_result(False, f"Error creating alert: {e}")
        return False

def test_backend_test_alert():
    print_header("Testing Backend Test Alert Endpoint")
    try:
        response = requests.get(f"{BACKEND_URL}/test-alert")
        success = response.status_code == 200
        print_result(success, f"Test alert endpoint returned: {response.status_code}")
        
        if success:
            print(f"Test alert created: {json.dumps(response.json(), indent=2)}")
            print("If your frontend is connected to the WebSocket, you should see this test alert appear now.")
        
        return success
    except Exception as e:
        print_result(False, f"Error creating test alert: {e}")
        return False

def test_existing_alerts():
    print_header("Checking Existing Alerts")
    try:
        response = requests.get(f"{BACKEND_URL}/alerts")
        success = response.status_code == 200
        alerts = response.json() if success else []
        print_result(success, f"Found {len(alerts)} existing alerts")
        
        if success and alerts:
            print(f"Latest alert: {json.dumps(alerts[0], indent=2)}")
        
        return success
    except Exception as e:
        print_result(False, f"Error checking alerts: {e}")
        return False

def run_tests():
    print_header("REAL-TIME CYBERSECURITY MONITORING SYSTEM TEST")
    print("This script will test if your alerts are being properly displayed in the frontend.")
    print("Make sure both backend and frontend are running before running this test.")
    
    # Test backend availability
    if not test_backend_availability():
        print("\n⚠️  Backend is not available. Please start the backend server first with:")
        print("    cd backend && uvicorn app:app --reload")
        return
    
    # Check existing alerts
    test_existing_alerts()
    
    # Run tests
    for i in range(TEST_ITERATIONS):
        if i > 0:
            time.sleep(3)  # Wait between iterations
        
        # Test backend test alert endpoint
        test_backend_test_alert()
        
        time.sleep(1)
        
        # Test direct alert creation
        test_create_alert()
    
    print_header("TEST COMPLETE")
    print("If alerts are working correctly, you should see them in your frontend.")
    print("If not, check:")
    print("1. Frontend console for WebSocket connection errors")
    print("2. Backend logs for any errors processing alerts")
    print("3. Make sure your frontend is connecting to ws://localhost:8000/ws")

if __name__ == "__main__":
    run_tests() 