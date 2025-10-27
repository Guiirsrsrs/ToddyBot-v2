// _classes/packages/votos.js

const API = require("../api");
const { best, dbl } = require("../config"); // Assume que config contém IDs de canal e bot de voto
require('colors'); // Adicionado para logs

module.exports.check = async (message) => { // ALTERADO: Parâmetro para 'message'

    // Verifica se a mensagem veio do canal e autor corretos (bots de voto)
    // ATENÇÃO: API.ip não está definido na API, verificar a intenção desta condição
    // if (API.ip != "localhost" && message.author.id == '782329664730824784' && message.channel.id == '761582265741475850') {
    // Simplificando a condição para focar na lógica de voto (ajuste conforme necessário)
     if (message.author.bot && (message.channel.id === dbl.voteLogs_channel || message.channel.id === best.voteLogs_channel)) {

        try {
            // Verifica se é um voto do Top.gg (estrutura de mensagem pode variar)
            // Esta lógica de `message.content.includes('topgg')` parece frágil,
            // pode precisar de ser ajustada com base no formato real da mensagem do webhook/bot do Top.gg
            if (message.content.includes('topgg') && message.channel.id === dbl.voteLogs_channel) {
                 // Extrai ID do utilizador (Ex: "123456789012345678:topgg")
                const userId = message.content.split(':')[0];
                if (!/^\d{17,19}$/.test(userId)) {
                     console.warn(`[Votos] Não foi possível extrair ID de utilizador válido da mensagem Top.gg: ${message.content}`);
                     return;
                }

                const user = await API.client.users.fetch(userId).catch(() => null);
                if (!user) {
                     console.warn(`[Votos] Utilizador ${userId} (Top.gg) não encontrado.`);
                     return;
                }

                let size = 1; // Recompensa (Cristais)

                // ALTERADO: API.Discord.MessageEmbed -> API.EmbedBuilder
                const embed = new API.EmbedBuilder()
                    .setColor('Random')
                    .setDescription(`\`${user.tag}\` votou no **Top.gg** e ganhou ${size} ${API.money2} ${API.money2emoji} como recompensa!\nVote você também usando \`/votar\` ou [clicando aqui](https://top.gg/bot/763815343507505183)`)
                    .setAuthor({ name: user.tag + ' | ' + user.id, iconURL: user.displayAvatarURL(), url: 'https://top.gg/bot/763815343507505183' });

                API.client.channels.cache.get(dbl.voteLogs_channel).send({ embeds: [embed] });
                // Estas chamadas usam módulos já atualizados para API.db
                API.eco.addToHistory(user.id, `Vote Top.gg | + ${API.utils.format(size)} ${API.money2emoji}`) // eco.addToHistory usa fs
                API.eco.points.add(user.id, size)
                API.playerUtils.cooldown.set(user.id, "votetopgg", 43200); // 12 horas

                console.log(`[Votos] Recompensa Top.gg processada para ${user.tag} (${user.id}).`.cyan);
                return;

            // Verifica se é um voto da BestList (baseado na estrutura do embed)
            } else if (message.embeds.length > 0 && message.channel.id === best.voteLogs_channel && message.author.id === '782329664730824784') { // ID do bot BestList? Verificar se está correto

                // Extrai ID do utilizador do footer do embed (Ex: "123456789012345678 Votou!")
                const footerText = message.embeds[0]?.footer?.text;
                if (!footerText) return; // Embed sem footer esperado
                const userId = footerText.split(' ')[0];
                 if (!/^\d{17,19}$/.test(userId)) {
                     console.warn(`[Votos] Não foi possível extrair ID de utilizador válido do footer BestList: ${footerText}`);
                     return;
                 }

                const user = await API.client.users.fetch(userId).catch(() => null);
                if (!user) {
                     console.warn(`[Votos] Utilizador ${userId} (BestList) não encontrado.`);
                     return;
                }

                let size = 1; // Recompensa (Caixa Comum)

                 // ALTERADO: API.Discord.MessageEmbed -> API.EmbedBuilder
                const embed = new API.EmbedBuilder()
                    .setColor('Random')
                    .setDescription(`\`${user.tag}\` votou na **BestList** e ganhou ${size}x 📦 Caixa Comum como recompensa!\nVote você também usando \`/votar\` ou [clicando aqui](https://www.bestlist.online/bots/763815343507505183)`)
                    .setAuthor({ name: user.tag + ' | ' + user.id, iconURL: user.displayAvatarURL(), url: 'https://www.bestlist.online/bots/763815343507505183' });

                API.client.channels.cache.get(best.voteLogs_channel).send({ embeds: [embed] });
                // Esta chamada usa módulo já atualizado para API.db
                API.crateExtension.give(user.id, 1, size); // ID 1 = Caixa Comum? Verificar crates.json
                API.eco.addToHistory(user.id, `Vote BestList | + ${size}x 📦 Caixa Comum`); // eco.addToHistory usa fs
                API.playerUtils.cooldown.set(user.id, "votebestlist", 43200); // Cooldown separado? 12 horas

                 console.log(`[Votos] Recompensa BestList processada para ${user.tag} (${user.id}).`.cyan);
            }

        } catch (err) {
            console.error('[ERRO][Votos] Falha ao processar mensagem de voto:', err);
            API.client.emit('error', err)
        }
    }
}