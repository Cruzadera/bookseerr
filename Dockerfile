FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY locales ./locales
COPY frontend ./frontend

RUN npm run build


FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY locales ./locales
COPY --from=builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "src/server.js"]
