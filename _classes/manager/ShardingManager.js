// _classes/manager/ShardingManager.js

const { ShardingManager } = require('discord.js');
const path = require('path');
require('colors');

class NisrukshaShardManager {
    constructor(config) {
        this.config = config;
        this.token = this.validateToken(config); // Valida e obtém o token

        if (!this.token) {
            console.error('[ShardingManager] ERRO CRÍTICO: Token não encontrado na configuração ou ambiente!'.red);
            process.exit(1);
        }

        // Injeta o token no ambiente para que os shards filhos possam lê-lo
        // Isso permite que ToddyClient use process.env.DISCORD_TOKEN como fallback
        process.env.DISCORD_TOKEN = this.token;
        console.log('[ShardingManager] Token injetado no process.env para os shards filhos.'.cyan);


        // Configuração do ShardingManager
        const shardConfig = {
            token: this.token,
            totalShards: config.sharding?.totalShards || 'auto', // Usa 'auto' ou valor da config
            shardArgs: [], // Argumentos extras para passar aos shards, se necessário
            execArgv: [], // Argumentos extras para passar ao processo Node.js dos shards
            respawn: config.sharding?.respawn !== undefined ? config.sharding.respawn : true, // Padrão é respawnar
            mode: config.sharding?.mode || 'process', // 'process' ou 'worker'
        };

        // Caminho para o arquivo que inicia cada shard (index.js)
        const shardFilePath = path.join(__dirname, '..', '..', 'index.js'); // ../../index.js

        this.manager = new ShardingManager(shardFilePath, shardConfig);

        console.log(`[ShardingManager] Configurado para iniciar com ${shardConfig.totalShards === 'auto' ? 'um número automático de' : shardConfig.totalShards} shards.`);

        // --- Handlers de Eventos do ShardingManager ---
        this.manager.on('shardCreate', shard => {
            console.log(`[Shard ${shard.id}] Iniciada com PID: ${shard.process?.pid ?? 'N/A'}.`.green);

            shard.on('ready', () => {
                console.log(`[Shard ${shard.id}] READY.`.cyan.bold);
            });
            shard.on('disconnect', () => {
                console.warn(`[Shard ${shard.id}] Desconectado.`.yellow);
            });
            shard.on('reconnecting', () => {
                console.warn(`[Shard ${shard.id}] Reconectando...`.yellow);
            });
            shard.on('death', (process) => {
                 console.error(`[Shard ${shard.id}] Processo morreu. Sinal: ${process.signalCode}, Código: ${process.exitCode}. Respawn: ${shard.manager.respawn}.`.red.bold);
                 // Adicionar log mais detalhado ou notificação aqui se necessário
            });
            shard.on('error', (error) => {
                 console.error(`[Shard ${shard.id}] ERRO:`, error);
                 // Logar o erro, pode ser útil para depuração
            });
        });

        // Opcional: Lidar com mensagens entre shards ou do manager para shards
        // this.manager.on('message', (shard, message) => {
        //     console.log(`[Shard ${shard.id}] Recebeu mensagem:`, message);
        // });
    }

    validateToken(config) {
        let finalToken = config.app?.token; // Tenta obter da config
        console.log(`[ShardingManager DEBUG] Token recebido via options: ${finalToken ? `Encontrado (termina com ...${finalToken.slice(-5)})` : "NÃO ENCONTRADO!"}`);

        // Tenta obter do ambiente se não encontrado na config
        // (Isso serve como fallback se a config não for passada corretamente)
        if (!finalToken) {
            const envToken = process.env.DISCORD_TOKEN;
             console.log(`[ShardingManager DEBUG] Token recebido via process.env: ${envToken ? `Encontrado (termina com ...${envToken.slice(-5)})` : "NÃO ENCONTRADO!"}`);
             if (envToken) {
                  finalToken = envToken;
             }
        }
        return finalToken;
    }


    async connect() {
        console.log('[Shard Manager] Iniciando spawn dos shards...'.yellow);
        try {
            await this.manager.spawn({
                amount: this.manager.totalShards, // Número de shards a iniciar
                delay: this.config.sharding?.spawnDelay || 5500, // Delay entre spawns
                timeout: this.config.sharding?.spawnTimeout || 30000 // Timeout para shard ficar ready
            });
            console.log('[Shard Manager] Todos os shards foram iniciados.'.green);
        } catch (err) {
            console.error('[ShardingManager] ERRO ao iniciar shards:'.red, err);
            // Considerar limpar processos filhos ou sair
            process.exit(1);
        }
    }
}

module.exports = NisrukshaShardManager;