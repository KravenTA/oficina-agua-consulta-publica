# --- Etapa 1: dependencias (se reutiliza mientras no cambie package-lock.json) ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Etapa 2: compilar ---
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Etapa 3: imagen final, solo con lo necesario para ejecutar ---
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
# Reemplaza X-Forwarded-For por la IP real de la conexion (ver el comentario dentro del archivo).
COPY --from=build --chown=app:app /app/ip-del-socket.cjs ./ip-del-socket.cjs
USER app
EXPOSE 3000
CMD ["node", "--require", "./ip-del-socket.cjs", "server.js"]
