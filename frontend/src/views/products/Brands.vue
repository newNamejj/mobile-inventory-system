<template>
  <div class="brands-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>品牌管理</span>
        </div>
      </template>
      
      <!-- 操作按钮 -->
      <div class="operations">
        <el-button type="primary" @click="addBrand">新增品牌</el-button>
      </div>
      
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索品牌名称或描述" 
          :prefix-icon="Search"
          @keyup.enter="fetchBrands"
          style="width: 300px;"
        ></el-input>
        <el-button type="primary" style="margin-left: 10px;" @click="fetchBrands">搜索</el-button>
      </div>
      
      <!-- 品牌列表 -->
      <el-table :data="brandsList" style="width: 100%" v-loading="loading" row-key="id">
        <el-table-column prop="id" label="ID" width="100"></el-table-column>
        <el-table-column prop="name" label="品牌名称" width="200">
          <template #default="scope">
            <el-input 
              v-if="scope.row.editing" 
              v-model="scope.row.name" 
              placeholder="请输入品牌名称"
            ></el-input>
            <span v-else>{{ scope.row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述">
          <template #default="scope">
            <el-input 
              v-if="scope.row.editing" 
              v-model="scope.row.description" 
              type="textarea"
              :rows="2"
              placeholder="请输入品牌描述"
            ></el-input>
            <span v-else>{{ scope.row.description }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180"></el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="180"></el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <div v-if="!scope.row.editing">
              <el-button size="small" @click="editBrand(scope.row)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteBrand(scope.row)">删除</el-button>
            </div>
            <div v-else>
              <el-button size="small" type="primary" @click="saveBrand(scope.row)">保存</el-button>
              <el-button size="small" @click="cancelEdit(scope.row)">取消</el-button>
            </div>
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
    
    <!-- 新增/编辑品牌对话框 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="500px">
      <el-form :model="currentBrand" :rules="brandRules" ref="brandFormRef" label-width="100px">
        <el-form-item label="品牌名称" prop="name">
          <el-input v-model="currentBrand.name" placeholder="请输入品牌名称"></el-input>
        </el-form-item>
        <el-form-item label="品牌描述" prop="description">
          <el-input 
            v-model="currentBrand.description" 
            type="textarea" 
            :rows="4"
            placeholder="请输入品牌描述"
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmBrandAction" :loading="submitting">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import request from '@/utils/request'

export default {
  name: 'Brands',
  setup() {
    const brandsList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const searchKeyword = ref('')
    
    const dialogVisible = ref(false)
    const dialogTitle = ref('')
    const submitting = ref(false)
    const brandFormRef = ref(null)
    
    const currentBrand = reactive({
      id: null,
      name: '',
      description: ''
    })
    
    const brandRules = {
      name: [
        { required: true, message: '请输入品牌名称', trigger: 'blur' },
        { min: 1, max: 100, message: '品牌名称长度应在1到100个字符之间', trigger: 'blur' }
      ]
    }
    
    const fetchBrands = async () => {
      loading.value = true
      try {
        const response = await request.get('/api/brands', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value
          }
        })
        
        if (response.data.success) {
          // 添加editing属性用于行内编辑
          const brandsWithEditing = response.data.data.list.map(brand => ({
            ...brand,
            editing: false
          }))
          brandsList.value = brandsWithEditing
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取品牌列表失败')
        }
      } catch (error) {
        console.error('获取品牌列表错误:', error)
        ElMessage.error('获取品牌列表失败')
      } finally {
        loading.value = false
      }
    }
    
    const handleSizeChange = (size) => {
      pageSize.value = size
      fetchBrands()
    }
    
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchBrands()
    }
    
    const addBrand = () => {
      // 重置表单
      currentBrand.id = null
      currentBrand.name = ''
      currentBrand.description = ''
      
      dialogTitle.value = '新增品牌'
      dialogVisible.value = true
    }
    
    const editBrand = (row) => {
      // 重置表单
      currentBrand.id = row.id
      currentBrand.name = row.name
      currentBrand.description = row.description
      
      dialogTitle.value = '编辑品牌'
      dialogVisible.value = true
    }
    
    const deleteBrand = (row) => {
      ElMessageBox.confirm(`确定要删除品牌 "${row.name}" 吗？删除后将无法恢复。`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.delete(`/api/brands/${row.id}`)
          
          if (response.data.success) {
            ElMessage.success('品牌删除成功')
            fetchBrands() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '品牌删除失败')
          }
        } catch (error) {
          console.error('删除品牌错误:', error)
          ElMessage.error('品牌删除失败')
        }
      }).catch(() => {
        // 用户取消删除
      })
    }
    
    const confirmBrandAction = async () => {
      if (!brandFormRef.value) return
      
      await brandFormRef.value.validate(async (valid) => {
        if (valid) {
          submitting.value = true
          try {
            let response
            
            if (currentBrand.id) {
              // 编辑现有品牌
              response = await request.put(`/api/brands/${currentBrand.id}`, {
                name: currentBrand.name,
                description: currentBrand.description
              })
            } else {
              // 新增品牌
              response = await request.post('/api/brands', {
                name: currentBrand.name,
                description: currentBrand.description
              })
            }
            
            if (response.data.success) {
              ElMessage.success(currentBrand.id ? '品牌更新成功' : '品牌创建成功')
              dialogVisible.value = false
              fetchBrands() // 刷新列表
            } else {
              ElMessage.error(response.data.message || (currentBrand.id ? '品牌更新失败' : '品牌创建失败'))
            }
          } catch (error) {
            console.error(currentBrand.id ? '更新品牌错误:' : '创建品牌错误:', error)
            ElMessage.error(currentBrand.id ? '品牌更新失败' : '品牌创建失败')
          } finally {
            submitting.value = false
          }
        }
      })
    }
    
    // 行内编辑相关方法
    const editRow = (row) => {
      // 保存原始数据用于取消编辑
      row.originalData = { ...row }
      row.editing = true
    }
    
    const saveBrand = async (row) => {
      if (!row.name) {
        ElMessage.warning('品牌名称不能为空')
        return
      }
      
      try {
        const response = await request.put(`/api/brands/${row.id}`, {
          name: row.name,
          description: row.description
        })
        
        if (response.data.success) {
          ElMessage.success('品牌更新成功')
          row.editing = false
          // 更新列表中的数据
          const index = brandsList.value.findIndex(item => item.id === row.id)
          if (index !== -1) {
            brandsList.value[index] = { ...row }
          }
        } else {
          ElMessage.error(response.data.message || '品牌更新失败')
        }
      } catch (error) {
        console.error('更新品牌错误:', error)
        ElMessage.error('品牌更新失败')
      }
    }
    
    const cancelEdit = (row) => {
      // 恢复原始数据
      if (row.originalData) {
        Object.assign(row, row.originalData)
        delete row.originalData
      }
      row.editing = false
    }
    
    onMounted(() => {
      fetchBrands()
    })
    
    return {
      brandsList,
      loading,
      currentPage,
      pageSize,
      total,
      searchKeyword,
      dialogVisible,
      dialogTitle,
      submitting,
      brandFormRef,
      currentBrand,
      brandRules,
      Search,
      fetchBrands,
      handleSizeChange,
      handleCurrentChange,
      addBrand,
      editBrand,
      deleteBrand,
      confirmBrandAction,
      editRow,
      saveBrand,
      cancelEdit
    }
  }
}
</script>

<style scoped>
.brands-container {
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