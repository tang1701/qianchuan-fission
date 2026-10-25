import crypto from 'node:crypto'
import { app } from 'electron'
import { LICENSE_GATED_FEATURES, TRIAL_TASK_LIMIT } from './constants'
import { verifyActivationCode } from './codec'
import { formatMachineCode, getMachineId } from './machineId'
import { LicenseStore } from './store'

export type LicenseStatus = {
  machineCode: string
  mode: 'trial' | 'licensed' | 'expired'
  trialUsed: number
  trialLimit: number
  trialRemaining: number
  expiresAt: number | null
  enforce: boolean
}

function shouldEnforceLicense(): boolean {
  if (process.env.EAUTO_SKIP_LICENSE === '1') return false
  if (process.env.EAUTO_LICENSE_ENFORCE === '1') return true
  return app.isPackaged
}

function machineSecret(machineId: string): string {
  return crypto.createHash('sha256').update(`eauto-license|${machineId}|v1`, 'utf8').digest('hex')
}

export function createLicenseService() {
  const machineId = getMachineId()
  const store = new LicenseStore(app.getPath('userData'), machineSecret(machineId))

  async function resolveMode(st: { trialTasksUsed: number; activationCode?: string }): Promise<{
    mode: LicenseStatus['mode']
    expiresAt: number | null
  }> {
    if (st.activationCode) {
      const v = verifyActivationCode(st.activationCode, machineId)
      if (v.ok) return { mode: 'licensed', expiresAt: v.expMs }
      return { mode: 'expired', expiresAt: null }
    }
    return { mode: 'trial', expiresAt: null }
  }

  async function getStatus(): Promise<LicenseStatus> {
    const st = await store.load()
    const { mode, expiresAt } = await resolveMode(st)
    const trialUsed = st.trialTasksUsed
    const trialRemaining = Math.max(0, TRIAL_TASK_LIMIT - trialUsed)
    return {
      machineCode: formatMachineCode(machineId),
      mode,
      trialUsed,
      trialLimit: TRIAL_TASK_LIMIT,
      trialRemaining,
      expiresAt,
      enforce: shouldEnforceLicense(),
    }
  }

  async function activate(code: string): Promise<{ ok: true; expiresAt: number } | { ok: false; error: string }> {
    const v = verifyActivationCode(code, machineId)
    if (!v.ok) return { ok: false, error: v.reason }
    const st = await store.load()
    st.activationCode = code.trim()
    await store.save(st)
    return { ok: true, expiresAt: v.expMs }
  }

  async function assertCanProcess(featureId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!shouldEnforceLicense()) return { ok: true }
    if (!LICENSE_GATED_FEATURES.has(featureId)) return { ok: true }

    const st = await store.load()
    const { mode } = await resolveMode(st)
    if (mode === 'licensed') return { ok: true }

    const used = st.trialTasksUsed
    if (used >= TRIAL_TASK_LIMIT) {
      return {
        ok: false,
        error: `试用已用完（共 ${TRIAL_TASK_LIMIT} 次任务）。请将机器码发给作者获取激活码后再裂变。`,
      }
    }
    return { ok: true }
  }

  async function recordSuccessfulJob(featureId: string): Promise<void> {
    if (!shouldEnforceLicense()) return
    if (!LICENSE_GATED_FEATURES.has(featureId)) return

    const st = await store.load()
    const { mode } = await resolveMode(st)
    if (mode === 'licensed') return
    st.trialTasksUsed = Math.min(TRIAL_TASK_LIMIT + 999, st.trialTasksUsed + 1)
    await store.save(st)
  }

  return { getStatus, activate, assertCanProcess, recordSuccessfulJob, getMachineId: () => machineId }
}

let singleton: ReturnType<typeof createLicenseService> | null = null

export function getLicenseService() {
  if (!singleton) singleton = createLicenseService()
  return singleton
}
