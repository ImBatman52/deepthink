import { createRouter, createWebHistory } from 'vue-router';
import ChatView from '@/views/ChatView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: ChatView,
      meta: { title: 'DeepThink AI' },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { title: 'DeepThink 设置' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

// Dynamic page title
router.afterEach((to) => {
  const title = (to.meta as any)?.title;
  if (title) {
    document.title = title;
  }
});

export default router;
