<script setup lang="ts">
import { isDesktopApp } from '../services/desktop'
</script>

<template>
  <div v-if="!isDesktopApp()" class="desktop-hint" role="status">
    当前为浏览器预览：导入/导出不可用。请在项目目录运行
    <code>npm run dev:app</code>
    或先 <code>npm run build</code> 再 <code>npm run start</code> 打开桌面版。
  </div>
</template>
