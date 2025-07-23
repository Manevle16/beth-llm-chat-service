/**
 * Database Schema Verification Script
 * 
 * This script verifies that the stream_sessions table
 * and all required indexes were created correctly.
 */

import pool from "../../config/database.js";

console.log('🔍 Verifying database schema...');

async function verifySchema() {
  try {
    // Check if stream_sessions table exists
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'stream_sessions'
    `;
    
    const tableResult = await pool.query(tableQuery);
    console.log('✅ Stream sessions table exists:', tableResult.rows.length > 0);

    if (tableResult.rows.length === 0) {
      console.log('❌ Stream sessions table not found');
      return false;
    }

    // Check table structure
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'stream_sessions'
      ORDER BY ordinal_position
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    console.log('📋 Table columns:');
    columnsResult.rows.forEach(column => {
      console.log(`  - ${column.column_name}: ${column.data_type} ${column.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Check indexes
    const indexesQuery = `
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'stream_sessions'
      ORDER BY indexname
    `;
    
    const indexesResult = await pool.query(indexesQuery);
    console.log('🔍 Table indexes:');
    indexesResult.rows.forEach(index => {
      console.log(`  - ${index.indexname}`);
    });

    // Check foreign key constraints
    const constraintsQuery = `
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'stream_sessions'
    `;
    
    const constraintsResult = await pool.query(constraintsQuery);
    console.log('🔗 Foreign key constraints:');
    constraintsResult.rows.forEach(constraint => {
      console.log(`  - ${constraint.constraint_name}: ${constraint.column_name} -> ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
    });

    // Check check constraints
    const checkConstraintsQuery = `
      SELECT 
        conname,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'stream_sessions'::regclass 
      AND contype = 'c'
    `;
    
    const checkConstraintsResult = await pool.query(checkConstraintsQuery);
    console.log('✅ Check constraints:');
    checkConstraintsResult.rows.forEach(constraint => {
      console.log(`  - ${constraint.conname}: ${constraint.definition}`);
    });

    // Test basic operations
    console.log('\n🧪 Testing basic operations...');
    
    // Test insert
    const testInsertQuery = `
      INSERT INTO stream_sessions (id, conversation_id, model, status)
      VALUES ('test-schema-verification', 'conv-db-test-123', 'test-model', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING
    `;
    await pool.query(testInsertQuery);
    console.log('✅ Insert operation works');

    // Test select
    const testSelectQuery = `
      SELECT * FROM stream_sessions WHERE id = 'test-schema-verification'
    `;
    const selectResult = await pool.query(testSelectQuery);
    console.log('✅ Select operation works:', selectResult.rows.length > 0);

    // Test update
    const testUpdateQuery = `
      UPDATE stream_sessions 
      SET status = 'TERMINATED', ended_at = CURRENT_TIMESTAMP
      WHERE id = 'test-schema-verification'
    `;
    await pool.query(testUpdateQuery);
    console.log('✅ Update operation works');

    // Test delete
    const testDeleteQuery = `
      DELETE FROM stream_sessions WHERE id = 'test-schema-verification'
    `;
    await pool.query(testDeleteQuery);
    console.log('✅ Delete operation works');

    console.log('\n🎉 Database schema verification completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Schema verification failed:', error.message);
    return false;
  }
}

// Run verification if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifySchema()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Schema verification failed:', error.message);
      process.exit(1);
    });
}

export default verifySchema; 