// Main application entry point
class SecureChatApp {
    constructor() {
        this.currentComponent = null;
        this.router = new Router();
        this.mobileGuard = new MobileGuard();
        this.sessionId = this.generateSessionId();
        
        this.init();
    }
    
    init() {
        // Check if mobile first
        if (!this.mobileGuard.isMobile()) {
            this.mobileGuard.show();
            return;
        }
        
        // Initialize router
        this.setupRoutes();
        this.router.init();
        
        // Start with home page
        this.router.navigate('/');
        
        // Setup privacy protection
        this.setupPrivacyProtection();
    }
    
    setupRoutes() {
        this.router.addRoute('/', () => this.showHome());
        this.router.addRoute('/create', () => this.showCreateRoom());
        this.router.addRoute('/join', () => this.showJoinRoom());
        this.router.addRoute('/room-created', () => this.showRoomCreated());
        this.router.addRoute('/room/:code', (params) => this.showChatRoom(params.code));
        this.router.addRoute('/admin/:code', (params) => this.showAdminPanel(params.code));
    }
    
    showHome() {
        this.setComponent(new Home(this));
    }
    
    showCreateRoom() {
        this.setComponent(new CreateRoom(this));
    }
    
    showJoinRoom() {
        this.setComponent(new JoinRoom(this));
    }
    
    showRoomCreated() {
        this.setComponent(new RoomCreated(this));
    }
    
    showChatRoom(code) {
        this.setComponent(new ChatRoom(this, code));
    }
    
    showAdminPanel(code) {
        this.setComponent(new AdminPanel(this, code));
    }
    
    setComponent(component) {
        if (this.currentComponent && this.currentComponent.cleanup) {
            this.currentComponent.cleanup();
        }
        
        this.currentComponent = component;
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = component.render();
        
        if (component.afterRender) {
            component.afterRender();
        }
    }
    
    generateSessionId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    
    setupPrivacyProtection() {
        // Screenshot detection
        let isScreenshotAttempt = false;
        
        // Detect common screenshot keys
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '3' || e.key === '4')) {
                this.showPrivacyOverlay();
                isScreenshotAttempt = true;
            }
            
            if (e.key === 'PrintScreen') {
                this.showPrivacyOverlay();
                isScreenshotAttempt = true;
            }
        });
        
        // Detect window focus loss (possible screenshot)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !isScreenshotAttempt) {
                this.showPrivacyOverlay();
            } else if (!document.hidden) {
                setTimeout(() => this.hidePrivacyOverlay(), 1000);
                isScreenshotAttempt = false;
            }
        });
        
        // Disable text selection and context menu
        document.addEventListener('selectstart', (e) => e.preventDefault());
        document.addEventListener('contextmenu', (e) => e.preventDefault());
        document.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    showPrivacyOverlay() {
        const overlay = document.getElementById('privacy-overlay');
        overlay.classList.remove('hidden');
    }
    
    hidePrivacyOverlay() {
        const overlay = document.getElementById('privacy-overlay');
        overlay.classList.add('hidden');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SecureChatApp();
});