const { Ollama } = require("ollama");

class OllamaService {
  constructor() {
    this.ollama = new Ollama({
      host: process.env.OLLAMA_HOST || "http://localhost:11434"
    });
  }

  async generateResponse(model, message, conversationHistory = []) {
    try {
      // Build the conversation context
      const messages = this.buildConversationContext(conversationHistory, message);

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

  buildConversationContext(conversationHistory, currentMessage) {
    const messages = [];

    // Add conversation history
    conversationHistory.forEach((msg) => {
      messages.push({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text
      });
    });

    // Add current user message
    messages.push({
      role: "user",
      content: currentMessage
    });

    return messages;
  }

  async listModels() {
    try {
      const models = await this.ollama.list();
      return models.models.map((model) => model.name);
    } catch (error) {
      console.error("Error listing Ollama models:", error);
      throw new Error("Unable to list available models");
    }
  }

  async checkModelExists(modelName) {
    try {
      const models = await this.listModels();
      return models.includes(modelName);
    } catch (error) {
      console.error("Error checking model existence:", error);
      return false;
    }
  }
}

module.exports = new OllamaService();
