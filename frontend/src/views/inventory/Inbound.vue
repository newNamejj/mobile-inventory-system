<template>
  <div class="inventory-inbound-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>入库管理</span>
        </div>
      </template>
      
      <!-- 入库单表单 -->
      <el-form :model="inboundForm" :rules="rules" ref="inboundFormRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="入库类型" prop="inboundType">
              <el-select v-model="inboundForm.inboundType" placeholder="请选择入库类型">
                <el-option label="采购入库" value="purchase"></el-option>
                <el-option label="退货入库" value="return"></el-option>
                <el-option label="调拨入库" value="transfer"></el-option>
                <el-option label="其他入库" value="other"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="供应商" prop="supplierId" v-if="inboundForm.inboundType === 'purchase'">
              <el-select v-model="inboundForm.supplierId" placeholder="请选择供应商" filterable>
                <el-option 
                  v-for="supplier in suppliers" 
                  :key="supplier.id" 
                  :label="supplier.name" 
                  :value="supplier.id"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="备注">
          <el-input v-model="inboundForm.remarks" type="textarea" placeholder="请输入备注信息"></el-input>
        </el-form-item>
      </el-form>
      
      <!-- 入库商品列表 -->
      <div class="goods-section">
        <div class="section-header">
          <span>入库商品列表</span>
          <el-button type="primary" @click="addGoods">添加商品</el-button>
        </div>
        
        <el-table :data="inboundForm.goodsList" style="width: 100%; margin-top: 10px;">
          <el-table-column prop="model_name" label="商品型号" width="200">
            <template #default="scope">
              <el-select 
                v-if="scope.$index === editingIndex" 
                v-model="scope.row.model_id" 
                placeholder="请选择商品型号"
                filterable
                @change="handleModelChange(scope.row)"
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
                v-model="scope.row.purchase_price" 
                :precision="2" 
                :min="0" 
                style="width: 100%"
              ></el-input-number>
              <span v-else>¥{{ scope.row.purchase_price }}</span>
            </template>
          </el-table-column>
          <el-table-column label="入库数量" width="120">
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
          <el-table-column label="总金额" width="120">
            <template #default="scope">
              ¥{{ (scope.row.purchase_price * scope.row.quantity).toFixed(2) }}
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
      <div class="total-info" v-if="inboundForm.goodsList.length > 0">
        <el-divider></el-divider>
        <div class="total-row">
          <span>总计：</span>
          <span>商品种类：{{ inboundForm.goodsList.length }}种</span>
          <span>总数量：{{ totalQuantity }}</span>
          <span>总金额：¥{{ totalAmount.toFixed(2) }}</span>
        </div>
      </div>
      
      <!-- 提交按钮 -->
      <div class="submit-section">
        <el-button type="primary" @click="submitInbound" :loading="submitting">提交入库</el-button>
        <el-button @click="resetForm">重置</el-button>
      </div>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'

export default {
  name: 'InventoryInbound',
  setup() {
    const inboundFormRef = ref(null)
    const editingIndex = ref(-1)
    const submitting = ref(false)
    
    const suppliers = ref([])
    const models = ref([])
    
    const inboundForm = reactive({
      inboundType: '',
      supplierId: null,
      remarks: '',
      goodsList: []
    })
    
    const rules = {
      inboundType: [
        { required: true, message: '请选择入库类型', trigger: 'change' }
      ],
      supplierId: [
        { required: true, message: '请选择供应商', trigger: 'change' }
      ]
    }
    
    // 计算属性
    const totalQuantity = computed(() => {
      return inboundForm.goodsList.reduce((sum, item) => sum + (item.quantity || 0), 0)
    })
    
    const totalAmount = computed(() => {
      return inboundForm.goodsList.reduce((sum, item) => sum + (item.purchase_price * item.quantity || 0), 0)
    })
    
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
    
    // 添加商品
    const addGoods = () => {
      inboundForm.goodsList.push({
        model_id: null,
        model_name: '',
        brand_name: '',
        purchase_price: 0,
        quantity: 1
      })
      // 默认进入编辑状态
      editingIndex.value = inboundForm.goodsList.length - 1
    }
    
    // 编辑行
    const editRow = (index) => {
      editingIndex.value = index
    }
    
    // 保存编辑
    const saveEdit = (index) => {
      const item = inboundForm.goodsList[index]
      if (!item.model_id) {
        ElMessage.warning('请选择商品型号')
        return
      }
      if (!item.purchase_price || item.purchase_price <= 0) {
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
        inboundForm.goodsList.splice(index, 1)
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
        if (!row.purchase_price || row.purchase_price === 0) {
          row.purchase_price = parseFloat(selectedModel.purchase_price || 0)
        }
      }
    }
    
    // 提交入库
    const submitInbound = async () => {
      if (!inboundForm.inboundType) {
        ElMessage.warning('请选择入库类型')
        return
      }
      
      if (inboundForm.inboundType === 'purchase' && !inboundForm.supplierId) {
        ElMessage.warning('请选择供应商')
        return
      }
      
      if (inboundForm.goodsList.length === 0) {
        ElMessage.warning('请至少添加一种商品')
        return
      }
      
      // 验证每条记录
      for (let i = 0; i < inboundForm.goodsList.length; i++) {
        const item = inboundForm.goodsList[i]
        if (!item.model_id) {
          ElMessage.warning(`第${i + 1}行请选择商品型号`)
          return
        }
        if (!item.purchase_price || item.purchase_price <= 0) {
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
        // 根据入库类型决定关联表
        let relatedTable = null
        let relatedId = null
        
        if (inboundForm.inboundType === 'purchase') {
          // 如果是采购入库，可能需要先创建采购订单
          // 这里简化处理，直接入库
          relatedTable = 'purchase_orders'
          // 实际应用中可能需要先创建采购订单
        }
        
        // 执行入库操作
        for (const item of inboundForm.goodsList) {
          const response = await request.post('/api/inventory/in', {
            model_id: item.model_id,
            quantity: item.quantity,
            remarks: inboundForm.remarks || `入库操作，类型：${inboundForm.inboundType}`,
            related_table: relatedTable,
            related_id: relatedId
          })
          
          if (!response.data.success) {
            throw new Error(response.data.message || '入库操作失败')
          }
        }
        
        ElMessage.success('入库操作成功')
        resetForm()
      } catch (error) {
        console.error('入库操作失败:', error)
        ElMessage.error(error.message || '入库操作失败')
      } finally {
        submitting.value = false
      }
    }
    
    // 重置表单
    const resetForm = () => {
      inboundForm.inboundType = ''
      inboundForm.supplierId = null
      inboundForm.remarks = ''
      inboundForm.goodsList = []
      editingIndex.value = -1
    }
    
    onMounted(() => {
      fetchSuppliers()
      fetchModels()
    })
    
    return {
      inboundFormRef,
      editingIndex,
      submitting,
      inboundForm,
      rules,
      suppliers,
      models,
      totalQuantity,
      totalAmount,
      addGoods,
      editRow,
      saveEdit,
      deleteRow,
      handleModelChange,
      submitInbound,
      resetForm
    }
  }
}
</script>

<style scoped>
.inventory-inbound-container {
  padding: 20px;
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

.submit-section {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 20px;
}
</style>