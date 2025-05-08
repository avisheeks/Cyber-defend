
import os
import json
import numpy as np
import lightgbm as lgb
import joblib
from datetime import datetime

class Windows10ThreatDetector:
    def __init__(self, model_dir='models'):
        # Load model
        self.model_path = os.path.join(model_dir, 'windows10_threat_detector.lgb')
        self.model = lgb.Booster(model_file=self.model_path)
        
        # Load metadata
        with open(os.path.join(model_dir, 'windows10_threat_detector_metadata.json'), 'r') as f:
            self.metadata = json.load(f)
        
        self.feature_names = self.metadata['feature_names']
        self.is_binary = self.metadata['is_binary']
        
        # Load scaler if exists
        scaler_path = os.path.join(model_dir, 'windows10_threat_detector_scaler.pkl')
        self.scaler = joblib.load(scaler_path) if os.path.exists(scaler_path) else None
    
    def detect(self, metrics):
        """
        Detect threats from Windows metrics
        
        Args:
            metrics: Dict containing system metrics matching the feature names
                    or numpy array/list of values in the correct order
        
        Returns:
            Dict with detection results
        """
        # Prepare input data
        if isinstance(metrics, dict):
            # Get values in the correct order
            input_data = []
            for feature in self.feature_names:
                if feature in metrics:
                    input_data.append(metrics[feature])
                else:
                    print(f"Warning: Missing feature {feature}, using 0")
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
        if self.is_binary:
            probability = self.model.predict(input_array)[0]
            prediction = int(probability > 0.5)
            confidence = float(max(probability, 1-probability))
        else:
            probabilities = self.model.predict(input_array)
            prediction = int(np.argmax(probabilities))
            confidence = float(np.max(probabilities))
        
        # Return results
        return {
            "timestamp": datetime.now().isoformat(),
            "is_threat": bool(prediction == 1) if self.is_binary else bool(prediction != 0),
            "prediction": prediction,
            "confidence": confidence,
            "top_features": self.metadata['top_features']
        }

# Example usage
if __name__ == "__main__":
    # Example metrics (replace with real metrics)
    sample_metrics = {
        # Add your Windows metrics here
    }
    
    # Initialize detector
    detector = Windows10ThreatDetector()
    
    # Run detection
    result = detector.detect(sample_metrics)
    print(f"Threat detected: {result['is_threat']}")
    print(f"Confidence: {result['confidence']:.4f}")
