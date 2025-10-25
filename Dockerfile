# Usar a tag LTS mais recente do Node 16
FROM node:16-bullseye

RUN apt-get update && apt-get install -y \
    netcat-openbsd \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

# --- NOVO PASSO ---
# Garante que qualquer node_modules antigo seja removido
RUN rm -rf node_modules
# ------------------

RUN npm install

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["node", "bot.js"]