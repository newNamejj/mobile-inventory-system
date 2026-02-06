<template>
  <div class="purchases-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>采购管理</span>
        </div>
      </template>
      
      <!-- 操作按钮 -->
      <div class="operations">
        <el-button type="primary" @click="addPurchaseOrder">新增采购单</el-button>
      </div>
      
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索订单号或供应商" 
          style="width: 300px; margin-right: 10px;"
        ></el-input>
        <el-select v-model="searchStatus" placeholder="订单状态" style="width: 150px; margin-right: 10px;">
          <el-option label="全部" value=""></el-option>
          <el-option label="待收货" value="pending"></el-option>
          <el-option label="已完成" value="completed"></el-option>
          <el-option label="已取消" value="cancelled"></el-option>
        </el-select>
        <el-button type="primary" @click="fetchPurchaseOrders">搜索</el-button>
      </div>
      
      <!-- 采购订单列表 -->
      <el-table :data="purchaseOrdersList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="订单号" width="120"></el-table-column>
        <el-table-column prop="supplier_name" label="供应商" width="200"></el-table-column>
        <el-table-column prop="total_amount" label="总金额" width="120">
          <template #default="scope">
            ¥{{ scope.row.total_amount }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
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
        <el-table-column prop="received_at" label="收货时间" width="180"></el-table-column>
        <el-table-column label="操作" width="250">
          <template #default="scope">
            <el-button size="small" @click="viewDetail(scope.row)">详情</el-button>
            <el-button 
              size="small" 
              type="primary" 
              @click="receiveGoods(scope.row)"
              :disabled="scope.row.status !== 'pending'"
            >
              收货
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="cancelOrder(scope.row)"
              :disabled="scope.row.status !== 'pending'"
            >
              取消
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
    
    <!-- 新增/编辑采购订单对话框 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="800px">
      <el-form :model="currentOrder" :rules="orderRules" ref="orderFormRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="供应商" prop="supplier_id">
              <el-select 
                v-model="currentOrder.supplier_id" 
                placeholder="请选择供应商" 
                filterable
                style="width: 100%"
              >
                <el-option 
                  v-for="supplier in suppliers" 
                  :key="supplier.id" 
                  :label="supplier.name" 
                  :value="supplier.id"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="备注">
              <el-input 
                v-model="currentOrder.remarks" 
                type="textarea" 
                :rows="2"
                placeholder="请输入备注信息"
              ></el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      
      <!-- 商品列表 -->
      <div class="goods-section">
        <div class="section-header">
          <span>采购商品列表</span>
          <el-button type="primary" @click="addGoods">添加商品</el-button>
        </div>
        
        <el-table :data="currentOrder.items" style="width: 100%; margin-top: 10px;">
          <el-table-column prop="model_name" label="商品型号" width="200">
            <template #default="scope">
              <el-select 
                v-if="scope.$index === editingIndex" 
                v-model="scope.row.model_id" 
                placeholder="请选择商品型号"
                filterable
                @change="handleModelChange(scope.row)"
                style="width: 100%"
              >
                <el-option 
                  v-for="model in models" 
                  :key="model.id" 
                  :label="model.model_name" 
                  :value="model.id"
                ></el-option>
              </el-select>
              <span v-else>{{ scope.row.model_name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="brand_name" label="品牌" width="120">
            <template #default="scope">
              <span>{{ scope.row.brand_name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="采购价" width="120">
            <template #default="scope">
              <el-input-number 
                v-if="scope.$index === editingIndex" 
                v-model="scope.row.price" 
                :precision="2" 
                :min="0" 
                style="width: 100%"
              ></el-input-number>
              <span v-else>¥{{ scope.row.price }}</span>
            </template>
          </el-table-column>
          <el-table-column label="数量" width="120">
            <template #default="scope">
              <el-input-number 
                v-if="scope.$index === editingIndex" 
                v-model="scope.row.quantity" 
                :min="1" 
                style="width: 100%"
              ></el-input-number>
              <span v-else>{{ scope.row.quantity }}</span>
            </template>
          </el-table-column>
          <el-table-column label="小计" width="120">
            <template #default="scope">
              ¥{{ (scope.row.price * scope.row.quantity).toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="scope">
              <el-button 
                v-if="scope.$index === editingIndex" 
                size="small" 
                type="primary" 
                @click="saveEdit(scope.$index)"
              >
                保存
              </el-button>
              <el-button 
                v-else 
                size="small" 
                @click="editRow(scope.$index)"
              >
                编辑
              </el-button>
              <el-button 
                size="small" 
                type="danger" 
                @click="deleteRow(scope.$index)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      
      <!-- 总计信息 -->
      <div class="total-info" v-if="currentOrder.items.length > 0">
        <el-divider></el-divider>
        <div class="total-row">
          <span>总计：</span>
          <span>商品种类：{{ currentOrder.items.length }}种</span>
          <span>总数量：{{ totalQuantity }}</span>
          <span>总金额：¥{{ totalAmount.toFixed(2) }}</span>
        </div>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmOrderAction" :loading="submitting">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'

export default {
  name: 'Purchases',
  setup() {
    const purchaseOrdersList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const searchKeyword = ref('')
    const searchStatus = ref('')
    
    const suppliers = ref([])
    const models = ref([])
    
    const dialogVisible = ref(false)
    const dialogTitle = ref('')
    const submitting = ref(false)
    const orderFormRef = ref(null)
    const editingIndex = ref(-1)
    
    const currentOrder = reactive({
      id: null,
      supplier_id: null,
      remarks: '',
      items: []
    })
    
    const orderRules = {
      supplier_id: [
        { required: true, message: '请选择供应商', trigger: 'change' }
      ]
    }
    
    // 计算属性
    const totalQuantity = computed(() => {
      return currentOrder.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
    })
    
    const totalAmount = computed(() => {
      return currentOrder.items.reduce((sum, item) => sum + (item.price * item.quantity || 0), 0)
    })
    
    // 获取采购订单列表
    const fetchPurchaseOrders = async () => {
      loading.value = true
      try {
        const response = await request.get('/api/purchases/orders', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value,
            status: searchStatus.value
          }
        })
        
        if (response.data.success) {
          purchaseOrdersList.value = response.data.data.list
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取采购订单列表失败')
        }
      } catch (error) {
        console.error('获取采购订单列表错误:', error)
        ElMessage.error('获取采购订单列表失败')
      } finally {
        loading.value = false
      }
    }
    
    // 获取供应商列表
    const fetchSuppliers = async () => {
      try {
        const response = await request.get('/api/suppliers')
        if (response.data.success) {
          suppliers.value = response.data.data.list
        }
      } catch (error) {
        console.error('获取供应商列表失败:', error)
        ElMessage.error('获取供应商列表失败')
      }
    }
    
    // 获取商品型号列表
    const fetchModels = async () => {
      try {
        const response = await request.get('/api/models')
        if (response.data.success) {
          models.value = response.data.data.list
        }
      } catch (error) {
        console.error('获取商品型号列表失败:', error)
        ElMessage.error('获取商品型号列表失败')
      }
    }
    
    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        pending: '待收货',
        completed: '已完成',
        cancelled: '已取消'
      }
      return statusMap[status] || status
    }
    
    // 获取状态标签类型
    const getStatusType = (status) => {
      const typeMap = {
        pending: 'warning',
        completed: 'success',
        cancelled: 'danger'
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
      fetchPurchaseOrders()
    }
    
    // 处理当前页变化
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchPurchaseOrders()
    }
    
    // 新增采购订单
    const addPurchaseOrder = () => {
      // 重置表单
      currentOrder.id = null
      currentOrder.supplier_id = null
      currentOrder.remarks = ''
      currentOrder.items = []
      
      dialogTitle.value = '新增采购订单'
      dialogVisible.value = true
    }
    
    // 查看详情
    const viewDetail = (row) => {
      console.log('查看订单详情:', row)
      ElMessage.info('功能开发中：查看订单详情')
    }
    
    // 收货
    const receiveGoods = (row) => {
      ElMessageBox.confirm(`确定要收货订单 "${row.id}" 吗？收货后将更新库存。`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.put(`/api/purchases/orders/${row.id}/receive`)
          
          if (response.data.success) {
            ElMessage.success('收货成功')
            fetchPurchaseOrders() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '收货失败')
          }
        } catch (error) {
          console.error('收货错误:', error)
          ElMessage.error('收货失败')
        }
      }).catch(() => {
        // 用户取消收货
      })
    }
    
    // 取消订单
    const cancelOrder = (row) => {
      ElMessageBox.confirm(`确定要取消订单 "${row.id}" 吗？`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.put(`/api/purchases/orders/${row.id}/status`, {
            status: 'cancelled'
          })
          
          if (response.data.success) {
            ElMessage.success('订单已取消')
            fetchPurchaseOrders() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '取消订单失败')
          }
        } catch (error) {
          console.error('取消订单错误:', error)
          ElMessage.error('取消订单失败')
        }
      }).catch(() => {
        // 用户取消操作
      })
    }
    
    // 添加商品
    const addGoods = () => {
      currentOrder.items.push({
        model_id: null,
        model_name: '',
        brand_name: '',
        price: 0,
        quantity: 1
      })
      // 默认进入编辑状态
      editingIndex.value = currentOrder.items.length - 1
    }
    
    // 编辑行
    const editRow = (index) => {
      editingIndex.value = index
    }
    
    // 保存编辑
    const saveEdit = (index) => {
      const item = currentOrder.items[index]
      if (!item.model_id) {
        ElMessage.warning('请选择商品型号')
        return
      }
      if (!item.price || item.price <= 0) {
        ElMessage.warning('请输入正确的采购价')
        return
      }
      if (!item.quantity || item.quantity <= 0) {
        ElMessage.warning('请输入正确的数量')
        return
      }
      
      // 根据model_id获取型号和品牌名称
      const selectedModel = models.value.find(m => m.id === item.model_id)
      if (selectedModel) {
        item.model_name = selectedModel.model_name
        item.brand_name = selectedModel.brand_name
      }
      
      editingIndex.value = -1
    }
    
    // 删除行
    const deleteRow = (index) => {
      ElMessageBox.confirm('确定要删除这条记录吗?', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        currentOrder.items.splice(index, 1)
        if (editingIndex.value === index) {
          editingIndex.value = -1
        }
        ElMessage.success('删除成功')
      }).catch(() => {
        // 取消删除
      })
    }
    
    // 型号改变事件
    const handleModelChange = (row) => {
      const selectedModel = models.value.find(m => m.id === row.model_id)
      if (selectedModel) {
        row.model_name = selectedModel.model_name
        row.brand_name = selectedModel.brand_name
        // 可以根据型号自动填充采购价
        if (!row.price || row.price === 0) {
          row.price = parseFloat(selectedModel.purchase_price || 0)
        }
      }
    }
    
    // 确认订单操作
    const confirmOrderAction = async () => {
      if (!orderFormRef.value) return
      
      await orderFormRef.value.validate(async (valid) => {
        if (valid) {
          if (currentOrder.items.length === 0) {
            ElMessage.warning('请至少添加一种商品')
            return
          }
          
          // 验证每条记录
          for (let i = 0; i < currentOrder.items.length; i++) {
            const item = currentOrder.items[i]
            if (!item.model_id) {
              ElMessage.warning(`第${i + 1}行请选择商品型号`)
              return
            }
            if (!item.price || item.price <= 0) {
              ElMessage.warning(`第${i + 1}行请输入正确的采购价`)
              return
            }
            if (!item.quantity || item.quantity <= 0) {
              ElMessage.warning(`第${i + 1}行请输入正确的数量`)
              return
            }
          }
          
          submitting.value = true
          try {
            let response
            
            if (currentOrder.id) {
              // 编辑现有订单
              response = await request.put(`/api/purchases/orders/${currentOrder.id}`, {
                supplier_id: currentOrder.supplier_id,
                items: currentOrder.items,
                remarks: currentOrder.remarks
              })
            } else {
              // 新增订单
              response = await request.post('/api/purchases/orders', {
                supplier_id: currentOrder.supplier_id,
                items: currentOrder.items,
                remarks: currentOrder.remarks
              })
            }
            
            if (response.data.success) {
              ElMessage.success(currentOrder.id ? '采购订单更新成功' : '采购订单创建成功')
              dialogVisible.value = false
              fetchPurchaseOrders() // 刷新列表
            } else {
              ElMessage.error(response.data.message || (currentOrder.id ? '采购订单更新失败' : '采购订单创建失败'))
            }
          } catch (error) {
            console.error(currentOrder.id ? '更新采购订单错误:' : '创建采购订单错误:', error)
            ElMessage.error(currentOrder.id ? '采购订单更新失败' : '采购订单创建失败')
          } finally {
            submitting.value = false
          }
        }
      })
    }
    
    onMounted(() => {
      fetchPurchaseOrders()
      fetchSuppliers()
      fetchModels()
    })
    
    return {
      purchaseOrdersList,
      loading,
      currentPage,
      pageSize,
      total,
      searchKeyword,
      searchStatus,
      suppliers,
      models,
      dialogVisible,
      dialogTitle,
      submitting,
      orderFormRef,
      editingIndex,
      currentOrder,
      orderRules,
      totalQuantity,
      totalAmount,
      fetchPurchaseOrders,
      fetchSuppliers,
      fetchModels,
      getStatusText,
      getStatusType,
      getStatusEffect,
      handleSizeChange,
      handleCurrentChange,
      addPurchaseOrder,
      viewDetail,
      receiveGoods,
      cancelOrder,
      addGoods,
      editRow,
      saveEdit,
      deleteRow,
      handleModelChange,
      confirmOrderAction
    }
  }
}
</script>

<style scoped>
.purchases-container {
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

.goods-section {
  margin-top: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.total-info {
  margin-top: 20px;
}

.total-row {
  display: flex;
  justify-content: flex-end;
  gap: 20px;
  font-weight: bold;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>