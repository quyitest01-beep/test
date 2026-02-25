# 主API服务的Dockerfile
FROM node:20-alpine

# 安装必要的系统依赖
RUN apk add --no-cache wget curl

# 设置工作目录
WORKDIR /app

# 复制backend目录的package.json和package-lock.json
COPY backend/package*.json ./

# 安装依赖
RUN npm install --omit=dev && npm cache clean --force

# 复制backend目录的所有代码
COPY backend/ ./

# 创建必要的目录
RUN mkdir -p exports logs

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8000

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/health || exit 1

# 启动应用
CMD ["node", "server.js"]