import type { FeatureItem } from '../types/feature'

/** 产品对外名称 */
export const APP_DISPLAY_NAME = '千川裂变神器'

export const features: FeatureItem[] = [
  {
    id: 'video-effects',
    title: APP_DISPLAY_NAME,
    tags: ['来源登记', '精确去重', '裂变导出'],
    description:
      '导入自有或已授权素材，核验通过后导出裂变版本。完全相同的文件会被拦住。巨量千川是否标成优质或首发，以平台回填为准。',
    category: 'creation',
    available: true,
    layout: 'effects-editor',
    primaryAction: '进入工作台',
  },
  {
    id: 'ai-mix',
    title: 'AI 智能混剪',
    tags: ['AI智能混剪', '语音合成', '批量成片', '视频理解'],
    description:
      '添加文案或音频，AI 自动从你的素材库中挑选最合适素材，自动合成配音，一键批量生成逻辑连贯的成片视频。',
    category: 'creation',
    available: false,
    layout: 'mix-editor',
    primaryAction: '开始批量成片',
  },
  {
    id: 'video-mix',
    title: '视频混剪',
    tags: ['视频混剪', '语音合成', '批量混剪', '随机重组'],
    description:
      '从文件夹抽取素材，随机组合混剪，自动匹配文案配音，一键批量生成混剪视频。',
    category: 'creation',
    available: false,
    layout: 'mix-editor',
    primaryAction: '开始批量混剪',
  },
  {
    id: 'category-mix',
    title: '分类混剪',
    tags: ['分类混剪', '语音合成', '批量混剪', '多文件夹'],
    description:
      '按分类文件夹自动组合混剪，拖拽排序分类文件夹，随机或顺序抽取素材，一键生成结构化混剪视频。',
    category: 'creation',
    available: false,
    layout: 'category-editor',
    primaryAction: '开始分类混剪',
  },
  {
    id: 'copy-rewrite',
    title: '文案改写',
    tags: ['AI改写', '文案优化', '批量改写'],
    description:
      '粘贴文案，AI 智能改写，支持自定义改写提示词，批量粘贴文案，一键生成差异化文案。',
    category: 'creation',
    available: false,
    layout: 'copy-tool',
    primaryAction: '开始批量改写',
  },
  {
    id: 'content-extract',
    title: '视频内容提炼',
    tags: ['视频切片', '直播切片', '精华提取', 'AI分析'],
    description:
      '从视频中提取有价值片段，支持批量导入、手动选择或 AI 智能分析，自定义 AI 提示词，一键生成新视频。',
    category: 'creation',
    available: false,
    layout: 'extract-editor',
    primaryAction: '开始批量切片',
  },
  {
    id: 'drama-mix',
    title: '短剧混剪',
    tags: ['短剧混剪', '剧情精剪', '高光提取', 'AI智能分析'],
    description:
      '导入短剧全集，AI 自动分析，支持剧情精剪或高光提取，自动重组多条不同剧情线，满足差异化需求。',
    category: 'creation',
    available: false,
    layout: 'drama-editor',
    primaryAction: '开始短剧混剪',
  },
  {
    id: 'batch-crop',
    title: '批量裁剪',
    tags: ['尺寸裁剪', '比例适配', '批量导出'],
    description: '统一参数批量裁剪视频尺寸与比例，适配抖音、小红书、视频号等平台发布规格。',
    category: 'efficiency',
    available: false,
    layout: 'batch-tool',
    primaryAction: '开始批量裁剪',
  },
  {
    id: 'audio-extract',
    title: '音频提取',
    tags: ['提取音频', '批量转换', 'MP3/WAV'],
    description: '从视频中批量提取音频轨道，支持 MP3、WAV 等格式，可调节码率与声道。',
    category: 'efficiency',
    available: false,
    layout: 'batch-tool',
    primaryAction: '开始提取音频',
  },
  {
    id: 'subtitle-erase',
    title: '字幕擦除',
    tags: ['硬字幕', '区域擦除', '批量处理'],
    description: '批量擦除视频硬字幕，支持自定义擦除区域与边缘模糊，减少反复手工打马赛克。',
    category: 'efficiency',
    available: false,
    layout: 'batch-tool',
    primaryAction: '开始擦除字幕',
  },
  {
    id: 'md5-diff',
    title: 'MD5 差异化',
    tags: ['抽帧', '镜像', '防搬运'],
    description:
      '通过抽帧、镜像、微调参数等方式批量生成 MD5 不同的视频版本，降低平台判搬运风险。',
    category: 'efficiency',
    available: false,
    layout: 'batch-tool',
    primaryAction: '开始差异化处理',
  },
]

export function getFeatureById(id: string): FeatureItem | undefined {
  return features.find((f) => f.id === id)
}

/** 可用功能排在最前，其余保持原顺序 */
export function sortFeaturesForHome(list: FeatureItem[]): FeatureItem[] {
  const available = list.filter((f) => f.available)
  const upcoming = list.filter((f) => !f.available)
  return [...available, ...upcoming]
}
