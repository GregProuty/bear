# Complete Call Stack Analysis: Stake Transaction to Fireblocks

**Goal:** Trace every step from UI button click to error, examining all transformations and identifying control points

---

## 📋 Call Stack Overview

```
1. UI Button Click (User stakes NEAR)
   ↓
2. stakeNative() - burrow-cash/store/actions/stake-native.ts
   ↓
3. executeMultipleTransactions() - burrow-cash/store/wallet.ts
   ↓
4. wallet.signAndSendTransactions() - @near-wallet-selector/core interface
   ↓
5. WalletConnect.signAndSendTransactions() - proximity-wallet-connect
   ↓
6. signAndSendViaWalletConnect() - proximity-wallet-connect (internal)
   ↓
7. Build NEAR transactions with near-api-js
   ↓
8. Serialize transactions to bytes (Borsh)
   ↓
9. Convert to Array and send to Fireblocks via WalletConnect
   ↓
10. User approves in Fireblocks app
   ↓
11. Fireblocks returns signed transaction
   ↓
12. Deserialize response (Buffer → SignedTransaction)
   ↓
13. Verify signature cryptographically ❌ FAILS HERE
   ↓
14. Broadcast to NEAR RPC
   ↓
15. NEAR rejects: "Transaction is not signed with the given public key"
```

---

## 🔍 Detailed Step-by-Step Analysis

### **Step 1: UI Button Click**
**File:** `burrow-cash/screens/Staking` (UI component)  
**User Action:** Clicks "Stake" button

**What happens:**
- User enters amount: e.g., "1 NEAR"
- Selects validator: e.g., "stardust.poolv1.near"
- Clicks stake button

**We control:** ✅ 100%

---

### **Step 2: stakeNative() Function**
**File:** `burrow-cash/store/actions/stake-native.ts:12-77`

```typescript
export async function stakeNative({ amount, validatorAddress }) {
  // Parse NEAR amount to yoctoNEAR
  const amountInYocto = nearAPI.utils.format.parseNearAmount(amount);
  // "1" → "1000000000000000000000000"
  
  const transactions = [{
    receiverId: validatorAddress,  // "stardust.poolv1.near"
    functionCalls: [{
      methodName: "deposit_and_stake",
      args: {},
      attachedDeposit: new BN(amountInYocto),  // BN object
    }],
  }];
  
  const result = await executeMultipleTransactions(transactions);
  return result;
}
```

**Transformations:**
- `amount: "1"` → `amountInYocto: "1000000000000000000000000"` (24 zeros)
- Amount wrapped in BN (Big Number) object
- Transaction object created with receiverId and functionCalls

**We control:** ✅ 100% - Our code, we can modify this format

**Potential issues:** ❌ None identified - Standard NEAR transaction format

---

### **Step 3: executeMultipleTransactions()**
**File:** `burrow-cash/store/wallet.ts:32-310`

```typescript
export const executeMultipleTransactions = async (transactions) => {
  const { account, selector } = await getBurrow();
  
  // Transform to wallet selector format
  const selectorTransactions: Array<SelectorTransaction> = transactions.map((t) => ({
    signerId: account.accountId,  // e.g., "user.near"
    receiverId: t.receiverId,     // "stardust.poolv1.near"
    actions: t.functionCalls.map(({ methodName, args, gas, attachedDeposit }) => ({
      type: "FunctionCall",
      params: {
        methodName,              // "deposit_and_stake"
        args,                    // {}
        gas: gas.toString(),     // "100000000000000"
        deposit: attachedDeposit.toString(),  // "1000000000000000000000000"
      },
    })),
  }));
  
  const wallet = await selector.wallet();
  const result = await wallet.signAndSendTransactions({
    transactions: selectorTransactions,
  });
  
  return result;
}
```

**Transformations:**
- Adds `signerId` (current user account)
- Wraps in `actions` array with `type: "FunctionCall"`
- Converts BN to string: `attachedDeposit.toString()`
- Converts gas to string

**We control:** ✅ 100% - Our burrow-cash code

**Potential issues:** ❌ None - Standard @near-wallet-selector format

---

### **Step 4: WalletConnect.signAndSendTransactions()**
**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts:1083-1108`

```typescript
async signAndSendTransactions({ transactions }) {
  logger.log("🚀 PROXIMITY-WALLET-CONNECT v14 signAndSendTransactions called!");
  
  const { contract } = store.getState();
  if (!_state.session || !contract) {
    throw new Error("Wallet not signed in");
  }
  
  const account = getActiveAccount(store.getState());
  if (!account) {
    throw new Error("No active account");
  }
  
  const resolvedTransactions = transactions.map((x) => ({
    signerId: x.signerId || account.accountId,
    receiverId: x.receiverId,
    actions: x.actions,
  }));
  
  return await signAndSendViaWalletConnect(resolvedTransactions);
}
```

**Transformations:**
- Validates session exists
- Ensures account is available
- Passes through to internal function

**We control:** ✅ 100% - Our proximity-wallet-connect package

**Potential issues:** ❌ None - Just routing

---

### **Step 5: signAndSendViaWalletConnect() - Transaction Building**
**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts:474-540`

```typescript
const signAndSendViaWalletConnect = async (transactions: Array<Transaction>): Promise<Array<providers.FinalExecutionOutcome>> => {
  console.log('🎯🎯🎯 signAndSendViaWalletConnect CALLED - v19 WITH IMPORTED SHA256! 🎯🎯🎯');
  
  const txs: Array<nearAPI.transactions.Transaction> = [];
  
  // Get latest block and accounts
  const [block, accounts] = await Promise.all([
    provider.block({ finality: "final" }),
    getAccounts()
  ]);
  
  for (let i = 0; i < transactions.length; i += 1) {
    const transaction = transactions[i];
    const account = accounts.find(x => x.accountId === transaction.signerId);
    
    // Get access key from NEAR blockchain
    const accessKey = await provider.query<AccessKeyView>({
      request_type: "view_access_key",
      finality: "final",
      account_id: transaction.signerId,
      public_key: account.publicKey,
    });
    
    // BUILD the transaction
    txs.push(
      nearAPI.transactions.createTransaction(
        transaction.signerId,              // "user.near"
        nearAPI.utils.PublicKey.from(account.publicKey),  // ed25519:ABC...
        transaction.receiverId,            // "stardust.poolv1.near"
        accessKey.nonce + i + 1,          // nonce from blockchain + 1
        transaction.actions.map((action) => createAction(action)),  // Convert to NEAR actions
        nearAPI.utils.serialize.base_decode(block.header.hash)     // Current block hash
      )
    );
  }
```

**Transformations:**
- Queries NEAR blockchain for:
  - Latest block hash
  - Access key and nonce for signer
- Builds `nearAPI.transactions.Transaction` object using:
  - `signerId`: Account sending transaction
  - `publicKey`: Public key from cached session
  - `receiverId`: Validator pool contract
  - `nonce`: Current nonce + 1
  - `actions`: Function call actions
  - `blockHash`: Recent block hash (for replay protection)

**We control:** ✅ 100% - Our code using near-api-js library

**Potential issues:**
- ⚠️ **Public key from cached session** - Could be stale if session changed
- ⚠️ **Nonce calculation** - Uses `accessKey.nonce + i + 1`

**Critical Detail:** The `publicKey` used here is from `getAccounts()` which returns cached session data, NOT fresh from Fireblocks.

---

### **Step 6: Transaction Serialization (Borsh)**
**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts:548-557`

```typescript
const encodedTxs = txs.map((x, idx) => {
  const encoded = x.encode();  // Call near-api-js encode() - uses Borsh
  console.log(`📦 Transaction #${idx + 1} BEFORE sending to Fireblocks:`);
  console.log(`   Length: ${encoded.length} bytes`);  // e.g., 221 bytes
  console.log(`   Full bytes:`, Buffer.from(encoded).toString('hex'));
  return Array.from(encoded);  // Convert Uint8Array to plain Array
});
```

**What `x.encode()` does:**
- Uses Borsh serialization (Binary Object Representation Serializer for Hashing)
- Serializes all transaction fields: signerId, receiverId, publicKey, nonce, actions, blockHash
- Returns `Uint8Array` (e.g., 221 bytes for simple function call)

**Transformation:**
- `nearAPI.transactions.Transaction` object
  ↓
- Borsh serialization
  ↓
- `Uint8Array` of bytes (221 bytes)
  ↓
- Plain JavaScript `Array` of numbers `[64, 0, 0, 0, 52, 55, ...]`

**We control:** ⚠️ **Partial**
- ✅ We control: Conversion to Array vs Uint8Array vs base64 vs hex
- ❌ We don't control: Borsh serialization (handled by near-api-js)

**Potential issues:**
- ⚠️ **Format Fireblocks expects** - No documentation on whether it should be Array, Uint8Array, base64, or hex
- ✅ **Borsh serialization** - Standard, should be correct

**🎯 CONTROL POINT #1: We can try different encodings here!**
- Current: `Array.from(encoded)` → `[64, 0, 0, 0, ...]`
- Alternative: `Buffer.from(encoded).toString('base64')` → `"QAA..."`
- Alternative: `Buffer.from(encoded).toString('hex')` → `"40000000..."`
- Alternative: Keep as `Uint8Array`

---

### **Step 7: Send to Fireblocks via WalletConnect**
**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts:561-568`

```typescript
const signedTxsEncoded = await _state.client.request<Array<any>>({
  topic: _state.session!.topic,
  chainId: getChainId(),  // "near:mainnet" or "near:testnet"
  request: {
    method: "near_signTransactions",  // ← Fireblocks method
    params: { transactions: encodedTxs },  // ← Our encoded transactions
  },
});
```

**What happens:**
1. WalletConnect client encrypts the request with symmetric key
2. Sends encrypted message to WalletConnect relay server
3. Relay forwards to Fireblocks
4. Fireblocks decrypts and parses the request
5. **Fireblocks displays transaction in mobile app for approval**

**We control:** ⚠️ **Partial**
- ✅ We control: Method name (`near_signTransactions` vs `near_signAndSendTransactions`)
- ✅ We control: Chain ID (`near:mainnet` vs `near:testnet`)
- ✅ We control: Transaction encoding format (from Step 6)
- ❌ We don't control: WalletConnect encryption/transmission
- ❌ We don't control: Fireblocks parsing/interpretation

**Potential issues:**
- ⚠️ **Method choice** - Should we use `near_signAndSendTransactions` instead?
- ⚠️ **Chain ID format** - Must be native format ("near:mainnet"), not CASA
- ⚠️ **Session methods** - Session must include this method in allowed methods

**🎯 CONTROL POINT #2: We can try `near_signAndSendTransactions` instead!**
- Current: `near_signTransactions` (sign only, we broadcast)
- Alternative: `near_signAndSendTransactions` (Fireblocks signs AND broadcasts)

---

### **Step 8: User Approval in Fireblocks**
**Location:** Fireblocks mobile app  
**Duration:** 10-60 seconds (depending on user)

**What user sees:**
- Transaction details:
  - From: user.near
  - To: stardust.poolv1.near  
  - Method: deposit_and_stake
  - Amount: 1 NEAR
- Approval buttons: Approve / Reject

**User action:** Taps "Approve"

**We control:** ❌ 0% - This is entirely in Fireblocks' hands

**What Fireblocks does (INTERNAL - We don't control):**
1. Deserializes the transaction bytes
2. Extracts: signerId, receiverId, publicKey, nonce, actions, blockHash
3. **Signs the transaction with the private key for that public key**
4. Re-serializes with signature added
5. Returns signed transaction bytes

**Potential issues (Fireblocks-side):**
- ❌ If Fireblocks deserializes incorrectly
- ❌ If Fireblocks re-serializes differently (changes byte order, adds/removes fields)
- ❌ If Fireblocks signs with wrong private key
- ❌ If Fireblocks signs wrong data (e.g., base64-encoded string instead of raw bytes)

---

### **Step 9: Receive Response from Fireblocks**
**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts:570-591`

```typescript
console.log(`✅ Received ${signedTxsEncoded.length} signed transaction(s) from Fireblocks`);
console.log(`🔍 First signed tx type:`, typeof signedTxsEncoded[0]);

const signedTxs: Array<nearAPI.transactions.SignedTransaction> = signedTxsEncoded.map((encoded, idx) => {
  console.log(`🔧 Decoding transaction #${idx + 1}...`);
  
  let arrayData: number[];
  if (Array.isArray(encoded)) {
    arrayData = encoded;
  } else if (encoded && typeof encoded === 'object' && encoded.type === 'Buffer' && Array.isArray(encoded.data)) {
    // Fireblocks returns serialized Buffer: {type: "Buffer", data: [...]}
    arrayData = encoded.data;
  } else {
    arrayData = Array.from(encoded as any);
  }
  
  // Convert to Node.js Buffer for BinaryReader
  const buffer = Buffer.from(arrayData);
  
  const decoded = nearAPI.transactions.SignedTransaction.decode(buffer);
  return decoded;
});
```

**What Fireblocks returns:**
- Format observed: `{type: "Buffer", data: [64, 0, 0, 0, ...]}`
- Length: 286 bytes (221 bytes transaction + 1 byte signature type + 64 bytes signature)

**Transformation:**
1. Extract data array from Buffer object
2. Convert to Node.js Buffer
3. Deserialize with `SignedTransaction.decode()`

**We control:** ✅ 100% - Deserialization logic is our code

**Potential issues:**
- ⚠️ **Response format** - Fireblocks could return different format (base64, hex, plain array)
- ✅ **Deserialization** - Using standard near-api-js method

**🎯 CONTROL POINT #3: We handle different response formats!**
- Current: Handles Buffer object, Array, and fallback
- Could add: base64 decoding, hex decoding if needed

---

### **Step 10: Signature Verification**
**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts:626-661`

```typescript
// CRITICAL: Manually verify the signature
const txBytes = decoded.transaction.encode();  // Re-serialize transaction part
const txHashBytes = new Uint8Array(sha256.array(txBytes));  // SHA-256 hash
  
console.log(`   🔐 MANUAL SIGNATURE VERIFICATION:`);
console.log(`      Transaction bytes length:`, txBytes.length);
console.log(`      Transaction hash (hex):`, Buffer.from(txHashBytes).toString('hex'));
console.log(`      Public key (base58):`, decoded.transaction.publicKey.toString());
console.log(`      Signature (hex):`, Buffer.from(decoded.signature.data).toString('hex'));
  
// Verify using near-api-js PublicKey.verify()
const isValid = decoded.transaction.publicKey.verify(
  txHashBytes,        // 32-byte SHA-256 hash of transaction
  decoded.signature.data  // 64-byte Ed25519 signature
);

console.log(`      Signature valid: ${isValid ? '✅ YES' : '❌ NO - INVALID!'}`);
```

**What this does:**
1. Re-serializes the transaction part (without signature)
2. Computes SHA-256 hash of transaction bytes
3. Verifies Ed25519 signature using:
   - Hash: SHA-256 of transaction
   - Signature: 64 bytes from Fireblocks
   - Public Key: From transaction

**Expected:** `isValid = true` (signature verifies)  
**Actual:** `isValid = false` ❌ **SIGNATURE IS INVALID**

**We control:** ❌ 0% - This is pure cryptography
- Can't change: Transaction hash (deterministic from transaction bytes)
- Can't change: Signature (came from Fireblocks)
- Can't change: Verification algorithm (standard Ed25519)

**What this means:**
```
Fireblocks returned signature: 901bbb14c17d561b5ac0252c1c4c0e525fec618ed4a7aed2b07f5747076a9be68450a6e051350080ace6ed7c3eb4843a9e38bfd1a70d06af6b3b82e044d5170e

Transaction hash: 43f33d6d13db19d41228189eb70661232c3d93e745da2ef3562c565336548814

Public key: ed25519:AFkwNDC2CNxzgF7RnTQdcL1hq7ykjwS5HvvVn2SZWWHH

Ed25519.verify(hash, signature, publicKey) = FALSE ❌
```

**This definitively proves:** Fireblocks is signing DIFFERENT data than the transaction bytes we sent.

**Possible causes (Fireblocks-side):**
1. ❌ Fireblocks is signing base64-encoded transaction string instead of raw bytes
2. ❌ Fireblocks is signing hex-encoded transaction string
3. ❌ Fireblocks is re-serializing transaction differently (different byte order, extra fields)
4. ❌ Fireblocks is signing with wrong private key
5. ❌ Fireblocks' Ed25519 implementation has a bug

**We control:** ❌ 0% - We cannot fix an invalid signature

---

### **Step 11: Broadcast to NEAR**
**File:** `proximity-wallet-connect/src/lib/wallet-connect.ts:706-716`

```typescript
try {
  const result = await provider.sendTransaction(signedTx);
  console.log(`   ✅ Transaction #${i + 1} broadcast successfully`);
  results.push(result);
} catch (error: any) {
  console.error(`   ❌ Failed to broadcast:`, error.message);
  throw error;
}
```

**What happens:**
1. Sends signed transaction to NEAR RPC: `https://near.lava.build`
2. NEAR node receives transaction
3. NEAR node verifies:
   - ✅ Transaction format is valid
   - ✅ Access key exists on-chain
   - ❌ **Signature verification FAILS**

**NEAR error:**
```
ServerError: Transaction is not signed with the given public key
```

**We control:** ❌ 0% - NEAR node does the verification

**Why NEAR rejects:**
- NEAR re-computes SHA-256 hash of transaction bytes
- NEAR verifies Ed25519 signature using public key
- Signature doesn't verify → rejection

---

## 📊 Summary: What We Can Control

| Step | Component | We Control? | Can We Fix? |
|------|-----------|------------|-------------|
| 1 | UI Button Click | ✅ 100% | N/A |
| 2 | stakeNative() | ✅ 100% | ✅ Could change transaction format |
| 3 | executeMultipleTransactions() | ✅ 100% | ✅ Could change selector format |
| 4 | WalletConnect.signAndSendTransactions() | ✅ 100% | ✅ Could change routing |
| 5 | Build transactions | ✅ 100% | ⚠️ Using standard near-api-js |
| 6 | **Serialize to bytes** | ⚠️ **50%** | ✅ **Can try different encodings** |
| 7 | **Send to Fireblocks** | ⚠️ **50%** | ✅ **Can try different methods** |
| 8 | Fireblocks signing | ❌ 0% | ❌ **Fireblocks internal** |
| 9 | Receive response | ✅ 100% | ✅ Can handle different formats |
| 10 | **Signature verification** | ❌ **0%** | ❌ **Pure cryptography** |
| 11 | Broadcast to NEAR | ❌ 0% | ❌ NEAR node verification |

---

## 🎯 What We CAN Try (Control Points)

### **Control Point #1: Transaction Encoding Format**
**Location:** Step 6 - `proximity-wallet-connect/src/lib/wallet-connect.ts:548-557`

**Current:**
```typescript
return Array.from(encoded);  // [64, 0, 0, 0, ...]
```

**Alternatives to try:**
```typescript
// Option A: Base64 string
return Buffer.from(encoded).toString('base64');  // "QAA..."

// Option B: Hex string
return Buffer.from(encoded).toString('hex');  // "40000000..."

// Option C: Keep as Uint8Array
return encoded;  // Uint8Array {64, 0, 0, 0, ...}

// Option D: Node.js Buffer
return Buffer.from(encoded);  // <Buffer 40 00 00 00 ...>
```

**Likelihood:** 20% - Fireblocks might expect base64

---

### **Control Point #2: WalletConnect Method**
**Location:** Step 7 - `proximity-wallet-connect/src/lib/wallet-connect.ts:565`

**Current:**
```typescript
method: "near_signTransactions",
```

**Alternative:**
```typescript
method: "near_signAndSendTransactions",  // Let Fireblocks broadcast too
```

**Why try this:**
- Maybe Fireblocks' `near_signTransactions` is broken
- But `near_signAndSendTransactions` works
- Fireblocks would sign AND broadcast, we just wait for result

**Likelihood:** 30% - Worth trying, takes 30 mins

---

### **Control Point #3: Public Key Source**
**Location:** Step 5 - `proximity-wallet-connect/src/lib/wallet-connect.ts:489`

**Current:**
```typescript
const accounts = await getAccounts();  // Uses cached session data
const account = accounts.find(x => x.accountId === transaction.signerId);
const publicKey = account.publicKey;  // Cached public key
```

**Alternative:**
```typescript
// Fetch fresh public key from Fireblocks via near_getAccounts
const freshAccounts = await _state.client.request({
  topic: _state.session!.topic,
  chainId: getChainId(),
  request: {
    method: "near_getAccounts",
    params: {},
  },
});
const publicKey = freshAccounts[0].publicKey;  // Fresh from Fireblocks
```

**Problem:** We already tried this and it caused a 5-second delay that broke transaction display in Fireblocks.

**Likelihood:** 5% - Already attempted

---

### **Control Point #4: Fresh WalletConnect Session**
**Location:** Browser storage

**Action:**
```javascript
// Clear all WalletConnect data
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB');

// Refresh page
// Reconnect Fireblocks
// Try transaction
```

**Why:**
- Sessions expire after 7 days
- New session might have different permissions
- New session gets fresh methods list

**Likelihood:** 40% - Most likely to work, matches timeline

---

### **Control Point #5: Network Configuration**
**Location:** Multiple places

**Check:**
1. `burrow-cash/.env`: `NEXT_PUBLIC_DEFAULT_NETWORK=mainnet`
2. Fireblocks workspace: Mainnet or testnet?
3. WalletConnect chain ID: `"near:mainnet"` or `"near:testnet"`?

**All three MUST match.**

**Likelihood:** 25% - Quick to verify

---

## ❌ What We CANNOT Fix

### **The Signature Is Invalid (Step 10)**

**Fact:** The signature Fireblocks returns does NOT verify using standard Ed25519.

```
PublicKey.verify(transactionHash, signature) = FALSE ❌
```

**This means:**
- Either Fireblocks signed different data (wrong input)
- Or Fireblocks used wrong private key
- Or Fireblocks' Ed25519 implementation is broken

**We cannot:**
- ❌ Change the signature (it comes from Fireblocks)
- ❌ Change the transaction hash (it's deterministic from transaction bytes)
- ❌ Skip signature verification (NEAR node does it too)
- ❌ "Fix" an invalid signature

**This is a Fireblocks issue, not our code.**

---

## 🎯 Action Plan: What to Try

### **Priority 1: Fresh Session (5 mins)**
**Likelihood:** 40%  
**Effort:** 5 minutes

```bash
# In browser console:
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB');

# Refresh page, reconnect, try transaction
```

---

### **Priority 2: Network Match (5 mins)**
**Likelihood:** 25%  
**Effort:** 5 minutes

Verify all three match:
- burrow-cash network setting
- Fireblocks workspace network
- WalletConnect chain ID

---

### **Priority 3: Try near_signAndSendTransactions (30 mins)**
**Likelihood:** 30%  
**Effort:** 30 minutes

Change method from `near_signTransactions` to `near_signAndSendTransactions`.

---

### **Priority 4: Try Base64 Encoding (30 mins)**
**Likelihood:** 20%  
**Effort:** 30 minutes

Change transaction encoding from Array to base64 string.

---

### **Priority 5: Deploy for Admin Testing (1-2 hours)**
**Likelihood:** 10% (permission issue)  
**Effort:** 1-2 hours

Publish to npm, deploy to production, have admin coworker test.

---

## 🏁 Bottom Line

### **What We CAN Control:**
1. ✅ Transaction encoding format (Array vs base64 vs hex)
2. ✅ WalletConnect method (signTransactions vs signAndSendTransactions)
3. ✅ Session freshness (clear and reconnect)
4. ✅ Network configuration (verify match)

### **What We CANNOT Fix:**
1. ❌ Invalid signature from Fireblocks
2. ❌ Fireblocks' internal signing logic
3. ❌ NEAR node's signature verification

### **The Root Cause:**
**Fireblocks is returning a cryptographically invalid signature.**

The signature does NOT verify using standard Ed25519 verification with the transaction hash and public key. This definitively proves that Fireblocks is signing different data than the transaction bytes we're sending.

### **Is there TRULY nothing we can do?**

**We can try 4 things:**
1. Fresh session (might have fixed permissions/methods)
2. Different encoding (might match what Fireblocks expects)
3. Different method (signAndSendTransactions might work better)
4. Admin testing (rule out permission issues)

**But if all 4 fail:** No, there's nothing more we can do. The signature verification failure is mathematical proof that Fireblocks is doing something wrong on their side.

---

**Recommendation:** Try all 4 priorities in order. If they all fail, escalate to Fireblocks with technical evidence.


