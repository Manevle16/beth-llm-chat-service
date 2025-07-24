import bcrypt from "bcrypt";
import pool from "../config/database.js";
import ollamaService from "../services/ollamaService.js";
import streamSessionDatabase from "../services/streamSessionDatabase.js";
import streamSessionManager from "../services/streamSessionManager.js";
import { TERMINATION_REASON } from "../types/streamSession.js";

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
          SELECT id, conversation_id, text, sender, timestamp, has_images
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
            timestamp: row.timestamp,
            hasImages: row.has_images || false
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
          SELECT id, conversation_id, text, sender, timestamp, has_images
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
          timestamp: row.timestamp,
          hasImages: row.has_images || false
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
          RETURNING id, conversation_id, text, sender, timestamp, has_images
        `;

        const messageResult = await pool.query(messageQuery, [conversationId, text, sender]);
        const userMessage = {
          id: messageResult.rows[0].id,
          conversationId: messageResult.rows[0].conversation_id,
          text: messageResult.rows[0].text,
          sender: messageResult.rows[0].sender,
          timestamp: messageResult.rows[0].timestamp,
          hasImages: messageResult.rows[0].has_images || false
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
              RETURNING id, conversation_id, text, sender, timestamp, has_images
            `;

            const llmMessageResult = await pool.query(llmMessageQuery, [conversationId, llmResponse, "llm"]);
            llmMessage = {
              id: llmMessageResult.rows[0].id,
              conversationId: llmMessageResult.rows[0].conversation_id,
              text: llmMessageResult.rows[0].text,
              sender: llmMessageResult.rows[0].sender,
              timestamp: llmMessageResult.rows[0].timestamp,
              hasImages: llmMessageResult.rows[0].has_images || false
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
    },

    // Terminate an active streaming session
    terminateStream: async (_, { input }) => {
      try {
        const { sessionId, conversationId, password, reason } = input;

        console.log("[GraphQL] terminateStream called", {
          sessionId,
          conversationId,
          hasPassword: !!password,
          reason
        });

        // Validate required parameters
        if (!sessionId || !conversationId) {
          return {
            success: false,
            sessionId: sessionId || "unknown",
            message: "Session ID and conversation ID are required",
            partialResponse: "",
            tokenCount: 0,
            finalStatus: "ERROR",
            terminationReason: TERMINATION_REASON.ERROR,
            error: "Missing required parameters"
          };
        }

        // Validate conversation access permissions
        const conversationQuery = `
          SELECT id, is_private, password_hash
          FROM conversations
          WHERE id = $1
        `;
        const conversationResult = await pool.query(conversationQuery, [conversationId]);
        
        if (conversationResult.rows.length === 0) {
          return {
            success: false,
            sessionId,
            message: "Conversation not found",
            partialResponse: "",
            tokenCount: 0,
            finalStatus: "ERROR",
            terminationReason: TERMINATION_REASON.ERROR,
            error: "Conversation not found"
          };
        }

        const conversation = conversationResult.rows[0];

        // Check if conversation is private and password is required
        if (conversation.is_private) {
          if (!password) {
            return {
              success: false,
              sessionId,
              message: "Password required for private conversation",
              partialResponse: "",
              tokenCount: 0,
              finalStatus: "ERROR",
              terminationReason: TERMINATION_REASON.ERROR,
              error: "Password required for private conversation"
            };
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(password, conversation.password_hash);
          if (!isValidPassword) {
            return {
              success: false,
              sessionId,
              message: "Invalid password for private conversation",
              partialResponse: "",
              tokenCount: 0,
              finalStatus: "ERROR",
              terminationReason: TERMINATION_REASON.ERROR,
              error: "Invalid password"
            };
          }
        }

        // Get session from database
        const session = await streamSessionDatabase.getSession(sessionId);
        if (!session) {
          return {
            success: false,
            sessionId,
            message: "Stream session not found",
            partialResponse: "",
            tokenCount: 0,
            finalStatus: "ERROR",
            terminationReason: TERMINATION_REASON.ERROR,
            error: "Session not found"
          };
        }

        // Verify session belongs to the specified conversation
        if (session.conversationId !== conversationId) {
          return {
            success: false,
            sessionId,
            message: "Session does not belong to the specified conversation",
            partialResponse: "",
            tokenCount: 0,
            finalStatus: "ERROR",
            terminationReason: TERMINATION_REASON.ERROR,
            error: "Session conversation mismatch"
          };
        }

        // Check if session is in a terminable state
        if (session.status !== 'ACTIVE') {
          return {
            success: false,
            sessionId,
            message: `Session is in ${session.status} state and cannot be terminated`,
            partialResponse: session.partialResponse || "",
            tokenCount: session.tokenCount || 0,
            finalStatus: session.status,
            terminationReason: session.terminationReason || TERMINATION_REASON.USER_REQUESTED,
            error: "Session not in terminable state"
          };
        }

        // Determine termination reason
        const terminationReason = reason || TERMINATION_REASON.USER_REQUESTED;

        // Terminate the session in the database
        const terminatedSession = await streamSessionDatabase.terminateSession(
          sessionId,
          terminationReason
        );

        if (!terminatedSession) {
          return {
            success: false,
            sessionId,
            message: "Failed to terminate session in database",
            partialResponse: "",
            tokenCount: 0,
            finalStatus: "ERROR",
            terminationReason: TERMINATION_REASON.ERROR,
            error: "Database termination failed"
          };
        }

        // Save partial response as a message in the conversation
        let savedMessageId = null;
        if (terminatedSession.partialResponse && terminatedSession.partialResponse.trim()) {
          try {
            const savedMessage = await streamSessionDatabase.savePartialResponseAsMessage(
              sessionId,
              conversationId,
              terminatedSession.partialResponse
            );
            savedMessageId = savedMessage.id;
            console.log("[GraphQL] Partial response saved as message:", savedMessageId);
          } catch (error) {
            console.error("[GraphQL] Failed to save partial response:", error.message);
            // Don't fail the termination if message saving fails
          }
        }

        // Terminate the session in the session manager (if it exists in memory)
        try {
          streamSessionManager.terminateSession(sessionId, terminationReason);
        } catch (error) {
          console.log("[GraphQL] Session not found in memory manager (non-critical):", error.message);
        }

        console.log("[GraphQL] Stream termination successful:", {
          sessionId,
          conversationId,
          tokenCount: terminatedSession.tokenCount,
          responseLength: terminatedSession.partialResponse.length,
          terminationReason
        });

        return {
          success: true,
          sessionId: sessionId,
          message: "Stream terminated successfully",
          partialResponse: terminatedSession.partialResponse || "",
          tokenCount: terminatedSession.tokenCount || 0,
          finalStatus: terminatedSession.status,
          terminationReason: terminationReason,
          error: null
        };

      } catch (error) {
        console.error("[GraphQL] Error in terminateStream:", error);
        return {
          success: false,
          sessionId: input?.sessionId || "unknown",
          message: "An error occurred while terminating the stream",
          partialResponse: "",
          tokenCount: 0,
          finalStatus: "ERROR",
          terminationReason: TERMINATION_REASON.ERROR,
          error: error.message || "Internal server error"
        };
      }
    }
  },

  // Field resolvers for computed fields
  Conversation: {
    messages: async (parent) => {
      try {
        const query = `
          SELECT id, conversation_id, text, sender, timestamp, has_images
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
          timestamp: row.timestamp,
          hasImages: row.has_images || false
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
  },

  // Field resolvers for Message type
  Message: {
    hasImages: async (parent) => {
      try {
        const query = `
          SELECT has_images
          FROM messages 
          WHERE id = $1
        `;
        const result = await pool.query(query, [parent.id]);
        return result.rows[0]?.has_images || false;
      } catch (error) {
        console.error("Error resolving hasImages:", error);
        return false;
      }
    },

    images: async (parent) => {
      try {
        const query = `
          SELECT id, filename, file_size, mime_type, content_hash, created_at
          FROM images 
          WHERE message_id = $1 AND deleted_at IS NULL
          ORDER BY created_at ASC
        `;
        const result = await pool.query(query, [parent.id]);
        return result.rows.map((row) => ({
          id: row.id,
          filename: row.filename,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          contentHash: row.content_hash,
          createdAt: row.created_at
        }));
      } catch (error) {
        console.error("Error resolving images:", error);
        return [];
      }
    }
  }
};

export default resolvers;
