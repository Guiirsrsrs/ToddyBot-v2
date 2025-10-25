# Use a versão LTS mais recente do Node.js (v20) baseada em Alpine
FROM node:20-alpine

# Instale as dependências do sistema necessárias para 'canvas' e outras libs
# Use apk (gerenciador de pacotes Alpine)
RUN apk update && apk add --no-cache \
    wait4ports \
    build-base \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
 && rm -rf /var/cache/apk/*

# Crie o diretório do aplicativo
WORKDIR /usr/src/app

# Copie package.json e package-lock.json (ou yarn.lock)
COPY package*.json ./
# Se você usar yarn, copie yarn.lock também:
# COPY yarn.lock ./

# Instale as dependências do Node.js
# Se você usa yarn: RUN yarn install --production
# Se você usa npm:
RUN npm install --omit=dev --legacy-peer-deps
# Use --omit=dev para pular dependências de desenvolvimento
# Use --legacy-peer-deps se houver conflitos de dependência de pares que você deseja ignorar temporariamente

# Cop