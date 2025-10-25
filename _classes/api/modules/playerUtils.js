// _classes/api/modules/playerUtils.js

const API = require('../index'); // Importa API centralizada
const DatabaseManager = API.DatabaseManager; // Usa a instância do DBManager

const playerUtils = {
  cooldown: {},
  stamina: {}
};

// --- Sistema de Experiência ---

/**
 * Adiciona experiência ao jogador e lida com level up.
 * @param {Interaction} interaction - Objeto da interação do Discord.
 * @param {number} xpp - Quantidade de XP base a adicionar.
 * @param {boolean} pure - Se true, não aplica bônus de tier da máquina.
 * @returns {Promise<number>} A quantidade de XP efetivamente adicionada.
 */
playerUtils.execExp = async function(interaction, xpp, pure) {
    if (!interaction?.user || xpp == null) return 0; // Verifica interaction e user

    const userId = interaction.user.id;
    const machinesDoc = await DatabaseManager.findOne('machines', { user_id: userId });

    // Se o usuário não tem registro em 'machines', cria um padrão ou retorna
    if (!machinesDoc) {
        console.warn(`[PlayerUtils] Documento 'machines' não encontrado para ${userId}. Não foi possível adicionar XP.`);
        // Opcional: Criar um documento padrão aqui se necessário
        // await DatabaseManager.insertOne('machines', { user_id: userId, level: 1, xp: 0, totalxp: 0, machine: 0, ... });
        return 0;
    }

    const currentLevel = machinesDoc.level || 1; // Padrão nível 1
    const currentXp = machinesDoc.xp || 0;
    const machineId = machinesDoc.machine || 0;
    const maq = API.shopExtension.getProduct(machineId) || { tier: 0 }; // Objeto padrão se máquina não encontrada

    const xpToAdd = pure ? Math.round(xpp) : Math.round((xpp * (maq.tier + 1)) / 1.35);
    const xpNeeded = currentLevel * 1980; // XP necessário para o próximo nível
    let finalXp = currentXp + xpToAdd;
    let leveledUp = false;
    let newLevel = currentLevel;

    const updates = { $inc: { totalxp: xpToAdd } }; // Sempre incrementa totalxp

    if (finalXp >= xpNeeded) {
        leveledUp = true;
        newLevel = currentLevel + 1;
        finalXp = finalXp - xpNeeded; // XP restante após upar

        updates.$set = { level: newLevel, xp: finalXp }; // Define novo nível e XP restante
        console.log(`[PlayerUtils] Usuário ${userId} subiu para o nível ${newLevel}!`);
    } else {
        updates.$inc.xp = xpToAdd; // Apenas incrementa XP atual
    }

    // Atualiza o banco de dados
    await DatabaseManager.updateOne('machines', { user_id: userId }, updates);

    // Lógica de Level Up (Mensagem, Recompensas)
    if (leveledUp) {
        let slotGain = false;
        if (newLevel % 6 === 0) {
            // Calcula quantos slots deveriam ter no novo nível
            const expectedSlots = Math.floor(newLevel / 6);
            if (expectedSlots > 0 && expectedSlots <= 5) { // Limite de 5 slots
                // Verifica quantos slots o usuário JÁ tem (precisaria buscar o doc de novo ou adicionar 'slots' ao projection inicial)
                // Assumindo que a recompensa é dada a cada 6 níveis
                 slotGain = true;
                // A lógica real de adicionar slot pode precisar ir para outro lugar
                // ou ser feita aqui com $push ou $set no array 'slots' (se existir)
            }
        }

        try {
            const levelupImageAttachment = await API.img.imagegens.get('levelup')?.(API, { // Optional chaining no get
                level: currentLevel, // Nível antigo
                avatar: interaction.user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }),
            });

            const embed = new API.EmbedBuilder()
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
                .setFooter({ text: `Você evoluiu do nível ${currentLevel} para o nível ${newLevel}` })
                .setColor('Random');

            if (levelupImageAttachment) {
                 embed.setImage(`attachment://${levelupImageAttachment.name || 'image.png'}`); // Usa o nome do anexo
            }

            let rewardText = `**3x <:caixaup:782307290295435304> Caixa up**!\nUtilize \`/mochila\` para visualizar suas caixas.`;
            if (newLevel === 3) rewardText += `\n \nVocê liberou acesso ao sistema de **EMPRESAS**!`;
            if (newLevel === 10) rewardText += `\n \nVocê liberou acesso a **CRIAÇÃO DE EMPRESAS**! Utilize \`/abrirempresa\`.`;
            if (slotGain) rewardText += `\n \nVocê recebeu **+1 Slot de Aprimoramento**! Use \`/maquina\`.`;

            embed.addFields({ name: `🥇 Recompensas Nv. ${newLevel}`, value: rewardText });

            API.crateExtension.give(userId, 2, 3);

            // Envia a mensagem no canal da interação
            await interaction.channel?.send({ // Optional chaining no channel
                 content: `${interaction.user}`, // Menção
                 embeds: [embed],
                 files: levelupImageAttachment ? [levelupImageAttachment] : [] // Adiciona anexo se existir
             }).catch(err => console.error("[PlayerUtils] Erro ao enviar mensagem de level up:", err));

        } catch (levelUpError) {
             console.error(`[ERRO][PlayerUtils] Falha ao processar level up para ${userId}:`, levelUpError);
             if(API.client?.emit) API.client.emit('error', levelUpError);
        }
    }

    return xpToAdd; // Retorna o XP que foi efetivamente considerado
};


// --- Sistema de Cooldowns ---

/**
 * Obtém o tempo restante de um cooldown em milissegundos.
 * @param {string} user_id - ID do usuário.
 * @param {string} cooldownName - Nome do cooldown (será o nome do campo no documento).
 * @returns {Promise<number>} Tempo restante em ms (0 se não estiver em cooldown).
 */
playerUtils.cooldown.get = async function(user_id, cooldownName) {
    if (!cooldownName) return 0; // Nome inválido

    // Busca apenas o campo específico do cooldown
    const projection = { projection: { [cooldownName]: 1 } };
    const doc = await DatabaseManager.findOne('cooldowns', { user_id: user_id }, projection);

    const cooldownData = doc?.[cooldownName]; // Acessa o campo dinamicamente

    if (!cooldownData || typeof cooldownData.timestamp !== 'number' || typeof cooldownData.duration !== 'number') {
        return 0; // Cooldown não existe ou está mal formatado
    }

    const timePassed = (Date.now() - cooldownData.timestamp) / 1000; // Tempo passado em segundos
    const timeLeft = cooldownData.duration - timePassed; // Tempo restante em segundos

    return Math.max(0, Math.round(timeLeft * 1000)); // Retorna em ms, mínimo 0
};

/**
 * Define um cooldown para um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {string} cooldownName - Nome do cooldown.
 * @param {number} durationSeconds - Duração do cooldown em segundos.
 */
playerUtils.cooldown.set = async function(user_id, cooldownName, durationSeconds) {
    if (!cooldownName) return; // Nome inválido
    const value = Number(durationSeconds) || 0;
    if (value < 0) return; // Duração não pode ser negativa

    const filter = { user_id: user_id };
    // Armazena o timestamp de início e a duração
    const update = { $set: { [cooldownName]: { timestamp: Date.now(), duration: value } } };
    await DatabaseManager.updateOne('cooldowns', filter, update, { upsert: true });
};

/**
 * Verifica se um usuário está em um determinado cooldown.
 * @param {string} user_id - ID do usuário.
 * @param {string} cooldownName - Nome do cooldown.
 * @returns {Promise<boolean>} True se estiver em cooldown, false caso contrário.
 */
playerUtils.cooldown.check = async function(user_id, cooldownName) {
  let time = await playerUtils.cooldown.get(user_id, cooldownName);
  return time > 0;
};

/**
 * Envia uma mensagem de cooldown para o usuário.
 * @param {Interaction} interaction - Objeto da interação.
 * @param {string} cooldownName - Nome do cooldown.
 * @param {string} actionText - Texto descrevendo a ação (ex: "digitar outro comando").
 * @returns {Promise<Message|null>} A mensagem de resposta enviada ou null.
 */
playerUtils.cooldown.message = async function(interaction, cooldownName, actionText) {
  let cooldownTime = await playerUtils.cooldown.get(interaction.user.id, cooldownName);
  if (cooldownTime <= 0) return null; // Não envia mensagem se não houver cooldown

  const embed = new API.EmbedBuilder()
      .setColor('#b8312c')
      .setDescription(`🕑 Aguarde mais \`${API.utils.ms(cooldownTime)}\` para ${actionText}.`)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

   try {
       // Tenta responder à interação (ephemeral se possível)
       if (interaction.replied || interaction.deferred) {
            return await interaction.editReply({ embeds: [embed], ephemeral: true });
       } else {
            return await interaction.reply({ embeds: [embed], ephemeral: true });
       }
   } catch (error) {
       console.error(`[PlayerUtils] Erro ao enviar mensagem de cooldown para ${interaction.user.id}:`, error);
       // Tenta enviar no canal como fallback se a resposta falhar
       try {
            return await interaction.channel?.send({ embeds: [embed] });
       } catch {
            return null; // Falha total
       }
   }
};


// --- Sistema de Maestria ---

/**
 * Adiciona pontos de maestria a um usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} value - Quantidade a adicionar.
 */
playerUtils.addMastery = async function(user_id, value) {
  await DatabaseManager.increment(user_id, 'players', 'mastery', value, 'user_id');
};

/**
 * Obtém os pontos de maestria de um usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Pontos de maestria (padrão 0).
 */
playerUtils.getMastery = async function (user_id) {
  const doc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { mastery: 1 } });
  return doc?.mastery || 0;
};


// --- Sistema de Stamina (Usando Timestamp) ---
// Constantes para Stamina
const MAX_STAMINA = 1000;
const STAMINA_REGEN_INTERVAL_SECONDS = 30; // A cada 30 segundos regenera 1 ponto

/**
 * Obtém a stamina atual do usuário.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Stamina atual (0 a MAX_STAMINA).
 */
playerUtils.stamina.get = async function(user_id) {
    const doc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { staminaTimestamp: 1 } });
    const timestampWhenFull = doc?.staminaTimestamp || 0; // Timestamp (ms) de quando a stamina estará cheia

    const now = Date.now();
    if (now >= timestampWhenFull) {
        return MAX_STAMINA; // Já está cheia
    }

    const msRemaining = timestampWhenFull - now;
    const secondsRemaining = Math.ceil(msRemaining / 1000); // Segundos restantes arredondados para cima
    const pointsToRegen = Math.floor(secondsRemaining / STAMINA_REGEN_INTERVAL_SECONDS); // Quantos pontos ainda faltam regenerar

    // Stamina atual é o máximo menos o que falta regenerar
    const currentStamina = MAX_STAMINA - pointsToRegen;

    return Math.max(0, currentStamina); // Garante que não seja negativo
};

/**
 * Obtém o tempo restante (em ms) até a stamina ficar cheia.
 * @param {string} user_id - ID do usuário.
 * @returns {Promise<number>} Tempo restante em ms (0 se já estiver cheia).
 */
playerUtils.stamina.time = async function(user_id) {
    const doc = await DatabaseManager.findOne('players', { user_id: user_id }, { projection: { staminaTimestamp: 1 } });
    const timestampWhenFull = doc?.staminaTimestamp || 0;

    const now = Date.now();
    const msRemaining = timestampWhenFull - now;

    return Math.max(0, msRemaining); // Retorna tempo restante ou 0
};

/**
 * Define o timestamp (em ms) de quando a stamina estará cheia.
 * Usado internamente por subset, add, remove.
 * @param {string} user_id - ID do usuário.
 * @param {number} timestampMs - O timestamp em milissegundos.
 */
playerUtils.stamina.set = async function(user_id, timestampMs) {
    const value = Number(timestampMs) || 0;
    await DatabaseManager.set(user_id, 'players', 'staminaTimestamp', value, 'user_id');
};

/**
 * Define a stamina do usuário para um valor específico, calculando o timestamp futuro.
 * @param {string} user_id - ID do usuário.
 * @param {number} targetStamina - O valor de stamina desejado (0 a MAX_STAMINA).
 */
playerUtils.stamina.subset = async function(user_id, targetStamina) {
    const safeTarget = Math.max(0, Math.min(MAX_STAMINA, Number(targetStamina) || 0));
    const pointsNeeded = MAX_STAMINA - safeTarget; // Pontos que precisam regenerar
    const secondsToRegen = pointsNeeded * STAMINA_REGEN_INTERVAL_SECONDS;
    const newTimestampWhenFull = Date.now() + (secondsToRegen * 1000);
    await playerUtils.stamina.set(user_id, newTimestampWhenFull);
};

/**
 * Remove stamina do usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} value - Quantidade a remover.
 */
playerUtils.stamina.remove = async function(user_id, value) {
  const currentStamina = await playerUtils.stamina.get(user_id);
  const newValue = currentStamina - (Number(value) || 0);
  await playerUtils.stamina.subset(user_id, newValue);
};

/**
 * Adiciona stamina ao usuário.
 * @param {string} user_id - ID do usuário.
 * @param {number} value - Quantidade a adicionar.
 */
playerUtils.stamina.add = async function(user_id, value) {
  const currentStamina = await playerUtils.stamina.get(user_id);
  const newValue = currentStamina + (Number(value) || 0);
  await playerUtils.stamina.subset(user_id, newValue);
};

module.exports = playerUtils;