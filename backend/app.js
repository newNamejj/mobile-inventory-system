require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { db, initDatabase } = require('./database/db');

// 初始化数据库
initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/static', express.static('../static'));
app.use('/uploads', express.static('../uploads'));
// 提供前端静态文件
app.use(express.static('../../frontend/dist'));

// API路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/brands', require('./routes/brands'));
app.use('/api/models', require('./routes/models'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/rebates', require('./routes/rebates'));
app.use('/api/dashboard', require('./routes/dashboard'));

// 根路径返回前端页面
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '../frontend/dist/index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error sending index.html:', err);
            res.status(500).send('Internal Server Error');
        }
    });
});

// 处理前端路由 (用于SPA)
app.get(/^(?!\/api\/).*$/, (req, res) => {
    // 只有非API请求才返回前端index.html
    const indexPath = path.join(__dirname, '../frontend/dist/index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error sending index.html for route', req.path, ':', err);
            res.status(500).send('Internal Server Error');
        }
    });
});

module.exports = app;