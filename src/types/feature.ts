export type FeatureCategory = 'creation' | 'efficiency'

export type FeatureLayout =
  | 'mix-editor'
  | 'effects-editor'
  | 'category-editor'
  | 'extract-editor'
  | 'drama-editor'
  | 'copy-tool'
  | 'batch-tool'

export interface FeatureItem {
  id: string
  title: string
  tags: string[]
  description: string
  category: FeatureCategory
  available: boolean
  layout: FeatureLayout
  primaryAction: string
}
