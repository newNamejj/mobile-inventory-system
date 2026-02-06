// 数据库连接配置
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 创建数据库实例
const dbPath = path.join(__dirname, '../database/inventory.db');
const db = new sqlite3.Database(dbPath);

// 初始化数据库表
function initDatabase() {
    const fs = require('fs');
    
    // 确保数据库目录存在
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // 创建数据表
    const schemaSQL = `
        PRAGMA foreign_keys = ON;
        
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(100),
            phone VARCHAR(20),
            role VARCHAR(20) DEFAULT 'staff',
            status TINYINT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS brands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand_id INTEGER NOT NULL,
            model_name VARCHAR(200) NOT NULL,
            specifications TEXT,
            purchase_price DECIMAL(10,2) NOT NULL,
            retail_price DECIMAL(10,2) NOT NULL,
            wholesale_price DECIMAL(10,2),
            imei_required BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (brand_id) REFERENCES brands(id)
        );
        
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(200) NOT NULL,
            contact_person VARCHAR(100),
            phone VARCHAR(20),
            email VARCHAR(100),
            address TEXT,
            credit_limit DECIMAL(12,2) DEFAULT 0,
            balance DECIMAL(12,2) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(200) NOT NULL,
            contact_person VARCHAR(100),
            phone VARCHAR(20),
            email VARCHAR(100),
            address TEXT,
            credit_limit DECIMAL(12,2) DEFAULT 0,
            balance DECIMAL(12,2) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            available_quantity INTEGER NOT NULL DEFAULT 0,
            min_stock_level INTEGER DEFAULT 0,
            location VARCHAR(100),
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (model_id) REFERENCES models(id)
        );
        
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number VARCHAR(50) UNIQUE NOT NULL,
            supplier_id INTEGER NOT NULL,
            total_amount DECIMAL(12,2) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            remarks TEXT,
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );
        
        CREATE TABLE IF NOT EXISTS purchase_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_order_id INTEGER NOT NULL,
            model_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(12,2) NOT NULL,
            received_quantity INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
            FOREIGN KEY (model_id) REFERENCES models(id)
        );
        
        CREATE TABLE IF NOT EXISTS sales_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_number VARCHAR(50) UNIQUE NOT NULL,
            customer_id INTEGER NOT NULL,
            total_amount DECIMAL(12,2) NOT NULL,
            discount DECIMAL(12,2) DEFAULT 0,
            final_amount DECIMAL(12,2) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            payment_status VARCHAR(20) DEFAULT 'unpaid',
            remarks TEXT,
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );
        
        CREATE TABLE IF NOT EXISTS sales_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sales_order_id INTEGER NOT NULL,
            model_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(12,2) NOT NULL,
            delivered_quantity INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
            FOREIGN KEY (model_id) REFERENCES models(id)
        );
        
        CREATE TABLE IF NOT EXISTS inventory_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id INTEGER NOT NULL,
            transaction_type VARCHAR(20) NOT NULL,
            quantity INTEGER NOT NULL,
            related_table VARCHAR(50),
            related_id INTEGER,
            remarks TEXT,
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (model_id) REFERENCES models(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );
        
        CREATE TABLE IF NOT EXISTS payments_receivables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            related_table VARCHAR(50) NOT NULL,
            related_id INTEGER NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            paid_amount DECIMAL(12,2) DEFAULT 0,
            due_date DATE,
            status VARCHAR(20) DEFAULT 'unpaid',
            remarks TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );
        
        CREATE TABLE IF NOT EXISTS payments_payables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER NOT NULL,
            related_table VARCHAR(50) NOT NULL,
            related_id INTEGER NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            paid_amount DECIMAL(12,2) DEFAULT 0,
            due_date DATE,
            status VARCHAR(20) DEFAULT 'unpaid',
            remarks TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );
        
        CREATE TABLE IF NOT EXISTS payment_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payment_type VARCHAR(10) NOT NULL,
            related_table VARCHAR(50) NOT NULL,
            related_id INTEGER NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            payment_method VARCHAR(20),
            payment_date DATE NOT NULL,
            operator_id INTEGER NOT NULL,
            remarks TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (operator_id) REFERENCES users(id)
        );
        
        CREATE TABLE IF NOT EXISTS profit_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sales_order_item_id INTEGER NOT NULL,
            cost_price DECIMAL(10,2) NOT NULL,
            sell_price DECIMAL(10,2) NOT NULL,
            quantity INTEGER NOT NULL,
            revenue DECIMAL(12,2) NOT NULL,
            cost DECIMAL(12,2) NOT NULL,
            profit DECIMAL(12,2) NOT NULL,
            profit_margin DECIMAL(5,2),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id)
        );
        
        CREATE TABLE IF NOT EXISTS rebates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rebate_type VARCHAR(20) NOT NULL,
            related_table VARCHAR(50) NOT NULL,
            related_id INTEGER NOT NULL,
            customer_supplier_id INTEGER,
            customer_id INTEGER,
            supplier_id INTEGER,
            amount DECIMAL(12,2) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            expiry_date DATE,
            remarks TEXT,
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_models_model_name ON models(model_name);
        CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
        CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
        CREATE INDEX IF NOT EXISTS idx_inventory_model_id ON inventory(model_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
        CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
        CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON sales_orders(customer_id);
        CREATE INDEX IF NOT EXISTS idx_payments_receivables_status ON payments_receivables(status);
        CREATE INDEX IF NOT EXISTS idx_payments_payables_status ON payments_payables(status);
        CREATE INDEX IF NOT EXISTS idx_payment_records_payment_date ON payment_records(payment_date);
        CREATE INDEX IF NOT EXISTS idx_rebates_status ON rebates(status);
    `;
    
    db.exec(schemaSQL, (err) => {
        if (err) {
            console.error('数据库初始化错误:', err.message);
        } else {
            console.log('数据库初始化成功');
            
            // 插入默认管理员账户
            const bcrypt = require('bcryptjs');
            const saltRounds = 10;
            const defaultPassword = 'admin123';
            const hashedPassword = bcrypt.hashSync(defaultPassword, saltRounds);
            
            db.run(
                `INSERT OR IGNORE INTO users (username, password_hash, role, email, phone) 
                 VALUES ('admin', ?, 'admin', 'admin@inventory.local', '13800138000')`,
                [hashedPassword],
                function(err) {
                    if (err) {
                        console.error('插入默认管理员账户失败:', err.message);
                    } else {
                        console.log('默认管理员账户创建成功 (用户名: admin, 密码: admin123)');
                    }
                }
            );
        }
    });
}

module.exports = { db, initDatabase };