<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <span>手机进销存系统</span>
        </div>
      </template>
      
      <el-form :model="loginForm" :rules="loginRules" ref="loginFormRef" label-width="0px" class="login-form">
        <el-form-item prop="username">
          <el-input 
            v-model="loginForm.username" 
            prefix-icon="User" 
            placeholder="请输入用户名"
            @keyup.enter="handleLogin"
          ></el-input>
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input 
            v-model="loginForm.password" 
            prefix-icon="Lock" 
            type="password" 
            placeholder="请输入密码"
            @keyup.enter="handleLogin"
          ></el-input>
        </el-form-item>
        
        <el-form-item>
          <el-button 
            type="primary" 
            @click="handleLogin" 
            :loading="loading" 
            class="login-button"
            style="width: 100%"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const userStore = useUserStore()
    const loginFormRef = ref(null)
    const loading = ref(false)
    
    const loginForm = reactive({
      username: '',
      password: ''
    })
    
    const loginRules = {
      username: [
        { required: true, message: '请输入用户名', trigger: 'blur' }
      ],
      password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
      ]
    }
    
    const handleLogin = async () => {
      if (!loginFormRef.value) return
      
      await loginFormRef.value.validate(async (valid) => {
        if (valid) {
          loading.value = true
          try {
            await userStore.login(loginForm)
            ElMessage.success('登录成功')
            
            // 跳转到仪表盘
            router.push('/dashboard')
          } catch (error) {
            console.error('登录错误:', error)
            ElMessage.error(error.message || '登录失败')
          } finally {
            loading.value = false
          }
        }
      })
    }
    
    return {
      loginFormRef,
      loading,
      loginForm,
      loginRules,
      handleLogin,
      User,
      Lock
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
}

.login-card {
  width: 400px;
}

.card-header {
  text-align: center;
  font-size: 18px;
  font-weight: bold;
}

.login-form {
  padding-top: 20px;
}

.login-button {
  margin-top: 10px;
}
</style>