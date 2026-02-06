const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 获取采购订单列表
router.get('/orders', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, keyword = '', status = '', startDate = '', endDate = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT po.*, s.name as supplier_name, u.username as creator_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u ON po.created_by = u.id
        WHERE 1=1
    `;
    const params = [];
    
    if (keyword) {
        query += ' AND (po.order_number LIKE ? OR s.name LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam);
    }
    
    if (status) {
        query += ' AND po.status = ?';
        params.push(status);
    }
    
    if (startDate) {
        query += ' AND po.created_at >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND po.created_at <= ?';
        params.push(endDate);
    }
    
    query += ' ORDER BY po.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, orders) => {
        if (err) {
            console.error('查询采购订单列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            WHERE 1=1
        `;
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (po.order_number LIKE ? OR s.name LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam);
        }
        
        if (status) {
            countQuery += ' AND po.status = ?';
            countParams.push(status);
        }
        
        if (startDate) {
            countQuery += ' AND po.created_at >= ?';
            countParams.push(startDate);
        }
        
        if (endDate) {
            countQuery += ' AND po.created_at <= ?';
            countParams.push(endDate);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询采购订单总数错误:', err);
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

// 获取单个采购订单
router.get('/orders/:id', authenticateToken, (req, res) => {
    const orderId = req.params.id;
    
    const query = `
        SELECT po.*, s.name as supplier_name, u.username as creator_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u ON po.created_by = u.id
        WHERE po.id = ?
    `;
    
    db.get(query, [orderId], (err, order) => {
        if (err) {
            console.error('查询采购订单错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: '采购订单不存在' 
            });
        }
        
        // 获取订单明细
        const itemsQuery = `
            SELECT poi.*, m.model_name, b.name as brand_name
            FROM purchase_order_items poi
            LEFT JOIN models m ON poi.model_id = m.id
            LEFT JOIN brands b ON m.brand_id = b.id
            WHERE poi.purchase_order_id = ?
        `;
        
        db.all(itemsQuery, [orderId], (err, items) => {
            if (err) {
                console.error('查询采购订单明细错误:', err);
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

// 创建采购订单
router.post('/orders', authenticateToken, checkPermission(['admin', 'manager', 'staff']), (req, res) => {
    const { supplier_id, items, remarks = '' } = req.body;
    
    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: '供应商ID和订单明细是必需的' 
        });
    }
    
    // 开始事务
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 检查供应商是否存在
        const checkSupplierQuery = 'SELECT id, balance FROM suppliers WHERE id = ?';
        
        db.get(checkSupplierQuery, [supplier_id], (err, supplier) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('检查供应商错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (!supplier) {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: '指定的供应商不存在' 
                });
            }
            
            // 计算总金额
            let totalAmount = 0;
            for (const item of items) {
                if (!item.model_id || !item.quantity || !item.unit_price) {
                    db.run('ROLLBACK');
                    return res.status(400).json({ 
                        success: false, 
                        message: '订单明细中缺少必要信息' 
                    });
                }
                totalAmount += parseFloat(item.quantity) * parseFloat(item.unit_price);
            }
            
            // 生成订单号 (格式: PO + 年月日 + 4位序号)
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const orderNumberPrefix = `PO${dateStr}`;
            
            // 获取当天最大的序号
            const getMaxSeqQuery = `
                SELECT MAX(CAST(SUBSTR(order_number, 11) AS INTEGER)) as max_seq 
                FROM purchase_orders 
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
                
                // 插入采购订单
                const insertOrderQuery = `
                    INSERT INTO purchase_orders (order_number, supplier_id, total_amount, remarks, created_by)
                    VALUES (?, ?, ?, ?, ?)
                `;
                
                db.run(insertOrderQuery, [orderNumber, supplier_id, totalAmount, remarks, req.user.userId], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('插入采购订单错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
                    }
                    
                    const orderId = this.lastID;
                    
                    // 插入订单明细
                    let itemsProcessed = 0;
                    for (const item of items) {
                        const insertItemQuery = `
                            INSERT INTO purchase_order_items (purchase_order_id, model_id, quantity, unit_price, total_price)
                            VALUES (?, ?, ?, ?, ?)
                        `;
                        
                        const totalPrice = parseFloat(item.quantity) * parseFloat(item.unit_price);
                        
                        db.run(insertItemQuery, [orderId, item.model_id, item.quantity, item.unit_price, totalPrice], function(err) {
                            itemsProcessed++;
                            
                            if (err) {
                                db.run('ROLLBACK');
                                console.error('插入采购订单明细错误:', err);
                                return res.status(500).json({ 
                                    success: false, 
                                    message: '服务器错误' 
                                });
                            }
                            
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
                                        message: '采购订单创建成功',
                                        data: { id: orderId, order_number: orderNumber }
                                    });
                                });
                            }
                        });
                    }
                });
            });
        });
    });
});

// 更新采购订单状态
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
    const checkOrderQuery = 'SELECT id, status FROM purchase_orders WHERE id = ?';
    
    db.get(checkOrderQuery, [orderId], (err, order) => {
        if (err) {
            console.error('检查采购订单错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: '采购订单不存在' 
            });
        }
        
        // 更新订单状态
        const updateQuery = 'UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        
        db.run(updateQuery, [status, orderId], function(err) {
            if (err) {
                console.error('更新采购订单状态错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '采购订单不存在' 
                });
            }
            
            // 如果订单状态变为完成，执行入库操作
            if (status === 'completed') {
                // 获取订单明细
                const itemsQuery = 'SELECT model_id, quantity FROM purchase_order_items WHERE purchase_order_id = ?';
                
                db.all(itemsQuery, [orderId], (err, items) => {
                    if (err) {
                        console.error('获取订单明细错误:', err);
                        // 不中断响应，入库操作可以异步处理
                    } else {
                        // 对每个商品执行入库操作
                        for (const item of items) {
                            // 更新库存数量
                            const updateInventoryQuery = `
                                INSERT OR REPLACE INTO inventory (model_id, quantity, available_quantity, min_stock_level, last_updated)
                                SELECT 
                                    ?, 
                                    COALESCE((SELECT quantity FROM inventory WHERE model_id = ?), 0) + ?,
                                    COALESCE((SELECT available_quantity FROM inventory WHERE model_id = ?), 0) + ?,
                                    COALESCE(min_stock_level, 0),
                                    CURRENT_TIMESTAMP
                                FROM inventory WHERE model_id = ? UNION ALL 
                                SELECT ?, ?, ?, 0, CURRENT_TIMESTAMP 
                                WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE model_id = ?)
                            `;
                            
                            db.run(updateInventoryQuery, [
                                item.model_id, item.model_id, item.quantity,
                                item.model_id, item.quantity,
                                item.model_id,
                                item.model_id, item.quantity, item.quantity
                            ]);
                            
                            // 记录库存变动
                            const insertTransactionQuery = `
                                INSERT INTO inventory_transactions (model_id, transaction_type, quantity, related_table, related_id, remarks, created_by)
                                VALUES (?, 'in', ?, 'purchase_orders', ?, '采购入库', ?)
                            `;
                            
                            db.run(insertTransactionQuery, [item.model_id, item.quantity, orderId, req.user.userId]);
                        }
                    }
                });
            }
            
            res.json({
                success: true,
                message: '采购订单状态更新成功'
            });
        });
    });
});

// 收货操作
router.put('/orders/:id/receive', authenticateToken, checkPermission(['admin', 'manager', 'staff']), (req, res) => {
    const orderId = req.params.id;
    const { items } = req.body; // items包含每个明细的接收数量
    
    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ 
            success: false, 
            message: '收货明细是必需的' 
        });
    }
    
    // 开始事务
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 获取原订单信息
        const getOrderQuery = 'SELECT id, status FROM purchase_orders WHERE id = ?';
        
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
                    message: '采购订单不存在' 
                });
            }
            
            if (order.status === 'completed') {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: '订单已完成，无需重复收货' 
                });
            }
            
            // 更新订单明细的收货数量
            let itemsProcessed = 0;
            for (const item of items) {
                const updateItemQuery = `
                    UPDATE purchase_order_items 
                    SET received_quantity = received_quantity + ? 
                    WHERE purchase_order_id = ? AND id = ?
                `;
                
                db.run(updateItemQuery, [item.received_quantity, orderId, item.item_id], function(err) {
                    itemsProcessed++;
                    
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('更新订单明细收货数量错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
                    }
                    
                    // 如果所有明细都处理完，则检查是否全部收货完成
                    if (itemsProcessed === items.length) {
                        // 检查是否所有商品都已收货完毕
                        const checkAllReceivedQuery = `
                            SELECT COUNT(*) as not_received 
                            FROM purchase_order_items 
                            WHERE purchase_order_id = ? AND received_quantity < quantity
                        `;
                        
                        db.get(checkAllReceivedQuery, [orderId], (err, result) => {
                            if (err) {
                                db.run('ROLLBACK');
                                console.error('检查收货状态错误:', err);
                                return res.status(500).json({ 
                                    success: false, 
                                    message: '服务器错误' 
                                });
                            }
                            
                            let updateOrderStatus = false;
                            
                            if (result.not_received === 0) {
                                // 所有商品都已收货，更新订单状态为已完成
                                const updateOrderQuery = 'UPDATE purchase_orders SET status = \'completed\', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
                                db.run(updateOrderQuery, [orderId]);
                                updateOrderStatus = true;
                            } else {
                                // 更新订单状态为部分收货
                                const updateOrderQuery = 'UPDATE purchase_orders SET status = \'partial\', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
                                db.run(updateOrderQuery, [orderId]);
                                updateOrderStatus = true;
                            }
                            
                            if (updateOrderStatus) {
                                // 更新库存
                                for (const item of items) {
                                    // 更新库存数量
                                    const updateInventoryQuery = `
                                        INSERT OR REPLACE INTO inventory (model_id, quantity, available_quantity, min_stock_level, last_updated)
                                        SELECT 
                                            ?, 
                                            COALESCE((SELECT quantity FROM inventory WHERE model_id = ?), 0) + ?,
                                            COALESCE((SELECT available_quantity FROM inventory WHERE model_id = ?), 0) + ?,
                                            COALESCE(min_stock_level, 0),
                                            CURRENT_TIMESTAMP
                                        FROM inventory WHERE model_id = ? UNION ALL 
                                        SELECT ?, ?, ?, 0, CURRENT_TIMESTAMP 
                                        WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE model_id = ?)
                                    `;
                                    
                                    db.run(updateInventoryQuery, [
                                        item.model_id, item.model_id, item.received_quantity,
                                        item.model_id, item.received_quantity,
                                        item.model_id,
                                        item.model_id, item.received_quantity, item.received_quantity
                                    ]);
                                    
                                    // 记录库存变动
                                    const insertTransactionQuery = `
                                        INSERT INTO inventory_transactions (model_id, transaction_type, quantity, related_table, related_id, remarks, created_by)
                                        VALUES (?, 'in', ?, 'purchase_orders', ?, '采购收货入库', ?)
                                    `;
                                    
                                    db.run(insertTransactionQuery, [item.model_id, item.received_quantity, orderId, req.user.userId]);
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
                                    message: '收货操作成功'
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