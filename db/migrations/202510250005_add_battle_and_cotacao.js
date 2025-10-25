/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Tabela para os EQUIPAMENTOS de batalha dos jogadores
  await knex.schema.createTable('player_equipments', (table) => {
    table.increments('equipment_id').primary();
    table.string('user_id', 20).notNullable().references('user_id').inTable('players').onDelete('CASCADE');
    table.string('type').notNullable(); // 'sword', 'helmet', 'armor', 'shield', 'boots'
    table.string('item_key').notNullable(); // O ID do item (ex: 'sword_1')
    table.integer('level').notNullable().defaultTo(1);
    table.bigint('xp').notNullable().defaultTo(0);
  });

  // 2. Adiciona colunas faltantes em 'players'
  await knex.schema.alterTable('players', (table) => {
    table.string('badge'); // O ID do badge equipado
    // Slots de equipamento
    table.integer('equip_sword').references('equipment_id').inTable('player_equipments').onDelete('SET NULL');
    table.integer('equip_helmet').references('equipment_id').inTable('player_equipments').onDelete('SET NULL');
    table.integer('equip_armor').references('equipment_id').inTable('player_equipments').onDelete('SET NULL');
    table.integer('equip_shield').references('equipment_id').inTable('player_equipments').onDelete('SET NULL');
    table.integer('equip_boots').references('equipment_id').inTable('player_equipments').onDelete('SET NULL');
  });

  // 3. Adiciona colunas faltantes em 'globals'
  await knex.schema.alterTable('globals', (table) => {
    table.jsonb('cotacao'); // Para /cot
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('globals', (table) => {
    table.dropColumn('cotacao');
  });

  await knex.schema.alterTable('players', (table) => {
    table.dropColumn('badge');
    table.dropColumn('equip_sword');
    table.dropColumn('equip_helmet');
    table.dropColumn('equip_armor');
    table.dropColumn('equip_shield');
    table.dropColumn('equip_boots');
  });

  await knex.schema.dropTableIfExists('player_equipments');
};