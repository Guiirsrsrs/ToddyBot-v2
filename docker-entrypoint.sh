#!/bin/sh

# Seta o "environment" do Knex com base na variável NODE_ENV (se existir)
# ou usa "development" como padrão
KNEX_ENV=${NODE_ENV:-development}

echo "Aguardando o banco de dados ($DB_HOST:$DB_PORT)..."

# Loop simples para esperar o Postgres acordar
# (Isso é mais robusto do que 'depends_on' sozinho)
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done

echo "Banco de dados está online. Rodando migrações..."

# Roda as migrações do Knex
npx knex migrate:latest --knexfile knexfile.js --env $KNEX_ENV

if [ $? -eq 0 ]; then
  echo "Migrações concluídas com sucesso."
  # Se as migrações funcionarem, executa o comando principal do Docker (CMD)
  # que é 'node bot.js'
  exec "$@"
else
  echo "Falha ao rodar as migrações!"
  exit 1
fi