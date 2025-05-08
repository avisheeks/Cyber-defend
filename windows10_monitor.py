import os
import sys
import time
import json
import datetime
import psutil
import numpy as np
import lightgbm as lgb
import joblib
from pathlib import Path
import logging
import traceback
import subprocess
import requests
import socket
import uuid
import threading
from collections import deque

# Configure logging
logging.basicConfig(
    filename='threat_monitor.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Configuration
BACKEND_URL = "http://localhost:8000"
DEVICE_ID = str(uuid.uuid4())  # Generate a unique device ID
POLLING_INTERVAL = 1  # seconds
MAX_HISTORY = 100

# Storage for metrics history
metrics_history = {
    "network": deque(maxlen=MAX_HISTORY),
    "processes": deque(maxlen=MAX_HISTORY),
    "connections": deque(maxlen=MAX_HISTORY),
    "system": deque(maxlen=MAX_HISTORY)
}

class Windows10ThreatDetector:
    def __init__(self, model_dir='models', threshold=0.8):
        # Load model
        self.model_path = os.path.join(model_dir, 'windows10_threat_detector.lgb')
        self.model = lgb.Booster(model_file=self.model_path)
        
        # Load metadata
        with open(os.path.join(model_dir, 'windows10_threat_detector_metadata.json'), 'r') as f:
            self.metadata = json.load(f)
        
        self.feature_names = self.metadata['feature_names']
        self.is_binary = self.metadata['is_binary']
        
        # Custom threshold for reducing false positives (default is 0.5)
        self.threshold = threshold
        
        # Load scaler
        scaler_path = os.path.join(model_dir, 'windows10_threat_detector_scaler.pkl')
        try:
            self.scaler = joblib.load(scaler_path)
            logging.info("Scaler loaded successfully")
        except Exception as e:
            logging.warning(f"Could not load scaler: {e}")
            self.scaler = None
    
    def detect(self, metrics):
        # Prepare input data
        if isinstance(metrics, dict):
            # Get values in the correct order
            input_data = []
            for feature in self.feature_names:
                if feature in metrics:
                    input_data.append(metrics[feature])
                else:
                    input_data.append(0)
        else:
            # Assume array-like in correct order
            input_data = metrics
            
        # Convert to numpy array with correct shape
        input_array = np.array(input_data).reshape(1, -1)
        
        # Apply scaling if available
        if self.scaler is not None:
            input_array = self.scaler.transform(input_array)
        
        # Make prediction
        probability = self.model.predict(input_array)[0]
        
        # Use custom threshold instead of default 0.5
        prediction = int(probability > self.threshold)
        confidence = float(max(probability, 1-probability))
        
        # Return results
        return {
            "timestamp": datetime.datetime.now().isoformat(),
            "is_threat": bool(prediction == 1),
            "prediction": prediction,
            "raw_probability": float(probability),
            "confidence": confidence,
            "top_features": self.metadata['top_features'],
            "threshold": self.threshold
        }

def collect_system_metrics():
    """Collect Windows system metrics that match the model's expected features"""
    metrics = {}
    
    try:
        # Basic time feature
        metrics["ts"] = int(time.time())
        metrics["type"] = 0  # Default to normal operation
        
        # Process metrics
        metrics["Process_Thread Count"] = len(psutil.pids())
        
        # Get main process info
        process = psutil.Process()
        metrics["Process_Virtual_Bytes"] = process.memory_info().vms
        metrics["Process_Working_Set_Peak"] = getattr(process.memory_info(), 'peak_wset', 0)
        metrics["Process_Page_File Bytes Peak"] = getattr(process.memory_info(), 'pagefile', 0)
        
        # Memory metrics
        memory = psutil.virtual_memory()
        metrics["Memory Pool Paged Bytes"] = memory.total - memory.available
        metrics["Memory Pool Paged Resident Bytes"] = memory.used
        metrics["Memory Pool Nonpaged Bytes"] = getattr(memory, 'shared', 0)
        metrics["Memory pct_ Committed Bytes In Use"] = memory.percent / 100
        metrics["Memory System Driver Total Bytes"] = memory.total * 0.1  # Estimate
        metrics["Memory Standby Cache Core Bytes"] = memory.cached
        
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)
        metrics["Processor_pct_ Processor_Time"] = cpu_percent / 100
        cpu_times = psutil.cpu_times_percent(interval=0.1)
        metrics["Processor_pct_ Privileged_Time"] = cpu_times.system / 100
        metrics["Processor_pct_ Interrupt_Time"] = getattr(cpu_times, 'interrupt', 0) / 100
        
        # Disk metrics
        disk = psutil.disk_usage('/')
        metrics["LogicalDisk(_Total) pct_ Free Space"] = disk.free / disk.total
        metrics["LogicalDisk(_Total) Free Megabytes"] = disk.free / (1024 * 1024)
        metrics["LogicalDisk(_Total) pct_ Disk Read Time"] = 0.01  # Placeholder
        
        # Network metrics
        net_io = psutil.net_io_counters()
        metrics["Network_I(Intel R _82574L_GNC) Packets Received sec"] = net_io.packets_recv
        metrics["Network_I(Intel R _82574L_GNC) Packets Sent sec"] = net_io.packets_sent
        metrics["Network_I(Intel R _82574L_GNC) Bytes Received sec"] = net_io.bytes_recv
        metrics["Network_I(Intel R _82574L_GNC)TCP_APS"] = 0.01  # Placeholder
        
        return metrics
        
    except Exception as e:
        logging.error(f"Error collecting metrics: {e}")
        return metrics

def alert_user(result):
    """Alert user about a detected threat"""
    # Log to threat log file
    with open('threats.log', 'a') as f:
        log_data = {
            "timestamp": result["timestamp"],
            "confidence": result["confidence"],
            "top_features": result["top_features"][:5]
        }
        f.write(json.dumps(log_data) + '\n')
    
    # Print to console
    print("="*50)
    print(f"⚠️ SECURITY ALERT: Threat detected at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Confidence: {result['confidence']:.2%}")
    print(f"Top indicators: {', '.join(result['top_features'][:3])}")
    print("="*50)
    
    # Send alert to backend for frontend display
    try:
        threat_type = "Malicious Activity"
        
        # Determine severity based on confidence
        if "raw_probability" in result and result["raw_probability"] > 0.9:
            severity = "critical"
        elif "raw_probability" in result and result["raw_probability"] > 0.7:
            severity = "high"
        else:
            severity = "medium"
            
        # Create alert object for backend
        alert_data = {
            "id": str(uuid.uuid4()),
            "threat_type": threat_type,
            "severity": severity,
            "timestamp": datetime.datetime.now().isoformat(),
            "status": "open",
            "device_id": DEVICE_ID,
            "description": f"Threat detected with {result['confidence']:.2%} confidence. Top indicators: {', '.join(result['top_features'][:3])}",
            "metrics": {
                "confidence": result['confidence'],
                "top_features": result['top_features'][:5]
            }
        }
        
        # Send to backend API with proper headers
        headers = {
            "Content-Type": "application/json"
        }
        response = requests.post(f"{BACKEND_URL}/api/alert", json=alert_data, headers=headers)
        
        if response.status_code == 200:
            print(f"Alert sent to dashboard successfully")
        else:
            print(f"Failed to send alert to dashboard: {response.status_code} - {response.text}")
            logging.error(f"Failed to send alert to dashboard: {response.status_code} - {response.text}")
    except Exception as e:
        logging.error(f"Error sending alert to backend: {e}")
        print(f"Error sending alert to backend: {e}")
    
    logging.warning(f"THREAT DETECTED: {json.dumps(log_data)}")

def run_continuous_monitoring(interval=30, threshold=0.8):
    """Run continuous monitoring at the specified interval"""
    try:
        # Initialize the detector with custom threshold
        detector = Windows10ThreatDetector(threshold=threshold)
        logging.info(f"Detector initialized with {len(detector.feature_names)} features and threshold {threshold}")
        
        print(f"Starting Windows 10 Threat Monitoring with threshold {threshold}")
        print(f"(Higher threshold = fewer false positives, fewer false negatives)")
        
        # Create threats log file if it doesn't exist
        if not os.path.exists('threats.log'):
            with open('threats.log', 'w') as f:
                f.write('')
        
        # Initialize counters
        checks_count = 0
        threats_count = 0
        start_time = datetime.datetime.now()
        
        print(f"Starting Windows 10 Threat Monitoring (checking every {interval} seconds)")
        print(f"Press Ctrl+C to stop")
        logging.info(f"Monitoring started at {start_time}")
        
        # Main monitoring loop
        while True:
            try:
                # Collect system metrics
                metrics = collect_system_metrics()
                
                # Run threat detection
                result = detector.detect(metrics)
                
                # Update counters
                checks_count += 1
                if result['is_threat']:
                    threats_count += 1
                    alert_user(result)
                
                # Print status update every 10 checks
                if checks_count % 10 == 0:
                    run_time = (datetime.datetime.now() - start_time).total_seconds() / 60
                    print(f"Status: Ran {checks_count} checks in {run_time:.1f} minutes, detected {threats_count} threats")
                
                # Simple console output
                if not result['is_threat']:
                    print(f"✓ {datetime.datetime.now().strftime('%H:%M:%S')} - System secure ({result['confidence']:.2%})")
                
                # Wait for next check
                time.sleep(interval)
                
            except KeyboardInterrupt:
                raise
            except Exception as e:
                logging.error(f"Error in monitoring loop: {e}")
                logging.error(traceback.format_exc())
                print(f"Error: {e}")
                time.sleep(interval)  # Continue monitoring despite errors
                
    except KeyboardInterrupt:
        run_time = (datetime.datetime.now() - start_time).total_seconds() / 60
        print(f"\nMonitoring stopped after {run_time:.1f} minutes")
        print(f"Ran {checks_count} checks and detected {threats_count} threats")
        logging.info(f"Monitoring stopped by user after {run_time:.1f} minutes")
    except Exception as e:
        logging.critical(f"Fatal error: {e}")
        logging.critical(traceback.format_exc())
        print(f"Fatal error: {e}")

if __name__ == "__main__":
    try:
        # Check if running as standalone script or imported as module
        if len(sys.argv) > 2:
            # Custom interval and threshold provided
            interval = int(sys.argv[1])
            threshold = float(sys.argv[2])
            run_continuous_monitoring(interval, threshold)
        elif len(sys.argv) > 1:
            # Only custom interval provided
            interval = int(sys.argv[1])
            run_continuous_monitoring(interval)
        else:
            # Default interval and threshold
            run_continuous_monitoring(30, 0.8)
    except Exception as e:
        logging.critical(f"Error starting monitor: {e}")
        print(f"Error starting monitor: {e}")
        traceback.print_exc()

def setup_socket():
    try:
        # Create a socket for local communication
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.bind(('localhost', 7890))
        server_socket.listen(5)
        return server_socket
    except Exception as e:
        logging.error(f"Failed to setup socket: {e}")
        return None

def get_network_metrics():
    """Collect network statistics using PowerShell"""
    try:
        # Get network adapter statistics
        cmd = "powershell -Command \"Get-NetAdapterStatistics | Where-Object {$_.ReceivedBytes -gt 0} | ConvertTo-Json\""
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logging.error(f"Failed to get network metrics: {result.stderr}")
            return None
            
        # Parse PowerShell output
        try:
            data = json.loads(result.stdout)
            
            # Handle case where multiple adapters are returned (as array) or single adapter (as object)
            if isinstance(data, list):
                # Find the most active adapter
                data = max(data, key=lambda x: x.get('ReceivedBytes', 0) + x.get('SentBytes', 0))
            
            # Calculate rates
            now = datetime.datetime.now().isoformat()
            
            # Convert bytes to MB
            received_mb = data.get('ReceivedBytes', 0) / (1024 * 1024)
            sent_mb = data.get('SentBytes', 0) / (1024 * 1024)
            
            return {
                "time": now,
                "inbound_traffic": {"time": now, "value": round(received_mb, 2)},
                "outbound_traffic": {"time": now, "value": round(sent_mb, 2)},
                "packet_count": data.get('ReceivedUnicastPackets', 0) + data.get('SentUnicastPackets', 0),
                "adapter_name": data.get('Name', 'Unknown')
            }
        except json.JSONDecodeError:
            logging.error(f"Failed to parse network metrics: {result.stdout}")
            return None
    except Exception as e:
        logging.error(f"Error in get_network_metrics: {e}")
        return None

def get_active_connections():
    """Get active network connections"""
    try:
        cmd = "powershell -Command \"Get-NetTCPConnection | Where-Object {$_.State -eq 'Established'} | Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,State,OwningProcess | ConvertTo-Json\""
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logging.error(f"Failed to get connections: {result.stderr}")
            return None
            
        try:
            data = json.loads(result.stdout)
            
            # If single connection, wrap in list
            if isinstance(data, dict):
                data = [data]
                
            now = datetime.datetime.now().isoformat()
            
            connections = []
            for conn in data:
                # Get process name from process ID
                pid = conn.get('OwningProcess', 0)
                process_name = get_process_name(pid)
                
                connections.append({
                    "local_address": conn.get('LocalAddress', ''),
                    "local_port": conn.get('LocalPort', 0),
                    "remote_address": conn.get('RemoteAddress', ''),
                    "remote_port": conn.get('RemotePort', 0),
                    "state": conn.get('State', ''),
                    "process_id": pid,
                    "process_name": process_name
                })
            
            return {
                "time": now, 
                "active_connections": {"time": now, "value": len(connections)},
                "connections": connections
            }
        except json.JSONDecodeError:
            logging.error(f"Failed to parse connections: {result.stdout}")
            return None
    except Exception as e:
        logging.error(f"Error in get_active_connections: {e}")
        return None

def get_process_name(pid):
    """Get process name from process ID"""
    try:
        cmd = f"powershell -Command \"Get-Process -Id {pid} | Select-Object -ExpandProperty ProcessName\""
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            return "Unknown"
            
        return result.stdout.strip()
    except:
        return "Unknown"

def get_running_processes():
    """Get currently running processes"""
    try:
        cmd = "powershell -Command \"Get-Process | Select-Object Id,ProcessName,CPU,WorkingSet,HandleCount | ConvertTo-Json\""
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logging.error(f"Failed to get processes: {result.stderr}")
            return None
            
        try:
            data = json.loads(result.stdout)
            
            # If single process, wrap in list
            if isinstance(data, dict):
                data = [data]
                
            now = datetime.datetime.now().isoformat()
            
            # Calculate some metrics
            total_cpu = sum(p.get('CPU', 0) for p in data if isinstance(p.get('CPU'), (int, float)))
            total_memory = sum(p.get('WorkingSet', 0) for p in data) / (1024 * 1024)  # MB
            
            return {
                "time": now,
                "process_count": len(data),
                "total_cpu": round(total_cpu, 2),
                "total_memory_mb": round(total_memory, 2),
                "processes": data[:10]  # Take only top 10 processes to avoid too much data
            }
        except json.JSONDecodeError:
            logging.error(f"Failed to parse processes: {result.stdout}")
            return None
    except Exception as e:
        logging.error(f"Error in get_running_processes: {e}")
        return None

def get_system_metrics():
    """Get system metrics like CPU, Memory, Disk"""
    try:
        # Get CPU usage
        cpu_cmd = "powershell -Command \"Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object -ExpandProperty Average\""
        cpu_result = subprocess.run(cpu_cmd, capture_output=True, text=True)
        
        # Get memory usage
        mem_cmd = "powershell -Command \"Get-WmiObject -Class Win32_OperatingSystem | Select-Object -ExpandProperty FreePhysicalMemory\""
        mem_result = subprocess.run(mem_cmd, capture_output=True, text=True)
        
        # Get total memory
        total_mem_cmd = "powershell -Command \"(Get-WmiObject -Class Win32_ComputerSystem).TotalPhysicalMemory\""
        total_mem_result = subprocess.run(total_mem_cmd, capture_output=True, text=True)
        
        now = datetime.datetime.now().isoformat()
        
        try:
            cpu_usage = float(cpu_result.stdout.strip())
            free_memory_kb = float(mem_result.stdout.strip())
            total_memory_bytes = float(total_mem_result.stdout.strip())
            
            # Convert to more readable format
            total_memory_mb = total_memory_bytes / (1024 * 1024)
            free_memory_mb = free_memory_kb / 1024
            used_memory_mb = total_memory_mb - free_memory_mb
            memory_usage_percent = (used_memory_mb / total_memory_mb) * 100
            
            return {
                "time": now,
                "cpu_usage": round(cpu_usage, 2),
                "memory_usage_percent": round(memory_usage_percent, 2),
                "memory_used_mb": round(used_memory_mb, 2),
                "memory_total_mb": round(total_memory_mb, 2)
            }
        except Exception as e:
            logging.error(f"Failed to parse system metrics: {e}")
            return None
    except Exception as e:
        logging.error(f"Error in get_system_metrics: {e}")
        return None

def collect_all_metrics():
    """Collect all metrics from different sources"""
    metrics = {}
    
    network = get_network_metrics()
    if network:
        metrics["network"] = network
        metrics_history["network"].append(network)
    
    connections = get_active_connections()
    if connections:
        metrics["connections"] = connections
        metrics_history["connections"].append(connections)
        
        # Update packet rate calculation based on number of active connections
        now = datetime.datetime.now().isoformat()
        conn_count = connections["active_connections"]["value"]
        # Estimate packet rate based on connection count (simple heuristic)
        packet_rate = conn_count * 10  # Assume 10 packets per connection per second
        metrics["packet_rate"] = {"time": now, "value": packet_rate}
    
    processes = get_running_processes()
    if processes:
        metrics["processes"] = processes
        metrics_history["processes"].append(processes)
    
    system = get_system_metrics()
    if system:
        metrics["system"] = system
        metrics_history["system"].append(system)
    
    return metrics

def send_to_backend(metrics):
    """Send metrics to backend for analysis"""
    try:
        # Format data for the backend API
        network_data = {
            "inbound_traffic": metrics.get("network", {}).get("inbound_traffic", {"time": datetime.datetime.now().isoformat(), "value": 0}),
            "outbound_traffic": metrics.get("network", {}).get("outbound_traffic", {"time": datetime.datetime.now().isoformat(), "value": 0}),
            "packet_rate": metrics.get("packet_rate", {"time": datetime.datetime.now().isoformat(), "value": 0}),
            "active_connections": metrics.get("connections", {}).get("active_connections", {"time": datetime.datetime.now().isoformat(), "value": 0})
        }
        
        # Send network data to WebSocket endpoint
        try:
            response = requests.post(f"{BACKEND_URL}/api/network-data", json=network_data)
            if response.status_code != 200:
                logging.error(f"Failed to send network data: {response.status_code} - {response.text}")
        except Exception as e:
            logging.error(f"Error sending network data: {e}")
        
        # Process data to check for threats
        threat_features = {
            "packet_count": metrics.get("network", {}).get("packet_count", 0),
            "connection_duration": 60,  # Default to 60 seconds for analysis window
            "bytes_transferred": metrics.get("network", {}).get("inbound_traffic", {}).get("value", 0) * 1024 * 1024,  # Convert MB back to bytes
            "port_number": metrics.get("connections", {}).get("connections", [{}])[0].get("remote_port", 0) if metrics.get("connections", {}).get("connections", []) else 0,
            "protocol_type": "TCP",
            "flags": []
        }
        
        # Send to threat prediction endpoint
        try:
            response = requests.post(f"{BACKEND_URL}/predict", json={"features": threat_features})
            if response.status_code == 200:
                result = response.json()
                if result.get("prediction") == "threat":
                    logging.warning(f"Threat detected: {result.get('details', {}).get('threat_type')} with confidence {result.get('confidence')}")
                    print(f"🚨 THREAT DETECTED: {result.get('details', {}).get('threat_type')} (Confidence: {int(result.get('confidence', 0) * 100)}%)")
            else:
                logging.error(f"Failed to predict threat: {response.status_code} - {response.text}")
        except Exception as e:
            logging.error(f"Error predicting threat: {e}")
            
    except Exception as e:
        logging.error(f"Error in send_to_backend: {e}")

def monitor_loop():
    """Main monitoring loop"""
    while True:
        try:
            # Collect metrics
            metrics = collect_all_metrics()
            
            # Send to backend
            if metrics:
                send_to_backend(metrics)
                
            # Sleep for polling interval
            time.sleep(POLLING_INTERVAL)
        except Exception as e:
            logging.error(f"Error in monitor loop: {e}")
            time.sleep(POLLING_INTERVAL)

def handle_client(client_socket):
    """Handle client connection for local communication"""
    try:
        # Receive request
        request = client_socket.recv(1024).decode('utf-8')
        
        # Process request
        if request.startswith('GET_METRICS'):
            # Return latest metrics
            latest_metrics = {
                "network": list(metrics_history["network"])[-1] if metrics_history["network"] else None,
                "connections": list(metrics_history["connections"])[-1] if metrics_history["connections"] else None,
                "processes": list(metrics_history["processes"])[-1] if metrics_history["processes"] else None,
                "system": list(metrics_history["system"])[-1] if metrics_history["system"] else None
            }
            client_socket.send(json.dumps(latest_metrics).encode('utf-8'))
        else:
            client_socket.send(b'Unknown command')
    except Exception as e:
        logging.error(f"Error handling client: {e}")
    finally:
        client_socket.close()

def socket_server_loop(server_socket):
    """Socket server loop to handle local clients"""
    while True:
        try:
            client_socket, addr = server_socket.accept()
            client_handler = threading.Thread(target=handle_client, args=(client_socket,))
            client_handler.daemon = True
            client_handler.start()
        except Exception as e:
            logging.error(f"Error in socket server: {e}")
            time.sleep(1)

def main():
    print("Starting Windows 10 Monitoring Agent...")
    logging.info("Starting Windows 10 Monitoring Agent")
    
    # Check if backend is available
    try:
        response = requests.get(BACKEND_URL)
        if response.status_code != 200:
            print(f"Backend not available at {BACKEND_URL}. Please start the backend server.")
            logging.error(f"Backend not available at {BACKEND_URL}")
            return
    except requests.exceptions.ConnectionError:
        print(f"Backend not available at {BACKEND_URL}. Please start the backend server.")
        logging.error(f"Backend not available at {BACKEND_URL}")
        return
    
    # Setup socket for local communication
    server_socket = setup_socket()
    if server_socket:
        socket_thread = threading.Thread(target=socket_server_loop, args=(server_socket,))
        socket_thread.daemon = True
        socket_thread.start()
    
    # Start monitoring loop
    try:
        print(f"Monitoring started. Device ID: {DEVICE_ID}")
        print(f"Logs are being written to threat_monitor.log")
        print("Press Ctrl+C to stop monitoring")
        
        monitor_loop()
    except KeyboardInterrupt:
        print("\nMonitoring stopped by user")
        logging.info("Monitoring stopped by user")
    except Exception as e:
        print(f"Error: {e}")
        logging.error(f"Error in main: {e}")
    finally:
        if server_socket:
            server_socket.close()

if __name__ == "__main__":
    main() 