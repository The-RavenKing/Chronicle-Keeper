// Chronicle Keeper Module for Foundry VTT v13
console.log("Chronicle Keeper | Loading...");

// Initialize when Foundry is ready
Hooks.once('ready', async function() {
    console.log("Chronicle Keeper | Initializing for Foundry v" + game.version);
    
    // Register settings
    game.settings.register('chronicle-keeper', 'ollamaUrl', {
        name: 'Ollama URL',
        hint: 'URL where Ollama is running',
        scope: 'world',
        config: true,
        type: String,
        default: 'http://localhost:11434'
    });
    
    game.settings.register('chronicle-keeper', 'ollamaModel', {
        name: 'Model Name',
        hint: 'Ollama model to use - must match exactly (e.g. llama2:7b, llama2:latest, mistral)',
        scope: 'world',
        config: true,
        type: String,
        default: 'llama2:7b'
    });
    
    game.settings.register('chronicle-keeper', 'systemPrompt', {
        name: 'System Prompt',
        hint: 'Instructions for how the AI should behave as a game master',
        scope: 'world',
        config: true,
        type: String,
        default: 'You are a helpful and creative game master assistant for a tabletop RPG. Provide engaging, atmospheric responses that enhance the story. Be concise but descriptive.'
    });
    
    game.settings.register('chronicle-keeper', 'aiName', {
        name: 'AI Name',
        hint: 'The name shown for AI responses (e.g., "Chronicle Keeper", "Game Master", "Storyteller")',
        scope: 'world',
        config: true,
        type: String,
        default: 'Chronicle Keeper'
    });
    
    game.settings.register('chronicle-keeper', 'gmOnlyMode', {
        name: 'GM Only Mode',
        hint: 'If enabled, only GMs can use /ask, /recall, and /history. Players can still use /npc and /remember. Prevents spoilers!',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });
    
    game.settings.register('chronicle-keeper', 'ragEnabled', {
        name: 'Enable RAG',
        hint: 'Use semantic search to remember campaign details (requires nomic-embed-text model)',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });
    
    game.settings.register('chronicle-keeper', 'currentCampaign', {
        name: 'Campaign Name',
        hint: 'Name for this campaign (leave blank for default). Each campaign has separate memory.',
        scope: 'world',
        config: true,
        type: String,
        default: ''
    });
    
    game.settings.register('chronicle-keeper', 'campaignNotes', {
        name: 'Campaign Notes (for RAG)',
        hint: 'Important campaign information that the AI should remember',
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });
    
    game.settings.register('chronicle-keeper', 'currentState', {
        name: 'Current State',
        hint: 'Current situation context (locations, relationships, status)',
        scope: 'world',
        config: false,
        type: String,
        default: ''
    });
    
    game.settings.register('chronicle-keeper', 'autoNPCJournals', {
        name: 'Auto-Create NPC Journals',
        hint: 'Automatically create/update journal entries for NPCs after conversations',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    game.settings.register('chronicle-keeper', 'npcJournalName', {
        name: 'Player NPC Journal Name',
        hint: 'Name of the journal for player-visible NPC information',
        scope: 'world',
        config: true,
        type: String,
        default: 'NPCs'
    });
    
    game.settings.register('chronicle-keeper', 'npcJournalGMName', {
        name: 'GM NPC Journal Name',
        hint: 'Name of the journal for GM-only NPC secrets',
        scope: 'world',
        config: true,
        type: String,
        default: 'NPCs (GM Secrets)'
    });
    
    game.settings.register('chronicle-keeper', 'showWelcomeMessage', {
        name: 'Show Welcome Message on Load',
        hint: 'Display the full command list when Foundry loads. Disable this if you prefer to use /help instead.',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    // Show welcome message
    if (game.user.isGM) {
        const gmOnlyMode = game.settings.get('chronicle-keeper', 'gmOnlyMode');
        const showWelcome = game.settings.get('chronicle-keeper', 'showWelcomeMessage');
        
        ui.notifications.info("Chronicle Keeper loaded! Type /help for commands.");
        
        if (showWelcome) {
            ChatMessage.create({
                content: '<div style="border: 2px solid #ff6400; padding: 10px; background: rgba(255,100,0,0.1);">' +
                    '<h3>🎲 Chronicle Keeper Active!</h3>' +
                    (gmOnlyMode ? '<p><strong>⚠️ GM ONLY MODE ENABLED</strong> - Players cannot use /ask</p>' : '') +
                    '<p><strong>Commands:</strong></p>' +
                    '<ul>' +
                    '<li><code>/ask [question]</code> - Ask the AI (public)</li>' +
                    '<li><code>/wask [question]</code> - Ask the AI (whispered to GM)</li>' +
                    '<li><code>/ooc [question]</code> - Out of character meta question ⭐</li>' +
                    '<li><code>/wooc [question]</code> - OOC whispered</li>' +
                    '<li><code>/npc [Name]: [message]</code> - Talk to NPC (public)</li>' +
                    '<li><code>/wnpc [Name]: [message]</code> - Talk to NPC (whispered)</li>' +
                    '<li><code>/state [info]</code> - Set current situation context</li>' +
                    '<li><code>/ingest</code> - Learn all journals, characters, scenes!</li>' +
                    '<li><code>/npcjournal</code> - Generate NPC profiles from all chat history ⭐</li>' +
                    '<li><code>/help</code> - Show this command list</li>' +
                    '</ul>' +
                    '<p><strong>✨ Use /ooc for meta questions about the game!</strong></p>' +
                    '<p>Configure in <strong>Game Settings → Module Settings</strong></p>' +
                    (gmOnlyMode ? '' : '<p><em>Enable "GM Only Mode" in settings to prevent player spoilers</em></p>') +
                    '</div>',
                whisper: [game.user.id]
            });
        }
    }
    
    console.log("Chronicle Keeper | Ready - Commands available: /ask, /npc, /help");
});

// Track combat encounters automatically
Hooks.on('combatStart', (combat, updateData) => {
    if (!game.user.isGM) return;
    
    const ragEnabled = game.settings.get('chronicle-keeper', 'ragEnabled');
    if (!ragEnabled) return;
    
    console.log("Chronicle Keeper | Combat started, recording initial state");
    
    // Record initial HP for all combatants
    const combatants = combat.combatants.map(c => {
        const actor = c.actor;
        const hp = actor?.system?.attributes?.hp || actor?.system?.hp;
        const maxHP = hp?.max || hp?.value || 0;
        const currentHP = hp?.value || 0;
        
        return {
            id: c.id,
            name: actor?.name || 'Unknown',
            currentHP: currentHP,
            maxHP: maxHP,
            type: actor?.type || 'unknown'
        };
    });
    
    // Store combat start data temporarily
    game.chronicleKeeper = game.chronicleKeeper || {};
    game.chronicleKeeper.currentCombat = {
        id: combat.id,
        round: 0,
        startTime: new Date().toLocaleString(),
        initialState: combatants
    };
    
    // Auto-update current state
    const stateText = 'COMBAT STARTED\n' + combatants.map(c => 
        `${c.name}: ${c.currentHP}/${c.maxHP} HP`
    ).join('\n');
    game.settings.set('chronicle-keeper', 'currentState', stateText);
});

Hooks.on('deleteCombat', (combat, options, userId) => {
    if (!game.user.isGM) return;
    
    const ragEnabled = game.settings.get('chronicle-keeper', 'ragEnabled');
    if (!ragEnabled) return;
    
    console.log("Chronicle Keeper | Combat ended, recording final state");
    
    // Get stored combat data
    const storedCombat = game.chronicleKeeper?.currentCombat;
    if (!storedCombat || storedCombat.id !== combat.id) return;
    
    // Record final HP for all combatants
    const finalState = combat.combatants.map(c => {
        const actor = c.actor;
        const hp = actor?.system?.attributes?.hp || actor?.system?.hp;
        const currentHP = hp?.value || 0;
        const maxHP = hp?.max || hp?.value || 0;
        
        // Find initial state
        const initial = storedCombat.initialState.find(i => i.id === c.id);
        const hpChange = initial ? currentHP - initial.currentHP : 0;
        
        return {
            name: actor?.name || 'Unknown',
            initialHP: initial?.currentHP || 0,
            finalHP: currentHP,
            maxHP: maxHP,
            change: hpChange,
            survived: currentHP > 0,
            type: actor?.type || 'unknown'
        };
    });
    
    // Create combat summary
    const timestamp = new Date().toLocaleString();
    const duration = storedCombat.startTime;
    
    let summary = `[${timestamp}] === COMBAT ENCOUNTER ===\n`;
    summary += `Started: ${duration}\n`;
    summary += `Rounds: ${combat.round}\n\n`;
    
    // Separate PCs and NPCs
    const pcs = finalState.filter(c => c.type === 'character');
    const npcs = finalState.filter(c => c.type !== 'character');
    
    if (pcs.length > 0) {
        summary += 'PLAYER CHARACTERS:\n';
        pcs.forEach(pc => {
            const status = pc.survived ? '✓ SURVIVED' : '✗ DEFEATED';
            summary += `  ${pc.name}: ${pc.initialHP} → ${pc.finalHP}/${pc.maxHP} HP (${pc.change >= 0 ? '+' : ''}${pc.change}) ${status}\n`;
        });
    }
    
    if (npcs.length > 0) {
        summary += '\nENEMIES/NPCs:\n';
        npcs.forEach(npc => {
            const status = npc.survived ? '✓ SURVIVED' : '✗ DEFEATED';
            summary += `  ${npc.name}: ${npc.initialHP} → ${npc.finalHP}/${npc.maxHP} HP (${npc.change >= 0 ? '+' : ''}${npc.change}) ${status}\n`;
        });
    }
    
    summary += '=== END COMBAT ===\n';
    
    // Store in campaign memory
    const currentNotes = getCampaignNotes();
    setCampaignNotes(currentNotes + '\n' + summary);
    
    // Clear current state combat info
    game.settings.set('chronicle-keeper', 'currentState', '');
    
    // Clean up temporary data
    delete game.chronicleKeeper.currentCombat;
    
    // Notify GM
    ui.notifications.info("Combat summary saved to memory");
    
    console.log("Chronicle Keeper | Combat summary saved");
});

// Helper function to get current campaign name
function getCurrentCampaignKey() {
    const campaignName = game.settings.get('chronicle-keeper', 'currentCampaign');
    return campaignName.trim() === '' ? 'default' : campaignName.trim().toLowerCase().replace(/\s+/g, '-');
}

// Helper function to get campaign notes
function getCampaignNotes() {
    const allNotes = game.settings.get('chronicle-keeper', 'campaignNotes');
    const campaignKey = getCurrentCampaignKey();
    return allNotes[campaignKey] || '';
}

// Helper function to set campaign notes
function setCampaignNotes(notes) {
    const allNotes = game.settings.get('chronicle-keeper', 'campaignNotes');
    const campaignKey = getCurrentCampaignKey();
    allNotes[campaignKey] = notes;
    game.settings.set('chronicle-keeper', 'campaignNotes', allNotes);
}

// ===== NPC JOURNAL FUNCTIONS =====

// Find or create the NPC journal
async function getOrCreateNPCJournal(isGM = false) {
    const journalName = isGM ? 
        game.settings.get('chronicle-keeper', 'npcJournalGMName') :
        game.settings.get('chronicle-keeper', 'npcJournalName');
    
    // Find existing journal
    let journal = game.journal.find(j => j.name === journalName);
    
    if (!journal) {
        // Create new journal
        journal = await JournalEntry.create({
            name: journalName,
            ownership: isGM ? { default: 0 } : { default: 2 } // GM-only or visible to all
        });
        console.log(`Chronicle Keeper | Created ${isGM ? 'GM' : 'player'} NPC journal:`, journalName);
    }
    
    return journal;
}

// Find or create NPC page within journal
async function getOrCreateNPCPage(journal, npcName, isGM = false) {
    // Find existing page
    let page = journal.pages.find(p => p.name === npcName);
    
    if (!page) {
        // Create new page with template
        const template = isGM ? createGMNPCTemplate(npcName) : createPlayerNPCTemplate(npcName);
        page = await journal.createEmbeddedDocuments('JournalEntryPage', [{
            name: npcName,
            type: 'text',
            text: { content: template, format: 1 }, // format: 1 = HTML
            ownership: isGM ? { default: 0 } : { default: 2 }
        }]);
        page = page[0];
        console.log(`Chronicle Keeper | Created NPC page: ${npcName} (${isGM ? 'GM' : 'Player'})`);
    }
    
    return page;
}

// Create player-visible NPC template
function createPlayerNPCTemplate(npcName) {
    return `
<h1>${npcName}</h1>
<p><strong>Aliases:</strong> <span class="aliases">None known</span></p>
<p><strong>Species:</strong> <span class="species">Unknown</span></p>
<p><strong>Class:</strong> <span class="class">Unknown</span></p>
<p><strong>Gender:</strong> <span class="gender">Unknown</span></p>

<h2>Physical Description</h2>
<div class="physical-description">
<p><em>No description yet.</em></p>
</div>

<h2>Personality</h2>
<div class="personality">
<p><em>No personality information yet.</em></p>
</div>

<h2>Interactions</h2>
<div class="interactions">
<p><em>No interactions recorded.</em></p>
</div>
`;
}

// Create GM-only NPC template
function createGMNPCTemplate(npcName) {
    return `
<h1>${npcName} (GM Secrets)</h1>
<p><strong>True Identity:</strong> <span class="true-identity">${npcName}</span></p>
<p><strong>Public Persona:</strong> <span class="public-persona">${npcName}</span></p>

<h2>Secret Information</h2>
<div class="secrets">
<p><em>No secrets recorded yet.</em></p>
</div>

<h2>Hidden Motivations</h2>
<div class="motivations">
<p><em>No motivations recorded yet.</em></p>
</div>

<h2>GM Notes</h2>
<div class="gm-notes">
<p><em>No notes yet.</em></p>
</div>

<h2>Full Interaction History</h2>
<div class="full-history">
<p><em>No interactions yet.</em></p>
</div>
`;
}

// Update NPC page with AI-analyzed information
async function updateNPCFromConversation(npcName, playerMessage, npcResponse) {
    if (!game.settings.get('chronicle-keeper', 'autoNPCJournals')) {
        return; // Feature disabled
    }
    
    console.log(`Chronicle Keeper | Updating NPC journal for: ${npcName}`);
    
    try {
        // Get or create journals
        const playerJournal = await getOrCreateNPCJournal(false);
        const gmJournal = await getOrCreateNPCJournal(true);
        
        // Get or create pages
        const playerPage = await getOrCreateNPCPage(playerJournal, npcName, false);
        const gmPage = await getOrCreateNPCPage(gmJournal, npcName, true);
        
        // Get AI analysis of the conversation
        const analysis = await analyzeNPCConversation(npcName, playerMessage, npcResponse, playerPage.text.content);
        
        // Update player page
        await updatePlayerNPCPage(playerPage, analysis);
        
        // Update GM page with full history
        await updateGMNPCPage(gmPage, playerMessage, npcResponse);
        
        console.log(`Chronicle Keeper | Updated NPC journals for: ${npcName}`);
        
    } catch (error) {
        console.error(`Chronicle Keeper | Error updating NPC journal for ${npcName}:`, error);
    }
}

// Use AI to analyze conversation and extract NPC details
async function analyzeNPCConversation(npcName, playerMessage, npcResponse, currentContent) {
    const ollamaUrl = game.settings.get('chronicle-keeper', 'ollamaUrl');
    const model = game.settings.get('chronicle-keeper', 'ollamaModel');
    
    const analysisPrompt = `Based on this conversation with ${npcName}:

Player: "${playerMessage}"
${npcName}: "${npcResponse}"

Current known information about ${npcName}:
${currentContent}

Extract and provide ONLY the following information in this exact format:
PHYSICAL: [Brief physical description if any details mentioned, or "None" if nothing new]
PERSONALITY: [Personality traits inferred from dialogue, or "None" if nothing new]
SPECIES: [Species if mentioned, or "Unknown"]
CLASS: [Class/occupation if mentioned, or "Unknown"]
GENDER: [Gender if clear from context, or "Unknown"]
SUMMARY: [One sentence summary of this interaction]

Be concise. Only include NEW information not already in current content.`;

    try {
        const response = await fetch(ollamaUrl + '/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: analysisPrompt,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        
        const data = await response.json();
        console.log("Chronicle Keeper | AI Analysis Response:", data.response);
        const parsed = parseNPCAnalysis(data.response);
        console.log("Chronicle Keeper | Parsed Analysis:", parsed);
        return parsed;
        
    } catch (error) {
        console.error("Chronicle Keeper | Error analyzing NPC conversation:", error);
        // Return basic fallback
        return {
            physical: "None",
            personality: "None",
            species: "Unknown",
            class: "Unknown",
            gender: "Unknown",
            summary: `Conversation with ${npcName}`
        };
    }
}

// Parse AI response into structured data
function parseNPCAnalysis(aiResponse) {
    const analysis = {
        physical: "None",
        personality: "None",
        species: "Unknown",
        class: "Unknown",
        gender: "Unknown",
        summary: ""
    };
    
    const lines = aiResponse.split('\n');
    for (const line of lines) {
        if (line.startsWith('PHYSICAL:')) {
            analysis.physical = line.substring(9).trim();
        } else if (line.startsWith('PERSONALITY:')) {
            analysis.personality = line.substring(12).trim();
        } else if (line.startsWith('SPECIES:')) {
            analysis.species = line.substring(8).trim();
        } else if (line.startsWith('CLASS:')) {
            analysis.class = line.substring(6).trim();
        } else if (line.startsWith('GENDER:')) {
            analysis.gender = line.substring(7).trim();
        } else if (line.startsWith('SUMMARY:')) {
            analysis.summary = line.substring(8).trim();
        }
    }
    
    return analysis;
}

// Update player-visible NPC page
async function updatePlayerNPCPage(page, analysis) {
    console.log("Chronicle Keeper | Updating player page with analysis:", analysis);
    let content = page.text.content;
    const timestamp = new Date().toLocaleDateString();
    
    // Update physical description if new info
    if (analysis.physical !== "None") {
        console.log("Chronicle Keeper | Adding physical description:", analysis.physical);
        content = updateSection(content, 'physical-description', analysis.physical);
    }
    
    // Update personality if new info
    if (analysis.personality !== "None") {
        console.log("Chronicle Keeper | Adding personality:", analysis.personality);
        content = updateSection(content, 'personality', analysis.personality);
    }
    
    // Update species if known
    if (analysis.species !== "Unknown") {
        content = content.replace(/<span class="species">.*?<\/span>/, `<span class="species">${analysis.species}</span>`);
    }
    
    // Update class if known
    if (analysis.class !== "Unknown") {
        content = content.replace(/<span class="class">.*?<\/span>/, `<span class="class">${analysis.class}</span>`);
    }
    
    // Update gender if known
    if (analysis.gender !== "Unknown") {
        content = content.replace(/<span class="gender">.*?<\/span>/, `<span class="gender">${analysis.gender}</span>`);
    }
    
    // Add interaction summary
    if (analysis.summary) {
        content = addInteraction(content, `<strong>${timestamp}:</strong> ${analysis.summary}`);
    }
    
    await page.update({ 'text.content': content });
}

// Update GM-only NPC page with full conversation
async function updateGMNPCPage(page, playerMessage, npcResponse) {
    let content = page.text.content;
    const timestamp = new Date().toLocaleString();
    
    const fullInteraction = `
<p><strong>${timestamp}</strong><br>
<em>Player:</em> "${playerMessage}"<br>
<em>NPC:</em> "${npcResponse}"</p>`;
    
    content = addToSection(content, 'full-history', fullInteraction);
    
    await page.update({ 'text.content': content });
}

// Handle /npc-secret command - Add GM-only secret to NPC
async function handleNPCSecretCommand(npcName, secretInfo, chatData) {
    console.log("Chronicle Keeper | Adding secret to NPC:", npcName);
    
    const whisperTargets = chatData?.whisper || [];
    
    try {
        // Get or create GM journal and page
        const gmJournal = await getOrCreateNPCJournal(true);
        const gmPage = await getOrCreateNPCPage(gmJournal, npcName, true);
        
        // Add secret to GM secrets section
        let content = gmPage.text.content;
        const timestamp = new Date().toLocaleString();
        const secretHTML = `<p><strong>[${timestamp}]</strong> ${secretInfo}</p>`;
        
        content = addToSection(content, 'gm-secrets', secretHTML);
        await gmPage.update({ 'text.content': content });
        
        // Whispered confirmation to GM
        await ChatMessage.create({
            content: '<div style="background: rgba(156,39,176,0.1); padding: 10px; border-left: 3px solid #9c27b0;">' +
                '<strong>🔒 Secret Added to ' + npcName + ':</strong><br>' + secretInfo +
                '</div>',
            whisper: whisperTargets
        });
        
        ui.notifications.info("Secret added to GM journal for " + npcName);
        
    } catch (error) {
        console.error("Chronicle Keeper | Error adding NPC secret:", error);
        ui.notifications.error('Failed to add secret: ' + error.message);
    }
}

// Handle /npc-merge command - Merge two NPC identities
async function handleNPCMergeCommand(npcName1, npcName2, chatData) {
    console.log("Chronicle Keeper | Merging NPCs:", npcName1, "and", npcName2);
    
    const whisperTargets = chatData?.whisper || [];
    
    try {
        // Get both journals
        const playerJournal = await getOrCreateNPCJournal(false);
        const gmJournal = await getOrCreateNPCJournal(true);
        
        // Find both NPC pages in player journal
        const page1 = playerJournal.pages.find(p => p.name === npcName1);
        const page2 = playerJournal.pages.find(p => p.name === npcName2);
        
        if (!page1 || !page2) {
            const missing = !page1 ? npcName1 : npcName2;
            ui.notifications.warn('Could not find NPC page for: ' + missing);
            return;
        }
        
        // Extract all interactions from both pages
        const interactions1 = extractSection(page1.text.content, 'interactions');
        const interactions2 = extractSection(page2.text.content, 'interactions');
        
        // Update page1 to show the merge
        let content1 = page1.text.content;
        
        // Update aliases to include the other name
        content1 = updateSpan(content1, 'aliases', npcName2);
        
        // Add reveal note at top
        const revealNote = `<div style="background: rgba(255,215,0,0.2); padding: 10px; margin-bottom: 10px; border: 2px solid #ffd700;">
<strong>⚠️ IDENTITY REVEALED</strong><br>
<em>${npcName1} and ${npcName2} are the same person!</em>
</div>`;
        
        content1 = revealNote + content1;
        
        // Merge interactions
        content1 = content1.replace(/<div class="interactions">[\s\S]*?<\/div>/, 
            `<div class="interactions">
<p><em><strong>Combined interaction history (chronological):</strong></em></p>
${interactions1}
${interactions2}
</div>`);
        
        await page1.update({ 'text.content': content1 });
        
        // Update page2 to redirect to page1
        const redirectContent = `<div style="background: rgba(255,215,0,0.2); padding: 20px; border: 2px solid #ffd700;">
<h2>⚠️ This NPC has been merged</h2>
<p><strong>${npcName2}</strong> is actually <strong>${npcName1}</strong>!</p>
<p>All information has been moved to the ${npcName1} page.</p>
</div>`;
        
        await page2.update({ 'text.content': redirectContent });
        
        // Update GM pages similarly
        const gmPage1 = gmJournal.pages.find(p => p.name.includes(npcName1));
        const gmPage2 = gmJournal.pages.find(p => p.name.includes(npcName2));
        
        if (gmPage1 && gmPage2) {
            let gmContent = gmPage1.text.content;
            
            // Update true identity field
            gmContent = updateSpan(gmContent, 'true-identity', `${npcName1} / ${npcName2} (same person)`);
            gmContent = updateSpan(gmContent, 'public-persona', `Known as both ${npcName1} and ${npcName2}`);
            
            // Merge full histories
            const gmHistory1 = extractSection(gmPage1.text.content, 'full-history');
            const gmHistory2 = extractSection(gmPage2.text.content, 'full-history');
            
            gmContent = gmContent.replace(/<div class="full-history">[\s\S]*?<\/div>/,
                `<div class="full-history">
<p><em><strong>Complete merged history:</strong></em></p>
${gmHistory1}
${gmHistory2}
</div>`);
            
            await gmPage1.update({ 'text.content': gmContent });
            
            // Update GM page2 with redirect
            await gmPage2.update({ 'text.content': redirectContent });
        }
        
        // Whispered confirmation to GM
        await ChatMessage.create({
            content: '<div style="background: rgba(255,215,0,0.2); padding: 10px; border: 2px solid #ffd700;">' +
                '<strong>✨ NPCs Merged!</strong><br>' +
                npcName1 + ' and ' + npcName2 + ' have been revealed as the same person.<br>' +
                'Player journal updated with combined history.' +
                '</div>',
            whisper: whisperTargets
        });
        
        ui.notifications.info("NPCs merged successfully!");
        
    } catch (error) {
        console.error("Chronicle Keeper | Error merging NPCs:", error);
        ui.notifications.error('Failed to merge NPCs: ' + error.message);
    }
}

// Helper: Extract section content as HTML
function extractSection(content, className) {
    const regex = new RegExp(`<div class="${className}">([\s\S]*?)<\/div>`);
    const match = content.match(regex);
    return match ? match[1] : '';
}

// Helper: Update a span element with new text
function updateSpan(content, className, newText) {
    const regex = new RegExp(`<span class="${className}">[^<]*</span>`);
    return content.replace(regex, `<span class="${className}">${newText}</span>`);
}

// Helper: Update a section with new text (append)
function updateSection(content, className, newText) {
    const regex = new RegExp(`<div class="${className}">(.*?)<\/div>`, 's');
    const match = content.match(regex);
    
    if (match) {
        let currentText = match[1];
        // Remove "No description yet" type messages
        currentText = currentText.replace(/<p><em>No .*?<\/em><\/p>/g, '');
        // Add new text
        const updated = `<div class="${className}">${currentText}<p>${newText}</p></div>`;
        return content.replace(regex, updated);
    }
    
    return content;
}

// Helper: Add interaction to interactions section
function addInteraction(content, interactionHTML) {
    return addToSection(content, 'interactions', interactionHTML);
}

// Helper: Add content to any section
function addToSection(content, className, newHTML) {
    const regex = new RegExp(`<div class="${className}">(.*?)<\/div>`, 's');
    const match = content.match(regex);
    
    if (match) {
        let currentText = match[1];
        // Remove "No X yet" messages
        currentText = currentText.replace(/<p><em>No .*?<\/em><\/p>/g, '');
        // Add new content
        const updated = `<div class="${className}">${currentText}${newHTML}</div>`;
        return content.replace(regex, updated);
    }
    
    return content;
}

// Register chat commands
Hooks.on('chatMessage', (chatLog, message, chatData) => {
    const msg = message.trim();
    const msgLower = msg.toLowerCase();
    
    console.log("Chronicle Keeper | Chat command received:", msgLower.substring(0, 20));
    
    // /ask command
    if (msgLower.startsWith('/ask ')) {
        const gmOnlyMode = game.settings.get('chronicle-keeper', 'gmOnlyMode');
        if (gmOnlyMode && !game.user.isGM) {
            ui.notifications.warn('Only GMs can use /ask in GM Only Mode');
            return false;
        }
        const question = msg.substring(5).trim();
        handleAskCommand(question, chatData);
        return false;
    }
    
    // /wask command - whispered ask
    if (msgLower.startsWith('/wask ')) {
        const gmOnlyMode = game.settings.get('chronicle-keeper', 'gmOnlyMode');
        if (gmOnlyMode && !game.user.isGM) {
            ui.notifications.warn('Only GMs can use /wask in GM Only Mode');
            return false;
        }
        const question = msg.substring(6).trim();
        const whisperData = { ...chatData, whisper: [game.user.id, ...game.users.filter(u => u.isGM).map(u => u.id)] };
        handleAskCommand(question, whisperData);
        return false;
    }
    
    // /ooc command - out of character question (no memory, no state, just system prompt)
    if (msgLower.startsWith('/ooc ')) {
        const question = msg.substring(5).trim();
        handleOOCCommand(question, chatData);
        return false;
    }
    
    // /wooc command - whispered out of character
    if (msgLower.startsWith('/wooc ')) {
        const question = msg.substring(6).trim();
        const whisperData = { ...chatData, whisper: [game.user.id, ...game.users.filter(u => u.isGM).map(u => u.id)] };
        handleOOCCommand(question, whisperData);
        return false;
    }
    
    // /npc command  
    if (msgLower.startsWith('/npc ')) {
        const rest = msg.substring(5).trim();
        const parts = rest.split(':');
        if (parts.length >= 2) {
            const npcName = parts[0].trim();
            const npcMessage = parts.slice(1).join(':').trim();
            handleNPCCommand(npcName, npcMessage, chatData);
        } else {
            ui.notifications.warn('Usage: /npc [NPC Name]: [message]');
        }
        return false;
    }
    
    // /wnpc command - whispered npc
    if (msgLower.startsWith('/wnpc ')) {
        const rest = msg.substring(6).trim();
        const parts = rest.split(':');
        if (parts.length >= 2) {
            const npcName = parts[0].trim();
            const npcMessage = parts.slice(1).join(':').trim();
            const whisperData = { ...chatData, whisper: [game.user.id, ...game.users.filter(u => u.isGM).map(u => u.id)] };
            handleNPCCommand(npcName, npcMessage, whisperData);
        } else {
            ui.notifications.warn('Usage: /wnpc [NPC Name]: [message]');
        }
        return false;
    }
    
    // /remember command - add to campaign memory
    if (msgLower.startsWith('/remember ')) {
        const info = msg.substring(10).trim();
        handleRememberCommand(info);
        return false;
    }
    
    // /wremember command - whispered remember
    if (msgLower.startsWith('/wremember ')) {
        const info = msg.substring(11).trim();
        handleRememberCommand(info);
        return false;
    }
    
    // /recall command - search campaign memory
    if (msgLower.startsWith('/recall ')) {
        const gmOnlyMode = game.settings.get('chronicle-keeper', 'gmOnlyMode');
        if (gmOnlyMode && !game.user.isGM) {
            ui.notifications.warn('Only GMs can use /recall in GM Only Mode');
            return false;
        }
        const topic = msg.substring(8).trim();
        handleRecallCommand(topic);
        return false;
    }
    
    // /wrecall command - whispered recall
    if (msgLower.startsWith('/wrecall ')) {
        const gmOnlyMode = game.settings.get('chronicle-keeper', 'gmOnlyMode');
        if (gmOnlyMode && !game.user.isGM) {
            ui.notifications.warn('Only GMs can use /wrecall in GM Only Mode');
            return false;
        }
        const topic = msg.substring(9).trim();
        handleRecallCommand(topic);
        return false;
    }
    
    // /history command - view recent conversation history
    if (msgLower === '/history' || msgLower.startsWith('/history ')) {
        const gmOnlyMode = game.settings.get('chronicle-keeper', 'gmOnlyMode');
        if (gmOnlyMode && !game.user.isGM) {
            ui.notifications.warn('Only GMs can use /history in GM Only Mode');
            return false;
        }
        const count = msgLower === '/history' ? 10 : parseInt(msg.substring(9).trim()) || 10;
        handleHistoryCommand(count);
        return false;
    }
    
    // /clearhistory command - clear stored conversations
    if (msgLower === '/clearhistory') {
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can clear history');
            return false;
        }
        handleClearHistoryCommand();
        return false;
    }
    
    // /campaigns command - list all campaigns
    if (msgLower === '/campaigns') {
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can view campaigns');
            return false;
        }
        handleCampaignsCommand();
        return false;
    }
    
    // /state command - view or set current state
    if (msgLower === '/state' || msgLower.startsWith('/state ')) {
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can manage current state');
            return false;
        }
        if (msgLower === '/state') {
            handleViewStateCommand();
        } else {
            const stateInfo = msg.substring(7).trim();
            handleSetStateCommand(stateInfo);
        }
        return false;
    }
    
    // /clearstate command - clear current state
    if (msgLower === '/clearstate') {
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can clear state');
            return false;
        }
        handleClearStateCommand();
        return false;
    }
    
    // /ingest command - ingest Foundry content
    if (msgLower === '/ingest' || msgLower.startsWith('/ingest ')) {
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can use /ingest');
            return false;
        }
        const type = msgLower === '/ingest' ? 'all' : msg.substring(8).trim();
        handleIngestCommand(type);
        return false;
    }
    
    // /npc-secret command - add GM-only secrets to NPC (GM only, always whispered)
    if (msgLower.startsWith('/npc-secret ')) {
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can use /npc-secret');
            return false;
        }
        const rest = msg.substring(12).trim();
        const parts = rest.split(':');
        if (parts.length >= 2) {
            const npcName = parts[0].trim();
            const secretInfo = parts.slice(1).join(':').trim();
            // Always whisper to GM only
            const whisperData = { ...chatData, whisper: game.users.filter(u => u.isGM).map(u => u.id) };
            handleNPCSecretCommand(npcName, secretInfo, whisperData);
        } else {
            ui.notifications.warn('Usage: /npc-secret [NPC Name]: [secret information]');
        }
        return false;
    }
    
    // /npc-merge command - merge two NPC identities (GM only, always whispered)
    if (msgLower.startsWith('/npc-merge ')) {
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can use /npc-merge');
            return false;
        }
        const rest = msg.substring(11).trim();
        const parts = rest.split(' and ');
        if (parts.length === 2) {
            const npcName1 = parts[0].trim();
            const npcName2 = parts[1].trim();
            // Always whisper to GM only
            const whisperData = { ...chatData, whisper: game.users.filter(u => u.isGM).map(u => u.id) };
            handleNPCMergeCommand(npcName1, npcName2, whisperData);
        } else {
            ui.notifications.warn('Usage: /npc-merge [Name1] and [Name2]');
        }
        return false;
    }
    
    // /npcjournal command - generate NPC profiles from chat history (GM only)
    if (msgLower === '/npcjournal') {
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can use /npcjournal');
            return false;
        }
        handleNPCJournalCommand();
        return false;
    }
    
    // /help command - show command list
    if (msgLower === '/help') {
        handleHelpCommand();
        return false;
    }
    
    return true;
});

// Handle /ask command
async function handleAskCommand(question, chatData) {
    console.log("Chronicle Keeper | Handling /ask command");
    ui.notifications.info("Asking AI...");
    
    const aiName = game.settings.get('chronicle-keeper', 'aiName');
    const whisperTargets = chatData?.whisper || [];
    
    await ChatMessage.create({
        content: '<div style="background: rgba(100,150,255,0.1); padding: 10px; border-left: 3px solid #6496ff;">' +
            '<strong>Question:</strong> ' + question +
            '</div>',
        whisper: whisperTargets
    });
    
    try {
        const ollamaUrl = game.settings.get('chronicle-keeper', 'ollamaUrl');
        const model = game.settings.get('chronicle-keeper', 'ollamaModel');
        const systemPrompt = game.settings.get('chronicle-keeper', 'systemPrompt');
        const ragEnabled = game.settings.get('chronicle-keeper', 'ragEnabled');
        
        console.log("Chronicle Keeper | Connecting to:", ollamaUrl, "Model:", model);
        
        // Build context with RAG if enabled
        let context = '';
        if (ragEnabled) {
            // Add current state first (most important)
            const currentState = game.settings.get('chronicle-keeper', 'currentState');
            if (currentState && currentState.trim() !== '') {
                context = '\n\n=== CURRENT STATE ===\n' + currentState + '\n=== END CURRENT STATE ===\n';
            }
            
            // Then add relevant past context
            const campaignNotes = getCampaignNotes();
            if (campaignNotes) {
                // Search for relevant past conversations
                const lines = campaignNotes.split('\n').filter(line => line.trim() !== '');
                
                // Try to find relevant context by looking for keywords in the question
                const keywords = question.toLowerCase().split(' ').filter(w => w.length > 3);
                const relevantLines = lines.filter(line => {
                    const lineLower = line.toLowerCase();
                    return keywords.some(keyword => lineLower.includes(keyword));
                });
                
                // Use relevant lines if found, otherwise use recent history
                if (relevantLines.length > 0) {
                    context += '\n\nRELEVANT PAST CONTEXT:\n' + relevantLines.slice(-10).join('\n') + '\n\n';
                } else if (lines.length > 0) {
                    context += '\n\nRECENT CONTEXT:\n' + lines.slice(-5).join('\n') + '\n\n';
                }
            }
        }
        
        const fullPrompt = systemPrompt + context + '\n\nQuestion: ' + question + '\n\nAnswer:';
        
        const response = await fetch(ollamaUrl + '/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: fullPrompt,
                stream: false
            })
        });
        
        console.log("Chronicle Keeper | Response status:", response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Chronicle Keeper | Error response:", errorText);
            throw new Error('HTTP ' + response.status + ' - ' + errorText);
        }
        
        const data = await response.json();
        console.log("Chronicle Keeper | Received response");
        
        await ChatMessage.create({
            speaker: { alias: aiName },
            content: '<div style="background: rgba(255,100,100,0.1); padding: 10px; border-left: 3px solid #ff6464;">' +
                '<strong>AI Response:</strong><br>' + data.response +
                '</div>',
            whisper: whisperTargets
        });
        
        ui.notifications.info("Response received!");
        
        // Automatically store conversation for future reference
        if (ragEnabled) {
            const conversationEntry = '[' + new Date().toLocaleString() + '] Q: ' + question + ' | A: ' + data.response;
            const currentNotes = getCampaignNotes();
            setCampaignNotes(currentNotes + '\n' + conversationEntry);
            console.log("Chronicle Keeper | Auto-stored conversation");
        }
        
    } catch (error) {
        console.error("Chronicle Keeper | Error:", error);
        ui.notifications.error('Failed to get AI response: ' + error.message);
        
        const url = game.settings.get('chronicle-keeper', 'ollamaUrl');
        await ChatMessage.create({
            speaker: { alias: aiName },
            content: '<div style="background: rgba(255,0,0,0.1); padding: 10px; border-left: 3px solid #ff0000;">' +
                '<strong>Error:</strong> Could not connect to Ollama at ' + url + '<br>' +
                'Make sure Ollama is running with: <code>ollama serve</code>' +
                '</div>',
            whisper: whisperTargets
        });
    }
}

// Handle /npc command
async function handleNPCCommand(npcName, message, chatData) {
    console.log("Chronicle Keeper | Handling /npc command for:", npcName);
    ui.notifications.info('Talking to ' + npcName + '...');
    
    const whisperTargets = chatData?.whisper || [];
    
    await ChatMessage.create({
        content: '<div style="background: rgba(100,150,255,0.1); padding: 10px; border-left: 3px solid #6496ff;">' +
            '<strong>You to ' + npcName + ':</strong> ' + message +
            '</div>',
        whisper: whisperTargets
    });
    
    try {
        const ollamaUrl = game.settings.get('chronicle-keeper', 'ollamaUrl');
        const model = game.settings.get('chronicle-keeper', 'ollamaModel');
        const systemPrompt = game.settings.get('chronicle-keeper', 'systemPrompt');
        const ragEnabled = game.settings.get('chronicle-keeper', 'ragEnabled');
        
        // Build context with past conversations with this NPC
        let npcContext = '';
        if (ragEnabled) {
            const campaignNotes = getCampaignNotes();
            if (campaignNotes) {
                // Find all past conversations with this specific NPC
                const lines = campaignNotes.split('\n');
                const npcLines = lines.filter(line => 
                    line.includes('NPC ' + npcName + ' -') || 
                    line.includes(npcName + ':')
                );
                
                if (npcLines.length > 0) {
                    npcContext = '\n\nPAST CONVERSATIONS WITH ' + npcName.toUpperCase() + ':\n' + 
                                npcLines.slice(-5).join('\n') + '\n\n';
                }
            }
        }
        
        const prompt = systemPrompt + npcContext + 
                      '\n\nYou are roleplaying as ' + npcName + '. ' +
                      'Stay in character and be consistent with past interactions. ' +
                      'The player says: "' + message + '"\n\nRespond as ' + npcName + ':';
        
        const response = await fetch(ollamaUrl + '/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        
        const data = await response.json();
        
        await ChatMessage.create({
            speaker: { alias: npcName },
            content: '<div style="background: rgba(255,165,0,0.1); padding: 10px; border-left: 3px solid #ffa500;">' +
                data.response +
                '</div>',
            whisper: whisperTargets
        });
        
        // Automatically store NPC conversation for future reference
        if (ragEnabled) {
            const conversationEntry = '[' + new Date().toLocaleString() + '] NPC ' + npcName + ' - Player: ' + message + ' | ' + npcName + ': ' + data.response;
            const currentNotes = getCampaignNotes();
            setCampaignNotes(currentNotes + '\n' + conversationEntry);
            console.log("Chronicle Keeper | Auto-stored NPC conversation with", npcName);
            
            // Update NPC journals with this conversation
            await updateNPCFromConversation(npcName, message, data.response);
        }
        
    } catch (error) {
        console.error("Chronicle Keeper | Error:", error);
        ui.notifications.error('Failed to get response from ' + npcName);
    }
}

// Handle /remember command - add to campaign notes
function handleRememberCommand(info) {
    console.log("Chronicle Keeper | Adding to campaign memory:", info);
    
    const currentNotes = getCampaignNotes();
    const timestamp = new Date().toLocaleDateString();
    const newNotes = currentNotes + '\n[' + timestamp + '] ' + info;
    
    setCampaignNotes(newNotes);
    
    ui.notifications.info("Added to campaign memory!");
    
    ChatMessage.create({
        content: '<div style="background: rgba(76,175,80,0.1); padding: 10px; border-left: 3px solid #4caf50;">' +
            '<strong>📝 Remembered:</strong> ' + info +
            '</div>'
    });
}

// Handle /recall command - search campaign notes
function handleRecallCommand(topic) {
    console.log("Chronicle Keeper | Recalling:", topic);
    
    const campaignNotes = getCampaignNotes();
    
    if (!campaignNotes || campaignNotes.trim() === '') {
        ui.notifications.warn("No conversation history yet!");
        ChatMessage.create({
            content: '<div style="background: rgba(255,152,0,0.1); padding: 10px; border-left: 3px solid #ff9800;">' +
                '<strong>⚠️ No conversation history yet</strong><br>' +
                'Start using /ask or /npc commands to build up conversation memory.' +
                '</div>'
        });
        return;
    }
    
    // Simple keyword search
    const lines = campaignNotes.split('\n').filter(line => line.trim() !== '');
    const matches = lines.filter(line => 
        line.toLowerCase().includes(topic.toLowerCase())
    );
    
    if (matches.length === 0) {
        ChatMessage.create({
            content: '<div style="background: rgba(255,152,0,0.1); padding: 10px; border-left: 3px solid #ff9800;">' +
                '<strong>🔍 No matches found for:</strong> ' + topic +
                '</div>'
        });
    } else {
        const resultText = matches.slice(-10).join('<br>'); // Show last 10 matches
        ChatMessage.create({
            content: '<div style="background: rgba(76,175,80,0.1); padding: 10px; border-left: 3px solid #4caf50;">' +
                '<strong>🔍 Found ' + matches.length + ' match(es) for "' + topic + '":</strong><br><br>' +
                resultText +
                '</div>'
        });
    }
}

// Handle /history command - show recent conversations
function handleHistoryCommand(count) {
    console.log("Chronicle Keeper | Showing history, last", count, "entries");
    
    const campaignNotes = getCampaignNotes();
    const campaignName = game.settings.get('chronicle-keeper', 'currentCampaign') || 'Default';
    
    if (!campaignNotes || campaignNotes.trim() === '') {
        ui.notifications.warn("No conversation history yet!");
        return;
    }
    
    const lines = campaignNotes.split('\n').filter(line => line.trim() !== '');
    const recentLines = lines.slice(-count);
    
    ChatMessage.create({
        content: '<div style="background: rgba(33,150,243,0.1); padding: 10px; border-left: 3px solid #2196f3;">' +
            '<strong>📜 Campaign: ' + campaignName + '</strong><br>' +
            '<strong>Recent History (last ' + count + '):</strong><br><br>' +
            recentLines.join('<br>') +
            '</div>'
    });
}

// Handle /clearhistory command
function handleClearHistoryCommand() {
    const campaignName = game.settings.get('chronicle-keeper', 'currentCampaign') || 'Default';
    
    Dialog.confirm({
        title: "Clear Conversation History",
        content: "<p>Are you sure you want to clear all stored conversations for campaign <strong>" + campaignName + "</strong>?</p><p>This cannot be undone.</p>",
        yes: () => {
            setCampaignNotes('');
            ui.notifications.info("Conversation history cleared!");
            ChatMessage.create({
                content: '<div style="background: rgba(255,152,0,0.1); padding: 10px; border-left: 3px solid #ff9800;">' +
                    '<strong>🗑️ Campaign "' + campaignName + '" history cleared</strong>' +
                    '</div>'
            });
        },
        no: () => {
            ui.notifications.info("Cancelled");
        }
    });
}

// Handle /campaigns command - list all campaigns with data
function handleCampaignsCommand() {
    const allNotes = game.settings.get('chronicle-keeper', 'campaignNotes');
    const currentCampaign = game.settings.get('chronicle-keeper', 'currentCampaign') || 'Default';
    const currentKey = getCurrentCampaignKey();
    
    const campaigns = Object.keys(allNotes).map(key => {
        const lines = (allNotes[key] || '').split('\n').filter(l => l.trim() !== '');
        const displayName = key === 'default' ? 'Default' : key;
        const isCurrent = key === currentKey;
        return {
            key: key,
            name: displayName,
            count: lines.length,
            current: isCurrent
        };
    });
    
    if (campaigns.length === 0) {
        ChatMessage.create({
            content: '<div style="background: rgba(33,150,243,0.1); padding: 10px; border-left: 3px solid #2196f3;">' +
                '<strong>📚 No campaigns yet</strong><br>' +
                'Start using /ask or /npc to create your first campaign!' +
                '</div>'
        });
        return;
    }
    
    let content = '<div style="background: rgba(33,150,243,0.1); padding: 10px; border-left: 3px solid #2196f3;">' +
        '<strong>📚 Available Campaigns:</strong><br><br>';
    
    campaigns.forEach(c => {
        const marker = c.current ? '➜ ' : '　';
        content += marker + '<strong>' + c.name + '</strong>: ' + c.count + ' entries<br>';
    });
    
    content += '<br><em>Current: ' + currentCampaign + '</em><br>';
    content += '<em>Change in Settings → Campaign Name</em>';
    content += '</div>';
    
    ChatMessage.create({ content: content });
}

// Handle /state command - view current state
function handleViewStateCommand() {
    const currentState = game.settings.get('chronicle-keeper', 'currentState');
    const campaignName = game.settings.get('chronicle-keeper', 'currentCampaign') || 'Default';
    
    if (!currentState || currentState.trim() === '') {
        ChatMessage.create({
            content: '<div style="background: rgba(255,152,0,0.1); padding: 10px; border-left: 3px solid #ff9800;">' +
                '<strong>📍 No Current State Set</strong><br>' +
                'Use <code>/state [info]</code> to set current situation context.<br><br>' +
                '<em>Example: /state Player 1 is in the tavern, Player 2 is at the docks</em>' +
                '</div>',
            whisper: [game.user.id]
        });
    } else {
        ChatMessage.create({
            content: '<div style="background: rgba(33,150,243,0.1); padding: 10px; border-left: 3px solid #2196f3;">' +
                '<strong>📍 Current State (' + campaignName + '):</strong><br><br>' +
                currentState.split('\n').join('<br>') +
                '</div>',
            whisper: [game.user.id]
        });
    }
}

// Handle /state [info] command - set current state
function handleSetStateCommand(stateInfo) {
    game.settings.set('chronicle-keeper', 'currentState', stateInfo);
    
    ui.notifications.info("Current state updated!");
    
    ChatMessage.create({
        content: '<div style="background: rgba(76,175,80,0.1); padding: 10px; border-left: 3px solid #4caf50;">' +
            '<strong>📍 Current State Updated:</strong><br><br>' +
            stateInfo.split('\n').join('<br>') +
            '</div>',
        whisper: [game.user.id]
    });
}

// Handle /clearstate command
function handleClearStateCommand() {
    const currentState = game.settings.get('chronicle-keeper', 'currentState');
    
    if (!currentState || currentState.trim() === '') {
        ui.notifications.info("Current state is already empty");
        return;
    }
    
    Dialog.confirm({
        title: "Clear Current State",
        content: "<p>Clear the current state context?</p>",
        yes: () => {
            game.settings.set('chronicle-keeper', 'currentState', '');
            ui.notifications.info("Current state cleared!");
            ChatMessage.create({
                content: '<div style="background: rgba(255,152,0,0.1); padding: 10px; border-left: 3px solid #ff9800;">' +
                    '<strong>📍 Current state cleared</strong>' +
                    '</div>',
                whisper: [game.user.id]
            });
        },
        no: () => {
            ui.notifications.info("Cancelled");
        }
    });
}

// Handle /ingest command - ingest Foundry content into memory
async function handleIngestCommand(type) {
    console.log("Chronicle Keeper | Ingesting content type:", type);
    
    ui.notifications.info("Ingesting campaign content...");
    
    let ingestedCount = 0;
    let contentParts = [];
    
    try {
        // Ingest Journals
        if (type === 'all' || type === 'journals') {
            for (const journal of game.journal.contents) {
                for (const page of journal.pages.contents) {
                    if (page.text?.content) {
                        const text = stripHTML(page.text.content);
                        if (text.length > 50) {
                            contentParts.push(`[JOURNAL: ${journal.name} - ${page.name}] ${text}`);
                            ingestedCount++;
                        }
                    }
                }
            }
        }
        
        // Ingest Actors (Characters, NPCs)
        if (type === 'all' || type === 'actors' || type === 'characters' || type === 'npcs') {
            for (const actor of game.actors.contents) {
                let actorInfo = `[${actor.type.toUpperCase()}: ${actor.name}]`;
                
                // Basic info
                if (actor.system) {
                    // Try to get common fields (works with most systems)
                    if (actor.system.details?.biography?.value) {
                        actorInfo += ` Bio: ${stripHTML(actor.system.details.biography.value)}`;
                    }
                    if (actor.system.details?.background) {
                        actorInfo += ` Background: ${actor.system.details.background}`;
                    }
                    if (actor.system.details?.trait) {
                        actorInfo += ` Traits: ${actor.system.details.trait}`;
                    }
                    
                    // Attributes
                    if (actor.system.attributes) {
                        const attrs = [];
                        for (const [key, value] of Object.entries(actor.system.attributes)) {
                            if (typeof value === 'object' && value.value !== undefined) {
                                attrs.push(`${key}: ${value.value}`);
                            }
                        }
                        if (attrs.length > 0) {
                            actorInfo += ` Stats: ${attrs.join(', ')}`;
                        }
                    }
                }
                
                if (actorInfo.length > 50) {
                    contentParts.push(actorInfo);
                    ingestedCount++;
                }
            }
        }
        
        // Ingest Scenes
        if (type === 'all' || type === 'scenes') {
            for (const scene of game.scenes.contents) {
                let sceneInfo = `[SCENE: ${scene.name}]`;
                
                if (scene.journal) {
                    const journal = game.journal.get(scene.journal);
                    if (journal) {
                        sceneInfo += ` Linked to journal: ${journal.name}`;
                    }
                }
                
                if (scene.description) {
                    sceneInfo += ` Description: ${scene.description}`;
                }
                
                // Add notes from pins
                const notes = scene.notes?.contents || [];
                if (notes.length > 0) {
                    sceneInfo += ` Notes: ${notes.map(n => n.text).join(', ')}`;
                }
                
                if (sceneInfo.length > 30) {
                    contentParts.push(sceneInfo);
                    ingestedCount++;
                }
            }
        }
        
        // Ingest Items (if type specified)
        if (type === 'items') {
            for (const item of game.items.contents) {
                let itemInfo = `[ITEM: ${item.name}]`;
                
                if (item.system?.description?.value) {
                    itemInfo += ` ${stripHTML(item.system.description.value)}`;
                }
                
                if (itemInfo.length > 30) {
                    contentParts.push(itemInfo);
                    ingestedCount++;
                }
            }
        }
        
        // Store all ingested content
        if (contentParts.length > 0) {
            const timestamp = new Date().toLocaleString();
            const ingestEntry = `\n[${timestamp}] === INGESTED CONTENT (${type}) ===\n` + 
                              contentParts.join('\n') + 
                              `\n=== END INGESTED CONTENT ===\n`;
            
            const currentNotes = getCampaignNotes();
            setCampaignNotes(currentNotes + ingestEntry);
        }
        
        // Show results
        ChatMessage.create({
            content: '<div style="background: rgba(76,175,80,0.1); padding: 10px; border-left: 3px solid #4caf50;">' +
                '<strong>✅ Ingestion Complete!</strong><br>' +
                `Ingested ${ingestedCount} items of type: ${type}<br><br>` +
                '<em>The AI now knows about this content!</em>' +
                '</div>'
        });
        
        ui.notifications.info(`Ingested ${ingestedCount} items!`);
        
    } catch (error) {
        console.error("Chronicle Keeper | Ingest error:", error);
        ui.notifications.error("Failed to ingest content: " + error.message);
    }
}

// Helper function to strip HTML tags
function stripHTML(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
}


// ===== NEW NPC JOURNAL FUNCTIONS - ADD BEFORE THE FINAL CONSOLE.LOG =====

// Handle /npcjournal command - generate NPC profiles from chat history
async function handleNPCJournalCommand() {
    console.log("Chronicle Keeper | Generating NPC journals from chat history");
    
    ui.notifications.info("Analyzing chat history for NPCs...");
    
    try {
        // Get all chat messages
        const messages = game.messages.contents;
        
        // First pass: collect ALL relevant messages (everything could contain NPC info)
        const allRelevantMessages = [];
        const npcConversations = {}; // For messages explicitly tagged as NPC conversations
        
        for (const msg of messages) {
            const content = msg.content || '';
            const speaker = msg.speaker?.alias || msg.alias || '';
            const timestamp = new Date(msg.timestamp).toLocaleString();
            
            // Skip empty messages
            if (!content.trim()) continue;
            
            // Priority 1: Explicit NPC conversations (from /npc commands)
            if (content.includes('NPC Response:') || content.includes('whispers:')) {
                const npcMatch = content.match(/<strong>([^<]+)<\/strong>/);
                if (npcMatch) {
                    const npcName = npcMatch[1].trim();
                    
                    // Skip system text
                    if (npcName === 'NPC Response' || npcName === 'Question' || npcName === 'OOC Question' || npcName === 'OOC Response') {
                        continue;
                    }
                    
                    if (!npcConversations[npcName]) {
                        npcConversations[npcName] = [];
                    }
                    
                    npcConversations[npcName].push({
                        content: stripHTML(content),
                        timestamp: timestamp,
                        speaker: speaker,
                        priority: 'high' // Mark as high priority NPC conversation
                    });
                }
            }
            
            // Priority 2: Messages with NPC speaker names
            if (speaker && speaker !== 'Chronicle Keeper' && speaker !== 'Chronicle Keeper (OOC)' && !speaker.includes('(OOC)')) {
                // Check if this speaker is a known NPC or might be one
                const speakerIsPlayer = game.users.contents.some(u => u.name === speaker);
                
                if (!speakerIsPlayer) {
                    // This might be an NPC
                    if (!npcConversations[speaker]) {
                        npcConversations[speaker] = [];
                    }
                    
                    npcConversations[speaker].push({
                        content: stripHTML(content),
                        timestamp: timestamp,
                        speaker: speaker,
                        priority: 'high'
                    });
                }
            }
            
            // Priority 3: ALL other messages - collect for AI analysis
            allRelevantMessages.push({
                content: stripHTML(content),
                timestamp: timestamp,
                speaker: speaker
            });
        }
        
        let npcNames = Object.keys(npcConversations);
        
        // STEP 1: Use AI to discover NPCs from ALL chat history
        console.log("Chronicle Keeper | Step 1: Discovering NPCs from all conversations...");
        ui.notifications.info("Step 1/2: Discovering NPCs from chat history...");
        
        // Compile recent chat history for AI analysis
        const recentMessages = allRelevantMessages.slice(-200);
        const chatHistoryText = recentMessages.map(m => 
            `[${m.timestamp}] ${m.speaker ? m.speaker + ': ' : ''}${m.content}`
        ).join('\n\n');
        
        // Ask AI to identify all NPCs mentioned
        const discoveredNPCs = await discoverNPCsFromHistory(chatHistoryText);
        
        // Merge discovered NPCs with explicit ones
        for (const discoveredNPC of discoveredNPCs) {
            if (!npcConversations[discoveredNPC]) {
                npcConversations[discoveredNPC] = [];
            }
            
            // Add all messages that mention this NPC
            for (const msg of allRelevantMessages) {
                const contentLower = msg.content.toLowerCase();
                const npcLower = discoveredNPC.toLowerCase();
                
                // Check for the full name OR just the first name (more flexible matching)
                const npcFirstName = npcLower.split(' ')[0];
                const npcMatches = contentLower.includes(npcLower) || 
                                 (npcFirstName.length > 3 && contentLower.includes(npcFirstName));
                
                if (npcMatches) {
                    const isDuplicate = npcConversations[discoveredNPC].some(existing => 
                        existing.content === msg.content && existing.timestamp === msg.timestamp
                    );
                    
                    if (!isDuplicate) {
                        npcConversations[discoveredNPC].push({
                            content: msg.content,
                            timestamp: msg.timestamp,
                            speaker: msg.speaker,
                            priority: 'medium'
                        });
                    }
                }
            }
        }
        
        npcNames = Object.keys(npcConversations);
        
        if (npcNames.length === 0) {
            ui.notifications.warn("No NPCs found in chat history!");
            return;
        }
        
        // STEP 2: Analyze each NPC
        console.log("Chronicle Keeper | Step 2: Analyzing NPC profiles...");
        ui.notifications.info(`Step 2/2: Analyzing ${npcNames.length} NPCs...`);
        
        await ChatMessage.create({
            content: '<div style="background: rgba(76,175,80,0.1); padding: 10px; border-left: 3px solid #4caf50;">' +
                `<strong>🔍 Found ${npcNames.length} NPCs in chat history</strong><br>` +
                `NPCs: ${npcNames.join(', ')}<br><br>` +
                '<em>Processing with AI...</em>' +
                '</div>',
            whisper: game.users.filter(u => u.isGM).map(u => u.id)
        });
        
        // Process each NPC
        let successCount = 0;
        const errors = [];
        
        for (const npcName of npcNames) {
            try {
                console.log(`Chronicle Keeper | Processing NPC: ${npcName}`);
                
                const conversations = npcConversations[npcName];
                
                // Sort: high priority first
                conversations.sort((a, b) => {
                    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
                    return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
                });
                
                const conversationText = conversations.map(c => {
                    const marker = c.priority === 'high' ? '[DIRECT CONVERSATION]' : '[MENTIONED IN]';
                    // Clean up the content to make it clearer
                    let cleanContent = c.content
                        .replace(/^Question:\s*/i, 'PLAYER ASKED: ')
                        .replace(/^AI Response:\s*/i, 'ANSWER: ')
                        .replace(/^OOC Question:\s*/i, 'PLAYER ASKED: ')
                        .replace(/^OOC Response:\s*/i, 'ANSWER: ');
                    
                    return `${marker} [${c.timestamp}]\n${cleanContent}`;
                }).join('\n\n---\n\n');
                
                console.log(`Chronicle Keeper | Conversation text for ${npcName}:`, conversationText.substring(0, 500) + '...');
                
                const npcProfile = await analyzeNPCFromHistory(npcName, conversationText);
                await createNPCJournalEntry(npcName, npcProfile, conversations);
                
                successCount++;
                
            } catch (error) {
                console.error(`Chronicle Keeper | Error processing ${npcName}:`, error);
                errors.push({ name: npcName, error: error.message });
            }
        }
        
        // Show completion
        let resultMessage = '<div style="background: rgba(76,175,80,0.1); padding: 10px; border-left: 3px solid #4caf50;">' +
            '<strong>✅ NPC Journal Generation Complete!</strong><br>' +
            `Successfully processed ${successCount} NPCs<br>`;
        
        if (errors.length > 0) {
            resultMessage += `<br><strong>⚠️ Errors (${errors.length}):</strong><br>`;
            errors.forEach(e => {
                resultMessage += `• ${e.name}: ${e.error}<br>`;
            });
        }
        
        resultMessage += '<br><em>Check the "NPCs" journal for player-visible profiles.</em><br>' +
            '<em>Check the "NPCs (GM Secrets)" journal for complete information.</em>' +
            '</div>';
        
        await ChatMessage.create({
            content: resultMessage,
            whisper: game.users.filter(u => u.isGM).map(u => u.id)
        });
        
        ui.notifications.info(`NPC journals created for ${successCount} NPCs!`);
        
    } catch (error) {
        console.error("Chronicle Keeper | NPC Journal error:", error);
        ui.notifications.error("Failed to generate NPC journals: " + error.message);
    }
}

// Use AI to discover all NPCs mentioned in chat history
async function discoverNPCsFromHistory(chatHistoryText) {
    const ollamaUrl = game.settings.get('chronicle-keeper', 'ollamaUrl');
    const model = game.settings.get('chronicle-keeper', 'ollamaModel');
    
    const discoveryPrompt = `You are analyzing chat history from a tabletop RPG campaign. Identify ALL non-player characters (NPCs) mentioned.

Here is the chat history:

${chatHistoryText}

Identify EVERY NPC mentioned. Include characters the players talked to, NPCs mentioned in descriptions, quest givers, merchants, guards, villains, allies.

IMPORTANT: 
- Do NOT include player character names
- Do NOT include "Chronicle Keeper"
- Do NOT include generic terms like "the guard" unless they have a specific name
- Only include actual named NPCs

Provide your answer in this EXACT format:

NPC_LIST:
[NPC Name 1]
[NPC Name 2]
[NPC Name 3]

If no NPCs found, respond: NPC_LIST:\nNONE`;

    try {
        const response = await fetch(ollamaUrl + '/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: discoveryPrompt,
                stream: false
            })
        });
        
        if (!response.ok) throw new Error('HTTP ' + response.status);
        
        const data = await response.json();
        return parseNPCList(data.response);
        
    } catch (error) {
        console.error("Chronicle Keeper | Error discovering NPCs:", error);
        return [];
    }
}

// Parse AI response to extract NPC names
function parseNPCList(aiResponse) {
    const npcList = [];
    const lines = aiResponse.split('\n');
    let inList = false;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed === 'NPC_LIST:') {
            inList = true;
            continue;
        }
        
        if (inList && trimmed && trimmed !== 'NONE') {
            let npcName = trimmed.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
            
            if (npcName && 
                npcName !== 'Chronicle Keeper' && 
                npcName !== 'Chronicle Keeper (OOC)' &&
                !npcName.includes('Player') &&
                !npcName.includes('player') &&
                npcName.length > 1) {
                npcList.push(npcName);
            }
        }
    }
    
    return npcList;
}

// Use AI to analyze NPC from all their conversation history - OVERHAULED VERSION
async function analyzeNPCFromHistory(npcName, conversationText) {
    const ollamaUrl = game.settings.get('chronicle-keeper', 'ollamaUrl');
    const model = game.settings.get('chronicle-keeper', 'ollamaModel');
    
    // FIRST PASS: Extract everything including physical descriptions
    const analysisPrompt = `You are analyzing conversations about "${npcName}" from a D&D campaign.

YOUR #1 PRIORITY: Find and extract PHYSICAL DESCRIPTIONS.

Physical descriptions can appear in many forms:
✅ "I notice their crimson cloak" → Extract: "Wears a crimson cloak"
✅ "The tall elf with silver hair" → Extract: "Tall elf with silver hair"
✅ "She has piercing green eyes" → Extract: "Piercing green eyes"
✅ "He's wearing chain mail" → Extract: "Wears chain mail"
✅ "The scarred veteran" → Extract: "Has scars (veteran)"
✅ "I like your fancy hat" → Extract: "Wears a fancy hat"
✅ "His deep voice" → Extract: "Deep voice"
✅ "The young woman" → Extract: "Young woman"
✅ "Old man" → Extract: "Appears old/elderly"

Here are the conversations:

${conversationText}

Extract these fields in this EXACT format:

NAME: ${npcName}
ALIASES: Other names this NPC is called, or "None"
SPECIES: Race/species mentioned (elf, human, dwarf, etc.), or "Unknown"
GENDER: Gender if clear from pronouns/context, or "Unknown"  
CLASS: Job/occupation (guard, merchant, barmaid, etc.), or "Unknown"
LOCATIONS: Where this NPC can be FOUND (not places they mention visiting), or "Unknown"

PHYSICAL_DESCRIPTION:
[Write 2-5 sentences describing the NPC's appearance. Include:
- Body type/build (tall, short, muscular, slender)
- Hair color and style
- Eye color
- Facial features (scars, beard, etc.)
- Clothing and armor
- Distinctive features or accessories
- Approximate age
If you find ANY physical details AT ALL, write them here. If truly NOTHING is mentioned, write: "No physical description mentioned in conversations."]

PERSONALITY:
[Describe personality traits shown in dialogue/behavior, or write: "Limited personality information"]

RELATIONSHIPS:
[Describe relationships with the party/other NPCs, or write: "No relationships established"]

KEY_INFORMATION:
[Important facts about THIS NPC, not stories they tell about the past, or write: "No key information"]`;

    try {
        console.log(`Chronicle Keeper | OVERHAULED: Analyzing ${npcName}...`);
        
        const response = await fetch(ollamaUrl + '/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: analysisPrompt,
                stream: false,
                options: {
                    temperature: 0.7  // Slightly higher temperature for more creative extraction
                }
            })
        });
        
        if (!response.ok) throw new Error('HTTP ' + response.status);
        
        const data = await response.json();
        console.log(`Chronicle Keeper | Raw AI response for ${npcName}:`, data.response);
        
        const profile = parseNPCProfile(data.response);
        
        // SECOND PASS: If physical description is too generic, try again with a focused prompt
        if (profile.physical === "No physical description available." || 
            profile.physical === "No physical description mentioned in conversations." ||
            profile.physical.length < 50) {
            
            console.log(`Chronicle Keeper | Physical description too short for ${npcName}, attempting focused extraction...`);
            
            const focusedPhysicalPrompt = `Look at these conversations about "${npcName}" and find ANY mentions of physical appearance:

${conversationText}

TASK: Extract EVERY detail about how ${npcName} looks. Look for:
- Descriptions of clothing ("wearing a", "dressed in", "cloak", "armor", "robe")
- Body/build mentions ("tall", "short", "muscular", "thin", "large", "small")
- Hair ("black hair", "bald", "long hair", "ponytail")
- Eyes ("blue eyes", "piercing gaze")
- Age indicators ("young", "old", "elderly", "child")
- Facial features ("beard", "scar", "tattoo", "handsome", "ugly")
- Voice ("deep voice", "high-pitched", "raspy")
- Race indicators ("elf ears", "dwarven", "halfling")
- Equipment ("carries a sword", "has a staff")

Write a 2-4 sentence physical description. If you find ANYTHING, include it. If absolutely nothing, write exactly: "No physical details found."

PHYSICAL DESCRIPTION:`;

            const physicalResponse = await fetch(ollamaUrl + '/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: focusedPhysicalPrompt,
                    stream: false,
                    options: {
                        temperature: 0.8,
                        max_tokens: 500
                    }
                })
            });
            
            if (physicalResponse.ok) {
                const physicalData = await physicalResponse.json();
                const extractedPhysical = physicalData.response.trim();
                
                if (extractedPhysical && 
                    extractedPhysical !== "No physical details found." &&
                    extractedPhysical.length > profile.physical.length) {
                    console.log(`Chronicle Keeper | Found better physical description: ${extractedPhysical.substring(0, 100)}...`);
                    profile.physical = extractedPhysical;
                }
            }
        }
        
        return profile;
        
    } catch (error) {
        console.error(`Chronicle Keeper | Error analyzing ${npcName}:`, error);
        return {
            name: npcName,
            aliases: "None",
            species: "Unknown",
            gender: "Unknown",
            class: "Unknown",
            locations: "Unknown",
            physical: "No description available.",
            personality: "No personality information available.",
            relationships: "No relationships established.",
            keyInfo: "No key information available."
        };
    }
}

// Parse AI response into structured NPC profile - IMPROVED VERSION
function parseNPCProfile(aiResponse) {
    console.log("Chronicle Keeper | Parsing AI response...");
    
    const profile = {
        name: "",
        aliases: "None",
        species: "Unknown",
        gender: "Unknown",
        class: "Unknown",
        locations: "Unknown",
        physical: "No description available.",
        personality: "No personality information available.",
        relationships: "No relationships established.",
        keyInfo: "No key information available."
    };
    
    // First, extract single-line fields
    const nameMatch = aiResponse.match(/NAME:\s*(.+?)(?:\n|$)/i);
    if (nameMatch) profile.name = nameMatch[1].trim().replace(/^\[|\]$/g, '');
    
    const aliasMatch = aiResponse.match(/ALIASES:\s*(.+?)(?:\n|$)/i);
    if (aliasMatch) profile.aliases = aliasMatch[1].trim().replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
    
    const speciesMatch = aiResponse.match(/SPECIES:\s*(.+?)(?:\n|$)/i);
    if (speciesMatch) profile.species = speciesMatch[1].trim().replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
    
    const genderMatch = aiResponse.match(/GENDER:\s*(.+?)(?:\n|$)/i);
    if (genderMatch) profile.gender = genderMatch[1].trim().replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
    
    const classMatch = aiResponse.match(/CLASS:\s*(.+?)(?:\n|$)/i);
    if (classMatch) profile.class = classMatch[1].trim().replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
    
    const locationMatch = aiResponse.match(/LOCATIONS:\s*(.+?)(?:\n|$)/i);
    if (locationMatch) profile.locations = locationMatch[1].trim().replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
    
    // Now extract multi-line sections using regex
    const physicalMatch = aiResponse.match(/PHYSICAL_DESCRIPTION:\s*([\s\S]*?)(?=\n\n[A-Z_]+:|\nPERSONALITY:|$)/i);
    if (physicalMatch) {
        let physicalText = physicalMatch[1].trim();
        // Remove any bracket markers and quotes
        physicalText = physicalText.replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
        // Remove "No physical description mentioned" variants if we found other text
        if (physicalText.length > 60 && !physicalText.toLowerCase().includes('no physical')) {
            profile.physical = physicalText;
        } else if (physicalText.length > 10 && !physicalText.toLowerCase().includes('no physical description mentioned')) {
            profile.physical = physicalText;
        }
    }
    
    const personalityMatch = aiResponse.match(/PERSONALITY:\s*([\s\S]*?)(?=\n\n[A-Z_]+:|\nRELATIONSHIPS:|$)/i);
    if (personalityMatch) {
        let personalityText = personalityMatch[1].trim();
        personalityText = personalityText.replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
        if (personalityText.length > 10 && !personalityText.toLowerCase().includes('limited personality')) {
            profile.personality = personalityText;
        }
    }
    
    const relationshipsMatch = aiResponse.match(/RELATIONSHIPS:\s*([\s\S]*?)(?=\n\n[A-Z_]+:|\nKEY_INFORMATION:|$)/i);
    if (relationshipsMatch) {
        let relationshipsText = relationshipsMatch[1].trim();
        relationshipsText = relationshipsText.replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
        if (relationshipsText.length > 10 && !relationshipsText.toLowerCase().includes('no relationships') && !relationshipsText.toLowerCase().includes('no clear relationships')) {
            profile.relationships = relationshipsText;
        }
    }
    
    const keyInfoMatch = aiResponse.match(/KEY_INFORMATION:\s*([\s\S]*?)$/i);
    if (keyInfoMatch) {
        let keyInfoText = keyInfoMatch[1].trim();
        keyInfoText = keyInfoText.replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
        if (keyInfoText.length > 10 && !keyInfoText.toLowerCase().includes('no key information')) {
            profile.keyInfo = keyInfoText;
        }
    }
    
    console.log(`Chronicle Keeper | Parsed profile:`, profile);
    
    return profile;
}

// Create or update NPC journal entries
async function createNPCJournalEntry(npcName, profile, conversations) {
    const playerJournal = await getOrCreateNPCJournal(false);
    const gmJournal = await getOrCreateNPCJournal(true);
    
    const playerContent = `
<h1>${profile.name || npcName}</h1>
<p><strong>Aliases:</strong> ${profile.aliases}</p>
<p><strong>Species:</strong> ${profile.species}</p>
<p><strong>Class/Job:</strong> ${profile.class}</p>
<p><strong>Gender:</strong> ${profile.gender}</p>
<p><strong>Locations:</strong> ${profile.locations}</p>

<h2>Physical Description</h2>
<div class="physical-description">
<p>${profile.physical}</p>
</div>

<h2>Personality</h2>
<div class="personality">
<p>${profile.personality}</p>
</div>

<h2>Relationships</h2>
<div class="relationships">
<p>${profile.relationships}</p>
</div>

<h2>Key Information</h2>
<div class="key-info">
<p>${profile.keyInfo}</p>
</div>

<hr>
<p><em>Last updated: ${new Date().toLocaleString()}</em></p>
<p><em>Generated from ${conversations.length} recorded interaction${conversations.length !== 1 ? 's' : ''}</em></p>
`;
    
    const conversationHistory = conversations.map(c => 
        `<div style="margin-bottom: 10px; padding: 8px; background: rgba(0,0,0,0.05);">
<strong>${c.timestamp}</strong><br>
${c.content}
</div>`
    ).join('\n');
    
    const gmContent = `
<h1>${profile.name || npcName} (GM Notes)</h1>
<p><strong>Aliases:</strong> ${profile.aliases}</p>
<p><strong>Species:</strong> ${profile.species}</p>
<p><strong>Class/Job:</strong> ${profile.class}</p>
<p><strong>Gender:</strong> ${profile.gender}</p>
<p><strong>Locations:</strong> ${profile.locations}</p>

<h2>Physical Description</h2>
<div class="physical-description">
<p>${profile.physical}</p>
</div>

<h2>Personality</h2>
<div class="personality">
<p>${profile.personality}</p>
</div>

<h2>Relationships</h2>
<div class="relationships">
<p>${profile.relationships}</p>
</div>

<h2>Key Information</h2>
<div class="key-info">
<p>${profile.keyInfo}</p>
</div>

<h2>GM Secrets & Notes</h2>
<div class="gm-notes">
<p><em>Add your secret notes here...</em></p>
</div>

<h2>Complete Conversation History</h2>
<div class="full-history">
${conversationHistory}
</div>

<hr>
<p><em>Last updated: ${new Date().toLocaleString()}</em></p>
<p><em>Total interactions: ${conversations.length}</em></p>
`;
    
    let playerPage = playerJournal.pages.find(p => p.name === npcName || p.name === profile.name);
    let gmPage = gmJournal.pages.find(p => p.name === npcName || p.name === profile.name);
    
    if (playerPage) {
        await playerPage.update({ 'text.content': playerContent });
    } else {
        await playerJournal.createEmbeddedDocuments('JournalEntryPage', [{
            name: profile.name || npcName,
            type: 'text',
            text: { content: playerContent, format: 1 },
            ownership: { default: 2 }
        }]);
    }
    
    if (gmPage) {
        await gmPage.update({ 'text.content': gmContent });
    } else {
        await gmJournal.createEmbeddedDocuments('JournalEntryPage', [{
            name: profile.name || npcName,
            type: 'text',
            text: { content: gmContent, format: 1 },
            ownership: { default: 0 }
        }]);
    }
}

// Handle /help command - show command list
function handleHelpCommand() {
    const gmOnlyMode = game.settings.get('chronicle-keeper', 'gmOnlyMode');
    
    ChatMessage.create({
        content: '<div style="border: 2px solid #ff6400; padding: 10px; background: rgba(255,100,0,0.1);">' +
            '<h3>🎲 Chronicle Keeper Commands</h3>' +
            (gmOnlyMode ? '<p><strong>⚠️ GM ONLY MODE ENABLED</strong> - Players cannot use /ask, /recall, /history</p>' : '') +
            '<p><strong>AI Interaction:</strong></p>' +
            '<ul>' +
            '<li><code>/ask [question]</code> - Ask the AI with campaign memory (public)</li>' +
            '<li><code>/wask [question]</code> - Ask the AI (whispered to GM)</li>' +
            '<li><code>/ooc [question]</code> - Out of character meta question, no memory</li>' +
            '<li><code>/wooc [question]</code> - OOC question (whispered)</li>' +
            '</ul>' +
            '<p><strong>NPCs:</strong></p>' +
            '<ul>' +
            '<li><code>/npc [Name]: [message]</code> - Talk to NPC (public)</li>' +
            '<li><code>/wnpc [Name]: [message]</code> - Talk to NPC (whispered)</li>' +
            '<li><code>/npcjournal</code> - Generate NPC profiles from chat history (GM only)</li>' +
            '<li><code>/npc-secret [Name]: [info]</code> - Add GM-only secrets to NPC (GM only)</li>' +
            '<li><code>/npc-merge [Name1] and [Name2]</code> - Merge two NPC identities (GM only)</li>' +
            '</ul>' +
            '<p><strong>Memory & State:</strong></p>' +
            '<ul>' +
            '<li><code>/remember [info]</code> - Add to campaign memory</li>' +
            '<li><code>/recall [topic]</code> - Search campaign memory</li>' +
            '<li><code>/history [count]</code> - View recent conversation history</li>' +
            '<li><code>/state [info]</code> - Set current situation context (GM only)</li>' +
            '<li><code>/clearstate</code> - Clear current state (GM only)</li>' +
            '<li><code>/clearhistory</code> - Clear conversation history (GM only)</li>' +
            '</ul>' +
            '<p><strong>Content:</strong></p>' +
            '<ul>' +
            '<li><code>/ingest [type]</code> - Learn journals, actors, scenes (GM only)</li>' +
            '<li><code>/campaigns</code> - List all campaigns (GM only)</li>' +
            '</ul>' +
            '<p><strong>Other:</strong></p>' +
            '<ul>' +
            '<li><code>/help</code> - Show this command list</li>' +
            '</ul>' +
            '<p>Configure in <strong>Game Settings → Module Settings</strong></p>' +
            '</div>',
        whisper: [game.user.id]
    });
}

// Handle /ooc command - out of character (no memory, just system prompt)
async function handleOOCCommand(question, chatData) {
    console.log("Chronicle Keeper | Handling /ooc command");
    ui.notifications.info("Asking AI (OOC)...");
    
    const aiName = game.settings.get('chronicle-keeper', 'aiName');
    const whisperTargets = chatData?.whisper || [];
    
    await ChatMessage.create({
        content: '<div style="background: rgba(156,39,176,0.1); padding: 10px; border-left: 3px solid #9c27b0;">' +
            '<strong>OOC Question:</strong> ' + question +
            '</div>',
        whisper: whisperTargets
    });
    
    try {
        const ollamaUrl = game.settings.get('chronicle-keeper', 'ollamaUrl');
        const model = game.settings.get('chronicle-keeper', 'ollamaModel');
        const systemPrompt = game.settings.get('chronicle-keeper', 'systemPrompt');
        
        const oocPrompt = systemPrompt + "\n\nThis is an OUT OF CHARACTER meta question. Answer as a helpful assistant discussing the game.\n\nQuestion: " + question + "\n\nAnswer:";
        
        const response = await fetch(ollamaUrl + '/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: model, prompt: oocPrompt, stream: false })
        });
        
        if (!response.ok) throw new Error('HTTP ' + response.status);
        
        const data = await response.json();
        
        await ChatMessage.create({
            speaker: { alias: aiName + ' (OOC)' },
            content: '<div style="background: rgba(156,39,176,0.1); padding: 10px; border-left: 3px solid #9c27b0;">' +
                '<strong>OOC Response:</strong><br>' + data.response +
                '</div>',
            whisper: whisperTargets
        });
        
        ui.notifications.info("OOC response received!");
    } catch (error) {
        console.error("Chronicle Keeper | OOC Error:", error);
        ui.notifications.error('Failed to get OOC response: ' + error.message);
    }
}

console.log("Chronicle Keeper | Script loaded successfully");

// Export for ES6 module compatibility
export { handleAskCommand, handleNPCCommand, handleRememberCommand, handleRecallCommand, handleHistoryCommand, handleClearHistoryCommand, handleCampaignsCommand, handleIngestCommand, handleViewStateCommand, handleSetStateCommand, handleClearStateCommand, handleOOCCommand, handleNPCJournalCommand, handleHelpCommand };
