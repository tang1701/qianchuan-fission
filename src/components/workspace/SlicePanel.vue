<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useMaterialStore } from '../../stores/material'
import { useFeatureStateStore } from '../../stores/featureState'

const material = useMaterialStore()
const feature = useFeatureStateStore()
const { selectedVideo } = storeToRefs(material)
const { slices } = storeToRefs(feature)
</script>

<template>
  <section class="panel script-panel">
    <header class="script-panel__head">
      <h3>切片列表</h3>
      <span v-if="slices.length" class="badge badge--ok">{{ slices.length }} 段</span>
    </header>
    <div v-if="!selectedVideo" class="empty-state empty-state--compact">
      <p class="empty-state__hint">选择视频后可查看或编辑 AI 生成的切片</p>
    </div>
    <ul v-else-if="slices.length" class="slice-list">
      <li v-for="s in slices" :key="s.id" class="slice-list__item">
        <strong>{{ s.title }}</strong>
        <span>{{ s.start }} — {{ s.end }}</span>
      </li>
    </ul>
    <div v-else class="empty-state empty-state--compact">
      <p class="empty-state__hint">点击「开始批量切片」后在此显示结果</p>
    </div>
  </section>
</template>
