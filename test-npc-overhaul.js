// TEST SCRIPT FOR NPC JOURNAL OVERHAUL
// Copy and paste this into browser console (F12) to test the new extraction

console.log("🧪 Testing NPC Journal Overhaul...");

// Sample conversation text with physical descriptions
const testConversation = `
[2025-01-15 10:30] PLAYER: We enter the tavern and see the bartender
[2025-01-15 10:31] GM: You see Mary, a plump halfling woman with curly red hair pulled back in a messy bun. She's wearing a stained apron and wipes down the bar with practiced ease.
[2025-01-15 10:32] PLAYER to Mary: What ales do you have today?
[2025-01-15 10:33] Mary: *in a cheerful voice* We've got our house special - Dragonfire Red, and a nice imported elven wine if you're feeling fancy!
[2025-01-15 10:35] GM: Mary has piercing green eyes that seem to notice everything in the tavern. Despite her small stature, she carries herself with confidence.
`;

// Test the parsing
async function testNPCExtraction() {
    try {
        console.log("📋 Test Conversation:");
        console.log(testConversation);
        console.log("\n🤖 Calling AI to analyze...");
        
        const ollamaUrl = game.settings.get('chronicle-keeper', 'ollamaUrl');
        const model = game.settings.get('chronicle-keeper', 'ollamaModel');
        
        const analysisPrompt = `You are analyzing conversations about "Mary" from a D&D campaign.

YOUR #1 PRIORITY: Find and extract PHYSICAL DESCRIPTIONS.

Physical descriptions can appear in many forms:
✅ "I notice their crimson cloak" → Extract: "Wears a crimson cloak"
✅ "The tall elf with silver hair" → Extract: "Tall elf with silver hair"
✅ "She has piercing green eyes" → Extract: "Piercing green eyes"

Here are the conversations:

${testConversation}

Extract these fields in this EXACT format:

NAME: Mary
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
If you find ANY physical details AT ALL, write them here.]

PERSONALITY:
[Describe personality traits shown in dialogue/behavior, or write: "Limited personality information"]

RELATIONSHIPS:
[Describe relationships with the party/other NPCs, or write: "No relationships established"]

KEY_INFORMATION:
[Important facts about THIS NPC, or write: "No key information"]`;

        const response = await fetch(ollamaUrl + '/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: analysisPrompt,
                stream: false,
                options: {
                    temperature: 0.7
                }
            })
        });
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        
        const data = await response.json();
        console.log("\n✅ AI Response:");
        console.log(data.response);
        
        // Parse it
        console.log("\n🔍 Parsing...");
        const parsed = parseNPCProfile(data.response);
        console.log("\n📊 Parsed Result:");
        console.log(parsed);
        
        // Check physical description
        console.log("\n🎨 Physical Description Check:");
        if (parsed.physical.length > 50 && !parsed.physical.includes("No physical")) {
            console.log("✅ SUCCESS! Found detailed physical description:");
            console.log("   " + parsed.physical);
        } else {
            console.log("⚠️ WARNING: Physical description is short or generic:");
            console.log("   " + parsed.physical);
            console.log("   Triggering second pass...");
            
            // Second pass test
            const focusedPrompt = `Look at these conversations about "Mary" and find ANY mentions of physical appearance:

${testConversation}

TASK: Extract EVERY detail about how Mary looks. Look for:
- Clothing, hair, eyes, build, age, facial features, voice, equipment

Write a 2-4 sentence physical description. If you find ANYTHING, include it.

PHYSICAL DESCRIPTION:`;

            const response2 = await fetch(ollamaUrl + '/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: focusedPrompt,
                    stream: false,
                    options: { temperature: 0.8 }
                })
            });
            
            if (response2.ok) {
                const data2 = await response2.json();
                console.log("\n✅ Second Pass Result:");
                console.log("   " + data2.response.trim());
            }
        }
        
        console.log("\n✅ Test Complete!");
        
    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

// Run the test
testNPCExtraction();

console.log("\n💡 TIP: Look for:");
console.log("   - 'plump halfling woman'");
console.log("   - 'curly red hair'");
console.log("   - 'stained apron'");
console.log("   - 'piercing green eyes'");
console.log("   - 'small stature'");
console.log("   These should all appear in PHYSICAL_DESCRIPTION!");
