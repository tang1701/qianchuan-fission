<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import FeatureCard from '../components/FeatureCard.vue'
import { APP_DISPLAY_NAME, features, sortFeaturesForHome } from '../data/features'
import type { FeatureCategory } from '../types/feature'
import AppSettingsModal from '../components/AppSettingsModal.vue'

const router = useRouter()
const tab = ref<FeatureCategory>('creation')
const settingsOpen = ref(false)

const creationCount = computed(
  () => features.filter((f) => f.category === 'creation').length,
)
const efficiencyCount = computed(
  () => features.filter((f) => f.category === 'efficiency').length,
)

const visibleFeatures = computed(() =>
  sortFeaturesForHome(features.filter((f) => f.category === tab.value)),
)

function openFeature(id: string) {
  const f = features.find((x) => x.id === id)
  if (!f?.available) return
  router.push({ name: 'workspace', params: { featureId: id } })
}
</script>

<template>
  <div class="home">
    <header class="home__header">
      <div>
        <h1 class="home__product-title">{{ APP_DISPLAY_NAME }}</h1>
        <p class="tagline">导入素材并登记来源授权后，再导出裂变版本。平台是否标成优质或首发，以巨量千川回填为准。</p>
      </div>
      <div class="home__actions">
        <button type="button" class="btn btn--ghost btn--sm" @click="settingsOpen = true">
          全局设置
        </button>
        <nav class="home__nav" aria-label="功能分类">
          <button
            type="button"
            class="nav-pill"
            :class="{ 'nav-pill--active': tab === 'creation' }"
            @click="tab = 'creation'"
          >
            创作中心
            <span class="nav-pill__count">{{ creationCount }}</span>
          </button>
          <button
            type="button"
            class="nav-pill"
            :class="{ 'nav-pill--active': tab === 'efficiency' }"
            @click="tab = 'efficiency'"
          >
            效率工具
            <span class="nav-pill__count">{{ efficiencyCount }}</span>
          </button>
        </nav>
      </div>
    </header>

    <AppSettingsModal :open="settingsOpen" @close="settingsOpen = false" />

    <main class="home__grid">
      <FeatureCard
        v-for="feature in visibleFeatures"
        :key="feature.id"
        :feature="feature"
        @open="openFeature"
      />
    </main>
  </div>
</template>
