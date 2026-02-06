const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db').db;
const router = express.Router();

// 登录
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: '用户名和密码不能为空' 
        });
    }
    
    const query = 'SELECT * FROM users WHERE username = ? AND status = 1';
    
    db.get(query, [username], (err, user) => {
        if (err) {
            console.error('数据库查询错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: '用户名或密码错误' 
            });
        }
        
        // 验证密码
        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
            if (err) {
                console.error('密码验证错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (!isMatch) {
                return res.status(401).json({ 
                    success: false, 
                    message: '用户名或密码错误' 
                });
            }
            
            // 生成JWT令牌
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    username: user.username, 
                    role: user.role 
                },
                process.env.JWT_SECRET || 'default_secret_key_for_development',
                { expiresIn: '24h' }
            );
            
            res.json({
                success: true,
                message: '登录成功',
                data: {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        email: user.email,
                        phone: user.phone
                    }
                }
            });
        });
    });
});

// 注册新用户（仅限管理员）
router.post('/register', (req, res) => {
    const { username, password, email, phone, role } = req.body;
    
    // TODO: 验证管理员权限
    
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: '用户名和密码不能为空' 
        });
    }
    
    // 检查用户名是否已存在
    const checkQuery = 'SELECT id FROM users WHERE username = ?';
    
    db.get(checkQuery, [username], (err, existingUser) => {
        if (err) {
            console.error('数据库查询错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: '用户名已存在' 
            });
        }
        
        // 加密密码
        const saltRounds = 10;
        bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
            if (err) {
                console.error('密码加密错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            // 插入新用户
            const insertQuery = `
                INSERT INTO users (username, password_hash, email, phone, role)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            db.run(insertQuery, [username, hashedPassword, email, phone, role || 'staff'], function(err) {
                if (err) {
                    console.error('插入用户错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                res.json({
                    success: true,
                    message: '用户注册成功',
                    data: { id: this.lastID }
                });
            });
        });
    });
});

// 验证令牌中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
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

// 获取当前用户信息
router.get('/me', authenticateToken, (req, res) => {
    const query = 'SELECT id, username, email, phone, role FROM users WHERE id = ?';
    
    db.get(query, [req.user.userId], (err, user) => {
        if (err) {
            console.error('数据库查询错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }
        
        res.json({
            success: true,
            data: user
        });
    });
});

// 修改密码
router.put('/change-password', authenticateToken, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ 
            success: false, 
            message: '旧密码和新密码不能为空' 
        });
    }
    
    // 获取当前用户的密码哈希
    const getUserQuery = 'SELECT password_hash FROM users WHERE id = ?';
    
    db.get(getUserQuery, [req.user.userId], (err, user) => {
        if (err) {
            console.error('数据库查询错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }
        
        // 验证旧密码
        bcrypt.compare(oldPassword, user.password_hash, (err, isMatch) => {
            if (err) {
                console.error('密码验证错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (!isMatch) {
                return res.status(400).json({ 
                    success: false, 
                    message: '旧密码不正确' 
                });
            }
            
            // 加密新密码
            const saltRounds = 10;
            bcrypt.hash(newPassword, saltRounds, (err, hashedNewPassword) => {
                if (err) {
                    console.error('密码加密错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                // 更新密码
                const updateQuery = 'UPDATE users SET password_hash = ? WHERE id = ?';
                
                db.run(updateQuery, [hashedNewPassword, req.user.userId], function(err) {
                    if (err) {
                        console.error('更新密码错误:', err);
                        return res.status(500).json({ 
                            success: false, 
                            message: '服务器错误' 
                        });
                    }
                    
                    res.json({
                        success: true,
                        message: '密码修改成功'
                    });
                });
            });
        });
    });
});

module.exports = router;