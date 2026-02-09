/**
 * Chronicle Keeper - Combat Narrator
 */

import { MODULE_NAME, ChronicleKeeper, getSetting } from '../main.js';
import { ChronicleKeeperSettings } from '../settings.js';

/**
 * Generates dramatic combat narration
 */
export class CombatNarrator {
    /**
     * Generate attack narration
     * @param {Object} data - Attack data
     * @returns {Promise<string>}
     */
    static async narrateAttack(data) {
        const { attacker, target, weapon, hit, critical, damage } = data;

        let prompt = '';
        if (critical) {
            prompt = `${attacker} scores a CRITICAL HIT on ${target} with ${weapon}, dealing ${damage} damage! Describe this devastating blow dramatically.`;
        } else if (hit) {
            prompt = `${attacker} hits ${target} with ${weapon} for ${damage} damage. Briefly describe the strike.`;
        } else {
            prompt = `${attacker} misses ${target} with ${weapon}. Briefly describe the failed attack.`;
        }

        return await ChronicleKeeper.ollama?.chat({
            model: ChronicleKeeperSettings.model,
            messages: [
                { role: 'system', content: 'Narrate combat briefly (1 sentence). Be vivid but concise.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.8,
            maxTokens: 60
        }) || '';
    }

    /**
     * Generate death/defeat narration
     * @param {string} name - Defeated creature name
     * @param {string} killer - Who dealt the final blow
     * @returns {Promise<string>}
     */
    static async narrateDeath(name, killer) {
        return await ChronicleKeeper.ollama?.chat({
            model: ChronicleKeeperSettings.model,
            messages: [
                { role: 'system', content: 'Narrate a creature defeat dramatically but briefly (1-2 sentences).' },
                { role: 'user', content: `${name} falls, defeated by ${killer}. Describe their demise.` }
            ],
            temperature: 0.8,
            maxTokens: 80
        }) || '';
    }

    /**
     * Generate spell effect narration
     * @param {Object} data - Spell data
     * @returns {Promise<string>}
     */
    static async narrateSpell(data) {
        const { caster, spell, targets, effect } = data;
        const prompt = `${caster} casts ${spell}${targets ? ` at ${targets}` : ''}. ${effect || ''} Describe the magical effect briefly.`;

        return await ChronicleKeeper.ollama?.chat({
            model: ChronicleKeeperSettings.model,
            messages: [
                { role: 'system', content: 'Describe magic vividly but briefly (1-2 sentences).' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.9,
            maxTokens: 80
        }) || '';
    }
}
