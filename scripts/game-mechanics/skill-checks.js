/**
 * Chronicle Keeper - Skill Checks Handler
 */

import { MODULE_NAME, ChronicleKeeper } from '../main.js';
import { DnD5eAdapter } from './dnd5e-adapter.js';

/**
 * Handles skill check suggestions and interpretations
 */
export class SkillChecks {
    constructor() {
        this.dnd5e = new DnD5eAdapter();
    }

    /**
     * Suggest a skill check for a player action
     * @param {string} action - Player's described action
     * @returns {Object|null}
     */
    suggestCheck(action) {
        if (!this.dnd5e.isActive()) return null;

        const skill = this.dnd5e.suggestSkill(action);
        if (!skill) return null;

        const skillName = this.dnd5e.getSkills()[skill];
        return {
            skill,
            skillName,
            suggestedDC: 15,
            rollCommand: `/roll 1d20 + @skills.${skill}.total`
        };
    }

    /**
     * Interpret a skill check result
     * @param {number} total - Roll total
     * @param {number} dc - Difficulty class
     * @param {string} skill - Skill used
     * @returns {Object}
     */
    interpretResult(total, dc, skill) {
        const margin = total - dc;
        const success = margin >= 0;

        let degree;
        if (margin >= 10) degree = 'exceptional';
        else if (margin >= 5) degree = 'solid';
        else if (margin >= 0) degree = 'bare';
        else if (margin >= -5) degree = 'close';
        else degree = 'significant';

        return {
            success,
            margin,
            degree,
            description: success
                ? `${degree === 'exceptional' ? 'Exceptional' : degree === 'solid' ? 'Solid' : 'Narrow'} success`
                : `${degree === 'close' ? 'Close' : 'Clear'} failure`
        };
    }
}
