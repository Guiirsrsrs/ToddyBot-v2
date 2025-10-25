/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Tabela para os PETS dos jogadores
  await knex.schema.createTable('player_pets', (table) => {
    table.increments('pet_id').primary();
    table.string('user_id', 20).notNullable().references('user_id').inTable('players').onDelete('CASCADE');
    table.string('type').notNullable(); // ID/Tipo do pet (ex: 'dragon')
    table.string('name');
    table.integer('level').notNullable().defaultTo(1);
    table.bigint('xp').notNullable().defaultTo(0);
  });

  // 2. Adiciona colunas faltantes em 'players'
  await knex.schema.alterTable('players', (table) => {
    table.bigint('tokens').notNullable().defaultTo(0); // Para /tradetoken
    table.string('married', 20); // ID do parceiro
    table.integer('pet').references('pet_id').inTable('player_pets').onDelete('SET NULL'); // ID do pet equipado
  });

  // 3. Adiciona colunas faltantes em 'company'
  await knex.schema.alterTable('company', (table) => {
    table.jsonb('storage').defaultTo('{}'); // Armazém da empresa
    table.integer('storage_level').notNullable().defaultTo(1);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('company', (table) => {
    table.dropColumn('storage');
    table.dropColumn('storage_level');
  });

  await knex.schema.alterTable('players', (table) => {
    table.dropColumn('tokens');
    table.dropColumn('married');
    table.dropColumn('pet');
  });

  await knex.schema.dropTableIfExists('player_pets');
};