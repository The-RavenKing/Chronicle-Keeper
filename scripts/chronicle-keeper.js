function createPlayerNPCTemplate(npcName) {
    return `
<h1>${npcName}</h1>
<p><strong>Aliases:</strong> <span class="aliases">None known</span></p>
<p><strong>Species:</strong> <span class="species">Unknown</span></p>
<p><strong>Class:</strong> <span class="class">Unknown</span></p>
<p><strong>Gender:</strong> <span class="gender">Unknown</span></p>

<h2>Physical Description</h2>
<div class="physical-description">
    No description yet
</div>

<h2>Personality Traits</h2>
<div class="personality-traits">
    No traits yet
</div>

<h2>Background and History</h2>
<div class="background-history">
    No background yet
</div>
`;

function updateNPCFromConversation(npcName, playerMessage, npcResponse) {
    if (!game.settings.get('chronicle-keeper', 'autoNPCJournals')) {
        return; // Feature disabled
    }
    
    console.log(`Chronicle Keeper | Updating NPC journal for: ${npcName}`);
    
    try {
        // Get or create journals
        const playerJournal = await getOrCreateNPCJournal(false);
        
        // Find existing page
        let page = playerJournal.pages.find(p => p.name === npcName);
        
        if (!page) {
            // Create new page with template
            const template = createPlayerNPCTemplate(npcName);
            page = await journal.createEmbeddedDocuments('JournalEntryPage', [{
                name: npcName,
                type: 'text',
                text: { content: template }
            }]);
        }
        
        let content = page.text.content;
        const timestamp = new Date().toLocaleDateString();
        
        // Update physical description if new info
        if (analysis.physical !== "None") {
            console.log("Chronicle Keeper | Adding physical description:", analysis.physical);
            content = updateSection(content, 'physical-description', analysis.physical);
        }
        
        // Update personality traits if new info
        if (analysis.personality !== "None") {
            console.log("Chronicle Keeper | Adding personality traits:", analysis.personality);
            content = updateSection(content, 'personality-traits', analysis.personality);
        }
        
        // Update background and history if new info
        if (analysis.summary !== "") {
            console.log("Chronicle Keeper | Adding background and history:", analysis.summary);
            content = updateSection(content, 'background-history', analysis.summary);
        }
        
        // Save updated page
        await page.update({ text: { content } });
    } catch (error) {
        console.error(`Error updating NPC journal for ${npcName}:`, error);
    }
}
