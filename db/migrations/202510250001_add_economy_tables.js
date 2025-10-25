/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Adiciona as colunas que faltam na tabela 'players'
  await knex.schema.alterTable('players', (table) => {
    // Colunas de Economia (vistas em commands/economy/)
    table.bigint('money').notNullable().defaultTo(0);
    table.bigint('bank').notNullable().defaultTo(0);

    // Colunas de Perfil (vistas em commands/social/profile.js)
    table.text('bio').defaultTo('Use /bio para definir uma biografia.');
    table.string('background', 10).defaultTo('1');
    table.string('frame', 10).defaultTo('1');
    table.integer('rep').notNullable().defaultTo(0);

    // Colunas de Level/Stamina (vistas em commands/players/ e commands/social/profile.js)
    table.bigint('xp').notNullable().defaultTo(0);
    table.integer('level').notNullable().defaultTo(1);
    table.integer('stamina').notNullable().defaultTo(100);
  });

  // 2. Cria a tabela 'remember' (para cacheLists)
  await knex.schema.createTable('remember', (table) => {
    table.string('id').primary();
    table.jsonb('value'); // jsonb é flexível para armazenar qualquer dado
  });

  // 3. Cria a tabela 'company_process' (para company.jobs.process)
  await knex.schema.createTable('company_process', (table) => {
    table.increments('process_id').primary();
    table.integer('company_id').references('company_id').inTable('company').onDelete('CASCADE');
    table.string('item_id').notNullable();
    table.integer('quantity').notNullable();
    table.bigint('finish_at').notNullable(); // Para salvar Date.now()
  });

  // 4. Cria a tabela 'player_inventory' (para /backpack)
  await knex.schema.createTable('player_inventory', (table) => {
    table.increments('inventory_id').primary();
    table.string('user_id', 20).references('user_id').inTable('players').onDelete('CASCADE');
    table.string('item_id').notNullable();
    table.integer('quantity').notNullable().defaultTo(1);
  });

  // 5. Cria a tabela 'player_plots' (para /landplots)
  await knex.schema.createTable('player_plots', (table) => {
    table.increments('plot_id').primary();
    table.string('user_id', 20).references('user_id').inTable('players').onDelete('CASCADE');
    table.string('seed_id');
    table.bigint('planted_at');
    table.boolean('fertilized').defaultTo(false);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Remove as tabelas na ordem inversa
  await knex.schema.dropTableIfExists('player_plots');
  await knex.schema.dropTableIfExists('player_inventory');
  await knex.schema.dropTableIfExists('company_process');
  await knex.schema.dropTableIfExists('remember');

  // Remove as colunas da tabela 'players'
  await knex.schema.alterTable('players', (table) => {
    table.dropColumn('money');
    table.dropColumn('bank');
    table.dropColumn('bio');
    table.dropColumn('background');
    table.dropColumn('frame');
    table.dropColumn('rep');
    table.dropColumn('xp');
    table.dropColumn('level');
    table.dropColumn('stamina');
  });
};