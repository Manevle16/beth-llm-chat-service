-- Database schema for Beth LLM Chat Service with Provider Support
-- PostgreSQL tables for conversations, messages, and multi-provider model management

-- Provider configurations table - stores provider-specific settings
CREATE TABLE provider_configs (
    id SERIAL PRIMARY KEY,
    provider_name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Model metadata table - stores provider-specific model information
CREATE TABLE model_metadata (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,
    provider_name VARCHAR(50) NOT NULL REFERENCES provider_configs(provider_name),
    display_name VARCHAR(255),
    description TEXT,
    capabilities JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_name, provider_name)
);

-- Conversations table - stores conversation metadata with provider support
CREATE TABLE conversations (
    id VARCHAR(255) PRIMARY KEY,
    tab_name VARCHAR(255) NOT NULL,
    llm_model VARCHAR(100) DEFAULT 'llama3.1:8b',
    model_provider VARCHAR(50) DEFAULT 'ollama',
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

-- Stream Sessions table - stores active streaming sessions with provider support
CREATE TABLE stream_sessions (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    model_provider VARCHAR(50) DEFAULT 'ollama',
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

-- Model usage statistics table - tracks usage across providers
CREATE TABLE model_usage_stats (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,
    provider_name VARCHAR(50) NOT NULL,
    conversation_id VARCHAR(255) REFERENCES conversations(id) ON DELETE SET NULL,
    session_id VARCHAR(255) REFERENCES stream_sessions(id) ON DELETE SET NULL,
    tokens_generated INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_messages_has_images ON messages(has_images);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX idx_conversations_is_private ON conversations(is_private);
CREATE INDEX idx_conversations_model_provider ON conversations(model_provider);
CREATE INDEX idx_conversations_llm_model ON conversations(llm_model);

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
CREATE INDEX idx_stream_sessions_model_provider ON stream_sessions(model_provider);

-- Indexes for provider and model tables
CREATE INDEX idx_provider_configs_enabled ON provider_configs(enabled);
CREATE INDEX idx_provider_configs_priority ON provider_configs(priority);
CREATE INDEX idx_model_metadata_provider ON model_metadata(provider_name);
CREATE INDEX idx_model_metadata_available ON model_metadata(is_available);
CREATE INDEX idx_model_usage_stats_provider ON model_usage_stats(provider_name);
CREATE INDEX idx_model_usage_stats_model ON model_usage_stats(model_name);
CREATE INDEX idx_model_usage_stats_created_at ON model_usage_stats(created_at);

-- Constraints for provider support
ALTER TABLE conversations ADD CONSTRAINT check_valid_provider 
    CHECK (model_provider IN ('ollama', 'huggingface'));

ALTER TABLE stream_sessions ADD CONSTRAINT check_valid_provider 
    CHECK (model_provider IN ('ollama', 'huggingface'));

-- Triggers to update the updated_at timestamp when messages are added
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

-- Function to update provider configs
CREATE OR REPLACE FUNCTION update_provider_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_provider_config_updated_at
    BEFORE UPDATE ON provider_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_config_updated_at();

-- Function to update model metadata updated_at
CREATE OR REPLACE FUNCTION update_model_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_model_metadata_updated_at
    BEFORE UPDATE ON model_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_model_metadata_updated_at();

-- Insert default provider configurations
INSERT INTO provider_configs (provider_name, display_name, config, priority) VALUES 
    ('ollama', 'Ollama', '{"host": "http://localhost:11434", "timeout": 30000}', 1),
    ('huggingface', 'Hugging Face', '{"device": "cpu", "precision": "float16", "max_memory": 4096}', 2);

-- Insert some default model metadata for Ollama
INSERT INTO model_metadata (model_name, provider_name, display_name, description, capabilities) VALUES 
    ('llama3.1:8b', 'ollama', 'Llama 3.1 8B', 'Meta''s Llama 3.1 8B parameter model', '{"supportsVision": false, "supportsStreaming": true, "maxContextLength": 8192}'),
    ('llama3.1:70b', 'ollama', 'Llama 3.1 70B', 'Meta''s Llama 3.1 70B parameter model', '{"supportsVision": false, "supportsStreaming": true, "maxContextLength": 8192}'),
    ('qwen2.5:32b', 'ollama', 'Qwen 2.5 32B', 'Alibaba''s Qwen 2.5 32B parameter model', '{"supportsVision": false, "supportsStreaming": true, "maxContextLength": 32768}'),
    ('qwen2.5-vl:32b', 'ollama', 'Qwen 2.5 VL 32B', 'Alibaba''s Qwen 2.5 Vision Language 32B model', '{"supportsVision": true, "supportsStreaming": true, "maxContextLength": 32768}');

-- Insert some default model metadata for Hugging Face
INSERT INTO model_metadata (model_name, provider_name, display_name, description, capabilities) VALUES 
    ('gpt2', 'huggingface', 'GPT-2', 'OpenAI''s GPT-2 model', '{"supportsVision": false, "supportsStreaming": true, "maxContextLength": 1024}'),
    ('gpt2-medium', 'huggingface', 'GPT-2 Medium', 'OpenAI''s GPT-2 Medium model', '{"supportsVision": false, "supportsStreaming": true, "maxContextLength": 1024}'),
    ('distilgpt2', 'huggingface', 'DistilGPT-2', 'Distilled version of GPT-2', '{"supportsVision": false, "supportsStreaming": true, "maxContextLength": 1024}'),
    ('microsoft/DialoGPT-medium', 'huggingface', 'DialoGPT Medium', 'Microsoft''s conversational GPT model', '{"supportsVision": false, "supportsStreaming": true, "maxContextLength": 1024}');

-- Sample data insertion (optional - for testing)
-- INSERT INTO conversations (id, tab_name, llm_model, model_provider, is_private, password_hash) VALUES 
--     ('conversation-123', 'Conversation 1', 'llama3.1:8b', 'ollama', FALSE, NULL),
--     ('conversation-456', 'Conversation 2', 'gpt2', 'huggingface', TRUE, '$2b$10$hashedpasswordhere'),
--     ('conversation-789', 'Private Chat', 'qwen2.5:32b', 'ollama', TRUE, '$2b$10$anotherhashedpassword');

-- INSERT INTO messages (conversation_id, text, sender) VALUES
--     ('conversation-123', 'Hello, how are you?', 'user'),
--     ('conversation-123', 'I''m good, thanks!', 'llm'),
--     ('conversation-456', 'What is the meaning of life?', 'user'),
--     ('conversation-456', 'It''s a complex question.', 'llm'); 