<template>
  <div class="receivables-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>应收账款</span>
        </div>
      </template>
      
      <!-- 操作按钮 -->
      <div class="operations">
        <el-button type="primary" @click="addReceivable">新增应收款</el-button>
      </div>
      
      <!-- 搜索栏 -->
      <div class="search-bar">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索客户或订单号" 
          style="width: 300px; margin-right: 10px;"
        ></el-input>
        <el-select v-model="searchStatus" placeholder="状态" style="width: 150px; margin-right: 10px;">
          <el-option label="全部" value=""></el-option>
          <el-option label="未结清" value="pending"></el-option>
          <el-option label="已结清" value="cleared"></el-option>
        </el-select>
        <el-button type="primary" @click="fetchReceivables">搜索</el-button>
      </div>
      
      <!-- 应收账款列表 -->
      <el-table :data="receivablesList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80"></el-table-column>
        <el-table-column prop="customer_name" label="客户" width="200"></el-table-column>
        <el-table-column prop="order_id" label="关联订单" width="150"></el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="scope">
            ¥{{ scope.row.amount }}
          </template>
        </el-table-column>
        <el-table-column prop="paid_amount" label="已收金额" width="120">
          <template #default="scope">
            ¥{{ scope.row.paid_amount }}
          </template>
        </el-table-column>
        <el-table-column prop="due_amount" label="待收金额" width="120">
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
              收款
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteReceivable(scope.row)"
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
    
    <!-- 新增收款记录对话框 -->
    <el-dialog title="收款记录" v-model="paymentDialogVisible" width="500px">
      <el-form :model="currentPayment" label-width="100px">
        <el-form-item label="客户">
          <el-input v-model="currentPayment.customer_name" disabled></el-input>
        </el-form-item>
        <el-form-item label="订单号">
          <el-input v-model="currentPayment.order_id" disabled></el-input>
        </el-form-item>
        <el-form-item label="应收金额">
          <el-input v-model.number="currentPayment.total_amount" disabled></el-input>
        </el-form-item>
        <el-form-item label="待收金额">
          <el-input v-model.number="currentPayment.due_amount" disabled></el-input>
        </el-form-item>
        <el-form-item label="本次收款" prop="payment_amount">
          <el-input-number 
            v-model="currentPayment.payment_amount" 
            :min="0.01" 
            :max="currentPayment.due_amount"
            :precision="2"
            style="width: 100%"
          ></el-input-number>
        </el-form-item>
        <el-form-item label="收款日期">
          <el-date-picker
            v-model="currentPayment.payment_date"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
          ></el-date-picker>
        </el-form-item>
        <el-form-item label="收款方式">
          <el-select v-model="currentPayment.payment_method" placeholder="请选择收款方式" style="width: 100%">
            <el-option label="现金" value="cash"></el-option>
            <el-option label="银行转账" value="bank_transfer"></el-option>
            <el-option label="支付宝" value="alipay"></el-option>
            <el-option label="微信支付" value="wechat_pay"></el-option>
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
  name: 'Receivables',
  setup() {
    const receivablesList = ref([])
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
      customer_name: '',
      order_id: '',
      total_amount: 0,
      due_amount: 0,
      payment_amount: 0,
      payment_date: new Date(),
      payment_method: 'cash',
      remarks: ''
    })
    
    // 获取应收账款列表
    const fetchReceivables = async () => {
      loading.value = true
      try {
        const response = await request.get('/api/finance/receivables', {
          params: {
            page: currentPage.value,
            limit: pageSize.value,
            keyword: searchKeyword.value,
            status: searchStatus.value
          }
        })
        
        if (response.data.success) {
          receivablesList.value = response.data.data.list
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取应收账款列表失败')
        }
      } catch (error) {
        console.error('获取应收账款列表错误:', error)
        ElMessage.error('获取应收账款列表失败')
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
      fetchReceivables()
    }
    
    // 处理当前页变化
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchReceivables()
    }
    
    // 新增应收款
    const addReceivable = () => {
      ElMessage.info('功能开发中：新增应收款')
    }
    
    // 查看详情
    const viewDetail = (row) => {
      console.log('查看应收款详情:', row)
      ElMessage.info('功能开发中：查看应收款详情')
    }
    
    // 记录收款
    const recordPayment = (row) => {
      // 设置当前收款信息
      currentPayment.id = row.id
      currentPayment.customer_name = row.customer_name
      currentPayment.order_id = row.order_id
      currentPayment.total_amount = row.amount
      currentPayment.due_amount = row.due_amount
      currentPayment.payment_amount = Math.min(row.due_amount, row.amount) // 默认全部收回
      currentPayment.payment_date = new Date()
      currentPayment.payment_method = 'cash'
      currentPayment.remarks = ''
      
      paymentDialogVisible.value = true
    }
    
    // 确认收款
    const confirmPayment = async () => {
      if (currentPayment.payment_amount <= 0) {
        ElMessage.warning('收款金额必须大于0')
        return
      }
      
      if (currentPayment.payment_amount > currentPayment.due_amount) {
        ElMessage.warning('收款金额不能超过待收金额')
        return
      }
      
      paymentSubmitting.value = true
      try {
        const response = await request.post('/api/finance/receive-payment', {
          receivable_id: currentPayment.id,
          amount: currentPayment.payment_amount,
          payment_method: currentPayment.payment_method,
          payment_date: currentPayment.payment_date.toISOString().split('T')[0],
          remarks: currentPayment.remarks
        })
        
        if (response.data.success) {
          ElMessage.success('收款记录成功')
          paymentDialogVisible.value = false
          fetchReceivables() // 刷新列表
        } else {
          ElMessage.error(response.data.message || '收款记录失败')
        }
      } catch (error) {
        console.error('收款记录错误:', error)
        ElMessage.error('收款记录失败')
      } finally {
        paymentSubmitting.value = false
      }
    }
    
    // 删除应收款
    const deleteReceivable = (row) => {
      ElMessageBox.confirm(`确定要删除应收账款 "${row.id}" 吗？删除后将无法恢复。`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        try {
          const response = await request.delete(`/api/finance/receivables/${row.id}`)
          
          if (response.data.success) {
            ElMessage.success('应收账款删除成功')
            fetchReceivables() // 刷新列表
          } else {
            ElMessage.error(response.data.message || '应收账款删除失败')
          }
        } catch (error) {
          console.error('删除应收账款错误:', error)
          ElMessage.error('应收账款删除失败')
        }
      }).catch(() => {
        // 用户取消删除
      })
    }
    
    onMounted(() => {
      fetchReceivables()
    })
    
    return {
      receivablesList,
      loading,
      currentPage,
      pageSize,
      total,
      searchKeyword,
      searchStatus,
      paymentDialogVisible,
      paymentSubmitting,
      currentPayment,
      fetchReceivables,
      getStatusText,
      getStatusType,
      getStatusEffect,
      handleSizeChange,
      handleCurrentChange,
      addReceivable,
      viewDetail,
      recordPayment,
      confirmPayment,
      deleteReceivable
    }
  }
}
</script>

<style scoped>
.receivables-container {
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