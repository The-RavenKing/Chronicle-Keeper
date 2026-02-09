/**
 * Chronicle Keeper - Actor Bridge
 * Integrates with Foundry actor/character sheets
 */

import { MODULE_NAME } from '../main.js';

/**
 * Bridge between Chronicle Keeper and Foundry actors
 */
export class ActorBridge {
    constructor() {
        this.systemId = game.system.id;
    }

    /**
     * Get context string for a character actor
     * @param {Actor} actor - Foundry actor
     * @returns {string} Character context for AI
     */
    getCharacterContext(actor) {
        if (!actor) return '';

        if (this.systemId === 'dnd5e') {
            return this._getDnD5eContext(actor);
        }

        // Generic fallback
        return this._getGenericContext(actor);
    }

    /**
     * Get D&D 5e specific context
     */
    _getDnD5eContext(actor) {
        const data = actor.system;
        const lines = [];

        lines.push(`**${actor.name}** - Level ${data.details?.level || '?'} ${data.details?.race || ''} ${actor.classes?.map(c => c.name).join('/') || ''}`);

        // Stats
        const abilities = data.abilities || {};
        const abilityStrs = Object.entries(abilities).map(([key, val]) =>
            `${key.toUpperCase()}: ${val.value}`
        );
        if (abilityStrs.length) lines.push(`Stats: ${abilityStrs.join(', ')}`);

        // HP
        if (data.attributes?.hp) {
            const hp = data.attributes.hp;
            lines.push(`HP: ${hp.value}/${hp.max}${hp.temp ? ` (+${hp.temp} temp)` : ''}`);
        }

        // AC
        if (data.attributes?.ac) {
            lines.push(`AC: ${data.attributes.ac.value}`);
        }

        // Conditions
        const conditions = actor.effects?.filter(e => e.isTemporary)?.map(e => e.name) || [];
        if (conditions.length) lines.push(`Conditions: ${conditions.join(', ')}`);

        // Notable items
        const weapons = actor.items?.filter(i => i.type === 'weapon')?.map(i => i.name) || [];
        if (weapons.length) lines.push(`Weapons: ${weapons.slice(0, 3).join(', ')}`);

        // Spell slots (if caster)
        if (data.spells) {
            const slots = Object.entries(data.spells)
                .filter(([k, v]) => k.startsWith('spell') && v.max > 0)
                .map(([k, v]) => `${k.replace('spell', 'Lvl ')}: ${v.value}/${v.max}`);
            if (slots.length) lines.push(`Spell Slots: ${slots.join(', ')}`);
        }

        return lines.join('\n');
    }

    /**
     * Get generic context for unknown systems
     */
    _getGenericContext(actor) {
        const lines = [`**${actor.name}**`];

        if (actor.system?.attributes) {
            const attrs = Object.entries(actor.system.attributes)
                .filter(([k, v]) => typeof v === 'number' || (v && v.value !== undefined))
                .slice(0, 6)
                .map(([k, v]) => `${k}: ${v.value ?? v}`);
            if (attrs.length) lines.push(attrs.join(', '));
        }

        return lines.join('\n');
    }

    /**
     * Get all player characters in the game
     * @returns {Array<Actor>}
     */
    getPlayerCharacters() {
        return game.actors?.filter(a => a.hasPlayerOwner && a.type === 'character') || [];
    }

    /**
     * Get the current user's character
     * @returns {Actor|null}
     */
    getCurrentCharacter() {
        const speaker = ChatMessage.getSpeaker();
        return game.actors?.get(speaker.actor) || game.user?.character || null;
    }

    /**
     * Get party summary for AI context
     * @returns {string}
     */
    getPartySummary() {
        const pcs = this.getPlayerCharacters();
        if (!pcs.length) return '';

        return 'Party Members:\n' + pcs.map(pc => `- ${this.getCharacterContext(pc)}`).join('\n');
    }

    /**
     * Check if an actor has a specific condition
     * @param {Actor} actor 
     * @param {string} condition 
     * @returns {boolean}
     */
    hasCondition(actor, condition) {
        return actor.effects?.some(e =>
            e.name?.toLowerCase().includes(condition.toLowerCase())
        ) || false;
    }

    /**
     * Get actor's skill modifier (D&D 5e)
     * @param {Actor} actor 
     * @param {string} skill 
     * @returns {number|null}
     */
    getSkillMod(actor, skill) {
        if (this.systemId !== 'dnd5e') return null;
        return actor.system?.skills?.[skill]?.total ?? null;
    }
}
