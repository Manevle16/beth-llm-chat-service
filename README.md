# NONAI PART
Fully vibe coded
Just testing out how good cursor is and creating myself my own llm service that handles history and deletions
similar to chatgpt whenever llm models are cheaper

# Beth LLM Chat Service

A secure chat service API built with GraphQL that supports multiple LLM models with password-protected conversations and automatic LLM responses via Ollama.

## Features

- Create and manage conversations with GraphQL
- Support for multiple LLM models (GPT-4, Claude, Llama, etc.) via Ollama
- **Automatic LLM responses** - User messages automatically trigger LLM responses
- Password-protected private conversations
- Secure password hashing with bcrypt
- PostgreSQL database backend
- GraphQL Playground for testing
- Real-time introspection and documentation
- Conversation context awareness for LLM responses

## Setup

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- **Ollama** installed and running locally
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd beth-llm-chat-service
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment variables:
```bash
cp env.example .env
# Edit .env with your database credentials and Ollama host
```

4. Create the database and run the schema:
```sql
-- Create database
CREATE DATABASE beth_chat_service;

-- Run the schema from database_schema.sql
```

5. Install and start Ollama:
```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service
ollama serve

# Pull a model (in another terminal)
ollama pull llama3.1:8b
```

6. Start the server:
```bash
npm run dev
```

## GraphQL API

### Endpoints

- **GraphQL Endpoint**: `http://localhost:3000/graphql`
- **GraphQL Playground**: `http://localhost:3000/graphql` (Interactive IDE)
- **Health Check**: `http://localhost:3000/health`

### Queries

#### Get All Public Conversations
```graphql
query {
  conversations {
    count
    conversations {
      id
      tabName
      llmModel
      isPrivate
      createdAt
      updatedAt
      messageCount
    }
  }
}
```

#### Get Conversation with Messages
```graphql
query GetConversation($id: String!, $password: String) {
  conversation(id: $id, password: $password) {
    id
    tabName
    llmModel
    isPrivate
    createdAt
    updatedAt
    messageCount
    messages {
      id
      text
      sender
      timestamp
    }
  }
}
```

#### Get Available Ollama Models
```graphql
query {
  availableModels {
    models
    count
  }
}
```

### Mutations

#### Create Conversation
```graphql
mutation CreateConversation($input: CreateConversationInput!) {
  createConversation(input: $input) {
    message
    conversation {
      id
      tabName
      llmModel
      isPrivate
      createdAt
    }
  }
}
```

#### Add Message (with automatic LLM response)
```graphql
mutation AddMessage($input: AddMessageInput!) {
  addMessage(input: $input) {
    message
    userMessage {
      id
      text
      sender
      timestamp
    }
    llmMessage {
      id
      text
      sender
      timestamp
    }
    llmModel
    error
  }
}
```

#### Verify Password
```graphql
mutation VerifyPassword($input: VerifyPasswordInput!) {
  verifyPassword(input: $input) {
    message
    conversationId
    tabName
  }
}
```

## Client Usage Examples

### JavaScript/TypeScript Client

```javascript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:3000/graphql',
  cache: new InMemoryCache(),
});

// Create a conversation with specific LLM model
await client.mutate({
  mutation: CREATE_CONVERSATION,
  variables: {
    input: {
      id: 'chat-1',
      tabName: 'AI Chat',
      llmModel: 'llama3.1:8b'
    }
  }
});

// Add a user message - this will automatically generate an LLM response
const { data } = await client.mutate({
  mutation: ADD_MESSAGE,
  variables: {
    input: {
      conversationId: 'chat-1',
      text: 'Hello, how are you?',
      sender: 'user'
      // llmModel is optional - will use conversation's default if not provided
    }
  }
});

console.log('User message:', data.addMessage.userMessage);
console.log('LLM response:', data.addMessage.llmMessage);
console.log('Model used:', data.addMessage.llmModel);

// Check available models
const { data: modelsData } = await client.query({
  query: gql`
    query {
      availableModels {
        models
        count
      }
    }
  `
});

console.log('Available models:', modelsData.availableModels.models);
```

### cURL Examples

```bash
# Add a message with automatic LLM response
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation AddMessage($input: AddMessageInput!) { addMessage(input: $input) { message userMessage { text sender } llmMessage { text sender } llmModel error } }",
    "variables": {
      "input": {
        "conversationId": "chat-1",
        "text": "What is the meaning of life?",
        "sender": "user",
        "llmModel": "llama3.1:8b"
      }
    }
  }'

# Get available models
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { availableModels { models count } }"
  }'
```

## How LLM Integration Works

### Automatic Response Flow

1. **User sends message** → Message is stored in database
2. **System detects user message** → Triggers LLM call
3. **Conversation history retrieved** → Provides context to LLM
4. **Ollama API called** → Uses specified model (or conversation default)
5. **LLM response generated** → Response stored in database
6. **Both messages returned** → User message + LLM response

### Conversation Context

The system automatically provides conversation history to the LLM, ensuring:
- **Contextual responses** - LLM remembers previous messages
- **Conversation continuity** - Responses are relevant to the ongoing chat
- **Model flexibility** - Can override conversation's default model per message

### Error Handling

- **Model not found** → Clear error message with model name
- **Ollama connection issues** → Helpful troubleshooting guidance
- **Graceful degradation** → User message still stored even if LLM fails

## Database Schema

The service uses two main tables:

### conversations
- `id` (VARCHAR) - Primary key
- `tab_name` (VARCHAR) - Display name
- `llm_model` (VARCHAR) - LLM model identifier
- `is_private` (BOOLEAN) - Password protection flag
- `password_hash` (VARCHAR) - Hashed password
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### messages
- `id` (SERIAL) - Primary key
- `conversation_id` (VARCHAR) - Foreign key
- `text` (TEXT) - Message content
- `sender` (VARCHAR) - 'user' or 'llm'
- `timestamp` (TIMESTAMP)
- `created_at` (TIMESTAMP)

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt
- **Private Conversations**: Conversations can be password-protected
- **Input Validation**: All inputs are validated through GraphQL schema
- **Error Handling**: Comprehensive error handling and logging
- **Field-Level Security**: Password-protected conversations require password for all operations

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_USER` | PostgreSQL username | `postgres` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_NAME` | Database name | `beth_chat_service` |
| `DB_PASSWORD` | Database password | `` |
| `DB_PORT` | Database port | `5432` |
| `PORT` | Server port | `3000` |
| `OLLAMA_HOST` | Ollama service URL | `http://localhost:11434` |

## Ollama Setup

### Installing Models

```bash
# Pull popular models
ollama pull llama3.1:8b
ollama pull llama3.1:70b
ollama pull codellama:7b
ollama pull mistral:7b

# List installed models
ollama list
```

### Model Compatibility

The service works with any Ollama model. Common model names:
- `llama3.1:8b` - Fast, good for general chat
- `llama3.1:70b` - More capable, slower
- `codellama:7b` - Specialized for code
- `mistral:7b` - Good balance of speed/quality

## GraphQL Playground

Visit `http://localhost:3000/graphql` to access the GraphQL Playground, where you can:

- Explore the schema documentation
- Test queries and mutations interactively
- View query execution plans
- Debug GraphQL operations
- Test LLM integration with real models

## License

MIT