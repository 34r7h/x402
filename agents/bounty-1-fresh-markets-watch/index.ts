import { z } from "zod";
import { createAgentApp } from "@lucid-dreams/agent-kit";
import { ethers } from "ethers";

const { app, addEntrypoint } = createAgentApp({
  name: "fresh-markets-watch",
  version: "0.1.0",
  description: "List new AMM pairs or pools in the last few minutes",
});

// Uniswap V2 Factory ABI - PairCreated event
const FACTORY_ABI = [
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)",
];

const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

interface PairInfo {
  pair_address: string;
  tokens: string[];
  init_liquidity: string;
  top_holders: string[];
  created_at: number;
}

async function getTopHolders(
  provider: ethers.Provider,
  tokenAddress: string,
  limit: number = 10
): Promise<string[]> {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 50000); // Scan last ~50000 blocks
    
    // Query Transfer events to build holder list
    const transferFilter = tokenContract.filters.Transfer();
    const transfers = await tokenContract.queryFilter(transferFilter, fromBlock, currentBlock);
    
    // Aggregate balances
    const balances: Map<string, bigint> = new Map();
    
    for (const event of transfers) {
      if (!("args" in event) || !event.args) continue;
      const args = event.args as any;
      const from = args[0];
      const to = args[1];
      const value = args[2];
      
      // Update balances
      if (from && from !== ethers.ZeroAddress) {
        const current = balances.get(from) || BigInt(0);
        balances.set(from, current - value);
      }
      if (to && to !== ethers.ZeroAddress) {
        const current = balances.get(to) || BigInt(0);
        balances.set(to, current + value);
      }
    }
    
    // Get current balances for addresses that might have received tokens
    const holders = new Set<string>();
    for (const event of transfers) {
      if ("args" in event && event.args) {
        const args = event.args as any;
        if (args[1] !== ethers.ZeroAddress) {
          holders.add(args[1]);
        }
      }
    }
    
    // Query current balances
    const holderBalances: Array<{ address: string; balance: bigint }> = [];
    const holdersArray = Array.from(holders).slice(0, 100); // Limit to 100 to avoid too many calls
    
    for (const holder of holdersArray) {
      try {
        const balance = await tokenContract.balanceOf(holder);
        if (balance > BigInt(0)) {
          holderBalances.push({ address: holder, balance });
        }
      } catch (e) {
        // Skip if balanceOf fails
        continue;
      }
    }
    
    // Sort by balance and return top holders
    holderBalances.sort((a, b) => (b.balance > a.balance ? 1 : -1));
    return holderBalances.slice(0, limit).map(h => h.address);
  } catch (error) {
    console.error(`Error getting top holders for ${tokenAddress}:`, error);
    // Fallback: try to query recent large transfers
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);
      const transferFilter = tokenContract.filters.Transfer();
      const transfers = await tokenContract.queryFilter(transferFilter, fromBlock, currentBlock);
      
    const largeTransfers: Array<{ to: string; value: bigint }> = [];
    for (const event of transfers) {
      if ("args" in event && event.args) {
        const args = event.args as any;
        if (args[1] !== ethers.ZeroAddress) {
          largeTransfers.push({ to: args[1], value: args[2] });
        }
      }
    }
      
      largeTransfers.sort((a, b) => (b.value > a.value ? 1 : -1));
      return [...new Set(largeTransfers.slice(0, limit).map(t => t.to))];
    } catch (fallbackError) {
      return [];
    }
  }
}

async function getInitialLiquidity(
  provider: ethers.Provider,
  pairAddress: string
): Promise<string> {
  try {
    const pairContract = new ethers.Contract(
      pairAddress,
      [
        "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
        "function token0() view returns (address)",
        "function token1() view returns (address)",
      ],
      provider
    );

    const [reserve0, reserve1] = await pairContract.getReserves();
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();

    const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
    const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);

    const [decimals0, decimals1] = await Promise.all([
      token0Contract.decimals(),
      token1Contract.decimals(),
    ]);

    const liquidity0 = ethers.formatUnits(reserve0, decimals0);
    const liquidity1 = ethers.formatUnits(reserve1, decimals1);

    return `${liquidity0}, ${liquidity1}`;
  } catch (error) {
    console.error(`Error getting liquidity for ${pairAddress}:`, error);
    return "0, 0";
  }
}

async function scanNewPairs(
  provider: ethers.Provider,
  factoryAddress: string,
  windowMinutes: number
): Promise<PairInfo[]> {
  const pairs: PairInfo[] = [];
  const currentBlock = await provider.getBlockNumber();
  
  // Calculate blocks to scan based on chain
  const chainId = (await provider.getNetwork()).chainId;
  let blocksPerMinute = 12; // Ethereum mainnet default
  
  if (chainId === 137n) blocksPerMinute = 28; // Polygon
  else if (chainId === 42161n) blocksPerMinute = 12; // Arbitrum
  else if (chainId === 10n) blocksPerMinute = 12; // Optimism
  
  const blocksToScan = Math.ceil(windowMinutes * blocksPerMinute);
  const fromBlock = Math.max(0, currentBlock - blocksToScan);

  try {
    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
    const filter = factory.filters.PairCreated();

    const events = await factory.queryFilter(filter, fromBlock, currentBlock);

    for (const event of events) {
      if (!event || !("args" in event) || !event.args) continue;

      const token0 = event.args[0];
      const token1 = event.args[1];
      const pairAddress = event.args[2];

      const block = await provider.getBlock(event.blockNumber);
      const createdAt = block?.timestamp || Math.floor(Date.now() / 1000);

      // Get initial liquidity
      const initLiquidity = await getInitialLiquidity(provider, pairAddress);

      // Get top holders for both tokens
      const [topHolders0, topHolders1] = await Promise.all([
        getTopHolders(provider, token0, 5),
        getTopHolders(provider, token1, 5),
      ]);
      const topHolders = Array.from(
        new Set([...topHolders0, ...topHolders1])
      ).slice(0, 10);

      pairs.push({
        pair_address: pairAddress,
        tokens: [token0, token1],
        init_liquidity: initLiquidity,
        top_holders: topHolders,
        created_at: createdAt,
      });
    }
  } catch (error) {
    console.error("Error scanning pairs:", error);
  }

  return pairs;
}

addEntrypoint({
  key: "scan_new_pairs",
  description: "List new AMM pairs or pools in the last N minutes",
  input: z.object({
    chain: z.string().describe("Target blockchain (e.g., 'ethereum', 'polygon')"),
    factories: z
      .array(z.string())
      .describe("AMM factory contracts to monitor"),
    window_minutes: z
      .number()
      .int()
      .positive()
      .describe("Time window to scan in minutes"),
  }),
  async handler({ input }) {
    try {
      // Get RPC URL based on chain
      const chainLower = input.chain.toLowerCase();
      let rpcUrl = process.env[`RPC_URL_${input.chain.toUpperCase()}`] || process.env.RPC_URL;
      
      if (!rpcUrl) {
        const defaultRPCs: Record<string, string> = {
          ethereum: "https://eth.llamarpc.com",
          polygon: "https://polygon.llamarpc.com",
          arbitrum: "https://arb1.arbitrum.io/rpc",
          optimism: "https://mainnet.optimism.io",
          base: "https://mainnet.base.org",
          bsc: "https://bsc-dataseed1.binance.org",
        };
        rpcUrl = defaultRPCs[chainLower] || "https://eth.llamarpc.com";
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const allPairs: PairInfo[] = [];

      // Scan each factory
      for (const factoryAddress of input.factories) {
        const pairs = await scanNewPairs(
          provider,
          factoryAddress,
          input.window_minutes
        );
        allPairs.push(...pairs);
      }

      // Sort by creation time (newest first)
      allPairs.sort((a, b) => b.created_at - a.created_at);

      return {
        output: {
          pairs: allPairs,
          count: allPairs.length,
          window_minutes: input.window_minutes,
          scanned_factories: input.factories,
        },
        usage: {
          total_tokens: JSON.stringify(allPairs).length,
        },
      };
    } catch (error: any) {
      return {
        output: {
          error: error.message || "Unknown error occurred",
          pairs: [],
          count: 0,
        },
        usage: {
          total_tokens: 100,
        },
      };
    }
  },
});

// Start HTTP server if run directly
import { serve } from '@hono/node-server';

// Always start server when run as main module
const port = Number(process.env.PORT) || 3000;
serve({
  fetch: app.fetch,
  port,
}, () => {
  console.log(`Agent server running on http://localhost:${port}`);
  console.log(`Entrypoints: scan_new_pairs`);
});

export default app;
