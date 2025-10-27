// _classes/packages/quote.js

const fs = require('fs');
const path = require('path');
// Não precisa da API aqui diretamente

const quote = {};

// Função auxiliar para carregar e parsear JSON de forma segura
function loadJsonData(filePath) {
    try {
        const fullPath = path.join(__dirname, '..', '..', '_json/quotes', filePath); // Caminho relativo a partir de _classes/packages
        // console.log(`[Quote] Tentando carregar: ${fullPath}`); // Log para depuração
        if (fs.existsSync(fullPath)) {
            const jsonString = fs.readFileSync(fullPath, 'utf8');
            return JSON.parse(jsonString);
        } else {
             console.warn(`[Quote] Arquivo JSON não encontrado: ${fullPath}`);
             return []; // Retorna array vazio se o arquivo não existe
        }
    } catch (err) {
        console.error(`[ERRO][Quote] Falha ao carregar ou parsear ${filePath}:`, err);
        return []; // Retorna array vazio em caso de erro
    }
}

// Carrega os dados na inicialização do módulo (ou sob demanda)
const quoteData = {
    anime: loadJsonData('anime.json'),
    movies: loadJsonData('movies.json'),
    // Adicionar mais categorias se existirem arquivos correspondentes
};

/**
 * Obtém uma citação aleatória de uma categoria específica ou de todas.
 * @param {string} [type='anime'] - Tipo de citação ('anime', 'movies', ou 'random' para qualquer uma).
 * @returns {object|null} Objeto com a citação { quote, author, source } ou null.
 */
quote.get = function(type = 'anime') {
    const typeLower = String(type).toLowerCase();
    let dataSet = [];

    if (typeLower === 'random') {
        // Combina todas as citações de todas as categorias carregadas
        dataSet = Object.values(quoteData).flat();
    } else if (quoteData[typeLower]) {
        dataSet = quoteData[typeLower];
    } else {
        // Fallback para anime se o tipo for inválido
        console.warn(`[Quote] Tipo de citação inválido "${type}". Usando 'anime' como fallback.`);
        dataSet = quoteData.anime || [];
    }

    if (!dataSet || dataSet.length === 0) {
        console.error(`[ERRO][Quote] Nenhum dado de citação disponível para o tipo "${typeLower}".`);
        return null; // Retorna null se não houver dados
    }

    // Seleciona uma citação aleatória do dataSet escolhido
    const randomIndex = Math.floor(Math.random() * dataSet.length);
    const randomQuote = dataSet[randomIndex];

    // Garante que a citação tem os campos esperados (quote, author, source)
    return {
        quote: randomQuote?.quote || "Citação não encontrada.",
        author: randomQuote?.author || "Desconhecido",
        source: randomQuote?.source || "Desconhecida"
    };
};

module.exports = quote;