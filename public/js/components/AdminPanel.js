// Admin panel component for room management
class AdminPanel {
    constructor(app, roomCode, room) {
        this.app = app;
        this.roomCode = roomCode;
        this.room = room;
        this.members = [];
        this.isOpen = false;
        this.container = null;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'admin-panel';
        this.container = container;
        
        container.innerHTML = `
            <div class="admin-panel-content">
                <div class="admin-panel-header">
                    <h2 class="admin-panel-title">
                        <span class="admin-crown-icon">👑</span>
                        Admin Panel
                    </h2>
                    <button class="close-button" onclick="this.close()">×</button>
                </div>
                
                <div class="admin-panel-body">
                    <div class="admin-section">
                        <h3 class="section-title">
                            <span class="section-icon">ℹ️</span>
                            Room Information
                        </h3>
                        <div class="room-settings-grid">
                            <div class="setting-item">
                                <div class="setting-label">Room Code</div>
                                <div class="setting-value code">${this.roomCode}</div>
                            </div>
                            <div class="setting-item">
                                <div class="setting-label">Time Remaining</div>
                                <div class="setting-value timer" id="admin-timer">Loading...</div>
                            </div>
                            <div class="setting-item">
                                <div class="setting-label">Members</div>
                                <div class="setting-value" id="admin-member-count">${this.room?.memberCount || 0}</div>
                            </div>
                            <div class="setting-item">
                                <div class="setting-label">Max Members</div>
                                <div class="setting-value">${this.room?.maxMembers || 'Unlimited'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-section">
                        <h3 class="section-title">
                            <span class="section-icon">👥</span>
                            Member Management
                        </h3>
                        <div class="members-management" id="members-list">
                            <div class="no-members">Loading members...</div>
                        </div>
                    </div>
                    
                    <div class="admin-section">
                        <h3 class="section-title">
                            <span class="section-icon">🔗</span>
                            Share Room
                        </h3>
                        <div class="room-link-section">
                            <div class="room-link-display">
                                <span class="room-link-text" id="room-link">${Utils.createRoomURL(this.roomCode)}</span>
                                <button class="copy-link-button" onclick="this.copyRoomLink()" id="copy-link-btn">
                                    📋 Copy
                                </button>
                            </div>
                            <div class="qr-code-mini" id="admin-qr">
                                <canvas width="100" height="100"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-section">
                        <h3 class="section-title">
                            <span class="section-icon">📊</span>
                            Statistics
                        </h3>
                        <div class="statistics-grid">
                            <div class="stat-item">
                                <div class="stat-value" id="total-messages">0</div>
                                <div class="stat-label">Messages</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value" id="total-joins">0</div>
                                <div class="stat-label">Joins</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-value" id="room-age">0m</div>
                                <div class="stat-label">Age</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="admin-section">
                        <h3 class="section-title">
                            <span class="section-icon">⚙️</span>
                            Room Controls
                        </h3>
                        <div class="room-controls">
                            <button class="control-button extend-button" onclick="this.extendRoom()">
                                ⏰ Extend (+15min)
                            </button>
                            <button class="control-button share-room-button" onclick="this.shareRoom()">
                                🔗 Share Room
                            </button>
                            <button class="control-button close-room-button" onclick="this.closeRoom()">
                                🔒 Close Room
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return container;
    }

    async init() {
        this.isOpen = true;
        this.bindEvents();
        this.generateMiniQR();
        this.startTimer();
        
        // Load members and statistics
        await this.loadMembers();
        await this.loadStatistics();
        
        // Listen for WebSocket updates
        document.addEventListener('websocketMessage', (event) => {
            this.handleWebSocketMessage(event.detail);
        });
    }

    bindEvents() {
        // Close on background click
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.close();
            }
        });
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Close button
        const closeBtn = this.container.querySelector('.close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.close();
            });
        }
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'members_update':
                this.updateMembers(message.members);
                break;
            case 'user_joined':
            case 'user_left':
                this.updateMemberCount(message.memberCount);
                this.loadMembers(); // Refresh member list
                break;
        }
    }

    async loadMembers() {
        try {
            const response = await this.app.api.getRoomMembers(this.roomCode);
            
            if (response.success) {
                this.members = response.members || [];
                this.renderMembersList();
            }
        } catch (error) {
            console.error('Failed to load members:', error);
            this.showMembersError();
        }
    }

    renderMembersList() {
        const container = document.getElementById('members-list');
        if (!container) return;
        
        if (this.members.length === 0) {
            container.innerHTML = '<div class="no-members">No members in room</div>';
            return;
        }
        
        const memberItems = this.members.map(member => {
            const isCurrentUser = member.sessionId === this.app.sessionId;
            const canKick = !member.isAdmin && !isCurrentUser;
            
            return `
                <div class="member-list-item">
                    <div class="member-list-info">
                        <div class="member-avatar">
                            ${member.username.charAt(0).toUpperCase()}
                        </div>
                        <div class="member-details">
                            <div class="member-list-name ${member.isAdmin ? 'admin' : ''}">
                                ${Utils.sanitizeHTML(member.username)}
                                ${member.isAdmin ? ' 👑' : ''}
                                ${isCurrentUser ? ' (You)' : ''}
                            </div>
                            <div class="member-list-status">
                                <div class="status-indicator"></div>
                                Online
                            </div>
                        </div>
                    </div>
                    <div class="member-list-actions">
                        ${canKick ? `
                            <button class="action-button danger" onclick="this.kickMember('${member.sessionId}', '${Utils.sanitizeHTML(member.username)}')">
                                Kick
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = memberItems;
    }

    showMembersError() {
        const container = document.getElementById('members-list');
        if (container) {
            container.innerHTML = '<div class="no-members">Failed to load members</div>';
        }
    }

    updateMembers(members) {
        this.members = members || [];
        this.renderMembersList();
        this.updateMemberCount(this.members.length);
    }

    updateMemberCount(count) {
        const memberCountEl = document.getElementById('admin-member-count');
        if (memberCountEl) {
            memberCountEl.textContent = count || this.members.length;
        }
    }

    async loadStatistics() {
        // Simple statistics - in a full implementation, these would come from the API
        const stats = {
            totalMessages: this.app.messages?.length || 0,
            totalJoins: this.members.length,
            roomAge: this.calculateRoomAge()
        };
        
        document.getElementById('total-messages').textContent = stats.totalMessages;
        document.getElementById('total-joins').textContent = stats.totalJoins;
        document.getElementById('room-age').textContent = stats.roomAge;
    }

    calculateRoomAge() {
        if (!this.room?.createdAt) return '0m';
        
        const created = new Date(this.room.createdAt);
        const now = new Date();
        const diff = now - created;
        const minutes = Math.floor(diff / (1000 * 60));
        
        if (minutes < 60) {
            return `${minutes}m`;
        }
        
        const hours = Math.floor(minutes / 60);
        return `${hours}h`;
    }

    generateMiniQR() {
        const canvas = document.querySelector('#admin-qr canvas');
        if (!canvas) return;
        
        const roomURL = Utils.createRoomURL(this.roomCode);
        const qrCanvas = Utils.generateQRCode(roomURL, 100);
        
        canvas.width = qrCanvas.width;
        canvas.height = qrCanvas.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(qrCanvas, 0, 0);
    }

    startTimer() {
        this.updateTimer();
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    updateTimer() {
        const timerEl = document.getElementById('admin-timer');
        if (!timerEl || !this.room?.expiresAt) return;
        
        const timeRemaining = Utils.formatTimeRemaining(this.room.expiresAt);
        timerEl.textContent = timeRemaining;
        
        if (timeRemaining === 'Expired') {
            this.close();
        }
    }

    async copyRoomLink() {
        const url = Utils.createRoomURL(this.roomCode);
        const success = await Utils.copyToClipboard(url);
        const button = document.getElementById('copy-link-btn');
        
        if (success) {
            button.classList.add('copied');
            button.textContent = '✅ Copied';
            
            setTimeout(() => {
                button.classList.remove('copied');
                button.textContent = '📋 Copy';
            }, 2000);
            
            this.app.showMessage('Room link copied!', 'success');
        } else {
            this.app.showMessage('Failed to copy link', 'error');
        }
    }

    async kickMember(sessionId, username) {
        const confirmed = confirm(`Are you sure you want to kick ${username} from the room?`);
        if (!confirmed) return;
        
        try {
            const response = await this.app.api.kickMember(this.roomCode, this.app.sessionId, sessionId);
            
            if (response.success) {
                this.app.showMessage(`${username} has been kicked from the room`, 'success');
                
                // Send kick message via WebSocket
                this.app.ws?.kickUser(sessionId);
                
                // Refresh members list
                await this.loadMembers();
            } else {
                throw new Error(response.error || 'Failed to kick member');
            }
        } catch (error) {
            console.error('Failed to kick member:', error);
            this.app.showMessage('Failed to kick member: ' + error.message, 'error');
        }
    }

    async extendRoom() {
        const confirmed = confirm('Extend room by 15 minutes?');
        if (!confirmed) return;
        
        try {
            const response = await this.app.api.extendRoom(this.roomCode, this.app.sessionId, 15);
            
            if (response.success) {
                this.room.expiresAt = response.room.expiresAt;
                this.app.showMessage('Room extended by 15 minutes', 'success');
            } else {
                throw new Error(response.error || 'Failed to extend room');
            }
        } catch (error) {
            console.error('Failed to extend room:', error);
            this.app.showMessage('Failed to extend room: ' + error.message, 'error');
        }
    }

    async shareRoom() {
        const text = Utils.generateShareText(this.roomCode);
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join my SecureChat room',
                    text: text,
                    url: Utils.createRoomURL(this.roomCode)
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    this.fallbackShare(text);
                }
            }
        } else {
            this.fallbackShare(text);
        }
    }

    fallbackShare(text) {
        Utils.copyToClipboard(text).then(success => {
            if (success) {
                this.app.showMessage('Share text copied to clipboard!', 'success');
            } else {
                this.app.showMessage('Failed to copy share text', 'error');
            }
        });
    }

    async closeRoom() {
        const confirmed = confirm('Are you sure you want to close this room? This action cannot be undone and will kick all members.');
        if (!confirmed) return;
        
        try {
            const response = await this.app.api.closeRoom(this.roomCode, this.app.sessionId);
            
            if (response.success) {
                this.app.showMessage('Room closed successfully', 'success');
                this.close();
                this.app.navigate('/');
            } else {
                throw new Error(response.error || 'Failed to close room');
            }
        } catch (error) {
            console.error('Failed to close room:', error);
            this.app.showMessage('Failed to close room: ' + error.message, 'error');
        }
    }

    close() {
        this.isOpen = false;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }

    destroy() {
        this.close();
    }
}
