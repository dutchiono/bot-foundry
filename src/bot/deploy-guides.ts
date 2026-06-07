import path from 'node:path'
import { escapeMarkdown } from './format.js'

function resolveWorkspaceAbs(workspaceDir: string): string {
  return path.resolve(process.cwd(), workspaceDir)
}

function whereIsWorkspace(absPath: string, target: DeployTarget): string {
  const p = escapeMarkdown(absPath)
  const openHint =
    target === 'windows'
      ? `Press Win+R, paste the path, Enter — or in PowerShell: \`cd "${absPath.replace(/\\/g, '\\\\')}"\``
      : target === 'mac'
        ? `In Finder: Cmd+Shift+G, paste the path. Or Terminal: \`cd "${absPath}"\``
        : `Terminal: \`cd "${absPath}"\``

  return `*Where is this?*
The bot code is on *your computer* — the same machine running Bot Foundry and OpenCode. It is not inside Telegram.

*Full path:*
\`${p}\`

${openHint}`
}

export type DeployTarget = 'windows' | 'mac' | 'linux' | 'docker' | 'fly' | 'railway'

export function isLocalHostTarget(target: DeployTarget): boolean {
  return target === 'windows' || target === 'mac' || target === 'linux'
}

export function parseDeployChoice(text: string): DeployTarget | null {
  const t = text.trim().toLowerCase()
  const first = t.split(/\s+/)[0]

  // Keywords win over bare numbers — "4 on windows" → windows, not docker
  if (/\bwindows?\b/.test(t) || /\bwin\b/.test(t)) return 'windows'
  if (/\bmac\b/.test(t) || /\bmacos\b/.test(t) || /\bosx\b/.test(t)) return 'mac'
  if (/\blinux\b/.test(t) || /\bwsl\b/.test(t) || /\bubuntu\b/.test(t) || /\bvps\b/.test(t)) return 'linux'
  if (/\bdocker\b/.test(t) || /\bcontainer\b/.test(t)) return 'docker'
  if (/\bfly\b/.test(t)) return 'fly'
  if (/\brailway\b/.test(t)) return 'railway'

  if (first === '1') return 'windows'
  if (first === '2') return 'mac'
  if (first === '3') return 'linux'
  if (first === '4') return 'docker'
  if (first === '5') return 'fly'
  if (first === '6') return 'railway'

  return null
}

export function deployMenuText(botName: string): string {
  return `🚀 *Ready to deploy*: ${escapeMarkdown(botName)}

*Run locally:*
1. *Windows* — Node.js on your PC
2. *macOS* — Node.js on your Mac
3. *Linux* — Node.js on Linux or WSL

*Other:*
4. *Docker* — works on Windows, Mac, or Linux
5. *Fly.io* — cloud hosting
6. *Railway* — cloud hosting

Reply with a number or name (e.g. \`1\`, \`windows\`, \`docker\`).`
}

export function deployGuide(target: DeployTarget, workspaceDir: string, botName: string): string {
  const absPath = resolveWorkspaceAbs(workspaceDir)
  const name = escapeMarkdown(botName)

  const tokenNote = 'Create a *new* bot in @BotFather, then paste its token here — Foundry will start it on this machine for you.'

  switch (target) {
    case 'windows':
      return `🪟 *Host on this Windows PC* — ${name}

${whereIsWorkspace(absPath, 'windows')}

*Foundry hosting:* paste your new bot's token in chat and I'll \`npm install\` + start it here automatically.

${tokenNote}

*Manual instead?* Open PowerShell:
\`\`\`
cd "${absPath}"
copy .env.example .env
notepad .env
npm install
npm run dev
\`\`\``

    case 'mac':
      return `🍎 *Host on this Mac* — ${name}

${whereIsWorkspace(absPath, 'mac')}

*Foundry hosting:* paste your new bot's token and I'll start it on this machine.

${tokenNote}

*Manual (Terminal):*
\`\`\`
cd "${absPath}"
cp .env.example .env
nano .env
npm install
npm run dev
\`\`\`

${tokenNote}

*Keep running:* use \`screen\`, \`tmux\`, or launchd for always-on.`

    case 'linux':
      return `🐧 *Host on this Linux machine* — ${name}

${whereIsWorkspace(absPath, 'linux')}

*Foundry hosting:* paste your new bot's token and I'll start it here.

${tokenNote}

*Manual:*
\`\`\`
cd "${absPath}"
cp .env.example .env
nano .env
npm install
npm run build
npm start
\`\`\`

${tokenNote}

*Always-on:* use systemd, pm2, or Docker. Works the same on Ubuntu VPS or WSL on Windows.`

    case 'docker':
      return `🐳 *Deploy with Docker* — ${name}

Works on Windows, Mac, and Linux.

${whereIsWorkspace(absPath, target)}

*Steps:*
\`\`\`
cd "${absPath}"
copy .env.example .env   # Windows
# cp .env.example .env  # Mac/Linux
# Set BOT_TOKEN in .env
docker build -t ${botName.replace(/[^a-z0-9-]/gi, '-').toLowerCase()} .
docker run --env-file .env ${botName.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}
\`\`\`

Or if \`docker-compose.yml\` exists:
\`\`\`
docker compose up -d
\`\`\`

${tokenNote}`

    case 'fly':
      return `✈️ *Deploy to Fly.io* — ${name}

${whereIsWorkspace(absPath, 'linux')}

*Steps:*
\`\`\`
cd "${absPath}"
fly auth login
fly launch    # if fly.toml exists, follow prompts
fly secrets set BOT_TOKEN=your_token
fly deploy
\`\`\`

${tokenNote}

Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/`

    case 'railway':
      return `🚂 *Deploy to Railway* — ${name}

${whereIsWorkspace(absPath, 'linux')}

*Steps:*
1. Push \`${escapeMarkdown(absPath)}\` to a GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Set \`BOT_TOKEN\` in Railway environment variables
4. Set start command: \`npm run build && npm start\`

${tokenNote}`
  }
}
