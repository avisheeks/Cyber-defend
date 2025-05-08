import React, { useState, useEffect } from 'react';
import { FiFilter, FiRefreshCw, FiCheck, FiX } from 'react-icons/fi';
import WebSocketService from '../services/WebSocketService';
import AlertService from '../services/AlertService';
import ThreatsList from '../components/ThreatsList';

const AlertsPage = () => {
  // State for alerts and filtering
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    severities: {
      critical: true,
      high: true,
      medium: true,
      low: true
    },
    statuses: {
      open: true,
      investigating: true,
      resolved: false
    },
    searchTerm: ''
  });
  
  // Load alerts and set up WebSocket connection
  useEffect(() => {
    console.log('[AlertsPage] Initializing');
    
    // Function to load alerts
    const loadAlerts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get alerts from service
        const alerts = await AlertService.fetchAlerts(100); // Get up to 100 alerts
        console.log(`[AlertsPage] Loaded ${alerts.length} alerts`);
        setAlerts(alerts);
        applyFilters(alerts, filters);
        
        setLastUpdated(new Date());
      } catch (err) {
        console.error('[AlertsPage] Error loading alerts:', err);
        setError(`Failed to load alerts: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Connection status handler
    const handleConnectionChange = (isConnected) => {
      console.log('[AlertsPage] WebSocket connection status:', isConnected);
      setIsConnected(isConnected);
    };
    
    // New alert handler
    const handleNewAlert = (alert) => {
      console.log('[AlertsPage] Received new alert:', alert.threat_type);
      
      // Add to service
      AlertService.addAlert(alert);
      
      // Update state
      setAlerts(current => {
        // Check if alert already exists
        const exists = current.some(a => a.id === alert.id);
        
        let updatedAlerts;
        if (exists) {
          // Update existing alert
          updatedAlerts = current.map(a => a.id === alert.id ? alert : a);
        } else {
          // Add new alert
          updatedAlerts = [alert, ...current];
        }
        
        // Apply filters to the updated alerts
        applyFilters(updatedAlerts, filters);
        
        return updatedAlerts;
      });
      
      setLastUpdated(new Date());
    };
    
    // Initialize WebSocket if not already connected
    if (!WebSocketService.isConnected) {
      WebSocketService.connect();
    }
    
    // Subscribe to events
    const unsubscribeConnection = WebSocketService.subscribe('connection', handleConnectionChange);
    const unsubscribeAlert = WebSocketService.subscribe('alert', handleNewAlert);
    
    // Load initial data
    loadAlerts();
    
    // Cleanup
    return () => {
      console.log('[AlertsPage] Unmounting');
      unsubscribeConnection();
      unsubscribeAlert();
    };
  }, []);
  
  // Function to apply filters to alerts
  const applyFilters = (alertsToFilter = alerts, currentFilters = filters) => {
    if (!alertsToFilter) return;
    
    const filtered = alertsToFilter.filter(alert => {
      // Filter by severity
      if (!currentFilters.severities[alert.severity?.toLowerCase()]) {
        return false;
      }
      
      // Filter by status
      if (!currentFilters.statuses[alert.status?.toLowerCase()]) {
        return false;
      }
      
      // Filter by search term
      if (currentFilters.searchTerm) {
        const term = currentFilters.searchTerm.toLowerCase();
        return (
          alert.threat_type?.toLowerCase().includes(term) ||
          alert.description?.toLowerCase().includes(term) ||
          alert.device_id?.toLowerCase().includes(term)
        );
      }
      
      return true;
    });
    
    setFilteredAlerts(filtered);
  };
  
  // Update filters when they change
  useEffect(() => {
    applyFilters(alerts, filters);
  }, [filters]);
  
  // Toggle a specific filter value
  const toggleFilter = (category, value) => {
    setFilters(prev => {
      const updated = { 
        ...prev,
        [category]: {
          ...prev[category],
          [value]: !prev[category][value]
        }
      };
      
      return updated;
    });
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    const searchTerm = e.target.value;
    setFilters(prev => ({
      ...prev,
      searchTerm
    }));
  };
  
  // Reset all filters to default values
  const resetFilters = () => {
    setFilters({
      severities: {
        critical: true,
        high: true,
        medium: true,
        low: true
      },
      statuses: {
        open: true,
        investigating: true,
        resolved: false
      },
      searchTerm: ''
    });
  };
  
  // Refresh alerts
  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      
      // Get alerts from service
      const alerts = await AlertService.fetchAlerts(100);
      console.log(`[AlertsPage] Refreshed ${alerts.length} alerts`);
      setAlerts(alerts);
      applyFilters(alerts, filters);
      
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('[AlertsPage] Error refreshing alerts:', err);
      setError(`Failed to refresh: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Security Alerts</h1>
        
        <div className="flex items-center gap-4">
          {/* Connection status */}
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
          
          {/* Filter toggle button */}
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center bg-blue-50 text-blue-600 px-4 py-2 rounded hover:bg-blue-100"
          >
            <FiFilter className="mr-2" />
            Filters {showFilters ? 'Hide' : 'Show'}
          </button>
          
          {/* Refresh button */}
          <button 
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            <FiRefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      {/* Filters panel */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Filter Alerts</h2>
            <button 
              onClick={resetFilters}
              className="text-blue-500 hover:text-blue-700 text-sm"
            >
              Reset Filters
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Search box */}
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                id="search"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search alerts..."
                value={filters.searchTerm}
                onChange={handleSearchChange}
              />
            </div>
            
            {/* Severity filters */}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">Severity</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip 
                  label="Critical" 
                  isActive={filters.severities.critical}
                  onClick={() => toggleFilter('severities', 'critical')}
                  color="red"
                />
                <FilterChip 
                  label="High" 
                  isActive={filters.severities.high}
                  onClick={() => toggleFilter('severities', 'high')}
                  color="orange"
                />
                <FilterChip 
                  label="Medium" 
                  isActive={filters.severities.medium}
                  onClick={() => toggleFilter('severities', 'medium')}
                  color="yellow"
                />
                <FilterChip 
                  label="Low" 
                  isActive={filters.severities.low}
                  onClick={() => toggleFilter('severities', 'low')}
                  color="green"
                />
              </div>
            </div>
            
            {/* Status filters */}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">Status</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip 
                  label="Open" 
                  isActive={filters.statuses.open}
                  onClick={() => toggleFilter('statuses', 'open')}
                  color="yellow"
                />
                <FilterChip 
                  label="Investigating" 
                  isActive={filters.statuses.investigating}
                  onClick={() => toggleFilter('statuses', 'investigating')}
                  color="blue"
                />
                <FilterChip 
                  label="Resolved" 
                  isActive={filters.statuses.resolved}
                  onClick={() => toggleFilter('statuses', 'resolved')}
                  color="green"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Alerts count */}
      <div className="mb-4 font-medium text-gray-700">
        Showing {filteredAlerts.length} {filteredAlerts.length === 1 ? 'alert' : 'alerts'}
        {alerts.length > filteredAlerts.length && ` (filtered from ${alerts.length})`}
      </div>
      
      {/* Alerts table */}
      <div className="bg-white rounded-lg shadow">
        <ThreatsList 
          threats={filteredAlerts} 
          isLoading={isLoading} 
        />
      </div>
      
      {/* No alerts message */}
      {!isLoading && filteredAlerts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">
            {alerts.length === 0 
              ? 'No alerts have been detected yet.' 
              : 'No alerts match your current filters.'}
          </p>
          {alerts.length > 0 && (
            <button 
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Filter chip component
const FilterChip = ({ label, isActive, onClick, color }) => {
  const baseClasses = "px-3 py-1 rounded-full text-sm font-medium flex items-center";
  
  const getColorClasses = () => {
    if (!isActive) return "bg-gray-100 text-gray-700 hover:bg-gray-200";
    
    switch (color) {
      case 'red': return "bg-red-100 text-red-800";
      case 'orange': return "bg-orange-100 text-orange-800";
      case 'yellow': return "bg-yellow-100 text-yellow-800";
      case 'green': return "bg-green-100 text-green-800";
      case 'blue': return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };
  
  return (
    <button 
      onClick={onClick}
      className={`${baseClasses} ${getColorClasses()}`}
    >
      {label}
      {isActive ? <FiCheck className="ml-1" /> : <FiX className="ml-1" />}
    </button>
  );
};

export default AlertsPage; 