const jwt = require('jsonwebtoken');
const db = require('../database/db').db;

// 验证令牌中间件
const authenticateToken = (req, res, next) => {
    // 尝试从多个可能的位置获取认证头部
    let authHeader = req.headers['authorization'] || 
                    req.headers['Authorization'] || 
                    req.headers['HTTP_AUTHORIZATION'] ||
                    req.headers['http_authorization'] ||
                    req.headers['X-Original-Auth'];
    
    // 检查是否为数组，如果是取第一个值
    if (Array.isArray(authHeader)) {
        authHeader = authHeader[0];
    }
    
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        console.log('DEBUG: No auth header found. All headers:', req.headers);
        return res.status(401).json({ 
            success: false, 
            message: '访问被拒绝，缺少令牌' 
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'default_secret_key_for_development', (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                message: '令牌无效' 
            });
        }
        
        req.user = user;
        next();
    });
};

// 权限检查中间件
const checkPermission = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ 
                success: false, 
                message: '未授权访问' 
            });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: '没有权限执行此操作' 
            });
        }
        
        next();
    };
};

// 检查是否为管理员
const isAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: '需要管理员权限' 
        });
    }
    
    next();
};

// 检查是否为特定用户或管理员
const isOwnerOrAdmin = (req, res, next) => {
    const requestedId = parseInt(req.params.id) || parseInt(req.body.id);
    const currentUserId = req.user.userId;
    
    if (currentUserId !== requestedId && req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: '只能访问自己的资源或需要管理员权限' 
        });
    }
    
    next();
};

module.exports = {
    authenticateToken,
    checkPermission,
    isAdmin,
    isOwnerOrAdmin
};