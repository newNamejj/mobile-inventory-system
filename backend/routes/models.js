const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 获取手机型号列表
router.get('/', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, keyword = '', brandId = null } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT m.*, b.name as brand_name 
        FROM models m 
        LEFT JOIN brands b ON m.brand_id = b.id 
        WHERE 1=1
    `;
    const params = [];
    
    if (keyword) {
        query += ' AND (m.model_name LIKE ? OR b.name LIKE ? OR m.specifications LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam, searchParam);
    }
    
    if (brandId) {
        query += ' AND m.brand_id = ?';
        params.push(brandId);
    }
    
    query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, models) => {
        if (err) {
            console.error('查询手机型号列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = 'SELECT COUNT(*) as total FROM models m LEFT JOIN brands b ON m.brand_id = b.id WHERE 1=1';
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (m.model_name LIKE ? OR b.name LIKE ? OR m.specifications LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam, searchParam);
        }
        
        if (brandId) {
            countQuery += ' AND m.brand_id = ?';
            countParams.push(brandId);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询手机型号总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: models,
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

// 获取单个手机型号
router.get('/:id', authenticateToken, (req, res) => {
    const modelId = req.params.id;
    
    const query = `
        SELECT m.*, b.name as brand_name 
        FROM models m 
        LEFT JOIN brands b ON m.brand_id = b.id 
        WHERE m.id = ?
    `;
    
    db.get(query, [modelId], (err, model) => {
        if (err) {
            console.error('查询手机型号错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!model) {
            return res.status(404).json({ 
                success: false, 
                message: '手机型号不存在' 
            });
        }
        
        res.json({
            success: true,
            data: model
        });
    });
});

// 创建手机型号
router.post('/', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const { brand_id, model_name, specifications, purchase_price, retail_price, wholesale_price, imei_required } = req.body;
    
    if (!brand_id || !model_name || !purchase_price || !retail_price) {
        return res.status(400).json({ 
            success: false, 
            message: '品牌ID、型号名称、采购价和零售价不能为空' 
        });
    }
    
    // 检查品牌是否存在
    const checkBrandQuery = 'SELECT id FROM brands WHERE id = ?';
    
    db.get(checkBrandQuery, [brand_id], (err, brand) => {
        if (err) {
            console.error('检查品牌错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!brand) {
            return res.status(400).json({ 
                success: false, 
                message: '指定的品牌不存在' 
            });
        }
        
        // 检查型号名称是否已存在
        const checkModelQuery = 'SELECT id FROM models WHERE model_name = ? AND brand_id = ?';
        
        db.get(checkModelQuery, [model_name, brand_id], (err, existingModel) => {
            if (err) {
                console.error('检查型号名称错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (existingModel) {
                return res.status(400).json({ 
                    success: false, 
                    message: '该品牌下已存在相同的型号名称' 
                });
            }
            
            // 插入新手机型号
            const insertQuery = `
                INSERT INTO models (brand_id, model_name, specifications, purchase_price, retail_price, wholesale_price, imei_required)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.run(insertQuery, [brand_id, model_name, specifications, purchase_price, retail_price, wholesale_price || null, imei_required || 0], function(err) {
                if (err) {
                    console.error('插入手机型号错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                // 同时创建库存记录
                const insertInventoryQuery = `
                    INSERT INTO inventory (model_id, quantity, available_quantity, min_stock_level)
                    VALUES (?, 0, 0, ?)
                `;
                
                db.run(insertInventoryQuery, [this.lastID, 0], (err) => {
                    if (err) {
                        console.error('创建库存记录错误:', err);
                        // 不中断流程，因为型号已经创建成功
                    }
                });
                
                res.json({
                    success: true,
                    message: '手机型号创建成功',
                    data: { id: this.lastID }
                });
            });
        });
    });
});

// 更新手机型号
router.put('/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const modelId = req.params.id;
    const { brand_id, model_name, specifications, purchase_price, retail_price, wholesale_price, imei_required } = req.body;
    
    if (!brand_id || !model_name || !purchase_price || !retail_price) {
        return res.status(400).json({ 
            success: false, 
            message: '品牌ID、型号名称、采购价和零售价不能为空' 
        });
    }
    
    // 检查品牌是否存在
    const checkBrandQuery = 'SELECT id FROM brands WHERE id = ?';
    
    db.get(checkBrandQuery, [brand_id], (err, brand) => {
        if (err) {
            console.error('检查品牌错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!brand) {
            return res.status(400).json({ 
                success: false, 
                message: '指定的品牌不存在' 
            });
        }
        
        // 检查型号名称是否已被其他型号使用
        const checkModelQuery = 'SELECT id FROM models WHERE model_name = ? AND brand_id = ? AND id != ?';
        
        db.get(checkModelQuery, [model_name, brand_id, modelId], (err, existingModel) => {
            if (err) {
                console.error('检查型号名称错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (existingModel) {
                return res.status(400).json({ 
                    success: false, 
                    message: '该品牌下已存在相同的型号名称' 
                });
            }
            
            const updateQuery = `
                UPDATE models 
                SET brand_id = ?, model_name = ?, specifications = ?, purchase_price = ?, 
                    retail_price = ?, wholesale_price = ?, imei_required = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            db.run(updateQuery, [brand_id, model_name, specifications, purchase_price, retail_price, wholesale_price || null, imei_required || 0, modelId], function(err) {
                if (err) {
                    console.error('更新手机型号错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: '手机型号不存在' 
                    });
                }
                
                res.json({
                    success: true,
                    message: '手机型号更新成功'
                });
            });
        });
    });
});

// 删除手机型号
router.delete('/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const modelId = req.params.id;
    
    // 检查型号是否存在
    const checkQuery = 'SELECT id FROM models WHERE id = ?';
    
    db.get(checkQuery, [modelId], (err, model) => {
        if (err) {
            console.error('检查型号错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!model) {
            return res.status(404).json({ 
                success: false, 
                message: '手机型号不存在' 
            });
        }
        
        // 检查是否有库存、采购或销售记录关联此型号
        const checkInventoryQuery = 'SELECT COUNT(*) as count FROM inventory WHERE model_id = ?';
        const checkPurchaseItemsQuery = 'SELECT COUNT(*) as count FROM purchase_order_items WHERE model_id = ?';
        const checkSalesItemsQuery = 'SELECT COUNT(*) as count FROM sales_order_items WHERE model_id = ?';
        
        db.get(checkInventoryQuery, [modelId], (err, inventoryResult) => {
            if (err) {
                console.error('检查库存记录错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (inventoryResult.count > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '无法删除手机型号，仍有库存记录' 
                });
            }
            
            db.get(checkPurchaseItemsQuery, [modelId], (err, purchaseResult) => {
                if (err) {
                    console.error('检查采购记录错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                if (purchaseResult.count > 0) {
                    return res.status(400).json({ 
                        success: false, 
                        message: '无法删除手机型号，有采购记录关联' 
                    });
                }
                
                db.get(checkSalesItemsQuery, [modelId], (err, salesResult) => {
                    if (err) {
                        console.error('检查销售记录错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
                    }
                    
                    if (salesResult.count > 0) {
                        return res.status(400).json({ 
                            success: false, 
                            message: '无法删除手机型号，有销售记录关联' 
                        });
                    }
                    
                    // 删除型号
                    const deleteQuery = 'DELETE FROM models WHERE id = ?';
                    
                    db.run(deleteQuery, [modelId], function(err) {
                        if (err) {
                            console.error('删除手机型号错误:', err);
                            return res.status(500).json({ 
                                success: false, 
                                message: '服务器错误' 
                            });
                        }
                        
                        if (this.changes === 0) {
                            return res.status(404).json({ 
                                success: false, 
                                message: '手机型号不存在' 
                            });
                        }
                        
                        res.json({
                            success: true,
                            message: '手机型号删除成功'
                        });
                    });
                });
            });
        });
    });
});

module.exports = router;