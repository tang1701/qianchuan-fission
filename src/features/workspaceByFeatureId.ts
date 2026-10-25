import type { Component } from 'vue'
import AiMixWorkspace from './workspaces/AiMixWorkspace.vue'
import VideoEffectsWorkspace from './workspaces/VideoEffectsWorkspace.vue'
import VideoMixWorkspace from './workspaces/VideoMixWorkspace.vue'
import CategoryMixWorkspace from './workspaces/CategoryMixWorkspace.vue'
import CopyRewriteWorkspace from './workspaces/CopyRewriteWorkspace.vue'
import ContentExtractWorkspace from './workspaces/ContentExtractWorkspace.vue'
import DramaMixWorkspace from './workspaces/DramaMixWorkspace.vue'
import BatchToolWorkspace from './workspaces/BatchToolWorkspace.vue'

/** 按模块独立工作台（11 个入口均已注册） */
export const workspaceByFeatureId: Partial<Record<string, Component>> = {
  'ai-mix': AiMixWorkspace,
  'video-effects': VideoEffectsWorkspace,
  'video-mix': VideoMixWorkspace,
  'category-mix': CategoryMixWorkspace,
  'copy-rewrite': CopyRewriteWorkspace,
  'content-extract': ContentExtractWorkspace,
  'drama-mix': DramaMixWorkspace,
  'batch-crop': BatchToolWorkspace,
  'audio-extract': BatchToolWorkspace,
  'subtitle-erase': BatchToolWorkspace,
  'md5-diff': BatchToolWorkspace,
}
