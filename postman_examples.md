# Postman cURL Examples for Beth LLM Chat Service

## GraphQL Endpoints

### HTTP (Default)
```
http://localhost:3000/graphql
```

### HTTPS (Development)
```
https://localhost:3443/graphql
```

## 1. Add Message (with automatic LLM response)

### HTTP cURL Command
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation AddMessage($input: AddMessageInput!) { addMessage(input: $input) { message userMessage { id text sender timestamp } llmMessage { id text sender timestamp } llmModel error } }",
    "variables": {
      "input": {
        "conversationId": "test-conversation-123",
        "text": "What is the meaning of life?",
        "sender": "user",
        "llmModel": "llama3.1:8b"
      }
    }
  }'
```

### HTTPS cURL Command (Development)
```bash
curl -X POST https://localhost:3443/graphql \
  -H "Content-Type: application/json" \
  -k \
  -d '{
    "query": "mutation AddMessage($input: AddMessageInput!) { addMessage(input: $input) { message userMessage { id text sender timestamp } llmMessage { id text sender timestamp } llmModel error } }",
    "variables": {
      "input": {
        "conversationId": "test-conversation-123",
        "text": "What is the meaning of life?",
        "sender": "user",
        "llmModel": "llama3.1:8b"
      }
    }
  }'
```

### Postman Setup (HTTP)
- **Method**: POST
- **URL**: `http://localhost:3000/graphql`
- **Headers**: 
  - `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "query": "mutation AddMessage($input: AddMessageInput!) { addMessage(input: $input) { message userMessage { id text sender timestamp } llmMessage { id text sender timestamp } llmModel error } }",
  "variables": {
    "input": {
      "conversationId": "test-conversation-123",
      "text": "What is the meaning of life?",
      "sender": "user",
      "llmModel": "llama3.1:8b"
    }
  }
}
```

### Postman Setup (HTTPS)
- **Method**: POST
- **URL**: `https://localhost:3443/graphql`
- **Headers**: 
  - `Content-Type: application/json`
- **SSL Certificate Verification**: Disable (for self-signed certificates)
- **Body** (raw JSON): Same as HTTP

## 2. Create Conversation

### HTTP cURL Command
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation CreateConversation($input: CreateConversationInput!) { createConversation(input: $input) { message conversation { id tabName llmModel isPrivate createdAt } } }",
    "variables": {
      "input": {
        "id": "my-chat-123",
        "tabName": "My AI Chat",
        "llmModel": "llama3.1:8b"
      }
    }
  }'
```

### HTTPS cURL Command
```bash
curl -X POST https://localhost:3443/graphql \
  -H "Content-Type: application/json" \
  -k \
  -d '{
    "query": "mutation CreateConversation($input: CreateConversationInput!) { createConversation(input: $input) { message conversation { id tabName llmModel isPrivate createdAt } } }",
    "variables": {
      "input": {
        "id": "my-chat-123",
        "tabName": "My AI Chat",
        "llmModel": "llama3.1:8b"
      }
    }
  }'
```

## 3. Get All Public Conversations

### HTTP cURL Command
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { conversations { count conversations { id tabName llmModel isPrivate createdAt updatedAt messageCount } } }"
  }'
```

### HTTPS cURL Command
```bash
curl -X POST https://localhost:3443/graphql \
  -H "Content-Type: application/json" \
  -k \
  -d '{
    "query": "query { conversations { count conversations { id tabName llmModel isPrivate createdAt updatedAt messageCount } } }"
  }'
```

## 4. Get Available Ollama Models

### HTTP cURL Command
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { availableModels { models count } }"
  }'
```

### HTTPS cURL Command
```bash
curl -X POST https://localhost:3443/graphql \
  -H "Content-Type: application/json" \
  -k \
  -d '{
    "query": "query { availableModels { models count } }"
  }'
```

## 5. Get Conversation with Messages

### HTTP cURL Command
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetConversation($id: String!) { conversation(id: $id) { id tabName llmModel messages { id text sender timestamp } } }",
    "variables": {
      "id": "test-conversation-123"
    }
  }'
```

### HTTPS cURL Command
```bash
curl -X POST https://localhost:3443/graphql \
  -H "Content-Type: application/json" \
  -k \
  -d '{
    "query": "query GetConversation($id: String!) { conversation(id: $id) { id tabName llmModel messages { id text sender timestamp } } }",
    "variables": {
      "id": "test-conversation-123"
    }
  }'
```

## 6. Add Message (Simple Example)

### HTTP cURL Command
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { addMessage(input: { conversationId: \"test-conversation-123\", text: \"Hello, how are you?\", sender: \"user\" }) { message userMessage { text sender } llmMessage { text sender } llmModel } }"
  }'
```

### HTTPS cURL Command
```bash
curl -X POST https://localhost:3443/graphql \
  -H "Content-Type: application/json" \
  -k \
  -d '{
    "query": "mutation { addMessage(input: { conversationId: \"test-conversation-123\", text: \"Hello, how are you?\", sender: \"user\" }) { message userMessage { text sender } llmMessage { text sender } llmModel } }"
  }'
```

## 7. Add Message (Private Conversation with Password)

### HTTP cURL Command
```bash
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation AddMessage($input: AddMessageInput!) { addMessage(input: $input) { message userMessage { id text sender timestamp } llmMessage { id text sender timestamp } llmModel error } }",
    "variables": {
      "input": {
        "conversationId": "private-chat-456",
        "text": "This is a secret message",
        "sender": "user",
        "password": "secret123",
        "llmModel": "llama3.1:8b"
      }
    }
  }'
```

### HTTPS cURL Command
```bash
curl -X POST https://localhost:3443/graphql \
  -H "Content-Type: application/json" \
  -k \
  -d '{
    "query": "mutation AddMessage($input: AddMessageInput!) { addMessage(input: $input) { message userMessage { id text sender timestamp } llmMessage { id text sender timestamp } llmModel error } }",
    "variables": {
      "input": {
        "conversationId": "private-chat-456",
        "text": "This is a secret message",
        "sender": "user",
        "password": "secret123",
        "llmModel": "llama3.1:8b"
      }
    }
  }'
```

## Expected Response Format

### Successful addMessage Response:
```json
{
  "data": {
    "addMessage": {
      "message": "Message added successfully",
      "userMessage": {
        "id": "test-user-message-id",
        "text": "What is the meaning of life?",
        "sender": "user",
        "timestamp": "2024-01-15T10:30:00.000Z"
      },
      "llmMessage": {
        "id": "test-llm-message-id",
        "text": "The meaning of life is a profound philosophical question...",
        "sender": "llm",
        "timestamp": "2024-01-15T10:30:05.000Z"
      },
      "llmModel": "llama3.1:8b",
      "error": null
    }
  }
}
```

### Error Response:
```json
{
  "data": {
    "addMessage": {
      "message": "Message added successfully",
      "userMessage": {
        "id": "test-user-message-id",
        "text": "What is the meaning of life?",
        "sender": "user",
        "timestamp": "2024-01-15T10:30:00.000Z"
      },
      "llmMessage": null,
      "llmModel": "llama3.1:8b",
      "error": "LLM model 'llama3.1:8b' not found. Please ensure it's installed in Ollama."
    }
  }
}
```

## HTTPS Setup Instructions

### 1. Generate SSL Certificates (Development)
```bash
npm run generate-ssl
```

### 2. Start Server with HTTPS
```bash
npm run dev:https
```

### 3. Environment Variables for Production
```bash
# Set these in your .env file for production
FORCE_HTTPS=true
SSL_KEY_PATH=/path/to/your/private-key.pem
SSL_CERT_PATH=/path/to/your/certificate.pem
```

## Testing Tips

1. **Start with simple queries** like `availableModels` to test connectivity
2. **Use the conversation ID** from your database or create one first
3. **Check Ollama is running** before testing LLM responses
4. **Try different models** if one isn't available
5. **Use the GraphQL Playground** at `http://localhost:3000/graphql` or `https://localhost:3443/graphql` for interactive testing
6. **For HTTPS testing**: Use `-k` flag in cURL to ignore SSL certificate warnings (development only)
7. **In Postman**: Disable SSL certificate verification for self-signed certificates 