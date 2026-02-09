/**
 * Chronicle Keeper - Campaign Import Wizard
 * Step-by-step wizard to import existing campaigns using AI extraction
 */

import { MODULE_ID, MODULE_NAME, ChronicleKeeper } from '../main.js';
import { ChronicleKeeperSettings } from '../settings.js';

/**
 * Campaign Import Wizard Application
 * Multi-step form for importing campaign data
 */
export class CampaignImportWizard extends FormApplication {
    constructor(options = {}) {
        super(options);
        this.currentStep = 0;
        this.steps = [
            { id: 'overview', title: 'Campaign Overview', icon: 'fa-scroll' },
            { id: 'characters', title: 'Player Characters', icon: 'fa-users' },
            { id: 'npcs', title: 'NPCs', icon: 'fa-user-friends' },
            { id: 'locations', title: 'Locations', icon: 'fa-map-marker-alt' },
            { id: 'story', title: 'Story So Far', icon: 'fa-book' },
            { id: 'review', title: 'Review & Import', icon: 'fa-check-circle' }
        ];

        // Store user input for each step
        this.data = {
            overview: '',
            characters: '',
            npcs: '',
            locations: '',
            story: ''
        };

        // Store extracted data
        this.extracted = {
            campaign: null,
            characters: [],
            npcs: [],
            locations: [],
            storyBeats: []
        };

        this.isProcessing = false;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'chronicle-keeper-import-wizard',
            title: 'Campaign Import Wizard',
            template: `modules/${MODULE_ID}/templates/campaign-import.hbs`,
            classes: ['chronicle-keeper-import-wizard'],
            width: 650,
            height: 550,
            resizable: true
        });
    }

    getData() {
        const step = this.steps[this.currentStep];
        return {
            currentStep: this.currentStep,
            currentStepDisplay: this.currentStep + 1,
            totalSteps: this.steps.length,
            steps: this.steps.map((s, i) => ({
                ...s,
                active: i === this.currentStep,
                completed: i < this.currentStep
            })),
            step,
            isFirstStep: this.currentStep === 0,
            isLastStep: this.currentStep === this.steps.length - 1,
            isReviewStep: step.id === 'review',
            inputValue: this.data[step.id] || '',
            extracted: this.extracted,
            isProcessing: this.isProcessing,
            placeholders: this._getPlaceholder(step.id)
        };
    }

    _getPlaceholder(stepId) {
        const placeholders = {
            overview: `Describe your campaign setting and current situation. Example:

"Our campaign is set in the Forgotten Realms, in the region of the Sword Coast. The party has been hired by the Lord's Alliance to investigate a series of mysterious disappearances in the town of Phandalin. We are currently at level 5 and have just discovered that a cult is behind the kidnappings..."`,

            characters: `Describe your player characters. Example:

"Thorin Ironforge - Dwarf Fighter, level 5. Gruff but loyal, carries his grandfather's warhammer. He's searching for his missing brother.

Lyra Nightwhisper - Half-elf Wizard, level 5. Curious scholar from Candlekeep. She's fascinated by ancient magic and has a pet owl named Archimedes..."`,

            npcs: `List the important NPCs in your campaign. Example:

"Sildar Hallwinter - Human knight of the Lord's Alliance. He's the party's patron and contact. Stern but fair.

Glasstaff - The villain. A wizard who betrayed the Lords' Alliance. Currently in hiding. The party doesn't know his real identity is Iarno Albrek..."`,

            locations: `Describe important locations. Example:

"Phandalin - Small mining town, recently troubled by bandits. The party has a room at the Stonehill Inn.

Wave Echo Cave - Ancient dwarven mine, rumored to hold great magical power. The party is searching for its location.

Tresendar Manor - Ruined mansion at the edge of town. Secret hideout of the Redbrands gang..."`,

            story: `Summarize the major events so far. Example:

"Session 1: The party escorted a wagon to Phandalin. Ambushed by goblins. Rescued Sildar from Cragmaw Hideout.

Session 2: Arrived in Phandalin. Learned about the Redbrands terrorizing the town. Confronted them at the Sleeping Giant tavern.

Session 3: Cleared out Tresendar Manor. Discovered Glasstaff's connection to the Black Spider..."`
        };
        return placeholders[stepId] || '';
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Handle both jQuery and native element
        const root = html instanceof HTMLElement ? html : html[0];

        // Navigation buttons
        root.querySelector('.wizard-prev')?.addEventListener('click', () => this._onPrevious());
        root.querySelector('.wizard-next')?.addEventListener('click', () => this._onNext());
        root.querySelector('.wizard-finish')?.addEventListener('click', () => this._onFinish());

        // Text input
        const textarea = root.querySelector('.wizard-input');
        if (textarea) {
            textarea.addEventListener('input', (e) => {
                const stepId = this.steps[this.currentStep].id;
                this.data[stepId] = e.target.value;
            });
        }

        // Step navigation (clicking on step indicators)
        root.querySelectorAll('.step-indicator').forEach((el, index) => {
            el.addEventListener('click', () => {
                if (index < this.currentStep) {
                    this.currentStep = index;
                    this.render();
                }
            });
        });
    }

    async _onPrevious() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.render();
        }
    }

    async _onNext() {
        const stepId = this.steps[this.currentStep].id;

        // If there's content, extract it before moving on
        if (this.data[stepId]?.trim()) {
            this.isProcessing = true;
            this.render();

            try {
                await this._extractData(stepId, this.data[stepId]);
            } catch (error) {
                console.error(`${MODULE_NAME} | Extraction error:`, error);
                ui.notifications.error('Failed to process input. Please try again.');
            }

            this.isProcessing = false;
        }

        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.render();
        }
    }

    async _extractData(stepId, text) {
        if (!ChronicleKeeper.ollama?.connected) {
            ui.notifications.warn('Not connected to Ollama. Data will be saved as raw text.');
            return;
        }

        const model = ChronicleKeeperSettings.model || ChronicleKeeper.currentModel || 'llama3:8b';

        const prompts = {
            overview: `Extract campaign information from this text. Return ONLY valid JSON:
{
  "name": "campaign name or 'Unnamed Campaign'",
  "setting": "world/setting description",
  "currentSituation": "what's happening now",
  "partyLevel": "party level if mentioned, or null"
}

Text:
${text}`,

            characters: `Extract player characters from this text. Return ONLY a valid JSON array:
[
  {
    "name": "character name",
    "race": "race",
    "class": "class",
    "level": "level or null",
    "personality": "personality traits",
    "backstory": "backstory summary",
    "goals": "character goals"
  }
]

Text:
${text}`,

            npcs: `Extract NPCs from this text. Return ONLY a valid JSON array:
[
  {
    "name": "NPC name",
    "role": "their role (e.g., patron, villain, shopkeeper)",
    "description": "physical description if any",
    "personality": "personality traits",
    "relationship": "relationship to party",
    "secrets": "any secrets about them"
  }
]

Text:
${text}`,

            locations: `Extract locations from this text. Return ONLY a valid JSON array:
[
  {
    "name": "location name",
    "type": "type (city, dungeon, tavern, etc.)",
    "description": "description",
    "significance": "why it matters to the story"
  }
]

Text:
${text}`,

            story: `Extract story beats/events from this text. Return ONLY a valid JSON array:
[
  {
    "event": "what happened",
    "session": "session number if known, or null",
    "importance": "high/medium/low",
    "consequences": "ongoing effects of this event"
  }
]

Text:
${text}`
        };

        const prompt = prompts[stepId];
        if (!prompt) return;

        try {
            const response = await ChronicleKeeper.ollama.chat({
                model,
                messages: [
                    { role: 'system', content: 'You are a data extraction assistant. Return ONLY valid JSON, no explanations or markdown.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                maxTokens: 2000
            });

            // Parse JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);

                // Store extracted data
                switch (stepId) {
                    case 'overview':
                        this.extracted.campaign = parsed;
                        break;
                    case 'characters':
                        this.extracted.characters = Array.isArray(parsed) ? parsed : [parsed];
                        break;
                    case 'npcs':
                        this.extracted.npcs = Array.isArray(parsed) ? parsed : [parsed];
                        break;
                    case 'locations':
                        this.extracted.locations = Array.isArray(parsed) ? parsed : [parsed];
                        break;
                    case 'story':
                        this.extracted.storyBeats = Array.isArray(parsed) ? parsed : [parsed];
                        break;
                }

                console.log(`${MODULE_NAME} | Extracted ${stepId}:`, parsed);
            }
        } catch (error) {
            console.error(`${MODULE_NAME} | JSON parse error:`, error);
            ui.notifications.warn(`Could not parse ${stepId} data. It will be saved as raw text.`);
        }
    }

    async _onFinish() {
        this.isProcessing = true;
        this.render();

        try {
            // Save everything to memory
            await this._saveToMemory();

            ui.notifications.info('Campaign imported successfully!');
            this.close();
        } catch (error) {
            console.error(`${MODULE_NAME} | Import error:`, error);
            ui.notifications.error('Failed to import campaign: ' + error.message);
            this.isProcessing = false;
            this.render();
        }
    }

    async _saveToMemory() {
        const memory = ChronicleKeeper.memory;
        if (!memory) {
            throw new Error('Memory system not initialized');
        }

        // Save campaign overview as a high-importance story beat
        if (this.extracted.campaign) {
            await memory.addStoryBeat(
                `Campaign: ${this.extracted.campaign.name}. Setting: ${this.extracted.campaign.setting}. Current situation: ${this.extracted.campaign.currentSituation}`,
                'campaign_info',
                { importance: 'high' }
            );
        }

        // Save player characters
        for (const char of this.extracted.characters) {
            await memory.addStoryBeat(
                `Player Character: ${char.name} (${char.race} ${char.class}). ${char.personality}. ${char.backstory || ''}`,
                'player_character',
                { importance: 'high' }
            );
        }

        // Save NPCs to entity memory
        for (const npc of this.extracted.npcs) {
            await memory.addEntity('npcs', {
                name: npc.name,
                description: npc.description || '',
                personality: npc.personality || '',
                occupation: npc.role || '',
                relationships: npc.relationship || '',
                notes: npc.secrets || ''
            });
        }

        // Save locations to entity memory
        for (const loc of this.extracted.locations) {
            await memory.addEntity('locations', {
                name: loc.name,
                description: loc.description || '',
                type: loc.type || '',
                notes: loc.significance || ''
            });
        }

        // Save story beats
        for (const beat of this.extracted.storyBeats) {
            await memory.addStoryBeat(
                beat.event,
                'past_event',
                {
                    importance: beat.importance || 'medium',
                    session: beat.session,
                    consequences: beat.consequences
                }
            );
        }

        console.log(`${MODULE_NAME} | Campaign import complete`);
    }

    async _updateObject(event, formData) {
        // Required by FormApplication but not used
    }
}

/**
 * Open the Campaign Import Wizard
 */
export function openImportWizard() {
    new CampaignImportWizard().render(true);
}
