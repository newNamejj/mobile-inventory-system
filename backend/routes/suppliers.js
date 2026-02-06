const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 获取供应商列表
router.get('/', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, keyword = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, name, contact_person, phone, email, address, credit_limit, balance, created_at, updated_at FROM suppliers WHERE 1=1';
    const params = [];
    
    if (keyword) {
        query += ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, suppliers) => {
        if (err) {
            console.error('查询供应商列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = 'SELECT COUNT(*) as total FROM suppliers WHERE 1=1';
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam, searchParam, searchParam);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询供应商总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: suppliers,
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

// 获取单个供应商
router.get('/:id', authenticateToken, (req, res) => {
    const supplierId = req.params.id;
    
    const query = 'SELECT id, name, contact_person, phone, email, address, credit_limit, balance, created_at, updated_at FROM suppliers WHERE id = ?';
    
    db.get(query, [supplierId], (err, supplier) => {
        if (err) {
            console.error('查询供应商错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!supplier) {
            return res.status(404).json({ 
                success: false, 
                message: '供应商不存在' 
            });
        }
        
        res.json({
            success: true,
            data: supplier
        });
    });
});

// 创建供应商
router.post('/', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const { name, contact_person, phone, email, address, credit_limit } = req.body;
    
    if (!name) {
        return res.status(400).json({ 
            success: false, 
            message: '供应商名称不能为空' 
        });
    }
    
    // 检查供应商名称是否已存在
    const checkQuery = 'SELECT id FROM suppliers WHERE name = ?';
    
    db.get(checkQuery, [name], (err, existingSupplier) => {
        if (err) {
            console.error('检查供应商名称错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (existingSupplier) {
            return res.status(400).json({ 
                success: false, 
                message: '供应商名称已存在' 
            });
        }
        
        // 插入新供应商
        const insertQuery = `
            INSERT INTO suppliers (name, contact_person, phone, email, address, credit_limit, balance)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(insertQuery, [name, contact_person, phone, email, address, credit_limit || 0, 0], function(err) {
            if (err) {
                console.error('插入供应商错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                message: '供应商创建成功',
                data: { id: this.lastID }
            });
        });
    });
});

// 更新供应商
router.put('/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const supplierId = req.params.id;
    const { name, contact_person, phone, email, address, credit_limit } = req.body;
    
    if (!name) {
        return res.status(400).json({ 
            success: false, 
            message: '供应商名称不能为空' 
        });
    }
    
    // 检查供应商名称是否已被其他供应商使用
    const checkQuery = 'SELECT id FROM suppliers WHERE name = ? AND id != ?';
    
    db.get(checkQuery, [name, supplierId], (err, existingSupplier) => {
        if (err) {
            console.error('检查供应商名称错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (existingSupplier) {
            return res.status(400).json({ 
                success: false, 
                message: '供应商名称已存在' 
            });
        }
        
        const updateQuery = `
            UPDATE suppliers 
            SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, credit_limit = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        db.run(updateQuery, [name, contact_person, phone, email, address, credit_limit || 0, supplierId], function(err) {
            if (err) {
                console.error('更新供应商错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '供应商不存在' 
                });
            }
            
            res.json({
                success: true,
                message: '供应商更新成功'
            });
        });
    });
});

// 删除供应商
router.delete('/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const supplierId = req.params.id;
    
    // 检查供应商是否存在
    const checkQuery = 'SELECT id FROM suppliers WHERE id = ?';
    
    db.get(checkQuery, [supplierId], (err, supplier) => {
        if (err) {
            console.error('检查供应商错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!supplier) {
            return res.status(404).json({ 
                success: false, 
                message: '供应商不存在' 
            });
        }
        
        // 检查是否有采购订单关联此供应商
        const checkOrdersQuery = 'SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ?';
        
        db.get(checkOrdersQuery, [supplierId], (err, result) => {
            if (err) {
                console.error('检查采购订单错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (result.count > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '无法删除供应商，有采购订单关联此供应商' 
                });
            }
            
            // 删除供应商
            const deleteQuery = 'DELETE FROM suppliers WHERE id = ?';
            
            db.run(deleteQuery, [supplierId], function(err) {
                if (err) {
                    console.error('删除供应商错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: '供应商不存在' 
                    });
                }
                
                res.json({
                    success: true,
                    message: '供应商删除成功'
                });
            });
        });
    });
});

module.exports = router;