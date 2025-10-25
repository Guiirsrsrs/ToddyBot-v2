/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Tabela para o jogo LUCKYCARD
  await knex.schema.createTable('luckycard', (table) => {
    table.string('user_id', 20).primary().references('user_id').inTable('players').onDelete('CASCADE');
    table.jsonb('cards').defaultTo('[]'); // Armazena as cartas do jogador
  });

  // 2. Adiciona a coluna 'donation' na tabela 'globals'
  await knex.schema.alterTable('globals', (table) => {
    table.jsonb('donation'); // Armazena dados do evento de doação
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('globals', (table) => {
    table.dropColumn('donation');
  });

  await knex.schema.dropTableIfExists('luckycard');
};