# 移动库存系统前端部署到Vercel的配置指南

## 前提条件
- 已注册Vercel账户
- 已将代码推送到GitHub仓库

## 部署步骤

1. 登录Vercel (https://vercel.com)
2. 点击 "New Project"
3. 选择 "mobile-inventory-system" 仓库
4. 在配置页面设置以下选项：

### 构建设置
- Framework Preset: `Other`
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Development Command: `npm run dev`

### 环境变量
在Environment Variables部分添加：
- API_URL: `http://35.166.19.193:8081/api`

### 构建钩子
在Settings > Git Environment中添加：
- NODE_VERSION: `18.x`

## 重要注意事项

1. **后端API连接**：前端将会连接到 `http://35.166.19.193:8081/api` 获取数据
2. **跨域设置**：后端已经配置了CORS，允许来自Vercel域名的请求
3. **数据库**：所有数据都保存在当前服务器上，不会受到影响

## 验证部署

部署完成后：
1. 访问Vercel提供的URL
2. 尝试登录（用户名: admin, 密码: admin123）
3. 验证能否正常访问库存数据

## 故障排除

如果遇到连接问题：
1. 确认后端服务仍在运行：`/home/ubuntu/.openclaw/workspace/lib/node_modules/pm2/bin/pm2 list`
2. 确认防火墙设置允许外部访问
3. 检查API_URL环境变量是否正确设置

## 保持后端服务运行

当前服务器上的后端服务已使用PM2守护进程运行，会自动重启以防崩溃。