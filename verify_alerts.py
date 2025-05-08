import requests
import json
import websocket
import threading
import time
import uuid
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws"

received_messages = []

def on_message(ws, message):
    print(f"\n🔔 RECEIVED WEBSOCKET MESSAGE: {message[:100]}...")
    received_messages.append(json.loads(message))
    
def on_error(ws, error):
    print(f"❌ WebSocket error: {error}")
    
def on_close(ws, close_status_code, close_msg):
    print("📴 WebSocket connection closed")
    
def on_open(ws):
    print("📡 WebSocket connected")

def check_backend_status():
    """Check if the backend is running and has alerts"""
    try:
        # Check if server is up
        response = requests.get(f"{BACKEND_URL}/")
        if response.status_code != 200:
            print(f"❌ Backend not available: {response.status_code}")
            return False
            
        print(f"✅ Backend is running at {BACKEND_URL}")
        
        # Check debug endpoint
        response = requests.get(f"{BACKEND_URL}/debug/alerts")
        if response.status_code != 200:
            print(f"❌ Debug endpoint error: {response.status_code}")
            return False
            
        debug_info = response.json()
        print(f"\n🔍 DEBUG INFO:")
        print(f"  Active WebSocket connections: {debug_info['active_websocket_connections']}")
        print(f"  Total alerts in memory: {debug_info['total_alerts_in_memory']}")
        print(f"  Alert history size: {debug_info['alert_history_size']}")
        
        if debug_info["most_recent_alert"]:
            print(f"\n📊 MOST RECENT ALERT:")
            print(json.dumps(debug_info["most_recent_alert"], indent=2))
        else:
            print("❌ No alerts in memory")
            
        # Check alerts endpoint
        response = requests.get(f"{BACKEND_URL}/alerts")
        if response.status_code != 200:
            print(f"❌ Alerts endpoint error: {response.status_code}")
            return False
            
        alerts = response.json()
        print(f"\n🚨 FOUND {len(alerts)} ALERTS")
        
        return True
    except Exception as e:
        print(f"❌ Error checking backend: {e}")
        return False

def create_test_alert():
    """Create a test alert via the API"""
    try:
        alert_data = {
            "id": str(uuid.uuid4()),
            "threat_type": "TEST ALERT",
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
        
        headers = {
            "Content-Type": "application/json"
        }
        
        print(f"\n📤 SENDING TEST ALERT:")
        print(json.dumps(alert_data, indent=2))
        
        response = requests.post(f"{BACKEND_URL}/api/alert", json=alert_data, headers=headers)
        
        if response.status_code == 200:
            print(f"✅ Alert sent successfully: {response.json()}")
            return True
        else:
            print(f"❌ Failed to send alert: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating alert: {e}")
        return False

def main():
    print("="*80)
    print("🔍 ALERT VERIFICATION TOOL")
    print("="*80)
    
    if not check_backend_status():
        print("\n❌ Backend checks failed. Make sure backend is running.")
        return
        
    # Start WebSocket client
    ws = websocket.WebSocketApp(
        WS_URL,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    
    # Run WebSocket in a separate thread
    ws_thread = threading.Thread(target=ws.run_forever)
    ws_thread.daemon = True
    ws_thread.start()
    
    # Wait for WebSocket to connect
    time.sleep(2)
    
    # Create a test alert
    if create_test_alert():
        print("\n🕒 Waiting for WebSocket messages...")
        time.sleep(5)
        
        if received_messages:
            print(f"\n✅ RECEIVED {len(received_messages)} WEBSOCKET MESSAGES:")
            for idx, msg in enumerate(received_messages):
                print(f"\nMessage {idx+1}:")
                print(json.dumps(msg, indent=2))
        else:
            print("\n❌ No WebSocket messages received after sending alert")
    
    # Check backend status again
    time.sleep(1)
    check_backend_status()
    
    # Clean up
    ws.close()
    
    print("\n="*80)
    print("VERIFICATION COMPLETE")
    print("="*80)
    
    if not received_messages:
        print("\n⚠️ ALERT ISSUE DETECTED:")
        print("  1. Alerts are being stored in the backend")
        print("  2. But NO WebSocket messages are being received")
        print("  3. Check the broadcast_alert function in app.py")
        print("  4. Make sure frontend is connected to ws://localhost:8000/ws")
    
if __name__ == "__main__":
    main() 