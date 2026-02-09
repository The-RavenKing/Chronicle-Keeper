/**
 * Chronicle Keeper - Scene Manager
 * Provides scene and journal awareness
 */

import { MODULE_ID, MODULE_NAME } from '../main.js';

/**
 * Scene and journal integration for AI context
 */
export class SceneManager {
    constructor() {
        this.currentScene = null;
        this.sceneHistory = [];
    }

    /**
     * Handle scene change
     * @param {Scene} scene - New active scene
     */
    onSceneChange(scene) {
        if (this.currentScene?.id !== scene?.id) {
            if (this.currentScene) {
                this.sceneHistory.push({
                    id: this.currentScene.id,
                    name: this.currentScene.name,
                    leftAt: Date.now()
                });
                // Keep last 10 scenes
                if (this.sceneHistory.length > 10) this.sceneHistory.shift();
            }
            this.currentScene = scene;
        }
    }

    /**
     * Get current scene context for AI
     * @returns {string}
     */
    getCurrentSceneContext() {
        const scene = game.scenes?.active || this.currentScene;
        if (!scene) return '';

        const lines = [];
        lines.push(`**Location: ${scene.name}**`);

        // Scene notes/description
        if (scene.description) {
            lines.push(scene.description);
        }

        // Active tokens (NPCs present)
        const tokens = scene.tokens?.filter(t => !t.hidden);
        if (tokens?.length) {
            const npcs = tokens.filter(t => !t.actor?.hasPlayerOwner).map(t => t.name);
            if (npcs.length) {
                lines.push(`NPCs present: ${npcs.slice(0, 5).join(', ')}`);
            }
        }

        // Weather/atmosphere if set
        if (scene.weather) {
            lines.push(`Weather: ${scene.weather}`);
        }

        return lines.join('\n');
    }

    /**
     * Get relevant journal entries for context
     * @param {string} [query] - Optional search query
     * @returns {Array}
     */
    getRelevantJournals(query = '') {
        const journals = game.journal?.contents || [];

        if (!query) {
            // Return recently viewed or scene-linked journals
            return journals
                .filter(j => j.getFlag(MODULE_ID, 'relevant') ||
                    this.currentScene?.journal?.id === j.id)
                .slice(0, 3);
        }

        // Search journals
        const queryLower = query.toLowerCase();
        return journals
            .filter(j => {
                const name = j.name?.toLowerCase() || '';
                const pages = j.pages?.map(p => p.text?.content || '').join(' ').toLowerCase() || '';
                return name.includes(queryLower) || pages.includes(queryLower);
            })
            .slice(0, 5);
    }

    /**
     * Get journal entry content
     * @param {string} journalId - Journal ID or name
     * @returns {string}
     */
    getJournalContent(journalId) {
        const journal = game.journal?.get(journalId) ||
            game.journal?.getName(journalId);

        if (!journal) return '';

        // Combine all text pages
        return journal.pages
            ?.filter(p => p.type === 'text')
            ?.map(p => p.text?.content || '')
            ?.join('\n\n') || '';
    }

    /**
     * Get location history
     * @returns {string}
     */
    getLocationHistory() {
        if (!this.sceneHistory.length) return '';

        return 'Previously visited:\n' +
            this.sceneHistory
                .slice(-5)
                .map(s => `- ${s.name}`)
                .join('\n');
    }

    /**
     * Find notes related to current context
     * @param {string} context - Current conversation context
     * @returns {Array}
     */
    findRelatedNotes(context) {
        if (!context) return [];

        const words = context.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const journals = game.journal?.contents || [];

        return journals
            .map(j => {
                let score = 0;
                const name = j.name?.toLowerCase() || '';
                const content = j.pages?.map(p => p.text?.content || '').join(' ').toLowerCase() || '';

                for (const word of words) {
                    if (name.includes(word)) score += 2;
                    if (content.includes(word)) score += 1;
                }

                return { journal: j, score };
            })
            .filter(j => j.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(j => j.journal);
    }

    /**
     * Create or update a location in entity memory
     * @param {Scene} scene 
     * @param {Object} memory - Memory manager reference
     */
    async saveLocationToMemory(scene, memory) {
        if (!scene || !memory) return;

        await memory.addEntity('locations', {
            name: scene.name,
            description: scene.description || '',
            sceneId: scene.id,
            visited: true,
            firstVisit: Date.now()
        });
    }

    /**
     * Get all scene names for entity matching
     * @returns {Array<string>}
     */
    getAllSceneNames() {
        return game.scenes?.map(s => s.name) || [];
    }
}
