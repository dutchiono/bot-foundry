import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface RunningBot {
  workspaceDir: string
  pid: number
  username?: string
  startedAt: string
}

const running = new Map<string, RunningBot>()

export function isBotToken(text: string): boolean {
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(text.trim())
}

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: true,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

function writeEnvFile(absWorkspace: string, token: string): void {
  const envExample = path.join(absWorkspace, '.env.example')
  const envPath = path.join(absWorkspace, '.env')

  let content = fs.existsSync(envExample)
    ? fs.readFileSync(envExample, 'utf8')
    : 'BOT_TOKEN=\n'

  const setVar = (name: string) => {
    const re = new RegExp(`^${name}=.*$`, 'm')
    if (re.test(content)) {
      content = content.replace(re, `${name}=${token}`)
    } else {
      content += `\n${name}=${token}`
    }
  }

  setVar('BOT_TOKEN')
  setVar('TELEGRAM_BOT_TOKEN')

  fs.writeFileSync(envPath, content.trim() + '\n', 'utf8')
}

async function fetchBotUsername(token: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = await res.json() as { ok?: boolean; result?: { username?: string } }
    return data.ok ? data.result?.username : undefined
  } catch {
    return undefined
  }
}

export function getRunningBot(workspaceDir: string): RunningBot | undefined {
  return running.get(workspaceDir)
}

export function listRunningBots(): RunningBot[] {
  return [...running.values()]
}

export async function stopLocalBot(workspaceDir: string): Promise<boolean> {
  const entry = running.get(workspaceDir)
  if (!entry) return false
  try {
    process.kill(entry.pid)
  } catch {
    // already dead
  }
  running.delete(workspaceDir)
  return true
}

export async function startLocalBot(
  workspaceDir: string,
  token: string,
): Promise<{ success: boolean; message: string; username?: string }> {
  const abs = path.resolve(process.cwd(), workspaceDir)
  if (!fs.existsSync(abs)) {
    return { success: false, message: `Workspace not found: ${abs}` }
  }

  if (!fs.existsSync(path.join(abs, 'package.json'))) {
    return { success: false, message: 'No package.json in workspace — scaffold may have failed.' }
  }

  await stopLocalBot(workspaceDir)
  writeEnvFile(abs, token)

  try {
    await runCommand('npm', ['install'], abs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: `npm install failed: ${msg}` }
  }

  const username = await fetchBotUsername(token)

  const child = spawn('npm', ['run', 'dev'], {
    cwd: abs,
    shell: true,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      BOT_TOKEN: token,
      TELEGRAM_BOT_TOKEN: token,
    },
  })

  child.unref()

  if (!child.pid) {
    return { success: false, message: 'Failed to start bot process.' }
  }

  running.set(workspaceDir, {
    workspaceDir,
    pid: child.pid,
    username,
    startedAt: new Date().toISOString(),
  })

  const who = username ? `@${username}` : 'your bot'
  return {
    success: true,
    username,
    message: `✅ Started ${who} on this machine (pid ${child.pid}).\n\nOpen Telegram and message ${who} — it's live as long as this process runs.`,
  }
}
