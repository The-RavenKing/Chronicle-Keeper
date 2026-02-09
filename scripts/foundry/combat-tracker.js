/**
 * Chronicle Keeper - Combat Tracker Integration
 * Provides combat awareness and narration hooks
 */

import { MODULE_ID, MODULE_NAME, ChronicleKeeper, getSetting } from '../main.js';
import { ChronicleKeeperSettings } from '../settings.js';

/**
 * Combat tracker integration for AI awareness
 */
export class CombatTracker {
    constructor() {
        this.lastTurn = null;
        this.lastRound = null;
    }

    /**
     * Get current combat context for AI
     * @returns {string}
     */
    getCombatContext() {
        const combat = game.combat;
        if (!combat || !combat.active) return '';

        const lines = [];
        lines.push(`**Combat - Round ${combat.round}**`);

        // Current turn
        const current = combat.combatant;
        if (current) {
            lines.push(`Current Turn: ${current.name} (Initiative: ${current.initiative})`);
        }

        // Turn order
        const turnOrder = combat.turns
            .filter(c => !c.defeated)
            .map(c => `${c.name}${c.isNPC ? ' (NPC)' : ''}: ${c.initiative}`)
            .slice(0, 8);

        if (turnOrder.length) {
            lines.push(`Turn Order: ${turnOrder.join(' → ')}`);
        }

        // Defeated
        const defeated = combat.turns.filter(c => c.defeated).map(c => c.name);
        if (defeated.length) {
            lines.push(`Defeated: ${defeated.join(', ')}`);
        }

        return lines.join('\n');
    }

    /**
     * Handle turn change event
     * @param {Combat} combat 
     * @param {Object} updateData 
     */
    async onTurnChange(combat, updateData) {
        const combatant = combat.combatant;
        if (!combatant) return;

        // Don't narrate if same turn (could be updates)
        const turnKey = `${combat.round}-${combat.turn}`;
        if (this.lastTurn === turnKey) return;
        this.lastTurn = turnKey;

        // Generate turn narration
        if (ChronicleKeeper.chat && ChronicleKeeper.connected) {
            const isNPC = combatant.isNPC;
            const actor = combatant.actor;

            const prompt = isNPC
                ? `It's now ${combatant.name}'s turn in combat. Describe their readiness or intent briefly.`
                : `It's now ${combatant.name}'s turn. What does the situation look like from their perspective?`;

            // Only auto-narrate for NPCs or if setting enabled
            if (isNPC || getSetting('enableCombatNarration')) {
                await this._narrateTurn(combatant, prompt);
            }
        }
    }

    /**
     * Handle round change event
     * @param {Combat} combat 
     * @param {Object} updateData 
     */
    async onRoundChange(combat, updateData) {
        if (this.lastRound === combat.round) return;
        this.lastRound = combat.round;

        // Generate round transition narration
        if (ChronicleKeeper.chat && ChronicleKeeper.connected && combat.round > 1) {
            const prompt = `Round ${combat.round} of combat begins. Briefly describe the overall state of the battle.`;
            await this._narrateRound(combat, prompt);
        }
    }

    /**
     * Generate turn narration
     */
    async _narrateTurn(combatant, prompt) {
        try {
            const response = await ChronicleKeeper.ollama.chat({
                model: ChronicleKeeperSettings.model,
                messages: [
                    { role: 'system', content: 'You are a combat narrator. Keep descriptions very brief (1-2 sentences). Be dramatic but concise.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.8,
                maxTokens: 100
            });

            if (response) {
                await ChatMessage.create({
                    content: `<div class="chronicle-keeper-message combat"><div class="message-content"><em>${response}</em></div></div>`,
                    speaker: { alias: 'Combat Narrator' },
                    flags: { [MODULE_ID]: { isCombatNarration: true } }
                });
            }
        } catch (error) {
            console.warn(`${MODULE_NAME} | Turn narration failed:`, error);
        }
    }

    /**
     * Generate round narration
     */
    async _narrateRound(combat, prompt) {
        try {
            const defeated = combat.turns.filter(c => c.defeated).map(c => c.name);
            const remaining = combat.turns.filter(c => !c.defeated).length;

            const context = `${prompt}\nDefeated: ${defeated.join(', ') || 'None'}. ${remaining} combatants remain.`;

            const response = await ChronicleKeeper.ollama.chat({
                model: ChronicleKeeperSettings.model,
                messages: [
                    { role: 'system', content: 'You are a combat narrator. Keep round summaries brief (2-3 sentences).' },
                    { role: 'user', content: context }
                ],
                temperature: 0.7,
                maxTokens: 150
            });

            if (response) {
                await ChatMessage.create({
                    content: `<div class="chronicle-keeper-message combat"><div class="message-content">${response}</div></div>`,
                    speaker: { alias: 'Combat Narrator' },
                    flags: { [MODULE_ID]: { isRoundNarration: true } }
                });
            }
        } catch (error) {
            console.warn(`${MODULE_NAME} | Round narration failed:`, error);
        }
    }

    /**
     * Get combat summary for memory storage
     * @param {Combat} combat 
     * @returns {Object}
     */
    getCombatSummary(combat) {
        if (!combat) return null;

        return {
            rounds: combat.round,
            participants: combat.turns.map(c => ({
                name: c.name,
                isNPC: c.isNPC,
                defeated: c.defeated
            })),
            winners: combat.turns.filter(c => !c.defeated && !c.isNPC).map(c => c.name),
            defeated: combat.turns.filter(c => c.defeated).map(c => c.name)
        };
    }
}
