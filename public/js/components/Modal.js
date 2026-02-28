// Modal Component
const Modal = {
    props: {
        visible: {
            type: Boolean,
            default: false
        },
        title: {
            type: String,
            required: true
        },
        size: {
            type: String,
            default: 'md' // sm, md, lg, xl
        }
    },
    emits: ['close'],
    computed: {
        modalSize() {
            const sizes = {
                sm: 'w-11/12 md:w-1/2 lg:w-1/3',
                md: 'w-11/12 md:w-3/4 lg:w-1/2',
                lg: 'w-11/12 md:w-5/6 lg:w-3/4',
                xl: 'w-11/12 md:w-11/12 lg:w-5/6'
            };
            return sizes[this.size] || sizes.md;
        }
    },
    template: `
        <div v-if="visible" @click="$emit('close')" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div @click.stop class="relative top-20 mx-auto p-5 border shadow-lg rounded-md bg-white" :class="modalSize">
                <div class="mt-3">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium text-gray-900">{{ title }}</h3>
                        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <slot></slot>
                </div>
            </div>
        </div>
    `
};

// ImageUploader Component
const ImageUploader = {
    props: {
        value: {
            type: String,
            default: ''
        },
        placeholder: {
            type: String,
            default: 'Enter image URL'
        },
        uploadId: {
            type: String,
            required: true
        },
        uploading: {
            type: Boolean,
            default: false
        },
        uploadProgress: {
            type: Number,
            default: 0
        },
        generatingAi: {
            type: Boolean,
            default: false
        }
    },
    emits: ['input', 'upload', 'generate-ai'],
    template: `
        <div class="space-y-2">
            <div class="flex items-center space-x-4">
                <input :value="value" 
                       @input="$emit('input', $event.target.value)"
                       class="flex-1 border rounded-md px-3 py-2" 
                       :placeholder="placeholder">
                <div class="relative">
                    <input type="file" 
                           @change="$emit('upload', $event)" 
                           accept="image/*"
                           :disabled="uploading"
                           class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                    <button :disabled="uploading"
                            :class="{
                                'px-4 py-2 rounded text-sm font-medium': true,
                                'bg-indigo-600 text-white hover:bg-indigo-700': !uploading,
                                'bg-gray-400 text-gray-200 cursor-not-allowed': uploading
                            }">
                        <span v-if="!uploading">Upload</span>
                        <span v-else class="flex items-center space-x-2">
                            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>{{ uploadProgress }}%</span>
                        </span>
                    </button>
                </div>
                <button @click="$emit('generate-ai')" 
                        :disabled="generatingAi"
                        :class="{
                            'px-4 py-2 rounded text-sm font-medium flex items-center space-x-2': true,
                            'bg-green-600 text-white hover:bg-green-700': !generatingAi,
                            'bg-gray-400 text-gray-200 cursor-not-allowed': generatingAi
                        }">
                    <svg v-if="!generatingAi" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    <svg v-else class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{{ generatingAi ? 'Generating...' : 'AI Generate' }}</span>
                </button>
            </div>
            <img v-if="value" 
                 :src="value" 
                 class="mt-2 h-32 object-cover rounded">
        </div>
    `
};

// Export components
window.Modal = Modal;
window.ImageUploader = ImageUploader; 