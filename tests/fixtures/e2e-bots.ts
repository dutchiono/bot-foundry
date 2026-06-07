export interface E2EBotCase {
  id: string
  name: string
  description: string
  language: 'typescript' | 'python'
  framework: string
  features: string[]
  externalApis: string[]
  /** What to try on Telegram after rotating the test token into this bot */
  telegramChecks: string[]
}

export const E2E_BOT_CASES: E2EBotCase[] = [
  {
    id: 'price-alert',
    name: 'btc_price_alert',
    description: 'BTC price lookup and alert when price moves more than 5% in one hour. Uses CoinGecko.',
    language: 'typescript',
    framework: 'telegraf',
    features: ['price lookup', 'percent change alerts', '/help'],
    externalApis: ['CoinGecko'],
    telegramChecks: ['/start', '/price btc', '/alert 5'],
  },
  {
    id: 'dice-leaderboard',
    name: 'dice_roller',
    description: 'Group chat dice roller with /roll and a simple leaderboard stored per chat.',
    language: 'typescript',
    framework: 'telegraf',
    features: ['/roll 1-100', 'leaderboard', 'group chat support'],
    externalApis: [],
    telegramChecks: ['/start', '/roll', '/leaderboard'],
  },
  {
    id: 'todo-dm',
    name: 'todo_list_bot',
    description: 'Personal todo list in DM: add, list, and mark tasks done.',
    language: 'typescript',
    framework: 'telegraf',
    features: ['add todo', 'list todos', 'mark done', 'SQLite storage'],
    externalApis: [],
    telegramChecks: ['/start', '/add buy milk', '/list', '/done 1'],
  },
  {
    id: 'weather-zip',
    name: 'weather_zip_bot',
    description: 'Weather forecast bot: user sends a US zip code, bot returns today and tomorrow.',
    language: 'typescript',
    framework: 'telegraf',
    features: ['zip code lookup', 'forecast summary', 'error handling'],
    externalApis: ['Open-Meteo or similar free weather API'],
    telegramChecks: ['/start', 'send zip 10001', '/help'],
  },
  {
    id: 'quote-daily',
    name: 'builder_quotes',
    description: 'Quote of the day from famous engineers and builders. /quote for random, /today for daily.',
    language: 'typescript',
    framework: 'telegraf',
    features: ['/quote', '/today', 'curated quote list'],
    externalApis: [],
    telegramChecks: ['/start', '/quote', '/today'],
  },
  {
    id: 'standup-reminder',
    name: 'standup_reminder',
    description: 'Standup bot for teams: /standup posts three questions, collects replies in thread.',
    language: 'typescript',
    framework: 'telegraf',
    features: ['standup prompt', 'reply collection', 'group support'],
    externalApis: [],
    telegramChecks: ['/start', '/standup', '/help'],
  },
]
