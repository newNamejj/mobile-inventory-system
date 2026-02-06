<template>
  <div class="users-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
        </div>
      </template>
      
      <!-- 操作按钮 -->
      <div class="operations">
        <el-button type="primary" @click="addUser">新增用户</el-button>
      </div>
      
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索用户名或姓名" 
          style="width: 300px; margin-right: 10px;"
        ></el-input>
        <el-button type="primary" @click="fetchUsers">搜索</el-button>
      </div>
      
      <!-- 用户列表 -->
      <el-table :data="usersList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80"></el-table-column>
        <el-table-column prop="username" label="用户名" width="120"></el-table-column>
        <el-table-column prop="name" label="姓名" width="120"></el-table-column>
        <el-table-column prop="role" label="角色" width="120">
          <template #default="scope">
            <el-tag 
              :type="getRoleType(scope.row.role)"
              :effect="getRoleEffect(scope.row.role)"
            >
              {{ getRoleText(scope.row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" width="200"></el-table-column>
        <el-table-column prop="phone" label="手机号" width="150"></el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag 
              :type="getStatusType(scope.row.status)"
              :effect="getStatusEffect(scope.row.status)"
            >
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180"></el-table-column>
        <el-table-column label="操作" width="250">
          <template #default="scope">
            <el-button size="small" @click="editUser(scope.row)">编辑</el-button>
            <el-button 
              size="small" 
              type="primary" 
              @click="resetPassword(scope.row)"
            >
              重置密码
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteUser(scope.row)"
              :disabled="scope.row.id === currentUser.id"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        style="margin-top: 20px; justify-content: center; display: flex"
      />
    </el-card>
    
    <!-- 新增/编辑用户对话框 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="600px">
      <el-form :model="currentUserForm" :rules="userRules" ref="userFormRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="用户名" prop="username">
              <el-input 
                v-model="currentUserForm.username" 
                :disabled="!!currentUserForm.id"
                placeholder="请输入用户名"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="currentUserForm.name" placeholder="请输入姓名"></el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="角色" prop="role">
              <el-select v-model="currentUserForm.role" placeholder="请选择角色" style="width: 100%">
                <el-option label="管理员" value="admin"></el-option>
                <el-option label="经理" value="manager"></el-option>
                <el-option label="员工" value="staff"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="currentUserForm.status" placeholder="请选择状态" style="width: 100%">
                <el-option label="启用" value="active"></el-option>
                <el-option label="禁用" value="inactive"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="currentUserForm.email" placeholder="请输入邮箱地址"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="currentUserForm.phone" placeholder="请输入手机号"></el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item v-if="!currentUserForm.id" label="密码" prop="password">
          <el-input 
            v-model="currentUserForm.password" 
            type="password" 
            placeholder="请输入密码"
            show-password
          ></el-input>
        </el-form-item>
        <el-form-item v-if="!currentUserForm.id" label="确认密码" prop="confirmPassword">
          <el-input 
            v-model="currentUserForm.confirmPassword" 
            type="password" 
            placeholder="请再次输入密码"
            show-password
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmUserAction" :loading="submitting">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import request from '@/utils/request'

export default {
  name: 'Users',
  setup() {
    const usersList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const searchKeyword = ref('')
    
    const dialogVisible = ref(false)
    const dialogTitle = ref('')
    const submitting = ref(false)
    const userFormRef = ref(null)
    
    const currentUserForm = reactive({
      id: null,
      username: '',
      name: '',
      role: 'staff',
      status: 'active',
      email: '',
      phone: '',
      password: '',
      confirmPassword: ''
    })
    
    // 从store获取当前用户信息
    const userStore = useUserStore()
    const currentUser = ref(userStore.currentUser || {})
    
    const userRules = {
      username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 3, max: 20, message: '用户名长度在3到20个字符之间', trigger: 'blur' }
      ],
      name: [
        { required: true, message: '请输入姓名', trigger: 'blur' }
      ],
      role: [
        { required: true, message: '请选择角色', trigger: 'change' }
      ],
      status: [
        { required: true, message: '请选择状态', trigger: 'change' }
      ],
      email: [
        { required: true, message: '请输入邮箱地址', trigger: 'blur' },
        { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
      ],
      phone: [
        { required: true, message: '请输入手机号', trigger: 'blur' },
        { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
      ],
      password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, max: 20, message: '密码长度在6到20个字符之间', trigger: 'blur' }
      ],
      confirmPassword: [
        { required: true, message: '请再次输入密码', trigger: 'blur' },
        {
          validator: (rule, value, callback) => {
            if (value !== currentUserForm.password) {
              callback(new Error('两次输入的密码不一致'))
            } else {
              callback()
            }
          },
          trigger: 'blur'
        }
      ]
    }
    
    // 获取用户列表
    const fetchUsers = async () => {
      loading.value = true
      try {
        const response = await request.get('/api/users', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value
          }
        })
        
        if (response.data.success) {
          usersList.value = response.data.data.list
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取用户列表失败')
        }
      } catch (error) {
        console.error('获取用户列表错误:', error)
        ElMessage.error('获取用户列表失败')
      } finally {
        loading.value = false
      }
    }
    
    // 获取角色文本
    const getRoleText = (role) => {
      const roleMap = {
        admin: '管理员',
        manager: '经理',
        staff: '员工'
      }
      return roleMap[role] || role
    }
    
    // 获取角色标签类型
    const getRoleType = (role) => {
      const typeMap = {
        admin: 'danger',
        manager: 'warning',
        staff: 'primary'
      }
      return typeMap[role] || 'info'
    }
    
    // 获取角色标签效果
    const getRoleEffect = (role) => {
      return 'light'
    }
    
    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        active: '启用',
        inactive: '禁用'
      }
      return statusMap[status] || status
    }
    
    // 获取状态标签类型
    const getStatusType = (status) => {
      const typeMap = {
        active: 'success',
        inactive: 'danger'
      }
      return typeMap[status] || 'info'
    }
    
    // 获取状态标签效果
    const getStatusEffect = (status) => {
      return 'light'
    }
    
    // 处理分页大小变化
    const handleSizeChange = (size) => {
      pageSize.value = size
      fetchUsers()
    }
    
    // 处理当前页变化
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchUsers()
    }
    
    // 新增用户
    const addUser = () => {
      // 重置表单
      currentUserForm.id = null
      currentUserForm.username = ''
      currentUserForm.name = ''
      currentUserForm.role = 'staff'
      currentUserForm.status = 'active'
      currentUserForm.email = ''
      currentUserForm.phone = ''
      currentUserForm.password = ''
      currentUserForm.confirmPassword = ''
      
      dialogTitle.value = '新增用户'
      dialogVisible.value = true
    }
    
    // 编辑用户
    const editUser = (row) => {
      // 重置表单
      currentUserForm.id = row.id
      currentUserForm.username = row.username
      currentUserForm.name = row.name
      currentUserForm.role = row.role
      currentUserForm.status = row.status
      currentUserForm.email = row.email
      currentUserForm.phone = row.phone
      
      dialogTitle.value = '编辑用户'
      dialogVisible.value = true
    }
    
    // 删除用户
    const deleteUser = (row) => {
      if (row.id === currentUser.value.id) {
        ElMessage.warning('不能删除自己')
        return
      }
      
      ElMessageBox.confirm(`确定要删除用户 "${row.username}" 吗？删除后将无法恢复。`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.delete(`/api/users/${row.id}`)
          
          if (response.data.success) {
            ElMessage.success('用户删除成功')
            fetchUsers() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '用户删除失败')
          }
        } catch (error) {
          console.error('删除用户错误:', error)
          ElMessage.error('用户删除失败')
        }
      }).catch(() => {
        // 用户取消删除
      })
    }
    
    // 重置密码
    const resetPassword = (row) => {
      ElMessageBox.prompt('请输入新密码', '重置密码', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputType: 'password',
        inputPattern: /^.{6,20}$/,
        inputErrorMessage: '密码长度在6到20个字符之间'
      }).then(async ({ value }) => {
        try {
          const response = await request.put(`/api/users/${row.id}/password`, {
            password: value
          })
          
          if (response.data.success) {
            ElMessage.success('密码重置成功')
          } else {
            ElMessage.error(response.data.message || '密码重置失败')
          }
        } catch (error) {
          console.error('密码重置错误:', error)
          ElMessage.error('密码重置失败')
        }
      }).catch(() => {
        // 用户取消操作
      })
    }
    
    // 确认用户操作
    const confirmUserAction = async () => {
      if (!userFormRef.value) return
      
      await userFormRef.value.validate(async (valid) => {
        if (valid) {
          submitting.value = true
          try {
            let response
            
            if (currentUserForm.id) {
              // 编辑现有用户
              response = await request.put(`/api/users/${currentUserForm.id}`, {
                name: currentUserForm.name,
                role: currentUserForm.role,
                status: currentUserForm.status,
                email: currentUserForm.email,
                phone: currentUserForm.phone
              })
            } else {
              // 新增用户
              response = await request.post('/api/users', {
                username: currentUserForm.username,
                name: currentUserForm.name,
                role: currentUserForm.role,
                status: currentUserForm.status,
                email: currentUserForm.email,
                phone: currentUserForm.phone,
                password: currentUserForm.password
              })
            }
            
            if (response.data.success) {
              ElMessage.success(currentUserForm.id ? '用户更新成功' : '用户创建成功')
              dialogVisible.value = false
              fetchUsers() // 刷新列表
            } else {
              ElMessage.error(response.data.message || (currentUserForm.id ? '用户更新失败' : '用户创建失败'))
            }
          } catch (error) {
            console.error(currentUserForm.id ? '更新用户错误:' : '创建用户错误:', error)
            ElMessage.error(currentUserForm.id ? '用户更新失败' : '用户创建失败')
          } finally {
            submitting.value = false
          }
        }
      })
    }
    
    onMounted(() => {
      fetchUsers()
    })
    
    return {
      usersList,
      loading,
      currentPage,
      pageSize,
      total,
      searchKeyword,
      dialogVisible,
      dialogTitle,
      submitting,
      userFormRef,
      currentUserForm,
      userRules,
      currentUser,
      fetchUsers,
      getRoleText,
      getRoleType,
      getRoleEffect,
      getStatusText,
      getStatusType,
      getStatusEffect,
      handleSizeChange,
      handleCurrentChange,
      addUser,
      editUser,
      deleteUser,
      resetPassword,
      confirmUserAction
    }
  }
}
</script>

<style scoped>
.users-container {
  padding: 20px;
}

.operations {
  margin-bottom: 20px;
}

.search-bar {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>