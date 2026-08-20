FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
COPY docs/context/example-app-ads.txt ./docs/context/example-app-ads.txt
RUN npm run build
ENV NODE_ENV=production
