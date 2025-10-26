require('dotenv').config();
require('colors');

const config = require('./_classes/config');
const { connectDB } = require('./_classes/db');

// Verificar se deve usar Sharding ou não
const useSharding = process.env.USE_SHARDING === 'true' || config.sharding?.shardAmount !== 1;

async function startBot() {
    console.log('[STARTUP] Iniciando Nisruksha Bot...'.cyan);
    
    // Conectar ao MongoDB ANTES de iniciar o bot
    try {
        console.log('[STARTUP] Conectando ao MongoDB...'.yellow);
        await connectDB();
        console.log('[STARTUP] MongoDB conectado com sucesso!'.green);
    } catch (error) {
        console.error('[STARTUP] ERRO FATAL: Falha ao conectar ao MongoDB:'.red, error);
        process.exit(1);
    }

    if (useSharding) {
        // Modo Sharding
        console.log('[STARTUP] Iniciando em modo SHARDING...'.cyan);
        const NisrukshaShardManager = require('./_classes/manager/ShardingManager');
        
        const manager = new NisrukshaShardManager(config);
        
        try {
            await manager.connect();
            console.log('[STARTUP] Sharding Manager iniciado com sucesso!'.green);
        } catch (error) {
            console.error('[STARTUP] ERRO ao iniciar Sharding Manager:'.red, error);
            process.exit(1);
        }
    } else {
        // Modo Single Instance (sem sharding)
        console.log('[STARTUP] Iniciando em modo SINGLE INSTANCE (sem sharding)...'.cyan);
        const NisrukshaClient = require('./_classes/NisrukshaClient');
        
        const client = new NisrukshaClient(config);
        
        try {
            await client.login();
            console.log('[STARTUP] Bot iniciado com sucesso!'.green);
        } catch (error) {
            console.error('[STARTUP] ERRO ao fazer login:'.red, error);
            process.exit(1);
        }
    }
}

// Iniciar o bot
startBot().catch(error => {
    console.error('[STARTUP] ERRO FATAL NÃO TRATADO:'.red, error);
    process.exit(1);
});