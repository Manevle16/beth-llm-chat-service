import dotenv from 'dotenv';

dotenv.config();

export const HUGGING_FACE_CONFIG = {
  MODEL_STORAGE_PATH: process.env.HF_MODEL_PATH || '/Users/mattnevle/Models/huggingface',
  MAX_CACHED_MODELS: parseInt(process.env.HF_MAX_CACHED_MODELS) || 3,
  DEFAULT_TASK: process.env.HF_DEFAULT_TASK || 'text-generation',
  ENABLE_GPU: process.env.HF_ENABLE_GPU === 'true',
  MODEL_TIMEOUT_MS: parseInt(process.env.HF_MODEL_TIMEOUT_MS) || 30000,
  STREAM_CHUNK_SIZE: parseInt(process.env.HF_STREAM_CHUNK_SIZE) || 50
};

export default HUGGING_FACE_CONFIG;