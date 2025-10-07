# 🔄 Fresh Approach: What Can We Actually Try?

**Core Insight:** It worked before (~Oct 1, 2025) → Something changed → Can we adapt to that change?

---

## 🎯 What We Control (Entire Stack!)

Since you forked and control everything, we can modify:
1. ✅ **Transaction building** (how we construct the transaction)
2. ✅ **Transaction encoding** (how we serialize it)
3. ✅ **WalletConnect protocol** (what method we call, what we send)
4. ✅ **Response handling** (how we decode/verify what comes back)
5. ✅ **near-api-js version** (we can change it)
6. ✅ **Verification logic** (we can adjust what we check)

---

## 🔍 New Theories to Test

### **Theory 1: near-api-js Version Mismatch** ⭐ HIGH PRIORITY

**Current situation:**
- `proximity-wallet-connect`: uses near-api-js@0.44.2 (2022)
- `burrow-cash`: uses near-api-js@2.1.4 (2024)
- Fireblocks: probably uses latest near-api-js@5.x (2024)

**The issue:**
- Different versions might have different:
  - Borsh serialization
  - SHA-256 implementations
  - Transaction structure
  - Public key formats

**What if:**
- Fireblocks updated to near-api-js@5.x ~Oct 1
- Our old 0.44.2 is now incompatible
- We need to upgrade to match them

**Test:**
```bash
# Upgrade proximity-wallet-connect to use near-api-js@2.1.4
cd proximity-wallet-connect
# Update package.json to use 2.1.4 (same as burrow-cash)
# Rebuild and test
```

**Likelihood:** 60% - Version mismatches cause exactly these issues

---

### **Theory 2: Fresh WalletConnect Session** ⭐ MEDIUM PRIORITY

**Current situation:**
- Session was created before the Fireblocks change
- Session might have cached methods/permissions
- Session metadata might be stale

**Test:**
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
await indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB');
// Refresh, reconnect Fireblocks, try again
```

**Likelihood:** 30% - We already tested this somewhat, but worth a full clean slate

---

### **Theory 3: Transaction Hash Format** ⭐ HIGH PRIORITY

**What if Fireblocks changed what they sign?**

Currently we send:
- Transaction bytes: `[64, 0, 0, 0, ...]` (Array)
- Fireblocks signs: `SHA256(txBytes)`

**What if Fireblocks now signs something different?**
- Double SHA256: `SHA256(SHA256(txBytes))`
- Raw bytes without hashing
- Base58 encoded hash
- Different serialization format

**Test:** Try verifying with different hash formats:
```typescript
// In proximity-wallet-connect signature verification:

// Current:
const txHash = sha256.array(txBytes);

// Try these alternatives:
const txHash1 = sha256.array(sha256.array(txBytes)); // Double SHA256
const txHash2 = txBytes; // Raw bytes (no hash)
const txHash3 = sha256.array(Buffer.from(txBytes).toString('base64')); // SHA256 of base64

// Test each one
```

**Likelihood:** 40% - If Fireblocks changed their signing logic

---

### **Theory 4: Use Transaction.hash() Method** ⭐ HIGH PRIORITY

**What if we should use near-api-js's built-in hash method?**

```typescript
// Current (in v19):
import { sha256 } from "js-sha256";
const txHashBytes = sha256.array(txBytes);

// Try instead:
const txHashBytes = decoded.transaction.hash(); // Use near-api-js method

// Or get the hash from the RETURNED transaction:
const txHashBytes = decoded.hash(); // SignedTransaction might have a hash() method
```

**Why this might work:**
- near-api-js knows the "correct" way to hash for NEAR
- js-sha256 might be computing differently
- Fireblocks might use near-api-js's hash method

**Likelihood:** 50% - We're mixing libraries, using near-api-js throughout would be consistent

---

### **Theory 5: Don't Verify, Just Send** ⭐ ALREADY TESTED

We tried this (v20) - NEAR still rejected. So the signature is genuinely invalid for what NEAR expects.

---

### **Theory 6: Transaction Structure Changed**

**What if we need to build transactions differently?**

Check if transaction structure in newer near-api-js is different:
- Different field order?
- Different action encoding?
- Different public key format?

**Test:** Build transaction with near-api-js@2.1.4 instead of 0.44.2

---

## 🚀 Prioritized Action Plan

### **Action 1: Upgrade to near-api-js@2.1.4** (1 hour)

Match burrow-cash's version:

```json
// proximity-wallet-connect/package.json
{
  "dependencies": {
    "near-api-js": "2.1.4"  // Change from 0.44.2
  }
}

// proximity-dex-core/package.json  
{
  "dependencies": {
    "near-api-js": "2.1.4"  // Change from 0.44.2
  }
}
```

**Why:**
- Aligns all packages to same version
- 2.1.4 is 2 years newer than 0.44.2
- Might have compatibility fixes
- Eliminates version mismatch as a variable

**Risk:** Medium - might break other things, but worth testing

---

### **Action 2: Try near-api-js Hash Method** (30 mins)

```typescript
// In proximity-wallet-connect/src/lib/wallet-connect.ts
// Around line 440 (signature verification)

// REMOVE js-sha256:
// import { sha256 } from "js-sha256";

// INSTEAD use near-api-js:
const txHash = decoded.transaction.hash();
// or
const txHash = nearAPI.utils.serialize.hash(txBytes);

// Then verify:
const isValid = decoded.transaction.publicKey.verify(txHash, decoded.signature.data);
```

**Why:**
- Consistent with what near-api-js expects
- Might match what Fireblocks uses
- Eliminates js-sha256 as a variable

**Risk:** Low - easy to test and revert

---

### **Action 3: Complete Fresh Session** (5 mins)

Full nuclear reset:

```javascript
// Browser console:
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB');
sessionStorage.clear();
// Close all tabs
// Reopen, reconnect, test
```

**Why:**
- Eliminates cached state
- Fresh handshake with current Fireblocks version
- Might get updated methods/permissions

**Risk:** None - easy to test

---

### **Action 4: Debug What Fireblocks Actually Signs** (2 hours)

Add extensive logging to see what data is being signed:

```typescript
// Log EVERYTHING about the transaction:
console.log('Transaction object:', JSON.stringify(decoded.transaction, null, 2));
console.log('Transaction bytes (hex):', Buffer.from(txBytes).toString('hex'));
console.log('Transaction bytes (base64):', Buffer.from(txBytes).toString('base64'));
console.log('SHA256(bytes):', sha256(txBytes));
console.log('SHA256(SHA256(bytes)):', sha256(sha256(txBytes)));

// Try verifying with different formats:
const formats = [
  sha256.array(txBytes),
  sha256.array(sha256.array(txBytes)),
  txBytes,
  Buffer.from(txBytes),
];

formats.forEach((hash, i) => {
  const isValid = decoded.transaction.publicKey.verify(hash, decoded.signature.data);
  console.log(`Format ${i}: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
});
```

**Why:**
- Might discover what Fireblocks is actually signing
- Could reveal a pattern

**Risk:** Low - just logging

---

## 🎯 My Recommendation: Start with Action 1 + 2

**Upgrade near-api-js AND use its hash method:**

1. Update all packages to near-api-js@2.1.4
2. Remove js-sha256 dependency
3. Use near-api-js's hashing throughout
4. Test with Fireblocks

**Why this makes sense:**
- Eliminates version mismatches
- Uses consistent crypto throughout
- Might be what Fireblocks expects now
- Low risk, high potential reward

---

## 🤔 The Key Question

**What changed on Oct 1 that we can adapt to?**

Most likely scenarios:
1. **Fireblocks upgraded near-api-js** → We need to upgrade too
2. **Fireblocks changed hashing** → We need to match their method
3. **Fireblocks session/protocol change** → We need fresh session

All three are **testable and potentially fixable** on our end!

---

## 💡 Why This Might Work

**Before Oct 1:**
- Your code + Fireblocks's code = Compatible versions ✅

**After Oct 1:**
- Your code (unchanged) + Fireblocks's code (updated) = Incompatible ❌

**After our changes:**
- Your code (updated to match) + Fireblocks's code (updated) = Compatible again? ✅

---

**Ready to try Action 1 + 2?** This is our best shot at adapting to whatever Fireblocks changed.

