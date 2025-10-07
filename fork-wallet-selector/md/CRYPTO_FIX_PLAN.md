# 🔬 Crypto Library Fix Plan - Testing Signature Mismatch

**Created:** October 7, 2025  
**Goal:** Determine if the signature mismatch can be fixed on our end by fixing our crypto library usage

---

## 🎯 Core Theory

**YOU WERE RIGHT!** The problem might be that we're mixing crypto libraries:

```typescript
import { sha256 } from "js-sha256";        // ← WE ADDED THIS
import * as nearAPI from "near-api-js";    // ← Has its own crypto

// Then we mix them:
const hash = sha256.array(txBytes);        // js-sha256
const valid = publicKey.verify(hash, sig); // near-api-js
```

**The signature from Fireblocks might be VALID**, but our manual verification using a different crypto library might be WRONG.

---

## 🧪 Test Plan (In Priority Order)

### **Test 1: Remove Manual Verification Entirely** ⭐ **HIGHEST PRIORITY**

**Time:** 15 minutes  
**Likelihood of fixing issue:** 40%  
**Risk:** Low - easy to revert

#### Theory:
- Our js-sha256 verification is wrong
- Fireblocks' signature is actually VALID
- NEAR will verify correctly using standard crypto
- We just need to skip our manual check and trust Fireblocks

#### Implementation:

**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts`

**Find:** Lines ~626-661 (the manual signature verification block)

**Replace with:**
```typescript
// ⚠️ SKIPPING MANUAL VERIFICATION - TESTING CRYPTO LIBRARY THEORY
// Our manual verification using js-sha256 might compute hash differently than NEAR expects
// Fireblocks' signature might be valid, we're just checking it wrong
// Let NEAR blockchain do the verification with its standard crypto

console.log(`   ⚠️  TESTING: Skipping manual signature verification`);
console.log(`   💡 Theory: js-sha256 might compute differently than near-api-js`);
console.log(`   📡 Broadcasting to NEAR - let NEAR verify the signature`);
```

**Then rebuild:**
```bash
cd /Users/grey/Documents/fork-wallet-selector
npm run build:packages
cd burrow-cash
npm run dev
```

#### Expected Outcomes:

**✅ If this works (signature was valid all along):**
- No more signature verification errors in console
- Transaction broadcasts successfully
- NEAR accepts it and returns transaction hash
- **Conclusion:** Our manual verification was the bug, not Fireblocks

**❌ If this doesn't work (signature actually invalid):**
- Transaction broadcasts
- NEAR rejects with: "Transaction is not signed with the given public key"
- **Conclusion:** Fireblocks' signature is actually invalid, need to escalate

---

### **Test 2: Use near-api-js's Built-in Hash Method** ⭐ **MEDIUM PRIORITY**

**Time:** 30 minutes  
**Likelihood of fixing issue:** 25%  
**Risk:** Low

#### Theory:
- js-sha256 computes hash differently than near-api-js
- Should use near-api-js's own hashing method for consistency
- Keep the verification, but use consistent crypto library

#### Implementation:

**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts`

**Remove the js-sha256 import:**
```typescript
// REMOVE THIS LINE (around line 5-6):
// import { sha256 } from "js-sha256";
```

**Replace verification block (lines ~626-661):**
```typescript
try {
  console.log(`   🧪 TESTING: Using near-api-js crypto instead of js-sha256`);
  
  const txBytes = decoded.transaction.encode();
  
  // Try to use near-api-js's built-in hash method
  let txHash: Uint8Array;
  
  // Option A: Check if transaction has a hash() method
  if (typeof decoded.transaction.hash === 'function') {
    console.log(`      ✓ Using transaction.hash() method`);
    txHash = decoded.transaction.hash();
  } else {
    // Option B: Use near-api-js's crypto utilities
    console.log(`      ✓ Using near-api-js crypto utilities`);
    const crypto = require('near-api-js/lib/utils/key_pair');
    // If that doesn't work, we'll need to import differently
    
    // Fallback: Just try native crypto
    const nodeCrypto = require('crypto');
    txHash = new Uint8Array(nodeCrypto.createHash('sha256').update(txBytes).digest());
  }
  
  console.log(`      Transaction hash (hex):`, Buffer.from(txHash).toString('hex'));
  console.log(`      Signature (hex):`, Buffer.from(decoded.signature.data).toString('hex'));
  
  const isValid = decoded.transaction.publicKey.verify(
    txHash,
    decoded.signature.data
  );
  
  console.log(`      Signature valid: ${isValid ? '✅ YES' : '❌ NO'}`);
  
  if (!isValid) {
    console.error(`   ❌ SIGNATURE VERIFICATION FAILED!`);
    console.error(`   Even with near-api-js crypto, signature doesn't verify`);
  }
} catch (verifyError) {
  console.error(`   ⚠️  Verification error:`, verifyError);
}
```

#### Expected Outcomes:

**✅ If this works:**
- Signature verification passes
- Transaction broadcasts successfully
- **Conclusion:** js-sha256 was computing hash incorrectly

**❌ If this doesn't work:**
- Signature still fails verification
- Move to next test

---

### **Test 3: Compare Transaction Bytes Before/After** ⭐ **HIGH PRIORITY**

**Time:** 10 minutes  
**Likelihood of revealing issue:** 80% (diagnostic)  
**Risk:** None - just logging

#### Theory:
- Fireblocks might be re-serializing the transaction differently
- Different Borsh serialization = different bytes = different hash = invalid signature
- Check if bytes changed during Fireblocks signing

#### Implementation:

**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts`

**Add after decoding signed transaction (around line 593):**

```typescript
console.log(`   🔍 CRITICAL CHECK: Did Fireblocks change the transaction bytes?`);

// Original transaction bytes (what we sent)
const originalTxBytes = txs[idx].encode();

// Signed transaction bytes (what Fireblocks returned, minus signature)
const signedTxBytes = decoded.transaction.encode();

console.log(`      Original tx length:`, originalTxBytes.length);
console.log(`      Signed tx length:`, signedTxBytes.length);

const originalHex = Buffer.from(originalTxBytes).toString('hex');
const signedHex = Buffer.from(signedTxBytes).toString('hex');

const bytesMatch = originalHex === signedHex;

console.log(`      Bytes match: ${bytesMatch ? '✅ YES' : '❌ NO - FIREBLOCKS CHANGED THEM!'}`);

if (!bytesMatch) {
  console.error(`      ❌ TRANSACTION BYTES WERE MODIFIED BY FIREBLOCKS!`);
  console.error(`      This explains why the signature doesn't verify`);
  console.error(`      Fireblocks re-serialized differently (likely different near-api-js version)`);
  
  // Show differences
  console.error(`      Original (first 100 chars):`, originalHex.substring(0, 100));
  console.error(`      Signed   (first 100 chars):`, signedHex.substring(0, 100));
  
  // Find first difference
  for (let i = 0; i < Math.max(originalHex.length, signedHex.length); i++) {
    if (originalHex[i] !== signedHex[i]) {
      console.error(`      First difference at position ${i}:`);
      console.error(`         Original: ...${originalHex.substring(Math.max(0, i-10), i+10)}...`);
      console.error(`         Signed:   ...${signedHex.substring(Math.max(0, i-10), i+10)}...`);
      break;
    }
  }
}
```

#### Expected Outcomes:

**✅ If bytes match:**
- Transaction wasn't modified by Fireblocks
- The signature should be valid (but we're checking it wrong)
- Go back to Test 1 or Test 2

**❌ If bytes DON'T match:**
- Fireblocks is re-serializing the transaction
- This explains the signature mismatch
- Fireblocks is using a different version of near-api-js with different Borsh serialization
- **This is a Fireblocks issue, not fixable on our end**

---

### **Test 4: Upgrade near-api-js Version** ⚠️ **NUCLEAR OPTION**

**Time:** 2-3 hours  
**Likelihood of fixing issue:** 30%  
**Risk:** HIGH - might break other things

#### Theory:
- We're using near-api-js@0.44.2 (from 2022)
- Fireblocks probably uses near-api-js@2.x or newer
- Version mismatch causes Borsh serialization differences
- Upgrading might align our serialization with Fireblocks

#### Why Rhea pinned to 0.44.2:
Looking at the codebase, it was pinned for compatibility with the wallet selector ecosystem. But newer versions might work now.

#### Implementation:

**ONLY try this if Tests 1-3 don't work.**

**Step 1: Backup everything**
```bash
cd /Users/grey/Documents/fork-wallet-selector
git add .
git commit -m "Backup before near-api-js upgrade"
```

**Step 2: Try upgrading in burrow-cash first**
```bash
cd burrow-cash
npm install near-api-js@latest
npm run dev
```

**Step 3: Test extensively**
- Test all wallet types (not just Fireblocks)
- Test all transaction types
- Check for any console errors

#### Expected Outcomes:

**✅ If this works:**
- Fireblocks signatures verify correctly
- Other wallets still work
- **Conclusion:** Version mismatch was the issue

**❌ If this breaks things:**
- Other wallets stop working
- Revert: `npm install near-api-js@0.44.2`
- Stick with pinned version

---

## 🚀 Recommended Execution Order

### **Phase 1: Quick Wins (30 minutes total)**

1. **Start with Test 3** (10 mins) - Diagnostic logging
   - Add byte comparison logging
   - See if Fireblocks is changing the bytes
   - This tells us if the problem is fixable on our end

2. **Then Test 1** (15 mins) - Remove manual verification
   - Comment out js-sha256 verification
   - Let NEAR do the verification
   - See if transaction goes through

3. **Check results:**
   - If Test 1 works: **SOLVED!** Our verification was wrong
   - If Test 1 fails but Test 3 shows bytes match: Try Test 2
   - If Test 3 shows bytes DON'T match: Not fixable on our end

### **Phase 2: Deeper Fixes (if Phase 1 doesn't work)**

4. **Test 2** (30 mins) - Use near-api-js crypto
5. **Test 4** (2-3 hours) - Upgrade near-api-js (last resort)

---

## 📊 Decision Tree

```
Start Here
   ↓
Run Test 3 (byte comparison)
   ↓
   ├─→ Bytes MATCH?
   │      ↓
   │   Run Test 1 (remove verification)
   │      ↓
   │      ├─→ Works? ✅ SOLVED! (Our verification was wrong)
   │      └─→ Fails? Try Test 2 (use near-api-js crypto)
   │
   └─→ Bytes DON'T MATCH?
          ↓
       ❌ NOT FIXABLE ON OUR END
       Fireblocks is re-serializing differently
       Escalate to Fireblocks
```

---

## 💡 Why This Approach Makes Sense

### **We Have Evidence That:**

1. ✅ **WE added js-sha256** - not in original code
2. ✅ **near-api-js has its own crypto** - we're mixing libraries
3. ✅ **near-api-js@0.44.2 is OLD** - 2+ years behind
4. ✅ **Fireblocks probably uses newer version** - different serialization
5. ✅ **Timing matches** - broke ~1 week ago (Fireblocks update?)

### **The Most Likely Scenario:**

**Option A (40% probability):** 
- Fireblocks' signature is VALID
- Our js-sha256 verification computes hash differently
- If we skip our check, NEAR will accept it
- **Fix:** Test 1

**Option B (30% probability):**
- Fireblocks changed nothing
- Session expired and we need fresh connection
- **Fix:** Fresh session (already on todo list)

**Option C (20% probability):**
- Fireblocks re-serializes transactions with newer near-api-js
- Bytes change, signature is for different data
- **Not fixable on our end** - need Fireblocks to use same version

---

## 📋 Code Files to Modify

All changes in: `/Users/grey/Documents/fork-wallet-selector/proximity-wallet-connect/src/lib/wallet-connect.ts`

**Lines to focus on:**
- Line ~5-6: js-sha256 import
- Lines ~548-557: Transaction encoding (sent to Fireblocks)
- Lines ~570-593: Response decoding (received from Fireblocks)
- Lines ~626-661: Manual signature verification (the suspect code)

---

## 🎯 Success Criteria

### **We'll know Test 1 worked if:**
```
Console Output:
   ⚠️  TESTING: Skipping manual signature verification
   📡 Broadcasting to NEAR - let NEAR verify the signature
   ✅ Transaction #1 broadcast successfully
   Hash: 8kN3v2e5...

Result: Transaction completed successfully
```

### **We'll know it's not fixable on our end if:**
```
Console Output:
   🔍 CRITICAL CHECK: Did Fireblocks change the transaction bytes?
      Bytes match: ❌ NO - FIREBLOCKS CHANGED THEM!
      
Error from NEAR:
   ServerError: Transaction is not signed with the given public key
```

---

## 🚨 If All Tests Fail

Use the evidence you've gathered and escalate to Fireblocks with:

1. **Test 3 results** - Show if bytes were modified
2. **Test 1 results** - Show NEAR rejected even without our verification
3. **Concrete example** - Transaction hash, signature, public key
4. **Ask Fireblocks:**
   - What version of near-api-js do you use?
   - Do you re-serialize transactions after parsing?
   - Did you update your NEAR implementation recently?

---

## ⏱️ Time Estimate

- **Phase 1 (Tests 1 + 3):** 30 minutes
- **Phase 2 (Test 2):** 30 minutes
- **Phase 2 (Test 4):** 2-3 hours

**Total time investment:** 1-4 hours to definitively determine if it's fixable on your end.

---

## 🎓 What We'll Learn

After running these tests, you'll know **definitively**:

1. ✅ Whether your manual verification is wrong
2. ✅ Whether Fireblocks is changing transaction bytes
3. ✅ Whether the signature is actually valid or invalid
4. ✅ Whether this is fixable on your end or requires Fireblocks involvement

**No more guessing. Just data.** 🔬

---

**Ready to start with Test 1 + Test 3?** These two together should give you a clear answer in 30 minutes.

