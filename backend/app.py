from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, BackgroundTasks, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import uuid
import json
import time
import asyncio
from datetime import datetime, timedelta
import logging
import os
from collections import deque
from pydantic import BaseModel

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="Real-Time Cybersecurity Monitoring API")

# Add CORS middleware to allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager with improved handling
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_timestamps: Dict[str, datetime] = {}
        self.stats = {
            "total_connections": 0,
            "total_disconnections": 0,
            "messages_sent": 0,
            "errors": 0
        }

    async def connect(self, websocket: WebSocket, client_id: str = None):
        """Connect a client with better tracking and error handling"""
        try:
            await websocket.accept()
            
            # Generate client ID if not provided
            if client_id is None:
                client_id = str(uuid.uuid4())
                
            # Store connection with its ID
            self.active_connections[client_id] = websocket
            self.connection_timestamps[client_id] = datetime.now()
            self.stats["total_connections"] += 1
            
            logger.info(f"Client connected: {client_id} - Now {len(self.active_connections)} active connections")
            return client_id
            
        except Exception as e:
            logger.error(f"Error accepting WebSocket connection: {e}")
            self.stats["errors"] += 1
            return None

    def disconnect(self, client_id: str):
        """Disconnect a client by ID with cleanup"""
        if client_id in self.active_connections:
            self.active_connections.pop(client_id, None)
            self.connection_timestamps.pop(client_id, None)
            self.stats["total_disconnections"] += 1
            
            # Log connection duration if available
            if client_id in self.connection_timestamps:
                duration = datetime.now() - self.connection_timestamps[client_id]
                logger.info(f"Client disconnected: {client_id} - Connection duration: {duration} - Now {len(self.active_connections)} active connections")
            else:
                logger.info(f"Client disconnected: {client_id} - Now {len(self.active_connections)} active connections")

    async def broadcast(self, message: str):
        """Broadcast a message to all connected clients with better error handling"""
        disconnected_clients = []
        self.stats["messages_sent"] += 1
        
        for client_id, connection in self.active_connections.items():
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error sending to client {client_id}: {e}")
                self.stats["errors"] += 1
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)
            
        if disconnected_clients:
            logger.info(f"Removed {len(disconnected_clients)} disconnected clients during broadcast")
            
        return len(self.active_connections) - len(disconnected_clients)

    async def send_to_client(self, client_id: str, message: str):
        """Send message to a specific client"""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(message)
                return True
            except Exception as e:
                logger.error(f"Error sending to client {client_id}: {e}")
                self.disconnect(client_id)
                self.stats["errors"] += 1
                return False
        return False

    def get_connection_info(self):
        """Get information about current connections"""
        connection_info = []
        for client_id, _ in self.active_connections.items():
            connected_at = self.connection_timestamps.get(client_id, "unknown")
            if isinstance(connected_at, datetime):
                duration = datetime.now() - connected_at
                duration_str = str(duration).split('.')[0]  # Remove microseconds
            else:
                duration_str = "unknown"
                
            connection_info.append({
                "client_id": client_id,
                "connected_at": str(connected_at),
                "connection_duration": duration_str
            })
            
        return {
            "active_connections": len(self.active_connections),
            "connections": connection_info,
            "stats": self.stats
        }

manager = ConnectionManager()

# Network clients use a more efficient structure
class NetworkConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_timestamps: Dict[str, datetime] = {}
        self.stats = {
            "total_connections": 0,
            "total_disconnections": 0,
            "messages_sent": 0,
            "errors": 0
        }

    async def connect(self, websocket: WebSocket):
        """Connect a network monitoring client"""
        try:
            await websocket.accept()
            client_id = str(uuid.uuid4())
            self.active_connections[client_id] = websocket
            self.connection_timestamps[client_id] = datetime.now()
            self.stats["total_connections"] += 1
            
            logger.info(f"Network client connected: {client_id} - Now {len(self.active_connections)} active network connections")
            return client_id
            
        except Exception as e:
            logger.error(f"Error accepting network WebSocket connection: {e}")
            self.stats["errors"] += 1
            return None

    def disconnect(self, client_id: str):
        """Disconnect a network client"""
        if client_id in self.active_connections:
            self.active_connections.pop(client_id, None)
            
            # Log connection duration if available
            if client_id in self.connection_timestamps:
                duration = datetime.now() - self.connection_timestamps.get(client_id)
                self.connection_timestamps.pop(client_id, None)
                self.stats["total_disconnections"] += 1
                logger.info(f"Network client disconnected: {client_id} - Connection duration: {duration} - Now {len(self.active_connections)} active network connections")
            else:
                logger.info(f"Network client disconnected: {client_id} - Now {len(self.active_connections)} active network connections")

    async def broadcast(self, message: str):
        """Broadcast network data to all connected clients"""
        disconnected_clients = []
        self.stats["messages_sent"] += 1
        
        for client_id, connection in self.active_connections.items():
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error sending to network client {client_id}: {e}")
                self.stats["errors"] += 1
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)
            
        if disconnected_clients:
            logger.info(f"Removed {len(disconnected_clients)} disconnected network clients during broadcast")
            
        return len(self.active_connections) - len(disconnected_clients)

    def get_connection_info(self):
        """Get information about current network connections"""
        connection_info = []
        for client_id in self.active_connections:
            connected_at = self.connection_timestamps.get(client_id, "unknown")
            if isinstance(connected_at, datetime):
                duration = datetime.now() - connected_at
                duration_str = str(duration).split('.')[0]  # Remove microseconds
            else:
                duration_str = "unknown"
                
            connection_info.append({
                "client_id": client_id,
                "connected_at": str(connected_at),
                "connection_duration": duration_str
            })
            
        return {
            "active_connections": len(self.active_connections),
            "connections": connection_info,
            "stats": self.stats
        }

# Initialize network connection manager
network_manager = NetworkConnectionManager()

# Data models
class AlertUpdate(BaseModel):
    status: str

class NetworkData(BaseModel):
    inbound_traffic: Dict[str, Any]
    outbound_traffic: Dict[str, Any]
    packet_rate: Optional[Dict[str, Any]] = None
    active_connections: Optional[Dict[str, Any]] = None
    # System metrics
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    memory_used: Optional[float] = None
    memory_total: Optional[float] = None
    process_count: Optional[int] = None
    top_processes: Optional[List[Dict[str, Any]]] = None

# In-memory storage for real data
alerts = []
alert_history = deque(maxlen=1000)  # Store last 1000 alerts

# Network monitoring data storage
network_data = {
    "inbound_traffic": deque(maxlen=100),  # Last 100 data points
    "outbound_traffic": deque(maxlen=100),
    "packet_rate": deque(maxlen=100),
    "active_connections": deque(maxlen=100),
    "warnings": deque(maxlen=50)  # Last 50 warning events
}

# Status options for alerts
STATUS_OPTIONS = ["open", "investigating", "resolved"]

# Helper functions
async def broadcast_alert(alert):
    """Broadcast an alert to all connected websocket clients"""
    try:
        # Log the alert being broadcasted
        logger.info(f"Broadcasting alert to {len(manager.active_connections)} clients: {alert['threat_type']} (ID: {alert['id']})")
        
        # Ensure the alert has all required fields for frontend
        formatted_alert = {
            "id": alert["id"],
            "threat_type": alert["threat_type"],
            "severity": alert["severity"],
            "timestamp": alert["timestamp"],
            "status": alert.get("status", "open"),
            "device_id": alert.get("device_id", "unknown"),
            "description": alert.get("description", "No description provided"),
        }
        
        # Add metrics if present
        if "metrics" in alert:
            formatted_alert["metrics"] = alert["metrics"]
        elif "confidence" in alert:
            # Handle legacy format
            formatted_alert["metrics"] = {
                "confidence": alert["confidence"]
            }
        
        # Create the message with proper type field
        message = {
            "type": "alert", 
            "data": formatted_alert
        }
        
        # Convert to JSON and broadcast
        json_message = json.dumps(message)
        logger.info(f"Sending WebSocket message: {json_message[:200]}...")
        active_clients = await manager.broadcast(json_message)
        
        # Log success
        logger.info(f"Successfully broadcasted alert {alert['id']} to {active_clients} clients")
        return True
    except Exception as e:
        logger.error(f"Error broadcasting alert: {e}")
        return False

async def broadcast_network_data(data):
    """Broadcast network data to connected websocket clients"""
    try:
        message = json.dumps({"type": "update", "data": data})
        active_clients = await network_manager.broadcast(message)
        logger.debug(f"Network data broadcast to {active_clients} clients")
        return active_clients
    except Exception as e:
        logger.error(f"Error broadcasting network data: {e}")
        return 0

# API for receiving data from windows10_monitor.py
@app.post("/api/network-data")
async def receive_network_data(data: NetworkData):
    """Receive real network data from the Windows monitoring agent"""
    try:
        # Store received data
        if data.inbound_traffic:
            network_data["inbound_traffic"].append(data.inbound_traffic)
        
        if data.outbound_traffic:
            network_data["outbound_traffic"].append(data.outbound_traffic)
        
        if data.packet_rate:
            network_data["packet_rate"].append(data.packet_rate)
        
        if data.active_connections:
            network_data["active_connections"].append(data.active_connections)
        
        # Prepare update message
        update_data = {
            "inbound_traffic": data.inbound_traffic,
            "outbound_traffic": data.outbound_traffic,
            "packet_rate": data.packet_rate,
            "active_connections": data.active_connections
        }
        
        # Broadcast to connected clients
        await broadcast_network_data(update_data)
        
        logger.info("Received and broadcast real network data from agent")
        return {"status": "success"}
    
    except Exception as e:
        logger.error(f"Error processing network data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/alert")
async def receive_alert(alert: Dict[str, Any]):
    """Receive real alerts from the Windows monitoring agent"""
    try:
        logger.info(f"Received alert request: {json.dumps(alert)}")
        
        # Ensure alert has required fields
        if not all(key in alert for key in ["id", "threat_type", "severity", "timestamp"]):
            logger.error(f"Invalid alert format missing required fields: {json.dumps(alert)}")
            raise HTTPException(status_code=400, detail="Invalid alert format")
        
        # Add to alerts and history
        alerts.insert(0, alert)  # Add to beginning (newest first)
        alert_history.append(alert)
        
        logger.info(f"Alert added to memory: {alert['threat_type']} ({alert['severity']})")
        
        # Broadcast to clients
        await broadcast_alert(alert)
        
        logger.info(f"Finished processing alert: {alert['threat_type']}")
        return {"status": "success"}
    
    except Exception as e:
        logger.error(f"Error processing alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/alerts")
async def debug_alerts():
    """Debug endpoint to check all alerts in memory"""
    return {
        "active_websocket_connections": len(manager.active_connections),
        "total_alerts_in_memory": len(alerts),
        "most_recent_alert": alerts[0] if alerts else None,
        "alert_history_size": len(alert_history)
    }

# Debug endpoint for WebSocket connections
@app.get("/debug/connections")
async def debug_connections():
    """Debug endpoint to check WebSocket connections"""
    return {
        "alert_websockets": manager.get_connection_info(),
        "network_websockets": network_manager.get_connection_info()
    }

# Start the background tasks when app starts
@app.on_event("startup")
async def startup_event():
    logger.info("Backend started - ONLY processing REAL data from monitoring agent")

# API Endpoints
@app.get("/")
async def root():
    return {"message": "Real-Time Cybersecurity Monitoring API"}

@app.get("/test-alert")
async def test_alert():
    """Create a test alert to check frontend connectivity"""
    try:
        test_alert = {
            "id": str(uuid.uuid4()),
            "threat_type": "Test Alert",
            "severity": "medium",
            "timestamp": datetime.now().isoformat(),
            "status": "open",
            "device_id": "test-device",
            "description": "This is a test alert to verify WebSocket connectivity",
            "metrics": {
                "confidence": 0.85,
                "top_features": ["test1", "test2", "test3"]
            }
        }
        
        # Add to alerts list
        alerts.insert(0, test_alert)
        alert_history.append(test_alert)
        
        # Broadcast to all connected clients
        await broadcast_alert(test_alert)
        
        logger.info("Test alert created and broadcasted")
        return {"status": "success", "message": "Test alert created", "alert": test_alert}
    except Exception as e:
        logger.error(f"Error creating test alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/alerts")
async def get_alerts(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    severity: Optional[str] = None,
    status: Optional[str] = None
):
    filtered_alerts = alerts
    
    if severity:
        filtered_alerts = [a for a in filtered_alerts if a["severity"] == severity]
    
    if status:
        filtered_alerts = [a for a in filtered_alerts if a["status"] == status]
    
    # Apply pagination
    return filtered_alerts[offset:offset + limit]

@app.get("/alerts/{alert_id}")
async def get_alert(alert_id: str):
    for alert in alerts:
        if alert["id"] == alert_id:
            return alert
    raise HTTPException(status_code=404, detail="Alert not found")

@app.put("/alerts/{alert_id}/status")
async def update_alert_status(alert_id: str, update: AlertUpdate):
    for alert in alerts:
        if alert["id"] == alert_id:
            if update.status not in STATUS_OPTIONS:
                raise HTTPException(status_code=400, detail="Invalid status value")
            
            alert["status"] = update.status
            
            # Broadcast update to all connected clients
            await broadcast_alert(alert)
            
            return {"message": "Status updated", "alert": alert}
    
    raise HTTPException(status_code=404, detail="Alert not found")

@app.get("/dashboard/summary")
async def get_dashboard_summary():
    total_alerts = len(alerts)
    open_alerts = len([a for a in alerts if a["status"] == "open"])
    critical_alerts = len([a for a in alerts if a["severity"] == "critical" and a["status"] == "open"])
    
    # Calculate a security score based on real alerts
    severity_weights = {"low": 1, "medium": 3, "high": 5, "critical": 10}
    severity_counts = {}
    
    for severity in ["low", "medium", "high", "critical"]:
        severity_counts[severity] = len([a for a in alerts if a.get("severity") == severity and a.get("status") == "open"])
    
    # Lower is better for security score
    weighted_sum = sum(severity_counts[s] * severity_weights[s] for s in severity_counts.keys())
    
    # Convert to a 0-100 score where 100 is best
    security_score = max(0, 100 - min(weighted_sum * 2, 100))
    
    # Analyze alerts over time (last 24 hours)
    current_time = datetime.now()
    hours_ago_24 = current_time - timedelta(hours=24)
    
    alerts_by_hour = []
    for i in range(24):
        hour_start = hours_ago_24 + timedelta(hours=i)
        hour_end = hours_ago_24 + timedelta(hours=i+1)
        
        count = len([
            a for a in alert_history 
            if "timestamp" in a and hour_start <= datetime.fromisoformat(a["timestamp"]) < hour_end
        ])
        
        alerts_by_hour.append({
            "hour": (current_time - timedelta(hours=24-i)).hour,
            "count": count
        })
    
    return {
        "total_alerts": total_alerts,
        "open_alerts": open_alerts,
        "critical_alerts": critical_alerts,
        "security_score": security_score,
        "alerts_by_hour": alerts_by_hour
    }

# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = await manager.connect(websocket)
    
    if not client_id:
        return  # Connection failed
        
    try:
        # Send initial alert data
        initial_data = {"type": "initial", "alerts": alerts[:50]}  # Send last 50 alerts
        await websocket.send_text(json.dumps(initial_data))
        logger.info(f"Sent initial alerts to client {client_id}")
        
        # Keep connection open and handle messages
        while True:
            data = await websocket.receive_text()
            logger.debug(f"Received message from client {client_id}: {data[:100]}...")
            
            # Process client messages if needed
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "timestamp": datetime.now().isoformat()}))
            except:
                pass
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: Client {client_id}")
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error with client {client_id}: {e}")
        manager.disconnect(client_id)

# WebSocket endpoint for real-time network monitoring data
@app.websocket("/ws/network")
async def network_websocket_endpoint(websocket: WebSocket):
    client_id = await network_manager.connect(websocket)
    
    if not client_id:
        return  # Connection failed
        
    try:
        # Send initial dataset when a client connects
        initial_data = {
            "inbound_traffic": list(network_data["inbound_traffic"]),
            "outbound_traffic": list(network_data["outbound_traffic"]),
            "packet_rate": list(network_data["packet_rate"]),
            "active_connections": list(network_data["active_connections"]),
            "warnings": list(network_data["warnings"]),
            "type": "initial"
        }
        await websocket.send_text(json.dumps(initial_data))
        logger.info(f"Sent initial network data to client {client_id}")
        
        # Keep the connection open and handle incoming messages
        while True:
            data = await websocket.receive_text()
            logger.debug(f"Received message from network client {client_id}: {data[:100]}...")
            
            # Process client messages - handle ping/pong for connection health checks
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "timestamp": datetime.now().isoformat()}))
            except:
                pass
                
    except WebSocketDisconnect:
        logger.info(f"Network WebSocket disconnected: Client {client_id}")
        network_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"Network WebSocket error with client {client_id}: {e}")
        network_manager.disconnect(client_id) 