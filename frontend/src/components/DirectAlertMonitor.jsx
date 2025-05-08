import React, { useState, useEffect, useRef } from 'react';

/**
 * DirectAlertMonitor - A simple component that directly handles WebSocket connections 
 * and displays alerts with minimal complexity
 */
const DirectAlertMonitor = () => {
  // State for alerts and connection status
  const [alerts, setAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [status, setStatus] = useState('Initializing...');
  
  // WebSocket reference
  const ws = useRef(null);
  
  // Effect to set up WebSocket connection
  useEffect(() => {
    console.log('DirectAlertMonitor: Setting up WebSocket connection');
    
    // Function to create WebSocket connection
    const setupWebSocket = () => {
      try {
        // Close any existing connection
        if (ws.current) {
          ws.current.close();
        }
        
        setStatus('Connecting to WebSocket...');
        
        // Create new WebSocket connection
        ws.current = new WebSocket('ws://localhost:8000/ws');
        
        // Connection opened handler
        ws.current.onopen = () => {
          console.log('DirectAlertMonitor: WebSocket connection established');
          setIsConnected(true);
          setStatus('Connected to server');
        };
        
        // Message handler
        ws.current.onmessage = (event) => {
          console.log('DirectAlertMonitor: Message received:', event.data);
          setLastMessage(event.data);
          
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'initial' && Array.isArray(message.alerts)) {
              // Handle initial alerts
              console.log('DirectAlertMonitor: Received initial alerts:', message.alerts.length);
              setAlerts(message.alerts);
              setStatus(`Loaded ${message.alerts.length} alerts`);
            } 
            else if (message.type === 'alert' && message.data) {
              // Handle new alert
              console.log('DirectAlertMonitor: Received new alert:', message.data);
              
              // Add the new alert at the beginning of the list (newest first)
              setAlerts(prevAlerts => {
                // Check if alert already exists (by ID)
                const alertExists = prevAlerts.some(a => a.id === message.data.id);
                
                if (alertExists) {
                  // Replace the existing alert
                  return prevAlerts.map(alert => 
                    alert.id === message.data.id ? message.data : alert
                  );
                } else {
                  // Add new alert to the beginning
                  return [message.data, ...prevAlerts];
                }
              });
              
              setStatus(`New alert received: ${message.data.threat_type}`);
            }
          } catch (error) {
            console.error('DirectAlertMonitor: Error parsing message:', error);
            setStatus(`Error parsing message: ${error.message}`);
          }
        };
        
        // Error handler
        ws.current.onerror = (error) => {
          console.error('DirectAlertMonitor: WebSocket error:', error);
          setIsConnected(false);
          setStatus('WebSocket error occurred');
        };
        
        // Connection closed handler
        ws.current.onclose = (event) => {
          console.log('DirectAlertMonitor: WebSocket connection closed:', event.code, event.reason);
          setIsConnected(false);
          setStatus('Connection closed. Reconnecting...');
          
          // Try to reconnect after a delay
          setTimeout(setupWebSocket, 3000);
        };
      } catch (error) {
        console.error('DirectAlertMonitor: Error setting up WebSocket:', error);
        setStatus(`Connection error: ${error.message}`);
        setTimeout(setupWebSocket, 3000);
      }
    };
    
    // Initialize the WebSocket connection
    setupWebSocket();
    
    // Clean up on unmount
    return () => {
      console.log('DirectAlertMonitor: Cleaning up');
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);
  
  // Create a test alert
  const createTestAlert = async () => {
    try {
      const response = await fetch('http://localhost:8000/test-alert');
      if (!response.ok) throw new Error(`Error: ${response.status}`);
      const result = await response.json();
      console.log('DirectAlertMonitor: Test alert created:', result);
      setStatus(`Test alert created: ${result.alert.threat_type}`);
    } catch (error) {
      console.error('DirectAlertMonitor: Error creating test alert:', error);
      setStatus(`Error creating test alert: ${error.message}`);
    }
  };
  
  // Get severity badge color class
  const getSeverityClass = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <div className="p-4 bg-white shadow rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Direct Alert Monitor</h2>
        <div className="flex items-center space-x-2">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-1">Status:</div>
        <div className="bg-gray-50 p-2 rounded border text-sm">{status}</div>
      </div>
      
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-1">Actions:</div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={createTestAlert}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Create Test Alert
          </button>
          
          <button 
            onClick={() => {
              // Close existing connection
              if (ws.current) {
                ws.current.close();
                ws.current = null;
              }
              // Force reconnect
              setStatus('Reconnecting...');
              setTimeout(() => {
                const url = 'ws://localhost:8000/ws';
                ws.current = new WebSocket(url);
                ws.current.onopen = () => {
                  console.log('DirectAlertMonitor: Connection reset successful');
                  setIsConnected(true);
                  setStatus('Connection reset successful');
                };
                ws.current.onmessage = (event) => {
                  console.log('DirectAlertMonitor: Message received after reset:', event.data);
                  setLastMessage(event.data);
                  try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'initial' && Array.isArray(message.alerts)) {
                      setAlerts(message.alerts);
                      setStatus(`Reset complete. Loaded ${message.alerts.length} alerts`);
                    }
                  } catch (error) {
                    console.error('DirectAlertMonitor: Error parsing message after reset:', error);
                  }
                };
                ws.current.onerror = (error) => {
                  console.error('DirectAlertMonitor: WebSocket error after reset:', error);
                  setIsConnected(false);
                  setStatus('Error after reset: ' + error);
                };
                ws.current.onclose = () => {
                  setIsConnected(false);
                  setStatus('Connection closed after reset');
                };
              }, 500);
            }}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Reset Connection
          </button>
          
          <button 
            onClick={() => {
              // Clear all alerts
              setAlerts([]);
              setStatus('Alerts cleared');
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear Alerts
          </button>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-1">Connection Status:</div>
        <div className="bg-gray-50 p-2 rounded border text-sm">
          <p><strong>Connected:</strong> {isConnected ? 'Yes' : 'No'}</p>
          <p><strong>WebSocket Ready State:</strong> {ws.current ? ws.current.readyState : 'No connection'}</p>
          <p className="text-xs text-gray-500 mt-1">
            (0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED)
          </p>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-1">Last Raw Message:</div>
        <div className="bg-gray-50 p-2 rounded border text-xs overflow-x-auto whitespace-pre-wrap">
          {lastMessage ? lastMessage : 'No messages received yet'}
        </div>
      </div>
      
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-gray-600">Alerts ({alerts.length}):</div>
        </div>
        
        {alerts.length > 0 ? (
          <div className="border rounded overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {alerts.map(alert => (
                  <tr key={alert.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm">{alert.threat_type}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSeverityClass(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">{alert.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 rounded border">
            No alerts received yet
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectAlertMonitor; 