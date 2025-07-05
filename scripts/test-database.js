#!/usr/bin/env node

const { Pool } = require("pg");
require("dotenv").config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || "beth",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "beth_chat_service",
  password: process.env.DB_PASSWORD || "8826",
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
};

console.log("🔍 Testing PostgreSQL Database Connection...");
console.log("📊 Configuration:");
console.log(`   Host: ${dbConfig.host}`);
console.log(`   Port: ${dbConfig.port}`);
console.log(`   Database: ${dbConfig.database}`);
console.log(`   User: ${dbConfig.user}`);
console.log(`   SSL: ${dbConfig.ssl ? "enabled" : "disabled"}`);
console.log("");

// Create a new pool
const pool = new Pool(dbConfig);

async function testDatabaseConnection() {
  try {
    console.log("🔌 Testing basic connection...");

    // Test basic connection
    const client = await pool.connect();
    console.log("✅ Database connection successful!");

    // Test query execution
    const result = await client.query("SELECT version()");
    console.log("✅ Query execution successful!");
    console.log(
      `📋 PostgreSQL Version: ${result.rows[0].version.split(" ")[0]} ${result.rows[0].version.split(" ")[1]}`
    );

    client.release();
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    return false;
  }
}

async function testTableExistence() {
  try {
    console.log("\n📋 Testing table existence...");

    const client = await pool.connect();

    // Check if conversations table exists
    const conversationsTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'conversations'
      );
    `;

    const conversationsResult = await client.query(conversationsTableQuery);
    const conversationsExists = conversationsResult.rows[0].exists;

    if (conversationsExists) {
      console.log("✅ Conversations table exists");

      // Get table structure
      const conversationsStructureQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'conversations'
        ORDER BY ordinal_position;
      `;

      const structureResult = await client.query(conversationsStructureQuery);
      console.log("📊 Conversations table structure:");
      structureResult.rows.forEach((row) => {
        console.log(
          `   ${row.column_name}: ${row.data_type} ${row.is_nullable === "NO" ? "(NOT NULL)" : ""} ${
            row.column_default ? `DEFAULT ${row.column_default}` : ""
          }`
        );
      });
    } else {
      console.log("❌ Conversations table does not exist");
    }

    // Check if messages table exists
    const messagesTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'messages'
      );
    `;

    const messagesResult = await client.query(messagesTableQuery);
    const messagesExists = messagesResult.rows[0].exists;

    if (messagesExists) {
      console.log("✅ Messages table exists");

      // Get table structure
      const messagesStructureQuery = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'messages'
        ORDER BY ordinal_position;
      `;

      const structureResult = await client.query(messagesStructureQuery);
      console.log("📊 Messages table structure:");
      structureResult.rows.forEach((row) => {
        console.log(
          `   ${row.column_name}: ${row.data_type} ${row.is_nullable === "NO" ? "(NOT NULL)" : ""} ${
            row.column_default ? `DEFAULT ${row.column_default}` : ""
          }`
        );
      });
    } else {
      console.log("❌ Messages table does not exist");
    }

    client.release();
    return conversationsExists && messagesExists;
  } catch (error) {
    console.error("❌ Table existence check failed:", error.message);
    return false;
  }
}

async function getDatabaseStats() {
  try {
    console.log("\n📊 Database Statistics:");

    const client = await pool.connect();

    // Get conversation count
    const conversationCount = await client.query("SELECT COUNT(*) as count FROM conversations");
    console.log(`   Conversations: ${conversationCount.rows[0].count}`);

    // Get message count
    const messageCount = await client.query("SELECT COUNT(*) as count FROM messages");
    console.log(`   Messages: ${messageCount.rows[0].count}`);

    // Get database size
    const dbSize = await client.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`   Database size: ${dbSize.rows[0].size}`);

    // Get table sizes
    const tableSizes = await client.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `);

    console.log("   Table sizes:");
    tableSizes.rows.forEach((row) => {
      console.log(`     ${row.tablename}: ${row.size}`);
    });

    client.release();
    return true;
  } catch (error) {
    console.error("❌ Database statistics failed:", error.message);
    return false;
  }
}

async function runAllTests() {
  console.log("🚀 Starting PostgreSQL Database Tests\n");

  const results = {
    connection: false,
    tables: false,
    stats: false
  };

  // Test 1: Basic connection
  results.connection = await testDatabaseConnection();

  if (results.connection) {
    // Test 2: Table existence
    results.tables = await testTableExistence();

    if (results.tables) {
      // Test 3: Database statistics
      results.stats = await getDatabaseStats();
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📋 TEST SUMMARY");
  console.log("=".repeat(50));
  console.log(`🔌 Database Connection: ${results.connection ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`📋 Table Existence: ${results.tables ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`📊 Statistics: ${results.stats ? "✅ PASS" : "❌ FAIL"}`);

  const allPassed = Object.values(results).every((result) => result);
  console.log(`\n🎯 Overall Result: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);

  if (allPassed) {
    console.log("🎉 Database is ready for use!");
  } else {
    console.log("⚠️ Please check the failed tests above and fix any issues.");
  }

  // Close the pool
  await pool.end();

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Handle script execution
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error("💥 Test script failed:", error);
    process.exit(1);
  });
}

module.exports = {
  testDatabaseConnection,
  testTableExistence,
  getDatabaseStats,
  runAllTests
};
