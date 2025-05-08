import numpy as np
import json
import pickle
import os
from typing import Dict, Any, List, Tuple
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ThreatDetectionModel:
    """Simple threat detection model implementation"""
    
    def __init__(self, model_path: str = None):
        self.features = [
            "packet_count", "connection_duration", "bytes_transferred",
            "packet_rate", "port_number", "protocol_type", "flag_count"
        ]
        
        # Default threshold values for anomaly detection
        self.thresholds = {
            "packet_count": 1000,
            "connection_duration": 300,  # seconds
            "bytes_transferred": 500000,  # bytes
            "packet_rate": 100,  # packets per second
            "port_number": 1024,  # suspicious if below common ports
            "protocol_type": 1,  # encoded value
            "flag_count": 5
        }
        
        # Define weights for each feature
        self.weights = {
            "packet_count": 0.15,
            "connection_duration": 0.1,
            "bytes_transferred": 0.2,
            "packet_rate": 0.25,
            "port_number": 0.05,
            "protocol_type": 0.1,
            "flag_count": 0.15
        }
        
        # Load model if path provided
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
            logger.info(f"Loaded model from {model_path}")
        else:
            logger.info("Using default model parameters")
    
    def load_model(self, model_path: str) -> None:
        """Load model parameters from file"""
        try:
            with open(model_path, 'rb') as f:
                model_data = pickle.load(f)
                
            # Update model parameters
            self.thresholds = model_data.get('thresholds', self.thresholds)
            self.weights = model_data.get('weights', self.weights)
            self.features = model_data.get('features', self.features)
            
            logger.info("Model loaded successfully")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
    
    def save_model(self, model_path: str) -> None:
        """Save model parameters to file"""
        try:
            model_data = {
                'thresholds': self.thresholds,
                'weights': self.weights,
                'features': self.features
            }
            
            with open(model_path, 'wb') as f:
                pickle.dump(model_data, f)
                
            logger.info(f"Model saved to {model_path}")
        except Exception as e:
            logger.error(f"Error saving model: {e}")
    
    def predict(self, features: Dict[str, float]) -> Tuple[str, float, Dict[str, Any]]:
        """
        Predict if network traffic is a threat
        
        Args:
            features: Dictionary of feature values
            
        Returns:
            Tuple containing:
            - Prediction label ("threat" or "normal")
            - Confidence score (0.0 to 1.0)
            - Additional details
        """
        # Normalize features based on thresholds
        normalized_features = {}
        for feature in self.features:
            if feature in features:
                if feature == "port_number":
                    # Lower ports are more suspicious
                    normalized_features[feature] = 1.0 - min(1.0, features[feature] / self.thresholds[feature])
                else:
                    # Higher values are more suspicious
                    normalized_features[feature] = min(1.0, features[feature] / self.thresholds[feature])
            else:
                normalized_features[feature] = 0.0
        
        # Calculate weighted score
        score = 0.0
        for feature in self.features:
            score += normalized_features[feature] * self.weights[feature]
        
        # Determine threat classification
        is_threat = score > 0.6  # Threshold for detection
        
        # Calculate feature contributions to the decision
        contributions = {}
        for feature in self.features:
            contributions[feature] = normalized_features[feature] * self.weights[feature]
        
        # Determine threat type based on feature patterns
        threat_type = self._determine_threat_type(normalized_features, score)
        
        result = {
            "label": "threat" if is_threat else "normal",
            "confidence": score,
            "threat_type": threat_type if is_threat else None,
            "feature_contributions": contributions,
            "severity": self._determine_severity(score)
        }
        
        return (result["label"], result["confidence"], result)
    
    def _determine_threat_type(self, features: Dict[str, float], score: float) -> str:
        """Determine the type of threat based on feature patterns"""
        if features["port_number"] > 0.8 and features["packet_rate"] > 0.7:
            return "Port Scanning"
        elif features["packet_rate"] > 0.9 and features["bytes_transferred"] > 0.8:
            return "DDoS Attack"
        elif features["connection_duration"] > 0.8 and features["port_number"] < 0.3:
            return "Brute Force Attempt"
        elif features["bytes_transferred"] > 0.7 and features["connection_duration"] < 0.3:
            return "Data Exfiltration"
        elif features["protocol_type"] > 0.8 and features["flag_count"] > 0.7:
            return "Man-in-the-Middle"
        else:
            return "Unknown Threat"
    
    def _determine_severity(self, score: float) -> str:
        """Determine the severity based on the confidence score"""
        if score > 0.9:
            return "critical"
        elif score > 0.75:
            return "high"
        elif score > 0.6:
            return "medium"
        else:
            return "low"
    
    def update_thresholds(self, new_thresholds: Dict[str, float]) -> None:
        """Update model thresholds"""
        for feature, value in new_thresholds.items():
            if feature in self.thresholds:
                self.thresholds[feature] = value
    
    def update_weights(self, new_weights: Dict[str, float]) -> None:
        """Update feature weights"""
        for feature, value in new_weights.items():
            if feature in self.weights:
                self.weights[feature] = value
        
        # Normalize weights to sum to 1
        weight_sum = sum(self.weights.values())
        for feature in self.weights:
            self.weights[feature] /= weight_sum

# Create default model instance
default_model = ThreatDetectionModel()

def get_model():
    """Get the default model instance"""
    return default_model

def process_data(raw_data: Dict[str, Any]) -> Dict[str, float]:
    """Process raw network data into model features"""
    features = {}
    
    # Extract known features
    if "packet_count" in raw_data:
        features["packet_count"] = float(raw_data["packet_count"])
    
    if "connection_duration" in raw_data:
        features["connection_duration"] = float(raw_data["connection_duration"])
    
    if "bytes_transferred" in raw_data:
        features["bytes_transferred"] = float(raw_data["bytes_transferred"])
    
    # Calculate derived features
    if "packet_count" in features and "connection_duration" in features and features["connection_duration"] > 0:
        features["packet_rate"] = features["packet_count"] / features["connection_duration"]
    
    # Map port number
    if "port" in raw_data:
        features["port_number"] = float(raw_data["port"])
    
    # Map protocol type to numeric value
    if "protocol" in raw_data:
        protocol_map = {"TCP": 1, "UDP": 2, "HTTP": 3, "HTTPS": 4}
        features["protocol_type"] = float(protocol_map.get(raw_data["protocol"], 0))
    
    # Count flags or other indicators
    if "flags" in raw_data and isinstance(raw_data["flags"], list):
        features["flag_count"] = float(len(raw_data["flags"]))
    else:
        features["flag_count"] = 0.0
    
    return features 