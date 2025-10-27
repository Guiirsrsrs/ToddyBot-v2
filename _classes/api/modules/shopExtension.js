// _classes/api/modules/shopExtension.js

// NÃO requer a API aqui no topo para evitar dependência circular na carga inicial
const fs = require('fs');
const path = require('path');
require('colors'); // Para logs

const shopExtension = {
    // obj e obj2 serão preenchidos pela função load()
    obj: {}, // Dados base da loja
    obj2: {} // Dados com descontos aplicados (usado por getShopObj)
};

/**
 * Carrega as definições de todos os itens (minérios, drops, consumíveis) para API.itemExtension.obj.
 * @returns {Promise<object>} Objeto com todas as definições de itens.
 */
shopExtension.loadItens = async function() {
    // Requer a API DENTRO da função, quando ela já existe
    const API = require('../index');
    let bigobj = {
        minerios: [],
        drops: []
    };
    console.log("[ShopExt] Carregando definições de itens...".yellow);
    try {
        const basePath = path.join(__dirname, '..', '..', '..', '_json'); // ../../../_json/

        // Função auxiliar para carregar e parsear JSON
        const loadJson = (filePath, description) => {
            const fullPath = path.join(basePath, filePath);
            try {
                const jsonString = fs.readFileSync(fullPath, 'utf8');
                return JSON.parse(jsonString);
            } catch (err) {
                 console.error(`[ERRO][ShopExt] Falha ao carregar ${description} de ${fullPath}:`, err);
                 // Verifica se API.client existe antes de emitir erro
                 if(API.client?.emit) API.client.emit('error', err);
                 return []; // Retorna array vazio em caso de erro
            }
        };

        // Carrega Minérios
        bigobj.minerios = loadJson('ores.json', 'minérios');

        // Carrega Drops e outros itens
        let dropList = [];
        dropList = dropList.concat(loadJson('companies/exploration/drops_monsters.json', 'drops de monstros'));
        dropList = dropList.concat(loadJson('companies/agriculture/seeds.json', 'sementes'));
        dropList = dropList.concat(loadJson('companies/fish/mobs.json', 'peixes'));
        dropList = dropList.concat(loadJson('usaveis.json', 'itens usáveis'));
        dropList = dropList.concat(loadJson('companies/process/drops.json', 'drops de processamento'));
        bigobj.drops = dropList;

        console.log(`[ShopExt] ${bigobj.minerios.length} minérios e ${bigobj.drops.length} outros itens carregados.`);

        // Popula o objeto em itemExtension
        // Assume que API.itemExtension já está disponível quando esta função for chamada
        if (API.itemExtension) {
            API.itemExtension.obj = bigobj;
        } else {
             console.error("[ERRO FATAL][ShopExt] API.itemExtension não encontrado ao tentar carregar itens!");
        }

    } catch (err) { // Catch geral para erros inesperados no processo
        console.error('[ERRO FATAL][ShopExt] Falha crítica ao carregar definições de itens:', err);
        // Pode ser necessário parar o bot aqui se os itens forem essenciais
        // process.exit(1);
    }
    return bigobj; // Retorna os dados carregados
};

/**
 * Carrega as definições da loja do shop.json e inicializa as definições de itens.
 */
shopExtension.load = async function() {
    // Requer a API DENTRO da função
    const API = require('../index');
    const shopJsonPath = path.join(__dirname, '..', '..', '..', '_json/shop.json'); // ../../../_json/
    console.log(`[ShopExt] Carregando definições da loja de: ${shopJsonPath}`.yellow);
    try {
        const jsonString = fs.readFileSync(shopJsonPath, 'utf8');
        const shopData = JSON.parse(jsonString);
        this.obj = shopData; // Dados base
        // Agora API.utils DEVE existir quando esta função for chamada pelo ToddyClient
        this.obj2 = API.utils.clone(shopData); // Clona para aplicar descontos
        console.log(`[ShopExt] ${Object.keys(this.obj).length} categorias da loja carregadas.`);
    } catch (err) {
        console.error(`[ERRO][ShopExt] Falha ao carregar ou parsear ${shopJsonPath}:`, err);
        this.obj = {}; // Define como vazio em caso de erro
        this.obj2 = {};
        // Verifica se API.client existe
        if(API.client?.emit) API.client.emit('error', err);
        // Considerar parar o bot?
        return; // Sai se não conseguir carregar a loja
    }

    // Carrega as definições de itens após carregar a loja
    // Chama loadItens usando 'this' para garantir o contexto correto
    await this.loadItens();

};

/**
 * Retorna uma cópia do objeto da loja (com descontos aplicados).
 * @returns {object} Objeto da loja.
 */
shopExtension.getShopObj = function() {
    // Requer a API DENTRO da função
    const API = require('../index');
    // Retorna clone do obj2 (que contém os descontos atuais)
    return API.utils.clone(this.obj2); // Usa 'this.obj2'
};

/**
 * Formata os campos do embed para exibir uma página da loja e gera os botões.
 * @param {EmbedBuilder} embed - Embed a ser modificado.
 * @param {{currentpage: number, totalpages: number}} pageInfo - Informações da página atual.
 * @param {Array<object>} products - Lista de produtos da categoria atual.
 * @param {string} user_id - ID do usuário visualizando.
 * @param {boolean} stopComponents - Se true, não gera botões (usado após seleção).
 * @returns {Promise<Array<ActionRowBuilder>>} Array de ActionRowBuilders com os botões.
 */
shopExtension.formatPages = async function(embed, { currentpage, totalpages }, products, user_id, stopComponents = false) {
    // Requer a API DENTRO da função
    const API = require('../index');
    let machineDoc, playerDoc;
    try { // Busca dados do jogador e máquina para calcular preços e verificar níveis
         // ALTERADO: Acessa API.db AQUI
         machineDoc = await API.db.findOne('machines', { user_id: user_id }) || { machine: 0, level: 1, durability: 0 }; // Padrões
         playerDoc = await API.db.findOne('players', { user_id: user_id }) || { mvp: null }; // Padrão
    } catch (err) {
         console.error(`[ERRO][ShopExt.formatPages] Falha ao buscar dados para ${user_id}:`, err);
         machineDoc = { machine: 0, level: 1, durability: 0 }; // Usa padrões em caso de erro
         playerDoc = { mvp: null };
    }

    // Acessa this.getProduct para pegar dados da máquina (precisa do 'this' ou chamar shopExtension.getProduct)
    const machineId = machineDoc.machine;
    // Corrigido para chamar via this
    const machineData = this.getProduct(machineId) || { tier: 0, durability: 0 }; // Máquina padrão
    const playerLevel = machineDoc.level;
    const hasMvp = playerDoc.mvp != null; // Adapte a lógica de verificação do MVP

    const productsOnCurrentPage = [];
    const itemsPerPage = 3; // Mantido

    const startIndex = (currentpage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // Limpa campos antigos antes de adicionar novos
    embed.setFields([]); // Limpa todos os campos

    for (let i = startIndex; i < endIndex && i < products.length; i++) {
        const p = products[i];
        if (!p) continue; // Pula se o produto for inválido

        // Calcula preço com desconto (lógica mantida)
        let discountMVP = hasMvp ? 5 : 0;
        let totalDiscount = Math.round((p.discount || 0) + discountMVP);
        let finalPrice = Math.round(totalDiscount > 0 ? p.price * (100 - totalDiscount) / 100 : p.price);

        // Ajuste de preço para tipo 4 (conserto?)
         if (p.type == 4) {
             // Corrigido para chamar via this
             const machineProduct = this.getProduct(machineId); // Pega dados da máquina equipada
             if (machineProduct?.durability > 0) { // Evita divisão por zero
                const durabilityPercent = (machineDoc.durability / machineProduct.durability) * 100;
                const missingPercent = 100 - durabilityPercent;
                 finalPrice = Math.round(((p.price * (missingPercent / 100)) * 0.45) * (machineData.tier + 1));
             } else {
                  finalPrice = 0; // Não pode consertar se a máquina não tem durabilidade max
             }
        }

        // Formata string de preço
        let priceString = "";
        // Usa API para formatação e constantes
        if (totalDiscount > 0 && p.price > 0) priceString += `~~\`${API.utils.format(p.price)}\`~~ `;
        if (finalPrice > 0) priceString += `\`${API.utils.format(finalPrice)} ${API.money}\` ${API.moneyemoji}`;
        if (p.price2 > 0) priceString += (priceString ? ' e ' : '') + `\`${p.price2} ${API.money2}\` ${API.money2emoji}`;
        if (p.price3 > 0) priceString += (priceString ? ' e ' : '') + `\`${p.price3} ${API.tp.name}\` ${API.tp.emoji}`;
        if (!priceString) priceString = "Grátis"; // Se nenhum preço for definido

        // Monta descrição do item
        let description = `Preço: ${priceString}`;
        if (p.buyable) description += `\nUse \`/comprar id:${p.id}\``; // Sugere ID
        if (p.token) description += `\nQuantia: ${p.token} ${API.money3emoji}`;
        if (p.customitem?.typesmax) description += `\nMáx. Tipos: **${p.customitem.typesmax}** | Máx. por Item: **${p.customitem.itensmax}**`;
        if (p.tier !== undefined) { // Verifica se tier existe
             const oreList = API.itemExtension?.getObj()?.minerios || []; // Acesso seguro
             const tierOre = oreList[p.tier] || { name: '?', icon: '' }; // Fallback
             description += `\nTier: ${p.tier} (${tierOre.name} ${tierOre.icon})`;
        }
        if (p.profundidade) description += `\nProfundidade: ${p.profundidade}m`;
        if (p.durability) description += `\nDurabilidade: ${p.durability} usos`;
        if (p.level && playerLevel < p.level) description += `\n**⚠️ Requer Nível ${p.level}**`; // Adiciona aviso
        if (p.info) description += `\n*${p.info}*`; // Info em itálico

        // Adiciona campo ao embed
        embed.addFields({
            name: `${p.icon || ''} ${p.name} ┆ ID: ${p.id}${totalDiscount > 0 ? ` (${totalDiscount}% OFF)` : ''}`,
            value: description,
            inline: false // Manter inline false para melhor leitura?
        });
        productsOnCurrentPage.push(p);
    }

    if (products.length === 0) {
        embed.addFields({ name: '❌ Vazio', value: 'Esta categoria não possui produtos no momento.' });
    }

    embed.setFooter({ text: `Página ${currentpage}/${totalpages}` });

    // --- Geração de Botões ---
    if (stopComponents) return []; // Retorna array vazio se não for para gerar botões

    const buttonList = [];
    const components = [];

    // Usa API para criar botões
    buttonList.push(API.utils.discord.createButton('shop_backward', 'Primary', '', '⬅️', currentpage === 1));
    buttonList.push(API.utils.discord.createButton('shop_stop', 'Danger', '', '✖️')); // Danger para parar
    buttonList.push(API.utils.discord.createButton('shop_forward', 'Primary', '', '➡️', currentpage === totalpages));

    // Botões de Compra (um por item na página)
    for (const p of productsOnCurrentPage) {
        // Usa ID único com prefixo para evitar colisão com navegação
        const customId = `shop_buy_${p.id}`;
        // Extrai ID do emoji (se for custom) ou usa o próprio emoji unicode
        let emojiId = null;
        if (p.icon) {
            const emojiMatch = p.icon.match(/<a?:\w+:(\d+)>$/);
            emojiId = emojiMatch ? emojiMatch[1] : p.icon; // ID ou emoji unicode
        }
        buttonList.push(API.utils.discord.createButton(customId, 'Secondary', `${p.id}`, emojiId || '🛒', !p.buyable || (p.level && playerLevel < p.level))); // Desabilita se não comprável ou nível baixo
    }

    // Agrupa botões em Action Rows (máximo 5 por row)
    for (let i = 0; i < buttonList.length; i += 5) {
        const rowButtons = buttonList.slice(i, i + 5);
        if (rowButtons.length > 0) {
            // Usa API para ActionRowBuilder
            components.push(new API.ActionRowBuilder().addComponents(rowButtons));
        }
    }

    return components;
};


/**
 * Obtém a lista de categorias da loja formatada.
 * @returns {string} String formatada com as categorias.
 */
shopExtension.getShopList = function() {
    // Não precisa da API aqui, apenas usa 'this.obj' que foi carregado
    const categories = Object.keys(this.obj); // Usa obj base (sem descontos) para a lista
    if (categories.length === 0) return '`Erro ao carregar categorias da loja.`';
    return '**' + categories.join('**, **').toUpperCase() + '**';
};

/**
 * Verifica se uma categoria existe na loja.
 * @param {string} categoryName - Nome da categoria.
 * @returns {boolean} True se existe, false caso contrário.
 */
shopExtension.categoryExists = function(categoryName) {
    // Não precisa da API aqui
    // Compara em lowercase para ser insensível
    return this.obj.hasOwnProperty(String(categoryName).toLowerCase());
};

/**
 * Gerencia a paginação e coleta de botões para a interface da loja.
 * @param {string} category - Categoria sendo visualizada.
 * @param {Interaction} interaction - Interação original.
 * @param {Message} shopMessage - A mensagem da loja com os botões.
 * @param {Array<object>} products - Lista de produtos da categoria.
 * @param {EmbedBuilder} embed - O embed da loja.
 * @param {number} initialPage - Página inicial.
 * @param {number} totalPages - Total de páginas.
 */
shopExtension.editPage = async function(category, interaction, shopMessage, products, embed, initialPage, totalPages) {
    // Requer a API aqui para usar dentro do coletor
    const API = require('../index'); // Necessário para this.formatPages e this.execute
    if (!shopMessage || typeof shopMessage.createMessageComponentCollector !== 'function') return;

    const filter = i => i.user.id === interaction.user.id;
    let currentPage = initialPage;
    // Tempo maior para navegação
    const collector = shopMessage.createMessageComponentCollector({ filter, time: 120000 }); // 2 minutos

    let stopped = false;

    collector.on('collect', async(buttonInteraction) => {
        try {
             // Deferir update imediatamente
            if (!buttonInteraction.deferred) await buttonInteraction.deferUpdate();

            let needsUpdate = false;
            let stopComponents = false;
            let selectedProduct = null;

            // Lógica de Navegação/Ação
            switch (buttonInteraction.customId) {
                case 'shop_forward':
                    if (currentPage < totalPages) { currentPage++; needsUpdate = true; }
                    break;
                case 'shop_backward':
                    if (currentPage > 1) { currentPage--; needsUpdate = true; }
                    break;
                case 'shop_stop':
                    stopped = true;
                    collector.stop();
                    embed.setColor('#a60000').setFooter({ text: `Loja fechada por ${interaction.user.tag}` });
                    needsUpdate = true;
                    stopComponents = true;
                    break;
                default:
                    // Verifica se é um botão de compra
                    if (buttonInteraction.customId.startsWith('shop_buy_')) {
                        const productId = buttonInteraction.customId.replace('shop_buy_', '');
                        // Usa this.getProduct
                        selectedProduct = this.getProduct(productId);
                        if (selectedProduct) {
                             stopped = true;
                             collector.stop();
                             needsUpdate = false; // Não precisa editar a mensagem da loja, vai executar a compra
                             // Chama a função execute para processar a compra
                             // Usa this.execute
                             await this.execute(interaction, selectedProduct, shopMessage); // Passa a mensagem original para editar depois
                        } else {
                             // Produto não encontrado (erro?) - Apenas reseta o timer
                             console.warn(`[ShopExt.editPage] Botão de compra para ID ${productId} clicado, mas produto não encontrado.`);
                             collector.resetTimer();
                        }
                    }
                    break;
            }

            // Se precisa atualizar o embed da loja (navegação ou stop)
            if (needsUpdate) {
                 embed.setTitle(`Loja - ${category} (${currentPage}/${totalPages})`); // Atualiza título com página
                 // Usa this.formatPages
                 const components = await this.formatPages(embed, { currentpage: currentPage, totalpages: totalPages }, products, interaction.user.id, stopComponents);
                 await interaction.editReply({ embeds: [embed], components }); // Edita a resposta original da interação
                 if (!stopped) collector.resetTimer(); // Reseta timer se não parou
            } else if (!stopped && !selectedProduct) {
                 // Se não houve update mas não parou (ex: clicou em página inválida), reseta timer
                 collector.resetTimer();
            }

        } catch (collectError) {
             console.error("[ERRO][ShopExt.editPage] Falha ao processar interação de botão:", collectError);
             // Tenta notificar o usuário
             try { await buttonInteraction.followUp({ content: "Ocorreu um erro ao processar sua ação.", ephemeral: true }); } catch {}
             collector.stop(); // Para o coletor em caso de erro
             // Limpa botões da mensagem original
             try { await interaction.editReply({ components: [] }); } catch {}
        }
    });

    collector.on('end', async (collected, reason) => {
        // Limpa os botões se o coletor parou por timeout ou erro não tratado
        if (!stopped && reason !== 'user') { // Não limpa se foi parado manualmente ('shop_stop')
             console.log(`[ShopExt.editPage] Coletor finalizado (${reason}). Limpando botões.`);
             try {
                  embed.setFooter({ text: `Loja expirada.` }); // Atualiza footer
                  await interaction.editReply({ embeds: [embed], components: [] });
             } catch (endError) {
                  // Ignora erro se a mensagem já foi deletada
                  if (endError.code !== 10008) { // Unknown Message
                      console.error("[ERRO][ShopExt.editPage] Falha ao limpar botões no 'end':", endError);
                  }
             }
        }
    });
};


/**
 * Verifica se um produto com o ID existe na loja.
 * @param {string|number} productId - ID do produto.
 * @returns {boolean}
 */
shopExtension.checkIdExists = function(productId) {
  // Usa this.getProduct
  return !!this.getProduct(productId);
};

/**
 * Obtém os dados de um produto pelo ID.
 * @param {string|number} productId - ID do produto.
 * @returns {object|undefined} Objeto do produto ou undefined.
 */
shopExtension.getProduct = function(productId) {
    // Não precisa da API aqui diretamente, mas usa this.obj e this.obj2
    const idToFind = String(productId); // Compara como string
    // Itera sobre as categorias e produtos no obj base (sem descontos para definição)
    for (const category in this.obj) {
        if (Array.isArray(this.obj[category])) {
            const product = this.obj[category].find(p => String(p.id) === idToFind);
            if (product) {
                // Adiciona desconto atual do obj2 se existir
                // Verifica se this.obj2[category] existe antes de tentar o find
                const categoryWithDiscount = this.obj2[category];
                const productWithDiscount = categoryWithDiscount?.find(p => String(p.id) === idToFind);
                // Retorna cópia com desconto atualizado (ou 0 se obj2 ainda não foi carregado/categoria nao existe)
                return { ...product, discount: productWithDiscount?.discount || 0 };
            }
        }
    }
    return undefined; // Não encontrado
};


/**
 * Executa a lógica de compra de um item.
 * @param {Interaction} interaction - Interação original do comando /loja ou /comprar.
 * @param {object} product - Objeto do produto a ser comprado.
 * @param {Message} [shopMessage=null] - Mensagem original da loja (para editar após compra).
 */
shopExtension.execute = async function(interaction, product, shopMessage = null) {
    // Requer a API DENTRO da função
    const API = require('../index');
    const user_id = interaction.user.id;

    // 1. Verifica se o item é comprável
    if (!product.buyable) {
        const embedError = await API.utils.discord.sendError(interaction, `O item "${product.name}" não está disponível para compra!`);
        // Tenta editar a mensagem da loja ou responder à interação
        if (shopMessage && shopMessage.editable) await shopMessage.edit({ embeds: [embedError], components: [] }).catch(()=>{});
        else if (interaction.replied || interaction.deferred) await interaction.editReply({ embeds: [embedError], components: [] }).catch(()=>{});
        else await interaction.reply({ embeds: [embedError], ephemeral: true }).catch(()=>{});
        return;
    }

    // 2. Cria Embed de Confirmação
    const embedConfirm = new API.EmbedBuilder()
        .setColor('#606060')
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

    // 3. Calcula Preço Final (Reutiliza lógica de formatPages)
    let finalPrice = 0;
    let price2 = product.price2 || 0;
    let price3 = product.price3 || 0;
    let cashback = 0; // Cashback específico para máquinas

    try {
        // ALTERADO: Acessa API.db AQUI
        const machineDoc = await API.db.findOne('machines', { user_id: user_id }) || { machine: 0, level: 1, durability: 0 };
        const playerDoc = await API.db.findOne('players', { user_id: user_id }) || { mvp: null };
        const machineId = machineDoc.machine;
        const playerLevel = machineDoc.level;
        const hasMvp = playerDoc.mvp != null;

        let discountMVP = hasMvp ? 5 : 0;
        let totalDiscount = Math.round((product.discount || 0) + discountMVP);
        finalPrice = Math.round(totalDiscount > 0 ? product.price * (100 - totalDiscount) / 100 : product.price);

        // Ajuste de preço para tipo 4 (conserto)
         if (product.type === 4) {
             // Usa this.getProduct
             const machineProduct = this.getProduct(machineId);
             if (machineProduct?.durability > 0) {
                 const durabilityPercent = (machineDoc.durability / machineProduct.durability) * 100;
                 const missingPercent = Math.max(0, 100 - durabilityPercent); // Garante não negativo
                 finalPrice = Math.round(((product.price * (missingPercent / 100)) * 0.45) * ((machineProduct.tier || 0) + 1));
             } else {
                 finalPrice = 0; // Não pode consertar
             }
         }

        // Verifica nível necessário ANTES de mostrar confirmação
        if (product.level && playerLevel < product.level) {
             const embedError = await API.utils.discord.sendError(interaction, `Você precisa ser **Nível ${product.level}** para comprar ${product.name}! (Seu nível: ${playerLevel})`);
             if (shopMessage && shopMessage.editable) await shopMessage.edit({ embeds: [embedError], components: [] }).catch(()=>{});
             else if (interaction.replied || interaction.deferred) await interaction.editReply({ embeds: [embedError], components: [] }).catch(()=>{});
             else await interaction.reply({ embeds: [embedError], ephemeral: true }).catch(()=>{});
             return;
        }

        // Lógica de cashback para máquinas (tipo 1)
         if (product.type === 1) {
             // Usa this.getProduct
             const currentMachineProduct = this.getProduct(machineId);
             if (currentMachineProduct?.price > 0) {
                 cashback = Math.max(0, Math.round(0.07 * currentMachineProduct.price)); // 7%
             }
              // Verificação de ordem da máquina
             if (product.id > machineId + 1 && machineId !== 0) { // Permite comprar a primeira máquina (id > 0 + 1)
                  // Usa this.getProduct
                  const nextMachine = this.getProduct(machineId + 1);
                  const embedError = await API.utils.discord.sendError(interaction, `Você precisa comprar as máquinas em ordem! Sua próxima máquina é a **${nextMachine?.icon || ''} ${nextMachine?.name || `ID ${machineId+1}`}**.`);
                  if (shopMessage && shopMessage.editable) await shopMessage.edit({ embeds: [embedError], components: [] }).catch(()=>{});
                  else if (interaction.replied || interaction.deferred) await interaction.editReply({ embeds: [embedError], components: [] }).catch(()=>{});
                  else await interaction.reply({ embeds: [embedError], ephemeral: true }).catch(()=>{});
                  return;
             }
             // Verificação se está minerando (Assume que API.cacheLists está pronto)
             if (API.cacheLists.waiting.includes(user_id, 'mining')) { // TODO: Corrigir isso, waiting não é array
                  const embedError = await API.utils.discord.sendError(interaction, `Você não pode comprar uma máquina enquanto estiver minerando!`);
                  if (shopMessage && shopMessage.editable) await shopMessage.edit({ embeds: [embedError], components: [] }).catch(()=>{});
                  else if (interaction.replied || interaction.deferred) await interaction.editReply({ embeds: [embedError], components: [] }).catch(()=>{});
                  else await interaction.reply({ embeds: [embedError], ephemeral: true }).catch(()=>{});
                  return;
             }
         }


    } catch (err) {
        console.error(`[ERRO][ShopExt.execute] Falha ao calcular preço/verificar condições para ${user_id}, produto ${product.id}:`, err);
        const embedError = await API.utils.discord.sendError(interaction, `Ocorreu um erro ao verificar os detalhes da compra.`);
        if (shopMessage && shopMessage.editable) await shopMessage.edit({ embeds: [embedError], components: [] }).catch(()=>{});
        else if (interaction.replied || interaction.deferred) await interaction.editReply({ embeds: [embedError], components: [] }).catch(()=>{});
        else await interaction.reply({ embeds: [embedError], ephemeral: true }).catch(()=>{});
        return;
    }

    // Usa API para formatação e constantes
    const formatPriceString = `${finalPrice > 0 ? `${API.utils.format(finalPrice)} ${API.moneyemoji}` : ''}` +
                           `${price2 > 0 ? ` e ${price2} ${API.money2emoji}` : ''}` +
                           `${price3 > 0 ? ` e ${price3} ${API.tp.emoji}` : ''}` || 'Grátis';

    embedConfirm.addFields({ name: '<a:loading:736625632808796250> Confirmar Compra?', value: `Deseja comprar **${product.icon || ''} ${product.name}** por **${formatPriceString}**?`});
    if (cashback > 0) {
        embedConfirm.addFields({ name: '🔄 Cashback', value: `Você receberá **${API.utils.format(cashback)} ${API.moneyemoji}** de volta pela sua máquina atual.`});
    }

    // 4. Botões de Confirmação
    // Usa API para criar botões e row
    const confirmId = `shop_confirm_${product.id}_${Date.now()}`; // ID único
    const cancelId = `shop_cancel_${product.id}_${Date.now()}`;
    const btnConfirm = API.utils.discord.createButton(confirmId, 'Success', 'Confirmar', '✅');
    const btnCancel = API.utils.discord.createButton(cancelId, 'Danger', 'Cancelar', '❌');
    const confirmRow = new API.ActionRowBuilder().addComponents(btnConfirm, btnCancel);

    // 5. Envia ou Edita Mensagem de Confirmação
    let confirmMessage;
    const messagePayload = { embeds: [embedConfirm], components: [confirmRow], fetchReply: true };
    try {
        // Se veio da /loja (shopMessage existe), edita a mensagem da loja
        if (shopMessage && shopMessage.editable) {
             confirmMessage = await shopMessage.edit(messagePayload);
        }
        // Se veio do /comprar ou interação falhou antes, responde à interação
        else if (interaction.replied || interaction.deferred) {
            confirmMessage = await interaction.editReply(messagePayload);
        } else {
             // Responde ephemeralmente para confirmação
             messagePayload.ephemeral = true;
             confirmMessage = await interaction.reply(messagePayload);
        }
    } catch (sendError) {
         console.error("[ERRO][ShopExt.execute] Falha ao enviar/editar mensagem de confirmação:", sendError);
         // Tenta enviar mensagem de erro como fallback
         try { await interaction.followUp({ content: "❌ Falha ao iniciar processo de compra.", ephemeral: true }); } catch {}
         return; // Não pode continuar sem a mensagem de confirmação
    }

    // 6. Coletor de Botões de Confirmação
    const filter = i => i.user.id === user_id && (i.customId === confirmId || i.customId === cancelId);
    let purchaseResultEmbed = null; // Embed para mostrar resultado final

    try {
        const collectedInteraction = await confirmMessage.awaitMessageComponent({ filter, time: 30000 }); // 30 segundos

        if (collectedInteraction.customId === confirmId) {
            // --- INÍCIO: Lógica de Processamento da Compra ---
            await collectedInteraction.deferUpdate(); // Confirma que o botão foi clicado

            // Re-verifica saldos antes de debitar (Usa API para economia, que já usa API.db)
            const currentMoney = await API.eco.money.get(user_id);
            const currentPoints = await API.eco.points.get(user_id);
            const currentTp = (await API.eco.tp.get(user_id))?.points || 0; // Pega TP atualizado

            let canAfford = true;
            let missingCurrency = [];
            if (currentMoney < finalPrice) { canAfford = false; missingCurrency.push(API.moneyemoji); }
            if (currentPoints < price2) { canAfford = false; missingCurrency.push(API.money2emoji); }
            if (currentTp < price3) { canAfford = false; missingCurrency.push(API.tp.emoji); }

            if (!canAfford) {
                 // Usa API.EmbedBuilder
                 purchaseResultEmbed = new API.EmbedBuilder()
                     .setColor('#a60000')
                     .setTitle('❌ Falha na Compra')
                     .setDescription(`Saldo insuficiente! Você não possui ${missingCurrency.join(', ')} o suficiente.`)
                     .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
            } else {
                // SALDO SUFICIENTE - PROCESSA A COMPRA
                let purchaseSuccess = true;
                let errorMessage = "Erro desconhecido ao processar a compra.";

                try {
                    // Aplica o efeito da compra (ALTERADO: Usa API.db e outros módulos API)
                    switch (product.type) {
                        case 1: // Máquina
                             await API.db.updateOne('machines', { user_id: user_id }, {
                                 $set: {
                                     machine: product.id,
                                     durability: product.durability,
                                     pressure: Math.round(product.pressure / 2),
                                     refrigeration: product.refrigeration,
                                     pollutants: 0,
                                 }
                             }, { upsert: true });
                             await API.itemExtension.unequipAllChips(user_id); // itemExtension não mexe com DB diretamente aqui, ok
                            break;
                        case 2: // Token (Fichas)
                            await API.eco.token.add(user_id, product.token || 0); // eco já usa API.db
                            break;
                        case 3: // Mochila
                            await API.db.updateOne('players_utils', { user_id: user_id }, { $set: { backpack: product.id } }, { upsert: true });
                            break;
                        case 4: // Conserto
                             const machineToFix = await API.db.findOne('machines', { user_id: user_id });
                             // Usa this.getProduct
                             const machineProductToFix = this.getProduct(machineToFix?.machine || 0);
                             if (machineToFix && machineProductToFix) {
                                  await API.db.updateOne('machines', { user_id: user_id }, {
                                       $set: {
                                            durability: machineProductToFix.durability || 0,
                                            pressure: machineProductToFix.pressure || 0,
                                            refrigeration: machineProductToFix.refrigeration || 0,
                                            pollutants: 0
                                       }
                                  });
                             } else { throw new Error("Máquina não encontrada para consertar."); }
                            break;
                        case 5: // Chip/Peça
                            await API.itemExtension.add(user_id, `piece:${product.id}`, 1); // itemExtension não mexe com DB diretamente aqui, ok
                            break;
                        case 6: // Frame
                            await API.frames.add(user_id, product.frameid); // frames será atualizado depois
                            break;
                        case 7: // Cristais
                            await API.eco.points.add(user_id, product.size || 0); // eco já usa API.db
                            break;
                        case 8: // Cor de Perfil
                            await API.db.updateOne('players_utils', { user_id: user_id }, { $set: { profile_color: product.pcolorid } }, { upsert: true });
                            break;
                        default: throw new Error(`Tipo de produto desconhecido: ${product.type}`);
                    }

                    // Debita os custos e adiciona cashback (Usa API para economia, que já usa API.db)
                    if (finalPrice > 0) await API.eco.money.remove(user_id, finalPrice);
                    if (price2 > 0) await API.eco.points.remove(user_id, price2);
                    if (price3 > 0) await API.eco.tp.remove(user_id, price3);
                    if (cashback > 0) {
                         await API.eco.money.add(user_id, cashback);
                         await API.eco.addToHistory(user_id, `Cashback Máquina | + ${API.utils.format(cashback)} ${API.moneyemoji}`); // eco.addToHistory não usa DB, ok
                    }
                    await API.eco.addToHistory(user_id, `Compra ${product.icon || ''} ${product.name} | - ${formatPriceString}`); // eco.addToHistory não usa DB, ok

                     // Log da compra (Usa API.EmbedBuilder, API.client.channels)
                     try {
                         const logEmbed = new API.EmbedBuilder()
                             .setColor('#45d948')
                             .setTimestamp()
                             .setTitle('<:shop:788945462215835648> | Log de compra')
                             .addFields({ name: '<:arrow:737370913204600853> Produto', value: `${product.icon || ''} ${product.name} (\`id: ${product.id}\`)`})
                             .addFields({ name: '<:arrow:737370913204600853> Preço', value: `${formatPriceString}`})
                             .addFields({ name: '<:mention:788945462283075625> Membro', value: `${interaction.user.tag} (\`${interaction.user.id}\`)`})
                             .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

                         const logChannel = API.client.channels.cache.get('826177953796587530');
                         if (logChannel?.send) await logChannel.send({ embeds: [logEmbed] });
                     } catch (logError) { console.warn("[ShopExt.execute] Falha ao enviar log de compra:", logError); }

                    // Embed de Sucesso (Usa API.EmbedBuilder)
                    purchaseResultEmbed = new API.EmbedBuilder()
                        .setColor('#5bff45')
                        .setTitle('✅ Compra Realizada!')
                        .setDescription(`Você comprou **${product.icon || ''} ${product.name}** por **${formatPriceString}**.`)
                        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
                    if (cashback > 0) {
                         purchaseResultEmbed.setDescription(purchaseResultEmbed.data.description + `\nVocê recebeu **${API.utils.format(cashback)} ${API.moneyemoji}** de cashback!`);
                    }
                    if (product.type == 5) purchaseResultEmbed.setFooter({ text: "Use /maquina para ver seus chipes!" });

                } catch (purchaseError) {
                     console.error(`[ERRO][ShopExt.execute] Falha ao processar compra para ${user_id}, produto ${product.id}:`, purchaseError);
                     errorMessage = `Ocorreu um erro ao tentar processar sua compra: ${purchaseError.message}`;
                     purchaseSuccess = false;
                     // Usa API.EmbedBuilder
                     purchaseResultEmbed = new API.EmbedBuilder()
                         .setColor('#a60000')
                         .setTitle('❌ Falha na Compra')
                         .setDescription(errorMessage)
                         .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
                }
            } // --- FIM: Lógica de Processamento da Compra ---

        } else if (collectedInteraction.customId === cancelId) {
            // Compra Cancelada
            await collectedInteraction.deferUpdate();
            // Usa API.EmbedBuilder
            purchaseResultEmbed = new API.EmbedBuilder()
                .setColor('#a60000')
                .setTitle('❌ Compra Cancelada')
                .setDescription(`Você cancelou a compra de **${product.icon || ''} ${product.name}**.`)
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
        }

    } catch (error) {
        // Coletor expirou (timeout) ou outro erro
        if (error.code === 'InteractionCollectorError' || error.name === 'InteractionCollectorError') { // Verifica code ou name
             // Usa API.EmbedBuilder
             purchaseResultEmbed = new API.EmbedBuilder()
                .setColor('#a60000')
                .setTitle('⏰ Tempo Expirado')
                .setDescription(`A confirmação da compra expirou.`)
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
        } else {
            console.error("[ERRO][ShopExt.execute] Falha no coletor de confirmação:", error);
             // Usa API.EmbedBuilder
             purchaseResultEmbed = new API.EmbedBuilder()
                .setColor('#a60000')
                .setTitle('❌ Erro')
                .setDescription(`Ocorreu um erro inesperado durante a confirmação.`)
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });
        }
    }

    // 7. Edita a mensagem final
    try {
        if (!purchaseResultEmbed) {
             // Usa API.EmbedBuilder
             purchaseResultEmbed = new API.EmbedBuilder().setColor('#a60000').setDescription("Ocorreu um erro inesperado.");
        }
        // Tenta editar a mensagem de confirmação (que pode ser a da loja ou a resposta da interação)
        await confirmMessage.edit({ embeds: [purchaseResultEmbed], components: [] });
    } catch (finalEditError) {
         // Ignora erro se a mensagem foi deletada
         if (finalEditError.code !== 10008) { // Unknown Message
             console.error("[ERRO][ShopExt.execute] Falha ao editar mensagem final:", finalEditError);
             // Tenta enviar como followUp se a edição falhar
             try { await interaction.followUp({ embeds: [purchaseResultEmbed], ephemeral: true }); } catch {}
         }
    }
};


/**
 * Aplica descontos aleatórios aos itens da loja (modifica obj2).
 */
shopExtension.forceDiscount = async function() {
    // Requer a API DENTRO da função
    const API = require('../index');
    console.log("[ShopExt] Aplicando descontos aleatórios...");
    // Acessa API.utils AQUI e usa this.obj
    this.obj2 = API.utils.clone(this.obj);

    const categories = Object.keys(this.obj2); // Usa this.obj2

    for (const category of categories) {
        if (Array.isArray(this.obj2[category])) {
            const productsInCategory = this.obj2[category];
            if (productsInCategory.length === 0) continue;

            const numItemsWithDiscount = Math.max(1, Math.floor(productsInCategory.length / 4));

            const itemsToDiscountIndices = new Set();
            while (itemsToDiscountIndices.size < numItemsWithDiscount && itemsToDiscountIndices.size < productsInCategory.length) {
                // Acessa API.utils AQUI
                const randomIndex = API.utils.random(0, productsInCategory.length - 1);
                itemsToDiscountIndices.add(randomIndex);
            }

            itemsToDiscountIndices.forEach(index => {
                // Acessa API.utils AQUI
                this.obj2[category][index].discount = API.utils.random(1, 10);
            });
        }
    }
    console.log("[ShopExt] Novos descontos aplicados.");
};

// REMOVIDO auto-load da loja e itens na inicialização do módulo

module.exports = shopExtension;