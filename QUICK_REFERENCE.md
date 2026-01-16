# Quick Reference: Overhauled /npcjournal Function

## What's Different

✅ **TWO AI passes** instead of one
✅ **Physical descriptions are #1 priority**
✅ **Better extraction** of subtle details
✅ **Smarter parsing** with regex instead of line-by-line

## How It Works Now

```
You: /npcjournal
```

**For each NPC found:**

1. **FIRST PASS** - General analysis
   - Extracts: name, species, gender, class, locations
   - Extracts: physical description, personality, relationships
   - AI temperature: 0.7 (slightly creative)

2. **SECOND PASS** - Physical description focus (if needed)
   - Triggers if first pass found < 50 characters
   - ONLY looks for physical details
   - AI temperature: 0.8 (more creative)
   - Explicitly searches for: clothing, hair, eyes, build, age, features

## What Gets Extracted as Physical

✅ "I like your red cloak" → Wears a red cloak
✅ "The tall elf" → Tall elf
✅ "She has green eyes" → Green eyes  
✅ "Old man" → Appears old/elderly
✅ "His scar" → Has a scar
✅ "Deep voice" → Deep voice
✅ "Wearing chain mail" → Wears chain mail

❌ "He's from Waterdeep" → NOT physical (that's location/background)
❌ "He fought in wars" → NOT physical (that's history)

## Example Output

**Before (Old System):**
```
Physical Description: Unknown
```

**After (New System):**
```
Physical Description: Middle-aged human male with a weathered face and 
graying beard. Wears simple brown robes and carries a gnarled oak staff. 
Has piercing blue eyes and speaks with a deep, gravelly voice.
```

## Console Logging

Check F12 console for:
```
Chronicle Keeper | OVERHAULED: Analyzing [NPC Name]...
Chronicle Keeper | Raw AI response for [NPC Name]: ...
Chronicle Keeper | Parsed profile: { physical: "...", ... }
Chronicle Keeper | Physical description too short for [NPC], attempting focused extraction...
Chronicle Keeper | Found better physical description: ...
```

## Tips for Players/GMs

**To get better NPC descriptions, mention details in chat:**

❌ BAD: "We meet the shopkeeper"
✅ GOOD: "We meet the shopkeeper, a plump halfling woman with curly red hair"

❌ BAD: "He looks dangerous"  
✅ GOOD: "He looks dangerous - tall, scarred, wearing black leather armor"

❌ BAD: "She's nice"
✅ GOOD: "She's friendly, young, with an apron covered in flour"

## Settings

No new settings needed! The overhaul uses your existing:
- Ollama URL
- Model name
- Auto-Create NPC Journals (should be ON)

## Testing It

1. Have a conversation with an NPC using `/npc Name: message`
2. Include physical description: "The tall guard with the scar nods..."
3. Run `/npcjournal`
4. Check both NPC journals
5. Look in console (F12) to see what was extracted

## Troubleshooting

**Problem**: Still getting "No physical description"
**Solution**: 
1. Check console logs to see raw AI response
2. Make sure physical details are actually in chat
3. Try more explicit descriptions ("wearing X", "has Y")
4. Verify Ollama is running and responding

**Problem**: Extracting wrong information
**Solution**:
1. The AI avoids past-tense stories ("he fought in X")
2. Only extracts current appearance details
3. If needed, edit the journal manually after generation

## Files Changed

- `chronicle-keeper.js` - Main file with overhauled functions
- `chronicle-keeper-npc-overhaul.js` - Standalone backup version
- `NPC_JOURNAL_OVERHAUL.md` - Full documentation

---

**Quick Start**: Just use `/npcjournal` like before - it's now smarter!
