# Simple Node.js Example with chainsig.js

A basic example showing how to use modern JavaScript syntax (import statements) with chainsig.js in Node.js using TypeScript and ts-node.

## What this shows

- Modern import syntax works with chainsig.js
- TypeScript handles CommonJS compatibility automatically
- Simple one-command execution
- All exports are accessible and typed

## Quick start

```bash
cd simple-node-example
npm install
npm start
```

## How it works

You write modern syntax:
```typescript
import { chainAdapters, constants } from 'chainsig.js';
```

ts-node automatically transpiles it to:
```javascript
const { chainAdapters, constants } = require('chainsig.js');
```


## Benefits

- Write modern code with import/export syntax
- No complex build process
- Full TypeScript support
- Works with chainsig.js without compatibility issues
- Dependencies stay external (no bundling)

## Alternative: Compile to JavaScript

Add to package.json:
```json
{
  "scripts": {
    "build": "tsc",
    "start:compiled": "node dist/index.js"
  }
}
```

Then run:
```bash
npm run build
npm run start:compiled
```
