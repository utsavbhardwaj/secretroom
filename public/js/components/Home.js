// Home Component - Main landing page
class Home {
    constructor(app) {
        this.app = app;
    }
    
    render() {
        return `
            <div class="home">
                <div class="home-header">
                    <div class="logo">
                        <div class="logo-icon">💬</div>
                        <h1>SecureChat</h1>
                    </div>
                    <p class="tagline">Anonymous • Temporary • Secure</p>
                </div>
                
                <div class="home-content">
                    <div class="welcome-message">
                        <h2>Welcome to SecureChat</h2>
                        <p>Create temporary chat rooms that automatically disappear. No accounts, no tracking, just pure anonymous communication.</p>
                    </div>
                    
                    <div class="action-buttons">
                        <button id="create-room-btn" class="btn btn-primary">
                            <span class="btn-icon">➕</span>
                            Create Room
                        </button>
                        
                        <button id="join-room-btn" class="btn btn-secondary">
                            <span class="btn-icon">🔗</span>
                            Join Room
                        </button>
                    </div>
                    
                    <div class="features">
                        <div class="feature-card">
                            <div class="feature-icon">⏰</div>
                            <h3>Temporary</h3>
                            <p>Rooms expire automatically after 15 minutes to 8 hours</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">👤</div>
                            <h3>Anonymous</h3>
                            <p>No registration required. Use any username you like</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">🔒</div>
                            <h3>Encrypted</h3>
                            <p>Messages are encrypted end-to-end for maximum privacy</p>
                        </div>
                        
                        <div class="feature-card">
                            <div class="feature-icon">🛡️</div>
                            <h3>Protected</h3>
                            <p>Screenshot protection and privacy features enabled</p>
                        </div>
                    </div>
                </div>
                
                <div class="home-footer">
                    <p>Your privacy is our priority. No data is stored permanently.</p>
                </div>
            </div>
        `;
    }
    
    afterRender() {
        // Add event listeners for buttons
        const createBtn = document.getElementById('create-room-btn');
        const joinBtn = document.getElementById('join-room-btn');
        
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.app.router.navigate('/create');
            });
        }
        
        if (joinBtn) {
            joinBtn.addEventListener('click', () => {
                this.app.router.navigate('/join');
            });
        }
    }
    
    cleanup() {
        // Clean up any event listeners or timers
    }
}