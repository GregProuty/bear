export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string | undefined;
  aavePoolAddress: string;
  usdcAddress: string;
  vaultAddress?: string | undefined;
  explorerUrl: string;
  subgraphUrl?: string;
  elasticityFactor: number; // Percentage change in APY per 1% change in utilization
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    chainId: 11155111, // Ethereum Sepolia testnet chain ID
    name: 'Ethereum Sepolia',
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    aavePoolAddress: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951', // Ethereum Sepolia AAVE V3 Pool
    usdcAddress: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // Ethereum Sepolia USDT (USDC not supported on this AAVE pool)
    vaultAddress: process.env.AAVE_VAULT_ETHEREUM || undefined, // No vault deployed on Ethereum Sepolia yet
    explorerUrl: 'https://sepolia.etherscan.io',
    subgraphUrl: 'https://api.studio.thegraph.com/query/24660/aave-v3-sepolia/version/latest',
    elasticityFactor: 0.1 // 0.1% APY change per 1% utilization change (as per document)
  },
  base: {
    chainId: 84532, // Base Sepolia testnet chain ID
    name: 'Base Sepolia',
    rpcUrl: process.env.BASE_RPC_URL,
    aavePoolAddress: '0x6a9d64f93db660eacb2b6e9424792c630cda87d8', // Official Base Sepolia AAVE Pool from app
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Circle's official USDC on Base Sepolia testnet
    vaultAddress: '0xa189176b780Db31024038aD1C8080f62d87d5aea', // Deployed AaveVault on Base Sepolia
    explorerUrl: 'https://sepolia.basescan.org',
    subgraphUrl: 'https://api.studio.thegraph.com/query/24660/aave-v3-base/version/latest',
    elasticityFactor: 0.2 // 0.2% APY change per 1% utilization change (as per document)
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: process.env.OPTIMISM_RPC_URL,
    aavePoolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC on Optimism
    vaultAddress: process.env.AAVE_VAULT_OPTIMISM || undefined,
    explorerUrl: 'https://optimistic.etherscan.io',
    subgraphUrl: 'https://api.studio.thegraph.com/query/24660/aave-v3-optimism/version/latest',
    elasticityFactor: 0.15 // 0.15% APY change per 1% utilization change
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC_URL,
    aavePoolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum  
    vaultAddress: process.env.AAVE_VAULT_ARBITRUM || undefined,
    explorerUrl: 'https://arbiscan.io',
    subgraphUrl: 'https://api.studio.thegraph.com/query/24660/aave-v3-arbitrum/version/latest',
    elasticityFactor: 0.12 // 0.12% APY change per 1% utilization change
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL,
    aavePoolAddress: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    usdcAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon (bridged)
    vaultAddress: process.env.AAVE_VAULT_POLYGON || undefined,
    explorerUrl: 'https://polygonscan.com',
    subgraphUrl: 'https://api.studio.thegraph.com/query/24660/aave-v3-polygon/version/latest',
    elasticityFactor: 0.18 // 0.18% APY change per 1% utilization change
  },
  arbitrumSepolia: {
    chainId: 421614, // Arbitrum Sepolia testnet chain ID
    name: 'Arbitrum Sepolia',
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL,
    aavePoolAddress: '0x6ae43d3271ff6888e7fc43fd7321a503ff738951', // TODO: Update with real AAVE V3 pool address for Arbitrum Sepolia
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Circle's official USDC on Arbitrum Sepolia testnet
    vaultAddress: process.env.AAVE_VAULT_ARBITRUM_SEPOLIA || undefined, // No vault deployed yet
    explorerUrl: 'https://sepolia.arbiscan.io',
    subgraphUrl: 'https://api.studio.thegraph.com/query/24660/aave-v3-arbitrum-sepolia/version/latest', // TODO: Update with real subgraph URL
    elasticityFactor: 0.12 // Similar to Arbitrum mainnet
  },
  optimismSepolia: {
    chainId: 11155420, // Optimism Sepolia testnet chain ID
    name: 'Optimism Sepolia',
    rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL,
    aavePoolAddress: '0x6ae43d3271ff6888e7fc43fd7321a503ff738951', // TODO: Update with real AAVE V3 pool address for Optimism Sepolia
    usdcAddress: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // Circle's official USDC on Optimism Sepolia testnet
    vaultAddress: process.env.AAVE_VAULT_OPTIMISM_SEPOLIA || undefined, // No vault deployed yet
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    subgraphUrl: 'https://api.studio.thegraph.com/query/24660/aave-v3-optimism-sepolia/version/latest', // TODO: Update with real subgraph URL
    elasticityFactor: 0.15 // Similar to Optimism mainnet
  }
};

// AAVE Pool ABI - Essential functions for reading pool data
export const AAVE_POOL_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "asset", "type": "address"}],
    "name": "getReserveData",
    "outputs": [{
      "components": [
        {"internalType": "uint256", "name": "currentLiquidityRate", "type": "uint256"},
        {"internalType": "uint256", "name": "currentStableBorrowRate", "type": "uint256"},
        {"internalType": "uint256", "name": "currentVariableBorrowRate", "type": "uint256"},
        {"internalType": "uint256", "name": "liquidityIndex", "type": "uint256"},
        {"internalType": "uint256", "name": "variableBorrowIndex", "type": "uint256"},
        {"internalType": "uint40", "name": "lastUpdateTimestamp", "type": "uint40"},
        {"internalType": "address", "name": "aTokenAddress", "type": "address"},
        {"internalType": "address", "name": "stableDebtTokenAddress", "type": "address"},
        {"internalType": "address", "name": "variableDebtTokenAddress", "type": "address"},
        {"internalType": "address", "name": "interestRateStrategyAddress", "type": "address"},
        {"internalType": "uint128", "name": "accruedToTreasury", "type": "uint128"},
        {"internalType": "uint128", "name": "unbacked", "type": "uint128"},
        {"internalType": "uint128", "name": "isolationModeTotalDebt", "type": "uint128"}
      ],
      "internalType": "struct DataTypes.ReserveData",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "asset", "type": "address"}],
    "name": "getConfiguration",
    "outputs": [{
      "components": [
        {"internalType": "uint256", "name": "data", "type": "uint256"}
      ],
      "internalType": "struct DataTypes.ReserveConfigurationMap",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// ERC20 ABI for token balance checks
export const ERC20_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// ERC4626 Vault ABI - Essential functions for share price calculation
export const VAULT_ABI = [
  {
    "inputs": [],
    "name": "totalAssets",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply", 
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "asset",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view", 
    "type": "function"
  }
] as const;

// Helper function to get chain config by name
export function getChainConfig(chainName: string): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chainName.toLowerCase()];
}

// Helper function to get chain config by chain ID
export function getChainConfigById(chainId: number): ChainConfig | undefined {
  return Object.values(SUPPORTED_CHAINS).find(config => config.chainId === chainId);
}

// Validate that required environment variables are set
export function validateChainConfig(): void {
  const missingConfigs: string[] = [];
  
  for (const [chainName, config] of Object.entries(SUPPORTED_CHAINS)) {
    if (!config.rpcUrl) {
      missingConfigs.push(`${chainName.toUpperCase()}_RPC_URL`);
    }
  }
  
  if (missingConfigs.length > 0) {
    console.warn(`⚠️  Missing RPC URLs for: ${missingConfigs.join(', ')}`);
    console.warn('Some chain data collection will be disabled');
  }
} 