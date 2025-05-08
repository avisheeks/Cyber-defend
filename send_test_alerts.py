import requests
import json
import uuid
import time
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:8000"
SEVERITIES = ["low", "medium", "high", "critical"]
THREAT_TYPES = [
    "Suspicious Network Traffic", 
    "Unauthorized Port Access", 
    "Resource Usage Spike",
    "Unusual Login Attempt",
    "Potential Data Exfiltration",
    "Unknown Process Execution"
]

def send_test_alert(severity, threat_type, description):
    """Send a test alert to the backend server"""
    test_alert = {
        "id": str(uuid.uuid4()),
        "threat_type": threat_type,
        "severity": severity,
        "timestamp": datetime.now().isoformat(),
        "status": "open",
        "device_id": "test-device",
        "description": description,
        "metrics": {
            "confidence": 0.65 + (SEVERITIES.index(severity) * 0.1),
            "top_features": ["unusual_traffic", "port_scan", "cpu_usage"]
        }
    }
    
    try:
        print(f"Sending {severity} alert: {threat_type}")
        response = requests.post(f"{BACKEND_URL}/api/alert", json=test_alert)
        
        if response.status_code == 200:
            print(f"✅ Alert sent successfully: {response.json()}")
            return True
        else:
            print(f"❌ Failed to send alert: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error sending alert: {e}")
        return False

def main():
    print("="*80)
    print("🚨 TEST ALERT GENERATOR")
    print("="*80)
    
    # Check if backend is running
    try:
        response = requests.get(BACKEND_URL)
        if response.status_code != 200:
            print(f"❌ Backend not available at {BACKEND_URL}")
            return
        print(f"✅ Backend is running at {BACKEND_URL}")
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        return
    
    # Send test alerts with different severities
    print("\nSending test alerts with various severities...\n")
    
    for i, severity in enumerate(SEVERITIES):
        threat_type = THREAT_TYPES[i % len(THREAT_TYPES)]
        description = f"This is a test {severity} alert for {threat_type.lower()} detection"
        
        if send_test_alert(severity, threat_type, description):
            # Wait briefly between alerts
            print(f"Waiting 2 seconds before next alert...\n")
            time.sleep(2)
    
    print("\n="*80)
    print("✅ TEST COMPLETE")
    print("="*80)
    print("\nCheck your frontend dashboard to see if alerts appear")
    print("If alerts show in the backend logs but not in the frontend:")
    print("1. Check browser console for WebSocket messages")
    print("2. Verify the WebSocket connection is established")
    print("3. Make sure the Dashboard component is correctly handling alerts")

if __name__ == "__main__":
    main() 