/**
 * Modern Tooltip System
 * Uses CSS pseudo-elements for better performance and cleaner code
 */
class Tooltip {
    constructor(element) {
        this.element = element;
        this.init();
    }

    init() {
        // Add tooltip class to element
        this.element.classList.add('tooltip');
        
        // Set default position if not specified
        if (!this.element.getAttribute('data-tooltip-position')) {
            this.element.setAttribute('data-tooltip-position', 'top');
        }
        
        // Add focus support for accessibility
        this.element.addEventListener('focus', this.showTooltip.bind(this));
        this.element.addEventListener('blur', this.hideTooltip.bind(this));
        
        // Add keyboard support
        this.element.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    showTooltip() {
        // CSS handles the display via :hover and :focus
        // This method is for programmatic control if needed
    }

    hideTooltip() {
        // CSS handles the hiding via :hover and :focus
        // This method is for programmatic control if needed
    }

    handleKeydown(event) {
        // Show tooltip on Enter or Space key
        if (event.key === 'Enter' || event.key === ' ') {
            this.showTooltip();
        }
    }

    // Static method to initialize all tooltips on the page
    static init() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            new Tooltip(element);
        });
    }

    // Static method to add tooltip to a single element
    static add(element) {
        return new Tooltip(element);
    }
}

// Make Tooltip available globally
window.Tooltip = Tooltip;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        Tooltip.init();
    });
} else {
    Tooltip.init();
} 