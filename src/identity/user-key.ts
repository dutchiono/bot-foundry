export type Platform = 'telegram' | 'discord'

export function platformKey(platform: Platform, id: string | number): string {
  return `${platform === 'telegram' ? 'tg' : 'dc'}:${id}`
}

export function parsePlatformKey(userKey: string): { platform: Platform; id: string } | null {
  const m = userKey.match(/^(tg|dc):(.+)$/)
  if (!m) return null
  return { platform: m[1] === 'tg' ? 'telegram' : 'discord', id: m[2] }
}
