// Room created component - shows room details and sharing options
class RoomCreated {
    constructor(app, roomCode) {
        this.app = app;
        this.roomCode = roomCode;
        this.room = null;
        this.qrCanvas = null;
        this.expiryTimer = null;
        this.timeRemaining = '';
    }

    render() {
        const container = document.createElement('div');
        container.className = 'room-created-container';
        
        container.innerHTML = `
            <div class="room-created-header">
                <div class="success-icon">✅</div>
                <h1 class="room-created-title">Room Created!</h1>
                <p class="room-created-subtitle">Share the code below to invite others</p>
            </div>
            
            <div class="room-created-content">
                <div class="admin-notice">
                    <div class="admin-crown">👑</div>
                    <p class="admin-text">You are the room administrator with full control over this room.</p>
                </div>
                
                <div class="room-code-display">
                    <div class="room-code-label">Room Code</div>
                    <div class="room-code-value">${this.roomCode}</div>
                    <button class="copy-button" onclick="this.copyRoomCode()">
                        <span id="copy-icon">📋</span> Copy Code
                    </button>
                </div>
                
                <div class="room-info-grid">
                    <div class="room-info-card">
                        <div class="room-info-icon">⏰</div>
                        <div class="room-info-label">Duration</div>
                        <div class="room-info-value" id="duration-display">Loading...</div>
                    </div>
                    <div class="room-info-card">
                        <div class="room-info-icon">👥</div>
                        <div class="room-info-label">Max Members</div>
                        <div class="room-info-value" id="max-members-display">Loading...</div>
                    </div>
                </div>
                
                <div class="expiry-timer">
                    <div class="timer-icon">⏱️</div>
                    <div class="timer-text">Room expires in</div>
                    <div class="timer-value" id="countdown-timer">Loading...</div>
                </div>
                
                <div class="qr-code-section">
                    <div class="qr-code-title">
                        <span class="qr-code-icon">📱</span>
                        QR Code
                    </div>
                    <div class="qr-code-display">
                        <canvas id="qr-canvas" class="qr-code-canvas"></canvas>
                    </div>
                    <div class="qr-code-actions">
                        <button class="btn btn-secondary" onclick="this.downloadQR()">
                            📥 Download
                        </button>
                        <button class="btn btn-secondary" onclick="this.shareQR()">
                            📤 Share
                        </button>
                    </div>
                </div>
                
                <div class="sharing-options">
                    <div class="sharing-title">
                        <span class="sharing-icon">🔗</span>
                        Share Room
                    </div>
                    <div class="sharing-buttons">
                        <button class="share-button" onclick="this.shareText()">
                            <div class="share-button-icon">💬</div>
                            <div class="share-button-text">Message</div>
                        </button>
                        <button class="share-button" onclick="this.shareLink()">
                            <div class="share-button-icon">🔗</div>
                            <div class="share-button-text">Copy Link</div>
                        </button>
                        <button class="share-button" onclick="this.shareEmail()">
                            <div class="share-button-icon">📧</div>
                            <div class="share-button-text">Email</div>
                        </button>
                        <button class="share-button" onclick="this.shareSocial()">
                            <div class="share-button-icon">📱</div>
                            <div class="share-button-text">Social</div>
                        </button>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="this.goHome()">
                        🏠 Home
                    </button>
                    <button class="btn btn-join-now" onclick="this.joinRoom()">
                        🚀 Join Room Now
                    </button>
                </div>
            </div>
        `;
        
        return container;
    }

    async init() {
        await this.loadRoomInfo();
        this.generateQRCode();
        this.startExpiryTimer();
        this.bindEvents();
    }

    async loadRoomInfo() {
        try {
            const response = await this.app.api.getRoomInfo(this.roomCode);
            
            if (response.success) {
                this.room = response.room;
                this.updateRoomDisplay();
            } else {
                throw new Error(response.error || 'Failed to load room info');
            }
        } catch (error) {
            console.error('Failed to load room info:', error);
            this.app.showMessage('Failed to load room information', 'error');
            
            // Fallback display
            this.updateRoomDisplayFallback();
        }
    }

    updateRoomDisplay() {
        if (!this.room) return;
        
        // Update duration display
        const durationEl = document.getElementById('duration-display');
        if (durationEl) {
            durationEl.textContent = Utils.formatDuration(this.room.duration);
        }
        
        // Update max members display
        const maxMembersEl = document.getElementById('max-members-display');
        if (maxMembersEl) {
            maxMembersEl.textContent = this.room.maxMembers || 'Unlimited';
        }
    }

    updateRoomDisplayFallback() {
        // Show default values if room info couldn't be loaded
        const durationEl = document.getElementById('duration-display');
        if (durationEl) {
            durationEl.textContent = '15 minutes';
        }
        
        const maxMembersEl = document.getElementById('max-members-display');
        if (maxMembersEl) {
            maxMembersEl.textContent = '10';
        }
    }

    generateQRCode() {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas) return;
        
        const roomURL = Utils.createRoomURL(this.roomCode);
        const qrCanvas = Utils.generateQRCode(roomURL, 200);
        
        // Copy the generated QR code to our canvas
        canvas.width = qrCanvas.width;
        canvas.height = qrCanvas.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(qrCanvas, 0, 0);
        
        this.qrCanvas = canvas;
    }

    startExpiryTimer() {
        if (!this.room?.expiresAt) {
            // Fallback - assume 15 minutes from now
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
            this.room = { ...this.room, expiresAt: expiresAt.toISOString() };
        }
        
        this.updateTimer();
        this.expiryTimer = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }

    updateTimer() {
        const timerEl = document.getElementById('countdown-timer');
        if (!timerEl || !this.room?.expiresAt) return;
        
        this.timeRemaining = Utils.formatTimeRemaining(this.room.expiresAt);
        timerEl.textContent = this.timeRemaining;
        
        // Check if expired
        if (this.timeRemaining === 'Expired') {
            this.handleRoomExpired();
        }
    }

    handleRoomExpired() {
        if (this.expiryTimer) {
            clearInterval(this.expiryTimer);
            this.expiryTimer = null;
        }
        
        this.app.showMessage('Room has expired', 'warning');
        this.app.navigate('/');
    }

    bindEvents() {
        // Handle back button
        window.addEventListener('popstate', () => {
            if (this.expiryTimer) {
                clearInterval(this.expiryTimer);
            }
        });
    }

    async copyRoomCode() {
        const success = await Utils.copyToClipboard(this.roomCode);
        const button = document.querySelector('.copy-button');
        const icon = document.getElementById('copy-icon');
        
        if (success) {
            button.classList.add('copied');
            icon.textContent = '✅';
            button.innerHTML = '<span>✅</span> Copied!';
            
            setTimeout(() => {
                button.classList.remove('copied');
                icon.textContent = '📋';
                button.innerHTML = '<span id="copy-icon">📋</span> Copy Code';
            }, 2000);
            
            this.app.showMessage('Room code copied to clipboard!', 'success');
        } else {
            this.app.showMessage('Failed to copy room code', 'error');
        }
    }

    async shareText() {
        const text = Utils.generateShareText(this.roomCode);
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join my SecureChat room',
                    text: text
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

    async shareLink() {
        const url = Utils.createRoomURL(this.roomCode);
        const success = await Utils.copyToClipboard(url);
        
        if (success) {
            this.app.showMessage('Room link copied to clipboard!', 'success');
        } else {
            this.app.showMessage('Failed to copy room link', 'error');
        }
    }

    shareEmail() {
        const subject = encodeURIComponent('Join my SecureChat room');
        const body = encodeURIComponent(Utils.generateShareText(this.roomCode));
        const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
        
        window.open(mailtoUrl, '_blank');
    }

    async shareSocial() {
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

    downloadQR() {
        if (!this.qrCanvas) return;
        
        const link = document.createElement('a');
        link.download = `SecureChat-Room-${this.roomCode}.png`;
        link.href = this.qrCanvas.toDataURL();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.app.showMessage('QR code downloaded!', 'success');
    }

    async shareQR() {
        if (!this.qrCanvas || !navigator.share) {
            this.downloadQR();
            return;
        }
        
        try {
            // Convert canvas to blob
            const blob = await new Promise(resolve => {
                this.qrCanvas.toBlob(resolve, 'image/png');
            });
            
            const file = new File([blob], `SecureChat-Room-${this.roomCode}.png`, {
                type: 'image/png'
            });
            
            await navigator.share({
                title: 'SecureChat Room QR Code',
                text: `Join room ${this.roomCode}`,
                files: [file]
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.downloadQR();
            }
        }
    }

    joinRoom() {
        this.app.navigate(`/room/${this.roomCode}`);
    }

    goHome() {
        this.app.navigate('/');
    }

    destroy() {
        if (this.expiryTimer) {
            clearInterval(this.expiryTimer);
            this.expiryTimer = null;
        }
    }
}
