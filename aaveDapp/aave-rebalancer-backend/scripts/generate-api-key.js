#!/usr/bin/env node

/**
 * Generate secure API key for admin authentication
 * Run: node scripts/generate-api-key.js
 */

const crypto = require('crypto');

function generateSecureApiKey() {
  // Generate 32 random bytes and convert to base64
  const randomBytes = crypto.randomBytes(32);
  const apiKey = randomBytes.toString('base64').replace(/[+/=]/g, '').substring(0, 48);
  
  return apiKey;
}

function main() {
  const apiKey = generateSecureApiKey();
  
  console.log('🔑 Generated secure admin API key:');
  console.log('');
  console.log(`ADMIN_API_KEY=${apiKey}`);
  console.log('');
  console.log('📋 Instructions:');
  console.log('1. Copy this key to your environment variables');
  console.log('2. Keep it secure - anyone with this key has admin access');
  console.log('3. Use it in the X-API-Key header for admin operations');
  console.log('');
  console.log('🧪 Test with curl:');
  console.log(`curl -X POST https://your-api-domain.com/trigger/data-collection \\`);
  console.log(`  -H "X-API-Key: ${apiKey}" \\`);
  console.log(`  -H "Content-Type: application/json"`);
  console.log('');
  console.log('🔒 GraphQL admin mutations:');
  console.log(`curl -X POST https://your-api-domain.com/graphql \\`);
  console.log(`  -H "X-API-Key: ${apiKey}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"query":"mutation { collectAaveData }"}'`);
  console.log('');
  console.log('⚠️  Store this key securely - it will not be shown again!');
}

if (require.main === module) {
  main();
}

module.exports = { generateSecureApiKey }; 