<template>
  <div class="payables-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>应付账款</span>
        </div>
      </template>
      
      <!-- 操作按钮 -->
      <div class="operations">
        <el-button type="primary" @click="addPayable">新增应付款</el-button>
      </div>
      
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索供应商或订单号" 
          style="width: 300px; margin-right: 10px;"
        ></el-input>
        <el-select v-model="searchStatus" placeholder="状态" style="width: 150px; margin-right: 10px;">
          <el-option label="全部" value=""></el-option>
          <el-option label="未结清" value="pending"></el-option>
          <el-option label="已结清" value="cleared"></el-option>
        </el-select>
        <el-button type="primary" @click="fetchPayables">搜索</el-button>
      </div>
      
      <!-- 应付账款列表 -->
      <el-table :data="payablesList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80"></el-table-column>
        <el-table-column prop="supplier_name" label="供应商" width="200"></el-table-column>
        <el-table-column prop="order_id" label="关联订单" width="150"></el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="scope">
            ¥{{ scope.row.amount }}
          </template>
        </el-table-column>
        <el-table-column prop="paid_amount" label="已付金额" width="120">
          <template #default="scope">
            ¥{{ scope.row.paid_amount }}
          </template>
        </el-table-column>
        <el-table-column prop="due_amount" label="待付金额" width="120">
          <template #default="scope">
            <span :class="scope.row.due_amount > 0 ? 'due-amount' : 'cleared-amount'">
              ¥{{ scope.row.due_amount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="due_date" label="到期日期" width="150"></el-table-column>
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
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button size="small" @click="viewDetail(scope.row)">详情</el-button>
            <el-button 
              size="small" 
              type="primary" 
              @click="recordPayment(scope.row)"
              :disabled="scope.row.due_amount <= 0"
            >
              付款
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deletePayable(scope.row)"
              :disabled="scope.row.status === 'cleared'"
            >
              删除
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
    
    <!-- 新增付款记录对话框 -->
    <el-dialog title="付款记录" v-model="paymentDialogVisible" width="500px">
      <el-form :model="currentPayment" label-width="100px">
        <el-form-item label="供应商">
          <el-input v-model="currentPayment.supplier_name" disabled></el-input>
        </el-form-item>
        <el-form-item label="订单号">
          <el-input v-model="currentPayment.order_id" disabled></el-input>
        </el-form-item>
        <el-form-item label="应付金额">
          <el-input v-model.number="currentPayment.total_amount" disabled></el-input>
        </el-form-item>
        <el-form-item label="待付金额">
          <el-input v-model.number="currentPayment.due_amount" disabled></el-input>
        </el-form-item>
        <el-form-item label="本次付款" prop="payment_amount">
          <el-input-number 
            v-model="currentPayment.payment_amount" 
            :min="0.01" 
            :max="currentPayment.due_amount"
            :precision="2"
            style="width: 100%"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="付款日期">
          <el-date-picker
            v-model="currentPayment.payment_date"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
          ></el-date-picker>
        </el-form-item>
        <el-form-item label="付款方式">
          <el-select v-model="currentPayment.payment_method" placeholder="请选择付款方式" style="width: 100%">
            <el-option label="现金" value="cash"></el-option>
            <el-option label="银行转账" value="bank_transfer"></el-option>
            <el-option label="支票" value="check"></el-option>
            <el-option label="其他" value="other"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input 
            v-model="currentPayment.remarks" 
            type="textarea" 
            :rows="3"
            placeholder="请输入备注信息"
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="paymentDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmPayment" :loading="paymentSubmitting">确定</el-button>
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
  name: 'Payables',
  setup() {
    const payablesList = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    const searchKeyword = ref('')
    const searchStatus = ref('')
    
    const paymentDialogVisible = ref(false)
    const paymentSubmitting = ref(false)
    
    const currentPayment = reactive({
      id: null,
      supplier_name: '',
      order_id: '',
      total_amount: 0,
      due_amount: 0,
      payment_amount: 0,
      payment_date: new Date(),
      payment_method: 'cash',
      remarks: ''
    })
    
    // 获取应付账款列表
    const fetchPayables = async () => {
      loading.value = true
      try {
        const response = await request.get('/api/finance/payables', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value,
            status: searchStatus.value
          }
        })
        
        if (response.data.success) {
          payablesList.value = response.data.data.list
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取应付账款列表失败')
        }
      } catch (error) {
        console.error('获取应付账款列表错误:', error)
        ElMessage.error('获取应付账款列表失败')
      } finally {
        loading.value = false
      }
    }
    
    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        pending: '未结清',
        cleared: '已结清'
      }
      return statusMap[status] || status
    }
    
    // 获取状态标签类型
    const getStatusType = (status) => {
      const typeMap = {
        pending: 'warning',
        cleared: 'success'
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
      fetchPayables()
    }
    
    // 处理当前页变化
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchPayables()
    }
    
    // 新增应付款
    const addPayable = () => {
      ElMessage.info('功能开发中：新增应付款')
    }
    
    // 查看详情
    const viewDetail = (row) => {
      console.log('查看应付款详情:', row)
      ElMessage.info('功能开发中：查看应付款详情')
    }
    
    // 记录付款
    const recordPayment = (row) => {
      // 设置当前付款信息
      currentPayment.id = row.id
      currentPayment.supplier_name = row.supplier_name
      currentPayment.order_id = row.order_id
      currentPayment.total_amount = row.amount
      currentPayment.due_amount = row.due_amount
      currentPayment.payment_amount = Math.min(row.due_amount, row.amount) // 默认全部付清
      currentPayment.payment_date = new Date()
      currentPayment.payment_method = 'cash'
      currentPayment.remarks = ''
      
      paymentDialogVisible.value = true
    }
    
    // 确认付款
    const confirmPayment = async () => {
      if (currentPayment.payment_amount <= 0) {
        ElMessage.warning('付款金额必须大于0')
        return
      }
      
      if (currentPayment.payment_amount > currentPayment.due_amount) {
        ElMessage.warning('付款金额不能超过待付金额')
        return
      }
      
      paymentSubmitting.value = true
      try {
        const response = await request.post('/api/finance/make-payment', {
          payable_id: currentPayment.id,
          amount: currentPayment.payment_amount,
          payment_method: currentPayment.payment_method,
          payment_date: currentPayment.payment_date.toISOString().split('T')[0],
          remarks: currentPayment.remarks
        })
        
        if (response.data.success) {
          ElMessage.success('付款记录成功')
          paymentDialogVisible.value = false
          fetchPayables() // 刷新列表
        } else {
          ElMessage.error(response.data.message || '付款记录失败')
        }
      } catch (error) {
        console.error('付款记录错误:', error)
        ElMessage.error('付款记录失败')
      } finally {
        paymentSubmitting.value = false
      }
    }
    
    // 删除应付款
    const deletePayable = (row) => {
      ElMessageBox.confirm(`确定要删除应付账款 "${row.id}" 吗？删除后将无法恢复。`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.delete(`/api/finance/payables/${row.id}`)
          
          if (response.data.success) {
            ElMessage.success('应付账款删除成功')
            fetchPayables() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '应付账款删除失败')
          }
        } catch (error) {
          console.error('删除应付账款错误:', error)
          ElMessage.error('应付账款删除失败')
        }
      }).catch(() => {
        // 用户取消删除
      })
    }
    
    onMounted(() => {
      fetchPayables()
    })
    
    return {
      payablesList,
      loading,
      currentPage,
      pageSize,
      total,
      searchKeyword,
      searchStatus,
      paymentDialogVisible,
      paymentSubmitting,
      currentPayment,
      fetchPayables,
      getStatusText,
      getStatusType,
      getStatusEffect,
      handleSizeChange,
      handleCurrentChange,
      addPayable,
      viewDetail,
      recordPayment,
      confirmPayment,
      deletePayable
    }
  }
}
</script>

<style scoped>
.payables-container {
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

.due-amount {
  color: #f56c6c;
  font-weight: bold;
}

.cleared-amount {
  color: #67c23a;
  font-weight: bold;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>