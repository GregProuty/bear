# Publishing proximity packages to npm

## 📦 Packages Ready to Publish

### 1. `proximity-dex-core` v7.9.8-proximity.2
- **What it is**: Core wallet selector package with Lava RPC and near-api-js@0.44.2 compatibility
- **Location**: `/Users/grey/Documents/fork-wallet-selector/proximity-dex-core`
- **No changes in this release** - just ensuring it's published for proximity-wallet-connect dependency

### 2. `proximity-wallet-connect` v7.9.8-proximity.16  
- **What it is**: WalletConnect bridge for NEAR with Fireblocks transaction signing support
- **Location**: `/Users/grey/Documents/fork-wallet-selector/proximity-wallet-connect`
- **🚀 CRITICAL FIX**: Fireblocks Buffer deserialization fix
  - Handles serialized Buffer objects from Fireblocks: `{type: "Buffer", data: [...]}`
  - Converts to Node.js Buffer before passing to BinaryReader
  - Switches from `near_signAndSendTransactions` to `near_signTransactions` + manual broadcast

## 🔑 Key Changes in v7.9.8-proximity.16

### Fireblocks Transaction Signing Fix
**Problem**: Fireblocks returns signed transactions as serialized Buffer objects, which were failing to deserialize.

**Solution**:
```typescript
// Detect and handle serialized Buffer objects
if (encoded && typeof encoded === 'object' && encoded.type === 'Buffer' && Array.isArray(encoded.data)) {
  arrayData = encoded.data;
}

// Convert to Uint8Array then to Node.js Buffer for BinaryReader
const bytes = Uint8Array.from(arrayData);
const buffer = Buffer.from(bytes);  // BinaryReader needs Buffer, not Uint8Array
const decoded = nearAPI.transactions.SignedTransaction.decode(buffer);
```

### Method Switch
- Changed from `near_signAndSendTransactions` (Fireblocks doesn't broadcast)
- To `near_signTransactions` + manual `provider.sendTransaction()`
- Gives dApp full control over transaction broadcasting

### Version Logging
- Added version identifier: `v5-FIREBLOCKS-BUFFER-FIX-2024-10-07`
- Makes it easy to verify correct code is loaded

## 📋 Publishing Steps

### Prerequisites
1. You must be logged in to npm: `npm whoami`
2. If not logged in: `npm login`
3. Ensure you have publish rights to the `proximity-dex-core` and `proximity-wallet-connect` packages

### Publish proximity-dex-core first (dependency)

```bash
cd /Users/grey/Documents/fork-wallet-selector/proximity-dex-core

# Verify package.json
cat package.json | grep version
# Should show: "version": "7.9.8-proximity.2"

# Dry run to see what will be published
npm publish --dry-run --access public

# Publish for real
npm publish --access public
```

### Then publish proximity-wallet-connect

```bash
cd /Users/grey/Documents/fork-wallet-selector/proximity-wallet-connect

# Verify package.json
cat package.json | grep version
# Should show: "version": "7.9.8-proximity.16"

# Dry run
npm publish --dry-run --access public

# Publish for real
npm publish --access public
```

## ✅ After Publishing

### Update burrow-cash to use the published versions

```bash
cd /Users/grey/Documents/fork-wallet-selector/burrow-cash

# Update package.json dependencies to use published versions
npm install proximity-dex-core@7.9.8-proximity.2 proximity-wallet-connect@7.9.8-proximity.16

# Test
npm run dev
```

### Verify the Fix

1. Visit http://localhost:3000
2. Connect Fireblocks via WalletConnect
3. Attempt a staking transaction
4. Check console for:
   ```
   🔥 WALLET-CONNECT VERSION: v5-FIREBLOCKS-BUFFER-FIX-2024-10-07
   ✅ Successfully decoded transaction #1
   ```

## 🐛 Known Issues

### Transaction is not signed with the given public key
After our deserialization fix, transactions now properly decode but fail with "Transaction is not signed with the given public key". This is a **public key mismatch issue**, not a code bug:
- The transaction is created with one public key (from access key fetch)
- Fireblocks signs it with a different public key
- NEAR RPC rejects the transaction

**Next Steps** (after publishing):
1. Investigate which public key Fireblocks is using
2. Ensure we're creating transactions with the correct public key
3. May need to adjust how we fetch access keys or configure Fireblocks

## 📚 Package Links (after publishing)

- https://www.npmjs.com/package/proximity-dex-core
- https://www.npmjs.com/package/proximity-wallet-connect

## 🔄 Version History

- `7.9.8-proximity.16` - Fireblocks Buffer deserialization fix + method switch
- `7.9.8-proximity.15` - Previous version (had deserialization issues)
- `7.9.8-proximity.2` - proximity-dex-core with Lava RPC + near-api-js@0.44.2

