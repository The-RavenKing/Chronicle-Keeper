/**
 * Chronicle Keeper - Long-term Memory
 * Persistent storage for important story beats and facts
 * 
 * @module memory/long-term
 */

import { MODULE_ID, MODULE_NAME } from '../main.js';

/**
 * Long-term memory store
 * Persistent storage for story beats, quest progress, relationships, etc.
 */
export class LongTermMemory {
    constructor() {
        /** @type {Array} */
        this.memories = [];
    }

    /**
     * Get memory count
     * @returns {number}
     */
    get size() {
        return this.memories.length;
    }

    /**
     * Load memories from Foundry storage
     */
    async load() {
        try {
            this.memories = game.settings.get(MODULE_ID, 'longTermMemory') || [];
            console.log(`${MODULE_NAME} | Loaded ${this.memories.length} long-term memories`);
        } catch (error) {
            console.warn(`${MODULE_NAME} | Could not load long-term memory:`, error);
            this.memories = [];
        }
    }

    /**
     * Save memories to Foundry storage
     */
    async save() {
        try {
            await game.settings.set(MODULE_ID, 'longTermMemory', this.memories);
        } catch (error) {
            console.error(`${MODULE_NAME} | Failed to save long-term memory:`, error);
        }
    }

    /**
     * Add a memory
     * @param {Object} memory - Memory object
     */
    async add(memory) {
        const memoryEntry = {
            id: `ltm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: memory.content,
            type: memory.type || 'story_beat',
            timestamp: memory.timestamp || Date.now(),
            importance: memory.importance || 'medium',
            tags: memory.tags || [],
            relatedEntities: memory.relatedEntities || [],
            ...memory
        };

        this.memories.push(memoryEntry);
        await this.save();
    }

    /**
     * Get memories by type
     * @param {string} type - Memory type
     * @returns {Array} Matching memories
     */
    getByType(type) {
        return this.memories.filter(m => m.type === type);
    }

    /**
     * Get recent memories
     * @param {number} [count] - Number to retrieve
     * @returns {Array}
     */
    getRecent(count = 10) {
        return this.memories
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, count);
    }

    /**
     * Get memories by importance
     * @param {string} importance - 'high', 'medium', 'low'
     * @returns {Array}
     */
    getByImportance(importance) {
        return this.memories.filter(m => m.importance === importance);
    }

    /**
     * Get all memories
     * @returns {Array}
     */
    getAll() {
        return [...this.memories];
    }

    /**
     * Update a memory
     * @param {string} id - Memory ID
     * @param {Object} updates - Fields to update
     */
    async update(id, updates) {
        const index = this.memories.findIndex(m => m.id === id);
        if (index !== -1) {
            this.memories[index] = {
                ...this.memories[index],
                ...updates,
                updatedAt: Date.now()
            };
            await this.save();
        }
    }

    /**
     * Delete a memory
     * @param {string} id - Memory ID
     */
    async delete(id) {
        this.memories = this.memories.filter(m => m.id !== id);
        await this.save();
    }

    /**
     * Search memories
     * @param {string} query - Search query
     * @returns {Array} Matching memories with scores
     */
    search(query) {
        const queryLower = query.toLowerCase();
        // Common stop words to ignore
        const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'who', 'where',
            'when', 'how', 'which', 'that', 'this', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
            'and', 'or', 'but', 'not', 'it', 'its', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might'];
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

        return this.memories
            .map(memory => {
                const content = memory.content.toLowerCase();
                let score = 0;

                // Word matches (only meaningful words)
                for (const word of queryWords) {
                    if (content.includes(word)) {
                        score += 0.3;
                    }
                }

                // Importance boost
                if (memory.importance === 'high') score += 0.2;
                else if (memory.importance === 'medium') score += 0.1;

                // Recency boost (decay over time)
                const ageHours = (Date.now() - memory.timestamp) / (1000 * 60 * 60);
                const recencyBoost = Math.max(0, 0.1 - (ageHours / 1000));
                score += recencyBoost;

                return { ...memory, score };
            })
            .filter(m => m.score > 0.3)  // Require at least one meaningful word match
            .sort((a, b) => b.score - a.score);
    }

    /**
     * Archive old memories
     * Moves memories older than threshold to archive
     * @param {number} daysOld - Days threshold
     */
    async archive(daysOld = 30) {
        const threshold = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        const toArchive = this.memories.filter(m =>
            m.timestamp < threshold && m.importance !== 'high'
        );

        // Mark as archived
        for (const memory of toArchive) {
            memory.archived = true;
        }

        await this.save();
        return toArchive.length;
    }

    /**
     * Prune low-importance archived memories
     * @param {number} maxArchived - Maximum archived memories to keep
     */
    async prune(maxArchived = 100) {
        const archived = this.memories.filter(m => m.archived);

        if (archived.length > maxArchived) {
            // Sort by importance (keep high), then by timestamp (keep recent)
            const sortedArchived = archived.sort((a, b) => {
                if (a.importance === 'high' && b.importance !== 'high') return -1;
                if (b.importance === 'high' && a.importance !== 'high') return 1;
                return b.timestamp - a.timestamp;
            });

            const toRemove = sortedArchived.slice(maxArchived);
            const removeIds = new Set(toRemove.map(m => m.id));

            this.memories = this.memories.filter(m => !removeIds.has(m.id));
            await this.save();

            return toRemove.length;
        }

        return 0;
    }

    /**
     * Import memories
     * @param {Array} memories - Memories to import
     */
    async import(memories) {
        this.memories = memories;
        await this.save();
    }

    /**
     * Clear all memories
     */
    async clear() {
        this.memories = [];
        await this.save();
    }
}
