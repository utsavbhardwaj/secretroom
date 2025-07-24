// Create Room Component
class CreateRoom {
    constructor(app) {
        this.app = app;
        this.isLoading = false;
    }
    
    render() {
        return `
            <div class="create-room">
                <div class="create-room-header">
                    <button id="back-btn" class="back-btn">
                        <span class="back-icon">←</span>
                        Back
                    </button>
                    <h1>Create Room</h1>
                </div>
                
                <div class="create-room-content">
                    <form id="create-room-form" class="room-form">
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
                        
                        <div class="form-group">
                            <label for="duration">Room Duration</label>
                            <select id="duration" name="duration">
                                <option value="15">15 minutes</option>
                                <option value="30">30 minutes</option>
                                <option value="60">1 hour</option>
                                <option value="120">2 hours</option>
                                <option value="240">4 hours</option>
                                <option value="480">8 hours</option>
                            </select>
                            <small>Room will automatically expire after this time</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="maxMembers">Maximum Members</label>
                            <select id="maxMembers" name="maxMembers">
                                <option value="2">2 members</option>
                                <option value="5">5 members</option>
                                <option value="10" selected>10 members</option>
                                <option value="20">20 members</option>
                                <option value="50">50 members</option>
                            </select>
                            <small>Maximum number of people who can join</small>
                        </div>
                        
                        <div class="security-options">
                            <h3>Security Settings</h3>
                            
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="screenshotProtection" name="screenshotProtection" checked>
                                    <span class="checkmark"></span>
                                    <div class="checkbox-content">
                                        <strong>Screenshot Protection</strong>
                                        <small>Hide content when screenshot attempts are detected</small>
                                    </div>
                                </label>
                            </div>
                            
                            <div class="checkbox-group">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="messageEncryption" name="messageEncryption" checked>
                                    <span class="checkmark"></span>
                                    <div class="checkbox-content">
                                        <strong>Message Encryption</strong>
                                        <small>Encrypt messages for enhanced privacy</small>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <button type="submit" id="create-btn" class="btn btn-primary">
                            <span class="btn-icon">➕</span>
                            Create Room
                        </button>
                    </form>
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
        const form = document.getElementById('create-room-form');
        
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.app.router.navigate('/');
            });
        }
        
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateRoom();
            });
        }
    }
    
    async handleCreateRoom() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.updateUI(true);
        
        try {
            const formData = new FormData(document.getElementById('create-room-form'));
            const username = formData.get('username').trim();
            const duration = parseInt(formData.get('duration'));
            const maxMembers = parseInt(formData.get('maxMembers'));
            const enableScreenshotProtection = formData.get('screenshotProtection') === 'on';
            const enableMessageEncryption = formData.get('messageEncryption') === 'on';
            
            if (!username) {
                Utils.showToast('Please enter a username', 'error');
                return;
            }
            
            if (username.length < 2) {
                Utils.showToast('Username must be at least 2 characters', 'error');
                return;
            }
            
            const response = await window.api.createRoom(this.app.sessionId, username, {
                duration,
                maxMembers,
                enableScreenshotProtection,
                enableMessageEncryption
            });
            
            if (response.success) {
                Utils.showToast('Room created successfully!', 'success');
                
                // Navigate to room created page with room data
                this.app.router.navigate('/room-created', {
                    room: response.room,
                    user: response.user
                });
            } else {
                Utils.showToast(response.error || 'Failed to create room', 'error');
            }
        } catch (error) {
            console.error('Create room error:', error);
            Utils.showToast(error.message || 'Failed to create room', 'error');
        } finally {
            this.isLoading = false;
            this.updateUI(false);
        }
    }
    
    updateUI(loading) {
        const createBtn = document.getElementById('create-btn');
        const form = document.getElementById('create-room-form');
        
        if (createBtn) {
            createBtn.disabled = loading;
            createBtn.innerHTML = loading 
                ? '<span class="spinner"></span> Creating...'
                : '<span class="btn-icon">➕</span> Create Room';
        }
        
        if (form) {
            const inputs = form.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.disabled = loading;
            });
        }
    }
    
    cleanup() {
        this.isLoading = false;
    }
}