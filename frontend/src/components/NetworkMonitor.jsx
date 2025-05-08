import React, { useState, useEffect, useRef } from 'react';
import { 
  Line, 
  LineChart, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Area,
  AreaChart
} from 'recharts';
import { FiDownload, FiUpload, FiActivity, FiLink, FiAlertTriangle, FiCpu, FiHardDrive } from 'react-icons/fi';

const NetworkMonitor = () => {
  const [networkData, setNetworkData] = useState({
    inboundTraffic: 0,
    outboundTraffic: 0,
    packetRate: 0,
    activeConnections: 0,
    warningEvents: 0,
    // System metrics
    cpuUsage: 0,
    memoryUsage: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    processCount: 0,
    topProcesses: []
  });
  
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [connectionHistory, setConnectionHistory] = useState([]);
  const [warningHistory, setWarningHistory] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  const socketRef = useRef(null);
  
  // Maximum number of data points to keep in history
  const MAX_HISTORY_LENGTH = 50;
  
  // Connect to WebSocket and handle messages
  useEffect(() => {
    // Create WebSocket connection
    const connectWebSocket = () => {
      try {
        // Update the URL to point to your actual WebSocket endpoint
        const socket = new WebSocket('ws://localhost:8000/ws/network');
        socketRef.current = socket;
        
        socket.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          setConnectionError(null);
        };
        
        socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          handleIncomingData(data);
        };
        
        socket.onclose = (event) => {
          console.log('WebSocket disconnected', event);
          setIsConnected(false);
          // Try to reconnect after a delay
          setTimeout(connectWebSocket, 3000);
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionError('Failed to connect to network monitoring service');
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        setConnectionError('Failed to connect to network monitoring service');
        // Try to reconnect after a delay
        setTimeout(connectWebSocket, 3000);
      }
    };
    
    connectWebSocket();
    
    // Clean up WebSocket on component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);
  
  // Function to handle incoming WebSocket data
  const handleIncomingData = (data) => {
    // Handle initial data load (complete history)
    if (data.type === "initial") {
      // Process historical data for charts
      // Extract just the values from the time/value objects
      const processedInboundTraffic = data.inbound_traffic.map(item => ({
        timestamp: new Date(item.time).toLocaleTimeString(),
        inboundTraffic: item.value,
        outboundTraffic: 0
      }));
      
      const processedOutboundTraffic = data.outbound_traffic.map(item => ({
        timestamp: new Date(item.time).toLocaleTimeString(),
        outboundTraffic: item.value,
        inboundTraffic: 0
      }));
      
      const processedPacketRate = data.packet_rate.map(item => ({
        timestamp: new Date(item.time).toLocaleTimeString(),
        packetRate: item.value,
        activeConnections: 0
      }));
      
      const processedConnections = data.active_connections.map(item => ({
        timestamp: new Date(item.time).toLocaleTimeString(),
        activeConnections: item.value,
        packetRate: 0
      }));
      
      // Merge the data for each chart type based on timestamp
      const mergedTrafficData = [...processedInboundTraffic, ...processedOutboundTraffic]
        .reduce((acc, item) => {
          const existing = acc.find(e => e.timestamp === item.timestamp);
          if (existing) {
            existing.inboundTraffic = item.inboundTraffic || existing.inboundTraffic;
            existing.outboundTraffic = item.outboundTraffic || existing.outboundTraffic;
          } else {
            acc.push(item);
          }
          return acc;
        }, [])
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      const mergedConnectionData = [...processedPacketRate, ...processedConnections]
        .reduce((acc, item) => {
          const existing = acc.find(e => e.timestamp === item.timestamp);
          if (existing) {
            existing.packetRate = item.packetRate || existing.packetRate;
            existing.activeConnections = item.activeConnections || existing.activeConnections;
          } else {
            acc.push(item);
          }
          return acc;
        }, [])
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Update state with processed data
      setTrafficHistory(mergedTrafficData);
      setConnectionHistory(mergedConnectionData);
      
      // Process warning events
      if (data.warnings && Array.isArray(data.warnings)) {
        const processedWarnings = data.warnings.map(warning => ({
          timestamp: new Date(warning.time).toLocaleTimeString(),
          warningEvents: warning.value || 1,
          type: warning.type,
          message: warning.message
        }));
        setWarningHistory(processedWarnings);
      }
      
      // Update current metrics with the most recent values
      if (data.inbound_traffic.length > 0 && data.outbound_traffic.length > 0) {
        setNetworkData({
          inboundTraffic: data.inbound_traffic[data.inbound_traffic.length - 1].value,
          outboundTraffic: data.outbound_traffic[data.outbound_traffic.length - 1].value,
          packetRate: data.packet_rate[data.packet_rate.length - 1].value,
          activeConnections: data.active_connections[data.active_connections.length - 1].value,
          warningEvents: data.warnings ? data.warnings.length : 0,
          // Initialize system metrics
          cpuUsage: data.cpu_usage || 0,
          memoryUsage: data.memory_usage || 0,
          memoryUsed: data.memory_used || 0,
          memoryTotal: data.memory_total || 0,
          processCount: data.process_count || 0,
          topProcesses: data.top_processes || []
        });
      }
    } else {
      // Handle real-time updates (single data point)
      // Update current metrics
      setNetworkData({
        inboundTraffic: data.data?.inbound_traffic ? data.data.inbound_traffic.value : networkData.inboundTraffic,
        outboundTraffic: data.data?.outbound_traffic ? data.data.outbound_traffic.value : networkData.outboundTraffic,
        packetRate: data.data?.packet_rate ? data.data.packet_rate.value : networkData.packetRate,
        activeConnections: data.data?.active_connections ? data.data.active_connections.value : networkData.activeConnections,
        warningEvents: data.data?.warning ? networkData.warningEvents + 1 : networkData.warningEvents,
        // Update system metrics
        cpuUsage: data.data?.cpu_usage || networkData.cpuUsage,
        memoryUsage: data.data?.memory_usage || networkData.memoryUsage,
        memoryUsed: data.data?.memory_used || networkData.memoryUsed,
        memoryTotal: data.data?.memory_total || networkData.memoryTotal,
        processCount: data.data?.process_count || networkData.processCount,
        topProcesses: data.data?.top_processes || networkData.topProcesses
      });
      
      // Create a new history entry with timestamp
      const timestamp = data.data?.inbound_traffic ? 
        new Date(data.data.inbound_traffic.time).toLocaleTimeString() : 
        new Date().toLocaleTimeString();
      
      const newEntry = {
        timestamp,
        inboundTraffic: data.data?.inbound_traffic ? data.data.inbound_traffic.value : 0,
        outboundTraffic: data.data?.outbound_traffic ? data.data.outbound_traffic.value : 0,
        packetRate: data.data?.packet_rate ? data.data.packet_rate.value : 0,
        activeConnections: data.data?.active_connections ? data.data.active_connections.value : 0,
        warningEvents: data.data?.warning ? 1 : 0,
      };
      
      // Update traffic history
      setTrafficHistory(prev => {
        const newHistory = [...prev, newEntry];
        if (newHistory.length > MAX_HISTORY_LENGTH) {
          return newHistory.slice(newHistory.length - MAX_HISTORY_LENGTH);
        }
        return newHistory;
      });
      
      // Update connection history
      setConnectionHistory(prev => {
        const newHistory = [...prev, newEntry];
        if (newHistory.length > MAX_HISTORY_LENGTH) {
          return newHistory.slice(newHistory.length - MAX_HISTORY_LENGTH);
        }
        return newHistory;
      });
      
      // Update warning history if there's a new warning
      if (data.data?.warning) {
        const warningEntry = {
          timestamp,
          warningEvents: 1,
          type: data.data.warning.type,
          message: data.data.warning.message
        };
        
        setWarningHistory(prev => {
          const newHistory = [...prev, warningEntry];
          if (newHistory.length > MAX_HISTORY_LENGTH) {
            return newHistory.slice(newHistory.length - MAX_HISTORY_LENGTH);
          }
          return newHistory;
        });
        
        // Update anomalies list
        if (data.data.warning) {
          setAnomalies(prev => [
            {
              id: Date.now(),
              type: data.data.warning.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              description: data.data.warning.message,
              timestamp: new Date().toISOString()
            },
            ...prev.slice(0, 9) // Keep only the 10 most recent anomalies
          ]);
        }
      }
    }
  };
  
  // If we don't have real data, use this for development/testing
  useEffect(() => {
    if (!isConnected && !connectionError) {
      // Display a message that real data is required
      setConnectionError("No connection to Windows monitoring agent. Please start the monitoring agent to see real-time data.");
    }
  }, [isConnected, connectionError]);
  
  // Format tooltip values
  const formatTrafficValue = (value) => `${value} MB/s`;
  const formatPacketValue = (value) => `${value} pps`;
  const formatConnectionValue = (value) => `${value}`;
  
  return (
    <div className="min-h-screen pt-20 pb-10 px-4 bg-[#0B0B0F] text-white">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Network Monitor</h1>
        
        {connectionError && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500 rounded-md text-red-400">
            <p className="font-medium mb-1">{connectionError}</p>
            <p className="text-sm">
              Start the Windows monitoring agent with <span className="font-mono bg-black/30 px-2 py-0.5 rounded">start_monitoring.bat</span> to 
              view real-time network data from your PC.
            </p>
          </div>
        )}
        
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 flex items-start">
            <div className="p-3 rounded-full bg-blue-500/20 text-blue-400 mr-4">
              <FiDownload size={24} />
            </div>
            <div>
              <h3 className="text-gray-300 text-sm mb-1">Inbound Traffic</h3>
              <p className="text-2xl font-semibold">{networkData.inboundTraffic} MB</p>
            </div>
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 flex items-start">
            <div className="p-3 rounded-full bg-green-500/20 text-green-400 mr-4">
              <FiUpload size={24} />
            </div>
            <div>
              <h3 className="text-gray-300 text-sm mb-1">Outbound Traffic</h3>
              <p className="text-2xl font-semibold">{networkData.outboundTraffic} MB</p>
            </div>
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 flex items-start">
            <div className="p-3 rounded-full bg-orange-500/20 text-orange-400 mr-4">
              <FiActivity size={24} />
            </div>
            <div>
              <h3 className="text-gray-300 text-sm mb-1">Packet Rate</h3>
              <p className="text-2xl font-semibold">{networkData.packetRate} pps</p>
            </div>
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 flex items-start">
            <div className="p-3 rounded-full bg-purple-500/20 text-purple-400 mr-4">
              <FiLink size={24} />
            </div>
            <div>
              <h3 className="text-gray-300 text-sm mb-1">Active Connections</h3>
              <p className="text-2xl font-semibold">{networkData.activeConnections}</p>
            </div>
          </div>
          
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 flex items-start">
            <div className="p-3 rounded-full bg-red-500/20 text-red-400 mr-4">
              <FiAlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-gray-300 text-sm mb-1">Warning Events</h3>
              <p className="text-2xl font-semibold">{networkData.warningEvents}</p>
            </div>
          </div>
        </div>
        
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Network Traffic Chart */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Network Traffic</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={trafficHistory}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="inboundColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="outboundColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#999"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      // For readability, only show short time
                      const parts = value.split(':');
                      return `${parts[0]}:${parts[1]}`;
                    }}
                  />
                  <YAxis stroke="#999" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px' }}
                    formatter={formatTrafficValue}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="inboundTraffic" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#inboundColor)"
                    name="Inbound (MB/s)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="outboundTraffic" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#outboundColor)"
                    name="Outbound (MB/s)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Connection Metrics Chart */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Connection Metrics</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={connectionHistory}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#999"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      // For readability, only show short time
                      const parts = value.split(':');
                      return `${parts[0]}:${parts[1]}`;
                    }}
                  />
                  <YAxis stroke="#999" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px' }}
                    formatter={(value, name) => {
                      if (name.includes("Packet")) return formatPacketValue(value);
                      return formatConnectionValue(value);
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="packetRate" 
                    stroke="#f97316" 
                    name="Packet Rate (pps)"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="activeConnections" 
                    stroke="#a855f7" 
                    name="Active Connections"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Warning Events Chart */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Warning Events</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={warningHistory}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#999"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      // For readability, only show short time
                      const parts = value.split(':');
                      return `${parts[0]}:${parts[1]}`;
                    }}
                  />
                  <YAxis stroke="#999" domain={[0, 'dataMax + 2']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px' }}
                  />
                  <Line 
                    type="stepAfter" 
                    dataKey="warningEvents" 
                    stroke="#ef4444" 
                    name="Warning Events"
                    dot={true}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Recent Anomalies */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Anomalies</h2>
            <div className="h-80 overflow-auto">
              {anomalies.length > 0 ? (
                <div className="space-y-4">
                  {anomalies.map((anomaly) => (
                    <div 
                      key={anomaly.id} 
                      className="bg-red-500/10 border border-red-500/30 rounded-md p-4"
                    >
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-red-400">{anomaly.type}</h3>
                        <span className="text-xs text-gray-400">
                          {new Date(anomaly.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mt-2">{anomaly.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No anomalies detected
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkMonitor; 