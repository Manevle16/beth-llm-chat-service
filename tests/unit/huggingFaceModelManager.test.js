import { jest } from '@jest/globals';

// ESM-compatible mock for fs/promises with named exports
const access = jest.fn();
const readdir = jest.fn();
const mkdir = jest.fn();

await jest.unstable_mockModule('fs/promises', () => ({ access, readdir, mkdir }));

const { default: huggingFaceModelManager } = await import('../../services/huggingFaceModelManager.js');

describe('HuggingFaceModelManager', () => {
  beforeEach(() => {
    huggingFaceModelManager.loadedModels.clear();
    huggingFaceModelManager.modelMetadata.clear();
    huggingFaceModelManager._isInitialized = false;
    jest.clearAllMocks();
  });

  it('should initialize and scan local models', async () => {
    access.mockResolvedValue();
    readdir.mockResolvedValue([
      { isDirectory: () => true, name: 'test-model' }
    ]);
    readdir.mockResolvedValueOnce([
      { isDirectory: () => true, name: 'test-model' }
    ]).mockResolvedValueOnce([
      'config.json', 'tokenizer.json'
    ]);

    await huggingFaceModelManager.initialize();
    expect(huggingFaceModelManager.modelMetadata.has('test-model')).toBe(true);
  });

  it('should load and unload a model', async () => {
    const modelInstance = { pipeline: true };
    await huggingFaceModelManager.loadModel('foo', modelInstance);
    expect(huggingFaceModelManager.loadedModels.has('foo')).toBe(true);
    expect(huggingFaceModelManager.modelMetadata.get('foo').isLoaded).toBe(true);

    await huggingFaceModelManager.unloadModel('foo');
    expect(huggingFaceModelManager.loadedModels.has('foo')).toBe(false);
    expect(huggingFaceModelManager.modelMetadata.get('foo').isLoaded).toBe(false);
  });

  it('should update lastUsedAt on loadModel', async () => {
    const modelInstance = { pipeline: true };
    await huggingFaceModelManager.loadModel('bar', modelInstance);
    const meta = huggingFaceModelManager.modelMetadata.get('bar');
    expect(meta.lastUsedAt).toBeInstanceOf(Date);
  });

  it('should evict LRU model when cache is full', async () => {
    huggingFaceModelManager.maxCachedModels = 2;
    const m1 = { id: 1 };
    const m2 = { id: 2 };
    const m3 = { id: 3 };
    await huggingFaceModelManager.loadModel('m1', m1);
    await huggingFaceModelManager.loadModel('m2', m2);
    // Simulate m1 is older
    huggingFaceModelManager.modelMetadata.get('m1').lastUsedAt = new Date(Date.now() - 10000);
    huggingFaceModelManager.modelMetadata.get('m2').lastUsedAt = new Date();
    await huggingFaceModelManager.loadModel('m3', m3);
    expect(huggingFaceModelManager.loadedModels.has('m1')).toBe(false);
    expect(huggingFaceModelManager.loadedModels.has('m2')).toBe(true);
    expect(huggingFaceModelManager.loadedModels.has('m3')).toBe(true);
  });

  it('should list models and get metadata', async () => {
    huggingFaceModelManager.modelMetadata.set('baz', { name: 'baz', isLoaded: false });
    const models = huggingFaceModelManager.listModels();
    expect(models.some(m => m.name === 'baz')).toBe(true);
    expect(huggingFaceModelManager.getModelMetadata('baz')).toEqual({ name: 'baz', isLoaded: false });
    expect(huggingFaceModelManager.getModelMetadata('nope')).toBeNull();
  });
}); 