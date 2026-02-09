/**
 * Chronicle Keeper - Dice Interpreter
 * Parses and narrates dice roll results
 */

import { MODULE_ID, MODULE_NAME, ChronicleKeeper, getSetting } from '../main.js';
import { ChronicleKeeperSettings } from '../settings.js';

/**
 * Interprets dice rolls and generates narration
 */
export class DiceInterpreter {
    constructor() {
        this.recentRolls = [];
    }

    /**
     * Narrate a dice roll result
     * @param {ChatMessage} message - The roll message
     */
    async narrateRoll(message) {
        if (!message.isRoll || !ChronicleKeeper?.ollama?.connected) return;

        const roll = message.rolls?.[0];
        if (!roll) return;

        // Parse roll data
        const rollData = this._parseRoll(roll, message);
        if (!rollData) return;

        // Avoid duplicate narration
        const rollKey = `${message.speaker?.alias}-${rollData.total}-${Date.now()}`;
        if (this.recentRolls.includes(rollKey)) return;
        this.recentRolls.push(rollKey);
        if (this.recentRolls.length > 10) this.recentRolls.shift();

        // Generate narration
        try {
            const narration = await this._generateNarration(rollData, message);
            if (narration) {
                await ChatMessage.create({
                    content: `<div class="chronicle-keeper-message roll-narration ${rollData.resultClass}">
            <div class="message-content"><em>${narration}</em></div>
          </div>`,
                    speaker: { alias: 'Chronicle Keeper' },
                    flags: { [MODULE_ID]: { isRollNarration: true, rollData } }
                });
            }
        } catch (error) {
            console.warn(`${MODULE_NAME} | Roll narration failed:`, error);
        }
    }

    /**
     * Parse a Foundry roll into structured data
     */
    _parseRoll(roll, message) {
        const data = {
            formula: roll.formula,
            total: roll.total,
            dice: [],
            isD20: false,
            criticalHit: false,
            criticalMiss: false,
            success: null,
            type: 'unknown',
            actor: message.speaker?.alias || 'Unknown',
            resultClass: ''
        };

        // Extract individual dice
        for (const term of roll.terms) {
            if (term.results) {
                for (const r of term.results) {
                    data.dice.push({
                        faces: term.faces,
                        result: r.result,
                        active: r.active !== false
                    });
                }

                // Check for d20
                if (term.faces === 20) {
                    data.isD20 = true;
                    const d20Result = term.results[0]?.result;
                    if (d20Result === 20) {
                        data.criticalHit = true;
                        data.resultClass = 'critical-hit';
                    } else if (d20Result === 1) {
                        data.criticalMiss = true;
                        data.resultClass = 'critical-miss';
                    }
                }
            }
        }

        // Try to determine roll type from flavor
        const flavor = message.flavor?.toLowerCase() || '';
        if (flavor.includes('attack')) data.type = 'attack';
        else if (flavor.includes('damage')) data.type = 'damage';
        else if (flavor.includes('save') || flavor.includes('saving')) data.type = 'save';
        else if (flavor.includes('check') || flavor.includes('skill')) data.type = 'skill';
        else if (flavor.includes('initiative')) data.type = 'initiative';
        else if (data.isD20) data.type = 'check';

        return data;
    }

    /**
     * Generate narration for a roll
     */
    async _generateNarration(rollData, message) {
        const { type, total, criticalHit, criticalMiss, actor, formula } = rollData;
        const flavor = message.flavor || '';

        let prompt = '';

        if (criticalHit) {
            prompt = `${actor} rolled a natural 20 on ${flavor || 'their roll'}! Describe this critical success dramatically in one sentence.`;
        } else if (criticalMiss) {
            prompt = `${actor} rolled a natural 1 on ${flavor || 'their roll'}! Describe this critical failure dramatically in one sentence.`;
        } else {
            switch (type) {
                case 'attack':
                    prompt = `${actor} rolled ${total} for an attack (${flavor}). Describe the attack attempt briefly.`;
                    break;
                case 'damage':
                    prompt = `${actor} dealt ${total} damage (${formula}). Describe the impact briefly.`;
                    break;
                case 'save':
                    prompt = `${actor} rolled ${total} on a saving throw (${flavor}). Describe their effort briefly.`;
                    break;
                case 'skill':
                    prompt = `${actor} rolled ${total} on a skill check (${flavor}). Describe the attempt briefly.`;
                    break;
                case 'initiative':
                    return null; // Don't narrate initiative
                default:
                    prompt = `${actor} rolled ${total} (${formula}${flavor ? ': ' + flavor : ''}). Briefly describe the outcome.`;
            }
        }

        const response = await ChronicleKeeper.ollama.chat({
            model: ChronicleKeeperSettings.model,
            messages: [
                { role: 'system', content: 'You are a tabletop RPG narrator. Give very brief (one sentence) roll narrations. Be vivid but concise.' },
                { role: 'user', content: prompt }
            ],
            temperature: criticalHit || criticalMiss ? 0.9 : 0.7,
            maxTokens: 80
        });

        return response?.trim() || null;
    }

    /**
     * Determine DC from context
     * @param {string} text - Text to search for DC
     * @returns {number|null}
     */
    extractDC(text) {
        const match = text.match(/DC\s*(\d+)/i);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Check if roll beats DC
     * @param {number} total - Roll total
     * @param {number} dc - Difficulty class
     * @returns {boolean}
     */
    beatsDC(total, dc) {
        return total >= dc;
    }
}
