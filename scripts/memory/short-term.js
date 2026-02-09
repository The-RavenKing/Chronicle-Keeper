/**
 * Chronicle Keeper - Short-term Memory
 * Manages the recent conversation buffer
 * 
 * @module memory/short-term
 */

import { MODULE_ID, MODULE_NAME } from '../main.js';

/**
 * Short-term memory store
 * Ring buffer of recent messages for immediate context
 */
export class ShortTermMemory {
    constructor() {
        /** @type {Array} */
        this.messages = [];

        /** @type {number} */
        this.maxSize = 50;
    }

    /**
     * Get current size of memory
     * @returns {number}
     */
    get size() {
        return this.messages.length;
    }

    /**
     * Load memories from Foundry storage
     */
    async load() {
        try {
            this.messages = game.settings.get(MODULE_ID, 'shortTermMemory') || [];
            console.log(`${MODULE_NAME} | Loaded ${this.messages.length} short-term memories`);
        } catch (error) {
            console.warn(`${MODULE_NAME} | Could not load short-term memory:`, error);
            this.messages = [];
        }
    }

    /**
     * Save memories to Foundry storage
     */
    async save() {
        try {
            await game.settings.set(MODULE_ID, 'shortTermMemory', this.messages);
        } catch (error) {
            console.error(`${MODULE_NAME} | Failed to save short-term memory:`, error);
        }
    }

    /**
     * Add a message to memory
     * @param {Object} message - Message object with role, content, timestamp
     */
    async add(message) {
        this.messages.push({
            id: `stm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp || Date.now(),
            speaker: message.speaker || null,
            actorId: message.actorId || null
        });

        // Enforce max size
        if (this.messages.length > this.maxSize) {
            this.messages = this.messages.slice(-this.maxSize);
        }

        await this.save();
    }

    /**
     * Get recent messages
     * @param {number} [count] - Number of messages to retrieve
     * @returns {Array} Recent messages
     */
    getRecent(count = 20) {
        return this.messages.slice(-count);
    }

    /**
     * Get all messages
     * @returns {Array}
     */
    getAll() {
        return [...this.messages];
    }

    /**
     * Remove oldest messages
     * @param {number} count - Number of messages to remove
     */
    async removeOldest(count) {
        this.messages = this.messages.slice(count);
        await this.save();
    }

    /**
     * Clear all short-term memory
     */
    async clear() {
        this.messages = [];
        await this.save();
    }

    /**
     * Search messages by content
     * @param {string} query - Search query
     * @returns {Array} Matching messages
     */
    search(query) {
        const queryLower = query.toLowerCase();
        return this.messages.filter(msg =>
            msg.content.toLowerCase().includes(queryLower)
        ).map(msg => ({
            ...msg,
            score: this._calculateRelevance(msg.content, query)
        }));
    }

    /**
     * Calculate simple relevance score
     * @param {string} content - Content to score
     * @param {string} query - Search query
     * @returns {number} Relevance score 0-1
     * @private
     */
    _calculateRelevance(content, query) {
        const contentLower = content.toLowerCase();
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/);

        let matches = 0;
        for (const word of queryWords) {
            if (contentLower.includes(word)) {
                matches++;
            }
        }

        return matches / queryWords.length;
    }

    /**
     * Import messages
     * @param {Array} messages - Messages to import
     */
    async import(messages) {
        this.messages = messages;
        await this.save();
    }

    /**
     * Update max size setting
     * @param {number} size - New max size
     */
    setMaxSize(size) {
        this.maxSize = size;
        if (this.messages.length > this.maxSize) {
            this.messages = this.messages.slice(-this.maxSize);
        }
    }
}
