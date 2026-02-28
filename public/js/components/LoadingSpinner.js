// LoadingSpinner Component
const LoadingSpinner = {
    props: {
        size: {
            type: String,
            default: 'h-4 w-4'
        },
        text: {
            type: String,
            default: ''
        }
    },
    template: `
        <div class="flex items-center space-x-2">
            <svg class="animate-spin ${size}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span v-if="text">{{ text }}</span>
        </div>
    `
};

// Close Icon Component
const CloseIcon = {
    props: {
        size: {
            type: String,
            default: 'w-6 h-6'
        }
    },
    template: `
        <svg class="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
    `
};

// Export components
window.LoadingSpinner = LoadingSpinner;
window.CloseIcon = CloseIcon; 