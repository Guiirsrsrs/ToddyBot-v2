// _classes/manager/ShardingManager.js

const { ShardingManager } = require('discord.js');
const colors = require('colors'); // Certifique-se que 'colors' está instalado e importado
const path = require('path');

class NisrukshaShardManager extends ShardingManager {

    constructor(options = {}) {
        // Caminho para o arquivo principal do bot (index.js ou bot.js)
        const mainBotFile = path.join(__dirname, '..', '..', 'index.js'); // Ajuste se seu arquivo principal for outro

        // Determina o número de shards: 'auto' ou valor da config (padrão 'auto')
        const totalShards = options.sharding?.shardAmount > 0 ? options.sharding.shardAmount : 'auto';

        super(mainBotFile, {
            totalShards: totalShards,
            token: options.app?.token, // Acesso seguro ao token
            respawn: true, // Garante que shards reiniciem se crasharem (geralmente padrão)
            // mode: 'process', // Ou 'worker', dependendo da sua preferência (padrão 'process')
            // shardArgs: [], // Argumentos extras para passar para cada shard
            // execArgv: [], // Argumentos extras para passar para o processo node de cada shard
        });

        if (!options.app?.token) {
            console.error('[ShardingManager] ERRO: Token não encontrado nas opções!'.red);
            process.exit(1);
        }

        this.options = options; // Guardar opções se necessário para depois

        // --- Listeners de Eventos ---
        this.on('shardCreate', shard => this.onShardCreate(shard));
        // Adicionar outros listeners que foram removidos do construtor original se necessário:
        // this.on('shardDisconnect', (event, shardId) => this.onShardDisconnect(event, shardId)); // Corrigido para pegar event
        // this.on('shardReconnecting', shardId => this.onShardReconnecting(shardId)); // Corrigido para pegar shardId
        // this.on('shardReady', shardId => this.onShardReady(shardId));
        // this.on('shardResume', shardId => this.onShardResume(shardId));
        this.on('shardError', (error, shardId) => this.onShardError(error, shardId)); // Listener de erro

        // Listener para mensagens dos shards (opcional)
        // this.on('message', (shard, message) => this.onShardMessage(shard, message));

        console.log(`[ShardingManager] Configurado para iniciar com ${totalShards === 'auto' ? 'um número automático de' : totalShards} shards.`.cyan);

        // --- Graceful Shutdown ---
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    }

    // --- Métodos de Evento ---

    log(shardId, message, level = 'info') {
        const timestamp = new Date().toISOString();
        const shardTag = `[Shard ${shardId}]`.magenta;
        const logMessage = `[${timestamp}] ${shardTag} ${message}`;

        switch (level) {
            case 'error': console.error(logMessage.red); break;
            case 'warn': console.warn(logMessage.yellow); break;
            case 'info': console.log(logMessage.blue); break; // Alterado para azul para diferenciar
            case 'debug': console.log(logMessage.grey); break;
            case 'ready': console.log(logMessage.green); break; // Verde para ready/create
            default: console.log(logMessage);
        }
    }

    onShardCreate(shard) {
        this.log(shard.id, `Iniciada com PID: ${shard.process?.pid || 'N/A'}.`, 'ready'); // Log PID se disponível

        shard.on('ready', () => {
             this.log(shard.id, 'Pronta e conectada ao Discord.', 'ready');
             // clearTimeout(shard.readyTimeout); // Limpa o timeout se ficar pronta
        });

        shard.on('disconnect', (event) => { // 'disconnect' não fornece o evento no argumento direto do ShardingManager, mas sim no listener do shard
             this.log(shard.id, `Desconectada. Código: ${event?.code || 'N/A'}. Tentando reconectar...`, 'warn');
        });

        shard.on('reconnecting', () => {
             this.log(shard.id, 'Reconectando...', 'warn');
        });

        shard.on('death', (process) => {
             this.log(shard.id, `Processo morreu inesperadamente. Sinal: ${process.signalCode}, Código Saída: ${process.exitCode}. Respawn: ${this.respawn}.`, 'error');
             // clearTimeout(shard.readyTimeout); // Limpar timeout em caso de morte
             // Adicionar lógica de alerta aqui (Webhook, etc.)
        });

         shard.on('error', (error) => { // Erros específicos não fatais dentro da shard
             console.error(`[${new Date().toISOString()}] [Shard ${shard.id}]`.magenta, `Erro interno:`.yellow, error);
         });

         shard.on('message', (message) => { // Mensagens IPC da shard para o manager
             this.log(shard.id, `Recebeu mensagem: ${JSON.stringify(message)}`, 'debug');
             // Lógica para processar mensagens IPC aqui
         });

    }

    // Eventos principais gerenciados diretamente no onShardCreate agora

    onShardError(error, shardId) {
        this.log(shardId, `Erro fatal encontrado: ${error.message}`, 'error');
        console.error(error.stack); // Log completo do erro
        // Adicionar lógica de alerta aqui (Webhook, etc.)
        // Considerar se deve tentar reiniciar a shard ou parar o processo
        // Ex: this.shards.get(shardId)?.respawn(); (com cuidado para evitar loops)
    }

    // --- Métodos de Controle ---

    async connect() {
        this.log('Manager', 'Iniciando spawn dos shards...');
        try {
            await this.spawn({ amount: this.totalShards, delay: 5500, timeout: 60000 }); // Adiciona delay e timeout
            this.log('Manager', `Todos os ${this.shards.size} shards foram iniciados.`);
        } catch (error) {
            console.error('[ShardingManager] ERRO ao iniciar shards:'.red, error);
            process.exit(1);
        }
    }

    shutdown(signal) {
        console.log(`[ShardingManager] Recebido sinal ${signal}. Desligando shards...`.yellow);
        // Mata todos os shards
        this.broadcastEval(client => client.destroy()) // Pede para os clientes se destruírem
          .then(() => {
              console.log('[ShardingManager] Todos os shards foram instruídos a desligar.'.green);
              process.exit(0); // Sai do processo principal
          })
          .catch(err => {
              console.error('[ShardingManager] Erro ao desligar shards:'.red, err);
              process.exit(1); // Sai com erro
          });

         // Fallback de segurança após um tempo
         setTimeout(() => {
             console.warn('[ShardingManager] Timeout de desligamento. Forçando saída.'.yellow);
             process.exit(1);
         }, 10000); // 10 segundos
    }

    // --- Métodos de Comunicação (Exemplos) ---

    // Envia uma mensagem para um shard específico
    async sendToShard(shardId, message) {
        const shard = this.shards.get(shardId);
        if (shard) {
            try {
                await shard.send(message);
                this.log('Manager', `Mensagem enviada para Shard ${shardId}.`, 'debug');
            } catch (error) {
                this.log('Manager', `Erro ao enviar mensagem para Shard ${shardId}: ${error.message}`, 'error');
            }
        } else {
            this.log('Manager', `Shard ${shardId} não encontrada para envio de mensagem.`, 'warn');
        }
    }

    // Executa código em todos os shards e coleta resultados
    async broadcastEval(script, options) {
         try {
             const results = await super.broadcastEval(script, options);
             this.log('Manager', `BroadcastEval executado em ${results.length} shards.`, 'debug');
             return results;
         } catch (error) {
             this.log('Manager', `Erro durante broadcastEval: ${error.message}`, 'error');
             throw error; // Re-throw para quem chamou saber do erro
         }
     }

     // Busca um valor agregado de todos os shards
     async fetchClientValues(prop) {
         try {
             const results = await super.fetchClientValues(prop);
             this.log('Manager', `fetchClientValues para '${prop}' retornou ${results.length} resultados.`, 'debug');
             return results;
         } catch (error) {
             this.log('Manager', `Erro durante fetchClientValues para '${prop}': ${error.message}`, 'error');
             throw error;
         }
     }

}

module.exports = NisrukshaShardManager; // Exporta a nova classe