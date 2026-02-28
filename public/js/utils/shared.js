// Shared Utilities for Campaign Builder
// This file consolidates common functions used across multiple components

// File size formatting utility
const FileUtils = {
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    validateFile(file, maxSize = 5 * 1024 * 1024) {
        if (!file.type.startsWith('image/')) {
            throw new Error('Please select a valid image file');
        }

        if (file.size > maxSize) {
            throw new Error(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
        }

        return true;
    }
};

// Image configuration constants
const ImageConfig = {
    // Image sizing configuration for different sections
    sizing: {
        header: { width: 1200, height: 400, aspectRatio: 3, cropMode: 'cover' },
        banner: { width: 1200, height: 300, aspectRatio: 4, cropMode: 'cover' },
        body: { width: 800, height: 600, aspectRatio: 1.33, cropMode: 'contain' },
        footer: { width: 600, height: 200, aspectRatio: 3, cropMode: 'contain' }
    },

    // Get image requirements description
    getRequirements(type) {
        const config = this.sizing[type];
        if (!config) return '';
        return `${config.width}×${config.height}px (edit to fit)`;
    },

    // Get image dimensions for display
    getDimensions(type) {
        const config = this.sizing[type];
        if (!config) return '';
        return `${config.width}×${config.height}px`;
    },

    // Get image prompt placeholder based on type
    getPromptPlaceholder(type) {
        const config = this.sizing[type];
        const dimensions = config ? `${config.width}x${config.height}px` : '1024x1024px';
        
        switch (type) {
            case 'header':
                return `e.g., A modern business header image (${dimensions}) with professional branding, clean design, suitable for email templates - make it landscape oriented`;
            case 'banner':
                return `e.g., A promotional banner (${dimensions}) with vibrant colors, featuring products or services, eye-catching design - make it landscape oriented`;
            case 'footer':
                return `e.g., A subtle footer image (${dimensions}) with company logo, professional and clean, suitable for email footer - make it landscape oriented`;
            case 'body':
                return `e.g., A product image, team photo, or illustration (${dimensions}) that fits your email content`;
            default:
                return `e.g., A modern business meeting room with people collaborating, professional lighting, clean design (${dimensions})`;
        }
    }
};

// Authentication utilities
const AuthUtils = {
    // Check if user is authenticated
    isAuthenticated() {
        const token = localStorage.getItem('token');
        return !!token;
    },

    // Redirect to login if not authenticated (session expired / auth required → use loop=1 to avoid redirect loop)
    requireAuth() {
        if (!this.isAuthenticated()) {
            if (typeof window.redirectToLogin === 'function') {
                window.redirectToLogin('no_token', { from: 'shared', api: 'requireAuth' });
            } else {
                window.location.replace('/login?loop=1&reason=no_token&from=shared');
            }
            return false;
        }
        return true;
    },

    // Get authentication headers
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        };
    }
};

// Toast notification system (enhanced version)
const ToastSystem = {
    show(message, type = 'info', duration = 5000) {
        // Remove existing toasts to prevent stacking
        const existingToasts = document.querySelectorAll('.toast-notification');
        existingToasts.forEach(toast => toast.remove());

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast-notification fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        
        toast.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium">${message}</span>
                <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    },

    success(message) {
        this.show(message, 'success');
    },

    error(message) {
        this.show(message, 'error');
    },

    warning(message) {
        this.show(message, 'warning');
    },

    info(message) {
        this.show(message, 'info');
    }
};

// Export utilities to global scope
window.FileUtils = FileUtils;
window.ImageConfig = ImageConfig;
window.AuthUtils = AuthUtils;
window.ToastSystem = ToastSystem; 