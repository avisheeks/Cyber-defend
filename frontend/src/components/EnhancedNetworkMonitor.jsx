import React, { useState, useEffect } from 'react';
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
  AreaChart,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  BarChart,
  Bar
} from 'recharts';
import { 
  FiDownload, 
  FiUpload, 
  FiActivity, 
  FiLink, 
  FiAlertTriangle, 
  FiCpu, 
  FiHardDrive,
  FiRefreshCw,
  FiWifi,
  FiServer,
  FiCheckCircle,
  FiShield,
  FiTrendingUp
} from 'react-icons/fi';
import NetworkWebSocketService from '../services/NetworkWebSocketService';
import AlertService from '../services/AlertService';

// Create a specialized WebSocket service for network monitoring
const networkWsService = NetworkWebSocketService.getInstance('/ws/network');

const EnhancedNetworkMonitor = () => {
  // Network data state
  const [networkData, setNetworkData] = useState({
    inboundTraffic: 0,
    outboundTraffic: 0,
    packetRate: 0,
    activeConnections: 0,
    warningEvents: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    processCount: 0,
    topProcesses: []
  });
  
  // Chart data state
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [connectionHistory, setConnectionHistory] = useState([]);
  const [warningHistory, setWarningHistory] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [reconnectInfo, setReconnectInfo] = useState(null);
  
  // Max data points to keep in history
  const MAX_HISTORY_LENGTH = 50;
  
  // Colors for charts
  const COLORS = {
    inbound: '#3b82f6',    // Blue
    outbound: '#10b981',   // Green
    packet: '#f97316',     // Orange
    connection: '#a855f7', // Purple
    warning: '#ef4444',    // Red
    cpu: '#fbbf24',        // Yellow
    memory: '#06b6d4'      // Cyan
  };
  
  // Format tooltip values
  const formatTrafficValue = (value) => `${value} MB/s`;
  const formatPacketValue = (value) => `${value} pps`;
  const formatConnectionValue = (value) => `${value}`;
  const formatPercentValue = (value) => `${value}%`;
  
  // Add threat correlation data state
  const [threatCorrelationData, setThreatCorrelationData] = useState([]);
  const [threatsByCategory, setThreatsByCategory] = useState([]);
  const [attackVectors, setAttackVectors] = useState([]);
  
  // Effect to set up WebSocket connection via service
  useEffect(() => {
    console.log('NetworkMonitor: Setting up WebSocket connection via service');
    
    // Handle connection status changes
    const handleConnectionChange = (connected) => {
      console.log('NetworkMonitor: Connection status changed:', connected);
      setIsConnected(connected);
      setConnectionStatus(connected ? 'Connected to server' : 'Disconnected from server');
      
      if (connected) {
        setConnectionError(null);
      } else if (!connectionError) {
        setConnectionError('Connection to server lost. Attempting to reconnect...');
      }
    };
    
    // Handle reconnection attempts
    const handleReconnect = (info) => {
      console.log('NetworkMonitor: Reconnection attempt:', info);
      setReconnectInfo(info);
      setConnectionStatus(`Reconnecting... Attempt ${info.attempt}/${info.maxAttempts}`);
    };
    
    // Handle messages
    const handleMessage = (message) => {
      console.log('NetworkMonitor: Message received via service');
      setLastMessage(JSON.stringify(message));
      
      // Process the message
      handleIncomingData(message);
    };
    
    // Handle errors
    const handleError = (error) => {
      console.error('NetworkMonitor: WebSocket error:', error);
      setConnectionError(`Connection error: ${error.message || 'Unknown error'}`);
    };
    
    // Subscribe to WebSocket events
    const unsubscribeConnection = networkWsService.subscribe('connection', handleConnectionChange);
    const unsubscribeMessage = networkWsService.subscribe('message', handleMessage);
    const unsubscribeReconnect = networkWsService.subscribe('reconnect', handleReconnect);
    const unsubscribeError = networkWsService.subscribe('error', handleError);
    
    // Ensure connection is established
    networkWsService.connect();
    
    // Clean up subscriptions on unmount
    return () => {
      console.log('NetworkMonitor: Cleaning up WebSocket subscriptions');
      unsubscribeConnection();
      unsubscribeMessage();
      unsubscribeReconnect();
      unsubscribeError();
      
      // Don't disconnect if other components might be using the service
      // networkWsService.disconnect(true);
    };
  }, [connectionError]);
  
  // Function to handle incoming WebSocket data
  const handleIncomingData = (data) => {
    // Handle initial data load (complete history)
    if (data.type === "initial") {
      processInitialData(data);
    } else if (data.type === "update") {
      // Handle real-time updates (single data point)
      processUpdateData(data);
    }
  };
  
  // Process initial batch of data
  const processInitialData = (data) => {
    console.log('NetworkMonitor: Processing initial data');
    
    const processHistoryData = (historyArray, propertyName) => {
      if (!Array.isArray(historyArray) || historyArray.length === 0) return [];
      
      return historyArray
        .filter(item => item && item.time && item.value !== undefined)
        .map(item => ({
          time: new Date(item.time).toLocaleTimeString(),
          [propertyName]: item.value
        }))
        .slice(-MAX_HISTORY_LENGTH);
    };
    
    // Process inbound traffic history
    const inboundHistory = processHistoryData(data.inbound_traffic, 'inbound');
    
    // Process outbound traffic history
    const outboundHistory = processHistoryData(data.outbound_traffic, 'outbound');
    
    // Combine traffic data
    const combinedTrafficHistory = [];
    for (let i = 0; i < Math.max(inboundHistory.length, outboundHistory.length); i++) {
      const entry = {};
      
      // Add time (prefer inbound time if available)
      if (inboundHistory[i]) {
        entry.time = inboundHistory[i].time;
        entry.inbound = inboundHistory[i].inbound;
      }
      
      if (outboundHistory[i]) {
        if (!entry.time) entry.time = outboundHistory[i].time;
        entry.outbound = outboundHistory[i].outbound;
      }
      
      combinedTrafficHistory.push(entry);
    }
    
    // Process packet rate history
    const packetHistory = processHistoryData(data.packet_rate, 'packets');
    
    // Process connections history
    const connectionsHistory = processHistoryData(data.active_connections, 'connections');
    
    // Combine connection data
    const combinedConnectionHistory = [];
    for (let i = 0; i < Math.max(packetHistory.length, connectionsHistory.length); i++) {
      const entry = {};
      
      // Add time (prefer packets time if available)
      if (packetHistory[i]) {
        entry.time = packetHistory[i].time;
        entry.packets = packetHistory[i].packets;
      }
      
      if (connectionsHistory[i]) {
        if (!entry.time) entry.time = connectionsHistory[i].time;
        entry.connections = connectionsHistory[i].connections;
      }
      
      combinedConnectionHistory.push(entry);
    }
    
    // Process warnings
    const warnings = Array.isArray(data.warnings) ? data.warnings : [];
    
    // Update state with processed data
    setTrafficHistory(combinedTrafficHistory);
    setConnectionHistory(combinedConnectionHistory);
    setWarningHistory(warnings);
    
    // Set the most recent metrics
    updateLatestMetrics(
      combinedTrafficHistory, 
      combinedConnectionHistory,
      warnings
    );
  };
  
  // Process update data (single data point)
  const processUpdateData = (data) => {
    if (!data || !data.data) return;
    
    const updateData = data.data;
    
    // Format current time
    const now = new Date().toLocaleTimeString();
    
    // Update traffic history
    if (updateData.inbound_traffic || updateData.outbound_traffic) {
      setTrafficHistory(prev => {
        const newPoint = { time: now };
        
        if (updateData.inbound_traffic && updateData.inbound_traffic.value !== undefined) {
          newPoint.inbound = updateData.inbound_traffic.value;
        }
        
        if (updateData.outbound_traffic && updateData.outbound_traffic.value !== undefined) {
          newPoint.outbound = updateData.outbound_traffic.value;
        }
        
        const newHistory = [...prev, newPoint];
        if (newHistory.length > MAX_HISTORY_LENGTH) {
          return newHistory.slice(-MAX_HISTORY_LENGTH);
        }
        return newHistory;
      });
    }
    
    // Update connection history
    if (updateData.packet_rate || updateData.active_connections) {
      setConnectionHistory(prev => {
        const newPoint = { time: now };
        
        if (updateData.packet_rate && updateData.packet_rate.value !== undefined) {
          newPoint.packets = updateData.packet_rate.value;
        }
        
        if (updateData.active_connections && updateData.active_connections.value !== undefined) {
          newPoint.connections = updateData.active_connections.value;
        }
        
        const newHistory = [...prev, newPoint];
        if (newHistory.length > MAX_HISTORY_LENGTH) {
          return newHistory.slice(-MAX_HISTORY_LENGTH);
        }
        return newHistory;
      });
    }
    
    // Handle warning event
    if (updateData.warning) {
      setWarningHistory(prev => {
        const warning = {
          ...updateData.warning,
          time: now
        };
        
        const newWarnings = [...prev, warning];
        if (newWarnings.length > 10) {
          return newWarnings.slice(-10);
        }
        return newWarnings;
      });
      
      // Add to anomalies list
      setAnomalies(prev => {
        const anomaly = {
          type: updateData.warning.type,
          message: updateData.warning.message,
          time: now
        };
        
        const newAnomalies = [...prev, anomaly];
        if (newAnomalies.length > 5) {
          return newAnomalies.slice(-5);
        }
        return newAnomalies;
      });
    }
    
    // Update latest metrics from this update
    updateLatestMetricsFromUpdate(updateData);
  };
  
  // Update latest metrics from historical data
  const updateLatestMetrics = (trafficData, connectionData, warnings) => {
    setNetworkData(prev => {
      const newData = { ...prev };
      
      // Get last traffic point
      const lastTrafficPoint = trafficData.length > 0 ? trafficData[trafficData.length - 1] : null;
      if (lastTrafficPoint) {
        if (lastTrafficPoint.inbound !== undefined) newData.inboundTraffic = lastTrafficPoint.inbound;
        if (lastTrafficPoint.outbound !== undefined) newData.outboundTraffic = lastTrafficPoint.outbound;
      }
      
      // Get last connection point
      const lastConnectionPoint = connectionData.length > 0 ? connectionData[connectionData.length - 1] : null;
      if (lastConnectionPoint) {
        if (lastConnectionPoint.packets !== undefined) newData.packetRate = lastConnectionPoint.packets;
        if (lastConnectionPoint.connections !== undefined) newData.activeConnections = lastConnectionPoint.connections;
      }
      
      // Count warnings
      newData.warningEvents = warnings.length;
      
      return newData;
    });
  };
  
  // Update latest metrics from update data
  const updateLatestMetricsFromUpdate = (updateData) => {
    setNetworkData(prev => {
      const newData = { ...prev };
      
      // Update traffic metrics
      if (updateData.inbound_traffic && updateData.inbound_traffic.value !== undefined) {
        newData.inboundTraffic = updateData.inbound_traffic.value;
      }
      
      if (updateData.outbound_traffic && updateData.outbound_traffic.value !== undefined) {
        newData.outboundTraffic = updateData.outbound_traffic.value;
      }
      
      // Update connection metrics
      if (updateData.packet_rate && updateData.packet_rate.value !== undefined) {
        newData.packetRate = updateData.packet_rate.value;
      }
      
      if (updateData.active_connections && updateData.active_connections.value !== undefined) {
        newData.activeConnections = updateData.active_connections.value;
      }
      
      // Update system metrics if available
      if (updateData.cpu_usage !== undefined) {
        newData.cpuUsage = updateData.cpu_usage;
      }
      
      if (updateData.memory_usage !== undefined) {
        newData.memoryUsage = updateData.memory_usage;
      }
      
      if (updateData.memory_used !== undefined) {
        newData.memoryUsed = updateData.memory_used;
      }
      
      if (updateData.memory_total !== undefined) {
        newData.memoryTotal = updateData.memory_total;
      }
      
      if (updateData.process_count !== undefined) {
        newData.processCount = updateData.process_count;
      }
      
      if (updateData.top_processes) {
        newData.topProcesses = updateData.top_processes;
      }
      
      // If we have a warning, increment counter
      if (updateData.warning) {
        newData.warningEvents = prev.warningEvents + 1;
      }
      
      return newData;
    });
  };
  
  // Create test data for debugging
  const createTestDataPoint = () => {
    // Create a simulated data update
    const simulatedData = {
      type: "update",
      data: {
        inbound_traffic: {
          time: new Date().toISOString(),
          value: Math.random() * 10
        },
        outbound_traffic: {
          time: new Date().toISOString(),
          value: Math.random() * 8
        },
        packet_rate: {
          time: new Date().toISOString(),
          value: Math.floor(Math.random() * 1000)
        },
        active_connections: {
          time: new Date().toISOString(),
          value: Math.floor(Math.random() * 50)
        },
        cpu_usage: Math.random() * 100,
        memory_usage: Math.random() * 100,
        warning: Math.random() > 0.7 ? {
          type: "unusual_traffic",
          message: "Unusual network traffic pattern detected"
        } : null
      }
    };
    
    // Process the simulated data
    handleIncomingData(simulatedData);
  };
  
  // Reset the WebSocket connection
  const resetConnection = () => {
    console.log('NetworkMonitor: Forcing reconnection');
    setConnectionStatus('Resetting connection...');
    networkWsService.forceReconnection();
  };
  
  // If we don't have real data, set connection error
  useEffect(() => {
    if (!isConnected && !connectionError) {
      setConnectionError("No connection to Windows monitoring agent. Please start the monitoring agent to see real-time data.");
    }
  }, [isConnected, connectionError]);
  
  // System metrics data for display
  const getSystemMetricsData = () => [
    {
      name: 'CPU',
      value: networkData.cpuUsage,
      fill: COLORS.cpu
    },
    {
      name: 'Memory',
      value: networkData.memoryUsage,
      fill: COLORS.memory
    }
  ];
  
  // Traffic distribution data for pie chart
  const getTrafficDistribution = () => {
    const total = networkData.inboundTraffic + networkData.outboundTraffic;
    if (total === 0) return [];
    
    return [
      {
        name: 'Inbound',
        value: networkData.inboundTraffic,
        fill: COLORS.inbound
      },
      {
        name: 'Outbound',
        value: networkData.outboundTraffic,
        fill: COLORS.outbound
      }
    ];
  };
  
  // Get status card color based on value
  const getStatusColor = (value, thresholds) => {
    if (value >= thresholds.high) return 'bg-red-500/20 border-red-500/30';
    if (value >= thresholds.medium) return 'bg-orange-500/20 border-orange-500/30';
    return 'bg-green-500/20 border-green-500/30';
  };
  
  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800/90 backdrop-blur-sm text-white p-2 rounded border border-gray-700/50 shadow-lg text-xs">
          <p className="font-semibold">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value} {entry.unit || ''}
            </p>
          ))}
        </div>
      );
    }
    
    return null;
  };
  
  // Effect to fetch alert data and generate correlation
  useEffect(() => {
    const generateThreatCorrelationData = async () => {
      try {
        // Fetch alerts from service
        const alerts = await AlertService.fetchAlerts();
        
        // Count threats by severity
        const severityCounts = {
          low: 0,
          medium: 0, 
          high: 0,
          critical: 0
        };
        
        alerts.forEach(alert => {
          if (severityCounts[alert.severity] !== undefined) {
            severityCounts[alert.severity]++;
          }
        });
        
        // Create threat distribution data
        const threatDistribution = [
          { name: 'Low', value: severityCounts.low, fill: '#10b981' },
          { name: 'Medium', value: severityCounts.medium, fill: '#f97316' },
          { name: 'High', value: severityCounts.high, fill: '#f59e0b' },
          { name: 'Critical', value: severityCounts.critical, fill: '#ef4444' }
        ];
        
        setThreatsByCategory(threatDistribution);
        
        // Generate attack vectors (simulated based on alert count)
        const vectors = [
          { name: 'Port Scanning', value: Math.min(severityCounts.low * 2, 40) },
          { name: 'Brute Force', value: Math.min(severityCounts.medium * 3, 25) },
          { name: 'Malware', value: Math.min(severityCounts.high * 4, 15) },
          { name: 'Data Exfiltration', value: Math.min(severityCounts.critical * 5, 20) }
        ];
        
        setAttackVectors(vectors);
        
        // Generate time-based correlation data (simulated)
        const correlationData = [];
        const now = new Date();
        
        // Generate last 24 hours of data
        for (let i = 0; i < 24; i++) {
          const hour = new Date(now);
          hour.setHours(now.getHours() - 24 + i);
          
          // Base network activity that gradually increases
          const baseActivity = 20 + (i * 1.5);
          
          // Threats increase network activity
          const hourlyThreats = Math.floor(Math.random() * 3);
          const trafficSpike = hourlyThreats * 15;
          
          correlationData.push({
            time: hour.toLocaleTimeString(),
            networkActivity: baseActivity + trafficSpike,
            threats: hourlyThreats,
            anomalyScore: hourlyThreats > 0 ? 50 + (hourlyThreats * 20) : Math.random() * 30
          });
        }
        
        setThreatCorrelationData(correlationData);
        
      } catch (error) {
        console.error('Error generating threat correlation data:', error);
      }
    };
    
    // Generate correlation data
    generateThreatCorrelationData();
    
    // Regenerate every 5 minutes
    const interval = setInterval(generateThreatCorrelationData, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Network Monitoring</h1>
        
        {/* Connection status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className={`h-3 w-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm">{connectionStatus}</span>
          </div>
          
          <button 
            onClick={resetConnection} 
            className="flex items-center text-sm py-1 px-3 rounded bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30"
            title="Reset connection"
          >
            <FiRefreshCw className="mr-1" /> Reset
          </button>
          
          <button 
            onClick={createTestDataPoint} 
            className="flex items-center text-sm py-1 px-3 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30"
            title="Generate test data"
          >
            <FiActivity className="mr-1" /> Test
          </button>
        </div>
      </div>
      
      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Inbound Traffic */}
        <div className={`rounded-xl p-4 backdrop-blur-sm border ${getStatusColor(networkData.inboundTraffic, { medium: 5, high: 8 })}`}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Inbound Traffic</div>
              <div className="text-2xl font-semibold mt-1">{networkData.inboundTraffic.toFixed(2)} <span className="text-sm">MB/s</span></div>
            </div>
            <div className="p-2 rounded-full bg-blue-500/20 text-blue-400">
              <FiDownload size={20} />
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {trafficHistory.length > 1 ? 
              `${formatTrafficValue(
                trafficHistory[trafficHistory.length - 2]?.inbound || 0
              )} previously` : 'Collecting data...'}
          </div>
        </div>
        
        {/* Outbound Traffic */}
        <div className={`rounded-xl p-4 backdrop-blur-sm border ${getStatusColor(networkData.outboundTraffic, { medium: 4, high: 7 })}`}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Outbound Traffic</div>
              <div className="text-2xl font-semibold mt-1">{networkData.outboundTraffic.toFixed(2)} <span className="text-sm">MB/s</span></div>
            </div>
            <div className="p-2 rounded-full bg-green-500/20 text-green-400">
              <FiUpload size={20} />
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {trafficHistory.length > 1 ? 
              `${formatTrafficValue(
                trafficHistory[trafficHistory.length - 2]?.outbound || 0
              )} previously` : 'Collecting data...'}
          </div>
        </div>
        
        {/* Packet Rate */}
        <div className={`rounded-xl p-4 backdrop-blur-sm border ${getStatusColor(networkData.packetRate, { medium: 500, high: 800 })}`}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Packet Rate</div>
              <div className="text-2xl font-semibold mt-1">{Math.round(networkData.packetRate)} <span className="text-sm">pps</span></div>
            </div>
            <div className="p-2 rounded-full bg-orange-500/20 text-orange-400">
              <FiActivity size={20} />
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {connectionHistory.length > 1 ? 
              `${formatPacketValue(
                connectionHistory[connectionHistory.length - 2]?.packets || 0
              )} previously` : 'Collecting data...'}
          </div>
        </div>
        
        {/* Active Connections */}
        <div className={`rounded-xl p-4 backdrop-blur-sm border ${getStatusColor(networkData.activeConnections, { medium: 20, high: 40 })}`}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Active Connections</div>
              <div className="text-2xl font-semibold mt-1">{Math.round(networkData.activeConnections)}</div>
            </div>
            <div className="p-2 rounded-full bg-purple-500/20 text-purple-400">
              <FiLink size={20} />
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {connectionHistory.length > 1 ? 
              `${formatConnectionValue(
                connectionHistory[connectionHistory.length - 2]?.connections || 0
              )} previously` : 'Collecting data...'}
          </div>
        </div>
      </div>
      
      {/* Error message */}
      {connectionError && (
        <div className="mb-8 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-start">
            <FiAlertTriangle className="text-red-500 mr-2 mt-1" />
            <div>
              <p className="text-red-500 font-medium">{connectionError}</p>
              {reconnectInfo && (
                <p className="text-gray-400 text-sm mt-1">
                  Reconnection attempt {reconnectInfo.attempt} of {reconnectInfo.maxAttempts} in {Math.round(reconnectInfo.delay / 1000)} seconds...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Traffic Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Traffic Over Time */}
        <div className="col-span-2 bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-gray-500/20">
          <h3 className="text-lg font-medium mb-3">Network Traffic</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trafficHistory}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} tickFormatter={(value) => `${value}MB/s`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="inbound" 
                  name="Inbound"
                  stroke={COLORS.inbound} 
                  fill={COLORS.inbound} 
                  fillOpacity={0.3} 
                  activeDot={{ r: 5 }} 
                  unit=" MB/s"
                  isAnimationActive={false}
                />
                <Area 
                  type="monotone" 
                  dataKey="outbound" 
                  name="Outbound"
                  stroke={COLORS.outbound} 
                  fill={COLORS.outbound} 
                  fillOpacity={0.3} 
                  activeDot={{ r: 5 }} 
                  unit=" MB/s"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Traffic Distribution */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-gray-500/20">
          <h3 className="text-lg font-medium mb-3">Traffic Distribution</h3>
          
          {networkData.inboundTraffic === 0 && networkData.outboundTraffic === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No traffic data available
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getTrafficDistribution()}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {getTrafficDistribution().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toFixed(2)} MB/s`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      
      {/* Connection Charts */}
      <div className="mb-8 bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-gray-500/20">
        <h3 className="text-lg font-medium mb-3">Connection Metrics</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={connectionHistory}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} />
              <YAxis yAxisId="left" stroke="#9CA3AF" fontSize={12} tickLine={false} tickFormatter={(value) => `${value}pps`} />
              <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" fontSize={12} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="packets" 
                name="Packet Rate"
                stroke={COLORS.packet} 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
                unit=" pps"
                isAnimationActive={false}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="connections" 
                name="Active Connections"
                stroke={COLORS.connection} 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* System Resources and Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* System Resources */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-gray-500/20">
          <h3 className="text-lg font-medium mb-3">System Resources</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart 
                cx="50%" 
                cy="50%" 
                innerRadius="20%" 
                outerRadius="90%" 
                data={getSystemMetricsData()}
                startAngle={180} 
                endAngle={0}
              >
                <RadialBar
                  minAngle={15}
                  background
                  clockWise={true}
                  dataKey="value"
                  cornerRadius={10}
                  label={{ fill: '#fff', position: 'insideStart', formatter: (value) => `${Math.round(value)}%` }}
                />
                <Legend 
                  iconSize={10} 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                />
                <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Anomalies */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-gray-500/20">
          <h3 className="text-lg font-medium mb-3">Detected Anomalies</h3>
          
          {anomalies.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400">
              <FiCheckCircle size={40} className="text-green-500 mb-3" />
              <p>No anomalies detected</p>
              <p className="text-sm mt-1">Network traffic patterns appear normal</p>
            </div>
          ) : (
            <div className="h-64 overflow-y-auto pr-2">
              {anomalies.map((anomaly, index) => (
                <div 
                  key={index} 
                  className="mb-3 p-3 rounded bg-red-500/10 border border-red-500/20 flex items-center"
                >
                  <FiAlertTriangle className="text-red-500 mr-3" size={20} />
                  <div>
                    <p className="font-medium">{anomaly.type}</p>
                    <p className="text-sm text-gray-400">{anomaly.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{anomaly.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Warning Events */}
      <div className="mb-8 bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-gray-500/20">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium">Recent Warning Events</h3>
          <div className="bg-amber-500/20 py-1 px-3 rounded-full text-amber-400 text-sm">
            {networkData.warningEvents} events
          </div>
        </div>
        
        {warningHistory.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-gray-400">
            No warning events recorded
          </div>
        ) : (
          <div className="space-y-2">
            {warningHistory.map((warning, index) => (
              <div key={index} className="bg-gray-800/50 rounded p-3 flex items-start">
                <FiShield className="text-amber-500 mr-2 mt-1" />
                <div>
                  <div className="font-medium">{warning.type}</div>
                  <div className="text-sm text-gray-400">{warning.message}</div>
                  <div className="text-xs text-gray-500 mt-1">{warning.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Threat Correlation Section */}
      <div className="mt-12 mb-4">
        <h2 className="text-xl font-bold flex items-center">
          <FiTrendingUp className="mr-2 text-purple-400" /> Threat Correlation Analysis
        </h2>
        <p className="text-gray-400 text-sm">Visualizing relationships between network activity and security threats</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Correlation Chart */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-gray-500/20">
          <h3 className="text-lg font-medium mb-3">Network Activity vs Threats</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={threatCorrelationData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                <YAxis yAxisId="left" stroke="#9CA3AF" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  yAxisId="right" 
                  dataKey="threats" 
                  name="Detected Threats" 
                  fill="#ef4444" 
                  opacity={0.7}
                  barSize={20}
                />
                <Line 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="networkActivity" 
                  name="Network Activity" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="anomalyScore" 
                  name="Anomaly Score" 
                  stroke="#a855f7" 
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Threat Distribution */}
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-gray-500/20">
          <h3 className="text-lg font-medium mb-3">Threat Severity Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={threatsByCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  labelLine={true}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {threatsByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Attack Vectors */}
      <div className="mb-8 bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-gray-500/20">
        <h3 className="text-lg font-medium mb-3">Detected Attack Vectors</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={attackVectors}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
              <YAxis 
                type="category" 
                dataKey="name" 
                stroke="#9CA3AF" 
                fontSize={12}
                width={100}
              />
              <Tooltip />
              <Bar dataKey="value" name="Occurrence Rate">
                {attackVectors.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={index === 0 ? '#10b981' : 
                          index === 1 ? '#f97316' : 
                          index === 2 ? '#f59e0b' : '#ef4444'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Debug panel */}
      <div className="mt-8 bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-gray-500/20">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-300">Connection Status</h3>
          <div className="flex items-center">
            <div className={`h-2 w-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">{connectionStatus}</span>
          </div>
        </div>
        {lastMessage && (
          <div className="mt-2">
            <div className="text-xs text-gray-500">Last Message:</div>
            <div className="text-xs text-gray-400 font-mono mt-1 bg-black/30 p-2 rounded overflow-x-auto">
              {lastMessage.length > 200 ? lastMessage.substring(0, 200) + '...' : lastMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedNetworkMonitor; 