/**
 * Database Setup Script for Stream Session Tests
 * 
 * This script creates test conversations in the database
 * to support stream session testing.
 */

import pool from "../../config/database.js";

console.log('🔄 Setting up test database data...');

const testConversations = [
  {
    id: 'conv-db-test-123',
    tab_name: 'Test Conversation 123',
    llm_model: 'llama3.1:8b',
    is_private: false
  },
  {
    id: 'conv-db-test-456',
    tab_name: 'Test Conversation 456',
    llm_model: 'mistral:7b',
    is_private: false
  },
  {
    id: 'conv-expire-test',
    tab_name: 'Expire Test Conversation',
    llm_model: 'test-model',
    is_private: false
  },
  {
    id: 'conv-message-test',
    tab_name: 'Message Test Conversation',
    llm_model: 'llama3.1:8b',
    is_private: false
  },
  {
    id: 'conv-delete-test',
    tab_name: 'Delete Test Conversation',
    llm_model: 'test-model',
    is_private: false
  }
];

// Add concurrent test conversations
for (let i = 0; i < 5; i++) {
  testConversations.push({
    id: `conv-concurrent-${i}`,
    tab_name: `Concurrent Test ${i}`,
    llm_model: 'test-model',
    is_private: false
  });
}

async function setupTestData() {
  try {
    // Create test conversations
    for (const conversation of testConversations) {
      const query = `
        INSERT INTO conversations (id, tab_name, llm_model, is_private)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          tab_name = EXCLUDED.tab_name,
          llm_model = EXCLUDED.llm_model,
          is_private = EXCLUDED.is_private
      `;
      
      await pool.query(query, [
        conversation.id,
        conversation.tab_name,
        conversation.llm_model,
        conversation.is_private
      ]);
      
      console.log(`✅ Created/updated conversation: ${conversation.id}`);
    }
    
    console.log('✅ Test database setup completed successfully');
  } catch (error) {
    console.error('❌ Error setting up test data:', error.message);
    throw error;
  }
}

// Run setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestData()
    .then(() => {
      console.log('🎉 Database setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database setup failed:', error.message);
      process.exit(1);
    });
}

export default setupTestData; 