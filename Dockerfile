# 使用官方Node运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json(如果存在)
COPY package*.json ./

# 安装项目依赖
RUN npm ci --only=production

# 复制所有源代码到工作目录
COPY . .

# 在生产环境中构建前端
RUN cd frontend && npm ci && npm run build

# 暴露应用运行的端口
EXPOSE 8080 8081

# 启动应用
CMD ["npm", "start"]