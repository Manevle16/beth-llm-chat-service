const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Create SSL directory if it doesn't exist
const sslDir = path.join(__dirname, "../ssl");
if (!fs.existsSync(sslDir)) {
  fs.mkdirSync(sslDir, { recursive: true });
}

console.log("🔐 Generating self-signed SSL certificates for development...");

try {
  // Generate private key
  console.log("📝 Generating private key...");
  execSync(`openssl genrsa -out ${sslDir}/dev-key.pem 2048`, { stdio: "inherit" });

  // Generate certificate signing request
  console.log("📋 Generating certificate signing request...");
  execSync(
    `openssl req -new -key ${sslDir}/dev-key.pem -out ${sslDir}/dev-csr.pem -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"`,
    { stdio: "inherit" }
  );

  // Generate self-signed certificate
  console.log("🏷️  Generating self-signed certificate...");
  execSync(
    `openssl x509 -req -in ${sslDir}/dev-csr.pem -signkey ${sslDir}/dev-key.pem -out ${sslDir}/dev-cert.pem -days 365`,
    { stdio: "inherit" }
  );

  // Clean up CSR file
  fs.unlinkSync(`${sslDir}/dev-csr.pem`);

  console.log("✅ SSL certificates generated successfully!");
  console.log(`📁 Certificates saved to: ${sslDir}`);
  console.log("");
  console.log("🚀 To start the server with HTTPS:");
  console.log("   npm run dev:https");
  console.log("");
  console.log("⚠️  Note: Self-signed certificates will show security warnings in browsers.");
  console.log("   This is normal for development. Accept the certificate to proceed.");
} catch (error) {
  console.error("❌ Error generating SSL certificates:", error.message);
  console.log("");
  console.log("💡 Make sure OpenSSL is installed on your system:");
  console.log("   Ubuntu/Debian: sudo apt-get install openssl");
  console.log("   macOS: brew install openssl");
  console.log("   Windows: Download from https://slproweb.com/products/Win32OpenSSL.html");
  process.exit(1);
}
