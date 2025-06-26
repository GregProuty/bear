import { chainAdapters, constants, contracts, utils } from 'chainsig.js';

async function main() {
  console.log('ChainSig.js Example\n');

  // Available chain adapters
  console.log('Chain Adapters:');
  console.log('Bitcoin:', typeof chainAdapters.btc.Bitcoin);
  console.log('Ethereum:', typeof chainAdapters.evm.EVM);
  console.log('Solana:', typeof chainAdapters.solana.Solana);
  console.log('Cosmos:', typeof chainAdapters.cosmos.Cosmos);
  console.log('Aptos:', typeof chainAdapters.aptos.Aptos);
  console.log('SUI:', typeof chainAdapters.sui.SUI);
  console.log('XRP:', typeof chainAdapters.xrp.XRP);
  console.log();

  // Constants
  console.log('Available chains:', Object.keys(constants.CHAINS).join(', '));
  console.log('Environments:', Object.keys(constants.ENVS).join(', '));
  console.log();

  // Utilities
  console.log('Cryptography utils:', typeof utils.cryptography === 'object');
  console.log('Contract utils:', typeof contracts.utils === 'object');
  console.log();

  // Example usage notes
  console.log('To create adapter instances, you need:');
  console.log('- Bitcoin: network, contract, btcRpcAdapter');
  console.log('- EVM: publicClient, contract');
  console.log();

  console.log('Example completed successfully.');
}

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Error:', errorMessage);
  process.exit(1);
}); 