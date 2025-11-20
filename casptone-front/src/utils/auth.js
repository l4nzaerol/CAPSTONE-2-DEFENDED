// Authentication utility functions
export const authUtils = {
    // Check if user is authenticated
    isAuthenticated: () => {
        const isAuth = localStorage.getItem("isAuthenticated");
        const token = localStorage.getItem("token");
        const loginTime = localStorage.getItem("loginTime");
        
        if (isAuth !== "true" || !token) {
            return false;
        }
        
        // Check if login is recent (within 24 hours)
        const now = Date.now();
        const loginTimestamp = parseInt(loginTime) || 0;
        const hoursSinceLogin = (now - loginTimestamp) / (1000 * 60 * 60);
        
        if (hoursSinceLogin >= 24) {
            // Clear expired authentication
            authUtils.clearAuth();
            return false;
        }
        
        return true;
    },

    // Get user data
    getUserData: () => {
        if (!authUtils.isAuthenticated()) {
            return null;
        }
        
        return {
            token: localStorage.getItem("token"),
            username: localStorage.getItem("username"),
            role: localStorage.getItem("role"),
            userId: localStorage.getItem("userId"),
            userEmail: localStorage.getItem("userEmail"),
            loginTime: localStorage.getItem("loginTime")
        };
    },

    // Set authentication data
    setAuth: (authData) => {
        const { token, user } = authData;
        localStorage.setItem("token", token);
        localStorage.setItem("username", user.name);
        localStorage.setItem("role", user.role);
        localStorage.setItem("userId", user.id);
        localStorage.setItem("userEmail", user.email);
        localStorage.setItem("loginTime", Date.now().toString());
        localStorage.setItem("isAuthenticated", "true");
    },

    // Clear authentication data
    clearAuth: () => {
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("role");
        localStorage.removeItem("userId");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("loginTime");
    },

    // Force redirect to dashboard
    forceRedirectToDashboard: () => {
        // Clear any existing navigation state
        window.history.replaceState(null, '', '/dashboard');
        
        // Immediate redirect without delay
        if (window.location.pathname !== '/dashboard') {
            // Use window.location.href for immediate redirect
            window.location.href = '/dashboard';
        }
    },

    // Immediate redirect with React Router
    immediateRedirect: (navigate) => {
        // Clear history and force immediate navigation
        window.history.replaceState(null, '', '/dashboard');
        
        // Multiple redirect mechanisms for reliability
        try {
            if (navigate) {
                navigate("/dashboard", { replace: true });
            }
        } catch (error) {
            console.log("React Router navigation failed, using window.location");
        }
        
        // Force immediate redirect as backup
        setTimeout(() => {
            if (window.location.pathname !== '/dashboard') {
                window.location.href = '/dashboard';
            }
        }, 100);
    },

    // Check and redirect if authenticated
    checkAndRedirect: () => {
        if (authUtils.isAuthenticated()) {
            authUtils.forceRedirectToDashboard();
            return true;
        }
        return false;
    }
};
