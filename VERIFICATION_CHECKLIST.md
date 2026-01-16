# ✅ Verification Checklist: NPC Journal Overhaul

Use this checklist to verify the overhaul is working correctly.

---

## 📋 Pre-Flight Checks

### 1. Files Are In Place
- [ ] `chronicle-keeper.js` - Modified main file
- [ ] `chronicle-keeper-npc-overhaul.js` - Backup standalone version
- [ ] `NPC_JOURNAL_OVERHAUL.md` - Full documentation
- [ ] `QUICK_REFERENCE.md` - Quick guide
- [ ] `BEFORE_AFTER.md` - Visual comparison
- [ ] `TECHNICAL_CHANGES.md` - Code-level details
- [ ] `OVERHAUL_SUMMARY.md` - Complete summary
- [ ] `test-npc-overhaul.js` - Test script
- [ ] This checklist

### 2. Foundry Setup
- [ ] Chronicle Keeper module is enabled
- [ ] Ollama is running (`ollama serve`)
- [ ] Ollama model is available (check with `ollama list`)
- [ ] Module settings configured:
  - [ ] Ollama URL set (default: http://localhost:11434)
  - [ ] Model name set (e.g., llama2:7b)
  - [ ] Auto-Create NPC Journals: ON
  - [ ] NPC Journal Name: "NPCs"
  - [ ] GM NPC Journal Name: "NPCs (GM Secrets)"

---

## 🧪 Functional Tests

### Test 1: Basic Physical Description

**Steps:**
1. In Foundry chat, send:
   ```
   /npc TestNPC1: Hello there!
   ```
2. Then send a description:
   ```
   TestNPC1 is a tall elf with silver hair and blue robes.
   ```
3. Run command:
   ```
   /npcjournal
   ```
4. Open F12 console and look for:
   ```
   Chronicle Keeper | OVERHAULED: Analyzing TestNPC1...
   ```

**Expected Results:**
- [ ] Console shows "OVERHAULED: Analyzing TestNPC1"
- [ ] Console shows "Raw AI response"
- [ ] Console shows "Parsed profile"
- [ ] "NPCs" journal created with "TestNPC1" page
- [ ] Physical Description contains: "tall", "elf", "silver hair", "blue robes"

---

### Test 2: Indirect Physical Description

**Steps:**
1. Send chat:
   ```
   /npc TestNPC2: What can I help you with?
   ```
2. Send indirect description:
   ```
   I notice TestNPC2's fancy hat and ornate staff.
   ```
3. Run:
   ```
   /npcjournal
   ```

**Expected Results:**
- [ ] Console shows second-pass trigger (if needed)
- [ ] Physical Description mentions "hat" and/or "staff"
- [ ] Description converted from first person ("I notice") to third person ("Wears")

---

### Test 3: Multiple Scattered Mentions

**Steps:**
1. Send multiple messages:
   ```
   /npc TestNPC3: Good day!
   ```
   ```
   TestNPC3 is wearing leather armor.
   ```
   ```
   TestNPC3 has a scar on their face.
   ```
   ```
   TestNPC3 carries a longbow.
   ```
2. Run:
   ```
   /npcjournal
   ```

**Expected Results:**
- [ ] Physical Description combines all details
- [ ] Mentions: armor, scar, bow
- [ ] Reads as cohesive description, not list

---

### Test 4: Subtle Age/Build Mentions

**Steps:**
1. Send chat:
   ```
   /npc TestNPC4: *in a raspy voice* Welcome!
   ```
   ```
   The old man shuffles behind the counter.
   ```
2. Run:
   ```
   /npcjournal
   ```

**Expected Results:**
- [ ] Physical Description mentions "old" or "elderly"
- [ ] May mention "raspy voice"
- [ ] May infer physical effects of age (shuffling)

---

### Test 5: Equipment Only

**Steps:**
1. Send chat:
   ```
   /npc TestNPC5: Stand and deliver!
   ```
   ```
   TestNPC5 is wielding a greatsword and shield.
   ```
2. Run:
   ```
   /npcjournal
   ```

**Expected Results:**
- [ ] Physical Description mentions weapons
- [ ] May infer warrior/fighter nature

---

### Test 6: Second Pass Trigger

**Steps:**
1. Send minimal chat:
   ```
   /npc TestNPC6: Hello.
   ```
   (No physical description in chat)
2. Run:
   ```
   /npcjournal
   ```
3. Watch console

**Expected Results:**
- [ ] Console shows: "Physical description too short for TestNPC6"
- [ ] Console shows: "attempting focused extraction"
- [ ] Second AI call is made
- [ ] Either finds something subtle OR says "No physical details found"

---

## 🔍 Console Inspection

### Required Log Messages

When running `/npcjournal`, you should see in console (F12):

**For Each NPC:**
```
Chronicle Keeper | OVERHAULED: Analyzing [NPC Name]...
Chronicle Keeper | Raw AI response for [NPC Name]: [response text]
Chronicle Keeper | Parsing AI response...
Chronicle Keeper | Parsed profile: { name: "...", physical: "...", ... }
```

**If Second Pass Needed:**
```
Chronicle Keeper | Physical description too short for [NPC Name], attempting focused extraction...
Chronicle Keeper | Found better physical description: [text]...
```

### Check These Logs:
- [ ] "OVERHAULED: Analyzing" appears for each NPC
- [ ] "Raw AI response" shows actual AI-generated text
- [ ] "Parsed profile" shows extracted fields
- [ ] "physical" field is not "No description available" (when details present)
- [ ] No JavaScript errors
- [ ] No "undefined" values in parsed profile

---

## 📊 Journal Entry Verification

### Player Journal ("NPCs")

Open the "NPCs" journal and check a sample entry:

**Must Have:**
- [ ] NPC name as page title
- [ ] Aliases section (even if "None")
- [ ] Species field
- [ ] Gender field
- [ ] Class/Job field
- [ ] Locations field
- [ ] **Physical Description section** ← THIS IS KEY
- [ ] Personality section
- [ ] Relationships section
- [ ] Key Information section
- [ ] Timestamp at bottom
- [ ] Interaction count

**Physical Description Check:**
- [ ] Not "No description available"
- [ ] Not "Unknown"
- [ ] Contains actual descriptive text
- [ ] 2+ sentences long (when details present)
- [ ] Reads naturally

### GM Journal ("NPCs (GM Secrets)")

Open the "NPCs (GM Secrets)" journal:

**Must Have:**
- [ ] All fields from player journal
- [ ] GM Secrets & Notes section
- [ ] Complete Conversation History section
- [ ] Full chat timestamps
- [ ] All interactions logged

---

## 🎯 Quality Checks

### Physical Descriptions Should:
- [ ] ✅ Include clothing when mentioned
- [ ] ✅ Include hair color/style when mentioned
- [ ] ✅ Include eye color when mentioned
- [ ] ✅ Include build/size when mentioned
- [ ] ✅ Include age indicators when mentioned
- [ ] ✅ Include equipment when mentioned
- [ ] ✅ Include distinctive features when mentioned
- [ ] ✅ Read as natural prose (not bullet points)
- [ ] ✅ Use third person ("Wears" not "I wear")

### Physical Descriptions Should NOT:
- [ ] ❌ Include locations ("works at the tavern")
- [ ] ❌ Include past events ("fought in wars")
- [ ] ❌ Include relationships ("friend of the king")
- [ ] ❌ Include personality ("seems friendly")
- [ ] ❌ Be in first person ("I notice")
- [ ] ❌ Be just "Unknown" or "No description"

---

## 🐛 Troubleshooting

### If Physical Descriptions Are Still Empty:

1. **Check Console Logs:**
   - [ ] Look for "Raw AI response" - does it contain physical info?
   - [ ] Look for "Parsed profile" - is physical field populated?
   - [ ] Any JavaScript errors?

2. **Check Chat History:**
   - [ ] Are physical details actually in chat?
   - [ ] Are NPCs mentioned by name?
   - [ ] Are details in recent messages (last ~200)?

3. **Check AI Connection:**
   - [ ] Is Ollama running? (Test: `curl http://localhost:11434/api/generate`)
   - [ ] Is model loaded? (`ollama list`)
   - [ ] Does `/ask` command work?

4. **Check Settings:**
   - [ ] Auto-Create NPC Journals is ON
   - [ ] Ollama URL is correct
   - [ ] Model name matches exactly

### If Second Pass Always Triggers:

This might be normal if:
- [ ] Chat history has minimal physical descriptions
- [ ] AI first pass is too conservative
- [ ] Temperature 0.7 not creative enough

Try:
- [ ] Add more explicit physical descriptions in chat
- [ ] Check if second pass actually finds more details

---

## 📈 Success Metrics

**The overhaul is successful if:**

- [ ] 80%+ of NPCs have physical descriptions (when details present)
- [ ] Descriptions are 2+ sentences
- [ ] Descriptions include details from chat
- [ ] "No description available" rare (<20%)
- [ ] Console logs show expected flow
- [ ] No errors in console
- [ ] Journals generate correctly

**Current baseline (old system): ~10-20% success**
**Target (new system): ~80-90% success**

---

## 🎉 Final Verification

### Complete This Checklist:

**Setup:**
- [ ] All files present
- [ ] Foundry configured
- [ ] Ollama running

**Tests:**
- [ ] Test 1: Basic description ✓
- [ ] Test 2: Indirect description ✓
- [ ] Test 3: Multiple mentions ✓
- [ ] Test 4: Age/build ✓
- [ ] Test 5: Equipment ✓
- [ ] Test 6: Second pass ✓

**Quality:**
- [ ] Physical descriptions present
- [ ] Descriptions detailed (2+ sentences)
- [ ] Descriptions accurate to chat
- [ ] Console logs correct
- [ ] No errors
- [ ] Journals properly formatted

**Success Rate:**
- [ ] Tested on 5+ NPCs
- [ ] 80%+ have descriptions
- [ ] Descriptions match chat history
- [ ] Better than old system

---

## 📝 Report Template

Fill this out after testing:

```
NPC JOURNAL OVERHAUL - TEST REPORT

Date: __________
Tester: __________

TESTS PERFORMED:
✓ Test 1: Basic description
✓ Test 2: Indirect description
✓ Test 3: Multiple mentions
✓ Test 4: Age/build
✓ Test 5: Equipment
✓ Test 6: Second pass

RESULTS:
Total NPCs tested: ____
NPCs with descriptions: ____
Success rate: ____%

PHYSICAL DESCRIPTION QUALITY:
□ Excellent (4-5 sentences, very detailed)
□ Good (2-3 sentences, adequate detail)
□ Fair (1-2 sentences, minimal detail)
□ Poor (generic or missing)

CONSOLE LOGS:
□ All expected logs present
□ No errors
□ Second pass triggered when needed

ISSUES FOUND:
(List any problems)

OVERALL ASSESSMENT:
□ Overhaul successful - physical descriptions working great
□ Overhaul partially successful - some improvements needed
□ Overhaul unsuccessful - still missing descriptions

NOTES:
(Any additional observations)
```

---

**When all checks pass, the overhaul is complete and working! 🎯**
