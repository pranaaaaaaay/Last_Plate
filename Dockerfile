FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV NODE_ENV=production
USER node
EXPOSE 8080
CMD ["node", "server.js"]
