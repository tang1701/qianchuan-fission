export type FxWatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface FxTextOverlayItem {
  id: string
  text: string
  position: FxWatermarkPosition
  norm: { x: number; y: number; w: number; h: number }
}

let textIdSeq = 0

export function newFxTextOverlayId(): string {
  textIdSeq += 1
  return `fx-txt-${Date.now()}-${textIdSeq}`
}

/** 角点预设 + 叠层微偏移，便于多条文本不重叠 */
export function normFromWatermarkPosition(
  pos: FxWatermarkPosition,
  stackIndex = 0,
): { x: number; y: number; w: number; h: number } {
  const d = Math.min(stackIndex * 0.035, 0.12)
  const w = 0.42
  const h = 0.12
  switch (pos) {
    case 'top-left':
      return { x: 0.04 + d, y: 0.04 + d, w, h }
    case 'top-right':
      return { x: 0.54 - d, y: 0.04 + d, w, h }
    case 'bottom-left':
      return { x: 0.04 + d, y: 0.72 - d, w, h }
    case 'bottom-right':
    default:
      return { x: 0.54 - d, y: 0.72 - d, w, h }
  }
}

export function createFxTextOverlay(index: number): FxTextOverlayItem {
  const positions: FxWatermarkPosition[] = [
    'top-right',
    'top-left',
    'bottom-left',
    'bottom-right',
  ]
  const position = positions[index % positions.length]!
  return {
    id: newFxTextOverlayId(),
    text: index === 0 ? 'ECutAuto' : `文字${index + 1}`,
    position,
    norm: normFromWatermarkPosition(position, index),
  }
}
