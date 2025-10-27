// _classes/api/modules/img.js

const img = {};
// Importar API centralizada (ajuste o caminho se necessário)
const API = require("../index.js"); // Assumindo que img.js está em _classes/api/modules/
const fs = require('fs');
const path = require('path'); // Usar path para caminhos de arquivo
const opentype = require("opentype.js");
img.Canvas = require("canvas");

// Importar Collection e AttachmentBuilder diretamente do discord.js
const { Collection, AttachmentBuilder } = require('discord.js');
const colors = require('colors'); // Importar colors se for usar .green

// Usar new Collection() diretamente
img.imagegens = new Collection();

// --- Funções Auxiliares de Desenho ---

img.circle = function(ctx, imagew, imageh) {
    ctx.beginPath();
    ctx.arc(imagew / 2, imageh / 2, (imagew + imageh) / 4, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
};

img.corner = function(ctx, r, imagew, imageh) {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(imagew - r, 0);
    ctx.quadraticCurveTo(imagew, 0, imagew, r);
    ctx.lineTo(imagew, imageh - r);
    ctx.quadraticCurveTo(imagew, imageh, imagew - r, imageh);
    ctx.lineTo(r, imageh);
    ctx.quadraticCurveTo(0, imageh, 0, imageh - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.clip();
};

img.radius = function(ctx, imagew, imageh) {
    img.corner(ctx, (imagew + imageh) / 4, imagew, imageh);
};

img.runColor = function(ctx, width, height, color, type) {
    switch (type) {
        case 1: // Gradiente arco-íris
            var gradient = ctx.createLinearGradient(0, 0, width, height); // Ajuste a direção do gradiente se necessário
            gradient.addColorStop(0, "rgb(197, 0, 0)");
            gradient.addColorStop(0.2, "rgb(255, 116, 0)");
            gradient.addColorStop(0.4, "rgb(255, 252, 0)");
            gradient.addColorStop(0.6, "rgb(14, 232, 66)");
            gradient.addColorStop(0.8, "rgb(0, 255, 226)");
            gradient.addColorStop(0.9, "rgb(28, 94, 237)");
            gradient.addColorStop(1, "rgb(129, 28, 237)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height); // Use fillRect
            break;
        default: // Cor sólida
            ctx.fillStyle = color || '#FFFFFF'; // Cor padrão branca se nenhuma for fornecida
            ctx.fillRect(0, 0, width, height); // Use fillRect
            break;
    }
};

// --- Funções de Manipulação de Imagem ---

img.loadImage = async function (url) {
    let result;
    try {
        const image = await img.Canvas.loadImage(url);
        const canvas = img.Canvas.createCanvas(image.width, image.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, image.width, image.height);
        result = canvas.toDataURL("image/png"); // Retorna Data URL
    } catch (error) {
         console.error(`[ERRO][IMG] Falha ao carregar imagem de ${url}:`, error);
         result = null;
         if(API.client?.emit) API.client.emit('error', new Error(`Falha ao carregar imagem: ${url}. Erro: ${error.message}`));
    }
    return result;
};

img.sendImage = async function (channel, imagedata, interactionidreference, text) {
    if (!channel || typeof channel.send !== 'function') {
        console.error("[ERRO][IMG] Canal inválido fornecido para sendImage.");
        return null;
    }
    if(!imagedata) { console.warn("[AVISO][IMG] Imagem vazia fornecida para sendImage."); return null; };

    try {
        let buffer;
        if (Buffer.isBuffer(imagedata)) {
            buffer = imagedata;
        } else if (typeof imagedata === 'string' && imagedata.startsWith('data:image/')) {
             const base64Data = imagedata.replace(/^data:image\/png;base64,/, ""); // Assume PNG
             buffer = Buffer.from(base64Data, 'base64');
        } else {
             // Tenta carregar como se fosse URL/Path (pode falhar)
             const image = await img.Canvas.loadImage(imagedata);
             const canvas = img.Canvas.createCanvas(image.width, image.height);
             const ctx = canvas.getContext("2d");
             ctx.drawImage(image, 0, 0, image.width, image.height);
             buffer = canvas.toBuffer("image/png", { compressionLevel: 9 });
        }

        const name = `image.png`;
        const attachment = new AttachmentBuilder(buffer, { name: name });

        let messagePayload = { files: [attachment] };
        if (text) {
            messagePayload.content = text;
        }

        // Tentar enviar a mensagem
        const sentMessage = await channel.send(messagePayload);
        return sentMessage;

    } catch (err) {
        console.error('[ERRO][IMG] Falha ao enviar imagem:', err);
        if(API.client?.emit) API.client.emit('error', err);
        try {
             await channel.send({ content: '❌ Ocorreu um erro ao tentar processar ou enviar a imagem!' });
        } catch {}
        return null;
    }
};

img.getAttachment = async function (imagedata, name = 'image.png') {
    if(!imagedata) { console.warn("[AVISO][IMG] Imagem vazia fornecida para getAttachment."); return null; };

     try {
        let buffer;
         if (Buffer.isBuffer(imagedata)) {
             buffer = imagedata;
         } else if (typeof imagedata === 'string' && imagedata.startsWith('data:image/')) {
              const base64Data = imagedata.replace(/^data:image\/png;base64,/, "");
              buffer = Buffer.from(base64Data, 'base64');
         } else {
              const image = await img.Canvas.loadImage(imagedata);
              const canvas = img.Canvas.createCanvas(image.width, image.height);
              const ctx = canvas.getContext("2d");
              ctx.drawImage(image, 0, 0, image.width, image.height);
              buffer = canvas.toBuffer("image/png", { compressionLevel: 9 });
         }

        const attachment = new AttachmentBuilder(buffer, { name: name });
        return attachment;
    } catch (err) {
        console.error(`[ERRO][IMG] Falha ao criar anexo '${name}':`, err);
        if(API.client?.emit) API.client.emit('error', err);
        return null;
    }
};

img.resize = async function(imageInput, x, y) {
    try {
        const image = await img.Canvas.loadImage(imageInput); // Carrega a imagem (aceita Buffer, Data URL, Path)
        const imagew = image.width;
        const imageh = image.height;
        // Se quiser forçar o tamanho exato (pode distorcer):
        const newWidth = x;
        const newHeight = y;


        const canvas = img.Canvas.createCanvas(newWidth, newHeight);
        const ctx = canvas.getContext("2d");

        // Desenha a imagem redimensionada
        ctx.drawImage(image, 0, 0, newWidth, newHeight);

        // Retorna o canvas ou Data URL/Buffer
        // return canvas; // Retorna o objeto Canvas
        return canvas.toDataURL("image/png"); // Retorna Data URL

    } catch (error) {
        console.error('[ERRO][IMG] Falha ao redimensionar imagem:', error);
        if(API.client?.emit) API.client.emit('error', error);
        return null;
    }
};


img.drawImage = async function (baseImageData, overlayImageData, x, y){
    if(!baseImageData || !overlayImageData) {
        console.warn("[AVISO][IMG] Imagem base ou de sobreposição faltando em drawImage.");
        return null;
    }

    try {
        const baseImage = await img.Canvas.loadImage(baseImageData);
        const overlayImage = await img.Canvas.loadImage(overlayImageData);

        const canvas = img.Canvas.createCanvas(baseImage.width, baseImage.height);
        const ctx = canvas.getContext("2d");

        // Desenha a imagem base
        ctx.drawImage(baseImage, 0, 0, baseImage.width, baseImage.height);

        // Desenha a imagem de sobreposição nas coordenadas x, y
        // Garante que x e y são números
        const drawX = Number(x) || 0;
        const drawY = Number(y) || 0;
        ctx.drawImage(overlayImage, drawX, drawY, overlayImage.width, overlayImage.height);

        return canvas.toDataURL("image/png"); // Retorna Data URL

    } catch (error) {
        console.error('[ERRO][IMG] Falha ao sobrepor imagens:', error);
        if(API.client?.emit) API.client.emit('error', error);
        return null;
    }
};

img.drawText = function (ctx, text, fontSize, fontPath, fontColor, x, y, align = 0) { // Default align to 0
    if (!ctx || !text) return; // Verifica se ctx e text existem

    try {
        const resolvedFontPath = path.resolve(__dirname, '..', '..', '..', fontPath); // Resolve o caminho absoluto da fonte
        const font = opentype.loadSync(resolvedFontPath);

        const safeFontSize = Number(fontSize) || 10;
        let safeFontColor = String(fontColor) || '#000000';
        if (!safeFontColor.startsWith("#")) {
            safeFontColor = "#" + safeFontColor;
        }
        let drawX = parseFloat(x) || 0;
        let drawY = parseFloat(y) || 0;

        // Calcula bounds para alinhamento
        const textPathForBounds = font.getPath(text, 0, 0, safeFontSize);
        const bounds = textPathForBounds.getBoundingBox();
        const width = bounds.x2 - bounds.x1;
        const height = bounds.y2 - bounds.y1; // Altura real do texto desenhado

        // Ajusta coordenadas baseado no alinhamento (0-8)
        const row = Math.floor(align / 3); // 0: Top, 1: Middle, 2: Bottom
        const col = align % 3;          // 0: Left, 1: Center, 2: Right

        if (col === 1) drawX -= width / 2; // Center
        else if (col === 2) drawX -= width; // Right

        if (row === 1) drawY -= height / 2; // Middle (ajuste pode precisar refino dependendo da linha base da fonte)
        else if (row === 2) drawY -= height; // Bottom (ajuste pode precisar refino)

        // Cria o caminho final nas coordenadas ajustadas
        const finalPath = font.getPath(text, drawX, drawY, safeFontSize);
        finalPath.fill = safeFontColor;
        finalPath.draw(ctx); // Desenha no contexto fornecido

    } catch (error) {
        console.error(`[ERRO][IMG] Falha ao desenhar texto "${text}" com fonte ${fontPath}:`, error);
        if (API.client?.emit) API.client.emit('error', error);
    }
};


img.editBorder = async function (imageInput, radius, circleinfo) {
    try {
        const image = await img.Canvas.loadImage(imageInput);
        const imagew = image.width;
        const imageh = image.height;
        const canvas = img.Canvas.createCanvas(imagew, imageh);
        const ctx = canvas.getContext("2d");

        // Aplica clip
        if (radius > 0) {
            img.corner(ctx, radius, imagew, imageh); // Usa a função corner existente
        }
        if (circleinfo && imagew === imageh) { // Só aplica círculo se for quadrado
            img.circle(ctx, imagew, imageh); // Usa a função circle existente
        }

        // Desenha a imagem dentro do clip
        ctx.drawImage(image, 0, 0, imagew, imageh);

        // return canvas; // Retorna objeto Canvas
        return canvas.toDataURL("image/png"); // Retorna Data URL

    } catch (error) {
        console.error('[ERRO][IMG] Falha ao editar borda da imagem:', error);
        if(API.client?.emit) API.client.emit('error', error);
        return null;
    }
};


img.generateProgressBar = async function(type, width, height, percent, lineWidth, lineCapType, color) {
    try {
        const safePercent = Math.max(0, Math.min(100, Number(percent) || 0)); // Garante 0-100
        const safeLineWidth = Number(lineWidth) || 2;
        const safeColor = String(color) || '#000000';
        const capStyle = lineCapType === 1 ? "round" : "butt"; // butt é mais preciso que square para 0

        let canvas;
        // Ajustar tamanho do canvas para acomodar a espessura da linha
        if (type === 0) { // Barra horizontal
            canvas = img.Canvas.createCanvas(width, height);
        } else if (type === 1) { // Barra circular
             // Canvas quadrado, tamanho baseado no maior entre width/height + linha
             const diameter = Math.max(width, height);
             const radius = diameter / 2;
             canvas = img.Canvas.createCanvas(diameter + safeLineWidth, diameter + safeLineWidth); // +linha para não cortar borda
             var ctx = canvas.getContext("2d");
             // Transladar para o centro
             ctx.translate((diameter + safeLineWidth) / 2, (diameter + safeLineWidth) / 2);
             ctx.rotate(-0.5 * Math.PI); // Rotaciona para começar no topo (12h)
        } else {
             return null; // Tipo inválido
        }

        var ctx = canvas.getContext("2d"); // Pega o contexto novamente (ou antes do translate no tipo 1)
        ctx.strokeStyle = safeColor.startsWith("#") ? safeColor : "#" + safeColor;
        ctx.lineWidth = safeLineWidth;
        ctx.lineCap = capStyle;

        // Desenhar progresso
        ctx.beginPath();
        if (type === 0) { // Horizontal
            const startX = capStyle === 'round' ? safeLineWidth / 2 : 0;
            const endX = (width * safePercent / 100);
            const clampedEndX = capStyle === 'round' ? Math.max(startX, Math.min(width - safeLineWidth / 2, endX)) : Math.max(0, Math.min(width, endX)); // Evita ultrapassar
            if (clampedEndX > startX) { // Só desenha se houver progresso visível
                 ctx.moveTo(startX, height / 2);
                 ctx.lineTo(clampedEndX, height / 2);
            }
        } else if (type === 1) { // Circular
            const radius = width / 2; // Assume que width é o diâmetro desejado
            if (safePercent > 0) {
                 ctx.arc(0, 0, radius, 0, Math.PI * 2 * safePercent / 100, false);
            }
        }
        ctx.stroke();

        return canvas.toDataURL("image/png"); // Retorna Data URL

    } catch (error) {
         console.error('[ERRO][IMG] Falha ao gerar barra de progresso:', error);
         if(API.client?.emit) API.client.emit('error', error);
         return null;
    }
};
img.createImage = async function(width, height, color, type) {
    try {
        const canvas = img.Canvas.createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        img.runColor(ctx, width, height, color, type); // Usa a função runColor existente
        return canvas.toDataURL("image/png"); // Retorna Data URL
    } catch (error) {
        console.error('[ERRO][IMG] Falha ao criar imagem base:', error);
        if(API.client?.emit) API.client.emit('error', error);
        return null;
    }
};
img.rotate = async function(imagedata, degrees) {
    try {
        const image = await img.Canvas.loadImage(imagedata);
        const imagew = image.width;
        const imageh = image.height;
        const angleInRadians = degrees * Math.PI / 180;

        // Calcula o tamanho do novo canvas para caber a imagem rotacionada
        const cos = Math.abs(Math.cos(angleInRadians));
        const sin = Math.abs(Math.sin(angleInRadians));
        const newWidth = Math.floor(imagew * cos + imageh * sin);
        const newHeight = Math.floor(imagew * sin + imageh * cos);

        const canvas = img.Canvas.createCanvas(newWidth, newHeight);
        const ctx = canvas.getContext("2d");

        // Move o ponto de rotação para o centro do novo canvas
        ctx.translate(newWidth / 2, newHeight / 2);
        // Rotaciona
        ctx.rotate(angleInRadians);
        // Desenha a imagem original centrada no ponto de rotação
        ctx.drawImage(image, -imagew / 2, -imageh / 2);

        return canvas.toDataURL("image/png"); // Retorna Data URL

    } catch (error) {
        console.error('[ERRO][IMG] Falha ao rotacionar imagem:', error);
        if(API.client?.emit) API.client.emit('error', error);
        return null;
    }
};
// --- Carregamento dos Geradores de Imagem ---
let imagegensLoaded = false;
function loadImagegens() {
    if (imagegensLoaded) return;
    imagegensLoaded = true; // Previne recarregamento

    const imagegensPath = path.join(__dirname, '..', '..', 'packages', 'imagegens'); // Ajustado o caminho relativo
    fs.readdir(imagegensPath, (err, files) => {
        if (err) {
            console.error("[ERRO][IMG] Falha ao ler pasta imagegens:", err);
            return; // Interrompe se não conseguir ler a pasta
        }

        const genFiles = files.filter(f => f.endsWith('.js'));
        console.log(`[IMG] Encontrados ${genFiles.length} geradores de imagem.`);

        genFiles.forEach(file => {
            const genPath = path.join(imagegensPath, file);
            try {
                delete require.cache[require.resolve(genPath)]; // Limpa cache para dev
                const genModule = require(genPath);
                // Assume que o módulo exporta diretamente a função geradora
                if (typeof genModule === 'function') {
                    const genName = file.replace('.js', '');
                    img.imagegens.set(genName, genModule);
                    console.log(`[IMG] Gerador ${genName} carregado.`);
                } else {
                     console.warn(`[AVISO][IMG] Arquivo ${file} não exporta uma função. Pulando.`);
                }
            } catch (loadErr) {
                console.error(`[ERRO][IMG] Falha ao carregar gerador ${file}:`, loadErr);
                 if(API.client?.emit) API.client.emit('error', loadErr);
            }
        });
        console.log(`[IMG] Carregamento de ${img.imagegens.size} geradores concluído.`.green);
    });
}

loadImagegens();


module.exports = img;