// ===== OVERHAULED NPC JOURNAL FUNCTIONS =====
// This is a complete replacement for the analyzeNPCFromHistory function
// It focuses heavily on extracting physical descriptions

// Use AI to analyze NPC from all their conversation history - OVERHAULED VERSION
async function analyzeNPCFromHistoryOverhauled(npcName, conversationText) {
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
        
        const profile = parseNPCProfileOverhauled(data.response);
        
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

// Enhanced parser that handles multi-line sections better
function parseNPCProfileOverhauled(aiResponse) {
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
    if (aliasMatch) profile.aliases = aliasMatch[1].trim().replace(/^\[|\]$/g, '');
    
    const speciesMatch = aiResponse.match(/SPECIES:\s*(.+?)(?:\n|$)/i);
    if (speciesMatch) profile.species = speciesMatch[1].trim().replace(/^\[|\]$/g, '');
    
    const genderMatch = aiResponse.match(/GENDER:\s*(.+?)(?:\n|$)/i);
    if (genderMatch) profile.gender = genderMatch[1].trim().replace(/^\[|\]$/g, '');
    
    const classMatch = aiResponse.match(/CLASS:\s*(.+?)(?:\n|$)/i);
    if (classMatch) profile.class = classMatch[1].trim().replace(/^\[|\]$/g, '');
    
    const locationMatch = aiResponse.match(/LOCATIONS:\s*(.+?)(?:\n|$)/i);
    if (locationMatch) profile.locations = locationMatch[1].trim().replace(/^\[|\]$/g, '');
    
    // Now extract multi-line sections
    const physicalMatch = aiResponse.match(/PHYSICAL_DESCRIPTION:\s*([\s\S]*?)(?=\n\n[A-Z_]+:|$)/i);
    if (physicalMatch) {
        let physicalText = physicalMatch[1].trim();
        // Remove any bracket markers
        physicalText = physicalText.replace(/^\[|\]$/g, '');
        // Remove "No physical description mentioned" variants if we found other text
        if (physicalText.length > 60 && !physicalText.toLowerCase().includes('no physical')) {
            profile.physical = physicalText;
        } else if (physicalText.length > 10) {
            profile.physical = physicalText;
        }
    }
    
    const personalityMatch = aiResponse.match(/PERSONALITY:\s*([\s\S]*?)(?=\n\n[A-Z_]+:|$)/i);
    if (personalityMatch) {
        let personalityText = personalityMatch[1].trim();
        personalityText = personalityText.replace(/^\[|\]$/g, '');
        if (personalityText.length > 10) {
            profile.personality = personalityText;
        }
    }
    
    const relationshipsMatch = aiResponse.match(/RELATIONSHIPS:\s*([\s\S]*?)(?=\n\n[A-Z_]+:|$)/i);
    if (relationshipsMatch) {
        let relationshipsText = relationshipsMatch[1].trim();
        relationshipsText = relationshipsText.replace(/^\[|\]$/g, '');
        if (relationshipsText.length > 10) {
            profile.relationships = relationshipsText;
        }
    }
    
    const keyInfoMatch = aiResponse.match(/KEY_INFORMATION:\s*([\s\S]*?)$/i);
    if (keyInfoMatch) {
        let keyInfoText = keyInfoMatch[1].trim();
        keyInfoText = keyInfoText.replace(/^\[|\]$/g, '');
        if (keyInfoText.length > 10) {
            profile.keyInfo = keyInfoText;
        }
    }
    
    console.log(`Chronicle Keeper | Parsed profile:`, profile);
    
    return profile;
}

// Export the overhauled function
window.analyzeNPCFromHistoryOverhauled = analyzeNPCFromHistoryOverhauled;
window.parseNPCProfileOverhauled = parseNPCProfileOverhauled;

console.log("Chronicle Keeper | NPC Overhaul loaded - Use analyzeNPCFromHistoryOverhauled()");
