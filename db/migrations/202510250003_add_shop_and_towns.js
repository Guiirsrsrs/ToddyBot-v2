/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Tabela da LOJA (essencial para /shop, /buy)
  await knex.schema.createTable('shop', (table) => {
    table.string('item_id').primary(); // ID do item (ex: 'caixa_comum')
    table.bigint('price').notNullable().defaultTo(0);
    table.bigint('sell_price');
    table.string('category').notNullable().defaultTo('geral');
    table.text('description');
    table.string('icon');
    table.boolean('listed').defaultTo(true); // Se aparece na loja
  });

  // 2. Tabela de CIDADES (towns)
  await knex.schema.createTable('towns', (table) => {
    table.increments('town_id').primary(); // ID único da cidade
    table.string('name').notNullable().unique();
    table.string('owner_id', 20).notNullable(); // Dono da cidade
    table.text('description').defaultTo('Uma nova cidade!');
    table.integer('level').notNullable().defaultTo(1);
    table.bigint('xp').notNullable().defaultTo(0);
    table.bigint('money').notNullable().defaultTo(0); // Caixa da cidade
    table.jsonb('members').defaultTo('[]'); // Lista de IDs de membros
    table.jsonb('storage').defaultTo('{}'); // Armazém da cidade
  });

  // 3. Adiciona a coluna 'town_id' na tabela 'players'
  await knex.schema.alterTable('players', (table) => {
    table.integer('town_id').references('town_id').inTable('towns').onDelete('SET NULL');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('players', (table) => {
    table.dropColumn('town_id');
  });
  await knex.schema.dropTableIfExists('towns');
  await knex.schema.dropTableIfExists('shop');
};