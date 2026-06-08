import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface RunningBot {
  workspaceDir: string
  pid: number
  username?: string
  startedAt: string
}

const running = new Map<string, RunningBot>()
const PID_FILE = path.join(process.cwd(), '.running-bots.json')

export interface StartLocalBotOptions {
  /** Attached to terminal — Ctrl+C stops the bot. Default false for Telegram deploy. */
  foreground?: boolean
}

function loadPersistedBots(): RunningBot[] {
  try {
    if (!fs.existsSync(PID_FILE)) return []
    return JSON.parse(fs.readFileSync(PID_FILE, 'utf8')) as RunningBot[]
  } catch {
    return []
  }
}

function savePersistedBots(): void {
  fs.writeFileSync(PID_FILE, JSON.stringify([...running.values()], null, 2), 'utf8')
}

function killProcessTree(pid: number): void {
  if (!pid || pid <= 0) return
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
    } else {
      process.kill(-pid, 'SIGTERM')
    }
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // already dead
    }
  }
}

function findPidsForWorkspace(absWorkspace: string): number[] {
  const pids: number[] = []
  try {
    if (process.platform === 'win32') {
      const escaped = absWorkspace.replace(/'/g, "''")
      const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${escaped}') } | Select-Object -ExpandProperty ProcessId`
      const out = execSync(`powershell -NoProfile -Command "${ps}"`, { encoding: 'utf8' })
      for (const line of out.split(/\r?\n/)) {
        const n = parseInt(line.trim(), 10)
        if (!isNaN(n)) pids.push(n)
      }
    }
  } catch {
    // fallback: tracked pid only
  }
  return [...new Set(pids)]
}

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

// Rehydrate in-memory map from disk (survives script exit)
for (const entry of loadPersistedBots()) {
  running.set(entry.workspaceDir, entry)
}

export function getRunningBot(workspaceDir: string): RunningBot | undefined {
  return running.get(workspaceDir)
}

export function listRunningBots(): RunningBot[] {
  return [...running.values()]
}

export async function stopLocalBot(workspaceDir: string): Promise<boolean> {
  const abs = path.resolve(process.cwd(), workspaceDir)
  let stopped = false

  const entry = running.get(workspaceDir)
  if (entry) {
    killProcessTree(entry.pid)
    running.delete(workspaceDir)
    stopped = true
  }

  for (const pid of findPidsForWorkspace(abs)) {
    killProcessTree(pid)
    stopped = true
  }

  if (stopped) savePersistedBots()
  return stopped
}

export async function stopAllLocalBots(): Promise<number> {
  let count = 0
  for (const entry of [...running.values()]) {
    if (await stopLocalBot(entry.workspaceDir)) count++
  }
  // Also scan workspace folders
  const wsRoot = path.join(process.cwd(), 'workspace')
  if (fs.existsSync(wsRoot)) {
    for (const dir of fs.readdirSync(wsRoot)) {
      if (dir.startsWith('bot-')) {
        const rel = `workspace/${dir}`
        if (!running.has(rel) && (await stopLocalBot(rel))) count++
      }
    }
  }
  if (running.size === 0 && fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE)
  }
  return count
}

export async function startLocalBot(
  workspaceDir: string,
  token: string,
  options?: StartLocalBotOptions,
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
  const foreground = options?.foreground === true
  const childEnv = {
    ...process.env,
    BOT_TOKEN: token,
    TELEGRAM_BOT_TOKEN: token,
  }

  if (foreground) {
    return new Promise(resolve => {
      console.log(`\n▶ Running ${workspaceDir} — Ctrl+C to stop\n`)
      const child = spawn('npm', ['run', 'dev'], {
        cwd: abs,
        shell: true,
        stdio: 'inherit',
        env: childEnv,
      })

      const cleanup = () => {
        if (child.pid) killProcessTree(child.pid)
        running.delete(workspaceDir)
        savePersistedBots()
      }

      const onSignal = () => {
        cleanup()
        process.exit(0)
      }
      process.once('SIGINT', onSignal)
      process.once('SIGTERM', onSignal)

      if (child.pid) {
        running.set(workspaceDir, {
          workspaceDir,
          pid: child.pid,
          username,
          startedAt: new Date().toISOString(),
        })
        savePersistedBots()
      }

      child.on('exit', code => {
        process.off('SIGINT', onSignal)
        process.off('SIGTERM', onSignal)
        cleanup()
        const who = username ? `@${username}` : 'bot'
        resolve({
          success: code === 0 || code === null,
          username,
          message: code === 0 || code === null
            ? `Stopped ${who}.`
            : `${who} exited with code ${code}`,
        })
      })
    })
  }

  const child = spawn('npm', ['run', 'dev'], {
    cwd: abs,
    shell: true,
    detached: process.platform !== 'win32',
    stdio: 'ignore',
    env: childEnv,
  })

  if (process.platform !== 'win32') {
    child.unref()
  }

  if (!child.pid) {
    return { success: false, message: 'Failed to start bot process.' }
  }

  running.set(workspaceDir, {
    workspaceDir,
    pid: child.pid,
    username,
    startedAt: new Date().toISOString(),
  })
  savePersistedBots()

  const who = username ? `@${username}` : 'your bot'
  return {
    success: true,
    username,
    message: `✅ Started ${who} (pid ${child.pid}).\n\nStop: npm run e2e:rotate:stop  or  npm run stop\nForeground (Ctrl+C): npm run e2e:run`,
  }
}
