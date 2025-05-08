/**
 * NetworkWebSocketService - Service for managing WebSocket connections to network monitoring endpoints
 * Extends WebSocketService functionality with network-specific methods
 */
import WebSocketService from './WebSocketService';

class NetworkWebSocketService {
  constructor(path = '/ws/network') {
    this.debug = true;
    this.path = path;
    
    // Use the Singleton pattern - only create one service per endpoint
    if (NetworkWebSocketService.instances[path]) {
      this.log(`Returning existing instance for ${path}`);
      return NetworkWebSocketService.instances[path];
    }
    
    // Create a clone of the main WebSocket service with customizations
    this.wsService = Object.create(WebSocketService);
    this.wsService.path = path;
    this.wsService.messageTypes = {
      ...this.wsService.subscribers,
      networkStats: [],
      warning: [],
      systemMetrics: []
    };
    
    // Customize event handling for network-specific data
    this.setupCustomHandlers();
    
    // Store instance in static map
    NetworkWebSocketService.instances[path] = this;
    this.log(`Created new instance for ${path}`);
  }
  
  /**
   * Set up custom message handlers for network data
   */
  setupCustomHandlers() {
    // Override the message handler to handle network-specific messages
    const originalMessageHandler = this.wsService.handleMessage;
    
    this.wsService.handleMessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Let the original handler process standard messages
        originalMessageHandler.call(this.wsService, event);
        
        // Handle network-specific data
        if (message.type === 'update' && message.data) {
          // Extract specific data types
          const data = message.data;
          
          // Broadcast network stats
          if (data.inbound_traffic || data.outbound_traffic || 
              data.packet_rate || data.active_connections) {
            this.notifySubscribers('networkStats', data);
          }
          
          // Broadcast warnings
          if (data.warning) {
            this.notifySubscribers('warning', data.warning);
          }
          
          // Broadcast system metrics
          if (data.cpu_usage !== undefined || data.memory_usage !== undefined) {
            this.notifySubscribers('systemMetrics', {
              cpu_usage: data.cpu_usage,
              memory_usage: data.memory_usage,
              memory_used: data.memory_used,
              memory_total: data.memory_total,
              process_count: data.process_count,
              top_processes: data.top_processes
            });
          }
        }
      } catch (error) {
        this.log('Error in custom message handler:', error);
      }
    };
  }
  
  /**
   * Get instance of the service for a specific path
   */
  static getInstance(path = '/ws/network') {
    return new NetworkWebSocketService(path);
  }
  
  /**
   * Connect to the WebSocket server
   */
  connect() {
    this.log(`Connecting to ${this.path}`);
    this.wsService.connect();
    return this;
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  disconnect(isUnmounting = false) {
    this.log(`Disconnecting from ${this.path}`);
    this.wsService.disconnect(isUnmounting);
    return this;
  }
  
  /**
   * Subscribe to WebSocket events
   */
  subscribe(eventType, callback) {
    this.log(`Subscribing to ${eventType} events`);
    return this.wsService.subscribe(eventType, callback);
  }
  
  /**
   * Force a reconnection to the WebSocket server
   */
  forceReconnection() {
    this.log(`Forcing reconnection to ${this.path}`);
    this.wsService.forceReconnection();
    return this;
  }
  
  /**
   * Send data to the WebSocket server
   */
  send(data) {
    return this.wsService.send(data);
  }
  
  /**
   * Get current connection state
   */
  getConnectionState() {
    return this.wsService.getConnectionState();
  }
  
  /**
   * Generate a test data point for development testing
   */
  generateTestData() {
    const testData = {
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
    };
    
    this.notifySubscribers('message', {
      type: 'update',
      data: testData
    });
    
    return testData;
  }
  
  /**
   * Notify subscribers of an event
   */
  notifySubscribers(eventType, data) {
    this.wsService.notifySubscribers(eventType, data);
  }
  
  /**
   * Log messages if debug is enabled
   */
  log(message, data) {
    if (!this.debug) return;
    
    if (data) {
      console.log(`[NetworkWebSocketService] ${message}`, data);
    } else {
      console.log(`[NetworkWebSocketService] ${message}`);
    }
  }
}

// Initialize static properties
NetworkWebSocketService.instances = {};

export default NetworkWebSocketService; 