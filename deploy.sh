#!/bin/bash

# 手机进销存系统部署脚本

set -e

echo "==================================="
echo "手机进销存系统部署脚本"
echo "==================================="

# 检查是否已安装 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 Node.js 版本
NODE_VERSION=$(node -v | cut -d'v' -f2)
if [ "$(printf '%s\n' "$NODE_VERSION" "14.0.0" | sort -V | head -n1)" != "14.0.0" ]; then
    echo "警告: 建议使用 Node.js 14.0.0 或更高版本"
fi

echo "Node.js 版本: $NODE_VERSION"

# 检查是否已安装 npm
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm，请先安装 npm"
    exit 1
fi

echo "开始部署手机进销存系统..."

# 安装后端依赖
echo "安装后端依赖..."
cd backend
npm install
echo "后端依赖安装完成"

# 返回主目录
cd ..

# 检查前端目录并安装前端依赖
if [ -d "frontend" ]; then
    echo "安装前端依赖..."
    cd frontend
    npm install
    echo "前端依赖安装完成"
    
    # 构建前端
    echo "构建前端项目..."
    npm run build
    echo "前端构建完成"
    
    # 返回主目录
    cd ..
fi

echo "==================================="
echo "系统部署完成!"
echo "==================================="
echo ""
echo "启动后端服务:"
echo "  cd mobile_inventory_system && node backend/server.js"
echo ""
echo "启动前端开发服务器:"
echo "  cd mobile_inventory_system/frontend && npx vite --host 0.0.0.0 --port 8080"
echo ""
echo "默认账户信息:"
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "API 服务地址: http://localhost:8081"
echo "前端访问地址: http://localhost:8080"