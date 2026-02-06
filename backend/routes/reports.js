const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 销售报表
router.get('/sales-report', authenticateToken, (req, res) => {
    const { startDate, endDate, customerId = null, modelId = null } = req.query;
    
    let query = `
        SELECT 
            so.order_number,
            so.total_amount,
            so.discount,
            so.final_amount,
            so.created_at,
            c.name as customer_name,
            u.username as creator_name,
            GROUP_CONCAT(m.model_name || ' x ' || soi.quantity) as items
        FROM sales_orders so
        LEFT JOIN customers c ON so.customer_id = c.id
        LEFT JOIN users u ON so.created_by = u.id
        LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id
        LEFT JOIN models m ON soi.model_id = m.id
        WHERE so.status = 'completed'
    `;
    
    const params = [];
    
    if (startDate) {
        query += ' AND so.created_at >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND so.created_at <= ?';
        params.push(endDate);
    }
    
    if (customerId) {
        query += ' AND so.customer_id = ?';
        params.push(customerId);
    }
    
    if (modelId) {
        query += ' AND soi.model_id = ?';
        params.push(modelId);
    }
    
    query += ' GROUP BY so.id ORDER BY so.created_at DESC';
    
    db.all(query, params, (err, sales) => {
        if (err) {
            console.error('查询销售报表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 计算汇总数据
        let totalAmount = 0;
        let totalCount = sales.length;
        
        for (const sale of sales) {
            totalAmount += parseFloat(sale.final_amount || 0);
        }
        
        res.json({
            success: true,
            data: {
                list: sales,
                summary: {
                    totalAmount,
                    totalCount
                }
            }
        });
    });
});

// 采购报表
router.get('/purchase-report', authenticateToken, (req, res) => {
    const { startDate, endDate, supplierId = null, modelId = null } = req.query;
    
    let query = `
        SELECT 
            po.order_number,
            po.total_amount,
            po.created_at,
            s.name as supplier_name,
            u.username as creator_name,
            GROUP_CONCAT(m.model_name || ' x ' || poi.quantity) as items
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u ON po.created_by = u.id
        LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
        LEFT JOIN models m ON poi.model_id = m.id
        WHERE po.status = 'completed'
    `;
    
    const params = [];
    
    if (startDate) {
        query += ' AND po.created_at >= ?';
        params.push(startDate);
    }
    
    if (endDate) {
        query += ' AND po.created_at <= ?';
        params.push(endDate);
    }
    
    if (supplierId) {
        query += ' AND po.supplier_id = ?';
        params.push(supplierId);
    }
    
    if (modelId) {
        query += ' AND poi.model_id = ?';
        params.push(modelId);
    }
    
    query += ' GROUP BY po.id ORDER BY po.created_at DESC';
    
    db.all(query, params, (err, purchases) => {
        if (err) {
            console.error('查询采购报表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 计算汇总数据
        let totalAmount = 0;
        let totalCount = purchases.length;
        
        for (const purchase of purchases) {
            totalAmount += parseFloat(purchase.total_amount || 0);
        }
        
        res.json({
            success: true,
            data: {
                list: purchases,
                summary: {
                    totalAmount,
                    totalCount
                }
            }
        });
    });
});

// 库存报表
router.get('/inventory-report', authenticateToken, (req, res) => {
    const { lowStockOnly = false, modelId = null, brandId = null } = req.query;
    
    let query = `
        SELECT 
            i.*,
            m.model_name,
            b.name as brand_name,
            m.purchase_price,
            m.retail_price,
            (i.quantity * m.purchase_price) as total_cost_value,
            (i.quantity * m.retail_price) as total_retail_value
        FROM inventory i
        LEFT JOIN models m ON i.model_id = m.id
        LEFT JOIN brands b ON m.brand_id = b.id
        WHERE 1=1
    `;
    
    const params = [];
    
    if (lowStockOnly === 'true' || lowStockOnly === true) {
        query += ' AND i.available_quantity <= i.min_stock_level AND i.min_stock_level > 0';
    }
    
    if (modelId) {
        query += ' AND i.model_id = ?';
        params.push(modelId);
    }
    
    if (brandId) {
        query += ' AND m.brand_id = ?';
        params.push(brandId);
    }
    
    query += ' ORDER BY i.last_updated DESC';
    
    db.all(query, params, (err, inventory) => {
        if (err) {
            console.error('查询库存报表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 计算汇总数据
        let totalQuantity = 0;
        let totalAvailable = 0;
        let totalCostValue = 0;
        let totalRetailValue = 0;
        let lowStockCount = 0;
        
        for (const item of inventory) {
            totalQuantity += parseInt(item.quantity || 0);
            totalAvailable += parseInt(item.available_quantity || 0);
            totalCostValue += parseFloat(item.total_cost_value || 0);
            totalRetailValue += parseFloat(item.total_retail_value || 0);
            
            if (item.available_quantity <= item.min_stock_level && item.min_stock_level > 0) {
                lowStockCount++;
            }
        }
        
        res.json({
            success: true,
            data: {
                list: inventory,
                summary: {
                    totalQuantity,
                    totalAvailable,
                    totalCostValue,
                    totalRetailValue,
                    lowStockCount,
                    totalCount: inventory.length
                }
            }
        });
    });
});

// 利润报表
router.get('/profit-report', authenticateToken, (req, res) => {
    const { startDate, endDate, modelId = null, brandId = null } = req.query;
    
    let query = `
        SELECT 
            pr.*,
            m.model_name,
            b.name as brand_name,
            so.order_number as sales_order_number,
            so.created_at as sales_date
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
    
    if (brandId) {
        query += ' AND b.id = ?';
        params.push(brandId);
    }
    
    query += ' ORDER BY pr.created_at DESC';
    
    db.all(query, params, (err, profits) => {
        if (err) {
            console.error('查询利润报表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 计算汇总数据
        let totalRevenue = 0;
        let totalCost = 0;
        let totalProfit = 0;
        let avgProfitMargin = 0;
        
        for (const profit of profits) {
            totalRevenue += parseFloat(profit.revenue || 0);
            totalCost += parseFloat(profit.cost || 0);
            totalProfit += parseFloat(profit.profit || 0);
        }
        
        if (profits.length > 0) {
            avgProfitMargin = totalProfit / totalRevenue * 100;
        }
        
        res.json({
            success: true,
            data: {
                list: profits,
                summary: {
                    totalRevenue,
                    totalCost,
                    totalProfit,
                    avgProfitMargin: parseFloat(avgProfitMargin.toFixed(2)),
                    totalCount: profits.length
                }
            }
        });
    });
});

// 应收应付款报表
router.get('/receivable-payable-report', authenticateToken, (req, res) => {
    const { type = 'all', startDate, endDate } = req.query; // type: receivable, payable, all
    
    const reportData = {};
    
    // 查询应收账款
    if (type === 'receivable' || type === 'all') {
        let receivableQuery = `
            SELECT 
                pr.*,
                c.name as customer_name,
                c.phone as customer_phone,
                c.email as customer_email
            FROM payments_receivables pr
            LEFT JOIN customers c ON pr.customer_id = c.id
            WHERE pr.status != 'paid'
        `;
        
        const receivableParams = [];
        
        if (startDate) {
            receivableQuery += ' AND pr.created_at >= ?';
            receivableParams.push(startDate);
        }
        
        if (endDate) {
            receivableQuery += ' AND pr.created_at <= ?';
            receivableParams.push(endDate);
        }
        
        receivableQuery += ' ORDER BY pr.created_at DESC';
        
        db.all(receivableQuery, receivableParams, (err, receivables) => {
            if (err) {
                console.error('查询应收账款报表错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            // 计算应收账款汇总
            let totalReceivable = 0;
            let totalReceived = 0;
            let totalUnreceived = 0;
            
            for (const receivable of receivables) {
                totalReceivable += parseFloat(receivable.amount || 0);
                totalReceived += parseFloat(receivable.paid_amount || 0);
                totalUnreceived += (parseFloat(receivable.amount || 0) - parseFloat(receivable.paid_amount || 0));
            }
            
            reportData.receivables = {
                list: receivables,
                summary: {
                    totalReceivable,
                    totalReceived,
                    totalUnreceived,
                    totalCount: receivables.length
                }
            };
            
            // 如果只查询应收账款，直接返回
            if (type === 'receivable') {
                return res.json({
                    success: true,
                    data: reportData
                });
            }
        });
    }
    
    // 查询应付账款
    if (type === 'payable' || type === 'all') {
        let payableQuery = `
            SELECT 
                pp.*,
                s.name as supplier_name,
                s.phone as supplier_phone,
                s.email as supplier_email
            FROM payments_payables pp
            LEFT JOIN suppliers s ON pp.supplier_id = s.id
            WHERE pp.status != 'paid'
        `;
        
        const payableParams = [];
        
        if (startDate) {
            payableQuery += ' AND pp.created_at >= ?';
            payableParams.push(startDate);
        }
        
        if (endDate) {
            payableQuery += ' AND pp.created_at <= ?';
            payableParams.push(endDate);
        }
        
        payableQuery += ' ORDER BY pp.created_at DESC';
        
        db.all(payableQuery, payableParams, (err, payables) => {
            if (err) {
                console.error('查询应付账款报表错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            // 计算应付账款汇总
            let totalPayable = 0;
            let totalPaid = 0;
            let totalUnpaid = 0;
            
            for (const payable of payables) {
                totalPayable += parseFloat(payable.amount || 0);
                totalPaid += parseFloat(payable.paid_amount || 0);
                totalUnpaid += (parseFloat(payable.amount || 0) - parseFloat(payable.paid_amount || 0));
            }
            
            reportData.payables = {
                list: payables,
                summary: {
                    totalPayable,
                    totalPaid,
                    totalUnpaid,
                    totalCount: payables.length
                }
            };
            
            // 返回最终结果
            res.json({
                success: true,
                data: reportData
            });
        });
    }
});

module.exports = router;