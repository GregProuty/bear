# Crypto Library Version Analysis

**User's Theory:** The issue might be SHA/crypto library versions causing signature verification failures

**This is EXCELLENT thinking!** Let's analyze the layers of crypto libraries.

---

## 🔍 Current Crypto Stack

### **Our Code:**
```json
{
  "near-api-js": "0.44.2",        // From 2022, pinned by Rhea
  "js-sha256": "0.9.0",           // WE ADDED THIS for manual verification
  "bn.js": "^5.2.0"               // For big numbers
}
```

### **What Fireblocks Uses:**
- ❓ Unknown version of near-api-js (probably NEWER)
- ❓ Unknown crypto library
- ❓ Unknown Borsh version

### **What NEAR Blockchain Uses:**
- Latest NEAR node implementation
- Rust-based crypto (Ed25519 from `ed25519-dalek` or similar)
- Standard SHA-256

---

## 🚨 Critical Insight: WE ADDED js-sha256!

Looking at our code history:

**Version 17-18-19:** We added `js-sha256` for MANUAL signature verification:

```typescript
// v19 code:
import { sha256 } from "js-sha256";  // ← WE ADDED THIS

// In verification:
const txHashBytes = new Uint8Array(sha256.array(txBytes));  // ← Using js-sha256
const isValid = decoded.transaction.publicKey.verify(
  txHashBytes,
  decoded.signature.data
);
```

**But near-api-js@0.44.2 has its OWN internal crypto!**

---

## ❓ The Question: Are We Verifying WRONG?

### **Theory 1: Our Verification Is Wrong**

What if:
- ✅ Fireblocks' signature is ACTUALLY VALID
- ❌ But our manual verification using `js-sha256` is WRONG
- ❌ We're computing the hash differently than NEAR does

**Evidence:**
- We ADDED `js-sha256` ourselves (not in original code)
- near-api-js has its own internal crypto
- We're mixing libraries: `js-sha256` for hash + near-api-js's `PublicKey.verify()`

### **Theory 2: near-api-js Version Mismatch**

What if:
- We use `near-api-js@0.44.2` (from 2022) to build/serialize
- Fireblocks uses `near-api-js@2.x` (latest, from 2024) to deserialize/re-serialize
- **Different Borsh serialization between versions**
- Bytes are different after Fireblocks re-serializes

**Evidence:**
- Rhea pinned to 0.44.2 specifically
- Fireblocks probably uses latest version
- Borsh serialization could differ between versions

### **Theory 3: Crypto Library Incompatibility**

What if:
- `js-sha256@0.9.0` (browser library) computes hash differently
- near-api-js@0.44.2 uses different SHA-256 implementation
- Subtle differences in hash computation

---

## 🧪 How to Test These Theories

### **Test 1: Remove Manual Verification** ⭐ **HIGHEST PRIORITY**

**Current flow:**
1. Get signed transaction from Fireblocks
2. Manually verify with js-sha256 ❌ FAILS
3. Give up

**Proposed flow:**
1. Get signed transaction from Fireblocks
2. ~~Manual verification~~ **SKIP THIS**
3. **Just broadcast to NEAR directly**
4. Let NEAR verify (it uses standard crypto)

**Implementation:**
```typescript
// In proximity-wallet-connect/src/lib/wallet-connect.ts
// Around line 626-661

// REMOVE THIS ENTIRE BLOCK:
/*
try {
  const txBytes = decoded.transaction.encode();
  const txHashBytes = new Uint8Array(sha256.array(txBytes));
  
  const isValid = decoded.transaction.publicKey.verify(
    txHashBytes,
    decoded.signature.data
  );
  
  if (!isValid) {
    console.error('SIGNATURE VERIFICATION FAILED!');
    // ...
  }
} catch (verifyError) {
  // ...
}
*/

// REPLACE WITH:
console.log(`   ⚠️  Skipping manual verification - trusting Fireblocks signature`);
console.log(`   📡 Will let NEAR blockchain verify the signature`);
```

**Why this might work:**
- Our manual verification might be WRONG
- Fireblocks' signature might be VALID
- NEAR will verify correctly

**Likelihood:** 40% - We added this verification ourselves, might be the bug!

---

### **Test 2: Check Transaction Bytes Before/After**

**Current logging shows:**
```
📦 Transaction BEFORE sending to Fireblocks:
   Full bytes: 40000000...

📦 Transaction AFTER Fireblocks signed:
   Full bytes: 40000000... [signature added]
```

**Question:** Are the TRANSACTION bytes identical (ignoring signature)?

**Add this check:**
```typescript
// After decoding signed transaction
const originalTxBytes = txs[idx].encode();
const signedTxBytes = decoded.transaction.encode();

console.log(`   🔍 TRANSACTION BYTES COMPARISON:`);
console.log(`      Original length:`, originalTxBytes.length);
console.log(`      Signed length:`, signedTxBytes.length);
console.log(`      Match:`, Buffer.from(originalTxBytes).toString('hex') === Buffer.from(signedTxBytes).toString('hex'));

if (Buffer.from(originalTxBytes).toString('hex') !== Buffer.from(signedTxBytes).toString('hex')) {
  console.error(`   ❌ TRANSACTION BYTES CHANGED!`);
  console.error(`      Fireblocks re-serialized differently`);
  console.error(`      This explains the signature mismatch`);
}
```

**If bytes are different:** Fireblocks is using different Borsh serialization (likely newer near-api-js version)

---

### **Test 3: Use near-api-js's Built-in Verification**

Instead of manual js-sha256, use near-api-js's methods:

```typescript
// REMOVE: import { sha256 } from "js-sha256";

// Use near-api-js verification instead:
try {
  // SignedTransaction has a built-in method to get the hash
  const txHash = decoded.transaction.hash();  // Uses near-api-js's crypto
  
  // Verify using same library
  const isValid = decoded.transaction.publicKey.verify(
    txHash,
    decoded.signature.data
  );
  
  console.log(`   Using near-api-js crypto: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
} catch (e) {
  console.log(`   Could not verify with near-api-js:`, e.message);
}
```

---

### **Test 4: Upgrade near-api-js** (Nuclear option)

**Current:** `near-api-js@0.44.2` (from 2022)  
**Latest:** `near-api-js@5.0.1` (2024)

**Why Rhea pinned it:** Compatibility issues with wallet selector

**But what if:**
- Upgrading to latest near-api-js fixes Fireblocks compatibility
- The old version is the problem

**Risk:** HIGH - Might break other things  
**Effort:** HIGH - Need to test extensively  
**Likelihood:** 30% - Could fix it but risky

---

## 🎯 Recommended Actions (In Order)

### **Priority 1: Remove Manual Verification** ⭐ (15 mins)

**Hypothesis:** Our js-sha256 verification is wrong, signature might be valid

**Steps:**
1. Edit `proximity-wallet-connect/src/lib/wallet-connect.ts`
2. Comment out manual verification (lines 626-661)
3. Add log: "Skipping manual verification, letting NEAR verify"
4. Rebuild: `npm run build:packages`
5. Test transaction

**Expected outcome:**
- No more "signature invalid" errors in console
- Transaction broadcasts to NEAR
- Either succeeds (signature was valid!) or NEAR rejects (signature actually invalid)

**This is the FASTEST way to test if our verification is the problem!**

---

### **Priority 2: Compare Transaction Bytes** (5 mins)

**Hypothesis:** Fireblocks re-serializes differently

**Steps:**
1. Add byte comparison logging
2. Check if original tx bytes == signed tx bytes (without signature)
3. If different, proves Borsh serialization mismatch

---

### **Priority 3: Use near-api-js Crypto** (30 mins)

**Hypothesis:** js-sha256 computes differently than near-api-js

**Steps:**
1. Remove js-sha256 import
2. Use `transaction.hash()` method from near-api-js
3. Compare results

---

### **Priority 4: Fresh Session** (5 mins)

From earlier research - still worth trying:
```javascript
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB');
```

---

## 💡 Key Insights

### **We Mixed Crypto Libraries!**

```typescript
// What we did:
import { sha256 } from "js-sha256";        // Browser SHA-256 library
import * as nearAPI from "near-api-js";    // Has its own crypto

// Then mixed them:
const hash = sha256.array(txBytes);        // js-sha256
const valid = publicKey.verify(hash, sig); // near-api-js
```

**This might be the bug!** Different libraries might compute hashes differently (padding, endianness, etc.)

### **near-api-js@0.44.2 is OLD**

- Released: 2022
- Current version: 5.0.1 (2024)
- 2+ years of updates, bug fixes, crypto improvements

Fireblocks probably uses a NEWER version, leading to incompatibilities.

---

## 🔬 Quick Test Script

Here's a one-line change to test Theory 1:

```typescript
// In proximity-wallet-connect/src/lib/wallet-connect.ts
// Find the signature verification block (around line 626)

// COMMENT OUT THE ENTIRE try/catch BLOCK:
/*
try {
  const txBytes = decoded.transaction.encode();
  const txHashBytes = new Uint8Array(sha256.array(txBytes));
  ...entire verification block...
} catch (verifyError) {
  ...
}
*/

// REPLACE WITH:
console.log(`   ⚠️  SKIPPING MANUAL VERIFICATION (testing crypto library theory)`);
console.log(`   📡 Broadcasting to NEAR - let NEAR verify the signature`);
```

**Then:**
```bash
cd /Users/grey/Documents/fork-wallet-selector
npm run build:packages
cd burrow-cash
npm run dev
# Try transaction
```

**If it works:** Our manual verification was the bug!  
**If NEAR still rejects:** Signature is actually invalid

---

## 📊 Likelihood Assessment

| Theory | Likelihood | Effort to Test |
|--------|-----------|----------------|
| Our manual verification is wrong | 40% | 15 mins |
| Fireblocks re-serializes differently | 30% | 5 mins (check logs) |
| js-sha256 vs near-api-js crypto mismatch | 20% | 30 mins |
| near-api-js version too old | 20% | High (risky) |
| Fresh session fixes it | 40% | 5 mins |

---

## 🏁 Bottom Line

**YOU'RE ABSOLUTELY RIGHT!** The crypto/SHA library situation is suspicious:

1. ✅ We ADDED `js-sha256` for manual verification
2. ✅ near-api-js@0.44.2 is 2+ years old
3. ✅ We're mixing crypto libraries
4. ✅ Fireblocks probably uses newer near-api-js

**Most likely culprit:** Our manual verification using `js-sha256` is computing the hash differently than near-api-js and NEAR expect.

**Simplest test:** Remove the manual verification entirely and just broadcast to NEAR. If NEAR accepts it, our verification was wrong. If NEAR rejects it, the signature is actually invalid.

**Let's test this NOW!** It's a 15-minute change that could solve everything.


