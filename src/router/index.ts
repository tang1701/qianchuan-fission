import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import WorkspaceView from '../views/WorkspaceView.vue'

/** 安装包用 file:// 加载，History 模式会黑屏，Hash 模式兼容 dev 与打包 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/workspace/:featureId',
      name: 'workspace',
      component: WorkspaceView,
      props: true,
    },
  ],
})

export default router
