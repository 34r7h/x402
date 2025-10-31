# Agent Bounties - Development Guide

This repository contains 10 DeFi/Web3 AI agents for the Daydreams AI Agent Bounties program.

## Project Structure

```
├── agents/                    # Individual agent directories
│   ├── bounty-1-fresh-markets-watch/
│   ├── bounty-2-cross-dex-arbitrage-alert/
│   └── ... (10 total)
├── src/                       # Source code
│   ├── agents/               # Agent implementations
│   └── utils/                # Shared utilities
├── submissions/              # Submission markdown files
└── package.json
```

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Build TypeScript:
```bash
npm run build
```

3. Run development server:
```bash
npm run dev
```

## Agent Development

Each agent follows the `@lucid-dreams/agent-kit` pattern:

1. Create agent app with `createAgentApp()`
2. Define entrypoint with `addEntrypoint()`
3. Use Zod for input validation
4. Return structured output with usage metrics

## Deployment

All agents must be:
- Deployed on a domain
- Accessible via x402 protocol
- Meet all acceptance criteria from GitHub issues

## Resources

- [@lucid-dreams/agent-kit](https://www.npmjs.com/package/@lucid-dreams/agent-kit)
- [YouTube Tutorial](https://www.youtube.com/watch?v=POxLThEK_cM)
- [GitHub Issues](https://github.com/daydreamsai/agent-bounties/issues)

