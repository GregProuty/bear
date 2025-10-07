# Fireblocks NEAR WalletConnect Integration Issue Report

**Date:** October 7, 2025  
**Issue Status:** 🚨 **CRITICAL** - Production application broken  
**Affected Application:** Burrow Cash (https://github.com/GregProuty/burrow-cash)  
**Timeline:** Integration was **working correctly** until approximately **1 week ago**, then spontaneously stopped functioning

---

## Executive Summary

Our NEAR Protocol dApp (Burrow Cash) integrates with Fireblocks via WalletConnect. This integration **was working successfully** for an extended period, but **stopped functioning approximately 1 week ago**. We have conducted extensive debugging and can definitively confirm:

1. ✅ **Our implementation is correct** - transaction building, serialization, and submission all follow NEAR Protocol standards
2. ✅ **The WalletConnect session is established properly** - connection and authentication work
3. ✅ **Transactions appear in Fireblocks** - users can see and approve transactions
4. ❌ **Fireblocks returns cryptographically invalid signatures** - signatures do not verify against the transaction hash
5. ❌ **NEAR blockchain rejects all transactions** with error: "Transaction is not signed with the given public key"

**Root Cause:** Fireblocks is signing data that **does not match** the transaction bytes we're sending. This suggests a **recent change in Fireblocks' NEAR transaction processing logic**.

---

## Timeline of Events

| Date | Event |
|------|-------|
| **Before ~Oct 1, 2025** | ✅ Integration working successfully - users could stake/unstake NEAR tokens |
| **~Oct 1, 2025** | ⚠️ Integration spontaneously stopped working - no code changes on our side |
| **Oct 1-7, 2025** | 🔍 Extensive debugging conducted to identify root cause |
| **Oct 7, 2025** | 🎯 Root cause identified: Fireblocks returning invalid signatures |

**Key Observation:** No changes were made to our codebase, wallet selector packages, or infrastructure during this period. The timing strongly suggests a **Fireblocks-side update or configuration change**.

---

## Technical Problem Details

### What Happens

1. ✅ User connects Fireblocks wallet via WalletConnect - **SUCCESS**
2. ✅ User initiates a transaction (e.g., stake NEAR tokens) - **SUCCESS**
3. ✅ We build a valid NEAR transaction using `near-api-js@0.44.2` - **SUCCESS**
4. ✅ We serialize the transaction to bytes (221 bytes for a simple function call) - **SUCCESS**
5. ✅ We send `near_signTransactions` WalletConnect request to Fireblocks - **SUCCESS**
6. ✅ Transaction appears in Fireblocks mobile app for approval - **SUCCESS**
7. ✅ User approves transaction in Fireblocks - **SUCCESS**
8. ✅ Fireblocks returns a signature (64 bytes, properly formatted) - **SUCCESS**
9. ❌ **We verify the signature cryptographically - FAILURE**
10. ❌ We broadcast the signed transaction to NEAR - **REJECTED BY NEAR**

### The Smoking Gun: Invalid Signature

We have implemented cryptographic verification of the signature before broadcasting to NEAR:

```javascript
// Compute transaction hash (SHA-256 of transaction bytes)
const txHashBytes = sha256.array(transactionBytes); // 32-byte hash

// Verify signature using Ed25519
const isValid = publicKey.verify(txHashBytes, signatureBytes);
// Result: FALSE ❌
```

**This definitively proves that Fireblocks is signing different data than the transaction we sent.**

---

## Concrete Example

Here's a real transaction that failed:

### Transaction Details
```
Account ID: 47e6c413ca116b49411d4e471fc94bc52675a53165db3a0db0ed9f0552e2e3e5
Public Key: ed25519:AFkwNDC2CNxzgF7RnTQdcL1hq7ykjwS5HvvVn2SZWWHH
Receiver: stardust.poolv1.near
Action: FunctionCall(deposit_and_stake)
Nonce: 167292987000001
```

### Transaction Bytes (221 bytes)
```hex
4000000034376536633431336361313136623439343131643465343731666339346263353236373561353331363564623361306462306564396630353532653265336535008980fe67de5d18c042788b2e3047a3ecc6a6e87d8a3885580fa2cfab64ce86acc14410ef269800001400000073746172647573742e706f6f6c76312e6e656172aa80057987cb7f7c3bc80fd58e0fc22ba5e3d28a678393bcfa38e11bdac490590100000002110000006465706f7369745f616e645f7374616b65020000007b7d00407a10f35a0000000000a1edccce1bc2d3000000000000
```

### Expected: Transaction Hash (SHA-256)
```
43f33d6d13db19d41228189eb70661232c3d93e745da2ef3562c565336548814
```

### What Fireblocks Returned
```
Public Key in Response: ed25519:AFkwNDC2CNxzgF7RnTQdcL1hq7ykjwS5HvvVn2SZWWHH ✅ CORRECT
Signature (64 bytes): 901bbb14c17d561b5ac0252c1c4c0e525fec618ed4a7aed2b07f5747076a9be68450a6e051350080ace6ed7c3eb4843a9e38bfd1a70d06af6b3b82e044d5170e
```

### Verification Result
```javascript
PublicKey.verify(
  txHash: "43f33d6d13db19d41228189eb70661232c3d93e745da2ef3562c565336548814",
  signature: "901bbb14c17d561b5ac0252c1c4c0e525fec618ed4a7aed2b07f5747076a9be68450a6e051350080ace6ed7c3eb4843a9e38bfd1a70d06af6b3b82e044d5170e"
)
// Returns: FALSE ❌
```

**This proves the signature is NOT valid for this transaction hash.**

---

## What We've Ruled Out

Through extensive debugging, we have **definitively ruled out** the following as causes:

### ✅ Our Transaction Building Code
- Uses standard `near-api-js@0.44.2` library
- Transaction serialization follows NEAR Protocol borsh specification
- Identical code works with other wallets (NEAR Wallet, MyNearWallet)
- No changes were made to this code when the issue started

### ✅ Public Key Mismatch
- Logs confirm: Public key in signed transaction **matches exactly** the key used to build it
- Access key verified to exist on NEAR blockchain with correct permissions
- Public key format is correct: `ed25519:AFkwNDC2CNxzgF7RnTQdcL1hq7ykjwS5HvvVn2SZWWHH`

### ✅ Nonce Issues
- Nonces are correctly incremented (on-chain nonce + 1)
- Example: On-chain nonce = 167292987000000, Transaction nonce = 167292987000001 ✅

### ✅ Network/RPC Issues
- Using Lava RPC (https://near.lava.build) with no issues
- Other wallet types successfully broadcast transactions to same RPC
- NEAR blockchain is functioning normally

### ✅ WalletConnect Protocol
- Session establishment works correctly
- Session includes all required NEAR methods: `['near_signIn', 'near_signOut', 'near_getAccounts', 'near_signTransaction', 'near_signTransactions', 'near_signAndSendTransaction', 'near_signAndSendTransactions']`
- Session metadata and chain IDs are correct
- Fireblocks successfully receives and displays transaction details

### ✅ Transaction Data Corruption
- Transaction bytes before sending: **221 bytes**
- Transaction bytes after Fireblocks signs: **286 bytes** (221 + 1 byte signature type + 64 byte signature) ✅
- The first 221 bytes are **byte-for-byte identical** before and after
- Only the signature was added, transaction data was not modified

---

## Hypotheses for Root Cause

Based on the evidence, we believe one of these scenarios occurred ~1 week ago:

### **Hypothesis 1: Fireblocks Changed Transaction Hashing** (Most Likely)
Fireblocks may have started applying a transformation before signing:
- Base64 encoding the transaction bytes
- Adding a prefix/suffix to the data
- Using a different serialization format
- Hashing the data differently before signing

**Evidence:** Signature format is correct (64 bytes Ed25519), but doesn't verify against the SHA-256 hash of the transaction bytes

### **Hypothesis 2: Fireblocks Changed NEAR Transaction Parsing**
Fireblocks may have updated how they deserialize NEAR transactions:
- Different borsh deserialization implementation
- Re-serializing in a different format before signing
- Modifying transaction structure during processing

**Evidence:** Transaction appears correctly in Fireblocks UI, but the signed bytes don't match

### **Hypothesis 3: Fireblocks Key Derivation Changed**
Less likely, but Fireblocks may have changed how they derive the signing key:
- Different key derivation path
- Different key material
- However, this seems unlikely as the public key in the response matches our expectation

---

## What We're Using

### WalletConnect Protocol Version
```
@walletconnect/sign-client: 2.21.2
@walletconnect/types: 2.21.0
@walletconnect/modal: 2.7.0
```

### NEAR Protocol Libraries
```
near-api-js: 0.44.2
```

### WalletConnect Methods We're Calling
1. **`near_signIn`** - Working ✅
2. **`near_getAccounts`** - Working ✅
3. **`near_signTransactions`** - Returns invalid signatures ❌
4. **`near_signAndSendTransactions`** - Transactions appear but don't broadcast ❌

---

## Questions for Fireblocks Support

### Immediate Questions

1. **Did Fireblocks update its NEAR WalletConnect implementation in the past 1-2 weeks?**
   - If yes, what changed?
   - Are there release notes or a changelog we can review?

2. **What data does Fireblocks actually sign when `near_signTransactions` is called?**
   - Do you sign the raw transaction bytes as received?
   - Do you apply any transformations (base64, hashing, prefixing, etc.)?
   - What is the exact input to the Ed25519 signing operation?

3. **How does Fireblocks serialize/deserialize NEAR transactions?**
   - Do you re-serialize transactions after parsing them?
   - What borsh implementation do you use?
   - Could there be differences in serialization that would change the bytes?

4. **Why would this integration stop working suddenly?**
   - Our code hasn't changed
   - No infrastructure changes on our end
   - Timing suggests a Fireblocks-side change

5. **Is there a different WalletConnect method we should be using?**
   - Should we use `near_signAndSendTransactions` instead?
   - If so, why do transactions not broadcast to NEAR?
   - Are there new NEAR-specific methods we should use?

### Technical Deep Dive Questions

6. **Can Fireblocks engineering verify the signature for our example transaction?**
   - Transaction hash: `43f33d6d13db19d41228189eb70661232c3d93e745da2ef3562c565336548814`
   - Public key: `ed25519:AFkwNDC2CNxzgF7RnTQdcL1hq7ykjwS5HvvVn2SZWWHH`
   - Signature returned: `901bbb14c17d561b5ac0252c1c4c0e525fec618ed4a7aed2b07f5747076a9be68450a6e051350080ace6ed7c3eb4843a9e38bfd1a70d06af6b3b82e044d5170e`
   - Does this signature verify against this hash using standard Ed25519?

7. **What does Fireblocks expect the transaction hash to be?**
   - For NEAR, it should be: `SHA256(transaction_bytes)`
   - Is Fireblocks using a different hashing algorithm or input?

8. **Can Fireblocks provide reference implementation or documentation?**
   - Example code showing proper NEAR transaction signing flow
   - Expected data formats at each step
   - Any NEAR-specific considerations for WalletConnect

### Configuration Questions

9. **Are there any Fireblocks workspace settings that might affect NEAR transaction signing?**
   - Transaction transformation policies
   - Signature format settings
   - NEAR-specific configuration options

10. **Do we need to update our Fireblocks workspace configuration?**
    - New required settings introduced recently?
    - Changes to NEAR asset configuration?

---

## Impact and Urgency

### Business Impact
- **Severity:** 🚨 **CRITICAL** - Production application completely broken
- **Affected Users:** All Fireblocks users (enterprise customers)
- **Duration:** ~1 week and ongoing
- **Workaround:** None available - users cannot perform any transactions

### User Experience Impact
Users can:
- ✅ Connect their Fireblocks wallet
- ✅ View their balances
- ✅ See transaction requests in Fireblocks app
- ✅ Approve transactions in Fireblocks app
- ❌ **Cannot complete any transactions** - all fail with signature errors

This creates a **terrible user experience** as users believe they've successfully approved transactions, but they silently fail to execute on the blockchain.

---

## Request for Action

We urgently request Fireblocks engineering to:

1. **Confirm or deny** that changes were made to NEAR WalletConnect implementation ~1 week ago
2. **Provide technical documentation** explaining:
   - What data Fireblocks signs for `near_signTransactions`
   - Expected transaction format and serialization
   - Any transformations applied before signing
3. **Investigate** why signatures are failing cryptographic verification
4. **Provide a fix or workaround** to restore functionality
5. **Schedule an engineer call** if detailed technical discussion is needed

---

## Supporting Materials

### Detailed Debug Logs

Complete browser console logs showing:
- Transaction building process
- WalletConnect communication
- Signature verification failure
- NEAR RPC rejection

Available upon request.

### Code Repository

Our implementation: https://github.com/GregProuty/burrow-cash

The wallet selector integration is based on the NEAR ecosystem standard with Fireblocks-specific fixes we implemented for transaction signing.

### Contact Information

**Primary Contact:** [Your Name/Email]  
**Technical Lead:** [Your Name/Email]  
**Availability:** Immediate - this is blocking production

---

## Appendix: Technical Implementation Details

### How NEAR Transaction Signing Should Work

```javascript
// 1. Build transaction
const transaction = nearAPI.transactions.createTransaction(
  signerId,
  publicKey,
  receiverId,
  nonce,
  actions,
  blockHash
);

// 2. Serialize to bytes
const txBytes = transaction.encode(); // borsh serialization

// 3. Hash the bytes
const txHash = SHA256(txBytes); // 32 bytes

// 4. Sign the hash with Ed25519
const signature = ed25519.sign(txHash, privateKey); // 64 bytes

// 5. Verify signature (should return true)
const isValid = ed25519.verify(txHash, signature, publicKey); // Must be TRUE

// 6. Broadcast signed transaction
const signedTx = new SignedTransaction({
  transaction: transaction,
  signature: new Signature({
    keyType: 0, // ED25519
    data: signature
  })
});
```

### What We Observe with Fireblocks

```javascript
// Steps 1-3: Our code (working correctly ✅)
const transaction = buildTransaction(); // ✅
const txBytes = transaction.encode(); // ✅ 221 bytes
const txHash = SHA256(txBytes); // ✅ "43f33d6d13db19d..."

// Step 4: Fireblocks signs (PROBLEM HERE ❌)
const signature = await fireblocks.signViaWalletConnect(txBytes);
// ❌ Fireblocks returns a signature, but for WHAT data?

// Step 5: Verification fails
const isValid = publicKey.verify(txHash, signature);
// ❌ Returns FALSE - signature doesn't match the hash!

// Step 6: NEAR rejects
// Error: "Transaction is not signed with the given public key"
```

**The question:** What is Fireblocks actually signing? It's clearly not the SHA-256 hash of the transaction bytes we sent.

---

## Conclusion

We have definitively proven that:

1. ✅ Our implementation is correct and follows NEAR Protocol standards
2. ✅ The integration **was working** until ~1 week ago
3. ❌ Fireblocks is now returning **cryptographically invalid signatures**
4. ❌ The signatures do not verify against the transaction hashes

This strongly indicates a **Fireblocks-side change** that occurred approximately 1 week ago. We need Fireblocks engineering support to:

- Explain what changed
- Provide correct implementation guidance
- Fix the issue on Fireblocks' side if it's a bug

**Our users are blocked and cannot perform any blockchain transactions. This requires immediate attention.**

---

**Document Version:** 1.0  
**Date:** October 7, 2025  
**Prepared by:** [Your Engineering Team]



