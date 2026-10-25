import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

type StoredState = {
  trialTasksUsed: number
  activationCode?: string
}

type Envelope = { d: string; s: string }

function stateHmac(secret: string, dataB64: string): string {
  return crypto.createHmac('sha256', secret).update(dataB64, 'utf8').digest('base64url')
}

export class LicenseStore {
  private filePath: string
  private secret: string
  private cache: StoredState | null = null

  constructor(userDataPath: string, machineSecret: string) {
    this.filePath = path.join(userDataPath, 'license-state.dat')
    this.secret = machineSecret
  }

  private encode(state: StoredState): Envelope {
    const d = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url')
    return { d, s: stateHmac(this.secret, d) }
  }

  private decode(env: Envelope): StoredState | null {
    if (stateHmac(this.secret, env.d) !== env.s) return null
    try {
      return JSON.parse(Buffer.from(env.d, 'base64url').toString('utf8')) as StoredState
    } catch {
      return null
    }
  }

  async load(): Promise<StoredState> {
    if (this.cache) return this.cache
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const env = JSON.parse(raw) as Envelope
      const st = this.decode(env)
      if (st) {
        const legacy = (st as { trialVideosUsed?: number }).trialVideosUsed
        const tasks =
          st.trialTasksUsed ??
          (legacy != null ? Math.min(3, Number(legacy) || 0) : 0)
        this.cache = {
          trialTasksUsed: Math.max(0, Math.min(9999, Number(tasks) || 0)),
          activationCode: typeof st.activationCode === 'string' ? st.activationCode : undefined,
        }
        return this.cache
      }
    } catch {
      /* 首次运行 */
    }
    this.cache = { trialTasksUsed: 0 }
    return this.cache
  }

  async save(state: StoredState): Promise<void> {
    this.cache = state
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(this.encode(state)), 'utf8')
  }
}
