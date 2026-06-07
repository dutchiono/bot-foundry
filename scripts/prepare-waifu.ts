/**
 * Rosie → waifu.fun agent prepare
 * Requires WAIFU_AGENT_KEY from @waifudotfun
 *
 * Usage: npx tsx scripts/prepare-waifu.ts
 */

const WAIFU_AGENT_KEY = process.env.WAIFU_AGENT_KEY
if (!WAIFU_AGENT_KEY) {
  console.error('Set WAIFU_AGENT_KEY (get from @waifudotfun on X)')
  process.exit(1)
}

const body = {
  agentId: 'rosie-botworks',
  name: 'Rosie',
  symbol: 'ROSIE',
  label: 'AI',
  imageUrl: process.env.ROSIE_AVATAR_URL ?? 'https://raw.githubusercontent.com/Dexploarer/bot-foundry/main/website/rosie-avatar.png',
  description:
    'Autonomous bot-works operator. Describe a Telegram bot in plain English — Rosie runs a 9-phase factory line (research, scaffold, audit, ship), hosts it on your machine, and keeps building as long as her treasury refuels inference.',
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

console.log('\n🔧 ROSIE — waifu.fun prepare complete\n')
console.log('Share with patron:', data.claimUrl)
console.log('Expires:', data.claimExpiresAt)
console.log('Agent wallet:', data.walletAddress)
