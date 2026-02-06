# 手机进销存管理系统

## 项目概述
这是一个基于 Web 的手机进销存管理系统，旨在帮助手机零售商或批发商管理其日常业务流程，包括库存管理、采购管理、销售管理、财务管理等。

## 技术栈
- **前端**: Vue 3 + Element Plus + Vite
- **后端**: Node.js + Express + SQLite
- **数据库**: SQLite
- **状态管理**: Pinia
- **UI组件库**: Element Plus

## 功能模块

### 1. 用户管理
- 用户登录/登出
- 权限管理（管理员、经理、员工）
- 用户信息维护

### 2. 商品管理
- 手机品牌管理
- 手机型号管理
- 规格参数管理

### 3. 供应链管理
- 供应商管理
- 客户管理

### 4. 库存管理
- 商品入库管理
- 商品出库管理
- 库存查询统计
- 库存预警
- 库存盘点/调整

### 5. 采购管理
- 采购订单管理
- 采购入库管理
- 采购退货管理

### 6. 销售管理
- 销售订单管理
- 销售出库管理
- 销售退货管理

### 7. 财务管理
- 应收账款管理
- 应付账款管理
- 账款核销功能
- 收付款记录

### 8. 统计分析
- 利润查询统计
- 销售报表
- 采购报表
- 库存报表
- 利润报表

### 9. 返利管理
- 采购返利
- 销售返利
- 返利核销

## 项目结构

```
mobile_inventory_system/
├── backend/                 # 后端代码
│   ├── controllers/         # 控制器
│   ├── models/              # 数据模型
│   ├── routes/              # 路由定义
│   ├── middleware/          # 中间件
│   ├── config/              # 配置文件
│   ├── database/            # 数据库相关
│   ├── app.js               # 主应用文件
│   └── server.js            # 服务器启动文件
├── frontend/                # 前端代码
│   ├── public/
│   ├── src/
│   │   ├── components/      # Vue组件
│   │   ├── views/           # 页面视图
│   │   ├── router/          # 路由配置
│   │   ├── stores/          # 状态管理
│   │   └── utils/           # 工具函数
│   ├── package.json
│   └── vite.config.js
├── database/                # 数据库文件
├── static/                  # 静态资源
└── docs/                    # 文档
```

## 快速开始

### 后端启动
```bash
cd mobile_inventory_system
npm install
cd backend
node server.js
```

后端服务将在 `http://localhost:8081` 上运行。

### 前端启动
```bash
cd mobile_inventory_system/frontend
npm install
npx vite --host 0.0.0.0 --port 8080
```

前端开发服务器将在 `http://localhost:8080` 上运行。

## 默认账户
- **用户名**: admin
- **密码**: admin123

## API 接口

### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `GET /api/auth/me` - 获取当前用户信息
- `PUT /api/auth/change-password` - 修改密码

### 用户管理
- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取单个用户
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

### 商品管理
- `GET /api/brands` - 获取品牌列表
- `POST /api/brands` - 创建品牌
- `PUT /api/brands/:id` - 更新品牌
- `DELETE /api/brands/:id` - 删除品牌
- `GET /api/models` - 获取型号列表
- `POST /api/models` - 创建型号
- `PUT /api/models/:id` - 更新型号
- `DELETE /api/models/:id` - 删除型号

### 供应链管理
- `GET /api/suppliers` - 获取供应商列表
- `POST /api/suppliers` - 创建供应商
- `PUT /api/suppliers/:id` - 更新供应商
- `DELETE /api/suppliers/:id` - 删除供应商
- `GET /api/customers` - 获取客户列表
- `POST /api/customers` - 创建客户
- `PUT /api/customers/:id` - 更新客户
- `DELETE /api/customers/:id` - 删除客户

### 库存管理
- `GET /api/inventory` - 获取库存列表
- `POST /api/inventory/in` - 入库操作
- `POST /api/inventory/out` - 出库操作
- `PUT /api/inventory/adjust/:id` - 库存调整
- `GET /api/inventory/transactions/:modelId` - 获取库存变动记录

### 采购管理
- `GET /api/purchases/orders` - 获取采购订单列表
- `POST /api/purchases/orders` - 创建采购订单
- `PUT /api/purchases/orders/:id/status` - 更新采购订单状态
- `PUT /api/purchases/orders/:id/receive` - 采购收货

### 销售管理
- `GET /api/sales/orders` - 获取销售订单列表
- `POST /api/sales/orders` - 创建销售订单
- `PUT /api/sales/orders/:id/status` - 更新销售订单状态
- `PUT /api/sales/orders/:id/deliver` - 销售发货

### 财务管理
- `GET /api/finance/receivables` - 获取应收账款列表
- `GET /api/finance/payables` - 获取应付账款列表
- `POST /api/finance/receive-payment` - 收款操作
- `POST /api/finance/make-payment` - 付款操作
- `GET /api/finance/profit` - 获取利润记录

## 数据库设计

系统使用 SQLite 数据库，包含以下主要表：

- `users` - 用户表
- `brands` - 品牌表
- `models` - 型号表
- `suppliers` - 供应商表
- `customers` - 客户表
- `inventory` - 库存表
- `purchase_orders` - 采购订单表
- `purchase_order_items` - 采购订单明细表
- `sales_orders` - 销售订单表
- `sales_order_items` - 销售订单明细表
- `inventory_transactions` - 库存变动记录表
- `payments_receivables` - 应收账款表
- `payments_payables` - 应付账款表
- `payment_records` - 收付款记录表
- `profit_records` - 利润记录表
- `rebates` - 返利表

## 特色功能

1. **完整的进销存流程** - 从采购到销售的全流程管理
2. **财务一体化** - 应收应付管理，自动计算利润
3. **库存预警** - 最低库存警戒线提醒
4. **权限控制** - 不同角色有不同的操作权限
5. **数据统计** - 多维度的报表统计分析
6. **操作审计** - 所有库存变动都有记录

## 部署说明

### 生产环境部署
1. 安装 Node.js 环境
2. 克隆项目代码
3. 安装依赖：`npm install`
4. 构建前端：`cd frontend && npm run build`
5. 启动服务：`node backend/server.js`

### 反向代理配置（Nginx 示例）
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 部署到云平台

#### 部署到 Vercel (前端) + 其他平台 (后端)

1. **后端部署**：将后端部署到支持 Node.js 的平台（如 Heroku、Railway、Render 等）
2. **前端部署**：将前端部署到 Vercel
3. **配置 API 代理**：确保前端能够正确调用后端 API

有关详细部署指南，请参阅 [deployment_guide.md](./deployment_guide.md)

#### Docker 部署
项目包含 Dockerfile，可以使用以下命令构建和运行：

```bash
# 构建镜像
docker build -t mobile-inventory-system .

# 运行容器
docker run -p 8080:8080 -p 8081:8081 mobile-inventory-system
```

## 开发说明

### 后端开发
- 使用 Express 框架构建 RESTful API
- 使用 SQLite 作为数据库
- 实现 JWT 认证和权限控制
- 使用事务确保数据一致性

### 前端开发
- 使用 Vue 3 Composition API
- 使用 Element Plus 组件库
- 使用 Pinia 进行状态管理
- 使用 Vue Router 进行路由管理

## 安全措施

1. **身份认证** - 使用 JWT Token 进行身份验证
2. **权限控制** - 不同角色有不同的操作权限
3. **输入验证** - 所有输入数据都经过验证
4. **SQL注入防护** - 使用参数化查询防止SQL注入
5. **敏感信息保护** - 密码使用 bcrypt 加密存储

## 扩展性

系统设计具有良好的扩展性：
- 模块化设计，易于添加新功能
- API 接口标准化，易于第三方集成
- 数据库设计灵活，易于扩展字段
- 支持多门店管理（可通过用户权限实现）

## 维护说明

- 定期备份数据库
- 监控系统运行状态
- 定期更新依赖包
- 日志定期清理
- 定期核对库存数据

## 技术支持

如需技术支持或遇到问题，请联系开发团队。