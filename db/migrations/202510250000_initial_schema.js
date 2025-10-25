/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Tabela para configurações globais do bot
  await knex.schema.createTable('globals', (table) => {
    table.string('user_id', 20).primary(); // ID do aplicativo do bot
    table.smallint('status').notNullable().defaultTo(0); // 0 = OK, 2 = Manutenção
    table.string('man', 255).notNullable().defaultTo('Manutenção não especificada');
    table.bigint('totalcmd').notNullable().defaultTo(0);
  });

  // Tabela para configurações por servidor
  await knex.schema.createTable('servers', (table) => {
    table.string('server_id', 20).primary(); // ID do servidor (guild.id)
    table.smallint('status').notNullable().defaultTo(0); // 0 = OK, 1 = Não Permitido, 2 = Banido
    table.text('banreason');
    table.bigint('cmdsexec').notNullable().defaultTo(0);
    table.bigint('lastcmd'); // Salva Date.now()
  });

  // Tabela principal para dados dos jogadores
  await knex.schema.createTable('players', (table) => {
    table.string('user_id', 20).primary(); // ID do usuário (user.id)
    table.smallint('perm').notNullable().defaultTo(1); // 0 = Banido, 1 = Usuário, 3 = MVP, 4 = Staff
    table.text('banreason');
    table.bigint('cmdsexec').notNullable().defaultTo(0);
    table.bigint('mvp'); // Salva Date.now() de quando o MVP expira
    table.integer('company'); // ID da empresa
  });

  // Tabela para as empresas
  await knex.schema.createTable('company', (table) => {
    table.increments('company_id').primary(); // ID único da empresa (auto-incremento)
    table.string('owner_id', 20).notNullable(); // ID do dono (user.id)
    table.smallint('type').notNullable().defaultTo(1); // Tipo/setor da empresa
    table.string('name', 100).notNullable().defaultTo('Minha Empresa');
  });

  // Insere a linha padrão na 'globals'
  // IMPORTANTE: O bot ID é lido do .env
  if (process.env.BOT_ID) {
    await knex('globals').insert({ user_id: process.env.BOT_ID });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('company');
  await knex.schema.dropTableIfExists('players');
  await knex.schema.dropTableIfExists('servers');
  await knex.schema.dropTableIfExists('globals');
};