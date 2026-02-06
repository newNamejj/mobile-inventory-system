<template>
  <div class="inventory-outbound-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>出库管理</span>
        </div>
      </template>
      
      <!-- 出库单表单 -->
      <el-form :model="outboundForm" :rules="rules" ref="outboundFormRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="出库类型" prop="outboundType">
              <el-select v-model="outboundForm.outboundType" placeholder="请选择出库类型">
                <el-option label="销售出库" value="sale"></el-option>
                <el-option label="退货出库" value="return"></el-option>
                <el-option label="调拨出库" value="transfer"></el-option>
                <el-option label="其他出库" value="other"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="客户" prop="customerId" v-if="outboundForm.outboundType === 'sale'">
              <el-select v-model="outboundForm.customerId" placeholder="请选择客户" filterable>
                <el-option 
                  v-for="customer in customers" 
                  :key="customer.id" 
                  :label="customer.name" 
                  :value="customer.id"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="备注">
          <el-input v-model="outboundForm.remarks" type="textarea" placeholder="请输入备注信息"></el-input>
        </el-form-item>
      </el-form>
      
      <!-- 出库商品列表 -->
      <div class="goods-section">
        <div class="section-header">
          <span>出库商品列表</span>
          <el-button type="primary" @click="addGoods">添加商品</el-button>
        </div>
        
        <el-table :data="outboundForm.goodsList" style="width: 100%; margin-top: 10px;">
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
          <el-table-column label="销售价" width="120">
            <template #default="scope">
              <el-input-number 
                v-if="scope.$index === editingIndex" 
                v-model="scope.row.sale_price" 
                :precision="2" 
                :min="0" 
                style="width: 100%"
              ></el-input-number>
              <span v-else>¥{{ scope.row.sale_price }}</span>
            </template>
          </el-table-column>
          <el-table-column label="出库数量" width="120">
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
              ¥{{ (scope.row.sale_price * scope.row.quantity).toFixed(2) }}
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
      <div class="total-info" v-if="outboundForm.goodsList.length > 0">
        <el-divider></el-divider>
        <div class="total-row">
          <span>总计：</span>
          <span>商品种类：{{ outboundForm.goodsList.length }}种</span>
          <span>总数量：{{ totalQuantity }}</span>
          <span>总金额：¥{{ totalAmount.toFixed(2) }}</span>
        </div>
      </div>
      
      <!-- 提交按钮 -->
      <div class="submit-section">
        <el-button type="primary" @click="submitOutbound" :loading="submitting">提交出库</el-button>
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
  name: 'InventoryOutbound',
  setup() {
    const outboundFormRef = ref(null)
    const editingIndex = ref(-1)
    const submitting = ref(false)
    
    const customers = ref([])
    const models = ref([])
    
    const outboundForm = reactive({
      outboundType: '',
      customerId: null,
      remarks: '',
      goodsList: []
    })
    
    const rules = {
      outboundType: [
        { required: true, message: '请选择出库类型', trigger: 'change' }
      ],
      customerId: [
        { required: true, message: '请选择客户', trigger: 'change' }
      ]
    }
    
    // 计算属性
    const totalQuantity = computed(() => {
      return outboundForm.goodsList.reduce((sum, item) => sum + (item.quantity || 0), 0)
    })
    
    const totalAmount = computed(() => {
      return outboundForm.goodsList.reduce((sum, item) => sum + (item.sale_price * item.quantity || 0), 0)
    })
    
    // 获取客户列表
    const fetchCustomers = async () => {
      try {
        const response = await request.get('/api/customers')
        if (response.data.success) {
          customers.value = response.data.data.list
        }
      } catch (error) {
        console.error('获取客户列表失败:', error)
        ElMessage.error('获取客户列表失败')
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
      outboundForm.goodsList.push({
        model_id: null,
        model_name: '',
        brand_name: '',
        sale_price: 0,
        quantity: 1
      })
      // 默认进入编辑状态
      editingIndex.value = outboundForm.goodsList.length - 1
    }
    
    // 编辑行
    const editRow = (index) => {
      editingIndex.value = index
    }
    
    // 保存编辑
    const saveEdit = (index) => {
      const item = outboundForm.goodsList[index]
      if (!item.model_id) {
        ElMessage.warning('请选择商品型号')
        return
      }
      if (!item.sale_price || item.sale_price <= 0) {
        ElMessage.warning('请输入正确的销售价')
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
        outboundForm.goodsList.splice(index, 1)
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
        // 可以根据型号自动填充销售价
        if (!row.sale_price || row.sale_price === 0) {
          row.sale_price = parseFloat(selectedModel.sale_price || 0)
        }
      }
    }
    
    // 提交出库
    const submitOutbound = async () => {
      if (!outboundForm.outboundType) {
        ElMessage.warning('请选择出库类型')
        return
      }
      
      if (outboundForm.outboundType === 'sale' && !outboundForm.customerId) {
        ElMessage.warning('请选择客户')
        return
      }
      
      if (outboundForm.goodsList.length === 0) {
        ElMessage.warning('请至少添加一种商品')
        return
      }
      
      // 验证每条记录
      for (let i = 0; i < outboundForm.goodsList.length; i++) {
        const item = outboundForm.goodsList[i]
        if (!item.model_id) {
          ElMessage.warning(`第${i + 1}行请选择商品型号`)
          return
        }
        if (!item.sale_price || item.sale_price <= 0) {
          ElMessage.warning(`第${i + 1}行请输入正确的销售价`)
          return
        }
        if (!item.quantity || item.quantity <= 0) {
          ElMessage.warning(`第${i + 1}行请输入正确的数量`)
          return
        }
      }
      
      submitting.value = true
      try {
        // 根据出库类型决定关联表
        let relatedTable = null
        let relatedId = null
        
        if (outboundForm.outboundType === 'sale') {
          // 如果是销售出库，可能需要先创建销售订单
          // 这里简化处理，直接出库
          relatedTable = 'sales_orders'
          // 实际应用中可能需要先创建销售订单
        }
        
        // 执行出库操作
        for (const item of outboundForm.goodsList) {
          const response = await request.post('/api/inventory/out', {
            model_id: item.model_id,
            quantity: item.quantity,
            remarks: outboundForm.remarks || `出库操作，类型：${outboundForm.outboundType}`,
            related_table: relatedTable,
            related_id: relatedId
          })
          
          if (!response.data.success) {
            throw new Error(response.data.message || '出库操作失败')
          }
        }
        
        ElMessage.success('出库操作成功')
        resetForm()
      } catch (error) {
        console.error('出库操作失败:', error)
        ElMessage.error(error.message || '出库操作失败')
      } finally {
        submitting.value = false
      }
    }
    
    // 重置表单
    const resetForm = () => {
      outboundForm.outboundType = ''
      outboundForm.customerId = null
      outboundForm.remarks = ''
      outboundForm.goodsList = []
      editingIndex.value = -1
    }
    
    onMounted(() => {
      fetchCustomers()
      fetchModels()
    })
    
    return {
      outboundFormRef,
      editingIndex,
      submitting,
      outboundForm,
      rules,
      customers,
      models,
      totalQuantity,
      totalAmount,
      addGoods,
      editRow,
      saveEdit,
      deleteRow,
      handleModelChange,
      submitOutbound,
      resetForm
    }
  }
}
</script>

<style scoped>
.inventory-outbound-container {
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