const { ethers } = require('ethers');

// Base Sepolia RPC
const provider = new ethers.JsonRpcProvider('https://base-sepolia.g.alchemy.com/v2/8VkZ26QCAR_WQL1pmW6Tx');

// This is a common PoolAddressProvider address pattern for AAVE V3 testnets
const POSSIBLE_PROVIDERS = [
  '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e', // Common pattern
  '0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A', // Another common pattern
  '0x4EEE0BB72C2717310318f27628B0c9a7FE11b73E', // Another pattern
];

const POOL_PROVIDER_ABI = [
  'function getPool() view returns (address)',
  'function getMarketId() view returns (string)',
  'function getPoolDataProvider() view returns (address)',
  'function getPriceOracle() view returns (address)'
];

async function findBaseSepoliaAddresses() {
  console.log('🔍 Searching for AAVE V3 addresses on Base Sepolia...\n');
  
  for (const providerAddress of POSSIBLE_PROVIDERS) {
    try {
      console.log(`Trying PoolAddressProvider: ${providerAddress}`);
      const poolProvider = new ethers.Contract(providerAddress, POOL_PROVIDER_ABI, provider);
      
      // Try to get market ID to confirm it's AAVE
      const marketId = await poolProvider.getMarketId();
      console.log(`Market ID: ${marketId}`);
      
      if (marketId.toLowerCase().includes('aave') || marketId.toLowerCase().includes('base')) {
        console.log('✅ Found AAVE deployment!');
        
        const poolAddress = await poolProvider.getPool();
        const dataProvider = await poolProvider.getPoolDataProvider();
        const priceOracle = await poolProvider.getPriceOracle();
        
        console.log('\n🎉 Base Sepolia AAVE V3 Addresses:');
        console.log(`PoolAddressProvider: ${providerAddress}`);
        console.log(`Pool: ${poolAddress}`);
        console.log(`DataProvider: ${dataProvider}`);
        console.log(`PriceOracle: ${priceOracle}`);
        console.log(`Market ID: ${marketId}`);
        
        // Now get USDC address (common testnet token)
        const COMMON_USDC_ADDRESSES = [
          '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Common pattern
          '0x7c6b91D9Be155A6Db01f749217d76fF02A7227F2', // Another pattern
        ];
        
        console.log('\n💰 Possible USDC addresses (verify these):');
        COMMON_USDC_ADDRESSES.forEach(addr => console.log(`USDC: ${addr}`));
        
        return {
          poolProvider: providerAddress,
          pool: poolAddress,
          dataProvider: dataProvider,
          priceOracle: priceOracle,
          marketId: marketId
        };
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message.substring(0, 50)}...`);
    }
  }
  
  console.log('\n🤔 Could not find addresses. Try checking app.aave.com manually.');
}

findBaseSepoliaAddresses().catch(console.error); 