const express = require('express');
const db = require('../database/db').db;
const authenticateToken = require('../middleware/auth').authenticateToken;
const checkPermission = require('../middleware/auth').checkPermission;

const router = express.Router();

// 获取品牌列表
router.get('/', authenticateToken, (req, res) => {
    const { page = 1, limit = 10, keyword = '' } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, name, description, created_at, updated_at FROM brands WHERE 1=1';
    const params = [];
    
    if (keyword) {
        query += ' AND (name LIKE ? OR description LIKE ?)';
        const searchParam = `%${keyword}%`;
        params.push(searchParam, searchParam);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, brands) => {
        if (err) {
            console.error('查询品牌列表错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        // 查询总数用于分页
        let countQuery = 'SELECT COUNT(*) as total FROM brands WHERE 1=1';
        const countParams = [];
        
        if (keyword) {
            countQuery += ' AND (name LIKE ? OR description LIKE ?)';
            const searchParam = `%${keyword}%`;
            countParams.push(searchParam, searchParam);
        }
        
        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('查询品牌总数错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                data: {
                    list: brands,
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

// 获取单个品牌
router.get('/:id', authenticateToken, (req, res) => {
    const brandId = req.params.id;
    
    const query = 'SELECT id, name, description, created_at, updated_at FROM brands WHERE id = ?';
    
    db.get(query, [brandId], (err, brand) => {
        if (err) {
            console.error('查询品牌错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!brand) {
            return res.status(404).json({ 
                success: false, 
                message: '品牌不存在' 
            });
        }
        
        res.json({
            success: true,
            data: brand
        });
    });
});

// 创建品牌
router.post('/', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const { name, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ 
            success: false, 
            message: '品牌名称不能为空' 
        });
    }
    
    // 检查品牌名称是否已存在
    const checkQuery = 'SELECT id FROM brands WHERE name = ?';
    
    db.get(checkQuery, [name], (err, existingBrand) => {
        if (err) {
            console.error('检查品牌名称错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (existingBrand) {
            return res.status(400).json({ 
                success: false, 
                message: '品牌名称已存在' 
            });
        }
        
        // 插入新品牌
        const insertQuery = `
            INSERT INTO brands (name, description)
            VALUES (?, ?)
        `;
        
        db.run(insertQuery, [name, description], function(err) {
            if (err) {
                console.error('插入品牌错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            res.json({
                success: true,
                message: '品牌创建成功',
                data: { id: this.lastID }
            });
        });
    });
});

// 更新品牌
router.put('/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const brandId = req.params.id;
    const { name, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ 
            success: false, 
            message: '品牌名称不能为空' 
        });
    }
    
    // 检查品牌名称是否已被其他品牌使用
    const checkQuery = 'SELECT id FROM brands WHERE name = ? AND id != ?';
    
    db.get(checkQuery, [name, brandId], (err, existingBrand) => {
        if (err) {
            console.error('检查品牌名称错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (existingBrand) {
            return res.status(400).json({ 
                success: false, 
                message: '品牌名称已存在' 
            });
        }
        
        const updateQuery = `
            UPDATE brands 
            SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        db.run(updateQuery, [name, description, brandId], function(err) {
            if (err) {
                console.error('更新品牌错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: '品牌不存在' 
                });
            }
            
            res.json({
                success: true,
                message: '品牌更新成功'
            });
        });
    });
});

// 删除品牌
router.delete('/:id', authenticateToken, checkPermission(['admin', 'manager']), (req, res) => {
    const brandId = req.params.id;
    
    // 检查品牌是否存在
    const checkQuery = 'SELECT id FROM brands WHERE id = ?';
    
    db.get(checkQuery, [brandId], (err, brand) => {
        if (err) {
            console.error('检查品牌错误:', err);
            return res.status(500).json({ 
                success: false, 
                message: '服务器错误' 
            });
        }
        
        if (!brand) {
            return res.status(404).json({ 
                success: false, 
                message: '品牌不存在' 
            });
        }
        
        // 检查是否有手机型号关联此品牌
        const checkModelsQuery = 'SELECT COUNT(*) as count FROM models WHERE brand_id = ?';
        
        db.get(checkModelsQuery, [brandId], (err, result) => {
            if (err) {
                console.error('检查关联型号错误:', err);
                return res.status(500).json({ 
                    success: false, 
                    message: '服务器错误' 
                });
            }
            
            if (result.count > 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: '无法删除品牌，有手机型号正在使用此品牌' 
                });
            }
            
            // 删除品牌
            const deleteQuery = 'DELETE FROM brands WHERE id = ?';
            
            db.run(deleteQuery, [brandId], function(err) {
                if (err) {
                    console.error('删除品牌错误:', err);
                    return res.status(500).json({ 
                        success: false, 
                        message: '服务器错误' 
                    });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ 
                        success: false, 
                        message: '品牌不存在' 
                    });
                }
                
                res.json({
                    success: true,
                    message: '品牌删除成功'
                });
            });
        });
    });
});

module.exports = router;