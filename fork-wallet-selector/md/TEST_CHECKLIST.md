# 🧪 WalletConnect Fix Test Checklist

## What We Changed:
Changed `burrow-cash/utils/wallet-selector-compat.ts` line 3:
```diff
- import { setupWalletSelector } from "@near-wallet-selector/core";
+ import { setupWalletSelector } from "rhea-dex-core";
```

## Why This Should Fix It:
- `@near-wallet-selector/core` uses `FailoverRpcProvider` (doesn't exist in near-api-js v2.1.4)
- `rhea-dex-core` uses `JsonRpcProvider` (exists in all versions)
- This eliminates the "is not a constructor" error

---

## 🔍 Test Sequence

### **Phase 1: Basic Functionality (BEFORE WalletConnect)**

#### Test 1.1: App Loads Without Errors
- [ ] Navigate to http://localhost:3000
- [ ] Open browser console (F12)
- [ ] Check for errors
- **Expected:** No "FailoverRpcProvider is not a constructor" error
- **Actual:** _______________

#### Test 1.2: Check Wallet Selector Initialization
Look in console for:
- [ ] "Wallet selector initialization error" - should be GONE
- [ ] "App initialization complete" - should appear
- **Expected:** Clean initialization
- **Actual:** _______________

#### Test 1.3: Verify Provider Type
Run in browser console:
```javascript
// This will tell us which core package is being used
window.selector?.store?.getState().modules.forEach(m => {
  console.log(`${m.id}: ${m.metadata.name}`);
});
```
- [ ] WalletConnect appears in the list
- **Expected:** wallet-connect module present
- **Actual:** _______________

---

### **Phase 2: WalletConnect Specific Tests**

#### Test 2.1: Open Wallet Selector Modal
- [ ] Click "Connect Wallet" button
- [ ] WalletConnect option appears
- [ ] No console errors
- **Expected:** Modal opens cleanly
- **Actual:** _______________

#### Test 2.2: Initiate WalletConnect Connection
- [ ] Click on "WalletConnect" option
- [ ] QR code or connection modal appears
- [ ] No "provider" or "constructor" errors in console
- **Expected:** Connection flow starts
- **Actual:** _______________

#### Test 2.3: Connect with Fireblocks
- [ ] Scan QR with Fireblocks app (if available)
- [ ] OR note if connection pending
- **Expected:** Connection established or pending
- **Actual:** _______________

---

### **Phase 3: Transaction Tests (if connected)**

#### Test 3.1: Attempt a Stake Transaction
- [ ] Navigate to staking page
- [ ] Enter amount
- [ ] Click "Stake"
- [ ] Check console for enhanced debugging output
- **Expected:** 
  - `🔍 ═══ PRE-TRANSACTION WC COMPREHENSIVE DEBUG ═══` appears
  - `🔌 DETAILED CONNECTOR STATE` shows connected: true
  - `📤 ═══ WC METHOD CALL - signAndSendTransactions ═══` appears
- **Actual:** _______________

#### Test 3.2: Monitor Transaction Flow
Watch console for:
- [ ] `🟢 WC Event [call_request]` (message sent to Fireblocks)
- [ ] `⏰ WC METHOD STILL PENDING after 30 seconds` warnings
- [ ] `📥 ═══ WC METHOD SUCCESS ═══` OR timeout
- **Expected:** Message reaches Fireblocks (even if timeout waiting for approval)
- **Actual:** _______________

---

### **Phase 4: Comparison Test**

#### Test 4.1: Revert the Change Temporarily
To PROVE this was the fix:

```bash
# Revert to @near-wallet-selector/core
git diff burrow-cash/utils/wallet-selector-compat.ts
git checkout burrow-cash/utils/wallet-selector-compat.ts
```

- [ ] Reload app
- [ ] Check if "FailoverRpcProvider is not a constructor" error returns
- **Expected:** Error comes BACK
- **Actual:** _______________

#### Test 4.2: Re-apply the Fix
```bash
# Re-apply our fix
git checkout HEAD -- burrow-cash/utils/wallet-selector-compat.ts
```
Or manually change back to `rhea-dex-core`

- [ ] Reload app
- [ ] Error should be GONE again
- **Expected:** Works again
- **Actual:** _______________

---

## 🎯 Success Criteria

The fix is CONFIRMED if:
1. ✅ "FailoverRpcProvider is not a constructor" error is GONE
2. ✅ Wallet selector initializes without errors
3. ✅ WalletConnect option appears in wallet list
4. ✅ Can initiate WalletConnect connection flow
5. ✅ Enhanced debugging shows connector state
6. ✅ Error returns when reverting to @near-wallet-selector/core

## 📊 Results Summary

**Date/Time:** _____________
**Tester:** _____________

### Before Fix:
- Error: "FailoverRpcProvider is not a constructor" ❌
- WalletConnect: Not working ❌
- Wallet Selector: Failed to initialize ❌

### After Fix (rhea-dex-core):
- Error: _______________
- WalletConnect: _______________
- Wallet Selector: _______________
- Transaction flow: _______________

### Confidence Level:
- [ ] 100% - Definitively fixed
- [ ] 75% - Mostly fixed, minor issues
- [ ] 50% - Partially fixed
- [ ] 0% - Still broken

### Notes:
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________

---

## 🐛 If Still Not Working

Check these:

1. **Clear browser cache completely**
   ```javascript
   // In console
   localStorage.clear();
   sessionStorage.clear();
   location.reload(true);
   ```

2. **Verify rhea-dex-core is actually being used**
   ```javascript
   // In console - check which packages are loaded
   Object.keys(window).filter(k => k.includes('selector')).forEach(k => console.log(k));
   ```

3. **Check for other version conflicts**
   ```bash
   cd burrow-cash
   npm list near-api-js
   npm list @near-wallet-selector/core
   npm list rhea-dex-core
   ```

4. **Look for webpack module resolution issues**
   - Check dev server output for "Multiple instances of X" warnings
   - Check for conflicting peer dependencies

---

## 📝 Documentation

If this works, document:
1. Which core package to use: `rhea-dex-core`
2. Why we use it: Compatibility with near-api-js v2.1.4
3. When to update: When Rhea releases updates OR when we upgrade near-api-js to v4+
4. Alternative: Implement Option 2 from SOLUTION_WALLETCONNECT_FIX.md

