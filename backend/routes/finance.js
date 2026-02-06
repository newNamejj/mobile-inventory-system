const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 获取应收账款列表
router.get('/receivables', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, keyword = '', status = '', startDate = '', endDate = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT pr.*, c.name as customer_name
        FROM payments_receivables pr
        LEFT JOIN customers c ON pr.customer_id = c.id
        WHERE 1=1
    `;
    const params = [];
    
    if (keyword) {
        query += ' AND (c.name LIKE ? OR pr.related_table LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam);
    }
    
    if (status) {
        query += ' AND pr.status = ?';
        params.push(status);
    }
    
    if (startDate) {
        query += ' AND pr.created_at >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND pr.created_at <= ?';
        params.push(endDate);
    }
    
    query += ' ORDER BY pr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, receivables) => {
        if (err) {
            console.error('查询应收账款列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM payments_receivables pr
            LEFT JOIN customers c ON pr.customer_id = c.id
            WHERE 1=1
        `;
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (c.name LIKE ? OR pr.related_table LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam);
        }
        
        if (status) {
            countQuery += ' AND pr.status = ?';
            countParams.push(status);
        }
        
        if (startDate) {
            countQuery += ' AND pr.created_at >= ?';
            countParams.push(startDate);
        }
        
        if (endDate) {
            countQuery += ' AND pr.created_at <= ?';
            countParams.push(endDate);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询应收账款总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: receivables,
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

// 获取应付账款列表
router.get('/payables', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, keyword = '', status = '', startDate = '', endDate = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT pp.*, s.name as supplier_name
        FROM payments_payables pp
        LEFT JOIN suppliers s ON pp.supplier_id = s.id
        WHERE 1=1
    `;
    const params = [];
    
    if (keyword) {
        query += ' AND (s.name LIKE ? OR pp.related_table LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam);
    }
    
    if (status) {
        query += ' AND pp.status = ?';
        params.push(status);
    }
    
    if (startDate) {
        query += ' AND pp.created_at >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND pp.created_at <= ?';
        params.push(endDate);
    }
    
    query += ' ORDER BY pp.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, payables) => {
        if (err) {
            console.error('查询应付账款列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM payments_payables pp
            LEFT JOIN suppliers s ON pp.supplier_id = s.id
            WHERE 1=1
        `;
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (s.name LIKE ? OR pp.related_table LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam);
        }
        
        if (status) {
            countQuery += ' AND pp.status = ?';
            countParams.push(status);
        }
        
        if (startDate) {
            countQuery += ' AND pp.created_at >= ?';
            countParams.push(startDate);
        }
        
        if (endDate) {
            countQuery += ' AND pp.created_at <= ?';
            countParams.push(endDate);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询应付账款总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: payables,
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

// 收款操作
router.post('/receive-payment', authenticateToken, checkPermission(['admin', 'manager', 'staff']), (req, res) => {
    const { receivable_id, amount, payment_method, payment_date, remarks = '' } = req.body;
    
    if (!receivable_id || !amount || !payment_method || !payment_date) {
        return res.status(400).json({ 
            success: false, 
            message: '应收款ID、金额、支付方式和支付日期都是必需的' 
        });
    }
    
    // 开始事务
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 获取应收款信息
        const getReceivableQuery = 'SELECT * FROM payments_receivables WHERE id = ?';
        
        db.get(getReceivableQuery, [receivable_id], (err, receivable) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('获取应收款信息错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (!receivable) {
                db.run('ROLLBACK');
                return res.status(404).json({ 
                    success: false, 
                    message: '应收款记录不存在' 
                });
            }
            
            if (receivable.paid_amount + parseFloat(amount) > receivable.amount) {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: '收款金额超过剩余应收款金额' 
                });
            }
            
            // 更新应收款记录
            const newPaidAmount = receivable.paid_amount + parseFloat(amount);
            let newStatus = receivable.status;
            
            if (newPaidAmount >= receivable.amount) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partially_paid';
            }
            
            const updateReceivableQuery = `
                UPDATE payments_receivables 
                SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            db.run(updateReceivableQuery, [newPaidAmount, newStatus, receivable_id], (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('更新应收款记录错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                // 更新客户余额
                const updateCustomerBalanceQuery = `
                    UPDATE customers 
                    SET balance = balance - ? 
                    WHERE id = ?
                `;
                
                db.run(updateCustomerBalanceQuery, [amount, receivable.customer_id], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('更新客户余额错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
                    }
                    
                    // 记录收付款记录
                    const insertPaymentRecordQuery = `
                        INSERT INTO payment_records (payment_type, related_table, related_id, amount, payment_method, payment_date, operator_id, remarks)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    db.run(insertPaymentRecordQuery, ['receive', 'payments_receivables', receivable_id, amount, payment_method, payment_date, req.user.userId, remarks], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('记录收付款错误:', err);
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
                                message: '收款操作成功'
                            });
                        });
                    });
                });
            });
        });
    });
});

// 付款操作
router.post('/make-payment', authenticateToken, checkPermission(['admin', 'manager', 'staff']), (req, res) => {
    const { payable_id, amount, payment_method, payment_date, remarks = '' } = req.body;
    
    if (!payable_id || !amount || !payment_method || !payment_date) {
        return res.status(400).json({ 
            success: false, 
            message: '应付款ID、金额、支付方式和支付日期都是必需的' 
        });
    }
    
    // 开始事务
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // 获取应付款信息
        const getPayableQuery = 'SELECT * FROM payments_payables WHERE id = ?';
        
        db.get(getPayableQuery, [payable_id], (err, payable) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('获取应付款信息错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (!payable) {
                db.run('ROLLBACK');
                return res.status(404).json({ 
                    success: false, 
                    message: '应付款记录不存在' 
                });
            }
            
            if (payable.paid_amount + parseFloat(amount) > payable.amount) {
                db.run('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: '付款金额超过剩余应付款金额' 
                });
            }
            
            // 更新应付款记录
            const newPaidAmount = payable.paid_amount + parseFloat(amount);
            let newStatus = payable.status;
            
            if (newPaidAmount >= payable.amount) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partially_paid';
            }
            
            const updatePayableQuery = `
                UPDATE payments_payables 
                SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            db.run(updatePayableQuery, [newPaidAmount, newStatus, payable_id], (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('更新应付款记录错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                // 更新供应商余额
                const updateSupplierBalanceQuery = `
                    UPDATE suppliers 
                    SET balance = balance - ? 
                    WHERE id = ?
                `;
                
                db.run(updateSupplierBalanceQuery, [amount, payable.supplier_id], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('更新供应商余额错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
                    }
                    
                    // 记录收付款记录
                    const insertPaymentRecordQuery = `
                        INSERT INTO payment_records (payment_type, related_table, related_id, amount, payment_method, payment_date, operator_id, remarks)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    db.run(insertPaymentRecordQuery, ['pay', 'payments_payables', payable_id, amount, payment_method, payment_date, req.user.userId, remarks], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('记录收付款错误:', err);
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
                                message: '付款操作成功'
                            });
                        });
                    });
                });
            });
        });
    });
});

// 获取利润记录
router.get('/profit', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, startDate = '', endDate = '', modelId = null } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT pr.*, soi.quantity, m.model_name, b.name as brand_name, so.order_number as sales_order_number
        FROM profit_records pr
        LEFT JOIN sales_order_items soi ON pr.sales_order_item_id = soi.id
        LEFT JOIN models m ON soi.model_id = m.id
        LEFT JOIN brands b ON m.brand_id = b.id
        LEFT JOIN sales_orders so ON soi.sales_order_id = so.id
        WHERE 1=1
    `;
    const params = [];
    
    if (startDate) {
        query += ' AND pr.created_at >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND pr.created_at <= ?';
        params.push(endDate);
    }
    
    if (modelId) {
        query += ' AND m.id = ?';
        params.push(modelId);
    }
    
    query += ' ORDER BY pr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, profits) => {
        if (err) {
            console.error('查询利润记录错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM profit_records pr
            LEFT JOIN sales_order_items soi ON pr.sales_order_item_id = soi.id
            LEFT JOIN models m ON soi.model_id = m.id
            WHERE 1=1
        `;
        const countParams = [];
        
        if (startDate) {
            countQuery += ' AND pr.created_at >= ?';
            countParams.push(startDate);
        }
        
        if (endDate) {
            countQuery += ' AND pr.created_at <= ?';
            countParams.push(endDate);
        }
        
        if (modelId) {
            countQuery += ' AND m.id = ?';
            countParams.push(modelId);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询利润记录总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            // 计算汇总数据
            let totalRevenue = 0;
            let totalCost = 0;
            let totalProfit = 0;
            
            for (const profit of profits) {
                totalRevenue += parseFloat(profit.revenue || 0);
                totalCost += parseFloat(profit.cost || 0);
                totalProfit += parseFloat(profit.profit || 0);
            }
            
            res.json({
                success: true,
                data: {
                    list: profits,
                    summary: {
                        totalRevenue,
                        totalCost,
                        totalProfit
                    },
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

// 获取利润统计摘要
router.get('/profit-summary', authenticateToken, (req, res) => {
    const { startDate = '', endDate = '', modelId = null } = req.query;
    
    let query = `
        SELECT 
            SUM(revenue) as total_revenue,
            SUM(cost) as total_cost,
            SUM(profit) as total_profit,
            AVG(profit_margin) as avg_profit_margin
        FROM profit_records pr
        LEFT JOIN sales_order_items soi ON pr.sales_order_item_id = soi.id
        LEFT JOIN models m ON soi.model_id = m.id
        WHERE 1=1
    `;
    const params = [];
    
    if (startDate) {
        query += ' AND pr.created_at >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND pr.created_at <= ?';
        params.push(endDate);
    }
    
    if (modelId) {
        query += ' AND m.id = ?';
        params.push(modelId);
    }
    
    db.get(query, params, (err, summary) => {
        if (err) {
            console.error('查询利润统计摘要错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        res.json({
            success: true,
            data: {
                totalRevenue: parseFloat(summary.total_revenue || 0),
                totalCost: parseFloat(summary.total_cost || 0),
                totalProfit: parseFloat(summary.total_profit || 0),
                avgProfitMargin: parseFloat(summary.avg_profit_margin || 0)
            }
        });
    });
});

module.exports = router;