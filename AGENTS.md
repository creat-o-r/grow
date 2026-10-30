# `Grow` — AI Coding Agent & Crowd-Developer Guide (`AGENTS.md`)

Welcome! This repository is architected for **zero-merge-conflict crowd development** across human developers, "vibe-coders" (gardeners building with AI), and autonomous AI agents.

## Core Architectural Rules
1. **Local-First & Zero Server Cost**: All user garden state lives in `IndexedDB` via Dexie ([`src/lib/db.ts`](./src/lib/db.ts)). Never introduce paid databases or persistent WebSocket backend servers that break **Vercel's Free Hobby Tier**.
2. **Never Destructively Wipe Data**: When importing or syncing plant data, always use [`mergeSeedPackIntoDb`](./src/lib/seed-pack.ts) so existing user gardens are preserved.
3. **Browser Support Policy**: Allow Newly Available web platform features (such as Chrome's Built-in AI `LanguageModel` Prompt API and `WebMCP`), provided they are strictly feature-detected (`'LanguageModel' in self`) and gracefully fall back to the free LLM cascade in [`src/ai/model.ts`](./src/ai/model.ts) or deterministic logic in [`src/lib/viability.ts`](./src/lib/viability.ts).

---

## How to Add Features with Zero Git Merge Conflicts

Do **not** edit [`src/app/page.tsx`](./src/lib/db.ts) when adding new gardening calculators, widgets, or datasets. Instead, use one of our three isolated drop-in extension points:

### 1. Building a Garden UI Widget / Calculator (`src/extensions/<your-extension-id>/index.tsx`)
Create a new folder `src/extensions/<kebab-id>/index.tsx` exporting a `GrowExtension` object, and add a single line to `registeredExtensions` in [`src/extensions/registry.ts`](./src/extensions/registry.ts):

```tsx
import type { GrowExtension } from '../registry';

export const myCustomExtension: GrowExtension = {
  id: 'frost-date-estimator',
  name: 'Frost Date Estimator',
  description: 'Estimates first/last frost windows for the active GardenLocation.',
  version: '1.0.0',
  slots: ['dashboard-toolbar'],
  contributor: {
    name: 'Your Name / Handle',
    githubOrNostr: 'your-github-username',
  },
  DashboardWidget: ({ activeLocation, plantings }) => {
    // Render a shadcn Dialog / Popover button here
    return null;
  },
};
```

### 2. Adding a Regional or Thematic Plant Dataset (`src/lib/datasets/<key>.json`)
Create a JSON file matching the `AiDataset` schema (`locations`, `plants`, `plantings`) in [`src/lib/datasets/`](./src/lib/datasets/index.ts) and register its loader in [`src/lib/datasets/index.ts`](./src/lib/datasets/index.ts). Always include a deterministic `uid` slug on each plant.

### 3. Adding a Free-LLM AI Flow (`src/ai/flows/<flow-name>.ts`)
Wrap all AI calls with [`executeWithModelFallback`](./src/ai/model.ts) and pass `routerOptions` (`systemPrompt`, `userPrompt`, `groqApiKey`, `openrouterApiKey`, `ollamaUrl`) so the flow automatically cascades across Gemini Free Tier, Groq Free Tier, OpenRouter `:free` models, and Local Ollama.

---

## MCP & A2A Protocol Endpoints
- **Stateless MCP Server**: [`src/app/api/mcp/route.ts`](./src/app/api/mcp/route.ts) (`POST /api/mcp` JSON-RPC 2.0 Streamable HTTP)
- **A2A Discovery Card**: [`src/app/.well-known/agent.json/route.ts`](./src/app/.well-known/agent.json/route.ts) (`GET /.well-known/agent.json`)
