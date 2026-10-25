import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDesktopApi } from '../services/desktop'

export interface MaterialFolder {
  id: string
  name: string
  path: string
  fileCount: number
  videoFiles: string[]
  filePaths: string[]
}

export interface MediaFile {
  id: string
  name: string
  /** 桌面版本地绝对路径；浏览器导入时为空 */
  path: string
  size: number
  /** 浏览器 file 选择器生成的预览地址 */
  objectUrl?: string
  durationSec?: number
}

export type MatchMode = 'local' | 'cloud' | 'clip' | 'vision'

const VIDEO_EXT = /\.(mp4|mov|mkv|avi|webm|m4v)$/i
const LOOSE_VIDEOS_SESSION_KEY = 'eauto.looseVideos.v1'

function readLooseVideosSession(): MediaFile[] {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(LOOSE_VIDEOS_SESSION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MediaFile[]
    return parsed.filter((v) => v && v.id && v.name && v.path)
  } catch {
    return []
  }
}

function writeLooseVideosSession(list: MediaFile[]) {
  if (typeof sessionStorage === 'undefined') return
  const payload = list
    .filter((v) => v.path)
    .map(({ id, name, path, size, durationSec }) => ({ id, name, path, size, durationSec }))
  sessionStorage.setItem(LOOSE_VIDEOS_SESSION_KEY, JSON.stringify(payload))
}

export const useMaterialStore = defineStore('material', () => {
  const folders = ref<MaterialFolder[]>([])
  const selectedFolderId = ref<string | null>(null)
  const restored = readLooseVideosSession()
  const looseVideos = ref<MediaFile[]>(restored)
  const selectedVideoId = ref<string | null>(restored[0]?.id ?? null)
  const matchMode = ref<MatchMode>('local')
  const previewFilePath = ref<string | null>(restored[0]?.path ?? null)

  function syncLooseVideosSession() {
    writeLooseVideosSession(looseVideos.value)
  }

  const selectedFolder = computed(
    () => folders.value.find((f) => f.id === selectedFolderId.value) ?? null,
  )

  const selectedVideo = computed(
    () => looseVideos.value.find((v) => v.id === selectedVideoId.value) ?? null,
  )

  function addFolderFromPick(data: {
    name: string
    path: string
    files: { name: string; path: string }[]
  }) {
    const id = crypto.randomUUID()
    folders.value.push({
      id,
      name: data.name,
      path: data.path,
      fileCount: data.files.length,
      videoFiles: data.files.map((f) => f.name),
      filePaths: data.files.map((f) => f.path),
    })
    selectedFolderId.value = id
    previewFilePath.value = data.files[0]?.path ?? null
  }

  function addFolderFromFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    const videos = files.filter((f) => VIDEO_EXT.test(f.name))
    if (!videos.length) return false

    const pathParts = (videos[0].webkitRelativePath || videos[0].name).split(/[/\\]/)
    const folderName = pathParts.length > 1 ? pathParts[0]! : '导入的素材'

    const id = crypto.randomUUID()
    folders.value.push({
      id,
      name: folderName,
      path: folderName,
      fileCount: videos.length,
      videoFiles: videos.map((f) => f.name),
      filePaths: [],
    })
    selectedFolderId.value = id
    return true
  }

  async function importFolderInteractive() {
    const api = getDesktopApi()
    if (api) {
      const picked = await api.pickFolder()
      if (picked?.files.length) {
        addFolderFromPick(picked)
        return true
      }
      return false
    }
    return null
  }

  function dedupeKey(name: string, path: string, size: number) {
    return path ? path.toLowerCase() : `${name}|${size}`
  }

  function shouldSkipDuplicate(name: string, path: string, size: number, dedupe: boolean) {
    if (!dedupe) return false
    const key = dedupeKey(name, path, size)
    return looseVideos.value.some((v) => dedupeKey(v.name, v.path, v.size) === key)
  }

  function sortLooseVideos(mode: 'name' | 'time' | 'size') {
    const list = [...looseVideos.value]
    if (mode === 'size') list.sort((a, b) => b.size - a.size)
    else if (mode === 'time') list.sort((a, b) => a.name.localeCompare(b.name))
    else list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    looseVideos.value = list
    syncLooseVideosSession()
  }

  function addLooseVideosFromPick(
    files: { name: string; path: string; size: number; duration?: number }[],
    dedupe = true,
  ) {
    for (const f of files) {
      if (shouldSkipDuplicate(f.name, f.path, f.size, dedupe)) continue
      looseVideos.value.push({
        id: crypto.randomUUID(),
        name: f.name,
        path: f.path,
        size: f.size,
        durationSec: f.duration,
      })
    }
    if (files.length) {
      const last = looseVideos.value[looseVideos.value.length - 1]
      selectedVideoId.value = last?.id ?? null
      previewFilePath.value = last?.path ?? null
    }
    syncLooseVideosSession()
  }

  function addLooseVideos(fileList: FileList | File[], dedupe = true) {
    const files = Array.from(fileList).filter((f) => VIDEO_EXT.test(f.name) || f.type.startsWith('video/'))
    for (const f of files) {
      if (shouldSkipDuplicate(f.name, '', f.size, dedupe)) continue
      looseVideos.value.push({
        id: crypto.randomUUID(),
        name: f.name,
        path: '',
        size: f.size,
        objectUrl: URL.createObjectURL(f),
      })
    }
    if (files.length) {
      const last = looseVideos.value[looseVideos.value.length - 1]
      selectedVideoId.value = last?.id ?? null
      previewFilePath.value = last?.path ?? null
    }
    syncLooseVideosSession()
    return files.length > 0
  }

  async function importVideosInteractive() {
    const api = getDesktopApi()
    if (api) {
      const picked = await api.pickVideos()
      if (picked.length) {
        addLooseVideosFromPick(picked)
        return true
      }
      return false
    }
    return null
  }

  async function importFolderAsVideos() {
    const api = getDesktopApi()
    if (!api?.pickFolder) return null
    const picked = await api.pickFolder()
    if (!picked?.files.length) return false
    addLooseVideosFromPick(
      picked.files.map((f) => ({ name: f.name, path: f.path, size: 0 })),
    )
    return true
  }

  function selectFolder(id: string) {
    selectedFolderId.value = id
    const folder = folders.value.find((f) => f.id === id)
    previewFilePath.value = folder?.filePaths[0] ?? null
  }

  function selectPreviewFile(filePath: string) {
    previewFilePath.value = filePath
  }

  function removeFolder(id: string) {
    folders.value = folders.value.filter((f) => f.id !== id)
    if (selectedFolderId.value === id) {
      selectedFolderId.value = folders.value[0]?.id ?? null
    }
  }

  function selectVideo(id: string) {
    selectedVideoId.value = id
    const v = looseVideos.value.find((x) => x.id === id)
    if (v?.path) previewFilePath.value = v.path
  }

  function removeVideo(id: string) {
    const victim = looseVideos.value.find((v) => v.id === id)
    if (victim?.objectUrl) URL.revokeObjectURL(victim.objectUrl)
    looseVideos.value = looseVideos.value.filter((v) => v.id !== id)
    if (selectedVideoId.value === id) {
      const next = looseVideos.value[0]
      selectedVideoId.value = next?.id ?? null
      previewFilePath.value = next?.path ?? null
    }
    syncLooseVideosSession()
  }

  function moveFolderOrder(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= folders.value.length) return
    const list = [...folders.value]
    const [item] = list.splice(fromIndex, 1)
    if (!item) return
    list.splice(toIndex, 0, item)
    folders.value = list
  }

  return {
    folders,
    selectedFolderId,
    selectedFolder,
    looseVideos,
    selectedVideoId,
    selectedVideo,
    matchMode,
    previewFilePath,
    addFolderFromFiles,
    addFolderFromPick,
    importFolderInteractive,
    addLooseVideos,
    addLooseVideosFromPick,
    importVideosInteractive,
    importFolderAsVideos,
    selectFolder,
    selectPreviewFile,
    removeFolder,
    selectVideo,
    removeVideo,
    moveFolderOrder,
    sortLooseVideos,
  }
})
