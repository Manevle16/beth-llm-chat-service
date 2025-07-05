-- Database schema for Beth LLM Chat Service
-- PostgreSQL tables for conversations and messages

-- Conversations table - stores conversation metadata
CREATE TABLE conversations (
    id VARCHAR(255) PRIMARY KEY,
    tab_name VARCHAR(255) NOT NULL,
    llm_model VARCHAR(100) DEFAULT 'llama3.1:8b',
    is_private BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages table - stores individual messages within conversations
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sender VARCHAR(50) NOT NULL CHECK (sender IN ('user', 'llm')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX idx_conversations_is_private ON conversations(is_private);

-- Trigger to update the updated_at timestamp when messages are added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT OR UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Sample data insertion (optional - for testing)
-- INSERT INTO conversations (id, tab_name, llm_model, is_private, password_hash) VALUES 
--     ('conversation-123', 'Conversation 1', 'gpt-3.5-turbo', FALSE, NULL),
--     ('conversation-456', 'Conversation 2', 'gpt-4', TRUE, '$2b$10$hashedpasswordhere'),
--     ('conversation-789', 'Private Chat', 'llama3.1:8b', TRUE, '$2b$10$anotherhashedpassword');

-- INSERT INTO messages (conversation_id, text, sender) VALUES
--     ('conversation-123', 'Hello, how are you?', 'user'),
--     ('conversation-123', 'I''m good, thanks!', 'llm'),
--     ('conversation-456', 'What is the meaning of life?', 'user'),
--     ('conversation-456', 'It''s a complex question.', 'llm'); 