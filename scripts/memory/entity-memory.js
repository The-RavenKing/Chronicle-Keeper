/**
 * Chronicle Keeper - Entity Memory
 * Structured storage for NPCs, locations, items, and factions
 * 
 * @module memory/entity-memory
 */

import { MODULE_ID, MODULE_NAME } from '../main.js';

/**
 * Entity memory store
 * Manages structured data for game entities
 */
export class EntityMemory {
    constructor() {
        /** @type {Object} */
        this.entities = {
            npcs: [],
            locations: [],
            items: [],
            factions: []
        };
    }

    /**
     * Load entities from Foundry storage
     */
    async load() {
        try {
            const stored = game.settings.get(MODULE_ID, 'entities');
            if (stored) {
                this.entities = {
                    npcs: stored.npcs || [],
                    locations: stored.locations || [],
                    items: stored.items || [],
                    factions: stored.factions || []
                };
            }

            const totalCount = Object.values(this.entities).reduce((sum, arr) => sum + arr.length, 0);
            console.log(`${MODULE_NAME} | Loaded ${totalCount} entities`);
        } catch (error) {
            console.warn(`${MODULE_NAME} | Could not load entities:`, error);
        }
    }

    /**
     * Save entities to Foundry storage
     */
    async save() {
        try {
            await game.settings.set(MODULE_ID, 'entities', this.entities);
        } catch (error) {
            console.error(`${MODULE_NAME} | Failed to save entities:`, error);
        }
    }

    /**
     * Add or update an entity
     * @param {string} type - Entity type (npcs, locations, items, factions)
     * @param {Object} entity - Entity data
     */
    async upsert(type, entity) {
        if (!this.entities[type]) {
            throw new Error(`Invalid entity type: ${type}`);
        }

        const index = this.entities[type].findIndex(e => e.id === entity.id || e.name === entity.name);

        if (index !== -1) {
            // Update existing
            this.entities[type][index] = {
                ...this.entities[type][index],
                ...entity,
                updatedAt: Date.now()
            };
        } else {
            // Add new
            this.entities[type].push({
                id: entity.id || `${type}_${Date.now()}`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                ...entity
            });
        }

        await this.save();
    }

    /**
     * Get entity by ID or name
     * @param {string} type - Entity type
     * @param {string} identifier - ID or name
     * @returns {Object|null}
     */
    get(type, identifier) {
        if (!this.entities[type]) return null;

        return this.entities[type].find(e =>
            e.id === identifier || e.name?.toLowerCase() === identifier.toLowerCase()
        ) || null;
    }

    /**
     * Get all entities of a type
     * @param {string} type - Entity type
     * @returns {Array}
     */
    getAll(type) {
        return this.entities[type] || [];
    }

    /**
     * Delete an entity
     * @param {string} type - Entity type
     * @param {string} id - Entity ID
     */
    async delete(type, id) {
        if (!this.entities[type]) return;

        this.entities[type] = this.entities[type].filter(e => e.id !== id);
        await this.save();
    }

    /**
     * Search across all entity types
     * @param {string} query - Search query
     * @returns {Array} Matching entities with type info
     */
    search(query) {
        const queryLower = query.toLowerCase();
        // Common stop words to ignore
        const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'who', 'where',
            'when', 'how', 'which', 'that', 'this', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
            'and', 'or', 'but', 'not', 'it', 'its', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might'];
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
        const results = [];

        for (const [type, entities] of Object.entries(this.entities)) {
            for (const entity of entities) {
                const nameLower = entity.name?.toLowerCase() || '';

                // Check 1: Exact name in query ("who is Borin" contains "borin")
                const nameInQuery = queryLower.includes(nameLower);

                // Check 2: Query inside entity text (Old strict match)
                const searchable = [
                    entity.name,
                    entity.description,
                    entity.notes,
                    entity.personality,
                    entity.goals,
                    entity.features
                ].filter(Boolean).join(' ').toLowerCase();

                const queryInEntity = searchable.includes(queryLower);

                // Check 3: Keyword overlap
                const wordMatches = queryWords.filter(w => searchable.includes(w)).length;

                if (nameInQuery || queryInEntity || wordMatches > 0) {
                    results.push({
                        ...entity,
                        entityType: type,
                        score: this._calculateEntityScore(entity, query)
                    });
                }
            }
        }

        return results.sort((a, b) => b.score - a.score);
    }

    /**
     * Calculate relevance score for entity
     * @param {Object} entity - Entity to score
     * @param {string} query - Search query
     * @returns {number} Score
     * @private
     */
    _calculateEntityScore(entity, query) {
        const queryLower = query.toLowerCase();
        const nameLower = entity.name?.toLowerCase() || '';
        let score = 0;

        // Name is IN the query ("who is Borin" -> matches "Borin") - Highest Priority
        if (nameLower && queryLower.includes(nameLower)) {
            score += 10.0;
        }

        // Exact name match
        if (nameLower === queryLower) {
            score += 5.0;
        }

        // Description match
        if (entity.description?.toLowerCase().includes(queryLower)) {
            score += 2.0;
        }

        // Keyword matches
        const words = queryLower.split(/\s+/).filter(w => w.length > 2);
        for (const word of words) {
            if (nameLower.includes(word)) score += 1.0;
            if (entity.description?.toLowerCase().includes(word)) score += 0.5;
        }

        return score;
    }

    /**
     * Add an NPC
     * @param {Object} npc - NPC data
     */
    async addNPC(npc) {
        await this.upsert('npcs', {
            name: npc.name,
            description: npc.description || '',
            personality: npc.personality || '',
            motivation: npc.motivation || '',
            relationships: npc.relationships || [],
            notes: npc.notes || '',
            location: npc.location || null,
            faction: npc.faction || null,
            status: npc.status || 'alive',
            ...npc
        });
    }

    /**
     * Add a location
     * @param {Object} location - Location data
     */
    async addLocation(location) {
        await this.upsert('locations', {
            name: location.name,
            description: location.description || '',
            features: location.features || '',
            npcs: location.npcs || [],
            items: location.items || [],
            connections: location.connections || [],
            notes: location.notes || '',
            visited: location.visited || false,
            ...location
        });
    }

    /**
     * Add an item
     * @param {Object} item - Item data
     */
    async addItem(item) {
        await this.upsert('items', {
            name: item.name,
            description: item.description || '',
            properties: item.properties || '',
            owner: item.owner || null,
            location: item.location || null,
            history: item.history || [],
            notes: item.notes || '',
            ...item
        });
    }

    /**
     * Add a faction
     * @param {Object} faction - Faction data
     */
    async addFaction(faction) {
        await this.upsert('factions', {
            name: faction.name,
            description: faction.description || '',
            goals: faction.goals || '',
            members: faction.members || [],
            relationships: faction.relationships || [],
            headquarters: faction.headquarters || null,
            notes: faction.notes || '',
            ...faction
        });
    }

    /**
     * Update NPC relationship
     * @param {string} npcId - NPC ID
     * @param {string} targetId - Target entity ID
     * @param {string} relationship - Relationship description
     */
    async updateRelationship(npcId, targetId, relationship) {
        const npc = this.get('npcs', npcId);
        if (!npc) return;

        const relationships = npc.relationships || [];
        const existing = relationships.findIndex(r => r.targetId === targetId);

        if (existing !== -1) {
            relationships[existing] = { targetId, relationship, updatedAt: Date.now() };
        } else {
            relationships.push({ targetId, relationship, createdAt: Date.now() });
        }

        await this.upsert('npcs', { ...npc, relationships });
    }

    /**
     * Get NPCs at a location
     * @param {string} locationId - Location ID or name
     * @returns {Array} NPCs at that location
     */
    getNPCsAtLocation(locationId) {
        return this.entities.npcs.filter(npc =>
            npc.location === locationId || npc.location?.toLowerCase() === locationId.toLowerCase()
        );
    }

    /**
     * Get faction members
     * @param {string} factionId - Faction ID or name
     * @returns {Array} NPCs in that faction
     */
    getFactionMembers(factionId) {
        return this.entities.npcs.filter(npc =>
            npc.faction === factionId || npc.faction?.toLowerCase() === factionId.toLowerCase()
        );
    }

    /**
     * Export all entities
     * @returns {Object}
     */
    export() {
        return { ...this.entities };
    }

    /**
     * Import entities
     * @param {Object} data - Entity data to import
     */
    async import(data) {
        if (data.npcs) this.entities.npcs = data.npcs;
        if (data.locations) this.entities.locations = data.locations;
        if (data.items) this.entities.items = data.items;
        if (data.factions) this.entities.factions = data.factions;
        await this.save();
    }

    /**
     * Clear all entities
     */
    async clear() {
        this.entities = {
            npcs: [],
            locations: [],
            items: [],
            factions: []
        };
        await this.save();
    }
}
