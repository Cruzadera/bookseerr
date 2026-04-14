FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY src ./src
COPY web ./web

RUN mkdir -p /data

EXPOSE 3000

CMD ["node", "src/server.js"]
