# 主API服务的Dockerfile
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json
COPY backend/package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY backend/ .

# 暴露端口
EXPOSE 8000

# 启动应用
CMD ["npm", "start"]