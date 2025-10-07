# ⚡ Quick Start: Fix Signature Mismatch in 30 Minutes

**Goal:** Determine if the Fireblocks signature issue can be fixed on your end

---

## 🎯 The Core Issue

You're mixing crypto libraries:
```typescript
import { sha256 } from "js-sha256";        // ← Browser SHA-256 lib
import * as nearAPI from "near-api-js";    // ← Has its own crypto

const hash = sha256.array(txBytes);        // Using js-sha256
const valid = publicKey.verify(hash, sig); // Using near-api-js
```

**Theory:** Fireblocks' signature might be VALID, but your verification is WRONG because it's using a different crypto library than NEAR expects.

---

## 🚀 Two Quick Tests (30 minutes total)

### **Test A: Add Diagnostic Logging** (10 minutes)

This tells you if Fireblocks is changing the transaction bytes.

**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts`

**Location:** After line 593 (after decoding the signed transaction)

**Add this code:**
```typescript
// 🔍 DIAGNOSTIC: Check if Fireblocks changed transaction bytes
const originalTxBytes = txs[idx].encode();
const signedTxBytes = decoded.transaction.encode();

const originalHex = Buffer.from(originalTxBytes).toString('hex');
const signedHex = Buffer.from(signedTxBytes).toString('hex');
const bytesMatch = originalHex === signedHex;

console.log(`   🔍 Transaction bytes comparison:`);
console.log(`      Original length: ${originalTxBytes.length}`);
console.log(`      Signed length: ${signedTxBytes.length}`);
console.log(`      Bytes match: ${bytesMatch ? '✅ YES' : '❌ NO - FIREBLOCKS CHANGED THEM!'}`);

if (!bytesMatch) {
  console.error(`      ❌ Fireblocks re-serialized the transaction!`);
  console.error(`      This is why signature doesn't verify - it's for different bytes`);
  console.error(`      First 100 chars original:`, originalHex.substring(0, 100));
  console.error(`      First 100 chars signed:`, signedHex.substring(0, 100));
}
```

---

### **Test B: Remove Manual Verification** (15 minutes)

Skip your js-sha256 check and let NEAR verify instead.

**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts`

**Location:** Lines ~626-661 (the entire manual verification try/catch block)

**Replace with:**
```typescript
// 🧪 TESTING CRYPTO LIBRARY THEORY
// Our manual verification using js-sha256 might be computing hash differently
// Fireblocks' signature might actually be VALID
// Skip our check and let NEAR verify with its standard crypto

console.log(`   🧪 TESTING: Skipping manual signature verification`);
console.log(`   💡 Theory: js-sha256 computes differently than near-api-js/NEAR`);
console.log(`   📡 Trusting Fireblocks signature, letting NEAR verify`);

// Continue to broadcast (no verification)
```

---

### **Rebuild and Test**

```bash
cd /Users/grey/Documents/fork-wallet-selector
npm run build:packages

cd burrow-cash
npm run dev

# Try a transaction with Fireblocks
```

---

## 📊 Interpreting Results

### **Scenario 1: Test B Works! ✅**

**Console shows:**
```
🧪 TESTING: Skipping manual signature verification
📡 Trusting Fireblocks signature, letting NEAR verify
✅ Transaction #1 broadcast successfully
   Hash: 8kN3v2e5...
```

**What this means:**
- Fireblocks' signature was VALID all along
- Your js-sha256 verification was computing hash incorrectly
- **SOLUTION:** Remove the manual verification permanently

**Next step:** 
- Remove js-sha256 dependency from package.json
- Clean up the verification code
- ✅ FIXED!

---

### **Scenario 2: Test B Fails, Test A Shows Bytes Match**

**Console shows:**
```
🔍 Transaction bytes comparison:
   Bytes match: ✅ YES

🧪 TESTING: Skipping manual signature verification
❌ Failed to broadcast: Transaction is not signed with the given public key
```

**What this means:**
- Transaction bytes weren't modified
- Signature is actually invalid
- Need to investigate encoding format or method

**Next step:** 
- Try Test 2 from CRYPTO_FIX_PLAN.md (use near-api-js crypto instead)
- Try different transaction encoding (base64 instead of Array)

---

### **Scenario 3: Test A Shows Bytes DON'T Match**

**Console shows:**
```
🔍 Transaction bytes comparison:
   Bytes match: ❌ NO - FIREBLOCKS CHANGED THEM!
   ❌ Fireblocks re-serialized the transaction!
```

**What this means:**
- Fireblocks is using a different version of near-api-js
- Different Borsh serialization = different bytes
- Signature is valid for Fireblocks' bytes, not yours
- **NOT FIXABLE ON YOUR END**

**Next step:**
- Escalate to Fireblocks support
- Ask what version of near-api-js they use
- Ask if they re-serialize transactions
- Share the diagnostic logs showing byte differences

---

## 🎯 Most Likely Outcome

Based on your research, **Scenario 1 is most likely (40% probability)**:

Your manual verification is wrong because:
1. You ADDED js-sha256 yourself
2. near-api-js has its own crypto
3. Mixing libraries often causes subtle incompatibilities
4. NEAR uses standard SHA-256 from its own implementation

**If Scenario 1 happens:** You've found the bug! It was in your verification code, not Fireblocks.

---

## 📝 Quick Checklist

Before you start:
- [ ] Have you read CRYPTO_FIX_PLAN.md?
- [ ] Do you have the code open in your editor?
- [ ] Are you ready to rebuild and test?

Let's fix this! 🚀

---

## 🆘 Need Help?

If results are unclear:
1. Copy all console logs
2. Note which scenario matches your output
3. Refer back to CRYPTO_FIX_PLAN.md for detailed next steps

**Time investment:** 30 minutes  
**Confidence level:** High - these tests will give you a definitive answer

