<template>
  <div class="dashboard-container">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="dashboard-card">
          <template #header>
            <div class="card-header">
              <span>总库存价值</span>
            </div>
          </template>
          <div class="card-content">
            <div class="value">¥{{ totalInventoryValue }}</div>
            <div class="desc">当前所有商品总价值</div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="dashboard-card">
          <template #header>
            <div class="card-header">
              <span>今日销售额</span>
            </div>
          </template>
          <div class="card-content">
            <div class="value">¥{{ todaySales }}</div>
            <div class="desc">今日销售总额</div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="dashboard-card">
          <template #header>
            <div class="card-header">
              <span>待处理订单</span>
            </div>
          </template>
          <div class="card-content">
            <div class="value">{{ pendingOrders }}</div>
            <div class="desc">待处理的采购/销售订单</div>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="6">
        <el-card class="dashboard-card">
          <template #header>
            <div class="card-header">
              <span>低库存商品</span>
            </div>
          </template>
          <div class="card-content">
            <div class="value">{{ lowStockItems }}</div>
            <div class="desc">低于安全库存的商品</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card class="dashboard-card">
          <template #header>
            <div class="card-header">
              <span>近期出入库记录</span>
            </div>
          </template>
          <el-table :data="recentTransactions" style="width: 100%">
            <el-table-column prop="model_name" label="商品型号" width="180"></el-table-column>
            <el-table-column prop="transaction_type" label="类型" width="80">
              <template #default="scope">
                <el-tag :type="scope.row.transaction_type === 'in' ? 'success' : 'danger'">
                  {{ scope.row.transaction_type === 'in' ? '入库' : '出库' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="80"></el-table-column>
            <el-table-column prop="created_at" label="时间" width="150"></el-table-column>
          </el-table>
        </el-card>
      </el-col>
      
      <el-col :span="12">
        <el-card class="dashboard-card">
          <template #header>
            <div class="card-header">
              <span>销售趋势</span>
            </div>
          </template>
          <div class="chart-container">
            <!-- 这里可以集成图表库，如 ECharts -->
            <div class="placeholder-chart">销售趋势图表将在这里显示</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import request from '@/utils/request'

export default {
  name: 'Dashboard',
  setup() {
    const userStore = useUserStore()
    
    // 实际从API获取数据
    const totalInventoryValue = ref('0.00')
    const todaySales = ref('0.00')
    const pendingOrders = ref(0)
    const lowStockItems = ref(0)
    const recentTransactions = ref([])

    const loadDashboardData = async () => {
      try {
        const response = await request.get('/api/dashboard/stats')
        
        if (response.data.success) {
          const data = response.data.data
          
          // 格式化数值
          totalInventoryValue.value = data.totalInventoryValue.toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
          
          todaySales.value = data.todaySales.toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
          
          pendingOrders.value = data.pendingOrders
          lowStockItems.value = data.lowStockItems
          recentTransactions.value = data.recentTransactions || []
        } else {
          console.error('获取仪表板数据失败:', response.data.message)
          // 设置默认值
          totalInventoryValue.value = '0.00'
          todaySales.value = '0.00'
          pendingOrders.value = 0
          lowStockItems.value = 0
          recentTransactions.value = []
        }
      } catch (error) {
        console.error('获取仪表板数据错误:', error)
        // 设置默认值
        totalInventoryValue.value = '0.00'
        todaySales.value = '0.00'
        pendingOrders.value = 0
        lowStockItems.value = 0
        recentTransactions.value = []
      }
    }

    onMounted(() => {
      // 确保用户信息是最新的
      if (userStore.token && Object.keys(userStore.currentUser).length === 0) {
        userStore.fetchCurrentUser()
      }
      
      // 加载仪表盘数据
      loadDashboardData()
      console.log('仪表盘已加载')
    })

    return {
      totalInventoryValue,
      todaySales,
      pendingOrders,
      lowStockItems,
      recentTransactions
    }
  }
}
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
}

.dashboard-card {
  height: 120px;
}

.card-header {
  font-weight: bold;
}

.card-content {
  text-align: center;
}

.value {
  font-size: 24px;
  font-weight: bold;
  color: #409EFF;
  margin-bottom: 5px;
}

.desc {
  font-size: 12px;
  color: #909399;
}

.chart-container {
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-chart {
  color: #C0C4CC;
  font-style: italic;
}
</style>