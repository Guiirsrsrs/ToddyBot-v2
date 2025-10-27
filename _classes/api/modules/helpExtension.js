// _classes/api/modules/helpExtension.js

// Requer a API DENTRO das funções que a utilizam
require('colors'); // Para logs

const helpExtension = {
    // Armazenar categorias em memória para evitar recálculo
    categories: null
};

/**
 * Obtém ou constrói a lista de categorias de comandos.
 * @returns {Array<string>} Lista de nomes de categorias em maiúsculas.
 */
helpExtension.getCategories = function() {
    // Requer a API aqui
    const API = require('../index');
    // Se as categorias já foram calculadas, retorna a versão em cache
    if (this.categories) {
        return this.categories;
    }

    console.log("[HelpExt] Construindo lista de categorias de comandos...".yellow);
    const categoriesSet = new Set();
    // Acessa os comandos carregados no client
    const commands = API.client?.commands;

    if (!commands || commands.size === 0) {
        console.warn("[HelpExt] Nenhuma comando encontrado em API.client.commands ao gerar categorias.");
        return []; // Retorna vazio se não houver comandos
    }

    commands.forEach(cmd => {
        // Usa 'geral' como categoria padrão se não definida
        const category = cmd.category ? String(cmd.category).toUpperCase() : 'GERAL';
        // Ignora categorias 'none' ou 'STAFF' (ou outras internas)
        if (category !== 'NONE' && category !== 'STAFF') {
            categoriesSet.add(category);
        }
    });

    this.categories = Array.from(categoriesSet).sort(); // Converte para array e ordena
    console.log(`[HelpExt] Categorias encontradas: ${this.categories.join(', ')}`);
    return this.categories;
};

/**
 * Obtém os comandos de uma categoria específica.
 * @param {string} categoryName - Nome da categoria (case-insensitive).
 * @returns {Array<object>} Lista de objetos de comando.
 */
helpExtension.getCommandsByCategory = function(categoryName) {
    // Requer a API aqui
    const API = require('../index');
    const targetCategory = String(categoryName).toUpperCase();
    const commandsInCategory = [];
    const commands = API.client?.commands;

    if (!commands) return [];

    commands.forEach(cmd => {
        const cmdCategory = cmd.category ? String(cmd.category).toUpperCase() : 'GERAL';
        // Inclui comandos sem categoria na 'GERAL'
        if (cmdCategory === targetCategory || (targetCategory === 'GERAL' && !cmd.category)) {
            // Adiciona apenas se o comando não estiver desabilitado e não for de STAFF/none
             if (!cmd.disabled && cmdCategory !== 'NONE' && cmdCategory !== 'STAFF') {
                  commandsInCategory.push(cmd);
             }
        }
    });

    // Ordena comandos por nome dentro da categoria
    return commandsInCategory.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Formata a página de ajuda para uma categoria ou comando específico.
 * @param {EmbedBuilder} embed - O embed a ser modificado.
 * @param {string} [categoryOrCommandName=null] - Nome da categoria ou comando. Se null, mostra a lista de categorias.
 * @param {Interaction} interaction - A interação do Discord (para contexto, como permissões do usuário).
 * @returns {Promise<{embed: EmbedBuilder, components: Array<ActionRowBuilder>}>} Embed atualizado e componentes (menu dropdown).
 */
helpExtension.formatHelpPage = async function(embed, categoryOrCommandName = null, interaction) {
    // Requer a API aqui
    const API = require('../index');
    embed.setTitle('❓ Central de Ajuda').setFields([]); // Limpa campos antigos
    const categories = this.getCategories(); // Pega a lista de categorias

    // Componente: Menu Dropdown de Categorias
    const options = categories.map(cat => ({
        label: cat.charAt(0) + cat.slice(1).toLowerCase(), // Capitaliza (ex: Economia)
        value: `help_category_${cat}`, // Valor único para identificar a seleção
        // description: `Ver comandos de ${cat.toLowerCase()}`, // Descrição opcional
        // emoji: '❓' // Emoji opcional
    }));

    // Adiciona opção para voltar ao início
     options.unshift({
         label: "Início (Lista de Categorias)",
         value: "help_category_HOME",
         // description: "Voltar para a lista de categorias",
         emoji: "🏠"
     });


    const selectMenu = new API.StringSelectMenuBuilder() // Usa o SelectMenuBuilder da API
        .setCustomId('help_category_select')
        .setPlaceholder('Selecione uma categoria...')
        .addOptions(options);

    const row = new API.ActionRowBuilder().addComponents(selectMenu);
    const components = [row]; // Coloca o menu em um array de ActionRow

    // --- Lógica de Exibição ---
    if (!categoryOrCommandName || categoryOrCommandName.toUpperCase() === 'HOME') {
        // Página Inicial: Lista de Categorias
        embed.setDescription('Bem-vindo à Central de Ajuda!\nUse o menu abaixo para navegar pelas categorias de comandos.');
        embed.addFields({
             name: 'Categorias Disponíveis',
             value: categories.length > 0 ? categories.map(c => `• ${c.charAt(0) + c.slice(1).toLowerCase()}`).join('\n') : 'Nenhuma categoria encontrada.'
        });
        // Define placeholder do menu para 'Início'
        selectMenu.setPlaceholder('Início (Lista de Categorias)');

    } else {
        const targetNameUpper = categoryOrCommandName.toUpperCase();
        // Verifica se é uma categoria válida
        if (categories.includes(targetNameUpper)) {
            // Página de Categoria
            const commands = this.getCommandsByCategory(targetNameUpper);
            const categoryDisplay = targetNameUpper.charAt(0) + targetNameUpper.slice(1).toLowerCase();
            embed.setTitle(`❓ Ajuda - Categoria: ${categoryDisplay}`);
            embed.setDescription(`Comandos disponíveis na categoria **${categoryDisplay}**:\n*(Use \`/ajuda <comando>\` para mais detalhes)*`);

            if (commands.length > 0) {
                 // Agrupa comandos para evitar exceder limite de campos/tamanho
                 let fieldValue = '';
                 commands.forEach((cmd, index) => {
                      const cmdLine = `</${cmd.name}:${cmd.id || '0'}> - ${cmd.description || 'Sem descrição'}\n`; // Link clicável do comando slash
                      if (fieldValue.length + cmdLine.length > 1020) { // Limite de 1024 por valor de campo
                           embed.addFields({ name: '\u200B', value: fieldValue, inline: false }); // Adiciona campo anterior
                           fieldValue = cmdLine; // Começa novo campo
                      } else {
                           fieldValue += cmdLine;
                      }
                 });
                 // Adiciona o último campo
                 if (fieldValue) {
                      embed.addFields({ name: '\u200B', value: fieldValue, inline: false });
                 }

            } else {
                embed.addFields({ name: 'Vazio', value: 'Nenhum comando encontrado nesta categoria.' });
            }
             // Define placeholder do menu para a categoria atual
             selectMenu.setPlaceholder(categoryDisplay);

        } else {
            // Página de Comando Específico (ou comando inválido)
            const commands = API.client?.commands;
            const command = commands?.find(cmd => cmd.name.toLowerCase() === categoryOrCommandName.toLowerCase());

            if (command && !command.disabled && command.category?.toUpperCase() !== 'NONE' && command.category?.toUpperCase() !== 'STAFF') {
                 embed.setTitle(`❓ Ajuda - Comando: /${command.name}`);
                 embed.setDescription(command.description || 'Sem descrição.');
                 if (command.usage) embed.addFields({ name: '📝 Como Usar', value: `\`/${command.name} ${command.usage}\``});
                 if (command.options && command.options.length > 0) {
                      const optionsString = command.options.map(opt => `\`${opt.name}\`: ${opt.description} ${opt.required ? '(obrigatório)' : '(opcional)'}`).join('\n');
                      embed.addFields({ name: '⚙️ Opções', value: optionsString });
                 }
                 if (command.examples) embed.addFields({ name: '💡 Exemplos', value: command.examples.map(ex => `\`/${command.name} ${ex}\``).join('\n') });
                 const cmdCategory = command.category ? command.category.charAt(0).toUpperCase() + command.category.slice(1).toLowerCase() : 'Geral';
                 embed.setFooter({ text: `Categoria: ${cmdCategory}`});
                 // Define placeholder do menu para o comando atual (ou categoria dele?)
                 selectMenu.setPlaceholder(`Comando: /${command.name}`);

            } else {
                // Comando ou Categoria Inválida
                embed.setColor('#a60000'); // Vermelho para erro
                embed.setDescription(`❌ O comando ou categoria "${categoryOrCommandName}" não foi encontrado.`);
                embed.addFields({
                     name: 'Categorias Disponíveis',
                     value: categories.length > 0 ? categories.map(c => `• ${c.charAt(0) + c.slice(1).toLowerCase()}`).join('\n') : 'Nenhuma categoria encontrada.'
                 });
                 // Mantém placeholder padrão
            }
        }
    }

    return { embed, components };
};

/**
 * Lida com a interação do menu dropdown da ajuda.
 * @param {Interaction} interaction - A interação do SelectMenu.
 * @param {Message} helpMessage - A mensagem original da ajuda.
 * @param {EmbedBuilder} embed - O embed original.
 */
helpExtension.handleMenuSelect = async function(interaction, helpMessage, embed) {
    // Requer a API aqui
    const API = require('../index');
    const selectedValue = interaction.values[0]; // Valor da opção selecionada

    if (!selectedValue.startsWith('help_category_')) return; // Ignora se não for do menu de ajuda

    const target = selectedValue.replace('help_category_', ''); // Extrai o nome da categoria ou 'HOME'

    try {
        await interaction.deferUpdate(); // Confirma o clique no menu

        // Formata a página para a nova seleção
        const { embed: updatedEmbed, components: updatedComponents } = await this.formatHelpPage(embed, target, interaction);

        // Edita a mensagem original com o novo conteúdo
        await interaction.editReply({ embeds: [updatedEmbed], components: updatedComponents });

    } catch (error) {
         console.error("[ERRO][HelpExt.handleMenuSelect] Falha ao atualizar página de ajuda:", error);
         try {
              await interaction.followUp({ content: "Ocorreu um erro ao carregar a categoria selecionada.", ephemeral: true });
         } catch {}
         // Tenta remover componentes se a edição falhar muito
         try { await interaction.editReply({ components: [] }); } catch {}
    }
};


module.exports = helpExtension;