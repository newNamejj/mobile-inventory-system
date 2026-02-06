<template>
  <div class="models-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>手机型号管理</span>
        </div>
      </template>
      
      <!-- 操作按钮 -->
      <div class="operations">
        <el-button type="primary" @click="addModel">新增型号</el-button>
      </div>
      
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索型号或品牌" 
          style="width: 300px; margin-right: 10px;"
        ></el-input>
        <el-button type="primary" @click="fetchModels">搜索</el-button>
      </div>
      
      <!-- 型号列表 -->
      <el-table :data="modelsList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80"></el-table-column>
        <el-table-column prop="model_name" label="型号名称" width="200"></el-table-column>
        <el-table-column prop="brand_name" label="品牌" width="120"></el-table-column>
        <el-table-column prop="specifications" label="规格参数" width="300">
          <template #default="scope">
            <div v-html="formatSpecs(scope.row.specifications)"></div>
          </template>
        </el-table-column>
        <el-table-column prop="purchase_price" label="采购价" width="120">
          <template #default="scope">
            ¥{{ scope.row.purchase_price }}
          </template>
        </el-table-column>
        <el-table-column prop="retail_price" label="销售价" width="120">
          <template #default="scope">
            ¥{{ scope.row.retail_price }}
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180"></el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" @click="editModel(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteModel(scope.row)">删除</el-button>
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
    
    <!-- 新增/编辑型号对话框 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="600px">
      <el-form :model="currentModel" :rules="modelRules" ref="modelFormRef" label-width="100px">
        <el-form-item label="型号名称" prop="model_name">
          <el-input v-model="currentModel.model_name" placeholder="请输入型号名称"></el-input>
        </el-form-item>
        <el-form-item label="品牌" prop="brand_id">
          <el-select v-model="currentModel.brand_id" placeholder="请选择品牌" style="width: 100%">
            <el-option 
              v-for="brand in brands" 
              :key="brand.id" 
              :label="brand.name" 
              :value="brand.id"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="规格参数">
          <el-input 
            v-model="currentModel.specifications" 
            type="textarea" 
            :rows="4"
            placeholder="请输入规格参数，用逗号分隔，例如：颜色,内存,存储"
          ></el-input>
        </el-form-item>
        <el-form-item label="采购价" prop="purchase_price">
          <el-input-number 
            v-model="currentModel.purchase_price" 
            :precision="2" 
            :step="100" 
            :min="0" 
            style="width: 100%"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="销售价" prop="sale_price">
          <el-input-number 
            v-model="currentModel.sale_price" 
            :precision="2" 
            :step="100" 
            :min="0" 
            style="width: 100%"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="最低库存">
          <el-input-number 
            v-model="currentModel.min_stock_level" 
            :min="0" 
            style="width: 100%"
          ></el-input-number>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmModelAction" :loading="submitting">确定</el-button>
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
  name: 'Models',
  setup() {
    const modelsList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const searchKeyword = ref('')
    
    const brands = ref([])
    
    const dialogVisible = ref(false)
    const dialogTitle = ref('')
    const submitting = ref(false)
    const modelFormRef = ref(null)
    
    const currentModel = reactive({
      id: null,
      model_name: '',
      brand_id: null,
      specifications: '',
      purchase_price: 0,
      sale_price: 0,
      min_stock_level: 0
    })
    
    const modelRules = {
      model_name: [
        { required: true, message: '请输入型号名称', trigger: 'blur' }
      ],
      brand_id: [
        { required: true, message: '请选择品牌', trigger: 'change' }
      ],
      purchase_price: [
        { required: true, message: '请输入采购价', trigger: 'blur' },
        { type: 'number', min: 0, message: '采购价不能小于0', trigger: 'blur' }
      ],
      sale_price: [
        { required: true, message: '请输入销售价', trigger: 'blur' },
        { type: 'number', min: 0, message: '销售价不能小于0', trigger: 'blur' }
      ]
    }
    
    // 获取型号列表
    const fetchModels = async () => {
      loading.value = true
      try {
        const response = await request.get('/api/models', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value
          }
        })
        
        if (response.data.success) {
          modelsList.value = response.data.data.list
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取型号列表失败')
        }
      } catch (error) {
        console.error('获取型号列表错误:', error)
        ElMessage.error('获取型号列表失败')
      } finally {
        loading.value = false
      }
    }
    
    // 获取品牌列表
    const fetchBrands = async () => {
      try {
        const response = await request.get('/api/brands')
        if (response.data.success) {
          brands.value = response.data.data.list
        }
      } catch (error) {
        console.error('获取品牌列表失败:', error)
        ElMessage.error('获取品牌列表失败')
      }
    }
    
    // 格式化规格参数显示
    const formatSpecs = (specs) => {
      if (!specs) return '-'
      return specs.replace(/,/g, '<br>')
    }
    
    // 处理分页大小变化
    const handleSizeChange = (size) => {
      pageSize.value = size
      fetchModels()
    }
    
    // 处理当前页变化
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchModels()
    }
    
    // 新增型号
    const addModel = () => {
      // 重置表单
      currentModel.id = null
      currentModel.model_name = ''
      currentModel.brand_id = null
      currentModel.specifications = ''
      currentModel.purchase_price = 0
      currentModel.sale_price = 0
      currentModel.min_stock_level = 0
      
      dialogTitle.value = '新增型号'
      dialogVisible.value = true
    }
    
    // 编辑型号
    const editModel = (row) => {
      // 重置表单
      currentModel.id = row.id
      currentModel.model_name = row.model_name
      currentModel.brand_id = row.brand_id
      currentModel.specifications = row.specifications
      currentModel.purchase_price = row.purchase_price
      currentModel.sale_price = row.sale_price
      currentModel.min_stock_level = row.min_stock_level
      
      dialogTitle.value = '编辑型号'
      dialogVisible.value = true
    }
    
    // 删除型号
    const deleteModel = (row) => {
      ElMessageBox.confirm(`确定要删除型号 "${row.model_name}" 吗？删除后将无法恢复。`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.delete(`/api/models/${row.id}`)
          
          if (response.data.success) {
            ElMessage.success('型号删除成功')
            fetchModels() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '型号删除失败')
          }
        } catch (error) {
          console.error('删除型号错误:', error)
          ElMessage.error('型号删除失败')
        }
      }).catch(() => {
        // 用户取消删除
      })
    }
    
    // 确认型号操作
    const confirmModelAction = async () => {
      if (!modelFormRef.value) return
      
      await modelFormRef.value.validate(async (valid) => {
        if (valid) {
          submitting.value = true
          try {
            let response
            
            if (currentModel.id) {
              // 编辑现有型号
              response = await request.put(`/api/models/${currentModel.id}`, {
                model_name: currentModel.model_name,
                brand_id: currentModel.brand_id,
                specifications: currentModel.specifications,
                purchase_price: currentModel.purchase_price,
                retail_price: currentModel.sale_price,
                min_stock_level: currentModel.min_stock_level
              })
            } else {
              // 新增型号
              response = await request.post('/api/models', {
                model_name: currentModel.model_name,
                brand_id: currentModel.brand_id,
                specifications: currentModel.specifications,
                purchase_price: currentModel.purchase_price,
                retail_price: currentModel.sale_price,
                min_stock_level: currentModel.min_stock_level
              })
            }
            
            if (response.data.success) {
              ElMessage.success(currentModel.id ? '型号更新成功' : '型号创建成功')
              dialogVisible.value = false
              fetchModels() // 刷新列表
            } else {
              ElMessage.error(response.data.message || (currentModel.id ? '型号更新失败' : '型号创建失败'))
            }
          } catch (error) {
            console.error(currentModel.id ? '更新型号错误:' : '创建型号错误:', error)
            ElMessage.error(currentModel.id ? '型号更新失败' : '型号创建失败')
          } finally {
            submitting.value = false
          }
        }
      })
    }
    
    onMounted(() => {
      fetchModels()
      fetchBrands()
    })
    
    return {
      modelsList,
      loading,
      currentPage,
      pageSize,
      total,
      searchKeyword,
      brands,
      dialogVisible,
      dialogTitle,
      submitting,
      modelFormRef,
      currentModel,
      modelRules,
      fetchModels,
      fetchBrands,
      formatSpecs,
      handleSizeChange,
      handleCurrentChange,
      addModel,
      editModel,
      deleteModel,
      confirmModelAction
    }
  }
}
</script>

<style scoped>
.models-container {
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