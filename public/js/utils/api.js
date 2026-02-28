// API Utility Functions
const API = {
    // Base API call with authentication
    async call(url, options = {}) {
        const defaultHeaders = {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        };

        const config = {
            headers: { ...defaultHeaders, ...options.headers },
            ...options
        };

        const response = await fetch(url, config);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
    },

    // GET request
    async get(url) {
        const response = await this.call(url, { method: 'GET' });
        return response.json();
    },

    // POST request
    async post(url, data) {
        const response = await this.call(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return response.json();
    },

    // PUT request
    async put(url, data) {
        const response = await this.call(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return response.json();
    },

    // DELETE request
    async delete(url) {
        const response = await this.call(url, { method: 'DELETE' });
        return response.json();
    },

    // File upload with progress tracking and metadata
    async uploadFile(url, file, onProgress, metadata = {}) {
        const formData = new FormData();
        formData.append('image', file);
        
        // Append metadata fields if provided
        if (metadata.name) {
            formData.append('name', metadata.name);
        }
        if (metadata.section) {
            formData.append('section', metadata.section);
        }
        if (metadata.tags) {
            formData.append('tags', metadata.tags);
        }
        if (metadata.description) {
            formData.append('description', metadata.description);
        }

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        onProgress(Math.round((e.loaded / e.total) * 100));
                    }
                });
            }

            // Handle response
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Failed to parse upload response'));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
            });

            // Handle errors
            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed. Please check your connection and try again.'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload cancelled'));
            });

            // Send request
            xhr.open('POST', url);
            xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
            xhr.send(formData);
        });
    }
};

// Toast notification utility
const Toast = {
    show(message, type = 'success', duration = 5000) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 ${
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

// Validation utility
const Validation = {
    validateTemplate(template) {
        const errors = {};
        let isValid = true;

        // Required fields validation
        if (!template.name || template.name.trim() === '') {
            errors.name = 'Template name is required';
            isValid = false;
        }

        // Validate body elements
        if (template.bodyElements.length === 0) {
            errors.body = 'At least one body element is required';
            isValid = false;
        }

        // Validate individual body elements
        template.bodyElements.forEach((element, index) => {
            if (element.type === 'text' && (!element.content || element.content.trim() === '')) {
                errors[`body_${index}`] = 'Text content is required';
                isValid = false;
            }
            if (element.type === 'button' && (!element.text || element.text.trim() === '')) {
                errors[`body_${index}`] = 'Button text is required';
                isValid = false;
            }
            if (element.type === 'button' && (!element.url || element.url.trim() === '')) {
                errors[`body_${index}`] = 'Button URL is required';
                isValid = false;
            }
            if (element.type === 'image' && (!element.url || element.url.trim() === '')) {
                errors[`body_${index}`] = 'Image URL is required';
                isValid = false;
            }
        });

        return { errors, isValid };
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

// Export utilities
window.API = API;
window.Toast = Toast;
window.Validation = Validation; 