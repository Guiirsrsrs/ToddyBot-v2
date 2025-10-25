/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // 1. Tabela de COOLDOWNS (Crucial para o bot iniciar)
  // O DatabaseManager antigo espera que todas estas colunas existam
  await knex.schema.createTable('player_cooldowns', (table) => {
    table.string('user_id', 20).primary().references('user_id').inTable('players').onDelete('CASCADE');
    table.bigint('antispam').defaultTo(0);
    table.bigint('banned').defaultTo(0);
    table.bigint('global').defaultTo(0);
    table.bigint('mastery').defaultTo(0);
    table.bigint('alertdelay').defaultTo(0);
    table.bigint('daily').defaultTo(0);
    table.bigint('rep').defaultTo(0);
    table.bigint('hunt').defaultTo(0);
    table.bigint('fish').defaultTo(0);
    table.bigint('mine').defaultTo(0);
    // Adicione outros cooldowns de comandos aqui se forem descobertos
  });

  // 2. Tabela de MÁQUINAS (Mineração)
  await knex.schema.createTable('player_machines', (table) => {
    table.string('user_id', 20).primary().references('user_id').inTable('players').onDelete('CASCADE');
    table.integer('storage_level').notNullable().defaultTo(1);
    table.jsonb('storage').defaultTo('{}'); // JSONB para armazenar os minérios
    table.integer('machine_level').notNullable().defaultTo(1);
  });

  // 3. Tabela de FERRAMENTAS (Pesca, etc)
  await knex.schema.createTable('player_tools', (table) => {
    table.string('user_id', 20).primary().references('user_id').inTable('players').onDelete('CASCADE');
    table.integer('fishing_rod').notNullable().defaultTo(0); // Nível da vara de pescar
    // Adicione outras ferramentas aqui (ex: picareta)
  });

  // 4. Tabela de BADGES (Emblemas)
  await knex.schema.createTable('player_badges', (table) => {
    table.string('user_id', 20).primary().references('user_id').inTable('players').onDelete('CASCADE');
    table.jsonb('badges').defaultTo('[]'); // JSONB para armazenar uma lista de badges
  });

  // 5. Tabela de EVENTOS (Corrida de cavalo, etc)
  await knex.schema.createTable('events', (table) => {
    table.string('event_id').primary(); // ex: 'race'
    table.jsonb('data'); // JSONB para armazenar os dados do evento
  });

  // 6. Tabelas de EMPRESAS (Trabalhadores e Currículos)
  await knex.schema.createTable('company_workers', (table) => {
    table.increments('worker_id').primary();
    table.string('user_id', 20).notNullable().references('user_id').inTable('players').onDelete('CASCADE');
    table.integer('company_id').notNullable().references('company_id').inTable('company').onDelete('CASCADE');
    table.integer('role').notNullable().defaultTo(1); // 1 = Worker
  });

  await knex.schema.createTable('company_curriculum', (table) => {
    table.increments('curriculum_id').primary();
    table.string('user_id', 20).notNullable().references('user_id').inTable('players').onDelete('CASCADE');
    table.integer('company_id').notNullable().references('company_id').inTable('company').onDelete('CASCADE');
    table.text('text').notNullable();
  });
  
  // 7. Tabela de CHAVES DE AUTENTICAÇÃO (para /usekey)
  await knex.schema.createTable('auth_keys', (table) => {
    table.increments('key_id').primary();
    table.string('key_value').notNullable().unique();
    table.string('key_type').notNullable(); // ex: 'mvp', 'money'
    table.integer('uses').defaultTo(1);
    table.string('generated_by', 20);
  });

  // 8. Adiciona colunas faltantes em 'players'
  await knex.schema.alterTable('players', (table) => {
    table.string('apoiador'); // ID de quem apoiou
    table.integer('apoios').notNullable().defaultTo(0); // Qtd de apoios recebidos
    table.string('position', 20).defaultTo('A1'); // Posição no mapa
  });

  // 9. Adiciona colunas faltantes em 'company'
  await knex.schema.alterTable('company', (table) => {
    table.text('description').defaultTo('Uma empresa incrível!');
    table.text('icon_url');
    table.integer('level').notNullable().defaultTo(1);
    table.bigint('xp').notNullable().defaultTo(0);
    table.bigint('money').notNullable().defaultTo(0); // Caixa da empresa
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Remove na ordem inversa de criação
  await knex.schema.alterTable('company', (table) => {
    table.dropColumn('description');
    table.dropColumn('icon_url');
    table.dropColumn('level');
    table.dropColumn('xp');
    table.dropColumn('money');
  });

  await knex.schema.alterTable('players', (table) => {
    table.dropColumn('apoiador');
    table.dropColumn('apoios');
    table.dropColumn('position');
  });

  await knex.schema.dropTableIfExists('auth_keys');
  await knex.schema.dropTableIfExists('company_curriculum');
  await knex.schema.dropTableIfExists('company_workers');
  await knex.schema.dropTableIfExists('events');
  await knex.schema.dropTableIfExists('player_badges');
  await knex.schema.dropTableIfExists('player_tools');
  await knex.schema.dropTableIfExists('player_machines');
  await knex.schema.dropTableIfExists('player_cooldowns');
};