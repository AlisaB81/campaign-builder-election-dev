/**
 * Image Prompt Builder Module
 * 
 * This module implements a two-stage AI image generation flow:
 * 1. An "Image Prompt Assistant" (chat-based) that takes structured input and returns a clean prompt
 * 2. A direct call to the image generation API using that prompt
 * 
 * IMPORTANT: Text is NEVER baked into AI-generated images. All text should be
 * overlaid using HTML/CSS for perfect spelling and easy editing.
 */

const OpenAI = require('openai');

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {'header' | 'banner' | 'body' | 'footer-left'} ImageSlot
 */

/**
 * Request payload from the template editor for image generation
 * @typedef {Object} ImageGenerationRequest
 * @property {ImageSlot} slot - The template slot where image will be placed
 * @property {string} styleDescription - Description of the desired look/style
 * @property {string} [overlayText] - Optional text that will be overlaid via HTML (NOT baked into image)
 */

/**
 * Result from the Image Prompt Assistant
 * @typedef {Object} ImagePromptResult
 * @property {string} prompt - Final natural language description for the image model
 * @property {string} negativePrompt - Things to avoid (busy layouts, text, etc.)
 * @property {string} size - Image dimensions (e.g., "1200x400")
 * @property {string} notes - Helpful notes for the caller (not sent to image model)
 * @property {boolean} requiresTextOverlay - Always true when overlayText is provided
 * @property {string} textSafetyInstructions - Guidance about text handling
 */

/**
 * Final response from generateTemplateImage
 * @typedef {Object} ImageGenerationResponse
 * @property {string} imageUrl - URL of the generated image
 * @property {Object} metadata - Additional info about the generation
 * @property {ImageSlot} metadata.slot - Which slot this image is for
 * @property {string} metadata.promptUsed - The final prompt sent to the image model
 * @property {string} metadata.notes - Notes from the prompt assistant
 * @property {boolean} metadata.requiresTextOverlay - Whether text should be overlaid via HTML
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default sizes for each template slot
 * @type {Record<ImageSlot, string>}
 */
const SLOT_DEFAULT_SIZES = {
    'header': '1200x400',
    'banner': '1200x300',
    'body': '800x600',
    'footer-left': '600x200'
};

/**
 * Human-readable descriptions for each slot
 * @type {Record<ImageSlot, string>}
 */
const SLOT_DESCRIPTIONS = {
    'header': 'Email header background - wide horizontal banner at the top',
    'banner': 'Promotional banner - wide horizontal image below header',
    'body': 'Content image - medium-sized image within email body',
    'footer-left': 'Footer branding - small image on the left side of footer'
};

/**
 * System prompt for the Image Prompt Assistant
 * This persona is an expert at crafting image prompts for DALL-E
 */
const IMAGE_PROMPT_ASSISTANT_SYSTEM = `You are an expert graphic designer and "image prompt builder" for a template editor app.

You NEVER generate images yourself.
You ONLY generate a single JSON object that will be sent to an image model.

Your priorities, in order:

1. FOLLOW REQUIREMENTS exactly: size/aspect, colors, mood, minimalism vs decorative, etc.

2. NO TEXT IN IMAGES:
   - CRITICAL: The image must contain NO text, NO words, NO letters, NO numbers, NO typography whatsoever.
   - Any text the user needs will be overlaid using HTML/CSS after the image is generated.
   - In your prompt, explicitly state "no text, no words, no letters, no typography".
   - In negativePrompt, always include "text, words, letters, typography, watermarks, labels".

3. MINIMIZE EXTRA ELEMENTS:
   - Only include elements the user requested, or extremely simple supportive details (e.g. "soft bokeh light" or "subtle gradient").
   - If the user says "no ornaments" or "no icons", do not add any.
   - Keep backgrounds clean so text can be overlaid legibly.

4. STYLE CONSISTENCY:
   - Match tone: professional, elegant, playful, minimalist, corporate, etc.
   - Prefer simple, clean compositions that work well as email and web banners.
   - Ensure good contrast areas for text overlay (e.g., darker regions or gradient areas).

5. ASPECT RATIO:
   - Use the exact size from the input (e.g., "1200x400" for header).
   - Compose the image to work well at that aspect ratio.

You must ALWAYS respond in this exact JSON schema (no extra keys, no markdown, just raw JSON):
{
  "prompt": "string",
  "negativePrompt": "string",
  "size": "WIDTHxHEIGHT",
  "notes": "string",
  "requiresTextOverlay": boolean,
  "textSafetyInstructions": "string"
}

Field descriptions:
- "prompt": Final natural language description to send to the image model. Must explicitly say "no text".
- "negativePrompt": Things to avoid (always include text-related items).
- "size": Use the exact size from the input (e.g., "1200x400").
- "notes": Brief helpful notes for the caller (this is NOT sent to the image model).
- "requiresTextOverlay": true if the user mentioned text they want on the image (they'll add it via HTML).
- "textSafetyInstructions": Always "No text should appear in the image. Text will be added via HTML overlay."`;

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Builds an optimized image prompt using the Image Prompt Assistant
 * 
 * @param {ImageGenerationRequest} request - The structured request from the UI
 * @param {OpenAI} openaiClient - Initialized OpenAI client
 * @returns {Promise<ImagePromptResult>} - The structured prompt result
 * @throws {Error} - If the API call fails or JSON parsing fails
 */
async function buildImagePrompt(request, openaiClient) {
    const { slot, styleDescription, overlayText } = request;
    
    // Validate slot
    if (!SLOT_DEFAULT_SIZES[slot]) {
        throw new Error(`Invalid slot: ${slot}. Must be one of: ${Object.keys(SLOT_DEFAULT_SIZES).join(', ')}`);
    }
    
    // Build the user message as structured JSON
    const userMessage = JSON.stringify({
        slot: slot,
        slotDescription: SLOT_DESCRIPTIONS[slot],
        size: SLOT_DEFAULT_SIZES[slot],
        styleDescription: styleDescription || 'Professional, clean design suitable for business email',
        overlayText: overlayText || '',
        textInImage: false  // Always false - we never bake text into images
    }, null, 2);
    
    console.log('[ImagePromptBuilder] Calling OpenAI chat API for prompt generation...');
    console.log('[ImagePromptBuilder] User message:', userMessage);
    
    try {
        const response = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',  // Fast and cost-effective for this task
            messages: [
                { role: 'system', content: IMAGE_PROMPT_ASSISTANT_SYSTEM },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.7,
            max_tokens: 800,
            response_format: { type: 'json_object' }  // Enforce JSON output
        });
        
        const content = response.choices[0]?.message?.content;
        
        if (!content) {
            throw new Error('Empty response from OpenAI chat API');
        }
        
        console.log('[ImagePromptBuilder] Raw response:', content);
        
        // Parse the JSON response
        let result;
        try {
            result = JSON.parse(content);
        } catch (parseError) {
            console.error('[ImagePromptBuilder] JSON parse error:', parseError.message);
            console.error('[ImagePromptBuilder] Raw content that failed to parse:', content);
            throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
        }
        
        // Validate required fields
        const requiredFields = ['prompt', 'negativePrompt', 'size', 'notes', 'requiresTextOverlay', 'textSafetyInstructions'];
        for (const field of requiredFields) {
            if (result[field] === undefined) {
                console.warn(`[ImagePromptBuilder] Missing field in response: ${field}`);
                // Provide defaults for missing fields
                if (field === 'negativePrompt') result[field] = 'text, words, letters, typography, watermarks, labels, blurry, low quality';
                if (field === 'size') result[field] = SLOT_DEFAULT_SIZES[slot];
                if (field === 'notes') result[field] = '';
                if (field === 'requiresTextOverlay') result[field] = !!overlayText;
                if (field === 'textSafetyInstructions') result[field] = 'No text should appear in the image.';
            }
        }
        
        console.log('[ImagePromptBuilder] Parsed result:', result);
        
        return result;
        
    } catch (error) {
        console.error('[ImagePromptBuilder] Error calling OpenAI:', error.message);
        throw error;
    }
}

/**
 * Generates a template image using the two-stage process
 * 
 * @param {ImageGenerationRequest} request - The structured request from the UI
 * @param {OpenAI} openaiClient - Initialized OpenAI client
 * @param {Object} options - Additional options
 * @param {string} [options.quality='standard'] - Image quality ('standard' or 'hd')
 * @returns {Promise<ImageGenerationResponse>} - The generated image URL and metadata
 */
async function generateTemplateImage(request, openaiClient, options = {}) {
    const { slot } = request;
    const { quality = 'standard' } = options;
    
    console.log('[ImagePromptBuilder] Starting two-stage image generation for slot:', slot);
    
    // Stage 1: Build the optimized prompt
    const promptResult = await buildImagePrompt(request, openaiClient);
    
    // Stage 2: Generate the image
    // Build the final prompt with safety instructions
    const finalPrompt = `${promptResult.prompt}

IMPORTANT: ${promptResult.textSafetyInstructions}
AVOID: ${promptResult.negativePrompt}`;
    
    console.log('[ImagePromptBuilder] Final prompt for image generation:', finalPrompt);
    
    // Determine DALL-E size parameter
    // DALL-E 3 supports: 1024x1024, 1792x1024, 1024x1792
    const sizeMapping = {
        '1200x400': '1792x1024',   // Wide header/banner → use widest option
        '1200x300': '1792x1024',   // Wide banner → use widest option
        '800x600': '1024x1024',    // Body image → square works well
        '600x200': '1792x1024'     // Footer → use wide option
    };
    
    const dalleSize = sizeMapping[promptResult.size] || '1024x1024';
    
    console.log('[ImagePromptBuilder] Calling DALL-E with size:', dalleSize);
    
    try {
        const imageResponse = await openaiClient.images.generate({
            model: 'dall-e-3',
            prompt: finalPrompt,
            size: dalleSize,
            quality: quality,
            n: 1
        });
        
        if (!imageResponse?.data?.[0]?.url) {
            throw new Error('Invalid response structure from DALL-E API');
        }
        
        const imageUrl = imageResponse.data[0].url;
        
        console.log('[ImagePromptBuilder] Image generated successfully');
        
        return {
            imageUrl: imageUrl,
            metadata: {
                slot: slot,
                promptUsed: finalPrompt,
                notes: promptResult.notes,
                requiresTextOverlay: promptResult.requiresTextOverlay,
                recommendedSize: SLOT_DEFAULT_SIZES[slot]
            }
        };
        
    } catch (dalleError) {
        console.error('[ImagePromptBuilder] DALL-E error:', dalleError.message);
        
        // Try DALL-E 2 as fallback (with adjusted size)
        if (dalleError.message?.includes('dall-e-3') || dalleError.code === 'model_not_found') {
            console.log('[ImagePromptBuilder] Trying DALL-E 2 fallback...');
            
            const dalle2Size = dalleSize === '1792x1024' || dalleSize === '1024x1792' 
                ? '1024x1024' 
                : dalleSize;
            
            const fallbackResponse = await openaiClient.images.generate({
                model: 'dall-e-2',
                prompt: finalPrompt,
                size: dalle2Size,
                n: 1
            });
            
            return {
                imageUrl: fallbackResponse.data[0].url,
                metadata: {
                    slot: slot,
                    promptUsed: finalPrompt,
                    notes: promptResult.notes + ' (Generated with DALL-E 2 fallback)',
                    requiresTextOverlay: promptResult.requiresTextOverlay,
                    recommendedSize: SLOT_DEFAULT_SIZES[slot]
                }
            };
        }
        
        throw dalleError;
    }
}

/**
 * Validates an ImageGenerationRequest
 * 
 * @param {Object} body - Request body to validate
 * @returns {{ valid: boolean, error?: string, request?: ImageGenerationRequest }}
 */
function validateImageGenerationRequest(body) {
    const { slot, styleDescription, overlayText } = body;
    
    // Validate slot
    const validSlots = ['header', 'banner', 'body', 'footer-left'];
    if (!slot || !validSlots.includes(slot)) {
        return { 
            valid: false, 
            error: `Invalid slot. Must be one of: ${validSlots.join(', ')}` 
        };
    }
    
    // Validate styleDescription
    if (!styleDescription || typeof styleDescription !== 'string') {
        return { 
            valid: false, 
            error: 'styleDescription is required and must be a string' 
        };
    }
    
    if (styleDescription.length < 10) {
        return { 
            valid: false, 
            error: 'styleDescription must be at least 10 characters long' 
        };
    }
    
    if (styleDescription.length > 500) {
        return { 
            valid: false, 
            error: 'styleDescription must be 500 characters or less' 
        };
    }
    
    // overlayText is optional
    if (overlayText !== undefined && typeof overlayText !== 'string') {
        return { 
            valid: false, 
            error: 'overlayText must be a string if provided' 
        };
    }
    
    return {
        valid: true,
        request: {
            slot,
            styleDescription: styleDescription.trim(),
            overlayText: overlayText?.trim() || undefined
        }
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    buildImagePrompt,
    generateTemplateImage,
    validateImageGenerationRequest,
    SLOT_DEFAULT_SIZES,
    SLOT_DESCRIPTIONS,
    IMAGE_PROMPT_ASSISTANT_SYSTEM
};

