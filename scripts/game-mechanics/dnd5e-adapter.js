/**
 * Chronicle Keeper - D&D 5e Adapter
 * Game system specific logic for D&D 5th Edition
 */

import { MODULE_NAME } from '../main.js';

/**
 * D&D 5e specific game mechanics adapter
 */
export class DnD5eAdapter {
    constructor() {
        this.systemId = 'dnd5e';
    }

    /**
     * Check if current system is D&D 5e
     * @returns {boolean}
     */
    isActive() {
        return game.system.id === this.systemId;
    }

    /**
     * Get skill list
     * @returns {Object}
     */
    getSkills() {
        return {
            acr: 'Acrobatics', ani: 'Animal Handling', arc: 'Arcana',
            ath: 'Athletics', dec: 'Deception', his: 'History',
            ins: 'Insight', itm: 'Intimidation', inv: 'Investigation',
            med: 'Medicine', nat: 'Nature', prc: 'Perception',
            prf: 'Performance', per: 'Persuasion', rel: 'Religion',
            slt: 'Sleight of Hand', ste: 'Stealth', sur: 'Survival'
        };
    }

    /**
     * Get ability names
     * @returns {Object}
     */
    getAbilities() {
        return {
            str: 'Strength', dex: 'Dexterity', con: 'Constitution',
            int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
        };
    }

    /**
     * Suggest appropriate skill for an action
     * @param {string} action - Described action
     * @returns {string|null}
     */
    suggestSkill(action) {
        const actionLower = action.toLowerCase();
        const skillMap = {
            'climb|jump|swim|push|pull|lift': 'ath',
            'balance|tumble|flip|dodge': 'acr',
            'hide|sneak|silent': 'ste',
            'search|investigate|examine|look': 'inv',
            'spot|notice|listen|watch': 'prc',
            'lie|deceive|bluff|trick': 'dec',
            'persuade|convince|negotiate|charm': 'per',
            'threaten|scare|menace': 'itm',
            'recall|remember|know|lore': 'his',
            'magic|arcane|spell|enchant': 'arc',
            'nature|wild|animal|plant': 'nat',
            'pray|divine|holy|religious': 'rel',
            'read|sense|empathy|motive': 'ins',
            'heal|medicine|treat|wound': 'med',
            'perform|sing|dance|act': 'prf',
            'pickpocket|palm|steal': 'slt',
            'track|survive|forage|navigate': 'sur',
            'calm|handle|tame|ride': 'ani'
        };

        for (const [pattern, skill] of Object.entries(skillMap)) {
            if (new RegExp(pattern).test(actionLower)) return skill;
        }
        return null;
    }

    /**
     * Suggest DC for difficulty
     * @param {string} difficulty - Difficulty description
     * @returns {number}
     */
    suggestDC(difficulty) {
        const diffLower = difficulty.toLowerCase();
        if (diffLower.includes('trivial') || diffLower.includes('very easy')) return 5;
        if (diffLower.includes('easy') || diffLower.includes('simple')) return 10;
        if (diffLower.includes('medium') || diffLower.includes('moderate')) return 15;
        if (diffLower.includes('hard') || diffLower.includes('difficult')) return 20;
        if (diffLower.includes('very hard') || diffLower.includes('challenging')) return 25;
        if (diffLower.includes('impossible') || diffLower.includes('nearly')) return 30;
        return 15; // Default moderate
    }

    /**
     * Interpret conditions
     * @param {string} condition - Condition name
     * @returns {string}
     */
    getConditionDescription(condition) {
        const conditions = {
            blinded: 'Cannot see. Auto-fail sight-based checks. Attacks have disadvantage, attacks against have advantage.',
            charmed: 'Cannot attack the charmer. Charmer has advantage on social checks.',
            deafened: 'Cannot hear. Auto-fail hearing-based checks.',
            frightened: 'Disadvantage on checks while source visible. Cannot willingly move closer to source.',
            grappled: 'Speed becomes 0. Ends if grappler incapacitated or moved out of reach.',
            incapacitated: 'Cannot take actions or reactions.',
            invisible: 'Impossible to see without magic. Advantage on attacks, attacks against have disadvantage.',
            paralyzed: 'Incapacitated, cannot move/speak. Auto-fail Str/Dex saves. Attacks have advantage, melee crits.',
            petrified: 'Transformed to stone. Incapacitated, unaware, resistant to all damage.',
            poisoned: 'Disadvantage on attack rolls and ability checks.',
            prone: 'Disadvantage on attacks. Melee attacks have advantage, ranged disadvantage. Crawl or stand up.',
            restrained: 'Speed 0. Attacks have disadvantage, Dex saves disadvantage. Attacks against have advantage.',
            stunned: 'Incapacitated, cannot move, can only speak falteringly. Auto-fail Str/Dex saves.',
            unconscious: 'Incapacitated, drops items, falls prone. Auto-fail saves, attacks have advantage, melee crits.'
        };
        return conditions[condition.toLowerCase()] || 'Unknown condition.';
    }

    /**
     * Get spell school description
     * @param {string} school 
     * @returns {string}
     */
    getSpellSchool(school) {
        const schools = {
            abj: 'Abjuration - Protective magic',
            con: 'Conjuration - Creating or teleporting',
            div: 'Divination - Revealing information',
            enc: 'Enchantment - Affecting minds',
            evo: 'Evocation - Elemental energy',
            ill: 'Illusion - Deceiving senses',
            nec: 'Necromancy - Life and death',
            trs: 'Transmutation - Changing properties'
        };
        return schools[school] || school;
    }

    /**
     * Get creature size category
     * @param {string} size 
     * @returns {Object}
     */
    getCreatureSize(size) {
        const sizes = {
            tiny: { space: '2.5 ft', examples: 'Imp, sprite, rat' },
            sm: { space: '5 ft', examples: 'Goblin, halfling, kobold' },
            med: { space: '5 ft', examples: 'Human, orc, elf' },
            lg: { space: '10 ft', examples: 'Ogre, horse, hippogriff' },
            huge: { space: '15 ft', examples: 'Giant, treant, elephant' },
            grg: { space: '20 ft+', examples: 'Dragon, kraken, tarrasque' }
        };
        return sizes[size] || { space: '5 ft', examples: 'Unknown' };
    }

    /**
     * Calculate proficiency bonus by level
     * @param {number} level 
     * @returns {number}
     */
    getProficiencyBonus(level) {
        return Math.ceil(level / 4) + 1;
    }

    /**
     * Get encounter difficulty thresholds
     * @param {number} level - Party level
     * @param {number} partySize - Number of players
     * @returns {Object}
     */
    getEncounterThresholds(level, partySize = 4) {
        const thresholdsPerLevel = [
            { easy: 25, medium: 50, hard: 75, deadly: 100 },      // Level 1
            { easy: 50, medium: 100, hard: 150, deadly: 200 },    // Level 2
            { easy: 75, medium: 150, hard: 225, deadly: 400 },    // Level 3
            { easy: 125, medium: 250, hard: 375, deadly: 500 },   // Level 4
            { easy: 250, medium: 500, hard: 750, deadly: 1100 }   // Level 5+
        ];

        const idx = Math.min(level - 1, 4);
        const base = thresholdsPerLevel[idx];

        return {
            easy: base.easy * partySize,
            medium: base.medium * partySize,
            hard: base.hard * partySize,
            deadly: base.deadly * partySize
        };
    }
}
