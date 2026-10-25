import type { EautoDesktopApi } from '../types/eauto'

export function getDesktopApi(): EautoDesktopApi | null {
  if (typeof window !== 'undefined' && window.eauto?.isDesktop) return window.eauto
  return null
}

export function isDesktopApp(): boolean {
  return getDesktopApi() != null
}
