from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import uvicorn
from typing import Dict, List, Any, Optional
import os
import datetime
import time
import traceback
import threading

# Import our detector
from windows10_monitor import Windows10ThreatDetector, collect_system_metrics

# Import our threat monitor
from windows10_monitor import Windows10Monitor

app = FastAPI(title="Edge Sentinel API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detector
detector = Windows10ThreatDetector(threshold=0.8)

# Store for connected clients
connected_clients: List[WebSocket] = []

# Detected threats history
threat_history = []

# System metrics history (for charts)
metrics_history = []

# Initialize our threat monitoring system
monitor = Windows10Monitor(interval=30)
alerts = []
active_websockets = []

# Background task to run the monitoring
def run_monitor_thread():
    # Instead of directly calling monitor.start() which blocks,
    # we'll create a custom monitoring loop that updates our alerts list
    monitor.running = True
    
    # Establish baseline first
    print("Establishing baseline...")
    monitor.establish_baseline()
    
    try:
        while monitor.running:
            # Collect metrics
            metrics = monitor.collect_system_metrics()
            
            # Detect threats
            threat_result = monitor.detect_threats(metrics)
            
            # If a threat is detected, create an alert and add to the list
            if threat_result["threat_detected"]:
                alert = create_alert(threat_result, metrics)
                alerts.append(alert)
                
                # Notify all connected WebSocket clients
                asyncio.run_coroutine_threadsafe(notify_clients(alert), asyncio.get_event_loop())
                
                # Log the alert
                print(f"THREAT DETECTED: {alert['threat_type']} (Score: {alert['threat_score']:.2f}, Severity: {alert['severity']})")
            
            # Sleep for the specified interval
            time.sleep(monitor.interval)
    
    except Exception as e:
        print(f"Error in monitoring thread: {str(e)}")
    finally:
        monitor.running = False

def create_alert(threat_result, metrics):
    """Create an alert from a threat detection result"""
    alert_id = f"THREAT-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    return {
        "id": alert_id,
        "timestamp": datetime.datetime.now().isoformat(),
        "threat_type": threat_result["threat_type"],
        "severity": monitor.determine_severity(threat_result["threat_score"]),
        "threat_score": threat_result["threat_score"],
        "anomalous_metrics": threat_result["anomalous_metrics"],
        "metrics": {k: metrics[k] for k in threat_result["anomalous_metrics"] if k in metrics},
        "status": "open",
        "source": "Windows Monitor"
    }

# Async function to notify WebSocket clients
async def notify_clients(alert):
    """Send an alert to all connected WebSocket clients"""
    if active_websockets:
        dead_sockets = []
        for websocket in active_websockets:
            try:
                await websocket.send_json(alert)
            except:
                dead_sockets.append(websocket)
        
        # Clean up any dead sockets
        for dead in dead_sockets:
            if dead in active_websockets:
                active_websockets.remove(dead)

# Start monitoring in a background thread
monitor_thread = threading.Thread(target=run_monitor_thread, daemon=True)
monitor_thread.start()

@app.get("/")
async def root():
    return {"message": "Edge Sentinel API is running"}

@app.get("/metrics")
async def get_current_metrics():
    """Get current system metrics"""
    metrics = collect_system_metrics()
    return metrics

@app.get("/metrics/history")
async def get_metrics_history(limit: int = 100):
    """Get historical system metrics"""
    return metrics_history[-limit:]

@app.get("/threats")
async def get_threats(limit: int = 10):
    """Get recent threats"""
    return threat_history[-limit:]

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    
    try:
        # Send initial data
        metrics = collect_system_metrics()
        result = detector.detect(metrics)
        await websocket.send_json({
            "type": "metrics",
            "data": {
                "metrics": metrics,
                "analysis": result,
                "timestamp": datetime.datetime.now().isoformat()
            }
        })
        
        # Keep connection alive
        while True:
            await asyncio.sleep(0.1)  # Just to keep the connection open
            
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if websocket in connected_clients:
            connected_clients.remove(websocket)

# Background task for monitoring
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(monitor_system_task())

async def monitor_system_task():
    """Background task to monitor system and broadcast updates"""
    while True:
        try:
            # Collect metrics
            metrics = collect_system_metrics()
            
            # Add timestamp
            current_time = datetime.datetime.now()
            metrics_with_time = {
                **metrics,
                "timestamp": current_time.isoformat()
            }
            
            # Add to history
            metrics_history.append(metrics_with_time)
            
            # Keep only last 200 metrics snapshots
            if len(metrics_history) > 200:
                metrics_history.pop(0)
            
            # Detect threats
            result = detector.detect(metrics)
            
            # Save threats to history
            if result["is_threat"]:
                threat_data = {
                    "id": len(threat_history),
                    "timestamp": current_time.isoformat(),
                    "confidence": result["confidence"],
                    "raw_probability": result["raw_probability"],
                    "top_features": result["top_features"][:5],
                    "metrics": {k: metrics[k] for k in result["top_features"][:5] if k in metrics}
                }
                threat_history.append(threat_data)
                
                # Keep only last 100 threats
                if len(threat_history) > 100:
                    threat_history.pop(0)
                    
                # Re-assign IDs
                for i, threat in enumerate(threat_history):
                    threat["id"] = i
            
            # Broadcast to all clients
            if connected_clients:
                message = {
                    "type": "update",
                    "data": {
                        "metrics": metrics,
                        "analysis": result,
                        "timestamp": current_time.isoformat()
                    }
                }
                
                for client in list(connected_clients):
                    try:
                        await client.send_json(message)
                    except Exception:
                        # Client disconnected
                        if client in connected_clients:
                            connected_clients.remove(client)
            
            # Wait before next check
            await asyncio.sleep(3)  # Check every 3 seconds
            
        except Exception as e:
            print(f"Monitoring error: {e}")
            print(traceback.format_exc())
            await asyncio.sleep(3)  # Continue despite errors

# Endpoint to get a specific threat by ID
@app.get("/threats/{threat_id}")
async def get_threat_by_id(threat_id: int):
    for threat in threat_history:
        if threat["id"] == threat_id:
            return threat
    raise HTTPException(status_code=404, detail="Threat not found")

# Endpoint to manually trigger a simulated threat (for testing)
@app.post("/simulate/threat")
async def simulate_threat():
    # Get current metrics
    metrics = collect_system_metrics()
    
    # Modify metrics to simulate a threat
    metrics["type"] = 1  # Set to attack
    
    # Get top features from model
    top_features = detector.metadata['top_features']
    
    # Modify top features to trigger detection
    for feature in top_features[:3]:
        if feature in metrics and feature != "ts" and feature != "type":
            metrics[feature] *= 10
    
    # Run detection
    result = detector.detect(metrics)
    
    # Return the result
    return {
        "success": True,
        "is_threat": result["is_threat"],
        "confidence": result["confidence"],
        "modified_features": top_features[:3]
    }

@app.get("/alerts")
async def get_alerts(limit: int = 100):
    """Get recent alerts"""
    return sorted(alerts, key=lambda x: x["timestamp"], reverse=True)[:limit]

@app.get("/alerts/{alert_id}")
async def get_alert(alert_id: str):
    """Get a specific alert by ID"""
    for alert in alerts:
        if alert["id"] == alert_id:
            return alert
    raise HTTPException(status_code=404, detail="Alert not found")

@app.get("/dashboard/summary")
async def get_dashboard_summary():
    """Get summary statistics for the dashboard"""
    # Count alerts by severity
    critical = len([a for a in alerts if a["severity"] == "critical"])
    high = len([a for a in alerts if a["severity"] == "high"])
    medium = len([a for a in alerts if a["severity"] == "medium"])
    low = len([a for a in alerts if a["severity"] == "low"])
    
    # Count alerts today
    today = datetime.datetime.now().date()
    alerts_today = len([
        a for a in alerts 
        if datetime.datetime.fromisoformat(a["timestamp"]).date() == today
    ])
    
    # Count resolved alerts
    resolved = len([a for a in alerts if a.get("status") == "resolved"])
    
    return {
        "security_score": calculate_security_score(),
        "alerts_today": alerts_today,
        "critical_alerts": critical,
        "high_alerts": high,
        "medium_alerts": medium,
        "low_alerts": low,
        "total_alerts": len(alerts),
        "resolved_alerts": resolved,
        "monitored_devices": 1,
        "last_scan": datetime.datetime.now().isoformat()
    }

@app.get("/dashboard/threat-distribution")
async def get_threat_distribution():
    """Get threat distribution data for the dashboard charts"""
    # Count threats by type
    threat_types = {}
    for alert in alerts:
        threat_type = alert.get("threat_type", "Unknown")
        if threat_type in threat_types:
            threat_types[threat_type] += 1
        else:
            threat_types[threat_type] = 1
    
    # Convert to list of objects with percentages
    total = len(alerts) or 1  # Avoid division by zero
    result = []
    
    for type_name, count in threat_types.items():
        percentage = round((count / total) * 100)
        result.append({
            "type": type_name,
            "count": count,
            "percentage": percentage
        })
    
    # Sort by count (descending)
    return sorted(result, key=lambda x: x["count"], reverse=True)

@app.get("/threat-locations")
async def get_threat_locations():
    """Generate mock geo-locations for threats to display on the map"""
    # This would normally come from real data or IP geolocation
    # For demo purposes, we'll generate synthetic data
    return generate_mock_geo_data()

@app.get("/metrics/current")
async def get_current_metrics():
    """Get the current system metrics"""
    return monitor.current_metrics

def calculate_security_score():
    """Calculate a security score based on recent alerts and their severity"""
    if not alerts:
        return 100
    
    # Count alerts in the past 24 hours
    recent_alerts = [
        a for a in alerts
        if datetime.datetime.now() - datetime.datetime.fromisoformat(a["timestamp"]) < datetime.timedelta(hours=24)
    ]
    
    if not recent_alerts:
        return 95
    
    # Calculate weighted score
    weights = {
        "critical": 25,
        "high": 15,
        "medium": 8,
        "low": 3
    }
    
    penalties = sum(weights.get(a["severity"], 0) for a in recent_alerts)
    # Cap penalties and calculate score
    score = max(0, 100 - min(penalties, 100))
    return score

def generate_mock_geo_data():
    """Generate mock geographical threat data for the map visualization"""
    # Countries with coordinates
    countries = [
        {"name": "United States", "code": "US", "lat": 37.0902, "lng": -95.7129},
        {"name": "China", "code": "CN", "lat": 35.8617, "lng": 104.1954},
        {"name": "Russia", "code": "RU", "lat": 61.5240, "lng": 105.3188},
        {"name": "Brazil", "code": "BR", "lat": -14.2350, "lng": -51.9253},
        {"name": "India", "code": "IN", "lat": 20.5937, "lng": 78.9629},
        {"name": "Germany", "code": "DE", "lat": 51.1657, "lng": 10.4515},
        {"name": "United Kingdom", "code": "GB", "lat": 55.3781, "lng": -3.4360},
        {"name": "Iran", "code": "IR", "lat": 32.4279, "lng": 53.6880},
        {"name": "North Korea", "code": "KP", "lat": 40.3399, "lng": 127.5101},
        {"name": "Ukraine", "code": "UA", "lat": 48.3794, "lng": 31.1656}
    ]
    
    # Threat types
    threat_types = [
        "DDoS Attack", "Brute Force", "Malware", "Data Breach", 
        "Ransomware", "Phishing", "SQL Injection", "Credential Theft"
    ]
    
    # Severity levels
    severity_levels = ["critical", "high", "medium", "low"]
    
    # Generate mock threat data based on real alerts
    mock_locations = []
    
    # Use real alerts for types if available
    for i, alert in enumerate(alerts[:15]):
        country = countries[i % len(countries)]
        
        # Add some randomness to coordinates
        import random
        lat_offset = (random.random() - 0.5) * 10
        lng_offset = (random.random() - 0.5) * 10
        
        mock_locations.append({
            "id": i + 1,
            "threat_type": alert.get("threat_type", random.choice(threat_types)),
            "country": country["name"],
            "country_code": country["code"],
            "latitude": country["lat"] + lat_offset,
            "longitude": country["lng"] + lng_offset,
            "severity": alert.get("severity", random.choice(severity_levels)),
            "timestamp": alert.get("timestamp", datetime.datetime.now().isoformat()),
            "count": random.randint(1, 50),
            "status": random.choice(["active", "inactive"]),
            "description": f"Suspicious activity detected from {country['name']} targeting system resources."
        })
    
    # Add more synthetic data if needed
    while len(mock_locations) < 25:
        i = len(mock_locations)
        country = countries[i % len(countries)]
        import random
        
        lat_offset = (random.random() - 0.5) * 10
        lng_offset = (random.random() - 0.5) * 10
        
        # Generate a timestamp between 1-7 days ago
        days_ago = random.randint(0, 7)
        hours_ago = random.randint(0, 24)
        timestamp = (datetime.datetime.now() - datetime.timedelta(days=days_ago, hours=hours_ago)).isoformat()
        
        mock_locations.append({
            "id": i + 1,
            "threat_type": random.choice(threat_types),
            "country": country["name"],
            "country_code": country["code"],
            "latitude": country["lat"] + lat_offset,
            "longitude": country["lng"] + lng_offset,
            "severity": random.choice(severity_levels),
            "timestamp": timestamp,
            "count": random.randint(1, 50),
            "status": random.choice(["active", "inactive"]),
            "description": f"Suspicious activity detected from {country['name']} targeting system resources."
        })
    
    return mock_locations

if __name__ == "__main__":
    print("Starting Edge Sentinel API...")
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True) 