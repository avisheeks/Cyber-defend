/**
 * WebSocketService - Singleton service for managing WebSocket connections
 * Handles reconnection, event broadcasting, and connection state
 */

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10; // Increased from 5
    this.reconnectDelay = 2000; // Base delay (2 seconds)
    this.maxReconnectDelay = 30000; // Maximum delay (30 seconds)
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.lastHeartbeatResponse = null;
    this.heartbeatMissedCount = 0;
    this.maxHeartbeatMisses = 3;
    this.subscribers = {
      message: [],
      connection: [],
      alert: [],
      error: [],
      reconnect: []
    };
    this.baseUrl = 'ws://localhost:8000';
    this.path = '/ws';
    this.debug = true;
    this.forceReconnect = false;
    this.lastDisconnectTime = 0;
    this.reconnectionThreshold = 1000; // Min time between reconnects (1 second)
    this.connectionId = null;
    this.developmentMode = process.env.NODE_ENV === 'development';
    this.unmounting = false; // Flag to prevent reconnects during component unmounting
  }

  /**
   * Initialize and connect to the WebSocket server
   */
  connect() {
    if (this.unmounting) {
      this.log('Ignoring connect call - service is unmounting');
      return this;
    }
    
    // Prevent rapid reconnections (especially during development hot reloads)
    const now = Date.now();
    if (!this.forceReconnect && (now - this.lastDisconnectTime < this.reconnectionThreshold)) {
      this.log('Throttling reconnection attempt - too soon after disconnect');
      if (!this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectTimeout = null;
          this.connect();
        }, this.reconnectionThreshold);
      }
      return this;
    }
    
    this.forceReconnect = false;
    this.log('Connecting to WebSocket server...');
    
    try {
      // Clear any existing heartbeat
      this.clearHeartbeat();
      
      // Clear any existing reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Close existing connection if any
      if (this.socket) {
        this.log('Closing existing connection before creating a new one');
        // Prevent the onclose handler from triggering a reconnect
        this.socket.onclose = null;
        this.socket.close();
        this.socket = null;
      }
      
      const url = `${this.baseUrl}${this.path}`;
      this.log(`Creating WebSocket connection to ${url}`);
      this.socket = new WebSocket(url);
      
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
    } catch (error) {
      this.log('Error creating WebSocket:', error);
      this.scheduleReconnect();
    }
    
    return this;
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(isUnmounting = false) {
    this.log('Disconnecting from WebSocket server');
    this.unmounting = isUnmounting;
    
    // Clear intervals and timeouts
    this.clearHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      // Prevent the onclose handler from triggering a reconnect
      const tempSocket = this.socket;
      this.socket = null;
      tempSocket.onclose = null;
      tempSocket.close();
    }
    
    // Only update state if not unmounting
    if (!isUnmounting) {
      this.isConnected = false;
      this.notifySubscribers('connection', false);
    }
    
    return this;
  }

  /**
   * Send data to the WebSocket server
   */
  send(data) {
    if (!this.isConnected || !this.socket) {
      this.log('Cannot send message - not connected');
      return false;
    }
    
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      this.socket.send(message);
      return true;
    } catch (error) {
      this.log('Error sending message:', error);
      return false;
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  subscribe(eventType, callback) {
    if (typeof callback !== 'function') {
      this.log(`Invalid callback for ${eventType} event`);
      return () => {};
    }
    
    if (!this.subscribers[eventType]) {
      this.subscribers[eventType] = [];
    }
    
    this.subscribers[eventType].push(callback);
    
    // For connection events, immediately notify with current state
    if (eventType === 'connection') {
      try {
        callback(this.isConnected);
      } catch (error) {
        this.log('Error in connection subscriber callback:', error);
      }
    }
    
    // Return unsubscribe function
    return () => {
      this.subscribers[eventType] = this.subscribers[eventType].filter(cb => cb !== callback);
    };
  }

  /**
   * Notify subscribers of an event
   */
  notifySubscribers(eventType, data) {
    const subscribers = this.subscribers[eventType] || [];
    
    if (subscribers.length > 0) {
      this.log(`Notifying ${subscribers.length} '${eventType}' subscribers`);
      
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.log(`Error in ${eventType} subscriber callback:`, error);
        }
      });
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  scheduleReconnect() {
    if (this.unmounting) {
      this.log('Ignoring reconnect - service is unmounting');
      return;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectAttempts++;
    
    // Calculate delay with exponential backoff and jitter
    const exponentialDelay = Math.min(
      this.maxReconnectDelay,
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1)
    );
    
    // Add jitter (±20%)
    const jitter = 0.8 + Math.random() * 0.4;
    const delay = Math.floor(exponentialDelay * jitter);
    
    this.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    // Notify subscribers about reconnection attempt
    this.notifySubscribers('reconnect', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay: delay
    });
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.log(`Attempting reconnect #${this.reconnectAttempts}`);
        this.connect();
      } else {
        this.log('Max reconnect attempts reached, giving up');
        this.notifySubscribers('error', new Error('Max reconnection attempts reached'));
        
        // Reset reconnect attempts to allow future reconnects
        this.reconnectAttempts = 0;
      }
    }, delay);
  }

  /**
   * Force a reconnection to the WebSocket server
   */
  forceReconnection() {
    this.log('Forcing reconnection');
    this.forceReconnect = true;
    this.reconnectAttempts = 0;
    this.disconnect();
    this.connect();
  }

  /**
   * Set up heartbeat to keep connection alive
   */
  setupHeartbeat() {
    // Clear any existing heartbeat
    this.clearHeartbeat();
    
    // Set up heartbeat interval (ping every 30 seconds)
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.socket) {
        this.log('Sending heartbeat ping');
        this.send({ type: 'ping', timestamp: new Date().toISOString() });
        
        // Set timeout to check for pong response
        this.heartbeatTimeout = setTimeout(() => {
          this.log('Heartbeat pong not received in time');
          this.heartbeatMissedCount++;
          
          if (this.heartbeatMissedCount >= this.maxHeartbeatMisses) {
            this.log(`Missed ${this.heartbeatMissedCount} heartbeats, reconnecting`);
            this.forceReconnection();
          }
        }, 5000); // Wait 5 seconds for pong
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Clear heartbeat timers
   */
  clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
    
    this.heartbeatMissedCount = 0;
  }

  /**
   * Handle heartbeat pong response
   */
  handleHeartbeatResponse() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
    
    this.lastHeartbeatResponse = new Date();
    this.heartbeatMissedCount = 0;
    this.log('Received heartbeat pong');
  }

  /**
   * Handle WebSocket open event
   */
  handleOpen() {
    this.log('WebSocket connection established');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Set up heartbeat
    this.setupHeartbeat();
    
    // Notify connection subscribers
    this.notifySubscribers('connection', true);
  }

  /**
   * Handle WebSocket message event
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      // Handle heartbeat response
      if (message.type === 'pong') {
        this.handleHeartbeatResponse();
        return;
      }
      
      // Log message receipt (but don't log the full content for large messages)
      if (event.data.length > 200) {
        this.log(`WebSocket message received: ${event.data.substring(0, 100)}... (${event.data.length} bytes)`);
      } else {
        this.log('WebSocket message received:', message);
      }
      
      // Notify all message subscribers
      this.notifySubscribers('message', message);
      
      // Also notify specific message type subscribers
      if (message.type && this.subscribers[message.type]) {
        this.notifySubscribers(message.type, message.data || message);
      }
      
      // Special handling for alerts
      if (message.type === 'alert' && message.data) {
        this.notifySubscribers('alert', message.data);
      } else if (message.type === 'initial' && message.alerts) {
        message.alerts.forEach(alert => {
          this.notifySubscribers('alert', alert);
        });
      }
    } catch (error) {
      this.log('Error processing message:', error);
    }
  }

  /**
   * Handle WebSocket error event
   */
  handleError(error) {
    this.log('WebSocket error:', error);
    this.notifySubscribers('error', error);
  }

  /**
   * Handle WebSocket close event
   */
  handleClose(event) {
    // Record time of disconnect for throttling reconnection attempts
    this.lastDisconnectTime = Date.now();
    
    this.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    this.isConnected = false;
    
    // Clean up heartbeat
    this.clearHeartbeat();
    
    // Notify connection subscribers
    this.notifySubscribers('connection', false);
    
    // Check for normal closure or unmounting
    const isNormalClosure = event.code === 1000;
    if (isNormalClosure || this.unmounting) {
      this.log(`Not reconnecting due to ${isNormalClosure ? 'normal closure' : 'unmounting'}`);
      return;
    }
    
    // Check if React is in development mode and recent disconnection
    const isDevReload = this.developmentMode && (Date.now() - this.lastDisconnectTime < 100);
    if (isDevReload) {
      this.log('Detected likely development hot reload, delaying reconnection');
      // In development mode with a rapid disconnect, delay reconnect to prevent churn
      setTimeout(() => this.scheduleReconnect(), 2000);
    } else {
      // Try to reconnect
      this.scheduleReconnect();
    }
  }
  
  /**
   * Get current connection state
   */
  getConnectionState() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeatResponse,
      connectionId: this.connectionId
    };
  }

  /**
   * Log messages if debug is enabled
   */
  log(message, data) {
    if (!this.debug) return;
    
    if (data) {
      console.log(`[WebSocketService] ${message}`, data);
    } else {
      console.log(`[WebSocketService] ${message}`);
    }
  }
}

// Export as singleton
const webSocketService = new WebSocketService();
export default webSocketService; 