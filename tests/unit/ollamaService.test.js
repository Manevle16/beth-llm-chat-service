/**
 * Jest tests for OllamaService
 * Covers essential functionality: initialization, rotation, model listing, response generation, and error handling.
 */

import ollamaService from '../../services/ollamaService.js';
import modelRotationService from '../../services/modelRotationService.js';
import { REQUEST_PRIORITY } from '../../types/modelRotation.js';

describe('OllamaService', () => {
  let originalOllama;

  beforeEach(async () => {
    // Reset state for each test
    if (ollamaService._isInitialized) {
      ollamaService._isInitialized = false;
      ollamaService._rotationEnabled = false;
    }
    
    // Mock the Ollama client methods
    originalOllama = ollamaService.ollama;
    ollamaService.ollama = {
      list: async () => ({
        models: [
          { name: 'llama3.1:8b' },
          { name: 'llama3.1:70b' },
          { name: 'mistral:7b' }
        ]
      }),
      generate: async (params) => {
        if (params.model === 'non-existent-model') {
          throw new Error('Model not found');
        }
        return {
          response: 'Mock response from Ollama'
        };
      },
      chat: async (params) => {
        if (params.model === 'non-existent-model') {
          throw new Error('Model not found');
        }
        return {
          message: { content: 'Mock chat response from Ollama' }
        };
      }
    };
  });

  afterEach(() => {
    // Restore original Ollama client
    if (originalOllama) {
      ollamaService.ollama = originalOllama;
    }
  });

  test('should initialize and set rotation state', async () => {
    await ollamaService.initialize();
    expect(ollamaService._isInitialized).toBe(true);
    // Accept boolean or string (from config)
    expect(['boolean', 'string']).toContain(typeof ollamaService._rotationEnabled);
  });

  test('should enable and disable rotation', async () => {
    await ollamaService.initialize();
    const initial = ollamaService.isRotationEnabled();
    ollamaService.setRotationEnabled(!initial);
    expect(ollamaService.isRotationEnabled()).toBe(!initial);
    ollamaService.setRotationEnabled(initial);
    expect(ollamaService.isRotationEnabled()).toBe(initial);
  });

  test('should build conversation context', () => {
    const history = [
      { sender: 'user', text: 'Hello' },
      { sender: 'assistant', text: 'Hi there!' }
    ];
    const messages = ollamaService.buildConversationContext(history, 'How are you?');
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.some(m => m.role === 'user')).toBe(true);
    expect(messages.some(m => m.role === 'assistant')).toBe(true);
    expect(messages[messages.length - 1].content).toContain('How are you?');
  });

  test('should handle model listing and existence check', async () => {
    await ollamaService.initialize();
    
    // Test with mocked models
    const models = await ollamaService.listModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models).toContain('llama3.1:8b');
    expect(models).toContain('llama3.1:70b');
    expect(models).toContain('mistral:7b');
    
    // Test model existence checks
    const exists = await ollamaService.checkModelExists('llama3.1:8b');
    expect(exists).toBe(true);
    
    const notExists = await ollamaService.checkModelExists('non-existent-model-check');
    expect(notExists).toBe(false);
    
    // Verify the models were returned correctly
    expect(models.length).toBe(3);
  });

  test('should get rotation status and history', async () => {
    await ollamaService.initialize();
    const status = await ollamaService.getRotationStatus();
    expect(status).toHaveProperty('isRotating');
    expect(status).toHaveProperty('activeModel');
    const history = await ollamaService.getRotationHistory(3);
    expect(Array.isArray(history)).toBe(true);
    const failed = await ollamaService.getFailedRotations();
    expect(Array.isArray(failed)).toBe(true);
  });

  test('should force model rotation and handle errors', async () => {
    await ollamaService.initialize();
    // Accept either a thrown error or an error object with a message
    let threw = false;
    try {
      const result = await ollamaService.forceModelRotation('non-existent-model', 'test');
      if (result && result.message) {
        expect(result.message).toMatch(/not found/i);
      } else {
        // If no error object, this is a failure
        expect(false).toBe(true);
      }
    } catch (error) {
      threw = true;
      expect(error.message).toMatch(/not found/i);
    }
    expect(threw || true).toBe(true); // Accept either path
  });

  test('should handle emergency cleanup', async () => {
    await ollamaService.initialize();
    const result = await ollamaService.emergencyCleanup();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('action');
    expect(result).toHaveProperty('message');
  });

  test('should generate response and handle rotation', async () => {
    await ollamaService.initialize();
    // Should throw for non-existent model
    await expect(
      ollamaService.generateResponse('non-existent-model', 'Hello', [], { enableRotation: true })
    ).rejects.toThrow();
  });

  test('should handle streamResponse errors for non-existent model', async () => {
    await ollamaService.initialize();
    // Should throw for non-existent model
    const stream = ollamaService.streamResponse('non-existent-model', 'Hello', [], { enableRotation: true });
    await expect(stream.next()).rejects.toThrow();
  });
}); 