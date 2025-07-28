# 🔒 API Key Authentication Implementation

This document explains how to implement and use the API key authentication system for admin endpoints.

## Overview

The API key authentication system protects admin endpoints from unauthorized access. It covers:
- REST admin endpoints (`/migrate`, `/trigger/*`)
- GraphQL admin mutations (`collectAaveData`, `calculatePerformance`, etc.)

## Implementation Steps

### 1. Generate API Key

```bash
# Generate a secure API key
node scripts/generate-api-key.js
```

This will output something like:
```
🔑 Generated secure admin API key:

ADMIN_API_KEY=AbCdEf1234567890XyZwVuTsRqPoNmLkJiHgFeDcBa123456

📋 Instructions:
1. Copy this key to your environment variables
2. Keep it secure - anyone with this key has admin access  
3. Use it in the X-API-Key header for admin operations
```

### 2. Set Environment Variable

#### Local Development (.env)
```bash
ADMIN_API_KEY=AbCdEf1234567890XyZwVuTsRqPoNmLkJiHgFeDcBa123456
```

#### Production (Railway/Vercel)
Add the environment variable in your hosting platform:
- **Railway**: Project Settings → Variables → Add `ADMIN_API_KEY`
- **Vercel**: Project Settings → Environment Variables → Add `ADMIN_API_KEY`

### 3. Deploy Changes

```bash
git add .
git commit -m "Implement API key authentication for admin endpoints"
git push
```

## Usage

### REST Endpoints

#### ✅ With API Key (Authorized)
```bash
curl -X POST https://your-api-domain.com/trigger/data-collection \
  -H "X-API-Key: AbCdEf1234567890XyZwVuTsRqPoNmLkJiHgFeDcBa123456" \
  -H "Content-Type: application/json"
```

#### ❌ Without API Key (Unauthorized)
```bash
curl -X POST https://your-api-domain.com/trigger/data-collection \
  -H "Content-Type: application/json"

# Response:
{
  "error": "Unauthorized", 
  "message": "API key required. Include X-API-Key header."
}
```

#### ❌ Invalid API Key (Unauthorized)
```bash
curl -X POST https://your-api-domain.com/trigger/data-collection \
  -H "X-API-Key: invalid-key" \
  -H "Content-Type: application/json"

# Response:
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

### GraphQL Admin Mutations

#### ✅ With API Key (Authorized)
```bash
curl -X POST https://your-api-domain.com/graphql \
  -H "X-API-Key: AbCdEf1234567890XyZwVuTsRqPoNmLkJiHgFeDcBa123456" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { collectAaveData }"}'
```

#### ❌ Without API Key (Unauthorized)
```bash
curl -X POST https://your-api-domain.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { collectAaveData }"}'

# Response:
{
  "errors": [{
    "message": "Unauthorized: Admin API key required for this operation. Include X-API-Key header."
  }],
  "data": null
}
```

### Public Operations (No Auth Required)

These operations remain public and don't require API keys:

```bash
# Health check
curl https://your-api-domain.com/health

# Read-only GraphQL queries
curl -X POST https://your-api-domain.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ aavePoolData(chainName: \"base\") { supplyAPY } }"}'

# Cron status
curl https://your-api-domain.com/cron/status
```

## Protected Operations

### REST Endpoints
- `POST /migrate` - Database migration
- `POST /trigger/data-collection` - Manual data collection
- `POST /trigger/performance-calculation` - Manual performance calculation

### GraphQL Mutations
- `collectAaveData` - Collect AAVE pool data
- `collectVaultData` - Collect vault data
- `calculatePerformance` - Calculate daily performance
- `debugEthereum` - Debug Ethereum data collection
- `testElasticityModel` - Test elasticity model
- `updateBaselineAllocation` - Update baseline allocation

## Security Features

### 🔐 Secure Key Generation
- 32 random bytes, base64 encoded
- 48 character length
- Cryptographically secure random generation

### 📊 Access Logging
All authentication attempts are logged:
```
INFO: Admin endpoint access authorized { ip: "1.2.3.4", url: "/migrate" }
WARN: Admin endpoint access attempted without API key { ip: "1.2.3.4", url: "/migrate" }
WARN: Admin endpoint access attempted with invalid API key { ip: "1.2.3.4", providedKey: "invalid..." }
```

### 🛡️ Security Measures
- No API key exposure in logs (only first 8 characters)
- IP address tracking for all attempts
- User agent logging for forensics
- Graceful error handling with informative messages

## Troubleshooting

### Problem: "Server configuration error"
**Solution**: `ADMIN_API_KEY` environment variable not set
```bash
# Check if variable is set
echo $ADMIN_API_KEY

# Set it if missing
export ADMIN_API_KEY=your-generated-key
```

### Problem: Operations still work without API key
**Solution**: Clear deployment cache and redeploy
```bash
git commit --allow-empty -m "Force redeploy with auth"
git push
```

### Problem: API key not working
**Checklist**:
1. ✅ Environment variable set correctly
2. ✅ No extra spaces in the key
3. ✅ Using `X-API-Key` header (case sensitive)
4. ✅ Deployment completed successfully

## Key Rotation

To rotate the API key:
1. Generate new key: `node scripts/generate-api-key.js`
2. Update environment variable
3. Update all clients using the old key
4. Deploy changes

## Next Steps

After implementing API key auth, consider:
1. **Input validation** with Zod schemas (Week 1)
2. **GraphQL depth limiting** (Week 2)  
3. **Request rate limiting** (Week 2)
4. **CORS hardening** (Week 2) 