let currentUser = null;
let allDownloads = [];
let userCanPost = false;
let userCanManageDownloads = false;
let userCanSuspendPosts = false;
let globalDownloadUploadsEnabled = false;
let showingFavoritesOnly = false;
let filteredDownloadsCache = [];
let currentDownloadsPage = 1;
const DOWNLOADS_PER_PAGE = 15;
const ANIMATED_PROFILE_CARD_THEMES = [
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
const ENABLE_ANIMATED_DOWNLOAD_CARDS = true;

const MAX_DOWNLOAD_LINKS = 3;
const MAX_DOWNLOAD_FILE_BYTES = 500 * 1024 * 1024;
const PROFILE_TAGLINE_MAX_LENGTH = 100;
const DOWNLOAD_FILE_ACCEPT = [
    '.apk', '.exe', '.msi', '.zip', '.rar', '.7z', '.war',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.mp3', '.mp4', '.iso',
    'application/vnd.android.package-archive',
    'application/x-msdownload', 'application/x-msdos-program', 'application/x-dosexec',
    'application/x-msi', 'application/octet-stream',
    'application/zip', 'application/x-zip-compressed',
    'application/vnd.rar', 'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/pdf', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'audio/mpeg', 'video/mp4',
    'application/x-iso9660-image'
].join(',');
const DOWNLOAD_LINK_FORMAT_OPTIONS = [
    { value: 'auto', label: 'Auto (detectar)' },
    { value: 'apk', label: 'APK (.apk)' },
    { value: 'exe', label: 'EXE (.exe)' },
    { value: 'msi', label: 'MSI (.msi)' },
    { value: 'zip', label: 'ZIP (.zip)' },
    { value: 'rar', label: 'RAR (.rar)' },
    { value: '7z', label: '7Z (.7z)' },
    { value: 'pdf', label: 'PDF (.pdf)' },
    { value: 'doc', label: 'DOC/DOCX (.doc, .docx)' },
    { value: 'xls', label: 'XLS/XLSX (.xls, .xlsx)' },
    { value: 'ppt', label: 'PPT/PPTX (.ppt, .pptx)' },
    { value: 'txt', label: 'TXT (.txt)' },
    { value: 'jpg', label: 'JPG/JPEG (.jpg, .jpeg)' },
    { value: 'png', label: 'PNG (.png)' },
    { value: 'gif', label: 'GIF (.gif)' },
    { value: 'webp', label: 'WEBP (.webp)' },
    { value: 'svg', label: 'SVG (.svg)' },
    { value: 'mp3', label: 'MP3 (.mp3)' },
    { value: 'mp4', label: 'MP4 (.mp4)' },
    { value: 'iso', label: 'ISO (.iso)' },
    { value: 'software', label: 'Software' },
    { value: 'site', label: 'Site/Link' },
    { value: 'outro', label: 'Outro' }
];
const DOWNLOAD_LINK_FORMAT_LABELS = DOWNLOAD_LINK_FORMAT_OPTIONS.reduce((acc, option) => {
    acc[option.value] = option.label;
    return acc;
}, {});
const DOWNLOAD_LINK_EXTENSION_FORMAT_MAP = {
    apk: 'apk',
    exe: 'exe',
    msi: 'msi',
    zip: 'zip',
    rar: 'rar',
    '7z': '7z',
    war: 'software',
    pdf: 'pdf',
    doc: 'doc',
    docx: 'doc',
    xls: 'xls',
    xlsx: 'xls',
    ppt: 'ppt',
    pptx: 'ppt',
    txt: 'txt',
    jpg: 'jpg',
    jpeg: 'jpg',
    png: 'png',
    gif: 'gif',
    webp: 'webp',
    svg: 'svg',
    mp3: 'mp3',
    mp4: 'mp4',
    iso: 'iso'
};
const COMMENT_ATTACHMENT_MAX_BYTES = 500 * 1024 * 1024;
const COMMENT_EMOJI_FALLBACK = ['😀', '😂', '😍', '😎', '🔥', '💖', '👍', '👏', '🤝', '🎮', '📥', '✨'];
const COMMENT_EMOJI_RANGES = [
    [0x1F300, 0x1F5FF],
    [0x1F600, 0x1F64F],
    [0x1F680, 0x1F6FF],
    [0x1F700, 0x1F77F],
    [0x1F780, 0x1F7FF],
    [0x1F800, 0x1F8FF],
    [0x1F900, 0x1F9FF],
    [0x1FA70, 0x1FAFF],
    [0x2600, 0x26FF],
    [0x2700, 0x27BF]
];
const COMMENT_GIF_TOKEN_REGEX = /\[gif\]([\s\S]*?)\[\/gif\]/i;
const COMMENT_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']);
const ADULT_CONTENT_RULES_MESSAGE = 'Qualquer conteudo +18, explicito ou nao, deve ser marcado na opcao de conteudo +18. Publicar sem marcar pode gerar consequencias e punicoes na conta.';

function buildCommentEmojiCatalog() {
    const emojis = [];
    const seen = new Set();
    let pictographicRegex = null;

    try {
        pictographicRegex = /\p{Extended_Pictographic}/u;
    } catch {
        return COMMENT_EMOJI_FALLBACK.slice();
    }

    for (const [start, end] of COMMENT_EMOJI_RANGES) {
        for (let cp = start; cp <= end; cp += 1) {
            const glyph = String.fromCodePoint(cp);
            if (!pictographicRegex.test(glyph)) continue;
            if (seen.has(glyph)) continue;
            seen.add(glyph);
            emojis.push(glyph);
        }
    }

    return emojis.length > 0 ? emojis : COMMENT_EMOJI_FALLBACK.slice();
}

const COMMENT_EMOJI_CATALOG = buildCommentEmojiCatalog();

function buildCommentEmojiCategory(ranges, label, id) {
    const seen = new Set();
    const emojis = [];
    let pictographicRegex = null;

    try {
        pictographicRegex = /\p{Extended_Pictographic}/u;
    } catch {
        return { id, label, emojis: COMMENT_EMOJI_FALLBACK.slice() };
    }

    for (const [start, end] of ranges) {
        for (let cp = start; cp <= end; cp += 1) {
            const glyph = String.fromCodePoint(cp);
            if (!pictographicRegex.test(glyph)) continue;
            if (seen.has(glyph)) continue;
            seen.add(glyph);
            emojis.push(glyph);
        }
    }

    return { id, label, emojis };
}

const COMMENT_EMOJI_CATEGORIES = [
    buildCommentEmojiCategory([[0x1F600, 0x1F64F], [0x1F970, 0x1F97A]], 'Rostos', 'faces'),
    buildCommentEmojiCategory([[0x1F44A, 0x1F64F], [0x1FAF0, 0x1FAF8]], 'Gestos', 'gestures'),
    buildCommentEmojiCategory([[0x1F48B, 0x1F49F], [0x2764, 0x2764]], 'Corações', 'hearts'),
    buildCommentEmojiCategory([[0x1F400, 0x1F43E], [0x1F980, 0x1F9AE]], 'Animais', 'animals'),
    buildCommentEmojiCategory([[0x1F32D, 0x1F37F], [0x1F950, 0x1F96F]], 'Comidas', 'food'),
    buildCommentEmojiCategory([[0x1F3A0, 0x1F3CF], [0x1F3D0, 0x1F3FA]], 'Atividades', 'activities'),
    buildCommentEmojiCategory([[0x1F680, 0x1F6FF], [0x1F6E0, 0x1F6EC]], 'Viagens', 'travel'),
    buildCommentEmojiCategory([[0x1F4A0, 0x1F4FF], [0x1F9F0, 0x1F9FF], [0x2600, 0x26FF], [0x2700, 0x27BF]], 'Objetos & Símbolos', 'objects')
].map((category) => {
    const safeEmojis = (category.emojis || []).length > 0 ? category.emojis : COMMENT_EMOJI_FALLBACK.slice();
    return { ...category, emojis: safeEmojis };
});

function openCommentEmojiPickerModal(onSelectEmoji) {
    const categories = COMMENT_EMOJI_CATEGORIES;
    const initialCategoryId = categories[0]?.id || 'faces';

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10050;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
        width: min(92vw, 720px);
        max-height: 80vh;
        background: linear-gradient(135deg, #161a36 0%, #121b3f 100%);
        border: 2px solid #6B46C1;
        border-radius: 12px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.4);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    `;

    panel.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; padding: 12px 14px; border-bottom:1px solid rgba(107,70,193,0.55);">
            <strong style="color:#EC4899; font-size:15px;">Selecionar Emoji</strong>
            <button type="button" id="closeEmojiPickerModal" style="background:transparent; color:#F9FAFB; border:1px solid rgba(236,72,153,0.5); border-radius:6px; padding:4px 10px; cursor:pointer;">Fechar</button>
        </div>
        <div style="padding: 10px 14px; border-bottom:1px solid rgba(107,70,193,0.4);">
            <input id="emojiSearchInput" type="text" placeholder="Buscar emoji..." style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #6B46C1; background:rgba(0,0,0,0.28); color:#fff;">
        </div>
        <div id="emojiCategoryTabs" style="display:flex; flex-wrap:wrap; gap:6px; padding: 10px 12px; border-bottom:1px solid rgba(107,70,193,0.4);"></div>
        <div id="emojiCategoryGrid" style="padding: 12px; overflow-y:auto; min-height: 260px;"></div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const tabsWrap = panel.querySelector('#emojiCategoryTabs');
    const gridWrap = panel.querySelector('#emojiCategoryGrid');
    const searchInput = panel.querySelector('#emojiSearchInput');

    let activeCategoryId = initialCategoryId;
    let searchTerm = '';

    const renderTabs = () => {
        tabsWrap.innerHTML = categories.map((category) => {
            const isActive = category.id === activeCategoryId;
            return `
                <button type="button" class="btn-emoji-category" data-category-id="${category.id}" style="
                    padding: 6px 10px;
                    border-radius: 7px;
                    border: 1px solid ${isActive ? '#EC4899' : 'rgba(107,70,193,0.6)'};
                    color: ${isActive ? '#fff' : '#c7d2fe'};
                    background: ${isActive ? 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)' : 'rgba(0,0,0,0.25)'};
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                ">${escapeHtml(category.label)}</button>
            `;
        }).join('');
    };

    const renderGrid = () => {
        const category = categories.find((item) => item.id === activeCategoryId) || categories[0];
        const all = category?.emojis || COMMENT_EMOJI_FALLBACK;
        const filtered = searchTerm
            ? all.filter((emoji) => emoji.includes(searchTerm))
            : all;

        if (filtered.length === 0) {
            gridWrap.innerHTML = '<p style="margin:0; color:#94a3b8; font-size:13px;">Nenhum emoji encontrado nessa categoria.</p>';
            return;
        }

        gridWrap.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap:8px;">
                ${filtered.map((emoji) => `
                    <button type="button" class="btn-pick-emoji" data-emoji="${escapeHtml(emoji)}" style="
                        width:40px;
                        height:40px;
                        border-radius:8px;
                        border:1px solid rgba(107,70,193,0.65);
                        background: rgba(0,0,0,0.3);
                        color:#fff;
                        cursor:pointer;
                        font-size:22px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                    ">${emoji}</button>
                `).join('')}
            </div>
        `;
    };

    const closeModal = () => {
        overlay.remove();
    };

    renderTabs();
    renderGrid();

    tabsWrap.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('.btn-emoji-category') : null;
        if (!target) return;
        activeCategoryId = String(target.getAttribute('data-category-id') || initialCategoryId);
        renderTabs();
        renderGrid();
    });

    searchInput?.addEventListener('input', () => {
        searchTerm = String(searchInput.value || '').trim();
        renderGrid();
    });

    panel.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const pickBtn = target.closest('.btn-pick-emoji');
        if (!pickBtn) return;
        const pickedEmoji = String(pickBtn.getAttribute('data-emoji') || '');
        if (!pickedEmoji) return;
        if (typeof onSelectEmoji === 'function') {
            onSelectEmoji(pickedEmoji);
        }
        closeModal();
    });

    panel.querySelector('#closeEmojiPickerModal')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeModal();
    });
}

function getApiOrigin() {
    const baseFromApi = typeof API_URL === 'string'
        ? API_URL.replace(/\/api\/?$/i, '').replace(/\/+$/, '')
        : '';
    if (baseFromApi) return baseFromApi;
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

function normalizeAvatarPath(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
        const parsed = new URL(raw, getApiOrigin());
        return String(parsed.pathname || '')
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .toLowerCase();
    } catch (error) {
        return raw
            .split('?')[0]
            .split('#')[0]
            .replace(/\\/g, '/')
            .replace(/\/+/g, '/')
            .toLowerCase();
    }
}

function isDefaultAvatarSource(value) {
    const normalizedPath = normalizeAvatarPath(value);
    if (!normalizedPath) return true;
    return normalizedPath.endsWith('/imagens/login.png') || normalizedPath.endsWith('imagens/login.png');
}

function hasCustomAvatarSource(value) {
    const raw = String(value || '').trim();
    return Boolean(raw) && !isDefaultAvatarSource(raw);
}

function getAvatarInitials(value) {
    const raw = String(value || '').trim().replace(/^@+/, '');
    if (!raw) return 'HG';

    const chunks = raw
        .split(/[^a-zA-Z0-9À-ÿ]+/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (chunks.length >= 2) {
        return `${chunks[0][0]}${chunks[1][0]}`.toUpperCase();
    }

    return raw.slice(0, 2).toUpperCase();
}

function renderDownloadAvatarMarkup({
    avatar,
    nickname,
    userId,
    size = 40,
    accentColor = '#EC4899',
    extraClasses = '',
    avatarScale = null,
    avatarOffsetX = null,
    avatarOffsetY = null
} = {}) {
    const safeNickname = String(nickname || 'Usuario').trim() || 'Usuario';
    const safeUserId = escapeHtml(String(userId ?? ''));
    const classes = ['user-avatar'];
    if (extraClasses) classes.push(String(extraClasses).trim());
    const classAttr = classes.join(' ').trim();
    const sizeStyle = `width: ${Number(size) || 40}px; height: ${Number(size) || 40}px;`;

    if (hasCustomAvatarSource(avatar)) {
        // Aplicar zoom APENAS se os valores foram explicitamente passados (não null)
        if (avatarScale !== null && avatarOffsetX !== null && avatarOffsetY !== null) {
            const scale = Number(avatarScale) || 1;
            const offsetX = Number(avatarOffsetX) || 50;
            const offsetY = Number(avatarOffsetY) || 50;
            const zoomStyle = `position: absolute; left: ${offsetX}%; top: ${offsetY}%; transform: translate(-50%, -50%) scale(${scale}); transform-origin: center; width: 100%; height: 100%; object-fit: cover;`;

            return `
                <img
                    src="${resolveMediaUrl(avatar, '')}"
                    alt="Avatar de ${escapeHtml(safeNickname)}"
                    class="${classAttr}"
                    style="${zoomStyle}"
                    data-user-id="${safeUserId}">
            `;
        } else {
            // Sem zoom - comportamento normal
            return `
                <img
                    src="${resolveMediaUrl(avatar, '')}"
                    alt="Avatar de ${escapeHtml(safeNickname)}"
                    class="${classAttr}"
                    style="${sizeStyle} object-fit: cover;"
                    data-user-id="${safeUserId}">
            `;
        }
    }

    // Avatar fallback - sem zoom
    return `
        <div
            class="${classAttr} user-avatar-fallback"
            role="img"
            aria-label="Avatar de ${escapeHtml(safeNickname)}"
            style="width: 100%; height: 100%; --avatar-accent: ${escapeHtml(accentColor)};"
            data-user-id="${safeUserId}">
            <span class="user-avatar-initials">${escapeHtml(getAvatarInitials(safeNickname))}</span>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const TAG_STYLE_OPTIONS = new Set([
    'none',
    'aurora',
    'neon',
    'pulse',
    'wave',
    'galaxy',
    'angle',
    'angle2',
    'double-angle',
    'chevron',
    'brackets',
    'square',
    'corner',
    'round',
    'ornate',
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
    'sand',
    'wings',
    'blades',
    'orb',
    'sigil',
    'crown'
]);
const TAG_SYMBOL_OPTIONS = new Set([
    'none',
    'wings',
    'anime',
    'loading',
    'heart',
    'star',
    'sun',
    'youtube',
    'cat',
    'garry'
]);

const TAG_GIF_SYMBOL_STYLES = new Set([
    'wings',
    'anime',
    'loading',
    'heart',
    'star',
    'sun',
    'youtube',
    'cat',
    'garry'
]);
const TAG_BANNER_OPTIONS = new Set([
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
]);

const PROFILE_TAG_DEFAULT_TEXT_COLOR = '#FFFFFF';

function normalizeProfileTagStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'none';
    return TAG_STYLE_OPTIONS.has(raw) ? raw : 'none';
}

function normalizeProfileTagSymbolStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'none';
    return TAG_SYMBOL_OPTIONS.has(raw) ? raw : 'none';
}

function normalizeProfileTagBannerStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'pill';
    return TAG_BANNER_OPTIONS.has(raw) ? raw : 'pill';
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

function getProfileTagSymbolGlyphs(style) {
    switch (style) {
        case 'angle': return { left: '<', right: '>' };
        case 'angle2': return { left: '⟨', right: '⟩' };
        case 'double-angle': return { left: '《', right: '》' };
        case 'chevron': return { left: '❮', right: '❯' };
        case 'brackets': return { left: '[', right: ']' };
        case 'square': return { left: '【', right: '】' };
        case 'corner': return { left: '『', right: '』' };
        case 'round': return { left: '(', right: ')' };
        case 'ornate': return { left: '✦', right: '✦' };
        case 'spark': return { left: '✦', right: '✦' };
        case 'flare': return { left: '✶', right: '✶' };
        case 'crystal': return { left: '◆', right: '◆' };
        case 'laurel': return { left: '❧', right: '❧' };
        case 'aura': return { left: '✧', right: '✧' };
        case 'wings': return { left: '༺', right: '༻' };
        case 'blades': return { left: '⟦', right: '⟧' };
        case 'orb': return { left: '◯', right: '◯' };
        case 'sigil': return { left: '✵', right: '✵' };
        case 'crown': return { left: '♔', right: '♔' };
        default: return { left: '', right: '' };
    }
}

function buildTagSymbolHtml(symbolStyle, text) {
    const normalized = normalizeProfileTagSymbolStyle(symbolStyle);
    const safeText = escapeHtml(text || '');

    if (TAG_GIF_SYMBOL_STYLES.has(normalized)) {
        return `
            <span class="tag-gif tag-gif-${escapeHtml(normalized)} center" aria-hidden="true"></span>
            <span class="tag-gif tag-gif-${escapeHtml(normalized)} left" aria-hidden="true"></span>
            <span class="tag-text">${safeText}</span>
            <span class="tag-gif tag-gif-${escapeHtml(normalized)} right" aria-hidden="true"></span>
        `;
    }

    const symbols = getProfileTagSymbolGlyphs(normalized);
    if (!symbols.left && !symbols.right) {
        return `<span class="tag-text">${safeText}</span>`;
    }
    return `
        <span class="tag-symbol left">${escapeHtml(symbols.left)}</span>
        <span class="tag-text">${safeText}</span>
        <span class="tag-symbol right">${escapeHtml(symbols.right)}</span>
    `;
}
function resolveProfileTagTheme({
    color,
    gradientStart,
    gradientEnd,
    useGradient,
    textColor
} = {}) {
    const base = normalizeProfileTagColor(color) || '#EC4899';
    const start = normalizeProfileTagColor(gradientStart) || base;
    const end = normalizeProfileTagColor(gradientEnd) || '#8B5CF6';
    const text = normalizeProfileTagColor(textColor) || PROFILE_TAG_DEFAULT_TEXT_COLOR;
    if (!normalizeProfileTagBool(useGradient)) {
        return { color1: base, color2: base, textColor: text };
    }
    return { color1: start, color2: end, textColor: text };
}

const TAG_STYLE_PALETTES = {
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

function applyFixedTagPalette(style, theme) {
    const palette = TAG_STYLE_PALETTES[style];
    if (!palette || palette.length === 0) return theme;
    return {
        ...theme,
        color1: palette[0],
        color2: palette[palette.length - 1]
    };
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

function splitTaglineUrlAndTrailingPunctuation(value) {
    let core = String(value || '');
    let trailing = '';

    while (core && /[),.!?:;]$/.test(core)) {
        trailing = core.slice(-1) + trailing;
        core = core.slice(0, -1);
    }

    return { core, trailing };
}

function buildTaglineLineHtml(line) {
    const source = String(line || '');
    const tokenRegex = /(\[([^\]\r\n]{1,100})\]\(((?:https?:\/\/|www\.)[^\s)]+)\))|(([^()\s<\[\]]{1,100})\(((?:https?:\/\/|www\.)[^\s)]+)\))|((?:https?:\/\/|www\.)[^\s<]+)/gi;
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
            const { core, trailing } = splitTaglineUrlAndTrailingPunctuation(autoUrlMatch || rawMatch);
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
    const normalized = String(value || '')
        .replace(/\r\n/g, '\n')
        .trim();
    if (!normalized.trim()) return '';

    return normalized
        .split('\n')
        .map((line) => buildTaglineLineHtml(line))
        .join('<br>');
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
            // fallback abaixo cobre casos comuns
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

function resolveRankSubtitle(rank) {
    const description = normalizeBrokenUtf8Text(rank?.description || '').trim();
    if (description) return description;

    const customText = normalizeBrokenUtf8Text(rank?.customText || '').trim();
    if (customText) return customText;

    const rankName = String(rank?.name || '').trim().toLowerCase();
    switch (rankName) {
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

function buildRankBadge(rank) {
    if (!rank || !rank.name) return '';
    const color = rank.color || '#6B46C1';
    const subtitle = resolveRankSubtitle(rank);
    const subtitleFlag = subtitle ? '1' : '0';
    const subtitleAttr = subtitle ? ` data-rank-subtitle="${escapeHtml(subtitle)}"` : '';
    return `
        <p class="download-rank-badge" data-rank-has-subtitle="${subtitleFlag}"${subtitleAttr} style="margin: 2px 0 0 0; font-size: 11px; background: ${color}20; color: ${color}; padding: 3px 8px; border-radius: 3px; display: inline-block; border: 1px solid ${color}40; font-weight: 600; text-shadow: 0 0 4px rgba(0,0,0,0.8);">
            ${escapeHtml(rank.name)}
        </p>
    `;
}

let rankSubtitleTooltipEl = null;

function ensureRankSubtitleTooltipElement() {
    if (rankSubtitleTooltipEl && document.body.contains(rankSubtitleTooltipEl)) {
        return rankSubtitleTooltipEl;
    }

    const el = document.createElement('div');
    el.id = 'downloadRankSubtitleTooltip';
    el.className = 'download-rank-tooltip';
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');
    el.style.opacity = '0';
    document.body.appendChild(el);
    rankSubtitleTooltipEl = el;
    return el;
}

function hideRankSubtitleTooltip() {
    const tooltip = ensureRankSubtitleTooltipElement();
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(4px) scale(0.98)';
    tooltip.setAttribute('aria-hidden', 'true');
}

function positionRankSubtitleTooltip(anchorRect) {
    const tooltip = ensureRankSubtitleTooltipElement();
    const margin = 12;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const rect = anchorRect || { left: 0, top: 0, width: 0, height: 0 };

    let left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
    let top = rect.top - tooltip.offsetHeight - 10;

    if (left < margin) left = margin;
    if (left + tooltip.offsetWidth > viewportWidth - margin) {
        left = viewportWidth - tooltip.offsetWidth - margin;
    }

    if (top < margin) {
        top = rect.bottom + 10;
    }
    if (top + tooltip.offsetHeight > viewportHeight - margin) {
        top = Math.max(margin, viewportHeight - tooltip.offsetHeight - margin);
    }

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
}

function showRankSubtitleTooltip(targetEl) {
    if (!targetEl) return;
    const subtitle = String(targetEl.dataset.rankSubtitle || '').trim();
    if (!subtitle) return;

    const tooltip = ensureRankSubtitleTooltipElement();
    tooltip.textContent = subtitle;
    tooltip.setAttribute('aria-hidden', 'false');
    positionRankSubtitleTooltip(targetEl.getBoundingClientRect());
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0) scale(1)';
}

function initRankBadgeTooltips(root = document) {
    const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
    scope.querySelectorAll('.download-rank-badge[data-rank-subtitle]').forEach((badge) => {
        if (badge.dataset.tooltipBound === '1') return;
        badge.dataset.tooltipBound = '1';

        badge.addEventListener('mouseenter', () => {
            showRankSubtitleTooltip(badge);
        });

        badge.addEventListener('mousemove', () => {
            if (!rankSubtitleTooltipEl || rankSubtitleTooltipEl.getAttribute('aria-hidden') === 'true') return;
            positionRankSubtitleTooltip(badge.getBoundingClientRect());
        });

        badge.addEventListener('mouseleave', hideRankSubtitleTooltip);
        badge.addEventListener('blur', hideRankSubtitleTooltip);
        badge.addEventListener('focus', () => {
            showRankSubtitleTooltip(badge);
        });
    });
}

function formatFileSize(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    const precision = size >= 10 || unitIndex === 0 ? 0 : 1;
    return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function normalizeCommentAttachment(comment) {
    if (!comment || !comment.attachmentPath) return null;
    const attachmentPath = String(comment.attachmentPath || '').trim();
    if (!attachmentPath) return null;
    const originalName = String(comment.attachmentOriginalName || '').trim() || 'arquivo';
    const mime = String(comment.attachmentMime || '').toLowerCase();
    const lowerName = originalName.toLowerCase();
    const hasImageExt = Array.from(COMMENT_IMAGE_EXTENSIONS).some((ext) => lowerName.endsWith(ext));
    const isImage = mime.startsWith('image/') || hasImageExt;

    return {
        url: resolveMediaUrl(attachmentPath, ''),
        originalName,
        mime,
        isImage,
        size: Number(comment.attachmentSize || 0)
    };
}

function renderCommentAttachment(comment) {
    const attachment = normalizeCommentAttachment(comment);
    if (!attachment || !attachment.url) return '';

    const safeName = escapeHtml(attachment.originalName);
    const safeSize = escapeHtml(formatFileSize(attachment.size));
    const safeHref = escapeHtml(attachment.url);

    if (attachment.isImage) {
        return `
            <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 8px; border: 1px solid rgba(56,189,248,0.5); border-radius: 8px; overflow: hidden; text-decoration: none;">
                <img src="${safeHref}" alt="${safeName}" style="display: block; max-width: 220px; max-height: 180px; object-fit: cover; background: rgba(0,0,0,0.25);">
                <span style="display: block; padding: 6px 8px; font-size: 11px; color: #9be7ff; background: rgba(3, 7, 20, 0.72);">${safeName} · ${safeSize}</span>
            </a>
        `;
    }

    return `
        <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; margin-top: 8px; padding: 7px 10px; border: 1px solid rgba(56,189,248,0.5); border-radius: 8px; color: #9be7ff; text-decoration: none; background: rgba(3, 7, 20, 0.45); font-size: 12px;">
            <span style="font-size: 14px;">📎</span>
            <span>${safeName} (${safeSize})</span>
        </a>
    `;
}

function hashSeed(value) {
    const text = String(value ?? '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function supportsAdvancedCardFx() {
    try {
        return Boolean(window?.matchMedia?.('(pointer:fine)').matches);
    } catch {
        return false;
    }
}

function bindCardFx(cardElement) {
    if (!cardElement || cardElement.dataset.fxBound === '1') return;
    if (!supportsAdvancedCardFx()) return;

    cardElement.dataset.fxBound = '1';
    cardElement.style.setProperty('--mx', '50%');
    cardElement.style.setProperty('--my', '50%');
    cardElement.style.setProperty('--rx', '0deg');
    cardElement.style.setProperty('--ry', '0deg');

    const onMove = (event) => {
        const rect = cardElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;

        const maxTilt = 7;
        const rotateY = ((x / rect.width) - 0.5) * (maxTilt * 2);
        const rotateX = (0.5 - (y / rect.height)) * (maxTilt * 2);

        cardElement.style.setProperty('--mx', `${px.toFixed(2)}%`);
        cardElement.style.setProperty('--my', `${py.toFixed(2)}%`);
        cardElement.style.setProperty('--rx', `${rotateX.toFixed(2)}deg`);
        cardElement.style.setProperty('--ry', `${rotateY.toFixed(2)}deg`);
        cardElement.classList.add('fx-active');
    };

    const onLeave = () => {
        cardElement.style.setProperty('--mx', '50%');
        cardElement.style.setProperty('--my', '50%');
        cardElement.style.setProperty('--rx', '0deg');
        cardElement.style.setProperty('--ry', '0deg');
        cardElement.classList.remove('fx-active');
    };

    cardElement.addEventListener('pointermove', onMove);
    cardElement.addEventListener('pointerleave', onLeave);
}

function attachInteractiveCardEffects(scope = document) {
    const root = scope && scope.querySelectorAll ? scope : document;
    root.querySelectorAll('.animated-download-card, .mini-profile-card').forEach(bindCardFx);
}

function resolveAnimatedThemeClass(seedValue) {
    const preferredTheme = arguments.length > 1 ? String(arguments[1] || '').trim() : '';
    if (ANIMATED_PROFILE_CARD_THEMES.includes(preferredTheme)) {
        return preferredTheme;
    }
    const index = hashSeed(seedValue) % ANIMATED_PROFILE_CARD_THEMES.length;
    return ANIMATED_PROFILE_CARD_THEMES[index];
}

function normalizeAnimatedGifUrl(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return resolveMediaUrl(raw, '');
    return '';
}

function normalizeAnimatedProfileGiphyId(value) {
    const raw = String(value || '').trim();
    return /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : '';
}

function buildGiphyEmbedMarkup(value) {
    const gifId = normalizeAnimatedProfileGiphyId(value);
    if (!gifId) return '';
    const embedUrl = `https://giphy.com/embed/${encodeURIComponent(gifId)}`;
    return `<iframe class="animated-profile-giphy-embed" src="${embedUrl}" title="GIF do GIPHY" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
}

function buildAnimatedCardConfig(seedValue, themeValue, visualModeValue, gifUrlValue, giphyIdValue = '') {
    const visualMode = String(visualModeValue || 'theme').trim().toLowerCase();
    const gifUrl = normalizeAnimatedGifUrl(gifUrlValue);
    const giphyId = normalizeAnimatedProfileGiphyId(giphyIdValue);

    if (visualMode === 'gif' && giphyId) {
        return {
            className: 'animated-profile-gif animated-profile-giphy',
            inlineStyle: '',
            embedHtml: buildGiphyEmbedMarkup(giphyId)
        };
    }

    if (visualMode === 'gif' && gifUrl) {
        return {
            className: 'animated-profile-gif',
            inlineStyle: `--animated-card-gif-url: url('${gifUrl.replace(/'/g, "\\'")}');`,
            embedHtml: ''
        };
    }

    return {
        className: resolveAnimatedThemeClass(seedValue, themeValue),
        inlineStyle: '',
        embedHtml: ''
    };
}

function normalizeDownloadLinkFormat(value) {
    const normalized = String(value || '').trim().toLowerCase();
    const isValid = DOWNLOAD_LINK_FORMAT_OPTIONS.some(option => option.value === normalized);
    return isValid ? normalized : 'auto';
}

function inferFormatFromUrl(url) {
    const rawUrl = String(url || '').trim();
    if (!rawUrl) return '';

    let pathName = rawUrl;
    try {
        pathName = new URL(rawUrl).pathname || '';
    } catch {
        pathName = rawUrl.split(/[?#]/)[0] || '';
    }

    const lowerPath = pathName.toLowerCase();
    const lastDot = lowerPath.lastIndexOf('.');
    if (lastDot < 0 || lastDot === lowerPath.length - 1) return '';

    const extension = lowerPath.slice(lastDot + 1);
    return DOWNLOAD_LINK_EXTENSION_FORMAT_MAP[extension] || '';
}

function getDownloadLinkFormatLabel(linkItem) {
    const explicitFormat = normalizeDownloadLinkFormat(linkItem?.format);
    if (explicitFormat && explicitFormat !== 'auto') {
        return DOWNLOAD_LINK_FORMAT_LABELS[explicitFormat] || explicitFormat.toUpperCase();
    }

    const inferred = inferFormatFromUrl(linkItem?.url || '');
    if (!inferred) return '';
    return DOWNLOAD_LINK_FORMAT_LABELS[inferred] || inferred.toUpperCase();
}

function isDownloadFileUrl(rawUrl) {
    const raw = String(rawUrl || '').trim();
    if (!raw) return false;

    try {
        const parsed = new URL(raw, window.location.origin);
        const pathname = String(parsed.pathname || '').toLowerCase();
        return pathname.startsWith('/uploads/download-files/')
            || pathname.startsWith('/api/downloads/file/');
    } catch {
        const normalized = raw.toLowerCase();
        return normalized.startsWith('/uploads/download-files/')
            || normalized.startsWith('/api/downloads/file/');
    }
}

async function cleanupUnattachedR2Uploads(uploadIds) {
    const uniqueUploadIds = [...new Set((Array.isArray(uploadIds) ? uploadIds : []).filter(Boolean))];
    for (const uploadId of uniqueUploadIds) {
        const result = await AuthAPI.abortDownloadFile(uploadId);
        if (!result?.success) {
            console.error(`Não foi possível remover o upload temporário ${uploadId}:`, result?.message);
        }
    }
}

function parseDownloadLinks(download) {
    const parsed = [];
    if (download?.links_json) {
        try {
            const rawLinks = JSON.parse(download.links_json);
            if (Array.isArray(rawLinks)) {
                rawLinks.forEach((entry) => {
                    if (typeof entry === 'string') {
                        const url = entry.trim();
                        if (!url) return;
                        parsed.push({ url, format: 'auto' });
                        return;
                    }

                    if (entry && typeof entry === 'object') {
                        const url = String(entry.url || entry.link || '').trim();
                        if (!url) return;
                        parsed.push({
                            url,
                            format: normalizeDownloadLinkFormat(entry.format)
                        });
                    }
                });
            }
        } catch {
            // Ignorar JSON inválido e usar fallback.
        }
    }

    if (parsed.length === 0 && download?.link) {
        const url = String(download.link).trim();
        if (url) parsed.push({ url, format: 'auto' });
    }

    return parsed.slice(0, MAX_DOWNLOAD_LINKS);
}

function getFormatOptionsHtml(selectedFormat = 'auto') {
    const selected = normalizeDownloadLinkFormat(selectedFormat);
    return DOWNLOAD_LINK_FORMAT_OPTIONS
        .map(option => `<option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${option.label}</option>`)
        .join('');
}

function buildPostLinkRowHtml(withRemoveButton = true) {
    return `
        <div class="download-link-row">
            <div class="download-link-grid">
                <div class="download-link-field">
                    <label class="downloadLinkLabel" style="display: block; margin-bottom: 5px; font-weight: 600; color: white;">Link *</label>
                    <input type="url" class="downloadLink" placeholder="https://..." style="width: 100%; padding: 10px; border: 1px solid #EC4899; border-radius: 5px; box-sizing: border-box; background: rgba(0,0,0,0.3); color: white;">
                </div>
                <div class="download-format-field">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600; color: white;">Formato</label>
                    <select class="downloadLinkFormat" style="width: 100%; padding: 10px; border: 1px solid #EC4899; border-radius: 5px; box-sizing: border-box; background: rgba(0,0,0,0.3); color: white;">
                        ${getFormatOptionsHtml('auto')}
                    </select>
                </div>
                ${withRemoveButton ? '<button type="button" class="btnRemoveLink download-link-action-btn" style="padding: 8px 12px; background: #EF4444; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">- Link</button>' : ''}
            </div>

            <div class="download-upload-row">
                <div class="download-mode-toggles">
                    <label style="display: inline-flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.85); font-weight: 700; cursor: pointer;">
                        <input type="checkbox" class="downloadUseLink themed-checkbox" checked>
                        Usar link (URL)
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.85); font-weight: 700; cursor: pointer;">
                        <input type="checkbox" class="downloadUseFile themed-checkbox">
                        Enviar arquivo
                    </label>
                </div>
                <small style="color: rgba(255,255,255,0.65); font-weight: 600;">Arquivo at&eacute; 500MB</small>
            </div>

            <div class="download-file-picker" hidden>
                <input type="file" class="downloadFile" accept="${DOWNLOAD_FILE_ACCEPT}" style="display:none;">
                <button type="button" class="download-file-btn">Escolher arquivo</button>
                <span class="download-file-name downloadFileName">Nenhum arquivo escolhido</span>
                <small class="download-file-hint">Máx.: 500MB</small>
            </div>
        </div>
    `;
}

function getPostLinksEntries() {
    const entries = [];

    Array.from(document.querySelectorAll('#linksContainer .download-link-row')).forEach((row) => {
        const useLink = row.querySelector('.downloadUseLink')?.checked === true;
        const useFile = row.querySelector('.downloadUseFile')?.checked === true;
        const url = String(row.querySelector('.downloadLink')?.value || '').trim();
        const selectedFormat = normalizeDownloadLinkFormat(row.querySelector('.downloadLinkFormat')?.value || 'auto');

        if (useLink && url) {
            entries.push({ type: 'url', url, format: selectedFormat });
        }

        if (useFile) {
            const fileInput = row.querySelector('.downloadFile');
            const file = fileInput?.files?.[0] || null;
            if (!file) return;
            const inferred = inferCompactFormatFromFilename(file.name);
            entries.push({ type: 'file', file, format: inferred === 'auto' ? 'zip' : inferred });
        }
    });

    return entries;
}

function resetPostLinksUi() {
    const linksContainer = document.getElementById('linksContainer');
    if (!linksContainer) return;

    const rows = Array.from(linksContainer.querySelectorAll('.download-link-row'));
    rows.forEach((row, idx) => {
        const urlInput = row.querySelector('.downloadLink');
        const formatSelect = row.querySelector('.downloadLinkFormat');
        const useLinkToggle = row.querySelector('.downloadUseLink');
        const useFileToggle = row.querySelector('.downloadUseFile');
        const fileInput = row.querySelector('.downloadFile');
        if (idx === 0) {
            if (urlInput) urlInput.value = '';
            if (formatSelect) formatSelect.value = 'auto';
            if (useLinkToggle) useLinkToggle.checked = true;
            if (useFileToggle) useFileToggle.checked = false;
            if (fileInput) fileInput.value = '';
            syncPostLinkRowMode(row);
            return;
        }
        row.remove();
    });
}

function inferCompactFormatFromFilename(filename) {
    const lower = String(filename || '').trim().toLowerCase();
    const dotIndex = lower.lastIndexOf('.');
    if (dotIndex === -1) return 'outro';
    const ext = lower.slice(dotIndex + 1);
    return DOWNLOAD_LINK_EXTENSION_FORMAT_MAP[ext] || 'outro';
}

function syncPostLinkRowMode(row) {
    if (!row) return;
    const useLinkToggle = row.querySelector('.downloadUseLink');
    const useFileToggle = row.querySelector('.downloadUseFile');
    if (!Boolean(globalDownloadUploadsEnabled) && useFileToggle) {
        useFileToggle.checked = false;
        useFileToggle.disabled = true;
    }
    const useLink = useLinkToggle?.checked === true;
    const useFile = useFileToggle?.checked === true;
    const urlInput = row.querySelector('.downloadLink');
    const fileInput = row.querySelector('.downloadFile');
    const filePicker = row.querySelector('.download-file-picker');
    const fileNameLabel = row.querySelector('.downloadFileName');
    const linkLabel = row.querySelector('.downloadLinkLabel');
    const formatSelect = row.querySelector('.downloadLinkFormat');

    if (urlInput) {
        urlInput.disabled = !useLink;
        urlInput.style.opacity = useLink ? '1' : '0.6';
    }

    if (linkLabel) {
        if (!useLink) {
            linkLabel.textContent = 'Link (desativado)';
        } else if (useLink && !useFile) {
            linkLabel.textContent = 'Link *';
        } else {
            linkLabel.textContent = 'Link (opcional)';
        }
    }

    if (filePicker) filePicker.hidden = !useFile;
    if (!useFile && fileInput) {
        fileInput.value = '';
    }
    if (fileNameLabel) {
        fileNameLabel.textContent = fileInput?.files?.[0]?.name || 'Nenhum arquivo escolhido';
    }

    if (formatSelect) {
        const onlyFile = useFile && !useLink;
        formatSelect.disabled = onlyFile;
        formatSelect.style.opacity = onlyFile ? '0.7' : '1';
        if (onlyFile) {
            const inferred = inferCompactFormatFromFilename(fileInput?.files?.[0]?.name);
            formatSelect.value = inferred === 'auto' ? 'zip' : inferred;
        } else if (!formatSelect.value) {
            formatSelect.value = 'auto';
        }
    }
}

function bindPostLinkRow(row) {
    if (!row || row.dataset.bound === '1') return;
    row.dataset.bound = '1';

    const useLinkToggle = row.querySelector('.downloadUseLink');
    const useFileToggle = row.querySelector('.downloadUseFile');
    const fileInput = row.querySelector('.downloadFile');
    const fileButton = row.querySelector('.download-file-btn');
    const fileNameLabel = row.querySelector('.downloadFileName');

    const ensureAtLeastOneMode = (preferred = 'link') => {
        const linkOn = useLinkToggle?.checked === true;
        const fileOn = useFileToggle?.checked === true;
        if (linkOn || fileOn) return;

        if (preferred === 'file') {
            if (useFileToggle) useFileToggle.checked = true;
            return;
        }

        if (useLinkToggle) useLinkToggle.checked = true;
    };

    const syncFileName = () => {
        if (!fileNameLabel) return;
        fileNameLabel.textContent = fileInput?.files?.[0]?.name || 'Nenhum arquivo escolhido';
    };

    fileButton?.addEventListener('click', (event) => {
        event.preventDefault();
        fileInput?.click();
    });

    useLinkToggle?.addEventListener('change', () => {
        ensureAtLeastOneMode('link');
        syncPostLinkRowMode(row);
    });

    useFileToggle?.addEventListener('change', () => {
        ensureAtLeastOneMode('file');
        syncPostLinkRowMode(row);
    });

    fileInput?.addEventListener('change', () => {
        const file = fileInput?.files?.[0] || null;
        if (file && Number(file.size || 0) > MAX_DOWNLOAD_FILE_BYTES) {
            showNotification('Arquivo muito grande (máximo 500MB).', 'error');
            fileInput.value = '';
        }
        syncFileName();
        ensureAtLeastOneMode('file');
        syncPostLinkRowMode(row);
    });

    syncFileName();
    ensureAtLeastOneMode('link');
    syncPostLinkRowMode(row);
}

function syncPostButtonAvailability() {
    const postButton = document.getElementById('btnPostDownload');
    const blockedReasonBox = document.getElementById('postDownloadBlockedReason');
    const blockedReasonText = document.getElementById('postDownloadBlockedReasonText');
    const openProfileSettingsBtn = document.getElementById('openProfileAccountSettingsBtn');

    if (!postButton) return;

    const isLoggedIn = Boolean(currentUser && currentUser.id);
    if (!isLoggedIn) {
        postButton.style.display = 'none';
        if (blockedReasonBox) blockedReasonBox.style.display = 'none';
        if (blockedReasonText) blockedReasonText.textContent = '';
        if (openProfileSettingsBtn) openProfileSettingsBtn.style.display = 'none';
        return;
    }

    const isBlocked = !userCanPost;
    const emailVerified = Boolean(currentUser?.emailVerified);

    if (isBlocked) {
        postButton.style.display = 'none';
        const reasonText = emailVerified
            ? 'Você não tem permissão para postar downloads neste momento. Fale com um administrador para liberar o acesso.'
            : 'Seu e-mail ainda não foi confirmado. Confirme seu e-mail em Configurações da Conta para poder postar downloads.';

        if (blockedReasonText) blockedReasonText.textContent = reasonText + ' ';
        if (blockedReasonBox) blockedReasonBox.style.display = 'block';
        if (openProfileSettingsBtn) {
            openProfileSettingsBtn.style.display = emailVerified ? 'none' : 'inline-flex';
            openProfileSettingsBtn.onclick = () => {
                localStorage.setItem('openProfileAccountSettings', '1');
                window.location.href = 'profile.html';
            };
        }
    } else {
        postButton.style.display = 'inline-flex';
        postButton.textContent = 'Postar Download';
        if (blockedReasonBox) blockedReasonBox.style.display = 'none';
    }

    syncDownloadUploadPermissionUi();
}

function syncDownloadUploadPermissionUi() {
    const canUpload = Boolean(globalDownloadUploadsEnabled);

    document.querySelectorAll('.downloadUseFile, .editDownloadUseFile').forEach((checkbox) => {
        if (!canUpload) {
            checkbox.checked = false;
            checkbox.disabled = true;
            const label = checkbox.closest('label');
            if (label) {
                label.style.opacity = '0.55';
                label.removeAttribute('title');
                bindDownloadUploadUnavailableTooltip(label);
            }
        } else {
            checkbox.disabled = false;
            const label = checkbox.closest('label');
            if (label) {
                label.style.opacity = '';
                label.removeAttribute('title');
                unbindDownloadUploadUnavailableTooltip(label);
            }
        }
    });

    document.querySelectorAll('.download-file-picker, .edit-download-file-picker').forEach((picker) => {
        if (!canUpload) picker.hidden = true;
    });

    document.querySelectorAll('.download-upload-row').forEach((row) => {
        const hint = row.querySelector('small');
        if (!hint) return;
        if (!canUpload) {
            hint.hidden = true;
            hint.textContent = '';
            hint.style.cssText = '';
        } else {
            hint.textContent = 'Arquivo até 500MB';
            hint.hidden = false;
            hint.style.cssText = 'color:rgba(255,255,255,.65);font-weight:600;';
        }
    });
}

function ensureDownloadUploadUnavailableTooltip() {
    let tooltip = document.getElementById('downloadUploadUnavailableTooltip');
    if (tooltip) return tooltip;

    tooltip = document.createElement('div');
    tooltip.id = 'downloadUploadUnavailableTooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.textContent = 'Essa opção está indisponivel no momento';
    tooltip.style.cssText = [
        'position:fixed',
        'left:0',
        'top:0',
        'z-index:12000',
        'max-width:min(320px,calc(100vw - 24px))',
        'padding:8px 10px',
        'border-radius:9px',
        'border:1px solid rgba(236,72,153,.72)',
        'background:linear-gradient(145deg,rgba(34,19,79,.96),rgba(14,24,56,.95))',
        'color:#F3E8FF',
        'font-size:12px',
        'line-height:1.35',
        'font-weight:600',
        'letter-spacing:.1px',
        'pointer-events:none',
        'opacity:0',
        'transform:translateY(4px) scale(.98)',
        'transition:opacity .16s ease,transform .16s ease',
        'box-shadow:0 10px 24px rgba(0,0,0,.45),0 0 18px rgba(236,72,153,.24)',
        'backdrop-filter:blur(7px)'
    ].join(';');
    document.body.appendChild(tooltip);
    return tooltip;
}

function showDownloadUploadUnavailableTooltip(label) {
    const tooltip = ensureDownloadUploadUnavailableTooltip();
    const rect = label.getBoundingClientRect();
    tooltip.setAttribute('aria-hidden', 'false');
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0) scale(1)';

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const margin = 12;
    let left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
    let top = rect.top - tooltip.offsetHeight - 10;

    left = Math.max(margin, Math.min(left, viewportWidth - tooltip.offsetWidth - margin));
    if (top < margin) top = rect.bottom + 10;
    top = Math.max(margin, Math.min(top, viewportHeight - tooltip.offsetHeight - margin));

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
}

function hideDownloadUploadUnavailableTooltip() {
    const tooltip = document.getElementById('downloadUploadUnavailableTooltip');
    if (!tooltip) return;
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(4px) scale(.98)';
    tooltip.setAttribute('aria-hidden', 'true');
}

function bindDownloadUploadUnavailableTooltip(label) {
    if (!label || label.dataset.downloadUploadTooltipBound === '1') return;
    label.dataset.downloadUploadTooltipBound = '1';
    label.addEventListener('mouseenter', () => {
        if (label.dataset.downloadUploadTooltipBound === '1') showDownloadUploadUnavailableTooltip(label);
    });
    label.addEventListener('mouseleave', hideDownloadUploadUnavailableTooltip);
    label.addEventListener('focusin', () => {
        if (label.dataset.downloadUploadTooltipBound === '1') showDownloadUploadUnavailableTooltip(label);
    });
    label.addEventListener('focusout', hideDownloadUploadUnavailableTooltip);
}

function unbindDownloadUploadUnavailableTooltip(label) {
    if (!label) return;
    delete label.dataset.downloadUploadTooltipBound;
}

function isDownloadHeartedByViewer(download) {
    return Boolean(download?.viewerHasHeart) || Number(download?.viewerHasHeart) === 1;
}

function isDownloadLikedByViewer(download) {
    return Boolean(download?.viewerHasLike) || Number(download?.viewerHasLike) === 1;
}

function syncFavoritesToggleButton() {
    const favoritesButton = document.getElementById('btnFavorites');
    if (!favoritesButton) return;

    const isActive = showingFavoritesOnly;
    favoritesButton.textContent = isActive ? 'Todos os Downloads' : 'Meus Favoritos';
    favoritesButton.style.background = isActive
        ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.95), rgba(107, 70, 193, 0.95))'
        : 'rgba(236, 72, 153, 0.2)';
    favoritesButton.style.color = '#FFFFFF';
    favoritesButton.style.borderColor = isActive ? '#F9A8D4' : '#EC4899';
    favoritesButton.style.boxShadow = isActive
        ? '0 0 18px rgba(236, 72, 153, 0.5)'
        : 'none';
}

function canUseAdultPostOptions() {
    return Boolean(currentUser?.isAdult);
}

function setPostAdvancedOptionsExpanded(expanded) {
    const toggleBtn = document.getElementById('postAdvancedOptionsToggle');
    const content = document.getElementById('postAdvancedOptionsContent');
    const label = toggleBtn?.querySelector('.post-advanced-toggle-text');
    if (!toggleBtn || !content) return;

    const isExpanded = Boolean(expanded);
    toggleBtn.classList.toggle('is-expanded', isExpanded);
    toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    if (label) {
        label.textContent = isExpanded
            ? 'Ocultar opções avançadas'
            : 'Mostrar opções avançadas';
    }
    content.hidden = !isExpanded;
}

function setupPostAdvancedOptionsToggle() {
    const toggleBtn = document.getElementById('postAdvancedOptionsToggle');
    if (!toggleBtn || toggleBtn.dataset.bound === '1') return;

    toggleBtn.dataset.bound = '1';
    toggleBtn.addEventListener('click', () => {
        const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        setPostAdvancedOptionsExpanded(!isExpanded);
    });
    setPostAdvancedOptionsExpanded(false);
}

function syncAdultPostOptionVisibility() {
    const adultOptionBox = document.getElementById('downloadAdultOptionBox');
    const adultCheckbox = document.getElementById('downloadIsAdult');
    if (!adultOptionBox || !adultCheckbox) return;

    const allowed = canUseAdultPostOptions();
    adultOptionBox.style.display = allowed ? '' : 'none';
    if (!allowed) {
        adultCheckbox.checked = false;
    }
}

async function openPostDownloadModal() {
    if (!userCanPost) {
        if (currentUser && !currentUser.emailVerified) {
            showNotification('Confirme seu e-mail antes de postar downloads.', 'error');
        } else {
            showNotification('Você não tem permissão para postar downloads', 'error');
        }
        return;
    }

    // Verificar se tem postagens suspensas antes de abrir
    if (currentUser) {
        try {
            const response = await AuthAPI.getSuspendedPostsUser?.();
            if (response && response.suspensions) {
                const activeSuspensions = response.suspensions.filter(s => s.status !== 'resolved');
                if (activeSuspensions.length > 0) {
                    showNotification(
                        'Você possui postagens suspendidas. Resolva-as antes de postar novas postagens.',
                        'warning'
                    );
                    return;
                }
            }
        } catch (error) {
            console.warn('Erro ao verificar suspensões:', error);
            // Continuar mesmo se houver erro
        }
    }

    const postModal = document.getElementById('postDownloadModal');
    if (!postModal) return;

    syncAdultPostOptionVisibility();
    setPostAdvancedOptionsExpanded(false);

    const errorDiv = document.getElementById('postErrorMessage');
    if (errorDiv) errorDiv.style.display = 'none';
    postModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closePostDownloadModal() {
    const postModal = document.getElementById('postDownloadModal');
    if (!postModal) return;
    postModal.style.display = 'none';
    const formatHelpTooltip = document.getElementById('formatHelpTooltip');
    if (formatHelpTooltip) formatHelpTooltip.style.display = 'none';
    document.body.style.overflow = '';
}

function setupFormatHelpTooltip() {
    const wrapper = document.getElementById('formatHelpWrapper');
    const toggle = document.getElementById('formatHelpToggle');
    const tooltip = document.getElementById('formatHelpTooltip');
    if (!wrapper || !toggle || !tooltip) return;

    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isVisible = tooltip.style.display === 'block';
        tooltip.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
        if (tooltip.style.display !== 'block') return;
        if (wrapper.contains(e.target)) return;
        tooltip.style.display = 'none';
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            tooltip.style.display = 'none';
        }
    });
}

// Carregar usuário autenticado ao abrir página
async function loadGlobalDownloadUploadsSetting() {
    try {
        const response = await AuthAPI.getDownloadUploadSettings();
        globalDownloadUploadsEnabled = response?.success === true && response.enabled === true;
        syncDownloadUploadPermissionUi();
    } catch {
        globalDownloadUploadsEnabled = false;
        syncDownloadUploadPermissionUi();
    }
}

async function loadCurrentUser() {
    const token = localStorage.getItem('token');
    if (!token) {
        currentUser = null;
        userCanPost = false;
        showingFavoritesOnly = false;
        syncPostButtonAvailability();
        syncFavoritesToggleButton();
        syncAdultPostOptionVisibility();
        return;
    }

    try {
        const response = await AuthAPI.getProfile();
        if (response.success) {
            currentUser = response.user;
            
            // Verificar se pode postar downloads
            const permResponse = await AuthAPI.checkCanPostDownloads();
            if (permResponse.success) {
                userCanPost = permResponse.canPost;
                syncPostButtonAvailability();
            }

            // Verificar se pode gerenciar downloads (editar/excluir outros)
            const manageResponse = await AuthAPI.checkCanManageDownloads();
            if (manageResponse.success) {
                userCanManageDownloads = manageResponse.canManage;
            }

            // Verificar se pode suspender postagens
            const suspendResponse = await AuthAPI.checkCanSuspendPosts();
            if (suspendResponse.success) {
                userCanSuspendPosts = suspendResponse.canSuspend;
                console.log('[LOAD-USER] Pode suspender postagens:', userCanSuspendPosts);
            } else {
                console.log('[LOAD-USER] Erro ao verificar permissão de suspensão:', suspendResponse);
            }
            
            // Notificacoes globais ficam no auth-manager.js
        } else {
            currentUser = null;
            showingFavoritesOnly = false;
        }
        syncFavoritesToggleButton();
        syncAdultPostOptionVisibility();
    } catch (error) {
        console.error('Erro ao carregar usuário:', error);
        currentUser = null;
        showingFavoritesOnly = false;
        syncFavoritesToggleButton();
        syncAdultPostOptionVisibility();
    }
}

// Carregar downloads com conquistas
async function loadDownloads() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) loadingSpinner.style.display = 'block';
    
    try {
        const response = await AuthAPI.getDownloadsWithRanks();
        if (response.success) {
            allDownloads = response.downloads || [];
            filterAndRender();
        }
    } catch (error) {
        console.error('Erro ao carregar downloads:', error);
        allDownloads = [];
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}

// Abrir um post especifico vindo de notifica\u00e7\u00e3o (query string)
function handleNotificationDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const downloadId = params.get('downloadId');
    const openComments = params.get('openComments') === '1';

    if (!downloadId) return;

    let targetCard = document.querySelector(`.download-card[data-id="${downloadId}"]`);
    if (!targetCard && filteredDownloadsCache.length > 0) {
        const targetIndex = filteredDownloadsCache.findIndex((item) => String(item.id) === String(downloadId));
        if (targetIndex >= 0) {
            const targetPage = Math.floor(targetIndex / DOWNLOADS_PER_PAGE) + 1;
            if (targetPage !== currentDownloadsPage) {
                currentDownloadsPage = targetPage;
                renderDownloads(filteredDownloadsCache, { preservePage: true });
                targetCard = document.querySelector(`.download-card[data-id="${downloadId}"]`);
            }
        }
    }
    if (!targetCard) return;

    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const previousTransition = targetCard.style.transition;
    targetCard.style.transition = 'box-shadow 0.25s ease, border-color 0.25s ease';
    targetCard.style.boxShadow = '0 0 0 2px rgba(236, 72, 153, 0.75), 0 0 22px rgba(236, 72, 153, 0.45)';
    targetCard.style.borderColor = 'rgba(236, 72, 153, 0.9)';

    setTimeout(() => {
        targetCard.style.boxShadow = '';
        targetCard.style.borderColor = '';
        targetCard.style.transition = previousTransition;
    }, 2200);

    if (openComments && currentUser) {
        setTimeout(() => {
            showCommentForm(downloadId);
        }, 450);
    }

    params.delete('downloadId');
    params.delete('openComments');
    const rest = params.toString();
    const cleanUrl = `${window.location.pathname}${rest ? `?${rest}` : ''}`;
    window.history.replaceState({}, document.title, cleanUrl);
}

// ===================== POSTAGENS SUSPENSAS =====================

async function loadSuspendedPostsUser() {
    if (!currentUser) return;

    try {
        const response = await AuthAPI.getSuspendedPostsUser?.();
        if (!response || !response.suspensions) return;

        // Filtrar apenas suspensões suspensas (não em revisão ou resolvidas)
        const suspensions = (response.suspensions || []).filter(s => s.status === 'suspended');
        if (suspensions.length === 0) {
            document.getElementById('suspendedSection').style.display = 'none';
            return;
        }

        const container = document.getElementById('suspendedPostsUserList');
        const section = document.getElementById('suspendedSection');
        
        let html = '';
        suspensions.forEach(suspension => {
            const statusLabel = 'Suspensa';
            
            // Não mostrar "Enviar para Revisão" se for admin
            const showSubmitButton = !userCanSuspendPosts;
            
            html += `
                <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(236, 72, 153, 0.5); border-radius: 8px; padding: 15px;">
                    <h3 style="margin: 0 0 8px 0; color: #EC4899; font-size: 14px;">${escapeHtml(suspension.name)}</h3>
                    <div style="color: #AAA; font-size: 12px; margin-bottom: 8px;">
                        <div><strong>Status:</strong> ${statusLabel}</div>
                        <div><strong>Motivo:</strong> ${escapeHtml(suspension.reason)}</div>
                    </div>
                    ${suspension.description ? `<p style="font-size: 12px; color: #CCC; margin: 8px 0;">Descrição: ${escapeHtml(suspension.description)}</p>` : ''}
                    <div id="buttons-container-${suspension.downloadId}" style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button onclick="editSuspendedPost(${suspension.downloadId})" style="flex: 1; min-width: 60px; padding: 8px 12px; background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); color: white; border: 1px solid #6B46C1; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(107, 70, 193, 0.3);">Editar</button>
                        ${showSubmitButton ? `<button onclick="openSuspensionReviewModal(${suspension.downloadId})" style="flex: 1; min-width: 80px; padding: 8px 12px; background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); color: white; border: 1px solid #22C55E; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(34, 197, 94, 0.3);">Enviar para Revisão</button>` : ''}
                        <button onclick="deleteSuspendedPost(${suspension.downloadId})" style="flex: 1; min-width: 60px; padding: 8px 12px; background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; border: 1px solid #EF4444; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);">Excluir</button>
                    </div>
                    <div id="status-message-${suspension.downloadId}" style="display: none; padding: 10px 12px; background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%); border: 1px solid rgba(34, 197, 94, 0.6); border-radius: 4px; color: #86EFAC; font-size: 12px; text-align: center; font-weight: 600; box-shadow: 0 0 10px rgba(34, 197, 94, 0.2);">
                        Postagem enviada para revisão! Aguarde enquanto a equipe de moderação analisa.
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        section.style.display = 'block';
    } catch (error) {
        console.error('Erro ao carregar postagens suspensas:', error);
    }
}

async function editSuspendedPost(downloadId) {
    const download = allDownloads.find(d => d.id == downloadId);
    if (!download) {
        showNotification('Postagem não encontrada', 'error');
        return;
    }
    
    // Abrir o formulário de edição para este download
    showEditDownloadForm(download);
}

async function openSuspensionReviewModal(downloadId) {
    const download = allDownloads.find(d => d.id == downloadId);
    
    if (!download || download.suspensionStatus !== 'suspended') {
        showNotification('Esta postagem não está suspensa', 'error');
        return;
    }

    // Criar modal para enviar revisão
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #A78BFA;
        border-radius: 12px;
        padding: 30px;
        max-width: 500px;
        text-align: center;
        color: white;
        box-shadow: 0 0 30px rgba(167, 139, 250, 0.3);
    `;
    
    content.innerHTML = `
        <h3 style="color: #C4B5FD; margin-bottom: 15px; font-size: 20px;">Enviar para Revisão</h3>
        <p style="color: rgba(255,255,255,0.8); margin-bottom: 20px;">Sua postagem foi editada. Descreva as alterações que você fez:</p>
        <textarea id="reviewMessage" placeholder="O que você alterou na postagem?" style="
            width: 100%;
            padding: 12px;
            background: rgba(255,255,255,0.1);
            border: 1px solid #A78BFA;
            border-radius: 5px;
            color: white;
            min-height: 100px;
            font-family: inherit;
            font-size: 14px;
            margin-bottom: 20px;
            box-sizing: border-box;
        "></textarea>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="cancelReview" style="padding: 10px 20px; background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); color: white; border: 1px solid #6B46C1; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s;">Cancelar</button>
            <button id="confirmReview" style="padding: 10px 20px; background: linear-gradient(135deg, #A78BFA 0%, #C4B5FD 100%); color: #1A1A2E; border: 1px solid #A78BFA; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s;">Enviar para Revisão</button>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    const messageInput = document.getElementById('reviewMessage');
    const cancelBtn = document.getElementById('cancelReview');
    const confirmBtn = document.getElementById('confirmReview');
    
    messageInput.focus();
    
    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    confirmBtn.addEventListener('click', async () => {
        const message = messageInput.value.trim();
        if (!message) {
            showNotification('Por favor, descreva as alterações que você fez', 'warning');
            return;
        }
        
        // Enviar para revisão
        const response = await AuthAPI.requestDownloadReview(downloadId, message);
        if (response.success) {
            showNotification('Postagem enviada para revisão! Aguarde o feedback da equipe.', 'success');
            modal.remove();
            loadDownloads();
            loadSuspendedPostsUser();
        } else {
            showNotification(response.message || 'Erro ao enviar para revisão', 'error');
        }
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

async function deleteSuspendedPost(downloadId) {
    const confirmed = confirm('Tem certeza que deseja excluir esta postagem suspensa? Esta ação não pode ser desfeita.');
    if (!confirmed) return;

    try {
        const response = await AuthAPI.deleteDownload(downloadId);
        if (response.success) {
            showNotification('Postagem excluída com sucesso', 'success');
            // Recarregar a lista de postagens suspensas
            await loadSuspendedPostsUser();
            // Recarregar downloads se estiver na página
            await loadDownloads();
        } else {
            showNotification(response.message || 'Erro ao excluir postagem', 'error');
        }
    } catch (error) {
        console.error('Erro ao deletar postagem suspensa:', error);
        showNotification('Erro ao excluir postagem', 'error');
    }
}

function resolveRenderStateForPage(downloadsToRender) {
    const totalItems = Array.isArray(downloadsToRender) ? downloadsToRender.length : 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / DOWNLOADS_PER_PAGE));
    if (currentDownloadsPage > totalPages) currentDownloadsPage = totalPages;
    if (currentDownloadsPage < 1) currentDownloadsPage = 1;

    const startIndex = (currentDownloadsPage - 1) * DOWNLOADS_PER_PAGE;
    const endIndex = startIndex + DOWNLOADS_PER_PAGE;
    const pageItems = downloadsToRender.slice(startIndex, endIndex);

    return { totalItems, totalPages, startIndex, endIndex, pageItems };
}

function renderDownloadsPagination(totalItems, totalPages) {
    const paginationContainer = document.getElementById('downloadsPagination');
    if (!paginationContainer) return;

    if (totalItems <= DOWNLOADS_PER_PAGE) {
        paginationContainer.innerHTML = '';
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';
    const pagesHtml = Array.from({ length: totalPages }, (_, idx) => {
        const page = idx + 1;
        const isActive = page === currentDownloadsPage;
        return `<button type="button" class="downloads-page-btn ${isActive ? 'active' : ''}" data-page="${page}">${page}</button>`;
    }).join('');

    paginationContainer.innerHTML = `
        <button type="button" class="downloads-page-btn" data-page="prev" ${currentDownloadsPage === 1 ? 'disabled' : ''}>Anterior</button>
        ${pagesHtml}
        <button type="button" class="downloads-page-btn" data-page="next" ${currentDownloadsPage === totalPages ? 'disabled' : ''}>Pr\u00f3xima</button>
    `;

    paginationContainer.querySelectorAll('.downloads-page-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const action = String(btn.dataset.page || '').trim();
            if (!action) return;
            if (action === 'prev') {
                currentDownloadsPage = Math.max(1, currentDownloadsPage - 1);
            } else if (action === 'next') {
                currentDownloadsPage = Math.min(totalPages, currentDownloadsPage + 1);
            } else {
                const nextPage = Number(action);
                if (!Number.isFinite(nextPage)) return;
                currentDownloadsPage = Math.min(totalPages, Math.max(1, nextPage));
            }
            renderDownloads(filteredDownloadsCache, { preservePage: true });
            window.scrollTo({ top: document.getElementById('downloads')?.offsetTop || 0, behavior: 'smooth' });
        });
    });
}

// Filtrar e renderizar downloads
async function filterAndRender(options = {}) {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const sortValue = document.getElementById('sortSelect')?.value || 'date-desc';
    
    // Extrair tipo de ordenação e verificar se é favoritos
    const sortType = sortValue === 'favorites' ? 'date-desc' : sortValue;
    showingFavoritesOnly = (sortValue === 'favorites');
    
    const preservePage = Boolean(options.preservePage);

    if (!preservePage) {
        currentDownloadsPage = 1;
    }

    let filtered = allDownloads.filter(download => 
        download.name.toLowerCase().includes(searchTerm) ||
        (download.description && download.description.toLowerCase().includes(searchTerm)) ||
        download.nickname.toLowerCase().includes(searchTerm)
    );

    if (showingFavoritesOnly) {
        filtered = filtered.filter((download) => isDownloadHeartedByViewer(download));
    }

    filtered = sortDownloads(filtered, sortType);
    filteredDownloadsCache = filtered;
    renderDownloads(filtered, { preservePage: true });
}

function normalizeCardAccentColor(rawColor, fallback = '#EC4899') {
    const candidate = String(rawColor || '').trim();
    if (!candidate) return fallback;
    return candidate;
}

function getAccentMixColor(accentColor, percent) {
    const amount = Math.max(0, Math.min(100, Number(percent) || 0));
    return `color-mix(in srgb, ${accentColor} ${amount}%, transparent)`;
}

function buildReactionIconDataUri(type, color) {
    const safeColor = normalizeCardAccentColor(color, '#EC4899');
    const iconType = String(type || '').trim().toLowerCase();
    const iconPathByType = {
        like: "M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z",
        heart: "M12 17.27L18.18 21 16.54 13.97 22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z",
        comment: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
    };
    const path = iconPathByType[iconType] || iconPathByType.like;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${safeColor}'><path d='${path}'/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function applyReactionButtonVisualState(button, isActive) {
    if (!button) return;
    const accentColor = normalizeCardAccentColor(button.dataset.accentColor, '#EC4899');
    const inactiveBorder = getAccentMixColor(accentColor, 62);
    const inactiveBg = 'transparent';
    const inactiveColor = accentColor;
    const activeBg = getAccentMixColor(accentColor, 10);

    button.style.borderColor = isActive ? accentColor : inactiveBorder;
    button.style.background = isActive ? activeBg : inactiveBg;
    button.style.color = inactiveColor;
    button.style.boxShadow = isActive
        ? `0 0 0 1px ${getAccentMixColor(accentColor, 45)} inset, 0 0 10px ${getAccentMixColor(accentColor, 20)}`
        : 'none';

    const iconElement = button.querySelector('img');
    if (iconElement) {
        iconElement.src = buildReactionIconDataUri(
            button.dataset.type,
            inactiveColor
        );
    }
}

function animateReactionFeedback(button, reactionType, isAdded = true) {
    if (!button) return;

    const icon = button.querySelector('img');
    const tilt = reactionType === 'like' ? 12 : reactionType === 'heart' ? -16 : 8;
    const popDuration = 500;

    if (typeof button.animate === 'function') {
        button.animate(
            [
                { transform: 'scale(1)' },
                { transform: 'scale(1.06)' },
                { transform: 'scale(0.98)' },
                { transform: 'scale(1)' }
            ],
            { duration: popDuration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
    }

    if (icon && typeof icon.animate === 'function') {
        icon.animate(
            [
                { transform: 'translateY(0) rotate(0deg) scale(1)' },
                { transform: `translateY(-3px) rotate(${tilt}deg) scale(1.22)` },
                { transform: `translateY(1px) rotate(${-tilt * 0.4}deg) scale(0.95)` },
                { transform: 'translateY(0) rotate(0deg) scale(1)' }
            ],
            { duration: popDuration, easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)' }
        );
    }

    if (!isAdded) return;

    const accentColor = normalizeCardAccentColor(button.dataset.accentColor, '#EC4899');
    const isCommentBurst = reactionType === 'comment';
    const burst = isCommentBurst ? document.createElement('img') : document.createElement('span');
    if (isCommentBurst) {
        burst.src = buildReactionIconDataUri('comment', accentColor);
        burst.alt = 'Comentário';
        burst.setAttribute(
            'style',
            'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;width:25px;height:25px;z-index:2;filter:drop-shadow(0 0 10px rgba(0,0,0,0.35));'
        );
    } else {
        burst.textContent = reactionType === 'like' ? '👍' : '⭐';
        burst.setAttribute(
            'style',
            'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;font-size:23px;line-height:1;z-index:2;filter:drop-shadow(0 0 10px rgba(0,0,0,0.35));'
        );
    }

    const prevPosition = button.style.position;
    const prevOverflow = button.style.overflow;
    if (!prevPosition || prevPosition === 'static') button.style.position = 'relative';
    button.style.overflow = 'visible';
    button.appendChild(burst);

    if (typeof burst.animate === 'function') {
        const animation = burst.animate(
            [
                { opacity: 0, transform: 'translate(-50%, -50%) scale(0.6)' },
                { opacity: 1, transform: 'translate(-50%, -105%) scale(1.22)' },
                { opacity: 0, transform: 'translate(-50%, -185%) scale(0.92)' }
            ],
            { duration: 760, easing: 'cubic-bezier(0.19, 1, 0.22, 1)' }
        );
        animation.onfinish = () => {
            burst.remove();
            if (!prevPosition || prevPosition === 'static') button.style.position = prevPosition || '';
            button.style.overflow = prevOverflow || '';
        };
    } else {
        if (!isCommentBurst) {
            burst.style.color = accentColor;
        }
        window.setTimeout(() => {
            burst.remove();
            if (!prevPosition || prevPosition === 'static') button.style.position = prevPosition || '';
            button.style.overflow = prevOverflow || '';
        }, 760);
    }
}

function pulseCommentButton(button) {
    if (!button) return;

    const accentColor = normalizeCardAccentColor(button.dataset.accentColor, '#EC4899');
    const baseBorder = getAccentMixColor(accentColor, 62);
    const baseBg = 'transparent';
    const baseColor = accentColor;
    const pulseBg = getAccentMixColor(accentColor, 20);

    button.style.borderColor = accentColor;
    button.style.background = pulseBg;
    button.style.color = baseColor;
    button.style.boxShadow = `0 0 0 1px ${getAccentMixColor(accentColor, 40)} inset, 0 0 10px ${getAccentMixColor(accentColor, 20)}`;
    const icon = button.querySelector('img');
    if (icon) icon.src = buildReactionIconDataUri('comment', baseColor);

    window.setTimeout(() => {
        if (!button.isConnected) return;
        button.style.borderColor = baseBorder;
        button.style.background = baseBg;
        button.style.color = baseColor;
        button.style.boxShadow = 'none';
        if (icon) icon.src = buildReactionIconDataUri('comment', baseColor);
    }, 360);
}

function syncReactionButtonsVisualState(root = document) {
    if (!currentUser || !root || typeof root.querySelectorAll !== 'function') return;

    root.querySelectorAll('.btn-reaction').forEach((button) => {
        const downloadId = String(button.dataset.id || '');
        const reactionType = String(button.dataset.type || '');
        if (!downloadId || !reactionType) return;

        const targetDownload = allDownloads.find((item) => String(item?.id) === downloadId);
        if (!targetDownload) return;

        const isActive = reactionType === 'like'
            ? isDownloadLikedByViewer(targetDownload)
            : isDownloadHeartedByViewer(targetDownload);
        applyReactionButtonVisualState(button, isActive);
    });
}

// Funeeo para lidar com reações (like/coração)
async function handleReaction(e) {
    if (!currentUser) {
        showNotification('Você deve estar logado para reagir', 'error');
        return;
    }

    const button = e.currentTarget;
    const downloadId = button.dataset.id;
    const reactionType = button.dataset.type; // 'like' ou 'heart'
    
    console.log(`Adicionando reacao: ${reactionType} no download ${downloadId}`);
    
    try {
        const response = await AuthAPI.addDownloadReaction(downloadId, reactionType);
        
        if (response.success) {
            console.log('Reacao adicionada/removida com sucesso');
            console.log('Resposta:', response);
            
            // Atualizar o botão visualmente
            if (response.userReactions) {
                const likeBtn = document.querySelector(`[data-type="like"][data-id="${downloadId}"]`);
                const heartBtn = document.querySelector(`[data-type="heart"][data-id="${downloadId}"]`);
                const targetDownload = allDownloads.find((item) => String(item?.id) === String(downloadId));
                
                if (likeBtn) {
                    applyReactionButtonVisualState(likeBtn, Boolean(response.userReactions.hasLike));
                    likeBtn.querySelector('.count').textContent = response.reactions.likes || 0;
                }
                
                if (heartBtn) {
                    applyReactionButtonVisualState(heartBtn, Boolean(response.userReactions.hasHeart));
                    heartBtn.querySelector('.count').textContent = response.reactions.hearts || 0;
                }

                if (targetDownload) {
                    targetDownload.viewerHasLike = Boolean(response.userReactions.hasLike);
                    targetDownload.viewerHasHeart = Boolean(response.userReactions.hasHeart);
                }
            }
            
            showNotification(`${reactionType === 'like' ? 'Like' : 'Estrela'} ${response.isAdded ? 'adicionado' : 'removido'}!`, 'success');
            animateReactionFeedback(button, reactionType, Boolean(response.isAdded));

            if (reactionType === 'heart' && showingFavoritesOnly) {
                await filterAndRender({ preservePage: true });
            }
        } else {
            showNotification(response.message || 'Erro ao adicionar reação', 'error');
        }
    } catch (error) {
        console.error('Erro ao adicionar reação:', error);
        showNotification('Erro ao processar reação', 'error');
    }
}

function sortDownloads(downloadsToSort, sortType) {
    const sorted = [...downloadsToSort];

    function dateToTimestamp(dateStr) {
        if (!dateStr) return 0;
        return new Date(dateStr).getTime();
    }

    switch (sortType) {
        case 'date-desc':
            sorted.sort((a, b) => dateToTimestamp(b.createdAt) - dateToTimestamp(a.createdAt));
            break;
        case 'date-asc':
            sorted.sort((a, b) => dateToTimestamp(a.createdAt) - dateToTimestamp(b.createdAt));
            break;
        case 'likes':
            sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
            break;
        case 'name':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            sorted.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }

    return sorted;
}

function syncDescriptionOverflowState(root = document) {
    const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
    scope.querySelectorAll('.download-description-scroll').forEach((el) => {
        el.classList.remove('has-overflow');

        const computed = window.getComputedStyle(el);
        const rawMaxHeight = parseFloat(computed.maxHeight);
        const maxVisibleHeight = Number.isFinite(rawMaxHeight)
            ? rawMaxHeight + 2
            : el.clientHeight + 2;
        const hasOverflow = el.scrollHeight > maxVisibleHeight;
        if (hasOverflow) {
            el.classList.add('has-overflow');
        }
    });
}

function isHiddenProfileRank(rank) {
    if (!rank || !rank.name) return false;
    const rankName = String(rank.name).trim().toLowerCase();
    const hiddenNames = new Set([
        'membro iniciado',
        'membro ativo',
        'admin user',
        'admin',
        'founder'
    ]);
    return hiddenNames.has(rankName) || Number(rank.id) === 632;
}

function renderDownloads(downloadsToRender = allDownloads, options = {}) {
    const grid = document.getElementById('downloads');
    const notFound = document.getElementById('notFound');

    if (downloadsToRender.length === 0) {
        grid.innerHTML = '';
        notFound.style.display = 'block';
        renderDownloadsPagination(0, 1);
        return;
    }

    notFound.style.display = 'none';
    const { totalItems, totalPages, pageItems, startIndex } = resolveRenderStateForPage(downloadsToRender);
    renderDownloadsPagination(totalItems, totalPages);

    grid.innerHTML = pageItems.map((download, idx) => {
        const dateObj = new Date(download.createdAt);
        const formattedDate = dateObj.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });

        // Renderizar conquistas respeitando ordem salva do perfil
        const achievementRanks = [];
        const pushUniqueRank = (rank) => {
            if (!rank || !rank.name) return;
            if (isHiddenProfileRank(rank)) return;
            const normalized = String(rank.name).trim().toLowerCase();
            if (!normalized) return;
            if (normalized === 'membro inicial' && Number(rank?.id) !== 33) return;
            if (achievementRanks.some(existing => String(existing.name).trim().toLowerCase() === normalized)) return;
            achievementRanks.push(rank);
        };

        const FIXED_AUTO_RANK_KEY = 'fixed:auto';
        const PROGRESSION_OVERRIDE_RANKS = new Set([
            'membro beta', 'membro inicial', 'membro novato', 'membro ativo', 'membro iniciado'
        ]);
        const BLOCKED_AUTO_PROGRESSION_RANKS = new Set([
            'membro novato', 'membro aprendiz', 'membro experiente', 'membro adepto',
            'membro especialista', 'membro mestre', 'grande mestre', 'membro lendário',
            'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal'
        ]);
        const sourceRanks = [];

        const isExplicitMembroInicialRank = (rank) => {
            const nameLower = String(rank?.name || '').trim().toLowerCase();
            return nameLower === 'membro inicial' && Number(rank?.id) === 33;
        };

        const hasBetaProgressionOverrideSelected = (download.userSelectedRanks || [])
            .some((rank) => String(rank?.name || '').trim().toLowerCase() === 'membro beta');

        if (Array.isArray(download.authorDisplayRanks) && download.authorDisplayRanks.length > 0) {
            download.authorDisplayRanks.forEach(rank => sourceRanks.push(rank));
        }

        const rankComplete = download.authorRankComplete || null;
        const hasFinalDisplayRanks = (Array.isArray(download.authorDisplayRanks) && download.authorDisplayRanks.length > 0)
            || (Array.isArray(download.userSelectedRanks) && download.userSelectedRanks.length > 0);
        const isBlockedProgressionRank = (rank) => {
            const nameLower = String(rank?.name || '').trim().toLowerCase();
            return BLOCKED_AUTO_PROGRESSION_RANKS.has(nameLower);
        };
        const shouldIncludeRank = (rank) => {
            if (!rank || !rank.name) return false;
            const nameLower = String(rank.name).trim().toLowerCase();
            const isFixedAutoRank = String(rank?.id || '').trim().toLowerCase() === FIXED_AUTO_RANK_KEY;
            const isMembroInicial = nameLower === 'membro inicial';
            if (isMembroInicial && !isExplicitMembroInicialRank(rank)) {
                return false;
            }
            if (!hasFinalDisplayRanks && isMembroInicial) {
                return false;
            }
            if (hasBetaProgressionOverrideSelected && isBlockedProgressionRank(rank) && !isFixedAutoRank) {
                return false;
            }
            return true;
        };

        if (rankComplete && !hasFinalDisplayRanks) {
            const authorAutoRank = rankComplete.automaticCompleted || rankComplete.automatic || null;
            if (rankComplete.current && shouldIncludeRank(rankComplete.current)) {
                sourceRanks.push(rankComplete.current);
            }
            if (
                authorAutoRank &&
                !isHiddenProfileRank(authorAutoRank) &&
                (!rankComplete.current || String(authorAutoRank.name).trim().toLowerCase() !== String(rankComplete.current?.name).trim().toLowerCase()) &&
                shouldIncludeRank(authorAutoRank)
            ) {
                sourceRanks.push(authorAutoRank);
            }
            if (rankComplete.custom) {
                sourceRanks.push(rankComplete.custom);
            }
        }

        if (Array.isArray(download.userSelectedRanks) && download.userSelectedRanks.length > 0) {
            download.userSelectedRanks.forEach(rank => sourceRanks.push(rank));
        }

        sourceRanks.forEach((rank) => {
            if (!rank || !rank.name) return;
            const nameLower = String(rank.name).trim().toLowerCase();
            const isFixedAutoRank = String(rank?.id || '').trim().toLowerCase() === FIXED_AUTO_RANK_KEY;
            if (hasBetaProgressionOverrideSelected && isFixedAutoRank) {
                return;
            }
            if (isFixedAutoRank && nameLower === 'membro iniciado') {
                return;
            }
            if (hasBetaProgressionOverrideSelected && BLOCKED_AUTO_PROGRESSION_RANKS.has(nameLower) && !isFixedAutoRank) {
                return;
            }
            pushUniqueRank(rank);
        });

        const achievementsHTML = achievementRanks.length > 0
            ? achievementRanks.map(rank => {
                const color = rank.color || '#6B46C1';
                const subtitle = resolveRankSubtitle(rank);
                const subtitleFlag = subtitle ? '1' : '0';
                const subtitleAttr = subtitle ? ` data-rank-subtitle="${escapeHtml(subtitle)}"` : '';
                return `
                    <p class="download-rank-badge" data-rank-has-subtitle="${subtitleFlag}"${subtitleAttr} style="margin: 2px 0 0 0; font-size: 11px; background: ${color}20; color: ${color}; padding: 3px 8px; border-radius: 3px; display: inline-block; border: 1px solid ${color}40; font-weight: 600; text-shadow: 0 0 4px rgba(0,0,0,0.8);">
                        ${rank.name}
                    </p>
                `;
            }).join('')
            : '<p style="margin: 0; font-size: 12px; color: #999;">Sem conquista</p>';


        const cardAccentColor = normalizeCardAccentColor(
            achievementRanks.find((rank) => String(rank?.color || '').trim())?.color,
            '#EC4899'
        );
        const cardAccentBorder = getAccentMixColor(cardAccentColor, 62);
        const cardAccentSoft = getAccentMixColor(cardAccentColor, 12);
        const cardAccentReactionsTopBorder = getAccentMixColor(cardAccentColor, 30);
        const likeIconUri = buildReactionIconDataUri('like', cardAccentColor);
        const heartIconUri = buildReactionIconDataUri('heart', cardAccentColor);
        const commentIconUri = buildReactionIconDataUri('comment', cardAccentColor);

        const isAdultPost = Number(download?.isAdult) === 1 || download?.isAdult === true;
        const isMembersOnlyPost = Number(download?.membersOnly) === 1 || download?.membersOnly === true;
        const isSuspended = download?.suspensionStatus === 'suspended' || download?.suspensionStatus === 'under_review';
        const isUnderReview = download?.suspensionStatus === 'under_review';
        const isAdultLocked = Boolean(download?.isAdultLocked);
        const isMembersOnlyLocked = Boolean(download?.membersOnlyLocked);
        const isOwnerOrAdmin = currentUser && (Number(currentUser.id) === Number(download.userId) || userCanManageDownloads);
        const isSuspendedLocked = isSuspended && !userCanManageDownloads; // Admins podem ver conteúdo suspenso
        const isContentLocked = isAdultLocked || isMembersOnlyLocked || isSuspendedLocked;
        const rawDisplayName = String(download?.name || '');
        const displayName = isAdultPost
            ? (rawDisplayName.replace(/\s*\+18\b/gi, '').trim() || rawDisplayName)
            : rawDisplayName;
        const adultBadgeHtml = isAdultPost
            ? `<span style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; border:1px solid rgba(239,68,68,0.65); color:#FCA5A5; background: rgba(239,68,68,0.12); font-size:11px; font-weight:700;">+18</span>`
            : '';
        const membersBadgeHtml = isMembersOnlyPost
            ? `<span style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; border:1px solid rgba(59,130,246,0.65); color:#93C5FD; background: rgba(59,130,246,0.12); font-size:11px; font-weight:700;">Membros</span>`
            : '';
        const lockReasonFallback = isMembersOnlyLocked
            ? 'Precisa estar logado para ver essa postagem.'
            : isSuspended
            ? 'Essa postagem feriu um dos nossos termos de serviço e foi bloqueada temporamente.'
            : 'Conteúdo +18 bloqueado.';
        const effectiveDescription = isContentLocked
            ? (download.adultLockReason || lockReasonFallback)
            : (download.description || '');
        const displayDescription = String(effectiveDescription || '').trim();
        const adultCanActivate = download?.adultCanActivate === true || Number(download?.adultCanActivate) === 1;
        const canActivateAdultPosts = Boolean(
            isAdultLocked &&
            currentUser &&
            adultCanActivate
        );
        const lockActionHtml = canActivateAdultPosts
            ? `<a href="profile.html?openAdultPosts=1" style="display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(236,72,153,0.65); color: #F9A8D4; background: rgba(236,72,153,0.12); font-size: 12px; font-weight: 700; text-decoration: none; white-space: nowrap;">Ativar agora</a>`
            : '';
        const links = isContentLocked ? [] : parseDownloadLinks(download);
        const canUseAnimatedProfile = ENABLE_ANIMATED_DOWNLOAD_CARDS
            && Boolean(download.authorCanUseAnimatedProfile)
            && Boolean(download.authorAnimatedDownloadCardEnabled ?? download.authorAnimatedProfileEnabled);
        const animatedCardConfig = canUseAnimatedProfile
            ? buildAnimatedCardConfig(
                `${download.userId || 0}-${download.id || 0}`,
                download.authorAnimatedProfileTheme,
                download.authorAnimatedProfileVisualMode,
                download.authorAnimatedProfileGifUrl,
                download.authorAnimatedProfileGiphyId
            )
            : { className: '', inlineStyle: '', embedHtml: '' };
        const animatedCardClass = canUseAnimatedProfile
            ? `animated-download-card ${animatedCardConfig.className}`.trim()
            : '';
        const cardInlineStyles = [`--card-accent: ${cardAccentColor};`];
        if (canUseAnimatedProfile && animatedCardConfig.inlineStyle) {
            cardInlineStyles.push(animatedCardConfig.inlineStyle);
        }
        const cardStyleAttr = cardInlineStyles.length > 0
            ? ` style="${cardInlineStyles.join(' ')}"`
            : '';
          const userAvatarHtml = renderDownloadAvatarMarkup({
              avatar: download.avatar,
              nickname: download.nickname,
              userId: download.userId,
              size: 40,
              accentColor: cardAccentColor,
              avatarScale: Number(download.avatarScale) || 1,
              avatarOffsetX: Number(download.avatarOffsetX) || 50,
              avatarOffsetY: Number(download.avatarOffsetY) || 50
          });
        const downloadButtonsHTML = links.map((linkItem, idx) => {
            const formatLabel = getDownloadLinkFormatLabel(linkItem);
            const baseLabel = links.length > 1 ? `LINK ${idx + 1}` : 'DOWNLOAD';
            let buttonLabel = baseLabel;
            if (formatLabel) {
                const parenIndex = formatLabel.indexOf('(');
                if (parenIndex >= 0) {
                    const paren = formatLabel.slice(parenIndex).trim();
                    buttonLabel = `${baseLabel} ${paren}`;
                } else {
                    buttonLabel = `${baseLabel} - ${formatLabel}`;
                }
            }
            const isFile = isDownloadFileUrl(linkItem?.url);
            const extraClass = isFile ? ' btn-download-file' : '';
            const scanTooltipId = `virus-scan-tooltip-${Number(download.id) || 0}-${idx}`;
            return `
            <div class="download-link-entry">
                <a href="${escapeHtml(linkItem.url)}" target="_blank" rel="noopener noreferrer" class="btn-download${extraClass}" style="display: inline-flex; align-items: center; justify-content: center; min-height: 34px; margin: 0; font-size: 12px; line-height: 1;">${escapeHtml(buttonLabel)}</a>
                <button type="button" class="btn-virus-scan" data-download-id="${Number(download.id) || 0}" data-link-index="${idx}" aria-describedby="${scanTooltipId}">Examinar vírus</button>
                <span class="virus-scan-tooltip" id="${scanTooltipId}" role="tooltip">Esta verificação consulta o link no VirusTotal.</span>
                <span class="virus-scan-result" data-state="idle" role="status" aria-live="polite" hidden></span>
            </div>
            `;
        }).join('');
        const lockPanelLabel = isUnderReview ? 'Aguardando revisão da equipe de moderação...' :
                               isSuspended ? 'Esta postagem foi suspensa pela equipe de moderação.' :
                               isMembersOnlyLocked ? 'Este conteúdo é restrito apenas para membros logados' : 'Este é conteúdo +18 (Conteúdo adulto)';
        const lockLinksLabel = isUnderReview ? 'Postagem em revisão' :
                               isSuspended ? 'Postagem bloqueada' :
                              isMembersOnlyLocked ? 'Acesso restrito (membros)' : 'Links bloqueados (+18)';
        const reactionsPanelHtml = isContentLocked
            ? `
                <div class="download-reactions" style="display: flex; gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 1px solid ${cardAccentReactionsTopBorder};">
                    <span style="flex: 1; padding: 8px; border: 1px solid ${isSuspended ? 'rgba(249, 115, 22, 0.65)' : 'rgba(239,68,68,0.65)'}; border-radius: 5px; background: ${isSuspended ? 'rgba(249, 115, 22, 0.1)' : 'rgba(239,68,68,0.1)'}; color: ${isSuspended ? '#FDBA74' : '#FCA5A5'}; font-size: 12px; font-weight: 600; text-align: center;">
                        ${lockPanelLabel}
                    </span>
                </div>
            `
            : isSuspended && userCanManageDownloads
            ? `
                <div class="download-reactions" style="display: flex; gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 1px solid ${cardAccentReactionsTopBorder};">
                    <button class="btn-unsuspend" data-id="${download.id}" style="flex: 1; padding: 8px; border: 1px solid rgba(34, 197, 94, 0.65); border-radius: 5px; background: rgba(34, 197, 94, 0.1); color: #86EFAC; cursor: pointer; font-size: 12px; font-weight: 600; text-align: center;">
                        Liberar Postagem
                    </button>
                    <button class="btn-reaction like-btn" data-type="like" data-id="${download.id}" data-accent-color="${escapeHtml(cardAccentColor)}" style="flex: 1; padding: 8px; border: 1px solid ${cardAccentBorder}; border-radius: 5px; background: transparent; color: ${cardAccentColor}; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <img src="${likeIconUri}" alt="Like" style="width: 16px; height: 16px;"> <span class="count">${download.likes || 0}</span>
                    </button>
                    <button class="btn-reaction heart-btn" data-type="heart" data-id="${download.id}" data-accent-color="${escapeHtml(cardAccentColor)}" style="flex: 1; padding: 8px; border: 1px solid ${cardAccentBorder}; border-radius: 5px; background: transparent; color: ${cardAccentColor}; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <img src="${heartIconUri}" alt="Estrela" style="width: 16px; height: 16px;"> <span class="count">${download.hearts || 0}</span>
                    </button>
                    <button class="btn-comment" data-id="${download.id}" data-accent-color="${escapeHtml(cardAccentColor)}" style="flex: 1; padding: 8px; border: 1px solid ${cardAccentBorder}; border-radius: 5px; background: transparent; color: ${cardAccentColor}; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <img src="${commentIconUri}" alt="Comentar" style="width: 16px; height: 16px;"> <span class="count">${download.comments || 0}</span>
                    </button>
                </div>
            `
            : `
                <div class="download-reactions" style="display: flex; gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 1px solid ${cardAccentReactionsTopBorder};">
                    <button class="btn-reaction like-btn" data-type="like" data-id="${download.id}" data-accent-color="${escapeHtml(cardAccentColor)}" style="flex: 1; padding: 8px; border: 1px solid ${cardAccentBorder}; border-radius: 5px; background: transparent; color: ${cardAccentColor}; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <img src="${likeIconUri}" alt="Like" style="width: 16px; height: 16px;"> <span class="count">${download.likes || 0}</span>
                    </button>
                    <button class="btn-reaction heart-btn" data-type="heart" data-id="${download.id}" data-accent-color="${escapeHtml(cardAccentColor)}" style="flex: 1; padding: 8px; border: 1px solid ${cardAccentBorder}; border-radius: 5px; background: transparent; color: ${cardAccentColor}; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <img src="${heartIconUri}" alt="Estrela" style="width: 16px; height: 16px;"> <span class="count">${download.hearts || 0}</span>
                    </button>
                    <button class="btn-comment" data-id="${download.id}" data-accent-color="${escapeHtml(cardAccentColor)}" style="flex: 1; padding: 8px; border: 1px solid ${cardAccentBorder}; border-radius: 5px; background: transparent; color: ${cardAccentColor}; cursor: pointer; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <img src="${commentIconUri}" alt="Comentar" style="width: 16px; height: 16px;"> <span class="count">${download.comments || 0}</span>
                    </button>
                </div>
            `;

        return `
            <div class="download-card ${animatedCardClass}" data-id="${download.id}"${cardStyleAttr} style="box-shadow: 0 0 20px rgba(236, 72, 153, 0.4), 0 0 40px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(236, 72, 153, 0.1);">
                  ${animatedCardConfig.embedHtml || ''}
                  <div class="download-header">
                      <div class="user-info">
                           <div style="position: relative; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid ${cardAccentColor};">
                               ${userAvatarHtml}
                           </div>
                           <div>
                               <strong class="user-name" style="cursor: pointer; color: ${cardAccentColor}; text-shadow: 0 0 6px rgba(0,0,0,0.9), 1px 1px 2px rgba(0,0,0,0.8);" data-user-id="${download.userId}">@${escapeHtml(download.nickname)}</strong>
                               <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 6px;">
                                   <div>${achievementsHTML}</div>
                               </div>
                           </div>
                     </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${(currentUser && (Number(currentUser.id) === Number(download.userId) || userCanManageDownloads)) ? `
                            ${isSuspended && download?.suspensionStatus === 'suspended' ? `
                                <div style="padding: 10px 12px; background: linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.1) 100%); border: 1px solid rgba(249, 115, 22, 0.6); border-radius: 4px; color: #FDBA74; font-size: 11px; font-weight: 600; text-align: center; box-shadow: 0 0 10px rgba(249, 115, 22, 0.2);">Você pode editá-la, removê-la ou enviar para revisão.</div>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn-edit-download" data-id="${download.id}" style="background: linear-gradient(135deg, #F97316 0%, #FDBA74 100%); border: 1px solid #F97316; color: white; cursor: pointer; font-size: 12px; padding: 6px 12px; border-radius: 4px; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(249, 115, 22, 0.3);" title="Editar para resolver suspensão">Editar</button>
                                    ${!userCanSuspendPosts ? `<button class="btn-request-review" data-id="${download.id}" style="background: linear-gradient(135deg, #A78BFA 0%, #C4B5FD 100%); border: 1px solid #A78BFA; color: #1A1A2E; cursor: pointer; font-size: 12px; padding: 6px 12px; border-radius: 4px; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(167, 139, 250, 0.3);" title="Enviar para revisão da equipe">Enviar Revisão</button>` : ''}
                                    <button class="btn-delete-download" data-id="${download.id}" style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); border: 1px solid #EF4444; color: white; cursor: pointer; font-size: 12px; padding: 6px 12px; border-radius: 4px; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);">Excluir</button>
                                </div>
                            ` : isUnderReview ? `
                                <div style="display: inline-block; padding: 8px 12px; background: linear-gradient(135deg, rgba(167, 139, 250, 0.2) 0%, rgba(167, 139, 250, 0.1) 100%); border: 1px solid rgba(167, 139, 250, 0.6); border-radius: 4px; color: #C4B5FD; font-size: 12px; font-weight: 600; box-shadow: 0 0 10px rgba(167, 139, 250, 0.2);">Aguardando revisão...</div>
                            ` : `
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn-edit-download" data-id="${download.id}" style="background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); border: 1px solid #EC4899; color: white; cursor: pointer; font-size: 12px; padding: 6px 12px; border-radius: 4px; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(236, 72, 153, 0.3);">Editar</button>
                                    <button class="btn-delete-download" data-id="${download.id}" style="background: linear-gradient(135deg, #EC4899 0%, #DB2777 100%); border: 1px solid #EC4899; color: white; cursor: pointer; font-size: 12px; padding: 6px 12px; border-radius: 4px; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(236, 72, 153, 0.3);">Excluir</button>
                                </div>
                            `}
                        ` : ''}
                        
                        ${userCanSuspendPosts ? `
                            ${isSuspended ? `
                                <button class="btn-reopen-download" data-id="${download.id}" style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); border: 1px solid #F97316; color: white; cursor: pointer; font-size: 12px; padding: 6px 12px; border-radius: 4px; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(249, 115, 22, 0.3);">Reabrir Postagem</button>
                            ` : `
                                <button class="btn-suspend-download" data-id="${download.id}" style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); border: 1px solid #F97316; color: white; cursor: pointer; font-size: 12px; padding: 6px 12px; border-radius: 4px; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(249, 115, 22, 0.3);">Suspender</button>
                            `}
                        ` : ''}
                    </div>
                </div>

                <div class="download-content">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px;">
                        <h3 style="margin: 0; text-shadow: 0 0 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,0.8);">${escapeHtml(displayName)}${adultBadgeHtml}${membersBadgeHtml}</h3>
                        ${lockActionHtml}
                    </div>
                    <div class="download-description-scroll" style="text-shadow: 0 0 6px rgba(0,0,0,0.9), 1px 1px 2px rgba(0,0,0,0.8);">${displayDescription ? escapeHtml(displayDescription) : ''}</div>
                    <div class="download-meta-bottom">
                        <p style="margin: 10px 0; font-size: 12px; color: #999; text-shadow: 0 0 4px rgba(0,0,0,0.9);">DATA: ${formattedDate}</p>
                        <div style="margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 34px;">
                            ${downloadButtonsHTML || (isContentLocked ? `<span style="font-size: 12px; color: #FCA5A5; text-shadow: 0 0 4px rgba(0,0,0,0.9);">${lockLinksLabel}</span>` : '')}
                        </div>
                    </div>
                </div>

                ${reactionsPanelHtml}
            </div>
        `;
    }).join('');

    syncDescriptionOverflowState(grid);
    requestAnimationFrame(() => syncDescriptionOverflowState(grid));

    document.querySelectorAll('.btn-virus-scan').forEach((button) => {
        button.addEventListener('click', async () => {
            const confirmed = await showConfirmModal(
                'O link completo será enviado ao VirusTotal e poderá ficar visível para outras pessoas. Se ele tiver códigos de acesso ou informações privadas, elas também poderão ser compartilhadas. Continue apenas se o link for público. A análise verifica o link, não o arquivo, e não garante que o download seja seguro.',
                {
                    title: 'Examinar link no VirusTotal?',
                    confirmText: 'Examinar vírus',
                    cancelText: 'Cancelar'
                }
            );
            if (!confirmed) return;

            const item = button.closest('.download-link-entry');
            const status = item?.querySelector('.virus-scan-result');
            if (!status) return;

            const originalLabel = button.textContent;
            button.disabled = true;
            button.textContent = 'Examinando...';
            status.hidden = false;
            status.dataset.state = 'pending';
            status.textContent = 'Consultando o VirusTotal...';

            try {
                const headers = { 'Content-Type': 'application/json' };
                const token = typeof AuthAPI !== 'undefined' && typeof AuthAPI.getToken === 'function'
                    ? AuthAPI.getToken()
                    : '';
                if (token) headers.Authorization = `Bearer ${token}`;

                const response = await fetch(`${window.location.origin}/api/virus-scan`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        downloadId: button.dataset.downloadId,
                        linkIndex: button.dataset.linkIndex,
                        consent: true
                    })
                });
                let result = null;
                try {
                    result = await response.json();
                } catch {
                    result = null;
                }
                if (!response.ok || !result?.success) {
                    throw new Error(result?.message || 'Não foi possível examinar este link.');
                }

                if (result.status === 'pending') {
                    status.dataset.state = 'pending';
                    status.textContent = 'Análise solicitada. Aguarde cerca de 1 minuto e examine novamente.';
                    return;
                }

                const stats = result.stats || {};
                const malicious = Number(stats.malicious) || 0;
                const suspicious = Number(stats.suspicious) || 0;
                const harmless = Number(stats.harmless) || 0;
                if (malicious > 0) {
                    status.dataset.state = 'danger';
                    status.textContent = `Alerta: ${malicious} mecanismo(s) marcaram o link como malicioso. Não baixe o arquivo.`;
                } else if (suspicious > 0) {
                    status.dataset.state = 'warning';
                    status.textContent = `Atenção: ${suspicious} mecanismo(s) marcaram o link como suspeito.`;
                } else if (harmless > 0) {
                    status.dataset.state = 'clear';
                    status.textContent = `Nenhuma detecção conhecida (${harmless} mecanismo(s) não sinalizaram ameaça). Isso não garante segurança.`;
                } else {
                    status.dataset.state = 'unknown';
                    status.textContent = 'O VirusTotal ainda não tem resultado conclusivo para este link.';
                }

                try {
                    const reportUrl = new URL(result.reportUrl);
                    if (reportUrl.origin === 'https://www.virustotal.com') {
                        const reportLink = document.createElement('a');
                        reportLink.href = reportUrl.toString();
                        reportLink.target = '_blank';
                        reportLink.rel = 'noopener noreferrer';
                        reportLink.textContent = 'Abrir relatório';
                        status.append(' ', reportLink);
                    }
                } catch {
                    // O resultado continua visível se o relatório não tiver um link válido.
                }
            } catch (error) {
                status.dataset.state = 'error';
                status.textContent = error?.message || 'Falha ao consultar o VirusTotal. Tente novamente.';
            } finally {
                button.disabled = false;
                button.textContent = originalLabel;
            }
        });
    });

    // Adicionar event listeners para reações
    document.querySelectorAll('.btn-reaction').forEach(btn => {
        btn.addEventListener('click', handleReaction);
    });
    syncReactionButtonsVisualState(grid);
    requestAnimationFrame(() => syncReactionButtonsVisualState(grid));

    // Adicionar event listeners para comentários
    document.querySelectorAll('.btn-comment').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!currentUser) {
                showNotification('Você deve estar logado para comentar', 'error');
                return;
            }
            const commentBtn = e.currentTarget;
            pulseCommentButton(commentBtn);
            animateReactionFeedback(commentBtn, 'comment', true);
            const downloadId = commentBtn.dataset.id;
            showCommentForm(downloadId);
        });
    });

    // Adicionar event listeners para usuários
    document.querySelectorAll('.user-name, .user-avatar').forEach(el => {
        el.addEventListener('click', (e) => {
            const userId = e.currentTarget.dataset.userId;
            showUserMiniProfile(userId);
        });
    });

    initRankBadgeTooltips(grid);

    // Adicionar event listeners para deletar
    document.querySelectorAll('.btn-delete-download').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const downloadId = e.currentTarget.dataset.id;
            
            // Criar modal de confirmação
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 2px solid #EC4899;
                border-radius: 12px;
                padding: 30px;
                max-width: 400px;
                text-align: center;
                color: white;
                box-shadow: 0 0 30px rgba(236, 72, 153, 0.3);
            `;
            
            content.innerHTML = `
                <h3 style="color: #EC4899; margin-bottom: 15px; font-size: 20px;">Deletar Download?</h3>
                <p style="color: rgba(255,255,255,0.8); margin-bottom: 30px;">Esta ação não pode ser desfeita. Tem certeza?</p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="cancelDelete" style="padding: 10px 20px; background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); color: white; border: 1px solid #6B46C1; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s;">Cancelar</button>
                    <button id="confirmDelete" style="padding: 10px 20px; background: linear-gradient(135deg, #EC4899 0%, #DB2777 100%); color: white; border: 1px solid #EC4899; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s;">Confirmar Delete</button>
                </div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            const cancelBtn = document.getElementById('cancelDelete');
            const confirmBtn = document.getElementById('confirmDelete');
            
            // Efeitos hover para botão cancelar
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)';
                cancelBtn.style.transform = 'translateY(-2px)';
                cancelBtn.style.boxShadow = '0 5px 15px rgba(236, 72, 153, 0.5)';
            });
            
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%)';
                cancelBtn.style.transform = 'translateY(0)';
                cancelBtn.style.boxShadow = '0 0 0px rgba(236, 72, 153, 0)';
            });
            
            // Efeitos hover para botão confirmar
            confirmBtn.addEventListener('mouseenter', () => {
                confirmBtn.style.background = 'linear-gradient(135deg, #DB2777 0%, #EC4899 100%)';
                confirmBtn.style.transform = 'translateY(-2px)';
                confirmBtn.style.boxShadow = '0 5px 15px rgba(236, 72, 153, 0.5)';
            });
            
            confirmBtn.addEventListener('mouseleave', () => {
                confirmBtn.style.background = 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)';
                confirmBtn.style.transform = 'translateY(0)';
                confirmBtn.style.boxShadow = '0 0 0px rgba(236, 72, 153, 0)';
            });
            
            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });
            
            confirmBtn.addEventListener('click', async () => {
                const response = await AuthAPI.deleteDownload(downloadId);
                if (response.success) {
                    showNotification('Download deletado com sucesso!', 'success');
                    modal.remove();
                    loadDownloads();
                } else {
                    showNotification(response.message || 'Erro ao deletar download', 'error');
                    modal.remove();
                }
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        });
    });

    // Adicionar event listeners para editar
    document.querySelectorAll('.btn-edit-download').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const downloadId = e.currentTarget.dataset.id;
            const download = allDownloads.find(d => d.id == downloadId);
            if (download) {
                showEditDownloadForm(download);
            }
        });
        
        // Efeito de hover para botão de editar
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)';
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 5px 15px rgba(236, 72, 153, 0.5)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%)';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 0 10px rgba(236, 72, 153, 0.3)';
        });
    });

    // Adicionar event listeners para enviar revisão
    document.querySelectorAll('.btn-request-review').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const downloadId = e.currentTarget.dataset.id;
            openSuspensionReviewModal(downloadId);
        });

        // Efeito de hover para botão de revisão
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'linear-gradient(135deg, #C4B5FD 0%, #DDD6FE 100%)';
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 5px 15px rgba(167, 139, 250, 0.5)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'linear-gradient(135deg, #A78BFA 0%, #C4B5FD 100%)';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 0 10px rgba(167, 139, 250, 0.3)';
        });
    });
    
    // Adicionar event listeners para suspender
    document.querySelectorAll('.btn-suspend-download').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const downloadId = e.currentTarget.dataset.id;
            
            // Criar modal de suspensão com campo de motivo
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 2px solid #F97316;
                border-radius: 12px;
                padding: 30px;
                max-width: 500px;
                text-align: center;
                color: white;
                box-shadow: 0 0 30px rgba(249, 115, 22, 0.3);
            `;
            
            content.innerHTML = `
                <h3 style="color: #F97316; margin-bottom: 15px; font-size: 20px;">Suspender Postagem</h3>
                <p style="color: rgba(255,255,255,0.8); margin-bottom: 20px;">Forneça um motivo para a suspensão:</p>
                <textarea id="suspensionReason" placeholder="Motivo da suspensão..." style="
                    width: 100%;
                    padding: 12px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid #F97316;
                    border-radius: 5px;
                    color: white;
                    min-height: 100px;
                    font-family: inherit;
                    font-size: 14px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                " ></textarea>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="cancelSuspend" style="padding: 10px 20px; background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); color: white; border: 1px solid #6B46C1; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s;">Cancelar</button>
                    <button id="confirmSuspend" style="padding: 10px 20px; background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); color: white; border: 1px solid #F97316; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s;">Suspender</button>
                </div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            const reasonInput = document.getElementById('suspensionReason');
            const cancelBtn = document.getElementById('cancelSuspend');
            const confirmBtn = document.getElementById('confirmSuspend');
            
            // Focus no textarea
            reasonInput.focus();
            
            // Efeitos hover para botão cancelar
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)';
                cancelBtn.style.transform = 'translateY(-2px)';
                cancelBtn.style.boxShadow = '0 5px 15px rgba(236, 72, 153, 0.5)';
            });
            
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%)';
                cancelBtn.style.transform = 'translateY(0)';
                cancelBtn.style.boxShadow = '0 0 0px rgba(236, 72, 153, 0)';
            });
            
            // Efeitos hover para botão confirmar
            confirmBtn.addEventListener('mouseenter', () => {
                confirmBtn.style.background = 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)';
                confirmBtn.style.transform = 'translateY(-2px)';
                confirmBtn.style.boxShadow = '0 5px 15px rgba(249, 115, 22, 0.5)';
            });
            
            confirmBtn.addEventListener('mouseleave', () => {
                confirmBtn.style.background = 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)';
                confirmBtn.style.transform = 'translateY(0)';
                confirmBtn.style.boxShadow = '0 0 0px rgba(249, 115, 22, 0)';
            });
            
            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });
            
            confirmBtn.addEventListener('click', async () => {
                const reason = reasonInput.value.trim();
                if (!reason) {
                    showNotification('Por favor, forneça um motivo para a suspensão', 'warning');
                    return;
                }
                
                const response = await AuthAPI.suspendDownload(downloadId, reason);
                if (response.success) {
                    showNotification('Postagem suspensa com sucesso!', 'success');
                    modal.remove();
                    loadDownloads();
                } else {
                    showNotification(response.message || 'Erro ao suspender postagem', 'error');
                }
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        });
        
        // Efeito de hover para botão de suspender
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'linear-gradient(135deg, #EA580C 0%, #F97316 100%)';
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 5px 15px rgba(249, 115, 22, 0.5)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 0 10px rgba(249, 115, 22, 0.3)';
        });
    });

    // Adicionar event listeners para reabrir postagem
    // Função para mostrar modal de confirmação temático
    function showConfirmModal(message, opts = {}) {
        return new Promise(resolve => {
            const modal = document.getElementById('confirmModal');
            if (!modal) return resolve(false);
            const titleEl = document.getElementById('confirmModalTitle');
            const msgEl = document.getElementById('confirmModalMessage');
            const okBtn = document.getElementById('confirmOkBtn');
            const cancelBtn = document.getElementById('confirmCancelBtn');
            const closeBtn = document.getElementById('confirmModalClose');

            titleEl.textContent = opts.title || 'Confirmar ação';
            msgEl.textContent = message || '';
            okBtn.textContent = opts.confirmText || 'Confirmar';
            cancelBtn.textContent = opts.cancelText || 'Cancelar';

            function cleanup(result) {
                modal.style.display = 'none';
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                closeBtn.removeEventListener('click', onCancel);
                modal.removeEventListener('click', onOutside);
                resolve(result);
            }

            function onOk(e) { e.preventDefault(); cleanup(true); }
            function onCancel(e) { e && e.preventDefault(); cleanup(false); }
            function onOutside(e) { if (e.target === modal) cleanup(false); }

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
            closeBtn.addEventListener('click', onCancel);
            modal.addEventListener('click', onOutside);

            // show
            modal.style.display = 'flex';
            // focus OK for keyboard users
            okBtn.focus();
        });
    }
    document.querySelectorAll('.btn-reopen-download').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const downloadId = e.currentTarget.dataset.id;
            
            const confirmed = await showConfirmModal('Tem certeza que deseja reabrir esta postagem?', { title: 'Reabrir Postagem', confirmText: 'Reabrir', cancelText: 'Cancelar' });
            if (!confirmed) return;
            
            const response = await AuthAPI.unsuspendDownload(downloadId);
            if (response && response.success) {
                showNotification('Postagem reabierta com sucesso!', 'success');
                await new Promise(resolve => setTimeout(resolve, 1500));
                loadDownloads();
            } else {
                showNotification(response?.message || 'Erro ao reabrir postagem', 'error');
            }
        });
        
        // Efeito de hover para botão de reabrir
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'linear-gradient(135deg, #A78BFA 0%, #C4B5FD 100%)';
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 5px 15px rgba(167, 139, 250, 0.5)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 0 10px rgba(139, 92, 246, 0.3)';
        });
    });

    // Adicionar efeito de hover para botão de excluir
    document.querySelectorAll('.btn-delete-download').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'linear-gradient(135deg, #DB2777 0%, #EC4899 100%)';
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 5px 15px rgba(236, 72, 153, 0.5)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 0 10px rgba(236, 72, 153, 0.3)';
        });
    });

    attachInteractiveCardEffects(grid);
}

// Mostrar formulário de comentários
async function showCommentForm(downloadId) {
    document.querySelectorAll('[data-comment-modal="1"]').forEach((existingModal) => existingModal.remove());

    const commentsResponse = await AuthAPI.getDownloadComments(downloadId);
    if (!commentsResponse?.success) {
        showNotification(commentsResponse?.message || 'Não foi possível abrir os comentários.', 'error');
        return;
    }
    const comments = commentsResponse.success ? commentsResponse.comments : [];
    const commentsById = new Map(
        (comments || []).map((item) => [String(item?.id), item])
    );
    const currentDownload = allDownloads.find((item) => String(item.id) === String(downloadId)) || null;
    const isDownloadOwner = Boolean(
        currentUser &&
        currentDownload &&
        Number(currentDownload.userId) === Number(currentUser.id)
    );
    const canModerateComments = Boolean(userCanManageDownloads || isDownloadOwner);

    const modal = document.createElement('div');
    modal.dataset.commentModal = '1';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        overflow-y: auto;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #6B46C1;
        border-radius: 12px;
        padding: 24px;
        width: min(92vw, 760px);
        max-width: 760px;
        max-height: 88vh;
        overflow-y: auto;
        color: white;
        margin: 16px;
    `;

    let commentsHTML = '';
    if (comments.length > 0) {
        commentsHTML = comments.map((comment, index) => {
            const safeNickname = escapeHtml(comment.nickname || 'usuario');
            const safeDate = new Date(comment.createdAt).toLocaleDateString('pt-BR');
            const safeContent = String(comment.content || '').trim();
            const canDeleteComment = Boolean(currentUser) && (
                Number(comment.userId) === Number(currentUser.id) ||
                canModerateComments
            );
            const canEditComment = canDeleteComment;
            const canPinComment = canModerateComments; // APENAS moderadores/admins podem fixar
            const isPinned = Boolean(comment.isPinned);
            const createdAtTs = new Date(comment.createdAt || '').getTime();
            const updatedAtTs = new Date(comment.updatedAt || '').getTime();
            const wasEdited = Number.isFinite(createdAtTs) &&
                Number.isFinite(updatedAtTs) &&
                (updatedAtTs - createdAtTs) > 1000;
            const contentHtml = safeContent
                ? `<p style="margin: 0 0 10px 0; color: #ddd; font-size: 13px; line-height: 1.5;">${escapeHtml(safeContent).replace(/\n/g, '<br>')}</p>`
                : '';
            const attachmentHtml = renderCommentAttachment(comment);
            const pinButtonHtml = canPinComment
                ? `<button class="btn-pin-comment" data-comment-id="${comment.id}" data-is-pinned="${isPinned ? '1' : '0'}" style="margin-top: 10px; background: linear-gradient(135deg, ${isPinned ? '#FBBF24' : '#6B46C1'} 0%, ${isPinned ? '#F59E0B' : '#8B5CF6'} 100%); color: white; border: 1px solid #EC4899; padding: 5px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600; transition: all 0.3s;">${isPinned ? 'Fixado' : 'Fixar'}</button>`
                : '';
            const editButtonHtml = canEditComment
                ? `<button class="btn-edit-comment" data-comment-id="${comment.id}" style="margin-top: 10px; background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); color: white; border: 1px solid #EC4899; padding: 5px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600; transition: all 0.3s;">Editar</button>`
                : '';
            const deleteButtonHtml = canDeleteComment
                ? `<button class="btn-delete-comment" data-comment-id="${comment.id}" style="margin-top: 10px; background: linear-gradient(135deg, #DB2777 0%, #EC4899 100%); color: white; border: 1px solid #EC4899; padding: 5px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600; transition: all 0.3s;">Excluir</button>`
                : '';
            const editedBadgeHtml = wasEdited
                ? `<span style="display: inline-block; margin-left: 6px; font-size: 10px; color: #FBCFE8; border: 1px solid rgba(236,72,153,0.55); padding: 2px 6px; border-radius: 999px; background: rgba(236,72,153,0.16);">editado</span>`
                : '';
            const pinnedBadgeHtml = isPinned && comment.pinnedByNickname
                ? `<span style="display: inline-block; margin-left: 6px; font-size: 10px; color: #FBBF24; border: 1px solid rgba(251,191,36,0.55); padding: 2px 6px; border-radius: 999px; background: rgba(251,191,36,0.16);">Fixado por <button class="btn-user-profile-from-comment" data-user-id="${comment.pinnedById}" style="background: none; border: none; color: #FBBF24; font-size: 10px; font-weight: 600; cursor: pointer; text-decoration: none; padding: 0; display: inline; margin: 0;">@${comment.pinnedByNickname}</button></span>`
                : '';

            return `
                <div style="background: linear-gradient(135deg, ${isPinned ? 'rgba(251, 191, 36, 0.15)' : 'rgba(107, 70, 193, 0.1)'} 0%, rgba(236, 72, 153, 0.05) 100%); padding: 15px; border-radius: 8px; margin-bottom: 12px; border: 2px solid ${isPinned ? '#FBBF24' : '#6B46C1'}; border-left: 5px solid ${isPinned ? '#FBBF24' : '#EC4899'};">
                    <div id="reactions-${comment.id}" style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; min-height: auto;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <button class="btn-user-profile-from-comment" data-user-id="${comment.userId}" style="background: none; border: none; color: #EC4899; font-size: 14px; font-weight: bold; cursor: pointer; text-decoration: none; padding: 0; transition: all 0.3s ease; display: inline-block;">@${safeNickname}</button>
                            <p style="margin: 4px 0 0 0; color: #999; font-size: 11px;">Comentario ${index + 1}</p>
                        </div>
                        <span style="font-size: 11px; color: #999; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px;">${safeDate}${editedBadgeHtml}${pinnedBadgeHtml}</span>
                    </div>
                    ${contentHtml}
                    ${attachmentHtml}
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn-add-reaction" data-comment-id="${comment.id}" data-emoji1="😊" data-emoji2="👍" style="margin-top: 10px; background: linear-gradient(135deg, #374151 0%, #1F2937 100%); color: #F9FAFB; border: 1px solid #6B46C1; padding: 5px 12px; border-radius: 4px; font-size: 16px; cursor: pointer; font-weight: 600; transition: all 0.3s; height: 30px; display: flex; align-items: center; justify-content: center; position: relative;"><span class="reaction-emoji-display">😊</span></button>
                        <button class="btn-reply-comment" data-comment-id="${comment.id}" data-user-nickname="@${safeNickname}" style="margin-top: 10px; background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); color: white; border: 1px solid #EC4899; padding: 5px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600; transition: all 0.3s;">Responder</button>
                        ${pinButtonHtml}
                        ${editButtonHtml}
                        ${deleteButtonHtml}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        commentsHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 120px; border: 1px dashed rgba(107, 70, 193, 0.55); border-radius: 8px;">
                <p style="color: #999; text-align: center; padding: 20px; margin: 0;">Nenhum comentário ainda. Seja o primeiro a comentar!</p>
            </div>
        `;
    }

    content.innerHTML = `
        <div style="text-align: center;">
            <h3 style="color: #EC4899; margin: 0 0 10px 0; font-size: 22px; font-weight: 700;">Comentarios</h3>
            <p style="color: #999; margin: 0 0 20px 0; font-size: 12px;">${comments.length} comentário(s)</p>
        </div>
        
        <div style="background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%); padding: 15px; border-radius: 8px; min-height: 160px; max-height: 36vh; overflow-y: auto; margin-bottom: 20px; border: 1px solid #6B46C1;">
            ${commentsHTML}
        </div>
        
        <div id="replySection" style="display: none; background: linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(107, 70, 193, 0.1) 100%); padding: 12px; border-radius: 6px; margin-bottom: 15px; border: 2px solid #EC4899;">
            <p style="margin: 0 0 10px 0; color: #EC4899; font-size: 12px; font-weight: 600;">Respondendo para: <span id="replyUserName"></span></p>
            <textarea id="replyContent" placeholder="Digite sua resposta..." style="width: 100%; padding: 10px; background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%); border: 2px solid #EC4899; border-radius: 6px; color: white; font-family: inherit; height: 80px; resize: vertical; font-size: 13px;" maxlength="500"></textarea>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                <span style="font-size: 11px; color: #999;" id="replyCharCount">0/500</span>
                <div style="display: flex; gap: 8px;">
                    <button id="cancelReply" type="button" style="background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); color: white; border: 1px solid #EC4899; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;">Cancelar</button>
                    <button id="submitReply" type="button" style="background: linear-gradient(135deg, #EC4899 0%, #DB2777 100%); color: white; border: 1px solid #EC4899; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;">Responder</button>
                </div>
            </div>
        </div>

        <div id="editCommentSection" style="display: none; background: linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(107, 70, 193, 0.1) 100%); padding: 12px; border-radius: 6px; margin-bottom: 15px; border: 2px solid #38BDF8;">
            <p style="margin: 0 0 10px 0; color: #38BDF8; font-size: 12px; font-weight: 600;">Editando comentário</p>
            <textarea id="editCommentContent" placeholder="Edite o comentário..." style="width: 100%; padding: 10px; background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%); border: 2px solid #38BDF8; border-radius: 6px; color: white; font-family: inherit; height: 90px; resize: vertical; font-size: 13px;" maxlength="500"></textarea>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                <span style="font-size: 11px; color: #999;" id="editCharCount">0/500</span>
                <div style="display: flex; gap: 8px;">
                    <button id="cancelEditComment" type="button" style="background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); color: white; border: 1px solid #EC4899; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;">Cancelar</button>
                    <button id="saveEditComment" type="button" style="background: linear-gradient(135deg, #38BDF8 0%, #0284C7 100%); color: white; border: 1px solid #38BDF8; padding: 6px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;">Salvar edição</button>
                </div>
            </div>
        </div>
        
        <form id="commentForm" style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 2px solid #6B46C1;">
            <div>
                <label style="color: #EC4899; font-size: 12px; font-weight: 600; display: block; margin-bottom: 8px;">Adicione seu comentario:</label>
                <textarea id="commentContent" placeholder="Digite seu comentário aqui..." style="width: 100%; padding: 12px; background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%); border: 2px solid #6B46C1; border-radius: 6px; color: white; font-family: inherit; height: 100px; resize: vertical; font-size: 13px;" maxlength="500"></textarea>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                <button id="toggleEmojiPicker" type="button" style="padding: 8px 12px; background: linear-gradient(135deg, #374151 0%, #1F2937 100%); color: #F9FAFB; border: 1px solid #6B46C1; border-radius: 5px; cursor: pointer; font-weight: 600;">Escolher emoji</button>
                <button id="chooseCommentAttachment" type="button" style="padding: 8px 12px; background: linear-gradient(135deg, #374151 0%, #1F2937 100%); color: #F9FAFB; border: 1px solid #6B46C1; border-radius: 5px; cursor: pointer; font-weight: 600;">Anexar arquivo</button>
                <input id="commentAttachmentInput" type="file" style="display: none;" accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.pdf,.txt,.zip,.rar,.7z,.apk,.iso,.exe,.msi,.mp3,.mp4,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.json">
                <span style="font-size: 11px; color: #9CA3AF;">Imagens, GIF e arquivos até 500MB</span>
            </div>

            <div id="commentAttachmentPreview" style="display: none; padding: 10px; border: 1px solid rgba(56,189,248,0.55); border-radius: 8px; background: rgba(0,0,0,0.25);"></div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: #999;" id="charCount">0/500</span>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button type="submit" style="padding: 10px 20px; background: linear-gradient(135deg, #EC4899 0%, #DB2777 100%); color: white; border: 1px solid #EC4899; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(236, 72, 153, 0.3);">Enviar Comentário</button>
                    <button id="closeComments" type="button" style="padding: 10px 20px; background: linear-gradient(135deg, #6B46C1 0%, #8B5CF6 100%); color: white; border: 1px solid #EC4899; border-radius: 5px; cursor: pointer; font-weight: 600; transition: all 0.3s; box-shadow: 0 0 10px rgba(236, 72, 153, 0.3);">Fechar</button>
                </div>
            </div>
        </form>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    const query = (selector) => content.querySelector(selector);
    const textarea = query('#commentContent');
    const charCount = query('#charCount');
    const emojiToggleBtn = query('#toggleEmojiPicker');
    const attachmentInput = query('#commentAttachmentInput');
    const attachmentPreview = query('#commentAttachmentPreview');
    const chooseAttachmentBtn = query('#chooseCommentAttachment');
    const replySection = query('#replySection');
    const editCommentSection = query('#editCommentSection');
    const editCommentContent = query('#editCommentContent');
    const editCharCount = query('#editCharCount');
    let activeEditingCommentId = null;
    let selectedAttachment = null;
    let previewObjectUrl = '';

    const updateCommentCounter = () => {
        if (!textarea || !charCount) return;
        charCount.textContent = `${textarea.value.length}/500`;
    };
    textarea?.addEventListener('input', updateCommentCounter);
    updateCommentCounter();

    const renderAttachmentPreview = () => {
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = '';
        }

        if (!selectedAttachment) {
            if (attachmentPreview) {
                attachmentPreview.style.display = 'none';
                attachmentPreview.innerHTML = '';
            }
            return;
        }

        const safeName = escapeHtml(selectedAttachment.name || 'arquivo');
        const safeSize = escapeHtml(formatFileSize(selectedAttachment.size || 0));
        const isImage = String(selectedAttachment.type || '').startsWith('image/');
        if (isImage) {
            previewObjectUrl = URL.createObjectURL(selectedAttachment);
        }
        const previewHtml = isImage
            ? `<img src="${escapeHtml(previewObjectUrl)}" alt="${safeName}" style="display:block; max-width: 220px; max-height: 180px; border-radius: 6px; margin-bottom: 8px; object-fit: cover;">`
            : `<div style="font-size: 24px; margin-bottom: 6px;">📎</div>`;

        if (!attachmentPreview) return;
        attachmentPreview.style.display = 'block';
        attachmentPreview.innerHTML = `
            ${previewHtml}
            <div style="font-size: 12px; color: #9be7ff; margin-bottom: 8px;">${safeName} (${safeSize})</div>
            <button id="removeCommentAttachment" type="button" style="padding: 6px 10px; background: rgba(239,68,68,0.2); color: #FECACA; border: 1px solid rgba(239,68,68,0.6); border-radius: 5px; cursor: pointer; font-size: 12px;">Remover anexo</button>
        `;

        const removeBtn = query('#removeCommentAttachment');
        removeBtn?.addEventListener('click', () => {
            selectedAttachment = null;
            if (attachmentInput) attachmentInput.value = '';
            renderAttachmentPreview();
        });
    };

    chooseAttachmentBtn?.addEventListener('click', () => {
        attachmentInput?.click();
    });

    attachmentInput?.addEventListener('change', () => {
        const picked = attachmentInput.files && attachmentInput.files[0] ? attachmentInput.files[0] : null;
        if (!picked) {
            selectedAttachment = null;
            renderAttachmentPreview();
            return;
        }

        if (picked.size > COMMENT_ATTACHMENT_MAX_BYTES) {
            selectedAttachment = null;
            attachmentInput.value = '';
            showNotification('Arquivo muito grande. Limite de 500MB.', 'error');
            renderAttachmentPreview();
            return;
        }

        selectedAttachment = picked;
        renderAttachmentPreview();
    });

    const appendEmojiToComment = (emoji) => {
        if (!textarea) return;
        const picked = String(emoji || '');
        if (!picked) return;
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        const currentText = textarea.value;
        textarea.value = `${currentText.slice(0, start)}${picked}${currentText.slice(end)}`;
        const nextPos = start + picked.length;
        textarea.setSelectionRange(nextPos, nextPos);
        textarea.focus();
        updateCommentCounter();
    };

    emojiToggleBtn?.addEventListener('click', () => {
        openCommentEmojiPickerModal((emoji) => {
            appendEmojiToComment(emoji);
        });
    });

    // Enviar comentário
    query('#commentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!textarea) return;
        const textContentRaw = String(textarea.value || '');
        const activeAttachment = selectedAttachment || (attachmentInput?.files && attachmentInput.files[0]) || null;
        const hasTextContent = /\S/u.test(textContentRaw);

        if (!hasTextContent && !activeAttachment) {
            showNotification('Comentário vazio. Digite algo ou envie um anexo.', 'error');
            return;
        }

        const response = await AuthAPI.addDownloadComment(downloadId, textContentRaw, {
            attachment: activeAttachment
        });
        if (response.success) {
            showNotification('Comentário adicionado com sucesso!', 'success');
            await loadDownloads();
            if (previewObjectUrl) {
                URL.revokeObjectURL(previewObjectUrl);
                previewObjectUrl = '';
            }
            await showCommentForm(downloadId);
        } else {
            showNotification(response.message || 'Erro ao adicionar comentário', 'error');
        }
    });

    // Fechar
    query('#closeComments')?.addEventListener('click', () => {
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = '';
        }
        modal.remove();
    });

    // Event listeners para botoes de responder
    content.querySelectorAll('.btn-reply-comment').forEach(btn => {
        btn.addEventListener('click', () => {
            const replyUserName = query('#replyUserName');
            const replyContent = query('#replyContent');

            if (!replySection || !replyUserName || !replyContent) return;
            if (editCommentSection) editCommentSection.style.display = 'none';
            activeEditingCommentId = null;
            replyUserName.textContent = btn.dataset.userNickname;
            replyContent.value = '';
            const replyCounter = query('#replyCharCount');
            if (replyCounter) replyCounter.textContent = '0/500';
            replySection.style.display = 'block';
            replyContent.focus();
        });
    });

    const updateEditCounter = () => {
        if (!editCommentContent || !editCharCount) return;
        editCharCount.textContent = `${editCommentContent.value.length}/500`;
    };
    editCommentContent?.addEventListener('input', updateEditCounter);
    updateEditCounter();

    content.querySelectorAll('.btn-edit-comment').forEach((btn) => {
        btn.addEventListener('click', () => {
            const commentId = String(btn.dataset.commentId || '').trim();
            const comment = commentsById.get(commentId);
            if (!comment || !editCommentSection || !editCommentContent) return;

            if (replySection) replySection.style.display = 'none';
            activeEditingCommentId = commentId;
            editCommentContent.value = String(comment.content || '');
            updateEditCounter();
            editCommentSection.style.display = 'block';
            editCommentContent.focus();
            editCommentContent.setSelectionRange(editCommentContent.value.length, editCommentContent.value.length);
        });
    });

    query('#cancelEditComment')?.addEventListener('click', () => {
        activeEditingCommentId = null;
        if (editCommentContent) {
            editCommentContent.value = '';
            updateEditCounter();
        }
        if (editCommentSection) {
            editCommentSection.style.display = 'none';
        }
    });

    query('#saveEditComment')?.addEventListener('click', async () => {
        const commentId = String(activeEditingCommentId || '').trim();
        if (!commentId || !editCommentContent) return;

        const comment = commentsById.get(commentId) || null;
        const editedText = String(editCommentContent.value || '');
        const trimmedEditedText = editedText.trim();
        const hasAttachment = Boolean(comment?.attachmentPath);

        if (!trimmedEditedText && !hasAttachment) {
            showNotification('Comentário vazio. Digite algo ou mantenha um anexo.', 'error');
            return;
        }

        const response = await AuthAPI.updateDownloadComment(commentId, editedText);
        if (!response?.success) {
            showNotification(response?.message || 'Erro ao editar comentário', 'error');
            return;
        }

        showNotification('Comentário editado com sucesso!', 'success');
        await loadDownloads();
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = '';
        }
        modal.remove();
        showCommentForm(downloadId);
    });

    content.querySelectorAll('.btn-delete-comment').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const commentId = btn.dataset.commentId;
            if (!commentId) return;

            const confirmed = await showThemedConfirm({
                title: 'Excluir comentário',
                message: 'Deseja excluir este comentário?',
                confirmText: 'Excluir',
                cancelText: 'Cancelar'
            });
            if (!confirmed) return;

            const response = await AuthAPI.deleteDownloadComment(commentId);
            if (!response?.success) {
                showNotification(response?.message || 'Erro ao excluir comentário', 'error');
                return;
            }

            showNotification('Comentário excluído com sucesso!', 'success');
            await loadDownloads();
            if (previewObjectUrl) {
                URL.revokeObjectURL(previewObjectUrl);
                previewObjectUrl = '';
            }
            modal.remove();
            showCommentForm(downloadId);
        });
    });

    // Event listeners para clique no nome do usuário do comentário
    content.querySelectorAll('.btn-user-profile-from-comment').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const userId = btn.dataset.userId;
            if (!userId) return;
            showUserMiniProfile(userId);
        });
        // Adicionar efeito de hover
        btn.addEventListener('mouseover', () => {
            btn.style.opacity = '0.8';
            btn.style.textDecoration = 'underline';
        });
        btn.addEventListener('mouseout', () => {
            btn.style.opacity = '1';
            btn.style.textDecoration = 'none';
        });
    });

    // Event listeners para fixar comentários
    content.querySelectorAll('.btn-pin-comment').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const commentId = btn.dataset.commentId;
            const currentlyPinned = btn.dataset.isPinned === '1';
            if (!commentId) return;

            try {
                console.log(`[PIN] Tentando ${currentlyPinned ? 'desafixar' : 'fixar'} comentário ${commentId}`);
                const response = await AuthAPI.pinComment(commentId, !currentlyPinned);
                console.log(`[PIN] Resposta do servidor:`, response);
                
                if (response && response.success) {
                    const msg = currentlyPinned ? 'Comentário desafixado com sucesso!' : 'Comentário fixado com sucesso!';
                    showNotification(msg, 'success');
                    
                    // Recarregar comentários para reordenar (fixados no topo)
                    const commentsResponse = await AuthAPI.getDownloadComments(downloadId);
                    if (commentsResponse.success && commentsResponse.comments) {
                        // Renderizar comentários novamente na mesma modal
                        await showCommentForm(downloadId);
                    }
                } else {
                    const errorMsg = response?.message || 'Erro ao fixar comentário. Tente novamente.';
                    console.error(`[PIN] Erro:`, response);
                    showNotification(errorMsg, 'error');
                }
            } catch (error) {
                console.error(`[PIN] Exceção ao fixar:`, error);
                showNotification('❌ Erro de conexão ao fixar. Verifique sua internet e tente novamente.', 'error');
            }
        });
    });

    // Event listeners para adicionar reações
    content.querySelectorAll('.btn-add-reaction').forEach((btn) => {
        const emoji1 = btn.dataset.emoji1 || '😊';
        const emoji2 = btn.dataset.emoji2 || '👍';
        const display = btn.querySelector('.reaction-emoji-display');
        
        // Alternar emojis ao passar o mouse
        btn.addEventListener('mouseenter', () => {
            if (display) {
                display.textContent = emoji2;
            }
        });
        
        btn.addEventListener('mouseleave', () => {
            if (display) {
                display.textContent = emoji1;
            }
        });
        
        btn.addEventListener('click', async () => {
            const commentId = btn.dataset.commentId;
            if (!commentId) return;

            if (!currentUser) {
                showNotification('Você deve estar logado para reagir', 'error');
                return;
            }

            // Mostrar picker de emojis
            openCommentReactionPicker((emoji) => {
                addReactionToComment(commentId, emoji, downloadId);
            });
        });
    });

    // Renderizar reações para cada comentário
    comments.forEach((comment) => {
        const reactionsContainer = content.querySelector(`#reactions-${comment.id}`);
        if (reactionsContainer) {
            renderCommentReactions(comment, reactionsContainer, downloadId);
        }
    });

    // Contador de caracteres da resposta
    const replyContent = query('#replyContent');
    const replyCharCount = query('#replyCharCount');
    if (replyContent) {
        replyContent.addEventListener('input', () => {
            if (replyCharCount) replyCharCount.textContent = `${replyContent.value.length}/500`;
        });
    }

    // Cancelar resposta
    query('#cancelReply')?.addEventListener('click', () => {
        if (replySection) replySection.style.display = 'none';
        if (!replyContent) return;
        replyContent.value = '';
        if (replyCharCount) replyCharCount.textContent = '0/500';
    });

    // Enviar resposta
    query('#submitReply')?.addEventListener('click', async () => {
        if (!replyContent) return;
        const responseText = replyContent.value.trim();
        const replyTo = (query('#replyUserName')?.textContent || '').trim();

        if (!responseText) {
            showNotification('Resposta não pode estar vazia', 'error');
            return;
        }

        const finalContent = replyTo ? `${replyTo} ${responseText}` : responseText;
        const response = await AuthAPI.addDownloadComment(downloadId, finalContent);
        if (response.success) {
            showNotification('Resposta adicionada com sucesso!', 'success');
            await loadDownloads();
            if (previewObjectUrl) {
                URL.revokeObjectURL(previewObjectUrl);
                previewObjectUrl = '';
            }
            await showCommentForm(downloadId);
        } else {
            showNotification(response.message || 'Erro ao adicionar resposta', 'error');
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            if (previewObjectUrl) {
                URL.revokeObjectURL(previewObjectUrl);
                previewObjectUrl = '';
            }
            modal.remove();
        }
    });
}

// Mostrar formulário de editar download
function showEditDownloadForm(download) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        overflow-y: auto;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #6B46C1;
        border-radius: 12px;
        padding: 30px;
        max-width: 500px;
        color: white;
        margin: 20px;
    `;

    const canEditAdultFlag = canUseAdultPostOptions();
    
    content.innerHTML = `
        <h3 style="color: #EC4899; margin-bottom: 20px; font-size: 20px;">Editar Download</h3>
        <form id="editDownloadForm" style="display: flex; flex-direction: column; gap: 15px;">
            <div>
                <label style="color: #EC4899; font-size: 12px; display: block; margin-bottom: 5px;">Nome do Programa</label>
                <input type="text" id="editDownloadName" style="width: 100%; box-sizing: border-box; padding: 10px; background: rgba(0, 0, 0, 0.3); border: 1px solid #EC4899; border-radius: 5px; color: white;">
            </div>
            <div>
                <label style="color: #EC4899; font-size: 12px; display: block; margin-bottom: 5px;">Descrieeo</label>
                <textarea id="editDownloadDescription" style="width: 100%; box-sizing: border-box; padding: 10px; background: rgba(0, 0, 0, 0.3); border: 1px solid #EC4899; border-radius: 5px; color: white; font-family: inherit; height: 100px; resize: vertical;"></textarea>
            </div>
            ${canEditAdultFlag ? `
            <div style="padding: 10px; border: 1px solid rgba(236, 72, 153, 0.45); border-radius: 8px; background: rgba(0,0,0,0.2);">
                <label style="display: flex; gap: 8px; align-items: center; color: #FBCFE8; font-weight: 600; cursor: pointer;">
                    <input type="checkbox" id="editDownloadIsAdult" class="themed-checkbox">
                    Esta postagem é maior de 18 anos?
                </label>
                <small style="display: block; margin-top: 6px; color: rgba(255,255,255,0.65);">Conteúdo +18 só será exibido para contas 18+ com opção ativada.</small>
                <small style="display: block; margin-top: 6px; color: rgba(251, 191, 36, 0.95);">Qualquer conteúdo +18, explícito ou não, deve ser marcado nessa opção. Se não marcar, haverá consequências e punições.</small>
            </div>
            ` : ''}
            <div style="padding: 10px; border: 1px solid rgba(236, 72, 153, 0.45); border-radius: 8px; background: rgba(0,0,0,0.2);">
                <label style="display: flex; gap: 8px; align-items: center; color: #FBCFE8; font-weight: 600; cursor: pointer;">
                    <input type="checkbox" id="editDownloadMembersOnly" class="themed-checkbox">
                    Mostrar postagem apenas para membros
                </label>
                <small style="display: block; margin-top: 6px; color: rgba(255,255,255,0.65);">Quando marcado, quem não estiver logado verá a postagem bloqueada.</small>
            </div>
            <div>
                <label style="color: #EC4899; font-size: 12px; display: block; margin-bottom: 8px;">Links do Download</label>
                <div id="editLinksContainer" style="display: flex; flex-direction: column; gap: 10px;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <small style="color: #A78BFA;">Máximo de ${MAX_DOWNLOAD_LINKS} links/arquivos</small>
                    <button id="editBtnAddLink" type="button" style="padding: 7px 12px; background: #6B46C1; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">+ Link</button>
                </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                <button id="cancelEdit" type="button" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">Cancelar</button>
                <button id="saveEdit" type="submit" style="padding: 10px 20px; background: #6B46C1; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">Salvar</button>
            </div>
        </form>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    const editDownloadName = document.getElementById('editDownloadName');
    const editDownloadDescription = document.getElementById('editDownloadDescription');
    const editDownloadIsAdult = document.getElementById('editDownloadIsAdult');
    const editDownloadMembersOnly = document.getElementById('editDownloadMembersOnly');
    const editLinksContainer = document.getElementById('editLinksContainer');
    const editBtnAddLink = document.getElementById('editBtnAddLink');

    if (editDownloadName) editDownloadName.value = download.name || '';
    if (editDownloadDescription) editDownloadDescription.value = download.description || '';
    if (editDownloadIsAdult) editDownloadIsAdult.checked = Number(download?.isAdult) === 1 || download?.isAdult === true;
    if (editDownloadMembersOnly) editDownloadMembersOnly.checked = Number(download?.membersOnly) === 1 || download?.membersOnly === true;

    const buildEditLinkRow = (linkData = { url: '', format: 'auto' }) => {
        const normalizedUrl = String(linkData?.url || '').trim();
        const existingUploadUrl = normalizedUrl && isDownloadFileUrl(normalizedUrl);
        const useFile = existingUploadUrl;
        const useLink = !existingUploadUrl;
        const row = document.createElement('div');
        row.className = 'edit-download-link-row';
        row.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
        row.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 220px;">
                    <label class="editDownloadLinkLabel" style="display: block; margin-bottom: 5px; font-weight: 600; color: white;">Link *</label>
                    <input type="url" class="editDownloadLinkInput" placeholder="https://..." style="width: 100%; box-sizing: border-box; padding: 10px; background: rgba(0, 0, 0, 0.3); border: 1px solid #EC4899; border-radius: 5px; color: white;">
                </div>
                <div style="width: 180px; min-width: 180px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: 600; color: white;">Formato</label>
                    <select class="editDownloadLinkFormat" style="width: 100%; box-sizing: border-box; padding: 10px; background: rgba(0, 0, 0, 0.3); border: 1px solid #EC4899; border-radius: 5px; color: white;">
                        ${getFormatOptionsHtml(linkData.format || 'auto')}
                    </select>
                </div>
                <button type="button" class="btnRemoveEditLink" style="padding: 8px 12px; background: #EF4444; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">- Link</button>
            </div>
            <div class="download-upload-row">
                <div class="download-mode-toggles">
                    <label style="display: inline-flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.85); font-weight: 700; cursor: pointer;">
                        <input type="checkbox" class="editDownloadUseLink themed-checkbox" ${useLink ? 'checked' : ''}>
                        Usar link (URL)
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.85); font-weight: 700; cursor: pointer;">
                        <input type="checkbox" class="editDownloadUseFile themed-checkbox" ${useFile ? 'checked' : ''}>
                        Enviar arquivo
                    </label>
                </div>
                <small style="color: rgba(255,255,255,0.65); font-weight: 600;">Arquivo até 500MB</small>
            </div>
            <div class="download-file-picker edit-download-file-picker" ${useFile ? '' : 'hidden'}>
                <input type="file" class="editDownloadFile" accept="${DOWNLOAD_FILE_ACCEPT}" style="display:none;">
                <button type="button" class="download-file-btn edit-download-file-btn">Escolher arquivo</button>
                <span class="download-file-name editDownloadFileName">${useFile ? escapeHtml(normalizedUrl.split('/').pop() || 'Arquivo atual mantido') : 'Nenhum arquivo escolhido'}</span>
                <small class="download-file-hint">${useFile ? 'Arquivo atual salvo. Escolha outro se quiser trocar.' : 'Máx.: 500MB'}</small>
            </div>
        `;
        row.querySelector('.editDownloadLinkInput').value = useLink ? normalizedUrl : '';
        row.dataset.existingFileUrl = useFile ? normalizedUrl : '';
        return row;
    };

    const syncEditLinkRowMode = (row) => {
        if (!row) return;
        const useLinkToggle = row.querySelector('.editDownloadUseLink');
        const useFileToggle = row.querySelector('.editDownloadUseFile');
        const useLink = useLinkToggle?.checked === true;
        const useFile = useFileToggle?.checked === true;
        const urlInput = row.querySelector('.editDownloadLinkInput');
        const linkLabel = row.querySelector('.editDownloadLinkLabel');
        const formatSelect = row.querySelector('.editDownloadLinkFormat');
        const fileInput = row.querySelector('.editDownloadFile');
        const filePicker = row.querySelector('.edit-download-file-picker');
        const fileNameLabel = row.querySelector('.editDownloadFileName');
        const existingFileUrl = String(row.dataset.existingFileUrl || '').trim();

        if (urlInput) {
            urlInput.disabled = !useLink;
            urlInput.style.opacity = useLink ? '1' : '0.6';
        }

        if (linkLabel) {
            if (!useLink) {
                linkLabel.textContent = 'Link (desativado)';
            } else if (useLink && !useFile) {
                linkLabel.textContent = 'Link *';
            } else {
                linkLabel.textContent = 'Link (opcional)';
            }
        }

        if (filePicker) filePicker.hidden = !useFile;

        if (!useFile && fileInput) {
            fileInput.value = '';
        }

        if (fileNameLabel) {
            const pickedFileName = fileInput?.files?.[0]?.name || '';
            if (pickedFileName) {
                fileNameLabel.textContent = pickedFileName;
            } else if (useFile && existingFileUrl) {
                fileNameLabel.textContent = existingFileUrl.split('/').pop() || 'Arquivo atual mantido';
            } else {
                fileNameLabel.textContent = 'Nenhum arquivo escolhido';
            }
        }

        if (formatSelect) {
            const onlyFile = useFile && !useLink;
            formatSelect.disabled = onlyFile;
            formatSelect.style.opacity = onlyFile ? '0.7' : '1';
            if (onlyFile) {
                const inferred = inferCompactFormatFromFilename(fileInput?.files?.[0]?.name || existingFileUrl);
                formatSelect.value = inferred === 'auto' ? 'zip' : inferred;
            } else if (!formatSelect.value) {
                formatSelect.value = 'auto';
            }
        }
    };

    const bindEditLinkRow = (row) => {
        if (!row || row.dataset.bound === '1') return;
        row.dataset.bound = '1';

        const useLinkToggle = row.querySelector('.editDownloadUseLink');
        const useFileToggle = row.querySelector('.editDownloadUseFile');
        const fileInput = row.querySelector('.editDownloadFile');
        const fileButton = row.querySelector('.edit-download-file-btn');

        const ensureAtLeastOneMode = (preferred = 'link') => {
            const linkOn = useLinkToggle?.checked === true;
            const fileOn = useFileToggle?.checked === true;
            if (linkOn || fileOn) return;

            if (preferred === 'file') {
                if (useFileToggle) useFileToggle.checked = true;
                return;
            }

            if (useLinkToggle) useLinkToggle.checked = true;
        };

        fileButton?.addEventListener('click', (event) => {
            event.preventDefault();
            fileInput?.click();
        });

        useLinkToggle?.addEventListener('change', () => {
            ensureAtLeastOneMode('link');
            syncEditLinkRowMode(row);
        });

        useFileToggle?.addEventListener('change', () => {
            ensureAtLeastOneMode('file');
            syncEditLinkRowMode(row);
        });

        fileInput?.addEventListener('change', () => {
            const file = fileInput?.files?.[0] || null;
            if (file && Number(file.size || 0) > MAX_DOWNLOAD_FILE_BYTES) {
                showNotification('Arquivo muito grande (máximo 500MB).', 'error');
                fileInput.value = '';
            }
            ensureAtLeastOneMode('file');
            syncEditLinkRowMode(row);
        });

        ensureAtLeastOneMode(useFileToggle?.checked ? 'file' : 'link');
        syncEditLinkRowMode(row);
    };

    const syncEditLinksState = () => {
        const rows = Array.from(editLinksContainer.querySelectorAll('.edit-download-link-row'));
        const maxReached = rows.length >= MAX_DOWNLOAD_LINKS;
        if (editBtnAddLink) {
            editBtnAddLink.disabled = maxReached;
            editBtnAddLink.style.opacity = maxReached ? '0.65' : '1';
            editBtnAddLink.style.cursor = maxReached ? 'not-allowed' : 'pointer';
        }
        rows.forEach((row) => {
            const removeBtn = row.querySelector('.btnRemoveEditLink');
            if (!removeBtn) return;
            const canRemove = rows.length > 1;
            removeBtn.disabled = !canRemove;
            removeBtn.style.opacity = canRemove ? '1' : '0.45';
            removeBtn.style.cursor = canRemove ? 'pointer' : 'not-allowed';
        });
    };

    const appendEditLinkRow = (linkData = { url: '', format: 'auto' }) => {
        const row = buildEditLinkRow(linkData);
        row.querySelector('.btnRemoveEditLink')?.addEventListener('click', () => {
            row.remove();
            syncEditLinksState();
        });
        bindEditLinkRow(row);
        editLinksContainer.appendChild(row);
        syncEditLinksState();
    };

    const existingLinks = parseDownloadLinks(download);
    const isEditDataLocked = Boolean(download?.isAdultLocked) || Boolean(download?.membersOnlyLocked);
    const canPreserveHiddenLinksOnSave = isEditDataLocked && existingLinks.length === 0;
    if (existingLinks.length === 0) {
        appendEditLinkRow({ url: String(download.link || '').trim(), format: 'auto' });
    } else {
        existingLinks.forEach(linkItem => appendEditLinkRow(linkItem));
    }

    if (canPreserveHiddenLinksOnSave) {
        const preserveInfo = document.createElement('small');
        preserveInfo.style.cssText = 'display: block; margin-top: 8px; color: #FBBF24;';
        preserveInfo.textContent = 'Os links deste download estão ocultos por bloqueio +18. Se salvar sem alterar os links, os links atuais serão mantidos.';
        editLinksContainer.insertAdjacentElement('afterend', preserveInfo);
    }

    editBtnAddLink?.addEventListener('click', () => {
        const rowCount = editLinksContainer.querySelectorAll('.edit-download-link-row').length;
        if (rowCount >= MAX_DOWNLOAD_LINKS) {
            showNotification(`Máximo de ${MAX_DOWNLOAD_LINKS} links por postagem`, 'error');
            syncEditLinksState();
            return;
        }
        appendEditLinkRow({ url: '', format: 'auto' });
    });

    document.getElementById('cancelEdit').addEventListener('click', () => {
        modal.remove();
    });
    
    document.getElementById('editDownloadForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('editDownloadName').value.trim();
        const description = document.getElementById('editDownloadDescription').value;
        const adultToggle = document.getElementById('editDownloadIsAdult');
        const membersOnly = document.getElementById('editDownloadMembersOnly')?.checked === true;
        const entries = Array.from(editLinksContainer.querySelectorAll('.edit-download-link-row'))
            .map((row) => {
                const useLink = row.querySelector('.editDownloadUseLink')?.checked === true;
                const useFile = row.querySelector('.editDownloadUseFile')?.checked === true;
                const url = String(row.querySelector('.editDownloadLinkInput')?.value || '').trim();
                const format = normalizeDownloadLinkFormat(row.querySelector('.editDownloadLinkFormat')?.value || 'auto');
                const fileInput = row.querySelector('.editDownloadFile');
                const file = fileInput?.files?.[0] || null;
                const existingFileUrl = String(row.dataset.existingFileUrl || '').trim();
                const rowEntries = [];

                if (useLink && url) {
                    rowEntries.push({ type: 'url', url, format });
                }

                if (useFile) {
                    if (file) {
                        const inferred = inferCompactFormatFromFilename(file.name);
                        rowEntries.push({ type: 'file', file, format: inferred === 'auto' ? 'zip' : inferred });
                    } else if (existingFileUrl) {
                        rowEntries.push({
                            type: 'existing-file',
                            url: existingFileUrl,
                            format: normalizeDownloadLinkFormat(format || inferCompactFormatFromFilename(existingFileUrl))
                        });
                    }
                }

                return rowEntries;
            })
            .flat();
        
        if (!name) {
            showNotification('Nome é obrigatório', 'error');
            return;
        }

        if (entries.length === 0 && !canPreserveHiddenLinksOnSave) {
            showNotification('Nome e pelo menos um link/arquivo são obrigatórios', 'error');
            return;
        }
        
        if (entries.length > MAX_DOWNLOAD_LINKS) {
            showNotification(`Máximo de ${MAX_DOWNLOAD_LINKS} links/arquivos permitidos`, 'error');
            return;
        }

        const saveButton = document.getElementById('saveEdit');
        const cancelButton = document.getElementById('cancelEdit');

        const payload = { name, description, membersOnly };
        const uploadedFileIds = [];

        try {
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = 'Salvando...';
            }
            if (cancelButton) cancelButton.disabled = true;

            if (entries.length > 0) {
                const links = [];
                for (const entry of entries) {
                    if (entry.type === 'url' || entry.type === 'existing-file') {
                        links.push({ url: entry.url, format: entry.format });
                        continue;
                    }

                    const file = entry.file;
                    if (!Boolean(globalDownloadUploadsEnabled)) {
                        throw new Error('Essa opção está indisponivel no momento');
                    }
                    if (!Boolean(globalDownloadUploadsEnabled)) {
                        throw new Error('Essa opção está indisponivel no momento');
                    }
                    if (Number(file?.size || 0) > MAX_DOWNLOAD_FILE_BYTES) {
                        throw new Error('Arquivo muito grande. Limite de 500MB para uploads de download.');
                    }

                    const inferredFormat = inferCompactFormatFromFilename(file?.name || '');
                    if (inferredFormat === 'outro') {
                        throw new Error('Esse tipo de arquivo não é suportado para upload de download.');
                    }

                    const uploadResponse = await AuthAPI.uploadDownloadFile(file);
                    if (!uploadResponse?.success || !uploadResponse?.file?.url) {
                        throw new Error(uploadResponse?.message || 'Erro ao enviar arquivo.');
                    }

                    const uploaded = uploadResponse.file;
                    if (uploaded.uploadId) uploadedFileIds.push(uploaded.uploadId);
                    links.push({
                        url: String(uploaded.url),
                        format: normalizeDownloadLinkFormat(entry.format || uploaded.format || 'auto')
                    });
                }

                payload.links = links;
            }

            if (adultToggle) {
                payload.isAdult = adultToggle.checked === true;
            }

            const response = await AuthAPI.updateDownload(download.id, payload);
            if (response.success) {
                uploadedFileIds.length = 0;
                showNotification('Download atualizado com sucesso!', 'success');
                modal.remove();
                loadDownloads();
            } else {
                await cleanupUnattachedR2Uploads(uploadedFileIds);
                showNotification(response.message || 'Erro ao atualizar download', 'error');
            }
        } catch (error) {
            await cleanupUnattachedR2Uploads(uploadedFileIds);
            showNotification(error?.message || 'Erro ao atualizar download', 'error');
        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'Salvar';
            }
            if (cancelButton) cancelButton.disabled = false;
        }
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function updateAddLinkButtonState() {
    const container = document.getElementById('linksContainer');
    const addLinkBtn = document.getElementById('btnAddLink');
    const limitHint = document.getElementById('postLinksLimitHint');
    if (!container || !addLinkBtn) return;

    const linkCount = container.querySelectorAll('.download-link-row').length;
    const maxReached = linkCount >= MAX_DOWNLOAD_LINKS;

    addLinkBtn.disabled = maxReached;
    addLinkBtn.classList.toggle('is-maxed', maxReached);
    addLinkBtn.style.opacity = maxReached ? '0.65' : '1';
    addLinkBtn.style.cursor = maxReached ? 'not-allowed' : 'pointer';
    addLinkBtn.title = '';
    if (limitHint) {
        limitHint.textContent = `Máximo de ${MAX_DOWNLOAD_LINKS} links por postagem.`;
        limitHint.hidden = !maxReached;
    }
}

// Adicionar botão de adicionar link
document.getElementById('btnAddLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    const container = document.getElementById('linksContainer');
    if (!container) return;

    const linkCount = container.querySelectorAll('.download-link-row').length;
    if (linkCount >= MAX_DOWNLOAD_LINKS) {
        updateAddLinkButtonState();
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildPostLinkRowHtml(true).trim();
    const appendedRow = wrapper.firstElementChild;
    if (!appendedRow) return;
    container.appendChild(appendedRow);
    bindPostLinkRow(appendedRow);

    // Evento para remover link
    appendedRow.querySelector('.btnRemoveLink')?.addEventListener('click', (event) => {
        event.preventDefault();
        appendedRow.remove();
        updateAddLinkButtonState();
    });

    updateAddLinkButtonState();
});

// Fechar mini perfil
document.getElementById('closeMiniProfileModal')?.addEventListener('click', () => {
    document.getElementById('miniProfileModal').style.display = 'none';
});

// Mostrar mensagem de erro no modal
function showErrorMessage(message) {
    const errorDiv = document.getElementById('postErrorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Mostrar notificação toast
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function showThemedConfirm({
    title = 'Confirmar ação',
    message = 'Tem certeza?',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar'
} = {}) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.78);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10050;
            padding: 20px;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            width: 100%;
            max-width: 420px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid rgba(236, 72, 153, 0.8);
            border-radius: 12px;
            padding: 20px;
            color: #EDE9FE;
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5), 0 0 22px rgba(236, 72, 153, 0.25);
        `;

        content.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #F9A8D4; font-size: 18px; font-weight: 700;">${escapeHtml(String(title || 'Confirmar ação'))}</h3>
            <p style="margin: 0 0 18px 0; color: rgba(237,233,254,0.92); line-height: 1.45;">${escapeHtml(String(message || 'Tem certeza?'))}</p>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" data-confirm-action="cancel" style="padding: 9px 14px; border-radius: 8px; border: 1px solid rgba(139,92,246,0.75); background: rgba(139,92,246,0.16); color: #E9D5FF; font-weight: 700; cursor: pointer;">
                    ${escapeHtml(String(cancelText || 'Cancelar'))}
                </button>
                <button type="button" data-confirm-action="confirm" style="padding: 9px 14px; border-radius: 8px; border: 1px solid rgba(236,72,153,0.85); background: linear-gradient(135deg, #EC4899, #6B46C1); color: white; font-weight: 700; cursor: pointer;">
                    ${escapeHtml(String(confirmText || 'Confirmar'))}
                </button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        const confirmBtn = content.querySelector('[data-confirm-action="confirm"]');
        const cancelBtn = content.querySelector('[data-confirm-action="cancel"]');

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                finish(false);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                finish(true);
            }
        };

        const finish = (result) => {
            document.removeEventListener('keydown', onKeyDown);
            modal.remove();
            resolve(Boolean(result));
        };

        document.addEventListener('keydown', onKeyDown);
        confirmBtn?.addEventListener('click', () => finish(true));
        cancelBtn?.addEventListener('click', () => finish(false));
        modal.addEventListener('click', (event) => {
            if (event.target === modal) finish(false);
        });

        confirmBtn?.focus();
    });
}

async function showAdultContentRulesNotice() {
    await showThemedConfirm({
        title: 'Aviso de Regras +18',
        message: ADULT_CONTENT_RULES_MESSAGE,
        confirmText: 'Entendi',
        cancelText: 'Fechar'
    });
}

async function refreshNavbarNotificationBadgeAfterAchievement() {
    try {
        if (window.NavbarManager && typeof window.NavbarManager.updateNotificationBadge === 'function') {
            await window.NavbarManager.updateNotificationBadge();
            return;
        }
    } catch (error) {
        console.error('Erro ao atualizar badge de notificações:', error);
    }

    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    const currentCount = Number.parseInt(String(badge.textContent || '0'), 10);
    const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;
    badge.textContent = String(nextCount);
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
}

// Debounce para evitar re-render múltiplo enquanto digita (evita perda de foco)
let searchDebounceTimer = null;
function debouncedFilterAndRender() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => filterAndRender(), 300);
}

// Event listeners para busca e ordenação
document.getElementById('searchInput')?.addEventListener('input', debouncedFilterAndRender);
document.getElementById('sortSelect')?.addEventListener('change', filterAndRender);

// Inicializar página
// Enviar novo download
async function submitDownload() {
    const name = document.getElementById('downloadName').value.trim();
    const description = document.getElementById('downloadDesc').value;
    const isAdult = document.getElementById('downloadIsAdult')?.checked === true;
    const membersOnly = document.getElementById('downloadMembersOnly')?.checked === true;
    const entries = getPostLinksEntries();
    const errorDiv = document.getElementById('postErrorMessage');

    if (errorDiv) errorDiv.style.display = 'none';

    if (!name || entries.length === 0) {
        errorDiv.textContent = 'Nome e pelo menos um link/arquivo são obrigatórios!';
        errorDiv.style.display = 'block';
        return;
    }

    if (entries.length > MAX_DOWNLOAD_LINKS) {
        errorDiv.textContent = `Máximo de ${MAX_DOWNLOAD_LINKS} links/arquivos permitidos!`;
        errorDiv.style.display = 'block';
        return;
    }

    const uploadedFileIds = [];
    try {
        const links = [];
        for (const entry of entries) {
            if (entry.type === 'url') {
                links.push({ url: entry.url, format: entry.format });
                continue;
            }

            const file = entry.file;
            if (Number(file?.size || 0) > MAX_DOWNLOAD_FILE_BYTES) {
                throw new Error('Arquivo muito grande. Limite de 500MB para uploads de download.');
            }
            const inferredFormat = inferCompactFormatFromFilename(file?.name || '');
            if (inferredFormat === 'outro') {
                throw new Error('Esse tipo de arquivo não é suportado para upload de download.');
            }

            const uploadResponse = await AuthAPI.uploadDownloadFile(file);
            if (!uploadResponse?.success || !uploadResponse?.file?.url) {
                throw new Error(uploadResponse?.message || 'Erro ao enviar arquivo.');
            }

            const uploaded = uploadResponse.file;
            if (uploaded.uploadId) uploadedFileIds.push(uploaded.uploadId);
            links.push({
                url: String(uploaded.url),
                format: normalizeDownloadLinkFormat(entry.format || uploaded.format || 'auto')
            });
        }

        const response = await AuthAPI.createDownload(name, description, { links, isAdult, membersOnly });

        if (response.success) {
            uploadedFileIds.length = 0;
            showNotification('Download postado com sucesso!', 'success');
            if (Array.isArray(response.gainedPostAchievementRanks) && response.gainedPostAchievementRanks.length > 0) {
                await refreshNavbarNotificationBadgeAfterAchievement();
            }
            
            // Limpar formulário
            document.getElementById('postDownloadForm').reset();
            closePostDownloadModal();
            resetPostLinksUi();
            updateAddLinkButtonState();
            
            // Recarregar downloads
            await loadDownloads();
        } else {
            await cleanupUnattachedR2Uploads(uploadedFileIds);
            errorDiv.textContent = response.message || 'Erro ao postar download';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        await cleanupUnattachedR2Uploads(uploadedFileIds);
        console.error('Erro ao postar download:', error);
        errorDiv.textContent = error?.message ? String(error.message) : 'Erro ao conectar ao servidor';
        errorDiv.style.display = 'block';
    }
}

// Renderizar reações de um comentário
function renderCommentReactions(comment, reactionsContainer, downloadId) {
    if (!reactionsContainer || !comment) return;
    
    // Limpar container
    reactionsContainer.innerHTML = '';
    
    // Se não há reações, deixar container vazio
    const reactions = comment.reactions || [];
    if (reactions.length === 0) {
        return;
    }
    
    // Renderizar cada emoji com seu contador
    reactions.forEach((reaction) => {
        const emoji = String(reaction.emoji || reaction);
        const count = Number(reaction.count || reaction.userCount || 1);
        const hasUserReacted = Boolean(reaction.userReacted || reaction.hasUserReacted);
        
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'comment-reaction-badge';
        badge.dataset.commentId = comment.id;
        badge.dataset.emoji = emoji;
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 12px;
            border: 1px solid ${hasUserReacted ? '#EC4899' : 'rgba(107,70,193,0.5)'};
            background: ${hasUserReacted ? 'rgba(236,72,153,0.15)' : 'rgba(107,70,193,0.1)'};
            color: #FCD34D;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s;
        `;
        badge.innerHTML = `
            <span style="font-size: 14px;">${emoji}</span>
            <span>${count}</span>
        `;
        
        badge.addEventListener('click', async () => {
            if (!currentUser) {
                showNotification('Você deve estar logado para reagir', 'error');
                return;
            }
            // Ao clicar, toggle a reação
            await addReactionToComment(comment.id, emoji, downloadId);
        });
        
        badge.addEventListener('mouseenter', () => {
            badge.style.transform = 'scale(1.05)';
            badge.style.boxShadow = '0 0 8px rgba(236,72,153,0.3)';
        });
        
        badge.addEventListener('mouseleave', () => {
            badge.style.transform = 'scale(1)';
            badge.style.boxShadow = 'none';
        });
        
        reactionsContainer.appendChild(badge);
    });
}
// Obter emojis mais usados do localStorage
function getMostUsedEmojis(limit = 8) {
    try {
        const stored = localStorage.getItem('reactionEmojisUsed') || '{}';
        const used = JSON.parse(stored);
        return Object.entries(used)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([emoji]) => emoji);
    } catch (e) {
        return [];
    }
}

// Adicionar emoji aos mais usados
function addEmojiToUsed(emoji) {
    try {
        const stored = localStorage.getItem('reactionEmojisUsed') || '{}';
        const used = JSON.parse(stored);
        used[emoji] = (used[emoji] || 0) + 1;
        localStorage.setItem('reactionEmojisUsed', JSON.stringify(used));
    } catch (e) {
        console.error('Erro ao salvar emoji usado:', e);
    }
}

function openCommentReactionPicker(onSelectEmoji) {
    const categories = COMMENT_EMOJI_CATEGORIES;
    const initialCategoryId = categories[0]?.id || 'faces';

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10050;
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
        width: min(92vw, 480px);
        max-height: 70vh;
        background: linear-gradient(135deg, #161a36 0%, #121b3f 100%);
        border: 2px solid #6B46C1;
        border-radius: 12px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.4);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    `;

    const mostUsedEmojis = getMostUsedEmojis(8);
    const mostUsedHtml = mostUsedEmojis.length > 0 ? `
        <div style="padding: 10px 14px; border-bottom: 1px solid rgba(107,70,193,0.4);">
            <p style="margin: 0 0 8px 0; color: #F9A8D4; font-size: 12px; font-weight: 600;">Mais Usados Recentemente</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap: 8px;">
                ${mostUsedEmojis.map((emoji) => `
                    <button type="button" class="btn-pick-reaction-emoji" data-emoji="${escapeHtml(emoji)}" style="
                        width:48px;
                        height:48px;
                        border-radius:8px;
                        border:2px solid #EC4899;
                        background: rgba(236,72,153,0.15);
                        color:#fff;
                        cursor:pointer;
                        font-size:28px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        transition: all 0.2s;
                    ">${emoji}</button>
                `).join('')}
            </div>
        </div>
    ` : '';

    panel.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; padding: 12px 14px; border-bottom:1px solid rgba(107,70,193,0.55);">
            <strong style="color:#EC4899; font-size:15px;">Escolher Reação</strong>
            <button type="button" id="closeReactionPicker" style="background:transparent; color:#F9FAFB; border:1px solid rgba(236,72,153,0.5); border-radius:6px; padding:4px 10px; cursor:pointer;">Fechar</button>
        </div>
        <div style="padding: 10px 14px; border-bottom:1px solid rgba(107,70,193,0.4);">
            <input id="reactionSearchInput" type="text" placeholder="Buscar emoji..." style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid #6B46C1; background:rgba(0,0,0,0.28); color:#fff;">
        </div>
        ${mostUsedHtml}
        <div id="reactionCategoryTabs" style="display:flex; flex-wrap:wrap; gap:6px; padding: 10px 12px; border-bottom:1px solid rgba(107,70,193,0.4);"></div>
        <div id="reactionCategoryGrid" style="padding: 12px; overflow-y:auto; min-height: 220px;"></div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const tabsWrap = panel.querySelector('#reactionCategoryTabs');
    const gridWrap = panel.querySelector('#reactionCategoryGrid');
    const searchInput = panel.querySelector('#reactionSearchInput');

    let activeCategoryId = initialCategoryId;
    let searchTerm = '';

    const renderTabs = () => {
        tabsWrap.innerHTML = categories.map((category) => {
            const isActive = category.id === activeCategoryId;
            return `
                <button type="button" class="btn-reaction-category" data-category-id="${category.id}" style="
                    padding: 6px 10px;
                    border-radius: 7px;
                    border: 1px solid ${isActive ? '#EC4899' : 'rgba(107,70,193,0.6)'};
                    color: ${isActive ? '#fff' : '#c7d2fe'};
                    background: ${isActive ? 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)' : 'rgba(0,0,0,0.25)'};
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                ">${escapeHtml(category.label)}</button>
            `;
        }).join('');
    };

    const renderGrid = () => {
        const category = categories.find((item) => item.id === activeCategoryId) || categories[0];
        const all = category?.emojis || COMMENT_EMOJI_FALLBACK;
        const filtered = searchTerm
            ? all.filter((emoji) => emoji.includes(searchTerm))
            : all;

        if (filtered.length === 0) {
            gridWrap.innerHTML = '<p style="margin:0; color:#94a3b8; font-size:13px;">Nenhum emoji encontrado.</p>';
            return;
        }

        gridWrap.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap:8px;">
                ${filtered.map((emoji) => `
                    <button type="button" class="btn-pick-reaction-emoji" data-emoji="${escapeHtml(emoji)}" style="
                        width:48px;
                        height:48px;
                        border-radius:8px;
                        border:1px solid rgba(107,70,193,0.65);
                        background: rgba(0,0,0,0.3);
                        color:#fff;
                        cursor:pointer;
                        font-size:28px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        transition: all 0.2s;
                    ">${emoji}</button>
                `).join('')}
            </div>
        `;
    };

    const closeModal = () => {
        overlay.remove();
    };

    renderTabs();
    renderGrid();

    tabsWrap.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('.btn-reaction-category') : null;
        if (!target) return;
        activeCategoryId = String(target.getAttribute('data-category-id') || initialCategoryId);
        renderTabs();
        renderGrid();
    });

    searchInput?.addEventListener('input', () => {
        searchTerm = String(searchInput.value || '').trim();
        renderGrid();
    });

    panel.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const pickBtn = target.closest('.btn-pick-reaction-emoji');
        if (!pickBtn) return;
        const pickedEmoji = String(pickBtn.getAttribute('data-emoji') || '');
        if (!pickedEmoji) return;
        addEmojiToUsed(pickedEmoji);
        if (typeof onSelectEmoji === 'function') {
            onSelectEmoji(pickedEmoji);
        }
        closeModal();
    });

    panel.querySelector('#closeReactionPicker')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeModal();
    });
}

// Adicionar reação a comentário
async function addReactionToComment(commentId, emoji, downloadId) {
    if (!currentUser) {
        showNotification('Você deve estar logado para reagir', 'error');
        return;
    }

    if (!commentId || !emoji) {
        showNotification('Erro ao processar reação', 'error');
        return;
    }

    try {
        const response = await AuthAPI.addCommentReaction(commentId, emoji);
        
        if (response.success) {
            showNotification('Reação adicionada!', 'success');
            
            // Buscar apenas os comentários atualizados
            if (downloadId) {
                const commentsResponse = await AuthAPI.getDownloadComments(downloadId);
                if (commentsResponse.success && commentsResponse.comments) {
                    // Encontrar o comentário atualizado
                    const updatedComment = commentsResponse.comments.find(c => String(c.id) === String(commentId));
                    if (updatedComment) {
                        // Atualizar apenas as reações deste comentário
                        const reactionsContainer = document.querySelector(`#reactions-${commentId}`);
                        if (reactionsContainer) {
                            renderCommentReactions(updatedComment, reactionsContainer, downloadId);
                        }
                    }
                }
            }
        } else {
            showNotification(response.message || 'Erro ao adicionar reação', 'error');
        }
    } catch (error) {
        console.error('Erro ao adicionar reação:', error);
        showNotification('Erro ao processar reação', 'error');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Injetar animação CSS para reações de comentários
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes reaction-pulse {
            0% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.7);
            }
            50% {
                transform: scale(1.15);
                box-shadow: 0 0 0 6px rgba(236, 72, 153, 0.3);
            }
            100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(236, 72, 153, 0);
            }
        }
        
        .reaction-pulse {
            animation: reaction-pulse 2s infinite !important;
        }
    `;
    document.head.appendChild(styleSheet);

    setupFormatHelpTooltip();
    setupPostAdvancedOptionsToggle();
    syncAdultPostOptionVisibility();
    await loadCurrentUser();
    await loadGlobalDownloadUploadsSetting();
    syncFavoritesToggleButton();
    syncPostButtonAvailability();
    await loadDownloads();
    await loadSuspendedPostsUser();
    handleNotificationDeepLink();
    updateAddLinkButtonState();
    document.querySelectorAll('#linksContainer .download-link-row').forEach(bindPostLinkRow);

    const postButton = document.getElementById('btnPostDownload');
    const closePostFormButton = document.getElementById('closeBtnPostForm');
    const postModal = document.getElementById('postDownloadModal');

    postButton?.addEventListener('click', () => {
        if (!userCanPost) {
            if (currentUser && !currentUser.emailVerified) {
                localStorage.setItem('openProfileAccountSettings', '1');
                window.location.href = 'profile.html';
                return;
            }
        }
        openPostDownloadModal();
    });

    closePostFormButton?.addEventListener('click', () => {
        closePostDownloadModal();
    });

    // Não fechar ao clicar fora do conteúdo (fechar apenas no X).
    
    // Configurar formulário de postagem
    const postDownloadForm = document.getElementById('postDownloadForm');
    if (postDownloadForm) {
        postDownloadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitDownload();
        });
    }

    window.addEventListener('resize', () => {
        const grid = document.getElementById('downloads');
        if (grid) {
            syncDescriptionOverflowState(grid);
        }
    });

    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
        document.fonts.ready.then(() => {
            const grid = document.getElementById('downloads');
            if (grid) {
                syncDescriptionOverflowState(grid);
            }
        }).catch(() => {});
    }
    
    // Atualizacao de notifica\u00e7\u00f5es feita globalmente no auth-manager.js
});

// Fallback antigo: formulario inline (mantido apenas para referencia)
function showCommentInlineForm(downloadId) {
    const card = document.querySelector(`.download-card[data-id="${downloadId}"]`);
    if (!card) return;
    
    // Verificar se já existe um formulário aberto
    let commentForm = card.querySelector('.comment-form-inline');
    if (commentForm) {
        commentForm.remove();
        return;
    }
    
    // Criar e inserir formulário inline
    const formHTML = `
        <div class="comment-form-inline" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;">
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <textarea id="commentInput-${downloadId}" placeholder="Digite seu comentário..." maxlength="500" style="flex: 1; padding: 10px; border: 1px solid #6B46C1; border-radius: 5px; background: rgba(0,0,0,0.3); color: white; font-family: inherit; resize: vertical; min-height: 60px;"></textarea>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn-cancel-comment" data-id="${downloadId}" style="padding: 8px 16px; border: 1px solid #666; border-radius: 5px; background: transparent; color: #999; cursor: pointer; font-weight: 600;">Cancelar</button>
                <button class="btn-submit-comment" data-id="${downloadId}" style="padding: 8px 16px; background: linear-gradient(135deg, #EC4899, #6B46C1); border: none; border-radius: 5px; color: white; cursor: pointer; font-weight: 600;">Comentar</button>
            </div>
        </div>
    `;
    
    // Inserir depois das reações
    const reactionsDiv = card.querySelector('.download-reactions');
    if (reactionsDiv) {
        reactionsDiv.insertAdjacentHTML('afterend', formHTML);
        
        // Adicionar eventos
        const submitBtn = card.querySelector('.btn-submit-comment');
        const cancelBtn = card.querySelector('.btn-cancel-comment');
        
        if (submitBtn) {
            submitBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const textarea = card.querySelector(`#commentInput-${downloadId}`);
                const content = textarea.value.trim();
                
                if (content.length === 0) {
                    showNotification('Comentário vazio. Digite algo ou envie um anexo.', 'error');
                    return;
                }
                
                if (content.length > 500) {
                    showNotification('Comentário muito longo (máximo 500 caracteres)', 'error');
                    return;
                }
                
                await submitInlineComment(downloadId, content);
                card.querySelector('.comment-form-inline').remove();
                // Atualizar contagem de comentários
                await loadDownloads();
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                card.querySelector('.comment-form-inline').remove();
            });
        }
        
        // Focus na textarea
        const textarea = card.querySelector(`#commentInput-${downloadId}`);
        if (textarea) {
            setTimeout(() => textarea.focus(), 0);
        }
    }
}

// Enviar comentario inline (fallback antigo)
async function submitInlineComment(downloadId, content) {
    const response = await AuthAPI.addDownloadComment(downloadId, content);
    
    if (response.success) {
        showNotification('Comentário adicionado com sucesso!', 'success');
        // Recarregar a página de downloads para atualizar contadores
        await loadDownloads();
    } else {
        showNotification(response.message || 'Erro ao adicionar comentário', 'error');
    }
}

// Mostrar mini perfil do usuário
async function showUserMiniProfile(userId) {
    try {
        // Buscar informaeees do usuário
        const response = await AuthAPI.getUserMiniProfile(userId);
        
        if (!response.success || !response.profile) {
            showNotification('Erro ao carregar perfil do usuário', 'error');
            return;
        }

        const profile = response.profile;
        
        // Criar modal com perfil
        const modal = document.createElement('div');
        modal.id = 'miniProfileModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10002;
        `;
        
        const content = document.createElement('div');
        const canUseAnimatedProfile = Boolean(profile.canUseAnimatedProfile) && Boolean(profile.animatedMiniProfileEnabled ?? profile.animatedProfileEnabled);
        const miniCardConfig = canUseAnimatedProfile
            ? buildAnimatedCardConfig(
                `mini-${userId || 0}`,
                profile.animatedProfileTheme,
                profile.animatedProfileVisualMode,
                profile.animatedProfileGifUrl,
                profile.animatedProfileGiphyId
            )
            : { className: '', inlineStyle: '', embedHtml: '' };
        content.className = `mini-profile-card${miniCardConfig.className ? ` ${miniCardConfig.className}` : ''}`;
        if (miniCardConfig.inlineStyle) {
            content.style.cssText = miniCardConfig.inlineStyle;
        }
        
        const miniRanks = [];
        const FIXED_AUTO_RANK_KEY = 'fixed:auto';
        const addMiniRank = (rank) => {
            if (!rank || !rank.name) return;
            const key = String(rank.name).trim().toLowerCase();
            if (!key) return;
            if (miniRanks.some(item => String(item.name).trim().toLowerCase() === key)) return;
            miniRanks.push(rank);
        };

        const hasOrderedDisplayRanks = Array.isArray(profile.displayRanks);

        // Definir safeCustomTitle ANTES de usar em ranksHTML
        const safeNickname = escapeHtml(String(profile.nickname || '').replace(/^@+/, '') || 'usuario');
        const safeFullName = escapeHtml(`${String(profile.firstName || '').trim()} ${String(profile.lastName || '').trim()}`.trim() || 'Usuário');
        const safeCustomTitle = profile.customTitle ? escapeHtml(String(profile.customTitle).trim()) : null;
        const safeCustomTitleSubtitle = profile.customTitleSubtitle ? escapeHtml(String(profile.customTitleSubtitle).trim()) : '';

        if (hasOrderedDisplayRanks) {
            profile.displayRanks.forEach(addMiniRank);
        } else {
            if (profile.currentRank) {
                addMiniRank(profile.currentRank);
            }
            if (profile.autoRank) {
                addMiniRank(profile.autoRank);
            }
            if (Array.isArray(profile.selectedRanks)) {
                profile.selectedRanks.forEach(addMiniRank);
            }
        }

        // REMOVER "Admin User" e "Admin" e "Founder" da lista
        let filteredMiniRanks = miniRanks.filter(rank => {
            if (isHiddenProfileRank(rank)) return false;
            const rankNameLower = String(rank.name || '').trim().toLowerCase();
            return rankNameLower !== 'admin user' && rankNameLower !== 'admin' && rankNameLower !== 'founder';
        });

        const rawShowFullName = profile.showFullNameInMiniProfile;
        const showFullNameInMiniProfile = rawShowFullName === undefined
            ? true
            : (rawShowFullName === true || rawShowFullName === 1 || rawShowFullName === '1' || rawShowFullName === 'true');
        
        // Não mostrar nome completo se for "Admin User"
        const isAdminUserProfile = safeFullName.toLowerCase().trim() === 'admin user';
        const shouldShowFullName = showFullNameInMiniProfile && !isAdminUserProfile;
        const safeBio = escapeHtml(String(profile.bio || '').trim());
        const miniProfileAvatarHtml = renderDownloadAvatarMarkup({
            avatar: profile.avatar,
            nickname: profile.nickname,
            userId: profile.id || userId,
            size: 80,
            accentColor: '#EC4899',
            extraClasses: 'mini-profile-avatar',
            avatarScale: null,
            avatarOffsetX: null,
            avatarOffsetY: null
        });
        const miniTaglineHtml = formatProfileTaglineHtml(profile.profileTagline || '');
        
        // Mostrar ranks normalmente (sempre)
        const ranksHTML = filteredMiniRanks.length > 0
            ? `
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; justify-content: center;">
                    ${filteredMiniRanks.map((rank) => {
                        const subtitle = resolveRankSubtitle(rank);
                        const subtitleAttr = subtitle ? ` data-rank-subtitle="${escapeHtml(subtitle)}"` : '';
                        return `
                        <div class="download-rank-badge" data-rank-has-subtitle="${subtitle ? '1' : '0'}"${subtitleAttr} style="background: ${(rank.color || '#6B46C1')}20; color: ${rank.color || '#6B46C1'}; padding: 8px 12px; border-radius: 5px; border: 1px solid ${(rank.color || '#6B46C1')}40; font-weight: 600;">
                            ${escapeHtml(rank.name)}
                        </div>
                        `;
                    }).join('')}
                </div>
            `
            : '<p style="margin: 10px 0 15px; font-size: 12px; color: #999;">Sem conquista</p>';
        
        content.innerHTML = `
            ${miniCardConfig.embedHtml || ''}
            <div style="text-align: center;">
                <div style="position: relative; width: 100%; max-width: 160px; aspect-ratio: 1 / 1; margin: 0 auto 10px; border-radius: 50%; overflow: hidden; border: 3px solid #EC4899;">
                    ${miniProfileAvatarHtml}
                </div>
                <h3 style="margin: 10px 0; color: #EC4899; text-shadow: 0 0 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,0.8);">@${safeNickname}</h3>
                ${shouldShowFullName ? `<p style="margin: 5px 0; font-size: 14px; color: #ccc; text-shadow: 0 0 6px rgba(0,0,0,0.9), 1px 1px 3px rgba(0,0,0,0.8);">${safeFullName}</p>` : ''}
                ${safeCustomTitle ? `<p class="custom-title-tooltip" style="margin: 5px 0; font-size: 14px; color: #F472B6; font-weight: 600; cursor: pointer; text-shadow: 0 0 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,0.8);" data-custom-title-subtitle="${safeCustomTitleSubtitle}">${safeCustomTitle}</p>` : ''}
                
                <div class="mini-profile-tagline" style="text-shadow: 0 0 6px rgba(0,0,0,0.9), 1px 1px 2px rgba(0,0,0,0.8);">${miniTaglineHtml}</div>
                
                ${safeBio ? `<p style="margin: 10px 0; font-size: 13px; color: #aaa; font-style: italic; text-shadow: 0 0 6px rgba(0,0,0,0.9), 1px 1px 2px rgba(0,0,0,0.8);">"${safeBio}"</p>` : ''}
                
                ${ranksHTML}
                
                ${profile.stats ? `
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(236, 72, 153, 0.2);">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div style="background: rgba(236, 72, 153, 0.1); padding: 10px; border-radius: 5px;">
                                <div style="font-size: 18px; font-weight: bold; color: #EC4899; text-shadow: 0 0 6px rgba(0,0,0,0.9);">${profile.stats.postCount || 0}</div>
                                <div style="font-size: 12px; color: #999; text-shadow: 0 0 4px rgba(0,0,0,0.8);">Postagens</div>
                            </div>
                            <div style="background: rgba(107, 70, 193, 0.1); padding: 10px; border-radius: 5px;">
                                <div style="font-size: 18px; font-weight: bold; color: #6B46C1; text-shadow: 0 0 6px rgba(0,0,0,0.9);">${profile.stats.totalLikes || 0}</div>
                                <div style="font-size: 12px; color: #999; text-shadow: 0 0 4px rgba(0,0,0,0.8);">Likes</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <button class="mini-profile-close-btn" onclick="document.getElementById('miniProfileModal').remove();" style="text-shadow: 0 0 4px rgba(0,0,0,0.7);">Fechar</button>
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);
        attachInteractiveCardEffects(modal);
        initRankBadgeTooltips(content);
        
        // Adicionar tooltip ao customTitle se existir
        const customTitleEl = content.querySelector('.custom-title-tooltip');
        if (customTitleEl) {
            customTitleEl.addEventListener('mouseenter', () => {
                const subtitle = String(customTitleEl.dataset.customTitleSubtitle || '').trim();
                if (subtitle) {
                    const tooltip = ensureRankSubtitleTooltipElement();
                    tooltip.textContent = subtitle;
                    tooltip.setAttribute('aria-hidden', 'false');
                    positionRankSubtitleTooltip(customTitleEl.getBoundingClientRect());
                    tooltip.style.opacity = '1';
                    tooltip.style.transform = 'translateY(0) scale(1)';
                }
            });
            
            customTitleEl.addEventListener('mousemove', () => {
                if (rankSubtitleTooltipEl && rankSubtitleTooltipEl.getAttribute('aria-hidden') === 'false') {
                    positionRankSubtitleTooltip(customTitleEl.getBoundingClientRect());
                }
            });
            
            customTitleEl.addEventListener('mouseleave', hideRankSubtitleTooltip);
        }
        
        // Adicionar zoom de avatar ao clicar
        setTimeout(() => {
            const avatarImg = content.querySelector('img.user-avatar');
            if (avatarImg && profile.avatar) {
                // Aplicar o zoom/posicionamento do avatar igual ao do perfil
                applyAvatarZoomTransform(avatarImg, profile.avatarScale, profile.avatarOffsetX, profile.avatarOffsetY);
            }
        }, 0);
        
        // Fechar ao clicar no fundo
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showNotification('Erro ao carregar perfil do usuário', 'error');
    }
}

// Fechar modais ao clicar fora
document.addEventListener('click', (e) => {
    const postModal = document.getElementById('postDownloadModal');
    const miniModal = document.getElementById('miniProfileModal');

    if (e.target === miniModal) {
        miniModal.style.display = 'none';
    }
});

function applyAvatarZoomTransform(imgElement, avatarScale, avatarOffsetX, avatarOffsetY) {
    if (!imgElement) return;
    const scale = Number(avatarScale) || 1;
    const offsetX = Number(avatarOffsetX) || 50;
    const offsetY = Number(avatarOffsetY) || 50;
    
    imgElement.style.position = 'absolute';
    imgElement.style.left = `${offsetX}%`;
    imgElement.style.top = `${offsetY}%`;
    imgElement.style.transform = `translate(-50%, -50%) scale(${scale})`;
    imgElement.style.transformOrigin = 'center';
    imgElement.style.width = '100%';
    imgElement.style.height = '100%';
    imgElement.style.objectFit = 'cover';
}

// Modal de Zoom de Avatar (Viewer Only - Dinâmico)
function openAvatarZoomViewer(avatarUrl, nickname = 'Usuário', initialScale = 1, initialOffsetX = 50, initialOffsetY = 50) {
    // Criar overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10070;
    `;

    // Criar modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        width: min(90vw, 500px);
        max-height: 80vh;
        overflow-y: auto;
        background: linear-gradient(135deg, #161a36 0%, #121b3f 100%);
        border: 2px solid #6B46C1;
        border-radius: 12px;
        padding: 20px;
        position: relative;
        box-shadow: 0 25px 60px rgba(0,0,0,0.5);
    `;

    modal.innerHTML = `
        <span class="close" id="closeZoom" style="
            cursor: pointer;
            font-size: 28px;
            color: #EC4899;
            position: absolute;
            right: 16px;
            top: 12px;
            font-weight: 300;
            user-select: none;
        ">&times;</span>

        <h2 style="
            color: #EC4899;
            text-align: center;
            margin: 0 0 16px 0;
            font-size: 18px;
        ">Zoom do Avatar</h2>

        <div style="
            position: relative;
            width: 100%;
            aspect-ratio: 1;
            max-width: 320px;
            margin: 0 auto 16px;
            border: 2px solid rgba(236,72,153,0.4);
            border-radius: 12px;
            overflow: hidden;
            background: rgba(0,0,0,0.4);
        ">
            <img id="zoomImg" alt="Avatar Zoom" style="
                position: absolute;
                width: 100%;
                height: 100%;
                object-fit: cover;
                cursor: grab;
                user-select: none;
                left: 50%;
                top: 50%;
            ">
            <div style="
                position: absolute;
                inset: 0;
                border-radius: 50%;
                border: 2px solid rgba(236, 72, 153, 0.3);
                pointer-events: none;
            "></div>
        </div>

        <div style="
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            margin-bottom: 12px;
        ">
            <label for="zoomSlider" style="
                color: #c7d2fe;
                font-size: 13px;
                font-weight: 600;
                white-space: nowrap;
            ">Zoom</label>
            <input type="range" id="zoomSlider" min="1" max="3" step="0.01" value="1" style="
                flex: 1;
                height: 6px;
                border-radius: 3px;
                background: linear-gradient(90deg, #EC4899 0%, #8B5CF6 100%);
                outline: none;
                accent-color: #EC4899;
            ">
            <span id="zoomPercent" style="
                color: #EC4899;
                font-size: 13px;
                font-weight: 600;
                min-width: 45px;
                text-align: right;
            ">100%</span>
        </div>

        <button id="resetBtn" style="
            width: 100%;
            padding: 8px 12px;
            border: 1px solid rgba(236,72,153,0.6);
            background: rgba(207, 74, 170, 0.15);
            color: #EC4899;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.2s;
            margin-bottom: 12px;
        ">Redefinir Zoom</button>

        <p style="
            text-align: center;
            color: #94a3b8;
            font-size: 12px;
            margin: 0;
        ">Arraste a imagem para ajustar o enquadramento. Use o zoom para ampliar (1x a 3x).</p>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Elementos
    const img = modal.querySelector('#zoomImg');
    const slider = modal.querySelector('#zoomSlider');
    const percentDisplay = modal.querySelector('#zoomPercent');
    const resetBtn = modal.querySelector('#resetBtn');
    const closeBtn = modal.querySelector('#closeZoom');

    // Estado com os valores iniciais passados
    let currentScale = Number(initialScale) || 1;
    let offsetX = Number(initialOffsetX) || 50;
    let offsetY = Number(initialOffsetY) || 50;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    // Funções
    const updateTransform = () => {
        img.style.left = `${offsetX}%`;
        img.style.top = `${offsetY}%`;
        img.style.transform = `translate(-50%, -50%) scale(${currentScale})`;
    };

    const updatePercent = () => {
        percentDisplay.textContent = `${Math.round(currentScale * 100)}%`;
    };

    // Carregar imagem
    img.src = escapeHtml(avatarUrl);

    // Aplicar transformações iniciais ao carregar
    img.onload = () => {
        updateTransform();
    };

    // Events
    slider.addEventListener('input', (e) => {
        currentScale = parseFloat(e.target.value);
        updateTransform();
        updatePercent();
    });

    img.addEventListener('mousedown', (e) => {
        if (currentScale <= 1) return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        img.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        offsetX += (deltaX / 150);
        offsetY += (deltaY / 150);
        offsetX = Math.max(0, Math.min(100, offsetX));
        offsetY = Math.max(0, Math.min(100, offsetY));
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        updateTransform();
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        img.style.cursor = 'grab';
    });

    resetBtn.addEventListener('click', () => {
        currentScale = 1;
        offsetX = 50;
        offsetY = 50;
        slider.value = '1';
        updateTransform();
        updatePercent();
    });

    const closeModal = () => {
        overlay.remove();
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Aplicar valores iniciais
    slider.value = String(currentScale);
    updatePercent();
    updateTransform();
}



