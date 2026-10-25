import type { Component } from 'vue'
import type { FeatureLayout } from '../types/feature'
import MixEditorWorkspace from './workspaces/MixEditorWorkspace.vue'
import EffectsEditorWorkspace from './workspaces/EffectsEditorWorkspace.vue'
import CategoryEditorWorkspace from './workspaces/CategoryEditorWorkspace.vue'
import ExtractEditorWorkspace from './workspaces/ExtractEditorWorkspace.vue'
import DramaEditorWorkspace from './workspaces/DramaEditorWorkspace.vue'
import CopyToolWorkspace from './workspaces/CopyToolWorkspace.vue'
import BatchToolWorkspace from './workspaces/BatchToolWorkspace.vue'

export const workspaceByLayout: Record<FeatureLayout, Component> = {
  'mix-editor': MixEditorWorkspace,
  'effects-editor': EffectsEditorWorkspace,
  'category-editor': CategoryEditorWorkspace,
  'extract-editor': ExtractEditorWorkspace,
  'drama-editor': DramaEditorWorkspace,
  'copy-tool': CopyToolWorkspace,
  'batch-tool': BatchToolWorkspace,
}
