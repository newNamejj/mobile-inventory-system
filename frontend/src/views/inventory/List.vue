<template>
  <div class="inventory-list-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>库存查询</span>
        </div>
      </template>
      
      <!-- 搜索和筛选 -->
      <div class="search-bar">
        <el-row :gutter="20">
          <el-col :span="6">
            <el-input 
              v-model="searchKeyword" 
              placeholder="搜索型号或品牌" 
              :prefix-icon="Search"
              @keyup.enter="fetchInventoryList"
            ></el-input>
          </el-col>
          <el-col :span="4">
            <el-button type="primary" @click="fetchInventoryList">搜索</el-button>
          </el-col>
          <el-col :span="4" :offset="10">
            <el-checkbox v-model="showLowStock" @change="fetchInventoryList">只显示低库存</el-checkbox>
          </el-col>
        </el-row>
      </div>
      
      <!-- 库存表格 -->
      <el-table :data="inventoryList" style="width: 100%" v-loading="loading">
        <el-table-column prop="model_name" label="型号" width="200"></el-table-column>
        <el-table-column prop="brand_name" label="品牌" width="120"></el-table-column>
        <el-table-column prop="quantity" label="总库存" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.quantity < scope.row.min_stock_level ? 'danger' : 'success'">
              {{ scope.row.quantity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="available_quantity" label="可用库存" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.available_quantity < scope.row.min_stock_level ? 'danger' : 'primary'">
              {{ scope.row.available_quantity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="min_stock_level" label="最低库存" width="100"></el-table-column>
        <el-table-column prop="last_updated" label="最后更新" width="150"></el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" @click="viewDetails(scope.row)">查看详情</el-button>
            <el-button size="small" type="primary" @click="adjustStock(scope.row)">调整库存</el-button>
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
    
    <!-- 库存调整对话框 -->
    <el-dialog v-model="adjustDialogVisible" title="调整库存" width="500px">
      <el-form :model="adjustForm" label-width="100px">
        <el-form-item label="型号">
          <el-input v-model="adjustForm.model_name" disabled></el-input>
        </el-form-item>
        <el-form-item label="当前库存">
          <el-input v-model.number="adjustForm.current_qty" disabled></el-input>
        </el-form-item>
        <el-form-item label="调整后库存">
          <el-input-number v-model.number="adjustForm.new_qty" :min="0" style="width: 100%"></el-input-number>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="adjustForm.remarks" type="textarea"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="adjustDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmAdjust">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import request from '@/utils/request'

export default {
  name: 'InventoryList',
  setup() {
    const inventoryList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const searchKeyword = ref('')
    const showLowStock = ref(false)
    
    const adjustDialogVisible = ref(false)
    const adjustForm = reactive({
      id: null,
      model_id: null,
      model_name: '',
      current_qty: 0,
      new_qty: 0,
      remarks: ''
    })
    
    const fetchInventoryList = async () => {
      loading.value = true
      try {
        const response = await request.get('/api/inventory', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value,
            lowStock: showLowStock.value
          }
        })
        
        if (response.data.success) {
          inventoryList.value = response.data.data.list
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取库存列表失败')
        }
      } catch (error) {
        console.error('获取库存列表错误:', error)
        ElMessage.error('获取库存列表失败')
      } finally {
        loading.value = false
      }
    }
    
    const handleSizeChange = (size) => {
      pageSize.value = size
      fetchInventoryList()
    }
    
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchInventoryList()
    }
    
    const viewDetails = (row) => {
      // 查看库存详情，可以跳转到详情页面或打开抽屉
      console.log('查看库存详情:', row)
      ElMessage.info('功能开发中：查看库存详情')
    }
    
    const adjustStock = (row) => {
      adjustForm.id = row.id
      adjustForm.model_id = row.model_id
      adjustForm.model_name = row.model_name
      adjustForm.current_qty = row.quantity
      adjustForm.new_qty = row.quantity
      adjustForm.remarks = ''
      adjustDialogVisible.value = true
    }
    
    const confirmAdjust = async () => {
      try {
        const response = await request.put(`/api/inventory/adjust/${adjustForm.id}`, {
          quantity: adjustForm.new_qty,
          remarks: adjustForm.remarks
        })
        
        if (response.data.success) {
          ElMessage.success('库存调整成功')
          adjustDialogVisible.value = false
          fetchInventoryList() // 刷新列表
        } else {
          ElMessage.error(response.data.message || '库存调整失败')
        }
      } catch (error) {
        console.error('库存调整错误:', error)
        ElMessage.error('库存调整失败')
      }
    }
    
    onMounted(() => {
      fetchInventoryList()
    })
    
    return {
      inventoryList,
      loading,
      currentPage,
      pageSize,
      total,
      searchKeyword,
      showLowStock,
      adjustDialogVisible,
      adjustForm,
      Search,
      fetchInventoryList,
      handleSizeChange,
      handleCurrentChange,
      viewDetails,
      adjustStock,
      confirmAdjust
    }
  }
}
</script>

<style scoped>
.inventory-list-container {
  padding: 20px;
}

.search-bar {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>