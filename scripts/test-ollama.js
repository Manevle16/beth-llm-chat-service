const { Ollama } = require("ollama");

console.log("🔍 Testing Ollama Connection...\n");

const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || "http://localhost:11434"
});

async function testOllama() {
  try {
    console.log(`🌐 Connecting to Ollama at: ${ollama.host}`);

    // Test 1: List models
    console.log("\n1️⃣  Testing model listing...");
    const models = await ollama.list();
    console.log("✅ Ollama is running and accessible");
    console.log(`📊 Available models: ${models.models.length}`);

    if (models.models.length > 0) {
      console.log("📋 Models:");
      models.models.forEach((model) => {
        console.log(`   - ${model.name} (${model.size})`);
      });
    } else {
      console.log("⚠️  No models installed");
      console.log("💡 Install a model with: ollama pull llama3.1:8b");
    }

    // Test 2: Try a simple chat (if models exist)
    if (models.models.length > 0) {
      console.log("\n2️⃣  Testing chat functionality...");
      const testModel = models.models[0].name;
      console.log(`🤖 Using model: ${testModel}`);

      try {
        const response = await ollama.chat({
          model: testModel,
          messages: [{ role: "user", content: "Hello, are you working?" }],
          stream: false
        });

        console.log("✅ Chat test successful");
        console.log(`📝 Response: ${response.message.content.substring(0, 100)}...`);
      } catch (chatError) {
        console.log("❌ Chat test failed");
        console.log(`   Error: ${chatError.message}`);
      }
    }
  } catch (error) {
    console.error("❌ Ollama connection failed");
    console.error(`   Error: ${error.message}`);
    console.log("\n🔧 Troubleshooting:");
    console.log("   1. Make sure Ollama is installed: https://ollama.ai/download");
    console.log("   2. Start Ollama service: ollama serve");
    console.log("   3. Check if port 11434 is available");
    console.log("   4. Try: curl http://localhost:11434/api/tags");
  }
}

testOllama().catch(console.error);
