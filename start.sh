#!/bin/bash

# 手机进销存系统启动脚本（内存优化版）

echo "==================================="
echo "手机进销存系统启动脚本（内存优化版）"
echo "==================================="

# 检查后台服务是否已经在运行
if pgrep -f "node.*backend/server.js" > /dev/null; then
    echo "错误: 后端服务已经在运行"
    exit 1
fi

if pgrep -f "vite.*--host" > /dev/null; then
    echo "错误: 前端开发服务器已经在运行"
    exit 1
fi

# 检查可用内存
AVAILABLE_MEM=$(free | awk 'NR==2{printf "%.0f", $7/1024}')
if [ $AVAILABLE_MEM -lt 100 ]; then
    echo "警告: 可用内存不足 ($AVAILABLE_MEM MB)，可能导致启动失败"
    read -p "是否继续启动? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "启动后端服务（内存限制400MB）..."
cd backend
node --max-old-space-size=400 server.js > backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "等待后端服务启动..."
sleep 5

# 检查后端是否成功启动
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "错误: 后端服务启动失败，请检查 backend.log"
    exit 1
fi

echo "==================================="
echo "系统已启动!"
echo "==================================="
echo "后端服务 PID: $BACKEND_PID (日志: ../backend.log)"
echo ""
echo "访问地址:"
echo "  API: http://localhost:8081/api/..."
echo ""
echo "默认账户:"
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "要停止服务，请运行: pkill -f 'node.*server.js'"