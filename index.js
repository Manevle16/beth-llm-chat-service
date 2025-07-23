import express from "express";
import { ApolloServer } from "apollo-server-express";
import cors from "cors";
import https from "https";
import http from "http";
import dotenv from "dotenv";
dotenv.config();

import typeDefs from "./schema/typeDefs.js";
import resolvers from "./schema/resolvers.js";
import { getSSLOptions, isHTTPSEnabled } from "./config/ssl.js";
import streamRoutes from "./routes/stream.js";
import streamSessionManager from "./services/streamSessionManager.js";
import streamSessionDatabase from "./services/streamSessionDatabase.js";
import ollamaService from "./services/ollamaService.js";

const app = express();
const PORT = process.env.PORT || 4000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://localhost:3004",
    "http://localhost:3005",
    "https://localhost:3000",
    "https://localhost:3001",
    "https://localhost:3002",
    "https://localhost:3003",
    "https://localhost:3004",
    "https://localhost:3005"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

// Middleware
app.use(cors(corsOptions));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  console.log(`   Headers:`, req.headers);
  if (req.body) {
    console.log(`   Body:`, JSON.stringify(req.body, null, 2));
  }
  next();
});

// Enhanced body parsing with error handling
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        console.error("❌ Invalid JSON in request body");
        throw new Error("Invalid JSON");
      }
    }
  })
);

app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Beth LLM Chat Service!",
    graphqlEndpoint: "/graphql",
    playground: "/graphql",
    protocol: isHTTPSEnabled() ? "HTTPS" : "HTTP",
    httpsEnabled: isHTTPSEnabled()
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    protocol: isHTTPSEnabled() ? "HTTPS" : "HTTP"
  });
});

// Test POST endpoint for debugging
app.post("/test", (req, res) => {
  console.log("✅ Test endpoint reached");
  console.log("📝 Request body:", req.body);
  res.json({
    message: "Test endpoint working",
    receivedBody: req.body,
    headers: req.headers
  });
});

// API routes
app.use("/api", streamRoutes);

// Service initialization
async function initializeServices() {
  try {
    console.log("🔧 Initializing services...");
    
    // Initialize stream session services
    await streamSessionDatabase.initialize();
    await streamSessionManager.initialize();
    
    // Initialize Ollama service (this will also initialize model rotation if enabled)
    await ollamaService.initialize();
    
    // Clean up any orphaned sessions from previous server runs
    console.log("🧹 Cleaning up orphaned sessions from previous runs...");
    try {
      const orphanedSessions = await streamSessionDatabase.getExpiredSessions();
      if (orphanedSessions.length > 0) {
        console.log(`📊 Found ${orphanedSessions.length} orphaned sessions, cleaning up...`);
        await streamSessionDatabase.cleanupExpiredSessions();
        console.log("✅ Orphaned sessions cleaned up successfully");
      } else {
        console.log("✅ No orphaned sessions found");
      }
    } catch (cleanupError) {
      console.warn("⚠️  Session cleanup failed (non-critical):", cleanupError.message);
    }
    
    console.log("✅ All services initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize services:", error);
    throw error;
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Shutdown stream session manager (this will terminate all active sessions)
    console.log("🔄 Shutting down Stream Session Manager...");
    await streamSessionManager.shutdown();
    console.log("✅ Stream Session Manager shutdown complete");
    
    // Note: Other services don't have explicit shutdown methods yet
    // They will be cleaned up by the process exit
    
    console.log("✅ Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during graceful shutdown:", error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Apollo Server setup
async function startApolloServer() {
  try {
    console.log("🔧 Starting Apollo Server...");

    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req }) => {
        // You can add authentication context here if needed
        console.log("🔍 GraphQL Context - Request method:", req.method);
        console.log("🔍 GraphQL Context - Request URL:", req.url);
        return { req };
      },
      formatError: (error) => {
        console.error("GraphQL Error:", error);
        return {
          message: error.message,
          path: error.path,
          extensions: error.extensions
        };
      },
      introspection: true, // Enable GraphQL Playground
      playground: {
        settings: {
          "editor.theme": "dark",
          "editor.reuseHeaders": true
        }
      },
      // Add debugging for Apollo Server
      debug: true
    });

    console.log("🚀 Starting Apollo Server...");
    await server.start();
    console.log("✅ Apollo Server started successfully");

    // Add specific middleware for GraphQL endpoint
    app.use("/graphql", (req, res, next) => {
      console.log("🔍 GraphQL middleware - Request received");
      console.log("   Method:", req.method);
      console.log("   Content-Type:", req.headers["content-type"]);
      console.log("   Body length:", req.body ? JSON.stringify(req.body).length : "no body");

      // Ensure body is parsed before reaching Apollo Server
      if (req.method === "POST" && req.headers["content-type"]?.includes("application/json")) {
        if (!req.body) {
          console.error("❌ No body found in GraphQL request");
          return res.status(400).json({ error: "No request body found" });
        }
        console.log("✅ GraphQL request body parsed successfully");
      }

      next();
    });

    server.applyMiddleware({
      app,
      path: "/graphql",
      bodyParserConfig: false // Disable Apollo's body parsing since Express handles it
    });
    console.log("✅ GraphQL middleware applied");

    // Error handling middleware (after Apollo Server)
    app.use((err, req, res, next) => {
      console.error("❌ Server Error:", err.stack);
      res.status(500).json({
        error: "Something went wrong!",
        details: process.env.NODE_ENV === "development" ? err.message : undefined
      });
    });

    // 404 handler (after Apollo Server)
    app.use((req, res) => {
      console.log(`❌ 404 - Endpoint not found: ${req.method} ${req.url}`);
      res.status(404).json({ error: "Endpoint not found" });
    });

    // Initialize all services before starting the server
    await initializeServices();

    // Start server based on configuration
    const httpsEnabled = isHTTPSEnabled();
    console.log(`🔧 HTTPS enabled: ${httpsEnabled}`);

    if (httpsEnabled) {
      console.log("🔒 Setting up HTTPS server...");
      const sslOptions = getSSLOptions();

      if (sslOptions) {
        console.log("✅ SSL options loaded successfully");
        // Start HTTPS server
        const httpsServer = https.createServer(sslOptions, app);
        httpsServer.listen(HTTPS_PORT, () => {
          console.log(`🚀 HTTPS Server is running on port ${HTTPS_PORT}`);
          console.log(`📊 GraphQL endpoint: https://localhost:${HTTPS_PORT}${server.graphqlPath}`);
          console.log(`🎮 GraphQL Playground: https://localhost:${HTTPS_PORT}${server.graphqlPath}`);
          console.log(`🏥 Health check: https://localhost:${HTTPS_PORT}/health`);
          console.log(`🔒 Protocol: HTTPS (SSL/TLS enabled)`);
        });

        // Add error handling for HTTPS server
        httpsServer.on("error", (error) => {
          console.error("❌ HTTPS Server Error:", error);
        });
      } else {
        console.error("❌ HTTPS requested but SSL certificates not available");
        console.log("💡 Run: npm run generate-ssl to create development certificates");
        console.log("💡 Or set SSL_KEY_PATH and SSL_CERT_PATH for production");
        process.exit(1);
      }
    } else {
      console.log("🌐 Setting up HTTP server...");
      // Start HTTP server
      const httpServer = http.createServer(app);
      httpServer.listen(PORT, () => {
        console.log(`🚀 HTTP Server is running on port ${PORT}`);
        console.log(`📊 GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
        console.log(`🎮 GraphQL Playground: http://localhost:${PORT}${server.graphqlPath}`);
        console.log(`🏥 Health check: http://localhost:${PORT}/health`);
        console.log(`🌐 Protocol: HTTP`);
      });

      // Add error handling for HTTP server
      httpServer.on("error", (error) => {
        console.error("❌ HTTP Server Error:", error);
      });
    }
  } catch (error) {
    console.error("❌ Failed to start Apollo Server:", error);
    process.exit(1);
  }
}

startApolloServer().catch(console.error);
