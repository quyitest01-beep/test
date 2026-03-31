# PDF服务的Dockerfile
FROM node:18-alpine

# 安装Chrome依赖
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 设置Chrome路径
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 设置工作目录
WORKDIR /app

# 复制所有文件
COPY . .

# 安装依赖
RUN npm install --omit=dev

# 暴露端口
EXPOSE 8787

# 启动应用
CMD ["node", "server.js"]