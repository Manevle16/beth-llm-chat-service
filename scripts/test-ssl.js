const fs = require("fs");
const path = require("path");

console.log("🔍 Testing SSL Configuration...\n");

// Check if SSL directory exists
const sslDir = path.join(__dirname, "../ssl");
console.log(`📁 SSL Directory: ${sslDir}`);
console.log(`   Exists: ${fs.existsSync(sslDir) ? "✅ Yes" : "❌ No"}`);

if (fs.existsSync(sslDir)) {
  // Check for certificate files
  const keyPath = path.join(sslDir, "dev-key.pem");
  const certPath = path.join(sslDir, "dev-cert.pem");

  console.log(`\n🔑 Private Key: ${keyPath}`);
  console.log(`   Exists: ${fs.existsSync(keyPath) ? "✅ Yes" : "❌ No"}`);

  console.log(`\n🏷️  Certificate: ${certPath}`);
  console.log(`   Exists: ${fs.existsSync(certPath) ? "✅ Yes" : "❌ No"}`);

  // Try to read the files
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    try {
      const key = fs.readFileSync(keyPath);
      const cert = fs.readFileSync(certPath);

      console.log("\n✅ SSL files can be read successfully");
      console.log(`   Key size: ${key.length} bytes`);
      console.log(`   Cert size: ${cert.length} bytes`);

      // Test SSL configuration
      console.log("\n🧪 Testing SSL configuration...");
      const { getSSLOptions, isHTTPSEnabled } = require("../config/ssl");

      // Simulate the same conditions as the server
      const originalArgv = process.argv;
      const originalEnv = process.env;

      // Test different scenarios
      console.log("\n📋 Testing different HTTPS scenarios:");

      // Scenario 1: No HTTPS flags
      console.log("\n1️⃣  Default (no flags):");
      console.log(`   HTTPS enabled: ${isHTTPSEnabled()}`);

      // Scenario 2: With --https flag
      process.argv = [...originalArgv, "--https"];
      console.log("\n2️⃣  With --https flag:");
      console.log(`   HTTPS enabled: ${isHTTPSEnabled()}`);

      // Scenario 3: With FORCE_HTTPS environment variable
      process.argv = originalArgv;
      process.env.FORCE_HTTPS = "true";
      console.log("\n3️⃣  With FORCE_HTTPS=true:");
      console.log(`   HTTPS enabled: ${isHTTPSEnabled()}`);

      // Reset to original state
      process.argv = originalArgv;
      process.env = originalEnv;

      // Test SSL options for each scenario
      console.log("\n🔐 Testing SSL options:");

      // Test with --https flag
      process.argv = [...originalArgv, "--https"];
      try {
        const sslOptions = getSSLOptions();
        if (sslOptions) {
          console.log("   SSL options with --https: ✅ Valid");
          console.log(`   Key type: ${typeof sslOptions.key}`);
          console.log(`   Cert type: ${typeof sslOptions.cert}`);
        } else {
          console.log("   SSL options with --https: ❌ Null/Invalid");
        }
      } catch (error) {
        console.log(`   SSL options with --https: ❌ Error - ${error.message}`);
      }

      // Reset
      process.argv = originalArgv;
    } catch (error) {
      console.log(`❌ Error reading SSL files: ${error.message}`);
    }
  } else {
    console.log("\n❌ SSL certificate files are missing");
    console.log("💡 Run: npm run generate-ssl to create them");
  }
} else {
  console.log("\n❌ SSL directory does not exist");
  console.log("💡 Run: npm run generate-ssl to create it");
}

// Check environment variables
console.log("\n🌍 Environment Variables:");
console.log(`   NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
console.log(`   FORCE_HTTPS: ${process.env.FORCE_HTTPS || "not set"}`);
console.log(`   HTTPS_PORT: ${process.env.HTTPS_PORT || "not set"}`);
console.log(`   SSL_KEY_PATH: ${process.env.SSL_KEY_PATH || "not set"}`);
console.log(`   SSL_CERT_PATH: ${process.env.SSL_CERT_PATH || "not set"}`);

// Check command line arguments
console.log("\n📝 Command Line Arguments:");
console.log(`   --https flag: ${process.argv.includes("--https") ? "✅ Present" : "❌ Not present"}`);
console.log(`   Full args: ${process.argv.join(" ")}`);

console.log("\n🎯 Recommendations:");
if (!fs.existsSync(sslDir) || !fs.existsSync(path.join(sslDir, "dev-key.pem"))) {
  console.log("   1. Run: npm run generate-ssl");
}
if (!process.argv.includes("--https")) {
  console.log("   2. Start with: npm run dev:https");
}
console.log("   3. Check server logs for detailed error messages");
