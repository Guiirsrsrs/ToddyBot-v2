/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Cria a tabela 'storage' referenciada por crateExtension.js
  // Esta tabela parece destinada a armazenar a contagem de crates por usuário
  await knex.schema.createTable('storage', (table) => {
    table.string('user_id', 20).primary().references('user_id').inTable('players').onDelete('CASCADE');

    // Adiciona colunas para os tipos de crate definidos em _json/crates.json
    // Se você tiver mais tipos de crate, adicione colunas aqui.
    // O tipo 'double precision' foi usado no código original, mas 'integer' pode ser mais apropriado para contagem.
    // Usaremos 'integer' com default 0.
    table.integer('crate:comum').notNullable().defaultTo(0);
    table.integer('crate:incomum').notNullable().defaultTo(0);
    table.integer('crate:raro').notNullable().defaultTo(0);
    table.integer('crate:epico').notNullable().defaultTo(0);
    table.integer('crate:lendario').notNullable().defaultTo(0);
    // Adicione mais colunas 'crate:...' se houver outros tipos no seu crates.json
  });

   // Nota: A função getCrates em crateExtension.js foi ajustada para usar player_inventory.
   // Se você quiser usar esta tabela 'storage' como no código ORIGINAL,
   // você precisará reverter as alterações em getCrates e give no crateExtension.js
   // e ajustar a lógica para ler/escrever nestas colunas específicas.
   // Por agora, vamos apenas criar a tabela que o código *tentava* alterar.
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('storage');
};