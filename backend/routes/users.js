const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 获取用户列表（需要管理员权限）
router.get('/', authenticateToken, checkPermission(['admin']), (req, res) => {
    const { page = 1, limit = 10, keyword = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, username, email, phone, role, status, created_at FROM users WHERE 1=1';
    const params = [];
    
    if (keyword) {
        query += ' AND (username LIKE ? OR email LIKE ? OR phone LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam, searchParam);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, users) => {
        if (err) {
            console.error('查询用户列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (username LIKE ? OR email LIKE ? OR phone LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam, searchParam);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询用户总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: users,
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

// 获取单个用户信息
router.get('/:id', authenticateToken, (req, res) => {
    const userId = req.params.id;
    
    // 普通员工只能查看自己的信息，管理员可以查看任意用户
    if (req.user.role !== 'admin' && parseInt(userId) !== req.user.userId) {
        return res.status(403).json({ 
            success: false, 
            message: '没有权限访问该用户信息' 
        });
    }
    
    const query = 'SELECT id, username, email, phone, role, status, created_at, updated_at FROM users WHERE id = ?';
    
    db.get(query, [userId], (err, user) => {
        if (err) {
            console.error('查询用户错误:', err);
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

// 创建新用户（需要管理员权限）
router.post('/', authenticateToken, checkPermission(['admin']), (req, res) => {
    const { username, password, email, phone, role = 'staff' } = req.body;
    
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
            console.error('检查用户名错误:', err);
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
            
            db.run(insertQuery, [username, hashedPassword, email, phone, role], function(err) {
                if (err) {
                    console.error('插入用户错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                res.json({
                    success: true,
                    message: '用户创建成功',
                    data: { id: this.lastID }
                });
            });
        });
    });
});

// 更新用户信息（需要管理员权限或本人）
router.put('/:id', authenticateToken, (req, res) => {
    const userId = req.params.id;
    
    // 检查权限：管理员或本人
    if (req.user.role !== 'admin' && parseInt(userId) !== req.user.userId) {
        return res.status(403).json({ 
            success: false, 
            message: '没有权限更新该用户信息' 
        });
    }
    
    const { email, phone, role } = req.body;
    
    // 管理员可以更新角色，普通用户不能更改角色
    let updateFields = [];
    let params = [];
    
    if (email !== undefined) {
        updateFields.push('email = ?');
        params.push(email);
    }
    
    if (phone !== undefined) {
        updateFields.push('phone = ?');
        params.push(phone);
    }
    
    // 只有管理员可以更新角色
    if (req.user.role === 'admin' && role !== undefined) {
        if (!['admin', 'manager', 'staff'].includes(role)) {
            return res.status(400).json({ 
                success: false, 
                message: '无效的角色' 
            });
        }
        updateFields.push('role = ?');
        params.push(role);
    }
    
    if (updateFields.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: '没有提供需要更新的字段' 
        });
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);
    
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    
    db.run(query, params, function(err) {
        if (err) {
            console.error('更新用户错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }
        
        res.json({
            success: true,
            message: '用户信息更新成功'
        });
    });
});

// 修改用户密码（需要管理员权限或本人）
router.put('/:id/password', authenticateToken, (req, res) => {
    const userId = req.params.id;
    const { newPassword } = req.body;
    
    if (!newPassword) {
        return res.status(400).json({ 
            success: false, 
            message: '新密码不能为空' 
        });
    }
    
    // 检查权限：管理员或本人
    if (req.user.role !== 'admin' && parseInt(userId) !== req.user.userId) {
        return res.status(403).json({ 
            success: false, 
            message: '没有权限修改该用户密码' 
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
        
        db.run(updateQuery, [hashedNewPassword, userId], function(err) {
            if (err) {
                console.error('更新密码错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '用户不存在' 
                });
            }
            
            res.json({
                success: true,
                message: '密码修改成功'
            });
        });
    });
});

// 删除用户（需要管理员权限）
router.delete('/:id', authenticateToken, checkPermission(['admin']), (req, res) => {
    const userId = req.params.id;
    
    // 不能删除自己
    if (parseInt(userId) === req.user.userId) {
        return res.status(400).json({ 
            success: false, 
            message: '不能删除自己的账户' 
        });
    }
    
    // 检查用户是否存在
    const checkQuery = 'SELECT role FROM users WHERE id = ?';
    
    db.get(checkQuery, [userId], (err, user) => {
        if (err) {
            console.error('检查用户错误:', err);
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
        
        // 不允许删除管理员（除非是超级管理员操作）
        if (user.role === 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ 
                success: false, 
                message: '没有权限删除管理员账户' 
            });
        }
        
        const deleteQuery = 'DELETE FROM users WHERE id = ?';
        
        db.run(deleteQuery, [userId], function(err) {
            if (err) {
                console.error('删除用户错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '用户不存在' 
                });
            }
            
            res.json({
                success: true,
                message: '用户删除成功'
            });
        });
    });
});

// 启用/禁用用户（需要管理员权限）
router.put('/:id/status', authenticateToken, checkPermission(['admin']), (req, res) => {
    const userId = req.params.id;
    const { status } = req.body;
    
    if (status === undefined) {
        return res.status(400).json({ 
            success: false, 
            message: '状态值不能为空' 
        });
    }
    
    if (status !== 0 && status !== 1) {
        return res.status(400).json({ 
            success: false, 
            message: '状态值必须是0或1' 
        });
    }
    
    // 不能禁用自己的账户
    if (parseInt(userId) === req.user.userId) {
        return res.status(400).json({ 
            success: false, 
            message: '不能禁用自己的账户' 
        });
    }
    
    const updateQuery = 'UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    db.run(updateQuery, [status, userId], function(err) {
        if (err) {
            console.error('更新用户状态错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }
        
        res.json({
            success: true,
            message: status ? '用户启用成功' : '用户禁用成功'
        });
    });
});

module.exports = router;