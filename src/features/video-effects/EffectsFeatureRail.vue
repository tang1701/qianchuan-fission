<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import SliderField from '../../components/ui/SliderField.vue'
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue'
import { useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'
import { fxModulesForSettingsRail, type FxModuleId } from './effectModules'

const store = useFeatureStateStore()
const {
  fxActiveModule,
  fxModuleEnabled,
  mirrorRandom,
  speedJitter,
  fxSaturation,
  fxContrast,
  fxNoiseAmount,
  fxBrightnessJitter,
  fxSaturationJitter,
  fxRotateDeg,
  fxIntroFadeSec,
  fxSpeedRate,
  fxCoverAtSec,
  fxDynamicBgBlur,
  removeWatermark,
  watermarkRemoveMode,
  eraseTop,
  eraseHeight,
  fxDelogoLeft,
  fxDelogoWidth,
  addTextWatermark,
  fxTextOverlays,
  fxAddImageWatermark,
  fxImageWatermarkPath,
  fxAddVideoWatermark,
  fxVideoWatermarkPath,
  fxWatermarkPosition,
  keepOriginalAudio,
  originalVolume,
  bgmEnabled,
  bgmPath,
  bgmVolume,
  removeBlackBar,
  fxFillMode,
  fxPipWidthPct,
  fxBrightness,
  bgmFadeInSec,
  bgmFadeOutSec,
} = storeToRefs(store)

const primaryModules = computed(() => fxModulesForSettingsRail().filter((m) => m.tab === 'effects'))
const extraModules = computed(() => fxModulesForSettingsRail().filter((m) => m.tab === 'sticker'))

function isOn(id: string) {
  return Boolean(fxModuleEnabled.value[id as FxModuleId])
}

function selectModule(id: string) {
  fxActiveModule.value = fxActiveModule.value === id ? null : id
}

async function pickImage() {
  const p = await getDesktopApi()?.pickImage?.()
  if (p) {
    fxImageWatermarkPath.value = p
    fxAddImageWatermark.value = true
    store.setFxModuleEnabled('image-wm', true)
  }
}

async function pickVideoWm() {
  const files = await getDesktopApi()?.pickVideos?.()
  if (files?.[0]?.path) {
    fxVideoWatermarkPath.value = files[0].path
    fxAddVideoWatermark.value = true
    store.setFxModuleEnabled('pip', true)
  }
}

async function pickBgm() {
  const p = await getDesktopApi()?.pickAudio?.()
  if (p) {
    bgmPath.value = p
    bgmEnabled.value = true
    store.setFxModuleEnabled('audio', true)
  }
}
</script>

<template>
  <aside class="fx-rail">
    <header class="fx-pane-head">效果设置</header>

    <div class="fx-rail__scroll">
      <button
        v-for="mod in primaryModules"
        :key="mod.id"
        type="button"
        class="fx-module"
        :class="{
          'fx-module--active': fxActiveModule === mod.id,
          'fx-module--on': isOn(mod.id),
        }"
        @click="selectModule(mod.id)"
      >
        <span class="fx-module__icon">{{ mod.icon }}</span>
        <span>
          <span class="fx-module__title">{{ mod.title }}</span>
          <span class="fx-module__desc">{{ mod.desc }}</span>
        </span>
        <ToggleSwitch
          class="fx-module__switch"
          :model-value="isOn(mod.id)"
          label=""
          @click.stop
          @update:model-value="(on) => store.setFxModuleEnabled(mod.id, on)"
        />
      </button>

      <p class="fx-rail__group-label">贴图与水印</p>
      <button
        v-for="mod in extraModules"
        :key="mod.id"
        type="button"
        class="fx-module"
        :class="{
          'fx-module--active': fxActiveModule === mod.id,
          'fx-module--on': isOn(mod.id),
        }"
        @click="selectModule(mod.id)"
      >
        <span class="fx-module__icon">{{ mod.icon }}</span>
        <span>
          <span class="fx-module__title">{{ mod.title }}</span>
          <span class="fx-module__desc">{{ mod.desc }}</span>
        </span>
        <ToggleSwitch
          class="fx-module__switch"
          :model-value="isOn(mod.id)"
          label=""
          @click.stop
          @update:model-value="(on) => store.setFxModuleEnabled(mod.id, on)"
        />
      </button>
    </div>

    <div v-if="fxActiveModule" class="fx-rail__detail">
      <template v-if="fxActiveModule === 'audio'">
        <ToggleSwitch v-model="keepOriginalAudio" label="保留原声" />
        <SliderField v-model="originalVolume" label="原声音量" :min="0" :max="100" suffix="%" />
        <ToggleSwitch v-model="bgmEnabled" label="叠加 BGM" />
        <button type="button" class="btn btn--ghost btn--sm" @click="pickBgm">选择 BGM 音频/视频</button>
        <SliderField v-model="bgmVolume" label="BGM 音量" :min="5" :max="200" suffix="%" />
        <SliderField v-model="bgmFadeInSec" label="BGM 淡入" :min="0" :max="10" :step="0.1" suffix="秒" />
        <SliderField v-model="bgmFadeOutSec" label="BGM 淡出" :min="0" :max="10" :step="0.1" suffix="秒" />
        <p class="settings-block__muted">开启左侧「音频设置」后，原声音量与 BGM 会写入导出</p>
      </template>
      <template v-else-if="fxActiveModule === 'cover'">
        <SliderField v-model="fxCoverAtSec" label="封面截取时间" :min="0" :max="120" suffix="秒" />
        <p class="settings-block__muted">导出 MP4 的同时另存同名 JPG 封面</p>
      </template>
      <template v-else-if="fxActiveModule === 'intro'">
        <SliderField
          v-model="fxIntroFadeSec"
          label="入场淡入时长"
          :min="0"
          :max="3"
          :step="0.1"
          suffix="秒"
        />
      </template>
      <template v-else-if="fxActiveModule === 'scrub'">
        <label class="field-label">填充方式</label>
        <select v-model="fxFillMode" class="select select--block">
          <option value="crop">裁剪</option>
          <option value="scale">缩放</option>
          <option value="blur">背景模糊填充</option>
        </select>
        <ToggleSwitch v-model="removeWatermark" label="区域涂除 / 去水印" />
      </template>
      <template v-else-if="fxActiveModule === 'remove-wm'">
        <ToggleSwitch v-model="removeWatermark" label="启用区域去水印" />
        <div v-if="removeWatermark" class="segmented segmented--block">
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': watermarkRemoveMode === 'delogo' }"
            @click="watermarkRemoveMode = 'delogo'"
          >
            delogo
          </button>
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': watermarkRemoveMode === 'inpaint' }"
            @click="watermarkRemoveMode = 'inpaint'"
          >
            智能修复
          </button>
        </div>
        <SliderField v-model="eraseTop" label="区域顶部 %" :min="0" :max="95" />
        <SliderField v-model="eraseHeight" label="区域高度 %" :min="4" :max="40" />
        <SliderField v-model="fxDelogoLeft" label="区域左侧 %" :min="0" :max="90" />
        <SliderField v-model="fxDelogoWidth" label="区域宽度 %" :min="10" :max="100" />
      </template>
      <template v-else-if="fxActiveModule === 'pip'">
        <SliderField v-model="fxPipWidthPct" label="小窗宽度" :min="5" :max="80" suffix="%" />
        <ToggleSwitch v-model="fxAddVideoWatermark" label="画中画视频" />
        <p class="settings-block__muted">
          未选小视频时，将用当前画面缩小叠加到角落（自画中画）；也可另选视频作为小窗。
        </p>
        <button type="button" class="btn btn--ghost btn--sm" @click="pickVideoWm">选择小视频</button>
        <select v-model="fxWatermarkPosition" class="select select--block">
          <option value="top-left">左上</option>
          <option value="top-right">右上</option>
          <option value="bottom-left">左下</option>
          <option value="bottom-right">右下</option>
        </select>
      </template>
      <template v-else-if="fxActiveModule === 'image-wm'">
        <ToggleSwitch v-model="fxAddImageWatermark" label="图片水印" />
        <button type="button" class="btn btn--ghost btn--sm" @click="pickImage">选择图片</button>
        <select v-model="fxWatermarkPosition" class="select select--block">
          <option value="top-left">左上</option>
          <option value="top-right">右上</option>
          <option value="bottom-left">左下</option>
          <option value="bottom-right">右下</option>
        </select>
      </template>
      <template v-else-if="fxActiveModule === 'text-wm'">
        <ToggleSwitch v-model="addTextWatermark" label="文字水印" />
        <p class="settings-block__muted">预览区「T 添加文本」可叠加多条；导出时按列表顺序绘制。</p>
        <div v-for="(item, idx) in fxTextOverlays" :key="item.id" class="fx-rail-text-row">
          <span class="fx-rail-text-row__idx">{{ idx + 1 }}</span>
          <input v-model="item.text" class="text-input" placeholder="水印文字" />
          <button
            v-if="fxTextOverlays.length > 1"
            type="button"
            class="btn btn--ghost btn--sm"
            @click="store.removeFxTextOverlay(item.id)"
          >
            删
          </button>
        </div>
        <button type="button" class="btn btn--ghost btn--sm" @click="store.addFxTextOverlay()">
          + 添加一条
        </button>
      </template>
      <template v-else-if="fxActiveModule === 'picture'">
        <SliderField v-model="fxBrightness" label="亮度" :min="-100" :max="100" />
        <SliderField v-model="fxSaturation" label="饱和度" :min="50" :max="150" />
        <SliderField v-model="fxContrast" label="对比度" :min="80" :max="130" />
        <ToggleSwitch v-model="fxBrightnessJitter" label="亮度微扰（裂变差异化）" />
        <ToggleSwitch v-model="fxSaturationJitter" label="饱和度差异化" />
      </template>
      <template v-else-if="fxActiveModule === 'pixel'">
        <SliderField v-model="fxNoiseAmount" label="胶片噪点" :min="0" :max="25" />
      </template>
      <template v-else-if="fxActiveModule === 'mirror'">
        <ToggleSwitch v-model="mirrorRandom" label="随机镜像（裂变）" />
        <SliderField v-model="fxRotateDeg" label="旋转角度" :min="0" :max="270" :step="90" />
        <ToggleSwitch v-model="removeBlackBar" label="智能去黑边（裁切填充）" />
      </template>
      <template v-else-if="fxActiveModule === 'speed'">
        <SliderField v-model="fxSpeedRate" label="变速比例" :min="50" :max="150" suffix="%" />
        <p class="settings-block__muted">100% 为原速；建议 90%～120% 以便明显听出/看出变化。</p>
        <ToggleSwitch v-model="speedJitter" label="随机微变速（裂变）" />
      </template>
      <template v-else-if="fxActiveModule === 'bg'">
        <SliderField v-model="fxDynamicBgBlur" label="底纹模糊强度" :min="4" :max="40" />
        <p class="settings-block__muted">黑边区域以模糊放大画面填充（动态缩放 / 底纹）</p>
      </template>
    </div>

  </aside>
</template>
