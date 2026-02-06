const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 获取客户列表
router.get('/', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, keyword = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, name, contact_person, phone, email, address, credit_limit, balance, created_at, updated_at FROM customers WHERE 1=1';
    const params = [];
    
    if (keyword) {
        query += ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, customers) => {
        if (err) {
            console.error('查询客户列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam, searchParam, searchParam);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询客户总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: customers,
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

// 获取单个客户
router.get('/:id', authenticateToken, (req, res) => {
    const customerId = req.params.id;
    
    const query = 'SELECT id, name, contact_person, phone, email, address, credit_limit, balance, created_at, updated_at FROM customers WHERE id = ?';
    
    db.get(query, [customerId], (err, customer) => {
        if (err) {
            console.error('查询客户错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!customer) {
            return res.status(404).json({ 
                success: false, 
                message: '客户不存在' 
            });
        }
        
        res.json({
            success: true,
            data: customer
        });
    });
});

// 创建客户
router.post('/', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const { name, contact_person, phone, email, address, credit_limit } = req.body;
    
    if (!name) {
        return res.status(400).json({ 
            success: false, 
            message: '客户名称不能为空' 
        });
    }
    
    // 检查客户名称是否已存在
    const checkQuery = 'SELECT id FROM customers WHERE name = ?';
    
    db.get(checkQuery, [name], (err, existingCustomer) => {
        if (err) {
            console.error('检查客户名称错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (existingCustomer) {
            return res.status(400).json({ 
                success: false, 
                message: '客户名称已存在' 
            });
        }
        
        // 插入新客户
        const insertQuery = `
            INSERT INTO customers (name, contact_person, phone, email, address, credit_limit, balance)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(insertQuery, [name, contact_person, phone, email, address, credit_limit || 0, 0], function(err) {
            if (err) {
                console.error('插入客户错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                message: '客户创建成功',
                data: { id: this.lastID }
            });
        });
    });
});

// 更新客户
router.put('/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const customerId = req.params.id;
    const { name, contact_person, phone, email, address, credit_limit } = req.body;
    
    if (!name) {
        return res.status(400).json({ 
            success: false, 
            message: '客户名称不能为空' 
        });
    }
    
    // 检查客户名称是否已被其他客户使用
    const checkQuery = 'SELECT id FROM customers WHERE name = ? AND id != ?';
    
    db.get(checkQuery, [name, customerId], (err, existingCustomer) => {
        if (err) {
            console.error('检查客户名称错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (existingCustomer) {
            return res.status(400).json({ 
                success: false, 
                message: '客户名称已存在' 
            });
        }
        
        const updateQuery = `
            UPDATE customers 
            SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, credit_limit = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        db.run(updateQuery, [name, contact_person, phone, email, address, credit_limit || 0, customerId], function(err) {
            if (err) {
                console.error('更新客户错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '客户不存在' 
                });
            }
            
            res.json({
                success: true,
                message: '客户更新成功'
            });
        });
    });
});

// 删除客户
router.delete('/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const customerId = req.params.id;
    
    // 检查客户是否存在
    const checkQuery = 'SELECT id FROM customers WHERE id = ?';
    
    db.get(checkQuery, [customerId], (err, customer) => {
        if (err) {
            console.error('检查客户错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!customer) {
            return res.status(404).json({ 
                success: false, 
                message: '客户不存在' 
            });
        }
        
        // 检查是否有销售订单关联此客户
        const checkOrdersQuery = 'SELECT COUNT(*) as count FROM sales_orders WHERE customer_id = ?';
        
        db.get(checkOrdersQuery, [customerId], (err, result) => {
            if (err) {
                console.error('检查销售订单错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (result.count > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '无法删除客户，有销售订单关联此客户' 
                });
            }
            
            // 删除客户
            const deleteQuery = 'DELETE FROM customers WHERE id = ?';
            
            db.run(deleteQuery, [customerId], function(err) {
                if (err) {
                    console.error('删除客户错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: '客户不存在' 
                    });
                }
                
                res.json({
                    success: true,
                    message: '客户删除成功'
                });
            });
        });
    });
});

module.exports = router;