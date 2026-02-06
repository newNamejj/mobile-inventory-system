<template>
  <div class="rebate-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>返利管理</span>
        </div>
      </template>
      
      <!-- 操作按钮 -->
      <div class="operations">
        <el-button type="primary" @click="addRebate">新增返利</el-button>
      </div>
      
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索关联订单或备注" 
          style="width: 300px; margin-right: 10px;"
        ></el-input>
        <el-select v-model="searchType" placeholder="返利类型" style="width: 120px; margin-right: 10px;">
          <el-option label="全部" value=""></el-option>
          <el-option label="采购返利" value="purchase"></el-option>
          <el-option label="销售返利" value="sales"></el-option>
        </el-select>
        <el-select v-model="searchStatus" placeholder="状态" style="width: 120px; margin-right: 10px;">
          <el-option label="全部" value=""></el-option>
          <el-option label="待确认" value="pending"></el-option>
          <el-option label="已确认" value="confirmed"></el-option>
          <el-option label="已兑换" value="redeemed"></el-option>
          <el-option label="已取消" value="cancelled"></el-option>
        </el-select>
        <el-button type="primary" @click="fetchRebates">搜索</el-button>
      </div>
      
      <!-- 返利列表 -->
      <el-table :data="rebatesList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80"></el-table-column>
        <el-table-column prop="rebate_type" label="返利类型" width="120">
          <template #default="scope">
            <el-tag :type="getTypeTagType(scope.row.rebate_type)">
              {{ getTypeText(scope.row.rebate_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="entity_name" label="关联方" width="200"></el-table-column>
        <el-table-column prop="related_table" label="关联单据" width="150">
          <template #default="scope">
            {{ getRelatedTableText(scope.row.related_table) }} - {{ scope.row.related_id }}
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="返利金额" width="120">
          <template #default="scope">
            ¥{{ scope.row.amount }}
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
        <el-table-column prop="expiry_date" label="到期日期" width="150"></el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180"></el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" @click="viewDetail(scope.row)">详情</el-button>
            <el-button 
              size="small" 
              type="primary" 
              @click="confirmRebate(scope.row)"
              :disabled="scope.row.status !== 'pending'"
            >
              确认
            </el-button>
            <el-button 
              size="small" 
              type="success" 
              @click="redeemRebate(scope.row)"
              :disabled="scope.row.status !== 'confirmed'"
            >
              兑换
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
    
    <!-- 新增/编辑返利对话框 -->
    <el-dialog :title="dialogTitle" v-model="dialogVisible" width="600px">
      <el-form :model="currentRebate" :rules="rebateRules" ref="rebateFormRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="返利类型" prop="rebate_type">
              <el-radio-group v-model="currentRebate.rebate_type">
                <el-radio label="purchase">采购返利</el-radio>
                <el-radio label="sales">销售返利</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item 
              :label="currentRebate.rebate_type === 'purchase' ? '供应商' : '客户'" 
              prop="entity_id"
            >
              <el-select 
                v-model="currentRebate.entity_id" 
                :placeholder="currentRebate.rebate_type === 'purchase' ? '请选择供应商' : '请选择客户'"
                filterable
                style="width: 100%"
              >
                <el-option 
                  v-for="entity in entities" 
                  :key="entity.id" 
                  :label="entity.name" 
                  :value="entity.id"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="关联单据" prop="related_table">
              <el-select v-model="currentRebate.related_table" placeholder="请选择关联单据类型" style="width: 100%">
                <el-option label="采购订单" value="purchase_orders"></el-option>
                <el-option label="销售订单" value="sales_orders"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单据编号" prop="related_id">
              <el-input v-model="currentRebate.related_id" placeholder="请输入单据编号"></el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="返利金额" prop="amount">
              <el-input-number 
                v-model="currentRebate.amount" 
                :precision="2" 
                :step="100" 
                :min="0" 
                style="width: 100%"
              ></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期日期">
              <el-date-picker
                v-model="currentRebate.expiry_date"
                type="date"
                placeholder="选择日期"
                style="width: 100%"
              ></el-date-picker>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input 
            v-model="currentRebate.remarks" 
            type="textarea" 
            :rows="3"
            placeholder="请输入备注信息"
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmRebateAction" :loading="submitting">确定</el-button>
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
  name: 'Rebate',
  setup() {
    const rebatesList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const searchKeyword = ref('')
    const searchType = ref('')
    const searchStatus = ref('')
    
    const suppliers = ref([])
    const customers = ref([])
    const entities = ref([]) // 根据返利类型动态显示供应商或客户
    
    const dialogVisible = ref(false)
    const dialogTitle = ref('')
    const submitting = ref(false)
    const rebateFormRef = ref(null)
    
    const currentRebate = reactive({
      id: null,
      rebate_type: 'purchase', // 默认采购返利
      entity_id: null,
      related_table: 'purchase_orders',
      related_id: '',
      amount: 0,
      expiry_date: null,
      remarks: ''
    })
    
    const rebateRules = {
      rebate_type: [
        { required: true, message: '请选择返利类型', trigger: 'change' }
      ],
      entity_id: [
        { required: true, message: '请选择关联方', trigger: 'change' }
      ],
      related_table: [
        { required: true, message: '请选择关联单据类型', trigger: 'change' }
      ],
      related_id: [
        { required: true, message: '请输入单据编号', trigger: 'blur' }
      ],
      amount: [
        { required: true, message: '请输入返利金额', trigger: 'blur' },
        { type: 'number', min: 0, message: '返利金额不能小于0', trigger: 'blur' }
      ]
    }
    
    // 获取返利列表
    const fetchRebates = async () => {
      loading.value = true
      try {
        const params = {
          page: currentPage.value,
          limit: pageSize.value,
          keyword: searchKeyword.value,
          type: searchType.value,
          status: searchStatus.value
        }
        
        const response = await request.get('/api/rebates', { params })
        
        if (response.data.success) {
          rebatesList.value = response.data.data.list
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取返利列表失败')
        }
      } catch (error) {
        console.error('获取返利列表错误:', error)
        ElMessage.error('获取返利列表失败')
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
    
    // 根据返利类型更新实体列表
    const updateEntities = () => {
      entities.value = currentRebate.rebate_type === 'purchase' ? suppliers.value : customers.value
      currentRebate.entity_id = null // 清空选择
    }
    
    // 获取返利类型文本
    const getTypeText = (type) => {
      const typeMap = {
        purchase: '采购返利',
        sales: '销售返利'
      }
      return typeMap[type] || type
    }
    
    // 获取返利类型标签类型
    const getTypeTagType = (type) => {
      const typeMap = {
        purchase: 'warning',
        sales: 'success'
      }
      return typeMap[type] || 'info'
    }
    
    // 获取关联表文本
    const getRelatedTableText = (table) => {
      const tableMap = {
        purchase_orders: '采购订单',
        sales_orders: '销售订单'
      }
      return tableMap[table] || table
    }
    
    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        pending: '待确认',
        confirmed: '已确认',
        redeemed: '已兑换',
        cancelled: '已取消'
      }
      return statusMap[status] || status
    }
    
    // 获取状态标签类型
    const getStatusType = (status) => {
      const typeMap = {
        pending: 'warning',
        confirmed: 'primary',
        redeemed: 'success',
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
      fetchRebates()
    }
    
    // 处理当前页变化
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchRebates()
    }
    
    // 新增返利
    const addRebate = () => {
      // 重置表单
      currentRebate.id = null
      currentRebate.rebate_type = 'purchase'
      currentRebate.entity_id = null
      currentRebate.related_table = 'purchase_orders'
      currentRebate.related_id = ''
      currentRebate.amount = 0
      currentRebate.expiry_date = null
      currentRebate.remarks = ''
      
      dialogTitle.value = '新增返利'
      updateEntities() // 更新实体列表
      dialogVisible.value = true
    }
    
    // 查看详情
    const viewDetail = (row) => {
      console.log('查看返利详情:', row)
      ElMessage.info('功能开发中：查看返利详情')
    }
    
    // 确认返利
    const confirmRebate = (row) => {
      ElMessageBox.confirm(`确定要确认返利 "${row.id}" 吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.put(`/api/rebates/${row.id}/status`, {
            status: 'confirmed'
          })
          
          if (response.data.success) {
            ElMessage.success('返利确认成功')
            fetchRebates() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '返利确认失败')
          }
        } catch (error) {
          console.error('返利确认错误:', error)
          ElMessage.error('返利确认失败')
        }
      }).catch(() => {
        // 用户取消操作
      })
    }
    
    // 兑换返利
    const redeemRebate = (row) => {
      ElMessageBox.confirm(`确定要兑换返利 "${row.id}" 吗？兑换后将不可逆转。`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.put(`/api/rebates/${row.id}/status`, {
            status: 'redeemed'
          })
          
          if (response.data.success) {
            ElMessage.success('返利兑换成功')
            fetchRebates() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '返利兑换失败')
          }
        } catch (error) {
          console.error('返利兑换错误:', error)
          ElMessage.error('返利兑换失败')
        }
      }).catch(() => {
        // 用户取消操作
      })
    }
    
    // 确认返利操作
    const confirmRebateAction = async () => {
      if (!rebateFormRef.value) return
      
      await rebateFormRef.value.validate(async (valid) => {
        if (valid) {
          submitting.value = true
          try {
            let response
            
            // 根据返利类型设置对应的ID
            const postData = {
              rebate_type: currentRebate.rebate_type,
              related_table: currentRebate.related_table,
              related_id: currentRebate.related_id,
              amount: currentRebate.amount,
              remarks: currentRebate.remarks
            }
            
            if (currentRebate.rebate_type === 'purchase') {
              postData.supplier_id = currentRebate.entity_id
            } else {
              postData.customer_id = currentRebate.entity_id
            }
            
            if (currentRebate.expiry_date) {
              postData.expiry_date = currentRebate.expiry_date.toISOString().split('T')[0]
            }
            
            if (currentRebate.id) {
              // 编辑现有返利（这里简化处理，实际可能不允许编辑）
              response = await request.put(`/api/rebates/${currentRebate.id}`, postData)
            } else {
              // 新增返利
              response = await request.post('/api/rebates', postData)
            }
            
            if (response.data.success) {
              ElMessage.success(currentRebate.id ? '返利更新成功' : '返利创建成功')
              dialogVisible.value = false
              fetchRebates() // 刷新列表
            } else {
              ElMessage.error(response.data.message || (currentRebate.id ? '返利更新失败' : '返利创建失败'))
            }
          } catch (error) {
            console.error(currentRebate.id ? '更新返利错误:' : '创建返利错误:', error)
            ElMessage.error(currentRebate.id ? '返利更新失败' : '返利创建失败')
          } finally {
            submitting.value = false
          }
        }
      })
    }
    
    // 监听返利类型变化
    const onRebateTypeChange = () => {
      updateEntities()
    }
    
    onMounted(() => {
      fetchRebates()
      fetchSuppliers()
      fetchCustomers()
      
      // 初始化实体列表
      updateEntities()
    })
    
    return {
      rebatesList,
      loading,
      currentPage,
      pageSize,
      total,
      searchKeyword,
      searchType,
      searchStatus,
      suppliers,
      customers,
      entities,
      dialogVisible,
      dialogTitle,
      submitting,
      rebateFormRef,
      currentRebate,
      rebateRules,
      fetchRebates,
      fetchSuppliers,
      fetchCustomers,
      updateEntities,
      getTypeText,
      getTypeTagType,
      getRelatedTableText,
      getStatusText,
      getStatusType,
      getStatusEffect,
      handleSizeChange,
      handleCurrentChange,
      addRebate,
      viewDetail,
      confirmRebate,
      redeemRebate,
      confirmRebateAction,
      onRebateTypeChange
    }
  }
}
</script>

<style scoped>
.rebate-container {
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