# Production Deployment Checklist

**Goal:** Deploy burrow-cash to production with fixed Fireblocks integration for admin testing

---

## ✅ Pre-Deployment Checklist

- [x] Both packages built successfully
- [x] Version numbers set:
  - `proximity-dex-core`: `7.9.8-proximity.3`
  - `proximity-wallet-connect`: `7.9.8-proximity.29` (with v19 signature verification)
- [x] Build scripts created
- [x] Publish scripts created

---

## 📝 Step-by-Step Deployment

### **Step 1: Login to npm** ⏱️ 2 minutes

```bash
npm login
```

**Enter your npm credentials:**
- Username
- Password
- Email
- 2FA code (if enabled)

**Verify login:**
```bash
npm whoami
```

---

### **Step 2: Publish Packages to npm** ⏱️ 5 minutes

```bash
cd /Users/grey/Documents/fork-wallet-selector
./PUBLISH_SCRIPT.sh
```

**What this does:**
- Publishes `proximity-dex-core@7.9.8-proximity.3`
- Publishes `proximity-wallet-connect@7.9.8-proximity.29`
- Shows npm package URLs

**Verify publication:**
- Visit: https://www.npmjs.com/package/proximity-dex-core
- Visit: https://www.npmjs.com/package/proximity-wallet-connect
- Check that the versions match

**⚠️ IMPORTANT:** Wait 1-2 minutes after publishing for npm's CDN to update!

---

### **Step 3: Update burrow-cash to Use npm Packages** ⏱️ 5 minutes

```bash
cd /Users/grey/Documents/fork-wallet-selector
./UPDATE_BURROW_FOR_NPM.sh
```

**What this does:**
- Updates `burrow-cash/package.json` to use specific versions
- Removes local `node_modules` and `package-lock.json`
- Installs fresh from npm
- Verifies installation

**Manual verification:**
```bash
cd burrow-cash
npm list proximity-dex-core
npm list proximity-wallet-connect
```

Should show:
```
burrow-cash@0.2.0
├── proximity-dex-core@7.9.8-proximity.3
└── proximity-wallet-connect@7.9.8-proximity.29
```

---

### **Step 4: Test Locally** ⏱️ 10 minutes

```bash
cd burrow-cash
npm run dev
```

**Test checklist:**
1. [ ] App loads at http://localhost:3001
2. [ ] No console errors on page load
3. [ ] Can connect Fireblocks wallet
4. [ ] Can see account balance
5. [ ] Try staking/unstaking
6. [ ] Check for signature verification logs in console
7. [ ] Look for: `🔥 WALLET-CONNECT VERSION: v19-IMPORTED-SHA256-2024-10-07`

**Expected console output when attempting transaction:**
```
🎯🎯🎯 signAndSendViaWalletConnect CALLED - v19 WITH IMPORTED SHA256! 🎯🎯🎯
🔥 WALLET-CONNECT VERSION: v19-IMPORTED-SHA256-2024-10-07
📤 Sending N transaction(s) to Fireblocks via near_signTransactions
...
🔐 MANUAL SIGNATURE VERIFICATION:
   Signature valid: ✅ YES or ❌ NO
```

**If everything works locally, proceed to Step 5.**
**If there are issues, debug before deploying to production.**

---

### **Step 5: Verify Environment Variables for Vercel** ⏱️ 3 minutes

Make sure these are set in Vercel dashboard (Project Settings → Environment Variables):

**Required Variables:**
```
NEXT_PUBLIC_DEFAULT_NETWORK=mainnet
NEXT_PUBLIC_CONTRACT_NAME=contract.main.burrow.near
NEXT_PUBLIC_NEAR_STORAGE_DEPOSIT=0.25
NEXT_PUBLIC_WALLET_CONNECT_ID=<your-walletconnect-project-id>
```

**To check/set:**
1. Go to https://vercel.com/dashboard
2. Select your burrow-cash project
3. Go to Settings → Environment Variables
4. Verify all are set for Production environment

---

### **Step 6: Deploy to Vercel** ⏱️ 10 minutes

#### Option A: Deploy via Vercel CLI (Recommended)

```bash
cd burrow-cash

# Preview deployment (test first)
vercel

# Production deployment
vercel --prod
```

#### Option B: Deploy via Git Push (if auto-deploy enabled)

```bash
cd burrow-cash
git add package.json package-lock.json
git commit -m "Update to npm published packages with Fireblocks fixes"
git push origin main
```

Vercel will auto-deploy if configured.

**Monitor deployment:**
- Watch Vercel dashboard for build progress
- Check build logs for errors

**Expected build time:** 3-5 minutes

---

### **Step 7: Verify Production Deployment** ⏱️ 5 minutes

**Production URL:** https://your-app.vercel.app (or custom domain)

**Verification checklist:**
1. [ ] App loads successfully
2. [ ] Open browser DevTools → Console
3. [ ] Look for: `🚨🚨🚨 PROXIMITY-WALLET-CONNECT MODULE LOADED - VERSION: v19-IMPORTED-SHA256-2024-10-07`
4. [ ] No console errors
5. [ ] Can connect wallet

---

### **Step 8: Have Admin Coworker Test** ⏱️ 15 minutes

**Send to coworker:**
1. Production URL
2. Instructions to:
   - Open DevTools Console
   - Connect Fireblocks with **admin account**
   - Try staking/unstaking NEAR
   - Watch for signature verification logs

**What they should see:**
```
🔐 MANUAL SIGNATURE VERIFICATION:
   Signature valid: ✅ YES or ❌ NO
```

**Outcomes:**

**If ✅ YES → Success!**
- Admin account works = it's a permissions issue on your account
- Solution: Update Fireblocks policies or use admin account

**If ❌ NO → Still broken**
- Not a permissions issue
- The signature verification is still failing
- Need to escalate to Fireblocks support with our detailed report

---

## 🔍 Troubleshooting

### npm publish fails

**Error: 403 Forbidden**
```bash
# Make sure you're logged in
npm whoami

# Try publishing with --access public
cd proximity-dex-core
npm publish --access public
```

**Error: Version already exists**
```bash
# Bump version in package.json
# Edit proximity-dex-core/package.json: 7.9.8-proximity.4
# Edit proximity-wallet-connect/package.json: 7.9.8-proximity.30
# Rebuild and publish again
npm run build:packages
./PUBLISH_SCRIPT.sh
```

### Vercel build fails

**Check build logs:**
1. Go to Vercel dashboard
2. Click on failed deployment
3. View "Building" logs
4. Look for specific error

**Common issues:**
- Missing environment variables → Set in Vercel dashboard
- Dependencies not found → Check package.json versions
- TypeScript errors → May need to skip type checking (already in vercel-build script)

### App loads but wallet doesn't work

**Check console for errors:**
- Missing WalletConnect project ID
- Network/RPC issues
- WalletConnect version conflicts

**Verify environment variables are set correctly in Vercel.**

### Wrong version deployed

**Clear Vercel cache:**
```bash
vercel --prod --force
```

**Check that npm packages are correct:**
```bash
npm view proximity-dex-core version
npm view proximity-wallet-connect version
```

---

## 📊 Success Criteria

✅ **Deployment Successful If:**
1. Packages published to npm
2. burrow-cash installs from npm
3. Local testing shows correct version logs
4. Vercel deployment succeeds
5. Production app loads and shows correct version
6. Admin coworker can test

✅ **Fireblocks Issue Resolved If:**
- Admin account shows `Signature valid: ✅ YES`
- Transactions successfully broadcast to NEAR
- No "Transaction is not signed with the given public key" errors

❌ **Still Need Fireblocks Support If:**
- Even admin account shows `Signature valid: ❌ NO`
- Signatures still fail verification
- Use `FIREBLOCKS_ISSUE_REPORT.md` to contact support

---

## 🎯 Quick Command Reference

```bash
# 1. Login to npm
npm login

# 2. Publish packages
cd /Users/grey/Documents/fork-wallet-selector
./PUBLISH_SCRIPT.sh

# 3. Update burrow-cash
./UPDATE_BURROW_FOR_NPM.sh

# 4. Test locally
cd burrow-cash
npm run dev

# 5. Deploy to production
vercel --prod

# 6. Check package versions
npm view proximity-dex-core version
npm view proximity-wallet-connect version
```

---

## 📞 Next Steps After Deployment

1. ✅ Test with admin account
2. 📊 Compare results (admin vs regular account)
3. 📝 Document findings
4. 📧 Contact Fireblocks if needed (use FIREBLOCKS_ISSUE_REPORT.md)

---

**Good luck with the deployment! 🚀**



