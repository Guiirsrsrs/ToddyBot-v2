// _classes/manager/ShardingManager.js

const { ShardingManager } = require('discord.js');
const colors = require('colors');
const path = require('path');

class NisrukshaShardManager extends ShardingManager {

    constructor(options = {}) {
        const mainBotFile = path.join(__dirname, '..', '..', 'index.js');
        const totalShards = options.sharding?.shardAmount > 0 ? options.sharding.shardAmount : 'auto';
        const tokenFromOptions = options.app?.token;

        console.log("[ShardingManager DEBUG] Token recebido via options:", tokenFromOptions ? `Encontrado (termina com ...${tokenFromOptions.slice(-5)})` : "NÃO RECEBIDO!".red);

        // CRÍTICO: Validar token ANTES de passar para o super()
        if (!tokenFromOptions) {
            console.error('[ShardingManager] ERRO CRÍTICO: Token não fornecido nas opções! Verifique config.js e .env.'.red);
            process.exit(1);
        }

        super(mainBotFile, {
            totalShards: totalShards,
            token: tokenFromOptions, // ← Token DEVE estar aqui
            respawn: true,
            // ADICIONAR: Passar variáveis de ambiente para os shards
            shardArgs: [],
            execArgv: []
        });

        this.options = options;

        // CRÍTICO: Injetar o token no ambiente para os shards filhos lerem
        process.env.DISCORD_TOKEN = tokenFromOptions;
        
        console.log("[ShardingManager] Token injetado no process.env para os shards filhos.".green);

        // Listeners de Eventos
        this.on('shardCreate', shard => this.onShardCreate(shard));
        this.on('shardError', (error, shardId) => this.onShardError(error, shardId));

        console.log(`[ShardingManager] Configurado para iniciar com ${totalShards === 'auto' ? 'um número automático de' : totalShards} shards.`.cyan);

        // Graceful Shutdown
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    }

    log(shardId, message, level = 'info') {
        const timestamp = new Date().toISOString();
        const shardTag = `[Shard ${shardId}]`.magenta;
        const logMessage = `[${timestamp}] ${shardTag} ${message}`;

        switch (level) {
            case 'error': console.error(logMessage.red); break;
            case 'warn': console.warn(logMessage.yellow); break;
            case 'info': console.log(logMessage.blue); break;
            case 'debug': console.log(logMessage.grey); break;
            case 'ready': console.log(logMessage.green); break;
            default: console.log(logMessage);
        }
    }

    onShardCreate(shard) {
        this.log(shard.id, `Iniciada com PID: ${shard.process?.pid || 'N/A'}.`, 'ready');

        shard.on('ready', () => {
             this.log(shard.id, 'Pronta e conectada ao Discord.', 'ready');
        });

        shard.on('disconnect', (event) => {
             this.log(shard.id, `Desconectada. Código: ${event?.code || 'N/A'}. Tentando reconectar...`, 'warn');
        });

        shard.on('reconnecting', () => {
             this.log(shard.id, 'Reconectando...', 'warn');
        });

        shard.on('death', (process) => {
             this.log(shard.id, `Processo morreu. Sinal: ${process.signalCode}, Código: ${process.exitCode}. Respawn: ${this.respawn}.`, 'error');
        });

         shard.on('error', (error) => {
             console.error(`[${new Date().toISOString()}] [Shard ${shard.id}]`.magenta, `Erro interno:`.yellow, error);
         });

         shard.on('message', (message) => {
             this.log(shard.id, `Recebeu mensagem: ${JSON.stringify(message)}`, 'debug');
         });
    }

    onShardError(error, shardId) {
        this.log(shardId, `Erro fatal encontrado: ${error.message}`, 'error');
        console.error(error.stack);
    }

    async connect() {
        this.log('Manager', 'Iniciando spawn dos shards...');
        try {
            await this.spawn({ amount: this.totalShards, delay: 5500, timeout: 60000 });
            this.log('Manager', `Todos os ${this.shards.size} shards foram iniciados.`);
        } catch (error) {
            console.error('[ShardingManager] ERRO ao iniciar shards:'.red, error);
            process.exit(1);
        }
    }

    shutdown(signal) {
        console.log(`[ShardingManager] Recebido sinal ${signal}. Desligando shards...`.yellow);
        this.broadcastEval(client => client.destroy())
          .then(() => {
              console.log('[ShardingManager] Todos os shards foram instruídos a desligar.'.green);
              process.exit(0);
          })
          .catch(err => {
              console.error('[ShardingManager] Erro ao desligar shards:'.red, err);
              process.exit(1);
          });

         setTimeout(() => {
             console.warn('[ShardingManager] Timeout de desligamento. Forçando saída.'.yellow);
             process.exit(1);
         }, 10000);
    }
}

module.exports = NisrukshaShardManager;