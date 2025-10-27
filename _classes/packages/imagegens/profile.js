// _classes/packages/imagegens/profile.js

const API = require("../../api/index");
let bg;

// Pré-carrega a imagem de fundo base ao iniciar o módulo
loadbg();

async function loadbg() {
    try {
        // Assume que API.img.Canvas está disponível (do módulo img.js)
        bg = await API.img.Canvas.loadImage('./resources/backgrounds/profile/profile.png');
        console.log("[Imagegen Profile] Background base carregado.");
    } catch (err) {
        console.error("[ERRO][Imagegen Profile] Falha ao carregar background base:", err);
        // Pode definir um fallback ou lançar erro
    }
}

module.exports = async function execute(API, options) {

    /* options : Object
     (Estrutura esperada do objeto options)
     name: String,
     textcolor: Hex,
     boxescolor: Hex,
     bio: String,
     mastery: Number,
     reps: Number,
     level: Number,
     xp: Number,
     url: {
         bg: String,      // URL do background personalizado (se houver)
         avatar: String,  // URL do avatar do usuário
         maq: String,     // URL do ícone da máquina equipada
         badges: Array    // Array de IDs dos emblemas possuídos
     },
     frame: Object,       // Objeto com dados da moldura (url, type) ou null
     perm: Number,        // Nível de permissão (para emblema de staff)
     profile_color: Number // ID da cor de perfil (ou 0/null)
    */

    // Garante que o background base foi carregado
    if (!bg) {
        console.error("[ERRO][Imagegen Profile] Background base não carregado. Abortando geração.");
        // Retornar null ou lançar erro para indicar falha
        throw new Error("Background base do perfil não está disponível.");
        // return null;
    }

    const imageDefault = bg;
    const width = imageDefault.width;
    const height = imageDefault.height;

    // Usa API.img.Canvas injetado
    const canvas = API.img.Canvas.createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Preenche com cor de fundo padrão (caso imagem BG falhe)
    ctx.fillStyle = '#2C2F33'; // Cor escura
    ctx.fillRect(0, 0, width, height);

    // Colocando o background personalizado do membro (se existir)
    if (options.url.bg) {
        try {
            const imageBackground = await API.img.Canvas.loadImage(options.url.bg);
            ctx.drawImage(imageBackground, 0, 0, width, height);
        } catch (bgError) {
            console.warn(`[Imagegen Profile] Falha ao carregar BG personalizado (${options.url.bg}):`, bgError.message);
            // Continua com o fundo padrão
        }
    }

    // Desenhando a imagem padrão por cima do background (para a estrutura)
    ctx.drawImage(imageDefault, 0, 0, width, height);

    // --- Escrevendo Textos ---
    // (Assume que API.img.drawText existe e lida com fontes/alinhamento)
    const textColor = options.textcolor || '#FFFFFF'; // Cor padrão branca
    const boxColor = options.boxescolor || '#7289DA'; // Cor padrão Discord Blurple

    // Nome do membro
    API.img.drawText(ctx, options.name || 'Nome Indisponível', 30, './resources/fonts/MartelSans-Regular.ttf', textColor, 400, 117, 3);
    // Biografia
    API.img.drawText(ctx, options.bio || 'Sem biografia definida.', 27, './resources/fonts/MartelSans-Regular.ttf', textColor, 400, 181, 3);
    // Reputação
    API.img.drawText(ctx, String(options.reps || 0), 30, './resources/fonts/MartelSans-Regular.ttf', textColor, 1060, 117, 3);
    // Maestria
    API.img.drawText(ctx, String(options.mastery || 0), 24, './resources/fonts/MartelSans-Regular.ttf', '#FFFFFF', 1150, 670, 5); // Cor branca fixa?
    // Nível
    const level = options.level || 1;
    const xp = options.xp || 0;
    const xpNeeded = level * 1980;
    API.img.drawText(ctx, `Nível atual: ${level}`, 25, './resources/fonts/MartelSans-Bold.ttf', textColor, 600, 675, 4);
    // Experiência
    const xpPercent = xpNeeded > 0 ? (100 * xp / xpNeeded).toFixed(2) : 0;
    API.img.drawText(ctx, `EXP: ${API.utils.format(xp)}/${API.utils.format(xpNeeded)} (${xpPercent}%)`, 25, './resources/fonts/MartelSans-Bold.ttf', textColor, 600, 705, 4);

    // --- Desenhando Badges ---
    let tempx = 0;
    let tempy = 605; // Posição Y inicial dos badges
    const badgeSize = 35;
    const badgeSpacing = 10; // Espaço entre badges

    // Badge de Permissão/Staff
    if (options.perm && options.perm > 1 && options.perm <= 5) { // Limita a 5 para evitar erros se perm for inválido
        try {
            const permBadgeImg = await API.img.Canvas.loadImage(`resources/backgrounds/profile/${options.perm}.png`);
            ctx.drawImage(permBadgeImg, tempx, tempy, badgeSize, badgeSize);
            tempx += badgeSize + badgeSpacing;
        } catch (permBadgeError) {
             console.warn(`[Imagegen Profile] Falha ao carregar badge de permissão ${options.perm}:`, permBadgeError.message);
        }
    }

    // Ícone da Máquina
    if (options.url.maq) {
        try {
            const maqImg = await API.img.Canvas.loadImage(options.url.maq);
            ctx.drawImage(maqImg, tempx, tempy, badgeSize, badgeSize);
            tempx += badgeSize + badgeSpacing;
        } catch (maqImgError) {
            console.warn(`[Imagegen Profile] Falha ao carregar imagem da máquina (${options.url.maq}):`, maqImgError.message);
        }
    }

    // Badges do Utilizador
    if (options.url.badges && Array.isArray(options.url.badges)) {
        for (const badgeId of options.url.badges) {
            const badgeData = API.badges.get(badgeId); // badges.js já foi atualizado
            if (badgeData?.url) {
                try {
                    const tempBadge = await API.img.Canvas.loadImage(badgeData.url);
                    ctx.drawImage(tempBadge, tempx, tempy, badgeSize, badgeSize);
                    tempx += badgeSize + badgeSpacing;
                    // Limita o número de badges para não sair da imagem
                    if (tempx > width - (badgeSize + badgeSpacing)) break;
                } catch (badgeImgError) {
                    console.warn(`[Imagegen Profile] Falha ao carregar imagem do badge ID ${badgeId} (${badgeData.url}):`, badgeImgError.message);
                }
            }
        }
    }

    // --- Barra de Progresso XP ---
    ctx.save();
    ctx.strokeStyle = boxColor; // Usa a cor definida
    ctx.lineWidth = 10;
    ctx.lineCap = "butt"; // 'butt' para cantos retos
    ctx.beginPath(); // Inicia novo path
    ctx.moveTo(0, 745); // Ponto inicial da linha
    const progressWidth = width * (parseFloat(xpPercent) / 100); // Calcula largura da barra
    ctx.lineTo(progressWidth, 745); // Desenha a linha até a porcentagem
    // ctx.closePath(); // Não necessário para lineTo
    ctx.stroke(); // Desenha a linha
    ctx.restore();

    // --- Barras de Cores (se perm > 1 ou profile_color definido) ---
    function runColor(x, y, w, h, defaultColor, type) {
        ctx.beginPath();
        let fillStyle = defaultColor; // Cor padrão

        if (type === 1) { // Gradiente Rainbow (MVP?)
            const gradient = ctx.createLinearGradient(x, y, x + w, y); // Gradiente horizontal
            // (Definição do gradiente mantida)
            gradient.addColorStop(0, "rgb(197, 0, 0)");
            gradient.addColorStop(0.07, "rgb(197, 0, 0)");
            gradient.addColorStop(0.20, "rgb(255, 116, 0)");
            gradient.addColorStop(0.42, "rgb(255, 252, 0)");
            gradient.addColorStop(0.62, "rgb(14, 232, 66)");
            gradient.addColorStop(0.76, "rgb(0, 255, 226)");
            gradient.addColorStop(0.84, "rgb(28, 94, 237)");
            gradient.addColorStop(0.95, "rgb(129, 28, 237)");
            gradient.addColorStop(1, "rgb(129, 28, 237)");
            fillStyle = gradient;
        }
        // Adicionar mais 'else if (type === ID_DA_COR)' aqui se houver outras cores
        // else if (type === 2) { fillStyle = '#CorHex'; }

        ctx.fillStyle = fillStyle;
        ctx.fillRect(x, y, w, h);
        // ctx.closePath(); // Não necessário para fillRect
    }

    ctx.save();
    const colorType = options.profile_color > 0 ? options.profile_color : (options.perm > 1 ? 0 : -1); // Usa profile_color se definido, senão padrão (0?) se perm > 1
    if (colorType !== -1) { // Só desenha se houver cor definida ou for staff
        runColor(387, 91, 593, 2, boxColor, colorType); // Barra 1
        runColor(1006, 91, 163, 2, boxColor, colorType); // Barra 2
        runColor(387, 154, 782, 2, boxColor, colorType); // Barra 3
    }
    ctx.restore();

    // --- Avatar e Moldura ---
    ctx.save();

    // Desenha avatar primeiro
    const avatarX = 85;
    const avatarY = 59;
    const avatarSize = 180;
    try {
        const avatar = await API.img.Canvas.loadImage(options.url.avatar);

        // Lógica para avatar redondo (se frame for tipo 1)
        if (options.frame && options.frame.type == 1) {
            ctx.save(); // Salva estado antes de clipar
            ctx.beginPath();
            // Coordenadas e raio baseados na posição/tamanho do avatar
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip(); // Aplica o clip
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore(); // Restaura estado (remove clip)
        } else {
            // Desenha avatar quadrado normal
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        }

    } catch (avatarError) {
         console.error(`[ERRO][Imagegen Profile] Falha ao carregar avatar (${options.url.avatar}):`, avatarError.message);
         // Desenhar um placeholder?
    }


    // Desenha moldura DEPOIS do avatar
    if (options.frame?.url) {
        try {
            const frameImg = await API.img.Canvas.loadImage(options.frame.url);
            // Ajustar posição da moldura (pode precisar de valores diferentes de 50, 24)
            // Idealmente, as coordenadas viriam junto com options.frame
            const frameX = options.frame.xOffset || 50; // Exemplo de offset X
            const frameY = options.frame.yOffset || 24; // Exemplo de offset Y
            ctx.drawImage(frameImg, frameX, frameY); // Desenha no tamanho original da imagem da moldura
        } catch (frameError) {
            console.warn(`[Imagegen Profile] Falha ao carregar moldura (${options.frame.url}):`, frameError.message);
        }
    }

    ctx.restore(); // Restaura estado após avatar/moldura

    // --- Finalização ---
    // ALTERADO: Usa AttachmentBuilder
    const attachment = new API.AttachmentBuilder(canvas.toBuffer("image/png"), { name: 'profile.png' }); // Define nome do arquivo
    return attachment;
}