#!/usr/bin/env python3
"""
Simple script to run models using Ollama with support for GGUF files and Hugging Face models.
This script demonstrates basic text generation with various model sources.
"""

import requests
import json
import argparse
import sys
import os
import time
import subprocess
import ollama

class OllamaClient:
    """Simple client for interacting with Ollama API."""
    
    def __init__(self, base_url="http://localhost:11434"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def check_ollama_running(self):
        """Check if Ollama is running."""
        try:
            response = self.session.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def list_models(self):
        """List available models."""
        try:
            response = self.session.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                return [model["name"] for model in models]
            return []
        except requests.exceptions.RequestException as e:
            print(f"Error listing models: {e}")
            return []
    
    def pull_model(self, model_name):
        """Pull a model from Ollama."""
        try:
            print(f"Pulling model: {model_name}")
            print("This may take several minutes depending on your internet connection...")
            
            response = self.session.post(
                f"{self.base_url}/api/pull",
                json={"name": model_name},
                stream=True
            )
            
            if response.status_code == 200:
                for line in response.iter_lines():
                    if line:
                        data = json.loads(line.decode('utf-8'))
                        if "status" in data:
                            print(f"Status: {data['status']}")
                        elif "completed_at" in data:
                            print("Model pulled successfully!")
                            return True
            else:
                print(f"Failed to pull model: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"Error pulling model: {e}")
            return False
    
    def create_custom_model(self, model_name, huggingface_model):
        """Create a custom model from Hugging Face using Modelfile."""
        try:
            print(f"Creating custom model '{model_name}' from Hugging Face: {huggingface_model}")
            print("This may take several minutes...")
            
            # Create Modelfile content
            modelfile_content = f"""FROM {huggingface_model}
TEMPLATE "{{{{ .Prompt }}}}"
"""
            
            # Create the model using Ollama's create API
            response = self.session.post(
                f"{self.base_url}/api/create",
                json={
                    "name": model_name,
                    "modelfile": modelfile_content
                },
                stream=True
            )
            
            if response.status_code == 200:
                for line in response.iter_lines():
                    if line:
                        data = json.loads(line.decode('utf-8'))
                        if "status" in data:
                            print(f"Status: {data['status']}")
                        elif "completed_at" in data:
                            print("Custom model created successfully!")
                            return True
            else:
                print(f"Failed to create model: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"Error creating custom model: {e}")
            return False

def register_gguf_model(model_folder, gguf_filename, model_name):
    """
    Register a GGUF model with Ollama using the provided guide approach.
    
    Parameters:
    - model_folder: path to the folder containing the .gguf file
    - gguf_filename: filename of the .gguf file
    - model_name: name to register the model in Ollama
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        gguf_path = os.path.join(model_folder, gguf_filename)
        modelfile_path = os.path.join(model_folder, 'Modelfile')

        # Step 1: Validate GGUF file
        if not os.path.isfile(gguf_path):
            print(f"GGUF file not found: {gguf_path}")
            return False

        print(f"Found GGUF file: {gguf_path}")

        # Step 2: Create Modelfile
        with open(modelfile_path, 'w') as f:
            f.write(f"FROM ./{gguf_filename}\n")

        print(f"Created Modelfile: {modelfile_path}")

        # Step 3: Build model with Ollama
        print(f"Registering model '{model_name}' with Ollama...")
        result = subprocess.run(['ollama', 'create', model_name, '-f', modelfile_path], 
                              capture_output=True, text=True, check=True)
        
        print(f"✅ Model '{model_name}' registered with Ollama")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"Error registering model: {e}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def find_gguf_files(directory):
    """Find all GGUF files in the specified directory."""
    gguf_files = []
    if os.path.exists(directory):
        for root, dirs, files in os.walk(directory):
            for file in files:
                if file.endswith('.gguf'):
                    gguf_files.append(os.path.join(root, file))
    return gguf_files

def generate_text_ollama_lib(model_name, prompt, max_length=512, temperature=0.7):
    """
    Generate text using the ollama Python library.
    
    Args:
        model_name (str): The model name to use
        prompt (str): Input prompt
        max_length (int): Maximum length of generated text
        temperature (float): Sampling temperature
        
    Returns:
        str: Generated text
    """
    try:
        response = ollama.chat(
            model=model_name, 
            messages=[{'role': 'user', 'content': prompt}],
            options={
                'temperature': max(0.1, min(2.0, temperature)),
                'num_predict': min(max_length, 2048),
                'top_p': 0.9,
                'top_k': 50,
                'repeat_penalty': 1.1
            }
        )
        return response['message']['content']
        
    except Exception as e:
        print(f"Error generating text with ollama library: {e}")
        return None

def generate_text_streaming_ollama_lib(model_name, prompt, max_length=512, temperature=0.7):
    """
    Generate text using streaming with the ollama Python library.
    
    Args:
        model_name (str): The model name to use
        prompt (str): Input prompt
        max_length (int): Maximum length of generated text
        temperature (float): Sampling temperature
        
    Returns:
        str: Generated text
    """
    try:
        print("Response: ", end="", flush=True)
        full_response = ""
        
        for chunk in ollama.chat(
            model=model_name, 
            messages=[{'role': 'user', 'content': prompt}],
            options={
                'temperature': max(0.1, min(2.0, temperature)),
                'num_predict': min(max_length, 2048),
                'top_p': 0.9,
                'top_k': 50,
                'repeat_penalty': 1.1
            },
            stream=True
        ):
            content = chunk['message']['content']
            print(content, end="", flush=True)
            full_response += content
        
        print()  # New line after response
        return full_response
        
    except Exception as e:
        print(f"Error generating text with ollama library: {e}")
        return None

def check_and_setup_model(client, model_name, huggingface_model=None, gguf_path=None):
    """
    Check if model is available and setup if necessary.
    
    Args:
        client: OllamaClient instance
        model_name (str): The model name to check/setup
        huggingface_model (str): Hugging Face model name if creating custom model
        gguf_path (str): Path to GGUF file if using local GGUF
        
    Returns:
        bool: True if model is ready, False otherwise
    """
    # Check if Ollama is running
    if not client.check_ollama_running():
        print("Error: Ollama is not running!")
        print("Please start Ollama first by running: ollama serve")
        return False
    
    # List available models
    available_models = client.list_models()
    print(f"Available models: {available_models}")
    
    # Check if our model is available
    if model_name in available_models:
        print(f"Model {model_name} is already available!")
        return True
    
    # If we have a GGUF file, register it
    if gguf_path:
        print(f"Model {model_name} not found. Registering GGUF model...")
        model_folder = os.path.dirname(gguf_path)
        gguf_filename = os.path.basename(gguf_path)
        return register_gguf_model(model_folder, gguf_filename, model_name)
    
    # If we have a Hugging Face model specified, create custom model
    if huggingface_model:
        print(f"Model {model_name} not found. Creating custom model from Hugging Face...")
        return client.create_custom_model(model_name, huggingface_model)
    
    # Try to pull the model from Ollama library
    print(f"Model {model_name} not found. Attempting to pull from Ollama library...")
    return client.pull_model(model_name)

def interactive_mode(model_name):
    """
    Run the model in interactive mode for chat-like interaction.
    
    Args:
        model_name (str): The model name to use
    """
    print("\n=== Interactive Mode ===")
    print("Type 'quit' to exit, 'help' for commands")
    print("Type your message and press Enter to generate a response.\n")
    
    while True:
        try:
            user_input = input("You: ").strip()
            
            if user_input.lower() == 'quit':
                print("Goodbye!")
                break
            elif user_input.lower() == 'help':
                print("Commands:")
                print("  quit - Exit the program")
                print("  help - Show this help message")
                print("  clear - Clear the conversation")
                continue
            elif user_input.lower() == 'clear':
                print("\n" + "="*50 + "\n")
                continue
            elif not user_input:
                continue
            
            print("Generating response...")
            response = generate_text_streaming_ollama_lib(model_name, user_input)
            
            if not response:
                print("Failed to generate response.")
                
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}")

def main():
    """Main function to run the script."""
    parser = argparse.ArgumentParser(description="Run models using Ollama with support for GGUF files and Hugging Face models")
    parser.add_argument(
        "--model", 
        default="gemma-3-4b-it-qat-abliterated",
        help="Model name to use (default: gemma-3-4b-it-qat-abliterated)"
    )
    parser.add_argument(
        "--prompt", 
        help="Single prompt to generate text for"
    )
    parser.add_argument(
        "--max-length", 
        type=int, 
        default=512,
        help="Maximum length of generated text (default: 512)"
    )
    parser.add_argument(
        "--temperature", 
        type=float, 
        default=0.7,
        help="Sampling temperature (default: 0.7)"
    )
    parser.add_argument(
        "--ollama-url",
        default="http://localhost:11434",
        help="Ollama API URL (default: http://localhost:11434)"
    )
    parser.add_argument(
        "--huggingface-model",
        help="Hugging Face model name to use for custom model creation"
    )
    parser.add_argument(
        "--gguf-path",
        help="Path to GGUF file to register with Ollama"
    )
    parser.add_argument(
        "--models-dir",
        default="/Users/mattnevle/Models/huggingface",
        help="Directory to search for GGUF files (default: /Users/mattnevle/Models/huggingface)"
    )

    args = parser.parse_args()
    
    # Initialize Ollama client
    client = OllamaClient(args.ollama_url)
    
    # Check for GGUF files if no specific path provided
    gguf_path = args.gguf_path
    if not gguf_path and args.model == "gemma-3-4b-it-qat-abliterated":
        gguf_files = find_gguf_files(args.models_dir)
        if gguf_files:
            # Find the matching GGUF file
            for gguf_file in gguf_files:
                if "gemma-3-4b-it-qat-abliterated" in gguf_file:
                    gguf_path = gguf_file
                    print(f"Found matching GGUF file: {gguf_path}")
                    break
    
    # Define the Hugging Face model for the default case or use provided argument
    if args.huggingface_model:
        huggingface_model = args.huggingface_model
    elif args.model == "gemma-3-1b-it-qat-abliterated":
        huggingface_model = "mlabonne/gemma-3-1b-it-qat-abliterated"
    else:
        huggingface_model = None
    
    # Check and setup model
    if not check_and_setup_model(client, args.model, huggingface_model, gguf_path):
        print("Failed to setup model. Exiting.")
        sys.exit(1)
    
    if args.prompt:
        # If a prompt is provided, generate text for it first
        print(f"Generating text for prompt: {args.prompt}")
        response = generate_text_ollama_lib(
            args.model, 
            args.prompt, 
            args.max_length, 
            args.temperature
        )
        if response:
            print(f"Generated text:\n{response}")
        else:
            print("Failed to generate text.")
        print("\n" + "="*50 + "\n")
    
    # Always enter interactive mode
    interactive_mode(args.model)

if __name__ == "__main__":
    main() 