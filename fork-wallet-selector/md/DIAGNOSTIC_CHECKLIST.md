# Diagnostic Checklist: What Can We Control?

**Goal:** Determine if there's anything we can change on our end to make Fireblocks work, before concluding it's entirely their issue.

---

## 🔍 Test Scenarios to Try

### **Scenario 1: Fireblocks Account Permissions/Policies** ⭐ **HIGH PRIORITY**

**Hypothesis:** Your specific Fireblocks account may have transaction policies or restrictions that an admin account doesn't have.

#### What to Test:
1. **Different Fireblocks account** - Have your coworker (with admin privileges) try the exact same flow
2. **Check Fireblocks policies** - Look in Fireblocks dashboard for:
   - Transaction approval policies
   - Signing policies for NEAR transactions
   - Any policy changes from ~1 week ago

#### How to Test:
```bash
# Your coworker should:
1. Open Fireblocks mobile app
2. Disconnect your current WalletConnect session (if connected)
3. Connect their admin Fireblocks account to burrow-cash
4. Try to stake/unstake NEAR
5. Compare the logs - especially the signature verification
```

#### What to Look For:
- ✅ **If admin account works:** It's a policy/permission issue on your account
- ❌ **If admin account also fails:** It's not account-specific

---

### **Scenario 2: WalletConnect Request Format** ⭐ **HIGH PRIORITY**

**Hypothesis:** We might be sending the transaction in the wrong format to Fireblocks.

#### Current Implementation:
```javascript
// We send as plain Array
const encodedTxs = txs.map(x => Array.from(x.encode()));

const signedTxsEncoded = await _state.client.request({
  topic: _state.session!.topic,
  chainId: getChainId(),
  request: {
    method: "near_signTransactions",
    params: { transactions: encodedTxs },  // Array of number[]
  },
});
```

#### Alternative Formats to Try:

**Option A: Send as Base64 String**
```javascript
const encodedTxs = txs.map(x => Buffer.from(x.encode()).toString('base64'));
```

**Option B: Send as Hex String**
```javascript
const encodedTxs = txs.map(x => Buffer.from(x.encode()).toString('hex'));
```

**Option C: Send as Uint8Array (not plain Array)**
```javascript
const encodedTxs = txs.map(x => x.encode()); // Keep as Uint8Array
```

**Option D: Send with explicit encoding metadata**
```javascript
const encodedTxs = txs.map(x => ({
  encoding: 'base64',
  data: Buffer.from(x.encode()).toString('base64')
}));
```

---

### **Scenario 3: Use `near_signAndSendTransactions` Instead** ⭐ **MEDIUM PRIORITY**

**Hypothesis:** Maybe Fireblocks fixed their broadcast logic but broke their sign-only logic.

#### What to Test:
```javascript
// Instead of near_signTransactions, try near_signAndSendTransactions
const result = await _state.client.request({
  topic: _state.session!.topic,
  chainId: getChainId(),
  request: {
    method: "near_signAndSendTransactions",  // Changed from near_signTransactions
    params: { transactions: encodedTxs },
  },
});

// Fireblocks should sign AND broadcast
// We just wait for the result
```

#### Why This Might Work:
- Before, `near_signAndSendTransactions` showed transactions in Fireblocks but didn't broadcast
- If Fireblocks updated their implementation, this might now work correctly
- Worth trying even though it didn't work before

---

### **Scenario 4: Response Format Issues** ⭐ **MEDIUM PRIORITY**

**Hypothesis:** Maybe we're misinterpreting what Fireblocks returns.

#### Current Assumption:
```javascript
// We assume Fireblocks returns SignedTransaction bytes
const signedTx = SignedTransaction.decode(Buffer.from(response));
```

#### Alternative Interpretations:

**Option A: Fireblocks returns just the signature (not full SignedTransaction)**
```javascript
// Maybe response is just the 64-byte signature?
const signature = Buffer.from(response);

// We need to construct SignedTransaction ourselves
const signedTx = new SignedTransaction({
  transaction: originalTransaction,
  signature: new Signature({ keyType: 0, data: signature })
});
```

**Option B: Fireblocks returns signature in different format**
```javascript
// Maybe signature needs to be decoded from base64 or hex?
const signature = Buffer.from(response, 'base64');
// or
const signature = Buffer.from(response, 'hex');
```

---

### **Scenario 5: Check WalletConnect Session Methods** ⭐ **LOW PRIORITY**

**Hypothesis:** The session might not have the correct methods enabled.

#### What to Check:
```javascript
// In browser console, check:
const session = _state.session;
console.log('Session methods:', session.namespaces.near.methods);

// Expected:
// ['near_signIn', 'near_signOut', 'near_getAccounts', 
//  'near_signTransaction', 'near_signTransactions',
//  'near_signAndSendTransaction', 'near_signAndSendTransactions']
```

#### If Methods Missing:
```javascript
// When establishing connection, explicitly request methods:
await connector.connect({
  requiredNamespaces: {
    near: {
      methods: [
        'near_signIn',
        'near_signOut', 
        'near_getAccounts',
        'near_signTransactions',
        'near_signAndSendTransactions'
      ],
      chains: ['near:mainnet', 'near:testnet'],
      events: []
    }
  }
});
```

---

### **Scenario 6: Transaction Nonce Issues** ⭐ **LOW PRIORITY**

**Hypothesis:** Maybe nonce calculation is wrong, causing signature mismatch.

#### What to Check:
```javascript
// Current nonce logic
const accessKey = await provider.query({
  request_type: "view_access_key",
  finality: "final",
  account_id: signerId,
  public_key: publicKey,
});

const nonce = accessKey.nonce + 1; // Is this correct?
```

#### Alternative Nonce Logic:
```javascript
// Try nonce without increment if we're signing multiple txs
for (let i = 0; i < transactions.length; i++) {
  const nonce = accessKey.nonce + i + 1; // Changed
  // Build transaction with this nonce
}
```

---

### **Scenario 7: Different Public Key Format** ⭐ **LOW PRIORITY**

**Hypothesis:** Maybe Fireblocks expects public key in different format.

#### Current Format:
```javascript
const publicKey = "ed25519:AFkwNDC2CNxzgF7RnTQdcL1hq7ykjwS5HvvVn2SZWWHH";
```

#### Alternative Formats:
```javascript
// Raw base58 (without ed25519: prefix)
const publicKey = "AFkwNDC2CNxzgF7RnTQdcL1hq7ykjwS5HvvVn2SZWWHH";

// Hex format
const publicKey = "0x...";

// Array format
const publicKey = [0x00, 0x19, ...];
```

---

## 🧪 Systematic Testing Plan

### Phase 1: Account Permissions (DO THIS FIRST)
1. [ ] Have admin coworker try exact same flow
2. [ ] Check Fireblocks dashboard for policies
3. [ ] Check for recent policy changes (~1 week ago)

**If admin account works:** Focus on permission differences  
**If admin account fails:** Continue to Phase 2

---

### Phase 2: Try `near_signAndSendTransactions`
1. [ ] Modify code to use `near_signAndSendTransactions`
2. [ ] Test transaction flow
3. [ ] Check if transaction broadcasts to NEAR

**If this works:** Use this method going forward  
**If this fails:** Continue to Phase 3

---

### Phase 3: Transaction Format Testing
Test different encoding formats:

1. [ ] Base64 encoding
2. [ ] Hex encoding  
3. [ ] Keep as Uint8Array (don't convert to Array)
4. [ ] Add encoding metadata

**For each format:**
- Modify `wallet-connect.ts`
- Rebuild packages (`npm run build:packages`)
- Test transaction
- Check logs for signature verification

---

### Phase 4: Response Handling
1. [ ] Log raw response from Fireblocks
2. [ ] Try different deserialization approaches
3. [ ] Check if response is just signature vs full SignedTransaction

---

## 🛠️ Quick Test: Admin Account

**HIGHEST PRIORITY - Do this first!**

### Steps for Admin Coworker:

1. **Disconnect current session:**
   ```javascript
   // In browser console on burrow-cash:
   localStorage.clear();
   sessionStorage.clear();
   
   // Also clear IndexedDB
   indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB');
   ```

2. **Refresh page and reconnect:**
   - Connect with admin Fireblocks account
   - Try to stake/unstake
   - Watch console for logs

3. **Key Logs to Compare:**
   ```
   Look for:
   - "🔐 MANUAL SIGNATURE VERIFICATION:"
   - "Signature valid: ✅ YES" vs "❌ NO"
   ```

4. **Share Results:**
   - If ✅ YES → It's a permission/policy issue
   - If ❌ NO → It's a deeper Fireblocks implementation issue

---

## 📊 Results Tracking

| Scenario | Tested? | Result | Notes |
|----------|---------|--------|-------|
| Admin Account | ⬜ | ? | Most likely to help |
| `near_signAndSendTransactions` | ⬜ | ? | Quick to test |
| Base64 encoding | ⬜ | ? | - |
| Hex encoding | ⬜ | ? | - |
| Uint8Array format | ⬜ | ? | - |
| Response as signature only | ⬜ | ? | - |
| Session methods check | ⬜ | ? | - |
| Nonce logic | ⬜ | ? | - |

---

## 🎯 Most Likely Solutions (Ranked)

1. **Admin account works** (40% probability)
   - Fireblocks policy/permission difference
   - Solution: Update policies or use admin account

2. **`near_signAndSendTransactions` works** (30% probability)
   - Fireblocks updated broadcast logic
   - Solution: Switch to this method

3. **Different encoding format** (20% probability)
   - Fireblocks expects base64/hex instead of array
   - Solution: Change encoding

4. **Fireblocks bug/change** (10% probability)
   - Nothing we can do works
   - Solution: Wait for Fireblocks fix

---

## 🚀 Let's Start Testing!

**Immediate Next Steps:**

1. ✅ Have admin try the flow (15 minutes)
2. ✅ Try `near_signAndSendTransactions` (30 minutes)
3. ✅ If both fail, try different encodings (1-2 hours)

**I can help implement any of these test scenarios - just let me know which one you want to try first!**



