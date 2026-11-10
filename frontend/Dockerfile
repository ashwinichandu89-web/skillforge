# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY avast.crt* /etc/ssl/certs/
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/avast.crt
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
# Same-origin by default: nginx proxies /api to the backend. Set VITE_API_URL only for a separate API origin.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
