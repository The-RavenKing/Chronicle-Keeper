/**
 * Chronicle Keeper - Memory Summarizer
 * Compresses old memories using the LLM
 */

import { MODULE_NAME, ChronicleKeeper, getSetting } from '../main.js';

/**
 * Summarizes conversation segments to compress memory
 */
export class Summarizer {
    constructor() {
        this.summaryPrompt = `Summarize the following conversation segment from a tabletop RPG session. 
Focus on: key story events, important decisions, NPC interactions, combat outcomes, and any world-building details.
Keep the summary concise but complete. Use past tense.

CONVERSATION:
{conversation}

SUMMARY:`;
    }

    /**
     * Summarize a set of messages
     * @param {Array} messages - Messages to summarize
     * @returns {Promise<string|null>} Summary text or null
     */
    async summarize(messages) {
        if (!ChronicleKeeper?.ollama?.connected) {
            console.warn(`${MODULE_NAME} | Cannot summarize: Ollama not connected`);
            return null;
        }

        if (!messages?.length) return null;

        try {
            const conversation = messages.map(m =>
                `${m.role === 'user' ? 'Player' : 'DM'}: ${m.content}`
            ).join('\n');

            const prompt = this.summaryPrompt.replace('{conversation}', conversation);
            const model = getSetting('model');

            const summary = await ChronicleKeeper.ollama.generate({
                model,
                prompt,
                temperature: 0.3,
                maxTokens: 512
            });

            return summary?.trim() || null;
        } catch (error) {
            console.error(`${MODULE_NAME} | Summarization error:`, error);
            return null;
        }
    }

    /**
     * Generate a session summary
     * @param {Array} messages - All session messages
     * @param {Object} context - Additional context (entities, etc)
     * @returns {Promise<string|null>}
     */
    async summarizeSession(messages, context = {}) {
        if (!ChronicleKeeper?.ollama?.connected) return null;

        const sessionPrompt = `Create a session summary for this tabletop RPG session.

Include:
- Major plot developments
- Key NPC interactions
- Combat encounters and outcomes
- Items acquired or lost
- Important player decisions
- Where the party ended up

${context.entities ? `Known Entities: ${JSON.stringify(context.entities)}` : ''}

CONVERSATION:
${messages.map(m => `${m.role === 'user' ? 'Player' : 'DM'}: ${m.content}`).join('\n')}

SESSION SUMMARY:`;

        try {
            return await ChronicleKeeper.ollama.generate({
                model: getSetting('model'),
                prompt: sessionPrompt,
                temperature: 0.4,
                maxTokens: 1024
            });
        } catch (error) {
            console.error(`${MODULE_NAME} | Session summary error:`, error);
            return null;
        }
    }

    /**
     * Extract entities from text
     * @param {string} text - Text to analyze
     * @returns {Promise<Object>} Extracted entities
     */
    async extractEntities(text) {
        if (!ChronicleKeeper?.ollama?.connected) return {};

        const extractPrompt = `Extract named entities from this RPG session text.
Return JSON with: npcs, locations, items, factions.
Only include clearly named entities.

TEXT:
${text}

JSON:`;

        try {
            const response = await ChronicleKeeper.ollama.generate({
                model: getSetting('model'),
                prompt: extractPrompt,
                temperature: 0.2,
                maxTokens: 512
            });

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            return {};
        } catch (error) {
            console.error(`${MODULE_NAME} | Entity extraction error:`, error);
            return {};
        }
    }
}
