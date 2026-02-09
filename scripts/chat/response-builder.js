/**
 * Chronicle Keeper - Response Builder
 * Formats AI responses for display in chat
 */

import { MODULE_ID, MODULE_NAME } from '../main.js';

/**
 * Builds and formats AI responses for Foundry chat
 */
export class ResponseBuilder {
    /**
     * Build a standard AI response
     */
    static buildStandardResponse(content) {
        return `
      <div class="chronicle-keeper-message">
        <div class="message-content">${this.formatContent(content)}</div>
      </div>
    `;
    }

    /**
     * Build a narration response
     */
    static buildNarration(content) {
        return `
      <div class="chronicle-keeper-message narration">
        <div class="message-content">${this.formatContent(content)}</div>
      </div>
    `;
    }

    /**
     * Build an NPC speech response
     */
    static buildNPCResponse(npcName, content) {
        return `
      <div class="chronicle-keeper-message npc-speech" data-npc-name="🗣️ ${npcName}">
        <div class="message-content">${this.formatContent(content)}</div>
      </div>
    `;
    }

    /**
     * Build a combat narration response
     */
    static buildCombatResponse(content) {
        return `
      <div class="chronicle-keeper-message combat">
        <div class="message-content">${this.formatContent(content)}</div>
      </div>
    `;
    }

    /**
     * Build the thinking indicator
     */
    static buildThinking() {
        return `
      <div class="chronicle-keeper-thinking">
        <div class="dots">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <span>Chronicle Keeper is thinking...</span>
      </div>
    `;
    }

    /**
     * Format content with markdown-like styling
     */
    static formatContent(content) {
        if (!content) return '';

        return content
            // Bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic text
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Newlines to breaks
            .replace(/\n/g, '<br>')
            // Dice notation highlighting
            .replace(/\b(\d+d\d+(?:[+-]\d+)?)\b/g, '<span class="dice-notation">$1</span>')
            // DC highlighting
            .replace(/\bDC\s*(\d+)\b/gi, '<span class="dc-value">DC $1</span>');
    }

    /**
     * Build a dice roll narration
     */
    static buildRollNarration(rollData, narration) {
        const { formula, total, success, criticalHit, criticalMiss } = rollData;

        let resultClass = '';
        let resultIcon = '';

        if (criticalHit) {
            resultClass = 'critical-hit';
            resultIcon = '💥';
        } else if (criticalMiss) {
            resultClass = 'critical-miss';
            resultIcon = '💀';
        } else if (success) {
            resultClass = 'success';
            resultIcon = '✅';
        } else if (success === false) {
            resultClass = 'failure';
            resultIcon = '❌';
        }

        return `
      <div class="chronicle-keeper-message roll-narration ${resultClass}">
        <div class="roll-header">
          <span class="roll-formula">${formula}</span>
          <span class="roll-result">${resultIcon} ${total}</span>
        </div>
        <div class="message-content">${this.formatContent(narration)}</div>
      </div>
    `;
    }

    /**
     * Post a response to chat
     */
    static async postToChat(html, options = {}) {
        const {
            speaker = { alias: 'Chronicle Keeper' },
            whisper = [],
            type = 'normal',
            flags = {}
        } = options;

        return ChatMessage.create({
            content: html,
            speaker,
            whisper,
            flags: {
                [MODULE_ID]: {
                    isAIResponse: true,
                    responseType: type,
                    ...flags
                }
            }
        });
    }
}
