# Chronicle Keeper: NPC Journal Overhaul

## What Changed

The `/npcjournal` command has been completely overhauled to **prioritize physical descriptions** and extract them more reliably from chat history.

## Key Improvements

### 1. **Two-Pass AI Analysis**
The system now makes TWO AI calls per NPC:
- **First Pass**: General analysis of all NPC information
- **Second Pass**: Focused extraction ONLY on physical descriptions (if first pass fails)

### 2. **Improved Prompts**
The AI prompts now:
- Put physical descriptions as the **#1 priority**
- Provide extensive examples of what counts as a physical description
- Use more explicit instructions with visual formatting (✅/❌ markers)
- Ask for 2-5 sentence descriptions instead of single words
- Explicitly list what to look for (clothing, hair, eyes, build, age, etc.)

### 3. **Better Parsing**
The parser now:
- Uses regex matching instead of line-by-line parsing (more reliable)
- Removes unwanted quotes and brackets automatically
- Handles multi-line descriptions properly
- Validates extracted text isn't just generic filler

### 4. **Examples of What Gets Extracted**

**Before (Old System):**
- Player: "I like your fancy hat"
- AI might extract: "Unknown" or "No description"

**After (New System):**
- Player: "I like your fancy hat"
- AI extracts: "Wears a fancy hat"
- If more details: "Wears a fancy hat and carries an ornate walking cane"

**More Examples:**
- "The tall elf with silver hair" → "Tall elf with silver hair"
- "She has piercing green eyes" → "Piercing green eyes"
- "The scarred veteran" → "Has scars (veteran)"
- "His deep voice" → "Deep voice"
- "Old man at the tavern" → "Appears old/elderly"

### 5. **Focused Physical Extraction**

If the first pass doesn't find enough details, the second pass specifically looks for:
- Clothing descriptions ("wearing a", "dressed in", "cloak", "armor")
- Body mentions ("tall", "short", "muscular", "thin")
- Hair ("black hair", "bald", "ponytail")
- Eyes ("blue eyes", "piercing gaze")
- Age ("young", "old", "elderly")
- Facial features ("beard", "scar", "tattoo")
- Voice ("deep voice", "raspy")
- Race indicators ("elf ears", "dwarven")
- Equipment ("carries a sword", "has a staff")

## How to Use

The command works exactly the same:
```
/npcjournal
```

The AI will now be much more aggressive about finding and extracting physical descriptions from your chat history.

## What Gets Created

Two journal entries per NPC:
1. **"NPCs" journal** - Player-visible information including physical descriptions
2. **"NPCs (GM Secrets)" journal** - Complete information with full chat history

## Technical Details

### Files Modified:
- `chronicle-keeper.js` - Main module file
  - Updated `analyzeNPCFromHistory()` function
  - Improved `parseNPCProfile()` function

### New Features:
- Two-pass AI analysis
- Focused physical description extraction
- Better regex-based parsing
- Enhanced logging for debugging

## Tips for Best Results

1. **Describe NPCs in chat**: Have players or GMs describe NPCs as they meet them
2. **Be specific**: "She's wearing a red cloak" is better than "nice outfit"
3. **Use the /npc command**: Direct NPC conversations get highest priority
4. **Mention features naturally**: "I notice your silver ring" works great

## Debugging

If descriptions still aren't appearing:
1. Check the browser console (F12) for logs
2. Look for: `Chronicle Keeper | Raw AI response for [NPC Name]`
3. Look for: `Chronicle Keeper | Parsed profile:`
4. This will show you exactly what the AI found and what got parsed

## Known Limitations

- The AI can only extract what's actually in the chat history
- Very brief mentions might still be missed
- Generic descriptions ("looks nice") won't provide much detail
- Past tense stories ("I fought in Neverwinter") are deliberately excluded

## Future Improvements

Potential enhancements:
- Allow manual NPC description entry
- Integration with Actor/NPC sheets in Foundry
- Image analysis if images are uploaded
- More sophisticated context understanding

---

**Version**: 2.0 (Overhauled)
**Date**: January 2026
**Author**: AI Assistant
