const fetch = require('node-fetch');
const aiService = require('./aiService');

class ImageGenerationService {
  constructor() {
    this.pollinationsUrl = 'https://image.pollinations.ai/prompt';
  }

  /**
   * Generate an image for a lesson using AI
   * @param {Object} lessonData - Lesson data including title, subject, grade, tags, questions
   * @param {string} customPrompt - Optional custom user-defined prompt
   * @returns {Object} - { success: boolean, imageUrl?: string, error?: string }
   */
  async generateLessonImage(lessonData, customPrompt = null) {
    const maxRetries = 2;
    const models = ['turbo', 'flux']; // Try turbo first, fallback to flux
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
        const currentModel = models[modelIndex];

        try {
          console.log(`Image generation attempt ${attempt}/${maxRetries} with model: ${currentModel}`);

          let imagePrompt;

          // Step 1: Generate or process image prompt
          if (customPrompt && customPrompt.trim() !== '') {
            console.log('Using custom user prompt:', customPrompt);
            // Sanitize and translate user prompt using Gemini
            imagePrompt = await aiService.sanitizeImagePrompt(customPrompt);
            console.log('Sanitized prompt:', imagePrompt);
          } else {
            // Generate automatic prompt from lesson data
            imagePrompt = await aiService.generateImagePrompt(lessonData);
          }

          // Step 2: Generate image using Pollinations with specific model
          const imageUrl = await this.generateWithPollinations(imagePrompt, { model: currentModel });

          // Step 3: Download and convert to base64
          const base64Image = await this.downloadAndConvertToBase64(imageUrl);

          return {
            success: true,
            imageUrl: base64Image,
            prompt: imagePrompt,
            model: currentModel,
            isCustomPrompt: !!customPrompt
          };
        } catch (error) {
          console.error(`Attempt ${attempt} with model ${currentModel} failed:`, error.message);
          lastError = error;

          // If turbo fails, try flux immediately
          if (currentModel === 'turbo' && modelIndex === 0) {
            console.log(`Turbo model failed, trying flux model...`);
            continue;
          }
        }
      }

      // If all models failed for this attempt, wait before next attempt
      if (attempt < maxRetries) {
        console.log(`All models failed for attempt ${attempt}, waiting 5 seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.error('All image generation attempts and models failed');
    return {
      success: false,
      error: lastError?.message || 'Failed to generate image after multiple attempts with all models'
    };
  }

  /**
   * Generate image URL using Pollinations API
   * @param {string} prompt - Image generation prompt
   * @param {Object} options - Generation options
   * @returns {string} - Pollinations image URL
   */
  async generateWithPollinations(prompt, options = {}) {
    // Clean and simplify the prompt to avoid encoding issues
    const cleanPrompt = prompt
      .replace(/[^\w\s,.-]/g, ' ') // Remove special characters except basic punctuation
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .substring(0, 200); // Limit prompt length

    // Encode the prompt for URL
    const encodedPrompt = encodeURIComponent(cleanPrompt);

    // Set default dimensions for lesson images (16:9 aspect ratio)
    const width = options.width || 854;
    const height = options.height || 480;
    const seed = options.seed;
    const model = options.model || 'kontext'; // Default to kontext, fallback to flux

    // Construct the full URL with parameters
    const url = new URL(`${this.pollinationsUrl}/${encodedPrompt}`);
    url.searchParams.set('width', width.toString());
    url.searchParams.set('height', height.toString());
    url.searchParams.set('model', model);
    url.searchParams.set('enhance', 'true'); // Enhance prompt using LLM
    url.searchParams.set('safe', 'true'); // Strict NSFW filtering

    if (seed) {
      url.searchParams.set('seed', seed.toString());
    }

    const imageUrl = url.toString();
    console.log('Generated Pollinations URL:', imageUrl);

    return imageUrl;
  }

  /**
   * Download image from URL and convert to base64
   * @param {string} imageUrl - URL of the image to download
   * @returns {string} - Base64 data URL
   */
  async downloadAndConvertToBase64(imageUrl) {
    try {
      console.log('Downloading image from:', imageUrl);

      // First attempt with long timeout to allow for image generation
      try {
        console.log('Attempting to download with 60 second timeout...');
        const response = await fetch(imageUrl, {
          timeout: 60000, // 60 second timeout for initial generation
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        if (response.ok) {
          const buffer = await response.buffer();
          console.log('Downloaded image size:', buffer.length, 'bytes');

          if (buffer.length > 1000) { // Valid image should be at least 1KB
            const contentType = response.headers.get('content-type');
            console.log('Response content-type:', contentType);

            if (contentType && contentType.startsWith('image/')) {
              // Success - convert to base64 data URL
              const mimeType = contentType || 'image/png';
              const base64String = buffer.toString('base64');
              const dataUrl = `data:${mimeType};base64,${base64String}`;

              console.log('Image converted to base64, size:', dataUrl.length);
              return dataUrl;
            } else {
              console.warn(`Invalid content type: ${contentType}`);
            }
          } else {
            console.warn(`Image too small (${buffer.length} bytes)`);
          }
        } else {
          console.warn(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (fetchError) {
        console.warn(`First attempt failed: ${fetchError.message}`);
      }

      throw new Error('Failed to download valid image - Pollinations API may be experiencing issues');
    } catch (error) {
      console.error('Error downloading and converting image:', error);
      throw new Error(`Failed to convert generated image: ${error.message}`);
    }
  }

  /**
   * Generate multiple image variations for a lesson
   * @param {Object} lessonData - Lesson data
   * @param {number} count - Number of variations to generate
   * @returns {Array} - Array of generated image results
   */
  async generateImageVariations(lessonData, count = 3) {
    const results = [];
    
    try {
      // Generate the base prompt once
      const basePrompt = await aiService.generateImagePrompt(lessonData);
      
      // Generate variations with different seeds using kontext model
      for (let i = 0; i < count; i++) {
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = await this.generateWithPollinations(basePrompt, {
          seed,
          model: 'kontext' // Use kontext for variations
        });

        results.push({
          index: i,
          prompt: basePrompt,
          seed: seed,
          url: imageUrl
        });
      }
      
      return {
        success: true,
        variations: results
      };
    } catch (error) {
      console.error('Error generating image variations:', error);
      return {
        success: false,
        error: error.message,
        variations: results
      };
    }
  }

  /**
   * Regenerate image with a modified prompt
   * @param {string} originalPrompt - Original image prompt
   * @param {string} modifier - Modification to apply to the prompt
   * @returns {Object} - Generation result
   */
  async regenerateWithModifier(originalPrompt, modifier) {
    try {
      // Combine original prompt with modifier
      const modifiedPrompt = `${originalPrompt}, ${modifier}`;
      
      // Generate new image with kontext model
      const imageUrl = await this.generateWithPollinations(modifiedPrompt, { model: 'kontext' });
      
      return {
        success: true,
        imageUrl: imageUrl,
        prompt: modifiedPrompt
      };
    } catch (error) {
      console.error('Error regenerating image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up old generated images (deprecated - images now stored as base64 in database)
   * @param {number} daysToKeep - Number of days to keep images
   * @returns {Object} - Cleanup result
   */
  async cleanupOldImages(daysToKeep = 30) {
    // This method is deprecated since images are now stored as base64 in the database
    // No file system cleanup needed
    return {
      success: true,
      deletedCount: 0,
      message: 'Images are now stored as base64 in database - no file cleanup needed'
    };
  }

  /**
   * Generate a thumbnail version of an image
   * @param {string} imageUrl - URL or path of the original image
   * @param {Object} options - Thumbnail options
   * @returns {string} - URL of the thumbnail
   */
  async generateThumbnail(imageUrl, options = {}) {
    const {
      width = 200,
      height = 150
    } = options;

    // For Pollinations URLs, we can modify the parameters
    if (imageUrl.includes('pollinations.ai')) {
      const url = new URL(imageUrl);
      url.searchParams.set('width', width.toString());
      url.searchParams.set('height', height.toString());
      return url.toString();
    }

    // For base64 images, return as-is (no thumbnail generation needed)
    return imageUrl;
  }

  /**
   * Validate if an image URL is accessible
   * @param {string} imageUrl - URL to validate
   * @returns {boolean} - Whether the image is accessible
   */
  async validateImageUrl(imageUrl) {
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      return response.ok && response.headers.get('content-type')?.startsWith('image/');
    } catch (error) {
      return false;
    }
  }
}

module.exports = new ImageGenerationService();