// WebSocket client for real-time communication
class WebSocketClient {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 2000;
        this.isConnected = false;
        this.messageHandlers = [];
        this.connectionHandlers = [];
        this.heartbeatInterval = null;
        this.lastHeartbeat = null;
    }
    
    connect(roomCode, sessionId, username) {
        try {
            // Close existing connection
            if (this.socket) {
                this.disconnect();
            }
            
            // Determine WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            console.log('Connecting to WebSocket:', wsUrl);
            
            this.socket = new WebSocket(wsUrl);
            this.roomCode = roomCode;
            this.sessionId = sessionId;
            this.username = username;
            
            this.socket.onopen = (event) => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // Join room
                this.send({
                    type: 'join_room',
                    roomCode: this.roomCode,
                    sessionId: this.sessionId,
                    username: this.username
                });
                
                // Start heartbeat
                this.startHeartbeat();
                
                // Notify connection handlers
                this.connectionHandlers.forEach(handler => {
                    if (handler.onConnect) handler.onConnect();
                });
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            this.socket.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                this.isConnected = false;
                this.stopHeartbeat();
                
                // Notify connection handlers
                this.connectionHandlers.forEach(handler => {
                    if (handler.onDisconnect) handler.onDisconnect(event);
                });
                
                // Attempt reconnection if not intentional
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    setTimeout(() => {
                        this.reconnectAttempts++;
                        console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
                        this.connect(this.roomCode, this.sessionId, this.username);
                    }, this.reconnectInterval * this.reconnectAttempts);
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                
                // Notify connection handlers
                this.connectionHandlers.forEach(handler => {
                    if (handler.onError) handler.onError(error);
                });
            };
            
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close(1000, 'Client disconnect');
            this.socket = null;
        }
        this.isConnected = false;
        this.stopHeartbeat();
    }
    
    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
            return true;
        } else {
            console.warn('WebSocket not connected, cannot send message');
            return false;
        }
    }
    
    handleMessage(data) {
        // Update heartbeat
        if (data.type === 'pong') {
            this.lastHeartbeat = Date.now();
            return;
        }
        
        // Route message to handlers
        this.messageHandlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error('Message handler error:', error);
            }
        });
    }
    
    addMessageHandler(handler) {
        this.messageHandlers.push(handler);
    }
    
    removeMessageHandler(handler) {
        const index = this.messageHandlers.indexOf(handler);
        if (index !== -1) {
            this.messageHandlers.splice(index, 1);
        }
    }
    
    addConnectionHandler(handler) {
        this.connectionHandlers.push(handler);
    }
    
    removeConnectionHandler(handler) {
        const index = this.connectionHandlers.indexOf(handler);
        if (index !== -1) {
            this.connectionHandlers.splice(index, 1);
        }
    }
    
    startHeartbeat() {
        this.lastHeartbeat = Date.now();
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping' });
                
                // Check if we've missed heartbeats
                const now = Date.now();
                if (this.lastHeartbeat && now - this.lastHeartbeat > 30000) {
                    console.warn('Heartbeat timeout, reconnecting...');
                    this.disconnect();
                    this.connect(this.roomCode, this.sessionId, this.username);
                }
            }
        }, 10000); // Send ping every 10 seconds
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    // Message sending methods
    sendMessage(content, encrypted = false) {
        return this.send({
            type: 'message',
            content,
            encrypted,
            timestamp: new Date().toISOString()
        });
    }
    
    sendTyping(isTyping) {
        return this.send({
            type: 'typing',
            isTyping
        });
    }
    
    leaveRoom() {
        return this.send({
            type: 'leave_room'
        });
    }
    
    kickMember(memberSessionId) {
        return this.send({
            type: 'kick_member',
            memberSessionId
        });
    }
}

// Create global WebSocket client instance
window.wsClient = new WebSocketClient();