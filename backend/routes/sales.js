const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 获取销售订单列表
router.get('/orders', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, keyword = '', status = '', startDate = '', endDate = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT so.*, c.name as customer_name, u.username as creator_name
        FROM sales_orders so
        LEFT JOIN customers c ON so.customer_id = c.id
        LEFT JOIN users u ON so.created_by = u.id
        WHERE 1=1
    `;
    const params = [];
    
    if (keyword) {
        query += ' AND (so.order_number LIKE ? OR c.name LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam);
    }
    
    if (status) {
        query += ' AND so.status = ?';
        params.push(status);
    }
    
    if (startDate) {
        query += ' AND so.created_at >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND so.created_at <= ?';
        params.push(endDate);
    }
    
    query += ' ORDER BY so.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, orders) => {
        if (err) {
            console.error('查询销售订单列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM sales_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            WHERE 1=1
        `;
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (so.order_number LIKE ? OR c.name LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam);
        }
        
        if (status) {
            countQuery += ' AND so.status = ?';
            countParams.push(status);
        }
        
        if (startDate) {
            countQuery += ' AND so.created_at >= ?';
            countParams.push(startDate);
        }
        
        if (endDate) {
            countQuery += ' AND so.created_at <= ?';
            countParams.push(endDate);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询销售订单总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: orders,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: countResult.total,
                        totalPages: Math.ceil(countResult.total / limit)
                    }
                }
            });
        });
    });
});

// 获取单个销售订单
router.get('/orders/:id', authenticateToken, (req, res) => {
    const orderId = req.params.id;
    
    const query = `
        SELECT so.*, c.name as customer_name, c.balance as customer_balance, u.username as creator_name
        FROM sales_orders so
        LEFT JOIN customers c ON so.customer_id = c.id
        LEFT JOIN users u ON so.created_by = u.id
        WHERE so.id = ?
    `;
    
    db.get(query, [orderId], (err, order) => {
        if (err) {
            console.error('查询销售订单错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: '销售订单不存在' 
            });
        }
        
        // 获取订单明细
        const itemsQuery = `
            SELECT soi.*, m.model_name, b.name as brand_name
            FROM sales_order_items soi
            LEFT JOIN models m ON soi.model_id = m.id
            LEFT JOIN brands b ON m.brand_id = b.id
            WHERE soi.sales_order_id = ?
        `;
        
        db.all(itemsQuery, [orderId], (err, items) => {
            if (err) {
                console.error('查询销售订单明细错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            order.items = items;
            
            res.json({
                success: true,
                data: order
            });
        });
    });
});

// 创建销售订单
router.post('/orders', authenticateToken, checkPermission(['admin', 'manager', 'staff']), (req, res) => {
    const { customer_id, items, discount = 0, remarks = '' } = req.body;
    
    if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: '客户ID和订单明细是必需的' 
        });
    }
    
    // 开始事务
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 检查客户是否存在
        const checkCustomerQuery = 'SELECT id, balance, credit_limit FROM customers WHERE id = ?';
        
        db.get(checkCustomerQuery, [customer_id], (err, customer) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('检查客户错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (!customer) {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: '指定的客户不存在' 
                });
            }
            
            // 验证库存是否足够
            let validationSuccess = true;
            for (const item of items) {
                if (!item.model_id || !item.quantity || !item.unit_price) {
                    db.run('ROLLBACK');
                    return res.status(400).json({ 
                        success: false, 
                        message: '订单明细中缺少必要信息' 
                    });
                }
                
                // 检查库存
                const checkStockQuery = 'SELECT available_quantity FROM inventory WHERE model_id = ?';
                
                db.get(checkStockQuery, [item.model_id], (err, stock) => {
                    if (err) {
                        db.run('ROLLBACK');
                        validationSuccess = false;
                        console.error('检查库存错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
                    }
                    
                    if (!stock || stock.available_quantity < item.quantity) {
                        db.run('ROLLBACK');
                        validationSuccess = false;
                        return res.status(400).json({ 
                            success: false, 
                            message: `商品 ${item.model_id} 库存不足，当前可用数量: ${stock ? stock.available_quantity : 0}，请求数量: ${item.quantity}` 
                        });
                    }
                });
            }
            
            if (!validationSuccess) {
                return; // 如果验证失败则直接返回
            }
            
            // 计算总金额
            let totalAmount = 0;
            for (const item of items) {
                totalAmount += parseFloat(item.quantity) * parseFloat(item.unit_price);
            }
            
            const finalAmount = totalAmount - parseFloat(discount);
            
            // 生成订单号 (格式: SO + 年月日 + 4位序号)
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const orderNumberPrefix = `SO${dateStr}`;
            
            // 获取当天最大的序号
            const getMaxSeqQuery = `
                SELECT MAX(CAST(SUBSTR(order_number, 11) AS INTEGER)) as max_seq 
                FROM sales_orders 
                WHERE order_number LIKE ?
            `;
            
            db.get(getMaxSeqQuery, [`${orderNumberPrefix}%`], (err, result) => {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('获取订单号序号错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                const seq = (result.max_seq || 0) + 1;
                const orderNumber = `${orderNumberPrefix}${seq.toString().padStart(4, '0')}`;
                
                // 插入销售订单
                const insertOrderQuery = `
                    INSERT INTO sales_orders (order_number, customer_id, total_amount, discount, final_amount, remarks, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                
                db.run(insertOrderQuery, [orderNumber, customer_id, totalAmount, discount, finalAmount, remarks, req.user.userId], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('插入销售订单错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
                    }
                    
                    const orderId = this.lastID;
                    
                    // 插入订单明细并更新库存预留
                    let itemsProcessed = 0;
                    for (const item of items) {
                        const insertItemQuery = `
                            INSERT INTO sales_order_items (sales_order_id, model_id, quantity, unit_price, total_price)
                            VALUES (?, ?, ?, ?, ?)
                        `;
                        
                        const totalPrice = parseFloat(item.quantity) * parseFloat(item.unit_price);
                        
                        db.run(insertItemQuery, [orderId, item.model_id, item.quantity, item.unit_price, totalPrice], function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                console.error('插入销售订单明细错误:', err);
                                return res.status(500).json({ 
                                    success: false, 
                                    message: '服务器错误' 
                                });
                            }
                            
                            // 预留库存（减少可用数量，但不减少总数量）
                            const reserveStockQuery = `
                                UPDATE inventory 
                                SET available_quantity = available_quantity - ? 
                                WHERE model_id = ?
                            `;
                            
                            db.run(reserveStockQuery, [item.quantity, item.model_id], function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    console.error('预留库存错误:', err);
                                    return res.status(500).json({ 
                                        success: false, 
                                        message: '服务器错误' 
                                    });
                                }
                                
                                itemsProcessed++;
                                
                                // 如果所有明细都处理完，则提交事务
                                if (itemsProcessed === items.length) {
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('提交事务错误:', err);
                                            return res.status(500).json({ 
                                                success: false, 
                                                message: '服务器错误' 
                                            });
                                        }
                                        
                                        res.json({
                                            success: true,
                                            message: '销售订单创建成功',
                                            data: { id: orderId, order_number: orderNumber }
                                        });
                                    });
                                }
                            });
                        });
                    }
                });
            });
        });
    });
});

// 更新销售订单状态
router.put('/orders/:id/status', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;
    
    if (!status) {
        return res.status(400).json({ 
            success: false, 
            message: '状态是必需的' 
        });
    }
    
    // 检查订单是否存在
    const checkOrderQuery = 'SELECT id, status FROM sales_orders WHERE id = ?';
    
    db.get(checkOrderQuery, [orderId], (err, order) => {
        if (err) {
            console.error('检查销售订单错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: '销售订单不存在' 
            });
        }
        
        // 更新订单状态
        const updateQuery = 'UPDATE sales_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        
        db.run(updateQuery, [status, orderId], function(err) {
            if (err) {
                console.error('更新销售订单状态错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '销售订单不存在' 
                });
            }
            
            // 如果订单状态变为完成，执行出库操作
            if (status === 'completed') {
                // 获取订单明细
                const itemsQuery = 'SELECT model_id, quantity FROM sales_order_items WHERE sales_order_id = ?';
                
                db.all(itemsQuery, [orderId], (err, items) => {
                    if (err) {
                        console.error('获取订单明细错误:', err);
                        // 不中断响应，出库操作可以异步处理
                    } else {
                        // 对每个商品执行出库操作
                        for (const item of items) {
                            // 更新库存数量（减少总库存和可用库存）
                            const updateInventoryQuery = `
                                UPDATE inventory 
                                SET quantity = quantity - ?, available_quantity = available_quantity - ?
                                WHERE model_id = ?
                            `;
                            
                            db.run(updateInventoryQuery, [item.quantity, item.quantity, item.model_id]);
                            
                            // 记录库存变动
                            const insertTransactionQuery = `
                                INSERT INTO inventory_transactions (model_id, transaction_type, quantity, related_table, related_id, remarks, created_by)
                                VALUES (?, 'out', ?, 'sales_orders', ?, '销售出库', ?)
                            `;
                            
                            db.run(insertTransactionQuery, [item.model_id, item.quantity, orderId, req.user.userId]);
                            
                            // 记录利润
                            const recordProfitQuery = `
                                INSERT INTO profit_records (sales_order_item_id, cost_price, sell_price, quantity, revenue, cost, profit, profit_margin)
                                SELECT 
                                    soi.id,
                                    m.purchase_price,
                                    soi.unit_price,
                                    soi.quantity,
                                    soi.total_price,
                                    m.purchase_price * soi.quantity,
                                    soi.total_price - (m.purchase_price * soi.quantity),
                                    ((soi.total_price - (m.purchase_price * soi.quantity)) / soi.total_price) * 100
                                FROM sales_order_items soi
                                LEFT JOIN models m ON soi.model_id = m.id
                                WHERE soi.sales_order_id = ? AND soi.model_id = ?
                            `;
                            
                            db.run(recordProfitQuery, [orderId, item.model_id]);
                        }
                    }
                });
            } else if (status === 'cancelled') {
                // 如果订单取消，释放预留的库存
                const itemsQuery = 'SELECT model_id, quantity FROM sales_order_items WHERE sales_order_id = ?';
                
                db.all(itemsQuery, [orderId], (err, items) => {
                    if (err) {
                        console.error('获取订单明细错误:', err);
                        // 不中断响应
                    } else {
                        for (const item of items) {
                            // 释放预留库存（增加可用数量）
                            const releaseStockQuery = `
                                UPDATE inventory 
                                SET available_quantity = available_quantity + ?
                                WHERE model_id = ?
                            `;
                            
                            db.run(releaseStockQuery, [item.quantity, item.model_id]);
                        }
                    }
                });
            }
            
            res.json({
                success: true,
                message: '销售订单状态更新成功'
            });
        });
    });
});

// 发货操作
router.put('/orders/:id/deliver', authenticateToken, checkPermission(['admin', 'manager', 'staff']), (req, res) => {
    const orderId = req.params.id;
    const { items } = req.body; // items包含每个明细的发货数量
    
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ 
            success: false, 
            message: '发货明细是必需的' 
        });
    }
    
    // 开始事务
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 获取原订单信息
        const getOrderQuery = 'SELECT id, status FROM sales_orders WHERE id = ?';
        
        db.get(getOrderQuery, [orderId], (err, order) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('获取订单信息错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (!order) {
                db.run('ROLLBACK');
                return res.status(404).json({ 
                    success: false, 
                    message: '销售订单不存在' 
                });
            }
            
            if (order.status === 'completed') {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: '订单已完成，无需重复发货' 
                });
            }
            
            // 更新订单明细的发货数量
            let itemsProcessed = 0;
            for (const item of items) {
                const updateItemQuery = `
                    UPDATE sales_order_items 
                    SET delivered_quantity = delivered_quantity + ? 
                    WHERE sales_order_id = ? AND id = ?
                `;
                
                db.run(updateItemQuery, [item.delivered_quantity, orderId, item.item_id], function(err) {
                    itemsProcessed++;
                    
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('更新订单明细发货数量错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
                    }
                    
                    // 如果所有明细都处理完，则检查是否全部发货完成
                    if (itemsProcessed === items.length) {
                        // 检查是否所有商品都已发货完毕
                        const checkAllDeliveredQuery = `
                            SELECT COUNT(*) as not_delivered 
                            FROM sales_order_items 
                            WHERE sales_order_id = ? AND delivered_quantity < quantity
                        `;
                        
                        db.get(checkAllDeliveredQuery, [orderId], (err, result) => {
                            if (err) {
                                db.run('ROLLBACK');
                                console.error('检查发货状态错误:', err);
                                return res.status(500).json({ 
                                    success: false, 
                                    message: '服务器错误' 
                                });
                            }
                            
                            if (result.not_delivered === 0) {
                                // 所有商品都已发货，更新订单状态为已完成
                                const updateOrderQuery = 'UPDATE sales_orders SET status = \'completed\', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
                                db.run(updateOrderQuery, [orderId]);
                                
                                // 同时更新库存
                                for (const item of items) {
                                    // 更新库存数量（减少总库存和可用库存）
                                    const updateInventoryQuery = `
                                        UPDATE inventory 
                                        SET quantity = quantity - ?, available_quantity = available_quantity - ?
                                        WHERE model_id = ?
                                    `;
                                    
                                    db.run(updateInventoryQuery, [item.delivered_quantity, item.delivered_quantity, item.model_id]);
                                    
                                    // 记录库存变动
                                    const insertTransactionQuery = `
                                        INSERT INTO inventory_transactions (model_id, transaction_type, quantity, related_table, related_id, remarks, created_by)
                                        VALUES (?, 'out', ?, 'sales_orders', ?, '销售发货出库', ?)
                                    `;
                                    
                                    db.run(insertTransactionQuery, [item.model_id, item.delivered_quantity, orderId, req.user.userId]);
                                    
                                    // 记录利润
                                    const recordProfitQuery = `
                                        INSERT INTO profit_records (sales_order_item_id, cost_price, sell_price, quantity, revenue, cost, profit, profit_margin)
                                        SELECT 
                                            soi.id,
                                            m.purchase_price,
                                            soi.unit_price,
                                            soi.quantity,
                                            soi.total_price,
                                            m.purchase_price * soi.quantity,
                                            soi.total_price - (m.purchase_price * soi.quantity),
                                            ((soi.total_price - (m.purchase_price * soi.quantity)) / soi.total_price) * 100
                                        FROM sales_order_items soi
                                        LEFT JOIN models m ON soi.model_id = m.id
                                        WHERE soi.sales_order_id = ? AND soi.id = ?
                                    `;
                                    
                                    // 注意：这里需要获取具体的订单项ID，而不是model_id
                                    const getSpecificItemQuery = 'SELECT id FROM sales_order_items WHERE sales_order_id = ? AND model_id = ?';
                                    db.get(getSpecificItemQuery, [orderId, item.model_id], (err, specificItem) => {
                                        if (specificItem) {
                                            db.run(recordProfitQuery, [orderId, specificItem.id]);
                                        }
                                    });
                                }
                            } else {
                                // 更新订单状态为部分发货
                                const updateOrderQuery = 'UPDATE sales_orders SET status = \'partial\', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
                                db.run(updateOrderQuery, [orderId]);
                                
                                // 部分发货也需要更新库存
                                for (const item of items) {
                                    // 更新库存数量（减少总库存和可用库存）
                                    const updateInventoryQuery = `
                                        UPDATE inventory 
                                        SET quantity = quantity - ?, available_quantity = available_quantity - ?
                                        WHERE model_id = ?
                                    `;
                                    
                                    db.run(updateInventoryQuery, [item.delivered_quantity, item.delivered_quantity, item.model_id]);
                                    
                                    // 记录库存变动
                                    const insertTransactionQuery = `
                                        INSERT INTO inventory_transactions (model_id, transaction_type, quantity, related_table, related_id, remarks, created_by)
                                        VALUES (?, 'out', ?, 'sales_orders', ?, '销售发货出库', ?)
                                    `;
                                    
                                    db.run(insertTransactionQuery, [item.model_id, item.delivered_quantity, orderId, req.user.userId]);
                                }
                            }
                            
                            db.run('COMMIT', (err) => {
                                if (err) {
                                    console.error('提交事务错误:', err);
                                    return res.status(500).json({ 
                                        success: false, 
                                        message: '服务器错误' 
                                    });
                                }
                                
                                res.json({
                                    success: true,
                                    message: '发货操作成功'
                                });
                            });
                        });
                    }
                });
            }
        });
    });
});

module.exports = router;