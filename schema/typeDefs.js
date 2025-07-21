import { gql } from "apollo-server-express";

const typeDefs = gql`
  type Conversation {
    id: ID!
    tabName: String!
    llmModel: String!
    isPrivate: Boolean!
    createdAt: String!
    updatedAt: String!
    messages: [Message!]!
    messageCount: Int!
  }

  type Message {
    id: ID!
    conversationId: String!
    text: String!
    sender: String!
    timestamp: String!
  }

  type ConversationList {
    conversations: [Conversation!]!
    count: Int!
  }

  type CreateConversationResponse {
    message: String!
    conversation: Conversation!
  }

  type AddMessageResponse {
    message: String!
    userMessage: Message!
    llmMessage: Message
    llmModel: String
    error: String
    llmResponseTime: Float
  }

  type VerifyPasswordResponse {
    message: String!
    conversationId: String!
    tabName: String!
  }

  type AvailableModelsResponse {
    models: [String!]!
    count: Int!
  }

  type WarmupOllamaResponse {
    message: String!
    models: [String!]!
    count: Int!
    status: String!
  }

  type DeleteConversationResponse {
    message: String!
    conversationId: String!
    success: Boolean!
  }

  type DeleteMessagesResponse {
    message: String!
    deletedCount: Int!
    success: Boolean!
  }

  input CreateConversationInput {
    id: String!
    tabName: String!
    llmModel: String
    password: String
  }

  input AddMessageInput {
    conversationId: String!
    text: String!
    sender: String!
    password: String
    llmModel: String
  }

  input VerifyPasswordInput {
    conversationId: String!
    password: String!
  }

  type Query {
    # Get all public conversations
    conversations: ConversationList!

    # Get a specific conversation with messages
    conversation(id: String!, password: String): Conversation!

    # Get messages for a conversation
    messages(conversationId: String!, password: String): [Message!]!

    # Get available Ollama models
    availableModels: AvailableModelsResponse!
  }

  type Mutation {
    # Create a new conversation
    createConversation(input: CreateConversationInput!): CreateConversationResponse!

    # Add a message to a conversation (with optional LLM response)
    addMessage(input: AddMessageInput!): AddMessageResponse!

    # Delete a conversation
    deleteConversation(conversationId: String!): DeleteConversationResponse!

    # Delete all messages after a given message in a conversation
    deleteMessagesAfter(conversationId: ID!, messageId: ID!): DeleteMessagesResponse!

    # Verify password for private conversation
    verifyPassword(input: VerifyPasswordInput!): VerifyPasswordResponse!

    # Warm up Ollama service to reduce initial latency
    warmupOllama: WarmupOllamaResponse!
  }
`;

export default typeDefs;
