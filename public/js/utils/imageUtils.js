// Image Utilities
const ImageUtils = {
    // URL normalization to handle different URL formats
    normalizeImageUrl(url) {
        if (!url) {
            return this.getPlaceholderImage();
        }
        
        // If it's already a full URL (starts with http/https), return as is
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // If it's a relative URL (starts with /), make it absolute
        if (url.startsWith('/')) {
            return window.location.origin + url;
        }
        
        // If it's a relative URL without leading slash, add it
        if (!url.startsWith('/')) {
            return window.location.origin + '/' + url;
        }
        
        return url;
    },
    
    // Get a placeholder image URL
    getPlaceholderImage() {
        return '/placeholder.svg';
    },
    
    // Check if an image URL is accessible
    async checkImageAccessibility(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.warn('Image accessibility check failed:', error);
            return false;
        }
    },
    
    // Preload an image
    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image failed to load'));
            img.src = this.normalizeImageUrl(url);
        });
    },
    
    // Get image dimensions
    getImageDimensions(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            };
            img.onerror = () => reject(new Error('Failed to get image dimensions'));
            img.src = this.normalizeImageUrl(url);
        });
    },
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Validate image file
    validateImageFile(file, maxSize = 5 * 1024 * 1024) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        }
        
        if (file.size > maxSize) {
            throw new Error(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
        }
        
        return true;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageUtils;
} 