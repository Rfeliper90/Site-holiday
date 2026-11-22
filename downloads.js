import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import Download from '../models/Download.js';
import User from '../models/User.js';
import Rank from '../models/Rank.js';
import PostageRank from '../models/PostageRank.js';
import DownloadComment from '../models/DownloadComment.js';
import Notification from '../models/Notification.js';
import AchievementNotification from '../models/AchievementNotification.js';
import { protect } from '../middleware/auth.js';
import { commentRateLimiter, reactionRateLimiter, postRateLimiter } from '../middleware/rate-limit.js';
import { getJwtSecret } from '../config/jwt-secret.js';
import db from '../config/database.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POST_ACHIEVEMENT_RANKS = [
    { minPosts: 5, name: 'Autor de Bronze', color: '#CD7F32', icon: 'P5', description: 'Conquistado ao atingir 5 postagens' },
    { minPosts: 15, name: 'Autor de Prata', color: '#C0C0C0', icon: 'P15', description: 'Conquistado ao atingir 15 postagens' },
    { minPosts: 30, name: 'Autor de Ouro', color: '#FBBF24', icon: 'P30', description: 'Conquistado ao atingir 30 postagens' },
    { minPosts: 50, name: 'Autor de Platina', color: '#E5E4E2', icon: 'P50', description: 'Conquistado ao atingir 50 postagens' },
    { minPosts: 75, name: 'Autor Diamante', color: '#22D3EE', icon: 'P75', description: 'Conquistado ao atingir 75 postagens' },
    { minPosts: 105, name: 'Autor Elite', color: '#34D399', icon: 'P105', description: 'Conquistado ao atingir 105 postagens' },
    { minPosts: 140, name: 'Autor Supremo', color: '#F472B6', icon: 'P140', description: 'Conquistado ao atingir 140 postagens' },
    { minPosts: 180, name: 'Autor Lendario', color: '#FB7185', icon: 'P180', description: 'Conquistado ao atingir 180 postagens' },
    { minPosts: 235, name: 'Autor Mitico', color: '#C084FC', icon: 'P235', description: 'Conquistado ao atingir 235 postagens' },
    { minPosts: 300, name: 'Autor Imortal', color: '#F59E0B', icon: 'P300', description: 'Conquistado ao atingir 300 postagens' }
];
const POST_ACHIEVEMENT_GROUP = 'post_achievement';
const LIKE_ACHIEVEMENT_GROUP = 'like_achievement';
const FIXED_AUTO_RANK_KEY = 'fixed:auto';
const FIXED_MANUAL_RANK_KEY = 'fixed:manual';
const ALLOWED_FIXED_RANK_KEYS = new Set([FIXED_AUTO_RANK_KEY, FIXED_MANUAL_RANK_KEY]);
const PROGRESSION_RANK_SEQUENCE = [
    'membro inicial',
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
];
const PROGRESSION_RANK_ORDER = new Map(PROGRESSION_RANK_SEQUENCE.map((name, index) => [name, index]));
const LIKE_ACHIEVEMENT_RANKS = [
    { minLikes: 3, name: 'Reacao Inicial', color: '#38BDF8', icon: 'L3', description: 'Conquistado ao atingir 3 likes recebidos' },
    { minLikes: 8, name: 'Apreciado', color: '#60A5FA', icon: 'L8', description: 'Conquistado ao atingir 8 likes recebidos' },
    { minLikes: 15, name: 'Bem Curtido', color: '#818CF8', icon: 'L15', description: 'Conquistado ao atingir 15 likes recebidos' },
    { minLikes: 25, name: 'Em Alta', color: '#A78BFA', icon: 'L25', description: 'Conquistado ao atingir 25 likes recebidos' },
    { minLikes: 35, name: 'Popular', color: '#C084FC', icon: 'L35', description: 'Conquistado ao atingir 35 likes recebidos' },
    { minLikes: 50, name: 'Destaque', color: '#E879F9', icon: 'L50', description: 'Conquistado ao atingir 50 likes recebidos' },
    { minLikes: 70, name: 'Queridinho', color: '#F472B6', icon: 'L70', description: 'Conquistado ao atingir 70 likes recebidos' },
    { minLikes: 95, name: 'Influente', color: '#FB7185', icon: 'L95', description: 'Conquistado ao atingir 95 likes recebidos' },
    { minLikes: 125, name: 'Em Evidencia', color: '#F97316', icon: 'L125', description: 'Conquistado ao atingir 125 likes recebidos' },
    { minLikes: 160, name: 'Notavel', color: '#FB923C', icon: 'L160', description: 'Conquistado ao atingir 160 likes recebidos' },
    { minLikes: 200, name: 'Famoso', color: '#F59E0B', icon: 'L200', description: 'Conquistado ao atingir 200 likes recebidos' },
    { minLikes: 250, name: 'Viral', color: '#FACC15', icon: 'L250', description: 'Conquistado ao atingir 250 likes recebidos' },
    { minLikes: 320, name: 'Icone da Comunidade', color: '#A3E635', icon: 'L320', description: 'Conquistado ao atingir 320 likes recebidos' },
    { minLikes: 400, name: 'Fenomeno', color: '#4ADE80', icon: 'L400', description: 'Conquistado ao atingir 400 likes recebidos' },
    { minLikes: 500, name: 'Estrela da Guilda', color: '#22D3EE', icon: 'L500', description: 'Conquistado ao atingir 500 likes recebidos' },
    { minLikes: 620, name: 'Lenda dos Likes', color: '#06B6D4', icon: 'L620', description: 'Conquistado ao atingir 620 likes recebidos' },
    { minLikes: 740, name: 'Dominio Social', color: '#14B8A6', icon: 'L740', description: 'Conquistado ao atingir 740 likes recebidos' },
    { minLikes: 860, name: 'Aura Magnetica', color: '#10B981', icon: 'L860', description: 'Conquistado ao atingir 860 likes recebidos' },
    { minLikes: 930, name: 'Supremo dos Likes', color: '#84CC16', icon: 'L930', description: 'Conquistado ao atingir 930 likes recebidos' },
    { minLikes: 1000, name: 'Soberano dos Likes', color: '#EAB308', icon: 'L1000', description: 'Conquistado ao atingir 1000 likes recebidos' }
];
const MAX_DOWNLOAD_LINKS = 3;
const VALID_DOWNLOAD_LINK_FORMATS = new Set(['auto', 'apk', 'exe', 'msi', 'zip', 'rar', '7z', 'pdf', 'doc', 'xls', 'ppt', 'txt', 'jpg', 'png', 'gif', 'webp', 'svg', 'mp3', 'mp4', 'iso', 'software', 'site', 'outro']);
const ALLOWED_ANIMATED_PROFILE_THEMES = new Set([
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
]);
const LEGACY_GIF_THEMES = new Set([
    'theme-arvore-de-natal',
    'theme-coracao',
    'theme-cruz',
    'theme-diagonal',
    'theme-estante-neon',
    'theme-luzes-azuis',
    'theme-motion',
    'theme-ondas',
    'theme-nebulo',
    'theme-stilo'
]);
const ALLOWED_ANIMATED_VISUAL_MODES = new Set(['theme', 'gif']);
const COMMENT_ATTACHMENTS_DIR = path.join(__dirname, '../../uploads/comment-files');
const MAX_COMMENT_ATTACHMENT_BYTES = 500 * 1024 * 1024; // 500MB
const DOWNLOAD_FILES_DIR = path.join(__dirname, '../../uploads/download-files');
const MAX_DOWNLOAD_UPLOAD_BYTES = Number(process.env.MAX_DOWNLOAD_UPLOAD_BYTES) > 0
    ? Number(process.env.MAX_DOWNLOAD_UPLOAD_BYTES)
    : 500 * 1024 * 1024; // 500MB
const ALLOWED_DOWNLOAD_FILE_EXTS = new Set([
    '.apk', '.exe', '.msi', '.zip', '.rar', '.7z', '.war',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.mp3', '.mp4', '.iso'
]);
const ALLOWED_DOWNLOAD_FILE_MIMES = new Set([
    'application/vnd.android.package-archive',
    'application/java-archive',
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-dosexec',
    'application/x-msi',
    'application/octet-stream',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.rar',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'audio/mpeg',
    'video/mp4',
    'application/x-iso9660-image'
]);
const ALLOWED_COMMENT_ATTACHMENT_EXTS = new Set([
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
    '.pdf', '.txt', '.zip', '.rar', '.7z',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.json',
    '.apk', '.iso', '.exe', '.msi',
    '.mp4', '.mp3'
]);
const ALLOWED_COMMENT_ATTACHMENT_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
    'application/pdf', 'text/plain',
    'application/zip', 'application/x-zip-compressed',
    'application/vnd.rar', 'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv', 'application/json',
    'application/vnd.android.package-archive',
    'application/x-msdownload', 'application/x-msdos-program', 'application/x-dosexec',
    'application/x-msi', 'application/octet-stream',
    'application/x-iso9660-image',
    'video/mp4', 'audio/mpeg'
]);
const JWT_SECRET = getJwtSecret();

const commentAttachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(COMMENT_ATTACHMENTS_DIR, { recursive: true });
        cb(null, COMMENT_ATTACHMENTS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = String(path.extname(file.originalname || '')).toLowerCase();
        const safeExt = ext && ext.length <= 10 ? ext : '';
        cb(null, `comment-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    }
});

const commentAttachmentUpload = multer({
    storage: commentAttachmentStorage,
    limits: { fileSize: MAX_COMMENT_ATTACHMENT_BYTES },
    fileFilter: (req, file, cb) => {
        const ext = String(path.extname(file.originalname || '')).toLowerCase();
        const mime = String(file.mimetype || '').toLowerCase();
        const isAllowed = ALLOWED_COMMENT_ATTACHMENT_EXTS.has(ext) || ALLOWED_COMMENT_ATTACHMENT_MIMES.has(mime);
        if (isAllowed) return cb(null, true);
        cb(new Error('Anexo de comentário aceita apenas imagens, GIF, documentos, ZIP/RAR/7Z, APK, ISO, EXE, MSI, MP3 e MP4.'));
    }
});

const downloadFileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(DOWNLOAD_FILES_DIR, { recursive: true });
        cb(null, DOWNLOAD_FILES_DIR);
    },
    filename: (req, file, cb) => {
        const ext = String(path.extname(file.originalname || '')).toLowerCase();
        const safeExt = ALLOWED_DOWNLOAD_FILE_EXTS.has(ext) ? ext : '';
        cb(null, `download-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    }
});

const downloadFileUpload = multer({
    storage: downloadFileStorage,
    limits: { fileSize: MAX_DOWNLOAD_UPLOAD_BYTES },
    fileFilter: (req, file, cb) => {
        const ext = String(path.extname(file.originalname || '')).toLowerCase();
        const mime = String(file.mimetype || '').toLowerCase();
        const isAllowed = ALLOWED_DOWNLOAD_FILE_EXTS.has(ext) || ALLOWED_DOWNLOAD_FILE_MIMES.has(mime);
        if (isAllowed) return cb(null, true);
        cb(new Error('Tipo de arquivo não suportado para upload de download.'));
    }
});

const DOWNLOAD_UPLOAD_EXTENSION_FORMAT_MAP = {
    '.apk': 'apk',
    '.exe': 'exe',
    '.msi': 'msi',
    '.zip': 'zip',
    '.rar': 'rar',
    '.7z': '7z',
    '.war': 'software',
    '.pdf': 'pdf',
    '.doc': 'doc',
    '.docx': 'doc',
    '.xls': 'xls',
    '.xlsx': 'xls',
    '.ppt': 'ppt',
    '.pptx': 'ppt',
    '.txt': 'txt',
    '.jpg': 'jpg',
    '.jpeg': 'jpg',
    '.png': 'png',
    '.gif': 'gif',
    '.webp': 'webp',
    '.svg': 'svg',
    '.mp3': 'mp3',
    '.mp4': 'mp4',
    '.iso': 'iso'
};

function buildDownloadFilePayload(file, req) {
    if (!file) return null;
    const relativePath = `/uploads/download-files/${file.filename}`;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const absoluteUrl = new URL(relativePath, baseUrl).toString();
    const ext = String(path.extname(file.originalname || '')).toLowerCase();
    const inferredFormat = DOWNLOAD_UPLOAD_EXTENSION_FORMAT_MAP[ext] || 'outro';

    return {
        url: absoluteUrl,
        path: relativePath,
        originalName: String(file.originalname || '').trim() || file.filename,
        mime: String(file.mimetype || '').toLowerCase(),
        size: Number(file.size || 0),
        format: inferredFormat
    };
}

async function removeDownloadFileByPath(relativePath) {
    const relative = String(relativePath || '').trim();
    if (!relative) return;
    const filename = path.basename(relative);
    if (!filename) return;
    const target = path.join(DOWNLOAD_FILES_DIR, filename);
    try {
        await fsPromises.unlink(target);
    } catch {
        // arquivo pode já não existir
    }
}

function buildCommentAttachmentPayload(file) {
    if (!file) return null;
    return {
        path: `/uploads/comment-files/${file.filename}`,
        originalName: String(file.originalname || '').trim() || file.filename,
        mime: String(file.mimetype || '').toLowerCase(),
        size: Number(file.size || 0)
    };
}

async function removeCommentAttachmentFileByPath(attachmentPath) {
    const relative = String(attachmentPath || '').trim();
    if (!relative) return;
    const filename = path.basename(relative);
    if (!filename) return;
    const target = path.join(COMMENT_ATTACHMENTS_DIR, filename);
    try {
        await fsPromises.unlink(target);
    } catch {
        // arquivo pode já não existir
    }
}

function normalizeDownloadLinkFormat(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return VALID_DOWNLOAD_LINK_FORMATS.has(normalized) ? normalized : 'auto';
}

function normalizeBooleanInput(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const raw = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(raw)) return true;
        if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(raw)) return false;
    }
    return fallback;
}

function getAgeFromBirthDateIso(birthDateIso) {
    const raw = String(birthDateIso || '').trim();
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

function getOptionalAuthUserId(req) {
    const authHeader = String(req.headers?.authorization || '').trim();
    if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const id = Number(decoded?.id);
        return Number.isFinite(id) ? id : null;
    } catch {
        return null;
    }
}

async function getUserBanStatus(userId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT id, banType, suspensionDays, reason, createdAt, expiresAt 
            FROM bans 
            WHERE userId = ? AND isActive = 1
            LIMIT 1
        `, [userId], (err, ban) => {
            if (err) {
                console.error('Erro ao verificar banimento:', err);
                return resolve(null);
            }
            
            if (!ban) {
                return resolve(null);
            }
            
            // Verificar se suspensão expirou
            if (ban.banType === 'suspension' && ban.expiresAt) {
                const expiryDate = new Date(ban.expiresAt);
                if (new Date() > expiryDate) {
                    // Remover banimento expirado
                    db.run(`UPDATE bans SET isActive = 0 WHERE id = ?`, [ban.id], (err) => {
                        if (err) console.error('Erro ao remover ban expirado:', err);
                    });
                    return resolve(null);
                }
            }
            
            resolve(ban);
        });
    });
}

async function getViewerAdultContext(req) {
    const fallback = { userId: null, isAdult: false, showAdultPosts: false };
    const tokenUserId = getOptionalAuthUserId(req);
    if (!tokenUserId) return fallback;

    const row = await dbGet('SELECT id, birthDate, showAdultPosts FROM users WHERE id = ?', [tokenUserId]);
    if (!row) return fallback;

    const age = getAgeFromBirthDateIso(row.birthDate);
    return {
        userId: Number(row.id),
        isAdult: age >= 18,
        showAdultPosts: Number(row.showAdultPosts) === 1
    };
}

function applyAdultVisibilityForViewer(downloads, viewer) {
    const source = Array.isArray(downloads) ? downloads : [];
    const out = [];

    for (const item of source) {
        const isMembersOnlyPost = Number(item?.membersOnly) === 1 || item?.membersOnly === true;
        const isAdultPost = Number(item?.isAdult) === 1 || item?.isAdult === true;
        const isLoggedIn = Number.isFinite(Number(viewer?.userId)) && Number(viewer?.userId) > 0;
        const isOwner = isLoggedIn && Number(item?.userId) === Number(viewer?.userId);
        const isAdultViewer = Boolean(viewer?.isAdult);
        const canShowAdultPosts = Boolean(viewer?.showAdultPosts);

        if (isMembersOnlyPost && !isLoggedIn) {
            out.push({
                ...item,
                isAdult: isAdultPost ? 1 : 0,
                membersOnly: 1,
                isAdultLocked: false,
                membersOnlyLocked: true,
                adultCanActivate: false,
                name: 'Postagem',
                description: '',
                link: '',
                links_json: null,
                adultLockReason: 'Precisa estar logado para ver essa postagem.'
            });
            continue;
        }

        if (!isAdultPost) {
            out.push({
                ...item,
                isAdult: 0,
                membersOnly: isMembersOnlyPost ? 1 : 0,
                isAdultLocked: false,
                membersOnlyLocked: false,
                adultCanActivate: false
            });
            continue;
        }

        // Post adulto - aplicar filtros de visualização

        if (!isLoggedIn) {
            out.push({
                ...item,
                isAdult: 1,
                membersOnly: isMembersOnlyPost ? 1 : 0,
                isAdultLocked: true,
                membersOnlyLocked: false,
                adultCanActivate: false,
                name: 'Postagem',
                description: '',
                link: '',
                links_json: null,
                adultLockReason: 'Precisa estar logado para ver essa postagem.'
            });
            continue;
        }

        if (!isAdultViewer) {
            out.push({
                ...item,
                isAdult: 1,
                membersOnly: isMembersOnlyPost ? 1 : 0,
                isAdultLocked: true,
                membersOnlyLocked: false,
                adultCanActivate: false,
                name: 'Postagem',
                description: '',
                link: '',
                links_json: null,
                adultLockReason: 'Você não pode ver essa postagem.'
            });
            continue;
        }

        if (!canShowAdultPosts) {
            console.log(`[DEBUG] Post ${item?.id} bloqueado por showAdultPosts=false. Usuário: ${viewer?.userId}`);
            out.push({
                ...item,
                isAdult: 1,
                membersOnly: isMembersOnlyPost ? 1 : 0,
                isAdultLocked: true,
                membersOnlyLocked: false,
                adultCanActivate: true,
                name: 'Postagem',
                description: '',
                link: '',
                links_json: null,
                adultLockReason: 'Conteúdo +18 bloqueado. Clique em Ativar agora.'
            });
            continue;
        }

        if (isOwner) {
            out.push({
                ...item,
                isAdult: isAdultPost ? 1 : 0,
                membersOnly: isMembersOnlyPost ? 1 : 0,
                isAdultLocked: false,
                membersOnlyLocked: false,
                adultCanActivate: false
            });
            continue;
        }

        out.push({
            ...item,
            isAdult: 1,
            membersOnly: isMembersOnlyPost ? 1 : 0,
            isAdultLocked: false,
            membersOnlyLocked: false,
            adultCanActivate: false
        });
    }

    return out;
}

function getAdultAccessDecision(download, viewer) {
    const isMembersOnlyPost = Number(download?.membersOnly) === 1 || download?.membersOnly === true;
    const isAdultPost = Number(download?.isAdult) === 1 || download?.isAdult === true;
    const isLoggedIn = Number.isFinite(Number(viewer?.userId)) && Number(viewer?.userId) > 0;

    if (isMembersOnlyPost && !isLoggedIn) {
        return {
            allowed: false,
            message: 'Precisa estar logado para ver essa postagem.'
        };
    }

    if (!isAdultPost) {
        return { allowed: true };
    }

    if (!isLoggedIn) {
        return {
            allowed: false,
            message: 'Precisa estar logado para ver essa postagem.'
        };
    }

    if (!viewer?.isAdult) {
        return {
            allowed: false,
            message: 'Você não pode ver essa postagem.'
        };
    }

    if (!viewer?.showAdultPosts) {
        return {
            allowed: false,
            message: 'Conteúdo +18 bloqueado. Ative a visualização +18 no perfil.'
        };
    }

    return { allowed: true };
}

function normalizeAnimatedProfileTheme(value) {
    const raw = String(value || 'auto').trim();
    if (LEGACY_GIF_THEMES.has(raw)) return 'auto';
    return ALLOWED_ANIMATED_PROFILE_THEMES.has(raw) ? raw : 'auto';
}

function normalizeAnimatedProfileVisualMode(value) {
    const raw = String(value || 'theme').trim().toLowerCase();
    return ALLOWED_ANIMATED_VISUAL_MODES.has(raw) ? raw : 'theme';
}

function normalizeAnimatedGifUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.startsWith('/uploads/animated-gifs/')) return raw;
    try {
        const parsed = new URL(raw);
        const protocol = String(parsed.protocol || '').toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

function normalizeAnimatedProfileGiphyId(value) {
    const raw = String(value || '').trim();
    return /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : null;
}

function normalizeDownloadLinksPayload(rawLinks) {
    const source = Array.isArray(rawLinks) ? rawLinks : [rawLinks];
    const normalized = [];

    for (const item of source) {
        if (typeof item === 'string') {
            const url = item.trim();
            if (!url) continue;
            normalized.push({ url, format: 'auto' });
            continue;
        }

        if (item && typeof item === 'object') {
            const url = String(item.url || item.link || '').trim();
            if (!url) continue;
            normalized.push({
                url,
                format: normalizeDownloadLinkFormat(item.format)
            });
        }
    }

    return normalized.slice(0, MAX_DOWNLOAD_LINKS);
}

function normalizeRankOrderValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Number(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const asNumber = Number(trimmed);
        if (Number.isFinite(asNumber)) return asNumber;
        if (ALLOWED_FIXED_RANK_KEYS.has(trimmed)) return trimmed;
    }
    return null;
}

function normalizeRankOrderList(values) {
    const list = Array.isArray(values) ? values : [];
    const unique = [];
    const seen = new Set();

    for (const item of list) {
        const normalized = normalizeRankOrderValue(item);
        if (normalized === null) continue;
        const key = typeof normalized === 'number' ? `n:${normalized}` : `s:${normalized}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(normalized);
    }

    return unique;
}

async function getHighestOwnedProgressionRank(userId, fallbackRank = null) {
    const progressionRows = await dbAll(
        `SELECT
            cr.id,
            cr.name,
            COALESCE(NULLIF(TRIM(ucr.customColor), ''), cr.color) AS color,
            cr.description,
            cr.customText,
            cr.icon,
            cr.rankGroup,
            cr.isVisible,
            ucr.assignedAt
         FROM user_custom_ranks ucr
         JOIN custom_ranks cr ON cr.id = ucr.customRankId
         WHERE ucr.userId = ? AND cr.rankGroup = 'progression'`,
        [userId]
    );

    const rankedRows = (progressionRows || [])
        .map((row) => {
            const nameKey = String(row?.name || '').trim().toLowerCase();
            return {
                ...row,
                _progressionOrder: PROGRESSION_RANK_ORDER.has(nameKey)
                    ? Number(PROGRESSION_RANK_ORDER.get(nameKey))
                    : -1
            };
        })
        .filter((row) => row._progressionOrder >= 0 && String(row?.name || '').trim().toLowerCase() !== 'membro beta')
        .sort((a, b) => b._progressionOrder - a._progressionOrder || String(b.assignedAt || '').localeCompare(String(a.assignedAt || '')));

    if (rankedRows.length > 0) {
        const top = rankedRows[0];
        return {
            id: top.id,
            name: top.name,
            color: top.color,
            description: top.description || '',
            customText: top.customText || '',
            backgroundImage: null,
            isVisible: top.isVisible,
            rankGroup: 'progression',
            icon: top.icon || '',
            isFixed: true
        };
    }

    return fallbackRank || null;
}

async function buildFixedProfileRanks(userId, rankComplete, userHasBetaRank = false) {
    const fixedRanks = [];
    
    const autoDisplayRank = (rankComplete?.automatic || rankComplete?.automaticCompleted)
        ? {
            id: FIXED_AUTO_RANK_KEY,
            ...(rankComplete?.automatic || rankComplete?.automaticCompleted),
            description: (rankComplete?.automatic || rankComplete?.automaticCompleted)?.description || 'Conquista automática atual',
            customText: '',
            backgroundImage: null,
            isVisible: 0,
            rankGroup: 'fixed_automatic',
            isFixed: true
        }
        : await getHighestOwnedProgressionRank(userId, null);
    if (rankComplete?.custom) {
        fixedRanks.push({
            id: FIXED_MANUAL_RANK_KEY,
            name: rankComplete.custom.name,
            color: rankComplete.custom.color,
            description: rankComplete.custom.description || 'Conquista manual atual',
            customText: rankComplete.custom.customText || '',
            backgroundImage: null,
            isVisible: 0,
            rankGroup: 'fixed_manual',
            icon: rankComplete.custom.icon || '',
            isFixed: true
        });
    }
    
    // Incluir a progressão atual, inclusive Membro Inicial, para respeitar a ordem salva.
    if (autoDisplayRank) {
        fixedRanks.push({
            id: FIXED_AUTO_RANK_KEY,
            name: autoDisplayRank.name,
            color: autoDisplayRank.color,
            description: autoDisplayRank.description || '',
            customText: autoDisplayRank.customText || '',
            backgroundImage: null,
            isVisible: 1,
            rankGroup: 'progression',
            icon: autoDisplayRank.icon || '',
            minDays: autoDisplayRank.minDays,
            maxDays: autoDisplayRank.maxDays,
            isFixed: true
        });
    }
    
    return fixedRanks;
}

function getDisplayRankUniqueKey(rank, fallbackKey = null) {
    if (!rank) return '';
    const rawId = rank?.id ?? fallbackKey;
    const isFixedLike =
        Boolean(rank?.isFixed) ||
        Number(rank?.isVisible) === 0 ||
        String(rawId || '').startsWith('fixed:');

    if (isFixedLike) {
        const normalizedName = String(rank?.name || '').trim().toLowerCase();
        if (normalizedName) return `fixed-name:${normalizedName}`;
    }
    if (rawId !== null && rawId !== undefined) return `id:${String(rawId)}`;
    return '';
}

export async function getProfileDisplayRanks(userId, rankComplete) {
    const userRow = await dbGet('SELECT selectedRanks FROM users WHERE id = ?', [userId]);
    let savedOrder = [];
    if (userRow?.selectedRanks) {
        try {
            savedOrder = normalizeRankOrderList(JSON.parse(userRow.selectedRanks));
        } catch {
            savedOrder = [];
        }
    }

    // Verificar se usuário tem "Membro BETA"
    const betaRank = await dbGet(
        `SELECT id FROM custom_ranks WHERE name = 'Membro BETA' LIMIT 1`
    );
    const betaRankId = Number(betaRank?.id || 0) || null;
    const userHasBetaRank = betaRankId
        ? Boolean(await dbGet(
            `SELECT 1 AS hasBeta FROM user_custom_ranks WHERE userId = ? AND customRankId = ? LIMIT 1`,
            [userId, betaRankId]
        ))
        : false;

    const fixedRanks = await buildFixedProfileRanks(userId, rankComplete, userHasBetaRank);
    const fixedByKey = new Map(fixedRanks.map((rank) => [String(rank.id), rank]));
    const customIds = savedOrder.filter((entry) => typeof entry === 'number');

    const customRows = customIds.length > 0
        ? await dbAll(
            `SELECT
                cr.id,
                cr.name,
                COALESCE(NULLIF(TRIM(ucr.customColor), ''), cr.color) AS color,
                cr.color AS baseColor,
                ucr.customColor AS customColor,
                cr.description,
                cr.customText,
                cr.backgroundImage,
                cr.isVisible,
                cr.rankGroup,
                cr.icon,
                cr.canChangeOwnColor
             FROM custom_ranks cr
             LEFT JOIN user_custom_ranks ucr
                ON ucr.customRankId = cr.id
               AND ucr.userId = ?
             WHERE cr.id IN (${customIds.map(() => '?').join(',')})`,
            [userId, ...customIds]
        )
        : [];
    const customById = new Map((customRows || []).map((row) => [Number(row.id), row]));

    const ordered = [];
    const seen = new Set();
    const hasBetaOverrideSelected = (customRows || []).some((rank) =>
        String(rank?.name || '').trim().toLowerCase() === 'membro beta'
    );
    
    // Filtrar progressões automáticas (apenas as de dias, não as especiais)
    const AUTO_PROGRESSION_NAMES = new Set([
        'membro inicial', 'membro novato', 'membro iniciado', 'membro aprendiz',
        'membro experiente', 'membro adepto', 'membro especialista', 'membro mestre', 'grande mestre',
        'membro lendário', 'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal'
    ]);
    
    const pushUnique = (rank, fallbackKey = null) => {
        if (!rank) return;

        const rankName = String(rank?.name || '').trim().toLowerCase();
        const uniqueKey = getDisplayRankUniqueKey(rank, fallbackKey);
        const rawId = rank?.id ?? fallbackKey;
        const isFixedAutoRank = String(rawId || '').trim() === FIXED_AUTO_RANK_KEY;
        if (AUTO_PROGRESSION_NAMES.has(rankName) && !isFixedAutoRank) {
            return;
        }
        if (!uniqueKey || seen.has(uniqueKey)) return;
        seen.add(uniqueKey);
        ordered.push(rank);
    };

    for (const entry of savedOrder) {
        if (typeof entry === 'number') {
            pushUnique(customById.get(Number(entry)), entry);
            continue;
        }
        if (entry === FIXED_AUTO_RANK_KEY || entry === FIXED_MANUAL_RANK_KEY) {
            pushUnique(fixedByKey.get(String(entry)), entry);
        }
    }

    const finalOrdered = ordered.filter((rank) => {
        const rankId = String(rank?.id || '').trim();
        if (rankId === FIXED_AUTO_RANK_KEY && hasBetaOverrideSelected) return false;
        return true;
    });

    const autoDisplayRank = rankComplete?.automatic
        || rankComplete?.automaticCompleted
        || (rankComplete?.current?.isCustom !== true ? rankComplete?.current : null)
        || null;
    const autoRankName = String(autoDisplayRank?.name || '').trim();
    const autoRankNameKey = autoRankName.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const hasAutoRankAlready = autoRankNameKey
        && finalOrdered.some((rank) => String(rank?.name || '').trim().normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase() === autoRankNameKey);

    if (!hasBetaOverrideSelected && autoRankName && !hasAutoRankAlready) {
        finalOrdered.unshift({
            id: FIXED_AUTO_RANK_KEY,
            ...autoDisplayRank,
            name: autoRankName,
            color: autoRankNameKey === 'membro inicial' ? '#8B5CF6' : autoDisplayRank.color,
            description: autoDisplayRank.description
                || (autoRankNameKey === 'membro inicial' ? 'Bem-vindo à Guild Holiday' : ''),
            rankGroup: 'progression',
            isFixed: true
        });
    }

    return finalOrdered;
}

async function getAnimatedProfilePermissions(userId) {
    const user = await dbGet(
        `SELECT canUseAnimatedProfile,
                animatedProfileEnabled,
                animatedMiniProfileEnabled,
                animatedDownloadCardEnabled,
                animatedProfileTheme,
                animatedProfileVisualMode,
                animatedProfileGifUrl,
                animatedProfileGiphyId
         FROM users
         WHERE id = ?`,
        [userId]
    );
    if (!user) {
        return {
            canUseAnimatedProfile: false,
            animatedProfileEnabled: false,
            animatedMiniProfileEnabled: false,
            animatedDownloadCardEnabled: false,
            animatedProfileTheme: 'auto',
            animatedProfileVisualMode: 'theme',
            animatedProfileGifUrl: null,
            animatedProfileGiphyId: null
        };
    }

    const hasRankPermission = await dbGet(
        `SELECT 1 AS allowed
         FROM user_custom_ranks ucr
         JOIN custom_ranks cr ON cr.id = ucr.customRankId
         WHERE ucr.userId = ? AND cr.canUseAnimatedProfile = 1
         LIMIT 1`,
        [userId]
    );

    const canUseAnimatedProfile = Number(user.canUseAnimatedProfile) === 1 || Boolean(hasRankPermission);
    const animatedMiniProfileEnabled = canUseAnimatedProfile
        ? Number(user.animatedMiniProfileEnabled ?? user.animatedProfileEnabled) === 1
        : false;
    const animatedDownloadCardEnabled = canUseAnimatedProfile
        ? Number(user.animatedDownloadCardEnabled ?? user.animatedProfileEnabled) === 1
        : false;
    return {
        canUseAnimatedProfile,
        animatedProfileEnabled: animatedMiniProfileEnabled || animatedDownloadCardEnabled,
        animatedMiniProfileEnabled,
        animatedDownloadCardEnabled,
        animatedProfileTheme: normalizeAnimatedProfileTheme(user.animatedProfileTheme),
        animatedProfileVisualMode: normalizeAnimatedProfileVisualMode(user.animatedProfileVisualMode),
        animatedProfileGifUrl: normalizeAnimatedGifUrl(user.animatedProfileGifUrl),
        animatedProfileGiphyId: normalizeAnimatedProfileGiphyId(user.animatedProfileGiphyId)
    };
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function getUserNotificationSettings(userId) {
    const row = await dbGet(
        `SELECT
            disableCommentNotifications,
            disableLikeNotifications,
            disableAchievementNotifications,
            disableAllNotifications
         FROM users
         WHERE id = ?`,
        [userId]
    );

    return {
        disableCommentNotifications: Boolean(row?.disableCommentNotifications),
        disableLikeNotifications: Boolean(row?.disableLikeNotifications),
        disableAchievementNotifications: Boolean(row?.disableAchievementNotifications),
        disableAllNotifications: Boolean(row?.disableAllNotifications)
    };
}

function shouldSendNotification(settings, type) {
    if (!settings) return true;
    if (settings.disableAllNotifications) return false;
    if (type === 'comment') return !settings.disableCommentNotifications;
    if (type === 'like' || type === 'heart') return !settings.disableLikeNotifications;
    if (type === 'conquista') return !settings.disableAchievementNotifications;
    return true;
}

async function createAchievementNotificationsForUser(userId, gainedRanks = [], options = {}) {
    const targetUserId = Number(userId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) return;

    const ranks = Array.isArray(gainedRanks) ? gainedRanks : [];
    if (ranks.length === 0) return;

    const settings = await getUserNotificationSettings(targetUserId);
    const canNotifyAchievement = shouldSendNotification(settings, 'conquista');
    if (!canNotifyAchievement) return;

    const awardedByUserId = Number.isInteger(Number(options.awardedByUserId))
        ? Number(options.awardedByUserId)
        : null;
    const relatedDownloadId = Number.isInteger(Number(options.relatedDownloadId))
        ? Number(options.relatedDownloadId)
        : null;

    for (const rank of ranks) {
        const rankName = String(rank?.name || '').trim();
        if (!rankName) continue;

        const message = awardedByUserId
            ? `Você recebeu a conquista \"${rankName}\".`
            : `Você desbloqueou a conquista \"${rankName}\".`;

        await AchievementNotification.createNotification(targetUserId, rankName, {
            message,
            awardedByUserId,
            relatedDownloadId
        });
    }
}

function dedupeRanksByGroup(ranks = []) {
    const seenGroups = new Set();
    const result = [];
    for (const rank of ranks || []) {
        let groupKey = String(rank?.rankGroup || '').trim();
        const icon = String(rank?.icon || '').trim().toUpperCase();
        if (!groupKey && /^P\d+/.test(icon)) groupKey = POST_ACHIEVEMENT_GROUP;
        if (!groupKey && /^L\d+/.test(icon)) groupKey = LIKE_ACHIEVEMENT_GROUP;
        if (groupKey) {
            if (seenGroups.has(groupKey)) continue;
            seenGroups.add(groupKey);
        }
        result.push(rank);
    }
    return result;
}

async function ensurePostAchievementRanksExist() {
    for (let i = 0; i < POST_ACHIEVEMENT_RANKS.length; i++) {
        const rank = POST_ACHIEVEMENT_RANKS[i];
        const rankLevel = i + 1;
        const existingPostageRank = await dbGet(
            `SELECT id FROM postage_ranks WHERE rankLevel = ? LIMIT 1`,
            [rankLevel]
        );

        if (existingPostageRank && existingPostageRank.id) {
            await dbRun(
                `UPDATE postage_ranks
                 SET minPostages = ?, name = ?, color = ?, icon = ?, description = ?
                 WHERE rankLevel = ?`,
                [rank.minPosts, rank.name, rank.color, rank.icon, rank.description, rankLevel]
            );
        } else {
            await dbRun(
                `INSERT INTO postage_ranks (rankLevel, minPostages, name, color, icon, description)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [rankLevel, rank.minPosts, rank.name, rank.color, rank.icon, rank.description]
            );
        }
    }

    await dbRun(`DELETE FROM postage_ranks WHERE rankLevel > ?`, [POST_ACHIEVEMENT_RANKS.length]);

    for (const rank of POST_ACHIEVEMENT_RANKS) {
        const existing = await dbGet(
            `SELECT id FROM custom_ranks WHERE name = ? LIMIT 1`,
            [rank.name]
        );

        if (existing && existing.id) {
            await dbRun(
                `UPDATE custom_ranks
                 SET color = ?, icon = ?, description = ?, customText = ?, isDefault = 0, isVisible = 1, rankGroup = ?
                 WHERE id = ?`,
                [rank.color, rank.icon, rank.description, `conquista de ${rank.minPosts} postagens`, POST_ACHIEVEMENT_GROUP, existing.id]
            );
            continue;
        }

        await dbRun(
            `INSERT INTO custom_ranks
             (name, color, icon, description, customText, backgroundImage, isDefault, isVisible, enableAdminPanel, canManageDownloads, rankGroup)
             VALUES (?, ?, ?, ?, ?, ?, 0, 1, 0, 0, ?)`,
            [rank.name, rank.color, rank.icon, rank.description, `conquista de ${rank.minPosts} postagens`, null, POST_ACHIEVEMENT_GROUP]
        );
    }
}

async function ensureLikeAchievementRanksExist() {
    for (const rank of LIKE_ACHIEVEMENT_RANKS) {
        const existing = await dbGet(
            `SELECT id FROM custom_ranks WHERE name = ? LIMIT 1`,
            [rank.name]
        );

        if (existing && existing.id) {
            await dbRun(
                `UPDATE custom_ranks
                 SET color = ?, icon = ?, description = ?, customText = ?, isDefault = 0, isVisible = 1, rankGroup = ?
                 WHERE id = ?`,
                [rank.color, rank.icon, rank.description, `conquista de ${rank.minLikes} likes recebidos`, LIKE_ACHIEVEMENT_GROUP, existing.id]
            );
            continue;
        }

        await dbRun(
            `INSERT INTO custom_ranks
             (name, color, icon, description, customText, backgroundImage, isDefault, isVisible, enableAdminPanel, canManageDownloads, rankGroup)
             VALUES (?, ?, ?, ?, ?, ?, 0, 1, 0, 0, ?)`,
            [rank.name, rank.color, rank.icon, rank.description, `conquista de ${rank.minLikes} likes recebidos`, null, LIKE_ACHIEVEMENT_GROUP]
        );
    }
}

async function syncUserPostAchievementRanks(userId) {
    await ensurePostAchievementRanksExist();

    const row = await dbGet(
        `SELECT COUNT(*) AS postCount FROM downloads WHERE userId = ?`,
        [userId]
    );
    const postCount = row?.postCount || 0;

    const targetNames = POST_ACHIEVEMENT_RANKS.map(rank => rank.name);
    const placeholders = targetNames.map(() => '?').join(',');
    const rankRows = await dbAll(
        `SELECT id, name FROM custom_ranks WHERE name IN (${placeholders})`,
        targetNames
    );
    const idByName = new Map(rankRows.map(rank => [rank.name, rank.id]));

    const existingAssigned = await dbAll(
        `SELECT customRankId FROM user_custom_ranks WHERE userId = ?`,
        [userId]
    );
    const existingAssignedSet = new Set(existingAssigned.map(item => Number(item.customRankId)));

    const gainedRanks = [];

    for (const rank of POST_ACHIEVEMENT_RANKS) {
        const customRankId = idByName.get(rank.name);
        if (!customRankId) continue;
        const wasAssigned = existingAssignedSet.has(Number(customRankId));

        if (postCount >= rank.minPosts) {
            await dbRun(
                `INSERT OR IGNORE INTO user_custom_ranks (userId, customRankId) VALUES (?, ?)`,
                [userId, customRankId]
            );
            if (!wasAssigned) {
                gainedRanks.push({
                    id: customRankId,
                    name: rank.name,
                    minPosts: rank.minPosts
                });
            }
        } else {
            await dbRun(
                `DELETE FROM user_custom_ranks WHERE userId = ? AND customRankId = ?`,
                [userId, customRankId]
            );
        }
    }

    return { postCount, gainedRanks };
}

async function getHistoricalLikesCount(userId) {
    const row = await dbGet(
        `SELECT COUNT(*) AS likeCount
         FROM download_like_history
         WHERE ownerUserId = ?`,
        [userId]
    );
    return Number(row?.likeCount || 0);
}

async function syncUserLikeAchievementRanks(userId) {
    await ensureLikeAchievementRanksExist();

    const likeCount = await getHistoricalLikesCount(userId);
    const targetNames = LIKE_ACHIEVEMENT_RANKS.map(rank => rank.name);
    const placeholders = targetNames.map(() => '?').join(',');
    const rankRows = await dbAll(
        `SELECT id, name FROM custom_ranks WHERE name IN (${placeholders})`,
        targetNames
    );
    const idByName = new Map(rankRows.map(rank => [rank.name, rank.id]));

    const existingAssigned = await dbAll(
        `SELECT customRankId FROM user_custom_ranks WHERE userId = ?`,
        [userId]
    );
    const existingAssignedSet = new Set(existingAssigned.map(item => Number(item.customRankId)));

    const gainedRanks = [];
    for (const rank of LIKE_ACHIEVEMENT_RANKS) {
        const customRankId = idByName.get(rank.name);
        if (!customRankId) continue;
        const wasAssigned = existingAssignedSet.has(Number(customRankId));

        if (likeCount >= rank.minLikes) {
            await dbRun(
                `INSERT OR IGNORE INTO user_custom_ranks (userId, customRankId) VALUES (?, ?)`,
                [userId, customRankId]
            );
            if (!wasAssigned) {
                gainedRanks.push({
                    id: customRankId,
                    name: rank.name,
                    minLikes: rank.minLikes
                });
            }
        }
    }

    return { likeCount, gainedRanks };
}

// GET - Verificar se usuário pode postar
router.get('/can-post', protect, async (req, res) => {
    try {
        const canPost = await Download.hasPostPermission(req.user.id);
        
        res.json({
            success: true,
            canPost
        });
    } catch (error) {
        console.error('Erro ao verificar permissão:', error);
        res.status(500).json({ success: false, message: 'Erro ao verificar permissão' });
    }
});

// POST - Upload de arquivo para download
router.post('/upload-file', protect, downloadFileUpload.single('file'), async (req, res) => {
    const payload = buildDownloadFilePayload(req.file, req);
    try {
        if (!payload) {
            return res.status(400).json({ success: false, message: 'Envie um arquivo válido para o download.' });
        }

        const canPost = await Download.hasPostPermission(req.user.id);
        if (!canPost) {
            await removeDownloadFileByPath(payload.path);

            const emailVerified = Number(req.user?.emailVerified) === 1;
            return res.status(403).json({
                success: false,
                message: emailVerified
                    ? 'Você não tem permissão para postar downloads. Peça permissão ao administrador.'
                    : 'Confirme seu e-mail antes de postar downloads.'
            });
        }

        res.status(201).json({
            success: true,
            file: payload
        });
    } catch (error) {
        await removeDownloadFileByPath(payload?.path);
        console.error('Erro ao enviar arquivo de download:', error);
        res.status(500).json({ success: false, message: 'Erro ao enviar arquivo' });
    }
});

router.post('/post-conquistas/sync', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { postCount, gainedRanks } = await syncUserPostAchievementRanks(userId);
        await createAchievementNotificationsForUser(userId, gainedRanks, {
            relatedDownloadId: null
        });

        res.json({
            success: true,
            message: 'conquistas de postagem sincronizados',
            postCount,
            gainedRanks: gainedRanks || []
        });
    } catch (error) {
        console.error('Erro ao sincronizar conquistas de postagem:', error);
        res.status(500).json({ success: false, message: 'Erro ao sincronizar conquistas de postagem' });
    }
});

router.post('/like-conquistas/sync', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { likeCount, gainedRanks } = await syncUserLikeAchievementRanks(userId);
        await createAchievementNotificationsForUser(userId, gainedRanks, {
            relatedDownloadId: null
        });

        res.json({
            success: true,
            message: 'conquistas de likes sincronizados',
            likeCount,
            gainedRanks: gainedRanks || []
        });
    } catch (error) {
        console.error('Erro ao sincronizar conquistas de likes:', error);
        res.status(500).json({ success: false, message: 'Erro ao sincronizar conquistas de likes' });
    }
});

// GET - Verificar se usuário pode gerenciar downloads (editar/excluir)
// GET - Verificar se usuário pode gerenciar (editar/excluir) downloads
router.get('/can-manage', protect, async (req, res) => {
    try {
        const canManage = await Download.canManageDownloads(req.user.id);
        
        res.json({
            success: true,
            canManage
        });
    } catch (error) {
        console.error('Erro ao verificar permissão de gerenciamento:', error);
        res.status(500).json({ success: false, message: 'Erro ao verificar permissão' });
    }
});

// GET - Perfil do usuário com conquistas de postagem
router.get('/user-profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        await syncUserPostAchievementRanks(userId);
        await syncUserLikeAchievementRanks(userId);

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        // Obter conjunto completo de conquistas do perfil
        const rankComplete = await Rank.getUserRankComplete(userId);
        
        // Ordem de exibição do perfil (mesma do /profile, incluindo fixos)
        const displayRanks = await getProfileDisplayRanks(userId, rankComplete);
        const autoDisplayRank = rankComplete?.automatic
            || rankComplete?.automaticCompleted
            || (rankComplete?.current?.isCustom !== true ? rankComplete?.current : null)
            || null;
        
        // Obter estatísticas de downloads
        const stats = await Download.getUserStats(userId);
        const animatedProfilePerms = await getAnimatedProfilePermissions(userId);
        
        // Obter conquista de postagem
        const postageRankInfo = await PostageRank.calculateRankByPostages(userId);

        res.json({
            success: true,
            profile: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                nickname: user.nickname,
                avatar: user.avatar,
                avatarScale: user.avatarScale,
                avatarOffsetX: user.avatarOffsetX,
                avatarOffsetY: user.avatarOffsetY,
                bio: user.bio,
                customTitle: user.customTitle,
                customTitleSubtitle: user.customTitleSubtitle,
                profileTagline: user.profileTagline,
                profileTag: user.profileTag,
                profileTagStyle: user.profileTagStyle,
                profileTagColor: user.profileTagColor,
                profileTagTextColor: user.profileTagTextColor,
                profileTagSymbolStyle: user.profileTagSymbolStyle,
                profileTagBannerStyle: user.profileTagBannerStyle,
                profileTagGradientStart: user.profileTagGradientStart,
                profileTagGradientEnd: user.profileTagGradientEnd,
                profileTagUseGradient: normalizeBooleanInput(user.profileTagUseGradient, false),
                showFullNameInMiniProfile: normalizeBooleanInput(user.showFullNameInMiniProfile, true),
                autoRank: autoDisplayRank ? {
                    name: autoDisplayRank.name,
                    icon: autoDisplayRank.icon,
                    color: autoDisplayRank.color,
                    level: autoDisplayRank.level,
                    description: autoDisplayRank.description || ''
                } : null,
                currentRank: rankComplete?.current ? {
                    name: rankComplete.current.name,
                    icon: rankComplete.current.icon,
                    color: rankComplete.current.color,
                    level: rankComplete.current.level,
                    description: rankComplete.current.description
                } : null,
                selectedRanks: displayRanks,
                displayRanks,
                canUseAnimatedProfile: animatedProfilePerms.canUseAnimatedProfile,
                animatedProfileEnabled: animatedProfilePerms.animatedProfileEnabled,
                animatedMiniProfileEnabled: animatedProfilePerms.animatedMiniProfileEnabled,
                animatedDownloadCardEnabled: animatedProfilePerms.animatedDownloadCardEnabled,
                animatedProfileTheme: animatedProfilePerms.animatedProfileTheme,
                animatedProfileVisualMode: animatedProfilePerms.animatedProfileVisualMode,
                animatedProfileGifUrl: animatedProfilePerms.animatedProfileGifUrl,
                animatedProfileGiphyId: animatedProfilePerms.animatedProfileGiphyId,
                postageRank: postageRankInfo.rank ? {
                    name: postageRankInfo.rank.name,
                    icon: postageRankInfo.rank.icon,
                    color: postageRankInfo.rank.color,
                    description: postageRankInfo.rank.description
                } : null,
                stats: {
                    postCount: stats.totalPostages || 0,
                    totalLikes: stats.totalLikes || 0,
                    totalHearts: stats.totalHearts || 0
                }
            }
        });

    } catch (error) {
        console.error('Erro ao obter perfil:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter perfil' });
    }
});

// GET - Obter todos os downloads
router.get('/', async (req, res) => {
    try {
        const downloads = await Download.getAllDownloads();
        const viewer = await getViewerAdultContext(req);
        const visibleDownloads = applyAdultVisibilityForViewer(downloads, viewer);
        
        res.json({
            success: true,
            downloads: visibleDownloads
        });
    } catch (error) {
        console.error('Erro ao obter downloads:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter downloads' });
    }
});

// GET - Obter downloads com conquistas customizados e de postagem
router.get('/list/with-ranks', async (req, res) => {
    try {
        const downloads = await Download.getAllDownloads();
        const userIds = [...new Set(
            (downloads || [])
                .map((download) => Number(download?.userId))
                .filter((userId) => Number.isInteger(userId) && userId > 0)
        )];
        const userDisplayCache = new Map();

        for (const userId of userIds) {
            await syncUserPostAchievementRanks(userId);
            await syncUserLikeAchievementRanks(userId);

            const rankInfo = await PostageRank.calculateRankByPostages(userId);
            const rankComplete = await Rank.getUserRankComplete(userId);
            const selectedRanks = await getProfileDisplayRanks(userId, rankComplete);
            const animatedProfilePerms = await getAnimatedProfilePermissions(userId);
            const authorBan = await getUserBanStatus(userId);

            const authorDisplayRanks = [...(selectedRanks || [])];
            const hasAnySelectedRanks = Array.isArray(selectedRanks) && selectedRanks.length > 0;
            const hasProgressionOverrideSelected = (selectedRanks || []).some((rank) => {
                const nameLower = String(rank?.name || '').trim().toLowerCase();
                return ['membro beta', 'membro inicial', 'membro ativo', 'membro iniciado'].includes(nameLower);
            });
            const blockProgressionRanks = hasProgressionOverrideSelected;
            const progressionRankNames = new Set([
                'membro novato', 'membro aprendiz', 'membro experiente', 'membro adepto',
                'membro especialista', 'membro mestre', 'grande mestre', 'membro lendário',
                'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal'
            ]);
            const hasAnyDisplayRanks = authorDisplayRanks.length > 0;
            if (!hasAnySelectedRanks && rankComplete?.current && String(rankComplete.current.name || '').trim()) {
                const currentNameLower = String(rankComplete.current.name || '').trim().toLowerCase();
                const isCurrentProgression = progressionRankNames.has(currentNameLower);
                const isCurrentMembroInicial = currentNameLower === 'membro inicial';
                if (!isCurrentMembroInicial && !(blockProgressionRanks && isCurrentProgression)) {
                    authorDisplayRanks.push(rankComplete.current);
                }
            }
            const authorAutoRank = rankComplete?.automatic || rankComplete?.automaticCompleted || null;
            if (!hasAnySelectedRanks &&
                authorAutoRank &&
                String(authorAutoRank.name || '').trim() &&
                String(authorAutoRank.name).trim().toLowerCase() !== String(rankComplete.current?.name || '').trim().toLowerCase() &&
                (!blockProgressionRanks || !progressionRankNames.has(String(authorAutoRank.name).trim().toLowerCase()))
            ) {
                const authorAutoRankNameLower = String(authorAutoRank.name || '').trim().toLowerCase();
                if (authorAutoRankNameLower !== 'membro inicial') {
                    authorDisplayRanks.push(authorAutoRank);
                }
            }

            userDisplayCache.set(userId, {
                authorPostageRank: rankInfo.rank,
                authorPostageCount: rankInfo.postageCount,
                userSelectedRanks: selectedRanks || [],
                authorDisplayRanks,
                authorRankComplete: rankComplete || null,
                authorCanUseAnimatedProfile: animatedProfilePerms.canUseAnimatedProfile,
                authorAnimatedProfileEnabled: animatedProfilePerms.animatedProfileEnabled,
                authorAnimatedMiniProfileEnabled: animatedProfilePerms.animatedMiniProfileEnabled,
                authorAnimatedDownloadCardEnabled: animatedProfilePerms.animatedDownloadCardEnabled,
                authorAnimatedProfileTheme: animatedProfilePerms.animatedProfileTheme,
                authorAnimatedProfileVisualMode: animatedProfilePerms.animatedProfileVisualMode,
                authorAnimatedProfileGifUrl: animatedProfilePerms.animatedProfileGifUrl,
                authorAnimatedProfileGiphyId: animatedProfilePerms.animatedProfileGiphyId,
                authorIsBanned: !!authorBan,
                authorBanType: authorBan?.banType || null,
                authorBanReason: authorBan?.reason || null
            });
        }
        
        // Adicionar informações de conquistas aos downloads
        const downloadsWithRanks = downloads.map((download) => {
            const cachedDisplay = userDisplayCache.get(Number(download?.userId)) || {};
            return {
                ...download,
                ...cachedDisplay,
                // Garantir que os campos de zoom do avatar existem
                avatarScale: Number(download?.avatarScale) || 1,
                avatarOffsetX: Number(download?.avatarOffsetX) || 50,
                avatarOffsetY: Number(download?.avatarOffsetY) || 50
            };
        });
        const viewer = await getViewerAdultContext(req);
        const viewerId = Number(viewer?.userId || 0);
        let likedDownloadIds = new Set();
        let heartedDownloadIds = new Set();

        if (viewerId > 0) {
            const viewerReactions = await dbAll(
                `SELECT downloadId, reactionType
                 FROM download_reactions
                 WHERE userId = ?
                   AND reactionType IN ('like', 'heart')`,
                [viewerId]
            );

            for (const reaction of viewerReactions || []) {
                const parsedId = Number(reaction?.downloadId);
                if (!Number.isFinite(parsedId) || parsedId <= 0) continue;
                if (reaction?.reactionType === 'like') {
                    likedDownloadIds.add(parsedId);
                } else if (reaction?.reactionType === 'heart') {
                    heartedDownloadIds.add(parsedId);
                }
            }
        }

        const downloadsWithViewerReactions = downloadsWithRanks.map((item) => {
            const downloadId = Number(item?.id || 0);
            return {
                ...item,
                viewerHasLike: likedDownloadIds.has(downloadId),
                viewerHasHeart: heartedDownloadIds.has(downloadId)
            };
        });

        console.log('[DEBUG] Viewer context:', {
            userId: viewer?.userId,
            isAdult: viewer?.isAdult,
            showAdultPosts: viewer?.showAdultPosts,
            downloadsCount: downloadsWithViewerReactions?.length
        });
        
        const visibleDownloads = applyAdultVisibilityForViewer(downloadsWithViewerReactions, viewer);
        
        console.log('[DEBUG] After visibility filter:', {
            adultLockedCount: visibleDownloads?.filter(d => d.isAdultLocked)?.length,
            unlockedCount: visibleDownloads?.filter(d => !d.isAdultLocked)?.length
        });
        
        res.json({
            success: true,
            downloads: visibleDownloads
        });
    } catch (error) {
        console.error('Erro ao obter downloads com conquistas:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter downloads' });
    }
});

// POST - Criar novo download
router.post('/', protect, postRateLimiter, async (req, res) => {
    try {
        const { name, description, links, link, isAdult, membersOnly } = req.body;
        const userId = req.user.id;
        const rawLinks = links ?? link;
        const normalizedLinks = normalizeDownloadLinksPayload(rawLinks);
        const isAdultPost = normalizeBooleanInput(isAdult, false);
        const isMembersOnlyPost = normalizeBooleanInput(membersOnly, false);

        // Validações
        if (!name || normalizedLinks.length === 0) {
            return res.status(400).json({ success: false, message: 'Nome e pelo menos um link são obrigatórios' });
        }

        // Validar máximo de 3 links
        if (Array.isArray(rawLinks) && rawLinks.length > MAX_DOWNLOAD_LINKS) {
            return res.status(400).json({ success: false, message: 'Máximo de 3 links permitidos' });
        }

        // Verificar se usuário tem permissão
        const canPost = await Download.hasPostPermission(userId);
        if (!canPost) {
            return res.status(403).json({ 
                success: false, 
                message: 'Você não tem permissão para postar downloads. Peça permissão ao administrador.' 
            });
        }

        // Verificar se usuário tem postagens suspensas
        const hasSuspendedPosts = await new Promise((resolve) => {
            db.get(
                `SELECT COUNT(*) as count FROM downloads WHERE userId = ? AND suspensionStatus = 'suspended'`,
                [userId],
                (err, row) => {
                    resolve(err || !row ? false : row.count > 0);
                }
            );
        });

        if (hasSuspendedPosts) {
            return res.status(403).json({
                success: false,
                message: 'Você possui postagens suspendidas. Resolva-as antes de postar novas postagens.'
            });
        }

        if (isAdultPost) {
            const postingUser = await User.findById(userId);
            const isAdultUser = getAgeFromBirthDateIso(postingUser?.birthDate) >= 18;
            if (!isAdultUser) {
                return res.status(403).json({
                    success: false,
                    message: 'Apenas contas com 18 anos ou mais podem criar postagem +18.'
                });
            }
        }

        const newDownload = await Download.createDownload(userId, name, description || '', normalizedLinks, {
            isAdult: isAdultPost,
            membersOnly: isMembersOnlyPost
        });
        const syncResult = await syncUserPostAchievementRanks(userId);
        
        // Obter informações completas do download
        const fullDownload = await Download.getDownloadById(newDownload.id);
        
        // Obter conquista de postagem atualizado
        const rankInfo = await PostageRank.calculateRankByPostages(userId);
        const ownNotificationSettings = await getUserNotificationSettings(userId);
        const canNotifyAchievement = shouldSendNotification(ownNotificationSettings, 'conquista');
        const gainedPostAchievementRanks = canNotifyAchievement ? (syncResult?.gainedRanks || []) : [];

        if (gainedPostAchievementRanks.length > 0) {
            await createAchievementNotificationsForUser(userId, gainedPostAchievementRanks, {
                relatedDownloadId: Number(newDownload?.id) || null
            });
        }

        res.status(201).json({
            success: true,
            message: 'Download postado com sucesso!',
            download: fullDownload,
            authorPostageRank: rankInfo.rank,
            authorPostageCount: rankInfo.postageCount,
            gainedPostAchievementRanks
        });

    } catch (error) {
        console.error('Erro ao criar download:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar download' });
    }
});

// POST - Adicionar reação a um download  
router.post('/:downloadId/reaction', protect, reactionRateLimiter, async (req, res) => {
    try {
        const { downloadId } = req.params;
        const { reactionType } = req.body;
        const userId = req.user.id;

        // Validar tipo de reação (removido 'dislike')
        if (!['like', 'heart'].includes(reactionType)) {
            return res.status(400).json({ success: false, message: 'Tipo de reação inválido' });
        }

        const download = await Download.getDownloadById(downloadId);
        if (!download) {
            return res.status(404).json({ success: false, message: 'Download não encontrado' });
        }

        const viewer = await getViewerAdultContext(req);
        const adultAccess = getAdultAccessDecision(download, viewer);
        if (!adultAccess.allowed) {
            return res.status(403).json({ success: false, message: adultAccess.message });
        }

        // Adicionar/atualizar reação
        const result = await Download.addOrUpdateReaction(downloadId, userId, reactionType);

        // Criar notificação se adicionou reação (não removeu)
        if ((result.created || result.updated) && download && download.userId !== userId) {
            const ownerNotificationSettings = await getUserNotificationSettings(download.userId);
            const canNotifyReaction = shouldSendNotification(ownerNotificationSettings, reactionType);
            if (!canNotifyReaction) {
                // Sem notificação para o dono por preferência
            } else {
                await Notification.createOrRefreshReactionNotification(
                    Number(download.userId),
                    Number(userId),
                    Number(downloadId),
                    reactionType
                );
            }
        }

        let likeAchievementSync = null;
        if (reactionType === 'like' && result.created && download) {
            // Historico permanente de likes recebidos (não reduz com apagar postagem)
            await dbRun(
                `INSERT OR IGNORE INTO download_like_history (ownerUserId, fromUserId, downloadId) VALUES (?, ?, ?)`,
                [download.userId, userId, Number(downloadId)]
            );
            likeAchievementSync = await syncUserLikeAchievementRanks(download.userId);
        }

        // Obter contagem atualizada
        const reactions = await Download.getReactions(downloadId);
        
        // Obter reações do usuário (both like and heart)
        const hasLike = await Download.checkUserReaction(downloadId, userId, 'like');
        const hasHeart = await Download.checkUserReaction(downloadId, userId, 'heart');

        const ownerNotificationSettingsForAchievement = download
            ? await getUserNotificationSettings(download.userId)
            : null;
        const canNotifyAchievement = shouldSendNotification(ownerNotificationSettingsForAchievement, 'conquista');
        const gainedLikeAchievementRanks = canNotifyAchievement ? (likeAchievementSync?.gainedRanks || []) : [];

        if (gainedLikeAchievementRanks.length > 0 && download) {
            await createAchievementNotificationsForUser(download.userId, gainedLikeAchievementRanks, {
                awardedByUserId: Number(userId),
                relatedDownloadId: Number(downloadId)
            });
        }

        res.json({
            success: true,
            message: 'Reação registrada',
            isAdded: result.created || result.updated,
            reactions,
            gainedLikeAchievementRanks,
            userReactions: {
                hasLike: hasLike,
                hasHeart: hasHeart
            }
        });

    } catch (error) {
        console.error('Erro ao adicionar reação:', error);
        res.status(500).json({ success: false, message: 'Erro ao adicionar reação' });
    }
});

// GET - Obter reações do usuário em um download
router.get('/:downloadId/my-reaction', protect, async (req, res) => {
    try {
        const { downloadId } = req.params;
        const userId = req.user.id;
        const download = await Download.getDownloadById(downloadId);
        if (!download) {
            return res.status(404).json({ success: false, message: 'Download não encontrado' });
        }

        const viewer = await getViewerAdultContext(req);
        const adultAccess = getAdultAccessDecision(download, viewer);
        if (!adultAccess.allowed) {
            return res.status(403).json({ success: false, message: adultAccess.message });
        }

        const reactions = await Download.getUserReactions(downloadId, userId);

        res.json({
            success: true,
            hasLike: reactions.like,
            hasHeart: reactions.heart
        });

    } catch (error) {
        console.error('Erro ao obter reações:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter reações' });
    }
});

// POST - Adicionar/remover favorito
router.post('/:downloadId/favorite', protect, async (req, res) => {
    try {
        const { downloadId } = req.params;
        const userId = req.user.id;
        const download = await Download.getDownloadById(downloadId);
        if (!download) {
            return res.status(404).json({ success: false, message: 'Download não encontrado' });
        }

        const viewer = await getViewerAdultContext(req);
        const adultAccess = getAdultAccessDecision(download, viewer);
        if (!adultAccess.allowed) {
            return res.status(403).json({ success: false, message: adultAccess.message });
        }

        const result = await Download.addOrRemoveFavorite(downloadId, userId);

        res.json({
            success: true,
            message: result.added ? 'Adicionado aos favoritos' : 'Removido dos favoritos',
            result
        });

    } catch (error) {
        console.error('Erro ao atualizar favorito:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar favorito' });
    }
});

// GET - Verificar se é favorito
router.get('/:downloadId/is-favorite', protect, async (req, res) => {
    try {
        const { downloadId } = req.params;
        const userId = req.user.id;
        const download = await Download.getDownloadById(downloadId);
        if (!download) {
            return res.status(404).json({ success: false, message: 'Download não encontrado' });
        }

        const viewer = await getViewerAdultContext(req);
        const adultAccess = getAdultAccessDecision(download, viewer);
        if (!adultAccess.allowed) {
            return res.status(403).json({ success: false, message: adultAccess.message });
        }

        const isFav = await Download.isFavorite(downloadId, userId);

        res.json({
            success: true,
            isFavorite: isFav
        });

    } catch (error) {
        console.error('Erro ao verificar favorito:', error);
        res.status(500).json({ success: false, message: 'Erro ao verificar favorito' });
    }
});

// GET - Obter favoritos do usuário
router.get('/favorites/list', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const favorites = await Download.getUserFavorites(userId);
        const viewer = await getViewerAdultContext(req);
        const visibleFavorites = applyAdultVisibilityForViewer(favorites, viewer);

        res.json({
            success: true,
            favorites: visibleFavorites
        });

    } catch (error) {
        console.error('Erro ao obter favoritos:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter favoritos' });
    }
});

// GET - Obter downloads de um usuário específico
router.get('/user/:userId/downloads', async (req, res) => {
    try {
        const { userId } = req.params;

        const downloads = await Download.getUserDownloads(userId);
        const viewer = await getViewerAdultContext(req);
        const visibleDownloads = applyAdultVisibilityForViewer(downloads, viewer);

        res.json({
            success: true,
            downloads: visibleDownloads
        });

    } catch (error) {
        console.error('Erro ao obter downloads do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter downloads' });
    }
});

// GET - Obter estatísticas de um usuário
router.get('/user/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;

        await syncUserLikeAchievementRanks(userId);
        const stats = await Download.getUserStats(userId);
        const rankInfo = await PostageRank.getUserRankInfo(userId);

        res.json({
            success: true,
            stats,
            rankInfo
        });

    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter estatísticas' });
    }
});

// GET - Obter todos os conquistas de postagem
router.get('/ranks/all', async (req, res) => {
    try {
        const ranks = await PostageRank.getAllRanks();

        res.json({
            success: true,
            ranks
        });

    } catch (error) {
        console.error('Erro ao obter conquistas:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter conquistas' });
    }
});

// DELETE - Deletar download (apenas author ou admin)
router.delete('/:downloadId', protect, async (req, res) => {
    try {
        const { downloadId } = req.params;
        const userId = req.user.id;

        // Verificar se é o criador ou admin ou tem permissão de gerenciar
        const download = await Download.getDownloadById(downloadId);
        const canManage = await Download.canManageDownloads(userId);

        if (!download) {
            return res.status(404).json({ success: false, message: 'Download não encontrado' });
        }

        if (Number(download.userId) !== Number(userId) && !canManage) {
            return res.status(403).json({ success: false, message: 'Você não tem permissão para deletar este download' });
        }

        const commentAttachments = await dbAll(
            `SELECT attachmentPath FROM download_comments WHERE downloadId = ? AND attachmentPath IS NOT NULL`,
            [downloadId]
        );

        // Deletar
        await Download.deleteDownload(downloadId);
        for (const item of commentAttachments || []) {
            await removeCommentAttachmentFileByPath(item?.attachmentPath);
        }
        await syncUserPostAchievementRanks(download.userId);

        res.json({
            success: true,
            message: 'Download deletado com sucesso!'
        });

    } catch (error) {
        console.error('Erro ao deletar download:', error);
        res.status(500).json({ success: false, message: 'Erro ao deletar download' });
    }
});

// PUT - Atualizar download (apenas author ou admin)
router.put('/:downloadId', protect, async (req, res) => {
    try {
        const { downloadId } = req.params;
        const { name, description, links, link, isAdult, membersOnly } = req.body;
        const userId = req.user.id;
        const hasLinksField = Object.prototype.hasOwnProperty.call(req.body || {}, 'links')
            || Object.prototype.hasOwnProperty.call(req.body || {}, 'link');
        const rawLinks = hasLinksField ? (links ?? link) : undefined;
        const normalizedLinks = hasLinksField ? normalizeDownloadLinksPayload(rawLinks) : [];
        const hasIsAdult = Object.prototype.hasOwnProperty.call(req.body || {}, 'isAdult');
        const isAdultPost = hasIsAdult ? normalizeBooleanInput(isAdult, false) : null;
        const hasMembersOnly = Object.prototype.hasOwnProperty.call(req.body || {}, 'membersOnly');
        const isMembersOnlyPost = hasMembersOnly ? normalizeBooleanInput(membersOnly, false) : null;

        // Validações
        if (!name) {
            return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
        }
        if (hasLinksField && normalizedLinks.length === 0) {
            return res.status(400).json({ success: false, message: 'Informe pelo menos um link válido' });
        }
        if (hasLinksField && Array.isArray(rawLinks) && rawLinks.length > MAX_DOWNLOAD_LINKS) {
            return res.status(400).json({ success: false, message: 'Máximo de 3 links permitidos' });
        }

        // Verificar se é o criador ou tem permissão de gerenciar
        const download = await Download.getDownloadById(downloadId);
        const canManage = await Download.canManageDownloads(userId);

        if (!download) {
            return res.status(404).json({ success: false, message: 'Download não encontrado' });
        }

        if (Number(download.userId) !== Number(userId) && !canManage) {
            return res.status(403).json({ success: false, message: 'Você não tem permissão para atualizar este download' });
        }

        if (isAdultPost === true) {
            const actorUser = await User.findById(userId);
            const isActorAdult = getAgeFromBirthDateIso(actorUser?.birthDate) >= 18;
            if (!isActorAdult) {
                return res.status(403).json({
                    success: false,
                    message: 'Apenas contas com 18 anos ou mais podem marcar postagem como +18.'
                });
            }
        }

        // Atualizar download
        const updatePayload = {
            name,
            description: description || '',
            ...(hasIsAdult ? { isAdult: isAdultPost } : {}),
            ...(hasMembersOnly ? { membersOnly: isMembersOnlyPost } : {})
        };
        if (hasLinksField) {
            updatePayload.links = normalizedLinks;
        }

        await Download.updateDownload(downloadId, updatePayload);

        // Obter download atualizado
        const updatedDownload = await Download.getDownloadById(downloadId);

        res.json({
            success: true,
            message: 'Download atualizado com sucesso!',
            download: updatedDownload
        });

    } catch (error) {
        console.error('Erro ao atualizar download:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar download' });
    }
});

// ===================== COMENTÁRIOS =====================

// POST - Adicionar comentário
router.post('/:downloadId/comments', protect, commentRateLimiter, commentAttachmentUpload.single('attachment'), async (req, res) => {
    try {
        const { downloadId } = req.params;
        const content = String(req.body?.content || '');
        const trimmedContent = content.trim();
        const userId = req.user.id;
        const attachmentPayload = buildCommentAttachmentPayload(req.file);

        if (!trimmedContent && !attachmentPayload) {
            await removeCommentAttachmentFileByPath(attachmentPayload?.path);
            return res.status(400).json({ success: false, message: 'Comentário vazio. Digite algo ou envie um anexo.' });
        }

        if (trimmedContent.length > 500) {
            await removeCommentAttachmentFileByPath(attachmentPayload?.path);
            return res.status(400).json({ success: false, message: 'Comentário muito longo (máximo 500 caracteres)' });
        }

        // Verificar se download existe
        const download = await Download.getDownloadById(downloadId);
        if (!download) {
            await removeCommentAttachmentFileByPath(attachmentPayload?.path);
            return res.status(404).json({ success: false, message: 'Download não encontrado' });
        }

        const viewer = await getViewerAdultContext(req);
        const adultAccess = getAdultAccessDecision(download, viewer);
        if (!adultAccess.allowed) {
            await removeCommentAttachmentFileByPath(attachmentPayload?.path);
            return res.status(403).json({ success: false, message: adultAccess.message });
        }

        // Criar comentário
        const comment = await DownloadComment.createComment(downloadId, userId, trimmedContent, attachmentPayload);

        // Criar notificação para o dono da postagem
        if (download.userId !== userId) {
            const ownerNotificationSettings = await getUserNotificationSettings(download.userId);
            if (shouldSendNotification(ownerNotificationSettings, 'comment')) {
                await Notification.createNotification(download.userId, userId, downloadId, 'comment', comment.id);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Comentário adicionado com sucesso!',
            comment
        });

    } catch (error) {
        await removeCommentAttachmentFileByPath(buildCommentAttachmentPayload(req.file)?.path);
        console.error('Erro ao adicionar comentário:', error);
        res.status(500).json({ success: false, message: 'Erro ao adicionar comentário' });
    }
});

// GET - Obter comentários de um download
router.get('/:downloadId/comments', async (req, res) => {
    try {
        const { downloadId } = req.params;
        const download = await Download.getDownloadById(downloadId);
        if (!download) {
            return res.status(404).json({ success: false, message: 'Download não encontrado' });
        }

        const viewer = await getViewerAdultContext(req);
        const adultAccess = getAdultAccessDecision(download, viewer);
        if (!adultAccess.allowed) {
            return res.status(403).json({ success: false, message: adultAccess.message });
        }

        const comments = await DownloadComment.getDownloadComments(downloadId);

        res.json({
            success: true,
            comments: comments
        });

    } catch (error) {
        console.error('Erro ao obter comentários:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter comentários' });
    }
});

// PUT - Editar comentário
router.put('/comments/:commentId', protect, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        const content = String(req.body?.content || '');
        const trimmedContent = content.trim();

        const comment = await DownloadComment.getCommentById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        const canManage = await Download.canManageDownloads(userId);
        let canEditComment = Number(comment.userId) === Number(userId) || canManage;

        if (!canEditComment) {
            const parentDownload = await Download.getDownloadById(comment.downloadId);
            if (parentDownload && Number(parentDownload.userId) === Number(userId)) {
                canEditComment = true;
            }
        }

        if (!canEditComment) {
            return res.status(403).json({
                success: false,
                message: 'Você não pode editar este comentário'
            });
        }

        if (!trimmedContent && !comment.attachmentPath) {
            return res.status(400).json({
                success: false,
                message: 'Comentário vazio. Digite algo ou mantenha um anexo.'
            });
        }

        if (trimmedContent.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'Comentário muito longo (máximo 500 caracteres)'
            });
        }

        await DownloadComment.updateComment(commentId, trimmedContent);
        const updatedComment = await DownloadComment.getCommentById(commentId);

        res.json({
            success: true,
            message: 'Comentário editado com sucesso!',
            comment: updatedComment
        });
    } catch (error) {
        console.error('Erro ao editar comentário:', error);
        res.status(500).json({ success: false, message: 'Erro ao editar comentário' });
    }
});

// DELETE - Deletar comentário
router.delete('/comments/:commentId', protect, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;

        // Obter comentário
        const comment = await DownloadComment.getCommentById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        // Verificar permissão:
        // 1) autor do comentário
        // 2) dono da postagem
        // 3) usuário com permissão global de gerenciar downloads
        const canManage = await Download.canManageDownloads(userId);
        let canDeleteComment = Number(comment.userId) === Number(userId) || canManage;

        if (!canDeleteComment) {
            const parentDownload = await Download.getDownloadById(comment.downloadId);
            if (parentDownload && Number(parentDownload.userId) === Number(userId)) {
                canDeleteComment = true;
            }
        }

        if (!canDeleteComment) {
            return res.status(403).json({
                success: false,
                message: 'Você não pode deletar este comentário'
            });
        }

        // Deletar
        await DownloadComment.deleteComment(commentId);
        await removeCommentAttachmentFileByPath(comment.attachmentPath);

        res.json({
            success: true,
            message: 'Comentário deletado com sucesso!'
        });

    } catch (error) {
        console.error('Erro ao deletar comentário:', error);
        res.status(500).json({ success: false, message: 'Erro ao deletar comentário' });
    }
});

// PATCH - Fixar/Desafixar comentário
router.patch('/comments/:commentId/pin', protect, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user?.id;
        const { isPinned } = req.body;

        console.log('[PATCH PIN] RecebidoRequest:', { commentId, userId, isPinned, userObj: req.user });

        if (!userId) {
            console.log('[PATCH PIN] Usuário não identificado');
            return res.status(401).json({ success: false, message: 'Usuário não identificado' });
        }

        // Obter comentário
        const comment = await DownloadComment.getCommentById(commentId);
        if (!comment) {
            console.log('[PATCH PIN] Comentário não encontrado:', commentId);
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        // Verificar permissões: APENAS moderadores/admins (nível 60+)
        const userHierarchy = await new Promise((resolve, reject) => {
            db.get(
                `SELECT MAX(COALESCE(cr.hierarchyLevel, 0)) AS maxLevel
                 FROM user_custom_ranks ucr
                 JOIN custom_ranks cr ON ucr.customRankId = cr.id
                 WHERE ucr.userId = ? AND cr.enableAdminPanel = 1`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(Number(row?.maxLevel || 0));
                }
            );
        });
        
        // Verificar se é admin (ID 1) ou tem nível 60+
        const isAdmin = Number(userId) === 1;
        const isModeratorPlus = userHierarchy >= 60;
        const canManageDownloads = await Download.canManageDownloads(userId);
        const hasPermissionToPin = isAdmin || isModeratorPlus || canManageDownloads;

        console.log('[PATCH PIN] Permissões:', { 
            isAdmin,
            userHierarchy,
            isModeratorPlus,
            canManageDownloads,
            hasPermissionToPin,
            requester: userId 
        });

        if (!hasPermissionToPin) {
            console.log('[PATCH PIN] Acesso negado - usuário sem permissão');
            return res.status(403).json({
                success: false,
                message: 'Apenas moderadores e administradores podem fixar comentários.'
            });
        }

        // Atualizar status
        console.log('[PATCH PIN] Atualizando pin status para:', isPinned);
        await DownloadComment.setPinned(commentId, Boolean(isPinned), isPinned ? userId : null);

        const msg = isPinned ? 'Comentário fixado!' : 'Comentário desafixado!';
        console.log('[PATCH PIN] Sucesso:', msg);
        res.json({
            success: true,
            message: msg,
            isPinned: Boolean(isPinned)
        });

    } catch (error) {
        console.error('[PATCH PIN] Erro:', error);
        res.status(500).json({ success: false, message: 'Erro ao fixar comentário' });
    }
});

// POST - Adicionar reação em comentário
router.post('/comments/:commentId/reactions', protect, reactionRateLimiter, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        const { emoji } = req.body;

        if (!emoji || String(emoji).trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Emoji inválido' });
        }

        // Obter comentário
        const comment = await DownloadComment.getCommentById(commentId);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        const safeEmoji = String(emoji).trim();

        // Adicionar ou remover reação
        db.query = (query, params, callback) => {
            db.run(query, params, callback);
        };
        db.query = (query, params, callback) => {
            db.get(query, params, callback);
        };

        db.run(
            `INSERT OR IGNORE INTO comment_reactions (commentId, userId, emoji) VALUES (?, ?, ?)`,
            [commentId, userId, safeEmoji],
            function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Erro ao adicionar reação' });
                }

                // Se foi inserido (IGNORE fez nada), vamos remover
                if (this.changes === 0) {
                    db.run(
                        `DELETE FROM comment_reactions WHERE commentId = ? AND userId = ? AND emoji = ?`,
                        [commentId, userId, safeEmoji],
                        function(err) {
                            if (err) {
                                return res.status(500).json({ success: false, message: 'Erro ao remover reação' });
                            }

                            db.all(
                                `SELECT emoji, COUNT(*) as count FROM comment_reactions WHERE commentId = ? GROUP BY emoji`,
                                [commentId],
                                (err, reactions) => {
                                    if (err) {
                                        return res.status(500).json({ success: false, message: 'Erro ao buscar reações' });
                                    }

                                    res.json({
                                        success: true,
                                        message: 'Reação removida!',
                                        reactions: (reactions || []).map((r) => ({ emoji: r.emoji, count: r.count })),
                                        userReacted: false
                                    });
                                }
                            );
                        }
                    );
                } else {
                    db.all(
                        `SELECT emoji, COUNT(*) as count FROM comment_reactions WHERE commentId = ? GROUP BY emoji`,
                        [commentId],
                        (err, reactions) => {
                            if (err) {
                                return res.status(500).json({ success: false, message: 'Erro ao buscar reações' });
                            }

                            res.json({
                                success: true,
                                message: 'Reação adicionada!',
                                reactions: (reactions || []).map((r) => ({ emoji: r.emoji, count: r.count })),
                                userReacted: true
                            });
                        }
                    );
                }
            }
        );

    } catch (error) {
        console.error('Erro ao adicionar reação:', error);
        res.status(500).json({ success: false, message: 'Erro ao adicionar reação' });
    }
});

// ===================== NOTIFICAÇÕES =====================

// GET - Obter notificações não lidas
router.get('/notifications/unread', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const notifications = await Notification.getUnreadNotifications(userId);
        const unreadCount = await Notification.getUnreadCount(userId);

        res.json({
            success: true,
            notifications,
            unreadCount
        });

    } catch (error) {
        console.error('Erro ao obter notificações:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter notificações' });
    }
});

// GET - Obter todas as notificações
router.get('/notifications/all', protect, async (req, res) => {
    console.log('[NOTIF] Endpoint atingido! userId:', req.user.id);
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        console.log('[NOTIF] Chamando getAllNotifications com:', { userId, limit, offset });
        const notifications = await Notification.getAllNotifications(userId, limit, offset);
        console.log('[NOTIF] Retornado:', notifications.length, 'items');

        res.json({
            success: true,
            notifications
        });

    } catch (error) {
        console.error('[NOTIF ERROR] Erro ao obter notificações:', error?.message);
        console.error('[NOTIF ERROR] Stack:', error?.stack);
        console.error('[NOTIF ERROR] Full error:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter notificações' });
    }
});

// POST - Marcar notificação como lida
router.post('/notifications/:notificationId/read', protect, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;

        await Notification.markAsRead(notificationId, userId);

        res.json({
            success: true,
            message: 'Notificação marcada como lida'
        });

    } catch (error) {
        console.error('Erro ao marcar como lida:', error);
        res.status(500).json({ success: false, message: 'Erro ao marcar como lida' });
    }
});

// POST - Marcar todas as notificações como lidas
router.post('/notifications/mark-all-read', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await Notification.markAllAsRead(userId);

        res.json({
            success: true,
            message: 'Todas as notificações marcadas como lidas',
            updated: result.updated
        });

    } catch (error) {
        console.error('Erro ao marcar como lido:', error);
        res.status(500).json({ success: false, message: 'Erro ao marcar como lido' });
    }
});

// DELETE - Excluir uma notificação
router.delete('/notifications/:notificationId', protect, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;

        const result = await Notification.deleteNotification(notificationId, userId);

        res.json({
            success: true,
            message: 'Notificação excluída',
            deleted: result.deleted
        });
    } catch (error) {
        console.error('Erro ao excluir notificação:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir notificação' });
    }
});

// DELETE - Excluir todas as notificações do usuário
router.delete('/notifications/all', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await Notification.deleteAllNotifications(userId);

        res.json({
            success: true,
            message: 'Todas as notificações foram excluídas',
            deleted: result.deleted
        });
    } catch (error) {
        console.error('Erro ao excluir todas as notificações:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir todas as notificações' });
    }
});

// GET - Contar notificações não lidas
router.get('/notifications/count', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const unreadCount = await Notification.getUnreadCount(userId);

        res.json({
            success: true,
            unreadCount
        });

    } catch (error) {
        console.error('Erro ao contar notificações:', error);
        res.status(500).json({ success: false, message: 'Erro ao contar notificações' });
    }
});

// ====== ENDPOINTS DE POSTAGENS SUSPENSAS ======

// GET - Obter postagens suspensas do usuário
router.get('/suspended', protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const suspensions = await dbAll(
            `SELECT 
                ds.id,
                ds.downloadId,
                ds.reason,
                ds.status,
                ds.createdAt,
                d.name,
                d.description,
                d.link,
                d.links_json,
                d.isAdult,
                d.membersOnly
            FROM download_suspensions ds
            JOIN downloads d ON ds.downloadId = d.id
            WHERE ds.userId = ?
            ORDER BY ds.createdAt DESC`,
            [userId]
        );

        res.json({ success: true, suspensions: suspensions || [] });
    } catch (error) {
        console.error('Erro ao obter postagens suspensas:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter postagens suspensas' });
    }
});

// POST - Enviar postagem suspensa para review
router.post('/:downloadId/submit-for-review', protect, async (req, res) => {
    try {
        const { downloadId } = req.params;
        const userId = req.user.id;

        // Verificar se a postagem existe e pertence ao usuário
        const download = await dbGet(
            `SELECT d.id, d.userId FROM downloads d WHERE d.id = ?`,
            [downloadId]
        );

        if (!download) {
            return res.status(404).json({ success: false, message: 'Download não encontrado' });
        }

        if (download.userId !== userId) {
            return res.status(403).json({ success: false, message: 'Você não pode fazer review desta postagem' });
        }

        // Verificar se está suspensa
        const suspension = await dbGet(
            `SELECT id, status FROM download_suspensions WHERE downloadId = ?`,
            [downloadId]
        );

        if (!suspension) {
            return res.status(400).json({ success: false, message: 'Esta postagem não está suspensa' });
        }

        if (suspension.status !== 'suspended') {
            if (suspension.status === 'under_review') {
                return res.status(400).json({ success: false, message: 'Esta postagem já foi enviada para revisão e está sendo analisada pela equipe de moderação' });
            }
            return res.status(400).json({ success: false, message: 'Esta postagem não está pronta para enviar para revisão (status: ' + suspension.status + ')' });
        }

        // Atualizar status para under_review
        await dbRun(
            `UPDATE download_suspensions SET status = 'under_review' WHERE downloadId = ?`,
            [downloadId]
        );

        res.json({ success: true, message: 'Postagem enviada para revisão da equipe com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar postagem para review:', error);
        res.status(500).json({ success: false, message: 'Erro ao enviar postagem para review' });
    }
});

export default router;
