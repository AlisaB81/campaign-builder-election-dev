// Modal Mixin for common modal functionality
const modalMixin = {
    data() {
        return {
            modals: {
                versionHistory: { visible: false, data: null },
                aiHtml: { visible: false, data: {} },
                aiImage: { visible: false, data: {} }
            }
        };
    },
    methods: {
        // Generic modal open method
        openModal(modalName, data = {}) {
            this.modals[modalName].visible = true;
            this.modals[modalName].data = data;
        },

        // Generic modal close method
        closeModal(modalName) {
            this.modals[modalName].visible = false;
            this.modals[modalName].data = {};
        },

        // Reset modal data
        resetModal(modalName) {
            this.modals[modalName].data = {};
        },

        // Check if modal is visible
        isModalVisible(modalName) {
            return this.modals[modalName]?.visible || false;
        },

        // Get modal data
        getModalData(modalName) {
            return this.modals[modalName]?.data || {};
        }
    }
};

// Template management mixin
const templateMixin = {
    methods: {
        // Create new template
        createNewTemplate() {
            this.currentTemplate = {
                id: null,
                name: '',
                headerImage: '',
                headerText: '',
                bannerImage: '',
                category: 'marketing',
                tags: [],
                bodyElements: [],
                footerImage: '',
                footerLinks: [],
                updatedAt: new Date().toISOString()
            };
            this.editingTemplate = true;
        },

        // Edit template
        editTemplate(template) {
            this.currentTemplate = { ...template };
            this.editingTemplate = true;
        },

        // Cancel edit
        cancelEdit() {
            this.editingTemplate = false;
            this.currentTemplate = null;
        },

        // Add body element
        addBodyElement(type) {
            const element = { type };
            
            switch (type) {
                case 'text':
                    element.content = '';
                    break;
                case 'button':
                    element.text = '';
                    element.url = '';
                    break;
                case 'image':
                    element.url = '';
                    element.alt = '';
                    break;
            }
            
            this.currentTemplate.bodyElements.push(element);
        },

        // Remove body element
        removeBodyElement(index) {
            this.currentTemplate.bodyElements.splice(index, 1);
        },

        // Add footer link
        addFooterLink() {
            this.currentTemplate.footerLinks.push({ text: '', url: '' });
        },

        // Remove footer link
        removeFooterLink(index) {
            this.currentTemplate.footerLinks.splice(index, 1);
        },

        // Add tag
        addTag() {
            if (this.newTag.trim() !== '') {
                this.currentTemplate.tags.push(this.newTag.trim());
                this.newTag = '';
                this.showTagInput = false;
            }
        },

        // Remove tag
        removeTag(index) {
            this.currentTemplate.tags.splice(index, 1);
        },

        // Toggle preview
        togglePreview(index) {
            if (!this.currentTemplate.bodyElements[index].showPreview) {
                this.currentTemplate.bodyElements[index].showPreview = true;
            } else {
                this.currentTemplate.bodyElements[index].showPreview = false;
            }
        }
    }
};

// Search and filter mixin
const searchMixin = {
    methods: {
        // Clear search
        clearSearch() {
            this.searchQuery = '';
            this.selectedCategory = 'all';
            this.selectedTags = [];
        },

        // Toggle tag filter
        toggleTagFilter(tag) {
            const index = this.selectedTags.indexOf(tag);
            if (index > -1) {
                this.selectedTags.splice(index, 1);
            } else {
                this.selectedTags.push(tag);
            }
        },

        // Check if tag is selected
        isTagSelected(tag) {
            return this.selectedTags.includes(tag);
        }
    }
};

// Export mixins
window.modalMixin = modalMixin;
window.templateMixin = templateMixin;
window.searchMixin = searchMixin; 