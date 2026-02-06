// src/stores/user.js
import { defineStore } from 'pinia'
import request from '@/utils/request'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    currentUser: JSON.parse(localStorage.getItem('user') || '{}'),
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    userRole: (state) => state.currentUser.role || '',
  },

  actions: {
    async login(credentials) {
      try {
        const response = await request.post('/api/auth/login', credentials)
        
        if (response.data.success) {
          const { token, user } = response.data.data
          
          this.token = token
          this.currentUser = user
          
          // 保存到本地存储
          localStorage.setItem('token', token)
          localStorage.setItem('user', JSON.stringify(user))
          
          return response.data
        } else {
          throw new Error(response.data.message || '登录失败')
        }
      } catch (error) {
        console.error('登录错误:', error)
        throw error
      }
    },

    async logout() {
      try {
        // 清除本地存储
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        
        // 清空状态
        this.$patch({
          token: '',
          currentUser: {}
        })
      } catch (error) {
        console.error('退出登录错误:', error)
        throw error
      }
    },

    async fetchCurrentUser() {
      try {
        const response = await request.get('/api/auth/me')
        
        if (response.data.success) {
          this.currentUser = response.data.data
          localStorage.setItem('user', JSON.stringify(response.data.data))
        }
      } catch (error) {
        console.error('获取当前用户信息失败:', error)
        // 如果获取失败，可能token已失效，清除本地状态
        if (error.response?.status === 401) {
          this.logout()
        }
      }
    },

    async changePassword(data) {
      try {
        const response = await request.put('/api/auth/change-password', data)
        return response.data
      } catch (error) {
        console.error('修改密码错误:', error)
        throw error
      }
    }
  }
})