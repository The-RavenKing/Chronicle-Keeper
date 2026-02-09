/**
 * Chronicle Keeper - Settings Module
 * Handles all module configuration and settings registration
 * 
 * @module settings
 */

import { MODULE_ID, MODULE_NAME } from './main.js';

/**
 * Default system prompt for the AI Dungeon Master
 * @constant {string}
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Chronicle Keeper, an expert AI Dungeon Master for tabletop roleplaying games. You create immersive, dynamic narratives that adapt to player choices.

CORE RESPONSIBILITIES:
- Narrate scenes vividly with sensory details
- Voice NPCs with distinct personalities and motivations
- Describe combat dramatically while respecting game mechanics
- Track story continuity and remember past events
- Present meaningful choices and consequences
- Balance challenge with fun

STYLE GUIDELINES:
- Use second person ("You see...", "You feel...") for player actions
- Use third person for NPC actions and world events
- Keep responses concise but evocative (2-4 paragraphs typically)
- Ask clarifying questions when player intent is unclear
- Reference character abilities, items, and backstories when relevant

GAME RULES:
- Respect the game system's mechanics (D&D 5e by default)
- Suggest skill checks when appropriate
- Don't determine outcomes of dice rolls - describe the attempt
- After a roll, describe the result dramatically

MEMORY:
You have access to memories of past sessions and important story elements. Reference these to maintain continuity and make the world feel alive.`;

/**
 * Settings configuration object
 * @type {Object}
 */
export const SETTINGS_CONFIG = {
    // Connection Settings
    ollamaUrl: {
        name: 'CHRONICLE_KEEPER.Settings.OllamaUrl.Name',
        hint: 'CHRONICLE_KEEPER.Settings.OllamaUrl.Hint',
        scope: 'world',
        config: true,
        type: String,
        default: 'http://localhost:11434',
        requiresReload: false
    },

    model: {
        name: 'CHRONICLE_KEEPER.Settings.Model.Name',
        hint: 'CHRONICLE_KEEPER.Settings.Model.Hint',
        scope: 'world',
        config: true,
        type: String,
        default: 'llama3:8b',
        choices: {}, // Populated dynamically
        requiresReload: false
    },

    embeddingModel: {
        name: 'CHRONICLE_KEEPER.Settings.EmbeddingModel.Name',
        hint: 'CHRONICLE_KEEPER.Settings.EmbeddingModel.Hint',
        scope: 'world',
        config: true,
        type: String,
        default: 'nomic-embed-text',
        requiresReload: false
    },

    // Generation Settings
    temperature: {
        name: 'CHRONICLE_KEEPER.Settings.Temperature.Name',
        hint: 'CHRONICLE_KEEPER.Settings.Temperature.Hint',
        scope: 'world',
        config: true,
        type: Number,
        default: 0.7,
        range: {
            min: 0,
            max: 1,
            step: 0.1
        },
        requiresReload: false
    },

    maxTokens: {
        name: 'CHRONICLE_KEEPER.Settings.MaxTokens.Name',
        hint: 'CHRONICLE_KEEPER.Settings.MaxTokens.Hint',
        scope: 'world',
        config: true,
        type: Number,
        default: 1024,
        range: {
            min: 256,
            max: 4096,
            step: 256
        },
        requiresReload: false
    },

    // Memory Settings
    shortTermMemorySize: {
        name: 'CHRONICLE_KEEPER.Settings.ShortTermMemorySize.Name',
        hint: 'CHRONICLE_KEEPER.Settings.ShortTermMemorySize.Hint',
        scope: 'world',
        config: true,
        type: Number,
        default: 30,
        range: {
            min: 10,
            max: 100,
            step: 5
        },
        requiresReload: false
    },

    memoryRetrievalCount: {
        name: 'CHRONICLE_KEEPER.Settings.MemoryRetrievalCount.Name',
        hint: 'CHRONICLE_KEEPER.Settings.MemoryRetrievalCount.Hint',
        scope: 'world',
        config: true,
        type: Number,
        default: 5,
        range: {
            min: 1,
            max: 20,
            step: 1
        },
        requiresReload: false
    },

    summarizationThreshold: {
        name: 'CHRONICLE_KEEPER.Settings.SummarizationThreshold.Name',
        hint: 'CHRONICLE_KEEPER.Settings.SummarizationThreshold.Hint',
        scope: 'world',
        config: true,
        type: Number,
        default: 50,
        range: {
            min: 20,
            max: 200,
            step: 10
        },
        requiresReload: false
    },

    // Feature Toggles
    dmEnabled: {
        name: 'CHRONICLE_KEEPER.Settings.DMEnabled.Name',
        hint: 'CHRONICLE_KEEPER.Settings.DMEnabled.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    },

    enableAutoNarration: {
        name: 'CHRONICLE_KEEPER.Settings.EnableAutoNarration.Name',
        hint: 'CHRONICLE_KEEPER.Settings.EnableAutoNarration.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    },

    enableCombatNarration: {
        name: 'CHRONICLE_KEEPER.Settings.EnableCombatNarration.Name',
        hint: 'CHRONICLE_KEEPER.Settings.EnableCombatNarration.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        requiresReload: false
    },

    // System Prompt
    systemPrompt: {
        name: 'CHRONICLE_KEEPER.Settings.SystemPrompt.Name',
        hint: 'CHRONICLE_KEEPER.Settings.SystemPrompt.Hint',
        scope: 'world',
        config: true,
        type: String,
        default: DEFAULT_SYSTEM_PROMPT,
        requiresReload: false
    }
};

/**
 * Non-config settings (stored but not shown in settings UI)
 * @type {Object}
 */
export const HIDDEN_SETTINGS = {
    // Short-term memory storage
    shortTermMemory: {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    },

    // Long-term memory storage
    longTermMemory: {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    },

    // Entity storage
    entities: {
        scope: 'world',
        config: false,
        type: Object,
        default: {
            npcs: [],
            locations: [],
            items: [],
            factions: []
        }
    },

    // Session summaries
    sessionSummaries: {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    },

    // Vector embeddings cache
    embeddings: {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    },

    // Last session timestamp
    lastSessionTimestamp: {
        scope: 'world',
        config: false,
        type: Number,
        default: 0
    }
};

/**
 * Register all module settings with Foundry
 */
export function registerSettings() {
    console.log(`${MODULE_NAME} | Registering settings...`);

    // Register menu for memory browser
    game.settings.registerMenu(MODULE_ID, 'memoryBrowser', {
        name: 'Memory Browser',
        label: 'Open Memory Browser',
        hint: 'View and manage stored memories, NPCs, locations, and other entities.',
        icon: 'fas fa-brain',
        type: MemoryBrowserApplication,
        restricted: true
    });

    // Register visible settings
    for (const [key, config] of Object.entries(SETTINGS_CONFIG)) {
        game.settings.register(MODULE_ID, key, config);
    }

    // Register hidden settings
    for (const [key, config] of Object.entries(HIDDEN_SETTINGS)) {
        game.settings.register(MODULE_ID, key, config);
    }

    console.log(`${MODULE_NAME} | Settings registered successfully`);
}

/**
 * Memory Browser Application
 * FormApplication for viewing and editing memories
 */
class MemoryBrowserApplication extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'chronicle-keeper-memory-browser',
            title: game.i18n.localize('CHRONICLE_KEEPER.Memory.Browser.Title'),
            template: `modules/${MODULE_ID}/templates/memory-browser.hbs`,
            classes: ['chronicle-keeper-memory-browser'],
            width: 700,
            height: 600,
            resizable: true,
            tabs: [{
                navSelector: '.tabs',
                contentSelector: '.tab-content',
                initial: 'short-term'
            }]
        });
    }

    async getData() {
        const shortTermMemory = game.settings.get(MODULE_ID, 'shortTermMemory') || [];
        const longTermMemory = game.settings.get(MODULE_ID, 'longTermMemory') || [];
        const entities = game.settings.get(MODULE_ID, 'entities') || { npcs: [], locations: [], items: [], factions: [] };
        const sessionSummaries = game.settings.get(MODULE_ID, 'sessionSummaries') || [];

        return {
            shortTermMemory: shortTermMemory.map((m, i) => ({ ...m, index: i })),
            longTermMemory: longTermMemory.map((m, i) => ({ ...m, index: i })),
            npcs: entities.npcs.map((e, i) => ({ ...e, index: i })),
            locations: entities.locations.map((e, i) => ({ ...e, index: i })),
            items: entities.items.map((e, i) => ({ ...e, index: i })),
            factions: entities.factions.map((e, i) => ({ ...e, index: i })),
            sessionSummaries: sessionSummaries.map((s, i) => ({ ...s, index: i }))
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Search functionality
        html.find('.search-input').on('input', this._onSearch.bind(this));

        // Delete buttons
        html.find('.delete-memory').on('click', this._onDeleteMemory.bind(this));

        // Edit buttons
        html.find('.edit-memory').on('click', this._onEditMemory.bind(this));

        // Add entity buttons
        html.find('.add-entity').on('click', this._onAddEntity.bind(this));

        // Clear all short-term
        html.find('.clear-short-term').on('click', this._onClearShortTerm.bind(this));
    }

    _onSearch(event) {
        const query = event.target.value.toLowerCase();
        const items = this.element.find('.memory-item, .entity-card');

        items.each((i, item) => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? '' : 'none';
        });
    }

    async _onDeleteMemory(event) {
        const button = event.currentTarget;
        const type = button.dataset.type;
        const index = parseInt(button.dataset.index);

        const confirmed = await Dialog.confirm({
            title: 'Delete Memory',
            content: '<p>Are you sure you want to delete this memory?</p>'
        });

        if (!confirmed) return;

        if (type === 'short-term') {
            const memory = game.settings.get(MODULE_ID, 'shortTermMemory') || [];
            memory.splice(index, 1);
            await game.settings.set(MODULE_ID, 'shortTermMemory', memory);
        } else if (type === 'long-term') {
            const memory = game.settings.get(MODULE_ID, 'longTermMemory') || [];
            memory.splice(index, 1);
            await game.settings.set(MODULE_ID, 'longTermMemory', memory);
        } else {
            const entities = game.settings.get(MODULE_ID, 'entities') || {};
            if (entities[type]) {
                entities[type].splice(index, 1);
                await game.settings.set(MODULE_ID, 'entities', entities);
            }
        }

        this.render();
    }

    async _onEditMemory(event) {
        // Implementation would open an edit dialog
        ui.notifications.info('Edit functionality coming soon');
    }

    async _onAddEntity(event) {
        const type = event.currentTarget.dataset.type;
        const typeLabel = type.slice(0, -1).charAt(0).toUpperCase() + type.slice(1, -1); // npcs -> Npc

        // Build form fields based on entity type
        let formFields = `
            <div class="form-group">
                <label>Name</label>
                <input type="text" name="name" required>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" rows="3"></textarea>
            </div>
        `;

        if (type === 'npcs') {
            formFields += `
                <div class="form-group">
                    <label>Personality</label>
                    <input type="text" name="personality">
                </div>
                <div class="form-group">
                    <label>Role/Occupation</label>
                    <input type="text" name="occupation">
                </div>
                <div class="form-group">
                    <label>Relationships</label>
                    <input type="text" name="relationships">
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" rows="2"></textarea>
                </div>
            `;
        } else if (type === 'locations') {
            formFields += `
                <div class="form-group">
                    <label>Features</label>
                    <textarea name="features" rows="2"></textarea>
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" rows="2"></textarea>
                </div>
            `;
        } else if (type === 'items') {
            formFields += `
                <div class="form-group">
                    <label>Properties</label>
                    <input type="text" name="properties" placeholder="e.g. magical, cursed, rare">
                </div>
                <div class="form-group">
                    <label>Location/Owner</label>
                    <input type="text" name="location">
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" rows="2"></textarea>
                </div>
            `;
        } else if (type === 'factions') {
            formFields += `
                <div class="form-group">
                    <label>Goals</label>
                    <textarea name="goals" rows="2"></textarea>
                </div>
            `;
        }

        const dialog = new Dialog({
            title: `Add ${typeLabel}`,
            content: `
                <form class="chronicle-keeper-add-entity">
                    <style>
                        .chronicle-keeper-add-entity { padding: 10px; }
                        .chronicle-keeper-add-entity .form-group { margin-bottom: 10px; }
                        .chronicle-keeper-add-entity label { display: block; margin-bottom: 3px; font-weight: bold; }
                        .chronicle-keeper-add-entity input, .chronicle-keeper-add-entity textarea { 
                            width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px; 
                        }
                    </style>
                    ${formFields}
                </form>
            `,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: 'Save',
                    callback: async (html) => {
                        const form = html.find('form')[0];
                        const formData = new FormData(form);
                        const entityData = {};

                        for (const [key, value] of formData.entries()) {
                            if (value) entityData[key] = value;
                        }

                        if (!entityData.name) {
                            ui.notifications.warn('Name is required');
                            return;
                        }

                        // Add to entities
                        const entities = game.settings.get(MODULE_ID, 'entities') || { npcs: [], locations: [], items: [], factions: [] };
                        if (!entities[type]) entities[type] = [];

                        entityData.id = `${type}_${Date.now()}`;
                        entityData.createdAt = Date.now();
                        entityData.updatedAt = Date.now();

                        entities[type].push(entityData);
                        await game.settings.set(MODULE_ID, 'entities', entities);

                        ui.notifications.info(`${typeLabel} "${entityData.name}" added successfully!`);
                        this.render();
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: 'Cancel'
                }
            },
            default: 'save'
        });

        dialog.render(true);
    }

    async _onClearShortTerm(event) {
        const confirmed = await Dialog.confirm({
            title: 'Clear Short-term Memory',
            content: '<p>Are you sure you want to clear all short-term memory? This cannot be undone.</p>'
        });

        if (!confirmed) return;

        await game.settings.set(MODULE_ID, 'shortTermMemory', []);
        this.render();
    }

    async _updateObject(event, formData) {
        // Handle form submission if needed
    }
}

/**
 * Helper class for accessing settings
 */
export class ChronicleKeeperSettings {
    /**
     * Get the Ollama server URL
     * @returns {string}
     */
    static get ollamaUrl() {
        return game.settings.get(MODULE_ID, 'ollamaUrl');
    }

    /**
     * Get the selected model
     * @returns {string}
     */
    static get model() {
        return game.settings.get(MODULE_ID, 'model');
    }

    /**
     * Get the embedding model
     * @returns {string}
     */
    static get embeddingModel() {
        return game.settings.get(MODULE_ID, 'embeddingModel');
    }

    /**
     * Get the temperature setting
     * @returns {number}
     */
    static get temperature() {
        return game.settings.get(MODULE_ID, 'temperature');
    }

    /**
     * Get max tokens setting
     * @returns {number}
     */
    static get maxTokens() {
        return game.settings.get(MODULE_ID, 'maxTokens');
    }

    /**
     * Get short-term memory size
     * @returns {number}
     */
    static get shortTermMemorySize() {
        return game.settings.get(MODULE_ID, 'shortTermMemorySize');
    }

    /**
     * Get memory retrieval count
     * @returns {number}
     */
    static get memoryRetrievalCount() {
        return game.settings.get(MODULE_ID, 'memoryRetrievalCount');
    }

    /**
     * Check if DM is enabled
     * @returns {boolean}
     */
    static get dmEnabled() {
        return game.settings.get(MODULE_ID, 'dmEnabled');
    }

    /**
     * Check if auto-narration is enabled
     * @returns {boolean}
     */
    static get enableAutoNarration() {
        return game.settings.get(MODULE_ID, 'enableAutoNarration');
    }

    /**
     * Check if combat narration is enabled
     * @returns {boolean}
     */
    static get enableCombatNarration() {
        return game.settings.get(MODULE_ID, 'enableCombatNarration');
    }

    /**
     * Get the system prompt
     * @returns {string}
     */
    static get systemPrompt() {
        return game.settings.get(MODULE_ID, 'systemPrompt');
    }
}
