/**
 * Chronicle Keeper - Chat Commands
 * Registers and handles slash commands
 */

import { MODULE_ID, MODULE_NAME, ChronicleKeeper, getSetting } from '../main.js';
import { openImportWizard } from '../import/campaign-import.js';

/**
 * Register all chat commands with Foundry
 */
export function registerChatCommands() {
    console.log(`${MODULE_NAME} | Registering chat commands...`);

    // Register /ai command
    Hooks.on('chatMessage', (chatLog, message, chatData) => {
        if (message.startsWith('/ai ')) {
            handleAICommand(message.slice(4).trim(), chatData);
            return false;
        }

        if (message.startsWith('/narrate')) {
            handleNarrateCommand(message.slice(8).trim(), chatData);
            return false;
        }

        if (message.startsWith('/npc ')) {
            handleNPCCommand(message.slice(5).trim(), chatData);
            return false;
        }

        if (message.toLowerCase().startsWith('/talk ')) {
            handleTalkCommand(message.slice(6).trim(), chatData);
            return false;
        }

        if (message.startsWith('/memory ')) {
            handleMemoryCommand(message.slice(8).trim(), chatData);
            return false;
        }

        if (message === '/dm toggle') {
            handleDMToggle();
            return false;
        }

        if (message === '/dm status') {
            handleDMStatus();
            return false;
        }

        if (message === '/ck help' || message === '/chronicle help') {
            showHelp();
            return false;
        }

        if (message === '/import' || message === '/import campaign') {
            openImportWizard();
            return false;
        }

        return true;
    });
}

/**
 * Handle /ai command - direct AI interaction
 */
async function handleAICommand(prompt, chatData) {
    if (!ChronicleKeeper.connected) {
        ui.notifications.warn(game.i18n.localize('CHRONICLE_KEEPER.Chat.ConnectionError'));
        return;
    }

    // Post user message
    await ChatMessage.create({
        content: prompt,
        speaker: ChatMessage.getSpeaker()
    });

    // Let chat handler process it
    if (ChronicleKeeper.chat) {
        await ChronicleKeeper.chat._handlePlayerMessage(prompt, chatData);
    }
}

/**
 * Handle /narrate command - scene narration
 */
async function handleNarrateCommand(prompt, chatData) {
    if (!ChronicleKeeper.connected) {
        ui.notifications.warn(game.i18n.localize('CHRONICLE_KEEPER.Chat.ConnectionError'));
        return;
    }

    const narratePrompt = prompt || 'Describe the current scene and atmosphere.';

    if (ChronicleKeeper.chat) {
        await ChronicleKeeper.chat.narrate(narratePrompt);
    }
}

/**
 * Handle /npc command - NPC dialogue
 */
async function handleNPCCommand(input, chatData) {
    if (!ChronicleKeeper.connected) {
        ui.notifications.warn(game.i18n.localize('CHRONICLE_KEEPER.Chat.ConnectionError'));
        return;
    }

    // Parse: /npc Name context or dialogue prompt
    const parts = input.split(' ');
    const npcName = parts[0];
    const context = parts.slice(1).join(' ') || 'Respond to the player.';

    if (!npcName) {
        ui.notifications.warn('Usage: /npc [name] [context]');
        return;
    }

    if (ChronicleKeeper.chat) {
        await ChronicleKeeper.chat.npcSpeak(npcName, context);
    }
}

/**
 * Handle /talk command - Player speaks to an NPC, NPC responds
 */
async function handleTalkCommand(input, chatData) {
    if (!ChronicleKeeper.connected) {
        ui.notifications.warn(game.i18n.localize('CHRONICLE_KEEPER.Chat.ConnectionError'));
        return;
    }

    // Parse: /talk NpcName What the player says to them
    const parts = input.split(' ');
    const npcName = parts[0];
    const playerDialogue = parts.slice(1).join(' ');

    if (!npcName || !playerDialogue) {
        ui.notifications.warn('Usage: /talk [NPC name] [what you say to them]');
        return;
    }

    // Get the speaker (player character)
    const speaker = ChatMessage.getSpeaker();
    const speakerName = speaker.alias || 'A player';

    // Post the player's dialogue as a chat message
    await ChatMessage.create({
        content: `<div class="chronicle-keeper-message player-dialogue">
            <em>${speakerName} to ${npcName}:</em>
            <p>"${playerDialogue}"</p>
        </div>`,
        speaker: speaker
    });

    // Have the NPC respond
    if (ChronicleKeeper.chat) {
        await ChronicleKeeper.chat.npcRespond(npcName, speakerName, playerDialogue);
    }
}

/**
 * Handle /memory command - memory management
 */
async function handleMemoryCommand(subcommand, chatData) {
    const [action, ...args] = subcommand.split(' ');

    switch (action) {
        case 'search':
            await memorySearch(args.join(' '));
            break;

        case 'save':
            await memorySave(args.join(' '));
            break;

        case 'clear':
            await memoryClear();
            break;

        case 'browse':
            openMemoryBrowser();
            break;

        case 'export':
            await memoryExport();
            break;

        case 'stats':
            await memoryStats();
            break;

        default:
            showMemoryHelp();
    }
}

/**
 * Search memories
 */
async function memorySearch(query) {
    if (!query) {
        ui.notifications.warn('Usage: /memory search [query]');
        return;
    }

    const results = await ChronicleKeeper.memory?.search(query);

    if (results?.length > 0) {
        // Separate entities from other results and filter by score
        const entities = results.filter(r => r.source === 'entities');
        const otherResults = results.filter(r => r.source !== 'entities' && r.score > 0.3);

        let resultHtml = '';

        // Show entities first with full detail
        if (entities.length > 0) {
            resultHtml += '<div style="margin-bottom: 15px;"><strong style="color: var(--ck-primary-light);">📇 Matching Entities</strong></div>';
            for (const r of entities.slice(0, 3)) {
                const type = r.entityType.slice(0, -1).toUpperCase();
                const typeIcon = type === 'NPC' ? '👤' : type === 'LOCATION' ? '🏰' : '📦';

                // Build detailed info string
                const details = [];
                if (r.description) details.push(r.description);
                if (r.personality) details.push(`<em>Personality:</em> ${r.personality}`);
                if (r.occupation) details.push(`<em>Role:</em> ${r.occupation}`);
                if (r.relationships) details.push(`<em>Relationships:</em> ${r.relationships}`);
                if (r.notes) details.push(`<em>Notes:</em> ${r.notes}`);

                resultHtml += `<div style="margin-bottom: 12px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px;">
                    <div style="font-size: 1.1em; margin-bottom: 5px;">
                        ${typeIcon} <strong>${r.name}</strong> <span style="color: var(--ck-text-muted);">(${type})</span>
                    </div>
                    <div style="font-size: 0.9em; line-height: 1.5;">${details.join('<br>') || 'No details stored.'}</div>
                </div>`;
            }
        }

        // Show related story beats (limited)
        if (otherResults.length > 0) {
            resultHtml += '<div style="margin: 15px 0 10px 0;"><strong style="color: var(--ck-text-muted);">📜 Related Memories</strong></div>';
            const storyHtml = otherResults.slice(0, 4).map(r => {
                const typeIcon = r.source === 'short-term' ? '💭' : '📜';
                const displayContent = r.content?.length > 120 ? r.content.substring(0, 120) + '...' : r.content;
                return `<li style="margin-bottom: 6px; font-size: 0.9em;">${typeIcon} ${displayContent}</li>`;
            }).join('');
            resultHtml += `<ul style="padding-left: 0; list-style: none; margin: 0;">${storyHtml}</ul>`;
        }

        ChatMessage.create({
            content: `<div class="chronicle-keeper-message">
        <h4 style="border-bottom: 1px solid var(--ck-border); padding-bottom: 5px; margin-bottom: 10px;">
            🔍 Memory Search: "${query}"
        </h4>
        ${resultHtml}
      </div>`,
            speaker: { alias: 'Chronicle Keeper' },
            whisper: [game.user.id]
        });
    } else {
        ui.notifications.info('No matching memories found.');
    }
}

/**
 * Save a manual memory
 */
async function memorySave(content) {
    if (!content) {
        ui.notifications.warn('Usage: /memory save [content]');
        return;
    }

    await ChronicleKeeper.memory?.addStoryBeat(content, 'world_fact', { importance: 'medium' });
    ui.notifications.info('Memory saved successfully.');
}

/**
 * Clear short-term memory
 */
async function memoryClear() {
    const confirmed = await Dialog.confirm({
        title: 'Clear Short-term Memory',
        content: '<p>Clear all short-term memory? This cannot be undone.</p>'
    });

    if (confirmed) {
        await ChronicleKeeper.memory?.clearShortTerm();
        ui.notifications.info('Short-term memory cleared.');
    }
}

/**
 * Open the memory browser
 */
function openMemoryBrowser() {
    game.settings.sheet.render(true);
    // The memory browser is registered as a settings menu
}

/**
 * Export memories to JSON
 */
async function memoryExport() {
    const data = ChronicleKeeper.memory?.export();
    if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chronicle-keeper-memories-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        ui.notifications.info('Memories exported successfully.');
    }
}

/**
 * Show memory statistics
 */
async function memoryStats() {
    const shortTerm = ChronicleKeeper.memory?.shortTerm?.size || 0;
    const longTerm = ChronicleKeeper.memory?.longTerm?.size || 0;
    const vectors = ChronicleKeeper.memory?.vectorStore?.size || 0;

    const entities = ChronicleKeeper.memory?.entities?.export() || {};
    const npcCount = entities.npcs?.length || 0;
    const locationCount = entities.locations?.length || 0;

    ChatMessage.create({
        content: `<div class="chronicle-keeper-message">
      <h4>📊 Memory Statistics</h4>
      <ul>
        <li><strong>Short-term:</strong> ${shortTerm} messages</li>
        <li><strong>Long-term:</strong> ${longTerm} memories</li>
        <li><strong>NPCs:</strong> ${npcCount}</li>
        <li><strong>Locations:</strong> ${locationCount}</li>
        <li><strong>Vector embeddings:</strong> ${vectors}</li>
      </ul>
    </div>`,
        speaker: { alias: 'Chronicle Keeper' },
        whisper: [game.user.id]
    });
}

/**
 * Show memory command help
 */
function showMemoryHelp() {
    ChatMessage.create({
        content: `<div class="chronicle-keeper-message">
      <h4>Memory Commands</h4>
      <ul>
        <li><code>/memory search [query]</code> - Search memories</li>
        <li><code>/memory save [text]</code> - Save a memory</li>
        <li><code>/memory clear</code> - Clear short-term</li>
        <li><code>/memory browse</code> - Open browser</li>
        <li><code>/memory export</code> - Export to JSON</li>
        <li><code>/memory stats</code> - Show statistics</li>
      </ul>
    </div>`,
        speaker: { alias: 'Chronicle Keeper' },
        whisper: [game.user.id]
    });
}

/**
 * Toggle AI DM on/off
 */
function handleDMToggle() {
    ChronicleKeeper.enabled = !ChronicleKeeper.enabled;
    game.settings.set(MODULE_ID, 'dmEnabled', ChronicleKeeper.enabled);

    const status = ChronicleKeeper.enabled ? 'enabled' : 'disabled';
    ui.notifications.info(`Chronicle Keeper AI DM ${status}`);

    // Broadcast to other clients
    game.socket.emit(`module.${MODULE_ID}`, {
        type: 'toggleDM',
        enabled: ChronicleKeeper.enabled
    });
}

/**
 * Show current DM status
 */
function handleDMStatus() {
    const connected = ChronicleKeeper.connected ? '🟢 Connected' : '🔴 Disconnected';
    const enabled = ChronicleKeeper.enabled ? 'Enabled' : 'Disabled';
    const model = ChronicleKeeper.currentModel || 'None selected';

    ChatMessage.create({
        content: `<div class="chronicle-keeper-message">
      <h4>Chronicle Keeper Status</h4>
      <ul>
        <li><strong>Connection:</strong> ${connected}</li>
        <li><strong>AI DM:</strong> ${enabled}</li>
        <li><strong>Model:</strong> ${model}</li>
      </ul>
    </div>`,
        speaker: { alias: 'Chronicle Keeper' },
        whisper: [game.user.id]
    });
}

/**
 * Show command cheat sheet
 */
function showHelp() {
    const content = `
    <div class="chronicle-keeper-message">
        <h3 style="border-bottom: 1px solid var(--ck-border); padding-bottom: 5px; margin-bottom: 10px;">
            🎭 Chronicle Keeper Commands
        </h3>
        
        <div style="margin-bottom: 15px;">
            <strong style="color: var(--ck-primary-light); font-size: 1.1em;">Narrative</strong>
            <ul style="margin: 5px 0;">
                <li><code>/narrate [prompt]</code><br><span style="color: var(--ck-text-muted); font-size: 0.9em;">Describe a scene or action.</span></li>
                <li><code>/npc [name] [instruction]</code><br><span style="color: var(--ck-text-muted); font-size: 0.9em;">Speak as an NPC (DM style).</span></li>
                <li><code>/talk [npc] [dialogue]</code><br><span style="color: var(--ck-text-muted); font-size: 0.9em;">Talk TO an NPC, get a response.</span><br><em>Ex: /talk Mayor We want 50 gold for the job.</em></li>
                <li><code>/ai [prompt]</code><br><span style="color: var(--ck-text-muted); font-size: 0.9em;">Ask the AI DM a question.</span></li>
            </ul>
        </div>

        <div style="margin-bottom: 15px;">
            <strong style="color: var(--ck-primary-light); font-size: 1.1em;">Memory</strong>
            <ul style="margin: 5px 0;">
                <li><code>/memory save [fact]</code><br><span style="color: var(--ck-text-muted); font-size: 0.9em;">Remember a key fact forever.</span></li>
                <li><code>/memory search [query]</code><br><span style="color: var(--ck-text-muted); font-size: 0.9em;">Find past lore/events.</span></li>
                <li><code>/memory clear</code><br><span style="color: var(--ck-text-muted); font-size: 0.9em;">Reset current conversation context.</span></li>
            </ul>
        </div>

        <div>
            <strong style="color: var(--ck-primary-light); font-size: 1.1em;">Utility</strong>
            <ul style="margin: 5px 0;">
                <li><code>/dm status</code> - Check connection</li>
                <li><code>/dm toggle</code> - Enable/Disable auto-prompts</li>
                <li><code>/import</code> - Open Campaign Import Wizard</li>
                <li><code>/ck help</code> - Show this menu</li>
            </ul>
        </div>
    </div>`;

    ChatMessage.create({
        content: content,
        speaker: { alias: 'Chronicle Keeper' },
        whisper: [game.user.id]
    });
}
