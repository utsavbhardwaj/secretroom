// Mobile Guard Component - Ensures mobile-only access
class MobileGuard {
    constructor() {
        this.checkInterval = null;
    }
    
    isMobile() {
        const userAgent = navigator.userAgent.toLowerCase();
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const smallScreen = window.innerWidth <= 768 && window.innerHeight <= 1024;
        const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
        
        // Mobile user agents
        const mobileAgents = [
            'android', 'webos', 'iphone', 'ipad', 'ipod', 
            'blackberry', 'iemobile', 'opera mini', 'mobile'
        ];
        
        const isMobileUA = mobileAgents.some(agent => userAgent.includes(agent));
        
        // Comprehensive mobile detection
        const mobileChecks = {
            userAgent: isMobileUA,
            touch: hasTouch,
            smallScreen: smallScreen,
            orientation: window.orientation !== undefined,
            memory: lowMemory
        };
        
        // Log detection results for debugging
        console.log('Device Info:', {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            screenWidth: screen.width,
            screenHeight: screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            hasTouch: hasTouch,
            maxTouchPoints: navigator.maxTouchPoints,
            deviceMemory: navigator.deviceMemory,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink
            } : null,
            orientation: window.orientation !== undefined ? 'supported' : 'unknown'
        });
        
        console.log('Mobile Detection Results:', mobileChecks);
        
        // Return true if at least 2 mobile indicators are present
        const mobileScore = Object.values(mobileChecks).filter(Boolean).length;
        return mobileScore >= 2;
    }
    
    show() {
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = this.render();
        
        // Start periodic check for mobile device
        this.startMobileCheck();
    }
    
    render() {
        return `
            <div class="mobile-guard">
                <div class="mobile-guard-content">
                    <div class="mobile-guard-icon">📱</div>
                    <h1>Mobile Device Required</h1>
                    <p>SecureChat is designed exclusively for mobile devices to ensure maximum privacy and security.</p>
                    
                    <div class="features-list">
                        <div class="feature">
                            <span class="feature-icon">🔒</span>
                            <span>Enhanced Privacy Protection</span>
                        </div>
                        <div class="feature">
                            <span class="feature-icon">🛡️</span>
                            <span>Screenshot Prevention</span>
                        </div>
                        <div class="feature">
                            <span class="feature-icon">⏰</span>
                            <span>Temporary Chat Rooms</span>
                        </div>
                        <div class="feature">
                            <span class="feature-icon">👤</span>
                            <span>Anonymous Messaging</span>
                        </div>
                    </div>
                    
                    <div class="instructions">
                        <h3>How to Access:</h3>
                        <ol>
                            <li>Open this link on your smartphone or tablet</li>
                            <li>Use your mobile browser (Safari, Chrome, etc.)</li>
                            <li>Enjoy secure, private chatting</li>
                        </ol>
                    </div>
                    
                    <div class="qr-section">
                        <p>Scan with your mobile device:</p>
                        <div class="qr-code">
                            <img src="${Utils.generateQRCode(window.location.href)}" alt="QR Code" />
                        </div>
                    </div>
                    
                    <button onclick="window.location.reload()" class="retry-btn">
                        Check Again
                    </button>
                </div>
            </div>
        `;
    }
    
    startMobileCheck() {
        // Check every 3 seconds if user switches to mobile
        this.checkInterval = setInterval(() => {
            if (this.isMobile()) {
                this.cleanup();
                window.location.reload();
            }
        }, 3000);
    }
    
    cleanup() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}