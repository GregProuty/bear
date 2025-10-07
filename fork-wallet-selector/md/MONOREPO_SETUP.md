# Monorepo Setup Guide

## Structure

This is an npm workspaces monorepo with the following structure:

```
fork-wallet-selector/
├── package.json                    # Root workspace config
├── burrow-cash/                    # Next.js app
├── proximity-dex-core/             # Core wallet selector package (local)
├── proximity-wallet-connect/       # WalletConnect package (local)
├── old-wallet-selector/            # Reference (not in workspace)
└── wallet-selector-FULL-MONOREPO/ # Reference (not in workspace)
```

## Key Features

✅ **Automatic linking**: Local packages are symlinked automatically  
✅ **No manual copying**: Changes propagate immediately  
✅ **Single install**: One `npm install` at root handles everything  
✅ **Proper resolution**: `transpilePackages` tells Next.js to compile local packages  
✅ **No cache issues**: Symlinks always point to source  

## Initial Setup

```bash
# From the root directory
npm run fresh-install
```

This will:
1. Clean all node_modules and caches
2. Install all dependencies
3. Create symlinks for local packages

## Development Workflow

### Start the dev server
```bash
# From root
npm run dev

# Or from burrow-cash directory
cd burrow-cash && npm run dev
```

### Making changes to local packages

1. **Edit source files** in `proximity-wallet-connect/src/` or `proximity-dex-core/src/`
2. **Build the package**: `cd proximity-wallet-connect && npm run build`
3. **Changes auto-reflect** in burrow-cash (Next.js detects symlink changes)
4. **Hard refresh browser** if needed (Cmd+Shift+R)

### Adding dependencies

```bash
# To burrow-cash
npm install package-name -w burrow-cash

# To proximity-wallet-connect
npm install package-name -w proximity-wallet-connect

# To proximity-dex-core
npm install package-name -w proximity-dex-core
```

## How It Works

### 1. Root package.json
Defines workspaces - tells npm to link local packages:
```json
{
  "workspaces": [
    "burrow-cash",
    "proximity-dex-core",
    "proximity-wallet-connect"
  ]
}
```

### 2. workspace:* Protocol
In burrow-cash/package.json:
```json
{
  "dependencies": {
    "proximity-dex-core": "workspace:*",
    "proximity-wallet-connect": "workspace:*"
  }
}
```

This tells npm to use the local workspace version.

### 3. transpilePackages
In burrow-cash/next.config.js:
```js
{
  transpilePackages: ['proximity-dex-core', 'proximity-wallet-connect']
}
```

This tells Next.js to compile these packages (they're in TypeScript/modern JS).

## Troubleshooting

### Changes not appearing?

1. **Rebuild the package**:
   ```bash
   cd proximity-wallet-connect
   npm run build
   ```

2. **Hard refresh browser**: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)

3. **Clear Next.js cache**:
   ```bash
   cd burrow-cash
   rm -rf .next
   npm run dev
   ```

### Module not found errors?

```bash
# Clean reinstall
npm run fresh-install
```

### Still having issues?

```bash
# Nuclear option
rm -rf node_modules burrow-cash/node_modules proximity-*/node_modules
rm -rf burrow-cash/.next
npm cache clean --force
npm install
```

## Version Identification

The wallet-connect package logs its version on load:
```
🔥 WALLET-CONNECT VERSION: v3-UINT8ARRAY-FIX-2024-10-06-22:30
```

Look for this in the browser console to confirm you're running the latest code.

## Benefits Over Previous Setup

| Old Method | New Method (Monorepo) |
|------------|----------------------|
| Manual copying after every change | Automatic via symlinks |
| Cache issues constantly | Symlinks prevent caching |
| Multiple npm installs | Single install at root |
| Hard to track versions | workspace:* is always latest |
| Slow iteration | Fast iteration |

##Publishing

When ready to publish packages:

1. Build packages: `npm run build -ws`
2. Update version in package.json
3. Publish: `npm publish` (from package directory)

Note: The `workspace:*` protocol is converted to real version numbers during publish.

