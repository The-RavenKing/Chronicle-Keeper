# Chronicle Keeper

**AI-Powered Campaign Memory for Foundry VTT**

Chronicle Keeper is your campaign's perfect memory. It automatically remembers every conversation, character, location, and event in your campaign, making your AI assistant truly knowledgeable about your story.

## Features

- 🧠 **Perfect Memory** - Automatically stores all conversations and campaign details
- 📚 **Content Ingestion** - Reads your journals, characters, scenes, and NPCs
- 🎭 **NPC Conversations** - Talk to NPCs who remember past interactions
- 🎲 **Campaign Separation** - Keep multiple campaigns completely isolated
- ✍️ **Custom AI Behavior** - Write your own system prompts
- 🔍 **Smart Search** - Find any detail from your campaign history

## Quick Start

### 1. Install Ollama
```bash
ollama pull llama2:7b
ollama serve
```

### 2. Install Module
Extract to: `FoundryVTT/Data/modules/chronicle-keeper/`

### 3. Configure
1. Enable module, refresh (F5)
2. Settings → Module Settings → Enable RAG
3. Run `/ingest` to learn your campaign!

## Commands

- `/ask [question]` - Ask the AI
- `/npc [Name]: [msg]` - Talk to NPC
- `/ingest` - Learn all campaign content
- `/history` - View conversations
- `/campaigns` - Manage campaigns

## How It Works

1. Run `/ingest` - AI reads all journals, characters, NPCs, scenes
2. Use `/ask` - AI automatically references relevant content
3. Everything is stored automatically
4. AI builds perfect campaign knowledge over time

## Documentation

See included guides for detailed help!

**Chronicle Keeper** - Your campaign's perfect memory 🎲✨
