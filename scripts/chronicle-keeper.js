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
    
    // Show welcome message
    if (game.user.isGM) {
        const gmOnlyMode = game.settings.get('chronicle-keeper', 'gmOnlyMode');
        
        ui.notifications.info("Chronicle Keeper loaded! Type /ask to test.");
        
        ChatMessage.create({
            content: '<div style="border: 2px solid #ff6400; padding: 10px; background: rgba(255,100,0,0.1);">' +
                '<h3>🎲 Chronicle Keeper Active!</h3>' +
                (gmOnlyMode ? '<p><strong>⚠️ GM ONLY MODE ENABLED</strong> - Players cannot use /ask</p>' : '') +
                '<p><strong>Commands:</strong></p>' +
                '<ul>' +
                '<li><code>/ask [question]</code> - Ask the AI (public)</li>' +
                '<li><code>/wask [question]</code> - Ask the AI (whispered to GM)</li>' +
                '<li><code>/npc [Name]: [message]</code> - Talk to NPC (public)</li>' +
                '<li><code>/wnpc [Name]: [message]</code> - Talk to NPC (whispered)</li>' +
                '<li><code>/ingest</code> - Learn all journals, characters, scenes! ⭐</li>' +
                '<li><code>/remember [info]</code> - Manually add info</li>' +
                '<li><code>/recall [topic]</code> - Search memory</li>' +
                '<li><code>/history</code> - View recent conversations</li>' +
                '</ul>' +
                '<p><strong>✨ Use /w commands for private conversations!</strong></p>' +
                '<p>Configure in <strong>Game Settings → Module Settings</strong></p>' +
                (gmOnlyMode ? '' : '<p><em>Enable "GM Only Mode" in settings to prevent player spoilers</em></p>') +
                '</div>',
            whisper: [game.user.id]
        });
    }
    
    console.log("Chronicle Keeper | Ready - Commands available: /ask, /npc");
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
                    context = '\n\nRELEVANT PAST CONTEXT:\n' + relevantLines.slice(-10).join('\n') + '\n\n';
                } else if (lines.length > 0) {
                    context = '\n\nRECENT CONTEXT:\n' + lines.slice(-5).join('\n') + '\n\n';
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

console.log("Chronicle Keeper | Script loaded successfully");

// Export for ES6 module compatibility
export { handleAskCommand, handleNPCCommand, handleRememberCommand, handleRecallCommand, handleHistoryCommand, handleClearHistoryCommand, handleCampaignsCommand, handleIngestCommand };
