import bcrypt from "bcrypt";
import pool from "../config/database.js";
import ollamaService from "../services/ollamaService.js";

const resolvers = {
  Query: {
    // Get all public conversations
    conversations: async () => {
      try {
        const query = `
          SELECT id, tab_name, llm_model, is_private, created_at, updated_at
          FROM conversations 
          WHERE is_private = FALSE
          ORDER BY updated_at DESC
        `;

        const result = await pool.query(query);

        return {
          conversations: result.rows.map((row) => ({
            id: row.id,
            tabName: row.tab_name,
            llmModel: row.llm_model,
            isPrivate: row.is_private,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            messages: [], // Will be resolved by the messages field resolver
            messageCount: 0 // Will be resolved by the messageCount field resolver
          })),
          count: result.rows.length
        };
      } catch (error) {
        console.error("Error fetching conversations:", error);
        throw new Error("Failed to fetch conversations");
      }
    },

    // Get a specific conversation with messages
    conversation: async (_, { id, password }) => {
      try {
        // First, get the conversation details
        const conversationQuery = `
          SELECT id, tab_name, llm_model, is_private, password_hash, created_at, updated_at
          FROM conversations 
          WHERE id = $1
        `;

        const conversationResult = await pool.query(conversationQuery, [id]);

        if (conversationResult.rows.length === 0) {
          throw new Error("Conversation not found");
        }

        const conversation = conversationResult.rows[0];

        // Check if conversation is private and password is required
        if (conversation.is_private) {
          if (!password) {
            throw new Error("Password required for private conversation");
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(password, conversation.password_hash);
          if (!isValidPassword) {
            throw new Error("Invalid password");
          }
        }

        // Get messages for this conversation
        const messagesQuery = `
          SELECT id, conversation_id, text, sender, timestamp
          FROM messages 
          WHERE conversation_id = $1
          ORDER BY timestamp ASC
        `;

        const messagesResult = await pool.query(messagesQuery, [id]);

        return {
          id: conversation.id,
          tabName: conversation.tab_name,
          llmModel: conversation.llm_model,
          isPrivate: conversation.is_private,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
          messages: messagesResult.rows.map((row) => ({
            id: row.id,
            conversationId: row.conversation_id,
            text: row.text,
            sender: row.sender,
            timestamp: row.timestamp
          })),
          messageCount: messagesResult.rows.length
        };
      } catch (error) {
        console.error("Error fetching conversation:", error);
        throw new Error(error.message || "Failed to fetch conversation");
      }
    },

    // Get messages for a conversation
    messages: async (_, { conversationId, password }) => {
      try {
        // Check if conversation exists and is accessible
        const conversationQuery = `
          SELECT id, is_private, password_hash
          FROM conversations 
          WHERE id = $1
        `;

        const conversationResult = await pool.query(conversationQuery, [conversationId]);

        if (conversationResult.rows.length === 0) {
          throw new Error("Conversation not found");
        }

        const conversation = conversationResult.rows[0];

        // If conversation is private, verify password
        if (conversation.is_private) {
          if (!password) {
            throw new Error("Password required for private conversation");
          }

          const isValidPassword = await bcrypt.compare(password, conversation.password_hash);
          if (!isValidPassword) {
            throw new Error("Invalid password");
          }
        }

        // Get messages
        const messagesQuery = `
          SELECT id, conversation_id, text, sender, timestamp
          FROM messages 
          WHERE conversation_id = $1
          ORDER BY timestamp ASC
        `;

        const messagesResult = await pool.query(messagesQuery, [conversationId]);

        return messagesResult.rows.map((row) => ({
          id: row.id,
          conversationId: row.conversation_id,
          text: row.text,
          sender: row.sender,
          timestamp: row.timestamp
        }));
      } catch (error) {
        console.error("Error fetching messages:", error);
        throw new Error(error.message || "Failed to fetch messages");
      }
    },

    // Get available Ollama models
    availableModels: async () => {
      try {
        const models = await ollamaService.listModels();
        return {
          models,
          count: models.length
        };
      } catch (error) {
        console.error("Error fetching available models:", error);
        throw new Error("Failed to fetch available models");
      }
    }
  },

  Mutation: {
    // Create a new conversation
    createConversation: async (_, { input }) => {
      try {
        const { id, tabName, llmModel, password } = input;

        if (!id || !tabName) {
          throw new Error("Conversation ID and tab name are required");
        }

        let passwordHash = null;
        let isPrivate = false;

        if (password) {
          isPrivate = true;
          passwordHash = await bcrypt.hash(password, 10);
        }

        const query = `
          INSERT INTO conversations (id, tab_name, llm_model, is_private, password_hash)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, tab_name, llm_model, is_private, created_at
        `;

        const values = [id, tabName, llmModel || "llama3.1:8b", isPrivate, passwordHash];
        const result = await pool.query(query, values);

        return {
          message: "Conversation created successfully",
          conversation: {
            id: result.rows[0].id,
            tabName: result.rows[0].tab_name,
            llmModel: result.rows[0].llm_model,
            isPrivate: result.rows[0].is_private,
            createdAt: result.rows[0].created_at,
            updatedAt: result.rows[0].created_at,
            messages: [],
            messageCount: 0
          }
        };
      } catch (error) {
        if (error.code === "23505") {
          // Unique violation
          throw new Error("Conversation ID already exists");
        }
        console.error("Error creating conversation:", error);
        throw new Error(error.message || "Failed to create conversation");
      }
    },

    // Add a message to a conversation (with optional LLM response)
    addMessage: async (_, { input }) => {
      try {
        const { conversationId, text, sender, password, llmModel } = input;

        if (!text || !sender) {
          throw new Error("Message text and sender are required");
        }

        if (!["user", "llm"].includes(sender)) {
          throw new Error('Sender must be either "user" or "llm"');
        }

        // Check if conversation exists and is accessible
        const conversationQuery = `
          SELECT id, llm_model, is_private, password_hash
          FROM conversations 
          WHERE id = $1
        `;

        const conversationResult = await pool.query(conversationQuery, [conversationId]);

        if (conversationResult.rows.length === 0) {
          throw new Error("Conversation not found");
        }

        const conversation = conversationResult.rows[0];

        // If conversation is private, verify password
        if (conversation.is_private) {
          if (!password) {
            throw new Error("Password required for private conversation");
          }

          const isValidPassword = await bcrypt.compare(password, conversation.password_hash);
          if (!isValidPassword) {
            throw new Error("Invalid password");
          }
        }

        // Insert the user message
        const messageQuery = `
          INSERT INTO messages (conversation_id, text, sender)
          VALUES ($1, $2, $3)
          RETURNING id, conversation_id, text, sender, timestamp
        `;

        const messageResult = await pool.query(messageQuery, [conversationId, text, sender]);
        const userMessage = {
          id: messageResult.rows[0].id,
          conversationId: messageResult.rows[0].conversation_id,
          text: messageResult.rows[0].text,
          sender: messageResult.rows[0].sender,
          timestamp: messageResult.rows[0].timestamp
        };

        let llmResponse = null;
        let llmMessage = null;
        let error = null;
        let llmResponseTime = null;

        // If this is a user message, generate LLM response
        if (sender === "user") {
          try {
            // Get conversation history for context
            const historyQuery = `
              SELECT text, sender
              FROM messages
              WHERE conversation_id = $1
              ORDER BY timestamp ASC
            `;
            const historyResult = await pool.query(historyQuery, [conversationId]);
            const conversationHistory = historyResult.rows;

            // Use provided llmModel or fall back to conversation's default model
            const modelToUse = llmModel || conversation.llm_model;

            console.log(`🔄 Generating LLM response for conversation: ${conversationId}`);
            console.log(`🤖 Using model: ${modelToUse}`);

            // Start timing the LLM response
            const startTime = Date.now();

            // Generate LLM response
            llmResponse = await ollamaService.generateResponse(modelToUse, text, conversationHistory);

            // Calculate response time in milliseconds
            llmResponseTime = Date.now() - startTime;

            console.log(`⏱️ LLM response generated in ${llmResponseTime}ms`);

            // Store the LLM response
            const llmMessageQuery = `
              INSERT INTO messages (conversation_id, text, sender)
              VALUES ($1, $2, $3)
              RETURNING id, conversation_id, text, sender, timestamp
            `;

            const llmMessageResult = await pool.query(llmMessageQuery, [conversationId, llmResponse, "llm"]);
            llmMessage = {
              id: llmMessageResult.rows[0].id,
              conversationId: llmMessageResult.rows[0].conversation_id,
              text: llmMessageResult.rows[0].text,
              sender: llmMessageResult.rows[0].sender,
              timestamp: llmMessageResult.rows[0].timestamp
            };

            console.log(`✅ LLM response stored for conversation: ${conversationId}`);
          } catch (llmError) {
            console.error("Error generating LLM response:", llmError);
            error = llmError.message;

            // Log additional debugging info
            console.log("🔍 LLM Error Details:");
            console.log("   - Error type:", llmError.constructor.name);
            console.log("   - Error message:", llmError.message);
            console.log("   - Error stack:", llmError.stack);
          }
        }

        return {
          message: "Message added successfully",
          userMessage,
          llmMessage,
          llmModel: llmModel || conversation.llm_model,
          error,
          llmResponseTime
        };
      } catch (error) {
        console.error("Error adding message:", error);
        throw new Error(error.message || "Failed to add message");
      }
    },

    // Verify password for private conversation
    verifyPassword: async (_, { input }) => {
      try {
        const { conversationId, password } = input;

        if (!password) {
          throw new Error("Password is required");
        }

        // Get conversation details
        const query = `
          SELECT id, tab_name, is_private, password_hash
          FROM conversations 
          WHERE id = $1
        `;

        const result = await pool.query(query, [conversationId]);

        if (result.rows.length === 0) {
          throw new Error("Conversation not found");
        }

        const conversation = result.rows[0];

        if (!conversation.is_private) {
          throw new Error("This conversation is not password protected");
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, conversation.password_hash);

        if (isValidPassword) {
          return {
            message: "Password verified successfully",
            conversationId: conversation.id,
            tabName: conversation.tab_name
          };
        } else {
          throw new Error("Invalid password");
        }
      } catch (error) {
        console.error("Error verifying password:", error);
        throw new Error(error.message || "Failed to verify password");
      }
    },

    // Warm up Ollama service to reduce initial latency
    warmupOllama: async () => {
      try {
        console.log("🔥 Warming up Ollama service...");

        // First, check if Ollama is running and get available models
        const models = await ollamaService.listModels();

        if (models.length === 0) {
          throw new Error("No models available in Ollama");
        }

        // Try to generate a simple response with the first available model to warm up the service
        const testModel = models[0];
        console.log(`🔄 Warming up model: ${testModel}`);

        const testResponse = await ollamaService.generateResponse(testModel, "Hello", []);

        console.log("✅ Ollama service warmed up successfully");

        return {
          message: "Ollama service warmed up successfully",
          models: models,
          count: models.length,
          status: "ready"
        };
      } catch (error) {
        console.error("❌ Error warming up Ollama service:", error);

        // Return error status but don't throw - this allows the service to continue
        return {
          message: `Failed to warm up Ollama service: ${error.message}`,
          models: [],
          count: 0,
          status: "error"
        };
      }
    },
    deleteConversation: async (_, { conversationId }) => {
      try {
        // Delete all messages for the conversation
        await pool.query("DELETE FROM messages WHERE conversation_id = $1", [conversationId]);
        // Delete the conversation itself
        const result = await pool.query("DELETE FROM conversations WHERE id = $1 RETURNING id", [conversationId]);
        if (result.rowCount === 0) {
          return {
            message: "Conversation not found",
            conversationId,
            success: false
          };
        }
        return {
          message: "Conversation deleted successfully",
          conversationId,
          success: true
        };
      } catch (error) {
        console.error("Error deleting conversation:", error);
        return {
          message: error.message || "Failed to delete conversation",
          conversationId,
          success: false
        };
      }
    },
    deleteMessagesAfter: async (_, { conversationId, messageId }) => {
      try {
        // Get the timestamp of the target message in the conversation
        const msgRes = await pool.query("SELECT timestamp FROM messages WHERE id = $1 AND conversation_id = $2", [
          messageId,
          conversationId
        ]);
        if (msgRes.rows.length === 0) {
          return { message: "Message not found", deletedCount: 0, success: false };
        }
        const { timestamp } = msgRes.rows[0];

        // Delete all messages in this conversation with timestamp >= this message
        const delRes = await pool.query("DELETE FROM messages WHERE conversation_id = $1 AND timestamp >= $2", [
          conversationId,
          timestamp
        ]);
        return {
          message: `Deleted ${delRes.rowCount} messages`,
          deletedCount: delRes.rowCount,
          success: true
        };
      } catch (error) {
        console.error("Error deleting messages after:", error);
        return {
          message: error.message || "Failed to delete messages",
          deletedCount: 0,
          success: false
        };
      }
    }
  },

  // Field resolvers for computed fields
  Conversation: {
    messages: async (parent) => {
      try {
        const query = `
          SELECT id, conversation_id, text, sender, timestamp
          FROM messages 
          WHERE conversation_id = $1
          ORDER BY timestamp ASC
        `;
        const result = await pool.query(query, [parent.id]);
        return result.rows.map((row) => ({
          id: row.id,
          conversationId: row.conversation_id,
          text: row.text,
          sender: row.sender,
          timestamp: row.timestamp
        }));
      } catch (error) {
        console.error("Error resolving messages:", error);
        return [];
      }
    },

    messageCount: async (parent) => {
      try {
        const query = `
          SELECT COUNT(*) as count
          FROM messages 
          WHERE conversation_id = $1
        `;
        const result = await pool.query(query, [parent.id]);
        return parseInt(result.rows[0].count);
      } catch (error) {
        console.error("Error resolving message count:", error);
        return 0;
      }
    }
  }
};

export default resolvers;
