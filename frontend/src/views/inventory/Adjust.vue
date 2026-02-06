<template>
  <div class="inventory-adjust-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>库存调整</span>
        </div>
      </template>
      
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索型号或品牌" 
          style="width: 300px; margin-right: 10px;"
        ></el-input>
        <el-button type="primary" @click="searchInventory">搜索</el-button>
      </div>
      
      <!-- 库存调整表格 -->
      <el-table 
        :data="inventoryList" 
        style="width: 100%" 
        v-loading="loading"
        :cell-style="getCellClass"
      >
        <el-table-column prop="model_name" label="型号" width="200"></el-table-column>
        <el-table-column prop="brand_name" label="品牌" width="120"></el-table-column>
        <el-table-column prop="quantity" label="当前库存" width="120"></el-table-column>
        <el-table-column label="调整数量" width="200">
          <template #default="scope">
            <el-input-number 
              v-model="scope.row.adjustQty" 
              :min="-scope.row.quantity" 
              :max="10000" 
              @change="calculateNewQty(scope.row)"
            ></el-input-number>
          </template>
        </el-table-column>
        <el-table-column label="调整后库存" width="120">
          <template #default="scope">
            <el-input-number 
              v-model="scope.row.newQty" 
              :min="0" 
              @change="calculateAdjustQty(scope.row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="min_stock_level" label="最低库存" width="120"></el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="scope">
            <el-button 
              size="small" 
              type="primary" 
              @click="adjustInventory(scope.row)"
              :disabled="!canAdjust(scope.row)"
            >
              调整
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
    
    <!-- 调整确认对话框 -->
    <el-dialog title="确认调整" v-model="adjustDialogVisible" width="500px">
      <p><strong>型号:</strong> {{ currentAdjust.model_name }}</p>
      <p><strong>当前库存:</strong> {{ currentAdjust.quantity }}</p>
      <p><strong>调整后库存:</strong> {{ currentAdjust.newQty }}</p>
      <p><strong>调整数量:</strong> {{ currentAdjust.adjustQty }}</p>
      <p><strong>调整原因:</strong></p>
      <el-input 
        v-model="adjustReason" 
        type="textarea" 
        :rows="3" 
        placeholder="请输入调整原因"
      ></el-input>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="adjustDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmAdjust" :loading="adjustLoading">确定</el-button>
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
  name: 'InventoryAdjust',
  setup() {
    const inventoryList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const searchKeyword = ref('')
    
    const adjustDialogVisible = ref(false)
    const adjustLoading = ref(false)
    const currentAdjust = reactive({
      id: null,
      model_id: null,
      model_name: '',
      quantity: 0,
      adjustQty: 0,
      newQty: 0
    })
    const adjustReason = ref('')
    
    // 获取库存列表
    const fetchInventoryList = async () => {
      loading.value = true
      try {
        const response = await request.get('/api/inventory', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value
          }
        })
        
        if (response.data.success) {
          // 初始化调整数量和新库存
          const list = response.data.data.list.map(item => ({
            ...item,
            adjustQty: 0,
            newQty: item.quantity
          }))
          inventoryList.value = list
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
    
    // 搜索库存
    const searchInventory = () => {
      currentPage.value = 1
      fetchInventoryList()
    }
    
    // 处理分页大小变化
    const handleSizeChange = (size) => {
      pageSize.value = size
      fetchInventoryList()
    }
    
    // 处理当前页变化
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchInventoryList()
    }
    
    // 计算新库存数量
    const calculateNewQty = (row) => {
      row.newQty = row.quantity + row.adjustQty
    }
    
    // 计算调整数量
    const calculateAdjustQty = (row) => {
      row.adjustQty = row.newQty - row.quantity
    }
    
    // 检查是否可以调整库存
    const canAdjust = (row) => {
      return row.adjustQty !== 0 && row.newQty >= 0
    }
    
    // 获取单元格样式
    const getCellClass = ({ row, column }) => {
      if (column.property === 'quantity' || column.property === 'newQty') {
        if (row.quantity < row.min_stock_level) {
          return 'low-stock-cell'
        }
      }
      return ''
    }
    
    // 调整库存
    const adjustInventory = (row) => {
      // 设置当前调整项
      Object.assign(currentAdjust, {
        id: row.id,
        model_id: row.model_id,
        model_name: row.model_name,
        quantity: row.quantity,
        adjustQty: row.adjustQty,
        newQty: row.newQty
      })
      
      // 显示确认对话框
      adjustReason.value = ''
      adjustDialogVisible.value = true
    }
    
    // 确认调整
    const confirmAdjust = async () => {
      if (!adjustReason.value.trim()) {
        ElMessage.warning('请输入调整原因')
        return
      }
      
      if (currentAdjust.adjustQty === 0) {
        ElMessage.warning('调整数量不能为0')
        return
      }
      
      adjustLoading.value = true
      try {
        const response = await request.put(`/api/inventory/adjust/${currentAdjust.id}`, {
          quantity: currentAdjust.newQty,
          remarks: `库存调整: ${adjustReason.value}, 调整数量: ${currentAdjust.adjustQty}`
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
      } finally {
        adjustLoading.value = false
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
      adjustDialogVisible,
      adjustLoading,
      currentAdjust,
      adjustReason,
      fetchInventoryList,
      searchInventory,
      handleSizeChange,
      handleCurrentChange,
      calculateNewQty,
      calculateAdjustQty,
      canAdjust,
      getCellClass,
      adjustInventory,
      confirmAdjust
    }
  }
}
</script>

<style scoped>
.inventory-adjust-container {
  padding: 20px;
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

.low-stock-cell {
  color: #f56c6c;
  font-weight: bold;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>