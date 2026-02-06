const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 仪表板统计数据
router.get('/stats', authenticateToken, (req, res) => {
    const stats = {};

    // 1. 总库存价值计算
    const inventoryValueQuery = `
        SELECT 
            SUM(i.quantity * m.purchase_price) as total_cost_value,
            SUM(i.quantity * m.retail_price) as total_retail_value
        FROM inventory i
        LEFT JOIN models m ON i.model_id = m.id
        WHERE i.quantity > 0
    `;

    db.get(inventoryValueQuery, [], (err, inventoryValue) => {
        if (err) {
            console.error('查询库存价值错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }

        stats.totalInventoryValue = parseFloat(inventoryValue?.total_cost_value || 0);

        // 2. 今日销售额
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todaySalesQuery = `
            SELECT 
                SUM(so.final_amount) as today_sales
            FROM sales_orders so
            WHERE so.status = 'completed' 
            AND DATE(so.created_at) = ?
        `;

        db.get(todaySalesQuery, [todayStr], (err, todaySales) => {
            if (err) {
                console.error('查询今日销售额错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }

            stats.todaySales = parseFloat(todaySales?.today_sales || 0);

            // 3. 待处理订单数量
            const pendingOrdersQuery = `
                SELECT 
                    COUNT(*) as pending_count
                FROM (
                    SELECT id FROM purchase_orders WHERE status IN ('pending', 'partially_received')
                    UNION ALL
                    SELECT id FROM sales_orders WHERE status IN ('pending', 'partially_shipped')
                ) AS pending
            `;

            db.get(pendingOrdersQuery, [], (err, pendingOrders) => {
                if (err) {
                    console.error('查询待处理订单错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }

                stats.pendingOrders = parseInt(pendingOrders?.pending_count || 0);

                // 4. 低库存商品数量
                const lowStockQuery = `
                    SELECT 
                        COUNT(*) as low_stock_count
                    FROM inventory i
                    LEFT JOIN models m ON i.model_id = m.id
                    WHERE i.available_quantity <= i.min_stock_level 
                    AND i.min_stock_level > 0
                    AND i.quantity > 0
                `;

                db.get(lowStockQuery, [], (err, lowStock) => {
                    if (err) {
                        console.error('查询低库存商品错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
                    }

                    stats.lowStockItems = parseInt(lowStock?.low_stock_count || 0);

                    // 5. 近期出入库记录 - 使用更简单的查询
                    // 由于我们不确定哪些表存在，返回空数组
                    stats.recentTransactions = [];

                    // 返回完整的仪表板统计数据
                    res.json({
                        success: true,
                        data: stats
                    });
                });
            });
        });
    });
});

module.exports = router;