<template>
  <div class="reports-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>报表中心</span>
        </div>
      </template>
      
      <!-- 报表分类 -->
      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="销售报表" name="sales">
          <div class="report-content">
            <div class="report-controls">
              <el-date-picker
                v-model="salesDateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                style="width: 240px; margin-right: 10px;"
              ></el-date-picker>
              <el-button type="primary" @click="fetchSalesReport">查询</el-button>
              <el-button @click="exportSalesReport">导出</el-button>
            </div>
            
            <el-table :data="salesReportData" style="width: 100%" v-loading="salesLoading">
              <el-table-column prop="id" label="订单号" width="120"></el-table-column>
              <el-table-column prop="customer_name" label="客户" width="200"></el-table-column>
              <el-table-column prop="total_amount" label="订单金额" width="120">
                <template #default="scope">
                  ¥{{ scope.row.total_amount }}
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="120">
                <template #default="scope">
                  <el-tag 
                    :type="getOrderStatusType(scope.row.status)"
                    :effect="getOrderStatusEffect(scope.row.status)"
                  >
                    {{ getOrderStatusText(scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="created_at" label="创建时间" width="180"></el-table-column>
              <el-table-column prop="delivered_at" label="发货时间" width="180"></el-table-column>
            </el-table>
            
            <el-pagination
              v-model:current-page="salesCurrentPage"
              v-model:page-size="salesPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="salesTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleSalesSizeChange"
              @current-change="handleSalesCurrentChange"
              style="margin-top: 20px; justify-content: center; display: flex"
            />
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="采购报表" name="purchase">
          <div class="report-content">
            <div class="report-controls">
              <el-date-picker
                v-model="purchaseDateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                style="width: 240px; margin-right: 10px;"
              ></el-date-picker>
              <el-button type="primary" @click="fetchPurchaseReport">查询</el-button>
              <el-button @click="exportPurchaseReport">导出</el-button>
            </div>
            
            <el-table :data="purchaseReportData" style="width: 100%" v-loading="purchaseLoading">
              <el-table-column prop="id" label="订单号" width="120"></el-table-column>
              <el-table-column prop="supplier_name" label="供应商" width="200"></el-table-column>
              <el-table-column prop="total_amount" label="订单金额" width="120">
                <template #default="scope">
                  ¥{{ scope.row.total_amount }}
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="120">
                <template #default="scope">
                  <el-tag 
                    :type="getOrderStatusType(scope.row.status)"
                    :effect="getOrderStatusEffect(scope.row.status)"
                  >
                    {{ getOrderStatusText(scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="created_at" label="创建时间" width="180"></el-table-column>
              <el-table-column prop="received_at" label="收货时间" width="180"></el-table-column>
            </el-table>
            
            <el-pagination
              v-model:current-page="purchaseCurrentPage"
              v-model:page-size="purchasePageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="purchaseTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handlePurchaseSizeChange"
              @current-change="handlePurchaseCurrentChange"
              style="margin-top: 20px; justify-content: center; display: flex"
            />
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="库存报表" name="inventory">
          <div class="report-content">
            <div class="report-controls">
              <el-input 
                v-model="inventoryKeyword" 
                placeholder="搜索型号或品牌" 
                style="width: 300px; margin-right: 10px;"
              ></el-input>
              <el-button type="primary" @click="fetchInventoryReport">查询</el-button>
              <el-button @click="exportInventoryReport">导出</el-button>
            </div>
            
            <el-table :data="inventoryReportData" style="width: 100%" v-loading="inventoryLoading">
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
            </el-table>
            
            <el-pagination
              v-model:current-page="inventoryCurrentPage"
              v-model:page-size="inventoryPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="inventoryTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleInventorySizeChange"
              @current-change="handleInventoryCurrentChange"
              style="margin-top: 20px; justify-content: center; display: flex"
            />
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="利润报表" name="profit">
          <div class="report-content">
            <div class="report-controls">
              <el-date-picker
                v-model="profitDateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                style="width: 240px; margin-right: 10px;"
              ></el-date-picker>
              <el-button type="primary" @click="fetchProfitReport">查询</el-button>
              <el-button @click="exportProfitReport">导出</el-button>
            </div>
            
            <!-- 利润统计卡片 -->
            <el-row :gutter="20" style="margin-bottom: 20px;">
              <el-col :span="6">
                <el-card class="stat-card">
                  <div class="stat-title">销售收入</div>
                  <div class="stat-value">¥{{ profitSummary.total_sales || 0 }}</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card class="stat-card">
                  <div class="stat-title">采购成本</div>
                  <div class="stat-value">¥{{ profitSummary.total_purchase || 0 }}</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card class="stat-card">
                  <div class="stat-title">毛利润</div>
                  <div class="stat-value">¥{{ profitSummary.gross_profit || 0 }}</div>
                </el-card>
              </el-col>
              <el-col :span="6">
                <el-card class="stat-card">
                  <div class="stat-title">利润率</div>
                  <div class="stat-value">{{ profitSummary.profit_margin || 0 }}%</div>
                </el-card>
              </el-col>
            </el-row>
            
            <el-table :data="profitReportData" style="width: 100%" v-loading="profitLoading">
              <el-table-column prop="model_name" label="商品型号" width="200"></el-table-column>
              <el-table-column prop="brand_name" label="品牌" width="120"></el-table-column>
              <el-table-column prop="quantity_sold" label="销售数量" width="120"></el-table-column>
              <el-table-column prop="total_sales" label="销售收入" width="120">
                <template #default="scope">
                  ¥{{ scope.row.total_sales }}
                </template>
              </el-table-column>
              <el-table-column prop="total_cost" label="采购成本" width="120">
                <template #default="scope">
                  ¥{{ scope.row.total_cost }}
                </template>
              </el-table-column>
              <el-table-column prop="gross_profit" label="毛利润" width="120">
                <template #default="scope">
                  <span :class="scope.row.gross_profit >= 0 ? 'profit-positive' : 'profit-negative'">
                    ¥{{ scope.row.gross_profit }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="profit_margin" label="利润率" width="120">
                <template #default="scope">
                  <span :class="scope.row.profit_margin >= 0 ? 'margin-positive' : 'margin-negative'">
                    {{ scope.row.profit_margin }}%
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="report_date" label="统计日期" width="180"></el-table-column>
            </el-table>
            
            <el-pagination
              v-model:current-page="profitCurrentPage"
              v-model:page-size="profitPageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="profitTotal"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleProfitSizeChange"
              @current-change="handleProfitCurrentChange"
              style="margin-top: 20px; justify-content: center; display: flex"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

export default {
  name: 'Reports',
  setup() {
    const activeTab = ref('sales')
    
    // 销售报表相关
    const salesDateRange = ref([])
    const salesReportData = ref([])
    const salesLoading = ref(false)
    const salesCurrentPage = ref(1)
    const salesPageSize = ref(10)
    const salesTotal = ref(0)
    
    // 采购报表相关
    const purchaseDateRange = ref([])
    const purchaseReportData = ref([])
    const purchaseLoading = ref(false)
    const purchaseCurrentPage = ref(1)
    const purchasePageSize = ref(10)
    const purchaseTotal = ref(0)
    
    // 库存报表相关
    const inventoryKeyword = ref('')
    const inventoryReportData = ref([])
    const inventoryLoading = ref(false)
    const inventoryCurrentPage = ref(1)
    const inventoryPageSize = ref(10)
    const inventoryTotal = ref(0)
    
    // 利润报表相关
    const profitDateRange = ref([])
    const profitReportData = ref([])
    const profitSummary = ref({})
    const profitLoading = ref(false)
    const profitCurrentPage = ref(1)
    const profitPageSize = ref(10)
    const profitTotal = ref(0)
    
    // 获取销售报表
    const fetchSalesReport = async () => {
      salesLoading.value = true
      try {
        const params = {
          page: salesCurrentPage.value,
          limit: salesPageSize.value
        }
        
        if (salesDateRange.value && salesDateRange.value.length === 2) {
          params.startDate = salesDateRange.value[0].toISOString().split('T')[0]
          params.endDate = salesDateRange.value[1].toISOString().split('T')[0]
        }
        
        const response = await request.get('/api/reports/sales-report', { params })
        
        if (response.data.success) {
          salesReportData.value = response.data.data.list
          salesTotal.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取销售报表失败')
        }
      } catch (error) {
        console.error('获取销售报表错误:', error)
        ElMessage.error('获取销售报表失败')
      } finally {
        salesLoading.value = false
      }
    }
    
    // 获取采购报表
    const fetchPurchaseReport = async () => {
      purchaseLoading.value = true
      try {
        const params = {
          page: purchaseCurrentPage.value,
          limit: purchasePageSize.value
        }
        
        if (purchaseDateRange.value && purchaseDateRange.value.length === 2) {
          params.startDate = purchaseDateRange.value[0].toISOString().split('T')[0]
          params.endDate = purchaseDateRange.value[1].toISOString().split('T')[0]
        }
        
        const response = await request.get('/api/reports/purchase-report', { params })
        
        if (response.data.success) {
          purchaseReportData.value = response.data.data.list
          purchaseTotal.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取采购报表失败')
        }
      } catch (error) {
        console.error('获取采购报表错误:', error)
        ElMessage.error('获取采购报表失败')
      } finally {
        purchaseLoading.value = false
      }
    }
    
    // 获取库存报表
    const fetchInventoryReport = async () => {
      inventoryLoading.value = true
      try {
        const params = {
          page: inventoryCurrentPage.value,
          limit: inventoryPageSize.value,
          keyword: inventoryKeyword.value
        }
        
        const response = await request.get('/api/reports/inventory-report', { params })
        
        if (response.data.success) {
          inventoryReportData.value = response.data.data.list
          inventoryTotal.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取库存报表失败')
        }
      } catch (error) {
        console.error('获取库存报表错误:', error)
        ElMessage.error('获取库存报表失败')
      } finally {
        inventoryLoading.value = false
      }
    }
    
    // 获取利润报表
    const fetchProfitReport = async () => {
      profitLoading.value = true
      try {
        const params = {
          page: profitCurrentPage.value,
          limit: profitPageSize.value
        }
        
        if (profitDateRange.value && profitDateRange.value.length === 2) {
          params.startDate = profitDateRange.value[0].toISOString().split('T')[0]
          params.endDate = profitDateRange.value[1].toISOString().split('T')[0]
        }
        
        const response = await request.get('/api/reports/profit-report', { params })
        
        if (response.data.success) {
          profitReportData.value = response.data.data.list
          profitSummary.value = response.data.data.summary
          profitTotal.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取利润报表失败')
        }
      } catch (error) {
        console.error('获取利润报表错误:', error)
        ElMessage.error('获取利润报表失败')
      } finally {
        profitLoading.value = false
      }
    }
    
    // 获取订单状态文本
    const getOrderStatusText = (status) => {
      const statusMap = {
        pending: '待处理',
        completed: '已完成',
        cancelled: '已取消'
      }
      return statusMap[status] || status
    }
    
    // 获取订单状态标签类型
    const getOrderStatusType = (status) => {
      const typeMap = {
        pending: 'warning',
        completed: 'success',
        cancelled: 'danger'
      }
      return typeMap[status] || 'info'
    }
    
    // 获取订单状态标签效果
    const getOrderStatusEffect = (status) => {
      return 'light'
    }
    
    // 处理销售报表分页
    const handleSalesSizeChange = (size) => {
      salesPageSize.value = size
      fetchSalesReport()
    }
    
    const handleSalesCurrentChange = (page) => {
      salesCurrentPage.value = page
      fetchSalesReport()
    }
    
    // 处理采购报表分页
    const handlePurchaseSizeChange = (size) => {
      purchasePageSize.value = size
      fetchPurchaseReport()
    }
    
    const handlePurchaseCurrentChange = (page) => {
      purchaseCurrentPage.value = page
      fetchPurchaseReport()
    }
    
    // 处理库存报表分页
    const handleInventorySizeChange = (size) => {
      inventoryPageSize.value = size
      fetchInventoryReport()
    }
    
    const handleInventoryCurrentChange = (page) => {
      inventoryCurrentPage.value = page
      fetchInventoryReport()
    }
    
    // 处理利润报表分页
    const handleProfitSizeChange = (size) => {
      profitPageSize.value = size
      fetchProfitReport()
    }
    
    const handleProfitCurrentChange = (page) => {
      profitCurrentPage.value = page
      fetchProfitReport()
    }
    
    // 导出报表
    const exportSalesReport = () => {
      ElMessage.info('功能开发中：导出销售报表')
    }
    
    const exportPurchaseReport = () => {
      ElMessage.info('功能开发中：导出采购报表')
    }
    
    const exportInventoryReport = () => {
      ElMessage.info('功能开发中：导出库存报表')
    }
    
    const exportProfitReport = () => {
      ElMessage.info('功能开发中：导出利润报表')
    }
    
    onMounted(() => {
      // 默认加载销售报表
      fetchSalesReport()
    })
    
    return {
      activeTab,
      // 销售报表
      salesDateRange,
      salesReportData,
      salesLoading,
      salesCurrentPage,
      salesPageSize,
      salesTotal,
      // 采购报表
      purchaseDateRange,
      purchaseReportData,
      purchaseLoading,
      purchaseCurrentPage,
      purchasePageSize,
      purchaseTotal,
      // 库存报表
      inventoryKeyword,
      inventoryReportData,
      inventoryLoading,
      inventoryCurrentPage,
      inventoryPageSize,
      inventoryTotal,
      // 利润报表
      profitDateRange,
      profitReportData,
      profitSummary,
      profitLoading,
      profitCurrentPage,
      profitPageSize,
      profitTotal,
      // 方法
      fetchSalesReport,
      fetchPurchaseReport,
      fetchInventoryReport,
      fetchProfitReport,
      getOrderStatusText,
      getOrderStatusType,
      getOrderStatusEffect,
      handleSalesSizeChange,
      handleSalesCurrentChange,
      handlePurchaseSizeChange,
      handlePurchaseCurrentChange,
      handleInventorySizeChange,
      handleInventoryCurrentChange,
      handleProfitSizeChange,
      handleProfitCurrentChange,
      exportSalesReport,
      exportPurchaseReport,
      exportInventoryReport,
      exportProfitReport
    }
  }
}
</script>

<style scoped>
.reports-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.report-content {
  padding: 20px 0;
}

.report-controls {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
}

.stat-card {
  text-align: center;
}

.stat-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 5px;
}

.profit-positive {
  color: #67c23a;
}

.profit-negative {
  color: #f56c6c;
}

.margin-positive {
  color: #67c23a;
}

.margin-negative {
  color: #f56c6c;
}
</style>