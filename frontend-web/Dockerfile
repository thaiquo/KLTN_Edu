# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS build
WORKDIR /workspace

COPY frontend-web/package.json frontend-web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend-web/ ./

ARG VITE_API_GATEWAY_URL
ARG VITE_API_URL
ARG VITE_REALTIME_URL
ARG VITE_DEFAULT_CHAIN_ID=11155111
ARG VITE_ESCROW_CONTRACT_ADDRESS
ARG VITE_USDC_CONTRACT_ADDRESS
ARG VITE_SEPOLIA_RPC_URL
ARG VITE_PROJECT_ID_WALLETCONNECT

ENV VITE_API_GATEWAY_URL=${VITE_API_GATEWAY_URL} \
    VITE_API_URL=${VITE_API_URL} \
    VITE_REALTIME_URL=${VITE_REALTIME_URL} \
    VITE_DEFAULT_CHAIN_ID=${VITE_DEFAULT_CHAIN_ID} \
    VITE_ESCROW_CONTRACT_ADDRESS=${VITE_ESCROW_CONTRACT_ADDRESS} \
    VITE_USDC_CONTRACT_ADDRESS=${VITE_USDC_CONTRACT_ADDRESS} \
    VITE_SEPOLIA_RPC_URL=${VITE_SEPOLIA_RPC_URL} \
    VITE_PROJECT_ID_WALLETCONNECT=${VITE_PROJECT_ID_WALLETCONNECT}

RUN npm run build

FROM nginx:1.27-alpine
COPY frontend-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html
RUN chown -R nginx:nginx /var/cache/nginx /usr/share/nginx/html /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid
USER nginx
EXPOSE 8080
