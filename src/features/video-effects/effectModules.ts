export type FxModuleTab = 'effects' | 'sticker'

export interface FxEffectModule {
  id: string
  tab: FxModuleTab
  title: string
  desc: string
  icon: string
}

export type FxModuleId =
  | 'audio'
  | 'cover'
  | 'intro'
  | 'scrub'
  | 'pip'
  | 'picture'
  | 'pixel'
  | 'mirror'
  | 'speed'
  | 'bg'
  | 'text-wm'
  | 'image-wm'
  | 'remove-wm'
  | 'fission'

export function defaultFxModuleEnabled(): Record<FxModuleId, boolean> {
  return {
    audio: false,
    cover: false,
    intro: false,
    scrub: false,
    pip: false,
    picture: false,
    pixel: false,
    mirror: false,
    speed: false,
    bg: false,
    'text-wm': false,
    'image-wm': false,
    'remove-wm': false,
    fission: false,
  }
}

export function smartFxModuleEnabled(): Record<FxModuleId, boolean> {
  const m = defaultFxModuleEnabled()
  for (const k of Object.keys(m) as FxModuleId[]) m[k] = true
  // 动态底纹易与手动裁剪冲突，智能配置默认关闭（可手动开）
  m.bg = false
  return m
}

/** 主效果区（与线框「效果设置」一致） */
export const fxEffectModules: FxEffectModule[] = [
  { id: 'audio', tab: 'effects', title: '音频设置', desc: '原声 / BGM / 音量', icon: '♪' },
  { id: 'cover', tab: 'effects', title: '视频封面', desc: '截取封面与缩略图', icon: '▣' },
  { id: 'intro', tab: 'effects', title: '入场效果', desc: '片头淡入 / 开场', icon: '◷' },
  { id: 'scrub', tab: 'effects', title: '视频填充', desc: '区域涂除 / 填充 / 去水印', icon: '▦' },
  { id: 'pip', tab: 'effects', title: '画中画', desc: '小窗叠加 / 角标', icon: '⊡' },
  { id: 'picture', tab: 'effects', title: '画面调整', desc: '亮度 / 对比度 / 饱和', icon: '☼' },
  { id: 'pixel', tab: 'effects', title: '像素融合', desc: '噪点 / 差异化', icon: '⁘' },
  { id: 'mirror', tab: 'effects', title: '旋转镜像', desc: '翻转 / 旋转 / 去黑边', icon: '↻' },
  { id: 'speed', tab: 'effects', title: '视频变速', desc: '全局或分段变速', icon: '»' },
  { id: 'bg', tab: 'effects', title: '动态缩放', desc: '黑边模糊底纹 / 画幅填充', icon: '≋' },
  { id: 'text-wm', tab: 'sticker', title: '文字水印', desc: '角标文字', icon: 'T' },
  { id: 'image-wm', tab: 'sticker', title: '图片水印', desc: 'PNG / JPG 贴图', icon: '⌘' },
  { id: 'remove-wm', tab: 'sticker', title: '去水印', desc: '框选 / 智能修复', icon: '⌧' },
  { id: 'fission', tab: 'sticker', title: '裂变差异化', desc: '每条多版本输出', icon: '⑂' },
]

export function fxModulesForSettingsRail() {
  return fxEffectModules.filter((m) => m.id !== 'fission')
}
