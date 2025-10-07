# Deploy to Production - Step-by-Step Guide

**Goal:** Publish packages to npm and deploy burrow-cash to Vercel for testing

---

## 📦 Step 1: Prepare Packages for npm Publishing

### 1.1 Verify Package Configurations

Both packages need:
- ✅ Unique version numbers (we'll bump them)
- ✅ Proper `package.json` fields
- ✅ Built `dist/` folders
- ✅ npm account access

---

## 🚀 Step 2: Build and Publish Packages

### 2.1 Build Both Packages
```bash
cd /Users/grey/Documents/fork-wallet-selector
npm run build:packages
```

### 2.2 Publish `proximity-dex-core`
```bash
cd proximity-dex-core
npm publish --access public
```

### 2.3 Publish `proximity-wallet-connect`
```bash
cd ../proximity-wallet-connect
npm publish --access public
```

**Note:** If packages are scoped (e.g., `@yourorg/proximity-dex-core`), you'll need `--access public` for first publish.

---

## 🔄 Step 3: Update burrow-cash to Use Published Packages

### 3.1 Update `burrow-cash/package.json`
```json
{
  "dependencies": {
    "proximity-dex-core": "7.9.8-proximity.3",
    "proximity-wallet-connect": "7.9.8-proximity.29"
  }
}
```

### 3.2 Install from npm
```bash
cd burrow-cash
rm -rf node_modules package-lock.json
npm install
```

### 3.3 Test Locally
```bash
npm run dev
```

Test a transaction flow to ensure everything works with npm packages.

---

## 🌐 Step 4: Deploy to Vercel

### 4.1 Ensure Vercel Configuration
Check `burrow-cash/vercel.json` exists and is correct.

### 4.2 Set Environment Variables in Vercel
Ensure these are set in Vercel dashboard:
- `NEXT_PUBLIC_DEFAULT_NETWORK`
- `NEXT_PUBLIC_CONTRACT_NAME`
- `NEXT_PUBLIC_NEAR_STORAGE_DEPOSIT`
- `NEXT_PUBLIC_WALLET_CONNECT_ID`

### 4.3 Deploy
```bash
cd burrow-cash
vercel --prod
```

Or push to GitHub if you have auto-deploy set up.

---

## ✅ Step 5: Test in Production

### 5.1 Your Coworker Tests
1. Visit production URL
2. Connect Fireblocks with **admin account**
3. Try staking/unstaking
4. Open browser DevTools → Console
5. Look for signature verification logs

### 5.2 What to Look For
```
🔐 MANUAL SIGNATURE VERIFICATION:
   Signature valid: ✅ YES or ❌ NO
```

---

## 📋 Pre-Flight Checklist

Before publishing:
- [ ] Build succeeds for both packages
- [ ] Version numbers are incremented
- [ ] npm login completed
- [ ] Test locally with built packages
- [ ] Vercel environment variables set
- [ ] Git commits pushed (if using auto-deploy)

---

## 🆘 Troubleshooting

### npm publish fails with 403
- Run `npm login` first
- Check if package name is available
- For scoped packages, use `--access public`

### Vercel build fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify environment variables are set

### Production app doesn't work
- Check browser console for errors
- Verify environment variables in Vercel
- Check Vercel function logs

---

## Current Package Versions

Based on latest changes:
- `proximity-dex-core`: `7.9.8-proximity.3`
- `proximity-wallet-connect`: `7.9.8-proximity.29` (with v19 signature verification)



