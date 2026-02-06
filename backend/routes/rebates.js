const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 获取返利列表
router.get('/', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, keyword = '', type = '', status = '', startDate = '', endDate = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT r.*, 
               CASE 
                   WHEN r.customer_id IS NOT NULL THEN c.name 
                   WHEN r.supplier_id IS NOT NULL THEN s.name 
                   ELSE 'Unknown' 
               END as entity_name
        FROM rebates r
        LEFT JOIN customers c ON r.customer_id = c.id
        LEFT JOIN suppliers s ON r.supplier_id = s.id
        WHERE 1=1
    `;
    const params = [];
    
    if (keyword) {
        query += ' AND (r.related_table LIKE ? OR r.remarks LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam);
    }
    
    if (type) {
        query += ' AND r.rebate_type = ?';
        params.push(type);
    }
    
    if (status) {
        query += ' AND r.status = ?';
        params.push(status);
    }
    
    if (startDate) {
        query += ' AND r.created_at >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND r.created_at <= ?';
        params.push(endDate);
    }
    
    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, rebates) => {
        if (err) {
            console.error('查询返利列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM rebates r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN suppliers s ON r.supplier_id = s.id
            WHERE 1=1
        `;
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (r.related_table LIKE ? OR r.remarks LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam);
        }
        
        if (type) {
            countQuery += ' AND r.rebate_type = ?';
            countParams.push(type);
        }
        
        if (status) {
            countQuery += ' AND r.status = ?';
            countParams.push(status);
        }
        
        if (startDate) {
            countQuery += ' AND r.created_at >= ?';
            countParams.push(startDate);
        }
        
        if (endDate) {
            countQuery += ' AND r.created_at <= ?';
            countParams.push(endDate);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询返利总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: rebates,
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

// 获取单个返利详情
router.get('/:id', authenticateToken, (req, res) => {
    const rebateId = req.params.id;
    
    const query = `
        SELECT r.*, 
               CASE 
                   WHEN r.customer_id IS NOT NULL THEN c.name 
                   WHEN r.supplier_id IS NOT NULL THEN s.name 
                   ELSE 'Unknown' 
               END as entity_name,
               u.username as creator_name
        FROM rebates r
        LEFT JOIN customers c ON r.customer_id = c.id
        LEFT JOIN suppliers s ON r.supplier_id = s.id
        LEFT JOIN users u ON r.created_by = u.id
        WHERE r.id = ?
    `;
    
    db.get(query, [rebateId], (err, rebate) => {
        if (err) {
            console.error('查询返利详情错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!rebate) {
            return res.status(404).json({ 
                success: false, 
                message: '返利记录不存在' 
            });
        }
        
        res.json({
            success: true,
            data: rebate
        });
    });
});

// 创建返利记录
router.post('/', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const { rebate_type, related_table, related_id, customer_id, supplier_id, amount, expiry_date, remarks = '' } = req.body;
    
    if (!rebate_type || !related_table || !related_id || !amount) {
        return res.status(400).json({ 
            success: false, 
            message: '返利类型、关联表、关联ID和金额都是必需的' 
        });
    }
    
    if (rebate_type === 'sales' && !customer_id) {
        return res.status(400).json({ 
            success: false, 
            message: '销售返利必须指定客户ID' 
        });
    }
    
    if (rebate_type === 'purchase' && !supplier_id) {
        return res.status(400).json({ 
            success: false, 
            message: '采购返利必须指定供应商ID' 
        });
    }
    
    // 开始事务
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 验证客户或供应商是否存在
        if (customer_id) {
            const checkCustomerQuery = 'SELECT id FROM customers WHERE id = ?';
            db.get(checkCustomerQuery, [customer_id], (err, customer) => {
                if (err || !customer) {
                    db.run('ROLLBACK');
                    return res.status(400).json({ 
                        success: false, 
                        message: '指定的客户不存在' 
                    });
                }
            });
        }
        
        if (supplier_id) {
            const checkSupplierQuery = 'SELECT id FROM suppliers WHERE id = ?';
            db.get(checkSupplierQuery, [supplier_id], (err, supplier) => {
                if (err || !supplier) {
                    db.run('ROLLBACK');
                    return res.status(400).json({ 
                        success: false, 
                        message: '指定的供应商不存在' 
                    });
                }
            });
        }
        
        // 插入返利记录
        const insertQuery = `
            INSERT INTO rebates (rebate_type, related_table, related_id, customer_id, supplier_id, amount, status, expiry_date, remarks, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(insertQuery, [rebate_type, related_table, related_id, customer_id, supplier_id, amount, 'pending', expiry_date, remarks, req.user.userId], function(err) {
            if (err) {
                db.run('ROLLBACK');
                console.error('插入返利记录错误:', err);
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
                    message: '返利记录创建成功',
                    data: { id: this.lastID }
                });
            });
        });
    });
});

// 更新返利状态
router.put('/:id/status', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const rebateId = req.params.id;
    const { status } = req.body;
    
    if (!status) {
        return res.status(400).json({ 
            success: false, 
            message: '状态是必需的' 
        });
    }
    
    // 验证状态值
    const validStatuses = ['pending', 'confirmed', 'redeemed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
            success: false, 
            message: '无效的状态值' 
        });
    }
    
    const updateQuery = 'UPDATE rebates SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    db.run(updateQuery, [status, rebateId], function(err) {
        if (err) {
            console.error('更新返利状态错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '返利记录不存在' 
            });
        }
        
        res.json({
            success: true,
            message: '返利状态更新成功'
        });
    });
});

// 删除返利记录
router.delete('/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const rebateId = req.params.id;
    
    // 检查返利记录是否存在且状态不是已兑换
    const checkQuery = 'SELECT id, status FROM rebates WHERE id = ?';
    
    db.get(checkQuery, [rebateId], (err, rebate) => {
        if (err) {
            console.error('检查返利记录错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!rebate) {
            return res.status(404).json({ 
                success: false, 
                message: '返利记录不存在' 
            });
        }
        
        if (rebate.status === 'redeemed') {
            return res.status(400).json({ 
                success: false, 
                message: '已兑换的返利记录不能删除' 
            });
        }
        
        const deleteQuery = 'DELETE FROM rebates WHERE id = ?';
        
        db.run(deleteQuery, [rebateId], function(err) {
            if (err) {
                console.error('删除返利记录错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '返利记录不存在' 
                });
            }
            
            res.json({
                success: true,
                message: '返利记录删除成功'
            });
        });
    });
});

// 获取客户的返利余额
router.get('/customer/:customerId/balance', authenticateToken, (req, res) => {
    const customerId = req.params.customerId;
    
    // 计算客户有效的返利总额（未过期、未兑换）
    const query = `
        SELECT 
            SUM(amount) as total_rebate,
            COUNT(*) as total_count
        FROM rebates
        WHERE customer_id = ? 
          AND status IN ('pending', 'confirmed')
          AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    `;
    
    db.get(query, [customerId], (err, result) => {
        if (err) {
            console.error('查询客户返利余额错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        res.json({
            success: true,
            data: {
                totalRebate: parseFloat(result.total_rebate || 0),
                totalCount: result.total_count || 0
            }
        });
    });
});

// 获取供应商的返利余额
router.get('/supplier/:supplierId/balance', authenticateToken, (req, res) => {
    const supplierId = req.params.supplierId;
    
    // 计算供应商有效的返利总额（未过期、未兑换）
    const query = `
        SELECT 
            SUM(amount) as total_rebate,
            COUNT(*) as total_count
        FROM rebates
        WHERE supplier_id = ? 
          AND status IN ('pending', 'confirmed')
          AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    `;
    
    db.get(query, [supplierId], (err, result) => {
        if (err) {
            console.error('查询供应商返利余额错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        res.json({
            success: true,
            data: {
                totalRebate: parseFloat(result.total_rebate || 0),
                totalCount: result.total_count || 0
            }
        });
    });
});

module.exports = router;