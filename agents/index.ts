// Prevent individual agents from starting servers when imported
process.env.NO_AGENT_SERVER = '1';

// Global error handlers to prevent crashes
process.on('unhandledRejection', (error: any) => {
  console.error('Unhandled rejection:', error?.message || error);
  // Don't crash on unhandled rejections - just log
});

process.on('uncaughtException', (error: any) => {
  console.error('Uncaught exception:', error?.message || error);
  // Don't crash on uncaught exceptions - just log
});

// Main routing server for all agents
import { Hono } from 'hono';
import { serve } from '@hono/node-server';

// Import all agent apps
import app1 from './bounty-1-fresh-markets-watch/index.js';
import app2 from './bounty-2-cross-dex-arbitrage-alert/index.js';
import app3 from './bounty-3-slippage-sentinel/index.js';
import app4 from './bounty-4-gasroute-oracle/index.js';
import app5 from './bounty-5-approval-risk-auditor/index.js';
import app6 from './bounty-6-yield-pool-watcher/index.js';
import app7 from './bounty-7-lp-impermanent-loss-estimator/index.js';
import app8 from './bounty-8-perps-funding-pulse/index.js';
import app9 from './bounty-9-lending-liquidation-sentinel/index.js';
import app10 from './bounty-10-bridge-route-pinger/index.js';

const mainApp = new Hono();

// Agent path mappings
const agentMap: Record<string, any> = {
  'fresh-markets-watch': app1,
  'cross-dex-arbitrage-alert': app2,
  'slippage-sentinel': app3,
  'gasroute-oracle': app4,
  'approval-risk-auditor': app5,
  'yield-pool-watcher': app6,
  'lp-impermanent-loss-estimator': app7,
  'perps-funding-pulse': app8,
  'lending-liquidation-sentinel': app9,
  'bridge-route-pinger': app10,
};

// Root endpoint - show available agents
mainApp.get('/', (c) => {
  return c.json({
    name: 'x402 Agent Server',
    version: '1.0.0',
    agents: Object.keys(agentMap).map((path) => ({
      path,
      url: `https://x402.haxters.com/${path}`,
    })),
  });
});

// Route each agent path
for (const [path, agentApp] of Object.entries(agentMap)) {
  // Route exact path (e.g., /fresh-markets-watch) - return 402 payment required for GET
  mainApp.all(`/${path}`, async (c) => {
    // For GET requests (x402scan validation), always return 402 with x402 response format
    if (c.req.method === 'GET' || c.req.method === 'HEAD') {
      // Use full HTTPS URL for resource
      const resourceUrl = `https://x402.haxters.com/${path}`;
      
      return c.json({
        x402Version: 1,
        accepts: [{
          scheme: "exact",
          network: "base",
          maxAmountRequired: "1000000000000000", // 0.001 ETH in wei (1e15)
          resource: resourceUrl,
          description: `Access ${path} agent services`,
          mimeType: "application/json",
          payTo: process.env.PAY_TO_ADDRESS || "0x0000000000000000000000000000000000000000",
          maxTimeoutSeconds: 300,
          asset: "native",
        }]
      }, 402);
    }
    
    // For non-GET requests, forward to agent app
    const originalUrl = new URL(c.req.url);
    const newUrl = new URL('/' + originalUrl.search, originalUrl.origin);
    
    let body: any = null;
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      try {
        body = await c.req.raw.clone().arrayBuffer();
      } catch (e) {}
    }

    const newRequest = new Request(newUrl.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: body,
    });

    try {
      const response = await agentApp.fetch(newRequest);
      return response;
    } catch (error: any) {
      return c.json({ error: error.message || 'Internal server error' }, 500);
    }
  });

  // Route sub-paths (e.g., /fresh-markets-watch/entrypoints)
  mainApp.all(`/${path}/*`, async (c) => {
    const originalUrl = new URL(c.req.url);
    // Remove the agent path prefix (e.g., /fresh-markets-watch) and keep the rest
    const remainingPath = originalUrl.pathname.replace(`/${path}`, '') || '/';
    
    // Reconstruct URL with remaining path only (agent app expects paths starting with /)
    const newUrl = new URL(remainingPath + originalUrl.search, originalUrl.origin);
    
    // Get request body if present
    let body: any = null;
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      try {
        body = await c.req.raw.clone().arrayBuffer();
      } catch (e) {
        // Body might not be available
      }
    }

    // Create a new request with the adjusted path
    const newRequest = new Request(newUrl.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: body,
    });

    // Forward to agent app
    try {
      const response = await agentApp.fetch(newRequest);
      return response;
    } catch (error: any) {
      return c.json({ error: error.message || 'Internal server error' }, 500);
    }
  });
}

// Start server
const port = Number(process.env.PORT) || 3005;
serve({
  fetch: mainApp.fetch,
  port,
}, () => {
  console.log(`x402 Agent Server running on http://localhost:${port}`);
  console.log(`Available agents:`);
  for (const path of Object.keys(agentMap)) {
    console.log(`  - https://x402.haxters.com/${path}`);
  }
});

export default mainApp;
