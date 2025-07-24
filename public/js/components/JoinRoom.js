// Join Room Component
class JoinRoom {
    constructor(app) {
        this.app = app;
        this.isLoading = false;
    }
    
    render() {
        return `
            <div class="join-room">
                <div class="join-room-header">
                    <button id="back-btn" class="back-btn">
                        <span class="back-icon">←</span>
                        Back
                    </button>
                    <h1>Join Room</h1>
                </div>
                
                <div class="join-room-content">
                    <div class="join-form-container">
                        <div class="join-icon">🔗</div>
                        <p class="join-description">Enter the 8-digit room code to join an existing chat room</p>
                        
                        <form id="join-room-form" class="join-form">
                            <div class="form-group">
                                <label for="roomCode">Room Code</label>
                                <input 
                                    type="text" 
                                    id="roomCode" 
                                    name="roomCode" 
                                    placeholder="12345678" 
                                    maxlength="8"
                                    pattern="[0-9]{8}"
                                    autocomplete="off"
                                    required
                                />
                                <small>Enter the 8-digit code shared by the room creator</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="username">Your Username</label>
                                <input 
                                    type="text" 
                                    id="username" 
                                    name="username" 
                                    placeholder="Enter a username" 
                                    maxlength="50"
                                    required
                                />
                                <small>This will be your display name in the chat</small>
                            </div>
                            
                            <button type="submit" id="join-btn" class="btn btn-primary">
                                <span class="btn-icon">🔗</span>
                                Join Room
                            </button>
                        </form>
                    </div>
                    
                    <div class="join-tips">
                        <h3>Tips:</h3>
                        <ul>
                            <li>Room codes are exactly 8 digits long</li>
                            <li>Ask the room creator to share the code with you</li>
                            <li>You can scan a QR code if provided</li>
                            <li>Rooms expire automatically after their set duration</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    afterRender() {
        // Set random username by default
        const usernameInput = document.getElementById('username');
        if (usernameInput) {
            usernameInput.value = Utils.generateUsername();
        }
        
        // Add event listeners
        const backBtn = document.getElementById('back-btn');
        const form = document.getElementById('join-room-form');
        const roomCodeInput = document.getElementById('roomCode');
        
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.app.router.navigate('/');
            });
        }
        
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleJoinRoom();
            });
        }
        
        // Format room code input (numbers only)
        if (roomCodeInput) {
            roomCodeInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 8) {
                    value = value.substring(0, 8);
                }
                e.target.value = value;
            });
            
            // Focus room code input
            roomCodeInput.focus();
        }
    }
    
    async handleJoinRoom() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.updateUI(true);
        
        try {
            const formData = new FormData(document.getElementById('join-room-form'));
            const roomCode = formData.get('roomCode').trim();
            const username = formData.get('username').trim();
            
            if (!roomCode) {
                Utils.showToast('Please enter a room code', 'error');
                return;
            }
            
            if (!Utils.isValidRoomCode(roomCode)) {
                Utils.showToast('Room code must be exactly 8 digits', 'error');
                return;
            }
            
            if (!username) {
                Utils.showToast('Please enter a username', 'error');
                return;
            }
            
            if (username.length < 2) {
                Utils.showToast('Username must be at least 2 characters', 'error');
                return;
            }
            
            // First, get room info to check if it exists and is valid
            const roomInfo = await window.api.getRoomInfo(roomCode);
            
            if (!roomInfo.success) {
                Utils.showToast(roomInfo.error || 'Room not found', 'error');
                return;
            }
            
            // Check if room is full
            if (roomInfo.room.memberCount >= roomInfo.room.maxMembers) {
                Utils.showToast('Room is full', 'error');
                return;
            }
            
            // Join the room
            const joinResponse = await window.api.joinRoom(roomCode, this.app.sessionId, username);
            
            if (joinResponse.success) {
                Utils.showToast('Joined room successfully!', 'success');
                
                // Navigate to chat room
                this.app.router.navigate(`/room/${roomCode}`, {
                    room: roomInfo.room,
                    user: joinResponse.user
                });
            } else {
                Utils.showToast(joinResponse.error || 'Failed to join room', 'error');
            }
        } catch (error) {
            console.error('Join room error:', error);
            
            if (error.message.includes('Room not found')) {
                Utils.showToast('Room code not found or expired', 'error');
            } else if (error.message.includes('Room is full')) {
                Utils.showToast('Room has reached maximum capacity', 'error');
            } else {
                Utils.showToast(error.message || 'Failed to join room', 'error');
            }
        } finally {
            this.isLoading = false;
            this.updateUI(false);
        }
    }
    
    updateUI(loading) {
        const joinBtn = document.getElementById('join-btn');
        const form = document.getElementById('join-room-form');
        
        if (joinBtn) {
            joinBtn.disabled = loading;
            joinBtn.innerHTML = loading 
                ? '<span class="spinner"></span> Joining...'
                : '<span class="btn-icon">🔗</span> Join Room';
        }
        
        if (form) {
            const inputs = form.querySelectorAll('input');
            inputs.forEach(input => {
                input.disabled = loading;
            });
        }
    }
    
    cleanup() {
        this.isLoading = false;
    }
}