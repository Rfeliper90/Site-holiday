// Script para página de PROFILE

let currentUser = null;
let currentRank = null;
let currentRankComplete = null;
let currentCustomRanks = [];
let currentUserPostCount = 0;
let currentUserLikeCount = 0;
let achievementBackgrounds = {
    like_achievement: '',
    post_achievement: '',
    animationModes: {},
    rankCards: {
        like_achievement: {},
        post_achievement: {}
    }
};
let isRankOrderMode = false;
let canOrderFixedRanks = false;
let orderBtn = null; // Inicializar ao carregar a página
let orderHint = null; // Inicializar ao carregar a página
let orderTag = null; // Inicializar ao carregar a página
let rankDisplay = null; // Inicializar ao carregar a página
let notificationTimeout = null;
let isProfileReturnRefreshInFlight = false;
let selectedProfileRankIds = [];
let selectedProfileRankOrder = [];
let resendVerifyCooldownTimer = null;
let resendVerifyInFlight = false;
const MAX_SELECTED_PROFILE_RANKS = 3;
const RESEND_COOLDOWN = 3000;

function isHiddenProfileRank(rank) {
    if (!rank || !rank.name) return false;
    const rankName = String(rank.name).trim().toLowerCase();
    const hiddenProfileRankNames = new Set([
        'admin user',
        'admin',
        'founder'
    ]);
    return hiddenProfileRankNames.has(rankName);
}

function isAutomaticProgressionRankName(rankName) {
    const value = String(rankName || '').trim().toLowerCase();
    return [
        'membro novato',
        'membro iniciado',
        'membro aprendiz',
        'membro experiente',
        'membro adepto',
        'membro especialista',
        'membro mestre',
        'grande mestre',
        'membro lendário',
        'membro mítico',
        'membro transcendente',
        'membro eterno',
        'membro imortal'
    ].includes(value);
}

function startProfileResendCooldown(button) {
    if (!button) return;

    clearInterval(resendVerifyCooldownTimer);
    let secondsLeft = Math.ceil(RESEND_COOLDOWN / 1000);

    const updateLabel = () => {
        button.disabled = true;
        button.style.opacity = '0.65';
        button.textContent = `Reenviar em ${secondsLeft}s`;
    };

    updateLabel();
    resendVerifyCooldownTimer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
            clearInterval(resendVerifyCooldownTimer);
            resendVerifyCooldownTimer = null;
            button.disabled = false;
            button.style.opacity = '1';
            button.textContent = 'Reenviar Código';
            return;
        }
        updateLabel();
    }, 1000);
}

function showCustomEmailPrompt(defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-email-prompt-overlay';

        const modal = document.createElement('div');
        modal.className = 'custom-email-prompt-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Informe o novo e-mail');
        modal.innerHTML = `
            <h3>Informe o novo e-mail</h3>
            <p>Digite o e-mail que você deseja usar no perfil.</p>
            <input type="email" id="customEmailPromptInput" value="${String(defaultValue).replace(/"/g, '&quot;')}" autocomplete="email" spellcheck="false">
            <div class="custom-email-prompt-actions">
                <button type="button" id="customEmailPromptCancelBtn" class="btn-secondary">Cancelar</button>
                <button type="button" id="customEmailPromptConfirmBtn" class="btn-primary">Confirmar</button>
            </div>
        `;

        const input = modal.querySelector('#customEmailPromptInput');
        const cancelBtn = modal.querySelector('#customEmailPromptCancelBtn');
        const confirmBtn = modal.querySelector('#customEmailPromptConfirmBtn');

        const close = (value = null) => {
            overlay.remove();
            resolve(value);
        };

        cancelBtn.addEventListener('click', () => close(null));
        confirmBtn.addEventListener('click', () => {
            const value = input.value.trim();
            close(value || null);
        });
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close(null);
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') close(null);
            if (event.key === 'Enter') {
                event.preventDefault();
                confirmBtn.click();
            }
        });

        document.body.appendChild(overlay);
        overlay.appendChild(modal);
        setTimeout(() => input.focus(), 0);
    });
}

let isApplyingNotificationSettings = false;
let isSavingNotificationSettings = false;
let isApplyingProfileAnimationSettings = false;
let isSavingProfileAnimationSettings = false;
let previousAllNotificationsToggleState = false;
let inboxNotificationsLoading = false;
let inboxNotificationsCache = [];
let inboxSelectedIds = new Set();
let inboxViewMode = 'inbox'; // 'notifications' = resumo sem delete | 'inbox' = detalhado com delete
let currentTwoFactorSetupSecret = '';
let currentTwoFactorOtpAuthUri = '';
let animatedGifSearchNextPos = '';
let animatedGifSearchLoading = false;
let animatedGifSearchUseTrending = false;
let selectedAnimatedProfileGifUrl = '';
let selectedAnimatedProfileGiphyId = '';
let userMissionsState = [];
const hoverGifStaticPreviewCache = new Map();
const ALLOWED_ANIMATED_PROFILE_THEMES = [
    'auto',
    'theme-aurora',
    'theme-prisma',
    'theme-pulse',
    'theme-comet',
    'theme-inferno',
    'theme-frost',
    'theme-voltage',
    'theme-emberstorm',
    'theme-blizzard',
    'theme-neon-grid',
    'theme-liquid-metal',
    'theme-void-rift',
    'theme-solar-flare',
    'theme-toxic-mist',
    'theme-crystal-cave',
    'theme-glitchwave'
];
const EXCLUSIVE_ANIMATED_PROFILE_THEMES = [
    'theme-void-rift',
    'theme-solar-flare',
    'theme-glitchwave'
];
const ALLOWED_ANIMATED_VISUAL_MODES = ['theme', 'gif'];
const MAX_CUSTOM_ANIMATED_GIF_BYTES = 15 * 1024 * 1024;
const AVATAR_MAX_FILE_BYTES = 15 * 1024 * 1024;
const AVATAR_ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif'
]);
const BANNER_MAX_FILE_BYTES = 15 * 1024 * 1024;
const BANNER_ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif'
]);
const AVATAR_SCALE_MIN = 1;
const AVATAR_SCALE_MAX = 3;
const AVATAR_OFFSET_MIN = 0;
const AVATAR_OFFSET_MAX = 100;
const BANNER_SCALE_MIN = 0.01;
const BANNER_SCALE_MAX = 3;
const BANNER_OFFSET_MIN = 0;
const BANNER_OFFSET_MAX = 100;
const BANNER_VIEWPORT_FALLBACK_WIDTH = 1200;
const BANNER_VIEWPORT_FALLBACK_HEIGHT = 250;
const AVATAR_DEFAULT_SETTINGS = Object.freeze({
    scale: 1,
    offsetX: 50,
    offsetY: 50
});
const BANNER_DEFAULT_SETTINGS = Object.freeze({
    scale: 1,
    offsetX: 50,
    offsetY: 50
});
const OWNER_USER_ID = 1;
const OWNER_EMAIL = 'sustmanrft@hotmail.com';
const FOUNDER_ACHIEVEMENT_NAME_KEY = 'fundador';
const FIXED_AUTO_RANK_KEY = 'fixed:auto';
const FIXED_MANUAL_RANK_KEY = 'fixed:manual';
const avatarAdjustState = {
    file: null,
    inputEl: null,
    objectUrl: '',
    naturalWidth: 1,
    naturalHeight: 1,
    scale: AVATAR_DEFAULT_SETTINGS.scale,
    offsetX: AVATAR_DEFAULT_SETTINGS.offsetX,
    offsetY: AVATAR_DEFAULT_SETTINGS.offsetY,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartOffsetX: AVATAR_DEFAULT_SETTINGS.offsetX,
    dragStartOffsetY: AVATAR_DEFAULT_SETTINGS.offsetY,
    uploading: false
};
const bannerAdjustState = {
    file: null,
    inputEl: null,
    objectUrl: '',
    naturalWidth: 1,
    naturalHeight: 1,
    scale: BANNER_DEFAULT_SETTINGS.scale,
    offsetX: BANNER_DEFAULT_SETTINGS.offsetX,
    offsetY: BANNER_DEFAULT_SETTINGS.offsetY,
    viewportWidth: BANNER_VIEWPORT_FALLBACK_WIDTH,
    viewportHeight: BANNER_VIEWPORT_FALLBACK_HEIGHT,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartOffsetX: BANNER_DEFAULT_SETTINGS.offsetX,
    dragStartOffsetY: BANNER_DEFAULT_SETTINGS.offsetY,
    uploading: false
};
let avatarRemoveConfirmResolver = null;
let taglineLinkModalResolver = null;
let taglineLinkSelectionRange = null;
let taglineLinkSelectionText = null;
let taglineLinkSelectionStart = null;
let taglineLinkSelectionEnd = null;
let hasInitializedAvatarActionButtons = false;
let avatarActionTransitionTimer = null;
let hasInitializedBannerActionButtons = false;
let bannerActionTransitionTimer = null;
const VISIBILITY_ICON_EYE = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
`;
const VISIBILITY_ICON_EYE_OFF = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 3l18 18"></path>
        <path d="M10.6 10.6A3 3 0 0012 15a3 3 0 002.4-4.8"></path>
        <path d="M9.9 5.1A11 11 0 0112 5c6.2 0 10 7 10 7a18.8 18.8 0 01-4 4.7"></path>
        <path d="M6.2 6.2A18.7 18.7 0 002 12s3.8 7 10 7a10.7 10.7 0 005.1-1.2"></path>
    </svg>
`;
const POST_ACHIEVEMENT_RANKS = [
    { minPosts: 5, name: 'Autor de Bronze', color: '#CD7F32' },
    { minPosts: 15, name: 'Autor de Prata', color: '#C0C0C0' },
    { minPosts: 30, name: 'Autor de Ouro', color: '#FBBF24' },
    { minPosts: 50, name: 'Autor de Platina', color: '#E5E4E2' },
    { minPosts: 75, name: 'Autor Diamante', color: '#22D3EE' },
    { minPosts: 105, name: 'Autor Elite', color: '#34D399' },
    { minPosts: 140, name: 'Autor Supremo', color: '#F472B6' },
    { minPosts: 180, name: 'Autor Lendario', color: '#FB7185' },
    { minPosts: 235, name: 'Autor Mitico', color: '#C084FC' },
    { minPosts: 300, name: 'Autor Imortal', color: '#F59E0B' }
];
const LIKE_ACHIEVEMENT_RANKS = [
    { minLikes: 3, name: 'Rea\u00e7\u00e3o Inicial', color: '#38BDF8' },
    { minLikes: 8, name: 'Apreciado', color: '#60A5FA' },
    { minLikes: 15, name: 'Bem Curtido', color: '#818CF8' },
    { minLikes: 25, name: 'Em Alta', color: '#A78BFA' },
    { minLikes: 35, name: 'Popular', color: '#C084FC' },
    { minLikes: 50, name: 'Destaque', color: '#E879F9' },
    { minLikes: 70, name: 'Queridinho', color: '#F472B6' },
    { minLikes: 95, name: 'Influente', color: '#FB7185' },
    { minLikes: 125, name: 'Em Evidencia', color: '#F97316' },
    { minLikes: 160, name: 'Notavel', color: '#FB923C' },
    { minLikes: 200, name: 'Famoso', color: '#F59E0B' },
    { minLikes: 250, name: 'Viral', color: '#FACC15' },
    { minLikes: 320, name: 'Icone da Comunidade', color: '#A3E635' },
    { minLikes: 400, name: 'Fenomeno', color: '#4ADE80' },
    { minLikes: 500, name: 'Estrela da Guilda', color: '#22D3EE' },
    { minLikes: 620, name: 'Lenda dos Likes', color: '#06B6D4' },
    { minLikes: 740, name: 'Dominio Social', color: '#14B8A6' },
    { minLikes: 860, name: 'Aura Magnetica', color: '#10B981' },
    { minLikes: 930, name: 'Supremo dos Likes', color: '#84CC16' },
    { minLikes: 1000, name: 'Soberano dos Likes', color: '#EAB308' }
];
const PROFILE_TAGLINE_MAX_LENGTH = 100;
const PROFILE_TAG_MAX_LENGTH = 4;
const PROFILE_TAG_STYLE_OPTIONS = [
    'none',
    'aurora',
    'neon',
    'pulse',
    'wave',
    'galaxy',
    'spark',
    'flare',
    'crystal',
    'laurel',
    'aura',
    'mist',
    'ember',
    'frost',
    'nova',
    'prism',
    'vortex',
    'halo',
    'ripple',
    'comet',
    'lava',
    'ice',
    'thunder',
    'mint',
    'sunset',
    'ocean',
    'jade',
    'candy',
    'rose',
    'dusk',
    'mosaic',
    'digital',
    'quilt',
    'circuit',
    'blocks',
    'gold',
    'violet',
    'poly',
    'royal',
    'sand'
];
const PROFILE_TAG_DEFAULT_COLOR = '#EC4899';
const PROFILE_TAG_DEFAULT_COLOR_2 = '#8B5CF6';
const PROFILE_TAG_DEFAULT_TEXT_COLOR = '#FFFFFF';
const PROFILE_TAG_SYMBOL_OPTIONS = [
    'none',
    'wings',
    'heart',
    'star',
    'sun',
    'youtube',
    'cat',
    'garry',
    'anime',
    'loading'
];
const PROFILE_TAG_BANNER_OPTIONS = [
    'pill',
    'round',
    'soft',
    'square',
    'slab',
    'banner',
    'banner-cut',
    'ticket',
    'tag',
    'tag-cut',
    'chevron',
    'chevron-soft',
    'hex',
    'octagon',
    'diamond',
    'shield',
    'bracket',
    'capsule',
    'plaque',
    'ribbon'
];
const PROFILE_TAG_STYLE_STORAGE_KEY = 'holiday_profile_tag_style';
const PROFILE_TAG_BANNER_STORAGE_KEY = 'holiday_profile_tag_banner';
const TAG_FX_STYLE_PRESETS = {
    none: { mode: 'solid', speed: 0.05, noise: 0.05, glow: 0.1, angle: 135 },
    aurora: { mode: 'flow', speed: 0.18, noise: 0.22, glow: 0.25, angle: 135, drift: 0.4 },
    neon: { mode: 'glow', speed: 0.35, noise: 0.1, glow: 0.55, angle: 135 },
    pulse: { mode: 'pulse', speed: 0.45, noise: 0.08, glow: 0.35, angle: 135 },
    wave: { mode: 'wave', speed: 0.28, noise: 0.12, glow: 0.2, angle: 120, waves: 3 },
    galaxy: { mode: 'sparkle', speed: 0.14, noise: 0.18, glow: 0.25, angle: 145, stars: 10 },
    spark: { mode: 'sparkle', speed: 0.2, noise: 0.22, glow: 0.3, angle: 135, stars: 14 },
    flare: { mode: 'glow', speed: 0.38, noise: 0.1, glow: 0.6, angle: 160 },
    crystal: { mode: 'prism', speed: 0.2, noise: 0.12, glow: 0.25, angle: 125, bands: 3 },
    laurel: { mode: 'flow', speed: 0.12, noise: 0.15, glow: 0.2, angle: 110, drift: 0.25 },
    aura: { mode: 'halo', speed: 0.3, noise: 0.1, glow: 0.55, angle: 135 },
    mist: { mode: 'mist', speed: 0.1, noise: 0.35, glow: 0.18, angle: 135 },
    ember: { mode: 'fire', speed: 0.55, noise: 0.25, glow: 0.4, angle: 90, embers: 6, heat: 0.7 },
    frost: { mode: 'ice', speed: 0.15, noise: 0.18, glow: 0.2, angle: 145 },
    nova: { mode: 'burst', speed: 0.25, noise: 0.12, glow: 0.4, angle: 135 },
    prism: { mode: 'prism', speed: 0.22, noise: 0.1, glow: 0.3, angle: 135, bands: 4 },
    vortex: { mode: 'vortex', speed: 0.2, noise: 0.12, glow: 0.3, angle: 135 },
    halo: { mode: 'halo', speed: 0.22, noise: 0.1, glow: 0.6, angle: 135 },
    ripple: { mode: 'wave', speed: 0.24, noise: 0.14, glow: 0.22, angle: 100, waves: 4 },
    comet: { mode: 'shimmer', speed: 0.5, noise: 0.08, glow: 0.28, angle: 140 },
    lava: { mode: 'fire', speed: 0.75, noise: 0.3, glow: 0.45, angle: 90, embers: 8, heat: 1 },
    ice: { mode: 'ice', speed: 0.18, noise: 0.22, glow: 0.2, angle: 120 },
    thunder: { mode: 'storm', speed: 0.32, noise: 0.16, glow: 0.3, angle: 135 },
    mint: { mode: 'flow', speed: 0.14, noise: 0.18, glow: 0.22, angle: 150 },
    sunset: { mode: 'flow', speed: 0.16, noise: 0.2, glow: 0.3, angle: 115 },
    ocean: { mode: 'wave', speed: 0.2, noise: 0.16, glow: 0.24, angle: 110, waves: 5 },
    jade: { mode: 'prism', speed: 0.18, noise: 0.12, glow: 0.26, angle: 130, bands: 3 },
    candy: { mode: 'shimmer', speed: 0.45, noise: 0.1, glow: 0.35, angle: 145 },
    rose: { mode: 'sparkle', speed: 0.16, noise: 0.16, glow: 0.3, angle: 135, stars: 12 },
    dusk: { mode: 'mist', speed: 0.12, noise: 0.28, glow: 0.2, angle: 135 },
    mosaic: { mode: 'tiles', speed: 0.12, noise: 0.1, glow: 0.18, angle: 135 },
    digital: { mode: 'digital', speed: 0.2, noise: 0.12, glow: 0.28, angle: 135 },
    quilt: { mode: 'quilt', speed: 0.08, noise: 0.08, glow: 0.12, angle: 135 },
    circuit: { mode: 'circuit', speed: 0.15, noise: 0.08, glow: 0.25, angle: 145 },
    blocks: { mode: 'blocks', speed: 0.18, noise: 0.08, glow: 0.2, angle: 135 },
    gold: { mode: 'gold', speed: 0.12, noise: 0.06, glow: 0.35, angle: 135 },
    violet: { mode: 'ribbons', speed: 0.18, noise: 0.12, glow: 0.3, angle: 135 },
    poly: { mode: 'poly', speed: 0.1, noise: 0.1, glow: 0.16, angle: 135 },
    royal: { mode: 'royal', speed: 0.12, noise: 0.06, glow: 0.28, angle: 135 },
    sand: { mode: 'sand', speed: 0.08, noise: 0.12, glow: 0.12, angle: 135 }
};
const TAG_FX_STYLE_PALETTES = {
    mosaic: ['#0B2D6B', '#113B8A', '#1E5AA8', '#3C7ED1'],
    digital: ['#061334', '#0B2A6F', '#1C4CCF', '#52A0FF'],
    quilt: ['#FFFFFF', '#E8E8E8', '#D9D9D9', '#F7F7F7'],
    circuit: ['#0B0F1A', '#1F2937', '#F97316', '#EF4444'],
    blocks: ['#0F172A', '#F59E0B', '#F97316', '#9CA3AF'],
    gold: ['#0B0A08', '#5A3E0E', '#D6A046', '#F8E3A1'],
    violet: ['#2A0B45', '#5B167A', '#A855F7', '#F472B6'],
    poly: ['#0E2A1A', '#2E7D32', '#7CB342', '#A3E635'],
    royal: ['#3B0A0A', '#991B1B', '#F59E0B', '#FDE68A'],
    sand: ['#8B5E34', '#C89B63', '#E7C592', '#F4E0B7']
};
const PROFILE_TAGLINE_SUGGESTIONS = Array.from(new Set([
    'Vivendo um dia de cada vez',
    'Energia boa atrai coisa boa',
    'Menos drama, mais paz',
    'Sorriso é meu cartão de visita',
    'Sonhando alto e vivendo leve',
    'Simplicidade é meu luxo favorito',
    'Sempre em busca de boas histórias',
    'Paz na alma e brilho no olhar',
    'O mundo é grande demais para ficar parado',
    'Gratidão muda tudo',
    'Criando memórias, não desculpas',
    'Amante dos pequenos detalhes',
    'Errando, aprendendo, evoluindo',
    'Liberdade é meu combustível',
    'Risadas são meu idioma favorito',
    'Colecionando momentos, não coisas',
    'A vida é curta demais para não ser intensa',
    'Sempre pronto para a próxima aventura',
    'Autenticidade acima de tudo',
    'Brilho onde a vida me coloca',
    'Sou minha melhor versão em construção',
    'Viver é colecionar momentos',
    'Fé no futuro, força no presente',
    'Quem acredita sempre alcança',
    'A vida é agora',
    'Dormir é meu esporte favorito',
    'Café é meu combustível oficial',
    'Ironia é meu idioma nativo',
    'Quem não gosta de meme não gosta de mim',
    'Sou metade risada, metade caos',
    'Minha vibe é paz e pizza',
    'Se não for para rir, nem me chama',
    'Drama só na Netflix',
    'Wi-Fi forte e coração leve',
    'Sou edição limitada',
    'O silêncio também fala',
    'O tempo cura, ensina e revela',
    'O que é verdadeiro permanece',
    'A vida é feita de ciclos',
    'O essencial mora nos detalhes',
    'Cada fim é um novo começo',
    'O coração sabe antes da razão',
    'O caminho importa tanto quanto o destino',
    'O amor sempre encontra espaço',
    'Nada é por acaso',
    'Amar é minha forma favorita de existir',
    'Meu coração conhece o caminho',
    'Amor-próprio vem primeiro',
    'Quem ama, cuida',
    'O amor mora nos detalhes',
    'Meu coração também escreve poesia',
    'Amar é viver duas vezes',
    'O sorriso de quem eu amo ilumina meu dia',
    'Amor também é liberdade',
    'Não sigo regras vazias, sigo meu coração',
    'Sou dono da minha própria história',
    'Quem me subestima me fortalece',
    'Ousadia combina comigo',
    'Não vim competir, vim construir',
    'Minha vibe não é para qualquer um',
    'Sou intensidade sem pedir licença',
    'Quem não arrisca, não descobre',
    'Minha energia não está à venda',
    'Sou tempestade e calmaria',
    'Mundo pequeno para sonhos tão grandes',
    'Viajar é meu vício favorito',
    'O mundo é meu quintal',
    'Cada lugar guarda uma história',
    'A vida é feita de encontros',
    'O planeta é lindo demais para ficar parado',
    'Quero colecionar passaportes carimbados',
    'Cultura também é riqueza',
    'O mundo é diverso, e eu gosto disso',
    'Sou cidadão do universo',
    'Vivo em ritmo de música',
    'Minha playlist me conhece bem',
    'Música é terapia diária',
    'Cada batida conta uma parte de mim',
    'A vida tem trilha sonora',
    'Sou nota fora da escala',
    'Música é linguagem universal',
    'Vivo entre acordes e versos',
    'O fone é meu refúgio',
    'Minha alma também canta',
    'Não sou para todos',
    'Quem entende, fica',
    'Sou intensidade sem manual',
    'Não me decifrem, me sintam',
    'Sou caos organizado',
    'Minha essência não se copia',
    'Quem não aguenta, não acompanha',
    'Sou fogo e calmaria',
    'Não sou opção, sou escolha',
    'Sou raro, não perfeito',
    'Floresço onde sou regado',
    'Sou pétala e espinho',
    'A vida é jardim e eu floresço nela',
    'Delicadeza também é força',
    'O vento leva, mas eu renasço',
    'Sou poesia em movimento',
    'Beleza vive nos detalhes',
    'Sou brisa leve em dias pesados',
    'A vida é feita de cores suaves',
    'Sou primavera em forma de gente',
    'Nem tudo que mostro é tudo que sou',
    'Mistério também tem charme',
    'Sou enigma com coração',
    'Quem sabe, entende',
    'Nem sempre revelo, mas sempre sinto',
    'Sou segredo bem guardado',
    'Nem tudo precisa ser explicado',
    'Sou sombra e luz',
    'Descobrir a si mesmo também é aventura',
    'Sou luz em dias nublados',
    'A vida é feita de escolhas',
    'O tempo é meu melhor conselheiro',
    'Sou feito de sonhos e coragem',
    'A vida é curta demais para esperar o momento perfeito',
    'Sou paz em meio ao caos',
    'Cada dia traz uma nova chance',
    'Sou feito de histórias',
    'A vida é movimento',
    'Sou força e delicadeza',
    'O futuro começa agora',
    'Sou feito de momentos',
    'A vida também é aprendizado',
    'Sou coragem em forma de gente',
    'Amanhã também é promessa',
    'Sou intensidade em cada detalhe',
    'A vida é presente',
    'Sou feito de fé',
    'O tempo é tesouro',
    'Sou esperança em pessoa',
    'A vida é poesia',
    'Sou feito de amor',
    'O mundo é meu palco',
    'Sou feito de liberdade',
    'A vida é descoberta',
    'Sou feito de risos',
    'O tempo também é arte',
    'Sou feito de verdades',
    'A vida é mágica quando a alma está leve',
    'Sou feito de cores',
    'O mundo me inspira',
    'Sou feito de sonhos grandes',
    'A vida é aventura',
    'Sou feito de fé e força',
    'O tempo mostra o caminho',
    'Sou feito de esperança',
    'A vida é música',
    'Sou feito de coragem',
    'O mundo está cheio de oportunidades',
    'Sou feito de gratidão',
    'A vida é luz',
    'Sou feito de intensidade',
    'O tempo é mestre',
    'Sou feito de escolhas que fazem sentido',
    'A vida é jornada',
    'Sou feito de paz',
    'O mundo é diverso e bonito assim',
    'Sou feito de energia boa',
    'A vida é presente constante',
    'Sou feito de simplicidade',
    'O tempo traz respostas',
    'Sou feito de alegria',
    'A vida também é surpresa',
    'Sou feito de fé no impossível',
    'O mundo é infinito para quem sonha',
    'Sou feito de amor-próprio',
    'A vida é transformação',
    'Sou feito de sonhos reais',
    'O tempo é aliado de quem persiste',
    'Sou feito de esperança viva',
    'A vida é movimento constante',
    'Sou feito de coragem diária',
    'O mundo também é meu lugar',
    'Sou feito de gratidão sincera',
    'A vida é feita de detalhes bonitos',
    'Sou feito de intensidade pura',
    'O tempo traz revelações',
    'Sou feito de fé verdadeira',
    'A vida é feita de reencontros',
    'Sou feito de amor sem medida',
    'O mundo é feito de possibilidades',
    'Sou feito de paz interior',
    'A vida é feita de escolhas simples',
    'Sou feito de alegria contagiante',
    'O tempo também cura',
    'Sou feito de esperança constante',
    'A vida é feita de momentos únicos',
    'Sou feito de coragem sem medo',
    'O mundo é feito de diversidade',
    'Sou feito de gratidão infinita',
    'A vida é feita de boas surpresas',
    'Sou feito de intensidade sem fim',
    'O tempo também é sabedoria',
    'Sou feito de fé que move',
    'A vida é feita de sonhos possíveis',
    'Sou feito de amor que transforma',
    'O mundo é feito de cores vivas',
    'Sou feito de paz que acalma',
    'A vida é feita de risos leves',
    'Sou feito de esperança que guia',
    'O tempo também ensina',
    'Sou feito de coragem que inspira',
    'A vida é feita de luz',
    'Sou feito de gratidão que fortalece',
    'O mundo é feito de encontros bons',
    'Sou feito de intensidade que marca',
    'A vida é feita de fé',
    'Sou feito de amor que liberta',
    'O tempo também abre portas',
    'Sou feito de paz que ilumina',
    'A vida é feita de escolhas certas',
    'Sou feito de esperança que renova',
    'O mundo é feito de sonhos vivos',
    'Sou feito de coragem que constrói',
    'A vida é feita de gratidão',
    'Sou feito de intensidade que contagia',
    'O tempo também é presente',
    'Sou feito de fé que sustenta',
    'A vida é feita de amor',
    'Sou feito de paz que transforma',
    'O mundo também é feito de fé',
    'Sou feito de esperança que floresce',
    'A vida é feita de coragem',
    'Sou feito de gratidão que inspira',
    'O tempo também é vida',
    'Sou feito de intensidade que vive',
    'Leve no jeito, forte na alma',
    'Meu ritmo é diferente, e tudo bem',
    'Eu me escolho todos os dias',
    'Calma também é poder',
    'Meu silêncio vale ouro',
    'Tem dias que eu viro sol',
    'Tenho pressa só de ser feliz',
    'Meu coração não combina com pouco',
    'Firme por fora, sensível por dentro',
    'Meu norte sempre foi a verdade',
    'Lealdade ainda é meu idioma',
    'Quem soma sempre encontra espaço',
    'Minha paz não entra em discussão',
    'Viver bonito é minha meta',
    'Meu brilho não pede permissão',
    'Sou raiz e também voo',
    'Nem tudo precisa de plateia',
    'Ficar bem comigo é prioridade',
    'Meu jeito já diz muita coisa',
    'Eu floresço no meu tempo'
]));

function getApiOrigin() {
    const baseFromApi = typeof API_URL === 'string'
        ? API_URL.replace(/\/api\/?$/i, '').replace(/\/+$/, '')
        : '';
    if (baseFromApi) return baseFromApi;

    if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return window.location.origin;
    }

    return 'https://guildaholiday.discloud.dev';
}

function resolveMediaUrl(value, fallback = '') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;

    const origin = getApiOrigin();
    if (raw.startsWith('/')) return `${origin}${raw}`;
    return `${origin}/${raw.replace(/^\/+/, '')}`;
}

function withCacheBuster(url) {
    if (!url) return '';
    return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
}

function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
}

function normalizeAvatarScale(value) {
    const scale = clampNumber(value, AVATAR_SCALE_MIN, AVATAR_SCALE_MAX, AVATAR_DEFAULT_SETTINGS.scale);
    return Number(scale.toFixed(4));
}

function normalizeAvatarOffset(value, fallback = AVATAR_DEFAULT_SETTINGS.offsetX) {
    const offset = clampNumber(value, AVATAR_OFFSET_MIN, AVATAR_OFFSET_MAX, fallback);
    return Number(offset.toFixed(2));
}

function normalizeBannerScale(value) {
    const scale = clampNumber(value, BANNER_SCALE_MIN, BANNER_SCALE_MAX, BANNER_DEFAULT_SETTINGS.scale);
    return Number(scale.toFixed(4));
}

function normalizeBannerOffset(value, fallback = BANNER_DEFAULT_SETTINGS.offsetX) {
    const offset = clampNumber(value, BANNER_OFFSET_MIN, BANNER_OFFSET_MAX, fallback);
    return Number(offset.toFixed(2));
}

function getAvatarOffsetBounds(naturalWidth, naturalHeight, scale) {
    const width = Math.max(1, Number(naturalWidth) || 1);
    const height = Math.max(1, Number(naturalHeight) || 1);
    const safeScale = normalizeAvatarScale(scale);
    const coverScale = Math.max(1 / width, 1 / height);
    const drawnWidth = width * coverScale * safeScale;
    const drawnHeight = height * coverScale * safeScale;
    const maxShiftX = Math.max(0, ((drawnWidth - 1) / 2) * 100);
    const maxShiftY = Math.max(0, ((drawnHeight - 1) / 2) * 100);

    return {
        minX: Math.max(AVATAR_OFFSET_MIN, 50 - maxShiftX),
        maxX: Math.min(AVATAR_OFFSET_MAX, 50 + maxShiftX),
        minY: Math.max(AVATAR_OFFSET_MIN, 50 - maxShiftY),
        maxY: Math.min(AVATAR_OFFSET_MAX, 50 + maxShiftY)
    };
}

function clampAvatarOffsetsByImage(offsetX, offsetY, naturalWidth, naturalHeight, scale) {
    const bounds = getAvatarOffsetBounds(naturalWidth, naturalHeight, scale);
    const x = clampNumber(offsetX, bounds.minX, bounds.maxX, AVATAR_DEFAULT_SETTINGS.offsetX);
    const y = clampNumber(offsetY, bounds.minY, bounds.maxY, AVATAR_DEFAULT_SETTINGS.offsetY);
    return {
        offsetX: Number(x.toFixed(2)),
        offsetY: Number(y.toFixed(2))
    };
}

function getBannerOffsetBounds(
    naturalWidth,
    naturalHeight,
    scale,
    viewportWidth = BANNER_VIEWPORT_FALLBACK_WIDTH,
    viewportHeight = BANNER_VIEWPORT_FALLBACK_HEIGHT
) {
    const width = Math.max(1, Number(naturalWidth) || 1);
    const height = Math.max(1, Number(naturalHeight) || 1);
    const safeScale = normalizeBannerScale(scale);
    const targetWidth = Math.max(1, Number(viewportWidth) || BANNER_VIEWPORT_FALLBACK_WIDTH);
    const targetHeight = Math.max(1, Number(viewportHeight) || BANNER_VIEWPORT_FALLBACK_HEIGHT);
    const coverScale = Math.max(targetWidth / width, targetHeight / height);
    const drawnWidth = width * coverScale * safeScale;
    const drawnHeight = height * coverScale * safeScale;
    const maxShiftX = Math.max(0, ((drawnWidth - targetWidth) / (2 * targetWidth)) * 100);
    const maxShiftY = Math.max(0, ((drawnHeight - targetHeight) / (2 * targetHeight)) * 100);

    return {
        minX: Math.max(BANNER_OFFSET_MIN, 50 - maxShiftX),
        maxX: Math.min(BANNER_OFFSET_MAX, 50 + maxShiftX),
        minY: Math.max(BANNER_OFFSET_MIN, 50 - maxShiftY),
        maxY: Math.min(BANNER_OFFSET_MAX, 50 + maxShiftY)
    };
}

function clampBannerOffsetsByImage(offsetX, offsetY, naturalWidth, naturalHeight, scale, viewportWidth, viewportHeight) {
    const bounds = getBannerOffsetBounds(naturalWidth, naturalHeight, scale, viewportWidth, viewportHeight);
    const x = clampNumber(offsetX, bounds.minX, bounds.maxX, BANNER_DEFAULT_SETTINGS.offsetX);
    const y = clampNumber(offsetY, bounds.minY, bounds.maxY, BANNER_DEFAULT_SETTINGS.offsetY);
    return {
        offsetX: Number(x.toFixed(2)),
        offsetY: Number(y.toFixed(2))
    };
}

function getProfileBannerViewportSize() {
    const bannerEl = document.getElementById('profileBanner');
    const width = Math.max(1, Number(bannerEl?.clientWidth) || BANNER_VIEWPORT_FALLBACK_WIDTH);
    const height = Math.max(1, Number(bannerEl?.clientHeight) || BANNER_VIEWPORT_FALLBACK_HEIGHT);
    return { width, height };
}

function syncBannerAdjustViewport() {
    const previewEl = document.getElementById('bannerAdjustPreview');
    const { width, height } = getProfileBannerViewportSize();
    bannerAdjustState.viewportWidth = width;
    bannerAdjustState.viewportHeight = height;

    if (previewEl) {
        previewEl.style.aspectRatio = `${width} / ${height}`;
    }
}

function getCurrentUserAvatarSettings() {
    return {
        scale: normalizeAvatarScale(currentUser?.avatarScale),
        offsetX: normalizeAvatarOffset(currentUser?.avatarOffsetX, AVATAR_DEFAULT_SETTINGS.offsetX),
        offsetY: normalizeAvatarOffset(currentUser?.avatarOffsetY, AVATAR_DEFAULT_SETTINGS.offsetY)
    };
}

function getCurrentUserBannerSettings() {
    return {
        scale: normalizeBannerScale(currentUser?.bannerScale),
        offsetX: normalizeBannerOffset(currentUser?.bannerOffsetX, BANNER_DEFAULT_SETTINGS.offsetX),
        offsetY: normalizeBannerOffset(currentUser?.bannerOffsetY, BANNER_DEFAULT_SETTINGS.offsetY)
    };
}

function applyAvatarTransformToImage(imageEl, settings = {}) {
    if (!imageEl) return;
    const scale = normalizeAvatarScale(settings.scale);
    const offsetX = normalizeAvatarOffset(settings.offsetX, AVATAR_DEFAULT_SETTINGS.offsetX);
    const offsetY = normalizeAvatarOffset(settings.offsetY, AVATAR_DEFAULT_SETTINGS.offsetY);
    imageEl.style.left = `${offsetX}%`;
    imageEl.style.top = `${offsetY}%`;
    imageEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function applyBannerTransformToImage(imageEl, settings = {}) {
    if (!imageEl) return;
    const scale = normalizeBannerScale(settings.scale);
    const offsetX = normalizeBannerOffset(settings.offsetX, BANNER_DEFAULT_SETTINGS.offsetX);
    const offsetY = normalizeBannerOffset(settings.offsetY, BANNER_DEFAULT_SETTINGS.offsetY);
    imageEl.style.left = `${offsetX}%`;
    imageEl.style.top = `${offsetY}%`;
    imageEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function ensureProfileAvatarImageElement() {
    const avatarContainer = document.getElementById('profileAvatar');
    if (!avatarContainer) return null;

    let imageEl = avatarContainer.querySelector('.profile-avatar-image');
    if (!imageEl) {
        imageEl = document.createElement('img');
        imageEl.className = 'profile-avatar-image';
        imageEl.alt = 'Avatar do perfil';
        avatarContainer.appendChild(imageEl);
    }

    return imageEl;
}

function ensureProfileBannerImageElement() {
    const bannerContainer = document.getElementById('profileBanner');
    if (!bannerContainer) return null;

    let imageEl = bannerContainer.querySelector('.profile-banner-image');
    if (!imageEl) {
        imageEl = document.createElement('img');
        imageEl.className = 'profile-banner-image';
        imageEl.alt = 'Banner do perfil';
        const actionsWrap = bannerContainer.querySelector('.banner-ring-actions');
        if (actionsWrap) {
            bannerContainer.insertBefore(imageEl, actionsWrap);
        } else {
            bannerContainer.appendChild(imageEl);
        }
    }

    return imageEl;
}

function syncAvatarActionButtons() {
    const removeBtn = document.getElementById('removeAvatarBtn');
    const uploadBtn = document.getElementById('avatarUploadTriggerBtn');
    const avatarWrap = document.querySelector('.profile-avatar-wrap');
    if (!removeBtn || !avatarWrap) return;

    const hasAvatar = Boolean(currentUser?.avatar);
    const hadAvatar = avatarWrap.classList.contains('has-avatar');
    const uploadLabel = hasAvatar ? 'Trocar avatar' : 'Adicionar avatar';

    removeBtn.disabled = !hasAvatar;
    removeBtn.style.pointerEvents = hasAvatar ? 'auto' : 'none';
    removeBtn.style.cursor = hasAvatar ? 'pointer' : 'default';
    removeBtn.tabIndex = hasAvatar ? 0 : -1;
    removeBtn.setAttribute('aria-hidden', hasAvatar ? 'false' : 'true');
    if (uploadBtn) {
        uploadBtn.setAttribute('aria-label', uploadLabel);
    }

    const uploadTooltip = document.querySelector('.avatar-upload-tooltip');
    if (uploadTooltip) {
        uploadTooltip.textContent = uploadLabel;
    }

    const removeTooltip = document.querySelector('.avatar-remove-tooltip');
    if (removeTooltip) {
        removeTooltip.textContent = 'Remover avatar';
    }

    if (avatarActionTransitionTimer) {
        clearTimeout(avatarActionTransitionTimer);
        avatarActionTransitionTimer = null;
    }

    if (!hasInitializedAvatarActionButtons) {
        hasInitializedAvatarActionButtons = true;
        avatarWrap.classList.toggle('has-avatar', hasAvatar);
        avatarWrap.classList.toggle('no-avatar', !hasAvatar);
        removeBtn.classList.remove('avatar-remove-appear');
        removeBtn.classList.remove('avatar-remove-disappear');
        return;
    }

    if (hasAvatar && !hadAvatar) {
        avatarWrap.classList.add('has-avatar');
        avatarWrap.classList.remove('no-avatar');
        removeBtn.classList.remove('avatar-remove-disappear');
        removeBtn.classList.remove('avatar-remove-appear');
        void removeBtn.offsetWidth;
        removeBtn.classList.add('avatar-remove-appear');
    } else if (!hasAvatar && hadAvatar) {
        avatarWrap.classList.add('has-avatar');
        avatarWrap.classList.remove('no-avatar');
        removeBtn.classList.remove('avatar-remove-appear');
        removeBtn.classList.remove('avatar-remove-disappear');
        void removeBtn.offsetWidth;
        removeBtn.classList.add('avatar-remove-disappear');
        avatarActionTransitionTimer = setTimeout(() => {
            avatarWrap.classList.remove('has-avatar');
            avatarWrap.classList.add('no-avatar');
            removeBtn.classList.remove('avatar-remove-disappear');
            avatarActionTransitionTimer = null;
        }, 420);
    } else if (!hasAvatar) {
        avatarWrap.classList.remove('has-avatar');
        avatarWrap.classList.add('no-avatar');
        removeBtn.classList.remove('avatar-remove-disappear');
        removeBtn.classList.remove('avatar-remove-appear');
    } else {
        avatarWrap.classList.add('has-avatar');
        avatarWrap.classList.remove('no-avatar');
        removeBtn.classList.remove('avatar-remove-disappear');
    }
}

function applyCurrentUserAvatarVisual(options = {}) {
    const avatarContainer = document.getElementById('profileAvatar');
    const avatarImage = ensureProfileAvatarImageElement();
    if (!avatarContainer || !avatarImage) return;

    const withBuster = options.withCacheBuster === true;
    const resolvedAvatar = currentUser?.avatar ? resolveMediaUrl(currentUser.avatar) : '';
    const finalAvatarUrl = resolvedAvatar
        ? (withBuster ? withCacheBuster(resolvedAvatar) : resolvedAvatar)
        : '';

    if (!finalAvatarUrl) {
        avatarImage.removeAttribute('src');
        avatarImage.style.display = 'none';
        avatarContainer.style.backgroundImage = '';
        syncAvatarActionButtons();
        return;
    }

    avatarImage.src = finalAvatarUrl;
    avatarImage.style.display = 'block';
    avatarContainer.style.backgroundImage = 'none';
    applyAvatarTransformToImage(avatarImage, getCurrentUserAvatarSettings());
    syncAvatarActionButtons();
}

function syncBannerActionButtons() {
    const removeBtn = document.getElementById('removeBannerBtn');
    const bannerEl = document.getElementById('profileBanner');
    if (!removeBtn || !bannerEl) return;

    const hasBanner = Boolean(currentUser?.banner);
    const hadBanner = bannerEl.classList.contains('has-banner');

    removeBtn.disabled = !hasBanner;
    removeBtn.style.pointerEvents = hasBanner ? 'auto' : 'none';
    removeBtn.style.cursor = hasBanner ? 'pointer' : 'default';
    removeBtn.tabIndex = hasBanner ? 0 : -1;
    removeBtn.setAttribute('aria-hidden', hasBanner ? 'false' : 'true');

    if (bannerActionTransitionTimer) {
        clearTimeout(bannerActionTransitionTimer);
        bannerActionTransitionTimer = null;
    }

    if (!hasInitializedBannerActionButtons) {
        hasInitializedBannerActionButtons = true;
        bannerEl.classList.toggle('has-banner', hasBanner);
        bannerEl.classList.toggle('no-banner', !hasBanner);
        removeBtn.classList.remove('banner-remove-appear');
        removeBtn.classList.remove('banner-remove-disappear');
        return;
    }

    if (hasBanner && !hadBanner) {
        bannerEl.classList.add('has-banner');
        bannerEl.classList.remove('no-banner');
        removeBtn.classList.remove('banner-remove-disappear');
        removeBtn.classList.remove('banner-remove-appear');
        void removeBtn.offsetWidth;
        removeBtn.classList.add('banner-remove-appear');
    } else if (!hasBanner && hadBanner) {
        bannerEl.classList.add('has-banner');
        bannerEl.classList.remove('no-banner');
        removeBtn.classList.remove('banner-remove-appear');
        removeBtn.classList.remove('banner-remove-disappear');
        void removeBtn.offsetWidth;
        removeBtn.classList.add('banner-remove-disappear');
        bannerActionTransitionTimer = setTimeout(() => {
            bannerEl.classList.remove('has-banner');
            bannerEl.classList.add('no-banner');
            removeBtn.classList.remove('banner-remove-disappear');
            bannerActionTransitionTimer = null;
        }, 400);
    } else if (!hasBanner) {
        bannerEl.classList.remove('has-banner');
        bannerEl.classList.add('no-banner');
        removeBtn.classList.remove('banner-remove-disappear');
        removeBtn.classList.remove('banner-remove-appear');
    } else {
        bannerEl.classList.add('has-banner');
        bannerEl.classList.remove('no-banner');
        removeBtn.classList.remove('banner-remove-disappear');
    }
}

function applyCurrentUserBannerVisual(options = {}) {
    const bannerEl = document.getElementById('profileBanner');
    const bannerImage = ensureProfileBannerImageElement();
    if (!bannerEl || !bannerImage) return;

    const withBuster = options.withCacheBuster === true;
    const resolvedBanner = currentUser?.banner ? resolveMediaUrl(currentUser.banner) : '';
    const finalBannerUrl = resolvedBanner
        ? (withBuster ? withCacheBuster(resolvedBanner) : resolvedBanner)
        : '';

    if (!finalBannerUrl) {
        bannerImage.removeAttribute('src');
        bannerImage.style.display = 'none';
        bannerEl.style.backgroundImage = '';
        syncBannerActionButtons();
        return;
    }

    bannerImage.src = finalBannerUrl;
    bannerImage.style.display = 'block';
    bannerEl.style.backgroundImage = 'none';
    applyBannerTransformToImage(bannerImage, getCurrentUserBannerSettings());
    syncBannerActionButtons();
}

function normalizeRankOrderKey(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `n:${value}`;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '';

        // J? este normalizado
        if (trimmed.startsWith('n:')) {
            const id = Number(trimmed.slice(2));
            return Number.isFinite(id) ? `n:${id}` : '';
        }
        if (trimmed.startsWith('s:')) {
            const key = trimmed.slice(2).trim();
            return key ? `s:${key}` : '';
        }

        const asNumber = Number(trimmed);
        if (Number.isFinite(asNumber)) {
            return `n:${asNumber}`;
        }

        return `s:${trimmed}`;
    }

    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
        return `n:${asNumber}`;
    }

    return '';
}

function rankOrderKeyToPayload(key) {
    if (!key) return null;
    if (key.startsWith('n:')) {
        const id = Number(key.slice(2));
        return Number.isFinite(id) ? id : null;
    }
    if (key.startsWith('s:')) {
        const value = key.slice(2);
        return value ? value : null;
    }
    return null;
}

function rankOrderKeyToNumericId(key) {
    if (!key || !key.startsWith('n:')) return null;
    const id = Number(key.slice(2));
    return Number.isFinite(id) ? id : null;
}

function getDisplayedRankOrderPayload() {
    const badges = Array.from(document.querySelectorAll('#selectedAchievementsDisplay .selected-conquista-badge'));
    if (badges.length === 0) return [];

    return badges
        .map((badge) => normalizeRankOrderKey(badge.dataset.rankId))
        .filter(Boolean)
        .map((key) => rankOrderKeyToPayload(key))
        .filter((value) => value !== null);
}

function getRankOrderKeyFromRank(rank) {
    return normalizeRankOrderKey(rank?.id);
}



function setSelectedProfileRankOrder(values) {
    const normalizedOrder = Array.isArray(values)
        ? values
            .map((value) => {
                const key = normalizeRankOrderKey(value);
                return key ? rankOrderKeyToPayload(key) : null;
            })
            .filter((value) => value !== null)
        : [];

    selectedProfileRankOrder = normalizedOrder;
    selectedProfileRankIds = normalizedOrder
        .filter((value) => typeof value === 'number' && Number.isFinite(value))
        .map((value) => Number(value));
}

function isRankSelectedForDisplay(rankOrId) {
    const rawValue = typeof rankOrId === 'object' && rankOrId !== null
        ? rankOrId.id
        : rankOrId;
    const targetKey = normalizeRankOrderKey(rawValue);
    if (!targetKey) return false;
    return selectedProfileRankOrder.some((value) => normalizeRankOrderKey(value) === targetKey);
}

function isFixedRankEntry(rank) {
    const rankId = String(rank?.id || '');
    return Boolean(rank?.isFixed) || Number(rank?.isVisible) === 0 || rankId.startsWith('fixed:');
}

function getFixedRankNameKey(rank) {
    if (!isFixedRankEntry(rank)) return '';
    const name = String(rank?.name || '').trim().toLowerCase();
    return name ? `fixed-name:${name}` : '';
}

function syncUnifiedRankStripMode(enabled) {
    const rankBadge = document.getElementById('rankBadge');
    const autoRanks = document.getElementById('automaticRanksInline');
    const customRanks = document.getElementById('customRanksInline');
    const rankNameEl = document.getElementById('rankName');
    const hasRankBadgeText = Boolean(String(rankNameEl?.textContent || '').trim());
    const hasAutomaticBadges = Boolean(autoRanks?.children?.length);
    const hasCustomBadges = Boolean(customRanks?.children?.length);
    const primaryRankName = normalizeAchievementNameKey(rankNameEl?.textContent || '');
    const selectedRankNames = new Set(
        Array.from(document.querySelectorAll('#selectedAchievementsDisplay .selected-conquista-badge span'))
            .map((badgeName) => normalizeAchievementNameKey(badgeName.textContent || ''))
            .filter(Boolean)
    );
    const betaIsSelectedInStrip = selectedRankNames.has(normalizeAchievementNameKey('Membro Beta'));
    const primaryRankIsRepresentedInStrip = selectedRankNames.has(primaryRankName);

    if (rankBadge) {
        rankBadge.style.display = !hasRankBadgeText || (enabled && primaryRankIsRepresentedInStrip)
            ? 'none'
            : '';
    }
    if (autoRanks) {
        autoRanks.style.display = enabled || betaIsSelectedInStrip || !hasAutomaticBadges ? 'none' : '';
    }
    if (customRanks) {
        customRanks.style.display = enabled || !hasCustomBadges ? 'none' : '';
    }
}

function getEffectiveProfileTagline() {
    const customTagline = normalizeProfileTagline(String(currentUser?.profileTagline || ''));
    return customTagline;
}

function normalizeProfileTagline(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .trim();
}

function getProfileTaglineVisibleText(value) {
    return String(value || '')
        .replace(/\[([^\]\r\n]{1,100})\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi, '$1')
        .replace(/([^()\r\n<[\]]{1,100})\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi, '$1');
}

function getProfileTaglineVisibleLength(value) {
    return getProfileTaglineVisibleText(value).length;
}

function normalizeProfileTag(value) {
    return String(value || '')
        .replace(/\s+/g, '')
        .trim()
        .slice(0, PROFILE_TAG_MAX_LENGTH);
}

function normalizeProfileTagStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'none';
    return PROFILE_TAG_STYLE_OPTIONS.includes(raw) ? raw : 'none';
}

function normalizeProfileTagSymbolStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'none';
    return PROFILE_TAG_SYMBOL_OPTIONS.includes(raw) ? raw : 'none';
}

function normalizeProfileTagBannerStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'pill';
    return PROFILE_TAG_BANNER_OPTIONS.includes(raw) ? raw : 'pill';
}

function getStoredProfileTagStyle() {
    try {
        return normalizeProfileTagStyle(localStorage.getItem(PROFILE_TAG_STYLE_STORAGE_KEY) || '');
    } catch (err) {
        return 'none';
    }
}

function setStoredProfileTagStyle(value) {
    try {
        localStorage.setItem(PROFILE_TAG_STYLE_STORAGE_KEY, normalizeProfileTagStyle(value));
    } catch (err) {
        // ignore storage errors
    }
}

function getStoredProfileTagBanner() {
    try {
        return normalizeProfileTagBannerStyle(localStorage.getItem(PROFILE_TAG_BANNER_STORAGE_KEY) || '');
    } catch (err) {
        return 'pill';
    }
}

function setStoredProfileTagBanner(value) {
    try {
        localStorage.setItem(PROFILE_TAG_BANNER_STORAGE_KEY, normalizeProfileTagBannerStyle(value));
    } catch (err) {
        // ignore storage errors
    }
}

function parseRgbColor(value) {
    const match = String(value || '').trim().match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i);
    if (!match) return null;
    const r = Number(match[1]);
    const g = Number(match[2]);
    const b = Number(match[3]);
    const a = match[4] !== undefined ? Number(match[4]) : null;
    if ([r, g, b].some((v) => Number.isNaN(v) || v < 0 || v > 255)) return null;
    if (a !== null && (Number.isNaN(a) || a < 0 || a > 1)) return null;
    return a === null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

function normalizeProfileTagColor(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(raw)) {
        return raw.toUpperCase();
    }
    const rgb = parseRgbColor(raw);
    return rgb || '';
}

function normalizeProfileTagBool(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    const raw = String(value || '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
}

function resolveProfileTagTheme({
    color,
    gradientStart,
    gradientEnd,
    useGradient,
    textColor
} = {}) {
    const base = normalizeProfileTagColor(color) || PROFILE_TAG_DEFAULT_COLOR;
    const start = normalizeProfileTagColor(gradientStart) || base;
    const end = normalizeProfileTagColor(gradientEnd) || PROFILE_TAG_DEFAULT_COLOR_2;
    const text = normalizeProfileTagColor(textColor) || PROFILE_TAG_DEFAULT_TEXT_COLOR;
    if (!useGradient) {
        return {
            useGradient: false,
            color1: base,
            color2: base,
            textColor: text
        };
    }
    return {
        useGradient: true,
        color1: start,
        color2: end,
        textColor: text
    };
}

function resolveFixedPaletteTheme(style, theme) {
    const palette = TAG_FX_STYLE_PALETTES[style];
    if (!palette || palette.length === 0) return theme;
    const fallback = theme || resolveProfileTagTheme({});
    return {
        ...fallback,
        useGradient: true,
        color1: palette[0],
        color2: palette[palette.length - 1]
    };
}

function applyProfileTagTheme(el, { style, theme, text, symbolStyle, bannerStyle } = {}) {
    if (!el) return;
    const normalizedStyle = normalizeProfileTagStyle(style);
    const baseTheme = theme || resolveProfileTagTheme({});
    const resolvedTheme = resolveFixedPaletteTheme(normalizedStyle, baseTheme);
    const normalizedSymbolStyle = normalizeProfileTagSymbolStyle(symbolStyle);
    const normalizedBannerStyle = normalizeProfileTagBannerStyle(bannerStyle);

    el.dataset.tagStyle = normalizedStyle;
    el.dataset.tagBanner = normalizedBannerStyle;
    el.style.setProperty('--tag-color', resolvedTheme.color1);
    el.style.setProperty('--tag-color-2', resolvedTheme.color2);
    el.style.setProperty('--tag-text-color', resolvedTheme.textColor || PROFILE_TAG_DEFAULT_TEXT_COLOR);
    el.classList.toggle('tag-animated-border', normalizedStyle !== 'none');
    if (typeof text === 'string') {
        setProfileTagText(el, text);
    }
    applyProfileTagSymbols(el, normalizedSymbolStyle);
    applyProfileTagFx(el, normalizedStyle, resolvedTheme);
}

function setProfileTagText(el, text) {
    if (!el) return;
    Array.from(el.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            el.removeChild(node);
        }
    });
    let textSpan = el.querySelector('.tag-text');
    if (!textSpan) {
        textSpan = document.createElement('span');
        textSpan.className = 'tag-text';
        el.appendChild(textSpan);
    }
    textSpan.textContent = text;
}

function applyProfileTagSymbols(el, style) {
    if (!el) return;
    const normalizedStyle = normalizeProfileTagSymbolStyle(style);

    // Remove any previous symbol nodes (unicode or gif).
    el.querySelectorAll('.tag-symbol').forEach((node) => node.remove());
    el.querySelectorAll('.tag-gif').forEach((node) => node.remove());

    if (normalizedStyle === 'none') {
        el.dataset.tagSymbolStyle = 'none';
        el.classList.remove('tag-with-symbols', 'tag-symbols-gif');
        const instance = ensureTagFxInstance(el);
        if (instance) instance.symbolStyle = 'none';
        return;
    }

    let textEl = el.querySelector('.tag-text');
    if (!textEl) {
        textEl = document.createElement('span');
        textEl.className = 'tag-text';
        el.appendChild(textEl);
    }

    const centerGif = document.createElement('span');
    centerGif.className = `tag-gif tag-gif-${normalizedStyle} center`;
    centerGif.setAttribute('aria-hidden', 'true');

    const leftGif = document.createElement('span');
    leftGif.className = `tag-gif tag-gif-${normalizedStyle} left`;
    leftGif.setAttribute('aria-hidden', 'true');

    const rightGif = document.createElement('span');
    rightGif.className = `tag-gif tag-gif-${normalizedStyle} right`;
    rightGif.setAttribute('aria-hidden', 'true');

    // Insert around the existing text node (keep any FX canvas nodes intact).
    el.insertBefore(centerGif, textEl);
    el.insertBefore(leftGif, textEl);
    el.insertBefore(rightGif, textEl.nextSibling);

    el.dataset.tagSymbolStyle = normalizedStyle;
    el.classList.add('tag-with-symbols', 'tag-symbols-gif');
    const instance = ensureTagFxInstance(el);
    if (instance) {
        instance.symbolStyle = normalizedStyle;
    }
}

const tagFxInstances = new Map();
let tagFxNoiseCanvas = null;
let tagFxNoiseCtx = null;
let tagFxLoopHandle = null;

function ensureTagFxNoiseCanvas() {
    if (tagFxNoiseCanvas) return;
    const size = 64;
    tagFxNoiseCanvas = document.createElement('canvas');
    tagFxNoiseCanvas.width = size;
    tagFxNoiseCanvas.height = size;
    tagFxNoiseCtx = tagFxNoiseCanvas.getContext('2d');
    const img = tagFxNoiseCtx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
        const value = Math.floor(Math.random() * 255);
        img.data[i] = value;
        img.data[i + 1] = value;
        img.data[i + 2] = value;
        img.data[i + 3] = 255;
    }
    tagFxNoiseCtx.putImageData(img, 0, 0);
}

function parseColorToRgb(value, fallback = { r: 236, g: 72, b: 153 }) {
    const raw = String(value || '').trim();
    if (!raw) return { ...fallback };
    if (raw.startsWith('#')) {
        const hex = raw.slice(1);
        if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            return { r, g, b };
        }
        if (hex.length >= 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return { r, g, b };
        }
    }
    const rgbMatch = raw.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
    if (rgbMatch) {
        return {
            r: Math.min(255, Number(rgbMatch[1])),
            g: Math.min(255, Number(rgbMatch[2])),
            b: Math.min(255, Number(rgbMatch[3]))
        };
    }
    return { ...fallback };
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function mixRgb(a, b, t) {
    return {
        r: Math.round(lerp(a.r, b.r, t)),
        g: Math.round(lerp(a.g, b.g, t)),
        b: Math.round(lerp(a.b, b.b, t))
    };
}

function fract(value) {
    return value - Math.floor(value);
}

function hash2D(x, y, seed = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return fract(n);
}

function getTagFxPalette(style) {
    const palette = TAG_FX_STYLE_PALETTES[style];
    if (!palette) return null;
    return palette.map((value) => parseColorToRgb(value));
}

function adjustRgb(color, amount) {
    const t = clamp(amount, -1, 1);
    if (t === 0) return { ...color };
    const target = t > 0 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
    return mixRgb(color, target, Math.abs(t));
}

function rgbToString(color, alpha = 1) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function resolveTagFxSettings(style) {
    return TAG_FX_STYLE_PRESETS[style] || TAG_FX_STYLE_PRESETS.none;
}

function ensureTagFxInstance(el) {
    if (!el) return null;
    let instance = tagFxInstances.get(el);
    if (!instance) {
        const canvas = document.createElement('canvas');
        canvas.className = 'tag-fx-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        el.classList.add('has-fx-canvas');
        if (el.firstChild) {
            el.insertBefore(canvas, el.firstChild);
        } else {
            el.appendChild(canvas);
        }
        instance = {
            el,
            canvas,
            ctx: canvas.getContext('2d', { alpha: true }),
            style: 'none',
            themeKey: '',
            settings: TAG_FX_STYLE_PRESETS.none,
            seed: Math.random() * 1000,
            stars: [],
            particles: [],
            staticDrawn: false
        };
        tagFxInstances.set(el, instance);
    } else if (!instance.canvas?.isConnected) {
        el.classList.add('has-fx-canvas');
        if (el.firstChild) {
            el.insertBefore(instance.canvas, el.firstChild);
        } else {
            el.appendChild(instance.canvas);
        }
    }
    return instance;
}

function applyProfileTagFx(el, style, theme) {
    const instance = ensureTagFxInstance(el);
    if (!instance) return;

    const resolvedTheme = theme || resolveProfileTagTheme({});
    const themeKey = `${resolvedTheme.color1}|${resolvedTheme.color2}`;
    const settings = resolveTagFxSettings(style);
    const styleChanged = instance.style !== style;
    const themeChanged = instance.themeKey !== themeKey;

    instance.style = style;
    instance.settings = settings;
    instance.themeKey = themeKey;
    instance.theme = resolvedTheme;
    instance.staticDrawn = false;

    if (styleChanged) {
        instance.stars = [];
        instance.particles = [];
    }
    if (themeChanged) {
        instance.stars = [];
        instance.particles = [];
    }

    startTagFxLoop();
}

function startTagFxLoop() {
    if (window.ProfileAnimationPreferences?.getMode?.() === 'off') return;
    if (tagFxLoopHandle) return;
    ensureTagFxNoiseCanvas();
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tick = (time) => {
        let hasActive = false;
        tagFxInstances.forEach((instance, el) => {
            if (!el.isConnected) {
                tagFxInstances.delete(el);
                return;
            }
            renderTagFxInstance(instance, time, reduceMotion);
            hasActive = true;
        });

        if (hasActive && !reduceMotion) {
            tagFxLoopHandle = window.requestAnimationFrame(tick);
        } else {
            tagFxLoopHandle = null;
        }
    };

    tagFxLoopHandle = window.requestAnimationFrame(tick);
}

function stopTagFxLoop() {
    if (tagFxLoopHandle !== null) {
        window.cancelAnimationFrame(tagFxLoopHandle);
        tagFxLoopHandle = null;
    }

    tagFxInstances.forEach((instance) => {
        instance.ctx?.clearRect(0, 0, instance.canvas.width, instance.canvas.height);
    });
}

window.addEventListener('profile-animation-mode-change', (event) => {
    if (event.detail?.mode === 'off') {
        stopTagFxLoop();
    } else {
        startTagFxLoop();
    }
    if (!isApplyingProfileAnimationSettings) {
        syncProfileAnimationControls(event.detail?.mode);
    }
});

function resizeTagFxCanvas(instance) {
    const rect = instance.el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));

    if (instance.canvas.width !== width || instance.canvas.height !== height) {
        instance.canvas.width = width;
        instance.canvas.height = height;
    }

    instance.canvas.style.width = `${rect.width}px`;
    instance.canvas.style.height = `${rect.height}px`;

    return { width, height, dpr, logicalWidth: rect.width, logicalHeight: rect.height };
}

function renderTagFxInstance(instance, time, reduceMotion) {
    if (!instance.ctx) return;
    const { width, height, dpr, logicalWidth, logicalHeight } = resizeTagFxCanvas(instance);
    if (width <= 0 || height <= 0) return;

    const ctx = instance.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    const t = (time * 0.001) + instance.seed;
    if (reduceMotion && instance.staticDrawn) return;
    drawTagFx(ctx, logicalWidth, logicalHeight, t, instance);
    updateTagSymbolAnimation(instance, t, reduceMotion);
    if (reduceMotion) {
        instance.staticDrawn = true;
    }
}

function drawTagFx(ctx, w, h, t, instance) {
    const settings = instance.settings || TAG_FX_STYLE_PRESETS.none;
    const theme = instance.theme || resolveProfileTagTheme({});
    const palette = getTagFxPalette(instance.style);
    const c1 = palette ? palette[0] : parseColorToRgb(theme.color1);
    const c2 = palette ? palette[palette.length - 1] : parseColorToRgb(theme.color2, c1);
    const mid = palette
        ? palette[Math.floor(palette.length / 2)]
        : mixRgb(c1, c2, 0.5);
    const bright = adjustRgb(mid, 0.28);
    const dim = adjustRgb(mid, -0.2);
    const angle = (settings.angle || 135) * (Math.PI / 180);
    const drift = settings.drift || 0;
    const speed = settings.speed || 0.15;
    const resolvedPalette = palette || [c1, mid, c2];

    const dx = Math.cos(angle) * (w * 0.6);
    const dy = Math.sin(angle) * (h * 0.6);
    const offset = Math.sin(t * speed) * drift * 0.2;
    const cx = w * 0.5 + offset * w;
    const cy = h * 0.5 - offset * h;

    const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    gradient.addColorStop(0, rgbToString(c1, 1));
    gradient.addColorStop(0.5, rgbToString(mid, 1));
    gradient.addColorStop(1, rgbToString(c2, 1));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    if (settings.glow) {
        ctx.save();
        ctx.globalAlpha = clamp(settings.glow, 0, 1);
        ctx.globalCompositeOperation = 'screen';
        const glow = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, Math.max(w, h));
        glow.addColorStop(0, rgbToString(bright, 0.7));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    if (settings.noise) {
        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = clamp(settings.noise, 0, 0.6);
        const noiseScale = 1.6;
        const nx = (t * speed * 40) % (tagFxNoiseCanvas.width * noiseScale);
        const ny = (t * speed * 30) % (tagFxNoiseCanvas.height * noiseScale);
        ctx.drawImage(
            tagFxNoiseCanvas,
            -nx,
            -ny,
            w + tagFxNoiseCanvas.width * noiseScale,
            h + tagFxNoiseCanvas.height * noiseScale
        );
        ctx.restore();
    }

    switch (settings.mode) {
        case 'wave':
            drawTagWaves(ctx, w, h, t, settings, bright);
            break;
        case 'sparkle':
            drawTagSparkles(ctx, w, h, t, settings, instance, bright);
            break;
        case 'glow':
            drawTagGlowPulse(ctx, w, h, t, settings, bright);
            break;
        case 'pulse':
            drawTagPulseOverlay(ctx, w, h, t, settings, bright);
            break;
        case 'prism':
            drawTagPrism(ctx, w, h, t, settings, bright, dim);
            break;
        case 'vortex':
            drawTagVortex(ctx, w, h, t, settings, bright);
            break;
        case 'shimmer':
            drawTagShimmer(ctx, w, h, t, settings);
            break;
        case 'fire':
            drawTagFire(ctx, w, h, t, settings, instance, c1, c2, bright);
            break;
        case 'ice':
            drawTagIce(ctx, w, h, t, settings, bright);
            break;
        case 'storm':
            drawTagStorm(ctx, w, h, t, settings);
            break;
        case 'burst':
            drawTagBurst(ctx, w, h, t, settings, bright);
            break;
        case 'mist':
            drawTagMist(ctx, w, h, t, settings);
            break;
        case 'tiles':
            drawTagTiles(ctx, w, h, t, settings, resolvedPalette);
            break;
        case 'digital':
            drawTagDigital(ctx, w, h, t, settings, resolvedPalette);
            break;
        case 'quilt':
            drawTagQuilt(ctx, w, h, t, settings, resolvedPalette);
            break;
        case 'circuit':
            drawTagCircuit(ctx, w, h, t, settings, resolvedPalette, instance);
            break;
        case 'blocks':
            drawTagBlocks(ctx, w, h, t, settings, resolvedPalette, instance);
            break;
        case 'gold':
            drawTagGold(ctx, w, h, t, settings, resolvedPalette);
            break;
        case 'ribbons':
            drawTagRibbons(ctx, w, h, t, settings, resolvedPalette);
            break;
        case 'poly':
            drawTagPoly(ctx, w, h, t, settings, resolvedPalette, instance);
            break;
        case 'royal':
            drawTagRoyal(ctx, w, h, t, settings, resolvedPalette);
            break;
        case 'sand':
            drawTagSand(ctx, w, h, t, settings, resolvedPalette);
            break;
        default:
            break;
    }
}

const TAG_SYMBOL_ANIM_PRESETS = {
    default: { speed: 1.6, amp: 2, rot: 6, scale: 0.06, flicker: 0.1 },
    ornate: { speed: 2.2, amp: 2.4, rot: 8, scale: 0.08, flicker: 0.35 },
    spark: { speed: 2.6, amp: 2.8, rot: 10, scale: 0.1, flicker: 0.45 },
    flare: { speed: 2.8, amp: 3, rot: 12, scale: 0.1, flicker: 0.5 },
    crystal: { speed: 2.1, amp: 2.2, rot: 7, scale: 0.08, flicker: 0.25 },
    laurel: { speed: 1.4, amp: 1.6, rot: 4, scale: 0.05, flicker: 0.1 },
    aura: { speed: 1.8, amp: 2.2, rot: 6, scale: 0.07, flicker: 0.2 },
    wings: { speed: 1.2, amp: 2.6, rot: 5, scale: 0.06, flicker: 0.12 },
    blades: { speed: 1.7, amp: 2.4, rot: 8, scale: 0.07, flicker: 0.18 },
    orb: { speed: 1.5, amp: 1.8, rot: 0, scale: 0.1, flicker: 0.2 },
    sigil: { speed: 2.0, amp: 2.2, rot: 9, scale: 0.08, flicker: 0.3 },
    crown: { speed: 1.6, amp: 2.0, rot: 5, scale: 0.07, flicker: 0.2 }
};

function updateTagSymbolAnimation(instance, t, reduceMotion) {
    const symbolStyle = instance.symbolStyle || 'none';
    const el = instance.el;
    if (!el || symbolStyle === 'none') return;
    const left = el.querySelector('.tag-symbol.left');
    const right = el.querySelector('.tag-symbol.right');
    if (!left || !right) return;
    if (reduceMotion) {
        left.style.transform = '';
        right.style.transform = '';
        left.style.opacity = '';
        right.style.opacity = '';
        return;
    }
    const preset = TAG_SYMBOL_ANIM_PRESETS[symbolStyle] || TAG_SYMBOL_ANIM_PRESETS.default;
    const phase = t * preset.speed;
    const wobble = Math.sin(phase);
    const drift = Math.cos(phase * 0.8);
    const translateX = wobble * preset.amp;
    const translateY = drift * (preset.amp * 0.4);
    const rotate = wobble * preset.rot;
    const scale = 1 + preset.scale * Math.sin(phase * 1.4);
    const flicker = preset.flicker ? (0.65 + 0.35 * Math.sin(phase * 2.2)) : 1;

    left.style.transform = `translate(${translateX}px, ${translateY}px) rotate(${rotate}deg) scale(${scale})`;
    right.style.transform = `translate(${-translateX}px, ${translateY}px) rotate(${-rotate}deg) scale(${scale})`;
    left.style.opacity = String(flicker);
    right.style.opacity = String(flicker);
}

function drawTagWaves(ctx, w, h, t, settings, color) {
    const waves = settings.waves || 3;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = Math.max(1, h * 0.12);
    for (let i = 0; i < waves; i += 1) {
        const phase = t * (settings.speed || 0.2) * (1 + i * 0.2);
        const y = h * (0.3 + (i / (waves + 1)));
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
            const waveY = y + Math.sin((x / w) * Math.PI * 2 + phase) * (h * 0.08);
            if (x === 0) ctx.moveTo(x, waveY);
            else ctx.lineTo(x, waveY);
        }
        ctx.strokeStyle = rgbToString(color, 0.25);
        ctx.stroke();
    }
    ctx.restore();
}

function drawTagSparkles(ctx, w, h, t, settings, instance, color) {
    const starCount = settings.stars || 10;
    if (instance.stars.length !== starCount) {
        instance.stars = Array.from({ length: starCount }, () => ({
            x: Math.random(),
            y: Math.random(),
            r: 0.08 + Math.random() * 0.14,
            speed: 0.6 + Math.random() * 1.4,
            seed: Math.random() * Math.PI * 2
        }));
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    instance.stars.forEach((star) => {
        const twinkle = 0.4 + 0.6 * Math.sin(t * star.speed + star.seed);
        const radius = star.r * Math.min(w, h);
        const gx = star.x * w;
        const gy = star.y * h;
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
        grad.addColorStop(0, rgbToString(color, 0.35 * twinkle));
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);
    });
    ctx.restore();
}

function drawTagGlowPulse(ctx, w, h, t, settings, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pulse = 0.35 + 0.3 * Math.sin(t * (settings.speed || 0.3) * 2);
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h));
    grad.addColorStop(0, rgbToString(color, pulse));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function drawTagPulseOverlay(ctx, w, h, t, settings, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pulse = 0.25 + 0.25 * Math.sin(t * (settings.speed || 0.4) * 2.6);
    ctx.fillStyle = rgbToString(color, pulse);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function drawTagPrism(ctx, w, h, t, settings, bright, dim) {
    const bands = settings.bands || 3;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const angle = Math.sin(t * (settings.speed || 0.2)) * 0.4;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle);
    ctx.translate(-w / 2, -h / 2);
    for (let i = 0; i < bands; i += 1) {
        const offset = (i / bands) * w;
        const grad = ctx.createLinearGradient(offset, 0, offset + w * 0.6, h);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, rgbToString(bright, 0.35));
        grad.addColorStop(1, rgbToString(dim, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
}

function drawTagVortex(ctx, w, h, t, settings, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(w / 2, h / 2);
    ctx.rotate(t * (settings.speed || 0.2));
    for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.strokeStyle = rgbToString(color, 0.2);
        ctx.lineWidth = h * (0.08 - i * 0.015);
        ctx.arc(0, 0, Math.min(w, h) * (0.35 + i * 0.12), 0, Math.PI * 1.5);
        ctx.stroke();
    }
    ctx.restore();
}

function drawTagShimmer(ctx, w, h, t, settings) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const speed = settings.speed || 0.4;
    const x = (t * speed * w) % (w * 2) - w;
    ctx.translate(x, 0);
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function drawTagFire(ctx, w, h, t, settings, instance, c1, c2, bright) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const heat = settings.heat || 0.8;
    const baseGrad = ctx.createLinearGradient(0, h, 0, 0);
    baseGrad.addColorStop(0, rgbToString(adjustRgb(c1, 0.15), 0.8));
    baseGrad.addColorStop(0.5, rgbToString(bright, 0.9));
    baseGrad.addColorStop(1, rgbToString(adjustRgb(c2, 0.35), 0.2));
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    const embers = settings.embers || 6;
    if (instance.particles.length !== embers) {
        instance.particles = Array.from({ length: embers }, () => ({
            x: Math.random(),
            y: 1 + Math.random() * 0.3,
            r: 0.05 + Math.random() * 0.08,
            speed: 0.08 + Math.random() * 0.12
        }));
    }
    instance.particles.forEach((p) => {
        p.y -= p.speed * (settings.speed || 0.5);
        if (p.y < -0.2) {
            p.y = 1 + Math.random() * 0.2;
            p.x = Math.random();
        }
        const gx = p.x * w;
        const gy = p.y * h;
        const radius = p.r * Math.min(w, h);
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
        grad.addColorStop(0, rgbToString(bright, 0.35 * heat));
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);
    });
    ctx.restore();
}

function drawTagIce(ctx, w, h, t, settings, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.strokeStyle = rgbToString(color, 0.18);
    const count = 5;
    for (let i = 0; i < count; i += 1) {
        const offset = (t * (settings.speed || 0.15) * 40 + i * 30) % (w + 60) - 30;
        ctx.beginPath();
        ctx.moveTo(offset, -10);
        ctx.lineTo(offset + w * 0.3, h + 10);
        ctx.stroke();
    }
    ctx.restore();
}

function drawTagStorm(ctx, w, h, t, settings) {
    ctx.save();
    const flash = Math.max(0, Math.sin(t * 2 + (settings.speed || 0.2) * 3) - 0.65);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function drawTagBurst(ctx, w, h, t, settings, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pulse = 0.25 + 0.25 * Math.sin(t * (settings.speed || 0.2) * 2);
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h));
    grad.addColorStop(0, rgbToString(color, pulse));
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function drawTagMist(ctx, w, h, t, settings) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.2;
    ctx.filter = 'blur(6px)';
    const offsetX = (t * (settings.speed || 0.1) * 20) % 40;
    ctx.drawImage(tagFxNoiseCanvas, -offsetX, 0, w + 40, h);
    ctx.filter = 'none';
    ctx.restore();
}

function drawTagTiles(ctx, w, h, t, settings, palette) {
    ctx.save();
    const size = Math.max(6, h * 0.6);
    const speed = settings.speed || 0.1;
    const shift = (t * speed * size) % size;
    const rows = Math.ceil((h + size * 2) / size);
    const cols = Math.ceil((w + size * 2) / size);
    for (let row = -1; row < rows; row += 1) {
        const y = row * size - shift;
        const rowOffset = (row % 2) * (size * 0.5);
        for (let col = -1; col < cols; col += 1) {
            const x = col * size - shift + rowOffset;
            const idx = Math.abs((row + col) % palette.length);
            ctx.fillStyle = rgbToString(palette[idx], 0.9);
            ctx.fillRect(x, y, size, size);
        }
    }
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.35;
    const glow = ctx.createLinearGradient(0, 0, w, h);
    glow.addColorStop(0, rgbToString(palette[palette.length - 1], 0.45));
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function drawTagDigital(ctx, w, h, t, settings, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const cell = Math.max(6, h * 0.45);
    const speed = settings.speed || 0.2;
    const phase = t * speed * 2;
    for (let y = -cell; y < h + cell; y += cell) {
        for (let x = -cell; x < w + cell; x += cell) {
            const wave = Math.sin((x * 0.14 + y * 0.21) + phase);
            if (wave > 0.35) {
                const size = cell * (0.35 + 0.35 * (wave - 0.35));
                const color = palette[(Math.abs(Math.floor((x + y) / cell)) + 2) % palette.length];
                ctx.fillStyle = rgbToString(color, 0.4);
                ctx.fillRect(x + cell * 0.2, y + cell * 0.2, size, size);
            }
        }
    }
    const lineY = (phase * h * 0.6) % (h * 2) - h;
    const scan = ctx.createLinearGradient(0, lineY, 0, lineY + h * 0.4);
    scan.addColorStop(0, 'rgba(255,255,255,0)');
    scan.addColorStop(0.5, rgbToString(palette[palette.length - 1], 0.45));
    scan.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = scan;
    ctx.fillRect(0, lineY, w, h * 0.4);
    ctx.restore();
}

function drawTagQuilt(ctx, w, h, t, settings, palette) {
    ctx.save();
    const size = Math.max(8, h * 0.7);
    const speed = settings.speed || 0.08;
    const drift = Math.sin(t * speed) * size * 0.2;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(Math.PI / 4);
    ctx.translate(-w / 2, -h / 2);
    for (let y = -size; y < h + size; y += size) {
        for (let x = -size; x < w + size; x += size) {
            const shade = ((x + y) / size) % 2 === 0 ? 0.08 : -0.05;
            const base = adjustRgb(palette[0], shade);
            ctx.fillStyle = rgbToString(base, 0.95);
            ctx.fillRect(x + drift, y + drift, size, size);
        }
    }
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = rgbToString(palette[palette.length - 1], 0.35);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function drawTagCircuit(ctx, w, h, t, settings, palette, instance) {
    if (!instance.circuitLines || instance.circuitLines.length === 0) {
        const count = 7;
        instance.circuitLines = Array.from({ length: count }, () => ({
            x1: Math.random(),
            y1: Math.random(),
            x2: Math.random(),
            y2: Math.random(),
            width: 0.6 + Math.random() * 0.8,
            seed: Math.random() * Math.PI * 2
        }));
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const speed = settings.speed || 0.12;
    instance.circuitLines.forEach((line, index) => {
        const pulse = 0.3 + 0.35 * Math.sin(t * speed * 2 + line.seed);
        const color = palette[index % palette.length];
        ctx.strokeStyle = rgbToString(color, pulse);
        ctx.lineWidth = Math.max(1, h * 0.05 * line.width);
        ctx.beginPath();
        ctx.moveTo(line.x1 * w, line.y1 * h);
        ctx.lineTo(line.x2 * w, line.y2 * h);
        ctx.stroke();

        ctx.fillStyle = rgbToString(color, 0.6);
        ctx.beginPath();
        ctx.arc(line.x2 * w, line.y2 * h, Math.max(1.5, h * 0.06), 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawTagBlocks(ctx, w, h, t, settings, palette, instance) {
    if (!instance.blocks || instance.blocks.length === 0) {
        const count = 6;
        instance.blocks = Array.from({ length: count }, () => ({
            x: Math.random(),
            y: Math.random(),
            w: 0.2 + Math.random() * 0.35,
            h: 0.25 + Math.random() * 0.4,
            seed: Math.random() * Math.PI * 2
        }));
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const speed = settings.speed || 0.18;
    instance.blocks.forEach((block, index) => {
        const drift = Math.sin(t * speed + block.seed) * 0.04;
        const color = palette[index % palette.length];
        ctx.fillStyle = rgbToString(color, 0.65);
        ctx.fillRect(
            (block.x + drift) * w,
            (block.y + drift) * h,
            block.w * w,
            block.h * h
        );
    });
    ctx.restore();
}

function drawTagGold(ctx, w, h, t, settings, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bandWidth = h * 1.4;
    ctx.translate(-w * 0.2, h * 0.1);
    ctx.rotate(-0.35);
    const band = ctx.createLinearGradient(0, 0, bandWidth, 0);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, rgbToString(palette[palette.length - 1], 0.7));
    band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, -bandWidth / 2, w * 1.6, bandWidth);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = rgbToString(palette[palette.length - 1], 0.6);
    const step = Math.max(6, h * 0.5);
    for (let x = 0; x < w + step; x += step) {
        ctx.strokeRect(x, h - step * 0.9, step * 0.5, step * 0.5);
    }
    ctx.restore();
}

function drawTagRibbons(ctx, w, h, t, settings, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const speed = settings.speed || 0.18;
    const lineCount = 3;
    for (let i = 0; i < lineCount; i += 1) {
        const y = h * (0.25 + i * 0.25);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
            const wave = Math.sin((x / w) * Math.PI * 2 + t * speed + i);
            ctx.lineTo(x, y + wave * (h * 0.08));
        }
        ctx.strokeStyle = rgbToString(palette[2 % palette.length], 0.35);
        ctx.lineWidth = Math.max(1, h * 0.07);
        ctx.stroke();
    }
    ctx.restore();
}

function drawTagPoly(ctx, w, h, t, settings, palette, instance) {
    ctx.save();
    const size = Math.max(8, h * 0.9);
    const speed = settings.speed || 0.1;
    const seed = instance.seed + t * speed;
    for (let y = -size; y < h + size; y += size) {
        for (let x = -size; x < w + size; x += size) {
            const n = hash2D(x / size, y / size, seed);
            const color = palette[Math.floor(n * palette.length)];
            ctx.fillStyle = rgbToString(color, 0.75);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + size, y);
            ctx.lineTo(x + size, y + size);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = rgbToString(palette[(Math.floor(n * palette.length) + 1) % palette.length], 0.65);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + size, y + size);
            ctx.lineTo(x, y + size);
            ctx.closePath();
            ctx.fill();
        }
    }
    ctx.restore();
}

function drawTagRoyal(ctx, w, h, t, settings, palette) {
    ctx.save();
    const border = Math.max(1, h * 0.16);
    ctx.strokeStyle = rgbToString(palette[palette.length - 1], 0.9);
    ctx.lineWidth = border;
    ctx.strokeRect(border * 0.5, border * 0.5, w - border, h - border);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const speed = settings.speed || 0.12;
    const x = (t * speed * w * 1.4) % (w * 2) - w;
    const shine = ctx.createLinearGradient(x, 0, x + w * 0.4, 0);
    shine.addColorStop(0, 'rgba(255,255,255,0)');
    shine.addColorStop(0.5, rgbToString(palette[palette.length - 1], 0.6));
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
}

function drawTagSand(ctx, w, h, t, settings, palette) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.2;
    ctx.drawImage(tagFxNoiseCanvas, 0, 0, w, h);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = rgbToString(palette[1], 0.35);
    ctx.lineWidth = Math.max(2, h * 0.22);
    ctx.lineCap = 'round';
    const speed = settings.speed || 0.08;
    for (let i = 0; i < 3; i += 1) {
        const offset = Math.sin(t * speed + i) * (h * 0.08);
        ctx.beginPath();
        ctx.moveTo(-w * 0.1, h * (0.2 + i * 0.25) + offset);
        ctx.bezierCurveTo(
            w * 0.3,
            h * (0.15 + i * 0.25),
            w * 0.6,
            h * (0.35 + i * 0.25),
            w * 1.1,
            h * (0.25 + i * 0.25) + offset
        );
        ctx.stroke();
    }
    ctx.restore();
}

function normalizeTaglineEditorDisplay(value) {
    const normalized = normalizeProfileTagline(value);
    return normalized.replace(/\[([^\]\r\n]{1,100})\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi, (fullMatch, rawLabel, rawUrl) => {
        const label = String(rawLabel || '').trim();
        const url = String(rawUrl || '').trim();
        if (!label || !url || /\s/.test(label)) return fullMatch;
        return `${label}(${url})`;
    });
}

function sanitizeSelectedTaglineLinkLabel(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';

    const markdownMatch = raw.match(/^\[([^\]\r\n]{1,100})\]\(((?:https?:\/\/|www\.)[^\s)]+)\)$/i);
    if (markdownMatch) {
        return String(markdownMatch[1] || '').trim();
    }

    const simpleMatch = raw.match(/^([^()\s<\[\]]{1,100})\(((?:https?:\/\/|www\.)[^\s)]+)\)$/i);
    if (simpleMatch) {
        return String(simpleMatch[1] || '').trim();
    }

    return raw.replace(/^\[|\]$/g, '').trim();
}

function getTaglineEditorElements() {
    return {
        inputEl: document.getElementById('editProfileTagline'),
        richEl: document.getElementById('editProfileTaglineRich')
    };
}

function getTaglineEditorSelectionRange() {
    const { richEl } = getTaglineEditorElements();
    if (!richEl) return null;

    const selection = window.getSelection();
    if (
        typeof taglineLinkSelectionStart === 'number' &&
        typeof taglineLinkSelectionEnd === 'number'
    ) {
        const offsetRange = createRangeFromTextOffsets(richEl, taglineLinkSelectionStart, taglineLinkSelectionEnd);
        if (offsetRange) {
            return offsetRange;
        }
    }

    if (selection && selection.rangeCount > 0) {
        const currentRange = selection.getRangeAt(0);
        if (richEl.contains(currentRange.commonAncestorContainer)) {
            return currentRange.cloneRange();
        }
    }

    if (taglineLinkSelectionRange && richEl.contains(taglineLinkSelectionRange.commonAncestorContainer)) {
        return taglineLinkSelectionRange.cloneRange();
    }

    return null;
}

function normalizeTaglineSelectionText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getTaglineEditorTextOffset(root, container, offset) {
    const range = document.createRange();
    range.setStart(root, 0);
    range.setEnd(container, offset);
    return range.toString().length;
}

function createRangeFromTextOffsets(root, start, end) {
    if (typeof start !== 'number' || typeof end !== 'number' || start < 0 || end < start) {
        return null;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const range = document.createRange();
    let position = 0;
    let startSet = false;

    while (walker.nextNode()) {
        const node = walker.currentNode;
        const nodeLength = String(node.textContent || '').length;
        const nodeEnd = position + nodeLength;

        if (!startSet && start >= position && start <= nodeEnd) {
            range.setStart(node, start - position);
            startSet = true;
        }

        if (startSet && end >= position && end <= nodeEnd) {
            range.setEnd(node, end - position);
            return range;
        }

        position = nodeEnd;
    }

    return null;
}

function getTaglineEditorSelectionOffsets() {
    const { richEl } = getTaglineEditorElements();
    if (!richEl) return null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!richEl.contains(range.commonAncestorContainer) || range.collapsed) return null;

    const start = getTaglineEditorTextOffset(richEl, range.startContainer, range.startOffset);
    const end = getTaglineEditorTextOffset(richEl, range.endContainer, range.endOffset);

    return {
        start: Math.min(start, end),
        end: Math.max(start, end),
        text: range.toString()
    };
}

function adjustTaglineSelectionRangeToText(range, expectedText) {
    if (!range || !expectedText) return range;

    const normalizedExpected = normalizeTaglineSelectionText(expectedText);
    const normalizedRangeText = normalizeTaglineSelectionText(range.toString());
    if (!normalizedExpected || normalizedExpected === normalizedRangeText) {
        return range;
    }

    if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer;
        const nodeText = String(textNode.textContent || '');
        const endOffset = range.endOffset;
        const candidateStart = nodeText.lastIndexOf(expectedText, endOffset - 1);

        if (candidateStart !== -1 && candidateStart + expectedText.length === endOffset) {
            range.setStart(textNode, candidateStart);
            range.setEnd(textNode, endOffset);
            return range;
        }

        const normalizedNodeText = normalizeTaglineSelectionText(nodeText.slice(0, endOffset));
        const normalizedExpectedIndex = normalizedNodeText.lastIndexOf(normalizedExpected);
        if (normalizedExpectedIndex !== -1) {
            let rawStart = 0;
            let currentNormalized = '';
            for (let i = 0; i < endOffset; i += 1) {
                const char = nodeText[i];
                if (!/\s/.test(char)) {
                    currentNormalized += char;
                } else if (currentNormalized.length && !/\s/.test(currentNormalized.slice(-1))) {
                    currentNormalized += ' ';
                }
                if (currentNormalized.length === normalizedExpectedIndex) {
                    rawStart = i + 1;
                    break;
                }
            }
            const rawEnd = endOffset;
            if (rawStart >= range.startOffset && rawEnd <= range.endOffset) {
                range.setStart(textNode, rawStart);
                range.setEnd(textNode, rawEnd);
            }
        }
    }

    return range;
}

function serializeTaglineEditorNode(node) {
    if (!node) return '';

    if (node.nodeType === Node.TEXT_NODE) {
        return String(node.textContent || '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
    }

    const element = /** @type {HTMLElement} */ (node);
    const tag = String(element.tagName || '').toLowerCase();

    if (tag === 'br') {
        return '\n';
    }

    if (tag === 'a') {
        const label = sanitizeSelectedTaglineLinkLabel(element.textContent || '');
        if (!label) return '';

        const href = normalizeTaglineHref(element.getAttribute('href') || '');
        if (!href) return label;

        return /\s/.test(label)
            ? `[${label}](${href})`
            : `${label}(${href})`;
    }

    let value = '';
    element.childNodes.forEach((childNode) => {
        value += serializeTaglineEditorNode(childNode);
    });

    if ((tag === 'div' || tag === 'p') && value && !value.endsWith('\n')) {
        value += '\n';
    }

    return value;
}

function serializeTaglineEditorContent(richEl) {
    if (!richEl) return '';

    let text = '';
    richEl.childNodes.forEach((childNode) => {
        text += serializeTaglineEditorNode(childNode);
    });

    return String(text || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n');
}

function getTaglineEditorRawValue({ normalize = true } = {}) {
    const { inputEl, richEl } = getTaglineEditorElements();
    const raw = richEl
        ? serializeTaglineEditorContent(richEl)
        : String(inputEl?.value || '');

    return normalize
        ? normalizeProfileTagline(raw)
        : String(raw || '').replace(/\r\n/g, '\n');
}

function renderTaglineEditorFromRaw(value) {
    const { inputEl, richEl } = getTaglineEditorElements();
    const normalized = normalizeProfileTagline(value);

    if (inputEl) {
        inputEl.value = normalized;
    }

    if (richEl) {
        richEl.innerHTML = normalized
            ? normalized.split('\n').map((line) => buildTaglineLineHtml(line)).join('<br>')
            : '';
    }

    return normalized;
}

function focusTaglineEditorAtEnd() {
    const { richEl } = getTaglineEditorElements();
    if (!richEl) return;

    richEl.focus();
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.selectNodeContents(richEl);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

function insertPlainTextAtSelection(text) {
    const value = String(text || '');
    if (!value) return;

    if (document.queryCommandSupported?.('insertText')) {
        document.execCommand('insertText', false, value);
        return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(value));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function splitUrlAndTrailingPunctuation(value) {
    let core = String(value || '');
    let trailing = '';

    while (core && /[),.!?:;]$/.test(core)) {
        trailing = core.slice(-1) + trailing;
        core = core.slice(0, -1);
    }

    return { core, trailing };
}

function normalizeTaglineHref(rawUrl) {
    const value = String(rawUrl || '').trim();
    if (!value) return '';

    const normalized = /^https?:\/\//i.test(value)
        ? value
        : (/^www\./i.test(value) ? `https://${value}` : '');
    if (!normalized) return '';

    try {
        const parsed = new URL(normalized);
        const protocol = String(parsed.protocol || '').toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') return '';
        return parsed.toString();
    } catch {
        return '';
    }
}

function buildTaglineLineHtml(line) {
    const source = String(line || '');
    const tokenRegex = /(\[([^\]\r\n]{1,100})\]\(((?:https?:\/\/|www\.)[^\s)]+)\))|(([^()\s\r\n<[\]]{1,100})\(((?:https?:\/\/|www\.)[^\s)]+)\))|((?:https?:\/\/|www\.)[^\s<]+)/gi;
    let html = '';
    let cursor = 0;
    let match;

    while ((match = tokenRegex.exec(source)) !== null) {
        const rawMatch = String(match[0] || '');
        const index = Number(match.index || 0);
        html += escapeHtml(source.slice(cursor, index));

        const markdownLabel = String(match[2] || '');
        const markdownHref = String(match[3] || '');
        const simpleLabel = String(match[5] || '');
        const simpleHref = String(match[6] || '');
        const autoUrlMatch = String(match[7] || '');

        if (markdownLabel && markdownHref) {
            const href = normalizeTaglineHref(markdownHref);
            if (href) {
                html += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(markdownLabel)}</a>`;
            } else {
                html += escapeHtml(rawMatch);
            }
        } else if (simpleLabel && simpleHref) {
            const href = normalizeTaglineHref(simpleHref);
            if (href) {
                html += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(simpleLabel)}</a>`;
            } else {
                html += escapeHtml(rawMatch);
            }
        } else {
            const { core, trailing } = splitUrlAndTrailingPunctuation(autoUrlMatch || rawMatch);
            const href = normalizeTaglineHref(core);
            if (href && core) {
                html += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(core)}</a>`;
            } else {
                html += escapeHtml(autoUrlMatch || rawMatch);
            }

            if (trailing) {
                html += escapeHtml(trailing);
            }
        }

        cursor = index + rawMatch.length;
    }

    html += escapeHtml(source.slice(cursor));
    return html;
}

function formatProfileTaglineHtml(value) {
    const tagline = normalizeProfileTagline(String(value || ''));
    if (!tagline.trim()) {
        return '';
    }

    return tagline
        .split('\n')
        .map((line) => buildTaglineLineHtml(line))
        .join('<br>');
}

function renderProfileTaglineBottom() {
    // Footer profile tagline is disabled here because the random tagline
    // should only appear inside the "Minhas Conquistas" section.
    const taglineBottomEl = document.getElementById('profileTaglineDisplayBottom');
    if (taglineBottomEl) {
        taglineBottomEl.style.display = 'none';
    }
}

function renderProfileTagline() {
    const taglineEl = document.getElementById('profileTaglineDisplay') || document.getElementById('rankDescription');
    if (taglineEl) {
        const html = formatProfileTaglineHtml(getEffectiveProfileTagline());
        taglineEl.innerHTML = html;
        taglineEl.style.display = html ? 'block' : 'none';
    }
    renderProfileTaglineBottom();
}

function applyVisibilityToggleState(buttonEl, isVisible, showLabel, hideLabel) {
    if (!buttonEl) return;

    buttonEl.innerHTML = isVisible ? VISIBILITY_ICON_EYE_OFF : VISIBILITY_ICON_EYE;
    buttonEl.setAttribute('aria-pressed', String(isVisible));
    buttonEl.setAttribute('aria-label', isVisible ? hideLabel : showLabel);
    buttonEl.setAttribute('data-tooltip', isVisible ? hideLabel : showLabel);
}

function syncEmailToggleButton() {
    const emailDisplay = document.getElementById('profileEmail');
    const toggleEmailBtn = document.getElementById('toggleEmailBtn');
    if (!emailDisplay || !toggleEmailBtn) return;

    const isHidden = emailDisplay.getAttribute('data-hidden') === 'true';
    applyVisibilityToggleState(toggleEmailBtn, !isHidden, 'Mostrar e-mail', 'Ocultar e-mail');
}

function isValidEmailFormat(email) {
    const normalizedEmail = String(email || '').trim();
    if (!normalizedEmail) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
}

function syncProfileEmailStatusVisual() {
    const emailDisplay = document.getElementById('profileEmail');
    const editEmailField = document.getElementById('editEmail');
    const sendVerifyCodeBtn = document.getElementById('sendVerifyCodeBtn');
    const requestEmailChangeBtn = document.getElementById('requestEmailChangeBtn');
    
    if (!emailDisplay && !editEmailField) return;

    const normalizedEmail = String(currentUser?.email || '').trim();
    const hasValidEmail = isValidEmailFormat(normalizedEmail);
    const isVerified = Boolean(currentUser?.emailVerified);
    const isHealthyEmail = hasValidEmail && isVerified;

    // Aplicar ao email principal da página
    if (emailDisplay) {
        emailDisplay.classList.remove('email-status-ok', 'email-status-alert');
        emailDisplay.classList.add(isHealthyEmail ? 'email-status-ok' : 'email-status-alert');
        emailDisplay.setAttribute('data-tooltip', isHealthyEmail ? 'E-mail confirmado' : 'E-mail não confirmado');
    }

    // Aplicar ao campo de edição no modal
    if (editEmailField) {
        editEmailField.classList.remove('email-status-ok', 'email-status-alert');
        editEmailField.classList.add(isHealthyEmail ? 'email-status-ok' : 'email-status-alert');
    }

    const verificationBadge = document.getElementById('emailVerificationStatus');
    if (verificationBadge) {
        verificationBadge.style.display = 'none';
    }

    if (sendVerifyCodeBtn) {
        sendVerifyCodeBtn.style.display = isVerified ? 'none' : 'inline-flex';
    }
    if (requestEmailChangeBtn) {
        requestEmailChangeBtn.style.display = isVerified ? 'none' : 'inline-flex';
    }
}

function setupPasswordVisibilityToggles() {
    const pairs = [
        ['toggleCurrentPassword', 'currentPassword'],
        ['toggleNewPassword', 'newPassword'],
        ['toggleConfirmPassword', 'confirmPassword']
    ];

    pairs.forEach(([buttonId, inputId]) => {
        const buttonEl = document.getElementById(buttonId);
        const inputEl = document.getElementById(inputId);
        if (!buttonEl || !inputEl) return;

        const updateState = () => {
            const isVisible = inputEl.type === 'text';
            applyVisibilityToggleState(buttonEl, isVisible, 'Mostrar senha', 'Ocultar senha');
        };

        updateState();

        if (buttonEl.dataset.boundPasswordToggle === '1') return;
        buttonEl.dataset.boundPasswordToggle = '1';

        buttonEl.addEventListener('click', (e) => {
            e.preventDefault();
            inputEl.type = inputEl.type === 'password' ? 'text' : 'password';
            updateState();
        });
    });
}

// Sistema de notificação customizada
function showNotification(message, type = 'success') {
    const toast = document.getElementById('notificationToast');
    
    // Remover classe de hide se existir
    toast.classList.remove('hide');
    
    // Definir tipo e mensagem
    toast.className = type;
    toast.textContent = message;
    
    // Mostrar
    toast.style.display = 'block';
    
    // Limpar timeout anterior
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    // Esconder apes 4 segundos
    notificationTimeout = setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 4000);
}

function getInboxModalElements() {
    return {
        modal: document.getElementById('notificationInboxModal'),
        bell: document.getElementById('notificationBell'),
        badge: document.getElementById('notificationBadge'),
        inboxBtn: document.getElementById('inboxBtn'),
        list: document.getElementById('notificationInboxList'),
        summary: document.getElementById('notificationInboxSummary'),
        deleteSelectedBtn: document.getElementById('deleteSelectedInboxBtn'),
        selectionActions: document.getElementById('inboxSelectionActions'),
        selectAllCheckbox: document.getElementById('selectAllInboxCheckbox'),
        confirmModal: document.getElementById('inboxDeleteConfirmModal'),
        confirmText: document.getElementById('inboxDeleteConfirmText'),
        confirmDeleteBtn: document.getElementById('confirmInboxDeleteBtn'),
        cancelDeleteBtn: document.getElementById('cancelInboxDeleteBtn'),
        detailModal: document.getElementById('inboxDetailModal'),
        detailType: document.getElementById('inboxDetailType'),
        detailTitle: document.getElementById('inboxDetailTitle'),
        detailAuthor: document.getElementById('inboxDetailAuthor'),
        detailTime: document.getElementById('inboxDetailTime'),
        detailContext: document.getElementById('inboxDetailContext'),
        detailMessage: document.getElementById('inboxDetailMessage'),
        detailAttachment: document.getElementById('inboxDetailAttachment'),
        detailReplyBox: document.getElementById('inboxDetailReplyBox'),
        detailReplyInput: document.getElementById('inboxDetailReplyInput'),
        detailReplyBtn: document.getElementById('inboxDetailReplyBtn'),
        detailReplyCount: document.getElementById('inboxDetailReplyCount')
    };
}

let inboxDeleteConfirmResolver = null;
let activeInboxDetailItem = null;

function closeInboxDeleteConfirm(result = false) {
    const { confirmModal, confirmText } = getInboxModalElements();
    if (confirmModal) {
        confirmModal.style.display = 'none';
    }
    if (confirmText) {
        confirmText.textContent = 'Deseja excluir as mensagens selecionadas?';
    }
    if (typeof inboxDeleteConfirmResolver === 'function') {
        const resolve = inboxDeleteConfirmResolver;
        inboxDeleteConfirmResolver = null;
        resolve(result);
    }
}

function openInboxDeleteConfirm(selectedCount = 0) {
    const { confirmModal, confirmText } = getInboxModalElements();
    if (!confirmModal || !confirmText) return Promise.resolve(false);
    confirmText.textContent = `Excluir ${selectedCount} mensagem(ns) selecionada(s)?`;
    confirmModal.style.display = 'block';
    return new Promise((resolve) => {
        inboxDeleteConfirmResolver = resolve;
    });
}

function formatInboxDateTime(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Agora mesmo';
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function buildInboxTypeLabel(item) {
    const type = String(item?.type || '').trim().toLowerCase();
    if (type === 'suspension') {
        return '⚠️ Suspensão';
    }
    if (type === 'ticket') {
        const isReview = String(item?.ticketTitle || '').includes('Solicitação de Revisão');
        if (isReview) {
            const status = String(item?.suspensionStatus || 'under_review').trim().toLowerCase();
            if (status === 'resolved') return 'Revisão - Aprovada';
            return 'Revisão - Em Análise';
        }
        
        const isSuspension = String(item?.ticketTitle || '').includes('Suspensa');
        if (isSuspension) {
            const status = String(item?.suspensionStatus || 'suspended').trim().toLowerCase();
            if (status === 'resolved') return 'Suspensão - Resolvida';
            if (status === 'under_review') return 'Suspensão - Em Análise';
            return 'Suspensão - Ativa';
        }
        return 'Ticket';
    }
    if (type === 'achievement') return 'Conquista';
    if (type === 'comment') return 'Comentário';
    if (type === 'heart') return 'Coração';
    if (type === 'like') return 'Like';
    return 'Notificação';
}

function buildInboxTitle(item) {
    const type = String(item?.type || '').trim().toLowerCase();
    const actor = String(item?.nickname || 'Sistema').trim() || 'Sistema';
    if (type === 'ticket') {
        return String(item?.ticketTitle || 'Ticket da administração').trim() || 'Ticket da administração';
    }
    if (type === 'achievement') {
        const rankName = String(item?.rankName || 'nova conquista').trim();
        return `Nova conquista: ${rankName}`;
    }
    if (type === 'comment') return `${actor} comentou em uma postagem sua`;
    if (type === 'heart') return `${actor} enviou um coração`;
    if (type === 'like') return `${actor} curtiu uma postagem sua`;
    return 'Nova notificação';
}

function getAchievementDisplayMessage(item) {
    const rawMessage = String(item?.achievementMessage || item?.message || '').trim();
    const rankName = String(item?.rankName || '').trim();
    const normalizedMessage = rawMessage.toLowerCase();

    if (normalizedMessage.includes('conquista automática de evento') || normalizedMessage.includes('conquista de postagem')) {
        return rankName ? `Você recebeu a conquista especial "${rankName}".` : rawMessage || 'Você recebeu uma nova conquista.';
    }

    return rawMessage || 'Você recebeu uma nova conquista.';
}

function buildInboxText(item) {
    const type = String(item?.type || '').trim().toLowerCase();
    if (type === 'suspension') {
        const reason = String(item?.suspensionReason || 'motivos da comunidade').trim();
        return `Sua postagem foi suspendida por: ${reason}. Você pode editar a postagem e solicitar uma revisão.`;
    }
    if (type === 'ticket') {
        const isReview = String(item?.ticketTitle || '').includes('Solicitação de Revisão');
        if (isReview) {
            const userMessage = String(item?.suspensionUserMessage || '').trim();
            if (userMessage) {
                return `Alterações: ${userMessage.length > 100 ? userMessage.slice(0, 97) + '...' : userMessage}`;
            }
            return 'Sua postagem foi enviada para revisão.';
        }
        
        const message = String(item?.ticketMessage || '').trim();
        if (message) return message;
        if (item?.ticketAttachmentPath) return 'Você recebeu um ticket com anexo da administração.';
        return 'Você recebeu uma mensagem da administração.';
    }
    if (type === 'achievement') {
        return getAchievementDisplayMessage(item);
    }
    const downloadName = String(item?.downloadName || 'sua postagem').trim() || 'sua postagem';
    if (type === 'comment') {
        const preview = String(item?.commentContent || '').trim();
        if (preview) {
            return preview.length > 120 ? `${preview.slice(0, 117)}...` : preview;
        }
        if (item?.commentAttachmentPath) {
            return `Comentaram em "${downloadName}" com um anexo.`;
        }
        return `Alguém interagiu com "${downloadName}".`;
    }
    if (type === 'heart') return `Sua postagem "${downloadName}" recebeu um coração.`;
    if (type === 'like') return `Sua postagem "${downloadName}" recebeu um like.`;
    return 'Você recebeu uma atualização na sua conta.';
}

function buildInboxFooter(item) {
    const type = String(item?.type || '').trim().toLowerCase();
    if (type === 'ticket') {
        // Não mostrar quem enviou o ticket
        return '';
    }
    if (type === 'achievement') {
        return String(item?.rankName || 'Conquista especial').trim();
    }
    const downloadName = String(item?.downloadName || '').trim();
    return downloadName ? `Postagem: ${downloadName}` : '';
}

function getInboxTypeClass(item) {
    const type = String(item?.type || '').trim().toLowerCase();
    if (type === 'ticket') {
        return 'inbox-type-ticket';
    }
    if (type === 'achievement') {
        const rankName = String(item?.rankName || '').trim();
        const isCustom = rankName.startsWith('fixed:manual');
        return isCustom ? 'inbox-type-custom-achievement' : 'inbox-type-auto-achievement';
    }
    return '';
}

function buildInboxAvatarHtml(item) {
    // Ícone para tickets (admin messages, suspensions, reviews)
    const isTicket = item?.type === 'ticket';
    if (isTicket) {
        return '<div class="inbox-avatar inbox-avatar-icon-ticket">!</div>';
    }
    
    // Ícone para conquistas (é um mérito do site, não de uma pessoa)
    const isAchievement = item?.type === 'achievement';
    if (isAchievement) {
        return '<div class="inbox-avatar inbox-avatar-icon-achievement"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3h8v4.5a4 4 0 0 1-8 0V3Z"></path><path d="M8 5H5v2a4 4 0 0 0 3 3.87M16 5h3v2a4 4 0 0 1-3 3.87M12 11.5V17m-3 4h6m-5-4h4"></path></svg></div>';
    }
    
    const avatarUrl = resolveMediaUrl(String(item?.avatar || '').trim(), '');
    if (avatarUrl) {
        // Aplicar zoom se disponível
        const scale = Number(item?.avatarScale) || 1;
        const offsetX = Number(item?.avatarOffsetX) || 50;
        const offsetY = Number(item?.avatarOffsetY) || 50;
        
        console.log('[ZOOM DEBUG]', {
            id: item?.id,
            avatarUrl: !!avatarUrl,
            scale,
            offsetX,
            offsetY,
            hasZoom: scale !== 1,
            fullItem: item
        });
        
        const hasZoom = scale !== 1;
        if (hasZoom) {
            return `<div class="inbox-avatar" style="position: relative;"><img src="${escapeHtml(avatarUrl)}" alt="" style="position: absolute; left: ${offsetX}%; top: ${offsetY}%; transform: translate(-50%, -50%) scale(${scale}); width: 100%; height: 100%; object-fit: cover;"></div>`;
        }
        
        return `<div class="inbox-avatar"><img src="${escapeHtml(avatarUrl)}" alt=""></div>`;
    }
    const fallbackText = String(item?.nickname || item?.rankName || 'AD')
        .trim()
        .slice(0, 2)
        .toUpperCase() || 'AD';
    return `<div class="inbox-avatar">${escapeHtml(fallbackText)}</div>`;
}

function normalizeInboxAttachment(item) {
    const path = resolveMediaUrl(String(item?.commentAttachmentPath || item?.ticketAttachmentPath || '').trim(), '');
    if (!path) return null;
    const mime = String(item?.commentAttachmentMime || item?.ticketAttachmentMime || '').trim().toLowerCase();
    const originalName = String(item?.commentAttachmentOriginalName || item?.ticketAttachmentOriginalName || '').trim() || 'anexo';
    const isImage = mime.startsWith('image/');
    return {
        path,
        mime,
        originalName,
        isImage
    };
}

function buildInboxContext(item) {
    const downloadName = String(item?.downloadName || '').trim();
    if (!downloadName) return '';
    return `Postagem relacionada: ${downloadName}`;
}

function buildInboxDetailMessage(item) {
    const type = String(item?.type || '').trim().toLowerCase();
    if (type === 'ticket') {
        const message = String(item?.ticketMessage || '').trim();
        if (message) return message;
        if (item?.ticketAttachmentPath) return 'Você recebeu um ticket com anexo da administração.';
        return 'Você recebeu uma mensagem da administração.';
    }
    if (type === 'achievement') {
        return getAchievementDisplayMessage(item);
    }
    if (type === 'comment') {
        return String(item?.commentContent || '').trim() || 'Este comentário não tem texto, mas pode conter anexo.';
    }
    return String(buildInboxText(item) || '').trim();
}

async function ensureInboxNotificationRead(notificationId) {
    const item = inboxNotificationsCache.find((entry) => String(entry?.id || '') === String(notificationId || ''));
    if (!item || item?.isRead) return true;
    const result = await AuthAPI.markNotificationAsRead(notificationId);
    if (!result?.success) return false;
    inboxNotificationsCache = inboxNotificationsCache.map((entry) => {
        if (String(entry?.id || '') !== String(notificationId || '')) return entry;
        return { ...entry, isRead: 1 };
    });
    renderInboxNotifications(inboxNotificationsCache);
    refreshInboxBadge().catch(() => {});
    return true;
}

function closeInboxDetailModal() {
    const { detailModal, detailAttachment, detailReplyInput, detailReplyBox, detailContext } = getInboxModalElements();
    if (detailModal) detailModal.style.display = 'none';
    if (detailAttachment) {
        detailAttachment.style.display = 'none';
        detailAttachment.innerHTML = '';
    }
    if (detailReplyInput) detailReplyInput.value = '';
    if (detailReplyBox) detailReplyBox.style.display = 'none';
    if (detailContext) {
        detailContext.style.display = 'none';
        detailContext.textContent = '';
    }
    activeInboxDetailItem = null;
}

function openInboxDetailModal(item) {
    const {
        detailModal,
        detailType,
        detailTitle,
        detailAuthor,
        detailTime,
        detailContext,
        detailMessage,
        detailAttachment,
        detailReplyBox,
        detailReplyInput,
        detailReplyCount
    } = getInboxModalElements();
    if (!detailModal || !detailTitle || !detailMessage) return;

    activeInboxDetailItem = item || null;
    const typeLabel = buildInboxTypeLabel(item);
    const author = String(item?.nickname || 'Sistema').trim() || 'Sistema';
    const contextText = buildInboxContext(item);
    const attachment = normalizeInboxAttachment(item);
    const canReply = String(item?.type || '').trim().toLowerCase() === 'comment' && Number(item?.downloadId || 0) > 0;

    if (detailType) detailType.textContent = typeLabel;
    detailTitle.textContent = buildInboxTitle(item);
    // Não mostrar autor para tickets
    if (detailAuthor) {
        const type = String(item?.type || '').trim().toLowerCase();
        if (type === 'ticket') {
            detailAuthor.textContent = '';
        } else {
            detailAuthor.textContent = `De: ${author}`;
        }
    }
    if (detailTime) detailTime.textContent = formatInboxDateTime(item?.createdAt);
    detailMessage.textContent = buildInboxDetailMessage(item);

    if (detailContext) {
        if (contextText) {
            detailContext.textContent = contextText;
            detailContext.style.display = 'block';
        } else {
            detailContext.textContent = '';
            detailContext.style.display = 'none';
        }
    }

    if (detailAttachment) {
        if (attachment?.isImage) {
            detailAttachment.innerHTML = `<img src="${escapeHtml(attachment.path)}" alt="${escapeHtml(attachment.originalName)}">`;
            detailAttachment.style.display = 'block';
        } else if (attachment) {
            detailAttachment.innerHTML = `<a class="inbox-detail-file" href="${escapeHtml(attachment.path)}" target="_blank" rel="noopener noreferrer">Abrir anexo: ${escapeHtml(attachment.originalName)}</a>`;
            detailAttachment.style.display = 'block';
        } else {
            detailAttachment.innerHTML = '';
            detailAttachment.style.display = 'none';
        }
    }

    if (detailReplyBox) {
        detailReplyBox.style.display = canReply ? 'block' : 'none';
    }
    if (detailReplyInput) detailReplyInput.value = '';
    if (detailReplyCount) detailReplyCount.textContent = '0/500';

    detailModal.style.display = 'block';
}

function renderInboxNotifications(items = []) {
    const { list, summary, deleteSelectedBtn, selectionActions, selectAllCheckbox } = getInboxModalElements();
    if (!list || !summary) return;

    const unreadCount = items.filter((item) => !item?.isRead).length;
    const selectedCount = inboxSelectedIds.size;
    const allSelected = items.length > 0 && items.every((item) => inboxSelectedIds.has(String(item?.id || '')));
    const isNotificationMode = inboxViewMode === 'notifications';
    
    summary.textContent = unreadCount > 0
        ? `${unreadCount} item(ns) não lido(s) na sua caixa de entrada.`
        : 'Tudo em dia. Nenhum item pendente na sua caixa de entrada.';

    // Esconder controles de seleção/delete no modo notificações
    if (selectionActions) {
        selectionActions.style.display = (isNotificationMode || selectedCount === 0) ? 'none' : 'inline-flex';
    }
    if (deleteSelectedBtn) {
        deleteSelectedBtn.style.display = isNotificationMode ? 'none' : 'inline-block';
        deleteSelectedBtn.disabled = selectedCount === 0;
        deleteSelectedBtn.textContent = selectedCount > 0
            ? `Apagar selecionadas (${selectedCount})`
            : 'Apagar selecionadas';
    }
    if (selectAllCheckbox) {
        selectAllCheckbox.parentElement.style.display = isNotificationMode ? 'none' : 'inline-flex';
        selectAllCheckbox.checked = allSelected;
        selectAllCheckbox.indeterminate = false;
    }

    if (!items.length) {
        inboxSelectedIds = new Set();
        list.innerHTML = '<p class="inbox-empty">Sua caixa de entrada está vazia.</p>';
        return;
    }

    list.innerHTML = items.map((item) => {
        const footer = buildInboxFooter(item);
        const notificationId = String(item.id || '');
        const isSelected = inboxSelectedIds.has(notificationId);
        const typeClass = getInboxTypeClass(item);
        
        // Adicionar classe para notificações de suspensão
        let suspensionClass = '';
        let isSuspensionActive = false;
        if (item?.type === 'ticket' && String(item?.ticketTitle || '').includes('Suspensa')) {
            const status = String(item?.suspensionStatus || 'suspended').trim().toLowerCase();
            if (status === 'resolved') {
                suspensionClass = 'suspension-resolved';
            } else {
                suspensionClass = 'suspension-active';
                isSuspensionActive = true;
            }
        }
        
        // Adicionar classe para notificações de revisão
        const isReview = item?.type === 'ticket' && String(item?.ticketTitle || '').includes('Solicitação de Revisão');
        if (isReview) {
            suspensionClass = 'review-notification';
        }
        
        const reviewStatus = String(item?.suspensionStatus || 'under_review').trim().toLowerCase();
        const isReviewActive = isReview && reviewStatus === 'under_review';
        const canSelect = !isNotificationMode && !isSuspensionActive && !isReviewActive;
        
        return `
            <button type="button" class="inbox-item ${item?.isRead ? '' : 'is-unread'} ${suspensionClass}" data-notification-id="${escapeHtml(String(item.id || ''))}">
                ${canSelect ? `<div class="inbox-select-col">
                    <input type="checkbox" class="inbox-select-checkbox" data-select-notification-id="${escapeHtml(notificationId)}" ${isSelected ? 'checked' : ''}>
                </div>` : `<div class="inbox-select-col" style="visibility: hidden;"></div>`}
                ${buildInboxAvatarHtml(item)}
                <div class="inbox-body">
                    <div class="inbox-meta">
                        <span class="inbox-type ${typeClass}">${escapeHtml(buildInboxTypeLabel(item))}</span>
                        <span class="inbox-time">${escapeHtml(formatInboxDateTime(item?.createdAt))}</span>
                    </div>
                    <h3 class="inbox-title">${escapeHtml(buildInboxTitle(item))}</h3>
                    <p class="inbox-text">${escapeHtml(buildInboxText(item))}</p>
                    ${footer ? `<div class="inbox-footer">${escapeHtml(footer)}</div>` : ''}
                </div>
            </button>
        `;
    }).join('');

    list.querySelectorAll('.inbox-item').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const notificationId = String(btn.getAttribute('data-notification-id') || '').trim();
            if (!notificationId) return;
            
            const item = inboxNotificationsCache.find((entry) => String(entry?.id || '') === notificationId);
            if (!item) return;
            
            await ensureInboxNotificationRead(notificationId);
            openInboxDetailModal(item);
        });
    });

    list.querySelectorAll('.inbox-select-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        checkbox.addEventListener('change', () => {
            const notificationId = String(checkbox.getAttribute('data-select-notification-id') || '').trim();
            if (!notificationId) return;
            if (checkbox.checked) {
                inboxSelectedIds.add(notificationId);
            } else {
                inboxSelectedIds.delete(notificationId);
            }
            renderInboxNotifications(inboxNotificationsCache);
        });
    });
}

async function refreshInboxBadge() {
    const { bell, badge, inboxBtn } = getInboxModalElements();
    if (!currentUser) return;
    if (bell) bell.style.display = 'inline-flex';
    if (inboxBtn) inboxBtn.style.display = 'inline-flex';

    try {
        const result = await AuthAPI.getNotificationCount();
        const unreadCount = Number(result?.unreadCount || 0);
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
                badge.style.display = 'inline-flex';
            } else {
                badge.textContent = '';
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar badge da caixa de entrada:', error);
    }
}

async function loadInboxNotifications() {
    const { list, deleteSelectedBtn, selectionActions, selectAllCheckbox } = getInboxModalElements();
    if (!list || inboxNotificationsLoading) return;

    inboxNotificationsLoading = true;
    if (deleteSelectedBtn) deleteSelectedBtn.disabled = true;
    if (selectionActions) selectionActions.style.display = 'none';
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
    list.innerHTML = '<p class="inbox-empty">Carregando sua caixa de entrada...</p>';

    try {
        const result = await AuthAPI.getAllNotifications(100, 0);
        inboxNotificationsCache = Array.isArray(result?.notifications) ? result.notifications : [];
        inboxSelectedIds = new Set();
        renderInboxNotifications(inboxNotificationsCache);
    } catch (error) {
        console.error('Erro ao carregar caixa de entrada:', error);
        list.innerHTML = '<p class="inbox-empty">Não foi possível carregar sua caixa de entrada agora.</p>';
    } finally {
        inboxNotificationsLoading = false;
    }
}

function openInboxModal(mode = 'inbox') {
    inboxViewMode = mode; // 'notifications' ou 'inbox'
    const { modal } = getInboxModalElements();
    if (!modal) return;
    document.querySelectorAll('.notifications-modal').forEach((panel) => panel.remove());
    
    // Atualizar título do modal e esconder badge de modo
    const modeBadge = document.getElementById('inboxModeBadge');
    if (modeBadge) {
        modeBadge.style.display = 'none';
    }

    const modalTitle = modal.querySelector('h2');
    if (modalTitle) {
        modalTitle.textContent = mode === 'notifications' ? 'Notificações' : 'Caixa de entrada';
    }
    
    modal.style.display = 'block';
    loadInboxNotifications().catch(() => {});
}

function closeInboxModal() {
    const { modal, confirmModal, detailModal } = getInboxModalElements();
    if (!modal) return;
    inboxSelectedIds = new Set();
    modal.style.display = 'none';
    if (confirmModal && confirmModal.style.display !== 'none') {
        closeInboxDeleteConfirm(false);
    }
    if (detailModal && detailModal.style.display !== 'none') {
        closeInboxDetailModal();
    }
}

function initializeInboxControls() {
    const {
        inboxBtn,
        bell,
        modal,
        deleteSelectedBtn,
        selectionActions,
        selectAllCheckbox,
        confirmModal,
        confirmDeleteBtn,
        cancelDeleteBtn,
        detailModal,
        detailReplyInput,
        detailReplyBtn,
        detailReplyCount
    } = getInboxModalElements();
    
    // Rebind o sino (bell) para abrir no modo notificações (resumo)
    if (bell && bell.dataset.boundNotifications !== '1') {
        bell.dataset.boundNotifications = '1';
        bell.onclick = () => openInboxModal('notifications');
    }
    
    if (inboxBtn && inboxBtn.dataset.boundInbox !== '1') {
        inboxBtn.dataset.boundInbox = '1';
        inboxBtn.addEventListener('click', () => openInboxModal('inbox')); // Abre caixa de entrada completa com delete
    }
    if (deleteSelectedBtn && deleteSelectedBtn.dataset.boundInbox !== '1') {
        deleteSelectedBtn.dataset.boundInbox = '1';
        deleteSelectedBtn.addEventListener('click', async () => {
            const selectedIds = Array.from(inboxSelectedIds);
            if (selectedIds.length === 0) {
                showNotification('Selecione pelo menos uma mensagem para excluir.', 'info');
                return;
            }

            // Verificar se há notificações protegidas
            const protectedNotifications = selectedIds.filter(id => {
                const item = inboxNotificationsCache.find(entry => String(entry?.id || '') === String(id || ''));
                // Suspensão ativa ou revisão em andamento
                const isSuspension = item?.type === 'ticket' && String(item?.ticketTitle || '').includes('Suspensa');
                const isReview = item?.type === 'ticket' && String(item?.ticketTitle || '').includes('Solicitação de Revisão');
                
                if (isSuspension && (item?.suspensionStatus === 'suspended' || item?.suspensionStatus === 'under_review')) {
                    return true;
                }
                if (isReview && String(item?.suspensionStatus || 'under_review').trim().toLowerCase() === 'under_review') {
                    return true;
                }
                return false;
            });

            if (protectedNotifications.length > 0) {
                showNotification(
                    `Você não pode excluir notificações de postagens suspensas ou em revisão enquanto estiverem ativas. Resolva ou edite a postagem primeiro.`,
                    'warning'
                );
                return;
            }

            const confirmed = await openInboxDeleteConfirm(selectedIds.length);
            if (!confirmed) return;

            const deletedIds = new Set();
            const failedIds = [];
            for (const notificationId of selectedIds) {
                try {
                    const result = await AuthAPI.deleteNotification(notificationId);
                    if (result?.success && Number(result.deleted) > 0) {
                        deletedIds.add(String(notificationId));
                    } else {
                        failedIds.push(String(notificationId));
                    }
                } catch (error) {
                    console.error('Erro ao excluir notificação:', error);
                    failedIds.push(String(notificationId));
                }
            }

            inboxNotificationsCache = inboxNotificationsCache.filter((item) => !deletedIds.has(String(item?.id || '')));
            inboxSelectedIds = new Set(failedIds);
            renderInboxNotifications(inboxNotificationsCache);
            await refreshInboxBadge();
            if (failedIds.length > 0) {
                showNotification(`${deletedIds.size} mensagem(ns) excluída(s); ${failedIds.length} não puderam ser excluídas.`, 'error');
            } else {
                showNotification(`${deletedIds.size} mensagem(ns) excluída(s).`, 'success');
            }
        });
    }
    if (confirmDeleteBtn && confirmDeleteBtn.dataset.boundInbox !== '1') {
        confirmDeleteBtn.dataset.boundInbox = '1';
        confirmDeleteBtn.addEventListener('click', () => closeInboxDeleteConfirm(true));
    }
    if (cancelDeleteBtn && cancelDeleteBtn.dataset.boundInbox !== '1') {
        cancelDeleteBtn.dataset.boundInbox = '1';
        cancelDeleteBtn.addEventListener('click', () => closeInboxDeleteConfirm(false));
    }
    if (selectAllCheckbox && selectAllCheckbox.dataset.boundInbox !== '1') {
        selectAllCheckbox.dataset.boundInbox = '1';
        selectAllCheckbox.addEventListener('change', () => {
            if (selectAllCheckbox.checked) {
                inboxSelectedIds = new Set(inboxNotificationsCache.map((item) => String(item?.id || '')));
            } else {
                inboxSelectedIds = new Set();
            }
            renderInboxNotifications(inboxNotificationsCache);
        });
    }
    if (modal && modal.dataset.boundInboxOverlay !== '1') {
        modal.dataset.boundInboxOverlay = '1';
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeInboxModal();
            }
        });
    }
    if (confirmModal && confirmModal.dataset.boundInboxOverlay !== '1') {
        confirmModal.dataset.boundInboxOverlay = '1';
        confirmModal.addEventListener('click', (event) => {
            if (event.target === confirmModal || event.target?.matches?.('[data-close-inbox-confirm="1"]')) {
                closeInboxDeleteConfirm(false);
            }
        });
    }
    if (detailReplyInput && detailReplyInput.dataset.boundInbox !== '1') {
        detailReplyInput.dataset.boundInbox = '1';
        detailReplyInput.addEventListener('input', () => {
            if (detailReplyCount) {
                detailReplyCount.textContent = `${detailReplyInput.value.length}/500`;
            }
        });
    }
    if (detailReplyBtn && detailReplyBtn.dataset.boundInbox !== '1') {
        detailReplyBtn.dataset.boundInbox = '1';
        detailReplyBtn.addEventListener('click', async () => {
            const item = activeInboxDetailItem;
            const replyText = String(detailReplyInput?.value || '').trim();
            if (!item || String(item?.type || '').trim().toLowerCase() !== 'comment') return;
            if (!replyText) {
                showNotification('Digite uma resposta antes de enviar.', 'info');
                return;
            }

            const prefix = item?.nickname ? `@${String(item.nickname).trim()} ` : '';
            const result = await AuthAPI.addDownloadComment(item.downloadId, `${prefix}${replyText}`);
            if (!result?.success) {
                showNotification(result?.message || 'Não foi possível responder o comentário.', 'error');
                return;
            }

            if (detailReplyInput) detailReplyInput.value = '';
            if (detailReplyCount) detailReplyCount.textContent = '0/500';
            showNotification('Resposta enviada com sucesso.', 'success');
        });
    }
    if (detailModal && detailModal.dataset.boundInboxOverlay !== '1') {
        detailModal.dataset.boundInboxOverlay = '1';
        detailModal.addEventListener('click', (event) => {
            if (event.target === detailModal || event.target?.matches?.('[data-close-inbox-detail="1"]')) {
                closeInboxDetailModal();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Profile DOMContentLoaded fired');
    console.log('localStorage keys:', Object.keys(localStorage));

    const token = AuthAPI.getToken();
    console.log('Token found:', token ? 'YES (length: ' + token.length + ')' : 'NO');
    
    if (!token) {
        console.log('Redirecionando para login...');
        window.location.href = 'login.html?message=' + encodeURIComponent('Faça login para acessar seu perfil');
        return;
    }

    const profileAnimationLoad = window.ProfileAnimationPreferences.load().catch((error) => {
        console.error('Erro ao carregar preferência de animações do perfil:', error);
        showNotification(error?.message || 'Não foi possível carregar a preferência de animações do perfil.', 'error');
    });

    // ===== INICIALIZAR ELEMENTOS DO DOM =====
    orderBtn = document.getElementById('toggleRankOrderBtn');
    orderHint = document.getElementById('rankOrderHint');
    orderTag = document.getElementById('rankOrderModeTag');
    rankDisplay = document.querySelector('.rank-display');

    console.log('Session ok, loading profile directly...');
    loadProfile();
    await profileAnimationLoad;

    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
            const targetBtn = event.target?.closest('.tab-btn') || btn;
            const tabName = targetBtn?.getAttribute('data-tab');
            if (!tabName) return;

            document.querySelectorAll('.tab-btn').forEach((tabBtn) => tabBtn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach((tabContent) => tabContent.classList.remove('active'));

            targetBtn.classList.add('active');

            const tab = document.getElementById(tabName);
            if (!tab) return;

            tab.classList.add('active');

            if (tabName === 'conquistas-tab') {
                await loadPostageAchievements();
            } else if (tabName === 'postages-tab') {
                await loadMyPostages();
            } else if (tabName === 'password-tab') {
                resetTwoFactorMessages();
                await loadTwoFactorStatus();
            } else if (tabName === 'advanced-tab') {
                initializeProfileAnimationControls();
                initializeNotificationSettingsControls();
                await loadAdultPostsPreference();
            }
        });
    });
});

window.addEventListener('pageshow', (event) => {
    if (!event?.persisted) return;
    refreshProfileAfterReturn().catch((error) => {
        console.warn('Erro ao atualizar perfil após retorno:', error?.message || error);
    });
});

function normalizeAchievementNameKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

// Mapear possíveis chaves/em nomes em inglês para as labels em português
const EN_TO_PT_PROGRESSION = new Map([
    ['adept', 'Membro Adepto'],
    ['alpha', 'Membro Experiente'],
    ['apprentice', 'Membro Aprendiz'],
    ['beta', 'Membro Inicial'],
    ['eternal', 'Membro Eterno'],
    ['expert', 'Membro Especialista'],
    ['master', 'Membro Mestre'],
    ['grand master', 'Grande Mestre'],
    ['grandmaster', 'Grande Mestre'],
    ['legend', 'Membro Lendário'],
    ['legendary', 'Membro Lendário'],
    ['mythic', 'Membro Mítico'],
    ['transcendent', 'Membro Transcendente'],
    ['immortal', 'Membro Imortal'],
    ['novice', 'Membro Novato'],
    ['initiated', 'Membro Iniciado'],
    ['initiate', 'Membro Iniciado']
]);

function localizeRankName(rawName) {
    if (!rawName) return '';
    const key = normalizeAchievementNameKey(rawName);
    // Se já for uma label PT conhecida, retornar como está
    const knownPortuguese = [
        'membro novato','membro iniciado','membro aprendiz','membro experiente','membro adepto',
        'membro especialista','membro mestre','grande mestre','membro lendário','membro mítico',
        'membro transcendente','membro eterno','membro imortal','membro inicial','membro beta','membro ativo'
    ];
    if (knownPortuguese.includes(key)) return String(rawName || '').trim();
    if (EN_TO_PT_PROGRESSION.has(key)) return EN_TO_PT_PROGRESSION.get(key);
    return String(rawName || '').trim();
}

function findAutoProgressionRankByName(rankNameLower) {
    if (!rankNameLower) return null;
    const key = normalizeAchievementNameKey(rankNameLower);
    const ranksSource = typeof ALL_RANKS !== 'undefined' ? ALL_RANKS : [];
    return ranksSource.find(rank => normalizeAchievementNameKey(rank?.name || '') === key) || null;
}

// Toggle to disable progression-type achievements globally (temporary)
const DISABLE_PROGRESSION = false;

function normalizeAchievementBackgroundMap(mapValue) {
    if (!mapValue || typeof mapValue !== 'object') return {};
    const result = {};
    Object.entries(mapValue).forEach(([rawKey, rawValue]) => {
        const key = normalizeAchievementNameKey(rawKey);
        const value = String(rawValue || '').trim();
        if (!key || !value) return;
        result[key] = value;
    });
    return result;
}

function normalizeAchievementCardAnimationMode(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'always' ? 'always' : 'hover';
}

function normalizeAchievementAnimationModeMap(mapValue) {
    if (!mapValue || typeof mapValue !== 'object') return {};
    const result = {};
    Object.entries(mapValue).forEach(([rawKey, rawValue]) => {
        const keyParts = String(rawKey || '').trim().toLowerCase().split(':');
        const groupKey = String(keyParts.shift() || '').trim();
        const rankNameKey = normalizeAchievementNameKey(keyParts.join(':'));
        if (!groupKey || !rankNameKey) return;
        const normalizedMode = normalizeAchievementCardAnimationMode(rawValue);
        if (normalizedMode === 'hover') return;
        result[`${groupKey}:${rankNameKey}`] = normalizedMode;
    });
    return result;
}

function resolveAchievementAnimationGroupKey(rankType) {
    const type = String(rankType || '').trim();
    if (type === 'progression') return 'progression';
    if (type === 'like_achievement') return 'like_achievement';
    if (type === 'post_achievement') return 'post_achievement';
    return 'general';
}

function resolveAchievementCardAnimationMode(rankType, rank = null) {
    const groupKey = resolveAchievementAnimationGroupKey(rankType);
    const rankNameKey = normalizeAchievementNameKey(rank?.name || '');
    if (!groupKey || !rankNameKey) return 'hover';
    const animationKey = `${groupKey}:${rankNameKey}`;
    return normalizeAchievementCardAnimationMode(achievementBackgrounds?.animationModes?.[animationKey] || 'hover');
}

function isGifMediaSource(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (raw.startsWith('blob:')) return false;

    const lowerRaw = raw.toLowerCase();
    if (lowerRaw.startsWith('data:image/gif')) return true;

    try {
        const parsed = new URL(raw, window.location.origin);
        return parsed.pathname.toLowerCase().endsWith('.gif');
    } catch (error) {
        return /\.gif($|[?#])/i.test(raw);
    }
}

function escapeCssUrlValue(value = '') {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}

function escapeHtmlAttributeValue(value = '') {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function extractUrlFromCssUrlValue(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const match = raw.match(/^url\((.*)\)$/i);
    if (!match) return raw;

    let inner = String(match[1] || '').trim();
    if (
        (inner.startsWith('"') && inner.endsWith('"'))
        || (inner.startsWith("'") && inner.endsWith("'"))
    ) {
        inner = inner.slice(1, -1);
    }
    return inner
        .replace(/\\\\/g, '\\')
        .replace(/\\'/g, "'");
}

function getRankHoverGifUrl(card) {
    const fromDataAttr = String(card?.dataset?.rankHoverGifUrl || '').trim();
    if (fromDataAttr) return fromDataAttr;

    const fromCssVar = extractUrlFromCssUrlValue(card?.style?.getPropertyValue('--rank-hover-gif-bg') || '');
    return String(fromCssVar || '').trim();
}

function createStaticImageDataUrlFromSource(sourceUrl = '') {
    return new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.crossOrigin = 'anonymous';

        image.onload = () => {
            try {
                const width = Math.max(1, Number(image.naturalWidth || image.width || 1));
                const height = Math.max(1, Number(image.naturalHeight || image.height || 1));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve('');
                    return;
                }
                ctx.drawImage(image, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png'));
            } catch (error) {
                resolve('');
            }
        };

        image.onerror = () => resolve('');
        image.src = sourceUrl;
    });
}

async function getStaticFrameDataUrlFromGif(gifUrl = '') {
    const raw = String(gifUrl || '').trim();
    if (!raw) return '';

    if (hoverGifStaticPreviewCache.has(raw)) {
        return hoverGifStaticPreviewCache.get(raw);
    }

    const promise = (async () => {
        let objectUrl = '';
        try {
            if (raw.startsWith('data:')) {
                return await createStaticImageDataUrlFromSource(raw);
            }

            const response = await fetch(raw, { cache: 'force-cache' });
            if (!response.ok) return '';

            const blob = await response.blob();
            objectUrl = URL.createObjectURL(blob);
            return await createStaticImageDataUrlFromSource(objectUrl);
        } catch (error) {
            return '';
        } finally {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        }
    })();

    hoverGifStaticPreviewCache.set(raw, promise);
    const result = await promise;
    if (!result) {
        hoverGifStaticPreviewCache.delete(raw);
    }
    return result;
}

async function applyHoverGifStaticPreview(card) {
    if (!card || !(card instanceof HTMLElement)) return;

    const animationMode = normalizeAchievementCardAnimationMode(card.dataset.rankAnimationMode || 'hover');
    if (animationMode !== 'hover') return;
    if (String(card.dataset.rankHoverGif || '') !== '1') return;

    const hoverGifUrl = getRankHoverGifUrl(card);
    if (!hoverGifUrl) return;

    const staticFrameDataUrl = await getStaticFrameDataUrlFromGif(hoverGifUrl);
    if (!staticFrameDataUrl || !card.isConnected) return;

    const latestMode = normalizeAchievementCardAnimationMode(card.dataset.rankAnimationMode || 'hover');
    const latestHoverGifUrl = getRankHoverGifUrl(card);
    if (latestMode !== 'hover' || latestHoverGifUrl !== hoverGifUrl) return;

    card.style.backgroundImage = `url('${escapeCssUrlValue(staticFrameDataUrl)}')`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
    card.style.backgroundRepeat = 'no-repeat';
}

function applyAchievementBackgroundSettings(backgrounds = {}) {
    achievementBackgrounds = {
        progression: String(backgrounds?.progression || '').trim(),
        like_achievement: String(backgrounds?.like_achievement || '').trim(),
        post_achievement: String(backgrounds?.post_achievement || '').trim(),
        progressionCards: normalizeAchievementBackgroundMap(backgrounds?.progressionCards || {}),
        animationModes: normalizeAchievementAnimationModeMap(backgrounds?.animationModes || {}),
        rankCards: {
            like_achievement: normalizeAchievementBackgroundMap(backgrounds?.rankCards?.like_achievement || {}),
            post_achievement: normalizeAchievementBackgroundMap(backgrounds?.rankCards?.post_achievement || {})
        }
    };
}

function resolveAchievementBackgroundByType(rankType) {
    const key = String(rankType || '').trim();
    if (!key) return '';
    const raw = String(achievementBackgrounds[key] || '').trim();
    if (!raw) return '';
    return resolveMediaUrl(raw, '');
}

function resolveAchievementBackgroundForRank(rankType, rank = null) {
    const typeKey = String(rankType || '').trim();
    if (!typeKey || !rank) return '';

    const rankNameKey = normalizeAchievementNameKey(rank?.name || '');
    if (!rankNameKey) return '';

    if (typeKey === 'progression') {
        const direct = String(achievementBackgrounds?.progressionCards?.[rankNameKey] || '').trim();
        return direct ? resolveMediaUrl(direct, '') : '';
    }

    if (typeKey === 'like_achievement' || typeKey === 'post_achievement') {
        const groupMap = achievementBackgrounds?.rankCards?.[typeKey] || {};
        const direct = String(groupMap?.[rankNameKey] || '').trim();
        return direct ? resolveMediaUrl(direct, '') : '';
    }

    const rankId = Number(rank?.id);
    const hasPersistentCustomRankId = Number.isInteger(rankId) && rankId > 0;
    if (!hasPersistentCustomRankId) {
        const manualOrFixedBackground = String(achievementBackgrounds?.progressionCards?.[rankNameKey] || '').trim();
        return manualOrFixedBackground ? resolveMediaUrl(manualOrFixedBackground, '') : '';
    }

    return '';
}

// Carregar perfil
async function loadProfile() {
    console.log('[PROFILE] Starting loadProfile...');
    
    try {
        console.log('[PROFILE] Calling AuthAPI.getProfile()...');
        const [result, achievementBackgroundResult] = await Promise.all([
            AuthAPI.getProfile(),
            AuthAPI.getAchievementBackgrounds()
        ]);
        console.log('[PROFILE] Profile response received:', result);

        if (!result.success || !result.user) {
            const shouldForceLogin = result?.banned || /token|autorizado|autenticado|login|sess[ae]o/i.test(String(result?.message || ''));
            if (shouldForceLogin) {
                AuthAPI.removeToken();
                window.location.href = 'login.html?message=' + encodeURIComponent(result?.message || 'Sessão inválida. Faça login novamente.');
                return;
            }
            throw new Error(result.message || 'Failed to load profile');
        }

        currentUser = result.user;
        currentUser.pendingEmailChangeRequest = Boolean(result.user?.pendingEmailChangeRequest);
        currentRank = result.rank;
        canOrderFixedRanks = Boolean(result?.user?.canOrderFixedRanks);
        syncProfileMissionRewardsUi();
        if (achievementBackgroundResult?.success && achievementBackgroundResult?.backgrounds) {
            applyAchievementBackgroundSettings(achievementBackgroundResult.backgrounds);
        } else {
            applyAchievementBackgroundSettings({});
        }
        console.log('[PROFILE] User loaded:', currentUser.firstName, currentUser.lastName);

        // Renderizar dados do usuário
        console.log('[PROFILE] Calling renderProfileData...');
        await renderProfileData(result);
        
        console.log('[PROFILE] About to show profileContent...');
        // Mostrar conteedo IMEDIATAMENTE
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('profileContent').style.display = 'block';
        
        console.log('[PROFILE] profileContent is now visible');
        
        // Anexar event listeners DEPOIS que os dados são renderizados
        console.log('[PROFILE] Attaching event listeners...');
        attachEventListeners();

        const shouldOpenAccountSettings = localStorage.getItem('openProfileAccountSettings') === '1';
        if (shouldOpenAccountSettings) {
            localStorage.removeItem('openProfileAccountSettings');
            const editBtn = document.getElementById('editBtn');
            const editModal = document.getElementById('editModal');
            if (editBtn) {
                editBtn.click();
            } else if (editModal) {
                editModal.style.display = 'block';
            }
            setTimeout(() => {
                const emailField = document.getElementById('editEmail');
                if (emailField) {
                    emailField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    emailField.focus({ preventScroll: true });
                }
            }, 150);
        }
        
        // Sincronizar status de cores do e-mail (verde/vermelho)
        syncProfileEmailStatusVisual();
        
        // Carregar conquistas customizados SEM BLOQUEAR (fire and forget)
        // Isso permite que o perfil carregue rápido, depois os conquistas customizáveis carregam em background
        console.log('[PROFILE] Loading custom ranks (non-blocking)...');
        loadCustomRanks(currentUser.id).catch(err => {
            console.warn('[PROFILE] Custom ranks loading error (non-critical, ignored):', err.message);
        });

        // Verificar acesso a painel admin
        console.log('[PROFILE] Checking admin panel access...');
        checkAdminPanelAccess();

        loadUserMissions().catch((error) => {
            console.error('[PROFILE] Erro ao carregar missões:', error);
        });

        await handleAdultPostsDeepLink();
        
        console.log('[PROFILE] PROFILE LOADED SUCCESSFULLY!');
        
    } catch (error) {
        console.error('[PROFILE] Error loading profile:', error);
        showError('Error loading profile: ' + error.message);
    }
}

async function renderProfileData(result) {
    console.log('Rendering profile data...');
    
    try {
        currentRankComplete = result.rankComplete || null;

        // Dados besicos
        document.getElementById('profileUsername').textContent = currentUser.nickname || (currentUser.firstName + ' ' + currentUser.lastName);
        
        // Email
        const emailDisplay = document.getElementById('profileEmail');
        const normalizedEmail = String(currentUser?.email || '').trim();
        if (emailDisplay) {
            if (normalizedEmail) {
                emailDisplay.textContent = '*'.repeat(normalizedEmail.length);
                emailDisplay.setAttribute('data-hidden', 'true');
            } else {
                emailDisplay.textContent = 'E-mail não informado';
                emailDisplay.setAttribute('data-hidden', 'false');
            }
            syncEmailToggleButton();
            syncProfileEmailStatusVisual();
        }
        
        // Bio (seção opcional)
        const profileBio = document.getElementById('profileBio');
        if (profileBio) {
            profileBio.textContent = currentUser.bio || 'Nenhuma bio configurada.';
        }
        document.getElementById('profileJoined').textContent = 'Membro desde: ' + formatDate(currentUser.createdAt);
        refreshInboxBadge().catch(() => {});

        // Avatar
        applyCurrentUserAvatarVisual();

        // Banner
        applyCurrentUserBannerVisual();

        // Rank
        window.currentProfileRenderResult = result;
        refreshPrimaryRankBadge();
        renderProfileTagline();

        // Renderizar conquistas automáticos (se existirem e forem diferentes do conquista principal)
        if (result.rankComplete && result.rankComplete.automatic) {
            const autoRank = result.rankComplete.automatic;
            const selectedRankIds = new Set(
                (Array.isArray(result.selectedRanks) ? result.selectedRanks : [])
                    .map((rank) => normalizeRankOrderKey(rank?.id))
                    .filter(Boolean)
            );
            const betaRank = (Array.isArray(result.rankHistory) ? result.rankHistory : [])
                .find((rank) => String(rank?.name || '').trim().toLowerCase() === 'membro beta');
            const betaIsSelected = Boolean(betaRank)
                && selectedRankIds.has(normalizeRankOrderKey(betaRank.id));
            const currentRank = betaIsSelected
                ? betaRank
                : result.rankComplete.automatic || result.rankComplete.automaticCompleted;
            
            // Se houver um rank customizado com o mesmo nome, usar suas cores/metadata para o badge automático.
            const autoRankName = String(autoRank?.name || '').trim().toLowerCase();
            let effectiveAutoRank = autoRank;
            let customAutoMatch = null;
            if (autoRankName && Array.isArray(result.rankHistory)) {
                customAutoMatch = result.rankHistory.find((rank) => String(rank?.name || '').trim().toLowerCase() === autoRankName);
                if (customAutoMatch) {
                    effectiveAutoRank = { ...autoRank, ...customAutoMatch };
                }
            }

            // Renderizar conquista automática se ela for diferente do conquista principal.
            // Para ranks de progressão, renderizar apenas quando houver rank customizado/admin correspondente.
            const AUTO_PROGRESSION_NAMES = new Set([
                'membro beta', 'membro inicial', 'membro novato', 'membro iniciado',
                'membro aprendiz', 'membro experiente', 'membro adepto', 'membro especialista',
                'membro mestre', 'grande mestre', 'membro lendário', 'membro mítico',
                'membro transcendente', 'membro eterno', 'membro imortal'
            ]);
            const isAutoProgression = AUTO_PROGRESSION_NAMES.has(autoRankName);
            const shouldShowAutoRank = !betaIsSelected
                && effectiveAutoRank
                && autoRankName
                && effectiveAutoRank.name !== currentRank?.name
                && (!isAutoProgression || Boolean(customAutoMatch));

            if (shouldShowAutoRank) {
                const autoRanksContainer = document.getElementById('automaticRanksInline');
                if (autoRanksContainer) {
                    const rankBadge = document.createElement('div');
                    rankBadge.className = 'automatic-rank-badge';
                    rankBadge.style.color = effectiveAutoRank.color;
                    rankBadge.style.borderColor = effectiveAutoRank.color;
                    rankBadge.style.backgroundColor = `${effectiveAutoRank.color}33`; // 20% opacity
                    rankBadge.textContent = effectiveAutoRank.name;
                    autoRanksContainer.appendChild(rankBadge);
                    console.log('conquista automatico renderizado:', effectiveAutoRank.name);
                }
            }
        }

        // Usar a progressão automática atual; automaticCompleted representa o elo anterior.
        if (result.rankComplete?.automatic?.name) {
            window.currentUserEloName = String(result.rankComplete.automatic.name || '').trim().toLowerCase();
        } else if (result.rankComplete?.automaticCompleted?.name) {
            window.currentUserEloName = String(result.rankComplete.automaticCompleted.name || '').trim().toLowerCase();
        }

        // Admin button
        if (currentUser.id === 1) {
            const adminBtn = document.getElementById('adminBtn');
            if (adminBtn) {
                adminBtn.style.display = 'block';
                adminBtn.addEventListener('click', () => {
                    window.location.href = 'admin.html';
                });
            }
        }

        syncAnimatedProfileButton();

        // Filtrar ranks automáticos que NÃO devem estar em currentCustomRanks
        // Nota: "membro inicial" e "membro novato" são conquistas que podem aparecer.
        // "Membro Beta" NÃO é removido aqui; ele deve poder aparecer como conquista personalizada se presente.
        const rawCustomRanks = Array.isArray(result?.rankHistory) && result.rankHistory.length > 0
            ? result.rankHistory
            : Array.isArray(currentCustomRanks) && currentCustomRanks.length > 0
                ? currentCustomRanks
                : [];
        const ALLOWED_AUTO_PROGRESSIONS_FOR_DISPLAY = new Set([
            'membro beta',
            'membro inicial',
            'membro ativo',
            'membro iniciado',
            'membro novato'
        ]);
        const filteredCustomRanks = rawCustomRanks.filter((rank) => {
            if (isHiddenProfileRank(rank)) return false;
            const rankNameLower = String(rank?.name || '').trim().toLowerCase();
            if (isAutomaticProgressionRankName(rankNameLower) && !ALLOWED_AUTO_PROGRESSIONS_FOR_DISPLAY.has(rankNameLower)) {
                return false;
            }
            return true;
        });
        
        // Usar os dados que vieram da API
        currentCustomRanks = filteredCustomRanks;
        
        const AUTO_PROGRESSION_RANK_FILTER = new Set([
            'membro iniciado', 'membro aprendiz',
            'membro experiente', 'membro adepto', 'membro especialista', 'membro mestre', 'grande mestre',
            'membro lendário', 'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal'
        ]);

        // Também filtrar selectedProfileRankIds para remover qualquer rank automático que possa ter sido adicionado
        // "Membro Beta" não é removido aqui e pode ser exibido se estiver selecionado.
        const selectedRankObjects = Array.isArray(result.selectedRanks) ? result.selectedRanks : [];
        const filteredSelectedRankIds = selectedRankObjects.filter((rank) => {
            const rankId = rank?.id;
            const rankName = String(rank?.name || '').trim().toLowerCase();
            if (rankId === FIXED_MANUAL_RANK_KEY) {
                return isOwnerAccount() && isFounderAchievementRank(rank);
            }
            if (rankId === FIXED_AUTO_RANK_KEY) return true;
            if (!Number.isInteger(Number(rankId)) || Number(rankId) <= 0) return false;
            const rankMeta = { id: Number(rankId), name: rankName };

            if (isHiddenProfileRank(rankMeta)) {
                console.log('[FILTER-API] Removendo rank oculto de selectedProfileRankIds:', rankName, 'ID:', rankId);
                return false;
            }
            if (rankName === 'membro inicial') {
                return true;
            }
            const isAutoProgression = AUTO_PROGRESSION_RANK_FILTER.has(rankName);
            if (isAutoProgression) {
                console.log('[FILTER-API] Removendo rank automático de selectedProfileRankIds:', rankName, 'ID:', rankId);
            }
            return !isAutoProgression;
        }).map((rank) => typeof rank.id === 'number' || /^\d+$/.test(String(rank.id || ''))
            ? Number(rank.id)
            : rank.id);
        setSelectedProfileRankOrder(filteredSelectedRankIds);
        
        console.log('[renderProfileData] currentCustomRanks (after filter):', currentCustomRanks.length, 'items:', currentCustomRanks.map(r => r.name));
        console.log('[renderProfileData] selectedProfileRankIds (after filter):', selectedProfileRankIds);
        
        // DEBUG ESPECÍFICO: Procurar por "Membro Novato" em currentCustomRanks
        const membroNovatoCheck = currentCustomRanks.filter(r => String(r?.name || '').trim().toLowerCase() === 'membro novato');
        if (membroNovatoCheck.length > 0) {
            console.error('❌ ERRO: "Membro Novato" AINDA está em currentCustomRanks após filtro!', membroNovatoCheck);
        } else {
            console.log('✅ OK: "Membro Novato" NÃO está em currentCustomRanks');
        }

        // NÃO renderizar histórico aqui - deixar para loadCustomRanks() fazer isso
        // quando os dados estiverem prontos
        console.log('[renderProfileData] Deferring rank history rendering to loadCustomRanks()...');
        
        // Form data
        const editProfileTagline = document.getElementById('editProfileTagline');
        if (editProfileTagline) {
            renderTaglineEditorFromRaw(currentUser.profileTagline || '');
            updateTaglineCount();
        }
        
        console.log('Profile data rendered');
        
    } catch (err) {
        console.warn('Error rendering profile data (non-critical):', err.message);
    }
}

function refreshPrimaryRankBadge() {
    const result = window.currentProfileRenderResult || {};
    const rawCustomRanks = Array.isArray(result?.rankHistory) && result.rankHistory.length > 0
        ? result.rankHistory
        : Array.isArray(currentCustomRanks) && currentCustomRanks.length > 0
            ? currentCustomRanks
            : [];
    const selectedRankKeys = new Set([
        ...(Array.isArray(result?.selectedRanks) ? result.selectedRanks.map((rank) => normalizeRankOrderKey(rank?.id)).filter(Boolean) : []),
        ...(Array.isArray(selectedProfileRankOrder) ? selectedProfileRankOrder.map(normalizeRankOrderKey).filter(Boolean) : [])
    ]);

    let rankParaExibir = null;
    let rankCor = '#8B5CF6';
    const membroBetaSelecionado = rawCustomRanks.some((rank) => {
        const rankNameLower = String(rank?.name || '').trim().toLowerCase();
        return rankNameLower === 'membro beta'
            && selectedRankKeys.has(normalizeRankOrderKey(rank?.id));
    });

    if (membroBetaSelecionado) {
        rankParaExibir = rawCustomRanks.find((rank) => String(rank?.name || '').trim().toLowerCase() === 'membro beta') || null;
        rankCor = rankParaExibir?.color || '#8B5CF6';
    }

    if (!rankParaExibir || !rankParaExibir.name) {
        const autoRank = result.rankComplete?.automatic
            || result.rankComplete?.automaticCompleted
            || (result.rank?.isCustom !== true && !isFounderAchievementRank(result.rank) ? result.rank : null);
        if (autoRank && autoRank.name) {
            rankParaExibir = autoRank;
            rankCor = autoRank?.color || '#8B5CF6';
        }
    }

    if (!rankParaExibir || !rankParaExibir.name) {
        rankParaExibir = { name: 'Sem conquista', color: '#8B5CF6' };
        rankCor = '#8B5CF6';
    }

    const rankNameEl = document.getElementById('rankName');
    if (rankNameEl) rankNameEl.textContent = rankParaExibir.name;

    const rankBadgeEl = document.querySelector('.rank-badge');
    if (rankBadgeEl) {
        const tooltipText = resolveRankBadgeTooltip(rankParaExibir);
        rankBadgeEl.style.borderColor = rankCor;
        rankBadgeEl.style.color = rankCor;
        rankBadgeEl.classList.toggle('tooltip-theme', Boolean(tooltipText));
        if (tooltipText) {
            rankBadgeEl.setAttribute('data-tooltip', tooltipText);
        } else {
            rankBadgeEl.removeAttribute('data-tooltip');
            rankBadgeEl.classList.remove('tooltip-theme');
        }
        const spanEl = rankBadgeEl.querySelector('span');
        if (spanEl) spanEl.style.color = rankCor;
    }

    const mainBadge = document.getElementById('rankBadge');
    if (mainBadge) mainBadge.style.display = '';
}

function renderRankHistory(history, rankProgress = {}) {
    console.log('[renderRankHistory] CALLED! currentCustomRanks count:', currentCustomRanks?.length || 0);
    console.log('[renderRankHistory] currentCustomRanks:', currentCustomRanks?.map(r => r.name) || []);
    console.log('[renderRankHistory] selectedProfileRankIds:', selectedProfileRankIds);
    
    // Verificar se currentUser está disponível
    if (!currentUser || !currentUser.createdAt) {
        console.error('[renderRankHistory] ERROR: currentUser not available or missing createdAt');
        const historyContainer = document.getElementById('ranksHistory');
        if (historyContainer) {
            historyContainer.innerHTML = '<p class="ranks-error-message">Erro ao carregar histórico de conquistas.</p>';
        }
        return;
    }
    
    console.log('[renderRankHistory] ✓ currentUser OK');
    
    // BLOQUEIO FINAL: Remover QUALQUER progressão automática de currentCustomRanks antes de renderizar.
    // Isso evita que a conquista atual de progressão (ex.: Membro Novato) apareça fora da área selecionada.
    const currentCustomRanksForRender = (currentCustomRanks || []).filter((rank) => {
        const rankNameLower = String(rank?.name || '').trim().toLowerCase();
        const isAutomaticProgression = isAutomaticProgressionRankName(rankNameLower);

        if (!isAutomaticProgression) return true;

        // Mantém apenas as progressões especiais que podem ser exibidas explicitamente.
        return ['membro beta', 'membro inicial', 'membro ativo', 'membro iniciado', 'membro novato'].includes(rankNameLower)
            || rank?.isCustom === true
            || Boolean(rank?.customText || rank?.backgroundImage || rank?.icon || rank?.createdBy);
    });
    
    console.log('[renderRankHistory] ✓ currentCustomRanksForRender created');
    
    const historyContainer = document.getElementById('ranksHistory');
    
    if (!historyContainer) {
        console.warn('ranksHistory container not found');
        return;
    }

    console.log('[renderRankHistory] ✓ historyContainer found');

    const ALL_RANKS = [
        { level: 0, name: 'Membro Inicial', minDays: 0, maxDays: 1, color: '#8B5CF6', description: 'Bem-vindo à Guild Holiday' },
        { level: 1, name: 'Membro Novato', minDays: 1, maxDays: 7, color: '#3B82F6', description: 'Você está se adaptando à comunidade.' },
        { level: 2, name: 'Membro Iniciado', minDays: 7, maxDays: 21, color: '#06B6D4', description: 'Iniciado nos mistérios da guild' },
        { level: 3, name: 'Membro Aprendiz', minDays: 21, maxDays: 45, color: '#14B8A6', description: 'Aprendiz dedicado' },
        { level: 4, name: 'Membro Experiente', minDays: 45, maxDays: 75, color: '#22C55E', description: 'Novato em ascensão' },
        { level: 5, name: 'Membro Adepto', minDays: 75, maxDays: 120, color: '#84CC16', description: 'Mestre em aprendizado' },
        { level: 6, name: 'Membro Especialista', minDays: 120, maxDays: 180, color: '#FACC15', description: 'Especialista da guild' },
        { level: 7, name: 'Membro Mestre', minDays: 180, maxDays: 250, color: '#F59E0B', description: 'Mestre guerreiro' },
        { level: 8, name: 'Grande Mestre', minDays: 250, maxDays: 335, color: '#F97316', description: 'Grande Mestre' },
        { level: 9, name: 'Membro Lendário', minDays: 335, maxDays: 430, color: '#EF4444', description: 'Lendário' },
        { level: 10, name: 'Membro Mítico', minDays: 430, maxDays: 540, color: '#E11D48', description: 'Ser mítico' },
        { level: 11, name: 'Membro Transcendente', minDays: 540, maxDays: 665, color: '#C026D3', description: 'Transcendente' },
        { level: 12, name: 'Membro Eterno', minDays: 665, maxDays: 805, color: '#D946EF', description: 'Membro eterno' },
        { level: 13, name: 'Membro Imortal', minDays: 805, maxDays: 950, color: '#FF2D95', description: 'Imortal da guild' }
    ];

    console.log('[renderRankHistory] ✓ ALL_RANKS created');

    try {
        const userCreatedDate = new Date(currentUser.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - userCreatedDate);
        // Usar dias completos para manter igual ao backend e evitar rank adiantado.
        const userDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        console.log('[renderRankHistory] ✓ userDays calculated:', userDays);

        const conquistasAutomaticas = ALL_RANKS.filter(rank => 
            userDays >= rank.minDays && 
            userDays < rank.maxDays
        );
        const conquistasPassadas = ALL_RANKS.filter(rank => 
            userDays >= rank.maxDays
        );
        const disponiveis = ALL_RANKS.filter(rank => 
            userDays < rank.minDays
        );
        
        console.log('[renderRankHistory] ✓ conquistasAutomaticas:', conquistasAutomaticas.map(r => r.name));
        console.log('[renderRankHistory] ✓ disponiveis:', disponiveis.map(r => r.name));
    
    function isAutoProgressionAssignedByAdmin(rankName) {
        if (!rankName) return false;
        const normalized = String(rankName).trim().toLowerCase();
        return (currentCustomRanksForRender || []).some(rank => {
            const rankNameLower = String(rank?.name || '').trim().toLowerCase();
            const rankIdNumber = Number(rank?.id);
            return rankNameLower === normalized && selectedProfileRankIds.includes(rankIdNumber);
        });
    }

    const isSpecialCustomRank = (rank) => Number(rank?.isSpecial) === 1 || rank?.isSpecial === true;
    const normalizeSpecialEventName = (name) => String(name || '').replace(/\s*\(Especial\)\s*$/i, '').trim();
    const normalizeSpecialEventDescription = (description, eventName = '') => {
        let text = String(description || '').trim();
        const normalizedEventName = String(eventName || '').replace(/\s*\(Especial\)\s*$/i, '').trim();
        const yearMatch = normalizedEventName.match(/(\d{4})$/);
        const baseEventName = yearMatch ? normalizedEventName.slice(0, yearMatch.index).trim() : normalizedEventName;
        const yearText = yearMatch ? yearMatch[1] : '';

        if (!text) {
            return yearText && baseEventName ? `Especial de ${baseEventName} ${yearText}` : text;
        }

        if (yearText && !/\b\d{4}\b/.test(text) && /especial|conquista/i.test(text)) {
            return `Especial de ${baseEventName} ${yearText}`;
        }

        return text;
    };

    // Funeeo auxiliar para gerar URL da imagem
    function getImageUrl(rankName) {
        const explicitPath = String(rankName || '').trim();
        if (!explicitPath) return '';

        // As imagens de conquista vêm do backgroundImage salvo no banco;
        // não devemos adivinhar caminhos por nome da conquista, porque isso
        // gera URLs quebradas como "Membro BETA.png".
        return '';
    }

    // Funeeo auxiliar para renderizar card com imagem de fundo
    function renderCard(rank, isCustom = false, status = 'available', userDays = 0, isVisible = true, cardRankType = '') {
        // status: 'available' = não conquistado, 'current' = conquista atual, 'created' = conta criada (Beta)
        let imageStyle = '';
        const originalRankName = normalizeBrokenUtf8Text(rank?.name || '');
        const rawRankDescription = normalizeBrokenUtf8Text(rank?.description || rank?.customText || '');
        const rankDescription = isSpecialCustomRank(rank)
            ? normalizeSpecialEventDescription(rawRankDescription, originalRankName)
            : rawRankDescription;
        const rankCustomText = normalizeBrokenUtf8Text(rank?.customText || '').trim();
        const customBadgeText = rankCustomText || 'Conquistado';
        const rankName = isSpecialCustomRank(rank)
            ? normalizeSpecialEventName(localizeRankName(originalRankName) || originalRankName)
            : localizeRankName(originalRankName) || originalRankName;
        const imageUrl = getImageUrl(originalRankName || rank.name);
        const customBackgroundUrl = resolveMediaUrl(rank?.backgroundImage || '', '');
        const inferredRankType = String(cardRankType || '').trim() || (isCustom ? detectRankGroup(rank) : 'progression');
        const normalizedRankType = inferredRankType && inferredRankType !== 'general'
            ? inferredRankType
            : (isCustom ? 'custom' : 'progression');
        const cardAnimationMode = resolveAchievementCardAnimationMode(normalizedRankType, rank);
        const specificBackgroundUrl = resolveAchievementBackgroundForRank(normalizedRankType, rank);
        const groupBackgroundUrl = resolveAchievementBackgroundByType(normalizedRankType);
        const resolvedCardBackground = customBackgroundUrl || specificBackgroundUrl || groupBackgroundUrl;
        const hasCustomBackground = Boolean(resolvedCardBackground);
        const rankIdNumber = Number(rank?.id);
        const isSelectedForDisplay = isRankSelectedForDisplay(rank);
        const safeRankColor = normalizeHexColorForUi(rank?.color, '#EC4899');
        const escapedResolvedBackground = escapeCssUrlValue(resolvedCardBackground);
        const escapedImageUrl = escapeCssUrlValue(imageUrl);
        const fallbackImageLayer = imageUrl ? `, url('${escapedImageUrl}')` : '';
        const tintedFallbackStyle = `
            background-image:
                radial-gradient(120% 90% at 14% 12%, ${safeRankColor}2b, transparent 50%),
                radial-gradient(120% 90% at 82% 88%, ${safeRankColor}1f, transparent 56%),
                linear-gradient(160deg, rgba(10, 14, 34, 0.92), rgba(8, 12, 28, 0.9))${fallbackImageLayer};
            background-size: 100% 100%, 100% 100%, 100% 100%${imageUrl ? ', contain' : ''};
            background-position: center, center, center, center;
            background-repeat: no-repeat, no-repeat, no-repeat, no-repeat;
            background-color: rgba(8, 12, 28, 0.9);
        `;
        let hasHoverGifBackground = false;
        
        if (!isCustom) {
            if (resolvedCardBackground) {
                if (cardAnimationMode === 'hover' && isGifMediaSource(resolvedCardBackground)) {
                    hasHoverGifBackground = true;
                    imageStyle = `--rank-hover-gif-bg: url('${escapedResolvedBackground}'); background-image: url('${escapedImageUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat; background-color: rgba(8, 12, 28, 0.9);`;
                } else {
                    imageStyle = `background-image: url('${escapedResolvedBackground}'); background-size: cover; background-position: center; background-repeat: no-repeat; background-color: rgba(8, 12, 28, 0.9);`;
                }
            } else {
                imageStyle = tintedFallbackStyle;
            }
        } else {
            const customOrFallback = resolvedCardBackground || imageUrl;
            const escapedCustomOrFallback = escapeCssUrlValue(customOrFallback);
            if (cardAnimationMode === 'hover' && isGifMediaSource(customOrFallback)) {
                hasHoverGifBackground = true;
                imageStyle = `--rank-hover-gif-bg: url('${escapedCustomOrFallback}'); ${tintedFallbackStyle}`;
            } else if (!resolvedCardBackground) {
                imageStyle = tintedFallbackStyle;
            } else {
                imageStyle = `background-image: url('${escapedCustomOrFallback}'); background-size: cover; background-position: center; background-repeat: no-repeat; background-color: rgba(8, 12, 28, 0.9);`;
            }
        }

        const cardStyle = `--rank-color: ${safeRankColor}; border-color: ${safeRankColor}; ${imageStyle} position: relative;`;
        const hoverGifUrlAttr = hasHoverGifBackground
            ? ` data-rank-hover-gif-url="${escapeHtmlAttributeValue(resolvedCardBackground)}"`
            : '';
        const cardMetaAttrs = `data-rank-status="${status}" data-rank-type="${normalizedRankType}" data-has-custom-bg="${hasCustomBackground ? '1' : '0'}" data-rank-animation-mode="${cardAnimationMode}" data-rank-hover-gif="${hasHoverGifBackground ? '1' : '0'}"${hoverGifUrlAttr}`;
        const checkboxColor = safeRankColor;
        
        // Checkbox para conquistas customizadas e para a seleção especial do Membro Beta.
        let checkbox = '';
        const rankNameLower = normalizeAchievementNameKey(rankName || rank?.name || '');
        const SELECTABLE_PROGRESSIONS = ['membro beta'];
        const isSelectableProgression = SELECTABLE_PROGRESSIONS.includes(rankNameLower);
        const isProgressionCustomRank = isCustom && (
            normalizedRankType === 'progression'
            || String(rank?.rankGroup || '').trim().toLowerCase() === 'progression'
            || ALL_RANKS.some((progressionRank) =>
                normalizeAchievementNameKey(progressionRank?.name || '') === rankNameLower
            )
        );
        const isSpecialProgressionSelector = isSelectableProgression;
        const canSelectManualFounder = String(rank?.id || '').trim() === FIXED_MANUAL_RANK_KEY
            && isOwnerAccount()
            && isFounderAchievementRank(rank);
        const shouldShowCheckbox = (isVisible || canSelectManualFounder) && (
            (!isProgressionCustomRank && isCustom) ||
            isSpecialProgressionSelector
        );
        
        if (shouldShowCheckbox) {
            // Apenas ranks especiais de progressão usam a exclusão mútua.
            const rankGroupValue = isSpecialProgressionSelector ? 'progression-selector' : (rank.rankGroup || '');
            // Para conquistas personalizadas, checked se estiver selecionada
            const shouldAutoCheck = isSelectedForDisplay;
            checkbox = `<input type="checkbox" class="rank-checkbox" data-rank-id="${rank.id}" data-rank-name="${String(rank?.name || '').trim()}" data-rank-group="${rankGroupValue}" data-rank-color="${checkboxColor}" ${shouldAutoCheck ? 'checked' : ''} style="--rank-checkbox-color: ${checkboxColor}; position: absolute; top: 8px; right: 8px; z-index: 3; width: 20px; height: 20px; cursor: pointer; background: rgba(3,7,18,0.92); border: 1px solid ${checkboxColor}; border-radius: 4px; box-shadow: 0 0 0 1px ${checkboxColor}66, 0 0 8px ${checkboxColor}55;">`;
        }
        if (status === 'available') {
            // Se for Membro Inicial, mostrar como conquista especial de conta criada/verificada
            if (rankName.toLowerCase() === 'membro inicial') {
                return `
                    <div class="rank-card achievement-card-fx" style="${cardStyle}" data-rank-id="${rank.id || ''}" data-rank-name="${rankName || rank.name}" ${cardMetaAttrs}>
                        <span class="rank-up-arrows" aria-hidden="true"></span>
                        <div class="rank-card-name" style="color: ${safeRankColor}; font-weight: 700; text-shadow: 0 0 10px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.8); background: rgba(0,0,0,0.4); padding: 4px 8px; border-radius: 4px; display: inline-block;">${rankName || rank.name}</div>
                        <div class="rank-card-description" style="color: rgba(255,255,255,0.95); text-shadow: 0 0 8px rgba(0,0,0,0.8); background: rgba(0,0,0,0.4); padding: 4px 8px; border-radius: 4px; display: inline-block; font-size: 13px; margin-top: 8px;">${rankDescription || 'Conta criada e verificada'}</div>
                        <div class="rank-card-badge" style="background-color: #6B46C166; color: white; font-weight: 600; text-shadow: 0 0 8px rgba(0,0,0,0.8); padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 12px; margin-top: 8px;">Conta Criada</div>
                    </div>
                `;
            }
            // Para demais, mostrar apenas nome e descrição
            return `
                <div class="rank-card achievement-card-fx" style="${cardStyle}" data-rank-id="${rank.id || ''}" data-rank-name="${rankName || rank.name}" ${cardMetaAttrs}>
                    <span class="rank-up-arrows" aria-hidden="true"></span>
                    <div class="rank-card-name" style="color: ${safeRankColor}; font-weight: 700; text-shadow: 0 0 10px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.8); background: rgba(0,0,0,0.4); padding: 4px 8px; border-radius: 4px; display: inline-block;">${rankName || rank.name}</div>
                    <div class="rank-card-description" style="color: rgba(255,255,255,0.95); text-shadow: 0 0 8px rgba(0,0,0,0.8); background: rgba(0,0,0,0.4); padding: 4px 8px; border-radius: 4px; display: inline-block; font-size: 13px; margin-top: 8px;">${rankDescription || 'conquista especial'}</div>
                </div>
            `;
        } else if (status === 'created') {
            // Beta - Conta criada
            return `
                <div class="rank-card achievement-card-fx" style="${cardStyle}" data-rank-id="${rank.id || ''}" data-rank-name="${rankName || rank.name}" ${cardMetaAttrs}>
                    <span class="rank-up-arrows" aria-hidden="true"></span>
                    ${checkbox}
                    <div class="rank-card-name" style="color: white; font-weight: 700; text-shadow: 0 0 10px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.9); background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 4px; display: inline-block; position: relative; z-index: 2;">${rankName || rank.name}</div>
                    <div class="rank-card-description" style="color: white; text-shadow: 0 0 8px rgba(0,0,0,0.9); background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 13px; margin-top: 8px; position: relative; z-index: 2;">${rankDescription || 'conquista especial'}</div>
                    <div class="rank-card-badge" style="background-color: #6B46C166; color: white; font-weight: 600; text-shadow: 0 0 8px rgba(0,0,0,0.8); padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 12px; margin-top: 8px; position: relative; z-index: 2;">Conta Criada</div>
                </div>
            `;
        } else if (status === 'completed') {
            // conquista já conquistada: mostrar apenas "Conquistada"
            return `
                <div class="rank-card achievement-card-fx" style="${cardStyle}" data-rank-id="${rank.id || ''}" data-rank-name="${rankName || rank.name}" ${cardMetaAttrs}>
                    <span class="rank-up-arrows" aria-hidden="true"></span>
                    <div class="rank-card-name" style="color: white; font-weight: 700; text-shadow: 0 0 10px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.9); background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 4px; display: inline-block; position: relative; z-index: 2;">${rankName || rank.name}</div>
                    <div class="rank-card-description" style="color: white; text-shadow: 0 0 8px rgba(0,0,0,0.9); background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 13px; margin-top: 8px; position: relative; z-index: 2;">${rankDescription || 'conquista especial'}</div>
                    <div class="rank-card-badge" style="background-color: ${safeRankColor}66; color: white; font-weight: 600; text-shadow: 0 0 8px rgba(0,0,0,0.8); padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 12px; margin-top: 8px; position: relative; z-index: 2;">Conquistada</div>
                </div>
            `;
        } else {
            // status === 'current' - conquista atual
            // Para conquistas customizados, mostrar com badge "conquista Atual" mas sem barra de dias
            if (isCustom) {
                const badgeText = isSelectedForDisplay ? 'Conquista Atual' : customBadgeText;
                return `
                    <div class="rank-card achievement-card-fx" style="${cardStyle}" data-rank-id="${rank.id || ''}" data-rank-name="${rankName || rank.name}" ${cardMetaAttrs}>
                    <span class="rank-up-arrows" aria-hidden="true"></span>
                        ${checkbox}
                        <div class="rank-card-name" style="color: white; font-weight: 700; text-shadow: 0 0 10px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.9); background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 4px; display: inline-block; position: relative; z-index: 2;">${rankName || rank.name}</div>
                        <div class="rank-card-description" style="color: white; text-shadow: 0 0 8px rgba(0,0,0,0.9); background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 13px; margin-top: 8px; position: relative; z-index: 2;">${rankDescription || 'conquista especial'}</div>
                        <div class="rank-card-badge" style="background-color: ${safeRankColor}66; color: white; font-weight: 600; text-shadow: 0 0 8px rgba(0,0,0,0.8); padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 12px; margin-top: 8px; position: relative; z-index: 2;">${badgeText}</div>
                    </div>
                `;
            } else {
                // conquista automático (como Alpha, Initiate) - COM BARRA
                const daysProgress = userDays - rank.minDays;
                const totalDays = rank.maxDays - rank.minDays;
                const progressPercent = Math.max(0, Math.min(100, (daysProgress / totalDays) * 100));
                
                return `
                    <div class="rank-card achievement-card-fx" style="${cardStyle}" data-rank-id="${rank.id || ''}" data-rank-name="${rankName || rank.name}" ${cardMetaAttrs}>
                    <span class="rank-up-arrows" aria-hidden="true"></span>
                        ${checkbox}
                        <div class="rank-card-name" style="color: white; font-weight: 700; text-shadow: 0 0 10px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.9); background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 4px; display: inline-block; position: relative; z-index: 2;">${rankName || rank.name}</div>
                        <div class="rank-card-description" style="color: white; text-shadow: 0 0 8px rgba(0,0,0,0.9); background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 13px; margin-top: 8px; position: relative; z-index: 2;">${rankDescription || 'conquista especial'}</div>
                        <div style="margin-top: 12px; position: relative; width: 100%; height: 32px; background: rgba(0,0,0,0.3); border-radius: 6px; overflow: hidden; border: 1px solid ${safeRankColor}40; display: flex; align-items: center; justify-content: center;">
                            <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${progressPercent}%; background: ${safeRankColor}; opacity: 0.5; transition: width 0.3s ease;"></div>
                            <div style="color: white; text-shadow: 0 0 8px rgba(0,0,0,0.8); font-size: 12px; font-weight: 600; position: relative; z-index: 2;">${daysProgress}/${totalDays} (${rank.minDays}-${rank.maxDays} dias)</div>
                        </div>
                    </div>
                `;
            }
        }
    }


    // Declarar variáveis ANTES de usar
    const fixedAndCustomRanks = [];
    let progressionAchievementRanks = [];
    const postAchievementCurrentRanks = [];
    const likeAchievementCurrentRanks = [];
    const seenAchievementNames = new Set();
    const progressionDisplayOrder = new Map([
        ['membro inicial', 0],
        ['membro novato', 1],
        ['membro iniciado', 2],
        ['membro aprendiz', 3],
        ['membro experiente', 4],
        ['membro adepto', 5],
        ['membro especialista', 6],
        ['membro mestre', 7],
        ['grande mestre', 8],
        ['membro lendário', 9],
        ['membro mítico', 10],
        ['membro transcendente', 11],
        ['membro eterno', 12],
        ['membro imortal', 13]
    ]);
    const AUTO_PROGRESSION_FILTER_SET = new Set([
        'membro aprendiz',
        'membro experiente', 'membro adepto', 'membro especialista', 'membro mestre', 'grande mestre',
        'membro lendário', 'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal'
    ]);

    // CONQUISTAS: usar o rank já resolvido pelo backend/loader como referência principal.
    const autoEloName = String(window.currentUserEloName || '').trim().toLowerCase();
    const preferredCurrentRank = currentRankComplete?.automatic
        || currentRankComplete?.automaticCompleted
        || null;
    const eloAtual = preferredCurrentRank
        ? (findAutoProgressionRankByName(String(preferredCurrentRank.name || '').trim().toLowerCase())
            || preferredCurrentRank)
        : (autoEloName
            ? (conquistasAutomaticas.find(rank => normalizeAchievementNameKey(rank.name || '') === autoEloName)
                || findAutoProgressionRankByName(autoEloName)
                || conquistasAutomaticas[0])
            : conquistasAutomaticas[0]);

    // Armazenar eloAtual numa variável global para usar em event listeners
    window.currentUserEloName = eloAtual ? String(eloAtual?.name || '').trim().toLowerCase() : null;
    // Garantir que a exibição de conquistas seja atualizada agora que sabemos o elo atual
    try {
        if (typeof loadSelectedRanksDisplay === 'function') {
            setTimeout(() => {
                try { loadSelectedRanksDisplay(); } catch (e) { console.warn('Erro ao atualizar selected ranks após set currentUserEloName', e); }
            }, 50);
        }
    } catch (e) {
        console.warn('Erro ao agendar atualização de selected ranks:', e);
    }
    const manualRank = currentRankComplete && currentRankComplete.custom ? currentRankComplete.custom : null;
    const manualRankForDisplay = manualRank && isOwnerAccount() && isFounderAchievementRank(manualRank)
        ? getOwnerFounderProfileRank(manualRank)
        : manualRank;
    
    console.log('DEBUG CONQUISTAS:');
    console.log('  eloAtual:', eloAtual?.name);
    console.log('  manualRank:', manualRank?.name);
    console.log('  currentCustomRanks:', currentCustomRanks.map(r => ({ id: r.id, name: r.name, isVisible: r.isVisible })));
    console.log('  userDays:', userDays);
    console.log('  currentCustomRanks:', currentCustomRanks.map(r => ({ id: r.id, name: r.name, isVisible: r.isVisible })));
    console.log('  userDays:', userDays);

    const pushUniqueAchievementRank = (rank, opts = {}) => {
        if (!rank || !rank.name) return;
        const localized = localizeRankName(rank.name || '');
        const nameKey = normalizeAchievementNameKey(localized || rank.name || '');
        
        // Sempre bloquear 'membro iniciado' explicitamente, mas permitir se for uma conquista customizada
        if (nameKey === 'membro iniciado' && !opts.isCustom) {
            console.log('[DEBUG-PUSH] Explicitly blocking Membro Iniciado');
            return;
        }

        // Bloquear nomes de progressão automática somente quando NÃO forem conquistas customizadas
        if (AUTO_PROGRESSION_FILTER_SET.has(nameKey) && !opts.isCustom) {
            console.log('[DEBUG-PUSH] BLOQUEANDO progressão automática:', rank.name);
            return;
        }
        if (nameKey === 'membro novato' && String(rank?.id || '').trim() !== FIXED_AUTO_RANK_KEY) {
            console.log('[DEBUG-PUSH] BLOQUEANDO Membro Novato em todas as seções do perfil');
            return;
        }
        
        if (seenAchievementNames.has(nameKey)) {
            console.log('[DEBUG-PUSH] DUPLICATA SKIPPED:', rank.name);
            return;
        }
        seenAchievementNames.add(nameKey);

        const group = opts.group || detectRankGroup(rank);
        const entry = { rank, ...opts, group };
        console.log('[DEBUG-PUSH] Adding to', group, ':', rank.name, 'opts:', opts);
        if (group === 'post_achievement') {
            postAchievementCurrentRanks.push(entry);
            return;
        }
        if (group === 'like_achievement') {
            likeAchievementCurrentRanks.push(entry);
            return;
        }
        console.log('[DEBUG-PUSH]   -> Added to fixedAndCustomRanks');
        fixedAndCustomRanks.push(entry);
    };

    // Declarar selectedProfileRankIdsSet AQUI, antes de qualquer uso
    const selectedProfileRankIdsSet = new Set(selectedProfileRankIds || []);

    // Membro Inicial pode ser um rank customizado selecionado pelo usuário,
    // ou então uma conquista automática baseada em dias.
    const membroInicialCustomForDisplay = (currentCustomRanksForRender || []).find(rank => 
        String(rank?.name || '').trim().toLowerCase() === 'membro inicial'
    ) || null;
    const membroInicialAutoForDisplay = !membroInicialCustomForDisplay
        ? conquistasAutomaticas.find(rank => 
            String(rank?.name || '').trim().toLowerCase() === 'membro inicial'
        ) || null
        : null;
    const membroInicialForDisplay = membroInicialCustomForDisplay || membroInicialAutoForDisplay;
    const membroInicialIsAuto = Boolean(membroInicialAutoForDisplay);
    
    // Só permitir que Membro Beta substitua a progressão
    const membroBetaRankForDisplay = (currentCustomRanksForRender || []).find(rank => {
        return String(rank?.name || '').trim().toLowerCase() === 'membro beta';
    }) || null;
    const membroBetaIsSelectedForDisplay = Boolean(
        membroBetaRankForDisplay
        && selectedProfileRankIdsSet.has(Number(membroBetaRankForDisplay.id))
    );
    // Verificar se Membro Novato foi desbloqueado
    const membroNovatoUnlocked = conquistasPassadas.some(rank => 
        String(rank?.name || '').trim().toLowerCase() === 'membro novato'
    );

    progressionAchievementRanks = ALL_RANKS.map(rank => ({ rank, isCustom: false, isVisible: true }));

    // Adicionar Membro Inicial APENAS se:
    // 1. Está nas conquistasAutomaticas ou é customizado
    // 2. Membro Novato NÃO foi desbloqueado
    // 3. Não for a versão automática do rank
    if (membroInicialForDisplay && !membroNovatoUnlocked && !membroInicialIsAuto) {
        console.log('[DEBUG] Adicionando Membro Inicial à progressão (custom)');
        progressionAchievementRanks.push({
            rank: membroInicialForDisplay,
            isCustom: true,
            isVisible: true // Mostrar na seção de progressão
        });
    }

    const currentAutoProgressionRankName = eloAtual ? String(eloAtual.name || '').trim().toLowerCase() : null;
    
    const achievedProgressionRanks = Array.from(
            new Map(
                [...conquistasPassadas]  // Só progressões já conquistadas, sem incluir a atual em andamento
                    .filter(rank => {
                        if (String(rank?.name || '').trim() === 'Membro Inicial') {
                            return !membroInicialForDisplay;
                        }
                        return true;
                    })
                    .filter(Boolean)
                    .map((rank) => [String(rank.name || '').trim().toLowerCase(), rank])
            ).values()
    ).sort((a, b) => Number(a?.minDays || 0) - Number(b?.minDays || 0));

    // Se eloAtual for "Membro Novato", não criar um item fixo duplicado em "Minhas Conquistas".
    // Quando o usuário tem Membro BETA, o rank atual será exibido em Progressão como fixed:auto.

    achievedProgressionRanks.forEach((rank) => {
        const rankNameLower = String(rank?.name || '').trim().toLowerCase();
        const isMembroIniciado = rankNameLower === 'membro iniciado';
        if (isMembroIniciado) {
            console.log('[DEBUG-PROG] Skipping Membro Iniciado (removido de exibição)');
            return;
        }
        // Filtrar "Membro BETA" - já foi adicionado em primeiro lugar
        const isBetaRank = rankNameLower === 'membro beta';
        if (isBetaRank) {
            console.log('[DEBUG-PROG] Skipping Membro BETA (already added)');
            return;
        }
        
        // Filtrar "Membro Inicial" - já foi adicionado como custom rank
        const isMembroInicial = rankNameLower === 'membro inicial';
        if (isMembroInicial) {
            console.log('[DEBUG-PROG] Skipping Membro Inicial (already added)');
            return;
        }
        
        // Se rank de progressão não estiver atribuído via rank customizado/admin, não mostrar.
        // Se por algum motivo o rank atual também vier em conquistasPassadas, não duplicar
        if (currentAutoProgressionRankName && rankNameLower === currentAutoProgressionRankName) {
            console.log('[DEBUG-PROG] Skipping current auto-progression rank in achieved list:', rank.name);
            return;
        }

        console.log('[DEBUG-PROG] Adding to progressionAchievementRanks:', rank.name);
        progressionAchievementRanks.push({
            rank,
            isCustom: true,
            isVisible: rankNameLower === 'membro novato' ? false : true // Membro Novato não tem checkbox
        });
    });

    // Mostrar conquistas de progressão adquiridas mesmo quando Membro Beta substitui o badge atual.
    const progressionCustomRanks = (currentCustomRanksForRender || []).filter((rank) => {
        if (isSpecialCustomRank(rank)) {
            return false;
        }
        const rankNameLower = String(rank?.name || '').trim().toLowerCase();
        if (!rankNameLower) return false;
        const isProgressionRank = String(rank?.rankGroup || '').trim() === 'progression'
            || ALL_RANKS.some((progressionRank) => String(progressionRank?.name || '').trim().toLowerCase() === rankNameLower);
        if (!isProgressionRank) return false;
        if (rankNameLower === 'membro beta') return false;
        // Manter se o usuário explicitamente selecionou a progressão
        if (selectedProfileRankIdsSet.has(Number(rank?.id))) return true;
        // Manter se é um rank fixo/obrigatório (isVisible===0)
        if (Number(rank?.isVisible) === 0 || rank?.isVisible === false) return true;
        // Manter se corresponde ao elo atual (para garantir exibição do atual)
        if (currentAutoProgressionRankName && rankNameLower === currentAutoProgressionRankName) return true;
        return false;
    });

    progressionCustomRanks.forEach((rank) => {
        progressionAchievementRanks.push({
            rank,
            isCustom: true,
            isVisible: rank.isVisible === 1 || rank.isVisible === true
        });
    });

    // Deduplicar progressionAchievementRanks por nome de rank para evitar entradas iguais
    const seenProgressionRankKeys = new Set();
    progressionAchievementRanks = progressionAchievementRanks.filter(item => {
        const rankNameKey = normalizeAchievementNameKey(String(item?.rank?.name || ''));
        if (!rankNameKey) return true;
        if (seenProgressionRankKeys.has(rankNameKey)) {
            console.log('DEBUG: Removendo duplicata de', item?.rank?.name, 'rankNameKey', rankNameKey);
            return false;
        }
        seenProgressionRankKeys.add(rankNameKey);
        return true;
    });
    progressionAchievementRanks.sort((a, b) => {
        const nameA = String(a?.rank?.name || '').trim().toLowerCase();
        const nameB = String(b?.rank?.name || '').trim().toLowerCase();
        const orderA = progressionDisplayOrder.has(nameA) ? progressionDisplayOrder.get(nameA) : Number.MAX_SAFE_INTEGER;
        const orderB = progressionDisplayOrder.has(nameB) ? progressionDisplayOrder.get(nameB) : Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
    });

    // Membro Ativo foi removido, então não há exclusão mútua necessária

    if (manualRank && !isSpecialCustomRank(manualRank)) {
        // conquista manual/fixo sempre aparece em "Minhas conquistas" e não tem checkbox.
        console.log('[DEBUG-PUSH] Adding manualRank:', manualRank.name);
        pushUniqueAchievementRank(manualRankForDisplay, { isCustom: true, isVisible: false, isFixed: true });
    } else if (manualRank && isSpecialCustomRank(manualRank)) {
        console.log('[DEBUG-PUSH] Pulando manualRank especial de Minhas Conquistas:', manualRank.name);
    }
    
    // Ranks de progressão ficam exclusivamente na seção de Progressão.
    const otherCustomRanks = (currentCustomRanksForRender || []).filter(rank => {
        const rankName = String(rank?.name || '').trim().toLowerCase();
        const rankGroup = String(rank?.rankGroup || '').trim().toLowerCase();
        const isProgressionRank = rankGroup === 'progression' || ALL_RANKS.some((progressionRank) => String(progressionRank?.name || '').trim().toLowerCase() === rankName);
        return rankName !== 'membro novato' && !isProgressionRank;
    });
    
    otherCustomRanks.forEach(rank => {
        const rankName = String(rank?.name || '').trim().toLowerCase();
        const isVisible = rank.isVisible === 1 || rank.isVisible === true;
        
        // Aqui adicionamos APENAS as outras conquistas personalizadas
        console.log('[DEBUG] Adicionando otherCustomRank:', rank.name, '(selected:', selectedProfileRankIdsSet.has(rank.id), ', mandatory:', rank.isVisible === 0 || rank.isVisible === false, ')');
        pushUniqueAchievementRank(rank, {
            isCustom: true,
            isVisible,
            isFixed: !isVisible
        });
    });

    console.log('[DEBUG] Filtro de AUTO_PROGRESSION_NAMES aplicado. Verificando se Membro Novato ainda existe:');
    console.log('[DEBUG-CHECK] Membro Novato em currentCustomRanks:', currentCustomRanks.filter(r => String(r?.name || '').trim().toLowerCase() === 'membro novato').map(r => ({ id: r.id, name: r.name, isVisible: r.isVisible })));
    console.log('[DEBUG-CHECK] Membro Novato em otherCustomRanks:', otherCustomRanks.filter(r => String(r?.name || '').trim().toLowerCase() === 'membro novato').map(r => ({ id: r.id, name: r.name, isVisible: r.isVisible })));
    console.log('[DEBUG-CHECK] Membro Novato em fixedAndCustomRanks ANTES:', fixedAndCustomRanks.filter(r => String(r?.rank?.name || '').trim().toLowerCase() === 'membro novato').map(r => ({ id: r?.rank?.id, name: r?.rank?.name, isFixed: r.isFixed })));

    console.log('[DEBUG] === RENDERRANKHISTORY DEBUG START ===');
    console.log('[DEBUG] currentCustomRanks:', currentCustomRanks.map(r => ({ id: r.id, name: r.name })));
    console.log('[DEBUG] selectedProfileRankIds:', selectedProfileRankIds);
    
    let sortedFixedAndCustom = [
        ...fixedAndCustomRanks.filter(item => item.isFixed || item.isCustom === false),
        ...fixedAndCustomRanks.filter(item => !(item.isFixed || item.isCustom === false))
    ].filter((item, idx) => {
        // BLOQUEIO FINAL: progressões automáticas não aparecem em "Minhas Conquistas",
        // exceto Beta enquanto ainda está disponível para seleção.
        // Conquistas especiais/evento (ex.: "Teste de evento") devem continuar aparecendo como conquistas personalizadas.
        const rankName = String(item?.rank?.name || '').trim().toLowerCase();

        if (rankName === 'membro beta' && !selectedProfileRankIdsSet.has(Number(item?.rank?.id))) {
            return true;
        }
        
        // Lista completa de progressões que NUNCA devem aparecer em "Minhas Conquistas"
        const BLOCKED_PROGRESSION_RANKS = new Set([
            'membro beta',
            'membro inicial',
            'membro iniciado',
            'membro novato', 
            'membro ativo',
            'membro aprendiz', 
            'membro experiente',
            'membro adepto', 
            'membro especialista', 
            'membro mestre', 
            'grande mestre',
            'membro lendário', 
            'membro mítico', 
            'membro transcendente', 
            'membro eterno', 
            'membro imortal'
        ]);
        
        const isBlockedProgression = String(item?.rank?.rankGroup || '').trim().toLowerCase() === 'progression'
            || BLOCKED_PROGRESSION_RANKS.has(rankName);
        
        if (isBlockedProgression) {
            console.log(`❌ [BLOQUEIO FINAL] REMOVENDO "${item?.rank?.name}" de Minhas Conquistas`);
            return false;
        }
        
        console.log(`✅ [BLOQUEIO FINAL] "${item?.rank?.name}" PODE aparecer em Minhas Conquistas`);
        return true;
    });

    // O rank automático atual é exibido no cabeçalho, não como um card personalizado.
    sortedFixedAndCustom = sortedFixedAndCustom.filter((item) => {
        const isFixedAutoCurrentProgression = item?.isFixed === true
            && String(item?.rank?.id || '').trim() === FIXED_AUTO_RANK_KEY;
        return !isFixedAutoCurrentProgression;
    });

    console.log('[DEBUG] sortedFixedAndCustom FINAL:', sortedFixedAndCustom.map(r => r?.rank?.name));
    console.log('[DEBUG] progressionAchievementRanks FINAL:', progressionAchievementRanks.map(r => r?.rank?.name));
    console.log('[DEBUG] postAchievementCurrentRanks FINAL:', postAchievementCurrentRanks.map(r => r?.rank?.name));
    console.log('[DEBUG] likeAchievementCurrentRanks FINAL:', likeAchievementCurrentRanks.map(r => r?.rank?.name));
    console.log('[DEBUG] === RENDERRANKHISTORY DEBUG END ===');

    const selectedCustomRankNamesForProgression = new Set(
        sortedFixedAndCustom
            .map(item => normalizeAchievementNameKey(localizeRankName(String(item?.rank?.name || ''))))
            .filter(Boolean)
    );
    progressionAchievementRanks = progressionAchievementRanks.filter(entry => {
        const rankNameKey = normalizeAchievementNameKey(localizeRankName(String(entry?.rank?.name || '')));
        return !selectedCustomRankNamesForProgression.has(rankNameKey);
    });

    const progressionAchievementCards = progressionAchievementRanks.filter((entry) => {
        if (!entry || !entry.rank || !entry.rank.name) return false;
        const userProgressionDays = Number(userDays || 0);
        const rankMinDays = Number(entry.rank.minDays || 0);
        const rankMaxDays = Number(entry.rank.maxDays || rankMinDays || 0);
        return entry.isCustom === true || userProgressionDays >= rankMinDays || userProgressionDays < rankMaxDays;
    }).map((entry) => ({
        ...entry,
        achieved: Number(userDays || 0) >= Number(entry.rank?.maxDays || entry.rank?.minDays || 0)
    }));

    const renderMeusElosSection = (title, color, ranks, emptyMessage, renderItem = null, cardRankType = '') => `
        <div style="margin-top: 20px; border-top: 1px solid ${color}55; padding-top: 14px; display: block; width: 100%;">
            <h4 class="conquista-list-title" style="display: block; width: 100%; margin: 0 0 12px 0; color: ${color}; border-bottom-color: ${color}55; font-size: 16px; line-height: 1.3;">${title}</h4>
            <div class="ranks-grid-compact" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; width: 100%; padding: 0;">
                ${ranks.length > 0
                    ? ranks.map((entry) => renderItem
                        ? renderItem(entry)
                        : renderCard(entry.rank, entry.isCustom, 'current', userDays, entry.isVisible, cardRankType)
                    ).join('')
                    : `<p style="margin: 0; color: rgba(255,255,255,0.55); font-size: 13px;">${emptyMessage}</p>`}
            </div>
        </div>
    `;

    function resolveMyAchievementGoalLabel(rank, group) {
        const icon = String(rank?.icon || '').trim().toUpperCase();
        const customText = String(rank?.customText || '').trim();
        const description = String(rank?.description || '').trim();
        const sourceText = `${customText} ${description}`.trim();

        if (group === 'like_achievement') {
            if (/^L\d+$/.test(icon)) return `${Number(icon.slice(1))} likes`;
            const likeMatch = sourceText.match(/(\d+)\s*likes?/i);
            if (likeMatch) return `${Number(likeMatch[1])} likes`;
            return 'Conquista de likes';
        }

        if (group === 'post_achievement') {
            if (/^P\d+$/.test(icon)) return `${Number(icon.slice(1))} postagens`;
            const postMatch = sourceText.match(/(\d+)\s*(postagens?|posts?)/i);
            if (postMatch) return `${Number(postMatch[1])} postagens`;
            return 'Conquista de postagens';
        }

        if (group === 'progression') {
            const minDays = rank?.minDays;
            const maxDays = rank?.maxDays;
            const hasMinDays = minDays !== undefined && minDays !== null && minDays !== ''
                && Number.isFinite(Number(minDays));
            const hasMaxDays = maxDays !== undefined && maxDays !== null && maxDays !== ''
                && Number.isFinite(Number(maxDays));

            if (hasMinDays && hasMaxDays) {
                return Number(minDays) === 0 ? '0 dias' : `${Number(minDays)}-${Number(maxDays)} dias`;
            }
            if (hasMinDays) {
                return `${Number(minDays)} dias`;
            }
            return String(rank?.name || '').trim().toLowerCase() === 'membro beta'
                ? 'Conquista especial'
                : 'Conquista de progressão';
        }

        return 'Conquista especial';
    }

    const currentProgressionName = String(eloAtual?.name || '').trim().toLowerCase();
    const currentProgressionForDisplay = membroBetaIsSelectedForDisplay
        ? membroBetaRankForDisplay
        : (currentProgressionName === 'membro inicial'
            ? membroInicialForDisplay || eloAtual
            : eloAtual)
            || ALL_RANKS.find(rank => String(rank.name).trim().toLowerCase() === 'membro inicial');
    const completedProgressionEntries = progressionAchievementCards
        .filter((entry) => {
            if (!entry?.achieved || !entry.rank) return false;
            return String(entry.rank.name || '').trim().toLowerCase() !== 'membro beta';
        })
        .map((entry) => ({ rank: entry.rank, achieved: true }));
    (currentCustomRanksForRender || [])
        .filter((rank) => {
            const rankName = String(rank?.name || '').trim().toLowerCase();
            return rankName !== 'membro beta'
                && (String(rank?.rankGroup || '').trim().toLowerCase() === 'progression'
                    || progressionDisplayOrder.has(rankName));
        })
        .forEach((rank) => completedProgressionEntries.push({ rank, achieved: true }));

    const conquistasSectionHTML = `
        <div style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(236, 72, 153, 0.35); background: rgba(236, 72, 153, 0.08); color: #F9A8D4; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
            Você pode escolher uma conquista de cada categoria (Postagens/Likes). Conquistas de progressão e personalizadas ficam separadas.
        </div>
        ${renderMeusElosSection('Conquistas Personalizadas', '#EC4899', sortedFixedAndCustom, 'Nenhuma conquista disponível nesta seção.', null, 'custom')}
        ${renderMeusElosSection('Conquistas de Progressão', '#A78BFA', (() => {
            const entriesByName = new Map();
            const addEntry = (rank, extra = {}) => {
                const rankName = String(rank?.name || '').trim();
                const rankNameKey = normalizeAchievementNameKey(rankName);
                if (!rankNameKey) return;
                entriesByName.set(rankNameKey, { rank, achieved: true, ...extra });
            };

            if (membroBetaRankForDisplay) {
                addEntry(membroBetaRankForDisplay, { isBetaSelection: true });
            }
            completedProgressionEntries.forEach(({ rank, ...entry }) => addEntry(rank, entry));
            if (!membroBetaIsSelectedForDisplay && currentProgressionForDisplay) {
                addEntry(currentProgressionForDisplay, {
                    isBetaSelection: false
                });
            }
            return Array.from(entriesByName.values()).sort((a, b) => {
                const orderFor = (entry) => entry.isBetaSelection
                    ? -1
                    : progressionDisplayOrder.get(String(entry.rank?.name || '').trim().toLowerCase())
                        ?? Number.MAX_SAFE_INTEGER;
                return orderFor(a) - orderFor(b);
            });
        })(), 'Nenhuma conquista de progressão disponível nesta seção.', (entry) => {
            const targetValue = Number(entry.rank?.maxDays) || Number(entry.rank?.minDays) || 1;
            return renderMilestoneCard(
                entry.rank,
                entry.achieved,
                resolveMyAchievementGoalLabel(entry.rank, 'progression'),
                'Conquistado',
                'progression',
                userDays,
                targetValue,
                false,
                entry.isBetaSelection === true,
                'progression-selector'
            );
        }, 'progression')}
        ${renderMeusElosSection(
            'Conquistas de Postagens',
            '#C084FC',
            postAchievementCurrentRanks,
            'Você ainda não desbloqueou conquistas de postagens.',
            ({ rank }) => renderMilestoneCard(
                rank,
                true,
                resolveMyAchievementGoalLabel(rank, 'post_achievement'),
                'Conquistado',
                'post_achievement',
                1,
                1,
                false,
                true,
                'post_achievement'
            )
        )}
        ${renderMeusElosSection(
            'Conquistas de Likes',
            '#38BDF8',
            likeAchievementCurrentRanks,
            'Você ainda não desbloqueou conquistas de likes.',
            ({ rank }) => renderMilestoneCard(
                rank,
                true,
                resolveMyAchievementGoalLabel(rank, 'like_achievement'),
                'Conquistado',
                'like_achievement',
                1,
                1,
                false,
                true,
                'like_achievement'
            )
        )}
    `;

    // Tab 2: Progressão (automática)
    // Não incluir Membro BETA na progressão se já estiver selecionado - só mostrar o elo atual real
    const currentProgressionRankForDisplay = eloAtual;
    const selectedRankNames = new Set((currentCustomRanks || []).map(r => normalizeAchievementNameKey(localizeRankName(String(r?.name || '')))));
    const selectedRankIds = new Set((currentCustomRanks || [])
        .map((rank) => normalizeRankOrderKey(rank?.id))
        .filter(Boolean)
    );
    const selectedCustomProgressionNames = new Set(
        (sortedFixedAndCustom || [])
            .map((item) => String(item?.rank?.name || '').trim().toLowerCase())
            .filter(Boolean)
    );

    // Mostrar todos os ranks de progressão na aba Progressão
    const progressaoRanks = ALL_RANKS;
    let progressaoHTML = progressaoRanks
        .filter(Boolean)
        .filter((rank, idx, self) => {
            const normalizedName = normalizeAchievementNameKey(rank?.name || '');
            return self.findIndex(other => normalizeAchievementNameKey(other?.name || '') === normalizedName) === idx;
        })
        .sort((a, b) => {
            const nameA = String(a?.name || '').trim().toLowerCase();
            const nameB = String(b?.name || '').trim().toLowerCase();
            const orderA = progressionDisplayOrder.has(nameA) ? progressionDisplayOrder.get(nameA) : Number.MAX_SAFE_INTEGER;
            const orderB = progressionDisplayOrder.has(nameB) ? progressionDisplayOrder.get(nameB) : Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        })
        .map(rank => {
            if (!rank || !rank.name) return '';
            const rankNameLower = String(rank.name || '').trim().toLowerCase();
            const isFixedAutoRank = String(rank?.id || '').trim() === FIXED_AUTO_RANK_KEY;
            const targetValue = Number(rank?.maxDays) || Number(rank?.minDays) || 1;
            const minDaysLabel = Number(rank?.minDays) || 0;
            const maxDaysLabel = Number(rank?.maxDays) || targetValue;
            const isPastProgression = userDays >= maxDaysLabel;
            const isCurrentProgression = userDays >= minDaysLabel && userDays < maxDaysLabel;
            const defaultGoalLabel = rankNameLower === 'membro inicial'
                ? `${minDaysLabel} dias`
                : `A partir de ${minDaysLabel} dias`;

            if (isFixedAutoRank || rank === eloAtual || isCurrentProgression) {
                return renderMilestoneCard(
                    rank,
                    false,
                    `Progresso ${userDays}/${maxDaysLabel} dias`,
                    'Atual',
                    'progression',
                    userDays,
                    targetValue,
                    true,
                    false,
                    'progression'
                );
            }

            if (isPastProgression) {
                return renderMilestoneCard(
                    rank,
                    true,
                    defaultGoalLabel,
                    'Conquistado',
                    'progression',
                    userDays,
                    targetValue,
                    false,
                    false,
                    'progression'
                );
            }

            return renderMilestoneCard(
                rank,
                false,
                defaultGoalLabel,
                '',
                'progression',
                userDays,
                targetValue,
                false,
                false,
                'progression'
            );
        }).join('');

    // Garantir que nenhum checkbox de seleção apareça na aba 'Progressão'
    try {
        const checkboxRegex = /<input\b[^>]*class=(?:"|'|)\s*[^>]*rank-checkbox[^>]*>/gi;
        progressaoHTML = progressaoHTML.replace(checkboxRegex, '');
    } catch (err) {
        console.warn('Erro ao limpar checkboxes em progressaoHTML:', err);
    }

    const postAchievementNames = new Set(
        (currentCustomRanks || [])
            .filter(rank => rank && rank.name)
            .map(rank => String(rank.name).trim().toLowerCase())
    );

    function renderMilestoneCard(
        rank,
        achieved,
        goalLabel,
        badgeLabel,
        milestoneType = 'milestone',
        currentValue = 0,
        targetValue = 1,
        showProgressBar = false,
        showSelectionCheckbox = false,
        selectionGroup = ''
    ) {
        // Adicionar validação básica do rank
        if (!rank || !rank.name || !rank.color) {
            console.warn('[renderMilestoneCard] Invalid rank, skipping:', rank);
            return '';
        }
        const rankNameLower = String(rank?.name || '').trim().toLowerCase();

        const rankName = normalizeBrokenUtf8Text(rank?.name || '');
        const rankDescription = normalizeBrokenUtf8Text(rank?.description || rank?.customText || '');
        const safeRankColor = normalizeHexColorForUi(rank?.color, '#EC4899');
        const safeGoalLabel = String(goalLabel || '').trim();
        const safeBadgeLabel = String(badgeLabel || '').trim();
        const rankIdValue = rank?.id;
        const rankIdNumber = Number(rankIdValue);
        const rankOrderKey = normalizeRankOrderKey(rankIdValue);
        const rankGroup = String(selectionGroup || rank?.rankGroup || milestoneType || '').trim();
        const cardAnimationMode = resolveAchievementCardAnimationMode(milestoneType, rank);
        const isSelectableVisibleRank = Number(rank?.isVisible ?? 1) === 1;
        const canSelect = showSelectionCheckbox && Boolean(rankOrderKey) && isSelectableVisibleRank;
        const isSelectedForDisplay = canSelect && isRankSelectedForDisplay(rank);
        const checkboxColor = safeRankColor;
        const shouldAutoCheckMilestone = isSelectedForDisplay && ['membro beta', 'membro inicial', 'membro novato', 'membro ativo', 'membro iniciado'].includes(rankNameLower);
        const checkboxHtml = canSelect
            ? `<input type="checkbox" class="rank-checkbox" data-rank-id="${rankIdNumber}" data-rank-name="${String(rank?.name || '').trim()}" data-rank-group="${rankGroup}" data-rank-color="${checkboxColor}" ${shouldAutoCheckMilestone ? 'checked' : ''} style="--rank-checkbox-color: ${checkboxColor}; position: absolute; top: 8px; right: 8px; z-index: 3; width: 20px; height: 20px; cursor: pointer; background: rgba(3,7,18,0.92); border: 1px solid ${checkboxColor}; border-radius: 4px; box-shadow: 0 0 0 1px ${checkboxColor}66, 0 0 8px ${checkboxColor}55;">`
            : '';
        const status = achieved ? 'completed' : 'available';
        const badgeColor = achieved ? '#FFFFFF' : safeRankColor;
        const badgeBg = achieved ? `${safeRankColor}66` : 'transparent';
        const parsedCurrent = Number.isFinite(Number(currentValue)) ? Math.max(0, Number(currentValue)) : 0;
        const parsedTarget = Number.isFinite(Number(targetValue)) ? Math.max(1, Number(targetValue)) : 1;
        const progressPercent = achieved
            ? 100
            : Math.max(0, Math.min(100, (parsedCurrent / parsedTarget) * 100));
        const progressValueLabel = `${parsedCurrent}/${parsedTarget}`;

        const milestoneCustomBackground = resolveMediaUrl(rank?.backgroundImage || '', '');
        const milestoneSpecificBackground = resolveAchievementBackgroundForRank(milestoneType, rank);
        const milestoneGroupBackground = resolveAchievementBackgroundByType(milestoneType);
        const milestoneBackground = milestoneCustomBackground || milestoneSpecificBackground || milestoneGroupBackground;
        const milestoneBackgroundEscaped = escapeCssUrlValue(milestoneBackground);
        const milestoneHoverGif = Boolean(milestoneBackground)
            && cardAnimationMode === 'hover'
            && isGifMediaSource(milestoneBackground);
        const cardStyle = milestoneBackground
            ? milestoneHoverGif
                ? `
                    --rank-color: ${safeRankColor};
                    border-color: ${safeRankColor};
                    --rank-hover-gif-bg: url('${milestoneBackgroundEscaped}');
                    background:
                        radial-gradient(120% 90% at 14% 12%, ${safeRankColor}2b, transparent 50%),
                        radial-gradient(120% 90% at 82% 88%, ${safeRankColor}1f, transparent 56%),
                        linear-gradient(160deg, rgba(10, 14, 34, 0.92), rgba(8, 12, 28, 0.9));
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                    background-color: rgba(8, 12, 28, 0.9);
                    position: relative;
                `
                : `
                    --rank-color: ${safeRankColor};
                    border-color: ${safeRankColor};
                    background-image: url('${milestoneBackgroundEscaped}');
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                    background-color: rgba(8, 12, 28, 0.9);
                    position: relative;
                `
            : `
                --rank-color: ${safeRankColor};
                border-color: ${safeRankColor};
                background:
                    radial-gradient(120% 90% at 14% 12%, ${safeRankColor}2b, transparent 50%),
                    radial-gradient(120% 90% at 82% 88%, ${safeRankColor}1f, transparent 56%),
                    linear-gradient(160deg, rgba(10, 14, 34, 0.92), rgba(8, 12, 28, 0.9));
                position: relative;
            `;

        const progressBarHtml = showProgressBar
            ? `
                <div style="margin-top: 10px; position: relative; width: 100%; height: 30px; background: rgba(0,0,0,0.34); border-radius: 8px; overflow: hidden; border: 1px solid ${safeRankColor}55; display: flex; align-items: center; justify-content: center;">
                    <div style="position: absolute; top: 0; left: 0; height: 100%; width: ${progressPercent}%; background: linear-gradient(90deg, ${safeRankColor}, ${safeRankColor}cc); opacity: 0.52; transition: width 0.35s ease;"></div>
                    <div style="color: white; text-shadow: 0 0 8px rgba(0,0,0,0.85); font-size: 11px; font-weight: 700; position: relative; z-index: 2;">${progressValueLabel}</div>
                </div>
            `
            : '';
        const effectiveBadgeLabel = isSelectedForDisplay ? 'Conquista Atual' : safeBadgeLabel;
        const badgeHtml = effectiveBadgeLabel
            ? `<div class="rank-card-badge" style="background-color: ${badgeBg}; color: ${badgeColor}; font-weight: 700; text-shadow: 0 0 8px rgba(0,0,0,0.8); padding: 6px 10px; border-radius: 999px; display: inline-block; font-size: 11px; margin-top: 8px; border: 1px solid ${safeRankColor}99; position: relative; z-index: 2;">${effectiveBadgeLabel}</div>`
            : '';

        const hoverGifUrlAttr = milestoneHoverGif
            ? ` data-rank-hover-gif-url="${escapeHtmlAttributeValue(milestoneBackground)}"`
            : '';

        return `
            <div class="rank-card achievement-card-fx" style="${cardStyle}" data-rank-name="${rankName || rank.name}" data-rank-status="${status}" data-rank-type="${milestoneType}" data-rank-animation-mode="${cardAnimationMode}" data-rank-hover-gif="${milestoneHoverGif ? '1' : '0'}"${hoverGifUrlAttr}>
                <span class="rank-up-arrows" aria-hidden="true"></span>
                ${checkboxHtml}
                <div class="rank-card-name" style="color: ${safeRankColor}; font-weight: 700; text-shadow: 0 0 10px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.9); background: rgba(0,0,0,0.5); padding: 6px 10px; border-radius: 4px; display: inline-block; position: relative; z-index: 2;">${rankName || rank.name}</div>
                <div class="rank-card-description" style="color: rgba(255,255,255,0.95); text-shadow: 0 0 8px rgba(0,0,0,0.9); background: rgba(0,0,0,0.48); padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 13px; margin-top: 8px; position: relative; z-index: 2;">${rankDescription || 'Conquista especial'}</div>
                <div class="rank-card-time" style="color: ${safeRankColor}; text-shadow: 0 0 8px rgba(0,0,0,0.9); background: rgba(0,0,0,0.44); padding: 5px 9px; border-radius: 8px; display: inline-block; font-size: 11px; margin-top: 8px; position: relative; z-index: 2;">${safeGoalLabel}</div>
                ${progressBarHtml}
                ${badgeHtml}
            </div>
        `;
    }

    let nextPostProgressAssigned = false;
    const postAchievementsHTML = POST_ACHIEVEMENT_RANKS.map(rank => {
        const achievedByCount = currentUserPostCount >= rank.minPosts;
        const achievedByRank = postAchievementNames.has(String(rank.name).trim().toLowerCase());
        const achieved = achievedByCount || achievedByRank;
        const showProgressBar = !achieved && !nextPostProgressAssigned;
        if (showProgressBar) {
            nextPostProgressAssigned = true;
        }
        const badgeLabel = achieved ? 'Conquistado' : '';
        return renderMilestoneCard(
            rank,
            achieved,
            `${rank.minPosts} postagens`,
            badgeLabel,
            'post_achievement',
            currentUserPostCount,
            rank.minPosts,
            showProgressBar
        );
    }).join('');

    const likeAchievementNames = new Set(
        (currentCustomRanks || [])
            .filter(rank => rank && rank.name)
            .map(rank => String(rank.name).trim().toLowerCase())
    );
    let nextLikeProgressAssigned = false;
    const likeAchievementsHTML = LIKE_ACHIEVEMENT_RANKS.map(rank => {
        const achievedByCount = currentUserLikeCount >= rank.minLikes;
        const achievedByRank = likeAchievementNames.has(String(rank.name).trim().toLowerCase());
        const achieved = achievedByCount || achievedByRank;
        const showProgressBar = !achieved && !nextLikeProgressAssigned;
        if (showProgressBar) {
            nextLikeProgressAssigned = true;
        }
        const badgeLabel = achieved ? 'Conquistado' : '';
        return renderMilestoneCard(
            rank,
            achieved,
            `${rank.minLikes} likes`,
            badgeLabel,
            'like_achievement',
            currentUserLikeCount,
            rank.minLikes,
            showProgressBar
        );
    }).join('');

    const html = `
        <div class="ranks-tabs" style="display: flex; flex-direction: column; width: 100%; gap: 20px;">
            
            <div class="ranks-tab-buttons" style="display: flex; gap: 20px; border-bottom: 2px solid rgba(107, 70, 193, 0.2); padding-bottom: 15px; margin-bottom: 15px;">
                <button class="ranks-tab-btn active" data-tab="conquistas" style="background: none; border: none; color: #6B46C1; font-size: 15px; font-weight: 600; cursor: pointer; border-bottom: 3px solid #6B46C1; padding: 5px 15px;">Minhas conquistas</button>
                <button class="ranks-tab-btn" data-tab="disponiveis" style="background: none; border: none; color: rgba(255, 255, 255, 0.6); font-size: 15px; font-weight: 600; cursor: pointer; border-bottom: 3px solid transparent; padding: 5px 15px;">Progressão</button>
                    </div>
            
            <div class="ranks-tab-content active" id="tab-conquistas" style="display: block;">
                ${conquistasSectionHTML}
            </div>
            
            <div class="ranks-tab-content" id="tab-disponiveis" style="display: none;">
                <div style="margin-bottom: 12px;">
                    <h4 style="margin: 0 0 12px 0; color: #A78BFA; font-size: 16px;">Conquistas de Progressão</h4>
                </div>
                <div class="ranks-grid-compact" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; width: 100%; padding: 0;">
                    ${progressaoHTML}
                </div>
                <div style="margin-top: 22px; border-top: 1px solid rgba(107, 70, 193, 0.3); padding-top: 16px;">
                    <h4 style="margin: 0 0 12px 0; color: #C084FC; font-size: 16px;">Conquistas de Postagens</h4>
                    <div class="ranks-grid-compact" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; width: 100%; padding: 0;">
                        ${postAchievementsHTML}
                    </div>
                </div>
                <div style="margin-top: 22px; border-top: 1px solid rgba(56, 189, 248, 0.28); padding-top: 16px;">
                    <h4 style="margin: 0 0 12px 0; color: #38BDF8; font-size: 16px;">Conquistas de Likes</h4>
                    <div class="ranks-grid-compact" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; width: 100%; padding: 0;">
                        ${likeAchievementsHTML}
                    </div>
                </div>
            </div>
        </div>
    `;

    console.log('[renderRankHistory] HTML length:', html.length);
    console.log('[renderRankHistory] HTML preview (first 500 chars):', html.substring(0, 500));
    console.log('[renderRankHistory] Setting innerHTML...');
    historyContainer.innerHTML = html;
    console.log('[renderRankHistory] innerHTML set successfully!');

    renderProfileTaglineBottom();

    // Event listeners para tabs
    document.querySelectorAll('.ranks-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.ranks-tab-btn').forEach(b => {
                b.style.color = 'rgba(255, 255, 255, 0.6)';
                b.style.borderBottom = '3px solid transparent';
            });
            document.querySelectorAll('.ranks-tab-content').forEach(c => c.style.display = 'none');
            
            e.target.style.color = '#6B46C1';
            e.target.style.borderBottom = '3px solid #6B46C1';
            document.getElementById(`tab-${e.target.dataset.tab}`).style.display = 'block';
        });
    });

    configureRankPerformanceMode(historyContainer);
    bindAchievementCardFx(historyContainer);

    console.log('Rank history rendered - User has ' + userDays + ' days');
    } catch (err) {
        console.error('[renderRankHistory] CAUGHT ERROR:', err);
        console.error('[renderRankHistory] ERROR message:', err.message);
        console.error('[renderRankHistory] ERROR stack:', err.stack);
        const historyContainer = document.getElementById('ranksHistory');
        if (historyContainer) {
            historyContainer.innerHTML = '<p class="ranks-error-message">Erro ao carregar histórico de conquistas.</p>';
        }
    }
}

async function refreshProfileAfterReturn() {
    if (isProfileReturnRefreshInFlight) return;
    if (!currentUser?.id) return;

    isProfileReturnRefreshInFlight = true;
    try {
        await loadCustomRanks(currentUser.id);

        const profileContent = document.getElementById('profileContent');
        const isProfileVisible = profileContent && profileContent.style.display !== 'none';
        if (isProfileVisible) {
            await loadSelectedRanksDisplay();
        }
    } finally {
        isProfileReturnRefreshInFlight = false;
    }
}

async function handleAdultPostsDeepLink() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openAdultPosts') !== '1') return;

    const editBtn = document.getElementById('editBtn');
    if (editBtn) {
        editBtn.click();
    } else {
        const modal = document.getElementById('editModal');
        if (modal) modal.style.display = 'block';
    }

    const targetTabName = 'advanced-tab';
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${targetTabName}"]`);
    const targetTab = document.getElementById(targetTabName);

    document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
    if (targetBtn) targetBtn.classList.add('active');
    if (targetTab) targetTab.classList.add('active');

    initializeNotificationSettingsControls();
    await loadAdultPostsPreference();

    const toggle = document.getElementById('showAdultPostsToggle');
    const isToggleVisible = Boolean(toggle) && toggle.offsetParent !== null;
    if (isToggleVisible) {
        toggle.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toggle.focus({ preventScroll: true });
    }

    params.delete('openAdultPosts');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, nextUrl);
}

async function loadCustomRanks(userId) {
    try {
        console.log('[loadCustomRanks] Starting...');

        try {
            const bgResult = await AuthAPI.getAchievementBackgrounds();
            if (bgResult?.success && bgResult?.backgrounds) {
                applyAchievementBackgroundSettings(bgResult.backgrounds);
            }
        } catch (bgError) {
            console.warn('Erro ao atualizar fundos de conquistas:', bgError?.message || bgError);
        }

        // Sincroniza conquistas de postagens e likes antes de buscar os conquistas do usuario
        console.log('[loadCustomRanks] Syncing post achievements...');
        await AuthAPI.syncPostAchievementRanks().catch(err => console.warn('Sync post error:', err));
        
        console.log('[loadCustomRanks] Syncing like achievements...');
        await AuthAPI.syncLikeAchievementRanks().catch(err => console.warn('Sync like error:', err));

        // Atualizar contagens para a aba de progressão
        const statsResult = await AuthAPI.getUserDownloadStats(userId);
        if (statsResult && statsResult.success && statsResult.stats) {
            currentUserPostCount = Number(statsResult.stats.totalPostages || 0);
            currentUserLikeCount = Number(statsResult.stats.totalLikes || 0);
        } else {
            currentUserPostCount = 0;
            currentUserLikeCount = 0;
        }
        
        console.log('[loadCustomRanks] Fetching custom ranks for user', userId);
        const elosResult = await AuthAPI.getUserCustomRanks(userId);
        console.log('[loadCustomRanks] API Response:', elosResult);
        console.log('[loadCustomRanks] API Response success:', elosResult?.success);
        console.log('[loadCustomRanks] API Response ranks count:', elosResult?.ranks?.length || 0);
        
        const rawElos = Array.isArray(elosResult?.ranks) ? elosResult.ranks : [];
        if (!elosResult?.success) {
            console.warn('[loadCustomRanks] getUserCustomRanks returned success=false:', elosResult?.message || elosResult);
        }
        const filteredElos = rawElos.filter(rank => {
            if (isHiddenProfileRank(rank)) {
                console.log('[loadCustomRanks FILTER] Removendo rank oculto do perfil:', rank.name);
                return false;
            }
            return true;
        });
        
        // Guardar os conquistas customizados na variável global (sem ranks automáticos de progressão, que são renderizados separadamente)
        currentCustomRanks = filteredElos.filter((rank) => {
            const rankName = String(rank?.name || '').trim().toLowerCase();
            return !isAutomaticProgressionRankName(rankName)
                || ['membro beta', 'membro inicial', 'membro ativo', 'membro iniciado', 'membro novato'].includes(rankName);
        });
        console.log('[loadCustomRanks] Custom ranks loaded (after filter):', currentCustomRanks.length);
        console.log('[loadCustomRanks] Custom ranks details:', currentCustomRanks.map(r => ({ id: r.id, name: r.name, isVisible: r.isVisible })));
        
        // Carregar conquistas selecionados para exibição ANTES de marcar checkboxes
        console.log('[loadCustomRanks] Fetching selected ranks...');
        let selectedResult;
        try {
            selectedResult = await AuthAPI.getSelectedProfileRanks();
        } catch (e) {
            console.error('[loadCustomRanks] Error fetching selected ranks:', e);
            selectedResult = { success: false, rankIds: [] };
        }
        console.log('[loadCustomRanks] Selected ranks result:', selectedResult);
        canOrderFixedRanks = Boolean(selectedResult?.canOrderFixedRanks || canOrderFixedRanks);
        
        // Manter IDs numéricos e chaves fixas válidas para o proprietário.
        const rawRankIds = selectedResult.success && Array.isArray(selectedResult.rankIds)
            ? selectedResult.rankIds
            : [];
        const selectedRankObjects = Array.isArray(selectedResult.ranks)
            ? selectedResult.ranks.filter(rank => rank && rank.name && !isHiddenProfileRank(rank))
            : [];
        const validSelectedRankIds = new Set(
            selectedRankObjects
                .map(rank => Number(rank.id))
                .filter(Number.isFinite)
        );

        const missingSelectedRanks = selectedRankObjects.filter(rank => {
            const rankNameLower = String(rank.name || '').trim().toLowerCase();
            return rankNameLower === 'membro beta'
                && !currentCustomRanks.some(existing => String(existing?.name || '').trim().toLowerCase() === rankNameLower);
        });
        if (missingSelectedRanks.length > 0) {
            currentCustomRanks = [...currentCustomRanks, ...missingSelectedRanks];
            console.log('[loadCustomRanks] Added missing selected special progression ranks to currentCustomRanks:', missingSelectedRanks.map(r => r.name));
        }

        const progressionSelectionNames = new Set(['membro beta']);
        const specialSelectedProgressionRankIds = new Set(
            selectedRankObjects
                .filter(rank => progressionSelectionNames.has(String(rank.name || '').trim().toLowerCase()))
                .map(rank => Number(rank.id))
                .filter(Number.isFinite)
        );
        const validFixedRankKeys = new Set(
            selectedRankObjects
                .map((rank) => String(rank?.id || '').trim())
                .filter((id) => id === FIXED_AUTO_RANK_KEY || (id === FIXED_MANUAL_RANK_KEY && isOwnerAccount()))
        );

        setSelectedProfileRankOrder(
            rawRankIds.filter((value) => {
                const key = normalizeRankOrderKey(value);
                if (!key) return false;
                if (typeof value === 'number' && (validSelectedRankIds.has(value) || specialSelectedProgressionRankIds.has(value))) return true;
                if (typeof value === 'string' && /^\d+$/.test(value)) {
                    const numericValue = Number(value);
                    return validSelectedRankIds.has(numericValue) || specialSelectedProgressionRankIds.has(numericValue);
                }
                if (typeof value === 'string' && validFixedRankKeys.has(value.trim())) return true;
                return false;
            })
        );

        // RE-RENDERIZAR O HISTORICO PARA REFLETIR CHECKBOXES E BADGES DE EXIBICAO
        console.log('[loadCustomRanks] Rendering history with custom ranks...');
        const historyContainer = document.getElementById('ranksHistory');
        if (historyContainer) {
            console.log('[loadCustomRanks] Re-rendering rank history...');
            // Chamar renderRankHistory com currentCustomRanks agora populado
            try {
                console.log('[loadCustomRanks] About to call renderRankHistory()');
                console.log('[loadCustomRanks] currentUser exists?:', Boolean(currentUser));
                console.log('[loadCustomRanks] currentCustomRanks exists?:', Boolean(currentCustomRanks));
                console.log('[loadCustomRanks] selectedProfileRankIds exists?:', Boolean(selectedProfileRankIds));
                renderRankHistory();
                console.log('[loadCustomRanks] Rank history re-rendered');
            } catch (renderErr) {
                console.error('[loadCustomRanks] ERROR in renderRankHistory:', renderErr);
                console.error('[loadCustomRanks] ERROR message:', renderErr.message);
                console.error('[loadCustomRanks] ERROR stack:', renderErr.stack);
                console.error('[DEBUG] currentUser:', currentUser);
                console.error('[DEBUG] currentCustomRanks:', currentCustomRanks);
                throw renderErr;
            }
        }

        // Adicionar event listeners aos checkboxes renderizados
        console.log('[loadCustomRanks] Adding checkbox listeners...');
        addCheckboxEventListeners();
        console.log('[loadCustomRanks] Checkbox event listeners added');
        
        // Chamar loadSelectedRanksDisplay novamente para renderizar a seção de conquistas
        console.log('[loadCustomRanks] Loading selected ranks display...');
        await loadSelectedRanksDisplay();
        console.log('[loadCustomRanks] Selected ranks display loaded');
        
        console.log('[loadCustomRanks] COMPLETE!');
    } catch (err) {
        console.error('[loadCustomRanks] ERROR:', err);
        console.warn('Error loading custom ranks:', err.message);
        currentCustomRanks = [];

        const historyContainer = document.getElementById('ranksHistory');
        if (historyContainer) {
            historyContainer.innerHTML = '<p class="ranks-error-message">Erro ao carregar histórico de conquistas.</p>';
        }
    }
}

function addCheckboxEventListeners() {
    const applyRankCheckboxTheme = (checkbox) => {
        if (!checkbox) return;
        const directColor = String(checkbox.dataset.rankColor || '').trim();
        const cardEl = checkbox.closest('.rank-card');
        const cardVarColor = String(cardEl?.style?.getPropertyValue('--rank-color') || '').trim();
        const borderColor = cardEl ? String(window.getComputedStyle(cardEl).borderColor || '').trim() : '';
        const resolvedColor = directColor || cardVarColor || borderColor || '#EC4899';

        checkbox.style.setProperty('--rank-checkbox-color', resolvedColor);
        checkbox.style.setProperty('border-color', resolvedColor, 'important');
        checkbox.style.setProperty('box-shadow', `0 0 0 1px ${resolvedColor}66, 0 0 8px ${resolvedColor}55`, 'important');
    };

    // Adicionar event listeners aos checkboxes dos conquistas customizáveis
    document.querySelectorAll('.rank-checkbox').forEach(checkbox => {
        // Remover listeners antigos
        checkbox.replaceWith(checkbox.cloneNode(true));
    });
    
    // Readicionar listeners
    document.querySelectorAll('.rank-checkbox').forEach(checkbox => {
        applyRankCheckboxTheme(checkbox);

        checkbox.addEventListener('change', async (e) => {
            const targetCheckbox = e.target;
            const targetKey = normalizeRankOrderKey(targetCheckbox.dataset.rankId);
            if (!targetKey) {
                targetCheckbox.checked = !targetCheckbox.checked;
                showNotification('Identificador de conquista inválido.', 'error');
                return;
            }

            const previouslySelectedKeys = new Set(
                (selectedProfileRankOrder || [])
                    .map(normalizeRankOrderKey)
                    .filter(Boolean)
            );
            const syncCheckboxesForKey = (key, checked) => {
                document.querySelectorAll('.rank-checkbox').forEach((checkboxItem) => {
                    if (normalizeRankOrderKey(checkboxItem.dataset.rankId) !== key) return;
                    checkboxItem.checked = checked;
                    applyRankCheckboxTheme(checkboxItem);
                });
            };
            const restorePreviousSelection = () => {
                document.querySelectorAll('.rank-checkbox').forEach((checkboxItem) => {
                    const key = normalizeRankOrderKey(checkboxItem.dataset.rankId);
                    checkboxItem.checked = previouslySelectedKeys.has(key);
                    applyRankCheckboxTheme(checkboxItem);
                });
            };

            syncCheckboxesForKey(targetKey, targetCheckbox.checked);
            applyRankCheckboxTheme(targetCheckbox);

            const progressionSelectionNames = new Set(['membro beta']);
            const targetRankNameLower = String(e.target.dataset.rankName || '').trim().toLowerCase();
            const targetRankGroup = String(e.target.dataset.rankGroup || '').trim();
            const isTargetBetaProgression = targetRankNameLower === 'membro beta';
            const isTargetProgression = targetRankGroup === 'progression-selector'
                || targetRankGroup === 'progression'
                || progressionSelectionNames.has(targetRankNameLower);

            // Só Membro Beta pode substituir progressão
            if (e.target.checked) {
                if (isTargetBetaProgression) {
                    const conflictingProgressionKeys = new Set();
                    Array.from(document.querySelectorAll('.rank-checkbox:checked')).forEach((cb) => {
                        const key = normalizeRankOrderKey(cb.dataset.rankId);
                        if (!key || key === targetKey) return;
                        const cbNameLower = String(cb.dataset.rankName || '').trim().toLowerCase();
                        const cbGroup = String(cb.dataset.rankGroup || '').trim();
                        const isCbProgression = cbGroup === 'progression-selector'
                            || cbGroup === 'progression'
                            || progressionSelectionNames.has(cbNameLower);
                        if (!isCbProgression) return;
                        conflictingProgressionKeys.add(key);
                    });
                    conflictingProgressionKeys.forEach((key) => syncCheckboxesForKey(key, false));
                    showNotification('Conquista de progressão substituída. Apenas Membro Beta pode substituir a progressão.', 'info');
                } else if (!isTargetProgression) {
                    // Se for personalizada, não desmarcar nenhuma progressão
                    // Nenhuma ação de exclusão mútua com progressão
                }
            }

            const detectGroup = (cb) => {
                let group = String(cb?.dataset?.rankGroup || '').trim();
                if (group) return group;
                const rankId = Number(cb?.dataset?.rankId);
                const rank = (currentCustomRanks || []).find(item => Number(item?.id) === rankId);
                const icon = String(rank?.icon || '').trim().toUpperCase();
                if (/^P\d+/.test(icon)) return 'post_achievement';
                if (/^L\d+/.test(icon)) return 'like_achievement';
                return '';
            };

            // Aplicar exclusão por grupo (Post vs Like) — nunca desmarcar progressão
            const targetGroup = detectGroup(e.target);
            if (e.target.checked && targetGroup && !isTargetProgression) {
                const replacedKeys = new Set();
                Array.from(document.querySelectorAll('.rank-checkbox:checked')).forEach(cb => {
                    const key = normalizeRankOrderKey(cb.dataset.rankId);
                    if (!key || key === targetKey) return;
                    const cbGroup = String(cb.dataset.rankGroup || '').trim();
                    const cbNameLower = String(cb.dataset.rankName || '').trim().toLowerCase();
                    const isCbProgression = cbGroup === 'progression-selector'
                        || cbGroup === 'progression'
                        || progressionSelectionNames.has(cbNameLower);
                    if (isCbProgression) return; // nunca desmarcar progressão
                    if (detectGroup(cb) === targetGroup) {
                        replacedKeys.add(key);
                    }
                });
                replacedKeys.forEach((key) => syncCheckboxesForKey(key, false));
                if (replacedKeys.size > 0) {
                    showNotification('Você pode escolher uma conquista de cada categoria. A anterior foi substituída.', 'success');
                }
            }

            const selectedCheckboxes = Array.from(document.querySelectorAll('.rank-checkbox:checked'));
            const selectedKeys = [...new Set(
                selectedCheckboxes
                    .map((checkboxItem) => normalizeRankOrderKey(checkboxItem.dataset.rankId))
                    .filter(Boolean)
            )];
            
            // Bloquear APENAS quando marcando e excede o limite, permitir desmarcar sempre
            if (e.target.checked && selectedKeys.length > MAX_SELECTED_PROFILE_RANKS) {
                restorePreviousSelection();
                showNotification(`Máximo de ${MAX_SELECTED_PROFILE_RANKS} conquistas selecionadas`, 'error');
                return;
            }
            const payloadToSave = selectedKeys
                .map(rankOrderKeyToPayload)
                .filter((value) => value !== null);
            console.log('[DEBUG-SAVE] Payload to save selected profile ranks:', payloadToSave);
            try {
                const result = await AuthAPI.selectProfileRanks(payloadToSave);
                console.log('[DEBUG-SAVE] API result for selectProfileRanks:', result);
                if (!result?.success) {
                    restorePreviousSelection();
                    showNotification(result?.message || 'Não foi possível salvar as conquistas selecionadas.', 'error');
                    return;
                }

                setSelectedProfileRankOrder(payloadToSave);
                window.currentProfileRenderResult = {
                    ...(window.currentProfileRenderResult || {}),
                    selectedRanks: payloadToSave.map((id) => ({ id }))
                };
                refreshPrimaryRankBadge();
                renderRankHistory();
                addCheckboxEventListeners();
                showNotification('Conquistas selecionadas para exibição!', 'success');
                await loadSelectedRanksDisplay();
                refreshPrimaryRankBadge();
            } catch (error) {
                console.error('Erro ao salvar seleção das conquistas:', error);
                restorePreviousSelection();
                showNotification('Erro ao salvar seleção das conquistas.', 'error');
            }
        });
    });
    
    console.log('Event listeners added to ' + document.querySelectorAll('.rank-checkbox').length + ' checkboxes');
}

function setupSelectedRanksDragAndDrop(display) {
    if (!display) return;

    const badges = Array.from(display.querySelectorAll('.selected-conquista-badge:not([data-profile-progression="display-only"])'));
    if (badges.length === 0) return;

    const clearDropTargets = () => {
        badges.forEach((badge) => badge.classList.remove('rank-drop-target'));
    };

    const canMoveBadge = (badge) => {
        if (!badge) return false;
        const isFixed = badge.dataset.fixed === '1';
        return canOrderFixedRanks || !isFixed;
    };

    const moveBadge = (draggedBadge, targetBadge) => {
        if (!draggedBadge || !targetBadge || draggedBadge === targetBadge) return;
        if (!canMoveBadge(draggedBadge) || !canMoveBadge(targetBadge)) return;

        const ordered = Array.from(display.querySelectorAll('.selected-conquista-badge:not([data-profile-progression="display-only"])'));
        const draggedIndex = ordered.indexOf(draggedBadge);
        const targetIndex = ordered.indexOf(targetBadge);
        if (draggedIndex < 0 || targetIndex < 0) return;

        if (draggedIndex < targetIndex) {
            display.insertBefore(draggedBadge, targetBadge.nextElementSibling);
            return;
        }
        display.insertBefore(draggedBadge, targetBadge);
    };

    let draggedBadge = null;

    badges.forEach((badge) => {
        const movable = isRankOrderMode && canMoveBadge(badge);

        badge.setAttribute('draggable', movable ? 'true' : 'false');
        badge.classList.toggle('rank-order-mode', isRankOrderMode);
        badge.classList.toggle('rank-order-draggable', movable);
        badge.classList.toggle('rank-order-locked', isRankOrderMode && !movable);

        badge.addEventListener('dragstart', (event) => {
            if (!isRankOrderMode || !movable) {
                event.preventDefault();
                return;
            }
            draggedBadge = badge;
            badge.classList.add('dragging');
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', badge.dataset.rankId || '');
            }
        });

        badge.addEventListener('dragover', (event) => {
            if (!isRankOrderMode || !draggedBadge || draggedBadge === badge) return;
            if (!canMoveBadge(draggedBadge) || !canMoveBadge(badge)) return;
            event.preventDefault();
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'move';
            }
            badge.classList.add('rank-drop-target');
        });

        badge.addEventListener('dragleave', () => {
            badge.classList.remove('rank-drop-target');
        });

        badge.addEventListener('drop', (event) => {
            event.preventDefault();
            if (!isRankOrderMode || !draggedBadge || draggedBadge === badge) return;
            moveBadge(draggedBadge, badge);
            clearDropTargets();
        });

        badge.addEventListener('dragend', () => {
            badge.classList.remove('dragging');
            clearDropTargets();
            draggedBadge = null;
        });
    });
}

async function loadSelectedRanksDisplay() {
    try {
        // ===== NOVA VERSÃO SIMPLES E LIMPA =====
        let result;
        try {
            result = await AuthAPI.getSelectedProfileRanks();
        } catch (e) {
            console.error('[loadSelectedRanksDisplay] Error fetching:', e);
            result = { success: false, rankIds: [], ranks: [] };
        }
        const display = document.getElementById('selectedAchievementsDisplay');
        const section = document.getElementById('selectedAchievementsSection');
        
        if (!display || !section) return;

        // Processar rankIds - filtrar apenas números (ignorar chaves fixas como "fixed:manual")
        const rawRankIds = result.success && Array.isArray(result.rankIds)
            ? result.rankIds
            : [];

        const selectedKeysOrdered = rawRankIds
            .map((id) => normalizeRankOrderKey(id))
            .filter((key) => Boolean(key));
            
        canOrderFixedRanks = Boolean(result?.canOrderFixedRanks || canOrderFixedRanks);
        const fetchedRanks = result.success && Array.isArray(result.ranks) ? result.ranks : [];
        const normalizedFetchedRanks = fetchedRanks.map((rank) => {
            if (Number(rank?.id) === 632) {
                return {
                    ...rank,
                    name: 'Membro Ativo',
                    description: 'Sua conta foi verificada'
                };
            }
            return rank;
        });
        const mergedFetchedRanks = [...normalizedFetchedRanks];

        const selectedRankIdSet = new Set(
            rawRankIds
                .map((value) => rankOrderKeyToPayload(normalizeRankOrderKey(value)))
                .filter((value) => Number.isFinite(Number(value)))
                .map((value) => Number(value))
        );

        const hasBetaProgressionOverrideSelected = normalizedFetchedRanks.some((rank) => {
            const rankId = Number(rank?.id);
            if (!Number.isFinite(rankId)) return false;

            const rankNameLower = String(rank?.name || '').trim().toLowerCase();
            return rankNameLower === 'membro beta' && selectedRankIdSet.has(rankId);
        });

        const filteredSelectedRanks = mergedFetchedRanks.filter((rank) => {
            if (!rank || !rank.name) return false;
            const rankId = String(rank?.id || '').trim();

            if (rankId === FIXED_AUTO_RANK_KEY) {
                if (hasBetaProgressionOverrideSelected) {
                    console.log('[loadSelectedRanksDisplay] Removendo fixed:auto porque Membro Beta está selecionado para substituir a progressão.');
                    return false;
                }
                return true;
            }

            return true;
        });

        const validSelectedKeys = new Set(
            filteredSelectedRanks
                .map((rank) => normalizeRankOrderKey(rank?.id))
                .filter(Boolean)
        );
        const selectedKeysForOrder = [...new Set([
            ...rawRankIds.map((value) => normalizeRankOrderKey(value)).filter(Boolean),
            ...selectedKeysOrdered
        ])];

        setSelectedProfileRankOrder(
            selectedKeysForOrder.filter((key) => validSelectedKeys.has(key))
        );

        const rankById = new Map(
            filteredSelectedRanks
                .map((rank) => [normalizeRankOrderKey(rank?.id), rank])
                .filter(([key]) => Boolean(key))
        );
        
        // Remover duplicatas pela ordem preservada e incluir também chaves fixas
        let seenIds = new Set();
        let orderedSelectedRanks = selectedKeysOrdered
            .map((key) => rankById.get(key))
            .filter(rank => {
                if (!rank || seenIds.has(rank.id)) return false;
                seenIds.add(rank.id);
                return true;
            });

        const hasSelectedCustomRanks = filteredSelectedRanks.some(rank => {
            const rankId = String(rank?.id || '').trim();
            if (!rankId) return false;
            if (rankId === FIXED_AUTO_RANK_KEY) return false;
            return true;
        });

        const hasAnyExplicitSelectedRanks = selectedKeysOrdered.some((key) => {
            return key !== normalizeRankOrderKey(FIXED_AUTO_RANK_KEY);
        });

        const shouldHideFixedAutoProgression = hasBetaProgressionOverrideSelected;

        if (shouldHideFixedAutoProgression) {
            orderedSelectedRanks = orderedSelectedRanks.filter(rank => String(rank?.id || '').trim() !== FIXED_AUTO_RANK_KEY);
            console.log('[loadSelectedRanksDisplay] Removendo fixed:auto porque Membro Beta está selecionado para substituir a progressão.');
            if (selectedProfileRankOrder.some(value => normalizeRankOrderKey(value) === normalizeRankOrderKey(FIXED_AUTO_RANK_KEY))) {
                const cleanedOrder = selectedProfileRankOrder.filter(value => normalizeRankOrderKey(value) !== normalizeRankOrderKey(FIXED_AUTO_RANK_KEY));
                setSelectedProfileRankOrder(cleanedOrder);
                console.log('[loadSelectedRanksDisplay] Atualizando selectedProfileRankOrder para remover fixed:auto.');
            }
        }

        const hasAnySelectedRanks = orderedSelectedRanks.length > 0 || hasAnyExplicitSelectedRanks;

        if (!hasAnySelectedRanks) {
            console.log('[loadSelectedRanksDisplay] Nenhuma conquista explícita selecionada; não será injetada progressão automática na exibição.');
        }

        try {
            const currentEloName = String(window.currentUserEloName || '').trim().toLowerCase();
            const hasCurrentElo = orderedSelectedRanks.some(r => String(r?.name || '').trim().toLowerCase() === currentEloName);
            const ALLOWED_AUTO_ELO_DISPLAY = new Set([
                'membro beta', 'membro inicial', 'membro novato', 'membro iniciado',
                'membro aprendiz', 'membro experiente', 'membro adepto', 'membro especialista',
                'membro mestre', 'grande mestre', 'membro lendário', 'membro mítico',
                'membro transcendente', 'membro eterno', 'membro imortal'
            ]);

            if (currentEloName && !hasCurrentElo && ALLOWED_AUTO_ELO_DISPLAY.has(currentEloName)) {
                console.log('[loadSelectedRanksDisplay] Elo automático de progressão não injetado na seção de Minhas Conquistas:', currentEloName);
            }
        } catch (err) {
            console.warn('Erro ao garantir elo atual na exibição:', err);
        }

        const betaIsSelectedInStrip = orderedSelectedRanks.some((rank) =>
            normalizeAchievementNameKey(rank?.name || '') === normalizeAchievementNameKey('Membro Beta')
        );
        const profileResult = window.currentProfileRenderResult || {};
        const currentProgressionRank = !hasBetaProgressionOverrideSelected
            ? profileResult?.rankComplete?.automatic
                || profileResult?.rankComplete?.automaticCompleted
                || (profileResult?.rank?.isCustom !== true ? profileResult?.rank : null)
            : null;
        const currentProgressionName = String(currentProgressionRank?.name || '').trim();
        const currentProgressionNameKey = normalizeAchievementNameKey(currentProgressionName);
        const progressionAlreadySelected = Boolean(currentProgressionNameKey)
            && orderedSelectedRanks.some((rank) =>
                normalizeAchievementNameKey(rank?.name || '') === currentProgressionNameKey
            );
        const progressionRankForStrip = currentProgressionName
            && currentProgressionNameKey !== normalizeAchievementNameKey('Membro Beta')
            && !progressionAlreadySelected
            ? currentProgressionRank
            : null;
        const progressionRankCanBeOrdered = Boolean(
            canOrderFixedRanks
            && progressionRankForStrip
            && orderedSelectedRanks.length > 0
        );
        const displayedRanksCount = orderedSelectedRanks.length + Number(Boolean(progressionRankForStrip));
        const movableRanksCount = orderedSelectedRanks.filter((rank) => canOrderFixedRanks || !isFixedRankEntry(rank)).length;
        // CORREÇÃO: Verificar permissão + ter pelo menos 2 conquistas
        const shouldShowOrderButton = canOrderFixedRanks
            && movableRanksCount + Number(progressionRankCanBeOrdered) >= 2;

        if (!shouldShowOrderButton && isRankOrderMode) {
            isRankOrderMode = false;
        }

        console.log('loadSelectedRanksDisplay:', {
            selectedRanks: fetchedRanks.length,
            selectedRanksNames: fetchedRanks.map(r => r.name),
            displayedRanksCount,
            movableRanksCount,
            hasPermission: canOrderFixedRanks,
            shouldShowButton: shouldShowOrderButton,
            finalRanksToDisplay: orderedSelectedRanks.map(r => ({ id: r.id, name: r.name }))
        });

        // Sempre mostrar a seção, mesmo se não houver conquistas selecionadas
        section.style.display = 'flex';
        if (orderedSelectedRanks.length > 0 || progressionRankForStrip) {
            // Exibir label "Minhas conquistas" ao lado dos badges
            const achievementsLabel = document.getElementById('achievementsLabel');
            if (achievementsLabel) {
                achievementsLabel.style.display = 'inline-block';
            }
            if (orderBtn) {
                orderBtn.style.display = shouldShowOrderButton ? 'inline-flex' : 'none';
                orderBtn.textContent = isRankOrderMode ? 'Salvar ordem' : 'Organizar';
                orderBtn.setAttribute('data-tooltip', isRankOrderMode
                    ? 'Salvar nova ordem das conquistas'
                    : 'Organizar conquistas - arraste para reordenar');
                orderBtn.classList.toggle('is-active', isRankOrderMode);
                orderBtn.onclick = async () => {
                    if (!isRankOrderMode) {
                        isRankOrderMode = true;
                        await loadSelectedRanksDisplay();
                        showNotification('Modo organização ativado. Arraste suas conquistas e clique em Salvar ordem.', 'success');
                        return;
                    }

                    const payloadOrder = getDisplayedRankOrderPayload();
                    const saveResult = await AuthAPI.selectProfileRanks(payloadOrder);
                    if (!saveResult?.success) {
                        showNotification(saveResult?.message || 'Erro ao salvar ordem das conquistas', 'error');
                        return;
                    }

                    isRankOrderMode = false;
                    showNotification('Ordem das conquistas salva com sucesso!', 'success');
                    await loadSelectedRanksDisplay();
                };
            }

            const showOrderMode = Boolean(isRankOrderMode && shouldShowOrderButton);
            if (orderHint) {
                orderHint.style.display = showOrderMode ? 'block' : 'none';
            }
            if (orderTag) {
                orderTag.style.display = showOrderMode ? 'inline-flex' : 'none';
            }
            if (rankDisplay) {
                rankDisplay.classList.toggle('rank-order-active', showOrderMode);
            }

        const fixedIds = new Set(
            orderedSelectedRanks
                .filter((rank) => isFixedRankEntry(rank))
                .map((rank) => getRankOrderKeyFromRank(rank))
                .filter(Boolean)
        );
            const html = orderedSelectedRanks.map(rank => {
                const rankKey = getRankOrderKeyFromRank(rank);
                if (!rankKey) return '';
                const rankId = String(rank?.id ?? '');
                if (!rankId || !rank?.name) return '';  // Evitar badges vazios
                const rankName = String(rank.name || '').trim();
                if (!rankName) return '';  // Evitar badge sem nome
                const isFixed = fixedIds.has(rankKey);
                const canMove = canOrderFixedRanks || !isFixed;
                const showDragHandle = isRankOrderMode && shouldShowOrderButton && canMove;
                const lockTitle = isRankOrderMode && !canMove ? 'Conquista fixa não pode ser movida' : '';
                const tooltipText = lockTitle || resolveRankBadgeTooltip(rank);
                const isCurrentProgressionBadge = currentProgressionNameKey
                    && normalizeAchievementNameKey(rankName) === currentProgressionNameKey;
                const safeColor = String(
                    (isCurrentProgressionBadge
                        ? currentProgressionNameKey === normalizeAchievementNameKey('Membro Inicial')
                            ? '#8B5CF6'
                            : currentProgressionRank?.color
                        : rank?.color)
                    || '#EC4899'
                ).trim() || '#EC4899';
                const currentProgressionTooltip = isCurrentProgressionBadge
                    ? resolveRankBadgeTooltip({
                        ...currentProgressionRank,
                        name: currentProgressionName,
                        description: currentProgressionRank?.description
                            || (currentProgressionNameKey === normalizeAchievementNameKey('Membro Inicial')
                                ? 'Bem-vindo à Guild Holiday'
                                : '')
                    })
                    : '';
                const badgeTooltipText = currentProgressionTooltip || tooltipText;
                const tooltipClass = badgeTooltipText ? ' tooltip-theme' : '';
                const tooltipAttr = badgeTooltipText
                    ? ` data-tooltip="${escapeHtmlAttributeValue(badgeTooltipText)}"`
                    : '';

                return `
                <div class="selected-conquista-badge${tooltipClass}" data-rank-id="${rankId}" data-fixed="${isFixed ? '1' : '0'}"${tooltipAttr} style="
                    border-color: ${safeColor};
                    color: ${safeColor};
                    background-color: ${safeColor}33;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <span>${rankName}</span>
                    ${showDragHandle ? '<span class="rank-drag-handle" aria-hidden="true">::</span>' : ''}
                </div>
            `;
            }).filter(Boolean).join('');

            let progressionBadgeHtml = '';
            if (progressionRankForStrip) {
                const progressionColor = currentProgressionNameKey === normalizeAchievementNameKey('Membro Inicial')
                    ? '#8B5CF6'
                    : /^#[0-9a-f]{6}$/i.test(String(progressionRankForStrip.color || ''))
                    ? String(progressionRankForStrip.color)
                    : '#8B5CF6';
                const progressionTooltip = resolveRankBadgeTooltip({
                    ...progressionRankForStrip,
                    name: currentProgressionName,
                    description: progressionRankForStrip.description
                        || (currentProgressionNameKey === normalizeAchievementNameKey('Membro Inicial')
                            ? 'Bem-vindo à Guild Holiday'
                            : '')
                });
                const progressionTooltipAttr = progressionTooltip
                    ? ` data-tooltip="${escapeHtmlAttributeValue(progressionTooltip)}"`
                    : '';
                const progressionRankId = progressionRankCanBeOrdered ? FIXED_AUTO_RANK_KEY : '';
                const progressionIsFixed = progressionRankCanBeOrdered ? '1' : '0';
                const progressionDragHandle = isRankOrderMode && shouldShowOrderButton && progressionRankCanBeOrdered
                    ? '<span class="rank-drag-handle" aria-hidden="true">::</span>'
                    : '';
                progressionBadgeHtml = `
                    <div class="selected-conquista-badge${progressionTooltip ? ' tooltip-theme' : ''}" data-profile-progression="${progressionRankCanBeOrdered ? 'orderable' : 'display-only'}" data-rank-id="${progressionRankId}" data-fixed="${progressionIsFixed}"${progressionTooltipAttr} style="
                        border-color: ${progressionColor};
                        color: ${progressionColor};
                        background-color: ${progressionColor}33;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                    ">
                        <span>${escapeHtml(currentProgressionName)}</span>
                        ${progressionDragHandle}
                    </div>
                `;
            }

            display.innerHTML = progressionBadgeHtml + html;
            if (!html.trim() && !progressionBadgeHtml.trim()) {
                display.innerHTML = '';
                section.style.display = 'none';
                const achievementsLabel = document.getElementById('achievementsLabel');
                if (achievementsLabel) {
                    achievementsLabel.style.display = 'none';
                }
                if (orderBtn) {
                    orderBtn.style.display = 'none';
                    orderBtn.classList.remove('is-active');
                }
                if (orderHint) {
                    orderHint.style.display = 'none';
                }
                if (orderTag) {
                    orderTag.style.display = 'none';
                }
                if (rankDisplay) {
                    rankDisplay.classList.remove('rank-order-active');
                }
                syncUnifiedRankStripMode(false);
                console.log('[loadSelectedRanksDisplay] Nenhum rank válido para exibir após renderização; seção ocultada');
                return;
            }

            const hasFixedInUnifiedStrip = canOrderFixedRanks
                && (orderedSelectedRanks.some((rank) => isFixedRankEntry(rank)) || progressionRankCanBeOrdered);
            syncUnifiedRankStripMode(Boolean(hasFixedInUnifiedStrip || progressionBadgeHtml || betaIsSelectedInStrip));
            setupSelectedRanksDragAndDrop(display);
            
            // Renderizar também a seção de TODAS as conquistas conquistadas (mesmo as não selecionadas)
            const allAchievementsSection = document.getElementById('allAchievementsSection');
            const allAchievementsDisplay = document.getElementById('allAchievementsDisplay');
            
            if (allAchievementsSection && allAchievementsDisplay && currentCustomRanks && currentCustomRanks.length > 0) {
                // currentCustomRanks contém TODAS as conquistas conquistadas pelo usuário.
                // Quando Membro Beta substitui a progressão atual, não devemos mostrar
                // a antiga progressão automática (ex.: Membro Novato) fora da área selecionada.
                const AUTO_PROGRESSION_NAMES = new Set([
                    'membro iniciado', 'membro novato', 'membro aprendiz', 'membro experiente',
                    'membro adepto', 'membro especialista', 'membro mestre', 'grande mestre',
                    'membro lendário', 'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal'
                ]);
                const allRanksToRender = currentCustomRanks
                    .filter(rank => rank && rank.name && String(rank.name || '').trim())
                    .filter(rank => {
                        if (!hasBetaProgressionOverrideSelected) return true;
                        const rankNameLower = String(rank?.name || '').trim().toLowerCase();
                        return rankNameLower === 'membro beta' || !AUTO_PROGRESSION_NAMES.has(rankNameLower);
                    });

                const allRanksHtml = allRanksToRender
                    .map(rank => {
                    const rankId = String(rank?.id ?? '');
                    const safeColor = String(rank?.color || '#22C55E').trim() || '#22C55E';
                    const rankName = String(rank.name || '').trim();
                    const isSelected = isRankSelectedForDisplay(rank);
                    
                    if (!rankId || !rankName) return '';  // Evitar badge sem ID ou nome
                    
                    return `
                    <div class="selected-conquista-badge" data-rank-id="${rankId}" style="
                        border-color: ${safeColor};
                        color: ${safeColor};
                        background-color: ${safeColor}33;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        ${isSelected ? 'opacity: 1;' : 'opacity: 0.7;'}
                    ">
                        <span>${rankName}</span>
                    </div>
                `;
                }).filter(Boolean).join('');
                
                if (allRanksHtml.trim()) {
                    allAchievementsDisplay.innerHTML = allRanksHtml;
                    allAchievementsSection.style.display = 'flex';
                } else {
                    allAchievementsSection.style.display = 'none';
                }
            } else if (allAchievementsSection) {
                allAchievementsSection.style.display = 'none';
            }
        } else {
            syncUnifiedRankStripMode(false);
            display.innerHTML = '';
            section.style.display = 'none';
            
            // Esconder seção de todas as conquistas também
            const allAchievementsSection = document.getElementById('allAchievementsSection');
            if (allAchievementsSection) {
                allAchievementsSection.style.display = 'none';
            }
            
            // Esconder label "Minhas conquistas" se não houver conquistas
            const achievementsLabel = document.getElementById('achievementsLabel');
            if (achievementsLabel) {
                achievementsLabel.style.display = 'none';
            }
            if (orderBtn) {
                orderBtn.style.display = 'none';
                orderBtn.classList.remove('is-active');
            }
            if (orderHint) {
                orderHint.style.display = 'none';
            }
            if (orderTag) {
                orderTag.style.display = 'none';
            }
            if (rankDisplay) {
                rankDisplay.classList.remove('rank-order-active');
            }
            console.log('No selected or mandatory ranks to display, but label remains visible');
        }
    } catch (err) {
        console.error('[loadSelectedRanksDisplay NOVO] Erro:', err);
    }
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
}

function normalizeBrokenUtf8Text(value) {
    let text = String(value ?? '');
    if (!text) return '';

    const hasMojibake = /[\u00c3\u00c2\uFFFD]/.test(text);
    if (hasMojibake) {
        try {
            const decoded = decodeURIComponent(escape(text));
            if (decoded && decoded !== text) {
                text = decoded;
            }
        } catch {
            // fallback abaixo cobre casos comuns sem quebrar render
        }
    }

    return text
        .replace(/\u00c2/g, '')
        .replace(/\u00c3\u00a1/g, '\u00e1')
        .replace(/\u00c3\u00a0/g, '\u00e0')
        .replace(/\u00c3\u00a2/g, '\u00e2')
        .replace(/\u00c3\u00a3/g, '\u00e3')
        .replace(/\u00c3\u00a9/g, '\u00e9')
        .replace(/\u00c3\u00aa/g, '\u00ea')
        .replace(/\u00c3\u00ad/g, '\u00ed')
        .replace(/\u00c3\u00b3/g, '\u00f3')
        .replace(/\u00c3\u00b4/g, '\u00f4')
        .replace(/\u00c3\u00b5/g, '\u00f5')
        .replace(/\u00c3\u00ba/g, '\u00fa')
        .replace(/\u00c3\u00a7/g, '\u00e7')
        .replace(/\u00c3\u0081/g, '\u00c1')
        .replace(/\u00c3\u0080/g, '\u00c0')
        .replace(/\u00c3\u0082/g, '\u00c2')
        .replace(/\u00c3\u0083/g, '\u00c3')
        .replace(/\u00c3\u0089/g, '\u00c9')
        .replace(/\u00c3\u008a/g, '\u00ca')
        .replace(/\u00c3\u008d/g, '\u00cd')
        .replace(/\u00c3\u0093/g, '\u00d3')
        .replace(/\u00c3\u0094/g, '\u00d4')
        .replace(/\u00c3\u0095/g, '\u00d5')
        .replace(/\u00c3\u009a/g, '\u00da')
        .replace(/\u00c3\u0087/g, '\u00c7');
}

function resolveRankBadgeTooltip(rank) {
    const description = normalizeBrokenUtf8Text(rank?.description || '').trim();
    if (description) return description;

    const customText = normalizeBrokenUtf8Text(rank?.customText || '').trim();
    if (customText) return customText;

    const rankName = String(rank?.name || '').trim().toLowerCase();
    switch (rankName) {
        case 'membro inicial':
            return 'Conquista inicial da sua conta na HOLIDAY Guild.';
        case 'membro beta':
            return 'Conquista especial para membros beta.';
        case 'membro novato':
            return 'Você está se adaptando à comunidade.';
        case 'membro iniciado':
            return 'Iniciado nos mistérios da guild.';
        case 'membro aprendiz':
            return 'Aprendiz dedicado.';
        case 'membro experiente':
            return 'Novato em ascensão.';
        case 'membro adepto':
            return 'Mestre em aprendizado.';
        case 'membro especialista':
            return 'Especialista da guild.';
        case 'membro mestre':
            return 'Mestre guerreiro.';
        case 'grande mestre':
            return 'Grande Mestre da guild.';
        case 'membro lendário':
            return 'Lendário entre os seus.';
        case 'membro mítico':
            return 'Ser mítico da comunidade.';
        case 'membro transcendente':
            return 'Transcendente em poder.';
        case 'membro eterno':
            return 'Membro eterno da guild.';
        case 'membro imortal':
            return 'Imortal, símbolo vivo da HOLIDAY Guild.';
        default:
            return '';
    }
}

function configureRankPerformanceMode(container) {
    if (!container) return false;

    const cardCount = container.querySelectorAll('.rank-card.achievement-card-fx').length;
    const reducedMotion = (() => {
        try {
            return Boolean(window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
        } catch {
            return false;
        }
    })();

    const lowMemoryDevice = Number.isFinite(Number(navigator?.deviceMemory))
        ? Number(navigator.deviceMemory) <= 4
        : false;
    const lowCpuDevice = Number.isFinite(Number(navigator?.hardwareConcurrency))
        ? Number(navigator.hardwareConcurrency) <= 4
        : false;

    const useLiteMode = reducedMotion || lowMemoryDevice || lowCpuDevice || cardCount >= 60;
    container.classList.toggle('ranks-performance-lite', useLiteMode);
    container.setAttribute('data-rank-card-count', String(cardCount));

    return useLiteMode;
}

function bindAchievementCardFx(rootElement = document) {
    const root = rootElement || document;
    const cards = Array.from(root.querySelectorAll('.achievement-card-fx'));
    if (!cards.length) return;

    cards.forEach((card) => {
        const cardAnimationMode = normalizeAchievementCardAnimationMode(card.dataset.rankAnimationMode || 'hover');
        card.dataset.rankAnimationMode = cardAnimationMode;
        card.classList.remove('fx-active');
        card.classList.add('fx-lite');
        card.style.removeProperty('--fx-mx');
        card.style.removeProperty('--fx-my');
        card.style.removeProperty('--fx-rx');
        card.style.removeProperty('--fx-ry');
        card.style.removeProperty('--fx-glow');

        if (cardAnimationMode === 'hover' && String(card.dataset.rankHoverGif || '') === '1') {
            void applyHoverGifStaticPreview(card);
        }
    });
}

function setAvatarAdjustError(message = '') {
    const errorEl = document.getElementById('avatarAdjustError');
    if (errorEl) {
        errorEl.textContent = String(message || '').trim();
    }
}

function clearAvatarAdjustObjectUrl() {
    if (avatarAdjustState.objectUrl) {
        URL.revokeObjectURL(avatarAdjustState.objectUrl);
        avatarAdjustState.objectUrl = '';
    }
}

function resetAvatarAdjustState() {
    avatarAdjustState.file = null;
    avatarAdjustState.inputEl = null;
    avatarAdjustState.naturalWidth = 1;
    avatarAdjustState.naturalHeight = 1;
    avatarAdjustState.scale = AVATAR_DEFAULT_SETTINGS.scale;
    avatarAdjustState.offsetX = AVATAR_DEFAULT_SETTINGS.offsetX;
    avatarAdjustState.offsetY = AVATAR_DEFAULT_SETTINGS.offsetY;
    avatarAdjustState.isDragging = false;
    avatarAdjustState.dragStartX = 0;
    avatarAdjustState.dragStartY = 0;
    avatarAdjustState.dragStartOffsetX = AVATAR_DEFAULT_SETTINGS.offsetX;
    avatarAdjustState.dragStartOffsetY = AVATAR_DEFAULT_SETTINGS.offsetY;
    avatarAdjustState.uploading = false;
}

function syncAvatarAdjustPreview() {
    const previewImage = document.getElementById('avatarAdjustPreviewImage');
    const zoomInput = document.getElementById('avatarAdjustZoom');
    const zoomValue = document.getElementById('avatarAdjustZoomValue');
    if (!previewImage) return;

    const clampedOffsets = clampAvatarOffsetsByImage(
        avatarAdjustState.offsetX,
        avatarAdjustState.offsetY,
        avatarAdjustState.naturalWidth,
        avatarAdjustState.naturalHeight,
        avatarAdjustState.scale
    );
    avatarAdjustState.offsetX = clampedOffsets.offsetX;
    avatarAdjustState.offsetY = clampedOffsets.offsetY;

    applyAvatarTransformToImage(previewImage, {
        scale: avatarAdjustState.scale,
        offsetX: avatarAdjustState.offsetX,
        offsetY: avatarAdjustState.offsetY
    });

    if (zoomInput) {
        zoomInput.value = String(normalizeAvatarScale(avatarAdjustState.scale));
    }
    if (zoomValue) {
        zoomValue.textContent = `${Math.round(normalizeAvatarScale(avatarAdjustState.scale) * 100)}%`;
    }
}

function hideAvatarAdjustPreviewImage(previewImage) {
    if (!previewImage) return;
    previewImage.onload = null;
    previewImage.onerror = null;
    previewImage.style.display = 'none';
    previewImage.removeAttribute('src');
    avatarAdjustState.naturalWidth = 1;
    avatarAdjustState.naturalHeight = 1;
}

function setAvatarAdjustPreviewSource(previewImage, src, onErrorMessage = '') {
    if (!previewImage || !src) {
        hideAvatarAdjustPreviewImage(previewImage);
        return;
    }

    previewImage.style.display = 'none';
    previewImage.onload = () => {
        avatarAdjustState.naturalWidth = Math.max(1, Number(previewImage.naturalWidth) || 1);
        avatarAdjustState.naturalHeight = Math.max(1, Number(previewImage.naturalHeight) || 1);
        previewImage.style.display = 'block';
        syncAvatarAdjustPreview();
    };
    previewImage.onerror = () => {
        hideAvatarAdjustPreviewImage(previewImage);
        syncAvatarAdjustPreview();
        if (onErrorMessage) {
            setAvatarAdjustError(onErrorMessage);
        }
    };
    previewImage.src = src;
}

function closeAvatarAdjustModal() {
    const modal = document.getElementById('avatarAdjustModal');
    const preview = document.getElementById('avatarAdjustPreview');
    const previewImage = document.getElementById('avatarAdjustPreviewImage');
    const applyBtn = document.getElementById('avatarAdjustApplyBtn');
    const zoomInput = document.getElementById('avatarAdjustZoom');

    if (modal) {
        modal.style.display = 'none';
    }
    if (preview) {
        preview.classList.remove('dragging');
        preview.classList.remove('drop-over');
    }
    if (previewImage) {
        hideAvatarAdjustPreviewImage(previewImage);
    }
    if (zoomInput) {
        zoomInput.value = String(AVATAR_DEFAULT_SETTINGS.scale);
    }
    if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Aplicar';
    }

    if (avatarAdjustState.inputEl) {
        avatarAdjustState.inputEl.value = '';
    }

    setAvatarAdjustError('');
    clearAvatarAdjustObjectUrl();
    resetAvatarAdjustState();
}

function openAvatarAdjustModal(file, sourceInputEl) {
    const modal = document.getElementById('avatarAdjustModal');
    const previewImage = document.getElementById('avatarAdjustPreviewImage');
    const zoomInput = document.getElementById('avatarAdjustZoom');
    if (!modal || !previewImage || !zoomInput) return false;

    clearAvatarAdjustObjectUrl();
    resetAvatarAdjustState();

    avatarAdjustState.file = file;
    avatarAdjustState.inputEl = sourceInputEl || null;
    avatarAdjustState.objectUrl = URL.createObjectURL(file);

    const userSettings = getCurrentUserAvatarSettings();
    avatarAdjustState.scale = userSettings.scale;
    avatarAdjustState.offsetX = userSettings.offsetX;
    avatarAdjustState.offsetY = userSettings.offsetY;

    zoomInput.value = String(avatarAdjustState.scale);
    setAvatarAdjustPreviewSource(previewImage, avatarAdjustState.objectUrl, 'Não foi possível carregar a imagem selecionada.');

    setAvatarAdjustError('');
    modal.style.display = 'block';
    return true;
}

function openAvatarAdjustModalFromCurrentAvatar() {
    const modal = document.getElementById('avatarAdjustModal');
    const previewImage = document.getElementById('avatarAdjustPreviewImage');
    const zoomInput = document.getElementById('avatarAdjustZoom');
    const resolvedAvatarUrl = currentUser?.avatar ? resolveMediaUrl(currentUser.avatar) : '';
    if (!modal || !previewImage || !zoomInput || !resolvedAvatarUrl) return false;

    clearAvatarAdjustObjectUrl();
    resetAvatarAdjustState();

    const userSettings = getCurrentUserAvatarSettings();
    avatarAdjustState.file = null;
    avatarAdjustState.inputEl = null;
    avatarAdjustState.scale = userSettings.scale;
    avatarAdjustState.offsetX = userSettings.offsetX;
    avatarAdjustState.offsetY = userSettings.offsetY;

    zoomInput.value = String(avatarAdjustState.scale);
    setAvatarAdjustPreviewSource(previewImage, withCacheBuster(resolvedAvatarUrl), 'Não foi possível carregar o avatar atual.');

    setAvatarAdjustError('');
    modal.style.display = 'block';
    return true;
}

function openAvatarAdjustModalWithoutFile() {
    const modal = document.getElementById('avatarAdjustModal');
    const previewImage = document.getElementById('avatarAdjustPreviewImage');
    const zoomInput = document.getElementById('avatarAdjustZoom');
    if (!modal || !previewImage || !zoomInput) return false;

    clearAvatarAdjustObjectUrl();
    resetAvatarAdjustState();

    avatarAdjustState.file = null;
    avatarAdjustState.inputEl = null;
    avatarAdjustState.scale = AVATAR_DEFAULT_SETTINGS.scale;
    avatarAdjustState.offsetX = AVATAR_DEFAULT_SETTINGS.offsetX;
    avatarAdjustState.offsetY = AVATAR_DEFAULT_SETTINGS.offsetY;
    syncAvatarAdjustPreview();

    hideAvatarAdjustPreviewImage(previewImage);
    zoomInput.value = String(avatarAdjustState.scale);

    setAvatarAdjustError('');
    modal.style.display = 'block';
    return true;
}

function handleAvatarUploadTriggerClick(event) {
    if (event) {
        event.preventDefault();
    }

    const hasCurrentAvatar = Boolean(String(currentUser?.avatar || '').trim());
    if (hasCurrentAvatar) {
        const opened = openAvatarAdjustModalFromCurrentAvatar();
        if (!opened) {
            showNotification('Erro ao abrir editor do avatar.', 'error');
        }
        return;
    }

    const opened = openAvatarAdjustModalWithoutFile();
    if (!opened) {
        showNotification('Erro ao abrir editor do avatar.', 'error');
    }
}

function getAvatarFileValidationError(file) {
    if (!file) {
        return 'Selecione uma imagem para continuar.';
    }

    const mimeType = String(file.type || '').toLowerCase();
    if (!AVATAR_ALLOWED_MIME_TYPES.has(mimeType)) {
        return 'Avatar: envie PNG, JPG, WEBP ou GIF.';
    }

    if (file.size > AVATAR_MAX_FILE_BYTES) {
        return 'Avatar muito grande. Limite de 15MB.';
    }

    return '';
}

function isFileDragEvent(event) {
    const transferTypes = Array.from(event?.dataTransfer?.types || []);
    return transferTypes.includes('Files');
}

function getFirstFileFromDataTransfer(dataTransfer) {
    if (!dataTransfer) return null;

    const fileList = dataTransfer.files;
    if (fileList && fileList.length > 0) {
        return fileList[0];
    }

    const itemList = dataTransfer.items;
    if (!itemList || itemList.length === 0) return null;
    for (const item of itemList) {
        if (item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (file) return file;
    }

    return null;
}

function handleAvatarAdjustDroppedFile(file) {
    const validationError = getAvatarFileValidationError(file);
    if (validationError) {
        setAvatarAdjustError(validationError);
        showNotification(validationError, 'error');
        return false;
    }

    const opened = openAvatarAdjustModal(file, null);
    if (!opened) {
        const message = 'Erro ao abrir editor do avatar.';
        setAvatarAdjustError(message);
        showNotification(message, 'error');
        return false;
    }

    return true;
}

function triggerAvatarFileBrowserFromAdjustModal() {
    if (avatarAdjustState.uploading) return;
    const avatarInput = document.getElementById('avatarInput');
    if (!avatarInput) {
        setAvatarAdjustError('Não foi possível abrir o seletor de arquivo.');
        return;
    }

    // Limpa o valor para disparar change até quando escolher o mesmo arquivo.
    avatarInput.value = '';
    avatarInput.click();
}

async function submitAvatarWithAdjustments() {
    if (avatarAdjustState.uploading) return;
    const hasSelectedFile = Boolean(avatarAdjustState.file);
    const hasCurrentAvatar = Boolean(currentUser?.avatar);
    if (!hasSelectedFile && !hasCurrentAvatar) {
        setAvatarAdjustError('Selecione uma imagem para continuar.');
        return;
    }

    const applyBtn = document.getElementById('avatarAdjustApplyBtn');
    avatarAdjustState.uploading = true;
    setAvatarAdjustError('');

    if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.textContent = 'Enviando...';
    }

    try {
        const formData = new FormData();
        if (hasSelectedFile) {
            formData.append('avatar', avatarAdjustState.file);
        }
        formData.append('avatarScale', String(normalizeAvatarScale(avatarAdjustState.scale)));
        formData.append('avatarOffsetX', String(normalizeAvatarOffset(avatarAdjustState.offsetX, AVATAR_DEFAULT_SETTINGS.offsetX)));
        formData.append('avatarOffsetY', String(normalizeAvatarOffset(avatarAdjustState.offsetY, AVATAR_DEFAULT_SETTINGS.offsetY)));

        const result = await AuthAPI.updateProfile(formData);
        if (!result?.success) {
            const message = result?.message || 'Erro ao atualizar avatar.';
            setAvatarAdjustError(message);
            showNotification(message, 'error');
            return;
        }

        currentUser.avatar = result.user?.avatar || currentUser.avatar;
        currentUser.avatarScale = result.user?.avatarScale ?? normalizeAvatarScale(avatarAdjustState.scale);
        currentUser.avatarOffsetX = result.user?.avatarOffsetX ?? normalizeAvatarOffset(avatarAdjustState.offsetX, AVATAR_DEFAULT_SETTINGS.offsetX);
        currentUser.avatarOffsetY = result.user?.avatarOffsetY ?? normalizeAvatarOffset(avatarAdjustState.offsetY, AVATAR_DEFAULT_SETTINGS.offsetY);

        applyCurrentUserAvatarVisual({ withCacheBuster: true });
        showNotification('Avatar atualizado com sucesso! (GIF/PNG/JPG/WEBP)', 'success');
        closeAvatarAdjustModal();
    } catch (error) {
        console.error('Erro ao enviar avatar ajustado:', error);
        setAvatarAdjustError('Erro ao enviar avatar. Tente novamente.');
        showNotification('Erro ao fazer upload do avatar', 'error');
    } finally {
        avatarAdjustState.uploading = false;
        if (applyBtn) {
            applyBtn.disabled = false;
            applyBtn.textContent = 'Aplicar';
        }
    }
}

function setBannerAdjustError(message = '') {
    const errorEl = document.getElementById('bannerAdjustError');
    if (errorEl) {
        errorEl.textContent = String(message || '').trim();
    }
}

function clearBannerAdjustObjectUrl() {
    if (bannerAdjustState.objectUrl) {
        URL.revokeObjectURL(bannerAdjustState.objectUrl);
        bannerAdjustState.objectUrl = '';
    }
}

function resetBannerAdjustState() {
    bannerAdjustState.file = null;
    bannerAdjustState.inputEl = null;
    bannerAdjustState.naturalWidth = 1;
    bannerAdjustState.naturalHeight = 1;
    bannerAdjustState.scale = BANNER_DEFAULT_SETTINGS.scale;
    bannerAdjustState.offsetX = BANNER_DEFAULT_SETTINGS.offsetX;
    bannerAdjustState.offsetY = BANNER_DEFAULT_SETTINGS.offsetY;
    bannerAdjustState.viewportWidth = BANNER_VIEWPORT_FALLBACK_WIDTH;
    bannerAdjustState.viewportHeight = BANNER_VIEWPORT_FALLBACK_HEIGHT;
    bannerAdjustState.isDragging = false;
    bannerAdjustState.dragStartX = 0;
    bannerAdjustState.dragStartY = 0;
    bannerAdjustState.dragStartOffsetX = BANNER_DEFAULT_SETTINGS.offsetX;
    bannerAdjustState.dragStartOffsetY = BANNER_DEFAULT_SETTINGS.offsetY;
    bannerAdjustState.uploading = false;
}

function syncBannerAdjustPreview() {
    const previewImage = document.getElementById('bannerAdjustPreviewImage');
    const zoomInput = document.getElementById('bannerAdjustZoom');
    const zoomValue = document.getElementById('bannerAdjustZoomValue');
    if (!previewImage) return;
    const viewportWidth = Math.max(1, Number(bannerAdjustState.viewportWidth) || BANNER_VIEWPORT_FALLBACK_WIDTH);
    const viewportHeight = Math.max(1, Number(bannerAdjustState.viewportHeight) || BANNER_VIEWPORT_FALLBACK_HEIGHT);

    const clampedOffsets = clampBannerOffsetsByImage(
        bannerAdjustState.offsetX,
        bannerAdjustState.offsetY,
        bannerAdjustState.naturalWidth,
        bannerAdjustState.naturalHeight,
        bannerAdjustState.scale,
        viewportWidth,
        viewportHeight
    );
    bannerAdjustState.offsetX = clampedOffsets.offsetX;
    bannerAdjustState.offsetY = clampedOffsets.offsetY;

    applyBannerTransformToImage(previewImage, {
        scale: bannerAdjustState.scale,
        offsetX: bannerAdjustState.offsetX,
        offsetY: bannerAdjustState.offsetY
    });

    if (zoomInput) {
        zoomInput.value = String(normalizeBannerScale(bannerAdjustState.scale));
    }
    if (zoomValue) {
        zoomValue.textContent = `${Math.round(normalizeBannerScale(bannerAdjustState.scale) * 100)}%`;
    }
}

function closeBannerAdjustModal() {
    const modal = document.getElementById('bannerAdjustModal');
    const preview = document.getElementById('bannerAdjustPreview');
    const previewImage = document.getElementById('bannerAdjustPreviewImage');
    const applyBtn = document.getElementById('bannerAdjustApplyBtn');
    const zoomInput = document.getElementById('bannerAdjustZoom');

    if (modal) {
        modal.style.display = 'none';
    }
    if (preview) {
        preview.classList.remove('dragging');
        preview.style.aspectRatio = '';
    }
    if (previewImage) {
        previewImage.removeAttribute('src');
    }
    if (zoomInput) {
        zoomInput.value = String(BANNER_DEFAULT_SETTINGS.scale);
    }
    if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Aplicar';
    }

    if (bannerAdjustState.inputEl) {
        bannerAdjustState.inputEl.value = '';
    }

    setBannerAdjustError('');
    clearBannerAdjustObjectUrl();
    resetBannerAdjustState();
}

function openBannerAdjustModal(file, sourceInputEl) {
    const modal = document.getElementById('bannerAdjustModal');
    const preview = document.getElementById('bannerAdjustPreview');
    const previewImage = document.getElementById('bannerAdjustPreviewImage');
    const zoomInput = document.getElementById('bannerAdjustZoom');
    if (!modal || !preview || !previewImage || !zoomInput) return false;

    clearBannerAdjustObjectUrl();
    resetBannerAdjustState();

    bannerAdjustState.file = file;
    bannerAdjustState.inputEl = sourceInputEl || null;
    bannerAdjustState.objectUrl = URL.createObjectURL(file);

    bannerAdjustState.scale = BANNER_DEFAULT_SETTINGS.scale;
    bannerAdjustState.offsetX = BANNER_DEFAULT_SETTINGS.offsetX;
    bannerAdjustState.offsetY = BANNER_DEFAULT_SETTINGS.offsetY;
    syncBannerAdjustViewport();

    zoomInput.value = String(bannerAdjustState.scale);
    previewImage.onload = () => {
        bannerAdjustState.naturalWidth = Math.max(1, Number(previewImage.naturalWidth) || 1);
        bannerAdjustState.naturalHeight = Math.max(1, Number(previewImage.naturalHeight) || 1);
        syncBannerAdjustPreview();
    };
    previewImage.src = bannerAdjustState.objectUrl;

    setBannerAdjustError('');
    modal.style.display = 'block';
    return true;
}

function openBannerAdjustModalFromCurrentBanner() {
    const modal = document.getElementById('bannerAdjustModal');
    const preview = document.getElementById('bannerAdjustPreview');
    const previewImage = document.getElementById('bannerAdjustPreviewImage');
    const zoomInput = document.getElementById('bannerAdjustZoom');
    const resolvedBannerUrl = currentUser?.banner ? resolveMediaUrl(currentUser.banner) : '';
    if (!modal || !preview || !previewImage || !zoomInput || !resolvedBannerUrl) return false;

    clearBannerAdjustObjectUrl();
    resetBannerAdjustState();

    bannerAdjustState.file = null;
    bannerAdjustState.inputEl = null;
    bannerAdjustState.scale = normalizeBannerScale(currentUser?.bannerScale ?? BANNER_DEFAULT_SETTINGS.scale);
    bannerAdjustState.offsetX = normalizeBannerOffset(currentUser?.bannerOffsetX ?? BANNER_DEFAULT_SETTINGS.offsetX, BANNER_DEFAULT_SETTINGS.offsetX);
    bannerAdjustState.offsetY = normalizeBannerOffset(currentUser?.bannerOffsetY ?? BANNER_DEFAULT_SETTINGS.offsetY, BANNER_DEFAULT_SETTINGS.offsetY);
    syncBannerAdjustViewport();

    zoomInput.value = String(bannerAdjustState.scale);
    previewImage.onload = () => {
        bannerAdjustState.naturalWidth = Math.max(1, Number(previewImage.naturalWidth) || 1);
        bannerAdjustState.naturalHeight = Math.max(1, Number(previewImage.naturalHeight) || 1);
        syncBannerAdjustPreview();
    };
    previewImage.src = withCacheBuster(resolvedBannerUrl);

    setBannerAdjustError('');
    modal.style.display = 'block';
    return true;
}

function openBannerAdjustModalWithoutFile() {
    const modal = document.getElementById('bannerAdjustModal');
    const preview = document.getElementById('bannerAdjustPreview');
    const previewImage = document.getElementById('bannerAdjustPreviewImage');
    const zoomInput = document.getElementById('bannerAdjustZoom');
    if (!modal || !preview || !previewImage || !zoomInput) return false;

    clearBannerAdjustObjectUrl();
    resetBannerAdjustState();

    bannerAdjustState.file = null;
    bannerAdjustState.inputEl = null;
    bannerAdjustState.scale = BANNER_DEFAULT_SETTINGS.scale;
    bannerAdjustState.offsetX = BANNER_DEFAULT_SETTINGS.offsetX;
    bannerAdjustState.offsetY = BANNER_DEFAULT_SETTINGS.offsetY;
    syncBannerAdjustViewport();
    syncBannerAdjustPreview();

    previewImage.removeAttribute('src');
    zoomInput.value = String(bannerAdjustState.scale);

    setBannerAdjustError('');
    modal.style.display = 'block';
    return true;
}

function handleBannerUploadTriggerClick(event) {
    if (event) {
        event.preventDefault();
    }

    const hasCurrentBanner = Boolean(String(currentUser?.banner || '').trim());
    if (hasCurrentBanner) {
        const opened = openBannerAdjustModalFromCurrentBanner();
        if (!opened) {
            showNotification('Erro ao abrir editor do banner.', 'error');
        }
        return;
    }

    const opened = openBannerAdjustModalWithoutFile();
    if (!opened) {
        showNotification('Erro ao abrir editor do banner.', 'error');
    }
}

function triggerBannerFileBrowserFromAdjustModal() {
    if (bannerAdjustState.uploading) return;
    const bannerInput = document.getElementById('bannerInput');
    if (!bannerInput) {
        setBannerAdjustError('Não foi possível abrir o seletor de arquivo.');
        return;
    }

    // Limpa o valor para disparar change até quando escolher o mesmo arquivo.
    bannerInput.value = '';
    bannerInput.click();
}

async function submitBannerWithAdjustments() {
    if (bannerAdjustState.uploading) return;
    const hasSelectedFile = Boolean(bannerAdjustState.file);
    const hasCurrentBanner = Boolean(currentUser?.banner);
    if (!hasSelectedFile && !hasCurrentBanner) {
        setBannerAdjustError('Selecione uma imagem para continuar.');
        return;
    }

    const applyBtn = document.getElementById('bannerAdjustApplyBtn');
    bannerAdjustState.uploading = true;
    setBannerAdjustError('');

    if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.textContent = 'Enviando...';
    }

    try {
        const formData = new FormData();
        if (hasSelectedFile) {
            formData.append('banner', bannerAdjustState.file);
        }
        formData.append('bannerScale', String(normalizeBannerScale(bannerAdjustState.scale)));
        formData.append('bannerOffsetX', String(normalizeBannerOffset(bannerAdjustState.offsetX, BANNER_DEFAULT_SETTINGS.offsetX)));
        formData.append('bannerOffsetY', String(normalizeBannerOffset(bannerAdjustState.offsetY, BANNER_DEFAULT_SETTINGS.offsetY)));

        const result = await AuthAPI.updateProfile(formData);
        if (!result?.success) {
            const message = result?.message || 'Erro ao atualizar banner.';
            setBannerAdjustError(message);
            showNotification(message, 'error');
            return;
        }

        currentUser.banner = result.user?.banner || currentUser.banner;
        currentUser.bannerScale = result.user?.bannerScale ?? normalizeBannerScale(bannerAdjustState.scale);
        currentUser.bannerOffsetX = result.user?.bannerOffsetX ?? normalizeBannerOffset(bannerAdjustState.offsetX, BANNER_DEFAULT_SETTINGS.offsetX);
        currentUser.bannerOffsetY = result.user?.bannerOffsetY ?? normalizeBannerOffset(bannerAdjustState.offsetY, BANNER_DEFAULT_SETTINGS.offsetY);

        applyCurrentUserBannerVisual({ withCacheBuster: true });
        showNotification('Banner atualizado com sucesso! (GIF/PNG/JPG/WEBP)', 'success');
        closeBannerAdjustModal();
    } catch (error) {
        console.error('Erro ao enviar banner ajustado:', error);
        setBannerAdjustError('Erro ao enviar banner. Tente novamente.');
        showNotification('Erro ao fazer upload do banner', 'error');
    } finally {
        bannerAdjustState.uploading = false;
        if (applyBtn) {
            applyBtn.disabled = false;
            applyBtn.textContent = 'Aplicar';
        }
    }
}

async function removeCurrentAvatar() {
    if (!currentUser?.avatar) {
        showNotification('Você já está sem avatar.', 'error');
        return;
    }

    const confirmed = await openAvatarRemoveConfirmModal();
    if (!confirmed) return;

    try {
        const formData = new FormData();
        formData.append('clearAvatar', '1');
        const result = await AuthAPI.updateProfile(formData);

        if (!result?.success) {
            showNotification(result?.message || 'Erro ao remover avatar.', 'error');
            return;
        }

        currentUser.avatar = result.user?.avatar || null;
        currentUser.avatarScale = normalizeAvatarScale(result.user?.avatarScale ?? AVATAR_DEFAULT_SETTINGS.scale);
        currentUser.avatarOffsetX = normalizeAvatarOffset(result.user?.avatarOffsetX ?? AVATAR_DEFAULT_SETTINGS.offsetX, AVATAR_DEFAULT_SETTINGS.offsetX);
        currentUser.avatarOffsetY = normalizeAvatarOffset(result.user?.avatarOffsetY ?? AVATAR_DEFAULT_SETTINGS.offsetY, AVATAR_DEFAULT_SETTINGS.offsetY);
        applyCurrentUserAvatarVisual({ withCacheBuster: true });
        showNotification('Avatar removido com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao remover avatar:', error);
        showNotification('Erro ao remover avatar.', 'error');
    }
}

async function removeCurrentBanner() {
    if (!currentUser?.banner) {
        showNotification('Você já está sem banner.', 'error');
        return;
    }

    const confirmed = window.confirm('Tem certeza que deseja remover seu banner atual?');
    if (!confirmed) return;

    try {
        const formData = new FormData();
        formData.append('clearBanner', '1');
        const result = await AuthAPI.updateProfile(formData);

        if (!result?.success) {
            showNotification(result?.message || 'Erro ao remover banner.', 'error');
            return;
        }

        currentUser.banner = result.user?.banner || null;
        currentUser.bannerScale = normalizeBannerScale(result.user?.bannerScale ?? BANNER_DEFAULT_SETTINGS.scale);
        currentUser.bannerOffsetX = normalizeBannerOffset(result.user?.bannerOffsetX ?? BANNER_DEFAULT_SETTINGS.offsetX, BANNER_DEFAULT_SETTINGS.offsetX);
        currentUser.bannerOffsetY = normalizeBannerOffset(result.user?.bannerOffsetY ?? BANNER_DEFAULT_SETTINGS.offsetY, BANNER_DEFAULT_SETTINGS.offsetY);
        applyCurrentUserBannerVisual({ withCacheBuster: true });
        showNotification('Banner removido com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao remover banner:', error);
        showNotification('Erro ao remover banner.', 'error');
    }
}

function closeAvatarRemoveConfirmModal(confirmed = false) {
    const modal = document.getElementById('avatarRemoveConfirmModal');
    if (modal) {
        modal.style.display = 'none';
    }

    if (typeof avatarRemoveConfirmResolver === 'function') {
        avatarRemoveConfirmResolver(Boolean(confirmed));
        avatarRemoveConfirmResolver = null;
    }
}

function openAvatarRemoveConfirmModal() {
    const modal = document.getElementById('avatarRemoveConfirmModal');
    if (!modal) {
        return Promise.resolve(false);
    }

    modal.style.display = 'block';
    return new Promise((resolve) => {
        avatarRemoveConfirmResolver = resolve;
    });
}

function bindAvatarRemoveConfirmEvents() {
    const modal = document.getElementById('avatarRemoveConfirmModal');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';

    const closeBtn = document.getElementById('closeAvatarRemoveConfirmModal');
    const cancelBtn = document.getElementById('avatarRemoveCancelBtn');
    const confirmBtn = document.getElementById('avatarRemoveConfirmBtn');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeAvatarRemoveConfirmModal(false));
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeAvatarRemoveConfirmModal(false));
    }
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => closeAvatarRemoveConfirmModal(true));
    }
}

function bindAvatarAdjustModalEvents() {
    const modal = document.getElementById('avatarAdjustModal');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';

    const preview = document.getElementById('avatarAdjustPreview');
    const previewImage = document.getElementById('avatarAdjustPreviewImage');
    const zoomInput = document.getElementById('avatarAdjustZoom');
    const resetBtn = document.getElementById('avatarAdjustResetBtn');
    const browseBtn = document.getElementById('avatarAdjustBrowseBtn');
    const cancelBtn = document.getElementById('avatarAdjustCancelBtn');
    const applyBtn = document.getElementById('avatarAdjustApplyBtn');
    const isAvatarAdjustModalOpen = () => modal.style.display === 'block';

    const preventFileNavigationWhileModalOpen = (event) => {
        if (!isAvatarAdjustModalOpen()) return;
        if (!isFileDragEvent(event)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.type === 'dragover' && event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
    };

    document.addEventListener('dragover', preventFileNavigationWhileModalOpen);
    document.addEventListener('drop', preventFileNavigationWhileModalOpen);

    if (zoomInput) {
        zoomInput.addEventListener('input', () => {
            avatarAdjustState.scale = normalizeAvatarScale(zoomInput.value);
            syncAvatarAdjustPreview();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            avatarAdjustState.scale = AVATAR_DEFAULT_SETTINGS.scale;
            avatarAdjustState.offsetX = AVATAR_DEFAULT_SETTINGS.offsetX;
            avatarAdjustState.offsetY = AVATAR_DEFAULT_SETTINGS.offsetY;
            syncAvatarAdjustPreview();
        });
    }

    if (browseBtn) {
        browseBtn.addEventListener('click', triggerAvatarFileBrowserFromAdjustModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeAvatarAdjustModal);
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', submitAvatarWithAdjustments);
    }

    if (preview && previewImage) {
        const clearDropOverState = () => {
            preview.classList.remove('drop-over');
        };

        const markDropOverState = (event) => {
            if (!isAvatarAdjustModalOpen()) return;
            if (!isFileDragEvent(event)) return;
            event.preventDefault();
            event.stopPropagation();
            preview.classList.add('drop-over');
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'copy';
            }
        };

        preview.addEventListener('dragenter', markDropOverState);
        preview.addEventListener('dragover', markDropOverState);
        preview.addEventListener('dragleave', (event) => {
            if (!isAvatarAdjustModalOpen()) return;
            if (!isFileDragEvent(event)) return;
            const relatedTarget = event.relatedTarget;
            if (relatedTarget && preview.contains(relatedTarget)) return;
            clearDropOverState();
        });
        preview.addEventListener('drop', (event) => {
            if (!isAvatarAdjustModalOpen()) return;
            if (!isFileDragEvent(event)) return;
            event.preventDefault();
            event.stopPropagation();
            clearDropOverState();
            const droppedFile = getFirstFileFromDataTransfer(event.dataTransfer);
            if (!droppedFile) {
                setAvatarAdjustError('Nenhum arquivo de imagem foi detectado.');
                return;
            }
            handleAvatarAdjustDroppedFile(droppedFile);
        });

        modal.addEventListener('dragleave', (event) => {
            if (!isAvatarAdjustModalOpen()) return;
            if (!isFileDragEvent(event)) return;
            const relatedTarget = event.relatedTarget;
            if (relatedTarget && modal.contains(relatedTarget)) return;
            clearDropOverState();
        });
        modal.addEventListener('drop', clearDropOverState);

        preview.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            avatarAdjustState.isDragging = true;
            avatarAdjustState.dragStartX = event.clientX;
            avatarAdjustState.dragStartY = event.clientY;
            avatarAdjustState.dragStartOffsetX = avatarAdjustState.offsetX;
            avatarAdjustState.dragStartOffsetY = avatarAdjustState.offsetY;
            preview.classList.add('dragging');
            preview.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        preview.addEventListener('pointermove', (event) => {
            if (!avatarAdjustState.isDragging) return;
            const rect = preview.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const deltaXPercent = ((event.clientX - avatarAdjustState.dragStartX) / rect.width) * 100;
            const deltaYPercent = ((event.clientY - avatarAdjustState.dragStartY) / rect.height) * 100;
            avatarAdjustState.offsetX = avatarAdjustState.dragStartOffsetX + deltaXPercent;
            avatarAdjustState.offsetY = avatarAdjustState.dragStartOffsetY + deltaYPercent;
            syncAvatarAdjustPreview();
        });

        const stopDrag = (event) => {
            if (!avatarAdjustState.isDragging) return;
            avatarAdjustState.isDragging = false;
            preview.classList.remove('dragging');
            if (event?.pointerId !== undefined && preview.hasPointerCapture(event.pointerId)) {
                preview.releasePointerCapture(event.pointerId);
            }
        };

        preview.addEventListener('pointerup', stopDrag);
        preview.addEventListener('pointercancel', stopDrag);
        preview.addEventListener('pointerleave', () => {
            if (!avatarAdjustState.isDragging) {
                preview.classList.remove('dragging');
            }
        });
    }
}

function bindBannerAdjustModalEvents() {
    const modal = document.getElementById('bannerAdjustModal');
    if (!modal || modal.dataset.bound === '1') return;
    modal.dataset.bound = '1';

    const preview = document.getElementById('bannerAdjustPreview');
    const previewImage = document.getElementById('bannerAdjustPreviewImage');
    const zoomInput = document.getElementById('bannerAdjustZoom');
    const resetBtn = document.getElementById('bannerAdjustResetBtn');
    const browseBtn = document.getElementById('bannerAdjustBrowseBtn');
    const cancelBtn = document.getElementById('bannerAdjustCancelBtn');
    const applyBtn = document.getElementById('bannerAdjustApplyBtn');

    if (zoomInput) {
        zoomInput.addEventListener('input', () => {
            bannerAdjustState.scale = normalizeBannerScale(zoomInput.value);
            syncBannerAdjustPreview();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            bannerAdjustState.scale = BANNER_DEFAULT_SETTINGS.scale;
            bannerAdjustState.offsetX = BANNER_DEFAULT_SETTINGS.offsetX;
            bannerAdjustState.offsetY = BANNER_DEFAULT_SETTINGS.offsetY;
            syncBannerAdjustPreview();
        });
    }

    if (browseBtn) {
        browseBtn.addEventListener('click', triggerBannerFileBrowserFromAdjustModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeBannerAdjustModal);
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', submitBannerWithAdjustments);
    }

    if (preview && previewImage) {
        preview.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            bannerAdjustState.isDragging = true;
            bannerAdjustState.dragStartX = event.clientX;
            bannerAdjustState.dragStartY = event.clientY;
            bannerAdjustState.dragStartOffsetX = bannerAdjustState.offsetX;
            bannerAdjustState.dragStartOffsetY = bannerAdjustState.offsetY;
            preview.classList.add('dragging');
            preview.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        preview.addEventListener('pointermove', (event) => {
            if (!bannerAdjustState.isDragging) return;
            const rect = preview.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            const deltaXPercent = ((event.clientX - bannerAdjustState.dragStartX) / rect.width) * 100;
            const deltaYPercent = ((event.clientY - bannerAdjustState.dragStartY) / rect.height) * 100;
            bannerAdjustState.offsetX = bannerAdjustState.dragStartOffsetX + deltaXPercent;
            bannerAdjustState.offsetY = bannerAdjustState.dragStartOffsetY + deltaYPercent;
            syncBannerAdjustPreview();
        });

        const stopDrag = (event) => {
            if (!bannerAdjustState.isDragging) return;
            bannerAdjustState.isDragging = false;
            preview.classList.remove('dragging');
            if (event?.pointerId !== undefined && preview.hasPointerCapture(event.pointerId)) {
                preview.releasePointerCapture(event.pointerId);
            }
        };

        preview.addEventListener('pointerup', stopDrag);
        preview.addEventListener('pointercancel', stopDrag);
        preview.addEventListener('pointerleave', () => {
            if (!bannerAdjustState.isDragging) {
                preview.classList.remove('dragging');
            }
        });
    }
}

function attachEventListeners() {
    console.log('Attaching event listeners...');
    
    try {
        bindAvatarAdjustModalEvents();
        bindBannerAdjustModalEvents();
        bindAvatarRemoveConfirmEvents();
        bindTaglineLinkModalEvents();
        initializeInboxControls();

        // ===== MODAL CLOSE BUTTONS =====
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (!modal) return;
                if (modal.id === 'avatarAdjustModal') {
                    closeAvatarAdjustModal();
                    return;
                }
                if (modal.id === 'bannerAdjustModal') {
                    closeBannerAdjustModal();
                    return;
                }
                if (modal.id === 'avatarRemoveConfirmModal') {
                    closeAvatarRemoveConfirmModal(false);
                    return;
                }
                modal.style.display = 'none';
            });
        });

        // ===== EDIT BUTTON & MODAL =====
        const editBtn = document.getElementById('editBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                // Preencher campos com dados do usuário
                if (currentUser) {
                    document.getElementById('editFirstName').value = currentUser.firstName || '';
                    document.getElementById('editLastName').value = currentUser.lastName || '';
                    document.getElementById('editNickname').value = currentUser.nickname || '';
                    const showFullNameToggle = document.getElementById('showFullNameInMiniProfileToggle');
                    if (showFullNameToggle) {
                        const rawValue = currentUser?.showFullNameInMiniProfile;
                        showFullNameToggle.checked = rawValue === undefined
                            ? true
                            : (rawValue === true || rawValue === 1 || rawValue === '1' || rawValue === 'true');
                    }
                    document.getElementById('editEmail').value = currentUser.email || '';
                    const birthDateInput = document.getElementById('editBirthDate');
                    const birthDateHint = document.getElementById('editBirthDateHint');
                    const hasLockedBirthDate = Boolean(String(currentUser.birthDate || '').trim());
                    if (birthDateInput) {
                        birthDateInput.value = currentUser.birthDate || '';
                        birthDateInput.disabled = hasLockedBirthDate;
                        birthDateInput.readOnly = hasLockedBirthDate;
                    }
                    if (birthDateHint) {
                        birthDateHint.textContent = hasLockedBirthDate
                            ? 'A data de nascimento é bloqueada após o cadastro por segurança.'
                            : 'Defina sua data de nascimento (não poderá ser alterada depois).';
                    }
                    renderTaglineEditorFromRaw(currentUser.profileTagline || '');
                    
                    // Atualizar o email no aviso do nickname
                    const nicknameWarning = document.querySelector('.nickname-warning em');
                    if (nicknameWarning) {
                        nicknameWarning.innerHTML = `Você também pode fazer login com seu email: <strong>${currentUser.email}</strong>`;
                    }
                    
                    updateTaglineCount();
                }

                initializeNotificationSettingsControls();
                loadAdultPostsPreference().catch(() => {});
                
                // Sincronizar cores do e-mail (verde/vermelho)
                syncProfileEmailStatusVisual();
                
                // Abrir modal
                document.getElementById('editModal').style.display = 'block';
                
                // Reset para a primeira aba (Perfil)
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                document.querySelector('.tab-btn').classList.add('active');
                document.getElementById('edit-tab').classList.add('active');
                
                // Limpar mensagens de erro
                document.getElementById('editError').textContent = '';
                document.getElementById('passwordError').textContent = '';
            });
        }

        const missionsBtn = document.getElementById('missionsBtn');
        if (missionsBtn && missionsBtn.dataset.boundMissionShortcut !== '1') {
            missionsBtn.dataset.boundMissionShortcut = '1';
            missionsBtn.addEventListener('click', () => {
                const missionsModal = document.getElementById('missionsModal');
                if (!missionsModal) return;
                missionsModal.style.display = 'block';
            });
        }

        const animatedProfileBtn = document.getElementById('animatedProfileBtn');
        if (animatedProfileBtn) {
            animatedProfileBtn.addEventListener('click', openAnimatedProfileModal);
        }

        const animatedMiniProfileEnabledToggle = document.getElementById('animatedMiniProfileEnabledToggle');
        const animatedDownloadCardEnabledToggle = document.getElementById('animatedDownloadCardEnabledToggle');
        const animatedVisualModeSelect = document.getElementById('animatedProfileVisualModeSelect');
        const animatedProfileThemeSelect = document.getElementById('animatedProfileThemeSelect');
        const animatedGifSearchInput = document.getElementById('animatedGifSearchInput');
        const animatedGifSearchBtn = document.getElementById('animatedGifSearchBtn');
        const animatedGifSearchMoreBtn = document.getElementById('animatedGifSearchMoreBtn');
        const animatedCustomGifUrl = document.getElementById('animatedCustomGifUrl');
        const uploadAnimatedGifBtn = document.getElementById('uploadAnimatedGifBtn');
        const animatedCustomGifFile = document.getElementById('animatedCustomGifFile');

        const handleAnimatedToggleChange = () => {
            const miniEnabled = Boolean(animatedMiniProfileEnabledToggle?.checked);
            const downloadEnabled = Boolean(animatedDownloadCardEnabledToggle?.checked);
            applyAnimatedProfileThemeState(miniEnabled || downloadEnabled);
            renderAnimatedProfilePreview(
                miniEnabled,
                animatedProfileThemeSelect?.value || 'auto',
                downloadEnabled,
                animatedVisualModeSelect?.value || 'theme',
                selectedAnimatedProfileGifUrl
            );
        };
        if (animatedMiniProfileEnabledToggle) {
            animatedMiniProfileEnabledToggle.addEventListener('change', () => {
                // Se ativar mini profile, ativa também download card
                if (animatedMiniProfileEnabledToggle.checked && animatedDownloadCardEnabledToggle) {
                    animatedDownloadCardEnabledToggle.checked = true;
                }
                handleAnimatedToggleChange();
            });
        }
        if (animatedDownloadCardEnabledToggle) {
            animatedDownloadCardEnabledToggle.addEventListener('change', () => {
                // Se ativar download card, ativa também mini profile
                if (animatedDownloadCardEnabledToggle.checked && animatedMiniProfileEnabledToggle) {
                    animatedMiniProfileEnabledToggle.checked = true;
                }
                handleAnimatedToggleChange();
            });
        }

        if (animatedProfileThemeSelect) {
            animatedProfileThemeSelect.addEventListener('change', () => {
                const miniEnabled = Boolean(document.getElementById('animatedMiniProfileEnabledToggle')?.checked);
                const downloadEnabled = Boolean(document.getElementById('animatedDownloadCardEnabledToggle')?.checked);
                renderAnimatedProfilePreview(
                    miniEnabled,
                    animatedProfileThemeSelect.value,
                    downloadEnabled,
                    animatedVisualModeSelect?.value || 'theme',
                    selectedAnimatedProfileGifUrl
                );
            });
        }

        if (animatedVisualModeSelect) {
            animatedVisualModeSelect.addEventListener('change', async () => {
                const miniEnabled = Boolean(document.getElementById('animatedMiniProfileEnabledToggle')?.checked);
                const downloadEnabled = Boolean(document.getElementById('animatedDownloadCardEnabledToggle')?.checked);
                applyAnimatedProfileThemeState(miniEnabled || downloadEnabled);
                if (animatedVisualModeSelect.value === 'gif') {
                    const resultsGrid = document.getElementById('animatedGifResults');
                    if (resultsGrid && !resultsGrid.children.length) {
                        animatedGifSearchNextPos = '';
                        await searchAnimatedGifs({ append: false, useTrending: true });
                    }
                }
                renderAnimatedProfilePreview(
                    miniEnabled,
                    animatedProfileThemeSelect?.value || 'auto',
                    downloadEnabled,
                    animatedVisualModeSelect.value,
                    selectedAnimatedProfileGifUrl
                );
            });
        }

        if (animatedGifSearchBtn) {
            animatedGifSearchBtn.addEventListener('click', async () => {
                animatedGifSearchNextPos = '';
                await searchAnimatedGifs({ append: false, useTrending: false });
            });
        }
        if (animatedGifSearchInput) {
            animatedGifSearchInput.addEventListener('keydown', async (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                animatedGifSearchNextPos = '';
                await searchAnimatedGifs({ append: false, useTrending: false });
            });
        }
        if (animatedGifSearchMoreBtn) {
            animatedGifSearchMoreBtn.addEventListener('click', async () => {
                if (!animatedGifSearchNextPos) return;
                await searchAnimatedGifs({ append: true, useTrending: animatedGifSearchUseTrending });
            });
        }

        if (animatedCustomGifUrl) {
            animatedCustomGifUrl.addEventListener('change', () => {
                if (!userCanUseAnimatedProfileCustomGif()) {
                    animatedCustomGifUrl.value = '';
                    showNotification('Você ainda não desbloqueou GIF próprio no perfil animado.', 'error');
                    return;
                }
                if (animatedVisualModeSelect) animatedVisualModeSelect.value = 'gif';
                selectedAnimatedProfileGifUrl = normalizeAnimatedProfileGifUrl(animatedCustomGifUrl.value);
                selectedAnimatedProfileGiphyId = '';
                const miniEnabled = Boolean(document.getElementById('animatedMiniProfileEnabledToggle')?.checked);
                const downloadEnabled = Boolean(document.getElementById('animatedDownloadCardEnabledToggle')?.checked);
                applyAnimatedProfileThemeState(miniEnabled || downloadEnabled);
                renderAnimatedProfilePreview(
                    miniEnabled,
                    animatedProfileThemeSelect?.value || 'auto',
                    downloadEnabled,
                    'gif',
                    selectedAnimatedProfileGifUrl
                );
            });
        }

        if (uploadAnimatedGifBtn) {
            uploadAnimatedGifBtn.addEventListener('click', async () => {
                if (!userCanUseAnimatedProfileCustomGif()) {
                    showNotification('Você ainda não desbloqueou GIF próprio no perfil animado.', 'error');
                    return;
                }
                const file = animatedCustomGifFile?.files?.[0];
                if (!file) {
                    showNotification('Selecione um GIF para enviar.', 'error');
                    return;
                }
                if (file.size > MAX_CUSTOM_ANIMATED_GIF_BYTES) {
                    showNotification('GIF muito grande. Máximo: 15MB.', 'error');
                    return;
                }
                if (String(file.type || '').toLowerCase() !== 'image/gif') {
                    showNotification('Envie apenas arquivo .gif', 'error');
                    return;
                }

                uploadAnimatedGifBtn.disabled = true;
                const originalText = uploadAnimatedGifBtn.textContent;
                uploadAnimatedGifBtn.textContent = 'Enviando...';
                try {
                    const result = await AuthAPI.uploadAnimatedProfileGif(file);
                    if (!result?.success || !result?.gifUrl) {
                        showNotification(result?.message || 'Erro ao enviar GIF.', 'error');
                        return;
                    }
                    if (animatedVisualModeSelect) animatedVisualModeSelect.value = 'gif';
                    selectedAnimatedProfileGifUrl = normalizeAnimatedProfileGifUrl(result.gifUrl);
                    selectedAnimatedProfileGiphyId = '';
                    if (animatedCustomGifUrl) animatedCustomGifUrl.value = selectedAnimatedProfileGifUrl;
                    showNotification('GIF enviado com sucesso!', 'success');
                    const miniEnabled = Boolean(document.getElementById('animatedMiniProfileEnabledToggle')?.checked);
                    const downloadEnabled = Boolean(document.getElementById('animatedDownloadCardEnabledToggle')?.checked);
                    applyAnimatedProfileThemeState(miniEnabled || downloadEnabled);
                    renderAnimatedProfilePreview(
                        miniEnabled,
                        animatedProfileThemeSelect?.value || 'auto',
                        downloadEnabled,
                        'gif',
                        selectedAnimatedProfileGifUrl
                    );
                } catch (error) {
                    console.error('Erro no upload de GIF:', error);
                    showNotification('Erro ao enviar GIF.', 'error');
                } finally {
                    uploadAnimatedGifBtn.disabled = false;
                    uploadAnimatedGifBtn.textContent = originalText;
                }
            });
        }

        const saveAnimatedProfileBtn = document.getElementById('saveAnimatedProfileBtn');
        if (saveAnimatedProfileBtn) {
            saveAnimatedProfileBtn.addEventListener('click', saveAnimatedProfileSettings);
        }

        // ===== MODAL TABS FUNCTIONALITY =====
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.getAttribute('data-tab');
                
                // Remove active class de todas as abas
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                // Adiciona active no botão e conteedo clicado
                btn.classList.add('active');
                document.getElementById(tabName).classList.add('active');

                if (tabName === 'password-tab') {
                    resetTwoFactorMessages();
                    loadTwoFactorStatus();
                }
            });
        });

        // ===== CHANGE EMAIL BUTTON =====
        const changeEmailBtn = document.getElementById('changeEmailBtn');
        if (changeEmailBtn) {
            changeEmailBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Preencher email atual no modal
                document.getElementById('currentEmailDisplay').value = currentUser.email || '';
                document.getElementById('newEmailInput').value = '';
                document.getElementById('emailVerificationCode').value = '';
                document.getElementById('changeEmailError').textContent = '';
                // Abrir modal
                document.getElementById('changeEmailModal').style.display = 'block';
            });
        }

        // ===== CLOSE CHANGE EMAIL MODAL =====
        const closeChangeEmailBtn = document.getElementById('closeChangeEmailModal');
        if (closeChangeEmailBtn) {
            closeChangeEmailBtn.addEventListener('click', () => {
                document.getElementById('changeEmailModal').style.display = 'none';
            });
        }

        const sendVerifyCodeBtn = document.getElementById('sendVerifyCodeBtn');
        if (sendVerifyCodeBtn) {
            sendVerifyCodeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const result = await AuthAPI.resendVerification(currentUser.email);
                    if (result.success) {
                        document.getElementById('verifyEmailDisplay').textContent = currentUser.email || 'seu e-mail';
                        document.getElementById('verifyEmailCodeInput').value = '';
                        document.getElementById('verifyEmailError').textContent = '';
                        document.getElementById('verifyEmailModal').style.display = 'block';
                        showNotification('Código enviado para o seu e-mail.', 'success');
                    } else {
                        showNotification(result.message || 'Não foi possível enviar o código.', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    showNotification('Erro ao enviar o código.', 'error');
                }
            });
        }

        const closeVerifyEmailBtn = document.getElementById('closeVerifyEmailModal');
        if (closeVerifyEmailBtn) {
            closeVerifyEmailBtn.addEventListener('click', () => {
                document.getElementById('verifyEmailModal').style.display = 'none';
            });
        }

        const verifyEmailForm = document.getElementById('verifyEmailForm');
        if (verifyEmailForm) {
            verifyEmailForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = document.getElementById('verifyEmailCodeInput').value.trim();
                const errorEl = document.getElementById('verifyEmailError');

                if (!code || code.length !== 6) {
                    if (errorEl) errorEl.textContent = 'Digite um código válido com 6 dígitos.';
                    return;
                }

                try {
                    const result = await AuthAPI.verifyEmail(currentUser.email, code);
                    if (result.success) {
                        currentUser.emailVerified = true;
                        syncProfileEmailStatusVisual();
                        document.getElementById('verifyEmailModal').style.display = 'none';
                        if (errorEl) errorEl.textContent = '';
                        showNotification('E-mail confirmado com sucesso!', 'success');
                    } else {
                        if (errorEl) errorEl.textContent = result.message || 'Código inválido ou expirado.';
                    }
                } catch (err) {
                    console.error(err);
                    if (errorEl) errorEl.textContent = 'Erro ao confirmar o e-mail.';
                }
            });
        }

        const resendVerifyEmailBtn = document.getElementById('resendVerifyEmailBtn');
        if (resendVerifyEmailBtn) {
            resendVerifyEmailBtn.addEventListener('click', async () => {
                const now = Date.now();
                const lastResendTime = parseInt(localStorage.getItem('profileVerificationResend') || '0', 10);

                if (resendVerifyInFlight) return;
                if (now - lastResendTime < RESEND_COOLDOWN) {
                    const secondsLeft = Math.ceil((RESEND_COOLDOWN - (now - lastResendTime)) / 1000);
                    showNotification(`Aguarde ${secondsLeft}s antes de reenviar o código.`, 'info');
                    return;
                }

                resendVerifyInFlight = true;
                resendVerifyEmailBtn.disabled = true;
                resendVerifyEmailBtn.textContent = 'Enviando...';
                resendVerifyEmailBtn.style.opacity = '0.65';

                try {
                    const result = await AuthAPI.resendVerification(currentUser.email);
                    if (result.success) {
                        localStorage.setItem('profileVerificationResend', now.toString());
                        showNotification('Um novo código foi enviado para o seu e-mail.', 'success');
                        startProfileResendCooldown(resendVerifyEmailBtn);
                    } else {
                        showNotification(result.message || 'Não foi possível reenviar o código.', 'error');
                        resendVerifyEmailBtn.disabled = false;
                        resendVerifyEmailBtn.textContent = 'Reenviar Código';
                        resendVerifyEmailBtn.style.opacity = '1';
                    }
                } catch (err) {
                    console.error(err);
                    showNotification('Erro ao reenviar o código.', 'error');
                    resendVerifyEmailBtn.disabled = false;
                    resendVerifyEmailBtn.textContent = 'Reenviar Código';
                    resendVerifyEmailBtn.style.opacity = '1';
                } finally {
                    resendVerifyInFlight = false;
                }
            });
        }


        // Checkbox e botão de pedido de troca de e-mail no modal
        const noAccessToEmailCheckbox = document.getElementById('noAccessToEmailCheckbox');
        const requestEmailChangeBtnModal = document.getElementById('requestEmailChangeBtnModal');
        const requestEmailChangeHint = document.getElementById('requestEmailChangeHint');
        const emailChangeRequestStatus = document.getElementById('emailChangeRequestStatus');
        const hasPendingEmailChangeRequest = Boolean(currentUser?.pendingEmailChangeRequest);
        if (requestEmailChangeBtnModal) {
            requestEmailChangeBtnModal.disabled = hasPendingEmailChangeRequest;
            requestEmailChangeBtnModal.style.opacity = hasPendingEmailChangeRequest ? '0.65' : '1';
            requestEmailChangeBtnModal.style.cursor = hasPendingEmailChangeRequest ? 'not-allowed' : 'pointer';
            if (hasPendingEmailChangeRequest && emailChangeRequestStatus) {
                emailChangeRequestStatus.style.display = 'block';
            }
        }
        if (noAccessToEmailCheckbox && requestEmailChangeBtnModal) {
            noAccessToEmailCheckbox.addEventListener('change', () => {
                if (noAccessToEmailCheckbox.checked) {
                    requestEmailChangeBtnModal.style.display = 'inline-block';
                    if (requestEmailChangeHint) requestEmailChangeHint.style.display = 'block';
                } else {
                    requestEmailChangeBtnModal.style.display = 'none';
                    if (requestEmailChangeHint) requestEmailChangeHint.style.display = 'none';
                }
            });
            requestEmailChangeBtnModal.addEventListener('click', async (e) => {
                e.preventDefault();
                const newEmail = await showCustomEmailPrompt(currentUser.email || '');
                if (!newEmail) return;
                if (!isValidEmailFormat(newEmail)) {
                    showNotification('Informe um e-mail válido.', 'error');
                    return;
                }
                try {
                    const result = await AuthAPI.requestEmailChange(newEmail, 'Pedido realizado via perfil (sem acesso ao e-mail antigo)');
                    if (result.success) {
                        currentUser.pendingEmailChangeRequest = true;
                        if (requestEmailChangeBtnModal) {
                            requestEmailChangeBtnModal.disabled = true;
                            requestEmailChangeBtnModal.style.opacity = '0.65';
                            requestEmailChangeBtnModal.style.cursor = 'not-allowed';
                        }
                        if (emailChangeRequestStatus) {
                            emailChangeRequestStatus.style.display = 'block';
                        }
                        showNotification('Pedido enviado para o administrador. Ele poderá aprovar ou cancelar a troca.', 'success');
                    } else {
                        showNotification(result.message || 'Não foi possível enviar o pedido.', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    showNotification('Erro ao enviar o pedido de troca.', 'error');
                }
            });
        }

        // ===== SEND EMAIL VERIFICATION CODE =====
        const sendEmailCodeBtn = document.getElementById('sendEmailCodeBtn');
        if (sendEmailCodeBtn) {
            sendEmailCodeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                
                try {
                    sendEmailCodeBtn.disabled = true;
                    sendEmailCodeBtn.textContent = 'Enviando...';
                    
                    const result = await AuthAPI.sendEmailChangeCode(currentUser.email);
                    
                    if (result.success) {
                        showNotification('Código enviado para seu e-mail! Verifique sua caixa de entrada.', 'success');
                        sendEmailCodeBtn.textContent = 'Código Enviado';
                        document.getElementById('changeEmailError').textContent = '';
                    } else {
                        document.getElementById('changeEmailError').textContent = 'Erro: ' + (result.message || 'Erro ao enviar código');
                        sendEmailCodeBtn.disabled = false;
                        sendEmailCodeBtn.textContent = 'Enviar Código';
                    }
                } catch (err) {
                    document.getElementById('changeEmailError').textContent = 'Erro ao enviar código';
                    sendEmailCodeBtn.disabled = false;
                    sendEmailCodeBtn.textContent = 'Enviar Código';
                    console.error(err);
                }
            });
        }

        // ===== CHANGE EMAIL FORM =====
        const changeEmailForm = document.getElementById('changeEmailForm');
        if (changeEmailForm) {
            changeEmailForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const newEmail = document.getElementById('newEmailInput').value;
                const code = document.getElementById('emailVerificationCode').value;
                
                if (!newEmail || !code) {
                    document.getElementById('changeEmailError').textContent = 'Preencha todos os campos';
                    return;
                }
                
                try {
                    const result = await AuthAPI.changeEmail(newEmail, code);
                    
                    if (result.success) {
                        // Atualizar email do usuário
                        currentUser.email = newEmail;
                        document.getElementById('editEmail').value = newEmail;
                        document.getElementById('profileEmail').textContent = '*'.repeat(newEmail.length);
                        document.getElementById('profileEmail').setAttribute('data-hidden', 'true');
                        syncEmailToggleButton();
                        syncProfileEmailStatusVisual();
                        
                        // Fechar modais
                        document.getElementById('changeEmailModal').style.display = 'none';
                        changeEmailForm.reset();
                        
                        showNotification('E-mail alterado com sucesso!', 'success');
                    } else {
                        document.getElementById('changeEmailError').textContent = 'Erro: ' + (result.message || 'Erro ao alterar e-mail');
                    }
                } catch (err) {
                    document.getElementById('changeEmailError').textContent = 'Erro ao alterar e-mail';
                    console.error(err);
                }
            });
        }

        const editProfileForm = document.getElementById('editProfileForm');
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Coletar todos os dados do formulário (SEM email)
                const formData = new FormData();
                formData.append('firstName', document.getElementById('editFirstName').value);
                formData.append('lastName', document.getElementById('editLastName').value);
                formData.append('nickname', document.getElementById('editNickname').value);
                const showFullNameToggle = document.getElementById('showFullNameInMiniProfileToggle');
                if (showFullNameToggle) {
                    formData.append('showFullNameInMiniProfile', showFullNameToggle.checked ? '1' : '0');
                }
                const birthDateInput = document.getElementById('editBirthDate');
                const hasLockedBirthDate = Boolean(String(currentUser?.birthDate || '').trim());
                if (!hasLockedBirthDate) {
                    const birthDateValue = String(birthDateInput?.value || '').trim();
                    if (!birthDateValue) {
                        document.getElementById('editError').textContent = 'Informe sua data de nascimento.';
                        return;
                    }
                    formData.append('birthDate', birthDateValue);
                }
                const customTaglineInput = document.getElementById('editProfileTagline');
                const normalizedTagline = getTaglineEditorRawValue();
                if (customTaglineInput) {
                    customTaglineInput.value = normalizedTagline;
                }
                renderTaglineEditorFromRaw(normalizedTagline);
                formData.append('profileTagline', normalizedTagline);

                try {
                    const result = await AuthAPI.updateProfile(formData);
                    if (result.success) {
                        // Atualizar dados no usuário atual
                        currentUser.firstName = result.user.firstName;
                        currentUser.lastName = result.user.lastName;
                        currentUser.nickname = result.user.nickname;
                        currentUser.email = result.user.email;
                        currentUser.birthDate = result.user.birthDate;
                        currentUser.profileTagline = normalizeProfileTagline(result.user.profileTagline);
                        currentUser.showFullNameInMiniProfile = result.user?.showFullNameInMiniProfile;
                        
                        // Atualizar o perfil na página
                        document.getElementById('profileUsername').textContent = `${result.user.firstName} ${result.user.lastName}`;
                        renderProfileTagline();
                        renderRankHistory();
                        
                        // Reconexeo ao email mascarado
                        const emailDisplay = document.getElementById('profileEmail');
                        emailDisplay.textContent = '*'.repeat(result.user.email.length);
                        emailDisplay.setAttribute('data-hidden', 'true');
                        syncEmailToggleButton();
                        syncProfileEmailStatusVisual();
                        
                        // Fechar modal e mostrar notificação
                        document.getElementById('editModal').style.display = 'none';
                        document.getElementById('editError').textContent = '';
                        showNotification('Perfil atualizado com sucesso!', 'success');
                    } else {
                        document.getElementById('editError').textContent = 'Erro: ' + (result.message || 'Erro desconhecido');
                    }
                } catch (err) {
                    document.getElementById('editError').textContent = 'Erro ao atualizar perfil';
                    console.error(err);
                }
            });
        }

        // ===== FRASE DO PERFIL =====
        const editProfileTaglineRich = document.getElementById('editProfileTaglineRich');
        if (editProfileTaglineRich) {
            editProfileTaglineRich.addEventListener('input', () => {
                updateTaglineCount({ keepFocus: true });
            });

            editProfileTaglineRich.addEventListener('paste', (event) => {
                event.preventDefault();
                const pastedText = String(event.clipboardData?.getData('text/plain') || '');
                insertPlainTextAtSelection(pastedText);
                updateTaglineCount({ keepFocus: true });
            });

            editProfileTaglineRich.addEventListener('click', (event) => {
                const linkEl = event.target instanceof Element
                    ? event.target.closest('a')
                    : null;
                if (!linkEl || !linkEl.href) return;
                event.preventDefault();
                window.open(linkEl.href, '_blank', 'noopener,noreferrer');
            });
        }
        const randomTaglineBtn = document.getElementById('randomTaglineBtn');
        if (randomTaglineBtn) {
            randomTaglineBtn.addEventListener('click', applyRandomProfileTagline);
        }
        const insertTaglineLinkBtn = document.getElementById('insertTaglineLinkBtn');
        if (insertTaglineLinkBtn) {
            const preserveTaglineSelection = (event) => {
                event.preventDefault();

                const { richEl } = getTaglineEditorElements();
                if (!richEl) return;

                const offsets = getTaglineEditorSelectionOffsets();
                if (!offsets) return;

                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0) return;

                const range = selection.getRangeAt(0);
                if (!richEl.contains(range.commonAncestorContainer)) return;

                taglineLinkSelectionRange = range.cloneRange();
                taglineLinkSelectionText = String(offsets.text || '');
                taglineLinkSelectionStart = offsets.start;
                taglineLinkSelectionEnd = offsets.end;
            };

            insertTaglineLinkBtn.addEventListener('pointerdown', preserveTaglineSelection);
            insertTaglineLinkBtn.addEventListener('mousedown', preserveTaglineSelection);
            insertTaglineLinkBtn.addEventListener('click', insertProfileTaglineLink);
        }
        const clearTaglineBtn = document.getElementById('clearTaglineBtn');
        if (clearTaglineBtn) {
            clearTaglineBtn.addEventListener('click', clearProfileTagline);
        }

        // ===== NICKNAME WARNING (Dynamic) =====
        const editNickname = document.getElementById('editNickname');
        if (editNickname) {
            editNickname.addEventListener('focus', () => {
                // Verificar se já existe o aviso
                let warning = document.getElementById('nicknameWarning');
                if (!warning) {
                    warning = document.createElement('div');
                    warning.id = 'nicknameWarning';
                    warning.className = 'nickname-warning';
                    warning.innerHTML = `
                        <strong>Atenção:</strong>
                        Se alterar seu nickname, o seu login mudará para o novo nickname.<br>
                        <em>Você também pode fazer login com seu email: <strong>${currentUser.email}</strong></em>
                    `;
                    editNickname.parentElement.appendChild(warning);
                }
                warning.style.display = 'block';
            });
            
            editNickname.addEventListener('blur', () => {
                const warning = document.getElementById('nicknameWarning');
                if (warning) {
                    warning.style.display = 'none';
                }
            });
        }

        // ===== CHANGE PASSWORD FORM =====
        setupPasswordVisibilityToggles();

        const changePasswordForm = document.getElementById('changePasswordForm');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const result = await AuthAPI.changePassword(
                        document.getElementById('currentPassword').value,
                        document.getElementById('newPassword').value,
                        document.getElementById('confirmPassword').value
                    );

                    if (result.success) {
                        // Fechar modal
                        document.getElementById('editModal').style.display = 'none';
                        changePasswordForm.reset();
                        document.getElementById('currentPassword').type = 'password';
                        document.getElementById('newPassword').type = 'password';
                        document.getElementById('confirmPassword').type = 'password';
                        setupPasswordVisibilityToggles();
                        document.getElementById('passwordError').textContent = '';
                        showNotification('Senha alterada com sucesso!', 'success');
                    } else {
                        document.getElementById('passwordError').textContent = 'Erro: ' + (result.message || 'Erro desconhecido');
                    }
                } catch (err) {
                    document.getElementById('passwordError').textContent = 'Erro ao alterar senha';
                    console.error(err);
                }
            });
        }

        // ===== AVATAR UPLOAD =====
        const removeAvatarBtn = document.getElementById('removeAvatarBtn');
        if (removeAvatarBtn) {
            removeAvatarBtn.addEventListener('click', removeCurrentAvatar);
        }

        const avatarUploadTrigger = document.getElementById('avatarUploadTriggerBtn') || document.querySelector('.avatar-arc-upload');
        if (avatarUploadTrigger && avatarUploadTrigger.dataset.boundAvatarUploadTrigger !== '1') {
            avatarUploadTrigger.dataset.boundAvatarUploadTrigger = '1';
            avatarUploadTrigger.addEventListener('click', handleAvatarUploadTriggerClick);
        }

        const avatarContainer = document.getElementById('profileAvatar');
        if (avatarContainer && avatarContainer.dataset.boundAvatarClick !== '1') {
            avatarContainer.dataset.boundAvatarClick = '1';
            avatarContainer.addEventListener('click', () => {
                if (!currentUser?.avatar) {
                    handleAvatarUploadTriggerClick();
                }
            });
        }

        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const validationError = getAvatarFileValidationError(file);
                if (validationError) {
                    showNotification(validationError, 'error');
                    e.target.value = '';
                    return;
                }

                const opened = openAvatarAdjustModal(file, e.target);
                if (!opened) {
                    showNotification('Erro ao abrir editor do avatar.', 'error');
                    e.target.value = '';
                }
            });
        }

        // ===== BANNER UPLOAD =====
        const removeBannerBtn = document.getElementById('removeBannerBtn');
        if (removeBannerBtn) {
            removeBannerBtn.addEventListener('click', removeCurrentBanner);
        }

        const bannerUploadTrigger = document.querySelector('.banner-arc-upload');
        if (bannerUploadTrigger && bannerUploadTrigger.dataset.boundBannerUploadTrigger !== '1') {
            bannerUploadTrigger.dataset.boundBannerUploadTrigger = '1';
            bannerUploadTrigger.addEventListener('click', handleBannerUploadTriggerClick);
        }

        const bannerInput = document.getElementById('bannerInput');
        if (bannerInput) {
            bannerInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const mimeType = String(file.type || '').toLowerCase();

                if (!BANNER_ALLOWED_MIME_TYPES.has(mimeType)) {
                    showNotification('Banner: envie PNG, JPG, WEBP ou GIF.', 'error');
                    e.target.value = '';
                    return;
                }

                if (file.size > BANNER_MAX_FILE_BYTES) {
                    showNotification('Banner muito grande. Limite de 15MB.', 'error');
                    e.target.value = '';
                    return;
                }

                const opened = openBannerAdjustModal(file, e.target);
                if (!opened) {
                    showNotification('Erro ao abrir editor do banner.', 'error');
                    e.target.value = '';
                }
            });
        }

        // Logout da navbar e gerenciado globalmente no auth-manager.js

        // ===== TOGGLE EMAIL VISIBILITY =====
        const toggleEmailBtn = document.getElementById('toggleEmailBtn');
        if (toggleEmailBtn) {
            toggleEmailBtn.addEventListener('click', () => {
                const emailDisplay = document.getElementById('profileEmail');
                const normalizedEmail = String(currentUser?.email || '').trim();
                if (!normalizedEmail) {
                    emailDisplay.textContent = 'E-mail não informado';
                    emailDisplay.setAttribute('data-hidden', 'false');
                    syncEmailToggleButton();
                    return;
                }
                const isHidden = emailDisplay.getAttribute('data-hidden') === 'true';
                
                if (isHidden) {
                    emailDisplay.textContent = normalizedEmail;
                    emailDisplay.setAttribute('data-hidden', 'false');
                } else {
                    emailDisplay.textContent = '*'.repeat(normalizedEmail.length);
                    emailDisplay.setAttribute('data-hidden', 'true');
                }

                syncEmailToggleButton();
            });
        }

        // ===== ADMIN BUTTON =====
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn && adminBtn.style.display !== 'none') {
            adminBtn.addEventListener('click', () => {
                window.location.href = 'admin.html';
            });
        }

        initializeTwoFactorControls();

        const showAdultPostsToggle = document.getElementById('showAdultPostsToggle');
        if (showAdultPostsToggle && showAdultPostsToggle.dataset.adultToggleBound !== '1') {
            showAdultPostsToggle.dataset.adultToggleBound = '1';
            showAdultPostsToggle.addEventListener('change', handleAdultPostsToggleChange);
        }

        console.log('Event listeners attached successfully');
    } catch (err) {
        console.warn('Error attaching listeners:', err.message);
    }
}

function updateTaglineCount({ keepFocus = false } = {}) {
    const { inputEl, richEl } = getTaglineEditorElements();
    const taglineCount = document.getElementById('taglineCount');

    const rawValue = getTaglineEditorRawValue({ normalize: false });
    const visibleLength = getProfileTaglineVisibleLength(rawValue);

    if (inputEl) {
        inputEl.value = rawValue;
    }

    if (taglineCount) {
        taglineCount.textContent = `${visibleLength}/${PROFILE_TAGLINE_MAX_LENGTH}`;
        taglineCount.style.color = visibleLength > PROFILE_TAGLINE_MAX_LENGTH
            ? '#FCA5A5'
            : '';
    }

    if (keepFocus) {
        focusTaglineEditorAtEnd();
    }

    return rawValue;
}

function applyRandomProfileTagline() {
    if (PROFILE_TAGLINE_SUGGESTIONS.length === 0) {
        return;
    }

    const randomIndex = Math.floor(Math.random() * PROFILE_TAGLINE_SUGGESTIONS.length);
    renderTaglineEditorFromRaw(PROFILE_TAGLINE_SUGGESTIONS[randomIndex]);
    updateTaglineCount();
}

function closeTaglineLinkModal(result = null) {
    const modal = document.getElementById('taglineLinkModal');
    const urlInput = document.getElementById('taglineLinkUrlInput');
    const errorEl = document.getElementById('taglineLinkModalError');

    if (modal) {
        modal.style.display = 'none';
    }
    if (urlInput) {
        urlInput.value = '';
    }
    if (errorEl) {
        errorEl.textContent = '';
    }

    if (typeof taglineLinkModalResolver === 'function') {
        taglineLinkModalResolver(result);
        taglineLinkModalResolver = null;
    }
}

function openTaglineLinkModal(selectedText) {
    const modal = document.getElementById('taglineLinkModal');
    const selectedTextEl = document.getElementById('taglineLinkSelectedText');
    const urlInput = document.getElementById('taglineLinkUrlInput');
    const errorEl = document.getElementById('taglineLinkModalError');

    if (!modal || !selectedTextEl || !urlInput || !errorEl) {
        return Promise.resolve(null);
    }

    if (typeof taglineLinkModalResolver === 'function') {
        taglineLinkModalResolver(null);
        taglineLinkModalResolver = null;
    }

    selectedTextEl.textContent = String(selectedText || '').trim();
    urlInput.value = 'https://';
    errorEl.textContent = '';
    modal.style.display = 'block';

    setTimeout(() => {
        urlInput.focus();
        urlInput.select();
    }, 0);

    return new Promise((resolve) => {
        taglineLinkModalResolver = resolve;
    });
}

function bindTaglineLinkModalEvents() {
    const modal = document.getElementById('taglineLinkModal');
    if (!modal || modal.dataset.boundTaglineLinkModal === '1') return;
    modal.dataset.boundTaglineLinkModal = '1';

    const closeBtn = document.getElementById('closeTaglineLinkModalBtn');
    const cancelBtn = document.getElementById('taglineLinkCancelBtn');
    const applyBtn = document.getElementById('taglineLinkApplyBtn');
    const urlInput = document.getElementById('taglineLinkUrlInput');
    const errorEl = document.getElementById('taglineLinkModalError');

    const submit = () => {
        const rawUrl = String(urlInput?.value || '').trim();
        if (!rawUrl) {
            if (errorEl) errorEl.textContent = 'Digite a URL do link.';
            return;
        }
        closeTaglineLinkModal(rawUrl);
    };

    closeBtn?.addEventListener('click', () => closeTaglineLinkModal(null));
    cancelBtn?.addEventListener('click', () => closeTaglineLinkModal(null));
    applyBtn?.addEventListener('click', submit);
    urlInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (modal.style.display !== 'block') return;
        closeTaglineLinkModal(null);
    });
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeTaglineLinkModal(null);
        }
    });
}

async function insertProfileTaglineLink() {
    if (!userCanUseProfileTaglineLinks()) {
        showNotification('Você ainda não desbloqueou links na frase do perfil.', 'error');
        return;
    }

    const { richEl } = getTaglineEditorElements();
    if (!richEl) return;

    const rawRange = getTaglineEditorSelectionRange();
    if (!rawRange) {
        showNotification('Selecione uma palavra ou trecho da frase antes de inserir o link.', 'error');
        return;
    }

    const selectedTextRaw = normalizeTaglineSelectionText(taglineLinkSelectionText || rawRange.toString());
    const range = adjustTaglineSelectionRangeToText(rawRange, selectedTextRaw);

    richEl.focus();
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }

    taglineLinkSelectionRange = null;
    taglineLinkSelectionText = null;
    taglineLinkSelectionStart = null;
    taglineLinkSelectionEnd = null;

    const selectedText = sanitizeSelectedTaglineLinkLabel(selectedTextRaw);

    if (!selectedText) {
        showNotification('Selecione uma palavra ou trecho da frase antes de inserir o link.', 'error');
        richEl.focus();
        return;
    }

    const inputUrl = await openTaglineLinkModal(selectedText);
    if (inputUrl === null) return;

    const href = normalizeTaglineHref(inputUrl);
    if (!href) {
        showNotification('Link inválido. Use URL iniciando com http(s):// ou www.', 'error');
        richEl.focus();
        return;
    }

    const replacement = /\s/.test(selectedText)
        ? `[${selectedText}](${href})`
        : `${selectedText}(${href})`;
    const previousHtml = richEl.innerHTML;

    const anchorEl = document.createElement('a');
    anchorEl.href = href;
    anchorEl.target = '_blank';
    anchorEl.rel = 'noopener noreferrer';

    const extracted = range.extractContents();
    if (extracted.childNodes.length === 0) {
        anchorEl.textContent = selectedText;
    } else {
        anchorEl.appendChild(extracted);
    }

    range.insertNode(anchorEl);
    range.setStartAfter(anchorEl);
    range.collapse(true);
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }

    const nextRaw = getTaglineEditorRawValue({ normalize: false });
    if (getProfileTaglineVisibleLength(nextRaw) > PROFILE_TAGLINE_MAX_LENGTH) {
        richEl.innerHTML = previousHtml;
        updateTaglineCount({ keepFocus: true });
        showNotification(`A frase visível com link passa de ${PROFILE_TAGLINE_MAX_LENGTH} caracteres.`, 'error');
        return;
    }

    updateTaglineCount({ keepFocus: true });
}

function getMissionStatusLabel(mission) {
    if (mission?.completed) return 'Concluída';
    if (mission?.accepted) return 'Em andamento';
    if (!mission?.unlocked) return 'Bloqueada';
    return 'Disponível';
}

function getMissionStatusClass(mission) {
    if (mission?.completed) return 'status-completed';
    if (mission?.accepted) return 'status-accepted';
    if (!mission?.unlocked) return 'status-locked';
    return 'status-open';
}

function renderUserMissions(payload = {}) {
    const missionsList = document.getElementById('missionsList');
    const missionsSummary = document.getElementById('missionsSummary');
    const missionsBtn = document.getElementById('missionsBtn');
    if (!missionsList || !missionsSummary) return;

    const missions = Array.isArray(payload?.missions) ? payload.missions : [];
    userMissionsState = missions;

    const completedCount = missions.filter((mission) => Boolean(mission?.completed)).length;
    const totalCount = missions.length;
    missionsSummary.textContent = `${completedCount}/${totalCount} concluídas`;
    if (missionsBtn) {
        missionsBtn.textContent = 'Missões';
    }

    if (!missions.length) {
        missionsList.innerHTML = '<p class="missions-empty">Nenhuma missão disponível agora.</p>';
        return;
    }

    missionsList.innerHTML = missions.map((mission) => {
        const current = Number(mission?.progress?.current || 0);
        const target = Math.max(Number(mission?.progress?.target || 0), 1);
        const progressPercent = Math.max(0, Math.min(100, (current / target) * 100));
        const isLocked = !mission?.unlocked;
        const isAccepted = Boolean(mission?.accepted);
        const isCompleted = Boolean(mission?.completed);
        const cardClasses = [
            'mission-card',
            isLocked ? 'is-locked' : '',
            isAccepted && !isCompleted ? 'is-accepted' : '',
            isCompleted ? 'is-completed' : ''
        ].filter(Boolean).join(' ');
        const buttonText = isCompleted ? 'Recompensa entregue' : isAccepted ? 'Missão aceita' : 'Aceitar missão';
        const unlockHint = isLocked
            ? `<p class="mission-unlock-hint">Desbloqueia ao concluir ${Number(mission?.unlockCompletedCount || 0)} missão(ões).</p>`
            : '';

        return `
            <article class="${cardClasses}">
                <div class="mission-card-top">
                    <div>
                        <h3 class="mission-card-title">${escapeHtml(mission?.title || 'Missão')}</h3>
                        <p class="mission-card-description">${escapeHtml(mission?.description || '')}</p>
                    </div>
                    <span class="mission-status ${getMissionStatusClass(mission)}">${getMissionStatusLabel(mission)}</span>
                </div>
                <div class="mission-meta">
                    <span class="mission-meta-badge">Objetivo: ${escapeHtml(mission?.requirementLabel || '')}</span>
                    <span class="mission-meta-badge">Recompensa: ${escapeHtml(mission?.rewardLabel || '')}</span>
                </div>
                <div class="mission-progress-row">
                    <span>Progresso</span>
                    <span>${current}/${target}</span>
                </div>
                <div class="mission-progress-bar">
                    <div class="mission-progress-fill" style="width: ${progressPercent.toFixed(2)}%;"></div>
                </div>
                ${mission?.progress?.detail ? `<p class="mission-detail">${escapeHtml(mission.progress.detail)}</p>` : ''}
                ${unlockHint}
                <div class="mission-card-actions">
                    <button
                        type="button"
                        class="mission-accept-btn"
                        data-mission-key="${escapeHtml(mission?.key || '')}"
                        ${isLocked || isAccepted || isCompleted ? 'disabled' : ''}
                    >${buttonText}</button>
                </div>
            </article>
        `;
    }).join('');

    missionsList.querySelectorAll('.mission-accept-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const missionKey = String(button.dataset.missionKey || '').trim();
            if (!missionKey) return;
            await acceptUserMission(missionKey, button);
        });
    });
}

async function loadUserMissions() {
    const missionsList = document.getElementById('missionsList');
    if (missionsList) {
        missionsList.innerHTML = '<p class="missions-loading">Carregando missões...</p>';
    }

    const result = await AuthAPI.getUserMissions();
    if (!result?.success) {
        if (missionsList) {
            missionsList.innerHTML = `<p class="missions-empty">${escapeHtml(result?.message || 'Não foi possível carregar as missões.')}</p>`;
        }
        return;
    }

    applyMissionRewardPermissions(result.permissions || {});
    renderUserMissions(result);
}

async function acceptUserMission(missionKey, buttonEl = null) {
    if (!missionKey) return;
    if (buttonEl) buttonEl.disabled = true;

    try {
        const result = await AuthAPI.acceptUserMission(missionKey);
        if (!result?.success) {
            showNotification(result?.message || 'Não foi possível aceitar a missão.', 'error');
            await loadUserMissions();
            return;
        }

        applyMissionRewardPermissions(result.permissions || {});
        renderUserMissions(result);
        if (Boolean(result?.permissions?.canOrderFixedRanks) || Boolean(result?.permissions?.canChangeRankColor)) {
            refreshProfileRankColors().catch((error) => {
                console.error('Erro ao atualizar conquistas após missão:', error);
            });
        }
        showNotification(result?.message || 'Missão aceita com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao aceitar missão:', error);
        showNotification('Erro ao aceitar missão.', 'error');
    } finally {
        if (buttonEl && !buttonEl.isConnected) return;
        if (buttonEl) buttonEl.disabled = false;
    }
}

function clearProfileTagline() {
    const { inputEl, richEl } = getTaglineEditorElements();
    if (!inputEl && !richEl) {
        return;
    }
    renderTaglineEditorFromRaw('');
    updateTaglineCount();
}

async function checkAdminPanelAccess() {
    try {
        console.log('[PROFILE] Checking admin panel access...');
        const result = await AuthAPI.checkAdminPermission();
        console.log('[PROFILE] Admin permission response:', result);
        
        if (result && result.success && result.hasAccess) {
            console.log('[PROFILE] User has admin access! Showing button...');
            // Mostrar botão de painel admin que já existe no HTML
            const adminBtn = document.getElementById('adminBtn');
            
            if (adminBtn) {
                adminBtn.style.display = 'block';
                adminBtn.textContent = result.isAdmin ? 'Painel Admin' : 'S-Admin';
                adminBtn.addEventListener('click', () => {
                    window.location.href = 'admin.html';
                });
                console.log('[PROFILE] Admin panel button shown successfully');
            } else {
                console.warn('[PROFILE] #adminBtn not found in DOM');
            }
        } else {
            console.log('[PROFILE] User does not have admin access', {
                success: result?.success,
                hasAccess: result?.hasAccess
            });
        }
    } catch (error) {
        console.error('[PROFILE] Error checking admin access:', error);
    }
}

function userCanUseAnimatedProfile() {
    const rawValue = currentUser?.canUseAnimatedProfile;
    return rawValue === true || Number(rawValue) === 1;
}

function userCanUseProfileTaglineLinks() {
    const rawValue = currentUser?.canUseProfileTaglineLinks;
    return rawValue === true || Number(rawValue) === 1;
}

function userCanUseExclusiveAnimatedThemes() {
    const rawValue = currentUser?.canUseExclusiveAnimatedThemes;
    return rawValue === true || Number(rawValue) === 1;
}

function userCanUseAnimatedProfileCustomGif() {
    const rawValue = currentUser?.canUseAnimatedProfileCustomGif;
    return rawValue === true || Number(rawValue) === 1;
}

function syncProfileMissionRewardsUi() {
    syncAnimatedProfileButton();

    const insertTaglineLinkBtn = document.getElementById('insertTaglineLinkBtn');
    if (insertTaglineLinkBtn) {
        insertTaglineLinkBtn.style.display = userCanUseProfileTaglineLinks() ? 'inline-flex' : 'none';
    }
}

function applyMissionRewardPermissions(permissions = {}) {
    if (!currentUser || !permissions || typeof permissions !== 'object') return;

    const knownKeys = [
        'canUseAnimatedProfile',
        'canOrderFixedRanks',
        'canChangeRankColor',
        'canUseProfileTaglineLinks',
        'canUseExclusiveAnimatedThemes',
        'canUseAnimatedProfileCustomGif'
    ];

    knownKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(permissions, key)) {
            currentUser[key] = Boolean(permissions[key]);
        }
    });

    canOrderFixedRanks = Boolean(currentUser?.canOrderFixedRanks);
    syncProfileMissionRewardsUi();
}

function normalizeAnimatedProfileTheme(themeValue) {
    const selected = String(themeValue || 'auto').trim();
    return ALLOWED_ANIMATED_PROFILE_THEMES.includes(selected) ? selected : 'auto';
}

function normalizeAnimatedProfileVisualMode(modeValue) {
    const selected = String(modeValue || 'theme').trim().toLowerCase();
    return ALLOWED_ANIMATED_VISUAL_MODES.includes(selected) ? selected : 'theme';
}

function normalizeAnimatedProfileGifUrl(urlValue) {
    const raw = String(urlValue || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return resolveMediaUrl(raw, '');
    return '';
}

function hashAnimatedThemeSeed(value) {
    const raw = String(value || '');
    let hash = 0;
    for (let i = 0; i < raw.length; i += 1) {
        hash = (hash * 31 + raw.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function resolveAnimatedPreviewTheme(themeValue) {
    const normalized = normalizeAnimatedProfileTheme(themeValue);
    if (normalized !== 'auto') return normalized;

    const variants = ALLOWED_ANIMATED_PROFILE_THEMES.filter((item) => item !== 'auto');
    if (!variants.length) return 'theme-aurora';

    const seed = `${currentUser?.id || 0}-${currentUser?.nickname || 'guest'}`;
    const index = hashAnimatedThemeSeed(seed) % variants.length;
    return variants[index];
}

function setAnimatedPreviewGif(url) {
    const card = document.getElementById('animatedProfilePreviewCard');
    if (!card) return;
    card.querySelectorAll('.animated-profile-giphy-embed').forEach((embed) => embed.remove());
    const normalizedUrl = normalizeAnimatedProfileGifUrl(url);
    if (normalizedUrl) {
        card.style.setProperty('--preview-gif-url', `url('${normalizedUrl.replace(/'/g, "\\'")}')`);
    } else {
        card.style.removeProperty('--preview-gif-url');
    }
}

function normalizeAnimatedProfileGiphyId(value) {
    const raw = String(value || '').trim();
    return /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : '';
}

function setAnimatedPreviewGiphy(gifIdValue) {
    const card = document.getElementById('animatedProfilePreviewCard');
    if (!card) return;
    card.querySelectorAll('.animated-profile-giphy-embed').forEach((embed) => embed.remove());
    const gifId = normalizeAnimatedProfileGiphyId(gifIdValue);
    if (!gifId) return;
    const embed = document.createElement('img');
    embed.className = 'animated-profile-giphy-embed';
    embed.src = `https://media.giphy.com/media/${encodeURIComponent(gifId)}/giphy.gif`;
    embed.alt = '';
    embed.setAttribute('aria-hidden', 'true');
    embed.loading = 'lazy';
    card.prepend(embed);
}

function renderAnimatedProfilePreview(miniEnabled, themeValue, downloadEnabled = false, visualMode = 'theme', gifUrl = '', giphyId = selectedAnimatedProfileGiphyId) {
    const card = document.getElementById('animatedProfilePreviewCard');
    if (!card) return;

    const variants = ALLOWED_ANIMATED_PROFILE_THEMES.filter((item) => item !== 'auto');
    variants.forEach((themeClass) => card.classList.remove(themeClass));
    card.classList.remove('animated-profile-gif');

    const normalizedMode = normalizeAnimatedProfileVisualMode(visualMode);
    const normalizedGiphyId = normalizeAnimatedProfileGiphyId(giphyId);
    if (normalizedMode === 'gif' && normalizedGiphyId) {
        card.classList.add('animated-profile-gif', 'animated-profile-giphy');
        setAnimatedPreviewGif('');
        setAnimatedPreviewGiphy(normalizedGiphyId);
    } else if (normalizedMode === 'gif' && normalizeAnimatedProfileGifUrl(gifUrl)) {
        card.classList.add('animated-profile-gif');
        card.classList.remove('animated-profile-giphy');
        setAnimatedPreviewGif(gifUrl);
    } else {
        card.classList.remove('animated-profile-giphy');
        const resolvedTheme = resolveAnimatedPreviewTheme(themeValue);
        card.classList.add(resolvedTheme);
        setAnimatedPreviewGif('');
    }
    card.classList.toggle('preview-disabled', !miniEnabled);

    const previewName = card.querySelector('.animated-profile-preview-name');
    if (previewName) {
        previewName.textContent = `@${currentUser?.nickname || 'SeuPerfil'}`;
    }

    const previewSubtitle = card.querySelector('.animated-profile-preview-subtitle');
    if (previewSubtitle) {
        if (!miniEnabled && !downloadEnabled) {
            previewSubtitle.textContent = 'Mini perfil: desativado | Download: desativado';
        } else {
            previewSubtitle.textContent = `Mini perfil: ${miniEnabled ? 'ativo' : 'desativado'} | Download: ${downloadEnabled ? 'ativo' : 'desativado'}`;
        }
    }
}

function bindAnimatedPreviewFx() {
    const card = document.getElementById('animatedProfilePreviewCard');
    if (!card || card.dataset.fxBound === '1') return;

    const supportsPointer = (() => {
        try {
            return Boolean(window?.matchMedia?.('(pointer:fine)').matches);
        } catch {
            return false;
        }
    })();

    if (!supportsPointer) return;

    card.dataset.fxBound = '1';
    card.style.setProperty('--mx', '50%');
    card.style.setProperty('--my', '50%');
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');

    card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;
        const maxTilt = 8;
        const rotateY = ((x / rect.width) - 0.5) * (maxTilt * 2);
        const rotateX = (0.5 - (y / rect.height)) * (maxTilt * 2);

        card.style.setProperty('--mx', `${px.toFixed(2)}%`);
        card.style.setProperty('--my', `${py.toFixed(2)}%`);
        card.style.setProperty('--rx', `${rotateX.toFixed(2)}deg`);
        card.style.setProperty('--ry', `${rotateY.toFixed(2)}deg`);
        card.classList.add('fx-active');
    });

    card.addEventListener('pointerleave', () => {
        card.style.setProperty('--mx', '50%');
        card.style.setProperty('--my', '50%');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
        card.classList.remove('fx-active');
    });
}

function syncAnimatedProfileRewardOptions() {
    const themeSelect = document.getElementById('animatedProfileThemeSelect');
    const visualModeSelect = document.getElementById('animatedProfileVisualModeSelect');
    const customGifUrlInput = document.getElementById('animatedCustomGifUrl');
    const customGifFileInput = document.getElementById('animatedCustomGifFile');
    const uploadGifBtn = document.getElementById('uploadAnimatedGifBtn');
    const gifSearchInput = document.getElementById('animatedGifSearchInput');
    const gifSearchBtn = document.getElementById('animatedGifSearchBtn');
    const gifSearchMoreBtn = document.getElementById('animatedGifSearchMoreBtn');

    const canUseExclusiveThemes = userCanUseExclusiveAnimatedThemes();
    const canUseCustomGif = userCanUseAnimatedProfileCustomGif();

    if (themeSelect) {
        Array.from(themeSelect.options).forEach((option) => {
            const isExclusive = EXCLUSIVE_ANIMATED_PROFILE_THEMES.includes(String(option.value || '').trim());
            option.disabled = isExclusive && !canUseExclusiveThemes;
            option.hidden = isExclusive && !canUseExclusiveThemes;
        });

        if (!canUseExclusiveThemes && EXCLUSIVE_ANIMATED_PROFILE_THEMES.includes(themeSelect.value)) {
            themeSelect.value = 'auto';
        }
    }

    if (visualModeSelect) {
        const gifOption = Array.from(visualModeSelect.options).find((option) => String(option.value || '').trim() === 'gif');
        if (gifOption) {
            gifOption.disabled = !canUseCustomGif;
            gifOption.hidden = !canUseCustomGif;
        }

        if (!canUseCustomGif && visualModeSelect.value === 'gif') {
            visualModeSelect.value = 'theme';
        }
    }

    [customGifUrlInput, customGifFileInput, uploadGifBtn, gifSearchInput, gifSearchBtn, gifSearchMoreBtn].forEach((element) => {
        if (!element) return;
        element.disabled = !canUseCustomGif;
        element.style.opacity = canUseCustomGif ? '1' : '0.6';
    });
}

function applyAnimatedProfileThemeState(enabled) {
    const themeSelect = document.getElementById('animatedProfileThemeSelect');
    const visualModeSelect = document.getElementById('animatedProfileVisualModeSelect');
    const gifSearchInput = document.getElementById('animatedGifSearchInput');
    const gifSearchBtn = document.getElementById('animatedGifSearchBtn');
    const gifSearchMoreBtn = document.getElementById('animatedGifSearchMoreBtn');
    const customGifUrlInput = document.getElementById('animatedCustomGifUrl');
    const customGifFileInput = document.getElementById('animatedCustomGifFile');
    const uploadGifBtn = document.getElementById('uploadAnimatedGifBtn');
    const gifOptionsWrap = document.getElementById('animatedGifOptions');

    syncAnimatedProfileRewardOptions();

    const mode = normalizeAnimatedProfileVisualMode(visualModeSelect?.value);
    const canUseTheme = enabled && mode === 'theme';
    const canUseGif = enabled && mode === 'gif' && userCanUseAnimatedProfileCustomGif();

    if (visualModeSelect) {
        visualModeSelect.disabled = !enabled;
        visualModeSelect.style.opacity = enabled ? '1' : '0.6';
    }
    if (themeSelect) {
        themeSelect.disabled = !canUseTheme;
        themeSelect.style.opacity = canUseTheme ? '1' : '0.6';
    }
    if (gifOptionsWrap) {
        gifOptionsWrap.style.display = canUseGif ? 'block' : 'none';
    }
    [gifSearchInput, gifSearchBtn, gifSearchMoreBtn, customGifUrlInput, customGifFileInput, uploadGifBtn].forEach((el) => {
        if (!el) return;
        el.disabled = !canUseGif;
        el.style.opacity = canUseGif ? '1' : '0.6';
    });
}

function renderAnimatedGifSearchResults(items = [], append = false) {
    const grid = document.getElementById('animatedGifResults');
    if (!grid) return;

    if (!append) {
        grid.innerHTML = '';
    }

    if (!Array.isArray(items) || items.length === 0) {
        if (!append) {
            grid.innerHTML = '<div class="animated-gif-empty">Nenhum GIF encontrado.</div>';
        }
        return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((gif) => {
        const url = normalizeAnimatedProfileGifUrl(gif?.gifUrl);
        const preview = normalizeAnimatedProfileGifUrl(gif?.previewUrl || gif?.gifUrl);
        const gifId = normalizeAnimatedProfileGiphyId(gif?.gifId);
        if (!gifId || !url || !preview) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'animated-gif-item';
        btn.dataset.gifUrl = url;
        btn.dataset.giphyId = gifId;
        btn.innerHTML = `<img src="${preview}" alt="GIF">`;
        if (selectedAnimatedProfileGiphyId && selectedAnimatedProfileGiphyId === gifId) {
            btn.classList.add('selected');
        }
        btn.addEventListener('click', () => {
            selectedAnimatedProfileGifUrl = url;
            selectedAnimatedProfileGiphyId = gifId;
            const customGifUrlInput = document.getElementById('animatedCustomGifUrl');
            const visualModeSelect = document.getElementById('animatedProfileVisualModeSelect');
            if (customGifUrlInput) customGifUrlInput.value = '';
            if (visualModeSelect) visualModeSelect.value = 'gif';
            applyAnimatedProfileThemeState(Boolean(document.getElementById('animatedMiniProfileEnabledToggle')?.checked) || Boolean(document.getElementById('animatedDownloadCardEnabledToggle')?.checked));
            document.querySelectorAll('.animated-gif-item').forEach((item) => item.classList.remove('selected'));
            btn.classList.add('selected');
            renderAnimatedProfilePreview(
                Boolean(document.getElementById('animatedMiniProfileEnabledToggle')?.checked),
                document.getElementById('animatedProfileThemeSelect')?.value || 'auto',
                Boolean(document.getElementById('animatedDownloadCardEnabledToggle')?.checked),
                'gif',
                selectedAnimatedProfileGifUrl,
                selectedAnimatedProfileGiphyId
            );
        });
        fragment.appendChild(btn);
    });

    grid.appendChild(fragment);
}

function showAnimatedGifSearchMessage(message) {
    const grid = document.getElementById('animatedGifResults');
    if (!grid) return;
    const emptyState = document.createElement('div');
    emptyState.className = 'animated-gif-empty';
    emptyState.textContent = message;
    grid.replaceChildren(emptyState);
}

async function searchAnimatedGifs({ append = false, useTrending = false } = {}) {
    if (animatedGifSearchLoading) return;
    if (!append) animatedGifSearchUseTrending = useTrending;
    const searchInput = document.getElementById('animatedGifSearchInput');
    const searchBtn = document.getElementById('animatedGifSearchBtn');
    const moreBtn = document.getElementById('animatedGifSearchMoreBtn');
    const query = String(searchInput?.value || '').trim();

    if (!useTrending && !query) {
        showNotification('Digite um termo para buscar GIF.', 'error');
        return;
    }

    animatedGifSearchLoading = true;
    if (searchBtn) searchBtn.disabled = true;
    if (moreBtn) moreBtn.disabled = true;

    try {
        const result = useTrending
            ? await AuthAPI.getTrendingAnimatedGifs(18, append ? animatedGifSearchNextPos : '')
            : await AuthAPI.searchAnimatedGifs(query, 18, append ? animatedGifSearchNextPos : '');

        if (!result?.success) {
            const message = result?.message || 'Não foi possível buscar GIFs agora.';
            showAnimatedGifSearchMessage(message);
            showNotification(message, 'error');
            return;
        }

        animatedGifSearchNextPos = String(result.next || '');
        renderAnimatedGifSearchResults(result.results || [], append);
        if (moreBtn) {
            moreBtn.style.display = animatedGifSearchNextPos ? 'inline-flex' : 'none';
        }
    } catch (error) {
        console.error('Erro ao buscar GIFs:', error);
        const message = 'Não foi possível conectar ao GIPHY. Verifique a chave de API e a conexão.';
        showAnimatedGifSearchMessage(message);
        showNotification(message, 'error');
    } finally {
        animatedGifSearchLoading = false;
        if (searchBtn) searchBtn.disabled = false;
        if (moreBtn) moreBtn.disabled = false;
    }
}

function syncAnimatedProfileButton() {
    const animatedProfileBtn = document.getElementById('animatedProfileBtn');
    if (!animatedProfileBtn) return;
    animatedProfileBtn.style.display = userCanUseAnimatedProfile() ? 'inline-flex' : 'none';
}

async function openAnimatedProfileModal() {
    if (!userCanUseAnimatedProfile()) {
        showNotification('Você não tem permissão para usar Perfil Animado.', 'error');
        return;
    }

    const modal = document.getElementById('animatedProfileModal');
    const miniEnabledToggle = document.getElementById('animatedMiniProfileEnabledToggle');
    const downloadEnabledToggle = document.getElementById('animatedDownloadCardEnabledToggle');
    const themeSelect = document.getElementById('animatedProfileThemeSelect');
    const visualModeSelect = document.getElementById('animatedProfileVisualModeSelect');
    const customGifUrlInput = document.getElementById('animatedCustomGifUrl');
    const gifResultsGrid = document.getElementById('animatedGifResults');
    const gifSearchMoreBtn = document.getElementById('animatedGifSearchMoreBtn');
    const errorEl = document.getElementById('animatedProfileError');
    const saveBtn = document.getElementById('saveAnimatedProfileBtn');

    if (!modal || !miniEnabledToggle || !downloadEnabledToggle || !themeSelect || !visualModeSelect || !saveBtn) {
        return;
    }

    if (errorEl) errorEl.textContent = '';
    saveBtn.disabled = true;
    const originalBtnText = saveBtn.textContent;
    saveBtn.textContent = 'Carregando...';

    let miniEnabled = Boolean(currentUser?.animatedMiniProfileEnabled ?? currentUser?.animatedProfileEnabled);
    let downloadEnabled = Boolean(currentUser?.animatedDownloadCardEnabled ?? currentUser?.animatedProfileEnabled);
    let theme = normalizeAnimatedProfileTheme(currentUser?.animatedProfileTheme);
    let visualMode = normalizeAnimatedProfileVisualMode(currentUser?.animatedProfileVisualMode);
    let gifUrl = normalizeAnimatedProfileGifUrl(currentUser?.animatedProfileGifUrl);
    let giphyId = normalizeAnimatedProfileGiphyId(currentUser?.animatedProfileGiphyId);

    try {
        const result = await AuthAPI.getAnimatedProfileSettings();
        if (result?.success && result?.settings) {
            miniEnabled = Boolean(result.settings.animatedMiniProfileEnabled ?? result.settings.animatedProfileEnabled);
            downloadEnabled = Boolean(result.settings.animatedDownloadCardEnabled ?? result.settings.animatedProfileEnabled);
            theme = normalizeAnimatedProfileTheme(result.settings.animatedProfileTheme);
            visualMode = normalizeAnimatedProfileVisualMode(result.settings.animatedProfileVisualMode);
            gifUrl = normalizeAnimatedProfileGifUrl(result.settings.animatedProfileGifUrl);
            giphyId = normalizeAnimatedProfileGiphyId(result.settings.animatedProfileGiphyId);
            if (currentUser) {
                currentUser.animatedProfileEnabled = miniEnabled || downloadEnabled;
                currentUser.animatedMiniProfileEnabled = miniEnabled;
                currentUser.animatedDownloadCardEnabled = downloadEnabled;
                currentUser.animatedProfileTheme = theme;
                currentUser.animatedProfileVisualMode = visualMode;
                currentUser.animatedProfileGifUrl = gifUrl;
                currentUser.animatedProfileGiphyId = giphyId;
                if (Object.prototype.hasOwnProperty.call(result.settings, 'canUseExclusiveAnimatedThemes')) {
                    currentUser.canUseExclusiveAnimatedThemes = Boolean(result.settings.canUseExclusiveAnimatedThemes);
                }
                if (Object.prototype.hasOwnProperty.call(result.settings, 'canUseAnimatedProfileCustomGif')) {
                    currentUser.canUseAnimatedProfileCustomGif = Boolean(result.settings.canUseAnimatedProfileCustomGif);
                }
            }
        } else if (result?.message && errorEl) {
            errorEl.textContent = result.message;
        }
    } catch (error) {
        console.error('Erro ao carregar configuração de Perfil Animado:', error);
        if (errorEl) errorEl.textContent = 'Não foi possível carregar as configurações.';
    } finally {
        miniEnabledToggle.checked = miniEnabled;
        downloadEnabledToggle.checked = downloadEnabled;
        themeSelect.value = theme;
        visualModeSelect.value = visualMode;
        syncAnimatedProfileRewardOptions();
        if (!userCanUseExclusiveAnimatedThemes() && EXCLUSIVE_ANIMATED_PROFILE_THEMES.includes(themeSelect.value)) {
            themeSelect.value = 'auto';
        }
        if (!userCanUseAnimatedProfileCustomGif() && visualModeSelect.value === 'gif') {
            visualModeSelect.value = 'theme';
        }
        selectedAnimatedProfileGifUrl = gifUrl;
        selectedAnimatedProfileGiphyId = giphyId;
        if (customGifUrlInput) {
            customGifUrlInput.value = selectedAnimatedProfileGiphyId ? '' : selectedAnimatedProfileGifUrl;
        }
        animatedGifSearchNextPos = '';
        if (gifResultsGrid) gifResultsGrid.innerHTML = '';
        if (gifSearchMoreBtn) gifSearchMoreBtn.style.display = 'none';
        applyAnimatedProfileThemeState(miniEnabled || downloadEnabled);
        renderAnimatedProfilePreview(miniEnabled, theme, downloadEnabled, visualMode, selectedAnimatedProfileGifUrl, selectedAnimatedProfileGiphyId);
        bindAnimatedPreviewFx();
        saveBtn.disabled = false;
        saveBtn.textContent = originalBtnText;
    }

    modal.style.display = 'block';

    if (visualMode === 'gif') {
        await searchAnimatedGifs({ append: false, useTrending: true });
    }
}

async function saveAnimatedProfileSettings() {
    if (!userCanUseAnimatedProfile()) {
        showNotification('Você não tem permissão para usar Perfil Animado.', 'error');
        return;
    }

    const miniEnabledToggle = document.getElementById('animatedMiniProfileEnabledToggle');
    const downloadEnabledToggle = document.getElementById('animatedDownloadCardEnabledToggle');
    const themeSelect = document.getElementById('animatedProfileThemeSelect');
    const visualModeSelect = document.getElementById('animatedProfileVisualModeSelect');
    const customGifUrlInput = document.getElementById('animatedCustomGifUrl');
    const saveBtn = document.getElementById('saveAnimatedProfileBtn');
    const errorEl = document.getElementById('animatedProfileError');

    if (!miniEnabledToggle || !downloadEnabledToggle || !themeSelect || !visualModeSelect || !saveBtn) {
        return;
    }

    const animatedMiniProfileEnabled = Boolean(miniEnabledToggle.checked);
    const animatedDownloadCardEnabled = Boolean(downloadEnabledToggle.checked);
    const animatedProfileEnabled = animatedMiniProfileEnabled || animatedDownloadCardEnabled;
    const animatedProfileTheme = normalizeAnimatedProfileTheme(themeSelect.value);
    const animatedProfileVisualMode = normalizeAnimatedProfileVisualMode(visualModeSelect.value);
    const animatedProfileGiphyId = animatedProfileVisualMode === 'gif'
        ? normalizeAnimatedProfileGiphyId(selectedAnimatedProfileGiphyId)
        : '';
    const gifUrlFromInput = normalizeAnimatedProfileGifUrl(customGifUrlInput?.value || selectedAnimatedProfileGifUrl);
    const animatedProfileGifUrl = animatedProfileVisualMode === 'gif' && !animatedProfileGiphyId ? gifUrlFromInput : '';

    if (!userCanUseExclusiveAnimatedThemes() && EXCLUSIVE_ANIMATED_PROFILE_THEMES.includes(animatedProfileTheme)) {
        if (errorEl) errorEl.textContent = 'Esse tema exclusivo ainda não foi desbloqueado.';
        return;
    }

    if (!userCanUseAnimatedProfileCustomGif() && animatedProfileVisualMode === 'gif') {
        if (errorEl) errorEl.textContent = 'Você ainda não desbloqueou GIF próprio no perfil animado.';
        return;
    }

    if (animatedProfileVisualMode === 'gif' && !animatedProfileGifUrl && !animatedProfileGiphyId) {
        if (errorEl) errorEl.textContent = 'Escolha um GIF (busca, URL ou upload) antes de salvar.';
        return;
    }

    if (errorEl) errorEl.textContent = '';
    saveBtn.disabled = true;
    const originalBtnText = saveBtn.textContent;
    saveBtn.textContent = 'Salvando...';

    try {
        const result = await AuthAPI.updateAnimatedProfileSettings({
            animatedProfileEnabled,
            animatedMiniProfileEnabled,
            animatedDownloadCardEnabled,
            animatedProfileTheme,
            animatedProfileVisualMode,
            animatedProfileGifUrl,
            animatedProfileGiphyId
        });
        if (result?.success) {
            if (currentUser) {
                currentUser.animatedProfileEnabled = animatedProfileEnabled;
                currentUser.animatedMiniProfileEnabled = animatedMiniProfileEnabled;
                currentUser.animatedDownloadCardEnabled = animatedDownloadCardEnabled;
                currentUser.animatedProfileTheme = animatedProfileTheme;
                currentUser.animatedProfileVisualMode = animatedProfileVisualMode;
                currentUser.animatedProfileGifUrl = animatedProfileGifUrl;
                currentUser.animatedProfileGiphyId = animatedProfileGiphyId;
            }
            showNotification('Perfil animado atualizado com sucesso!', 'success');
            const modal = document.getElementById('animatedProfileModal');
            if (modal) modal.style.display = 'none';
            // Aguarda um pouco e depois recarrega a página para refletir as mudanças
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            return;
        }
        if (errorEl) errorEl.textContent = result?.message || 'Não foi possível salvar as configurações.';
    } catch (error) {
        console.error('Erro ao salvar configuração de Perfil Animado:', error);
        if (errorEl) errorEl.textContent = 'Erro ao salvar configuração.';
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalBtnText;
    }
}

function showError(message) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('profileContent').style.display = 'block';
    document.getElementById('profileContent').innerHTML = `<p style="color: red; text-align: center; margin-top: 50px;">${message}</p>`;
}

function getTwoFactorElements() {
    return {
        statusBadge: document.getElementById('twoFactorStatusBadge'),
        setupBtn: document.getElementById('setupTwoFactorBtn'),
        settingsRow: document.getElementById('twoFactorSettingsRow'),
        rememberDaysSelect: document.getElementById('twoFactorRememberDays'),
        saveSettingsBtn: document.getElementById('saveTwoFactorSettingsBtn'),
        setupPanel: document.getElementById('twoFactorSetupPanel'),
        enableCodeInput: document.getElementById('twoFactorEnableCode'),
        enableBtn: document.getElementById('enableTwoFactorBtn'),
        disablePanel: document.getElementById('twoFactorDisablePanel'),
        showDisableFormBtn: document.getElementById('showDisableTwoFactorFormBtn'),
        disableFormWrap: document.getElementById('disableTwoFactorFormWrap'),
        disableCodeInput: document.getElementById('twoFactorDisableCode'),
        disableBtn: document.getElementById('disableTwoFactorBtn'),
        generateQrBtn: document.getElementById('generateTwoFactorQrBtn'),
        qrWrap: document.getElementById('twoFactorQrWrap'),
        qrImage: document.getElementById('twoFactorQrImage'),
        error: document.getElementById('twoFactorError')
    };
}

function resetTwoFactorMessages() {
    const els = getTwoFactorElements();
    if (els.error) {
        els.error.textContent = '';
    }
}

function setTwoFactorError(message) {
    const els = getTwoFactorElements();
    if (!els.error) return;
    els.error.textContent = String(message || '');
}

function showDisableTwoFactorForm() {
    const els = getTwoFactorElements();
    if (els.disableFormWrap) {
        els.disableFormWrap.style.display = 'block';
    }
    if (els.showDisableFormBtn) {
        els.showDisableFormBtn.style.display = 'none';
    }
    if (els.disableCodeInput) {
        els.disableCodeInput.focus();
    }
}

function hideDisableTwoFactorForm() {
    const els = getTwoFactorElements();
    if (els.disableFormWrap) {
        els.disableFormWrap.style.display = 'none';
    }
    if (els.showDisableFormBtn) {
        els.showDisableFormBtn.style.display = 'block';
    }
    if (els.disableCodeInput) {
        els.disableCodeInput.value = '';
    }
}

function clearTwoFactorQr() {
    const els = getTwoFactorElements();
    if (els.qrWrap) els.qrWrap.style.display = 'none';
    if (els.qrImage) els.qrImage.removeAttribute('src');
}

async function renderTwoFactorQr() {
    const els = getTwoFactorElements();
    const uri = String(currentTwoFactorOtpAuthUri || '').trim();
    if (!uri) {
        clearTwoFactorQr();
        return;
    }
    resetTwoFactorMessages();
    if (!els.qrWrap || !els.qrImage) return;

    // Fallback quando a lib externa e bloqueada pelo navegador/AdBlock.
    if (!window.QRCode || typeof window.QRCode.toDataURL !== 'function') {
        const fallbackUrl = `https://quickchart.io/qr?size=220&text=${encodeURIComponent(uri)}`;
        els.qrImage.onerror = () => {
            setTwoFactorError('Não foi possível carregar o QR. Tente novamente ou use o login por e-mail.');
        };
        els.qrImage.src = fallbackUrl;
        els.qrWrap.style.display = 'flex';
        return;
    }

    try {
        const qrDataUrl = await window.QRCode.toDataURL(uri, {
            width: 220,
            margin: 1,
            color: {
                dark: '#1A1338',
                light: '#FFFFFF'
            }
        });
        els.qrImage.src = qrDataUrl;
        els.qrWrap.style.display = 'flex';
    } catch (error) {
        console.error('Erro ao gerar QR do 2FA:', error);
        setTwoFactorError('Não foi possível gerar o QR Code. Tente novamente em alguns segundos.');
    }
}

function applyTwoFactorStatus(enabled) {
    const els = getTwoFactorElements();
    const isEnabled = Boolean(enabled);

    if (els.statusBadge) {
        els.statusBadge.textContent = isEnabled ? 'Ativado' : 'Desativado';
        els.statusBadge.classList.remove('on', 'off');
        els.statusBadge.classList.add(isEnabled ? 'on' : 'off');
    }

    if (els.setupBtn) {
        els.setupBtn.style.display = isEnabled ? 'none' : 'block';
    }
    if (els.settingsRow) {
        els.settingsRow.style.display = isEnabled ? 'flex' : 'none';
    }
    if (els.rememberDaysSelect) {
        els.rememberDaysSelect.disabled = !isEnabled;
    }
    if (els.saveSettingsBtn) {
        els.saveSettingsBtn.disabled = !isEnabled;
        els.saveSettingsBtn.style.opacity = isEnabled ? '1' : '0.6';
        els.saveSettingsBtn.style.cursor = isEnabled ? 'pointer' : 'not-allowed';
    }
    if (els.setupPanel) {
        els.setupPanel.style.display = 'none';
    }
    currentTwoFactorSetupSecret = '';
    currentTwoFactorOtpAuthUri = '';
    clearTwoFactorQr();
    if (els.enableCodeInput) els.enableCodeInput.value = '';
    if (els.disableCodeInput) els.disableCodeInput.value = '';
    if (els.disablePanel) {
        els.disablePanel.style.display = isEnabled ? 'block' : 'none';
    }
    hideDisableTwoFactorForm();
}

async function loadTwoFactorStatus() {
    const els = getTwoFactorElements();
    if (!els.statusBadge) return;

    try {
        const result = await AuthAPI.getTwoFactorStatus();
        if (result?.success) {
            applyTwoFactorStatus(Boolean(result.enabled));
            if (els.rememberDaysSelect) {
                const dayOptions = Array.isArray(result.rememberDayOptions) && result.rememberDayOptions.length > 0
                    ? result.rememberDayOptions
                    : [0, 3, 7, 30, 90];
                const normalizedOptions = dayOptions
                    .map((item) => Number(item))
                    .filter((item) => Number.isFinite(item));

                if (normalizedOptions.length > 0) {
                    els.rememberDaysSelect.innerHTML = normalizedOptions
                        .map((days) => days === 0
                            ? '<option value="0">Desativado</option>'
                            : `<option value="${days}">${days} dias</option>`)
                        .join('');
                }

                const selectedDays = Number(result.rememberDays || 3);
                els.rememberDaysSelect.value = String(
                    normalizedOptions.includes(selectedDays) ? selectedDays : (normalizedOptions[0] || 3)
                );
            }
        }
    } catch (error) {
        console.error('Erro ao carregar status 2FA:', error);
    }
}

async function saveTwoFactorSettings() {
    resetTwoFactorMessages();
    const els = getTwoFactorElements();
    const rememberDays = Number(els.rememberDaysSelect?.value || 3);
    if (!Number.isFinite(rememberDays)) {
        setTwoFactorError('Escolha um prazo v\u00e1lido.');
        return;
    }

    try {
        const result = await AuthAPI.updateTwoFactorSettings(rememberDays);
        if (result?.success) {
            if (els.rememberDaysSelect && result.rememberDays !== undefined && result.rememberDays !== null) {
                els.rememberDaysSelect.value = String(result.rememberDays);
            }
            const selectedValue = Number(result?.rememberDays ?? rememberDays);
            if (selectedValue === 0) {
                showNotification('2FA configurado para solicitar código em todo login.', 'success');
            } else {
                showNotification(`2FA configurado para pedir novo código a cada ${selectedValue} dia(s).`, 'success');
            }
            return;
        }
        setTwoFactorError(result?.message || 'Não foi possível salvar o prazo do 2FA.');
    } catch (error) {
        console.error('Erro ao salvar prazo do 2FA:', error);
        setTwoFactorError('Erro ao salvar prazo do 2FA.');
    }
}

async function setupTwoFactor() {
    resetTwoFactorMessages();
    const els = getTwoFactorElements();
    if (!els.setupPanel) return;

    const setupPanelVisible = getComputedStyle(els.setupPanel).display !== 'none';
    if (setupPanelVisible && currentTwoFactorSetupSecret) {
        if (els.enableCodeInput) {
            els.enableCodeInput.focus();
        }
        return;
    }

    try {
        const result = await AuthAPI.setupTwoFactor();
        if (!result?.success) {
            setTwoFactorError(result?.message || 'Erro ao iniciar configuração do 2FA');
            return;
        }

        currentTwoFactorSetupSecret = String(result.secret || '').trim();
        if (!currentTwoFactorSetupSecret) {
            setTwoFactorError('Falha ao gerar chave do Authenticator.');
            return;
        }
        currentTwoFactorOtpAuthUri = String(result.otpauthUri || '').trim();

        els.setupPanel.style.display = 'block';
        clearTwoFactorQr();
        if (els.enableCodeInput) {
            els.enableCodeInput.value = '';
            els.enableCodeInput.focus();
        }
    } catch (error) {
        console.error('Erro ao configurar 2FA:', error);
        setTwoFactorError('Erro ao iniciar configuração do 2FA');
    }
}

async function enableTwoFactor() {
    resetTwoFactorMessages();
    const els = getTwoFactorElements();
    const code = String(els.enableCodeInput?.value || '').replace(/\s+/g, '').trim();
    if (!/^\d{6}$/.test(code)) {
        setTwoFactorError('Digite o código de 6 d\u00edgitos do Authenticator.');
        return;
    }

    try {
        const result = await AuthAPI.enableTwoFactor(code);
        if (result?.success) {
            currentTwoFactorSetupSecret = '';
            currentTwoFactorOtpAuthUri = '';
            clearTwoFactorQr();
            if (els.setupPanel) els.setupPanel.style.display = 'none';
            if (els.enableCodeInput) els.enableCodeInput.value = '';
            showNotification('2FA ativado com sucesso!', 'success');
            await loadTwoFactorStatus();
            return;
        }
        setTwoFactorError(result?.message || 'Não foi possível ativar o 2FA.');
    } catch (error) {
        console.error('Erro ao ativar 2FA:', error);
        setTwoFactorError('Erro ao ativar 2FA.');
    }
}

async function disableTwoFactor() {
    resetTwoFactorMessages();
    const els = getTwoFactorElements();
    const code = String(els.disableCodeInput?.value || '').replace(/\s+/g, '').trim();
    if (!/^\d{6}$/.test(code)) {
        setTwoFactorError('Digite um código v\u00e1lido de 6 d\u00edgitos para desativar.');
        return;
    }

    try {
        const result = await AuthAPI.disableTwoFactor(code);
        if (result?.success) {
            currentTwoFactorSetupSecret = '';
            currentTwoFactorOtpAuthUri = '';
            clearTwoFactorQr();
            hideDisableTwoFactorForm();
            showNotification('2FA desativado com sucesso.', 'success');
            await loadTwoFactorStatus();
            return;
        }
        setTwoFactorError(result?.message || 'Não foi possível desativar o 2FA.');
    } catch (error) {
        console.error('Erro ao desativar 2FA:', error);
        setTwoFactorError('Erro ao desativar 2FA.');
    }
}

function initializeTwoFactorControls() {
    const els = getTwoFactorElements();
    if (!els.statusBadge) return;

    if (els.setupBtn && els.setupBtn.dataset.bound2fa !== '1') {
        els.setupBtn.dataset.bound2fa = '1';
        els.setupBtn.addEventListener('click', setupTwoFactor);
    }

    if (els.enableBtn && els.enableBtn.dataset.bound2fa !== '1') {
        els.enableBtn.dataset.bound2fa = '1';
        els.enableBtn.addEventListener('click', enableTwoFactor);
    }

    if (els.saveSettingsBtn && els.saveSettingsBtn.dataset.bound2fa !== '1') {
        els.saveSettingsBtn.dataset.bound2fa = '1';
        els.saveSettingsBtn.addEventListener('click', saveTwoFactorSettings);
    }

    if (els.disableBtn && els.disableBtn.dataset.bound2fa !== '1') {
        els.disableBtn.dataset.bound2fa = '1';
        els.disableBtn.addEventListener('click', disableTwoFactor);
    }

    if (els.showDisableFormBtn && els.showDisableFormBtn.dataset.bound2fa !== '1') {
        els.showDisableFormBtn.dataset.bound2fa = '1';
        els.showDisableFormBtn.addEventListener('click', () => {
            resetTwoFactorMessages();
            showDisableTwoFactorForm();
        });
    }

    if (els.generateQrBtn && els.generateQrBtn.dataset.bound2fa !== '1') {
        els.generateQrBtn.dataset.bound2fa = '1';
        els.generateQrBtn.addEventListener('click', async () => {
            resetTwoFactorMessages();
            if (!currentTwoFactorOtpAuthUri) {
                setTwoFactorError('Clique em "Configurar Authenticator" para gerar uma nova chave primeiro.');
                return;
            }
            await renderTwoFactorQr();
        });
    }
}
// ========== MINHAS CONQUISTAS E POSTAGENS ==========

function detectRankGroup(rank) {
    if (!rank) return '';
    const explicit = String(rank.rankGroup || '').trim();
    if (explicit) return explicit;
    const icon = String(rank.icon || '').trim().toUpperCase();
    if (/^P\d+/.test(icon)) return 'post_achievement';
    if (/^L\d+/.test(icon)) return 'like_achievement';
    return 'general';
}

function getRankGroupLabel(rankGroup) {
    if (rankGroup === 'post_achievement') return 'Conquista de Postagens';
    if (rankGroup === 'like_achievement') return 'Conquista de Likes';
    return 'Conquista';
}

function getNotificationSettingElements() {
    return {
        disableCommentNotifications: document.getElementById('disableCommentNotifications'),
        disableLikeNotifications: document.getElementById('disableLikeNotifications'),
        disableAchievementNotifications: document.getElementById('disableAchievementNotifications'),
        disableTeamEmailNotifications: document.getElementById('disableTeamEmailNotifications'),
        disableAllNotifications: document.getElementById('disableAllNotifications')
    };
}

function applyNotificationDependencies(options = {}) {
    const { resetSpecificOnDisable = true } = options;
    const els = getNotificationSettingElements();
    const allToggle = els.disableAllNotifications;
    if (!allToggle) return;

    const specificKeys = [
        'disableCommentNotifications',
        'disableLikeNotifications',
        'disableAchievementNotifications'
    ];
    const allOn = Boolean(allToggle.checked);

    specificKeys.forEach((key) => {
        const input = els[key];
        if (!input) return;
        const label = input.closest('.notif-setting-item');

        if (allOn) {
            input.checked = true;
            input.disabled = true;
            if (label) label.classList.add('disabled');
        } else {
            if (previousAllNotificationsToggleState && resetSpecificOnDisable) {
                input.checked = false;
            }
            input.disabled = false;
            if (label) label.classList.remove('disabled');
        }
    });

    previousAllNotificationsToggleState = allOn;
}

function collectNotificationSettingsFromUI() {
    const els = getNotificationSettingElements();
    return {
        disableCommentNotifications: Boolean(els.disableCommentNotifications?.checked),
        disableLikeNotifications: Boolean(els.disableLikeNotifications?.checked),
        disableAchievementNotifications: Boolean(els.disableAchievementNotifications?.checked),
        disableTeamEmailNotifications: Boolean(els.disableTeamEmailNotifications?.checked),
        disableAllNotifications: Boolean(els.disableAllNotifications?.checked)
    };
}

function getProfileAnimationSettingsElements() {
    return {
        pause: document.getElementById('pauseProfileAnimationsToggle'),
        disable: document.getElementById('disableProfileEffectsToggle')
    };
}

function applyProfileAnimationModeToUI(mode) {
    const normalizedMode = mode === 'pause' || mode === 'off' ? mode : 'normal';

    isApplyingProfileAnimationSettings = true;
    syncProfileAnimationControls(normalizedMode);
    window.ProfileAnimationPreferences?.setMode?.(normalizedMode);
    isApplyingProfileAnimationSettings = false;
}

function syncProfileAnimationControls(mode) {
    const els = getProfileAnimationSettingsElements();
    const normalizedMode = mode === 'pause' || mode === 'off' ? mode : 'normal';
    if (els.pause) els.pause.checked = normalizedMode === 'pause';
    if (els.disable) els.disable.checked = normalizedMode === 'off';
}

async function saveProfileAnimationSettings() {
    if (isSavingProfileAnimationSettings) return;

    const els = getProfileAnimationSettingsElements();
    const previousMode = window.ProfileAnimationPreferences?.getMode?.() || 'normal';
    const requestedMode = els.pause?.checked
        ? 'pause'
        : els.disable?.checked
            ? 'off'
            : 'normal';

    isSavingProfileAnimationSettings = true;
    if (els.pause) els.pause.disabled = true;
    if (els.disable) els.disable.disabled = true;

    let updateConfirmed = false;
    try {
        const result = await AuthAPI.updateProfileAnimationSettings(requestedMode);
        if (!result?.success) {
            throw new Error(result?.message || 'Não foi possível salvar a preferência de animações.');
        }
        updateConfirmed = true;

        const savedSettings = await AuthAPI.getProfileAnimationSettings();
        if (!savedSettings?.success || savedSettings.settings?.profileAnimationMode !== requestedMode) {
            throw new Error(
                savedSettings?.message ||
                'O servidor não confirmou a preferência salva. Tente novamente.'
            );
        }

        applyProfileAnimationModeToUI(savedSettings.settings.profileAnimationMode);
        showNotification('Preferência de animações salva', 'success');
    } catch (error) {
        console.error('Erro ao salvar preferência de animações do perfil:', error);
        applyProfileAnimationModeToUI(updateConfirmed ? requestedMode : previousMode);
        showNotification(error?.message || 'Erro ao salvar preferência de animações', 'error');
    } finally {
        isSavingProfileAnimationSettings = false;
        if (els.pause) els.pause.disabled = false;
        if (els.disable) els.disable.disabled = false;
    }
}

function initializeProfileAnimationControls() {
    const els = getProfileAnimationSettingsElements();
    if (!els.pause || !els.disable) return;

    applyProfileAnimationModeToUI(window.ProfileAnimationPreferences?.getMode?.() || 'normal');

    [els.pause, els.disable].forEach((input) => {
        if (input.dataset.boundProfileAnimation === '1') return;
        input.dataset.boundProfileAnimation = '1';
        input.addEventListener('change', async () => {
            if (isApplyingProfileAnimationSettings || isSavingProfileAnimationSettings) return;
            if (input.checked) {
                if (input === els.pause) els.disable.checked = false;
                else els.pause.checked = false;
            }
            await saveProfileAnimationSettings();
        });
    });
}

function applyNotificationSettingsToUI(settings) {
    const els = getNotificationSettingElements();
    if (!els.disableAllNotifications) return;

    isApplyingNotificationSettings = true;
    if (els.disableCommentNotifications) els.disableCommentNotifications.checked = Boolean(settings.disableCommentNotifications);
    if (els.disableLikeNotifications) els.disableLikeNotifications.checked = Boolean(settings.disableLikeNotifications);
    if (els.disableAchievementNotifications) els.disableAchievementNotifications.checked = Boolean(settings.disableAchievementNotifications);
    if (els.disableTeamEmailNotifications) els.disableTeamEmailNotifications.checked = Boolean(settings.disableTeamEmailNotifications);
    if (els.disableAllNotifications) els.disableAllNotifications.checked = Boolean(settings.disableAllNotifications);

    previousAllNotificationsToggleState = Boolean(settings.disableAllNotifications);
    applyNotificationDependencies({ resetSpecificOnDisable: false });
    isApplyingNotificationSettings = false;
}

async function saveNotificationSettings() {
    if (isSavingNotificationSettings) return;
    isSavingNotificationSettings = true;
    try {
        const payload = collectNotificationSettingsFromUI();
        const result = await AuthAPI.updateNotificationSettings(payload);
        if (result?.success) {
            applyNotificationSettingsToUI(result.settings || payload);
            showNotification('Configurações de notificações salvas', 'success');
        } else {
            showNotification(result?.message || 'Erro ao salvar notificações', 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar configurações de notificações:', error);
        showNotification('Erro ao salvar notificações', 'error');
    } finally {
        isSavingNotificationSettings = false;
    }
}

async function loadNotificationSettings() {
    try {
        const result = await AuthAPI.getNotificationSettings();
        if (result?.success && result.settings) {
            applyNotificationSettingsToUI(result.settings);
        } else {
            applyNotificationSettingsToUI({
                disableCommentNotifications: false,
                disableLikeNotifications: false,
                disableAchievementNotifications: false,
                disableTeamEmailNotifications: false,
                disableAllNotifications: false
            });
        }
    } catch (error) {
        console.error('Erro ao carregar configurações de notificações:', error);
    }
}

function initializeNotificationSettingsControls() {
    const els = getNotificationSettingElements();
    const allInputs = Object.values(els).filter(Boolean);
    if (allInputs.length === 0) return;

    allInputs.forEach((input) => {
        if (input.dataset.boundNotif === '1') return;
        input.dataset.boundNotif = '1';
        input.addEventListener('change', async () => {
            if (isApplyingNotificationSettings) return;
            applyNotificationDependencies();
            await saveNotificationSettings();
        });
    });

    loadNotificationSettings();
}

function setActiveEloSection(sectionId) {
    const options = document.querySelectorAll('#conquistas-tab .conquista-expand-btn');
    const sections = document.querySelectorAll('#conquistas-tab .conquista-expand-section');

    options.forEach((btn) => {
        if (btn.dataset.target === sectionId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    sections.forEach((section) => {
        if (section.id === sectionId) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
}

function initializeEloExpanders() {
    const tab = document.getElementById('conquistas-tab');
    if (!tab) return;

    const options = tab.querySelectorAll('.conquista-expand-btn');
    options.forEach((btn) => {
        if (btn.dataset.boundExpand === '1') return;
        btn.dataset.boundExpand = '1';
        btn.addEventListener('click', () => setActiveEloSection(btn.dataset.target));
    });

    const hasActiveSection = tab.querySelector('.conquista-expand-section.active');
    if (!hasActiveSection && options.length > 0) {
        setActiveEloSection(options[0].dataset.target);
    }
}

function normalizeHexColorForUi(value, fallback = '#EC4899') {
    const raw = String(value || '').trim();
    const candidate = raw.startsWith('#') ? raw : `#${raw}`;
    const shortMatch = candidate.match(/^#([0-9a-fA-F]{3})$/);
    if (shortMatch) {
        const [r, g, b] = shortMatch[1].split('');
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }
    if (/^#[0-9a-fA-F]{6}$/.test(candidate)) {
        return candidate.toUpperCase();
    }
    return fallback;
}

function isOwnerAccount() {
    const currentUserId = Number(currentUser?.id);
    if (Number.isFinite(currentUserId) && currentUserId === OWNER_USER_ID) {
        return true;
    }

    return String(currentUser?.email || '').trim().toLowerCase() === OWNER_EMAIL;
}

function isFounderAchievementRank(rank) {
    const rankNameKey = normalizeAchievementNameKey(rank?.name || '');
    return rankNameKey === FOUNDER_ACHIEVEMENT_NAME_KEY || rankNameKey.includes(FOUNDER_ACHIEVEMENT_NAME_KEY);
}

function getOwnerFounderProfileRank(fallbackRank = null) {
    if (!isOwnerAccount()) return null;

    const profileResult = window.currentProfileRenderResult || {};
    const candidates = [
        fallbackRank,
        profileResult?.rankComplete?.custom,
        ...(Array.isArray(currentCustomRanks) ? currentCustomRanks : [])
    ];
    const founderRank = candidates.find(isFounderAchievementRank);
    if (!founderRank) return null;

    return {
        ...founderRank,
        id: FIXED_MANUAL_RANK_KEY,
        isFixed: true,
        isVisible: 0,
        rankGroup: 'fixed_manual'
    };
}

function resolveConquestEditableRankId(rank) {
    const numericId = Number(rank?.id);
    if (Number.isFinite(numericId) && numericId > 0) {
        return numericId;
    }

    const rankIdRaw = String(rank?.id || '').trim().toLowerCase();
    const isOwnerUser = isOwnerAccount();
    const isFounderRank = isFounderAchievementRank(rank);

    if (rankIdRaw === FIXED_MANUAL_RANK_KEY && isOwnerUser) {
        return FIXED_MANUAL_RANK_KEY;
    }
    if (!isOwnerUser || !isFounderRank) return null;

    const match = (currentCustomRanks || []).find((item) => {
        const itemId = Number(item?.id);
        if (!Number.isFinite(itemId) || itemId <= 0) return false;
        return isFounderAchievementRank(item);
    });

    const resolvedId = Number(match?.id);
    if (Number.isFinite(resolvedId) && resolvedId > 0) {
        return resolvedId;
    }

    return FIXED_MANUAL_RANK_KEY;
}

function canEditConquestCardColor(rank) {
    const editableRankId = resolveConquestEditableRankId(rank);
    const isEditableRank =
        (Number.isFinite(Number(editableRankId)) && Number(editableRankId) > 0) ||
        String(editableRankId || '').trim().toLowerCase() === FIXED_MANUAL_RANK_KEY;
    const cardAllows = Number(rank?.canChangeOwnColor) === 1 || rank?.canChangeOwnColor === true;
    const userAllows = Boolean(currentUser?.canChangeRankColor);
    const isOwnerUser = isOwnerAccount();
    const isFounderRank = isFounderAchievementRank(rank);
    const isFixedManualRank = String(rank?.id || '').trim().toLowerCase() === FIXED_MANUAL_RANK_KEY;
    const ownerFounderException = isOwnerUser && isEditableRank && (isFounderRank || isFixedManualRank);
    return isEditableRank && ((userAllows && cardAllows) || ownerFounderException);
}

async function refreshProfileRankColors() {
    if (!currentUser?.id) return;

    const [customRanksResult, selectedRanksResult] = await Promise.all([
        AuthAPI.getUserCustomRanks(currentUser.id),
        AuthAPI.getSelectedProfileRanks()
    ]);

    if (customRanksResult?.success && Array.isArray(customRanksResult.ranks)) {
        // Filtrar ranks automáticos que não devem estar em currentCustomRanks
        // Nota: "Membro Inicial" e "Membro BETA" são especiais e devem ser mantidos.
        const AUTO_PROGRESSION_REFRESH = new Set([
            'membro novato', 'membro aprendiz',
            'membro experiente', 'membro adepto', 'membro especialista', 'membro mestre', 'grande mestre',
            'membro lendário', 'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal'
        ]);
        
        const filteredRanks = customRanksResult.ranks
            .filter(rank => {
                if (isHiddenProfileRank(rank)) {
                    console.log('[refreshProfileRankColors FILTER] Removendo rank oculto do perfil:', rank.name);
                    return false;
                }
                return true;
            });
        
        currentCustomRanks = filteredRanks;
    }

    if (selectedRanksResult?.success) {
        canOrderFixedRanks = Boolean(selectedRanksResult?.canOrderFixedRanks || canOrderFixedRanks);
    }

    const filteredRanks = (currentCustomRanks || []).filter(rank => {
        const rankNameLower = String(rank?.name || '').trim().toLowerCase();
        const BLOCKED_PROGRESSION = new Set([
            'membro novato', 'membro aprendiz',
            'membro experiente', 'membro adepto', 'membro especialista', 'membro mestre', 'grande mestre',
            'membro lendário', 'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal'
        ]);
        if (BLOCKED_PROGRESSION.has(rankNameLower)) {
            console.log(`❌ [refreshProfileRankColors] BLOQUEANDO "${rank.name}"`);
            return false;
        }
        return true;
    });
    console.log('📊 [refreshProfileRankColors] Ranks APÓS filtro:', filteredRanks.map(r => ({ name: r?.name, id: r?.id })));
    renderModalConquestRanks(filteredRanks);

    renderRankHistory();
    addCheckboxEventListeners();
    await loadSelectedRanksDisplay();
}

async function handleConquestColorInputChange(inputEl) {
    const rankIdRaw = String(inputEl?.dataset?.rankId || '').trim();
    const rankIdNumber = Number(rankIdRaw);
    const rankId =
        rankIdRaw.toLowerCase() === FIXED_MANUAL_RANK_KEY
            ? FIXED_MANUAL_RANK_KEY
            : (Number.isFinite(rankIdNumber) && rankIdNumber > 0 ? rankIdNumber : null);
    if (!rankId) return;

    const normalizedColor = normalizeHexColorForUi(inputEl.value, '#EC4899');
    const previousColor = normalizeHexColorForUi(inputEl.dataset.prevColor || inputEl.value, '#EC4899');
    inputEl.value = normalizedColor;

    if (normalizedColor === previousColor) return;

    inputEl.disabled = true;
    try {
        const result = await AuthAPI.updateMyRankColor(rankId, normalizedColor);
        if (!result?.success) {
            inputEl.value = previousColor;
            showNotification(result?.message || 'Não foi possível atualizar a cor da conquista.', 'error');
            return;
        }

        inputEl.dataset.prevColor = normalizedColor;
        showNotification('Cor da conquista atualizada!', 'success');
        await refreshProfileRankColors();
    } catch (error) {
        inputEl.value = previousColor;
        showNotification('Erro ao atualizar cor da conquista.', 'error');
    } finally {
        inputEl.disabled = false;
    }
}

async function handleConquestColorReset(buttonEl) {
    const rankIdRaw = String(buttonEl?.dataset?.rankId || '').trim();
    const rankIdNumber = Number(rankIdRaw);
    const rankId =
        rankIdRaw.toLowerCase() === FIXED_MANUAL_RANK_KEY
            ? FIXED_MANUAL_RANK_KEY
            : (Number.isFinite(rankIdNumber) && rankIdNumber > 0 ? rankIdNumber : null);
    if (!rankId) return;

    const inputEl = document.getElementById(`modalRankColor-${rankId}`);
    const fallbackColor = normalizeHexColorForUi(inputEl?.dataset?.prevColor || inputEl?.value, '#EC4899');
    const baseColor = normalizeHexColorForUi(buttonEl?.dataset?.baseColor || fallbackColor, fallbackColor);
    const currentColor = normalizeHexColorForUi(inputEl?.dataset?.prevColor || inputEl?.value, fallbackColor);

    if (inputEl) inputEl.value = baseColor;
    if (currentColor === baseColor) {
        showNotification('Esta conquista já está com a cor original.', 'info');
        return;
    }

    if (inputEl) inputEl.disabled = true;
    buttonEl.disabled = true;

    try {
        const result = await AuthAPI.updateMyRankColor(rankId, baseColor);
        if (!result?.success) {
            if (inputEl) inputEl.value = currentColor;
            showNotification(result?.message || 'Não foi possível restaurar a cor original.', 'error');
            return;
        }

        if (inputEl) inputEl.dataset.prevColor = baseColor;
        showNotification('Cor original restaurada!', 'success');
        await refreshProfileRankColors();
    } catch (error) {
        if (inputEl) inputEl.value = currentColor;
        showNotification('Erro ao restaurar cor original.', 'error');
    } finally {
        if (inputEl) inputEl.disabled = false;
        buttonEl.disabled = false;
    }
}

function renderModalConquestRanks(ranks) {
    const container = document.getElementById('myConquestsList');
    if (!container) return;

    const sourceRanks = Array.isArray(ranks) && ranks.length > 0
        ? ranks
        : (Array.isArray(currentCustomRanks) ? currentCustomRanks : []);
    const ownerFounderRank = getOwnerFounderProfileRank();
    const modalRanks = [
        ...sourceRanks.filter((rank) => !ownerFounderRank || !isFounderAchievementRank(rank)),
        ...(ownerFounderRank ? [ownerFounderRank] : [])
    ];

    console.log('🔍 renderModalConquestRanks - Ranks recebidos:', {
        count: modalRanks.length,
        names: modalRanks.map(r => ({ name: r?.name, id: r?.id, selectedForDisplay: isRankSelectedForDisplay(r) }))
    });

    if (!modalRanks.length) {
        container.innerHTML = '<p style="margin: 0; color: rgba(255,255,255,0.55);">Nenhuma conquista disponível para exibição.</p>';
        return;
    }


    // Remover duplicatas por id ou nome normalizado
    const seen = new Set();
    const uniqueRanks = [];
    for (const rank of modalRanks) {
        const key = String(rank?.id || '').trim() + '|' + String(rank?.name || '').trim().toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            uniqueRanks.push(rank);
        }
    }

    container.innerHTML = uniqueRanks.map((rank) => {
        const color = normalizeHexColorForUi(rank.color, '#EC4899');
        const group = detectRankGroup(rank);
        const groupLabel = getRankGroupLabel(group);
        const rankName = normalizeBrokenUtf8Text(rank?.name || '');
        const description = normalizeBrokenUtf8Text(rank?.description || rank?.customText || '') || 'Conquista desbloqueada';
        const canEditColor = canEditConquestCardColor(rank);
        const editableRankId = resolveConquestEditableRankId(rank);
        const baseColor = normalizeHexColorForUi(rank?.baseColor || rank?.color, color);
        const isCustomColor = color !== baseColor;
        const isSelectedForDisplay = isRankSelectedForDisplay(rank);
        const checkboxHtml = `
            <label class="conquista-card-toggle" style="display:flex; align-items:center; gap:8px; color: rgba(255,255,255,0.92); font-size: 12px; cursor:pointer; margin-bottom: 8px;">
                <input
                    type="checkbox"
                    class="rank-checkbox conquista-card-toggle-checkbox"
                    data-rank-id="${String(rank?.id || '').trim()}"
                    data-rank-name="${escapeHtmlAttributeValue(String(rank?.name || '').trim())}"
                    data-rank-group="${escapeHtmlAttributeValue(String(detectRankGroup(rank) || 'custom'))}"
                    data-rank-color="${escapeHtmlAttributeValue(color)}"
                    ${isSelectedForDisplay ? 'checked' : ''}
                >
                Exibir no perfil
            </label>
        `;
        const colorControlHtml = canEditColor && editableRankId
            ? `
                <div class="conquista-card-color-tools">
                    <div class="conquista-card-color-main">
                        <label class="conquista-card-color-label" for="modalRankColor-${editableRankId}">Cor</label>
                        <input
                            type="color"
                            id="modalRankColor-${editableRankId}"
                            class="conquista-card-color-input tooltip-theme"
                            data-rank-id="${editableRankId}"
                            data-prev-color="${color}"
                            value="${color}"
                            data-tooltip="Escolher cor da conquista"
                        >
                    </div>
                    <button
                        type="button"
                        class="conquista-card-color-reset tooltip-theme"
                        data-rank-id="${editableRankId}"
                        data-base-color="${baseColor}"
                        data-tooltip="Voltar para cor original"
                        ${isCustomColor ? '' : 'disabled'}
                    >Original</button>
                </div>
            `
            : '';

        return `
            <div class="conquista-conquista-card achievement-card-fx" style="border-color: ${color}66; background: linear-gradient(135deg, ${color}22, rgba(10,10,35,0.55));">
                ${checkboxHtml}
                <div class="conquista-conquista-name" style="color: ${color};">${rankName || rank.name || 'Sem nome'}</div>
                <div class="conquista-conquista-desc">${description}</div>
                <div class="conquista-card-footer">
                    <span class="conquista-conquista-badge" style="color: ${color};">${groupLabel}</span>
                    ${colorControlHtml}
                </div>
            </div>
        `;
    }).join('');

    // Eventos para checkbox de exibição
    container.querySelectorAll('.conquista-card-color-input').forEach((inputEl) => {
        if (inputEl.dataset.boundColorChange === '1') return;
        inputEl.dataset.boundColorChange = '1';
        inputEl.addEventListener('change', () => handleConquestColorInputChange(inputEl));
    });

    container.querySelectorAll('.conquista-card-color-reset').forEach((btnEl) => {
        if (btnEl.dataset.boundColorReset === '1') return;
        btnEl.dataset.boundColorReset = '1';
        btnEl.addEventListener('click', () => handleConquestColorReset(btnEl));
    });

    addCheckboxEventListeners();
    configureRankPerformanceMode(container);
    bindAchievementCardFx(container);
}

function calculateLikeRankInfo(totalLikes) {
    let current = null;
    let next = null;

    for (const rank of LIKE_ACHIEVEMENT_RANKS) {
        if (totalLikes >= rank.minLikes) {
            current = rank;
        } else {
            next = rank;
            break;
        }
    }

    if (!next && current) {
        next = current;
    }

    const baseline = current ? current.minLikes : 0;
    const target = next ? next.minLikes : baseline;
    const progressRange = Math.max(1, target - baseline);
    const progressValue = Math.max(0, totalLikes - baseline);
    const percentage = current && !next
        ? 100
        : Math.max(0, Math.min(100, Math.round((progressValue / progressRange) * 100)));

    return { current, next, percentage, baseline, target };
}

async function loadPostageAchievements() {
    if (!currentUser) return;

    try {
        initializeNotificationSettingsControls();
        initializeEloExpanders();

        await AuthAPI.syncPostAchievementRanks();
        await AuthAPI.syncLikeAchievementRanks();

        const [statsResponse, ranksResponse, selectedRanksResponse] = await Promise.all([
            AuthAPI.getUserDownloadStats(currentUser.id),
            AuthAPI.getPostageRanks(),
            AuthAPI.getSelectedProfileRanks()
        ]);

        if (selectedRanksResponse && selectedRanksResponse.success) {
            console.log('📊 [loadPostageAchievements] selectedRanksResponse.ranks (ANTES do filtro):', 
                selectedRanksResponse.ranks?.map(r => ({ name: r?.name, id: r?.id })));
            // BLOQUEIO: Remover progressões automáticas ANTES de renderizar (EXCETO "membro beta" e "membro inicial" que são selecionáveis)
            const BLOCKED_PROGRESSION = new Set([
                'membro novato', 'membro aprendiz',
                'membro experiente', 'membro adepto', 'membro especialista', 'membro mestre', 'grande mestre',
                'membro lendário', 'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal'
            ]);
            const filteredRanks = (currentCustomRanks || []).filter(rank => {
                const rankNameLower = String(rank?.name || '').trim().toLowerCase();
                if (BLOCKED_PROGRESSION.has(rankNameLower)) {
                    console.log(`❌ [loadPostageAchievements] BLOQUEANDO "${rank.name}"`);
                    return false;
                }
                console.log(`✅ [loadPostageAchievements] MANTENDO "${rank.name}"`);
                return true;
            });
            console.log('📊 [loadPostageAchievements] Ranks APÓS filtro:', filteredRanks.map(r => ({ name: r?.name, id: r?.id })));
            renderModalConquestRanks(filteredRanks);
        } else {
            renderModalConquestRanks([]);
        }

        if (statsResponse.success) {
            const stats = statsResponse.stats;
            const rankInfo = statsResponse.rankInfo;
            const totalPosts = Number(stats.totalPostages || 0);
            const totalLikesHistorical = Number(stats.totalLikes || 0);
            const totalLikesCurrent = Number(stats.totalLikesCurrent || 0);
            const totalHearts = Number(stats.totalHearts || 0);

            currentUserPostCount = totalPosts;
            currentUserLikeCount = totalLikesHistorical;

            // Preencher estatísticas
            document.getElementById('totalPostages').textContent = totalPosts;
            document.getElementById('totalLikesReceived').textContent = totalLikesHistorical;
            document.getElementById('totalHeartsReceived').textContent = totalHearts;

            document.getElementById('totalLikesHistory').textContent = totalLikesHistorical;
            document.getElementById('totalLikesCurrent').textContent = totalLikesCurrent;
            document.getElementById('totalHeartsLikesTab').textContent = totalHearts;

            // conquista atual
            const currentRank = rankInfo.currentRank;
            document.getElementById('currentRankIcon').textContent = currentRank?.icon || '??';
            document.getElementById('currentRankName').textContent = currentRank?.name || 'Sem conquista';
            document.getElementById('currentRankDesc').textContent = currentRank?.description || 'Faça sua primeira postagem';

            // Progresso
            const progress = rankInfo.progress;
            document.getElementById('progressCurrent').textContent = progress.current;
            document.getElementById('progressNeeded').textContent = progress.needed;
            document.getElementById('progressBar').style.width = progress.percentage + '%';

            // Preximo conquista
            const nextPostageRankHint = document.getElementById('nextPostageRankHint');
            if (rankInfo.nextRank) {
                const nextRank = rankInfo.nextRank;
                nextPostageRankHint.textContent = `${nextRank.postagensNeeded} postagens faltam para ${nextRank.name}`;
            } else {
                nextPostageRankHint.textContent = 'Você já alcançou a maior conquista de postagens.';
            }

            if (ranksResponse.success) {
                const ranksContainer = document.getElementById('allPostageRanks');
                ranksContainer.innerHTML = ranksResponse.ranks.map(rank => `
                    <div class="achievement-card-fx" style="background: linear-gradient(135deg, ${rank.color}22, ${rank.color}11); padding: 12px; border-radius: 8px; border: 1px solid ${rank.color}40; text-align: center;">
                        <div style="font-size: 24px; margin-bottom: 8px;">${rank.icon}</div>
                        <h5 style="margin: 0 0 5px 0; color: ${rank.color}; font-size: 12px;">${rank.name}</h5>
                        <small style="color: #999; font-size: 10px;">${rank.minPostages} posts</small>
                    </div>
                `).join('');
            }

            const likeRankInfo = calculateLikeRankInfo(totalLikesHistorical);
            const likeCurrent = likeRankInfo.current;
            const likeNext = likeRankInfo.next;

            document.getElementById('currentLikeRankIcon').textContent = likeCurrent ? `L${likeCurrent.minLikes}` : 'L0';
            document.getElementById('currentLikeRankName').textContent = likeCurrent ? likeCurrent.name : 'Sem conquista de Likes';
            document.getElementById('currentLikeRankName').style.color = likeCurrent?.color || '#38BDF8';
            document.getElementById('currentLikeRankDesc').textContent = likeCurrent
                ? `Conquistado com ${likeCurrent.minLikes} likes.`
                : 'Ganhe likes para desbloquear suas conquistas.';

            if (likeNext && totalLikesHistorical < likeNext.minLikes) {
                const remainingLikes = Math.max(0, likeNext.minLikes - totalLikesHistorical);
                document.getElementById('nextLikeRankHint').textContent = `${remainingLikes} likes faltam para ${likeNext.name}.`;
            } else {
                document.getElementById('nextLikeRankHint').textContent = 'Você já alcançou a maior conquista de likes.';
            }

            document.getElementById('likeProgressCurrent').textContent = totalLikesHistorical;
            document.getElementById('likeProgressNeeded').textContent = likeNext ? likeNext.minLikes : totalLikesHistorical;
            document.getElementById('likeProgressBar').style.width = `${likeRankInfo.percentage}%`;

            const allLikeRanksContainer = document.getElementById('allLikeRanks');
            allLikeRanksContainer.innerHTML = LIKE_ACHIEVEMENT_RANKS.map((rank) => {
                const achieved = totalLikesHistorical >= rank.minLikes;
                const badgeLabel = achieved
                    ? 'Conquistado'
                    : `Faltam ${Math.max(0, rank.minLikes - totalLikesHistorical)} like(s)`;
                return `
                    <div class="achievement-card-fx" style="border: 1px solid ${rank.color}80; border-radius: 12px; padding: 12px; background: linear-gradient(135deg, ${rank.color}${achieved ? '33' : '14'}, rgba(10, 10, 35, 0.55)); opacity: ${achieved ? '1' : '0.75'};">
                        <div style="font-weight: 700; color: ${rank.color}; margin-bottom: 6px;">${rank.name}</div>
                        <div style="font-size: 12px; color: rgba(255,255,255,0.85); margin-bottom: 8px;">${rank.minLikes} likes</div>
                        <div style="display: inline-block; font-size: 11px; padding: 4px 8px; border-radius: 999px; border: 1px solid ${rank.color}99; color: ${achieved ? '#fff' : rank.color}; background: ${achieved ? `${rank.color}55` : 'transparent'};">${badgeLabel}</div>
                    </div>
                `;
            }).join('');

            const conquistasTab = document.getElementById('conquistas-tab');
            configureRankPerformanceMode(conquistasTab);
            bindAchievementCardFx(conquistasTab);
        }
    } catch (error) {
        console.error('Erro ao carregar conquistas:', error);
    }
}

async function loadMyPostages() {
    if (!currentUser) return;

    try {
        await loadAdultPostsPreference();
        const response = await AuthAPI.getUserDownloads(currentUser.id);
        
        if (response.success && response.downloads) {
            const container = document.getElementById('myPostagesContainer');
            const downloads = response.downloads;

            if (downloads.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">
                        <p style="font-size: 18px; margin: 0;">Você ainda não postou nada</p>
                        <p style="margin: 10px 0 0 0;">Compartilhe seus programas com a comunidade!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = downloads.map(download => `
                <div style="background: rgba(107, 70, 193, 0.1); border: 1px solid #EC4899; border-radius: 10px; padding: 15px;">
                    <h4 style="margin: 0 0 8px 0; color: #EC4899;">
                        ${download.name}
                        ${Number(download?.isAdult) === 1 || download?.isAdult === true
                            ? '<span style="display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(239,68,68,0.65); color: #FCA5A5; background: rgba(239,68,68,0.12); font-size: 10px; font-weight: 700;">+18</span>'
                            : ''}
                    </h4>
                    ${download.isAdultLocked
                        ? `<p style="margin: 0 0 10px 0; color: #FCA5A5; font-size: 13px;">${download.adultLockReason || 'Conteúdo +18 bloqueado. Ative a opção para visualizar.'}</p>`
                        : (download.description ? `<p style="margin: 0 0 10px 0; color: #ccc; font-size: 13px;">${download.description}</p>` : '')}
                    
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; font-size: 11px; font-weight: 600;">
                        <span style="padding: 4px 8px; border-radius: 999px; border: 1px solid rgba(236, 72, 153, 0.45); color: #EC4899; background: rgba(236, 72, 153, 0.12);">Likes ${download.likes || 0}</span>
                        <span style="padding: 4px 8px; border-radius: 999px; border: 1px solid rgba(192, 132, 252, 0.45); color: #C084FC; background: rgba(192, 132, 252, 0.12);">Corações ${download.hearts || 0}</span>
                        <span style="padding: 4px 8px; border-radius: 999px; border: 1px solid rgba(56, 189, 248, 0.45); color: #38BDF8; background: rgba(56, 189, 248, 0.12);">${new Date(download.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    
                    <div style="display: flex; gap: 8px;">
                        ${download.isAdultLocked
                            ? '<span style="flex: 1; padding: 8px; border-radius: 5px; text-align: center; font-weight: 600; font-size: 12px; border: 1px solid rgba(239,68,68,0.6); color: #FCA5A5; background: rgba(239,68,68,0.1);">Bloqueado +18</span>'
                            : `<a href="${download.link}" target="_blank" style="flex: 1; padding: 8px; background: linear-gradient(135deg, #EC4899, #6B46C1); color: white; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; text-align: center; font-weight: 600; font-size: 12px;">Ver</a>`}
                        <button onclick="deletePostage(${download.id})" style="padding: 8px 12px; background: #EF4444; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 12px;">Excluir</button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar postagens:', error);
        document.getElementById('myPostagesContainer').innerHTML = 
            '<p style="color: red; grid-column: 1/-1;">Erro ao carregar postagens</p>';
    }
}

function getCurrentUserAge() {
    const raw = String(currentUser?.birthDate || '').trim();
    if (!raw) return 0;
    const birth = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(birth.getTime())) return 0;

    const today = new Date();
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
        age -= 1;
    }
    return Math.max(0, age);
}

function applyAdultPostsPreferenceUi(isAdult, enabled) {
    const box = document.getElementById('adultPostsPreferenceBox');
    const toggle = document.getElementById('showAdultPostsToggle');
    const hint = document.getElementById('showAdultPostsHint');
    if (!box || !toggle || !hint) return;

    if (!isAdult) {
        box.style.display = 'none';
        toggle.checked = false;
        toggle.disabled = true;
        hint.textContent = 'Disponível apenas para contas com 18 anos ou mais.';
        hint.style.color = '#FCA5A5';
        box.style.opacity = '0.8';
        return;
    }

    box.style.display = '';
    toggle.disabled = false;
    toggle.checked = Boolean(enabled);
    hint.textContent = enabled
        ? 'Postagens +18 visíveis.'
        : 'Postagens +18 ficam bloqueadas até ativar esta opção.';
    hint.style.color = enabled ? '#86EFAC' : 'rgba(255,255,255,0.72)';
    box.style.opacity = '1';
}

async function loadAdultPostsPreference() {
    const toggle = document.getElementById('showAdultPostsToggle');
    const hint = document.getElementById('showAdultPostsHint');
    if (!toggle || !hint) return;

    try {
        const result = await AuthAPI.getAdultPostSettings();
        if (!result?.success || !result?.settings) {
            const isAdultFallback = getCurrentUserAge() >= 18;
            const showAdultFallback = Boolean(currentUser?.showAdultPosts);
            applyAdultPostsPreferenceUi(isAdultFallback, showAdultFallback);
            return;
        }

        const isAdult = Boolean(result.settings.isAdult);
        const showAdultPosts = Boolean(result.settings.showAdultPosts);
        if (currentUser) {
            currentUser.isAdult = isAdult;
            currentUser.showAdultPosts = showAdultPosts;
        }
        applyAdultPostsPreferenceUi(isAdult, showAdultPosts);
    } catch (error) {
        console.error('Erro ao carregar configuração +18:', error);
        const isAdultFallback = getCurrentUserAge() >= 18;
        const showAdultFallback = Boolean(currentUser?.showAdultPosts);
        applyAdultPostsPreferenceUi(isAdultFallback, showAdultFallback);
        hint.textContent = 'Erro ao carregar configuração +18.';
        hint.style.color = '#FCA5A5';
    }
}

async function handleAdultPostsToggleChange() {
    const toggle = document.getElementById('showAdultPostsToggle');
    if (!toggle) return;

    const intendedValue = Boolean(toggle.checked);
    toggle.disabled = true;
    try {
        const result = await AuthAPI.updateAdultPostSettings(intendedValue);
        if (!result?.success || !result?.settings) {
            showNotification(result?.message || 'Erro ao salvar configuração +18', 'error');
            await loadAdultPostsPreference();
            return;
        }

        if (currentUser) {
            currentUser.showAdultPosts = Boolean(result.settings.showAdultPosts);
            currentUser.isAdult = Boolean(result.settings.isAdult);
        }
        applyAdultPostsPreferenceUi(Boolean(result.settings.isAdult), Boolean(result.settings.showAdultPosts));
        await loadMyPostages();
        showNotification('Configuração +18 atualizada!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar configuração +18:', error);
        showNotification('Erro ao salvar configuração +18', 'error');
        await loadAdultPostsPreference();
    } finally {
        toggle.disabled = false;
    }
}

async function deletePostage(downloadId) {
    if (!confirm('Tem certeza que deseja deletar esta postagem?')) return;

    try {
        const response = await AuthAPI.deleteDownload(downloadId);
        if (response.success) {
            showNotification('Postagem deletada com sucesso!', 'success');
            loadMyPostages();
        } else {
            showNotification('Erro ao deletar postagem', 'error');
        }
    } catch (error) {
        showNotification('Erro ao deletar postagem', 'error');
    }
}
