
import pandas as pd
from windows10_threat_detector import Windows10ThreatDetector

# 1. Load the detector
detector = Windows10ThreatDetector(model_dir='models')

# 2. Connect to Windows Performance Counters
# This would be implemented based on your data collection method
# Example using Python's psutil:
import psutil

def collect_system_metrics():
    metrics = {
        # Add metrics collection code here matching feature names
        # Example:
        'Memory Pool Paged Bytes': psutil.virtual_memory().total,
        'Process_Thread_Count': len(psutil.pids()),
        # Add more metrics...
    }
    return metrics

# 3. Run detection
metrics = collect_system_metrics()
result = detector.detect(metrics)

# 4. Handle results
if result['is_threat']:
    print(f"ALERT: Threat detected with {result['confidence']:.2%} confidence!")
    print(f"Important indicators: {', '.join(result['top_features'][:3])}")
else:
    print(f"No threat detected (confidence: {result['confidence']:.2%})")

# 5. For continuous monitoring
def monitor_continuously(interval=60):
    while True:
        metrics = collect_system_metrics()
        result = detector.detect(metrics)
        
        if result['is_threat']:
            print(f"ALERT: Threat detected at {result['timestamp']}!")
            # Add alert actions (email, logging, etc.)
        
        time.sleep(interval)

# Uncomment to start monitoring:
# import time
# monitor_continuously()
