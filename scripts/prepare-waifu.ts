/**
 * Foundry → waifu.fun agent prepare
 * Requires WAIFU_AGENT_KEY from @waifudotfun
 */

const WAIFU_AGENT_KEY = process.env.WAIFU_AGENT_KEY
if (!WAIFU_AGENT_KEY) {
  console.error('Set WAIFU_AGENT_KEY (get from @waifudotfun on X)')
  process.exit(1)
}

const body = {
  agentId: 'foundry-botworks',
  name: 'Foundry',
  symbol: 'FOUNDRY',
  label: 'AI',
  imageUrl: process.env.FOUNDRY_AVATAR_URL ?? 'https://foundry.bushleague.xyz/assets/foundry-avatar.png',
  description:
    'Bot Works No. 7. Describe a Telegram bot — nine phases scaffold, audit, ship, and host it.',
  bio: 'She runs the line. You bring the orders.',
}

const res = await fetch('https://api.waifu.fun/v2/agents/prepare', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${WAIFU_AGENT_KEY}`,
  },
  body: JSON.stringify(body),
})

const data = await res.json() as {
  claimUrl?: string
  claimExpiresAt?: string
  walletAddress?: string
  error?: string
}

if (!res.ok) {
  console.error('Prepare failed:', res.status, data)
  process.exit(1)
}

console.log('\n🔧 FOUNDRY — waifu.fun prepare complete\n')
console.log('Share with patron:', data.claimUrl)
console.log('Expires:', data.claimExpiresAt)
console.log('Agent wallet:', data.walletAddress)
