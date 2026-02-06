// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/inventory/list',
    name: 'InventoryList',
    component: () => import('../views/inventory/List.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/inventory/inbound',
    name: 'InventoryInbound',
    component: () => import('../views/inventory/Inbound.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/inventory/outbound',
    name: 'InventoryOutbound',
    component: () => import('../views/inventory/Outbound.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/inventory/adjust',
    name: 'InventoryAdjust',
    component: () => import('../views/inventory/Adjust.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/products/brands',
    name: 'Brands',
    component: () => import('../views/products/Brands.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/products/models',
    name: 'Models',
    component: () => import('../views/products/Models.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/trade/suppliers',
    name: 'Suppliers',
    component: () => import('../views/trade/Suppliers.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/trade/customers',
    name: 'Customers',
    component: () => import('../views/trade/Customers.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/trade/purchases',
    name: 'Purchases',
    component: () => import('../views/trade/Purchases.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/trade/sales',
    name: 'Sales',
    component: () => import('../views/trade/Sales.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/finance/receivables',
    name: 'Receivables',
    component: () => import('../views/finance/Receivables.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/finance/payables',
    name: 'Payables',
    component: () => import('../views/finance/Payables.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/finance/profit',
    name: 'Profit',
    component: () => import('../views/finance/Profit.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/finance/rebate',
    name: 'Rebate',
    component: () => import('../views/finance/Rebate.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('../views/reports/Index.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('../views/admin/Users.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  
  // 如果store中没有token但localStorage中有，同步状态
  if (!userStore.token && localStorage.getItem('token')) {
    userStore.$patch({
      token: localStorage.getItem('token') || '',
      currentUser: JSON.parse(localStorage.getItem('user') || '{}')
    })
  }
  
  // 如果有token但currentUser为空，尝试获取用户信息
  if (userStore.token && Object.keys(userStore.currentUser).length === 0) {
    try {
      await userStore.fetchCurrentUser()
    } catch (error) {
      console.error('获取用户信息失败:', error)
      // 如果获取失败，可能是token无效，登出用户
      userStore.logout()
    }
  }
  
  // 检查是否需要认证
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next('/login')
  } 
  // 检查是否需要管理员权限
  else if (to.meta.requiresAdmin && userStore.currentUser?.role !== 'admin') {
    next('/dashboard') // 或者显示无权限页面
  }
  // 如果已登录且访问登录页，重定向到仪表盘
  else if (to.path === '/login' && userStore.isLoggedIn) {
    next('/dashboard')
  }
  // 正常导航
  else {
    next()
  }
})

export default router