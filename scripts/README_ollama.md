# Ollama-based Model Script with GGUF Support

This is a converted version of the original `run_qwen_model.py` script that uses Ollama with support for GGUF files, Hugging Face models, and Ollama library models.

## Prerequisites

1. **Install Ollama**: Follow the instructions at [ollama.ai](https://ollama.ai) to install Ollama on your system.

2. **Start Ollama**: Run `ollama serve` to start the Ollama service.

3. **Install Python dependencies**:
   ```bash
   pip install -r requirements_ollama.txt
   ```

## Usage

### Basic Usage
```bash
python run_qwen_model_ollama.py
```

This will:
- Use the default model `gemma-3-4b-it-qat-abliterated` (from local GGUF file)
- Check if Ollama is running
- Automatically find and register the GGUF file from `/Users/mattnevle/Models/huggingface`
- Start interactive mode

### Command Line Options

```bash
python run_qwen_model_ollama.py [OPTIONS]
```

Options:
- `--model MODEL`: Model name to use (default: `gemma-3-4b-it-qat-abliterated`)
- `--prompt PROMPT`: Single prompt to generate text for
- `--max-length MAX_LENGTH`: Maximum length of generated text (default: 512)
- `--temperature TEMPERATURE`: Sampling temperature (default: 0.7)
- `--ollama-url URL`: Ollama API URL (default: `http://localhost:11434`)
- `--huggingface-model MODEL`: Hugging Face model name for custom model creation
- `--gguf-path PATH`: Path to specific GGUF file to register
- `--models-dir DIR`: Directory to search for GGUF files (default: `/Users/mattnevle/Models/huggingface`)

### Examples

1. **Use a different Ollama library model**:
   ```bash
   python run_qwen_model_ollama.py --model qwen:7b
   ```
   
   **Use a specific GGUF file**:
   ```bash
   python run_qwen_model_ollama.py --model my-gguf-model --gguf-path /path/to/your/model.gguf
   ```
   
   **Use a different Hugging Face model**:
   ```bash
   python run_qwen_model_ollama.py --model my-custom-model --huggingface-model microsoft/DialoGPT-medium
   ```
   
   **Use the default GGUF model explicitly**:
   ```bash
   python run_qwen_model_ollama.py --model gemma-3-4b-it-qat-abliterated
   ```

2. **Generate text for a specific prompt**:
   ```bash
   python run_qwen_model_ollama.py --prompt "Explain quantum computing in simple terms"
   ```

3. **Use custom parameters**:
   ```bash
   python run_qwen_model_ollama.py --temperature 0.9 --max-length 1024
   ```

## Interactive Mode Commands

Once in interactive mode, you can use these commands:
- `quit`: Exit the program
- `help`: Show help message
- `clear`: Clear the conversation
- `models`: List available models

## Key Differences from Original Script

1. **No PyTorch/Transformers**: This version doesn't require PyTorch or the transformers library, making it much lighter.

2. **Ollama API**: Uses Ollama's REST API instead of loading models directly in Python.

3. **Model Management**: Automatically pulls models from Ollama's model library or creates custom models from Hugging Face.

4. **Streaming Support**: Includes streaming text generation for better user experience.

5. **Simplified Setup**: No need to manage CUDA/GPU memory or model loading in Python.

6. **Custom Model Creation**: Can create custom models from any Hugging Face model using Ollama's Modelfile system.
7. **GGUF File Support**: Can register and use local GGUF files with Ollama.
8. **Ollama Python Library**: Uses the official ollama Python library for better integration.

## Available Models

### Default Model
The script defaults to using `gemma-3-4b-it-qat-abliterated.q3_k_m.gguf` from your local models directory, which will be automatically registered with Ollama.

### GGUF Files
You can use any local GGUF file by specifying the `--gguf-path` argument or placing it in the models directory:
- `gemma-3-4b-it-qat-abliterated.q3_k_m.gguf` - Quantized Gemma 3 4B model
- Any other GGUF file you have locally

### Ollama Library Models
You can use any model available in Ollama's library. Some popular options:
- `gemma:3b` - Google's Gemma 3B model
- `qwen:7b` - Alibaba's Qwen 7B model
- `llama3:8b` - Meta's Llama 3 8B model
- `mistral:7b` - Mistral AI's 7B model

To see all available models, visit [ollama.ai/library](https://ollama.ai/library).

### Custom Hugging Face Models
You can use any model from Hugging Face by specifying the `--huggingface-model` argument:
- `microsoft/DialoGPT-medium` - Microsoft's conversational model
- `gpt2` - OpenAI's GPT-2 model
- `EleutherAI/gpt-neo-125M` - EleutherAI's smaller GPT-Neo model
- Any other model available on Hugging Face Hub

## Troubleshooting

1. **"Ollama is not running"**: Make sure to run `ollama serve` first.

2. **Model not found**: The script will automatically attempt to pull the model. Make sure you have internet connectivity.

3. **Slow responses**: First-time model loading may take several minutes depending on your internet connection.

4. **Memory issues**: Ollama handles memory management automatically, but you may need to close other applications if you're using large models. 