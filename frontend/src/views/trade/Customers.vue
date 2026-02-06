<template>
  <div class="customers-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>客户管理</span>
        </div>
      </template>
      
      <!-- 操作按钮 -->
      <div class="operations">
        <el-button type="primary" @click="addCustomer">新增客户</el-button>
      </div>
      
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索客户名称或联系人" 
          style="width: 300px; margin-right: 10px;"
        ></el-input>
        <el-button type="primary" @click="fetchCustomers">搜索</el-button>
      </div>
      
      <!-- 客户列表 -->
      <el-table :data="customersList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80"></el-table-column>
        <el-table-column prop="name" label="客户名称" width="200"></el-table-column>
        <el-table-column prop="contact_person" label="联系人" width="120"></el-table-column>
        <el-table-column prop="phone" label="联系电话" width="150"></el-table-column>
        <el-table-column prop="email" label="邮箱" width="200"></el-table-column>
        <el-table-column prop="address" label="地址" width="300"></el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180"></el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" @click="editCustomer(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteCustomer(scope.row)">删除</el-button>
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
    
    <!-- 新增/编辑客户对话框 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="600px">
      <el-form :model="currentCustomer" :rules="customerRules" ref="customerFormRef" label-width="100px">
        <el-form-item label="客户名称" prop="name">
          <el-input v-model="currentCustomer.name" placeholder="请输入客户名称"></el-input>
        </el-form-item>
        <el-form-item label="联系人" prop="contact_person">
          <el-input v-model="currentCustomer.contact_person" placeholder="请输入联系人姓名"></el-input>
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="currentCustomer.phone" placeholder="请输入联系电话"></el-input>
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="currentCustomer.email" placeholder="请输入邮箱地址"></el-input>
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input 
            v-model="currentCustomer.address" 
            type="textarea" 
            :rows="3"
            placeholder="请输入详细地址"
          ></el-input>
        </el-form-item>
        <el-form-item label="备注">
          <el-input 
            v-model="currentCustomer.remarks" 
            type="textarea" 
            :rows="3"
            placeholder="请输入备注信息"
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmCustomerAction" :loading="submitting">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'

export default {
  name: 'Customers',
  setup() {
    const customersList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const searchKeyword = ref('')
    
    const dialogVisible = ref(false)
    const dialogTitle = ref('')
    const submitting = ref(false)
    const customerFormRef = ref(null)
    
    const currentCustomer = reactive({
      id: null,
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      remarks: ''
    })
    
    const customerRules = {
      name: [
        { required: true, message: '请输入客户名称', trigger: 'blur' }
      ],
      contact_person: [
        { required: true, message: '请输入联系人姓名', trigger: 'blur' }
      ],
      phone: [
        { required: true, message: '请输入联系电话', trigger: 'blur' },
        { pattern: /^1[3-9]\d{9}$|^(\d{3,4}-?)?\d{7,8}$/, message: '请输入正确的电话号码', trigger: 'blur' }
      ],
      email: [
        { required: true, message: '请输入邮箱地址', trigger: 'blur' },
        { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
      ]
    }
    
    // 获取客户列表
    const fetchCustomers = async () => {
      loading.value = true
      try {
        const response = await request.get('/api/customers', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value
          }
        })
        
        if (response.data.success) {
          customersList.value = response.data.data.list
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取客户列表失败')
        }
      } catch (error) {
        console.error('获取客户列表错误:', error)
        ElMessage.error('获取客户列表失败')
      } finally {
        loading.value = false
      }
    }
    
    // 处理分页大小变化
    const handleSizeChange = (size) => {
      pageSize.value = size
      fetchCustomers()
    }
    
    // 处理当前页变化
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchCustomers()
    }
    
    // 新增客户
    const addCustomer = () => {
      // 重置表单
      currentCustomer.id = null
      currentCustomer.name = ''
      currentCustomer.contact_person = ''
      currentCustomer.phone = ''
      currentCustomer.email = ''
      currentCustomer.address = ''
      currentCustomer.remarks = ''
      
      dialogTitle.value = '新增客户'
      dialogVisible.value = true
    }
    
    // 编辑客户
    const editCustomer = (row) => {
      // 重置表单
      currentCustomer.id = row.id
      currentCustomer.name = row.name
      currentCustomer.contact_person = row.contact_person
      currentCustomer.phone = row.phone
      currentCustomer.email = row.email
      currentCustomer.address = row.address
      currentCustomer.remarks = row.remarks
      
      dialogTitle.value = '编辑客户'
      dialogVisible.value = true
    }
    
    // 删除客户
    const deleteCustomer = (row) => {
      ElMessageBox.confirm(`确定要删除客户 "${row.name}" 吗？删除后将无法恢复。`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.delete(`/api/customers/${row.id}`)
          
          if (response.data.success) {
            ElMessage.success('客户删除成功')
            fetchCustomers() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '客户删除失败')
          }
        } catch (error) {
          console.error('删除客户错误:', error)
          ElMessage.error('客户删除失败')
        }
      }).catch(() => {
        // 用户取消删除
      })
    }
    
    // 确认客户操作
    const confirmCustomerAction = async () => {
      if (!customerFormRef.value) return
      
      await customerFormRef.value.validate(async (valid) => {
        if (valid) {
          submitting.value = true
          try {
            let response
            
            if (currentCustomer.id) {
              // 编辑现有客户
              response = await request.put(`/api/customers/${currentCustomer.id}`, {
                name: currentCustomer.name,
                contact_person: currentCustomer.contact_person,
                phone: currentCustomer.phone,
                email: currentCustomer.email,
                address: currentCustomer.address,
                remarks: currentCustomer.remarks
              })
            } else {
              // 新增客户
              response = await request.post('/api/customers', {
                name: currentCustomer.name,
                contact_person: currentCustomer.contact_person,
                phone: currentCustomer.phone,
                email: currentCustomer.email,
                address: currentCustomer.address,
                remarks: currentCustomer.remarks
              })
            }
            
            if (response.data.success) {
              ElMessage.success(currentCustomer.id ? '客户更新成功' : '客户创建成功')
              dialogVisible.value = false
              fetchCustomers() // 刷新列表
            } else {
              ElMessage.error(response.data.message || (currentCustomer.id ? '客户更新失败' : '客户创建失败'))
            }
          } catch (error) {
            console.error(currentCustomer.id ? '更新客户错误:' : '创建客户错误:', error)
            ElMessage.error(currentCustomer.id ? '客户更新失败' : '客户创建失败')
          } finally {
            submitting.value = false
          }
        }
      })
    }
    
    onMounted(() => {
      fetchCustomers()
    })
    
    return {
      customersList,
      loading,
      currentPage,
      pageSize,
      total,
      searchKeyword,
      dialogVisible,
      dialogTitle,
      submitting,
      customerFormRef,
      currentCustomer,
      customerRules,
      fetchCustomers,
      handleSizeChange,
      handleCurrentChange,
      addCustomer,
      editCustomer,
      deleteCustomer,
      confirmCustomerAction
    }
  }
}
</script>

<style scoped>
.customers-container {
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
</style>