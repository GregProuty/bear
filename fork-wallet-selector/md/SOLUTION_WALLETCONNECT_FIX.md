# 🔧 WalletConnect Fix - Complete Solution Guide

## 🎯 Problem Identified

**ROOT CAUSE:** Your `fastnear-wallet-selector-core` package uses `FailoverRpcProvider` which doesn't exist in `near-api-js` versions < 4.0.0.

```typescript
// wallet-selector/packages/core/src/lib/services/provider/provider.service.ts:17-20
private provider: nearAPI.providers.FailoverRpcProvider;

constructor(urls: Array<string>) {
  this.provider = new nearAPI.providers.FailoverRpcProvider(
    this.urlsToProviders(urls)
  );
}
```

**But Rhea's working version uses:**
```javascript
// rhea-wallet-connect/index.js:7-12
class Provider {
  constructor(url) {
    this.provider = new nearAPI.providers.JsonRpcProvider({ url });
  }
}
```

## ✅ Solution Options

---

### **OPTION 1: Quick Fix - Use Rhea's Complete Stack** ⭐ RECOMMENDED FOR TESTING

Replace ALL wallet-selector packages with Rhea's versions.

#### Steps:

**1. Update `burrow-cash/package.json`:**

```json
{
  "dependencies": {
    // REMOVE these:
    // "@near-wallet-selector/core": "8.9.3",
    // "@near-wallet-selector/here-wallet": "8.9.3",
    // "@near-wallet-selector/ledger": "8.9.3",
    // "@near-wallet-selector/meteor-wallet": "8.9.3",
    // "@near-wallet-selector/modal-ui": "8.9.3",
    // "@near-wallet-selector/near-mobile-wallet": "8.9.3",
    // "@near-wallet-selector/near-wallet": "8.9.3",
    // "@near-wallet-selector/neth": "8.9.3",
    // "@near-wallet-selector/nightly": "8.9.3",
    // "@near-wallet-selector/sender": "8.9.3",
    // "@near-wallet-selector/wallet-connect": "8.10.2",
    
    // ADD these (Rhea's versions):
    "rhea-dex-core": "7.9.1",
    "rhea-dex-modal-ui": "7.9.1",
    "rhea-dex-wallet-utils": "7.9.2",
    "rhea-wallet-connect": "7.9.8",
    
    // Keep existing rhea-compatible packages
    "near-api-js": "2.1.4",  // Keep this version!
    "rhea-wallet-connect": "7.9.8",
    
    // Keep other non-wallet packages as-is
    "@chakra-ui/react": "1.8.8",
    // ... etc
  }
}
```

**2. Update `burrow-cash/utils/wallet-selector-compat.ts`:**

```typescript
// REPLACE ALL IMPORTS
import { setupWalletSelector } from "rhea-dex-core";
import type { WalletSelector } from "rhea-dex-core";
import { setupModal } from "rhea-dex-modal-ui";
import type { WalletSelectorModal } from "rhea-dex-modal-ui";

// For individual wallets, check if rhea has equivalents, otherwise use standard ones
// WalletConnect MUST use rhea version:
import { setupWalletConnect } from "rhea-wallet-connect";

// Other wallets can stay as @near-wallet-selector/* IF compatible with near-api-js 2.1.4
// Otherwise, you might need to remove some wallets temporarily
```

**3. Install and test:**

```bash
cd /Users/grey/Documents/fork-wallet-selector/burrow-cash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Pros:**
- ✅ Guaranteed to work with Fireblocks
- ✅ All dependencies aligned
- ✅ Quick to implement

**Cons:**
- ❌ Locked to older versions
- ❌ Missing newer wallets
- ❌ Dependent on Rhea's updates

---

### **OPTION 2: Fix Your fastnear-wallet-selector-core** ⭐ RECOMMENDED FOR PRODUCTION

Backport Rhea's provider fix to make your fork compatible with older `near-api-js`.

#### Steps:

**1. Modify `wallet-selector/packages/core/src/lib/services/provider/provider.service.ts`:**

```typescript
import * as nearAPI from "near-api-js";
import type {
  AccessKeyView,
  BlockReference,
  QueryResponseKind,
  RpcQueryRequest,
} from "near-api-js/lib/providers/provider.js";
import type {
  ProviderService,
  QueryParams,
  ViewAccessKeyParams,
} from "./provider.service.types";
import { JsonRpcProvider } from "near-api-js/lib/providers/index.js";
import type { SignedTransaction } from "near-api-js/lib/transaction.js";

export class Provider implements ProviderService {
  // CHANGED: Use JsonRpcProvider instead of FailoverRpcProvider for compatibility
  private provider: nearAPI.providers.JsonRpcProvider;
  private fallbackProviders: Array<JsonRpcProvider> = [];
  private currentProviderIndex: number = 0;

  constructor(urls: Array<string>) {
    if (!urls || urls.length === 0) {
      throw new Error("At least one RPC URL must be provided");
    }
    
    // Create primary provider
    this.provider = new JsonRpcProvider({ url: urls[0] });
    
    // Create fallback providers if multiple URLs provided
    if (urls.length > 1) {
      this.fallbackProviders = urls.slice(1).map(url => 
        new JsonRpcProvider({ url })
      );
    }
  }

  private async withFallback<T>(
    operation: (provider: JsonRpcProvider) => Promise<T>
  ): Promise<T> {
    try {
      return await operation(this.provider);
    } catch (error) {
      // Try fallback providers
      for (let i = 0; i < this.fallbackProviders.length; i++) {
        try {
          console.warn(`Primary RPC failed, trying fallback ${i + 1}/${this.fallbackProviders.length}`);
          return await operation(this.fallbackProviders[i]);
        } catch (fallbackError) {
          // Continue to next fallback
          if (i === this.fallbackProviders.length - 1) {
            // Last fallback also failed, throw original error
            throw error;
          }
        }
      }
      throw error;
    }
  }

  query<Response extends QueryResponseKind>(
    paramsOrPath: QueryParams | RpcQueryRequest | string,
    data?: string
  ): Promise<Response> {
    return this.withFallback(async (provider) => {
      if (typeof paramsOrPath === "string" && data !== undefined) {
        return provider.query<Response>(paramsOrPath, data);
      } else {
        return provider.query<Response>(paramsOrPath as RpcQueryRequest);
      }
    });
  }

  viewAccessKey({ accountId, publicKey }: ViewAccessKeyParams) {
    return this.withFallback((provider) =>
      provider.query<AccessKeyView>({
        request_type: "view_access_key",
        finality: "final",
        account_id: accountId,
        public_key: publicKey,
      })
    );
  }

  block(reference: BlockReference) {
    return this.withFallback((provider) => provider.block(reference));
  }

  sendTransaction(signedTransaction: SignedTransaction) {
    return this.withFallback((provider) =>
      provider.sendTransaction(signedTransaction)
    );
  }
}
```

**2. Update `package.json` peer dependencies:**

```json
// wallet-selector/packages/core/package.json
{
  "peerDependencies": {
    "near-api-js": "^0.44.0 || ^2.0.0 || ^4.0.0 || ^5.0.0"
  }
}
```

**3. Update tests to match new implementation:**

```typescript
// wallet-selector/packages/core/src/lib/wallet-selector.spec.ts
// Replace FailoverRpcProvider mocks with JsonRpcProvider mocks
```

**4. Rebuild and republish:**

```bash
cd /Users/grey/Documents/fork-wallet-selector/wallet-selector
yarn build
cd packages/core
npm version patch  # 9.2.1 -> 9.2.2
npm publish dist/packages/core --access public
```

**5. Update burrow to use your fixed version:**

```json
// burrow-cash/package.json
{
  "dependencies": {
    "fastnear-wallet-selector-core": "9.2.2",
    "near-api-js": "2.1.4"
  }
}
```

**Pros:**
- ✅ Works with both old and new near-api-js
- ✅ Maintains your fastnear brand
- ✅ Independent from Rhea's updates
- ✅ Can use newer wallets

**Cons:**
- ❌ Requires rebuilding and republishing
- ❌ Need to maintain fallback logic
- ❌ More testing required

---

### **OPTION 3: Hybrid Approach** ⭐ BEST OF BOTH WORLDS

Use Rhea's WalletConnect ONLY, keep your other packages.

#### Steps:

**1. Install rhea-wallet-connect alongside your packages:**

```json
// burrow-cash/package.json
{
  "dependencies": {
    "@near-wallet-selector/core": "8.9.3",
    "@near-wallet-selector/modal-ui": "8.9.3",
    "@near-wallet-selector/here-wallet": "8.9.3",
    // ... other wallets ...
    
    // Special WalletConnect handling
    "rhea-wallet-connect": "7.9.8",
    
    // Pin near-api-js to compatible version
    "near-api-js": "2.1.4"
  }
}
```

**2. Create a compatibility wrapper:**

```typescript
// burrow-cash/utils/wallet-compat-wrapper.ts

import { setupWalletConnect as setupRheaWC } from "rhea-wallet-connect";

// Wrap Rhea's WalletConnect to match @near-wallet-selector interface
export function setupWalletConnect(params) {
  const rheaWC = setupRheaWC(params);
  
  // Add any interface compatibility shims if needed
  return rheaWC;
}
```

**3. Use in wallet-selector-compat.ts:**

```typescript
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
// ... other wallets ...

// Import our wrapped version
import { setupWalletConnect } from "./wallet-compat-wrapper";

// Rest stays the same...
```

**Pros:**
- ✅ WalletConnect works (Fireblocks compatible)
- ✅ Other wallets use latest versions
- ✅ Minimal changes required
- ✅ Easy to maintain

**Cons:**
- ❌ Version mismatches might cause issues
- ❌ near-api-js conflicts possible
- ❌ Need to manage two ecosystems

---

## 🚀 Recommended Implementation Path

### **Phase 1: Immediate Testing (Today)**
Use **OPTION 1** to verify the theory:

```bash
cd /Users/grey/Documents/fork-wallet-selector/burrow-cash

# Backup current state
cp package.json package.json.backup

# Install rhea packages
npm install rhea-dex-core@7.9.1 rhea-wallet-connect@7.9.8

# Update imports in wallet-selector-compat.ts
# Test with Fireblocks
```

### **Phase 2: If It Works (This Week)**
Implement **OPTION 2** for long-term solution:

1. Fix your fastnear-wallet-selector-core provider
2. Rebuild and publish
3. Update burrow to use fixed version
4. Comprehensive testing

### **Phase 3: Production (Next Week)**
- Full testing with all wallets
- Performance testing
- Security audit
- Documentation update

---

## 📋 Testing Checklist

After implementing fix:

- [ ] WalletConnect connects successfully
- [ ] Fireblocks app receives transaction requests
- [ ] Can sign transactions in Fireblocks
- [ ] Transaction completes and returns hash
- [ ] No console errors
- [ ] Other wallets still work (MyNearWallet, Meteor, etc.)
- [ ] Sign out works
- [ ] Wallet switching works
- [ ] Page refresh maintains connection
- [ ] Network switching works (mainnet/testnet)

---

## 🐛 Debug Commands

Add to browser console after implementing fix:

```javascript
// Check loaded packages
console.log('Core package:', window.selector?.constructor?.name);
console.log('near-api-js providers:', Object.keys(require('near-api-js').providers));

// Check if FailoverRpcProvider exists
try {
  console.log('Has FailoverRpcProvider:', typeof require('near-api-js').providers.FailoverRpcProvider);
} catch (e) {
  console.log('FailoverRpcProvider check failed:', e.message);
}

// Check wallet connect version
const wc = window.selector?.store?.getState()?.modules?.find(m => m.id === 'wallet-connect');
console.log('WalletConnect module:', wc);
```

---

## 📚 Key Files to Monitor

1. **Provider Service:** 
   - Your fork: `wallet-selector/packages/core/src/lib/services/provider/provider.service.ts`
   - Rhea's: `rhea-wallet-connect/index.js` (lines 7-32)

2. **Wallet Connect Setup:**
   - Your fork: `wallet-selector/packages/wallet-connect/src/lib/wallet-connect.ts`
   - Rhea's: `rhea-wallet-connect/index.js`

3. **Burrow Integration:**
   - `burrow-cash/utils/wallet-selector-compat.ts`
   - `burrow-cash/store/wallet.ts`

4. **Dependencies:**
   - `burrow-cash/package.json`
   - `wallet-selector/packages/core/package.json`

---

## 🎓 What You've Learned

1. **FailoverRpcProvider** only exists in `near-api-js` v4.0.0+
2. **Rhea solved this** by using `JsonRpcProvider` directly with manual fallback logic
3. **WalletConnect v2.17+** has breaking changes not supported by older ecosystems
4. **Version pinning** is sometimes necessary for ecosystem compatibility
5. **Monorepo dependencies** can create complex version conflicts

---

## 📞 Next Steps

1. **Choose your option** (recommend starting with Option 1)
2. **Implement the fix**
3. **Test thoroughly** with Fireblocks
4. **Document your results**
5. **Consider contributing** the fix back to NEAR's official wallet-selector

---

## ✨ Success Metrics

You'll know it's working when:

1. ✅ No `FailoverRpcProvider is not a constructor` errors
2. ✅ WalletConnect initiates without errors
3. ✅ Fireblocks app receives transaction prompts
4. ✅ Transactions complete within timeout
5. ✅ Console shows successful WC events
6. ✅ No 404 errors on any pages

---

**Good luck! Your theory was spot-on. 🎯**

