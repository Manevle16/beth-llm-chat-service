import { Ollama } from "ollama";
import modelRotationService from "./modelRotationService.js";
import configService from "../config/modelRotation.js";
import { REQUEST_PRIORITY } from "../types/modelRotation.js";
import { systemPrompt } from "../config/prompts.js";

class OllamaService {
  constructor() {
    this.ollama = new Ollama({
      host: process.env.OLLAMA_HOST || "http://localhost:11434"
    });
    this._rotationEnabled = false;
    this._isInitialized = false;
  }

  /**
   * Initialize the service with rotation capabilities
   * This is called automatically on first use, but can be called explicitly
   */
  async initialize() {
    if (this._isInitialized) {
      return;
    }

    console.log("🤖 Initializing OllamaService with rotation capabilities...");

    try {
      // Initialize configuration and rotation service
      configService.initialize();
      await modelRotationService.initialize();

      // Check if rotation is enabled
      this._rotationEnabled = configService.getSetting('MODEL_ROTATION_ENABLED') || false;

      this._isInitialized = true;
      console.log(`✅ OllamaService initialized successfully (rotation ${this._rotationEnabled ? 'enabled' : 'disabled'})`);
    } catch (error) {
      console.error("❌ Failed to initialize OllamaService:", error.message);
      // Continue without rotation capabilities
      this._rotationEnabled = false;
      this._isInitialized = true;
    }
  }

  /**
   * Ensure service is initialized
   * @private
   */
  async _ensureInitialized() {
    if (!this._isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Generate response with optional model rotation
   * @param {string} model - Model name to use
   * @param {string} message - User message
   * @param {Array} conversationHistory - Conversation history
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Generated response
   */
  async generateResponse(model, message, conversationHistory = [], options = {}) {
    await this._ensureInitialized();

    const { enableRotation = true, rotationPriority = REQUEST_PRIORITY.NORMAL } = options;

    try {
      // Handle model rotation if enabled
      if (this._rotationEnabled && enableRotation) {
        console.log(`🔄 Checking model rotation for: ${model}`);

        try {
          const rotationResult = await modelRotationService.requestModelRotation(
            model,
            'generateResponse',
            rotationPriority
          );

          if (rotationResult.action === 'rotated') {
            console.log(`✅ Model rotated to ${model} in ${rotationResult.duration}ms`);
          } else if (rotationResult.action === 'queued') {
            console.log(`📋 Model rotation queued for ${model}`);
          } else if (rotationResult.action === 'no_change') {
            console.log(`✅ Model ${model} already active`);
          }
        } catch (rotationError) {
          console.warn(`⚠️  Model rotation failed, continuing with current model: ${rotationError.message}`);
          // Continue with current model if rotation fails
        }
      }

      // Build the conversation context
      const messages = this.buildConversationContext(conversationHistory, message, model);

      console.log(`🤖 Sending request to Ollama model: ${model}`);
      console.log(`📝 Message: ${message}`);
      console.log(`📚 Context messages: ${messages.length}`);

      // First, check if Ollama is running by testing the connection
      try {
        await this.ollama.list();
        console.log("✅ Ollama service is running");
      } catch (connectionError) {
        console.error("❌ Ollama service is not running or not accessible");
        throw new Error(`Ollama service is not running. Please start Ollama with: ollama serve`);
      }

      const response = await this.ollama.chat({
        model: model,
        messages: messages,
        stream: false
      });

      console.log(`✅ Ollama response received for model: ${model}`);
      return response.message.content;
    } catch (error) {
      console.error(`❌ Error calling Ollama API for model ${model}:`, error);

      // Handle specific Ollama errors
      if (error.message.includes("model not found")) {
        throw new Error(`LLM model '${model}' not found. Please ensure it's installed in Ollama.`);
      } else if (error.message.includes("connection") || error.message.includes("stream is not readable")) {
        throw new Error("Unable to connect to Ollama service. Please ensure Ollama is running with: ollama serve");
      } else if (error.message.includes("Ollama service is not running")) {
        throw error; // Re-throw our custom error
      } else {
        throw new Error(`LLM service error: ${error.message}`);
      }
    }
  }

  /**
   * Stream response with optional model rotation and termination checking
   * @param {string} model - Model name to use
   * @param {string} message - User message
   * @param {Array} conversationHistory - Conversation history
   * @param {Object} options - Additional options
   * @param {Function} terminationCheck - Optional function to check for termination
   * @returns {AsyncGenerator<string>} Streamed response tokens
   */
  async *streamResponse(model, message, conversationHistory = [], options = {}, terminationCheck = null, visionMessage = null) {
    await this._ensureInitialized();

    const { enableRotation = true, rotationPriority = REQUEST_PRIORITY.HIGH } = options;

    try {
      // Handle model rotation if enabled (higher priority for streaming)
      if (this._rotationEnabled && enableRotation) {
        console.log(`🔄 Checking model rotation for streaming: ${model}`);

        try {
          const rotationResult = await modelRotationService.requestModelRotation(
            model,
            'streamResponse',
            rotationPriority
          );

          if (rotationResult.action === 'rotated') {
            console.log(`✅ Model rotated to ${model} for streaming in ${rotationResult.duration}ms`);
          } else if (rotationResult.action === 'queued') {
            console.log(`📋 Model rotation queued for streaming ${model}`);
          } else if (rotationResult.action === 'no_change') {
            console.log(`✅ Model ${model} already active for streaming`);
          }
        } catch (rotationError) {
          console.warn(`⚠️  Model rotation failed for streaming, continuing with current model: ${rotationError.message}`);
          // Continue with current model if rotation fails
        }
      }

      const messages = this.buildConversationContext(conversationHistory, message, model, visionMessage);

      // Check Ollama is running
      try {
        await this.ollama.list();
      } catch (connectionError) {
        throw new Error("Ollama service is not running. Please start Ollama with: ollama serve");
      }

      // Stream tokens from Ollama
      const stream = await this.ollama.chat({
        model: model,
        messages: messages,
        stream: true
      });

      for await (const part of stream) {
        // Check for termination if callback provided
        if (terminationCheck && typeof terminationCheck === 'function') {
          try {
            const shouldTerminate = await terminationCheck();
            if (shouldTerminate) {
              console.log(`🛑 Stream terminated during Ollama streaming for model: ${model}`);
              return; // Exit the generator
            }
          } catch (checkError) {
            console.warn(`⚠️  Termination check failed: ${checkError.message}`);
            // Continue streaming if termination check fails
          }
        }

        yield part.message.content;
      }
    } catch (error) {
      console.error(`❌ Error streaming from Ollama API for model ${model}:`, error);

      // Handle specific Ollama errors
      if (error.message.includes("model not found")) {
        throw new Error(`LLM model '${model}' not found. Please ensure it's installed in Ollama.`);
      } else if (error.message.includes("connection") || error.message.includes("stream is not readable")) {
        throw new Error("Unable to connect to Ollama service. Please ensure Ollama is running with: ollama serve");
      } else {
        throw new Error(`LLM streaming error: ${error.message}`);
      }
    }
  }

  /**
   * Build conversation context from history and current message
   * @param {Array} conversationHistory - Conversation history
   * @param {string} currentMessage - Current user message
   * @param {string} model - Model name to use (for special prompt handling)
   * @returns {Array} Formatted messages for Ollama
   */
  buildConversationContext(conversationHistory, currentMessage, model, visionMessage = null) {
    const messages = [];

    // Add system prompt for markdown responses and new conversation detection
    const isNewConversation = conversationHistory.length === 0;

    let promptText = systemPrompt;
    // If model is 'qwen3:32b' and new conversation, prepend '/no_think '
    if (model === 'qwen3:32b') {
      promptText = '/no_think ' + promptText;
    }
    messages.push({
      role: "system",
      content: promptText
    });


    // Add conversation history
    conversationHistory.forEach((msg) => {
      messages.push({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text
      });
    });

    // Add current user message with images if available
    const userMessage = {
      role: "user",
      content: currentMessage
    };

          // Add images to the user message if vision message is provided
      if (visionMessage && Array.isArray(visionMessage) && visionMessage.length > 0) {
        userMessage.images = visionMessage.map(msg => msg.image_url);
      }

    messages.push(userMessage);

    return messages;
  }

  /**
   * List available models
   * @returns {Promise<Array<string>>} List of model names
   */
  async listModels() {
    try {
      const models = await this.ollama.list();
      return models.models.map((model) => model.name);
    } catch (error) {
      console.error("Error listing Ollama models:", error);
      throw new Error("Unable to list available models");
    }
  }

  /**
   * Check if a model exists
   * @param {string} modelName - Model name to check
   * @returns {Promise<boolean>} True if model exists
   */
  async checkModelExists(modelName) {
    try {
      const models = await this.listModels();
      return models.includes(modelName);
    } catch (error) {
      console.error("Error checking model existence:", error);
      return false;
    }
  }

  /**
   * Get current rotation status
   * @returns {Promise<Object>} Rotation status information
   */
  async getRotationStatus() {
    await this._ensureInitialized();

    if (!this._rotationEnabled) {
      return {
        enabled: false,
        message: "Model rotation is disabled"
      };
    }

    try {
      return {
        enabled: true,
        ...modelRotationService.getRotationStatus()
      };
    } catch (error) {
      console.error("Error getting rotation status:", error);
      return {
        enabled: true,
        error: error.message
      };
    }
  }

  /**
   * Force model rotation (bypasses queue)
   * @param {string} targetModel - Target model to load
   * @param {string} source - Request source
   * @returns {Promise<Object>} Rotation result
   */
  async forceModelRotation(targetModel, source) {
    await this._ensureInitialized();

    if (!this._rotationEnabled) {
      throw new Error("Model rotation is disabled");
    }

    try {
      return await modelRotationService.forceModelRotation(targetModel, source);
    } catch (error) {
      console.error("Error forcing model rotation:", error);
      throw error;
    }
  }

  /**
   * Get rotation history
   * @param {number} limit - Number of recent rotations to return
   * @returns {Promise<Array>} Rotation history
   */
  async getRotationHistory(limit = 10) {
    await this._ensureInitialized();

    if (!this._rotationEnabled) {
      return [];
    }

    try {
      return modelRotationService.getRotationHistory(limit);
    } catch (error) {
      console.error("Error getting rotation history:", error);
      return [];
    }
  }

  /**
   * Get failed rotations
   * @returns {Promise<Array>} Failed rotation attempts
   */
  async getFailedRotations() {
    await this._ensureInitialized();

    if (!this._rotationEnabled) {
      return [];
    }

    try {
      return modelRotationService.getFailedRotations();
    } catch (error) {
      console.error("Error getting failed rotations:", error);
      return [];
    }
  }

  /**
   * Emergency cleanup - unload all models
   * @returns {Promise<Object>} Cleanup result
   */
  async emergencyCleanup() {
    await this._ensureInitialized();

    if (!this._rotationEnabled) {
      return {
        success: true,
        action: 'no_cleanup_needed',
        message: 'Model rotation is disabled'
      };
    }

    try {
      return await modelRotationService.emergencyCleanup();
    } catch (error) {
      console.error("Error during emergency cleanup:", error);
      throw error;
    }
  }

  /**
   * Check if rotation is enabled
   * @returns {boolean} True if rotation is enabled
   */
  isRotationEnabled() {
    return this._rotationEnabled;
  }

  /**
   * Enable or disable rotation
   * @param {boolean} enabled - Whether to enable rotation
   */
  setRotationEnabled(enabled) {
    this._rotationEnabled = enabled;
    console.log(`🔄 Model rotation ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export default new OllamaService();
