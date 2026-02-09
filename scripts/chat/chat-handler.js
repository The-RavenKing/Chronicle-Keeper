/**
 * Chronicle Keeper - Chat Handler
 * Processes chat messages and generates AI responses
 */

import { MODULE_ID, MODULE_NAME, ChronicleKeeper } from '../main.js';
import { ChronicleKeeperSettings, DEFAULT_SYSTEM_PROMPT } from '../settings.js';
import { OllamaService } from '../ollama-service.js';

/**
 * Handles chat message processing and AI response generation
 */
export class ChatHandler {
    constructor({ ollama, memory, actors, combat, dice, scenes }) {
        this.ollama = ollama;
        this.memory = memory;
        this.actors = actors;
        this.combat = combat;
        this.dice = dice;
        this.scenes = scenes;
        this.processing = false;
    }

    /**
     * Process an incoming chat message
     * @param {string} message - Raw message text
     * @param {Object} chatData - Foundry chat data
     * @returns {boolean} False to prevent default, true to continue
     */
    processChatMessage(message, chatData) {
        // Skip if already processing or message is a command
        if (this.processing || message.startsWith('/')) return true;

        // Skip system messages and whispers
        if (chatData.whisper?.length > 0) return true;

        // Process the message asynchronously
        this._handlePlayerMessage(message, chatData);

        return true; // Allow message to post normally
    }

    /**
     * Handle a player message
     * @param {string} message - Player's message
     * @param {Object} chatData - Chat metadata
     */
    async _handlePlayerMessage(message, chatData) {
        this.processing = true;

        try {
            // Show thinking indicator
            const thinkingMsg = await this._showThinking();

            // Get the speaker info
            const speaker = ChatMessage.getSpeaker();
            const actor = game.actors.get(speaker.actor);

            // Store message in memory
            await this.memory.addMessage('user', message, {
                speaker: speaker.alias,
                actorId: speaker.actor
            });

            // Get context from memory
            const context = await this.memory.getContext(message);

            // Build character info if available
            const characterInfo = actor ? this.actors.getCharacterContext(actor) : '';

            // Build scene info
            const sceneInfo = this.scenes?.getCurrentSceneContext() || '';

            // Build combat info if in combat
            const combatInfo = game.combat?.active ? this.combat?.getCombatContext() : '';

            // Assemble the system prompt with context
            const systemPrompt = this._buildSystemPrompt({
                basePrompt: ChronicleKeeperSettings.systemPrompt || DEFAULT_SYSTEM_PROMPT,
                memoryContext: this.memory.formatContextForPrompt(context),
                characterInfo,
                sceneInfo,
                combatInfo
            });

            // Get conversation history
            const history = this.memory.getConversationHistory();

            // Build messages for Ollama
            const messages = OllamaService.formatMessages(systemPrompt, history.slice(-20), message);

            // Generate response
            let response = '';

            await this.ollama.chat({
                model: ChronicleKeeperSettings.model || ChronicleKeeper?.currentModel || 'llama3:8b',
                messages,
                temperature: ChronicleKeeperSettings.temperature,
                maxTokens: ChronicleKeeperSettings.maxTokens,
                stream: true,
                onChunk: (chunk, full) => {
                    response = full;
                    // Could update thinking message here for streaming display
                }
            });

            // Remove thinking indicator
            await thinkingMsg?.delete();

            // Post the AI response
            if (response) {
                await this._postResponse(response);

                // Store response in memory
                await this.memory.addMessage('assistant', response);

                // Trigger dynamic entity updates in background
                const updatedHistory = this.memory.getConversationHistory();
                this.memory.processEntityUpdates(updatedHistory, context.entities).catch(err => {
                    console.error(`${MODULE_NAME} | Failed to process entity updates:`, err);
                });
            }
        } catch (error) {
            console.error(`${MODULE_NAME} | Chat handler error:`, error);
            ui.notifications.error(game.i18n.localize('CHRONICLE_KEEPER.Chat.ResponseError'));
        } finally {
            this.processing = false;
        }
    }

    /**
     * Build the complete system prompt with all context
     */
    _buildSystemPrompt({ basePrompt, memoryContext, characterInfo, sceneInfo, combatInfo }) {
        const sections = [basePrompt];

        if (characterInfo) {
            sections.push(`\n## Active Character\n${characterInfo}`);
        }

        if (sceneInfo) {
            sections.push(`\n## Current Scene\n${sceneInfo}`);
        }

        if (combatInfo) {
            sections.push(`\n## Combat Status\n${combatInfo}`);
        }

        if (memoryContext) {
            sections.push(`\n## Memory Context\n${memoryContext}`);
        }

        return sections.join('\n');
    }

    /**
     * Show the thinking indicator
     */
    async _showThinking() {
        const content = `
      <div class="chronicle-keeper-thinking">
        <div class="dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span>${game.i18n.localize('CHRONICLE_KEEPER.Chat.Thinking')}</span>
      </div>
    `;

        return ChatMessage.create({
            content,
            speaker: { alias: 'Chronicle Keeper' },
            flags: { [MODULE_ID]: { isThinking: true } }
        });
    }

    /**
     * Post an AI response to chat
     */
    async _postResponse(content, type = 'normal') {
        const html = `
      <div class="chronicle-keeper-message ${type}">
        <div class="message-content">${content}</div>
      </div>
    `;

        return ChatMessage.create({
            content: html,
            speaker: { alias: 'Chronicle Keeper' },
            flags: { [MODULE_ID]: { isAIResponse: true, type } }
        });
    }

    /**
     * Generate narration for a scene or event
     */
    async narrate(prompt) {
        if (!this.ollama?.connected) {
            ui.notifications.warn(game.i18n.localize('CHRONICLE_KEEPER.Chat.ConnectionError'));
            return;
        }

        const context = await this.memory.getContext(prompt);
        const sceneInfo = this.scenes?.getCurrentSceneContext() || '';

        const systemPrompt = `You are a narrator for a tabletop RPG. Describe the scene vividly with sensory details. Be dramatic but concise.
    
${sceneInfo ? `Current Scene: ${sceneInfo}` : ''}
${this.memory.formatContextForPrompt(context)}`;

        const messages = OllamaService.formatMessages(systemPrompt, [], prompt);

        // Show thinking indicator
        const thinkingMsg = await this._showThinking();

        try {
            const response = await this.ollama.chat({
                model: ChronicleKeeperSettings.model || ChronicleKeeper?.currentModel || 'llama3:8b',
                messages,
                temperature: 0.8,
                maxTokens: 512
            });

            // Remove thinking indicator
            await thinkingMsg?.delete();

            if (response) {
                await this._postResponse(response, 'narration');
                await this.memory.addMessage('assistant', response);
            }
        } catch (error) {
            await thinkingMsg?.delete();
            console.error(`${MODULE_NAME} | Narration error:`, error);
            ui.notifications.error(`Narration failed: ${error.message}`);
        }
    }

    /**
     * Have an NPC speak
     */
    /**
     * Have an NPC speak
     */
    async npcSpeak(npcName, context) {
        if (!this.ollama?.connected) return;

        // Look up NPC in memory
        const npc = this.memory.entities.get('npcs', npcName);
        const npcContext = this._buildNPCContext(npc, npcName);

        const prompt = `Respond as the NPC ${npcName}. Stay in character.
    
${npcContext}

Context: ${context}`;

        const messages = OllamaService.formatMessages(prompt, [], context);

        // Show thinking indicator
        const thinkingMsg = await this._showThinking();

        try {
            const response = await this.ollama.chat({
                model: ChronicleKeeperSettings.model || ChronicleKeeper?.currentModel || 'llama3:8b',
                messages,
                temperature: 0.9,
                maxTokens: 256
            });

            // Remove thinking indicator
            await thinkingMsg?.delete();

            if (response) {
                const html = `
          <div class="chronicle-keeper-message npc-speech" data-npc-name="🗣️ ${npcName}">
            <div class="message-content">${response}</div>
          </div>
        `;

                await ChatMessage.create({
                    content: html,
                    speaker: { alias: npcName },
                    flags: { [MODULE_ID]: { isNPC: true, npcName } }
                });
            }
        } catch (error) {
            await thinkingMsg?.delete();
            console.error(`${MODULE_NAME} | NPC speech error:`, error);
            ui.notifications.error(`NPC speech failed: ${error.message}`);
        }
    }

    /**
     * Have an NPC respond to player dialogue
     * @param {string} npcName - Name of the NPC
     * @param {string} speakerName - Name of the player/character speaking
     * @param {string} playerDialogue - What the player said
     */
    async npcRespond(npcName, speakerName, playerDialogue) {
        if (!this.ollama?.connected) return;

        // Look up NPC in memory for personality/context
        const npc = this.memory.entities.get('npcs', npcName);
        const npcContext = this._buildNPCContext(npc, npcName);

        // Get recent conversation context
        const memoryContext = await this.memory.getContext(playerDialogue);

        const systemPrompt = `${npcContext}

You are having a conversation with ${speakerName}. Respond naturally as ${npcName} would.
Stay in character. Keep your response conversational and reasonably brief (1-3 sentences typically).
Do not narrate actions unless necessary - focus on dialogue.

${this.memory.formatContextForPrompt(memoryContext)}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `${speakerName} says to you: "${playerDialogue}"` }
        ];

        // Show thinking indicator
        const thinkingMsg = await this._showThinking();

        try {
            const response = await this.ollama.chat({
                model: ChronicleKeeperSettings.model || ChronicleKeeper?.currentModel || 'llama3:8b',
                messages,
                temperature: 0.85,
                maxTokens: 200
            });

            await thinkingMsg?.delete();

            if (response) {
                const html = `
                <div class="chronicle-keeper-message npc-speech" data-npc-name="🗣️ ${npcName}">
                    <div class="message-content">"${response}"</div>
                </div>`;

                await ChatMessage.create({
                    content: html,
                    speaker: { alias: npcName },
                    flags: { [MODULE_ID]: { isNPC: true, npcName, isDialogue: true } }
                });

                // Add to memory
                await this.memory.addMessage('user', `${speakerName} to ${npcName}: "${playerDialogue}"`);
                await this.memory.addMessage('assistant', `${npcName}: "${response}"`);
            }
        } catch (error) {
            await thinkingMsg?.delete();
            console.error(`${MODULE_NAME} | NPC respond error:`, error);
            ui.notifications.error(`NPC response failed: ${error.message}`);
        }
    }

    /**
     * Helper to build full NPC context string
     * @param {Object} npc - NPC entity object
     * @param {string} npcName - Fallback name if npc object is null
     * @returns {string} Formatted context string
     */
    _buildNPCContext(npc, npcName) {
        if (!npc) {
            return `You are an NPC named ${npcName}. Respond in character based on context.`;
        }

        const lines = [`You are ${npc.name}.`];

        if (npc.description) lines.push(npc.description);
        if (npc.personality) lines.push(`Personality: ${npc.personality}`);
        if (npc.occupation) lines.push(`Occupation: ${npc.occupation}`);
        if (npc.motivation) lines.push(`Motivation: ${npc.motivation}`);
        if (npc.faction) lines.push(`Faction: ${npc.faction}`);
        if (npc.notes) lines.push(`Notes: ${npc.notes}`);

        if (npc.relationships && npc.relationships.length > 0) {
            const rels = npc.relationships.map(r => `${r.targetId}: ${r.relationship}`).join('; ');
            lines.push(`Relationships: ${rels}`);
        }

        return lines.join(' ');
    }
}
