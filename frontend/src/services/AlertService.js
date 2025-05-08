/**
 * AlertService - Handles fetching and managing alert data
 */

class AlertService {
  constructor() {
    this.baseUrl = 'http://localhost:8000';
    this.debug = true;
    this.cachedAlerts = [];
    this.lastFetchTime = null;
    this.cacheExpiry = 60 * 1000; // 1 minute
  }
  
  /**
   * Fetch alerts from the backend, or provide simulated data if no real data available
   */
  async fetchAlerts(useCached = true) {
    try {
      // Return cached results if they exist and aren't expired
      const now = Date.now();
      if (useCached && this.cachedAlerts.length > 0 && this.lastFetchTime && 
          (now - this.lastFetchTime < this.cacheExpiry)) {
        this.log('Returning cached alerts');
        return this.cachedAlerts;
      }
      
      // Try to fetch from backend
      const response = await fetch(`${this.baseUrl}/alerts`);
      
      if (response.ok) {
        const alerts = await response.json();
        this.log(`Fetched ${alerts.length} alerts from backend`);
        
        // Cache the results
        this.cachedAlerts = alerts;
        this.lastFetchTime = now;
        
        return alerts;
      } else {
        this.log('Error fetching alerts, generating simulated data');
        return this.generateSimulatedAlerts();
      }
    } catch (error) {
      this.log('Error fetching alerts, generating simulated data:', error);
      return this.generateSimulatedAlerts();
    }
  }
  
  /**
   * Generate simulated alerts for testing
   */
  generateSimulatedAlerts(count = 20) {
    const alertTypes = [
      'Suspicious Network Traffic',
      'Potential Port Scan',
      'Unusual Login Attempt',
      'Malware Detected',
      'Data Exfiltration Attempt',
      'DDoS Attack Detected',
      'Brute Force Attempt'
    ];
    
    const severities = ['low', 'medium', 'high', 'critical'];
    const statuses = ['open', 'investigating', 'resolved'];
    
    // Weight the distribution to have more low/medium than high/critical
    const severityWeights = [0.4, 0.3, 0.2, 0.1];
    const statusWeights = [0.6, 0.3, 0.1];
    
    const getWeightedRandom = (items, weights) => {
      const cumulativeWeights = [];
      let sum = 0;
      
      for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        cumulativeWeights[i] = sum;
      }
      
      const random = Math.random() * sum;
      
      for (let i = 0; i < cumulativeWeights.length; i++) {
        if (random < cumulativeWeights[i]) {
          return items[i];
        }
      }
      
      return items[0];
    };
    
    const alerts = [];
    const now = new Date();
    
    // Generate alerts spread over the last 24 hours with more recent ones
    for (let i = 0; i < count; i++) {
      const hoursAgo = Math.pow(Math.random(), 2) * 24; // Weight towards recent
      const timestamp = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
      
      const severity = getWeightedRandom(severities, severityWeights);
      
      // More severe alerts are more likely to be open
      const statusWeight = severity === 'critical' || severity === 'high' 
        ? [0.8, 0.2, 0] // High/critical mostly open
        : statusWeights; // Normal distribution
      
      const status = getWeightedRandom(statuses, statusWeight);
      
      alerts.push({
        id: `sim-${i}-${Date.now()}`,
        threat_type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
        severity: severity,
        timestamp: timestamp.toISOString(),
        status: status,
        device_id: `device-${Math.floor(Math.random() * 5) + 1}`,
        description: `Simulated ${severity} severity alert for testing purposes`,
        metrics: {
          confidence: 0.5 + (Math.random() * 0.5), // 0.5-1.0
          top_features: ['sim_feature_1', 'sim_feature_2', 'sim_feature_3'],
        }
      });
    }
    
    // Sort by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Update cache
    this.cachedAlerts = alerts;
    this.lastFetchTime = Date.now();
    
    this.log(`Generated ${alerts.length} simulated alerts`);
    return alerts;
  }
  
  /**
   * Add a new alert to the local cache
   */
  addAlert(alert) {
    // Check if alert already exists
    const exists = this.cachedAlerts.some(a => a.id === alert.id);
    
    if (exists) {
      // Update existing alert
      this.cachedAlerts = this.cachedAlerts.map(a => 
        a.id === alert.id ? alert : a
      );
    } else {
      // Add new alert at beginning
      this.cachedAlerts = [alert, ...this.cachedAlerts];
    }
  }
  
  /**
   * Get dashboard summary data
   */
  async getDashboardSummary() {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard/summary`);
      
      if (response.ok) {
        return await response.json();
      } else {
        return this.generateSimulatedSummary();
      }
    } catch (error) {
      this.log('Error fetching dashboard summary:', error);
      return this.generateSimulatedSummary();
    }
  }
  
  /**
   * Generate simulated dashboard summary
   */
  generateSimulatedSummary() {
    const alerts = this.cachedAlerts.length > 0 
      ? this.cachedAlerts 
      : this.generateSimulatedAlerts();
    
    const total_alerts = alerts.length;
    const open_alerts = alerts.filter(a => a.status === 'open').length;
    const resolved_alerts = alerts.filter(a => a.status === 'resolved').length;
    
    const critical_alerts = alerts.filter(a => a.severity === 'critical' && a.status === 'open').length;
    const high_alerts = alerts.filter(a => a.severity === 'high' && a.status === 'open').length;
    const medium_alerts = alerts.filter(a => a.severity === 'medium' && a.status === 'open').length;
    const low_alerts = alerts.filter(a => a.severity === 'low' && a.status === 'open').length;
    
    return {
      total_alerts,
      open_alerts,
      resolved_alerts,
      critical_alerts,
      high_alerts,
      medium_alerts,
      low_alerts,
      security_score: Math.max(0, 100 - (critical_alerts * 15) - (high_alerts * 5) - (medium_alerts * 2))
    };
  }
  
  /**
   * Log messages if debug is enabled
   */
  log(message, data) {
    if (!this.debug) return;
    
    if (data) {
      console.log(`[AlertService] ${message}`, data);
    } else {
      console.log(`[AlertService] ${message}`);
    }
  }
}

// Export as singleton
const alertService = new AlertService();
export default alertService; 