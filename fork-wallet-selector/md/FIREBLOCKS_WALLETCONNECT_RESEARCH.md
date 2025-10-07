# Fireblocks & WalletConnect Documentation Research

**Research Date:** October 7, 2025  
**Purpose:** Identify potential implementation issues or missing details in Fireblocks NEAR integration

---

## 🔍 Key Findings from Documentation

### **1. Fireblocks WalletConnect Integration - Official Details**

#### **Connection Process (Source: Fireblocks Support)**
✅ **We're doing this correctly:**
- User selects WalletConnect
- Fireblocks appears in wallet list
- User approves connection in Fireblocks app
- Session is established

#### **Session Management**
⚠️ **CRITICAL FINDING:**
- **WalletConnect sessions automatically expire after 7 days**
- After expiration, reconnection is required
- **Recommendation:** Disconnect when not in use

**🎯 Action Item:**
- Check if your original working session was within 7 days
- If the issue started ~1 week ago, it could coincide with session expiry
- A new session may have different permissions or methods enabled

---

### **2. Network Compatibility Requirements**

⚠️ **CRITICAL REQUIREMENT:**
- **dApp network MUST match Fireblocks workspace network**
- Testnet dApp → Testnet workspace
- Mainnet dApp → Mainnet workspace
- Mismatch causes connection failures

**🎯 Action Item:**
- Verify burrow-cash is configured for mainnet
- Verify Fireblocks workspace is mainnet
- Check WalletConnect session namespace includes correct chain ID: `"near:mainnet"`

---

### **3. Fireblocks Sandbox Limitations**

⚠️ **If using Sandbox:**
- Sandbox NOT compatible with Fireblocks mobile app
- QR code pairing doesn't work in Sandbox
- Sandbox ONLY supports testnet networks

**🎯 Action Item:**
- If using Sandbox, switch to production environment
- Or ensure you're using desktop WalletConnect pairing

---

### **4. Message Encryption & Debugging**

✅ **Fireblocks provides debugging guide:**
- WalletConnect messages are symmetrically encrypted
- Symmetric key shared during handshake
- Messages can be decrypted for debugging

**Source:** [Decrypting WalletConnect Messages Guide](https://medium.com/fireblocks-tech-blog/decrypting-walletconnect-messages-a-guide-for-developers-b38ce3371b9e)

**🎯 Action Item:**
We can decrypt WalletConnect messages to see EXACTLY what Fireblocks receives and returns:
1. Monitor WalletConnect messages in browser DevTools
2. Extract symmetric key from IndexedDB
3. Decrypt messages to inspect transaction payloads
4. Compare what we send vs what Fireblocks receives

---

### **5. NEAR Protocol Support**

✅ **Fireblocks officially supports:**
- NEAR DeFi applications via WalletConnect
- NEAR staking
- Connection to NEAR dApps through Web3 engine

**Source:** [Fireblocks NEAR DeFi Support Announcement](https://www.fireblocks.com/blog/expanding-our-web3-connectivity-with-near-defi-and-dapps-support/)

---

### **6. WalletConnect Protocol Version**

✅ **Fireblocks uses WalletConnect v2.0:**
- Supports non-EVM chains (including NEAR)
- Different from v1.0 protocol

**Our Implementation:** Using `@walletconnect/sign-client: 2.21.2` ✅

---

### **7. Chain ID Standards**

⚠️ **POTENTIAL ISSUE:**
- Some dApps use CASA chain ID standard
- **Fireblocks may not support CASA chain IDs**
- **Use native chain ID representation instead**

**For NEAR:**
- Native format: `"near:mainnet"` or `"near:testnet"`
- NOT: `"eip155:mainnet"` or other non-native formats

**🎯 Action Item:**
- Verify our WalletConnect session uses `"near:mainnet"` (not another format)
- Check session namespace in our code

---

## 🚨 Critical Gaps in Documentation

### **Missing Technical Details:**

1. **❌ No official specification for NEAR transaction format**
   - Should transactions be sent as Array, Uint8Array, base64, or hex?
   - No documentation found specifying the expected format

2. **❌ No documentation on `near_signTransactions` vs `near_signAndSendTransactions`**
   - When to use which method?
   - What does each method return?
   - No official Fireblocks guidance found

3. **❌ No specification for signed transaction response format**
   - Does Fireblocks return SignedTransaction bytes or just signature?
   - What encoding (if any) is applied?
   - No documentation found

4. **❌ No NEAR-specific transaction signing examples**
   - Fireblocks documentation shows EVM examples
   - No NEAR transaction examples in official docs

---

## 🎯 Actionable Recommendations Based on Research

### **Immediate Actions:**

#### **1. Verify Session Status and Permissions**
```javascript
// In browser console on burrow-cash:
const dbRequest = indexedDB.open('WALLET_CONNECT_V2_INDEXED_DB');
dbRequest.onsuccess = function(event) {
  const db = event.target.result;
  const tx = db.transaction(['keyvaluestorage'], 'readonly');
  const store = tx.objectStore('keyvaluestorage');
  
  const sessionRequest = store.get('wc@2:client:0.3:session');
  sessionRequest.onsuccess = function() {
    const sessions = JSON.parse(sessionRequest.result || '[]');
    if (sessions.length > 0) {
      const session = sessions[0];
      console.log('Session created:', new Date(session.expiry * 1000 - 7 * 24 * 60 * 60 * 1000));
      console.log('Session expires:', new Date(session.expiry * 1000));
      console.log('Session methods:', session.namespaces?.near?.methods);
      console.log('Session chains:', session.namespaces?.near?.chains);
    }
  };
};
```

**Check for:**
- Is session expired or near expiry?
- Are methods correct? Should include: `near_signTransactions`
- Is chain ID correct? Should be: `["near:mainnet"]` or `["near:testnet"]`

---

#### **2. Verify Network Configuration**

**In `burrow-cash/.env` or environment:**
```bash
NEXT_PUBLIC_DEFAULT_NETWORK=mainnet  # or testnet
```

**In Fireblocks:**
- Verify workspace is on same network (mainnet vs testnet)
- Check vault account has NEAR enabled

**In WalletConnect session:**
```javascript
// Check current chainId
const chainId = getChainId(); // Should return "near:mainnet" or "near:testnet"
console.log('Current WalletConnect chainId:', chainId);
```

---

#### **3. Implement Message Decryption for Debugging**

Follow [Fireblocks' guide](https://medium.com/fireblocks-tech-blog/decrypting-walletconnect-messages-a-guide-for-developers-b38ce3371b9e) to:

1. **Extract symmetric key from IndexedDB:**
```javascript
// In browser console:
const dbRequest = indexedDB.open('WALLET_CONNECT_V2_INDEXED_DB');
dbRequest.onsuccess = function(event) {
  const db = event.target.result;
  const tx = db.transaction(['keyvaluestorage'], 'readonly');
  const store = tx.objectStore('keyvaluestorage');
  
  // Get the symmetric key
  const keyRequest = store.getAllKeys();
  keyRequest.onsuccess = function() {
    console.log('All keys:', keyRequest.result);
    // Look for keys containing 'symKey'
  };
};
```

2. **Capture encrypted messages:**
   - Use browser DevTools Network tab
   - Filter for WalletConnect relay messages
   - Copy encrypted payloads

3. **Decrypt and inspect:**
   - Use the symmetric key to decrypt
   - See EXACTLY what transaction data Fireblocks receives
   - Compare with what we're sending

**This will definitively show:**
- ✅ What format Fireblocks receives (Array, base64, hex, etc.)
- ✅ What format Fireblocks returns
- ✅ Any transformations applied during transmission

---

#### **4. Test with Fresh Session**

**Clear everything and create a brand new session:**

```bash
# In browser console:
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB');

# Refresh page
# Reconnect Fireblocks wallet
# Try transaction again
```

**Why:** A fresh session will have the latest Fireblocks methods and permissions.

---

#### **5. Verify Chain ID Format**

**Check current implementation:**

```typescript
// In proximity-wallet-connect/src/lib/wallet-connect.ts
// Around line 134-135
const getChainId = (): string => {
  return _state.session
    ? _state.session.namespaces.near.accounts[0].split(":").slice(0, 2).join(":")
    : `near:${networkId}`;
};
```

**Ensure this returns:**
- `"near:mainnet"` for mainnet
- `"near:testnet"` for testnet
- NOT any other format (not CASA, not eip155, etc.)

---

### **Advanced Debugging Actions:**

#### **6. Try Alternative Transaction Encoding Formats**

Based on lack of official documentation, we should test all common formats:

**Current:** Sending as plain JavaScript Array
```typescript
const encodedTxs = txs.map(x => Array.from(x.encode()));
```

**Try these alternatives (one at a time):**

**A. Base64 String:**
```typescript
const encodedTxs = txs.map(x => Buffer.from(x.encode()).toString('base64'));
```

**B. Hex String:**
```typescript
const encodedTxs = txs.map(x => Buffer.from(x.encode()).toString('hex'));
```

**C. Uint8Array (no conversion):**
```typescript
const encodedTxs = txs.map(x => x.encode()); // Keep as Uint8Array
```

**D. Buffer:**
```typescript
const encodedTxs = txs.map(x => Buffer.from(x.encode()));
```

**Rationale:** Without official documentation, Fireblocks might expect a different format than we're using.

---

#### **7. Test `near_signAndSendTransactions` Again**

The original behavior (transactions appear but don't broadcast) might have been fixed by Fireblocks.

**Try:**
```typescript
const results = await _state.client.request({
  topic: _state.session!.topic,
  chainId: getChainId(),
  request: {
    method: "near_signAndSendTransactions",  // Instead of near_signTransactions
    params: { transactions: encodedTxs },
  },
});

// If Fireblocks now broadcasts, results should be FinalExecutionOutcome[]
console.log('Result from near_signAndSendTransactions:', results);
return results; // Don't try to broadcast ourselves
```

---

## 📊 Research Summary Matrix

| Aspect | Documentation Found | Our Implementation | Status |
|--------|-------------------|-------------------|--------|
| WalletConnect v2.0 | ✅ Yes | ✅ Using 2.21.2 | ✅ Match |
| Session expiry (7 days) | ✅ Yes | ⚠️ Need to verify | ⚠️ Check |
| Network compatibility | ✅ Yes (must match) | ⚠️ Need to verify | ⚠️ Check |
| NEAR support | ✅ Yes (officially supported) | ✅ Implemented | ✅ Match |
| Chain ID format | ✅ Yes (use native) | ⚠️ Need to verify | ⚠️ Check |
| Transaction encoding format | ❌ Not documented | Using Array | ❌ Unknown |
| Sign methods specification | ❌ Not documented | Using near_signTransactions | ❌ Unknown |
| Signed response format | ❌ Not documented | Expecting SignedTransaction | ❌ Unknown |
| Message decryption | ✅ Yes (guide available) | ❓ Not yet used | 🔄 Todo |

---

## 🎯 Priority Action Plan

### **Priority 1 (Do First - 15 mins):**
1. ✅ Check WalletConnect session details (expiry, methods, chain ID)
2. ✅ Verify network configuration matches (mainnet vs testnet)
3. ✅ Create fresh WalletConnect session

### **Priority 2 (If Priority 1 doesn't fix - 30 mins):**
4. ✅ Try `near_signAndSendTransactions` instead
5. ✅ Test different transaction encoding formats (base64, hex, Uint8Array)

### **Priority 3 (Advanced debugging - 1-2 hours):**
6. ✅ Implement WalletConnect message decryption
7. ✅ Inspect raw transaction payloads going to/from Fireblocks
8. ✅ Compare with working wallet implementations

---

## 💡 Most Likely Root Causes (Based on Research)

### **Theory 1: Session Expiry/Permission Change** (40% probability)
- Original session worked
- Session expired after 7 days
- New session has different permissions or methods
- **Test:** Create fresh session, check if it works

### **Theory 2: Network Mismatch** (25% probability)
- dApp on mainnet, Fireblocks on testnet (or vice versa)
- Chain ID format incorrect
- **Test:** Verify network configuration matches

### **Theory 3: Transaction Encoding Format** (20% probability)
- Fireblocks expects different format (base64, hex) than we're sending (Array)
- No official documentation to confirm correct format
- **Test:** Try different encoding formats

### **Theory 4: Fireblocks Update Changed Behavior** (15% probability)
- Fireblocks updated their NEAR implementation ~1 week ago
- New implementation has bugs or different requirements
- **Test:** Deploy to production, have admin test, escalate to Fireblocks if persists

---

## 📞 Questions for Fireblocks Support

If all testing fails, contact Fireblocks with these specific questions:

1. **What is the exact format expected for NEAR transaction payloads in `near_signTransactions`?**
   - Array of numbers? Base64 string? Hex string? Uint8Array?

2. **What format does Fireblocks return for signed NEAR transactions?**
   - Full SignedTransaction bytes? Just the signature? What encoding?

3. **When should we use `near_signTransactions` vs `near_signAndSendTransactions`?**
   - Does Fireblocks actually broadcast with `near_signAndSendTransactions`?
   - What does each method return?

4. **Did Fireblocks update its NEAR WalletConnect implementation around October 1, 2025?**
   - If yes, what changed?
   - Are there migration steps needed?

5. **How does Fireblocks serialize/deserialize NEAR transactions?**
   - Do you re-serialize after parsing?
   - What borsh implementation do you use?

6. **Can you verify the signature for our example transaction?**
   - Transaction hash: `43f33d6d13db19d41228189eb70661232c3d93e745da2ef3562c565336548814`
   - Signature: `901bbb14c17d561b5ac0252c1c4c0e525fec618ed4a7aed2b07f5747076a9be68450a6e051350080ace6ed7c3eb4843a9e38bfd1a70d06af6b3b82e044d5170e`
   - Why doesn't this verify using standard Ed25519?

---

## 📚 Reference Links

- [Fireblocks WalletConnect Integration](https://support.fireblocks.io/hc/en-us/articles/5403817784732-WalletConnect-integration)
- [Fireblocks Wallet Link API](https://developers.fireblocks.com/docs/web3-wallet-link)
- [Decrypting WalletConnect Messages](https://medium.com/fireblocks-tech-blog/decrypting-walletconnect-messages-a-guide-for-developers-b38ce3371b9e)
- [Fireblocks NEAR DeFi Support](https://www.fireblocks.com/blog/expanding-our-web3-connectivity-with-near-defi-and-dapps-support/)
- [Fireblocks Developer Community](https://community.fireblocks.com/)
- [WalletConnect Documentation](https://walletconnect.com/docs)

---

**Next Steps:** Follow the Priority Action Plan above, starting with Priority 1 items.


