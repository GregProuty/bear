# 🔍 WalletConnect Transaction Call Stack Analysis

## Complete Flow: Button Click → Fireblocks → NEAR Blockchain

### 1️⃣ **User Action** (`burrow-cash/screens/unstaking.tsx`)
```typescript
handleStake() → stakeNative()
```
**Purpose**: User clicks "Stake" button
**Status**: ✅ Working

---

### 2️⃣ **Transaction Preparation** (`burrow-cash/store/stake-native.ts`)
```typescript
stakeNative(amount, validatorAddress) {
  const transactions = [{
    receiverId: validatorAddress,  // "stardust.poolv1.near"
    functionCalls: [{
      methodName: "deposit_and_stake",
      args: {},
      gas: "100000000000000",
      attachedDeposit: amount.toString()
    }]
  }];
  
  return executeMultipleTransactions(transactions);
}
```
**Purpose**: Creates transaction object
**Status**: ✅ Working

---

### 3️⃣ **Transaction Execution** (`burrow-cash/store/wallet.ts:32-247`)
```typescript
executeMultipleTransactions(transactions) {
  // 1. Get burrow instance
  const { account, selector } = await getBurrow();
  
  // 2. Transform to selector format
  const selectorTransactions = transactions.map(t => ({
    signerId: account.accountId,  // "47e6c413ca116b49..."
    receiverId: t.receiverId,     // "stardust.poolv1.near"
    actions: [{ 
      type: "FunctionCall",
      params: {
        methodName: "deposit_and_stake",
        args: {},
        gas: "100000000000000",
        deposit: "1000000000000000000000000"
      }
    }]
  }));
  
  // 3. Get wallet and call signAndSendTransactions
  const wallet = await selector.wallet();  // wallet-connect
  const result = await wallet.signAndSendTransactions({ 
    transactions: selectorTransactions 
  });
  
  return result;
}
```
**Purpose**: Orchestrates wallet interaction
**Status**: ✅ Working

---

### 4️⃣ **Wallet Interface** (`node_modules/proximity-wallet-connect/dist/index.js:5264-5290`)
```javascript
// This is the wallet object's signAndSendTransactions method
signAndSendTransactions({ transactions }) {
  logger.log("🚀 PROXIMITY-WALLET-CONNECT v14 signAndSendTransactions called!");
  
  const { contract } = store.getState();
  const account = getActiveAccount(store.getState());
  
  if (!_state.session || !contract) {
    throw new Error("Wallet not signed in");
  }
  
  const resolvedTransactions = transactions.map(x => ({
    signerId: x.signerId || account.accountId,
    receiverId: x.receiverId,
    actions: x.actions
  }));
  
  // Call the helper function
  return await signAndSendViaWalletConnect(resolvedTransactions);
}
```
**Purpose**: Entry point for transaction signing
**Status**: ✅ Working
**Checks**:
- ✅ Session exists
- ✅ Contract exists
- ✅ Active account exists

---

### 5️⃣ **CRITICAL: Transaction Builder** (`index.js:4859-4908`)
```javascript
const signAndSendViaWalletConnect = async (transactions) => {
  const txs = [];
  
  // ⚠️ STEP A: Fetch FRESH public keys from Fireblocks
  console.log('🔑 Fetching FRESH account data from Fireblocks via near_getAccounts...');
  let accounts;
  let block;
  try {
    [block, accounts] = await Promise.all([
      provider.block({ finality: "final" }),
      _state.client.request({
        topic: _state.session.topic,
        chainId: getChainId(),
        request: {
          method: "near_getAccounts",  // ⚠️ NEW: Direct call to Fireblocks
          params: {}
        }
      })
    ]);
    console.log(`🔑 ✅ Received ${accounts.length} account(s) from Fireblocks via near_getAccounts`);
  } catch (error) {
    console.error('🔑 ❌ near_getAccounts failed:', error);
    console.log('🔑 ⚠️ Falling back to getAccounts() (may have stale keys)');
    [block, accounts] = await Promise.all([
      provider.block({ finality: "final" }),
      getAccounts()  // ⚠️ Fallback to local keystore
    ]);
  }
  
  // ⚠️ STEP B: Build transactions with public key
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    const account = accounts.find(x => x.accountId === transaction.signerId);
    
    if (!account || !account.publicKey) {
      throw new Error("Invalid signer id or missing public key");
    }
    
    console.log(`🔑 Building transaction #${i + 1} with publicKey: ${account.publicKey}`);
    
    // Fetch access key and nonce
    const accessKey = await provider.query({
      request_type: "view_access_key",
      finality: "final",
      account_id: transaction.signerId,
      public_key: account.publicKey  // ⚠️ CRITICAL: Must match Fireblocks key
    });
    
    // Create NEAR transaction
    txs.push(
      nearAPI.transactions.createTransaction(
        transaction.signerId,
        nearAPI.utils.PublicKey.from(account.publicKey),  // ⚠️ CRITICAL
        transaction.receiverId,
        accessKey.nonce + i + 1,
        transaction.actions.map(action => createAction(action)),
        nearAPI.utils.serialize.base_decode(block.header.hash)
      )
    );
  }
  
  // Continue to signing...
}
```
**Purpose**: Builds unsigned NEAR transactions
**Status**: ⚠️ **POTENTIAL ISSUE HERE**
**Critical Points**:
1. `near_getAccounts` must return account with correct public key
2. Public key must match what Fireblocks will use to sign
3. Access key query must succeed with this public key
4. If public key is wrong, transaction will be rejected after signing

---

### 6️⃣ **Send to Fireblocks** (`index.js:4909-4930`)
```javascript
console.log('🔥🔥🔥 WALLET-CONNECT VERSION: v6-FRESH-PUBLIC-KEY-FIX-2024-10-07 🔥🔥🔥');
console.log(`📤 Sending ${txs.length} transaction(s) to Fireblocks for signing via near_signTransactions`);

// Encode transactions
const encodedTxs = txs.map(x => Array.from(x.encode()));

// Request signatures from Fireblocks
const signedTxsEncoded = await _state.client.request({
  topic: _state.session.topic,
  chainId: getChainId(),
  request: {
    method: "near_signTransactions",  // ⚠️ Must be in session methods
    params: {
      transactions: encodedTxs
    }
  }
});

console.log(`✅✅✅ Received ${signedTxsEncoded.length} signed transaction(s) from Fireblocks`);
```
**Purpose**: Send unsigned transactions to Fireblocks for signing
**Status**: ✅ Working (when it reaches this point)
**Requirements**:
- ✅ Session must support `near_signTransactions` method
- ✅ Fireblocks must approve the transaction
- ✅ Response must be properly formatted

---

### 7️⃣ **Deserialize Signed Transactions** (`index.js:4934-4973`)
```javascript
const signedTxs = signedTxsEncoded.map((encoded, idx) => {
  console.log(`🔧 Processing transaction #${idx + 1}...`);
  
  // Handle Fireblocks Buffer serialization
  let arrayData;
  if (Array.isArray(encoded)) {
    arrayData = encoded;
  } else if (encoded && typeof encoded === 'object' && 
             encoded.type === 'Buffer' && Array.isArray(encoded.data)) {
    console.log(`   🔓 Detected Buffer object, extracting .data array`);
    arrayData = encoded.data;
  } else {
    arrayData = Array.from(encoded);
  }
  
  // Convert to Uint8Array then Buffer
  const bytes = Uint8Array.from(arrayData);
  const buffer = Buffer.from(bytes);
  
  // Deserialize
  const decoded = nearAPI.transactions.SignedTransaction.decode(buffer);
  console.log(`   ✅ Successfully decoded transaction #${idx + 1}`);
  
  return decoded;
});
```
**Purpose**: Deserialize signed transactions from Fireblocks
**Status**: ✅ Working (fixed Buffer handling)

---

### 8️⃣ **Broadcast to NEAR** (`index.js:4974-4990`)
```javascript
console.log(`📡 Broadcasting ${signedTxs.length} transaction(s) to NEAR...`);

const results = [];
for (let i = 0; i < signedTxs.length; i++) {
  const signedTx = signedTxs[i];
  try {
    const result = await provider.sendTransaction(signedTx);
    console.log(`✅ Transaction #${i + 1} broadcast successfully, hash: ${result.transaction.hash}`);
    results.push(result);
  } catch (error) {
    console.error(`❌ Failed to broadcast transaction #${i + 1}:`, error);
    throw error;
  }
}

return results;
```
**Purpose**: Broadcast signed transactions to NEAR blockchain
**Status**: ⚠️ **This is where "not signed with given public key" error occurs**

---

## 🚨 **IDENTIFIED ISSUES**

### **Issue #1: `near_getAccounts` might be failing silently**
**Location**: Step 5A
**Symptom**: Transactions not showing in Fireblocks
**Hypothesis**: 
- If `near_getAccounts` throws an error, it falls back to `getAccounts()`
- But the error is caught and logged, so execution continues
- **This might not be the issue if we're not seeing logs**

**Test**: Check if we see either:
- `🔑 ✅ Received X accounts via near_getAccounts` OR
- `🔑 ❌ near_getAccounts failed:` with fallback

---

### **Issue #2: Transaction never reaches step 6**
**Location**: Between step 5 and 6
**Symptom**: No transaction in Fireblocks = request never sent
**Possible causes**:
1. Error in step 5B (access key query fails)
2. Error in transaction building (createTransaction throws)
3. Code never reaches step 6

**Test**: Check if we see:
- `🔑 Building transaction #1 with publicKey: ...` 
- `🔥🔥🔥 WALLET-CONNECT VERSION: v6...`

---

### **Issue #3: Public key mismatch**
**Location**: Step 8
**Symptom**: "Transaction is not signed with the given public key"
**Root cause**: 
- Transaction built with public key `A`
- Fireblocks signs with public key `B`
- NEAR rejects because signatures don't match

**Test**: Compare:
- Public key used in step 5B: `console.log('🔑 Building transaction #1 with publicKey: ...')`
- Public key that signed the transaction (in the decoded SignedTransaction object)

---

## ✅ **NEXT STEPS**

### **1. Run transaction and capture ALL console logs**
Starting from clicking "Stake" button, copy EVERYTHING from console.

### **2. Check these specific logs**:
```
✅ Expected:
🔑 Fetching FRESH account data from Fireblocks via near_getAccounts...
🔑 ✅ Received 1 account(s) from Fireblocks via near_getAccounts
   Account #1: 47e6c413..., publicKey: ed25519:xxxxx
🔑 Building transaction #1 with publicKey: ed25519:xxxxx
🔥🔥🔥 WALLET-CONNECT VERSION: v6-FRESH-PUBLIC-KEY-FIX-2024-10-07 🔥🔥🔥
📤 Sending 1 transaction(s) to Fireblocks for signing via near_signTransactions

❌ Missing any of these = that's where the failure is!
```

### **3. If transaction reaches Fireblocks but fails broadcast**:
We need to add logging to compare:
- Public key used to build transaction
- Public key that actually signed it (from decoded SignedTransaction)

---

## 📊 **Call Stack Status Summary**

| Step | Component | Status | Logs to Check |
|------|-----------|--------|---------------|
| 1 | User Action | ✅ | `aloha top of stake native` |
| 2 | Prepare | ✅ | `aloha about to execute transactions` |
| 3 | Execute | ✅ | `aloha executeMultipleTransactions called` |
| 4 | Wallet Interface | ✅ | `🚀 PROXIMITY-WALLET-CONNECT v14` |
| 5A | Fetch Keys | ⚠️ | `🔑 Fetching FRESH account data` |
| 5B | Build Tx | ⚠️ | `🔑 Building transaction #1` |
| 6 | Send to FB | ⚠️ | `📤 Sending X transaction(s)` |
| 7 | Deserialize | ✅ | `✅ Successfully decoded` |
| 8 | Broadcast | ❌ | `❌ Failed to broadcast` |

