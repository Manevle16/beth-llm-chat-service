import express from "express";
import ollamaService from "../services/ollamaService.js";
import pool from "../config/database.js";
import streamSessionManager from "../services/streamSessionManager.js";
import streamSessionDatabase from "../services/streamSessionDatabase.js";
import imageUploadHandler from "../services/imageUploadHandler.js";
import { visionModelService } from "../services/visionModelService.js";
import { 
  TERMINATION_REASON, 
  STREAM_STATUS,
  createStreamSession 
} from "../types/streamSession.js";
const router = express.Router();

// SSE endpoint for streaming LLM responses (supports both JSON and multipart)
router.post("/stream-message", async (req, res) => {
  const apiStart = Date.now();
  console.log("[SSE] /api/stream-message called", {
    time: new Date().toISOString(),
    contentType: req.headers['content-type'],
    hasFiles: !!req.files
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Check if this is a multipart request
  const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
  
  let model, message, conversationId, password;
  let processedImages = [];
  let validationResult = null;

  if (isMultipart) {
    // Handle multipart request with images
    try {
      // Initialize image upload handler if not already done
      await imageUploadHandler.initialize();
      
      // Use multer middleware to process files
      const uploadMiddleware = imageUploadHandler.getUploadMiddleware();
      
      // Process the upload
      await new Promise((resolve, reject) => {
        uploadMiddleware(req, res, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      // Extract form data
      model = req.body.model;
      message = req.body.message;
      conversationId = req.body.conversationId;
      password = req.body.password;

      if (!model || !message || !conversationId) {
        console.log("[SSE] Missing required parameters in multipart request");
        res.write(`event: error\ndata: ${JSON.stringify({ error: "Missing model, message, or conversationId" })}\n\n`);
        return res.end();
      }

      // Process uploaded images if any
      if (req.files && req.files.length > 0) {
        console.log(`[SSE] Processing ${req.files.length} uploaded images`);
        
        // Process images after we save the message (we need the message ID)
        // For now, just validate them
        const { images, validationResult: imgValidation } = await imageUploadHandler.processUploadedFiles(
          req.files, 
          conversationId, 
          null // Will be set after message is saved
        );
        
        processedImages = images;
        validationResult = imgValidation;

        if (!imgValidation.isValid) {
          console.log("[SSE] Image validation failed:", imgValidation.errors);
          res.write(`event: error\ndata: ${JSON.stringify({ 
            error: "Image validation failed", 
            details: imgValidation.errors 
          })}\n\n`);
          return res.end();
        }

        if (imgValidation.warnings.length > 0) {
          console.log("[SSE] Image validation warnings:", imgValidation.warnings);
          res.write(`event: warning\ndata: ${JSON.stringify({ 
            warnings: imgValidation.warnings 
          })}\n\n`);
        }
      }

    } catch (error) {
      console.error("[SSE] Error processing multipart request:", error);
      res.write(`event: error\ndata: ${JSON.stringify({ 
        error: "Error processing multipart request", 
        details: error.message 
      })}\n\n`);
      return res.end();
    }
  } else {
    // Handle regular JSON request
    model = req.body.model;
    message = req.body.message;
    conversationId = req.body.conversationId;
    password = req.body.password;

    if (!model || !message || !conversationId) {
      console.log("[SSE] Missing required parameters");
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Missing model, message, or conversationId" })}\n\n`);
      return res.end();
    }
  }

  // Initialize stream session tracking
  let streamSession = null;
  let sessionId = null;

  try {
    // Validate conversation access permissions
    const conversationQuery = `
      SELECT id, is_private, password_hash
      FROM conversations
      WHERE id = $1
    `;
    const conversationResult = await pool.query(conversationQuery, [conversationId]);
    
    if (conversationResult.rows.length === 0) {
      console.log("[SSE] Conversation not found:", conversationId);
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Conversation not found" })}\n\n`);
      return res.end();
    }

    const conversation = conversationResult.rows[0];

    // Check if conversation is private and password is required
    if (conversation.is_private) {
      if (!password) {
        console.log("[SSE] Password required for private conversation");
        res.write(`event: error\ndata: ${JSON.stringify({ error: "Password required for private conversation" })}\n\n`);
        return res.end();
      }

      // In a real implementation, you would hash and compare the password
      if (conversation.password_hash && password !== conversation.password_hash) {
        console.log("[SSE] Invalid password for private conversation");
        res.write(`event: error\ndata: ${JSON.stringify({ error: "Invalid password for private conversation" })}\n\n`);
        return res.end();
      }
    }

    const userMsgStart = Date.now();
    
    // Determine if message has images
    const hasImages = processedImages.length > 0;
    
    // Save user message to DB with has_images flag
    const userMsgQuery = `
      INSERT INTO messages (conversation_id, text, sender, has_images)
      VALUES ($1, $2, $3, $4)
      RETURNING id, conversation_id, text, sender, timestamp, has_images
    `;
    const userMsgResult = await pool.query(userMsgQuery, [conversationId, message, "user", hasImages]);
    const userMessage = userMsgResult.rows[0];
    console.log(`[SSE] User message saved in ${Date.now() - userMsgStart}ms`, userMessage);

    // Process images after message is saved (if any)
    if (hasImages && req.files && req.files.length > 0) {
      try {
        console.log(`[SSE] Processing ${req.files.length} images for message ${userMessage.id}`);
        
        // Process images with the actual message ID
        const { images, validationResult: imgValidation } = await imageUploadHandler.processUploadedFiles(
          req.files, 
          conversationId, 
          userMessage.id
        );
        
        processedImages = images;
        validationResult = imgValidation;

        if (!imgValidation.isValid) {
          console.log("[SSE] Image processing failed:", imgValidation.errors);
          res.write(`event: error\ndata: ${JSON.stringify({ 
            error: "Image processing failed", 
            details: imgValidation.errors 
          })}\n\n`);
          return res.end();
        }

        console.log(`[SSE] Successfully processed ${processedImages.length} images`);
        
        // Send image processing info to client
        res.write(`event: images\ndata: ${JSON.stringify({ 
          processed: processedImages.length,
          warnings: imgValidation.warnings || []
        })}\n\n`);

      } catch (error) {
        console.error("[SSE] Error processing images:", error);
        res.write(`event: error\ndata: ${JSON.stringify({ 
          error: "Error processing images", 
          details: error.message 
        })}\n\n`);
        return res.end();
      }
    }

    const historyStart = Date.now();
    // Fetch conversation history from DB (ordered by timestamp)
    const historyQuery = `
      SELECT text, sender
      FROM messages
      WHERE conversation_id = $1
      ORDER BY timestamp ASC
    `;
    const historyResult = await pool.query(historyQuery, [conversationId]);
    const conversationHistory = historyResult.rows;
    console.log(
      `[SSE] Conversation history fetched in ${Date.now() - historyStart}ms, count: ${conversationHistory.length}`
    );

    // Create stream session for tracking
    streamSession = createStreamSession(conversationId, model);
    sessionId = streamSession.id;
    
    // Register session with both database and memory manager
    await streamSessionDatabase.createSession(streamSession);
    streamSessionManager.createSession(conversationId, model);
    
    console.log(`[SSE] Created stream session: ${sessionId}`);

    // Send session ID to client for potential termination
    res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);

    // Stream LLM response with termination checking
    let assistantText = "";
    const llmStart = Date.now();
    let tokenCount = 0;
    
    // Create termination check function
    const checkTermination = async () => {
      try {
        const currentSession = await streamSessionDatabase.getSession(sessionId);
        return !currentSession || currentSession.status !== STREAM_STATUS.ACTIVE;
      } catch (error) {
        console.warn(`[SSE] Error checking termination: ${error.message}`);
        return false;
      }
    };
    
    // Prepare the request for Ollama
    let ollamaRequest = {
      model,
      message,
      conversationHistory,
      options: {},
      checkTermination
    };

    // If we have images and vision is supported, create vision message
    if (processedImages.length > 0) {
      try {
        const visionSupported = await visionModelService.supportsVision(model);
        
        if (visionSupported) {
          const visionMessage = await visionModelService.createVisionMessage(message, processedImages);
          ollamaRequest.visionMessage = visionMessage;
          console.log(`[SSE] Using vision message for model ${model}`);
        } else {
          console.log(`[SSE] Model ${model} does not support vision, using text-only message`);
        }
      } catch (error) {
        console.error("[SSE] Error creating vision message:", error);
        // Continue with text-only message
      }
    }

    for await (const token of ollamaService.streamResponse(
      ollamaRequest.model, 
      ollamaRequest.message, 
      ollamaRequest.conversationHistory, 
      ollamaRequest.options, 
      ollamaRequest.checkTermination,
      ollamaRequest.visionMessage
    )) {
      assistantText += token;
      tokenCount++;
      
      // Update session with new token
      await streamSessionDatabase.updateSessionWithToken(sessionId, token);
      
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    
    // Check if stream was terminated during processing
    const finalSession = await streamSessionDatabase.getSession(sessionId);
    if (!finalSession || finalSession.status !== STREAM_STATUS.ACTIVE) {
      console.log(`[SSE] Stream terminated after processing: ${sessionId}`);
      res.write(`event: terminated\ndata: ${JSON.stringify({ 
        sessionId,
        partialResponse: assistantText,
        tokenCount,
        reason: finalSession?.terminationReason || TERMINATION_REASON.USER_REQUESTED
      })}\n\n`);
      return res.end();
    }
    
    const llmDuration = Date.now() - llmStart;
    console.log(`[SSE] LLM streaming finished in ${llmDuration}ms, tokens: ${tokenCount}`);

    // Mark session as completed
    await streamSessionDatabase.completeSession(sessionId);
    streamSessionManager.completeSession(sessionId);

    const assistantMsgStart = Date.now();
    // Save assistant message to DB
    const assistantMsgQuery = `
      INSERT INTO messages (conversation_id, text, sender)
      VALUES ($1, $2, $3)
      RETURNING id, conversation_id, text, sender, timestamp
    `;
    const assistantMsgResult = await pool.query(assistantMsgQuery, [conversationId, assistantText, "llm"]);
    const assistantMessage = assistantMsgResult.rows[0];
    console.log(`[SSE] Assistant message saved in ${Date.now() - assistantMsgStart}ms`, assistantMessage);

    res.write("event: end\ndata: {}\n\n");
    res.end();
    console.log(`[SSE] /api/stream-message completed in ${Date.now() - apiStart}ms`);
    
  } catch (err) {
    console.error("[SSE] Error in /api/stream-message:", err);
    
    // Handle session cleanup on error
    if (sessionId) {
      try {
        await streamSessionDatabase.terminateSession(sessionId, TERMINATION_REASON.ERROR, err.message);
        streamSessionManager.terminateSession(sessionId, TERMINATION_REASON.ERROR);
        console.log(`[SSE] Session ${sessionId} terminated due to error`);
      } catch (cleanupError) {
        console.error("[SSE] Error during session cleanup:", cleanupError.message);
      }
    }
    
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// Stream termination endpoint
router.post("/terminate-stream", async (req, res) => {
  const apiStart = Date.now();
  console.log("[TERMINATE] /api/terminate-stream called", {
    time: new Date().toISOString(),
    body: req.body
  });

  const { sessionId, conversationId, password, reason } = req.body;

  // Validate required parameters
  if (!sessionId || !conversationId) {
    console.log("[TERMINATE] Missing required parameters");
    return res.status(400).json({
      success: false,
      error: "Missing required parameters: sessionId and conversationId",
      message: "Session ID and conversation ID are required"
    });
  }

  try {
    // Validate conversation access permissions
    const conversationQuery = `
      SELECT id, is_private, password_hash
      FROM conversations
      WHERE id = $1
    `;
    const conversationResult = await pool.query(conversationQuery, [conversationId]);
    
    if (conversationResult.rows.length === 0) {
      console.log("[TERMINATE] Conversation not found:", conversationId);
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
        message: "The specified conversation does not exist"
      });
    }

    const conversation = conversationResult.rows[0];

    // Check if conversation is private and password is required
    if (conversation.is_private) {
      if (!password) {
        console.log("[TERMINATE] Password required for private conversation");
        return res.status(401).json({
          success: false,
          error: "Password required",
          message: "This conversation is private and requires a password"
        });
      }

      // In a real implementation, you would hash and compare the password
      // For now, we'll do a simple comparison (this should be improved with proper hashing)
      if (conversation.password_hash && password !== conversation.password_hash) {
        console.log("[TERMINATE] Invalid password for private conversation");
        return res.status(401).json({
          success: false,
          error: "Invalid password",
          message: "Invalid password for this conversation"
        });
      }
    }

    // Get session from database
    const session = await streamSessionDatabase.getSession(sessionId);
    if (!session) {
      console.log("[TERMINATE] Session not found:", sessionId);
      return res.status(404).json({
        success: false,
        error: "Session not found",
        message: "The specified stream session does not exist"
      });
    }

    // Verify session belongs to the specified conversation
    if (session.conversationId !== conversationId) {
      console.log("[TERMINATE] Session conversation mismatch:", {
        sessionConversationId: session.conversationId,
        requestedConversationId: conversationId
      });
      return res.status(403).json({
        success: false,
        error: "Session conversation mismatch",
        message: "The session does not belong to the specified conversation"
      });
    }

    // Check if session is in a terminable state
    if (session.status !== 'ACTIVE') {
      console.log("[TERMINATE] Session not in terminable state:", session.status);
      return res.status(400).json({
        success: false,
        error: "Session not terminable",
        message: `Session is in ${session.status} state and cannot be terminated`,
        sessionStatus: session.status
      });
    }

    // Determine termination reason
    const terminationReason = reason || TERMINATION_REASON.USER_REQUESTED;

    // Terminate the session in the database
    const terminatedSession = await streamSessionDatabase.terminateSession(
      sessionId,
      terminationReason
    );

    if (!terminatedSession) {
      console.log("[TERMINATE] Failed to terminate session in database");
      return res.status(500).json({
        success: false,
        error: "Database termination failed",
        message: "Failed to terminate session in database"
      });
    }

    // Save partial response as a message in the conversation
    let savedMessage = null;
    if (terminatedSession.partialResponse && terminatedSession.partialResponse.trim()) {
      try {
        savedMessage = await streamSessionDatabase.savePartialResponseAsMessage(
          sessionId,
          conversationId,
          terminatedSession.partialResponse
        );
        console.log("[TERMINATE] Partial response saved as message:", savedMessage.id);
      } catch (error) {
        console.error("[TERMINATE] Failed to save partial response:", error.message);
        // Don't fail the termination if message saving fails
      }
    }

    // Terminate the session in the session manager (if it exists in memory)
    try {
      streamSessionManager.terminateSession(sessionId, terminationReason);
    } catch (error) {
      console.log("[TERMINATE] Session not found in memory manager (non-critical):", error.message);
    }

    const response = {
      success: true,
      sessionId: sessionId,
      message: "Stream terminated successfully",
      partialResponse: terminatedSession.partialResponse,
      tokenCount: terminatedSession.tokenCount,
      finalStatus: terminatedSession.status,
      terminationReason: terminationReason,
      savedMessageId: savedMessage ? savedMessage.id : null,
      timestamp: new Date().toISOString()
    };

    console.log("[TERMINATE] Stream termination successful:", {
      sessionId,
      conversationId,
      tokenCount: terminatedSession.tokenCount,
      responseLength: terminatedSession.partialResponse.length,
      duration: Date.now() - apiStart
    });

    res.json(response);

  } catch (error) {
    console.error("[TERMINATE] Error in /api/terminate-stream:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "An error occurred while terminating the stream",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

export default router;
