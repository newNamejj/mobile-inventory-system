#!/bin/bash
# GitHub Setup Script for Mobile Inventory System

echo "==================================="
echo "Mobile Inventory System - GitHub Setup"
echo "==================================="

echo " "
echo "下一步操作说明:"
echo "1. 请在GitHub上创建一个新的仓库"
echo "2. 仓库名称建议: mobile-inventory-system"
echo "3. 不要初始化 README、.gitignore 或 license"
echo "4. 创建完成后，请返回此处继续操作"
echo " "

echo "请输入您的GitHub仓库URL (格式: https://github.com/username/repository-name.git):"
read REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "错误: 未提供仓库URL"
    exit 1
fi

echo " "
echo "正在将本地仓库连接到远程仓库: $REPO_URL"
git remote add origin $REPO_URL

echo " "
echo "正在推送代码到GitHub..."
git branch -M main
git push -u origin main

echo " "
echo "==================================="
echo "GitHub上传完成!"
echo "==================================="
echo " "
echo "仓库已成功上传到: $REPO_URL"
echo " "
echo "==================================="
echo "Vercel 部署说明"
echo "==================================="
echo "1. 访问 https://vercel.com 并登录"
echo "2. 点击 'New Project'"
echo "3. Import your Git repository (选择刚刚创建的仓库)"
echo "4. 在配置页面设置:"
echo "   - Framework Preset: Other Static Generate"
echo "   - Build Command: cd frontend && npm run build"
echo "   - Output Directory: frontend/dist"
echo "   - Root Directory: mobile_inventory_system"
echo "5. 点击 'Deploy' 完成部署"
echo " "
echo "注意: 如果您希望前后端分离部署，请参考 deployment_guide.md 文件"
echo " "