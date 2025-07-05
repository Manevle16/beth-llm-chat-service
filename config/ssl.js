const fs = require("fs");
const path = require("path");

// SSL configuration for HTTPS
const sslConfig = {
  // Development SSL certificates (self-signed) - lazy loaded
  dev: {
    get key() {
      return fs.readFileSync(path.join(__dirname, "../ssl/dev-key.pem"));
    },
    get cert() {
      return fs.readFileSync(path.join(__dirname, "../ssl/dev-cert.pem"));
    }
  },

  // Production SSL certificates (from environment variables) - lazy loaded
  prod: {
    get key() {
      return process.env.SSL_KEY_PATH ? fs.readFileSync(process.env.SSL_KEY_PATH) : null;
    },
    get cert() {
      return process.env.SSL_CERT_PATH ? fs.readFileSync(process.env.SSL_CERT_PATH) : null;
    }
  }
};

// Function to get SSL options based on environment
function getSSLOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  const useHTTPS = process.argv.includes("--https") || process.env.FORCE_HTTPS === "true";

  if (!useHTTPS) {
    return null;
  }

  if (isProduction) {
    // Production: Use certificates from environment variables
    if (!sslConfig.prod.key || !sslConfig.prod.cert) {
      console.warn("⚠️  Production HTTPS requested but SSL certificates not found in environment variables");
      console.warn("   Set SSL_KEY_PATH and SSL_CERT_PATH environment variables");
      return null;
    }
    return sslConfig.prod;
  } else {
    // Development: Use self-signed certificates
    try {
      return sslConfig.dev;
    } catch (error) {
      console.warn("⚠️  Development HTTPS requested but SSL certificates not found");
      console.warn("   Run: npm run generate-ssl to create development certificates");
      return null;
    }
  }
}

// Function to check if HTTPS is enabled
function isHTTPSEnabled() {
  return process.argv.includes("--https") || process.env.FORCE_HTTPS === "true";
}

module.exports = {
  getSSLOptions,
  isHTTPSEnabled
};
