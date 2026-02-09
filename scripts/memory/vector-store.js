/**
 * Chronicle Keeper - Vector Store
 * Semantic search using embeddings from Ollama
 */

import { MODULE_ID, MODULE_NAME, ChronicleKeeper, getSetting } from '../main.js';

/**
 * Vector store for semantic memory search
 */
export class VectorStore {
    constructor() {
        this.entries = new Map();
        this.embeddings = new Map();
        this.initialized = false;
    }

    async load() {
        try {
            const stored = game.settings.get(MODULE_ID, 'embeddings') || {};
            if (stored.entries) this.entries = new Map(Object.entries(stored.entries));
            if (stored.embeddings) this.embeddings = new Map(Object.entries(stored.embeddings));
            this.initialized = true;
            console.log(`${MODULE_NAME} | Vector store loaded with ${this.entries.size} entries`);
        } catch (error) {
            console.warn(`${MODULE_NAME} | Could not load vector store:`, error);
        }
    }

    async save() {
        try {
            await game.settings.set(MODULE_ID, 'embeddings', {
                entries: Object.fromEntries(this.entries),
                embeddings: Object.fromEntries(this.embeddings)
            });
        } catch (error) {
            console.error(`${MODULE_NAME} | Failed to save vector store:`, error);
        }
    }

    async addEntry(entry) {
        const { id, content, type, timestamp } = entry;
        this.entries.set(id, { content, type, timestamp: timestamp || Date.now() });

        if (ChronicleKeeper?.ollama?.connected) {
            try {
                const embedding = await ChronicleKeeper.ollama.embed(getSetting('embeddingModel'), content);
                if (embedding?.length > 0) this.embeddings.set(id, embedding);
            } catch (error) {
                console.warn(`${MODULE_NAME} | Failed to generate embedding:`, error);
            }
        }

        if (this.entries.size % 10 === 0) await this.save();
    }

    async search(query, topK = 5) {
        if (ChronicleKeeper?.ollama?.connected && this.embeddings.size > 0) {
            try {
                const queryEmbedding = await ChronicleKeeper.ollama.embed(getSetting('embeddingModel'), query);
                if (queryEmbedding?.length > 0) return this._semanticSearch(queryEmbedding, topK);
            } catch (error) {
                console.warn(`${MODULE_NAME} | Semantic search failed:`, error);
            }
        }
        return this._keywordSearch(query, topK);
    }

    _semanticSearch(queryEmbedding, topK) {
        const results = [];
        for (const [id, embedding] of this.embeddings.entries()) {
            const entry = this.entries.get(id);
            if (!entry) continue;
            results.push({ id, ...entry, score: this._cosineSimilarity(queryEmbedding, embedding) });
        }
        return results.sort((a, b) => b.score - a.score).slice(0, topK);
    }

    _cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return (normA && normB) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
    }

    _keywordSearch(query, topK) {
        const queryLower = query.toLowerCase();
        const words = queryLower.split(/\s+/).filter(w => w.length > 2);
        const results = [];

        for (const [id, entry] of this.entries.entries()) {
            const content = entry.content.toLowerCase();
            let score = content.includes(queryLower) ? 0.5 : 0;
            for (const word of words) if (content.includes(word)) score += 0.2;
            if (score > 0) results.push({ id, ...entry, score });
        }
        return results.sort((a, b) => b.score - a.score).slice(0, topK);
    }

    async remove(id) { this.entries.delete(id); this.embeddings.delete(id); await this.save(); }
    async clear() { this.entries.clear(); this.embeddings.clear(); await this.save(); }
    get size() { return this.entries.size; }
    get embeddingCount() { return this.embeddings.size; }

    async rebuild() {
        if (!ChronicleKeeper?.ollama?.connected) return;
        const model = getSetting('embeddingModel');
        for (const [id, entry] of this.entries.entries()) {
            try {
                const emb = await ChronicleKeeper.ollama.embed(model, entry.content);
                if (emb?.length > 0) this.embeddings.set(id, emb);
            } catch (e) { /* skip */ }
        }
        await this.save();
    }
}
