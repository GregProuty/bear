# Check Fireblocks Access Key Permissions

To verify what permissions a Fireblocks NEAR account has:

## Method 1: RPC Query (Quick)

```bash
curl -s https://near.lava.build -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0",
  "id":"dontcare",
  "method":"query",
  "params":{
    "request_type":"view_access_key_list",
    "finality":"final",
    "account_id":"YOUR_ACCOUNT_ID_HERE"
  }
}' | jq '.result.keys[] | {public_key: .public_key, permission: .access_key.permission}'
```

Replace `YOUR_ACCOUNT_ID_HERE` with the actual account ID.

## What to Look For

### ✅ FullAccess Key (Good for Staking)
```json
{
  "public_key": "ed25519:...",
  "permission": "FullAccess"
}
```
**This can stake to ANY validator!**

### ❌ FunctionCall Key (Limited - Your Current Key)
```json
{
  "public_key": "ed25519:AZ48fNH9wFSum5JJvLnBBxQmnvwKFdW7KvUMCEkMtbz6",
  "permission": {
    "FunctionCall": {
      "receiver_id": "contract.main.burrow.near"
    }
  }
}
```
**This can ONLY call `contract.main.burrow.near`**

## Your Account's Keys

Your account `47e6c413ca116b49411d4e471fc94bc52675a53165db3a0db0ed9f0552e2e3e5` has:

1. ✅ **FullAccess key**: `ed25519:5qg39o1agVoQaJZH4RQAnKjNqyDrUuKpctrRSNy5o9et`
2. ❌ **Limited key** (currently used by Fireblocks): `ed25519:AZ48fNH9wFSum5JJvLnBBxQmnvwKFdW7KvUMCEkMtbz6`

## Solution

Ask your Fireblocks admin to configure Fireblocks to use the **FullAccess key** (`5qg39o1agVoQaJZH4RQAnKjNqyDrUuKpctrRSNy5o9et`) instead of the limited one.

