import React, { useState, useEffect } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiActivity, FiShield, FiRefreshCw } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import WebSocketService from '../services/WebSocketService';
import AlertService from '../services/AlertService';
import ThreatsList from './ThreatsList';

const Dashboard = () => {
  // State variables
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({
    total_alerts: 0,
    open_alerts: 0,
    resolved_alerts: 0,
    critical_alerts: 0,
    high_alerts: 0,
    medium_alerts: 0,
    low_alerts: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const navigate = useNavigate();
  
  // Initialize data and set up WebSocket
  useEffect(() => {
    console.log('[Dashboard] Component mounted');
    
    // Function to load initial data
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch alerts
        const alerts = await AlertService.fetchAlerts();
        console.log('[Dashboard] Loaded initial alerts:', alerts.length);
        setAlerts(alerts);
        
        // Fetch summary
        try {
          const summaryData = await AlertService.getDashboardSummary();
          console.log('[Dashboard] Loaded dashboard summary:', summaryData);
          setSummary(summaryData);
        } catch (err) {
          console.error('[Dashboard] Error loading summary, calculating from alerts');
          // Calculate summary from alerts if endpoint fails
          updateSummaryFromAlerts(alerts);
        }
        
        setLastUpdated(new Date());
      } catch (err) {
        console.error('[Dashboard] Error loading initial data:', err);
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Handler for WebSocket connection status changes
    const handleConnectionChange = (isConnected) => {
      console.log('[Dashboard] WebSocket connection status:', isConnected);
      setIsConnected(isConnected);
    };
    
    // Handler for new alert messages
    const handleNewAlert = (alert) => {
      if (!alert || !alert.id) {
        console.error('[Dashboard] Received invalid alert:', alert);
        return;
      }
      
      console.log('[Dashboard] Received alert via WebSocket:', alert.threat_type);
      
      // Add alert to service
      AlertService.addAlert(alert);
      
      // Update component state
      setAlerts(current => {
        // Check if alert already exists
        const exists = current.some(a => a.id === alert.id);
        
        if (exists) {
          // Update existing alert
          return current.map(a => a.id === alert.id ? alert : a);
        } else {
          // Add new alert at beginning
          return [alert, ...current];
        }
      });
      
      // Update summary
      updateSummaryForAlert(alert, true);
      
      // Update last updated timestamp
      setLastUpdated(new Date());
    };
    
    // Connect to WebSocket
    WebSocketService.connect();
    
    // Subscribe to events
    const unsubscribeConnection = WebSocketService.subscribe('connection', handleConnectionChange);
    const unsubscribeAlert = WebSocketService.subscribe('alert', handleNewAlert);
    
    // Load initial data
    loadInitialData();
    
    // Clean up on unmount
    return () => {
      console.log('[Dashboard] Component unmounting');
      unsubscribeConnection();
      unsubscribeAlert();
    };
  }, []);
  
  // Helper function to calculate summary stats from alerts array
  const updateSummaryFromAlerts = (alerts) => {
    const stats = {
      total_alerts: alerts.length,
      open_alerts: 0,
      resolved_alerts: 0,
      critical_alerts: 0,
      high_alerts: 0,
      medium_alerts: 0,
      low_alerts: 0
    };
    
    alerts.forEach(alert => {
      if (alert.status === 'resolved') {
        stats.resolved_alerts++;
      } else {
        stats.open_alerts++;
      }
      
      // Count by severity
      switch(alert.severity) {
        case 'critical': stats.critical_alerts++; break;
        case 'high': stats.high_alerts++; break;
        case 'medium': stats.medium_alerts++; break;
        case 'low': stats.low_alerts++; break;
        default: break;
      }
    });
    
    setSummary(stats);
  };
  
  // Helper function to update summary for a single alert
  const updateSummaryForAlert = (alert, isNew = false) => {
    setSummary(prev => {
      const newSummary = { ...prev };
      
      if (isNew) {
        newSummary.total_alerts++;
        
        if (alert.status === 'resolved') {
          newSummary.resolved_alerts++;
        } else {
          newSummary.open_alerts++;
        }
        
        // Update severity counts
        switch(alert.severity) {
          case 'critical': newSummary.critical_alerts++; break;
          case 'high': newSummary.high_alerts++; break;
          case 'medium': newSummary.medium_alerts++; break;
          case 'low': newSummary.low_alerts++; break;
          default: break;
        }
      }
      
      return newSummary;
    });
  };
  
  // Handler for manual refresh
  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      
      // Fetch fresh data
      const alerts = await AlertService.fetchAlerts();
      setAlerts(alerts);
      
      try {
        const summaryData = await AlertService.getDashboardSummary();
        setSummary(summaryData);
      } catch (err) {
        // Calculate from alerts
        updateSummaryFromAlerts(alerts);
      }
      
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(`Failed to refresh: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test function to create a new alert (for development)
  const createTestAlert = async () => {
    try {
      const response = await fetch('http://localhost:8000/test-alert');
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      const result = await response.json();
      console.log('Test alert created:', result);
    } catch (err) {
      console.error('Error creating test alert:', err);
    }
  };
  
  // Show loading state
  if (isLoading && !alerts.length) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Security Dashboard</h1>
        
        <div className="flex items-center gap-4">
          {/* Connection status indicator */}
          <div className="flex items-center">
            <div className={`h-3 w-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {/* Last updated time */}
          {lastUpdated && (
            <div className="text-sm text-gray-600">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          
          {/* Refresh button */}
          <button 
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            <FiRefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          {/* Test button (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <button 
              onClick={createTestAlert}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
            >
              Create Test Alert
            </button>
          )}
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="rounded-full bg-blue-100 p-3 mr-4">
              <FiShield className="text-blue-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Threats</p>
              <p className="text-xl font-bold">{summary.total_alerts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="rounded-full bg-yellow-100 p-3 mr-4">
              <FiActivity className="text-yellow-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Threats</p>
              <p className="text-xl font-bold">{summary.open_alerts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="rounded-full bg-green-100 p-3 mr-4">
              <FiCheckCircle className="text-green-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Resolved Threats</p>
              <p className="text-xl font-bold">{summary.resolved_alerts}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="rounded-full bg-red-100 p-3 mr-4">
              <FiAlertTriangle className="text-red-500 text-xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Critical Threats</p>
              <p className="text-xl font-bold">{summary.critical_alerts}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Threats */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Recent Threats</h2>
          <button 
            onClick={() => navigate('/alerts')}
            className="text-blue-500 hover:text-blue-700 text-sm"
          >
            View All
          </button>
        </div>
        
        <ThreatsList 
          threats={alerts.slice(0, 10)} 
          isLoading={isLoading} 
        />
      </div>
    </div>
  );
};

export default Dashboard; 