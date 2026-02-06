const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 获取库存列表
router.get('/', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, keyword = '', lowStock = false } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT i.*, m.model_name, b.name as brand_name 
        FROM inventory i 
        LEFT JOIN models m ON i.model_id = m.id 
        LEFT JOIN brands b ON m.brand_id = b.id 
        WHERE 1=1
    `;
    const params = [];
    
    if (keyword) {
        query += ' AND (m.model_name LIKE ? OR b.name LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam);
    }
    
    if (lowStock === 'true' || lowStock === true) {
        query += ' AND i.available_quantity <= i.min_stock_level AND i.min_stock_level > 0';
    }
    
    query += ' ORDER BY i.last_updated DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, inventoryList) => {
        if (err) {
            console.error('查询库存列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM inventory i 
            LEFT JOIN models m ON i.model_id = m.id 
            LEFT JOIN brands b ON m.brand_id = b.id 
            WHERE 1=1
        `;
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (m.model_name LIKE ? OR b.name LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam);
        }
        
        if (lowStock === 'true' || lowStock === true) {
            countQuery += ' AND i.available_quantity <= i.min_stock_level AND i.min_stock_level > 0';
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询库存总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: inventoryList,
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

// 获取单个库存信息
router.get('/:id', authenticateToken, (req, res) => {
    const inventoryId = req.params.id;
    
    const query = `
        SELECT i.*, m.model_name, b.name as brand_name 
        FROM inventory i 
        LEFT JOIN models m ON i.model_id = m.id 
        LEFT JOIN brands b ON m.brand_id = b.id 
        WHERE i.id = ?
    `;
    
    db.get(query, [inventoryId], (err, inventory) => {
        if (err) {
            console.error('查询库存错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!inventory) {
            return res.status(404).json({ 
                success: false, 
                message: '库存记录不存在' 
            });
        }
        
        res.json({
            success: true,
            data: inventory
        });
    });
});

// 根据型号ID获取库存信息
router.get('/model/:modelId', authenticateToken, (req, res) => {
    const modelId = req.params.modelId;
    
    const query = `
        SELECT i.*, m.model_name, b.name as brand_name 
        FROM inventory i 
        LEFT JOIN models m ON i.model_id = m.id 
        LEFT JOIN brands b ON m.brand_id = b.id 
        WHERE i.model_id = ?
    `;
    
    db.get(query, [modelId], (err, inventory) => {
        if (err) {
            console.error('查询型号库存错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!inventory) {
            return res.status(404).json({ 
                success: false, 
                message: '库存记录不存在' 
            });
        }
        
        res.json({
            success: true,
            data: inventory
        });
    });
});

// 入库操作
router.post('/in', authenticateToken, checkPermission(['admin', 'manager', 'staff']), (req, res) => {
    const { model_id, quantity, remarks = '', related_table = null, related_id = null } = req.body;
    
    if (!model_id || !quantity || quantity <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: '型号ID和大于0的数量是必需的' 
        });
    }
    
    // 开始事务
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 检查型号是否存在
        const checkModelQuery = 'SELECT id FROM models WHERE id = ?';
        
        db.get(checkModelQuery, [model_id], (err, model) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('检查型号错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (!model) {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: '指定的型号不存在' 
                });
            }
            
            // 更新库存数量
            const updateInventoryQuery = `
                UPDATE inventory 
                SET quantity = quantity + ?, available_quantity = available_quantity + ?, last_updated = CURRENT_TIMESTAMP
                WHERE model_id = ?
            `;
            
            db.run(updateInventoryQuery, [quantity, quantity, model_id], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('更新库存错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                if (this.changes === 0) {
                    // 如果没有更新任何记录，则创建新的库存记录
                    const insertInventoryQuery = `
                        INSERT INTO inventory (model_id, quantity, available_quantity, min_stock_level)
                        VALUES (?, ?, ?, 0)
                    `;
                    
                    db.run(insertInventoryQuery, [model_id, quantity, quantity], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('插入库存记录错误:', err);
                            return res.status(500).json({ 
                                success: false, 
                                message: '服务器错误' 
                            });
                        }
                    });
                }
                
                // 记录库存变动
                const insertTransactionQuery = `
                    INSERT INTO inventory_transactions (model_id, transaction_type, quantity, related_table, related_id, remarks, created_by)
                    VALUES (?, 'in', ?, ?, ?, ?, ?)
                `.replace(`VALUES (?, 'in', ?, ?, ?, ?, ?, ?)`, `VALUES (?, 'in', ?, ?, ?, ?, ?, ?)`)
                
                db.run(insertTransactionQuery, [model_id, quantity, related_table, related_id, remarks, req.user.userId], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('插入库存变动记录错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
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
                            message: '入库操作成功'
                        });
                    });
                });
            });
        });
    });
});

// 出库操作
router.post('/out', authenticateToken, checkPermission(['admin', 'manager', 'staff']), (req, res) => {
    const { model_id, quantity, remarks = '', related_table = null, related_id = null } = req.body;
    
    if (!model_id || !quantity || quantity <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: '型号ID和大于0的数量是必需的' 
        });
    }
    
    // 开始事务
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 检查型号是否存在及可用库存
        const checkInventoryQuery = `
            SELECT i.id, i.available_quantity, i.quantity, m.model_name
            FROM inventory i
            LEFT JOIN models m ON i.model_id = m.id
            WHERE i.model_id = ?
        `;
        
        db.get(checkInventoryQuery, [model_id], (err, inventory) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('检查库存错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (!inventory) {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: '该型号没有库存记录' 
                });
            }
            
            if (inventory.available_quantity < quantity) {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: `库存不足，当前可用数量: ${inventory.available_quantity}，请求数量: ${quantity}` 
                });
            }
            
            // 更新库存数量
            const updateInventoryQuery = `
                UPDATE inventory 
                SET quantity = quantity - ?, available_quantity = available_quantity - ?, last_updated = CURRENT_TIMESTAMP
                WHERE model_id = ?
            `;
            
            db.run(updateInventoryQuery, [quantity, quantity, model_id], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('更新库存错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                // 记录库存变动
                const insertTransactionQuery = `
                    INSERT INTO inventory_transactions (model_id, transaction_type, quantity, related_table, related_id, remarks, created_by)
                    VALUES (?, 'out', ?, ?, ?, ?, ?)
                `;
                
                db.run(insertTransactionQuery, [model_id, quantity, related_table, related_id, remarks, req.user.userId], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('插入库存变动记录错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
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
                            message: '出库操作成功'
                        });
                    });
                });
            });
        });
    });
});

// 库存盘点/调整
router.put('/adjust/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const inventoryId = req.params.id;
    const { quantity, remarks = '' } = req.body;
    
    if (typeof quantity !== 'number' || quantity < 0) {
        return res.status(400).json({ 
            success: false, 
            message: '数量必须是非负数' 
        });
    }
    
    // 开始事务
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 获取当前库存信息
        const getInventoryQuery = 'SELECT model_id, quantity, available_quantity FROM inventory WHERE id = ?';
        
        db.get(getInventoryQuery, [inventoryId], (err, inventory) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('获取库存信息错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (!inventory) {
                db.run('ROLLBACK');
                return res.status(404).json({ 
                    success: false, 
                    message: '库存记录不存在' 
                });
            }
            
            // 计算差异数量
            const diff = quantity - inventory.quantity;
            
            // 更新库存
            const updateInventoryQuery = `
                UPDATE inventory 
                SET quantity = ?, available_quantity = ?, last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            db.run(updateInventoryQuery, [quantity, quantity, inventoryId], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('更新库存错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                // 记录库存变动
                const transactionType = diff >= 0 ? 'in' : 'out';
                const absDiff = Math.abs(diff);
                
                const insertTransactionQuery = `
                    INSERT INTO inventory_transactions (model_id, transaction_type, quantity, related_table, related_id, remarks, created_by)
                    VALUES (?, ?, ?, 'inventory_adjustment', ?, ?, ?)
                `;
                
                db.run(insertTransactionQuery, [inventory.model_id, transactionType, absDiff, inventoryId, remarks, req.user.userId], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('插入库存变动记录错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
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
                            message: '库存调整成功'
                        });
                    });
                });
            });
        });
    });
});

// 设置最低库存警戒线
router.put('/min-stock/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const inventoryId = req.params.id;
    const { min_stock_level } = req.body;
    
    if (typeof min_stock_level !== 'number' || min_stock_level < 0) {
        return res.status(400).json({ 
            success: false, 
            message: '最低库存警戒线必须是非负数' 
        });
    }
    
    const updateQuery = 'UPDATE inventory SET min_stock_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    db.run(updateQuery, [min_stock_level, inventoryId], function(err) {
        if (err) {
            console.error('更新最低库存警戒线错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '库存记录不存在' 
            });
        }
        
        res.json({
            success: true,
            message: '最低库存警戒线设置成功'
        });
    });
});

// 获取库存变动记录
router.get('/transactions/:modelId', authenticateToken, (req, res) => {
    const modelId = req.params.modelId;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT it.*, u.username as operator_name 
        FROM inventory_transactions it
        LEFT JOIN users u ON it.created_by = u.id
        WHERE it.model_id = ?
        ORDER BY it.created_at DESC LIMIT ? OFFSET ?
    `;
    
    db.all(query, [modelId, parseInt(limit), parseInt(offset)], (err, transactions) => {
        if (err) {
            console.error('查询库存变动记录错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        const countQuery = 'SELECT COUNT(*) as total FROM inventory_transactions WHERE model_id = ?';
        
        db.get(countQuery, [modelId], (err, countResult) => {
            if (err) {
                console.error('查询库存变动记录总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: transactions,
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

module.exports = router;