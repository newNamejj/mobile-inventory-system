<template>
  <div class="suppliers-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>供应商管理</span>
        </div>
      </template>
      
      <!-- 操作按钮 -->
      <div class="operations">
        <el-button type="primary" @click="addSupplier">新增供应商</el-button>
      </div>
      
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索供应商名称或联系人" 
          style="width: 300px; margin-right: 10px;"
        ></el-input>
        <el-button type="primary" @click="fetchSuppliers">搜索</el-button>
      </div>
      
      <!-- 供应商列表 -->
      <el-table :data="suppliersList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80"></el-table-column>
        <el-table-column prop="name" label="供应商名称" width="200"></el-table-column>
        <el-table-column prop="contact_person" label="联系人" width="120"></el-table-column>
        <el-table-column prop="phone" label="联系电话" width="150"></el-table-column>
        <el-table-column prop="email" label="邮箱" width="200"></el-table-column>
        <el-table-column prop="address" label="地址" width="300"></el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180"></el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" @click="editSupplier(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteSupplier(scope.row)">删除</el-button>
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
    
    <!-- 新增/编辑供应商对话框 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="600px">
      <el-form :model="currentSupplier" :rules="supplierRules" ref="supplierFormRef" label-width="100px">
        <el-form-item label="供应商名称" prop="name">
          <el-input v-model="currentSupplier.name" placeholder="请输入供应商名称"></el-input>
        </el-form-item>
        <el-form-item label="联系人" prop="contact_person">
          <el-input v-model="currentSupplier.contact_person" placeholder="请输入联系人姓名"></el-input>
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="currentSupplier.phone" placeholder="请输入联系电话"></el-input>
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="currentSupplier.email" placeholder="请输入邮箱地址"></el-input>
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input 
            v-model="currentSupplier.address" 
            type="textarea" 
            :rows="3"
            placeholder="请输入详细地址"
          ></el-input>
        </el-form-item>
        <el-form-item label="备注">
          <el-input 
            v-model="currentSupplier.remarks" 
            type="textarea" 
            :rows="3"
            placeholder="请输入备注信息"
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmSupplierAction" :loading="submitting">确定</el-button>
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
  name: 'Suppliers',
  setup() {
    const suppliersList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const searchKeyword = ref('')
    
    const dialogVisible = ref(false)
    const dialogTitle = ref('')
    const submitting = ref(false)
    const supplierFormRef = ref(null)
    
    const currentSupplier = reactive({
      id: null,
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      remarks: ''
    })
    
    const supplierRules = {
      name: [
        { required: true, message: '请输入供应商名称', trigger: 'blur' }
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
    
    // 获取供应商列表
    const fetchSuppliers = async () => {
      loading.value = true
      try {
        const response = await request.get('/api/suppliers', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value
          }
        })
        
        if (response.data.success) {
          suppliersList.value = response.data.data.list
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取供应商列表失败')
        }
      } catch (error) {
        console.error('获取供应商列表错误:', error)
        ElMessage.error('获取供应商列表失败')
      } finally {
        loading.value = false
      }
    }
    
    // 处理分页大小变化
    const handleSizeChange = (size) => {
      pageSize.value = size
      fetchSuppliers()
    }
    
    // 处理当前页变化
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchSuppliers()
    }
    
    // 新增供应商
    const addSupplier = () => {
      // 重置表单
      currentSupplier.id = null
      currentSupplier.name = ''
      currentSupplier.contact_person = ''
      currentSupplier.phone = ''
      currentSupplier.email = ''
      currentSupplier.address = ''
      currentSupplier.remarks = ''
      
      dialogTitle.value = '新增供应商'
      dialogVisible.value = true
    }
    
    // 编辑供应商
    const editSupplier = (row) => {
      // 重置表单
      currentSupplier.id = row.id
      currentSupplier.name = row.name
      currentSupplier.contact_person = row.contact_person
      currentSupplier.phone = row.phone
      currentSupplier.email = row.email
      currentSupplier.address = row.address
      currentSupplier.remarks = row.remarks
      
      dialogTitle.value = '编辑供应商'
      dialogVisible.value = true
    }
    
    // 删除供应商
    const deleteSupplier = (row) => {
      ElMessageBox.confirm(`确定要删除供应商 "${row.name}" 吗？删除后将无法恢复。`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.delete(`/api/suppliers/${row.id}`)
          
          if (response.data.success) {
            ElMessage.success('供应商删除成功')
            fetchSuppliers() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '供应商删除失败')
          }
        } catch (error) {
          console.error('删除供应商错误:', error)
          ElMessage.error('供应商删除失败')
        }
      }).catch(() => {
        // 用户取消删除
      })
    }
    
    // 确认供应商操作
    const confirmSupplierAction = async () => {
      if (!supplierFormRef.value) return
      
      await supplierFormRef.value.validate(async (valid) => {
        if (valid) {
          submitting.value = true
          try {
            let response
            
            if (currentSupplier.id) {
              // 编辑现有供应商
              response = await request.put(`/api/suppliers/${currentSupplier.id}`, {
                name: currentSupplier.name,
                contact_person: currentSupplier.contact_person,
                phone: currentSupplier.phone,
                email: currentSupplier.email,
                address: currentSupplier.address,
                remarks: currentSupplier.remarks
              })
            } else {
              // 新增供应商
              response = await request.post('/api/suppliers', {
                name: currentSupplier.name,
                contact_person: currentSupplier.contact_person,
                phone: currentSupplier.phone,
                email: currentSupplier.email,
                address: currentSupplier.address,
                remarks: currentSupplier.remarks
              })
            }
            
            if (response.data.success) {
              ElMessage.success(currentSupplier.id ? '供应商更新成功' : '供应商创建成功')
              dialogVisible.value = false
              fetchSuppliers() // 刷新列表
            } else {
              ElMessage.error(response.data.message || (currentSupplier.id ? '供应商更新失败' : '供应商创建失败'))
            }
          } catch (error) {
            console.error(currentSupplier.id ? '更新供应商错误:' : '创建供应商错误:', error)
            ElMessage.error(currentSupplier.id ? '供应商更新失败' : '供应商创建失败')
          } finally {
            submitting.value = false
          }
        }
      })
    }
    
    onMounted(() => {
      fetchSuppliers()
    })
    
    return {
      suppliersList,
      loading,
      currentPage,
      pageSize,
      total,
      searchKeyword,
      dialogVisible,
      dialogTitle,
      submitting,
      supplierFormRef,
      currentSupplier,
      supplierRules,
      fetchSuppliers,
      handleSizeChange,
      handleCurrentChange,
      addSupplier,
      editSupplier,
      deleteSupplier,
      confirmSupplierAction
    }
  }
}
</script>

<style scoped>
.suppliers-container {
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