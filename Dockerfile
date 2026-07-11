FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npx prisma generate

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts/start-app.sh ./scripts/start-app.sh

RUN chmod +x ./scripts/start-app.sh

EXPOSE 3000

CMD ["sh", "./scripts/start-app.sh"]

FROM builder AS seed

WORKDIR /app

COPY --from=builder /app/scripts/run-demo-seed.sh ./scripts/run-demo-seed.sh

RUN chmod +x ./scripts/run-demo-seed.sh

ENTRYPOINT ["sh", "./scripts/run-demo-seed.sh"]
