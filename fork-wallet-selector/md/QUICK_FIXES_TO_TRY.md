# Quick Fixes to Try (Based on Research)

**Based on Fireblocks & WalletConnect documentation research**

---

## 🚀 Fix #1: Fresh Session (MOST LIKELY - 5 mins)

**Why:** Sessions expire after 7 days. If your integration broke ~1 week ago, it could be session expiry + new session has different permissions.

### How to Test:

1. **In burrow-cash browser, open DevTools Console:**
```javascript
// Clear everything
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB');
```

2. **Refresh page**

3. **Reconnect Fireblocks wallet**

4. **Before trying transaction, check session:**
```javascript
const dbRequest = indexedDB.open('WALLET_CONNECT_V2_INDEXED_DB');
dbRequest.onsuccess = function(event) {
  const db = event.target.result;
  const tx = db.transaction(['keyvaluestorage'], 'readonly');
  const store = tx.objectStore('keyvaluestorage');
  
  const sessionRequest = store.get('wc@2:client:0.3:session');
  sessionRequest.onsuccess = function() {
    const sessions = JSON.parse(sessionRequest.result || '[]');
    const session = sessions[0];
    console.log('✅ Session Methods:', session.namespaces?.near?.methods);
    console.log('✅ Session Chains:', session.namespaces?.near?.chains);
    console.log('✅ Session Expires:', new Date(session.expiry * 1000));
  };
};
```

5. **Verify output:**
   - Methods should include: `near_signTransactions`
   - Chains should be: `["near:mainnet"]` or `["near:testnet"]`
   - Expiry should be ~7 days in future

6. **Try transaction**

---

## 🚀 Fix #2: Verify Network Match (5 mins)

**Why:** Fireblocks requires dApp network to match workspace network.

### How to Test:

1. **Check burrow-cash network:**
```bash
# In burrow-cash/.env or Vercel env vars:
NEXT_PUBLIC_DEFAULT_NETWORK=mainnet  # What is this set to?
```

2. **Check Fireblocks workspace:**
   - Log into Fireblocks dashboard
   - What network is your workspace on? (mainnet or testnet)

3. **Check WalletConnect session network:**
```javascript
// In browser console after connecting:
console.log('WalletConnect chainId:', getChainId()); // Should match network
```

4. **Ensure all three match:**
   - burrow-cash: mainnet
   - Fireblocks: mainnet  
   - WalletConnect: `"near:mainnet"`

---

## 🚀 Fix #3: Try Base64 Encoding (30 mins)

**Why:** No official docs specify format. Other blockchain integrations often use base64.

### Implementation:

Edit `/Users/grey/Documents/fork-wallet-selector/proximity-wallet-connect/src/lib/wallet-connect.ts`:

**Find line ~548 (encodedTxs creation):**

```typescript
// BEFORE:
const encodedTxs = txs.map((x, idx) => {
  const encoded = x.encode();
  console.log(`📦 Transaction #${idx + 1} BEFORE sending to Fireblocks:`);
  console.log(`   Length: ${encoded.length} bytes`);
  console.log(`   First 40 bytes (hex):`, Buffer.from(encoded.slice(0, 40)).toString('hex'));
  console.log(`   Last 40 bytes (hex):`, Buffer.from(encoded.slice(-40)).toString('hex'));
  console.log(`   Full bytes (for verification):`, Buffer.from(encoded).toString('hex'));
  return Array.from(encoded);
});
```

```typescript
// AFTER (try base64):
const encodedTxs = txs.map((x, idx) => {
  const encoded = x.encode();
  const base64 = Buffer.from(encoded).toString('base64');
  console.log(`📦 Transaction #${idx + 1} BEFORE sending to Fireblocks (BASE64):`);
  console.log(`   Length: ${encoded.length} bytes`);
  console.log(`   Base64:`, base64);
  return base64;  // Send as base64 string
});
console.log(`🧪 TEST: Sending as BASE64 strings`);
```

**Also update response handling (line ~574):**

```typescript
// Add this logging BEFORE deserialization:
console.log(`✅ Received signed transactions from Fireblocks`);
console.log(`   Type:`, typeof signedTxsEncoded[0]);
console.log(`   Is string:`, typeof signedTxsEncoded[0] === 'string');

// If response is also base64, decode it:
const signedTxs: Array<nearAPI.transactions.SignedTransaction> = signedTxsEncoded.map((encoded, idx) => {
  console.log(`🔧 Decoding transaction #${idx + 1}...`);
  
  let buffer: Buffer;
  if (typeof encoded === 'string') {
    // If Fireblocks returns base64 string
    buffer = Buffer.from(encoded, 'base64');
    console.log(`   ✓ Decoded from base64, length: ${buffer.length}`);
  } else if (Array.isArray(encoded)) {
    buffer = Buffer.from(encoded);
    console.log(`   ✓ Converted from array, length: ${buffer.length}`);
  } else if (encoded && typeof encoded === 'object' && encoded.type === 'Buffer') {
    buffer = Buffer.from(encoded.data);
    console.log(`   ✓ Converted from Buffer object, length: ${buffer.length}`);
  } else {
    buffer = Buffer.from(encoded);
    console.log(`   ⚠ Unknown format, tried conversion, length: ${buffer.length}`);
  }
  
  const decoded = nearAPI.transactions.SignedTransaction.decode(buffer);
  // ... rest of code
```

**Rebuild and test:**
```bash
cd /Users/grey/Documents/fork-wallet-selector
npm run build:packages
cd burrow-cash
npm run dev
```

---

## 🚀 Fix #4: Try `near_signAndSendTransactions` (30 mins)

**Why:** Fireblocks might have fixed their broadcast logic since we last tried.

### Implementation:

Edit `/Users/grey/Documents/fork-wallet-selector/proximity-wallet-connect/src/lib/wallet-connect.ts`:

**Find line ~561 (the client.request call):**

```typescript
// BEFORE:
const signedTxsEncoded = await _state.client.request<Array<any>>({
  topic: _state.session!.topic,
  chainId: getChainId(),
  request: {
    method: "near_signTransactions",
    params: { transactions: encodedTxs },
  },
});

// Then we decode and broadcast ourselves...
```

```typescript
// AFTER (try sign AND send):
console.log(`🧪 TEST: Using near_signAndSendTransactions (Fireblocks broadcasts)`);
const results = await _state.client.request<Array<any>>({
  topic: _state.session!.topic,
  chainId: getChainId(),
  request: {
    method: "near_signAndSendTransactions",  // Changed!
    params: { transactions: encodedTxs },
  },
});

console.log(`✅ Received results from Fireblocks:`, results);
console.log(`   Type:`, typeof results);
console.log(`   Is array:`, Array.isArray(results));

if (Array.isArray(results) && results.length > 0) {
  const firstResult = results[0];
  console.log(`   First result:`, firstResult);
  
  // Check if it's FinalExecutionOutcome
  if (firstResult?.transaction?.hash || firstResult?.transaction_outcome?.id) {
    console.log(`   ✅ Looks like FinalExecutionOutcome!`);
    console.log(`   Transaction hash:`, firstResult.transaction?.hash || firstResult.transaction_outcome?.id);
    return results;  // Fireblocks already broadcast, just return
  }
}

// If we get here, it didn't work as expected
console.error(`   ❌ Response doesn't look like FinalExecutionOutcome`);
console.error(`   Falling back to manual broadcast approach...`);
// Continue with old logic (decode and broadcast)
```

**Rebuild and test:**
```bash
cd /Users/grey/Documents/fork-wallet-selector
npm run build:packages
cd burrow-cash
npm run dev
```

---

## 🚀 Fix #5: Check Chain ID Format (5 mins)

**Why:** Fireblocks may not support non-native chain ID formats.

### How to Test:

1. **Check current chain ID:**
```javascript
// In browser console after connecting wallet:
console.log('Current chainId:', getChainId());
// Should output: "near:mainnet" or "near:testnet"
// NOT: "eip155:..." or anything else
```

2. **If wrong, check implementation:**

In `proximity-wallet-connect/src/lib/wallet-connect.ts` around line 134:

```typescript
const getChainId = (): string => {
  return _state.session
    ? _state.session.namespaces.near.accounts[0].split(":").slice(0, 2).join(":")
    : `near:${networkId}`;
};
```

This should return `"near:mainnet"` or `"near:testnet"`.

3. **Also check session creation:**

Around line 205-210:

```typescript
requiredNamespaces: {
  near: {
    chains: [chainId],  // This should be ["near:mainnet"] or ["near:testnet"]
    methods: methods || WC_METHODS,
    events: events || WC_EVENTS,
  },
},
```

---

## 📋 Testing Checklist

Try fixes in this order:

- [ ] **Fix #1: Fresh Session** (5 mins) - Most likely to work
- [ ] **Fix #2: Network Match** (5 mins) - Quick to verify
- [ ] If still broken: **Fix #4: near_signAndSendTransactions** (30 mins)
- [ ] If still broken: **Fix #3: Base64 Encoding** (30 mins)
- [ ] **Fix #5: Chain ID** (5 mins) - Verify this regardless

---

## 📊 Expected Outcomes

### **If Fix Works:**
```
🔐 MANUAL SIGNATURE VERIFICATION:
   Signature valid: ✅ YES - Fireblocks signature is VALID!
```
```
✅ Transaction #1 broadcast successfully
   Hash: ABC123...
```

### **If Still Broken:**
```
🔐 MANUAL SIGNATURE VERIFICATION:
   Signature valid: ❌ NO - FIREBLOCKS SIGNATURE IS INVALID!
```
→ Escalate to Fireblocks with research findings

---

## 🎯 Priority Order

1. **Try Fix #1** (fresh session) - 40% chance of success
2. **Try Fix #2** (network match) - 25% chance  
3. **Try Fix #4** (signAndSend) - 20% chance
4. **Try Fix #3** (base64) - 10% chance
5. **Deploy to production for admin test** - Determine if permissions issue

**If all fail:** Use `FIREBLOCKS_ISSUE_REPORT.md` to escalate to Fireblocks support.


