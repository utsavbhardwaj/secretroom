// API client for SecureChat
class API {
    constructor() {
        this.baseUrl = window.location.origin;
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    
    // Create a new room
    async createRoom(sessionId, username, settings = {}) {
        return this.request('/api/rooms', {
            method: 'POST',
            body: {
                sessionId,
                username,
                duration: settings.duration || 15,
                maxMembers: settings.maxMembers || 10,
                enableScreenshotProtection: settings.enableScreenshotProtection !== false,
                enableMessageEncryption: settings.enableMessageEncryption !== false
            }
        });
    }
    
    // Get room information
    async getRoomInfo(roomCode) {
        return this.request(`/api/rooms/${roomCode}`);
    }
    
    // Join a room
    async joinRoom(roomCode, sessionId, username) {
        return this.request(`/api/rooms/${roomCode}/join`, {
            method: 'POST',
            body: {
                sessionId,
                username
            }
        });
    }
    
    // Leave a room
    async leaveRoom(roomCode, sessionId) {
        return this.request(`/api/rooms/${roomCode}/leave`, {
            method: 'POST',
            body: {
                sessionId
            }
        });
    }
    
    // Get room messages
    async getMessages(roomCode, sessionId) {
        return this.request(`/api/rooms/${roomCode}/messages`, {
            headers: {
                'X-Session-ID': sessionId
            }
        });
    }
    
    // Send a message
    async sendMessage(roomCode, sessionId, content, encrypted = false) {
        return this.request(`/api/rooms/${roomCode}/messages`, {
            method: 'POST',
            body: {
                sessionId,
                content,
                encrypted
            }
        });
    }
    
    // Get room members
    async getRoomMembers(roomCode, sessionId) {
        return this.request(`/api/rooms/${roomCode}/members`, {
            headers: {
                'X-Session-ID': sessionId
            }
        });
    }
    
    // Kick a member (admin only)
    async kickMember(roomCode, sessionId, memberSessionId) {
        return this.request(`/api/rooms/${roomCode}/kick`, {
            method: 'POST',
            body: {
                sessionId,
                memberSessionId
            }
        });
    }
    
    // Update room settings (admin only)
    async updateRoomSettings(roomCode, sessionId, settings) {
        return this.request(`/api/rooms/${roomCode}/settings`, {
            method: 'PUT',
            body: {
                sessionId,
                ...settings
            }
        });
    }
    
    // Health check
    async healthCheck() {
        return this.request('/api/health');
    }
}

// Create global API instance
window.api = new API();