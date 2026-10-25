/** 与正版 ECutAuto 对齐情况（开发参考，界面默认不展示） */
export interface ParityInfo {
  ui: 'full' | 'partial'
  export: 'full' | 'partial' | 'demo'
  ai: 'full' | 'partial' | 'heuristic'
  notes: string[]
}

export const featureParity: Record<string, ParityInfo> = {
  'ai-mix': {
    ui: 'full',
    export: 'full',
    ai: 'partial',
    notes: [
      '独立 AI 混剪管线：按句 TTS → 镜头切点选段 → 字幕 → BGM → 9:16 成片',
      '本地模型：场景切点 + 语义/文件名；云端：OpenAI 嵌入选片',
    ],
  },
  'video-effects': {
    ui: 'full',
    export: 'full',
    ai: 'heuristic',
    notes: [
      '对齐《视频自动化处理功能参数开发需求清单》P0/P1：分割/填充/变速/镜像/输出/BGM/画中画参数',
      '任务配置 fxJobConfig 七层结构；P2 任务队列/GPU、P3 深度 AI 待迭代',
    ],
  },
  'video-mix': {
    ui: 'full',
    export: 'full',
    ai: 'heuristic',
    notes: ['随机抽段或文案+TTS；BGM、字幕、成片后处理'],
  },
  'category-mix': {
    ui: 'full',
    export: 'full',
    ai: 'heuristic',
    notes: ['多文件夹顺序混剪；拖拽/按钮排序；随机或顺序供片'],
  },
  'copy-rewrite': {
    ui: 'full',
    export: 'full',
    ai: 'partial',
    notes: ['GPT 改写导出 txt；无 Key 时本地占位'],
  },
  'content-extract': {
    ui: 'full',
    export: 'full',
    ai: 'partial',
    notes: ['场景切点切片或随机区间；批量导出'],
  },
  'drama-mix': {
    ui: 'full',
    export: 'full',
    ai: 'heuristic',
    notes: ['多剧情线、集数顺序/随机、高光/剧情模式、可选 TTS'],
  },
  'batch-crop': { ui: 'full', export: 'full', ai: 'heuristic', notes: ['FFmpeg 比例裁剪'] },
  'audio-extract': { ui: 'full', export: 'full', ai: 'heuristic', notes: ['批量抽音频'] },
  'subtitle-erase': { ui: 'full', export: 'full', ai: 'heuristic', notes: ['delogo 区域擦除'] },
  'md5-diff': { ui: 'full', export: 'full', ai: 'heuristic', notes: ['镜像/抽帧/亮度差异化'] },
}
