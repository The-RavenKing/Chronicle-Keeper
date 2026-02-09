# Chronicle Keeper - AI Dungeon Master

An AI-powered Dungeon Master module for Foundry VTT using Ollama for local LLM hosting. Features robust memory management for long-term campaign continuity.

![Foundry VTT](https://img.shields.io/badge/Foundry-v11%2Fv12-green)
![D&D 5e](https://img.shields.io/badge/System-D%26D%205e-red)

## Features

### 🎭 AI Dungeon Master
Chronicle Keeper acts as a co-DM, handling descriptive duties so you can focus on rules and pacing.

*   **Auto-Narration**: Automatically describes the outcome of skill checks and saving throws based on the roll result.
    *   *Example:* Player rolls a Nat 20 Acrobatics -> "You effortlessly vault over the goblin, landing with a flourish."
    *   *Example:* Player fails a Stealth check -> "Your scabbard scrapes loudly against the stone wall, echoing through the chamber."
    
*   **Combat Narrator**: Turns dry "hit for 8 damage" logs into visceral combat descriptions.
    *   *Example:* "The sword bites deep into the orc's shoulder, forcing a pained grunt as dark blood sprays across the floor."
    
*   **NPC Roleplay**: The AI can "possess" any NPC.
    *   Use `/npc [name] [instruction]` to have them speak.
    *   The AI knows their personality, stats, and current context from your notes.

*   **Scene Awareness**: The AI reads the current Scene's journal notes to understand the environment (lighting, smells, sounds).

### 🧠 Multi-layered Memory
(The module remembers details so you don't have to look them up)
- **Short-term**: Remembers the last ~50 messages of conversation.
- **Long-term**: Stores important story beats (quests, major decisions).
- **Entities**: Tracks NPCs, locations, and factions.
- **Semantic Search**: "What did the innkeeper say about the dragon?" retrieves the exact memory.

## Requirements

- Foundry VTT v11 or v12
- D&D 5e system (v3.0+)
- [Ollama](https://ollama.ai) running locally

## Installation

### 1. Install Ollama

Download and install from [ollama.ai](https://ollama.ai).

### 2. Pull a Model

```bash
# Recommended for most systems
ollama pull llama3:8b

# For better quality (requires more RAM)
ollama pull llama3:70b

# For embeddings (semantic search)
ollama pull nomic-embed-text
```

### 3. Install the Module

**Option A: Manifest URL**
1. In Foundry, go to Add-on Modules
2. Click "Install Module"
3. Paste manifest URL: `https://github.com/chronicle-keeper/chronicle-keeper-v2/releases/latest/download/module.json`

**Option B: Manual Install**
1. Download the latest release
2. Extract to `Data/modules/chronicle-keeper`
3. Restart Foundry

### 4. Configure

1. Enable the module in your world
2. Go to Module Settings → Chronicle Keeper
3. Set your Ollama URL (default: `http://localhost:11434`)
4. Select your preferred model

## Usage

### Slash Commands

### Command Reference

#### 🎭 Narrative Commands

**`/narrate [prompt]`**
Describes the current scene or action.
- **Example:** `/narrate The party enters the ancient, spider-infested crypt.`
- **Example:** `/narrate What do we see when we look through the keyhole?`
- *Tip:* If you leave the prompt empty (`/narrate`), it will describe the current scene based on the active Scene notes.

**`/npc [name] [context]`**
Generates dialogue or action for a specific NPC. *(DM-style: you instruct the NPC)*
- **Example:** `/npc Strahd Welcome them to my castle, but warn them not to stray from the path.`
- **Example:** `/npc Innkeeper Ask if they want ale or a room.`
- *Note:* Creates a chat bubble as that NPC.

**`/talk [npc] [your dialogue]`**
**NEW!** Have a conversation with an NPC. Your character speaks, and the NPC responds.
- **Example:** `/talk Mayor We'll clear the gnolls...for 50 gold.`
- **Example:** `/talk Bartender Have you heard any rumors about the old tower?`
- *Tip:* The AI remembers the conversation, so you can have multi-turn dialogue!

**`/ai [prompt]`**
Direct chat with the AI DM (for questions, rules, or brainstorming).
- **Example:** `/ai What are some good loot items for a level 3 party?`
- **Example:** `/ai Generate a riddle about time.`

#### 🧠 Memory Commands

**`/memory search [query]`**
Finds relevant lore or past events.
- **Example:** `/memory search Who is the leader of the Thieves Guild?`

**`/memory save [text]`**
Manually adds a fact to long-term memory.
- **Example:** `/memory save The party made an enemy of the mayor today.`
- **Example:** `/memory save The magic sword requires dragon blood to activate.`

**`/memory stats`**
Shows how many memories and entities are currently stored.

**`/memory clear`**
Wipes short-term conversation history (useful to start a "fresh" scene).

#### ⚙️ Utility Commands

**`/dm toggle`** - Turn the AI DM on or off.
**`/dm status`** - Check connection status and current model.
**`/import`** - Open the Campaign Import Wizard.
**`/ck help`** - Show this cheat sheet in chat.

### Memory System

### Memory System

Chronicle Keeper maintains several types of memory:

- **Short-term**: Last 20-50 messages for immediate context
- **Long-term**: Important story beats, quest progress, relationships
- **Entities**: NPCs, locations, items, and factions
- **Vector embeddings**: Semantic search for relevant context

Access the Memory Browser from Module Settings to view and manage memories.

### 💾 Data Persistence & Updates
All campaign data (memories, NPCs, lore) is stored in your **World data**, not in the module folder.
- You can safely update or reinstall the module without losing your campaign data.
- Data is stored in `world.json` (or your world's database files).
- To back up your data, export your World or use the `/memory export` command.

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Ollama URL | Server address | `http://localhost:11434` |
| Model | LLM to use | `llama3:8b` |
| Temperature | Creativity (0-1) | 0.7 |
| Max Tokens | Response length | 1024 |
| Short-term Size | Context messages | 30 |
| Auto-Narration | Narrate dice rolls | On |
| Combat Narration | Combat descriptions | On |

## Customizing Your AI DM

You can completely change the personality and tone of the AI by editing the **System Prompt** in the module settings. This allows you to simulate different DM styles or genres.

### How to Configure
1. Go to **Settings** -> **Configure Settings** -> **Chronicle Keeper**.
2. Scroll down to **System Prompt**.
3. Edit the text to define who the AI is.

### Persona Examples

**The Classic High Fantasy DM**
> You are a master storyteller for a D&D 5e game. Your tone is epic and grandiose. Focus on the heroism of the characters and the ancient history of the world. Describe magic with wonder and awe.

**The Gritty Dark Fantasy DM**
> You are a DM for a grimdark campaign. The world is dangerous, dirty, and unforgiving. Describe scenes with visceral, sensory details—the smell of rot, the chill of the grave, the rust on a blade. Combat is brutal and consequences are severe.

**The Sci-Fi / Cyberpunk DM**
> You are running a futuristic sci-fi game. Use technical jargon (OS, cybernetics, neon, chrome). The atmosphere is oppressive and high-tech. NPCs should speak with slang suitable for the setting.

**The Comedic DM**
> You are a lighthearted DM who loves humor. Highlight the absurdity of situations. NPCs should be quirky and memorable. Keep the mood fun and don't take things too seriously.

**Classic Fantasy**
```
You are a skilled Dungeon Master running a high fantasy campaign. Create vivid descriptions, memorable NPCs, and exciting encounters.
```

**Dark/Gritty**
```
You are a DM running a dark fantasy campaign where choices have consequences. The world is dangerous and not everyone survives.
```

**Comedy/Lighthearted**
```
You are a fun-loving DM who adds humor and whimsy. NPCs have quirky personalities and situations have comedic potential.
```

## Recommended Models

| Model | RAM Required | Quality | Speed |
|-------|-------------|---------|-------|
| llama3:8b | 8GB | Good | Fast |
| llama3:70b | 48GB | Excellent | Slow |
| mistral | 8GB | Good | Fast |
| mixtral:8x7b | 32GB | Very Good | Medium |

## Troubleshooting

### "Could not connect to Ollama"
1. Ensure Ollama is running: `ollama serve`
2. Check the URL in settings (default: `http://localhost:11434`)
3. Verify firewall isn't blocking the connection

### Slow Responses
1. Use a smaller model (e.g., `llama3:8b`)
2. Reduce Max Tokens setting
3. Disable streaming if unstable

### Memory Not Persisting
1. Check browser console for errors
2. Ensure you have GM permissions
3. Try `/memory stats` to verify

## API Reference

Access the module API via `window.ChronicleKeeper`:

```javascript
// Check connection
ChronicleKeeper.connected // boolean

// Toggle AI DM
ChronicleKeeper.enabled = true;

// Access memory
const context = await ChronicleKeeper.memory.getContext("search query");

// Generate response
const response = await ChronicleKeeper.ollama.chat({
  model: "llama3:8b",
  messages: [{ role: "user", content: "Hello!" }]
});
```

## Contributing

Contributions welcome! Please read our contributing guidelines first.

## License

MIT License - see LICENSE file for details.

---

Made with ❤️ for tabletop RPG enthusiasts
