/** 保证左侧模块开关与导出参数一致，避免「开了开关但没写入 FFmpeg」 */
export function normalizeFxJobOptions(
  options: Record<string, unknown>,
  modules: Record<string, boolean>,
): void {
  const on = (k: string) => Boolean(modules[k])
  if (on('scrub') || on('removeWm') || on('remove-wm')) {
    options.removeWatermark = true
  }
  if (on('textWm') || on('text-wm')) {
    options.addTextWatermark = true
    const list = options.fxTextOverlays
    const hasText =
      Array.isArray(list) &&
      list.some(
        (o) => o && typeof o === 'object' && String((o as Record<string, unknown>).text ?? '').trim(),
      )
    if (!hasText && !String(options.watermarkText ?? '').trim()) {
      options.watermarkText = 'ECutAuto'
    }
  }
  if (on('pip')) options.fxAddVideoWatermark = true
  if (on('imageWm') || on('image-wm')) options.fxAddImageWatermark = true
  if (on('audio')) options.keepOriginalAudio = true

  if (on('intro') && Number(options.fxIntroFadeSec ?? 0) <= 0) {
    options.fxIntroFadeSec = 0.6
  }
  if (on('speed') && Number(options.fxSpeedRate ?? 100) === 100) {
    options.fxSpeedRate = 110
  }
  if (on('pixel') && Number(options.fxNoiseAmount ?? 0) <= 0) {
    options.fxNoiseAmount = 4
  }
  if (
    on('picture') &&
    Number(options.fxSaturation ?? 100) === 100 &&
    Number(options.fxContrast ?? 100) === 100
  ) {
    options.fxSaturation = 112
  }
  if (on('mirror')) {
    options.removeBlackBar = options.removeBlackBar !== false
  }
}
