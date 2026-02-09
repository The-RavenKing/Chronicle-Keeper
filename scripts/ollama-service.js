/**
 * Chronicle Keeper - Ollama Service
 * Handles all communication with the Ollama API
 * 
 * @module ollama-service
 */

import { MODULE_NAME, getSetting } from './main.js';

/**
 * Service class for interacting with Ollama API
 */
export class OllamaService {
    /**
     * Create an OllamaService instance
     * @param {string} baseUrl - The base URL of the Ollama server
     */
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl;
        this.connected = false;
        this.models = [];
        this.abortController = null;
    }

    /**
     * Update the base URL
     * @param {string} url - New base URL
     */
    setBaseUrl(url) {
        this.baseUrl = url;
        this.connected = false;
    }

    /**
     * Check if the Ollama server is reachable
     * @returns {Promise<boolean>} True if connected
     */
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                this.connected = true;
                const data = await response.json();
                this.models = data.models || [];
                return true;
            }

            this.connected = false;
            return false;
        } catch (error) {
            console.warn(`${MODULE_NAME} | Connection check failed:`, error.message);
            this.connected = false;
            return false;
        }
    }

    /**
     * List available models from Ollama
     * @returns {Promise<Array>} Array of model objects
     */
    async listModels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                this.models = data.models || [];
                return this.models;
            }

            return [];
        } catch (error) {
            console.error(`${MODULE_NAME} | Failed to list models:`, error);
            return [];
        }
    }

    /**
     * Generate a chat completion
     * @param {Object} options - Generation options
     * @param {string} options.model - Model name to use
     * @param {Array} options.messages - Array of message objects
     * @param {number} [options.temperature] - Temperature for generation
     * @param {number} [options.maxTokens] - Maximum tokens to generate
     * @param {boolean} [options.stream] - Whether to stream the response
     * @param {Function} [options.onChunk] - Callback for streamed chunks
     * @returns {Promise<string>} Generated text
     */
    async chat({ model, messages, temperature = 0.7, maxTokens = 1024, stream = false, onChunk = null }) {
        if (!this.connected) {
            const reconnected = await this.checkConnection();
            if (!reconnected) {
                throw new Error('Not connected to Ollama server');
            }
        }

        const requestBody = {
            model,
            messages,
            options: {
                temperature,
                num_predict: maxTokens
            },
            stream
        };

        try {
            // Create abort controller for this request
            this.abortController = new AbortController();

            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Ollama API error: ${response.status} - ${error}`);
            }

            if (stream && onChunk) {
                return await this._handleStreamResponse(response, onChunk);
            } else {
                const data = await response.json();
                return data.message?.content || '';
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`${MODULE_NAME} | Request aborted`);
                return '';
            }
            throw error;
        } finally {
            this.abortController = null;
        }
    }

    /**
     * Handle streaming response from Ollama
     * @param {Response} response - Fetch response object
     * @param {Function} onChunk - Callback for each chunk
     * @returns {Promise<string>} Complete generated text
     * @private
     */
    async _handleStreamResponse(response, onChunk) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.message?.content) {
                            fullContent += data.message.content;
                            onChunk(data.message.content, fullContent);
                        }

                        // Check if this is the final message
                        if (data.done) {
                            return fullContent;
                        }
                    } catch (e) {
                        // Skip invalid JSON lines
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return fullContent;
    }

    /**
     * Generate text completion (non-chat)
     * @param {Object} options - Generation options
     * @param {string} options.model - Model name
     * @param {string} options.prompt - Prompt text
     * @param {number} [options.temperature] - Temperature
     * @param {number} [options.maxTokens] - Max tokens
     * @returns {Promise<string>} Generated text
     */
    async generate({ model, prompt, temperature = 0.7, maxTokens = 1024 }) {
        if (!this.connected) {
            const reconnected = await this.checkConnection();
            if (!reconnected) {
                throw new Error('Not connected to Ollama server');
            }
        }

        const requestBody = {
            model,
            prompt,
            options: {
                temperature,
                num_predict: maxTokens
            },
            stream: false
        };

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Ollama API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return data.response || '';

        } catch (error) {
            console.error(`${MODULE_NAME} | Generate error:`, error);
            throw error;
        }
    }

    /**
     * Generate embeddings for text
     * @param {string} model - Embedding model name
     * @param {string} text - Text to embed
     * @returns {Promise<Array<number>>} Embedding vector
     */
    async embed(model, text) {
        if (!this.connected) {
            const reconnected = await this.checkConnection();
            if (!reconnected) {
                throw new Error('Not connected to Ollama server');
            }
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt: text
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Ollama embedding error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return data.embedding || [];

        } catch (error) {
            console.error(`${MODULE_NAME} | Embedding error:`, error);
            throw error;
        }
    }

    /**
     * Cancel any ongoing request
     */
    abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * Pull a model from the Ollama library
     * @param {string} modelName - Name of model to pull
     * @param {Function} [onProgress] - Progress callback
     * @returns {Promise<boolean>} Success status
     */
    async pullModel(modelName, onProgress = null) {
        try {
            const response = await fetch(`${this.baseUrl}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName, stream: true })
            });

            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (onProgress) {
                            onProgress(data);
                        }

                        if (data.status === 'success') {
                            await this.listModels(); // Refresh model list
                            return true;
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }

            return true;
        } catch (error) {
            console.error(`${MODULE_NAME} | Pull model error:`, error);
            return false;
        }
    }

    /**
     * Get information about a specific model
     * @param {string} modelName - Model name
     * @returns {Promise<Object|null>} Model info or null
     */
    async getModelInfo(modelName) {
        try {
            const response = await fetch(`${this.baseUrl}/api/show`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName })
            });

            if (response.ok) {
                return await response.json();
            }

            return null;
        } catch (error) {
            console.error(`${MODULE_NAME} | Get model info error:`, error);
            return null;
        }
    }

    /**
     * Create a formatted message array for chat
     * @param {string} systemPrompt - System prompt
     * @param {Array} conversationHistory - Previous messages
     * @param {string} userMessage - Current user message
     * @returns {Array} Formatted messages array
     */
    static formatMessages(systemPrompt, conversationHistory = [], userMessage) {
        const messages = [];

        // Add system message
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // Add conversation history
        for (const msg of conversationHistory) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }

        // Add current user message
        if (userMessage) {
            messages.push({
                role: 'user',
                content: userMessage
            });
        }

        return messages;
    }
}
