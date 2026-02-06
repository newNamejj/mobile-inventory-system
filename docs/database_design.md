# 数据库设计文档

## 数据库表结构设计

### 1. users (用户表)
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'staff', -- admin, manager, staff
    status TINYINT DEFAULT 1, -- 1: active, 0: inactive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. brands (手机品牌表)
```sql
CREATE TABLE brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3. models (手机型号表)
```sql
CREATE TABLE models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    model_name VARCHAR(200) NOT NULL,
    specifications TEXT, -- JSON格式存储规格参数
    purchase_price DECIMAL(10,2) NOT NULL,
    retail_price DECIMAL(10,2) NOT NULL,
    wholesale_price DECIMAL(10,2),
    imei_required BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id)
);
```

### 4. suppliers (供应商表)
```sql
CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    credit_limit DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) DEFAULT 0, -- 应付余额
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5. customers (客户表)
```sql
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    credit_limit DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) DEFAULT 0, -- 应收余额
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 6. inventory (库存表)
```sql
CREATE TABLE inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0, -- 可用数量（总数量-已分配未出库）
    min_stock_level INTEGER DEFAULT 0, -- 最低库存警戒线
    location VARCHAR(100), -- 存放位置
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES models(id)
);
```

### 7. purchase_orders (采购单表)
```sql
CREATE TABLE purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, partial, completed, cancelled
    remarks TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 8. purchase_order_items (采购单明细表)
```sql
CREATE TABLE purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    received_quantity INTEGER DEFAULT 0, -- 已收货数量
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
);
```

### 9. sales_orders (销售单表)
```sql
CREATE TABLE sales_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    final_amount DECIMAL(12,2) NOT NULL, -- 扣除折扣后的金额
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, partial, completed, cancelled
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- unpaid, partially_paid, paid
    remarks TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 10. sales_order_items (销售单明细表)
```sql
CREATE TABLE sales_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_order_id INTEGER NOT NULL,
    model_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    delivered_quantity INTEGER DEFAULT 0, -- 已发货数量
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
);
```

### 11. inventory_transactions (库存变动记录表)
```sql
CREATE TABLE inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- in:入库, out:出库, adjust:调整
    quantity INTEGER NOT NULL,
    related_table VARCHAR(50), -- 关联的业务表
    related_id INTEGER, -- 关联的业务ID
    remarks TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES models(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 12. payments_receivables (应收账款表)
```sql
CREATE TABLE payments_receivables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    related_table VARCHAR(50) NOT NULL, -- 关联的业务表，如sales_orders
    related_id INTEGER NOT NULL, -- 关联的业务ID
    amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'unpaid', -- unpaid, partially_paid, paid, overdue
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### 13. payments_payables (应付账款表)
```sql
CREATE TABLE payments_payables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    related_table VARCHAR(50) NOT NULL, -- 关联的业务表，如purchase_orders
    related_id INTEGER NOT NULL, -- 关联的业务ID
    amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'unpaid', -- unpaid, partially_paid, paid, overdue
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);
```

### 14. payment_records (收付款记录表)
```sql
CREATE TABLE payment_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_type VARCHAR(10) NOT NULL, -- receive:收款, pay:付款
    related_table VARCHAR(50) NOT NULL,
    related_id INTEGER NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(20), -- cash, bank_transfer, wechat, alipay, etc.
    payment_date DATE NOT NULL,
    operator_id INTEGER NOT NULL,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operator_id) REFERENCES users(id)
);
```

### 15. profit_records (利润记录表)
```sql
CREATE TABLE profit_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_order_item_id INTEGER NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL, -- 成本价
    sell_price DECIMAL(10,2) NOT NULL, -- 销售价
    quantity INTEGER NOT NULL,
    revenue DECIMAL(12,2) NOT NULL, -- 收入
    cost DECIMAL(12,2) NOT NULL, -- 成本
    profit DECIMAL(12,2) NOT NULL, -- 利润
    profit_margin DECIMAL(5,2), -- 利润率
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id)
);
```

### 16. rebates (返利表)
```sql
CREATE TABLE rebates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rebate_type VARCHAR(20) NOT NULL, -- purchase:采购返利, sales:销售返利
    related_table VARCHAR(50) NOT NULL, -- 关联的业务表
    related_id INTEGER NOT NULL, -- 关联的业务ID
    customer_supplier_id INTEGER, -- 客户或供应商ID
    customer_id INTEGER, -- 如果是销售返利
    supplier_id INTEGER, -- 如果是采购返利
    amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, redeemed, cancelled
    expiry_date DATE, -- 返利有效期
    remarks TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

## 数据库索引设计

为了提高查询性能，需要创建以下索引：

```sql
-- 用户名索引
CREATE INDEX idx_users_username ON users(username);

-- 手机型号名称索引
CREATE INDEX idx_models_model_name ON models(model_name);

-- 供应商名称索引
CREATE INDEX idx_suppliers_name ON suppliers(name);

-- 客户名称索引
CREATE INDEX idx_customers_name ON customers(name);

-- 库存型号索引
CREATE INDEX idx_inventory_model_id ON inventory(model_id);

-- 采购单状态索引
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);

-- 采购单供应商索引
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);

-- 销售单状态索引
CREATE INDEX idx_sales_orders_status ON sales_orders(status);

-- 销售单客户索引
CREATE INDEX idx_sales_orders_customer_id ON sales_orders(customer_id);

-- 应收账款状态索引
CREATE INDEX idx_payments_receivables_status ON payments_receivables(status);

-- 应付账款状态索引
CREATE INDEX idx_payments_payables_status ON payments_payables(status);

-- 收付款日期索引
CREATE INDEX idx_payment_records_payment_date ON payment_records(payment_date);

-- 返利状态索引
CREATE INDEX idx_rebates_status ON rebates(status);
```