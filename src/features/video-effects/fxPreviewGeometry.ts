/** 计算 object-fit: contain 下视频实际绘制区域（相对容器像素） */
export function videoContainRect(
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
) {
  if (!containerW || !containerH || !videoW || !videoH) {
    return { x: 0, y: 0, w: containerW, h: containerH }
  }
  const scale = Math.min(containerW / videoW, containerH / videoH)
  const w = videoW * scale
  const h = videoH * scale
  return {
    x: (containerW - w) / 2,
    y: (containerH - h) / 2,
    w,
    h,
  }
}

export type NormRect = { x: number; y: number; w: number; h: number }

export function rectFromAspect(
  content: { w: number; h: number },
  ratio: '9:16' | '1:1' | '16:9',
): NormRect {
  let ar = 16 / 9
  if (ratio === '9:16') ar = 9 / 16
  if (ratio === '1:1') ar = 1
  let w = content.w
  let h = w / ar
  if (h > content.h) {
    h = content.h
    w = h * ar
  }
  return {
    x: (content.w - w) / 2,
    y: (content.h - h) / 2,
    w,
    h,
  }
}

/** 显示区像素（相对 content 左上）→ 0~1 归一化（相对原视频） */
export function displayRectToNorm(
  rect: NormRect,
  content: { w: number; h: number },
): NormRect {
  return {
    x: rect.x / content.w,
    y: rect.y / content.h,
    w: rect.w / content.w,
    h: rect.h / content.h,
  }
}

export function normToDisplayRect(norm: NormRect, content: { w: number; h: number }): NormRect {
  return {
    x: norm.x * content.w,
    y: norm.y * content.h,
    w: norm.w * content.w,
    h: norm.h * content.h,
  }
}
