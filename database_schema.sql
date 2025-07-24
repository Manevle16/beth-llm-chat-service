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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    has_images BOOLEAN DEFAULT FALSE
);

-- Images table - stores image metadata and file information
CREATE TABLE images (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Stream Sessions table - stores active streaming sessions
CREATE TABLE stream_sessions (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'TERMINATED', 'ERROR')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    partial_response TEXT DEFAULT '',
    token_count INTEGER DEFAULT 0,
    termination_reason VARCHAR(30) CHECK (termination_reason IN ('USER_REQUESTED', 'TIMEOUT', 'ERROR', 'SERVER_SHUTDOWN')),
    error_message TEXT,
    timeout_ms INTEGER DEFAULT 300000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_has_images ON messages(has_images);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX idx_conversations_is_private ON conversations(is_private);

-- Indexes for images table
CREATE INDEX idx_images_conversation_id ON images(conversation_id);
CREATE INDEX idx_images_message_id ON images(message_id);
CREATE INDEX idx_images_content_hash ON images(content_hash);
CREATE INDEX idx_images_created_at ON images(created_at);
CREATE INDEX idx_images_expires_at ON images(expires_at);
CREATE INDEX idx_images_deleted_at ON images(deleted_at);
CREATE INDEX idx_images_expired ON images(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_images_file_path ON images(file_path);

-- Indexes for stream sessions
CREATE INDEX idx_stream_sessions_conversation_id ON stream_sessions(conversation_id);
CREATE INDEX idx_stream_sessions_status ON stream_sessions(status);
CREATE INDEX idx_stream_sessions_started_at ON stream_sessions(started_at);
CREATE INDEX idx_stream_sessions_updated_at ON stream_sessions(updated_at);
CREATE INDEX idx_stream_sessions_ended_at ON stream_sessions(ended_at);
CREATE INDEX idx_stream_sessions_expired ON stream_sessions(started_at) WHERE status = 'ACTIVE';

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

-- Trigger to update message has_images flag when images are added/removed
CREATE OR REPLACE FUNCTION update_message_has_images()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE messages 
        SET has_images = TRUE 
        WHERE id = NEW.message_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Check if there are any remaining images for this message
        IF NOT EXISTS (SELECT 1 FROM images WHERE message_id = OLD.message_id AND deleted_at IS NULL) THEN
            UPDATE messages 
            SET has_images = FALSE 
            WHERE id = OLD.message_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_message_has_images
    AFTER INSERT OR DELETE ON images
    FOR EACH ROW
    EXECUTE FUNCTION update_message_has_images();

-- Function to clean up expired images
CREATE OR REPLACE FUNCTION cleanup_expired_images()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE images 
    SET deleted_at = CURRENT_TIMESTAMP 
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND deleted_at IS NULL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

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