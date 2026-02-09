/**
 * Chronicle Keeper - AI Dungeon Master
 * Main module entry point
 * 
 * @module chronicle-keeper
 * @description An AI-powered Dungeon Master using Ollama for local LLM hosting
 */

// Import core modules
import { ChronicleKeeperSettings, registerSettings } from './settings.js';
import { OllamaService } from './ollama-service.js';
import { MemoryManager } from './memory/memory-manager.js';
import { ChatHandler } from './chat/chat-handler.js';
import { registerChatCommands } from './chat/commands.js';
import { ActorBridge } from './foundry/actor-bridge.js';
import { CombatTracker } from './foundry/combat-tracker.js';
import { DiceInterpreter } from './foundry/dice-interpreter.js';
import { SceneManager } from './foundry/scene-manager.js';

/**
 * Module ID constant used throughout the module
 * @constant {string}
 */
export const MODULE_ID = 'chronicle-keeper';

/**
 * Module display name
 * @constant {string}
 */
export const MODULE_NAME = 'Chronicle Keeper';

/**
 * Global module state container
 * @type {Object}
 */
export const ChronicleKeeper = {
    /** @type {OllamaService|null} Ollama API service instance */
    ollama: null,
    /** @type {MemoryManager|null} Memory management system */
    memory: null,
    /** @type {ChatHandler|null} Chat message handler */
    chat: null,
    /** @type {ActorBridge|null} Actor/character bridge */
    actors: null,
    /** @type {CombatTracker|null} Combat tracker integration */
    combat: null,
    /** @type {DiceInterpreter|null} Dice roll interpreter */
    dice: null,
    /** @type {SceneManager|null} Scene and journal manager */
    scenes: null,
    /** @type {boolean} Whether AI DM is currently enabled */
    enabled: false,
    /** @type {boolean} Whether connected to Ollama */
    connected: false,
    /** @type {string|null} Currently selected model */
    currentModel: null
};

/**
 * Initialize the Chronicle Keeper module
 * Called during Foundry's init hook
 */
async function initializeModule() {
    console.log(`${MODULE_NAME} | Initializing module...`);

    // Register module settings
    registerSettings();

    // Register chat commands
    registerChatCommands();

    console.log(`${MODULE_NAME} | Module initialized successfully`);
}

/**
 * Set up the module after Foundry is ready
 * Called during Foundry's ready hook
 */
async function setupModule() {
    console.log(`${MODULE_NAME} | Setting up module components...`);

    try {
        // Initialize Ollama service
        const ollamaUrl = game.settings.get(MODULE_ID, 'ollamaUrl');
        ChronicleKeeper.ollama = new OllamaService(ollamaUrl);

        // Check connection and set status
        ChronicleKeeper.connected = await ChronicleKeeper.ollama.checkConnection();

        if (ChronicleKeeper.connected) {
            console.log(`${MODULE_NAME} | Connected to Ollama at ${ollamaUrl}`);

            // Load available models
            const models = await ChronicleKeeper.ollama.listModels();
            console.log(`${MODULE_NAME} | Available models:`, models);

            // Set current model from settings
            ChronicleKeeper.currentModel = game.settings.get(MODULE_ID, 'model');
        } else {
            console.warn(`${MODULE_NAME} | Could not connect to Ollama at ${ollamaUrl}`);
            ui.notifications.warn(game.i18n.localize('CHRONICLE_KEEPER.Chat.ConnectionError'));
        }

        // Initialize Memory Manager
        ChronicleKeeper.memory = new MemoryManager();
        await ChronicleKeeper.memory.initialize();

        // Initialize Foundry integrations
        ChronicleKeeper.actors = new ActorBridge();
        ChronicleKeeper.combat = new CombatTracker();
        ChronicleKeeper.dice = new DiceInterpreter();
        ChronicleKeeper.scenes = new SceneManager();

        // Initialize Chat Handler
        ChronicleKeeper.chat = new ChatHandler({
            ollama: ChronicleKeeper.ollama,
            memory: ChronicleKeeper.memory,
            actors: ChronicleKeeper.actors,
            combat: ChronicleKeeper.combat,
            dice: ChronicleKeeper.dice,
            scenes: ChronicleKeeper.scenes
        });

        // Set enabled state from settings
        ChronicleKeeper.enabled = game.settings.get(MODULE_ID, 'dmEnabled');

        // Display connection status
        displayConnectionStatus();

        console.log(`${MODULE_NAME} | Module setup complete`);

    } catch (error) {
        console.error(`${MODULE_NAME} | Error during module setup:`, error);
        ui.notifications.error(`${MODULE_NAME}: Failed to initialize. Check console for details.`);
    }
}

/**
 * Display the current Ollama connection status in chat
 */
function displayConnectionStatus() {
    const status = ChronicleKeeper.connected ? 'connected' : 'disconnected';
    const statusKey = ChronicleKeeper.connected ? 'Connected' : 'Disconnected';
    const statusText = game.i18n.localize(`CHRONICLE_KEEPER.UI.ConnectionStatus.${statusKey}`);

    // Only show to GM
    if (!game.user.isGM) return;

    const html = `
    <div class="chronicle-keeper-status ${status}">
      <span class="status-dot"></span>
      <span>${statusText}</span>
      ${ChronicleKeeper.connected && ChronicleKeeper.currentModel
            ? `<span class="model-name">(${ChronicleKeeper.currentModel})</span>`
            : ''}
    </div>
  `;

    ChatMessage.create({
        content: html,
        speaker: { alias: MODULE_NAME },
        whisper: [game.user.id],
        flags: {
            [MODULE_ID]: {
                isSystemMessage: true
            }
        }
    });
}

/**
 * Register socket handlers for multi-user functionality
 */
function registerSocketHandlers() {
    game.socket.on(`module.${MODULE_ID}`, async (data) => {
        switch (data.type) {
            case 'refreshMemory':
                // Reload memory from storage
                if (ChronicleKeeper.memory) {
                    await ChronicleKeeper.memory.load();
                }
                break;

            case 'toggleDM':
                // Sync DM enabled state
                ChronicleKeeper.enabled = data.enabled;
                break;

            default:
                console.log(`${MODULE_NAME} | Unknown socket message type:`, data.type);
        }
    });
}

/**
 * Get a localized string
 * @param {string} key - The localization key
 * @param {Object} [data] - Data for string interpolation
 * @returns {string} The localized string
 */
export function localize(key, data = {}) {
    return game.i18n.format(`CHRONICLE_KEEPER.${key}`, data);
}

/**
 * Get a module setting value
 * @param {string} key - The setting key
 * @returns {*} The setting value
 */
export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

/**
 * Set a module setting value
 * @param {string} key - The setting key
 * @param {*} value - The new value
 */
export async function setSetting(key, value) {
    return game.settings.set(MODULE_ID, key, value);
}

/* ===== Foundry Hooks ===== */

// Module initialization
Hooks.once('init', initializeModule);

// Module ready
Hooks.once('ready', setupModule);

// Socket registration
Hooks.once('ready', registerSocketHandlers);

// Chat message hooks - handle player messages
Hooks.on('chatMessage', (chatLog, message, chatData) => {
    // Only process if DM is enabled and we're connected
    if (!ChronicleKeeper.enabled || !ChronicleKeeper.connected) return true;

    // Let chat handler process the message
    if (ChronicleKeeper.chat) {
        return ChronicleKeeper.chat.processChatMessage(message, chatData);
    }

    return true;
});

// Combat turn changes - for combat narration
Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
    if (!ChronicleKeeper.enabled || !ChronicleKeeper.connected) return;

    const autoNarrate = game.settings.get(MODULE_ID, 'enableCombatNarration');
    if (autoNarrate && ChronicleKeeper.combat) {
        ChronicleKeeper.combat.onTurnChange(combat, updateData);
    }
});

// Combat round changes
Hooks.on('combatRound', (combat, updateData, updateOptions) => {
    if (!ChronicleKeeper.enabled || !ChronicleKeeper.connected) return;

    const autoNarrate = game.settings.get(MODULE_ID, 'enableCombatNarration');
    if (autoNarrate && ChronicleKeeper.combat) {
        ChronicleKeeper.combat.onRoundChange(combat, updateData);
    }
});

// Dice roll results - for narration
Hooks.on('createChatMessage', async (message, options, userId) => {
    if (!ChronicleKeeper.enabled || !ChronicleKeeper.connected) return;

    // Check if this is a dice roll
    if (message.isRoll) {
        const autoNarrate = game.settings.get(MODULE_ID, 'enableAutoNarration');
        if (autoNarrate && ChronicleKeeper.dice) {
            await ChronicleKeeper.dice.narrateRoll(message);
        }
    }
});

// Scene changes - update context
Hooks.on('canvasReady', (canvas) => {
    if (ChronicleKeeper.scenes) {
        ChronicleKeeper.scenes.onSceneChange(canvas.scene);
    }
});

// Settings changes - react to configuration updates
Hooks.on('closeSettingsConfig', async () => {
    try {
        // Re-check connection if URL changed
        const newUrl = game.settings.get(MODULE_ID, 'ollamaUrl');
        if (ChronicleKeeper.ollama) {
            // Always create a new service with the current URL
            ChronicleKeeper.ollama = new OllamaService(newUrl);
            ChronicleKeeper.connected = await ChronicleKeeper.ollama.checkConnection();
        }

        // Update model
        ChronicleKeeper.currentModel = game.settings.get(MODULE_ID, 'model');

        // Update enabled state
        ChronicleKeeper.enabled = game.settings.get(MODULE_ID, 'dmEnabled');
    } catch (error) {
        console.warn(`${MODULE_NAME} | Error updating settings:`, error);
    }
});

// Render settings sheet - add model dropdown population and test button
Hooks.on('renderSettingsConfig', async (app, html, data) => {
    // Handle both jQuery (v11) and native HTMLElement (v12+)
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    // Find the model select element
    const modelSelect = root.querySelector(`select[name="${MODULE_ID}.model"]`);
    const ollamaUrlInput = root.querySelector(`input[name="${MODULE_ID}.ollamaUrl"]`);

    // Add test connection button after the Ollama URL field
    if (ollamaUrlInput && !root.querySelector('.chronicle-keeper-test-btn')) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'form-group chronicle-keeper-buttons';
        buttonContainer.innerHTML = `
            <label></label>
            <div class="form-fields">
                <button type="button" class="chronicle-keeper-test-btn">
                    <i class="fas fa-plug"></i> Test Connection
                </button>
                <button type="button" class="chronicle-keeper-list-models-btn">
                    <i class="fas fa-list"></i> List Models
                </button>
            </div>
        `;

        // Insert after the URL input's form-group
        const urlFormGroup = ollamaUrlInput.closest('.form-group');
        if (urlFormGroup) {
            urlFormGroup.after(buttonContainer);
        }

        // Add event listeners
        buttonContainer.querySelector('.chronicle-keeper-test-btn').addEventListener('click', async () => {
            const url = ollamaUrlInput.value || 'http://localhost:11434';
            const testService = new OllamaService(url);

            ui.notifications.info('Testing connection...');
            const connected = await testService.checkConnection();

            if (connected) {
                ui.notifications.info('✓ Connected to Ollama successfully!');
                ChronicleKeeper.ollama = testService;
                ChronicleKeeper.connected = true;

                // Auto-populate models
                const models = await testService.listModels();
                if (models.length && modelSelect) {
                    populateModelSelect(modelSelect, models);
                }
            } else {
                ui.notifications.error('✗ Could not connect to Ollama at ' + url);
            }
        });

        buttonContainer.querySelector('.chronicle-keeper-list-models-btn').addEventListener('click', async () => {
            const url = ollamaUrlInput.value || 'http://localhost:11434';
            const testService = new OllamaService(url);

            ui.notifications.info('Fetching models...');
            const models = await testService.listModels();

            if (models.length) {
                populateModelSelect(modelSelect, models);
                ui.notifications.info(`Found ${models.length} models`);
            } else {
                ui.notifications.warn('No models found. Pull a model with: ollama pull llama3:8b');
            }
        });
    }

    // Populate model dropdown if already connected
    if (ChronicleKeeper.connected && ChronicleKeeper.ollama && modelSelect) {
        const models = await ChronicleKeeper.ollama.listModels();
        if (models.length) {
            populateModelSelect(modelSelect, models);
        }
    }
});

/**
 * Populate the model select dropdown
 */
function populateModelSelect(select, models) {
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '';

    let hasSelection = false;

    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = `${model.name} (${formatBytes(model.size)})`;

        const isSelected = model.name === currentValue || model.name === ChronicleKeeper.currentModel;
        if (isSelected) hasSelection = true;

        option.selected = isSelected;
        select.appendChild(option);
    });

    // Auto-select first if no match
    if (!hasSelection && models.length > 0) {
        select.options[0].selected = true;
        ChronicleKeeper.currentModel = models[0].name; // Update immediately for this session
    }
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Export for external access
window.ChronicleKeeper = ChronicleKeeper;
