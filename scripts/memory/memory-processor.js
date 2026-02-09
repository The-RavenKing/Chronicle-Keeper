/**
 * Chronicle Keeper - Memory Processor
 * Analyzes conversation history to extract structured updates for entities
 * 
 * @module memory/memory-processor
 */

import { MODULE_ID, MODULE_NAME } from '../main.js';
import { OllamaService } from '../ollama-service.js';
import { ChronicleKeeperSettings } from '../settings.js';

export class MemoryProcessor {
    /**
     * @param {Object} dependencies
     * @param {OllamaService} dependencies.ollama
     * @param {import('./entity-memory.js').EntityMemory} dependencies.entities
     */
    constructor({ ollama, entities }) {
        this.ollama = ollama;
        this.entities = entities;
        this.processing = false;
    }

    /**
     * Analyze recent conversation for entity updates
     * @param {Array} history - Recent conversation history
     * @param {Object} contextEntities - Entities currently in context
     */
    async processConversation(history, contextEntities) {
        if (this.processing || !this.ollama?.connected) return;

        // Only process if we have enough history
        if (!history || history.length < 2) return;

        this.processing = true;
        console.log(`${MODULE_NAME} | Processing conversation for entity updates...`);

        try {
            const updates = await this._extractUpdates(history, contextEntities);

            if (updates) {
                await this._applyUpdates(updates);
            }
        } catch (error) {
            console.error(`${MODULE_NAME} | Memory processing error:`, error);
        } finally {
            this.processing = false;
        }
    }

    /**
     * Extract updates using LLM
     * @private
     */
    async _extractUpdates(history, contextEntities) {
        const entityNames = this._formatEntityList(contextEntities);
        const conversationText = history.map(m => `${m.role}: ${m.content}`).join('\n');

        const systemPrompt = `You are a data extractor for a tabletop RPG. 
Analyze the conversation below and identify any CHANGES to the characters/entities listed.
Focus on:
1. New relationships or changes in existing ones (e.g., "now trusts the player", "is angry at X").
2. New personality traits revealed.
3. Important new facts or notes.
4. Changes in loyalty, motivation, or status.

Entities in scene: ${entityNames}

Return ONLY a JSON object with this structure:
{
    "updates": [
        {
            "name": "Entity Name",
            "type": "npc|location|item|faction",
            "changes": {
                "personality": "new trait",
                "motivation": "new motivation",
                "notes": "new fact to append",
                "relationships": [
                    { "targetId": "Target Name", "relationship": "Description of relationship" }
                ]
            }
        }
    ]
}
If no significant changes occurred, return { "updates": [] }.
Do not include unchanged fields. "notes" should be a short addition to their history.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: conversationText }
        ];

        try {
            // Note: We use a lower temperature for extraction to ensure valid JSON
            // We also need to handle the case where format: 'json' might not be supported by all models,
            // but we'll assume a capable model or that it outputs JSON-like text we can parse.
            const response = await this.ollama.chat({
                model: ChronicleKeeperSettings.model || 'llama3:8b',
                messages,
                temperature: 0.1,
                format: 'json',
                maxTokens: 512
            });

            if (!response) return null;

            // Parse valid JSON
            try {
                return JSON.parse(response);
            } catch (e) {
                console.warn(`${MODULE_NAME} | Failed to parse memory updates JSON:`, response);
                return null;
            }

        } catch (error) {
            console.error(`${MODULE_NAME} | Extraction error:`, error);
            return null;
        }
    }

    /**
     * Apply extracted updates to EntityMemory
     * @private
     */
    async _applyUpdates(data) {
        if (!data || !data.updates || !Array.isArray(data.updates)) return;

        let updateCount = 0;

        for (const update of data.updates) {
            if (!update.name) continue;

            const type = (update.type === 'npc' ? 'npcs' :
                update.type === 'location' ? 'locations' :
                    update.type === 'item' ? 'items' : 'factions');

            // Find existing entity
            const existing = this.entities.get(type, update.name);

            // For now, we only update EXISTING entities to avoid pollution
            if (!existing) {
                console.log(`${MODULE_NAME} | Skipping update for unknown entity: ${update.name}`);
                continue;
            }

            const changes = update.changes || {};
            let hasChanges = false;
            let newNotes = existing.notes || '';

            // 1. Update simple fields if provided
            if (changes.personality && changes.personality !== existing.personality) {
                existing.personality = changes.personality;
                hasChanges = true;
            }
            if (changes.motivation && changes.motivation !== existing.motivation) {
                existing.motivation = changes.motivation;
                hasChanges = true;
            }

            // 2. Handle notes
            if (changes.notes) {
                const timestamp = new Date().toLocaleTimeString();
                newNotes += `\n[${timestamp}] ${changes.notes}`;
                existing.notes = newNotes;
                hasChanges = true;
            }

            // 3. Update relationships
            if (changes.relationships && Array.isArray(changes.relationships)) {
                for (const rel of changes.relationships) {
                    await this.entities.updateRelationship(existing.id, rel.targetId, rel.relationship);
                    hasChanges = true;
                }
            }

            // 4. Save main entity update if needed
            if (hasChanges) {
                await this.entities.upsert(type, existing);
                updateCount++;
                console.log(`${MODULE_NAME} | Updated entity ${existing.name}:`, changes);
            }
        }

        if (updateCount > 0) {
            ui.notifications.info(`${MODULE_NAME}: Updated ${updateCount} entities based on conversation.`);
        }
    }

    /**
     * Format list of entities for context
     * @private
     */
    _formatEntityList(entities) {
        if (!entities) return 'None';
        const names = [];
        // Extract names from different entity types if they exist in the context object
        if (entities.npcs && Array.isArray(entities.npcs)) {
            names.push(...entities.npcs.map(e => `${e.name} (NPC)`));
        }
        if (entities.locations && Array.isArray(entities.locations)) {
            names.push(...entities.locations.map(e => `${e.name} (Location)`));
        }
        return names.join(', ') || 'None';
    }
}
