# 部署说明

## 部署到 GitHub

1. 将整个项目推送到 GitHub 仓库
2. 前端部分可以通过 Vercel 部署
3. 后端 API 需要单独部署到支持 Node.js 的平台（如 Heroku, Railway, DigitalOcean 等）

## 部署到 Vercel (前端部分)

### 步骤 1: 部署后端 API
首先，您需要将后端 API 部署到支持 Node.js 的平台上，例如：
- Heroku
- Railway
- Render
- DigitalOcean App Platform

记下后端 API 的 URL，例如：`https://your-backend-app.herokuapp.com`

### 步骤 2: 配置前端
修改前端的 API 请求地址，更新 `frontend/src/utils/request.js` 或相应文件中的基础 URL：

```javascript
const baseURL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-app.herokuapp.com'  // 替换为您的后端 URL
  : 'http://localhost:8081';
```

### 步骤 3: 部署前端到 Vercel
1. 登录 Vercel 并连接您的 GitHub 仓库
2. 在设置中指定构建命令和输出目录：
   - Build Command: `cd frontend && npm run build`
   - Output Directory: `frontend/dist`
   - Root Directory: `mobile_inventory_system`

### Vercel 配置 (vercel.json)
```json
{
  "version": 2,
  "name": "mobile-inventory-frontend",
  "public": true,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "frontend/dist/$1"
    }
  ]
}
```

## 环境变量
如果需要，可以在 Vercel 项目设置中添加环境变量：
- VITE_API_URL: 后端 API 的 URL

## 自动化部署
当您将代码推送到主分支时，Vercel 将自动构建和部署您的应用。