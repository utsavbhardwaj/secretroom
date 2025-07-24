// Chat room component - main chat interface
class ChatRoom {
    constructor(app, roomCode) {
        this.app = app;
        this.roomCode = roomCode;
        this.room = null;
        this.messages = [];
        this.members = [];
        this.typingUsers = new Set();
        this.isConnected = false;
        this.messageContainer = null;
        this.inputField = null;
        this.expiryTimer = null;
        this.typingTimer = null;
        this.isTyping = false;
        this.lastMessageTime = 0;
        this.adminPanel = null;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'chat-room-container';
        
        container.innerHTML = `
            <div class="chat-header">
                <div class="chat-info">
                    <div class="room-code-display">${this.roomCode}</div>
                    <div class="room-status">
                        <div class="room-title">SecureChat Room</div>
                        <div class="room-meta">
                            <div class="member-count">
                                <span class="member-icon">👥</span>
                                <span id="member-count">0</span>
                            </div>
                            <div class="expiry-countdown">
                                <span class="timer-icon">⏰</span>
                                <span id="expiry-time">--:--</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="chat-actions">
                    <button class="header-button" onclick="this.showMembers()" title="Members">
                        👥
                    </button>
                    <button class="header-button" onclick="this.showAdminPanel()" title="Admin Panel" id="admin-btn" style="display: none;">
                        <span class="admin-indicator">👑</span>
                    </button>
                    <button class="header-button" onclick="this.leaveRoom()" title="Leave Room">
                        🚪
                    </button>
                </div>
            </div>
            
            <div id="connection-status" class="connection-status connecting">
                Connecting to room...
            </div>
            
            <div class="chat-messages" id="chat-messages">
                <div class="empty-chat">
                    <div class="empty-chat-icon">💬</div>
                    <h3>Welcome to the room!</h3>
                    <p>Start the conversation by sending a message below.</p>
                </div>
            </div>
            
            <div id="typing-indicators"></div>
            
            <div class="chat-input-container">
                <form class="chat-input-form" onsubmit="this.handleSendMessage(event)">
                    <textarea 
                        id="message-input"
                        class="message-input" 
                        placeholder="Type your message..."
                        rows="1"
                        maxlength="1000"
                    ></textarea>
                    <button type="submit" class="send-button" id="send-btn" disabled>
                        <span class="send-icon">📤</span>
                    </button>
                </form>
            </div>
        `;
        
        return container;
    }

    async init() {
        this.messageContainer = document.getElementById('chat-messages');
        this.inputField = document.getElementById('message-input');
        
        await this.loadRoomInfo();
        await this.connectToRoom();
        this.bindEvents();
        this.setupMessageHandlers();
        this.startExpiryTimer();
        
        // Load message history
        await this.loadMessageHistory();
    }

    async loadRoomInfo() {
        try {
            const response = await this.app.api.getRoomInfo(this.roomCode);
            
            if (response.success) {
                this.room = response.room;
                this.updateRoomDisplay();
                
                // Show admin button if user is admin
                if (this.isUserAdmin()) {
                    document.getElementById('admin-btn').style.display = 'block';
                }
            } else {
                throw new Error(response.error || 'Room not found');
            }
        } catch (error) {
            console.error('Failed to load room info:', error);
            this.app.showMessage('Failed to load room: ' + error.message, 'error');
            this.app.navigate('/');
        }
    }

    async connectToRoom() {
        try {
            this.updateConnectionStatus('connecting', 'Connecting...');
            
            await this.app.connectToRoom(this.roomCode);
            
            this.isConnected = true;
            this.updateConnectionStatus('connected', 'Connected');
            
            // Hide connection status after delay
            setTimeout(() => {
                const statusEl = document.getElementById('connection-status');
                if (statusEl && this.isConnected) {
                    statusEl.style.display = 'none';
                }
            }, 2000);
            
        } catch (error) {
            console.error('Failed to connect to room:', error);
            this.updateConnectionStatus('disconnected', 'Connection failed');
            this.app.showMessage('Failed to connect to room', 'error');
        }
    }

    updateConnectionStatus(status, message) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.className = `connection-status ${status}`;
            statusEl.textContent = message;
            statusEl.style.display = 'block';
        }
    }

    setupMessageHandlers() {
        // Listen for WebSocket messages
        document.addEventListener('websocketMessage', (event) => {
            this.handleWebSocketMessage(event.detail);
        });
        
        // Listen for disconnections
        document.addEventListener('websocketDisconnect', () => {
            this.handleDisconnection();
        });
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'message':
                this.addMessage(message);
                break;
            case 'user_joined':
                this.handleUserJoined(message);
                break;
            case 'user_left':
                this.handleUserLeft(message);
                break;
            case 'user_kicked':
                this.handleUserKicked(message);
                break;
            case 'typing':
                this.handleTyping(message);
                break;
            case 'members_update':
                this.updateMembers(message.members);
                break;
            case 'room_expired':
                this.handleRoomExpired();
                break;
            case 'room_closed':
                this.handleRoomClosed();
                break;
        }
    }

    handleDisconnection() {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected', 'Disconnected');
        
        // Try to reconnect
        setTimeout(() => {
            if (!this.isConnected) {
                this.connectToRoom();
            }
        }, 3000);
    }

    bindEvents() {
        // Message input
        if (this.inputField) {
            this.inputField.addEventListener('input', (e) => {
                this.handleInputChange(e);
            });
            
            this.inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        // Send button
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }
        
        // Auto-resize textarea
        if (this.inputField) {
            this.inputField.addEventListener('input', () => {
                this.autoResizeTextarea();
            });
        }
    }

    handleInputChange(e) {
        const value = e.target.value.trim();
        const sendBtn = document.getElementById('send-btn');
        
        // Enable/disable send button
        if (sendBtn) {
            sendBtn.disabled = !value || !this.isConnected;
        }
        
        // Handle typing indicators
        if (value && !this.isTyping) {
            this.startTyping();
        } else if (!value && this.isTyping) {
            this.stopTyping();
        }
    }

    autoResizeTextarea() {
        if (this.inputField) {
            this.inputField.style.height = 'auto';
            this.inputField.style.height = Math.min(this.inputField.scrollHeight, 120) + 'px';
        }
    }

    startTyping() {
        if (!this.isConnected || this.isTyping) return;
        
        this.isTyping = true;
        this.app.ws?.sendTyping(true);
        
        // Clear existing timer
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
        }
        
        // Stop typing after 3 seconds of inactivity
        this.typingTimer = setTimeout(() => {
            this.stopTyping();
        }, 3000);
    }

    stopTyping() {
        if (!this.isTyping) return;
        
        this.isTyping = false;
        this.app.ws?.sendTyping(false);
        
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
    }

    async sendMessage() {
        const content = this.inputField?.value.trim();
        if (!content || !this.isConnected) return;
        
        const validation = Utils.validateMessageContent(content);
        if (!validation.valid) {
            this.app.showMessage(validation.error, 'error');
            return;
        }
        
        // Stop typing
        this.stopTyping();
        
        // Send message
        const success = this.app.ws?.sendMessage(validation.content);
        
        if (success) {
            // Clear input
            this.inputField.value = '';
            this.autoResizeTextarea();
            
            // Disable send button
            const sendBtn = document.getElementById('send-btn');
            if (sendBtn) {
                sendBtn.disabled = true;
            }
        } else {
            this.app.showMessage('Failed to send message', 'error');
        }
    }

    addMessage(messageData) {
        // Remove empty chat placeholder
        const emptyChat = document.querySelector('.empty-chat');
        if (emptyChat) {
            emptyChat.remove();
        }
        
        const messageEl = this.createMessageElement(messageData);
        this.messageContainer.appendChild(messageEl);
        
        // Scroll to bottom
        this.scrollToBottom();
        
        // Store message
        this.messages.push(messageData);
        
        // Update last message time
        this.lastMessageTime = Date.now();
    }

    createMessageElement(messageData) {
        const messageEl = document.createElement('div');
        const isOwn = messageData.sessionId === this.app.sessionId;
        const isSystem = messageData.type === 'system';
        
        messageEl.className = `message ${isOwn ? 'own' : 'other'} ${isSystem ? 'system-message' : ''}`;
        
        if (isSystem) {
            messageEl.innerHTML = `
                <div class="message-bubble">
                    <p class="message-content">${Utils.sanitizeHTML(messageData.content)}</p>
                </div>
            `;
        } else {
            const isAdmin = this.isUserAdmin(messageData.user);
            
            messageEl.innerHTML = `
                <div class="message-header">
                    <span class="message-author ${isAdmin ? 'admin' : ''}">
                        ${Utils.sanitizeHTML(messageData.user?.username || 'Anonymous')}
                        ${isAdmin ? '<span class="admin-crown">👑</span>' : ''}
                    </span>
                    <span class="message-time">${Utils.formatTime(messageData.timestamp)}</span>
                </div>
                <div class="message-bubble">
                    <p class="message-content">${Utils.sanitizeHTML(messageData.content)}</p>
                </div>
            `;
        }
        
        return messageEl;
    }

    handleUserJoined(data) {
        this.addSystemMessage(`${data.user.username} joined the room`);
        this.updateMemberCount(data.memberCount);
    }

    handleUserLeft(data) {
        this.addSystemMessage(`${data.user.username} left the room`);
        this.updateMemberCount(data.memberCount);
    }

    handleUserKicked(data) {
        if (data.sessionId === this.app.sessionId) {
            // We were kicked
            this.app.showMessage('You have been removed from the room', 'warning');
            this.app.navigate('/');
        } else {
            this.addSystemMessage(`${data.user.username} was removed from the room`);
            this.updateMemberCount(data.memberCount);
        }
    }

    handleTyping(data) {
        if (data.sessionId === this.app.sessionId) return;
        
        if (data.isTyping) {
            this.typingUsers.add(data.user.username);
        } else {
            this.typingUsers.delete(data.user.username);
        }
        
        this.updateTypingIndicators();
    }

    updateTypingIndicators() {
        const container = document.getElementById('typing-indicators');
        if (!container) return;
        
        if (this.typingUsers.size === 0) {
            container.innerHTML = '';
            return;
        }
        
        const users = Array.from(this.typingUsers);
        let text = '';
        
        if (users.length === 1) {
            text = `${users[0]} is typing`;
        } else if (users.length === 2) {
            text = `${users[0]} and ${users[1]} are typing`;
        } else {
            text = `${users.length} people are typing`;
        }
        
        container.innerHTML = `
            <div class="typing-indicator">
                <span>${text}</span>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
    }

    addSystemMessage(content) {
        this.addMessage({
            type: 'system',
            content: content,
            timestamp: Date.now()
        });
    }

    updateMemberCount(count) {
        const memberCountEl = document.getElementById('member-count');
        if (memberCountEl) {
            memberCountEl.textContent = count || this.members.length;
        }
    }

    updateMembers(members) {
        this.members = members || [];
        this.updateMemberCount(this.members.length);
    }

    scrollToBottom() {
        if (this.messageContainer) {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        }
    }

    async loadMessageHistory() {
        try {
            const response = await this.app.api.getRoomMessages(
                this.roomCode, 
                this.app.sessionId,
                50, 
                0
            );
            
            if (response.success && response.messages.length > 0) {
                // Remove empty chat
                const emptyChat = document.querySelector('.empty-chat');
                if (emptyChat) {
                    emptyChat.remove();
                }
                
                // Add messages in order
                response.messages.forEach(message => {
                    const messageEl = this.createMessageElement(message);
                    this.messageContainer.appendChild(messageEl);
                });
                
                this.scrollToBottom();
            }
        } catch (error) {
            console.error('Failed to load message history:', error);
        }
    }

    startExpiryTimer() {
        if (!this.room?.expiresAt) return;
        
        this.updateExpiryDisplay();
        this.expiryTimer = setInterval(() => {
            this.updateExpiryDisplay();
        }, 1000);
    }

    updateExpiryDisplay() {
        const expiryEl = document.getElementById('expiry-time');
        if (!expiryEl || !this.room?.expiresAt) return;
        
        const timeRemaining = Utils.formatTimeRemaining(this.room.expiresAt);
        expiryEl.textContent = timeRemaining;
        
        if (timeRemaining === 'Expired') {
            this.handleRoomExpired();
        }
    }

    handleRoomExpired() {
        if (this.expiryTimer) {
            clearInterval(this.expiryTimer);
        }
        
        this.app.showMessage('Room has expired', 'warning');
        this.app.navigate('/');
    }

    handleRoomClosed() {
        if (this.expiryTimer) {
            clearInterval(this.expiryTimer);
        }
        
        this.app.showMessage('Room has been closed by admin', 'warning');
        this.app.navigate('/');
    }

    updateRoomDisplay() {
        if (!this.room) return;
        
        // Update member count
        this.updateMemberCount(this.room.memberCount);
    }

    isUserAdmin(user = null) {
        const currentUser = user || this.app.getCurrentUser();
        return currentUser && this.room && currentUser.id === this.room.adminId;
    }

    showMembers() {
        // Simple members display - in a full implementation, this would be a modal
        const membersList = this.members.map(member => 
            `${member.username}${member.isAdmin ? ' 👑' : ''}`
        ).join('\n');
        
        if (membersList) {
            alert(`Room Members:\n\n${membersList}`);
        } else {
            alert('No members information available');
        }
    }

    showAdminPanel() {
        if (!this.isUserAdmin()) {
            this.app.showMessage('Admin access required', 'error');
            return;
        }
        
        // Create and show admin panel
        this.adminPanel = new AdminPanel(this.app, this.roomCode, this.room);
        const panelEl = this.adminPanel.render();
        document.body.appendChild(panelEl);
        this.adminPanel.init();
    }

    async leaveRoom() {
        const confirmed = confirm('Are you sure you want to leave this room?');
        if (!confirmed) return;
        
        try {
            // Send leave message via WebSocket
            if (this.app.ws) {
                this.app.ws.disconnect();
            }
            
            // API call to leave room
            await this.app.api.leaveRoom(this.roomCode, this.app.sessionId);
            
            this.app.navigate('/');
        } catch (error) {
            console.error('Failed to leave room:', error);
            this.app.navigate('/'); // Leave anyway
        }
    }

    destroy() {
        // Stop typing
        this.stopTyping();
        
        // Clear timers
        if (this.expiryTimer) {
            clearInterval(this.expiryTimer);
            this.expiryTimer = null;
        }
        
        if (this.typingTimer) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
        }
        
        // Disconnect WebSocket
        if (this.app.ws) {
            this.app.ws.disconnect();
        }
        
        // Remove admin panel if open
        if (this.adminPanel) {
            this.adminPanel.destroy();
        }
    }
}
