<template>
  <div class="profit-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>利润查询</span>
        </div>
      </template>
      
      <!-- 搜索条件 -->
      <div class="search-bar">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px; margin-right: 10px;"
        ></el-date-picker>
        <el-button type="primary" @click="fetchProfitData">查询</el-button>
        <el-button @click="exportData">导出</el-button>
      </div>
      
      <!-- 利润统计卡片 -->
      <el-row :gutter="20" style="margin-bottom: 20px;">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-title">销售收入</div>
            <div class="stat-value">¥{{ profitData.total_sales || 0 }}</div>
            <div class="stat-desc">总销售额</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-title">采购成本</div>
            <div class="stat-value">¥{{ profitData.total_purchase || 0 }}</div>
            <div class="stat-desc">总采购额</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-title">毛利润</div>
            <div class="stat-value">¥{{ profitData.gross_profit || 0 }}</div>
            <div class="stat-desc">总毛利润</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-title">利润率</div>
            <div class="stat-value">{{ profitData.profit_margin || 0 }}%</div>
            <div class="stat-desc">毛利率</div>
          </el-card>
        </el-col>
      </el-row>
      
      <!-- 利润详情列表 -->
      <el-table :data="profitList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80"></el-table-column>
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
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

export default {
  name: 'Profit',
  setup() {
    const loading = ref(false)
    const dateRange = ref([])
    const profitData = ref({})
    const profitList = ref([])
    const currentPage = ref(1)
    const pageSize = ref(10)
    const total = ref(0)
    
    // 获取利润数据
    const fetchProfitData = async () => {
      loading.value = true
      try {
        const params = {
          page: currentPage.value,
          limit: pageSize.value
        }
        
        if (dateRange.value && dateRange.value.length === 2) {
          params.startDate = dateRange.value[0].toISOString().split('T')[0]
          params.endDate = dateRange.value[1].toISOString().split('T')[0]
        }
        
        const response = await request.get('/api/finance/profit', { params })
        
        if (response.data.success) {
          profitData.value = response.data.data.summary
          profitList.value = response.data.data.list
          total.value = response.data.data.pagination.total
        } else {
          ElMessage.error(response.data.message || '获取利润数据失败')
        }
      } catch (error) {
        console.error('获取利润数据错误:', error)
        ElMessage.error('获取利润数据失败')
      } finally {
        loading.value = false
      }
    }
    
    // 处理分页大小变化
    const handleSizeChange = (size) => {
      pageSize.value = size
      fetchProfitData()
    }
    
    // 处理当前页变化
    const handleCurrentChange = (page) => {
      currentPage.value = page
      fetchProfitData()
    }
    
    // 导出数据
    const exportData = () => {
      ElMessage.info('功能开发中：导出利润数据')
    }
    
    onMounted(() => {
      fetchProfitData()
    })
    
    return {
      loading,
      dateRange,
      profitData,
      profitList,
      currentPage,
      pageSize,
      total,
      fetchProfitData,
      handleSizeChange,
      handleCurrentChange,
      exportData
    }
  }
}
</script>

<style scoped>
.profit-container {
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

.stat-desc {
  font-size: 12px;
  color: #909399;
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