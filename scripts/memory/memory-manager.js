/**
 * Chronicle Keeper - Memory Manager
 * Central orchestrator for all memory subsystems
 * 
 * @module memory/memory-manager
 */

import { MODULE_ID, MODULE_NAME, getSetting } from '../main.js';
import { ShortTermMemory } from './short-term.js';
import { LongTermMemory } from './long-term.js';
import { EntityMemory } from './entity-memory.js';
import { VectorStore } from './vector-store.js';
import { Summarizer } from './summarizer.js';

/**
 * Memory types enumeration
 * @enum {string}
 */
export const MemoryType = {
    CONVERSATION: 'conversation',
    STORY_BEAT: 'story_beat',
    QUEST_PROGRESS: 'quest_progress',
    RELATIONSHIP: 'relationship',
    SESSION_SUMMARY: 'session_summary',
    WORLD_FACT: 'world_fact'
};

/**
 * Entity types enumeration
 * @enum {string}
 */
export const EntityType = {
    NPC: 'npcs',
    LOCATION: 'locations',
    ITEM: 'items',
    FACTION: 'factions'
};

/**
 * Central memory management system
 * Coordinates between different memory stores and provides
 * unified access to all memories
 */
export class MemoryManager {
    constructor() {
        /** @type {ShortTermMemory} */
        this.shortTerm = new ShortTermMemory();

        /** @type {LongTermMemory} */
        this.longTerm = new LongTermMemory();

        /** @type {EntityMemory} */
        this.entities = new EntityMemory();

        /** @type {VectorStore} */
        this.vectorStore = new VectorStore();

        /** @type {Summarizer} */
        this.summarizer = new Summarizer();

        /** @type {boolean} */
        this.initialized = false;
    }

    /**
     * Initialize the memory system
     * Loads all stored memories from Foundry's storage
     */
    async initialize() {
        console.log(`${MODULE_NAME} | Initializing memory system...`);

        try {
            // Load all memory stores
            await Promise.all([
                this.shortTerm.load(),
                this.longTerm.load(),
                this.entities.load(),
                this.vectorStore.load()
            ]);

            this.initialized = true;
            console.log(`${MODULE_NAME} | Memory system initialized`);

        } catch (error) {
            console.error(`${MODULE_NAME} | Memory initialization error:`, error);
            throw error;
        }
    }

    /**
     * Add a message to short-term memory
     * @param {string} role - 'user' or 'assistant'
     * @param {string} content - Message content
     * @param {Object} [metadata] - Additional metadata
     */
    async addMessage(role, content, metadata = {}) {
        const message = {
            role,
            content,
            timestamp: Date.now(),
            ...metadata
        };

        await this.shortTerm.add(message);

        // Check if we need to summarize
        const threshold = getSetting('summarizationThreshold');
        if (this.shortTerm.size >= threshold) {
            await this.triggerSummarization();
        }

        // Generate embedding for vector search
        await this.vectorStore.addEntry({
            id: `msg_${Date.now()}`,
            content,
            type: MemoryType.CONVERSATION,
            timestamp: Date.now()
        });
    }

    /**
     * Add a story beat to long-term memory
     * @param {string} content - Story beat description
     * @param {MemoryType} type - Type of memory
     * @param {Object} [metadata] - Additional metadata
     */
    async addStoryBeat(content, type = MemoryType.STORY_BEAT, metadata = {}) {
        const memory = {
            content,
            type,
            timestamp: Date.now(),
            importance: metadata.importance || 'medium',
            ...metadata
        };

        await this.longTerm.add(memory);

        // Also add to vector store for semantic search
        await this.vectorStore.addEntry({
            id: `story_${Date.now()}`,
            content,
            type,
            timestamp: Date.now()
        });
    }

    /**
     * Add or update an entity
     * @param {EntityType} type - Type of entity
     * @param {Object} entity - Entity data
     */
    async addEntity(type, entity) {
        const entityWithMeta = {
            ...entity,
            id: entity.id || `${type}_${Date.now()}`,
            createdAt: entity.createdAt || Date.now(),
            updatedAt: Date.now()
        };

        await this.entities.upsert(type, entityWithMeta);

        // Add entity description to vector store
        const description = this._formatEntityDescription(type, entityWithMeta);
        await this.vectorStore.addEntry({
            id: entityWithMeta.id,
            content: description,
            type: `entity_${type}`,
            timestamp: Date.now()
        });
    }

    /**
     * Format an entity description for embedding
     * @param {EntityType} type - Entity type
     * @param {Object} entity - Entity data
     * @returns {string} Formatted description
     * @private
     */
    _formatEntityDescription(type, entity) {
        switch (type) {
            case EntityType.NPC:
                return `NPC: ${entity.name}. ${entity.description || ''} Personality: ${entity.personality || 'unknown'}. ${entity.notes || ''}`;
            case EntityType.LOCATION:
                return `Location: ${entity.name}. ${entity.description || ''} Notable features: ${entity.features || 'none noted'}. ${entity.notes || ''}`;
            case EntityType.ITEM:
                return `Item: ${entity.name}. ${entity.description || ''} Properties: ${entity.properties || 'none'}. ${entity.notes || ''}`;
            case EntityType.FACTION:
                return `Faction: ${entity.name}. ${entity.description || ''} Goals: ${entity.goals || 'unknown'}. ${entity.notes || ''}`;
            default:
                return `${entity.name}: ${entity.description || ''}`;
        }
    }

    /**
     * Retrieve context for an AI prompt
     * Combines relevant memories from all sources
     * @param {string} currentMessage - The current user message
     * @param {Object} [options] - Retrieval options
     * @returns {Promise<Object>} Context object
     */
    async getContext(currentMessage, options = {}) {
        const {
            includeShortTerm = true,
            includeLongTerm = true,
            includeEntities = true,
            includeSemanticSearch = true,
            maxShortTerm = null,
            maxLongTerm = 5,
            maxSemanticResults = 5
        } = options;

        const context = {
            shortTermMemory: [],
            longTermMemory: [],
            entities: {
                npcs: [],
                locations: [],
                items: [],
                factions: []
            },
            semanticResults: [],
            sessionSummary: null
        };

        // Get short-term memory (recent conversation)
        if (includeShortTerm) {
            const limit = maxShortTerm || getSetting('shortTermMemorySize');
            context.shortTermMemory = this.shortTerm.getRecent(limit);
        }

        // Get relevant long-term memories
        if (includeLongTerm) {
            context.longTermMemory = this.longTerm.getRecent(maxLongTerm);
        }

        // Get entities mentioned in current context
        if (includeEntities) {
            const mentionedEntities = await this._findMentionedEntities(currentMessage);
            context.entities = mentionedEntities;
        }

        // Semantic search for relevant memories
        if (includeSemanticSearch) {
            try {
                context.semanticResults = await this.vectorStore.search(currentMessage, maxSemanticResults);
            } catch (error) {
                console.warn(`${MODULE_NAME} | Semantic search failed:`, error);
            }
        }

        // Get most recent session summary
        const summaries = await this._getSessionSummaries();
        if (summaries.length > 0) {
            context.sessionSummary = summaries[summaries.length - 1];
        }

        return context;
    }

    /**
     * Find entities mentioned in text
     * @param {string} text - Text to search
     * @returns {Promise<Object>} Mentioned entities by type
     * @private
     */
    async _findMentionedEntities(text) {
        const textLower = text.toLowerCase();
        const result = {
            npcs: [],
            locations: [],
            items: [],
            factions: []
        };

        for (const type of Object.values(EntityType)) {
            const entities = this.entities.getAll(type);
            for (const entity of entities) {
                if (entity.name && textLower.includes(entity.name.toLowerCase())) {
                    result[type].push(entity);
                }
            }
        }

        return result;
    }

    /**
     * Get session summaries from storage
     * @returns {Promise<Array>}
     * @private
     */
    async _getSessionSummaries() {
        try {
            return game.settings.get(MODULE_ID, 'sessionSummaries') || [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Trigger summarization of old short-term memories
     */
    async triggerSummarization() {
        console.log(`${MODULE_NAME} | Triggering memory summarization...`);

        try {
            // Get messages to summarize (older half)
            const messages = this.shortTerm.getAll();
            const halfPoint = Math.floor(messages.length / 2);
            const toSummarize = messages.slice(0, halfPoint);

            if (toSummarize.length < 10) {
                return; // Not enough to summarize
            }

            // Generate summary
            const summary = await this.summarizer.summarize(toSummarize);

            if (summary) {
                // Save summary to long-term memory
                await this.addStoryBeat(summary, MemoryType.SESSION_SUMMARY, {
                    importance: 'high',
                    messageCount: toSummarize.length
                });

                // Remove summarized messages from short-term
                await this.shortTerm.removeOldest(halfPoint);

                console.log(`${MODULE_NAME} | Summarized ${toSummarize.length} messages`);
            }

        } catch (error) {
            console.error(`${MODULE_NAME} | Summarization error:`, error);
        }
    }

    /**
     * Format context for injection into AI prompt
     * @param {Object} context - Context from getContext()
     * @returns {string} Formatted context string
     */
    formatContextForPrompt(context) {
        const sections = [];

        // Session summary
        if (context.sessionSummary) {
            sections.push(`## Previous Session Summary\n${context.sessionSummary.content}`);
        }

        // Important entities
        const allEntities = [
            ...context.entities.npcs,
            ...context.entities.locations,
            ...context.entities.items,
            ...context.entities.factions
        ];

        if (allEntities.length > 0) {
            const entityLines = allEntities.map(e => `- **${e.name}**: ${e.description || 'No description'}`);
            sections.push(`## Relevant Entities\n${entityLines.join('\n')}`);
        }

        // Long-term memories
        if (context.longTermMemory.length > 0) {
            const memoryLines = context.longTermMemory.map(m => `- ${m.content}`);
            sections.push(`## Important Story Points\n${memoryLines.join('\n')}`);
        }

        // Semantic search results (if different from above)
        if (context.semanticResults.length > 0) {
            const semanticLines = context.semanticResults
                .filter(r => !r.content.startsWith('NPC:') && !r.content.startsWith('Location:'))
                .slice(0, 3)
                .map(r => `- ${r.content}`);

            if (semanticLines.length > 0) {
                sections.push(`## Related Context\n${semanticLines.join('\n')}`);
            }
        }

        return sections.join('\n\n');
    }

    /**
     * Get conversation history formatted for Ollama
     * @returns {Array} Messages array for Ollama chat
     */
    getConversationHistory() {
        return this.shortTerm.getAll().map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    /**
     * Clear all short-term memory
     */
    async clearShortTerm() {
        await this.shortTerm.clear();
        console.log(`${MODULE_NAME} | Short-term memory cleared`);
    }

    /**
     * Search all memories
     * @param {string} query - Search query
     * @returns {Promise<Array>} Search results
     */
    async search(query) {
        const results = [];

        // Search short-term
        const shortTermResults = this.shortTerm.search(query);
        results.push(...shortTermResults.map(r => ({ ...r, source: 'short-term' })));

        // Search long-term
        const longTermResults = this.longTerm.search(query);
        results.push(...longTermResults.map(r => ({ ...r, source: 'long-term' })));

        // Search entities
        const entityResults = this.entities.search(query);
        results.push(...entityResults.map(r => ({ ...r, source: 'entities' })));

        // Semantic search
        try {
            const semanticResults = await this.vectorStore.search(query, 5);
            results.push(...semanticResults.map(r => ({ ...r, source: 'semantic' })));
        } catch (error) {
            console.warn(`${MODULE_NAME} | Semantic search failed:`, error);
        }

        // Sort by relevance/timestamp
        return results.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    /**
     * Save all memories to storage
     */
    async save() {
        await Promise.all([
            this.shortTerm.save(),
            this.longTerm.save(),
            this.entities.save(),
            this.vectorStore.save()
        ]);
    }

    /**
     * Load all memories from storage
     */
    async load() {
        await this.initialize();
    }

    /**
     * Export all memories as JSON
     * @returns {Object} All memories
     */
    export() {
        return {
            shortTerm: this.shortTerm.getAll(),
            longTerm: this.longTerm.getAll(),
            entities: this.entities.export(),
            exportedAt: Date.now()
        };
    }

    /**
     * Import memories from JSON
     * @param {Object} data - Exported memory data
     */
    async import(data) {
        if (data.shortTerm) {
            await this.shortTerm.import(data.shortTerm);
        }
        if (data.longTerm) {
            await this.longTerm.import(data.longTerm);
        }
        if (data.entities) {
            await this.entities.import(data.entities);
        }

        // Rebuild vector store
        await this.vectorStore.rebuild();

        console.log(`${MODULE_NAME} | Memories imported successfully`);
    }
}
