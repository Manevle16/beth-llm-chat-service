import express from "express";
import ollamaService from "../services/ollamaService.js";
import pool from "../config/database.js";
const router = express.Router();

// SSE endpoint for streaming LLM responses
router.post("/stream-message", async (req, res) => {
  const apiStart = Date.now();
  console.log("[SSE] /api/stream-message called", {
    time: new Date().toISOString(),
    body: req.body
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const { model, message, conversationId, password } = req.body;
  if (!model || !message || !conversationId) {
    console.log("[SSE] Missing required parameters");
    res.write(`event: error\ndata: ${JSON.stringify({ error: "Missing model, message, or conversationId" })}\n\n`);
    return res.end();
  }

  try {
    const userMsgStart = Date.now();
    // Save user message to DB
    const userMsgQuery = `
      INSERT INTO messages (conversation_id, text, sender)
      VALUES ($1, $2, $3)
      RETURNING id, conversation_id, text, sender, timestamp
    `;
    const userMsgResult = await pool.query(userMsgQuery, [conversationId, message, "user"]);
    const userMessage = userMsgResult.rows[0];
    console.log(`[SSE] User message saved in ${Date.now() - userMsgStart}ms`, userMessage);

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

    // Stream LLM response
    let assistantText = "";
    const llmStart = Date.now();
    let tokenCount = 0;
    for await (const token of ollamaService.streamResponse(model, message, conversationHistory)) {
      assistantText += token;
      tokenCount++;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    const llmDuration = Date.now() - llmStart;
    console.log(`[SSE] LLM streaming finished in ${llmDuration}ms, tokens: ${tokenCount}`);

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
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

export default router;
