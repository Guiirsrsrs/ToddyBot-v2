// _classes/api/modules/maqExtension.js

// Requer a API DENTRO das funções que a utilizam
require('colors'); // Para logs

const maqExtension = {
    cot: {}, // Armazena a cotação atual
    proxcot: 0 // Timestamp da próxima atualização de cotação
};

/**
 * Inicia o processo de mineração para um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {Interaction} interaction - Objeto da interação (para enviar mensagens).
 * @returns {Promise<void>}
 */
maqExtension.startMining = async function(user_id, interaction) {
    // Requer a API aqui
    const API = require('../index');
    console.log(`[MaqExt] Iniciando mineração para ${user_id}`);

    try {
        // 1. Busca dados da máquina e jogador
        // ALTERADO: Usando API.db
        const machineDoc = await API.db.findOne('machines', { user_id: user_id });
        const playerDoc = await API.db.findOne('players', { user_id: user_id }); // Para stamina e localização

        if (!machineDoc || !playerDoc) {
            console.warn(`[MaqExt] Dados não encontrados para ${user_id} ao iniciar mineração.`);
            await interaction.reply({ content: "❌ Ocorreu um erro ao buscar seus dados. Tente novamente.", ephemeral: true });
            return;
        }

        // 2. Validações
        const machineId = machineDoc.machine;
        // Usa API.shopExtension (que já usa this)
        const machineData = API.shopExtension.getProduct(machineId);
        const playerLocation = playerDoc.location || 1; // Padrão localização 1
        const playerStamina = await API.playerUtils.stamina.get(user_id); // Usa playerUtils atualizado

        if (machineId === 0 || !machineData) {
            await interaction.reply({ content: "❌ Você não tem uma máquina equipada para minerar! Compre uma na `/loja`.", ephemeral: true });
            return;
        }
        if (machineDoc.durability <= 0) {
            await interaction.reply({ content: `❌ Sua **${machineData.icon} ${machineData.name}** está quebrada! Conserte-a na \`/loja\` (categoria Conserto).`, ephemeral: true });
            return;
        }
        if (playerStamina <= 0) {
             const timeUntilFull = await API.playerUtils.stamina.time(user_id);
            await interaction.reply({ content: `❌ Você está sem **<:stamina:919946658903658496> Stamina**! Aguarde ${timeUntilFull > 0 ? API.utils.ms(timeUntilFull) + ' para regenerar' : 'regenerar'}.`, ephemeral: true });
            return;
        }
        // Verifica se já está minerando (Assume que API.cacheLists está pronto e corrigido)
        if (API.cacheLists.waiting.includes(user_id, 'mining')) { // TODO: Corrigir API.cacheLists.waiting
            await interaction.reply({ content: "❌ Você já está minerando!", ephemeral: true });
            return;
        }
        // Verifica localização (mineração só na localização 1?)
        if (playerLocation !== 1) {
            await interaction.reply({ content: "❌ Você só pode minerar na **Vila Principal** (Localização 1)! Use `/mover 1`.", ephemeral: true });
            return;
        }

        // 3. Resposta inicial e adiciona à lista de espera
        const miningTimeSeconds = 60; // Tempo fixo de 1 minuto por ciclo
        await interaction.reply({ content: `<a:mining:759371078713737237> Mineração iniciada! Você receberá os resultados em \`${miningTimeSeconds} segundos\`.`, ephemeral: true });
        API.cacheLists.waiting.push(user_id, 'mining'); // TODO: Corrigir API.cacheLists.waiting

        // 4. Agenda a finalização da mineração
        setTimeout(async () => {
            try {
                await this.completeMining(user_id, interaction); // Chama a função de completar
            } catch (completionError) {
                 console.error(`[ERRO][MaqExt.startMining] Falha ao completar mineração para ${user_id}:`, completionError);
                 // Tenta notificar o usuário sobre o erro
                 try {
                      await interaction.followUp({ content: "❌ Ocorreu um erro ao finalizar sua mineração. Tente minerar novamente.", ephemeral: true });
                 } catch {}
                 // Remove da lista de espera mesmo se falhar
                 API.cacheLists.waiting.remove(user_id, 'mining'); // TODO: Corrigir API.cacheLists.waiting
            }
        }, miningTimeSeconds * 1000);

    } catch (err) {
        console.error(`[ERRO][MaqExt.startMining] Falha ao iniciar mineração para ${user_id}:`, err);
        await interaction.reply({ content: "❌ Ocorreu um erro inesperado ao iniciar a mineração.", ephemeral: true });
        API.cacheLists.waiting.remove(user_id, 'mining'); // TODO: Corrigir API.cacheLists.waiting
        if (API.client?.emit) API.client.emit('error', err);
    }
};

/**
 * Finaliza o processo de mineração, calcula recompensas e atualiza o DB.
 * @param {string} user_id - ID do usuário.
 * @param {Interaction} interaction - Objeto da interação original.
 * @returns {Promise<void>}
 */
maqExtension.completeMining = async function(user_id, interaction) {
    // Requer a API aqui
    const API = require('../index');
    console.log(`[MaqExt] Finalizando mineração para ${user_id}`);

    // Remove da lista de espera ANTES de processar
    API.cacheLists.waiting.remove(user_id, 'mining'); // TODO: Corrigir API.cacheLists.waiting

    try {
        // 1. Busca dados atualizados da máquina e jogador
        // ALTERADO: Usando API.db
        const machineDoc = await API.db.findOne('machines', { user_id: user_id });
        const playerDoc = await API.db.findOne('players', { user_id: user_id }); // Para localização (embora já validado)

        if (!machineDoc || !playerDoc) {
            console.warn(`[MaqExt] Dados não encontrados para ${user_id} ao finalizar mineração.`);
            await interaction.followUp({ content: "❌ Ocorreu um erro ao buscar seus dados para finalizar a mineração.", ephemeral: true });
            return;
        }

        // 2. Validações (redundantes, mas seguras)
        const machineId = machineDoc.machine;
        // Usa API.shopExtension (que já usa this)
        const machineData = API.shopExtension.getProduct(machineId);

        if (machineId === 0 || !machineData) {
             await interaction.followUp({ content: "❌ Sua máquina foi removida durante a mineração.", ephemeral: true });
             return;
        }
        // Não valida durabilidade aqui, pois ela é gasta durante o cálculo

        // 3. Calcula Recompensas (Lógica principal de mineração)
        const rewards = { xp: 0, items: [], durabilityLoss: 0, staminaCost: 0 };
        const machineTier = machineData.tier || 0;
        const playerLevel = machineDoc.level || 1;
        const allOres = API.itemExtension.getObj()?.minerios || []; // Acesso seguro

        // Custo de Stamina e Perda de Durabilidade baseados no tier
        rewards.staminaCost = Math.max(1, 10 + machineTier * 5); // Ex: 10, 15, 20...
        rewards.durabilityLoss = Math.max(1, Math.round(1 + machineTier * 0.5)); // Ex: 1, 2, 2, 3...

        // Verifica stamina ANTES de gastar
        const currentStamina = await API.playerUtils.stamina.get(user_id);
        if (currentStamina < rewards.staminaCost) {
             await interaction.followUp({ content: `❌ Você ficou sem **<:stamina:919946658903658496> Stamina** durante a mineração e não obteve nada!`, ephemeral: true });
             return; // Não prossegue se não tem stamina suficiente no final
        }

        // --- Lógica de Geração de Minérios ---
        const itemsFound = new Map(); // Usar Map para agrupar itens encontrados
        const numRolls = 3 + machineTier; // Mais rolagens com tiers maiores

        for (let i = 0; i < numRolls; i++) {
             // Lógica de chance baseada no tier da máquina e profundidade do minério
             // Exemplo simplificado: Maior chance de tiers baixos, menor de altos
             const randomChance = Math.random() * 100;
             let foundOre = null;

             // Tenta encontrar um minério baseado na chance e no tier da máquina
             // (Itera de tiers mais altos para mais baixos?)
             for (let oreTier = Math.min(allOres.length - 1, machineTier + 2); oreTier >= 0; oreTier--) {
                  const ore = allOres[oreTier];
                  if (!ore) continue;

                  // Chance base + bônus/redutor por tier da máquina vs tier do minério
                  let baseChance = 15 - (oreTier * 2); // Chance diminui para tiers maiores
                  let tierDifferenceBonus = (machineTier - oreTier) * 3; // Bônus se máquina for melhor
                  let finalChance = Math.max(1, baseChance + tierDifferenceBonus); // Chance mínima de 1%

                  if (randomChance < finalChance) {
                       foundOre = ore;
                       break; // Encontrou um minério, para a busca neste roll
                  }
             }

             if (foundOre) {
                  const currentAmount = itemsFound.get(foundOre.id) || 0;
                  itemsFound.set(foundOre.id, currentAmount + 1);
                  rewards.xp += (foundOre.xp || 0); // Adiciona XP base do minério
             }
        }
        // Converte o Map para o formato do array de recompensas
        itemsFound.forEach((qnt, id) => { rewards.items.push({ id: id, qnt: qnt }); });


        // 4. Atualiza DB (Stamina, Durabilidade, Itens, XP)
        const updates = {
            $inc: {
                durability: -rewards.durabilityLoss, // Decrementa durabilidade
                // XP é tratado pela função execExp
            }
        };
        // ALTERADO: Usando API.db
        await API.db.updateOne('machines', { user_id: user_id }, updates);
        await API.playerUtils.stamina.remove(user_id, rewards.staminaCost); // Remove stamina

        // Adiciona itens ao inventário
        for (const item of rewards.items) {
            await API.itemExtension.add(user_id, item.id, item.qnt); // itemExtension já usa API.db
        }

        // Adiciona XP (que lida com level up)
        await API.playerUtils.execExp(interaction, rewards.xp, false); // playerUtils já usa API.db

        // 5. Gera Embed de Resultado
        const embedResult = new API.EmbedBuilder()
            .setColor('#7a38ff')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle('<a:mining:759371078713737237> Mineração Concluída!');

        let description = `Você gastou **${rewards.staminaCost} <:stamina:919946658903658496>** e **${rewards.durabilityLoss} 🔩**.\n`;
        description += `Você ganhou **${rewards.xp} XP**.\n\n**Itens Obtidos:**\n`;

        if (rewards.items.length > 0) {
            rewards.items.forEach(item => {
                const itemData = API.itemExtension.get(item.id); // Pega dados do item
                description += `${itemData?.icon || '?'} **${item.qnt}x** ${itemData?.name || `ID ${item.id}`}\n`;
            });
        } else {
            description += "*Nenhum minério encontrado desta vez.*";
        }

        const finalDurability = Math.max(0, machineDoc.durability - rewards.durabilityLoss);
        if (finalDurability === 0) {
             description += `\n\n**⚠️ Sua ${machineData.icon} ${machineData.name} quebrou!** Conserte-a na \`/loja\`.`;
             embedResult.setColor('#a60000'); // Cor vermelha para indicar que quebrou
        } else {
             embedResult.setFooter({ text: `Durabilidade restante: ${finalDurability}/${machineData.durability}`});
        }

        embedResult.setDescription(description);

        // 6. Envia o resultado
        await interaction.followUp({ embeds: [embedResult], ephemeral: false }); // Não efêmero para mostrar o resultado

    } catch (err) {
        console.error(`[ERRO][MaqExt.completeMining] Falha ao finalizar mineração para ${user_id}:`, err);
        // Tenta enviar mensagem de erro genérica
        try {
            await interaction.followUp({ content: "❌ Ocorreu um erro ao processar os resultados da sua mineração.", ephemeral: true });
        } catch {}
        API.cacheLists.waiting.remove(user_id, 'mining'); // Garante remoção em caso de erro // TODO: Corrigir cacheLists
        if (API.client?.emit) API.client.emit('error', err);
    }
};

/**
 * Calcula e atualiza a cotação dos minérios.
 * @returns {Promise<object>} O objeto da nova cotação.
 */
maqExtension.forceCot = async function() {
    // Requer a API aqui
    const API = require('../index');
    console.log("[MaqExt] Atualizando cotação dos minérios...".cyan);
    const newCot = {};
    const allOres = API.itemExtension.getObj()?.minerios || []; // Acesso seguro

    allOres.forEach(ore => {
        if (ore.id === undefined || ore.price === undefined) return; // Pula minérios malformados

        const basePrice = ore.price;
        // Lógica de variação de preço (Exemplo: +/- 15% do preço base)
        const minVariation = 0.85; // -15%
        const maxVariation = 1.15; // +15%
        const randomFactor = Math.random() * (maxVariation - minVariation) + minVariation;
        const newPrice = Math.max(1, Math.round(basePrice * randomFactor)); // Preço mínimo de 1

        newCot[ore.id] = newPrice;
    });

    this.cot = newCot; // Atualiza cotação em memória
    this.proxcot = Date.now() + (API.getConfig().modules.cotacao * 60000); // Atualiza timestamp da próxima

    // Salva a nova cotação no banco de dados (documento 'globals')
    const filter = { _id: API.id }; // ID global (pode ser o ID do bot)
    const update = { $set: { cotacao: this.cot } };
    try {
        // ALTERADO: Usando API.db
        await API.db.updateOne('globals', filter, update, { upsert: true });
        console.log(`[MaqExt] Nova cotação com ${Object.keys(this.cot).length} minérios salva no DB.`);
    } catch (err) {
        console.error("[ERRO][MaqExt.forceCot] Falha ao salvar cotação no DB:", err);
        if (API.client?.emit) API.client.emit('error', err);
        // A cotação em memória ainda está atualizada, mas não persistiu
    }

    return this.cot;
};

/**
 * Obtém a cotação atual dos minérios.
 * @returns {object} Objeto da cotação.
 */
maqExtension.getCot = function() {
    // Retorna a cotação em memória
    return this.cot;
};

/**
 * Obtém o timestamp (ms) da próxima atualização de cotação.
 * @returns {number} Timestamp em milissegundos.
 */
maqExtension.getProxCot = function() {
    return this.proxcot;
};


/**
 * Carrega a cotação do banco de dados ao iniciar.
 * (Deve ser chamado após a conexão com o DB estar pronta)
 */
maqExtension.loadCot = async function() {
    // Requer a API aqui
    const API = require('../index');
    console.log("[MaqExt] Carregando cotação do banco de dados...".yellow);
    try {
        const filter = { _id: API.id };
        const options = { projection: { cotacao: 1 } };
        // ALTERADO: Usando API.db
        const globalDoc = await API.db.findOne('globals', filter, options);

        if (globalDoc && globalDoc.cotacao && Object.keys(globalDoc.cotacao).length > 0) {
            this.cot = globalDoc.cotacao;
            console.log(`[MaqExt] Cotação com ${Object.keys(this.cot).length} minérios carregada do DB.`);
        } else {
            console.warn("[MaqExt] Nenhuma cotação encontrada no DB. Gerando uma nova...");
            await this.forceCot(); // Gera e salva uma nova se não existir
        }
    } catch (err) {
        console.error("[ERRO][MaqExt.loadCot] Falha ao carregar cotação do DB:", err);
        if (API.client?.emit) API.client.emit('error', err);
        // Tenta gerar uma nova como fallback
        console.warn("[MaqExt] Gerando nova cotação como fallback...");
        await this.forceCot();
    }
};

// REMOVIDO: Auto-carregamento da cotação ao importar o módulo.
// Isso será chamado pelo client.start() ou pelo events.js load()

module.exports = maqExtension;