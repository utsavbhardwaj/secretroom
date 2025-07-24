// Simple client-side router
class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
    }
    
    addRoute(path, handler) {
        this.routes[path] = handler;
    }
    
    init() {
        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            this.handleRoute();
        });
        
        // Handle initial load
        this.handleRoute();
    }
    
    navigate(path, data = {}) {
        // Store data for the route
        if (Object.keys(data).length > 0) {
            sessionStorage.setItem(`route_data_${path}`, JSON.stringify(data));
        }
        
        // Update URL
        history.pushState({ path }, '', path);
        
        // Handle the route
        this.handleRoute();
    }
    
    handleRoute() {
        const path = window.location.pathname;
        this.currentRoute = path;
        
        // Try exact match first
        if (this.routes[path]) {
            this.routes[path]();
            return;
        }
        
        // Try parameterized routes
        for (const routePath in this.routes) {
            const params = this.matchRoute(routePath, path);
            if (params) {
                this.routes[routePath](params);
                return;
            }
        }
        
        // Default to home if no match
        if (this.routes['/']) {
            this.routes['/']();
        }
    }
    
    matchRoute(routePath, actualPath) {
        const routeParts = routePath.split('/');
        const actualParts = actualPath.split('/');
        
        if (routeParts.length !== actualParts.length) {
            return null;
        }
        
        const params = {};
        
        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const actualPart = actualParts[i];
            
            if (routePart.startsWith(':')) {
                // Parameter
                const paramName = routePart.substring(1);
                params[paramName] = actualPart;
            } else if (routePart !== actualPart) {
                // No match
                return null;
            }
        }
        
        return params;
    }
    
    getRouteData(path) {
        const data = sessionStorage.getItem(`route_data_${path}`);
        if (data) {
            sessionStorage.removeItem(`route_data_${path}`);
            return JSON.parse(data);
        }
        return {};
    }
}