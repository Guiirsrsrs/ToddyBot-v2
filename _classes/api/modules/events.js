// _classes/api/modules/events.js

const API = require('../index'); // API centralizada (que agora contém API.db)
// REMOVIDO: Instância local não é mais necessária
// const DatabaseManager = API.DatabaseManager; 
const config = require('../../config'); // Config principal
const { ChannelType } = require('discord.js'); // Importar ChannelType para verificação
require('colors'); // Para logs

// Estado dos eventos (em memória)
const events = {
    treasure: { loc: 0, update: 5, profundidade: 0, pos: {}, picked: false },
    duck: { loc: 0, sta: 0, level: 0, pos: {}, killed: [] },
    race: {
        time: (config.modules?.events?.race?.time || 15) * 60 * 1000, // Tempo padrão 15 min
        started: 0,
        rodando: false,
        interactionid: null, // Usar null como padrão para ID de interação/mensagem
        vencedor: 0,
        apostas: { laranja: [], vermelho: [], roxo: [] }
    },
};

/**
 * Gera o Embed para o evento da Corrida de Cavalos.
 * @param {number} [aposta] - Valor da aposta do usuário atual (opcional).
 * @returns {EmbedBuilder} Embed formatado.
 */
events.getRaceEmbed = function(aposta) {
    const embed = new API.EmbedBuilder() // Usa o EmbedBuilder da API
        .setColor('#36393f')
        .setTitle('🐎 Evento | Corrida de Cavalos');

    const inv = '<:inv:781993473331036251>';
    const inv2 = '<:inv2:838584020547141643>';
    const inv3 = '<:inv3:838584020571783179>';
    const inv4 = '<:inv4:838584020257734667>';

    const raceState = events.race; // Usa o estado em memória
    const vencedor = raceState.vencedor;
    const tempoRestanteMs = raceState.started > 0 ? raceState.time - (Date.now() - raceState.started) : 0;

    // Calcula totais das apostas (lógica mantida)
    let apostasLaranja = raceState.apostas.laranja.reduce((sum, bet) => sum + (bet.aposta || 0), 0);
    let apostasVermelho = raceState.apostas.vermelho.reduce((sum, bet) => sum + (bet.aposta || 0), 0);
    let apostasRoxo = raceState.apostas.roxo.reduce((sum, bet) => sum + (bet.aposta || 0), 0);

    embed.addFields({
        name: '<:info:736274028515295262> Informações',
        value: (aposta ? `Sua aposta: \`${API.utils.format(aposta)} ${API.money}\` ${API.moneyemoji}\n` : '') +
               'Você receberá **1.5x** (50% de lucro) se acertar o cavalo vencedor.\nUse `/apostarcavalo <cavalo> <valor>` para apostar!' // Atualizar comando
    });

    embed.addFields({
         name: raceState.rodando && tempoRestanteMs > 0 ? `⏰ Tempo restante: ${API.utils.ms2(tempoRestanteMs)}` : '🏁 Corrida Finalizada!',
         value: `
 ${vencedor === 1 ? '🎉|🏇' : '🏁|' + inv2}${vencedor !== 0 && vencedor !== 1 ? '🏇' : inv2}${inv2.repeat(3)}|${vencedor !== 0 ? inv : '🏇'}🟧${inv}\`${API.utils.format(apostasLaranja)} ${API.money}\` ${API.moneyemoji}
 ${vencedor === 2 ? '🎉|🏇' : '🏁|' + inv3}${vencedor !== 0 && vencedor !== 2 ? '🏇' : inv3}${inv3.repeat(3)}|${vencedor !== 0 ? inv : '🏇'}🟥${inv}\`${API.utils.format(apostasVermelho)} ${API.money}\` ${API.moneyemoji}
 ${vencedor === 3 ? '🎉|🏇' : '🏁|' + inv4}${vencedor !== 0 && vencedor !== 3 ? '🏇' : inv4}${inv4.repeat(3)}|${vencedor !== 0 ? inv : '🏇'}🟪${inv}\`${API.utils.format(apostasRoxo)} ${API.money}\` ${API.moneyemoji}
         `
    });

    if (vencedor !== 0) {
        let corVencedor = '';
        let nomeCorVencedor = '';
        switch (vencedor) {
            case 1: corVencedor = '🟧'; nomeCorVencedor = 'laranja'; break;
            case 2: corVencedor = '🟥'; nomeCorVencedor = 'vermelho'; break;
            case 3: corVencedor = '🟪'; nomeCorVencedor = 'roxo'; break;
        }

        const apostasVencedoras = raceState.apostas[nomeCorVencedor] || [];
        const totalApostasVencedoras = apostasVencedoras.reduce((sum, bet) => sum + (bet.aposta || 0), 0);
        const totalApostasGeral = raceState.apostas.laranja.length + raceState.apostas.vermelho.length + raceState.apostas.roxo.length;

        let resultadoTexto = apostasVencedoras.length === 0
            ? '**Não houveram apostas no cavalo vencedor.**'
            : `**Houveram ${totalApostasGeral} apostas no total e ${apostasVencedoras.length} acertaram!**\n` +
              `Um total de \`${API.utils.format(Math.round(totalApostasVencedoras * 1.5))} ${API.money}\` ${API.moneyemoji} foi distribuído.`;

        embed.addFields({ name: `🏆 Vencedor: 🏇${corVencedor}`, value: resultadoTexto });
    }

    return embed;
};

// Função auxiliar para editar a mensagem da corrida (lógica interna mantida)
async function editRace(message) { // Renomeado parâmetro para 'message'
    if (!message) {
         console.warn('[Events.Race] Tentativa de editar mensagem da corrida, mas a mensagem não foi encontrada (pode ter sido deletada).'.yellow);
         // Se a mensagem não existe, a corrida não pode continuar sendo exibida. Limpa o estado.
         if (events.race.rodando) {
              console.warn('[Events.Race] Limpando estado da corrida devido à mensagem perdida.');
              events.race.rodando = false;
              events.race.interactionid = null;
              // Remove do DB também
              // ALTERADO: Usando API.db
              await API.db.updateOne('globals', { _id: API.id }, { $unset: { 'events.race': "" } });
         }
         return;
    }

    const tempoRestanteMs = events.race.started > 0 ? events.race.time - (Date.now() - events.race.started) : 0;

    // Se ainda há tempo
    if (events.race.rodando && tempoRestanteMs > 0) {
        try {
            await message.edit({ embeds: [events.getRaceEmbed()] });
            // Agenda a próxima atualização
            setTimeout(() => { editRace(message); }, 10000); // 10 segundos
        } catch (editError) {
             console.error(`[ERRO][Events.Race] Falha ao editar mensagem da corrida (${message.id}):`, editError);
             // Se falhar ao editar (ex: mensagem deletada), para de tentar
             events.race.rodando = false;
             events.race.interactionid = null;
             // ALTERADO: Usando API.db
             await API.db.updateOne('globals', { _id: API.id }, { $unset: { 'events.race': "" } });
        }
    }
    // Se o tempo acabou
    else if (events.race.rodando && tempoRestanteMs <= 0) {
        console.log('[Events.Race] Tempo da corrida esgotado. Finalizando...'.cyan);
        events.race.rodando = false;
        events.race.vencedor = API.utils.random(1, 3); // Determina o vencedor

        let nomeCorVencedor = '';
        let corVencedorEmoji = '';
        switch (events.race.vencedor) {
            case 1: nomeCorVencedor = 'laranja'; corVencedorEmoji = '🟧'; break;
            case 2: nomeCorVencedor = 'vermelho'; corVencedorEmoji = '🟥'; break;
            case 3: nomeCorVencedor = 'roxo'; corVencedorEmoji = '🟪'; break;
        }

        const apostasVencedoras = events.race.apostas[nomeCorVencedor] || [];
        console.log(`[Events.Race] Vencedor: ${nomeCorVencedor}. ${apostasVencedoras.length} apostas vencedoras.`);

        // Pagar vencedores
        for (const bet of apostasVencedoras) {
            const userId = bet.id;
            const payout = Math.round(bet.aposta * 1.5); // 50% de lucro (Nome da var 'Payout' corrigido para 'payout')
            try {
                 // Usa API.eco (que já foi atualizado para usar API.db)
                 await API.eco.money.add(userId, payout);
                 // await API.eco.money.globalremove(payout); // Lógica de remover do bot (se necessário)
                 await API.eco.addToHistory(userId, `Aposta Corrida 🏇${corVencedorEmoji} | + ${API.utils.format(payout)} ${API.moneyemoji}`);
                 console.log(`[Events.Race] Pagou ${payout} para ${userId}`);
            } catch (payoutError) {
                 console.error(`[ERRO][Events.Race] Falha ao pagar ${payout} para ${userId}:`, payoutError);
                 // Considerar logar falhas de pagamento
            }
        }

        // Atualiza a mensagem final
        try {
             await message.edit({ embeds: [events.getRaceEmbed()] }); // Mostra o resultado final
             console.log('[Events.Race] Mensagem final da corrida atualizada.');
        } catch (finalEditError) {
             console.error(`[ERRO][Events.Race] Falha ao editar mensagem final da corrida (${message.id}):`, finalEditError);
        }

        // Limpa o estado da corrida em memória
        events.race.apostas = { laranja: [], vermelho: [], roxo: [] };
        events.race.interactionid = null;
        events.race.started = 0;
        // Limpa o estado da corrida no DB
        // ALTERADO: Usando API.db
        await API.db.updateOne('globals', { _id: API.id }, { $unset: { 'events.race': "" } });
        console.log('[Events.Race] Estado da corrida limpo.');
    }
}


events.getConfig = function() { return config; };

/**
 * Envia um alerta de evento para o canal configurado.
 * @param {string} text - Descrição do alerta.
 * @returns {Promise<Message|null>} A mensagem enviada ou null em caso de erro.
 */
events.alert = async function(text) {
    const channelId = config.modules?.events?.channel;
    if (!channelId) {
        console.error("[ERRO][Events] ID do canal de eventos não configurado!");
        return null;
    }

    try {
        const channel = await API.client.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.send) {
            console.error(`[ERRO][Events] Canal de eventos (${channelId}) não encontrado ou inválido.`);
            return null;
        }

        const embed = new API.EmbedBuilder()
            .setColor('Random')
            .setTitle("📢 Alerta de Evento!")
            .setDescription(text)
            .setTimestamp()
            .setFooter({ text: "Siga este canal para receber notificações!" });

        // Limpa mensagens antigas (opcional)
        try {
             if (channel.bulkDelete) await channel.bulkDelete(5).catch(() => {}); // Tenta limpar 5
        } catch (deleteError) { console.warn("[Events] Falha ao limpar mensagens antigas no canal de alerta:", deleteError.message); }


        const alertMessage = await channel.send({ embeds: [embed] });

        // Publica se for um canal de anúncios
        // ATUALIZAÇÃO v14: Checar tipo usando ChannelType enum
        if (channel.type === ChannelType.GuildAnnouncement && alertMessage.crosspostable) {
            await alertMessage.crosspost().catch(err => console.warn("[Events] Falha ao publicar alerta:", err.message));
        }

        return alertMessage;

    } catch (err) {
        console.error(`[ERRO][Events] Falha ao enviar alerta para canal ${channelId}:`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return null;
    }
};

// --- Funções para Iniciar Eventos (Tesouro e Pato mantidos em memória) ---

events.forceTreasure = async function(loc) {
    events.treasure.loc = loc || API.utils.random(1, 4); // Usa utils
    try {
        events.treasure.pos = await API.townExtension.getPosByTownNum(events.treasure.loc); // Usa townExtension atualizado
        events.treasure.profundidade = API.utils.random(15, 45); // Usa utils
        events.treasure.picked = false;

        events.alert("<:treasure:807671407160197141> **Tesouro Descoberto!**\nProcure-o pelas vilas e use `/pegartesouro`!");
        console.log(`[Events] Evento Tesouro iniciado na localização ${events.treasure.loc}.`);
    } catch (error) {
         console.error("[ERRO][Events] Falha ao iniciar evento Tesouro:", error);
    }
};

events.forceDuck = async function(loc) {
    events.duck.loc = loc || API.utils.random(1, 4); // Usa utils
    try {
        events.duck.pos = await API.townExtension.getPosByTownNum(events.duck.loc); // Usa townExtension atualizado
        events.duck.level = API.utils.random(30, 50); // Usa utils
        events.duck.sta = API.utils.random(events.duck.level * 16, events.duck.level * 22); // Usa utils
        events.duck.killed = []; // Reseta quem matou

        events.alert(`<:pato:919946658941399091> **Pato Dourado Nv.${events.duck.level} Apareceu!**\nEncontre-o no \`/mapa\` e use \`/patodourado\` para atacar!`);
        console.log(`[Events] Evento Pato Dourado iniciado na localização ${events.duck.loc}.`);
    } catch (error) {
         console.error("[ERRO][Events] Falha ao iniciar evento Pato Dourado:", error);
    }
};

/**
 * Inicia o evento Corrida de Cavalos, salva no DB e inicia o loop de atualização.
 */
events.forceRace = async function() {
    if (events.race.rodando) {
        console.warn("[Events.Race] Tentativa de iniciar corrida enquanto outra já está rodando.");
        return;
    }

    // Reseta estado local
    events.race.started = Date.now();
    events.race.apostas = { laranja: [], vermelho: [], roxo: [] };
    events.race.rodando = true;
    events.race.vencedor = 0;
    events.race.interactionid = null; // Reseta ID da mensagem

    console.log("[Events.Race] Iniciando evento Corrida de Cavalos...".cyan);

    // Envia o alerta inicial
    const alertMessage = await events.alert(`🐎 **Corrida de Cavalos Iniciada!**\nApostas abertas por **${API.utils.ms2(events.race.time)}**.\nUse \`/apostarcavalo <cavalo> <valor>\`.\nAcompanhe em <#${config.modules?.events?.race?.channel || 'ID_CANAL_CORRIDA'}> (Servidor Oficial)`); // Usar ID configurável

    if (!alertMessage) {
        console.error("[ERRO][Events.Race] Falha ao enviar alerta inicial da corrida. Abortando evento.");
        events.race.rodando = false; // Reseta estado
        return;
    }

    // Tenta enviar/encontrar a mensagem principal da corrida no canal específico (opcional)
    let raceMessage = null;
    const raceChannelId = config.modules?.events?.race?.channel; // ID do canal da corrida
    if (raceChannelId) {
        try {
            const raceChannel = await API.client.channels.fetch(raceChannelId).catch(() => null);
            if (raceChannel?.send) { // Verifica se pode enviar mensagens
                 // Tenta encontrar uma mensagem antiga da corrida para editar ou envia uma nova
                 // (Lógica mais complexa, simplificando: envia sempre uma nova)
                 raceMessage = await raceChannel.send({ embeds: [events.getRaceEmbed()] });
                 events.race.interactionid = raceMessage.id; // Salva ID da mensagem principal
            } else {
                 console.warn(`[Events.Race] Canal da corrida (${raceChannelId}) não encontrado ou inválido.`);
            }
        } catch (sendError) {
             console.error(`[ERRO][Events.Race] Falha ao enviar mensagem inicial no canal da corrida (${raceChannelId}):`, sendError);
        }
    } else {
         console.warn("[Events.Race] ID do canal da corrida não configurado. Acompanhamento não será em canal dedicado.");
         // Usar a mensagem de alerta como referência (menos ideal)
         // events.race.interactionid = alertMessage.id;
         // raceMessage = alertMessage; // Não pode editar alerta facilmente depois
    }


    // Salva o estado inicial da corrida no DB
    const filter = { _id: API.id };
    // Salva apenas os dados essenciais para recarregar depois
    const raceDataToSave = {
        started: events.race.started,
        time: events.race.time,
        rodando: events.race.rodando,
        interactionid: events.race.interactionid, // Salva o ID da mensagem principal
        // Não salva as apostas no DB por enquanto, ficam em memória
    };
    const update = { $set: { "events.race": raceDataToSave } };
    // ALTERADO: Usando API.db
    const dbResult = await API.db.updateOne('globals', filter, update, { upsert: true });

    if (!dbResult || !(dbResult.modifiedCount > 0 || dbResult.upsertedCount > 0)) {
         console.error("[ERRO][Events.Race] Falha ao salvar estado inicial da corrida no banco de dados!");
         // Considerar parar o evento?
         // events.race.rodando = false; return;
    } else {
         console.log("[Events.Race] Estado inicial da corrida salvo no banco de dados.");
    }

    // Inicia o loop de edição APENAS se tivermos uma mensagem principal para editar
    if (raceMessage) {
         editRace(raceMessage);
    } else {
         console.warn("[Events.Race] Não há mensagem principal para atualizar o estado da corrida.");
         // A corrida terminará, mas o embed não será atualizado em tempo real.
         // Iniciar um timer para finalizar a corrida mesmo sem mensagem?
         const raceDuration = events.race.time;
         setTimeout(async () => {
              if (events.race.rodando && events.race.started === raceDataToSave.started) { // Verifica se ainda é a mesma corrida
                   console.log("[Events.Race] Finalizando corrida via timer (sem mensagem principal).");
                   await editRace(null); // Chama editRace com null para finalizar a lógica
              }
         }, raceDuration + 2000); // +2s de margem
    }
};



// --- Função Load (Carrega estado da corrida ao iniciar) ---

events.load = async function() {
    console.log("[Events] Iniciando carregamento de estado e timers...".yellow);
    try {
        // Carrega estado da Corrida
        const filter = { _id: API.id }; // ID do bot
        const options = { projection: { events: 1 } };
        // ALTERADO: Usando API.db
        const globalDoc = await API.db.findOne('globals', filter, options);

        if (globalDoc?.events?.race && globalDoc.events.race.rodando) {
            const savedRace = globalDoc.events.race;
            // Restaura estado da corrida em memória (exceto apostas)
            events.race.started = savedRace.started || Date.now(); // Usa agora se timestamp inválido
            events.race.time = savedRace.time || config.modules?.events?.race?.time * 60 * 1000;
            events.race.rodando = true;
            events.race.interactionid = savedRace.interactionid;
            events.race.vencedor = 0; // Reseta vencedor
            events.race.apostas = { laranja: [], vermelho: [], roxo: [] }; // Reseta apostas

            console.log(`[Events.Race] Estado de corrida ativa encontrado (ID: ${events.race.interactionid}). Tentando retomar...`.cyan);

            // Tenta encontrar a mensagem da corrida para continuar editando
            let raceMessage = null;
            const raceChannelId = config.modules?.events?.race?.channel;
            if (events.race.interactionid && raceChannelId) {
                 try {
                     const raceChannel = await API.client.channels.fetch(raceChannelId).catch(() => null);
                     if (raceChannel?.messages) { // Verifica se pode buscar mensagens
                          raceMessage = await raceChannel.messages.fetch(events.race.interactionid).catch(() => null);
                     }
                 } catch (fetchError) {
                      console.error(`[ERRO][Events.Load] Falha ao buscar mensagem/canal da corrida ${events.race.interactionid}:`, fetchError);
                 }
            }

            if (raceMessage) {
                 console.log("[Events.Race] Mensagem da corrida encontrada. Retomando loop de edição.");
                 editRace(raceMessage); // Inicia o loop de edição
            } else {
                 console.warn(`[Events.Race] Mensagem da corrida (${events.race.interactionid}) não encontrada. A corrida terminará, mas não será atualizada visualmente.`);
                 // Iniciar timer para finalizar a corrida como fallback
                 const timePassed = Date.now() - events.race.started;
                 const timeRemaining = Math.max(0, events.race.time - timePassed);
                  setTimeout(async () => {
                      if (events.race.rodando && events.race.interactionid === savedRace.interactionid) { // Verifica se ainda é a mesma corrida
                           console.log("[Events.Race] Finalizando corrida via timer (mensagem não encontrada no load).");
                           await editRace(null);
                      }
                  }, timeRemaining + 2000); // +2s de margem
            }
        } else {
            console.log("[Events] Nenhuma corrida ativa encontrada no banco de dados.");
        }

        // --- Timers Globais (Cotação, Desconto, Eventos Aleatórios) ---

        // Timer de Eventos Aleatórios
        const runRandomEvent = async () => {
             // Só roda evento se não houver corrida ativa
             if (!events.race.rodando) {
                 const eventType = API.utils.random(0, 2); // 0, 1, 2
                 console.log(`[Events] Iniciando evento aleatório tipo ${eventType}...`);
                 switch (eventType) {
                     case 0: await events.forceTreasure(); break;
                     // case 1: await events.forceRace(); break; // Corrida só manual ou via load? Removido daqui
                     case 1: await events.forceDuck(); break; // Ajustado
                     case 2: await events.forceDuck(); break; // Mais chance de Pato?
                     default: await events.forceTreasure(); break;
                 }
             } else {
                  console.log("[Events] Corrida em andamento, evento aleatório adiado.");
             }
             // Agenda o próximo evento aleatório
             const intervalMs = API.utils.random(
                  (config.modules?.events?.minInterval || 60) * 60 * 1000,
                  (config.modules?.events?.maxInterval || 180) * 60 * 1000
             );
             console.log(`[Events] Próximo evento aleatório em ${API.utils.ms2(intervalMs)}`);
             setTimeout(runRandomEvent, intervalMs);
        };
        // Inicia o primeiro evento aleatório após um delay inicial
        const initialDelay = API.utils.random(1, 5) * 60 * 1000; // Delay inicial de 1-5 minutos
        console.log(`[Events] Primeiro evento aleatório em ${API.utils.ms2(initialDelay)}`);
        setTimeout(runRandomEvent, initialDelay);


        // Timer de Cotação
        const runCotacao = async () => {
             try {
                  await API.maqExtension.forceCot();
                  API.maqExtension.proxcot = Date.now() + (config.modules.cotacao * 60000); // Atualiza próximo tempo
                  // console.log("[Events] Cotação atualizada."); // Log opcional
             } catch (cotError) { console.error("[ERRO][Events] Falha ao forçar cotação:", cotError); }
             // Reagenda
             setTimeout(runCotacao, config.modules.cotacao * 60000);
        };
        // Roda a primeira cotação após um pequeno delay
        setTimeout(runCotacao, 10000); // Delay de 10s
        API.maqExtension.proxcot = Date.now() + (config.modules.cotacao * 60000); // Define próximo tempo inicial


        // Timer de Descontos
        const runDiscount = async () => {
             try {
                  await API.shopExtension.forceDiscount();
                  console.log("[Events] Descontos da loja atualizados.");
                  // Lógica adicional (transferir dinheiro/token do bot) mantida
                  const botUser = API.client?.user;
                  if (botUser) {
                       // As chamadas API.eco já usam API.db internamente
                       const botMoney = await API.eco.money.get(botUser.id);
                       if (botMoney > 1000000) {
                            await API.eco.money.remove(botUser.id, 1000000);
                            await API.eco.token.add(botUser.id, 500);
                            console.log("[Events] Transferido 1M moedas para 500 fichas (conta do bot).");
                       }
                  }
             } catch (discError) { console.error("[ERRO][Events] Falha ao forçar desconto ou transferir fundos:", discError); }
             // Reagenda
             setTimeout(runDiscount, config.modules.discount * 60000);
        };
         // Roda o primeiro desconto após um pequeno delay
        setTimeout(runDiscount, 20000); // Delay de 20s


        console.log("[Events] Timers de Cotação, Desconto e Eventos Aleatórios configurados.".green);

    } catch (loadError) {
         console.error("[ERRO FATAL][Events] Falha durante o carregamento inicial:", loadError);
         // Considerar sair se o load falhar criticamente
         // process.exit(1);
    }
};

module.exports = events;