import express from 'express';
import User from '../models/User.js';
import Rank from '../models/Rank.js';
import Download from '../models/Download.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { protect, checkBanStatus } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { sendEmail } from '../utils/mailer.js';
import db from '../config/database.js';
import Notification from '../models/Notification.js';
import { getCustomRankByName } from '../config/ranks.js';
import { canAccessMembersDirectory } from '../utils/staff-hierarchy.js';
import { buildCodeEmail, buildNoticeEmail } from '../utils/transactional-email.js';
import { getProfileDisplayRanks } from './downloads.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OWNER_USER_ID = 1;
const OWNER_EMAIL = 'sustmanrft@hotmail.com';
const MEMBRO_BETA_RANK_NAME = 'Membro BETA';
const FOUNDER_ACHIEVEMENT_NAME_KEY = 'fundador';
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

async function getEmailChangeAdminRecipients() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT DISTINCT u.email
             FROM users u
             WHERE u.email IS NOT NULL
               AND TRIM(u.email) <> ''
               AND (
                    u.id = 1 OR EXISTS (
                        SELECT 1
                        FROM user_custom_ranks ucr
                        JOIN custom_ranks cr ON ucr.customRankId = cr.id
                        WHERE ucr.userId = u.id
                          AND COALESCE(cr.isStaffRole, 0) = 1
                          AND COALESCE(cr.hierarchyLevel, 0) >= 200
                    )
               )`,
            [],
            (err, rows) => err ? reject(err) : resolve((rows || []).map((row) => String(row.email || '').trim()).filter(Boolean))
        );
    });
}

async function notifyAdminsAboutEmailChangeRequest(user, newEmail, reason) {
    try {
        const recipients = await getEmailChangeAdminRecipients();
        if (!recipients.length) {
            return;
        }

        const subject = 'Ação necessária: solicitação de troca de e-mail';
        const emailMessage = buildNoticeEmail({
            title: 'Nova solicitação de troca de e-mail',
            greeting: 'equipe administrativa',
            intro: 'Um usuário solicitou a atualização do endereço de e-mail da conta. Revise os dados abaixo no painel administrativo antes de aprovar ou recusar.',
            status: 'Aguardando análise',
            details: [
                { label: 'Usuário', value: `${user?.nickname || user?.firstName || `ID ${user?.id}`} (ID ${user?.id})` },
                { label: 'Novo e-mail', value: newEmail },
                { label: 'Motivo informado', value: String(reason || 'Nenhum motivo informado').trim() || 'Nenhum motivo informado' }
            ],
            notice: 'Confirme se a solicitação corresponde ao pedido do usuário antes de atualizar o endereço cadastrado.',
            noticeTitle: 'Revisão de segurança'
        });

        await Promise.all(recipients.map((to) => sendEmail(to, subject, emailMessage.html, [], emailMessage.text).catch((mailError) => {
            console.error(`[EMAIL] Falha ao notificar admin sobre troca de e-mail para ${to}:`, mailError?.message || mailError);
        })));
    } catch (error) {
        console.error('[EMAIL] Erro ao notificar admins sobre troca de e-mail:', error?.message || error);
    }
}

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
const MAX_CUSTOM_ANIMATED_GIF_BYTES = 15 * 1024 * 1024;
const AVATAR_SCALE_MIN = 1;
const AVATAR_SCALE_MAX = 3;
const AVATAR_OFFSET_MIN = 0;
const AVATAR_OFFSET_MAX = 100;
const BANNER_SCALE_MIN = 0.01;
const BANNER_SCALE_MAX = 3;
const BANNER_OFFSET_MIN = 0;
const BANNER_OFFSET_MAX = 100;
const PROFILE_TAGLINE_MAX_LENGTH = 100;
const PROFILE_TAGLINE_STORAGE_MAX_LENGTH = 2000;
const PROFILE_TAG_MAX_LENGTH = 4;
const EXCLUSIVE_ANIMATED_PROFILE_THEMES = new Set([
    'theme-void-rift',
    'theme-solar-flare',
    'theme-glitchwave'
]);
const USER_MISSIONS = [
    {
        key: 'postagens_iniciais',
        title: 'Primeiros Downloads',
        description: 'Publique 2 postagens para liberar o Perfil Animado.',
        requirementLabel: '2 postagens',
        rewardLabel: 'Perfil Animado',
        unlockCompletedCount: 0,
        getProgress: (stats) => ({
            current: Number(stats?.postCount || 0),
            target: 2
        }),
        isCompleted: (stats) => Number(stats?.postCount || 0) >= 2,
        applyReward: (userId) => grantMissionUserFlags(userId, { canUseAnimatedProfile: 1 })
    },
    {
        key: 'colecionador_de_postagens',
        title: 'Colecionador de Postagens',
        description: 'Publique 5 postagens para poder ordenar todas as suas conquistas.',
        requirementLabel: '5 postagens',
        rewardLabel: 'Ordenar todas as conquistas',
        unlockCompletedCount: 0,
        getProgress: (stats) => ({
            current: Number(stats?.postCount || 0),
            target: 5
        }),
        isCompleted: (stats) => Number(stats?.postCount || 0) >= 5,
        applyReward: (userId) => grantMissionUserFlags(userId, { canOrderFixedRanks: 1 })
    },
    {
        key: 'popularidade_em_alta',
        title: 'Popularidade em Alta',
        description: 'Receba 15 likes nas suas postagens para mudar a cor da própria conquista.',
        requirementLabel: '15 likes recebidos',
        rewardLabel: 'Mudar cor da própria conquista',
        unlockCompletedCount: 1,
        getProgress: (stats) => ({
            current: Number(stats?.likesReceived || 0),
            target: 15
        }),
        isCompleted: (stats) => Number(stats?.likesReceived || 0) >= 15,
        applyReward: (userId) => grantMissionUserFlags(userId, { canChangeRankColor: 1 })
    },
    {
        key: 'voz_ativa',
        title: 'Voz Ativa',
        description: 'Faça 10 comentários para liberar links na frase do perfil.',
        requirementLabel: '10 comentários feitos',
        rewardLabel: 'Frase com link',
        unlockCompletedCount: 2,
        getProgress: (stats) => ({
            current: Number(stats?.commentsMade || 0),
            target: 10
        }),
        isCompleted: (stats) => Number(stats?.commentsMade || 0) >= 10,
        applyReward: (userId) => grantMissionUserFlags(userId, { canUseProfileTaglineLinks: 1 })
    },
    {
        key: 'favoritado_pela_guilda',
        title: 'Favoritado pela Guilda',
        description: 'Receba 5 favoritos para liberar temas exclusivos do Perfil Animado.',
        requirementLabel: '5 favoritos recebidos',
        rewardLabel: 'Tema exclusivo de perfil animado',
        unlockCompletedCount: 4,
        getProgress: (stats) => ({
            current: Number(stats?.favoritesReceived || 0),
            target: 5
        }),
        isCompleted: (stats) => Number(stats?.favoritesReceived || 0) >= 5,
        applyReward: (userId) => grantMissionUserFlags(userId, { canUseExclusiveAnimatedThemes: 1 })
    },
    {
        key: 'criador_presente',
        title: 'Criador Presente',
        description: 'Publique 1 postagem e faça 3 comentários para liberar GIF próprio no Perfil Animado.',
        requirementLabel: '1 postagem + 3 comentários',
        rewardLabel: 'GIF próprio no perfil animado',
        unlockCompletedCount: 4,
        getProgress: (stats) => ({
            current: Math.min(Number(stats?.postCount || 0), 1) + Math.min(Number(stats?.commentsMade || 0), 3),
            target: 4,
            detail: `Postagens: ${Math.min(Number(stats?.postCount || 0), 1)}/1 | Comentários: ${Math.min(Number(stats?.commentsMade || 0), 3)}/3`
        }),
        isCompleted: (stats) => Number(stats?.postCount || 0) >= 1 && Number(stats?.commentsMade || 0) >= 3,
        applyReward: (userId) => grantMissionUserFlags(userId, { canUseAnimatedProfileCustomGif: 1 })
    }
];
const USER_MISSION_MAP = new Map(USER_MISSIONS.map((mission) => [mission.key, mission]));

function getProfileTaglineVisibleText(value) {
    return String(value || '')
        .replace(/\[([^\]\r\n]{1,100})\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi, '$1')
        .replace(/([^()\s<\[\]]{1,100})\(((?:https?:\/\/|www\.)[^\s)]+)\)/gi, '$1');
}

function profileTaglineContainsLinkMarkup(value) {
    return /\[([^\]\r\n]{1,100})\]\(((?:https?:\/\/|www\.)[^\s)]+)\)/i.test(String(value || ''))
        || /([^()\s<\[\]]{1,100})\(((?:https?:\/\/|www\.)[^\s)]+)\)/i.test(String(value || ''));
}

function isOwnerAccount(user) {
    const email = String(user?.email || '').trim().toLowerCase();
    return Number(user?.id) === OWNER_USER_ID || email === OWNER_EMAIL;
}

function dbGetAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function dbAllAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

function dbRunAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function userCanUseProfileTaglineLinks(userId) {
    const userRow = await dbGetAsync('SELECT id, email, canUseProfileTaglineLinks FROM users WHERE id = ?', [userId]);
    if (!userRow) return false;
    return isOwnerAccount(userRow) || Number(userRow.canUseProfileTaglineLinks) === 1;
}

async function userCanUseExclusiveAnimatedThemes(userId) {
    const userRow = await dbGetAsync('SELECT id, email, canUseExclusiveAnimatedThemes FROM users WHERE id = ?', [userId]);
    if (!userRow) return false;
    return isOwnerAccount(userRow) || Number(userRow.canUseExclusiveAnimatedThemes) === 1;
}

async function userCanUseAnimatedProfileCustomGif(userId) {
    const userRow = await dbGetAsync('SELECT id, email, canUseAnimatedProfileCustomGif FROM users WHERE id = ?', [userId]);
    if (!userRow) return false;
    return isOwnerAccount(userRow) || Number(userRow.canUseAnimatedProfileCustomGif) === 1;
}

async function grantMissionUserFlags(userId, flags = {}) {
    const entries = Object.entries(flags).filter(([, value]) => value !== undefined);
    if (!entries.length) return;

    const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
    const params = entries.map(([, value]) => (value ? 1 : 0));
    params.push(userId);

    await dbRunAsync(`UPDATE users SET ${setClause} WHERE id = ?`, params);
}

async function getMissionProgressStats(userId) {
    const [downloadStats, commentRow, favoriteRow] = await Promise.all([
        Download.getUserStats(userId),
        dbGetAsync(
            `SELECT COUNT(*) AS commentsMade
             FROM download_comments
             WHERE userId = ?`,
            [userId]
        ),
        dbGetAsync(
            `SELECT COUNT(*) AS favoritesReceived
             FROM downloads d
             JOIN download_favorites df ON df.downloadId = d.id
             WHERE d.userId = ?`,
            [userId]
        )
    ]);

    const likesHistorical = Number(downloadStats?.totalLikesHistorical ?? downloadStats?.totalLikes ?? 0);
    const likesCurrent = Number(downloadStats?.totalLikesCurrent || 0);

    return {
        postCount: Number(downloadStats?.totalPostages || 0),
        likesReceived: Math.max(likesHistorical, likesCurrent),
        commentsMade: Number(commentRow?.commentsMade || 0),
        favoritesReceived: Number(favoriteRow?.favoritesReceived || 0)
    };
}

async function getUserMissionRows(userId) {
    return dbAllAsync(
        `SELECT missionKey, acceptedAt, completedAt, rewardGrantedAt
         FROM user_missions
         WHERE userId = ?`,
        [userId]
    );
}

async function applyMissionRewardIfNeeded(userId, missionKey, missionRow) {
    const mission = USER_MISSION_MAP.get(missionKey);
    if (!mission || !missionRow?.completedAt || missionRow?.rewardGrantedAt) return;

    await mission.applyReward(userId);
    await dbRunAsync(
        `UPDATE user_missions
         SET rewardGrantedAt = COALESCE(rewardGrantedAt, CURRENT_TIMESTAMP)
         WHERE userId = ? AND missionKey = ?`,
        [userId, missionKey]
    );
}

async function evaluateUserMissions(userId) {
    const stats = await getMissionProgressStats(userId);
    const rows = await getUserMissionRows(userId);
    const rowMap = new Map(rows.map((row) => [row.missionKey, row]));

    for (const mission of USER_MISSIONS) {
        const row = rowMap.get(mission.key);
        if (!row?.acceptedAt || row?.completedAt) continue;
        if (!mission.isCompleted(stats)) continue;

        await dbRunAsync(
            `UPDATE user_missions
             SET completedAt = COALESCE(completedAt, CURRENT_TIMESTAMP)
             WHERE userId = ? AND missionKey = ?`,
            [userId, mission.key]
        );
    }

    const refreshedRows = await getUserMissionRows(userId);
    const refreshedRowMap = new Map(refreshedRows.map((row) => [row.missionKey, row]));
    for (const mission of USER_MISSIONS) {
        await applyMissionRewardIfNeeded(userId, mission.key, refreshedRowMap.get(mission.key));
    }

    return {
        stats,
        rows: await getUserMissionRows(userId)
    };
}

async function getMissionRewardPermissions(userId) {
    const user = await dbGetAsync(
        `SELECT id,
                email,
                canUseAnimatedProfile,
                canOrderFixedRanks,
                canChangeRankColor,
                canUseProfileTaglineLinks,
                canUseExclusiveAnimatedThemes,
                canUseAnimatedProfileCustomGif
         FROM users
         WHERE id = ?`,
        [userId]
    );

    if (!user) {
        return {
            canUseAnimatedProfile: false,
            canOrderFixedRanks: false,
            canChangeRankColor: false,
            canUseProfileTaglineLinks: false,
            canUseExclusiveAnimatedThemes: false,
            canUseAnimatedProfileCustomGif: false
        };
    }

    const isOwner = isOwnerAccount(user);
    const [rankAllowsOrderAll, rankAllowsColorChange, rankAllowsAnimatedProfile] = await Promise.all([
        dbGetAsync(
            `SELECT 1 AS allowed
             FROM user_custom_ranks ucr
             JOIN custom_ranks cr ON cr.id = ucr.customRankId
             WHERE ucr.userId = ? AND cr.canOrderAllRanks = 1
             LIMIT 1`,
            [userId]
        ),
        dbGetAsync(
            `SELECT 1 AS allowed
             FROM user_custom_ranks ucr
             JOIN custom_ranks cr ON cr.id = ucr.customRankId
             WHERE ucr.userId = ? AND cr.canChangeOwnColor = 1
             LIMIT 1`,
            [userId]
        ),
        dbGetAsync(
            `SELECT 1 AS allowed
             FROM user_custom_ranks ucr
             JOIN custom_ranks cr ON cr.id = ucr.customRankId
             WHERE ucr.userId = ? AND cr.canUseAnimatedProfile = 1
             LIMIT 1`,
            [userId]
        )
    ]);

    return {
        canUseAnimatedProfile: isOwner || Number(user.canUseAnimatedProfile) === 1 || Boolean(rankAllowsAnimatedProfile),
        canOrderFixedRanks: isOwner || Number(user.canOrderFixedRanks) === 1 || Boolean(rankAllowsOrderAll),
        canChangeRankColor: isOwner || Number(user.canChangeRankColor) === 1 || Boolean(rankAllowsColorChange),
        canUseProfileTaglineLinks: isOwner || Number(user.canUseProfileTaglineLinks) === 1,
        canUseExclusiveAnimatedThemes: isOwner || Number(user.canUseExclusiveAnimatedThemes) === 1,
        canUseAnimatedProfileCustomGif: isOwner || Number(user.canUseAnimatedProfileCustomGif) === 1
    };
}

async function buildMissionPayload(userId) {
    const evaluation = await evaluateUserMissions(userId);
    const rowMap = new Map((evaluation.rows || []).map((row) => [row.missionKey, row]));
    const permissions = await getMissionRewardPermissions(userId);

    // First pass: build missions data
    let missions = USER_MISSIONS.map((mission) => {
        const row = rowMap.get(mission.key) || null;
        const progress = mission.getProgress(evaluation.stats || {});
        const isCompleted = Boolean(row?.completedAt) || mission.isCompleted(evaluation.stats || {});
        const isAccepted = Boolean(row?.acceptedAt);

        return {
            key: mission.key,
            title: mission.title,
            description: mission.description,
            requirementLabel: mission.requirementLabel,
            rewardLabel: mission.rewardLabel,
            unlockCompletedCount: mission.unlockCompletedCount,
            progress: {
                current: Number(progress?.current || 0),
                target: Number(progress?.target || 0),
                detail: String(progress?.detail || '')
            },
            accepted: isAccepted,
            completed: isCompleted,
            unlocked: false, // Will be set in second pass
            acceptedAt: row?.acceptedAt || null,
            completedAt: row?.completedAt || null,
            rewardGrantedAt: row?.rewardGrantedAt || null
        };
    });

    // Second pass: calculate completedCount and update unlocked status
    const completedCount = missions.filter((mission) => mission.completed).length;
    missions = missions.map((mission) => ({
        ...mission,
        unlocked: mission.unlockCompletedCount <= completedCount || mission.accepted || mission.completed
    }));

    return {
        missions,
        summary: {
            total: USER_MISSIONS.length,
            completed: completedCount
        },
        permissions
    };
}
const PROFILE_TAG_STYLE_OPTIONS = new Set([
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
]);
const PROFILE_TAG_SYMBOL_OPTIONS = new Set([
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
]);
const PROFILE_TAG_BANNER_OPTIONS = new Set([
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

function normalizeProfileTagStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'none';
    return PROFILE_TAG_STYLE_OPTIONS.has(raw) ? raw : 'none';
}

function normalizeProfileTagSymbolStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'none';
    return PROFILE_TAG_SYMBOL_OPTIONS.has(raw) ? raw : 'none';
}

function normalizeProfileTagBannerStyle(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'pill';
    return PROFILE_TAG_BANNER_OPTIONS.has(raw) ? raw : 'pill';
}

function normalizeProfileTagBool(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    const raw = String(value || '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
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

const animatedGifStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/animated-gifs');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `animated-${Date.now()}-${Math.round(Math.random() * 1e9)}.gif`);
    }
});

const uploadAnimatedGif = multer({
    storage: animatedGifStorage,
    limits: { fileSize: MAX_CUSTOM_ANIMATED_GIF_BYTES },
    fileFilter: (req, file, cb) => {
        const ext = String(path.extname(file.originalname || '')).toLowerCase();
        const mime = String(file.mimetype || '').toLowerCase();
        const isGif = ext === '.gif' && mime === 'image/gif';
        if (isGif) return cb(null, true);
        cb(new Error('Apenas arquivos .gif são permitidos.'));
    }
});

function normalizeBirthDateInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    // Formato ISO esperado de input[type=date]
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }

    // Aceitar formato BR dd/mm/yyyy
    const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) {
        const [, dd, mm, yyyy] = brMatch;
        return `${yyyy}-${mm}-${dd}`;
    }

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isAtLeast13YearsOld(birthDateIso) {
    const birth = new Date(`${birthDateIso}T00:00:00Z`);
    if (Number.isNaN(birth.getTime())) return false;

    const today = new Date();
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - birth.getUTCMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
        age--;
    }

    return age >= 13;
}

function getAgeFromBirthDateIso(birthDateIso) {
    const birth = new Date(`${birthDateIso}T00:00:00Z`);
    if (Number.isNaN(birth.getTime())) return 0;

    const today = new Date();
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - birth.getUTCMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
        age--;
    }

    return Math.max(0, age);
}

function normalizeAqwCharPageUrl(value) {
    if (value === undefined) {
        return { ok: true, url: undefined };
    }

    const raw = String(value || '').trim();
    if (!raw) {
        return { ok: true, url: null };
    }

    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        return { ok: false, message: 'Link da Char Page AQW inválido.' };
    }

    const host = String(parsed.hostname || '').toLowerCase();
    if (host !== 'account.aq.com' && host !== 'www.account.aq.com') {
        return { ok: false, message: 'Use apenas link oficial account.aq.com/CharPage.' };
    }

    const path = String(parsed.pathname || '').toLowerCase();
    if (path !== '/charpage') {
        return { ok: false, message: 'Link inválido. Use /CharPage?id=SeuNick.' };
    }

    let charId = parsed.searchParams.get('id');
    if (!charId) {
        for (const [key, val] of parsed.searchParams.entries()) {
            if (String(key || '').toLowerCase() === 'id') {
                charId = val;
                break;
            }
        }
    }

    const cleanId = String(charId || '').trim();
    if (!cleanId) {
        return { ok: false, message: 'Informe o id do personagem no parâmetro ?id=' };
    }

    if (!/^[A-Za-z0-9 _\-.']{2,40}$/.test(cleanId)) {
        return { ok: false, message: 'ID do personagem inválido na Char Page.' };
    }

    return {
        ok: true,
        url: `https://account.aq.com/CharPage?id=${encodeURIComponent(cleanId)}`
    };
}

function normalizeAnimatedProfileVisualMode(value) {
    const raw = String(value || 'theme').trim().toLowerCase();
    return ALLOWED_ANIMATED_VISUAL_MODES.has(raw) ? raw : 'theme';
}

function normalizeAnimatedProfileTheme(value) {
    const raw = String(value || 'auto').trim();
    if (LEGACY_GIF_THEMES.has(raw)) return 'auto';
    return ALLOWED_ANIMATED_PROFILE_THEMES.has(raw) ? raw : 'auto';
}

function normalizeAnimatedGifUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    if (raw.startsWith('/uploads/animated-gifs/')) {
        return raw;
    }

    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        return null;
    }

    const protocol = String(parsed.protocol || '').toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
        return null;
    }

    return parsed.toString();
}

function normalizeAnimatedProfileGiphyId(value) {
    const raw = String(value || '').trim();
    return /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : '';
}

function normalizeAvatarScaleInput(value) {
    if (value === undefined) return undefined;
    const parsed = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed)) return null;
    const clamped = Math.min(AVATAR_SCALE_MAX, Math.max(AVATAR_SCALE_MIN, parsed));
    return Number(clamped.toFixed(4));
}

function normalizeAvatarOffsetInput(value) {
    if (value === undefined) return undefined;
    const parsed = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed)) return null;
    const clamped = Math.min(AVATAR_OFFSET_MAX, Math.max(AVATAR_OFFSET_MIN, parsed));
    return Number(clamped.toFixed(2));
}

function normalizeBannerScaleInput(value) {
    if (value === undefined) return undefined;
    const parsed = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed)) return null;
    const clamped = Math.min(BANNER_SCALE_MAX, Math.max(BANNER_SCALE_MIN, parsed));
    return Number(clamped.toFixed(4));
}

function normalizeBannerOffsetInput(value) {
    if (value === undefined) return undefined;
    const parsed = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed)) return null;
    const clamped = Math.min(BANNER_OFFSET_MAX, Math.max(BANNER_OFFSET_MIN, parsed));
    return Number(clamped.toFixed(2));
}

function normalizeHexColorInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const prefixed = raw.startsWith('#') ? raw : `#${raw}`;
    const shortMatch = prefixed.match(/^#([0-9a-fA-F]{3})$/);
    if (shortMatch) {
        const [r, g, b] = shortMatch[1].split('');
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
    }

    if (/^#[0-9a-fA-F]{6}$/.test(prefixed)) {
        return prefixed.toUpperCase();
    }

    return '';
}

function normalizeRankOrderValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Number(value);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;

        const asNumber = Number(trimmed);
        if (Number.isFinite(asNumber)) {
            return asNumber;
        }

        if (ALLOWED_FIXED_RANK_KEYS.has(trimmed)) {
            return trimmed;
        }
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

function orderKeyMapKey(value) {
    return typeof value === 'number' ? `n:${value}` : `s:${String(value)}`;
}

function normalizeRankNameKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function isOwnerUser(userEmail, userId = null) {
    const normalizedUserId = Number(userId);
    if (Number.isFinite(normalizedUserId) && normalizedUserId === OWNER_USER_ID) {
        return true;
    }
    return String(userEmail || '').trim().toLowerCase() === OWNER_EMAIL;
}

function isOwnerFounderRank(userEmail, rankName, userId = null) {
    const rankNameKey = normalizeRankNameKey(rankName);
    const isFounder =
        rankNameKey === FOUNDER_ACHIEVEMENT_NAME_KEY ||
        rankNameKey.includes(FOUNDER_ACHIEVEMENT_NAME_KEY);
    return isOwnerUser(userEmail, userId) && isFounder;
}

function rankDisplayKey(rank, fallbackOrderKey = null) {
    if (!rank) return '';

    const isFixedLike =
        Boolean(rank.isFixed) ||
        Number(rank.isVisible) === 0 ||
        String(rank.id || '').startsWith('fixed:');

    if (isFixedLike) {
        const name = String(rank.name || '').trim().toLowerCase();
        if (name) return `fixed-name:${name}`;
    }

    const id = rank?.id ?? fallbackOrderKey;
    if (id === null || id === undefined) return '';
    return orderKeyMapKey(id);
}

async function getHighestOwnedProgressionRank(userId, fallbackRank = null) {
    const progressionRows = await dbAllAsync(
        `SELECT
            cr.id,
            cr.name,
            COALESCE(NULLIF(TRIM(ucr.customColor), ''), cr.color) AS color,
            cr.color AS baseColor,
            ucr.customColor AS customColor,
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
            id: FIXED_AUTO_RANK_KEY,
            name: top.name,
            color: top.color,
            baseColor: top.baseColor || top.color,
            customColor: top.customColor || null,
            description: top.description || 'conquista automático atual',
            customText: top.customText || '',
            backgroundImage: null,
            isVisible: 0,
            rankGroup: 'fixed_automatic',
            icon: top.icon || '',
            isFixed: true
        };
    }

    return fallbackRank || null;
}

async function userHasRankColorPermission(userId) {
    const userRow = await new Promise((resolve, reject) => {
        db.get(
            `SELECT
                u.email,
                u.canChangeRankColor,
                EXISTS (
                    SELECT 1
                    FROM user_custom_ranks ucr
                    JOIN custom_ranks cr ON cr.id = ucr.customRankId
                    WHERE ucr.userId = u.id
                      AND cr.canChangeOwnColor = 1
                    LIMIT 1
                ) AS hasRankColorPermission
             FROM users u
             WHERE u.id = ?`,
            [userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            }
        );
    });
    if (!userRow) return false;

    if (String(userRow.email || '').toLowerCase() === OWNER_EMAIL) return true;
    return Number(userRow.canChangeRankColor) === 1 || Number(userRow.hasRankColorPermission) === 1;
}

async function userHasAnimatedProfilePermission(userId) {
    const userRow = await new Promise((resolve, reject) => {
        db.get('SELECT id, email, canUseAnimatedProfile FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
    if (!userRow) return false;

    if (isOwnerAccount(userRow)) return true;
    if (Number(userRow.canUseAnimatedProfile) === 1) return true;

    const rankAllows = await new Promise((resolve, reject) => {
        db.get(
            `SELECT 1 AS allowed
             FROM user_custom_ranks ucr
             JOIN custom_ranks cr ON cr.id = ucr.customRankId
             WHERE ucr.userId = ? AND cr.canUseAnimatedProfile = 1
             LIMIT 1`,
            [userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(Boolean(row));
            }
        );
    });
    return rankAllows;
}

// UPDATE PROFILE
router.put('/profile', protect, checkBanStatus, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
]), async (req, res) => {
    try {
        const {
            bio,
            firstName,
            lastName,
            nickname,
            email,
            birthDate,
            profileTagline,
            profileTag,
            profileTagStyle,
            profileTagColor,
            profileTagTextColor,
            profileTagSymbolStyle,
            profileTagBannerStyle,
            profileTagGradientStart,
            profileTagGradientEnd,
            profileTagUseGradient,
            showFullNameInMiniProfile,
            aqwCharPageUrl
        } = req.body;
        const userId = req.user.id;

        let updateData = {};
        
        if (bio !== undefined) updateData.bio = bio;
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (nickname) updateData.nickname = nickname;
        if (email) updateData.email = email;
        if (birthDate !== undefined) {
            const currentUser = await User.findById(userId);
            if (!currentUser) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
            }

            const normalizedBirthDate = normalizeBirthDateInput(birthDate);
            if (!normalizedBirthDate) {
                return res.status(400).json({ success: false, message: 'Data de nascimento inválida. Use o formato YYYY-MM-DD ou DD/MM/AAAA.' });
            }

            const currentBirthDate = normalizeBirthDateInput(currentUser.birthDate);
            if (currentBirthDate) {
                if (normalizedBirthDate !== currentBirthDate) {
                    return res.status(403).json({
                        success: false,
                        message: 'Data de nascimento não pode ser alterada após o cadastro.'
                    });
                }
            } else {
                const todayIso = new Date().toISOString().slice(0, 10);
                if (normalizedBirthDate > todayIso) {
                    return res.status(400).json({ success: false, message: 'Data de nascimento não pode ser no futuro.' });
                }

                if (!isAtLeast13YearsOld(normalizedBirthDate)) {
                    return res.status(400).json({ success: false, message: 'Você deve ter pelo menos 13 anos.' });
                }

                updateData.birthDate = normalizedBirthDate;
            }
        }
        if (profileTagline !== undefined) {
            const normalizedTagline = String(profileTagline || '').replace(/\r\n/g, '\n').trim();
            if (normalizedTagline.length > PROFILE_TAGLINE_STORAGE_MAX_LENGTH) {
                return res.status(400).json({
                    success: false,
                    message: 'Frase do perfil ficou grande demais por causa do link. Use uma URL menor.'
                });
            }

            const visibleTagline = getProfileTaglineVisibleText(normalizedTagline);
            if (visibleTagline.length > PROFILE_TAGLINE_MAX_LENGTH) {
                return res.status(400).json({
                    success: false,
                    message: `Frase visível do perfil deve ter no máximo ${PROFILE_TAGLINE_MAX_LENGTH} caracteres.`
                });
            }

            const canUseLinks = await userCanUseProfileTaglineLinks(userId);
            if (!canUseLinks && profileTaglineContainsLinkMarkup(normalizedTagline)) {
                return res.status(403).json({
                    success: false,
                    message: 'Você ainda não desbloqueou links na frase do perfil.'
                });
            }
            updateData.profileTagline = normalizedTagline;
        }
        if (profileTag !== undefined) {
            const normalizedTag = String(profileTag || '').replace(/\s+/g, '').trim();
            if (normalizedTag.length > PROFILE_TAG_MAX_LENGTH) {
                return res.status(400).json({
                    success: false,
                    message: `Tag do perfil deve ter no máximo ${PROFILE_TAG_MAX_LENGTH} caracteres.`
                });
            }
            updateData.profileTag = normalizedTag;
        }
        if (profileTagStyle !== undefined) {
            updateData.profileTagStyle = normalizeProfileTagStyle(profileTagStyle);
        }
        if (profileTagColor !== undefined) {
            updateData.profileTagColor = normalizeProfileTagColor(profileTagColor);
        }
        if (profileTagTextColor !== undefined) {
            updateData.profileTagTextColor = normalizeProfileTagColor(profileTagTextColor);
        }
        if (profileTagSymbolStyle !== undefined) {
            updateData.profileTagSymbolStyle = normalizeProfileTagSymbolStyle(profileTagSymbolStyle);
        }
        if (profileTagBannerStyle !== undefined) {
            updateData.profileTagBannerStyle = normalizeProfileTagBannerStyle(profileTagBannerStyle);
        }
        if (profileTagGradientStart !== undefined) {
            updateData.profileTagGradientStart = normalizeProfileTagColor(profileTagGradientStart);
        }
        if (profileTagGradientEnd !== undefined) {
            updateData.profileTagGradientEnd = normalizeProfileTagColor(profileTagGradientEnd);
        }
        if (profileTagUseGradient !== undefined) {
            const normalized = String(profileTagUseGradient).trim().toLowerCase();
            updateData.profileTagUseGradient = normalized === '1' || normalized === 'true' || normalized === 'yes';
        }
        if (showFullNameInMiniProfile !== undefined) {
            updateData.showFullNameInMiniProfile = normalizeProfileTagBool(showFullNameInMiniProfile) ? 1 : 0;
        }
        if (aqwCharPageUrl !== undefined) {
            const parsedAqwUrl = normalizeAqwCharPageUrl(aqwCharPageUrl);
            if (!parsedAqwUrl.ok) {
                return res.status(400).json({ success: false, message: parsedAqwUrl.message });
            }
            updateData.aqwCharPageUrl = parsedAqwUrl.url;
        }
        const clearAvatarRaw = String(req.body?.clearAvatar || '').trim().toLowerCase();
        const shouldClearAvatar = clearAvatarRaw === '1' || clearAvatarRaw === 'true' || clearAvatarRaw === 'yes';
        const clearBannerRaw = String(req.body?.clearBanner || '').trim().toLowerCase();
        const shouldClearBanner = clearBannerRaw === '1' || clearBannerRaw === 'true' || clearBannerRaw === 'yes';

        const avatarScale = normalizeAvatarScaleInput(req.body?.avatarScale);
        if (avatarScale === null) {
            return res.status(400).json({
                success: false,
                message: 'Zoom do avatar inválido. Use um valor entre 1 e 3.'
            });
        }
        if (avatarScale !== undefined) {
            updateData.avatarScale = avatarScale;
        }

        const avatarOffsetX = normalizeAvatarOffsetInput(req.body?.avatarOffsetX);
        if (avatarOffsetX === null) {
            return res.status(400).json({
                success: false,
                message: 'Posição horizontal do avatar inválida.'
            });
        }
        if (avatarOffsetX !== undefined) {
            updateData.avatarOffsetX = avatarOffsetX;
        }

        const avatarOffsetY = normalizeAvatarOffsetInput(req.body?.avatarOffsetY);
        if (avatarOffsetY === null) {
            return res.status(400).json({
                success: false,
                message: 'Posição vertical do avatar inválida.'
            });
        }
        if (avatarOffsetY !== undefined) {
            updateData.avatarOffsetY = avatarOffsetY;
        }

        const bannerScale = normalizeBannerScaleInput(req.body?.bannerScale);
        if (bannerScale === null) {
            return res.status(400).json({
                success: false,
                message: 'Zoom do banner inválido. Use um valor entre 0.01 e 3.'
            });
        }
        if (bannerScale !== undefined) {
            updateData.bannerScale = bannerScale;
        }

        const bannerOffsetX = normalizeBannerOffsetInput(req.body?.bannerOffsetX);
        if (bannerOffsetX === null) {
            return res.status(400).json({
                success: false,
                message: 'Posição horizontal do banner inválida.'
            });
        }
        if (bannerOffsetX !== undefined) {
            updateData.bannerOffsetX = bannerOffsetX;
        }

        const bannerOffsetY = normalizeBannerOffsetInput(req.body?.bannerOffsetY);
        if (bannerOffsetY === null) {
            return res.status(400).json({
                success: false,
                message: 'Posição vertical do banner inválida.'
            });
        }
        if (bannerOffsetY !== undefined) {
            updateData.bannerOffsetY = bannerOffsetY;
        }

        if (req.files?.avatar) {
            updateData.avatar = `/uploads/avatars/${req.files.avatar[0].filename}`;
            if (avatarScale === undefined) updateData.avatarScale = 1;
            if (avatarOffsetX === undefined) updateData.avatarOffsetX = 50;
            if (avatarOffsetY === undefined) updateData.avatarOffsetY = 50;
        } else if (shouldClearAvatar) {
            updateData.avatar = null;
            updateData.avatarScale = 1;
            updateData.avatarOffsetX = 50;
            updateData.avatarOffsetY = 50;
        }

        if (req.files?.banner) {
            updateData.banner = `/uploads/banners/${req.files.banner[0].filename}`;
            if (bannerScale === undefined) updateData.bannerScale = 1;
            if (bannerOffsetX === undefined) updateData.bannerOffsetX = 50;
            if (bannerOffsetY === undefined) updateData.bannerOffsetY = 50;
        } else if (shouldClearBanner) {
            updateData.banner = null;
            updateData.bannerScale = 1;
            updateData.bannerOffsetX = 50;
            updateData.bannerOffsetY = 50;
        }

        await User.updateProfile(userId, updateData);

        const user = await User.findById(userId);
        const rank = await Rank.getUserRank(userId);

        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso!',
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                nickname: user.nickname,
                email: user.email,
                avatar: user.avatar,
                avatarScale: user.avatarScale,
                avatarOffsetX: user.avatarOffsetX,
                avatarOffsetY: user.avatarOffsetY,
                banner: user.banner,
                bannerScale: user.bannerScale,
                bannerOffsetX: user.bannerOffsetX,
                bannerOffsetY: user.bannerOffsetY,
                bio: user.bio,
                profileTagline: user.profileTagline,
                profileTag: user.profileTag,
                profileTagStyle: user.profileTagStyle,
                profileTagColor: user.profileTagColor,
                profileTagTextColor: user.profileTagTextColor,
                profileTagSymbolStyle: user.profileTagSymbolStyle,
                profileTagBannerStyle: user.profileTagBannerStyle,
                profileTagGradientStart: user.profileTagGradientStart,
                profileTagGradientEnd: user.profileTagGradientEnd,
                profileTagUseGradient: normalizeProfileTagBool(user.profileTagUseGradient),
                showFullNameInMiniProfile: normalizeProfileTagBool(user.showFullNameInMiniProfile),
                birthDate: user.birthDate,
                aqwCharPageUrl: user.aqwCharPageUrl || null
            },
            rank
        });

    } catch (error) {
        console.error('Erro ao atualizar profile:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar perfil' });
    }
});

// PUT - Atualizar cor personalizada de uma conquista do próprio usuário
router.put('/rank-color', protect, checkBanStatus, async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        const rankIdRaw = String(req.body?.rankId || '').trim();
        const rankId = Number(rankIdRaw);
        const isFixedManualTarget = rankIdRaw.toLowerCase() === FIXED_MANUAL_RANK_KEY;
        const normalizedColor = normalizeHexColorInput(req.body?.color);

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(401).json({ success: false, message: 'Não autenticado' });
        }
        if (!isFixedManualTarget && (!Number.isInteger(rankId) || rankId <= 0)) {
            return res.status(400).json({ success: false, message: 'ID da conquista inválido' });
        }
        if (!normalizedColor) {
            return res.status(400).json({ success: false, message: 'Cor inválida. Use formato HEX (#RRGGBB).' });
        }

        const hasIndividualPermission = await userHasRankColorPermission(userId);
        if (!hasIndividualPermission) {
            return res.status(403).json({
                success: false,
                message: 'Você não tem permissão para alterar cor das conquistas.'
            });
        }

        let requesterEmail = String(req.user?.email || '').trim().toLowerCase();
        if (!requesterEmail) {
            requesterEmail = await new Promise((resolve, reject) => {
                db.get('SELECT email FROM users WHERE id = ?', [userId], (err, row) => {
                    if (err) reject(err);
                    else resolve(String(row?.email || '').trim().toLowerCase());
                });
            });
        }

        if (isFixedManualTarget) {
            const userRow = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT manualRank, manualRankColor, email
                     FROM users
                     WHERE id = ?
                     LIMIT 1`,
                    [userId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row || null);
                    }
                );
            });

            const manualRankName = String(userRow?.manualRank || '').trim();
            if (!manualRankName) {
                return res.status(404).json({ success: false, message: 'Conquista manual não encontrado para este usuário.' });
            }

            const ownerManualException = isOwnerUser(requesterEmail || userRow?.email, userId);
            if (!ownerManualException) {
                return res.status(403).json({
                    success: false,
                    message: 'Esta conquista não permite troca de cor.'
                });
            }

            const baseRank = getCustomRankByName(manualRankName);
            const baseColor = normalizeHexColorInput(baseRank?.color) || '#FFD700';
            const storedColor = normalizedColor === baseColor ? null : normalizedColor;

            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE users
                     SET manualRankColor = ?
                     WHERE id = ?`,
                    [storedColor, userId],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            return res.json({
                success: true,
                message: 'Cor da conquista atualizada com sucesso.',
                rank: {
                    id: FIXED_MANUAL_RANK_KEY,
                    name: manualRankName,
                    color: storedColor || baseColor,
                    baseColor,
                    customColor: storedColor
                }
            });
        }

        const assignedRank = await new Promise((resolve, reject) => {
            db.get(
                `SELECT
                    cr.id,
                    cr.name,
                    cr.color AS baseColor,
                    cr.canChangeOwnColor,
                    ucr.customColor
                 FROM user_custom_ranks ucr
                 JOIN custom_ranks cr ON cr.id = ucr.customRankId
                 WHERE ucr.userId = ? AND ucr.customRankId = ?
                 LIMIT 1`,
                [userId, rankId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || null);
                }
            );
        });

        if (!assignedRank) {
            return res.status(404).json({ success: false, message: 'Conquista não encontrada para este usuário.' });
        }

        const ownerFounderException = isOwnerFounderRank(requesterEmail, assignedRank.name, userId);
        if (Number(assignedRank.canChangeOwnColor) !== 1 && !ownerFounderException) {
            return res.status(403).json({
                success: false,
                message: 'Esta conquista não permite troca de cor.'
            });
        }

        const baseColor = normalizeHexColorInput(assignedRank.baseColor);
        const storedColor = baseColor && normalizedColor === baseColor ? null : normalizedColor;

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_custom_ranks
                 SET customColor = ?
                 WHERE userId = ? AND customRankId = ?`,
                [storedColor, userId, rankId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        return res.json({
            success: true,
            message: 'Cor da conquista atualizada com sucesso.',
            rank: {
                id: rankId,
                name: assignedRank.name,
                color: storedColor || baseColor || normalizedColor,
                baseColor: baseColor || null,
                customColor: storedColor
            }
        });
    } catch (error) {
        console.error('Erro ao atualizar cor da conquista:', error);
        return res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// ========== ROTAS PARA SELECAO DE CONQUISTAS - DEVE VIR ANTES DA ROTA GENERICA /:username ==========

// POST - Selecionar até 3 conquistas customizáveis para exibir no perfil
router.post('/selected-ranks', protect, checkBanStatus, async (req, res) => {
    try {
        const userId = req.user.id;
        const { rankIds } = req.body;

        console.log(`[DEBUG] POST /selected-ranks for user ${userId}`, rankIds);

        if (!Array.isArray(rankIds)) {
            return res.status(400).json({ success: false, message: 'Formato de conquistas inválido' });
        }

        // Membro Beta é a única progressão que o usuário pode exibir ou ocultar.
        // Limpar progressões dos rankIds se estiverem lá
        const cleanedRankIds = [];
        for (const rankId of rankIds) {
            if (typeof rankId === 'number' || (typeof rankId === 'string' && /^\d+$/.test(rankId))) {
                cleanedRankIds.push(rankId);  // Custom rank ID - será verificado depois
            } else if (typeof rankId === 'string' && rankId.startsWith('fixed:')) {
                cleanedRankIds.push(rankId);  // Fixed rank key
            }
        }

        const userRow = await new Promise((resolve, reject) => {
            db.get('SELECT email, canOrderFixedRanks FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        const rankAllowsOrderAll = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 1 as allowed
                 FROM user_custom_ranks ucr
                 JOIN custom_ranks cr ON cr.id = ucr.customRankId
                 WHERE ucr.userId = ? AND cr.canOrderAllRanks = 1
                 LIMIT 1`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(Boolean(row));
                }
            );
        });
        const canOrderFixedRanks =
            String(userRow?.email || '').toLowerCase() === OWNER_EMAIL ||
            Number(userRow?.canOrderFixedRanks) === 1 ||
            rankAllowsOrderAll;
        const betaRankRow = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM custom_ranks WHERE name = ? LIMIT 1`,
                [MEMBRO_BETA_RANK_NAME],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || null);
                }
            );
        });
        const betaRankId = Number(betaRankRow?.id || 0) || null;
        const userHasBetaAchievement = betaRankId
            ? await new Promise((resolve, reject) => {
                db.get(
                    `SELECT 1 AS hasBeta
                     FROM user_custom_ranks
                     WHERE userId = ? AND customRankId = ?
                     LIMIT 1`,
                    [userId, betaRankId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(Boolean(row));
                    }
                );
            })
            : false;

        const rawCleanRankOrder = normalizeRankOrderList(cleanedRankIds);
        const cleanRankOrder = rawCleanRankOrder;
        const fixedRankKeys = cleanRankOrder.filter((id) => typeof id === 'string');
        const cleanIds = cleanRankOrder.filter((id) => typeof id === 'number');

        const hasDisallowedFixedKey = fixedRankKeys.some((key) => !(
            key === FIXED_AUTO_RANK_KEY && userHasBetaAchievement
        ));
        if (!canOrderFixedRanks && hasDisallowedFixedKey) {
            return res.status(403).json({ success: false, message: 'Sem permissão para ordenar conquistas fixos' });
        }
        const selectedRankRows = await new Promise((resolve, reject) => {
            if (cleanIds.length === 0) {
                resolve([]);
                return;
            }
            const placeholders = cleanIds.map(() => '?').join(',');
            db.all(
                `SELECT id, name, description, isVisible, rankGroup, icon 
                 FROM custom_ranks WHERE id IN (${placeholders})`,
                cleanIds,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
        
        const AUTO_PROGRESSION_FILTER = new Set([
            'membro inicial', 'membro iniciado', 'membro novato', 'membro aprendiz',
            'membro experiente', 'membro adepto', 'membro especialista', 'membro mestre', 'grande mestre',
            'membro lendário', 'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal',
            'membro ativo'
        ]);
        
        const filteredRankRows = selectedRankRows.filter(row => {
            const rankName = String(row?.name || '').trim().toLowerCase();
            const isBeta = rankName === 'membro beta' && (!betaRankId || Number(row?.id) === betaRankId);
            const isProgression = String(row?.rankGroup || '').trim().toLowerCase() === 'progression'
                || AUTO_PROGRESSION_FILTER.has(rankName);
            if (isBeta) return userHasBetaAchievement;
            if (isProgression) {
                console.log(`[DEBUG] Filtrando progressão automática de selected-ranks: ${row.name}`);
                return false;
            }
            return true;
        });
        
        const selectedById = new Map(
            filteredRankRows.map(row => [Number(row.id), row])
        );
        const orderedSelectedRows = cleanIds
            .map(id => selectedById.get(Number(id)))
            .filter(Boolean);
        const visibleCount = orderedSelectedRows.filter(row => Number(row.isVisible) === 1).length;

        // Permitir qualquer número de conquistas ao salvar (o frontend controla o máximo de 3 para marcar)
        // Esta validação apenas registra, não bloqueia, para permitir desmarcar sempre
        if (visibleCount > 3) {
            console.log(`[DEBUG] Usuario ${userId} salvando ${visibleCount} conquistas visiveis (acima do limite de 3, mas permitido para desmarcar)`);
        }

        // Validar: apenas 1 conquista por grupo de progressao (ex.: post_achievement, like_achievement)
        const seenGroups = new Map();
        for (const row of orderedSelectedRows) {
            let groupKey = String(row.rankGroup || '').trim();
            const icon = String(row.icon || '').trim().toUpperCase();
            if (!groupKey && /^P\d+/.test(icon)) groupKey = 'post_achievement';
            if (!groupKey && /^L\d+/.test(icon)) groupKey = 'like_achievement';
            if (!groupKey) continue;
            if (seenGroups.has(groupKey)) {
                return res.status(400).json({
                    success: false,
                    message: 'Você só pode escolher um conquista de cada conquista.'
                });
            }
            seenGroups.set(groupKey, Number(row.id));
        }

        // Sem permissão, não pode salvar conquistas fixos na ordenação
        if (!canOrderFixedRanks) {
            const hasFixedId = await new Promise((resolve, reject) => {
                if (cleanIds.length === 0) {
                    resolve(false);
                    return;
                }
                const placeholders = cleanIds.map(() => '?').join(',');
                db.get(
                    `SELECT COUNT(*) as total FROM custom_ranks WHERE id IN (${placeholders}) AND isVisible = 0`,
                    cleanIds,
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(Number(row?.total || 0) > 0);
                    }
                );
            });
            if (hasFixedId) {
                return res.status(403).json({ success: false, message: 'Sem permissão para ordenar conquistas fixos' });
            }
        }

        const rankComplete = await Rank.getUserRankComplete(userId);
        const availableFixedKeys = new Set();
        if (canOrderFixedRanks || userHasBetaAchievement) {
            availableFixedKeys.add(FIXED_AUTO_RANK_KEY);
        }
        if (rankComplete?.custom && canOrderFixedRanks) {
            availableFixedKeys.add(FIXED_MANUAL_RANK_KEY);
        }
        const hasUnavailableFixedKey = fixedRankKeys.some((key) => !availableFixedKeys.has(key));
        if (hasUnavailableFixedKey) {
            return res.status(400).json({ success: false, message: 'conquista fixo inválido para este usuário' });
        }

        // Persistir apenas conquistas selecionáveis; o rank atual de progressão é fixo.
        const AUTO_PROGRESSION_IDS = new Set(
            filteredRankRows.map(row => Number(row.id))
        );
        
        const finalCleanRankOrder = cleanRankOrder.filter(item => {
            if (typeof item === 'string') return true; // Manter fixed keys
            if (AUTO_PROGRESSION_IDS.has(Number(item))) return true; // Manter IDs válidos
            return false; // Remover progressões automáticas
        });

        let dedupedRankOrder = finalCleanRankOrder;
        const hasMembroBeta = betaRankId
            ? finalCleanRankOrder.some(item => Number(item) === betaRankId)
            : false;
        if (hasMembroBeta) {
            dedupedRankOrder = dedupedRankOrder.filter(item => item !== FIXED_AUTO_RANK_KEY);
        }

        // Salvar como JSON string no banco (ordem mista: IDs custom + chaves fixas)
        const selectedRanks = dedupedRankOrder.length > 0 ? JSON.stringify(dedupedRankOrder) : null;
        
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET selectedRanks = ? WHERE id = ?',
                [selectedRanks, userId],
                function(err) {
                    if (err) {
                        console.error('[ERROR] Failed to save selected ranks:', err);
                        reject(err);
                    } else {
                        console.log(`[DEBUG] Successfully saved selected ranks for user ${userId}:`, selectedRanks);
                        resolve();
                    }
                }
            );
        });

        res.json({ success: true, message: 'conquistas selecionados com sucesso!' });
    } catch (error) {
        console.error('Erro ao selecionar conquistas:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// GET - Recuperar conquistas selecionados do perfil
router.get('/selected-ranks', protect, checkBanStatus, async (req, res) => {
    console.log('[DEBUG] GET /selected-ranks route hit');
    try {
        const userId = req.user?.id;
        console.log(`[DEBUG] GET /selected-ranks for user ${userId}`);

        if (!userId) {
            console.log('[DEBUG] No user ID found in req.user');
            return res.status(401).json({ success: false, message: 'Não autenticado' });
        }

        console.log('[DEBUG] Querying user from database...');
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT selectedRanks, email, canOrderFixedRanks, canChangeRankColor FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) {
                    console.error('[ERROR] Database query error:', err);
                    reject(err);
                } else {
                    console.log(`[DEBUG] Raw data from DB for user ${userId}:`, row);
                    resolve(row);
                }
            });
        });

        if (!user) {
            console.log(`[DEBUG] No user found with ID ${userId}`);
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        const existingSelectedRanks = normalizeRankOrderList(user?.selectedRanks ? JSON.parse(user.selectedRanks) : []);
        // Não reaplicar automaticamente todas as conquistas do usuário ao ler a seleção.
        // A seleção deve refletir apenas o que o usuário marcou explicitamente.
        // Isso evita que uma conquista desmarcada volte a aparecer como selecionada.

        const rankAllowsOrderAll = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 1 as allowed
                 FROM user_custom_ranks ucr
                 JOIN custom_ranks cr ON cr.id = ucr.customRankId
                 WHERE ucr.userId = ? AND cr.canOrderAllRanks = 1
                 LIMIT 1`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(Boolean(row));
                }
            );
        });
        const rankAllowsColorChange = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 1 as allowed
                 FROM user_custom_ranks ucr
                 JOIN custom_ranks cr ON cr.id = ucr.customRankId
                 WHERE ucr.userId = ? AND cr.canChangeOwnColor = 1
                 LIMIT 1`,
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(Boolean(row));
                }
            );
        });
        const canOrderFixedRanks =
            String(user?.email || '').toLowerCase() === OWNER_EMAIL ||
            Number(user?.canOrderFixedRanks) === 1 ||
            rankAllowsOrderAll;
        const canChangeRankColor =
            String(user?.email || '').toLowerCase() === OWNER_EMAIL ||
            Number(user?.canChangeRankColor) === 1 ||
            rankAllowsColorChange;
        const betaRankRow = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM custom_ranks WHERE name = ? LIMIT 1`,
                [MEMBRO_BETA_RANK_NAME],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || null);
                }
            );
        });
        const betaRankId = Number(betaRankRow?.id || 0) || null;
        const userHasBetaAchievement = betaRankId
            ? await new Promise((resolve, reject) => {
                db.get(
                    `SELECT 1 AS hasBeta
                     FROM user_custom_ranks
                     WHERE userId = ? AND customRankId = ?
                     LIMIT 1`,
                    [userId, betaRankId],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(Boolean(row));
                    }
                );
            })
            : false;

        // Parse da ordem salva (suporta IDs numéricos + chaves fixas)
        console.log(`[DEBUG] selectedRanks value: ${user.selectedRanks}`);
        let rankOrder = [];
        if (user.selectedRanks) {
            try {
                rankOrder = normalizeRankOrderList(JSON.parse(user.selectedRanks));
                rankOrder = rankOrder.filter((entry) => {
                    return true;
                });
                console.log(`[DEBUG] Parsed rankOrder:`, rankOrder);
            } catch (parseErr) {
                console.warn('[WARN] Failed to parse selectedRanks:', user.selectedRanks, parseErr);
                rankOrder = [];
            }
        }

        const explicitFixedKeys = new Set(
            rankOrder
                .filter((entry) => typeof entry === 'string' && Boolean(String(entry).trim()))
                .map((entry) => String(entry).trim())
                .filter((entry) => entry === FIXED_AUTO_RANK_KEY || entry === FIXED_MANUAL_RANK_KEY)
        );

        const fixedRanks = [];
        if (explicitFixedKeys.size > 0) {
            const rankComplete = await Rank.getUserRankComplete(userId);
            const autoDisplayRank = (rankComplete?.automatic || rankComplete?.automaticCompleted)
                ? {
                    id: FIXED_AUTO_RANK_KEY,
                    ...(rankComplete?.automatic || rankComplete?.automaticCompleted),
                    description: (rankComplete?.automatic || rankComplete?.automaticCompleted)?.description || 'conquista automática atual',
                    customText: '',
                    backgroundImage: null,
                    isVisible: 0,
                    rankGroup: 'fixed_automatic',
                    isFixed: true
                }
                : await getHighestOwnedProgressionRank(userId, null);

            if (explicitFixedKeys.has(FIXED_AUTO_RANK_KEY) && autoDisplayRank) {
                fixedRanks.push({
                    id: FIXED_AUTO_RANK_KEY,
                    name: autoDisplayRank.name,
                    color: autoDisplayRank.color,
                    description: autoDisplayRank.description || 'conquista automático atual',
                    customText: '',
                    backgroundImage: null,
                    isVisible: 0,
                    rankGroup: 'fixed_automatic',
                    icon: autoDisplayRank.icon || '',
                    isFixed: true
                });
            }

            if (explicitFixedKeys.has(FIXED_MANUAL_RANK_KEY) && rankComplete?.custom) {
                const canEditFixedManualColor =
                    isOwnerFounderRank(user?.email, rankComplete.custom.name, userId) ||
                    Number(rankComplete.custom?.canChangeOwnColor) === 1;
                fixedRanks.push({
                    id: FIXED_MANUAL_RANK_KEY,
                    name: rankComplete.custom.name,
                    color: rankComplete.custom.color,
                    baseColor: rankComplete.custom.baseColor || rankComplete.custom.color,
                    customColor: rankComplete.custom.customColor || null,
                    description: rankComplete.custom.description || 'conquista manual atual',
                    customText: rankComplete.custom.customText || '',
                    backgroundImage: rankComplete.custom.backgroundImage || null,
                    isVisible: 0,
                    rankGroup: 'fixed_manual',
                    icon: rankComplete.custom.icon || '',
                    canChangeOwnColor: canEditFixedManualColor ? 1 : 0,
                    isFixed: true
                });
            }
        }

        const fixedByKey = new Map(fixedRanks.map((rank) => [orderKeyMapKey(rank.id), rank]));
        const rankOrderFiltered = rankOrder.filter((entry) => {
            if (typeof entry === 'number') return true;
            if (!canOrderFixedRanks && !(userHasBetaAchievement && entry === FIXED_AUTO_RANK_KEY)) return false;
            return fixedByKey.has(orderKeyMapKey(entry));
        });
        rankOrder = rankOrderFiltered;

        // Respeitar apenas a seleção explícita salva pelo usuário.
        // Não reaplicar conquistas fixas ou escondidas automaticamente na leitura.
        const hiddenCustomIds = [];

        const customRankIds = rankOrder.filter((entry) => typeof entry === 'number');

        // Se houver IDs custom, buscar os dados dos conquistas
        let customRanks = [];
        if (customRankIds.length > 0) {
            console.log(`[DEBUG] Fetching details for ${customRankIds.length} ranks`);
            customRanks = await new Promise((resolve, reject) => {
                const placeholders = customRankIds.map(() => '?').join(',');
                const query = `
                    SELECT
                        cr.id,
                        cr.name AS name,
                        COALESCE(NULLIF(TRIM(ucr.customColor), ''), cr.color) AS color,
                        cr.color AS baseColor,
                        ucr.customColor AS customColor,
                        cr.description AS description,
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
                    WHERE cr.id IN (${placeholders})
                `;
                console.log(`[DEBUG] Query:`, query);
                console.log(`[DEBUG] Parameters:`, customRankIds);
                
                db.all(query, [userId, ...customRankIds], (err, rows) => {
                    if (err) {
                        console.error('[ERROR] Failed to fetch rank details:', err);
                        reject(err);
                    } else {
                        console.log(`[DEBUG] Found ${rows ? rows.length : 0} rank details`, rows);
                        const byId = new Map((rows || []).map(item => [Number(item.id), item]));
                        const orderedRaw = customRankIds.map(id => byId.get(Number(id))).filter(Boolean);
                        resolve(orderedRaw);
                    }
                });
            });
        } else {
            console.log('[DEBUG] No rank IDs to fetch');
        }

        const AUTO_PROGRESSION_FILTER = new Set([
            'membro inicial', 'membro iniciado', 'membro novato', 'membro aprendiz',
            'membro experiente', 'membro adepto', 'membro especialista', 'membro mestre', 'grande mestre',
            'membro lendário', 'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal',
            'membro ativo'
        ]);
        customRanks = customRanks.filter(rank => {
            if (!rank || !rank.name) return true;
            const rankNameLower = String(rank.name || '').trim().toLowerCase();
            const isBeta = rankNameLower === 'membro beta' && (!betaRankId || Number(rank.id) === betaRankId);
            const isProgression = String(rank?.rankGroup || '').trim().toLowerCase() === 'progression'
                || AUTO_PROGRESSION_FILTER.has(rankNameLower);
            if (isBeta) return userHasBetaAchievement;
            if (isProgression) {
                console.log('[DEBUG] Filtering out automatic progression rank from selected-ranks response:', rank.name);
                return false;
            }
            return true;
        });

        const customById = new Map((customRanks || []).map((rank) => [orderKeyMapKey(Number(rank.id)), rank]));
        const rankIds = [];
        const ranks = [];
        const seenOrderKeys = new Set();
        const seenDisplayKeys = new Set();

        for (const key of rankOrder) {
            const mapKey = orderKeyMapKey(key);
            if (seenOrderKeys.has(mapKey)) continue;
            seenOrderKeys.add(mapKey);

            let rank = null;
            if (typeof key === 'number') {
                rank = customById.get(mapKey) || null;
            } else if (canOrderFixedRanks || (userHasBetaAchievement && key === FIXED_AUTO_RANK_KEY)) {
                rank = fixedByKey.get(mapKey) || null;
            }

            if (!rank) continue;
            const displayKey = rankDisplayKey(rank, key);
            if (displayKey && seenDisplayKeys.has(displayKey)) continue;
            if (displayKey) seenDisplayKeys.add(displayKey);
            rankIds.push(key);
            ranks.push(rank);
        }

        // Não reaplicar conquistas fixas automaticamente na resposta.
        // A exibição deve refletir apenas a ordem explícita salva pelo usuário.
        for (const fixedRank of fixedRanks) {
            if (!explicitFixedKeys.has(fixedRank.id)) continue;
            const key = fixedRank.id;
            const mapKey = orderKeyMapKey(key);
            if (seenOrderKeys.has(mapKey)) continue;
            seenOrderKeys.add(mapKey);
            const displayKey = rankDisplayKey(fixedRank, key);
            if (displayKey && seenDisplayKeys.has(displayKey)) continue;
            if (displayKey) seenDisplayKeys.add(displayKey);
            rankIds.push(key);
            ranks.push(fixedRank);
        }

        const hasMembroBetaSelected = betaRankId
            ? rankIds.some(id => Number(id) === betaRankId) || ranks.some(rank => Number(rank?.id) === betaRankId || String(rank?.name || '').trim().toLowerCase() === 'membro beta')
            : ranks.some(rank => String(rank?.name || '').trim().toLowerCase() === 'membro beta');
        const hasFixedAutoSelected = rankIds.some(id => id === FIXED_AUTO_RANK_KEY) || ranks.some(rank => String(rank?.id || '').trim() === FIXED_AUTO_RANK_KEY);
        const hasExplicitSelectedRanks = rankIds.some((entry) => {
            if (typeof entry === 'string') return entry !== FIXED_AUTO_RANK_KEY;
            return true;
        });
        if (hasMembroBetaSelected && hasFixedAutoSelected) {
            const paired = rankIds.map((key, index) => ({ key, rank: ranks[index] }));
            const filtered = paired.filter(({ key, rank }) => {
                if (key === FIXED_AUTO_RANK_KEY) return false;
                if (String(rank?.id || '').trim() === FIXED_AUTO_RANK_KEY) return false;
                return true;
            });
            rankIds.length = 0;
            ranks.length = 0;
            filtered.forEach((item) => {
                rankIds.push(item.key);
                ranks.push(item.rank);
            });
        }

        // Progression ranks other than Beta are fixed and are not user-selectable.

        console.log('[DEBUG] Sending response:', { success: true, rankIds, ranksCount: ranks.length, canOrderFixedRanks, canChangeRankColor, hiddenCustomIds: hiddenCustomIds.length });
        res.json({ success: true, rankIds, ranks, canOrderFixedRanks, canChangeRankColor });
    } catch (error) {
        console.error('[ERROR] Erro ao recuperar conquistas selecionados:', error);
        console.error('[ERROR] Stack:', error.stack);
        res.status(500).json({ success: false, message: 'Erro no servidor', error: error.message });
    }
});

// GET - Configurações de notificações do usuário
router.get('/notification-settings', protect, checkBanStatus, async (req, res) => {
    try {
        const userId = req.user.id;
        const row = await new Promise((resolve, reject) => {
            db.get(
                `SELECT
                    disableCommentNotifications,
                    disableLikeNotifications,
                    disableAchievementNotifications,
                    disableTeamEmailNotifications,
                    disableAllNotifications
                 FROM users
                 WHERE id = ?`,
                [userId],
                (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                }
            );
        });

        res.json({
            success: true,
            settings: {
                disableCommentNotifications: Boolean(row?.disableCommentNotifications),
                disableLikeNotifications: Boolean(row?.disableLikeNotifications),
                disableAchievementNotifications: Boolean(row?.disableAchievementNotifications),
                disableTeamEmailNotifications: Boolean(row?.disableTeamEmailNotifications),
                disableAllNotifications: Boolean(row?.disableAllNotifications)
            }
        });
    } catch (error) {
        console.error('Erro ao buscar configurações de notificação:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// PUT - Atualizar configurações de notificações do usuário
router.put('/notification-settings', protect, checkBanStatus, async (req, res) => {
    try {
        const userId = req.user.id;

        const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
        const toFlag = (value) => (value ? 1 : 0);

        const current = await new Promise((resolve, reject) => {
            db.get(
                `SELECT
                    disableCommentNotifications,
                    disableLikeNotifications,
                    disableAchievementNotifications,
                    disableTeamEmailNotifications,
                    disableAllNotifications
                 FROM users
                 WHERE id = ?`,
                [userId],
                (err, data) => {
                    if (err) reject(err);
                    else resolve(data || {});
                }
            );
        });

        let disableCommentNotifications = Boolean(current.disableCommentNotifications);
        let disableLikeNotifications = Boolean(current.disableLikeNotifications);
        let disableAchievementNotifications = Boolean(current.disableAchievementNotifications);
        let disableTeamEmailNotifications = Boolean(current.disableTeamEmailNotifications);
        let disableAllNotifications = Boolean(current.disableAllNotifications);

        if (hasOwn(req.body, 'disableCommentNotifications')) {
            disableCommentNotifications = Boolean(req.body.disableCommentNotifications);
        }
        if (hasOwn(req.body, 'disableLikeNotifications')) {
            disableLikeNotifications = Boolean(req.body.disableLikeNotifications);
        }
        if (hasOwn(req.body, 'disableAchievementNotifications')) {
            disableAchievementNotifications = Boolean(req.body.disableAchievementNotifications);
        }
        if (hasOwn(req.body, 'disableTeamEmailNotifications')) {
            disableTeamEmailNotifications = Boolean(req.body.disableTeamEmailNotifications);
        }
        if (hasOwn(req.body, 'disableAllNotifications')) {
            disableAllNotifications = Boolean(req.body.disableAllNotifications);
        }

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET
                    disableCommentNotifications = ?,
                    disableLikeNotifications = ?,
                    disableAchievementNotifications = ?,
                    disableTeamEmailNotifications = ?,
                    disableAllNotifications = ?
                 WHERE id = ?`,
                [
                    toFlag(disableCommentNotifications),
                    toFlag(disableLikeNotifications),
                    toFlag(disableAchievementNotifications),
                    toFlag(disableTeamEmailNotifications),
                    toFlag(disableAllNotifications),
                    userId
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({
            success: true,
            message: 'Configurações de notificação salvas',
            settings: {
                disableCommentNotifications,
                disableLikeNotifications,
                disableAchievementNotifications,
                disableTeamEmailNotifications,
                disableAllNotifications
            }
        });
    } catch (error) {
        console.error('Erro ao atualizar configurações de notificação:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// GET - Configuração de visibilidade de postagens +18
router.get('/adult-post-settings', protect, checkBanStatus, async (req, res) => {
    try {
        const userId = req.user.id;
        const row = await new Promise((resolve, reject) => {
            db.get(
                `SELECT birthDate, showAdultPosts FROM users WHERE id = ?`,
                [userId],
                (err, data) => {
                    if (err) reject(err);
                    else resolve(data || null);
                }
            );
        });

        if (!row) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        const isAdult = getAgeFromBirthDateIso(row.birthDate) >= 18;
        const showAdultPosts = isAdult ? Number(row.showAdultPosts) === 1 : false;

        res.json({
            success: true,
            settings: {
                isAdult,
                showAdultPosts
            }
        });
    } catch (error) {
        console.error('Erro ao buscar configuração +18:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// PUT - Atualizar visibilidade de postagens +18
router.put('/adult-post-settings', protect, checkBanStatus, async (req, res) => {
    try {
        const userId = req.user.id;
        const requestedShowAdultPosts = Boolean(req.body?.showAdultPosts);

        const row = await new Promise((resolve, reject) => {
            db.get(
                `SELECT birthDate FROM users WHERE id = ?`,
                [userId],
                (err, data) => {
                    if (err) reject(err);
                    else resolve(data || null);
                }
            );
        });

        if (!row) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        const isAdult = getAgeFromBirthDateIso(row.birthDate) >= 18;
        if (!isAdult && requestedShowAdultPosts) {
            return res.status(403).json({
                success: false,
                message: 'Apenas contas com 18 anos ou mais podem ativar postagens +18.'
            });
        }

        const finalShowAdultPosts = isAdult ? requestedShowAdultPosts : false;
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET showAdultPosts = ? WHERE id = ?`,
                [finalShowAdultPosts ? 1 : 0, userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({
            success: true,
            message: 'Configuração +18 atualizada',
            settings: {
                isAdult,
                showAdultPosts: finalShowAdultPosts
            }
        });
    } catch (error) {
        console.error('Erro ao salvar configuração +18:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// GET - Configuração de card animado do perfil
router.get('/animated-profile-settings', protect, checkBanStatus, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await new Promise((resolve, reject) => {
            db.get(
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
                [userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row || null);
                }
            );
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        const canUseAnimatedProfile = await userHasAnimatedProfilePermission(userId);
        const canUseExclusiveThemes = await userCanUseExclusiveAnimatedThemes(userId);
        const canUseCustomGif = await userCanUseAnimatedProfileCustomGif(userId);
        const animatedProfileTheme = normalizeAnimatedProfileTheme(user.animatedProfileTheme);
        const animatedProfileVisualMode = normalizeAnimatedProfileVisualMode(user.animatedProfileVisualMode);
        const animatedProfileGifUrl = normalizeAnimatedGifUrl(user.animatedProfileGifUrl);
        const animatedProfileGiphyId = normalizeAnimatedProfileGiphyId(user.animatedProfileGiphyId);
        const animatedMiniProfileEnabled = canUseAnimatedProfile
            ? Number(user.animatedMiniProfileEnabled ?? user.animatedProfileEnabled) === 1
            : false;
        const animatedDownloadCardEnabled = canUseAnimatedProfile
            ? Number(user.animatedDownloadCardEnabled ?? user.animatedProfileEnabled) === 1
            : false;

        res.json({
            success: true,
            settings: {
                canUseAnimatedProfile,
                canUseExclusiveAnimatedThemes: canUseExclusiveThemes,
                canUseAnimatedProfileCustomGif: canUseCustomGif,
                animatedProfileEnabled: animatedMiniProfileEnabled || animatedDownloadCardEnabled,
                animatedMiniProfileEnabled,
                animatedDownloadCardEnabled,
                animatedProfileTheme,
                animatedProfileVisualMode,
                animatedProfileGifUrl,
                animatedProfileGiphyId
            }
        });
    } catch (error) {
        console.error('Erro ao buscar configuração de card animado:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// PUT - Atualizar configuração de card animado do perfil
router.put('/animated-profile-settings', protect, checkBanStatus, async (req, res) => {
    try {
        const userId = req.user.id;
        const canUseAnimatedProfile = await userHasAnimatedProfilePermission(userId);

        if (!canUseAnimatedProfile) {
            return res.status(403).json({ success: false, message: 'Sem permissão para usar card animado' });
        }

        const hasMiniValue = typeof req.body?.animatedMiniProfileEnabled === 'boolean';
        const hasDownloadValue = typeof req.body?.animatedDownloadCardEnabled === 'boolean';
        const legacyEnabled = Boolean(req.body?.animatedProfileEnabled);
        const miniEnabled = hasMiniValue ? Boolean(req.body?.animatedMiniProfileEnabled) : legacyEnabled;
        const downloadEnabled = hasDownloadValue ? Boolean(req.body?.animatedDownloadCardEnabled) : legacyEnabled;
        let animatedProfileTheme = normalizeAnimatedProfileTheme(req.body?.animatedProfileTheme);
        let animatedProfileVisualMode = normalizeAnimatedProfileVisualMode(req.body?.animatedProfileVisualMode);
        let animatedProfileGifUrl = normalizeAnimatedGifUrl(req.body?.animatedProfileGifUrl);
        let animatedProfileGiphyId = normalizeAnimatedProfileGiphyId(req.body?.animatedProfileGiphyId);
        if (req.body?.animatedProfileGiphyId && !animatedProfileGiphyId) {
            return res.status(400).json({ success: false, message: 'ID de GIF do GIPHY inválido.' });
        }
        const aggregatedEnabled = miniEnabled || downloadEnabled;
        const canUseExclusiveThemes = await userCanUseExclusiveAnimatedThemes(userId);
        const canUseCustomGif = await userCanUseAnimatedProfileCustomGif(userId);

        if (!canUseExclusiveThemes && EXCLUSIVE_ANIMATED_PROFILE_THEMES.has(animatedProfileTheme)) {
            return res.status(403).json({
                success: false,
                message: 'Você ainda não desbloqueou os temas exclusivos do perfil animado.'
            });
        }

        if (!canUseCustomGif) {
            if (animatedProfileVisualMode === 'gif') {
                return res.status(403).json({
                    success: false,
                    message: 'Você ainda não desbloqueou GIF próprio no perfil animado.'
                });
            }
            animatedProfileGifUrl = '';
            animatedProfileGiphyId = '';
        }
        if (animatedProfileVisualMode !== 'gif') {
            animatedProfileGifUrl = '';
            animatedProfileGiphyId = '';
        } else if (animatedProfileGiphyId) {
            animatedProfileGifUrl = '';
        }

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users
                 SET animatedProfileEnabled = ?,
                     animatedMiniProfileEnabled = ?,
                     animatedDownloadCardEnabled = ?,
                     animatedProfileTheme = ?,
                     animatedProfileVisualMode = ?,
                     animatedProfileGifUrl = ?,
                     animatedProfileGiphyId = ?
                 WHERE id = ?`,
                [
                    aggregatedEnabled ? 1 : 0,
                    miniEnabled ? 1 : 0,
                    downloadEnabled ? 1 : 0,
                    animatedProfileTheme,
                    animatedProfileVisualMode,
                    animatedProfileGifUrl,
                    animatedProfileGiphyId,
                    userId
                ],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({
            success: true,
            message: 'Configuração de card animado salva',
            settings: {
                canUseAnimatedProfile: true,
                canUseExclusiveAnimatedThemes: canUseExclusiveThemes,
                canUseAnimatedProfileCustomGif: canUseCustomGif,
                animatedProfileEnabled: aggregatedEnabled,
                animatedMiniProfileEnabled: miniEnabled,
                animatedDownloadCardEnabled: downloadEnabled,
                animatedProfileTheme,
                animatedProfileVisualMode,
                animatedProfileGifUrl,
                animatedProfileGiphyId
            }
        });
    } catch (error) {
        console.error('Erro ao salvar configuração de card animado:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// POST - Upload de GIF personalizado para perfil animado (máx: 15MB)
router.post('/animated-profile/upload-gif', protect, checkBanStatus, async (req, res) => {
    const canUseAnimatedProfile = await userHasAnimatedProfilePermission(req.user.id);
    if (!canUseAnimatedProfile) {
        return res.status(403).json({ success: false, message: 'Sem permissão para usar perfil animado' });
    }
    const canUseCustomGif = await userCanUseAnimatedProfileCustomGif(req.user.id);
    if (!canUseCustomGif) {
        return res.status(403).json({ success: false, message: 'Você ainda não desbloqueou GIF próprio no perfil animado.' });
    }

    uploadAnimatedGif.single('gif')(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: 'GIF muito grande. Tamanho máximo: 15MB.'
                });
            }
            return res.status(400).json({
                success: false,
                message: err?.message || 'Não foi possível enviar o GIF.'
            });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Envie um arquivo GIF.' });
        }

        const gifUrl = `/uploads/animated-gifs/${req.file.filename}`;
        return res.json({
            success: true,
            message: 'GIF enviado com sucesso.',
            gifUrl
        });
    });
});

router.get('/missions', protect, checkBanStatus, async (req, res) => {
    try {
        const payload = await buildMissionPayload(req.user.id);
        res.json({
            success: true,
            ...payload
        });
    } catch (error) {
        console.error('Erro ao buscar missões do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro ao carregar missões.' });
    }
});

router.post('/missions/:missionKey/accept', protect, checkBanStatus, async (req, res) => {
    try {
        const missionKey = String(req.params?.missionKey || '').trim();
        const mission = USER_MISSION_MAP.get(missionKey);
        if (!mission) {
            return res.status(404).json({ success: false, message: 'Missão não encontrada.' });
        }

        const currentPayload = await buildMissionPayload(req.user.id);
        const missionState = currentPayload.missions.find((item) => item.key === missionKey);
        if (!missionState) {
            return res.status(404).json({ success: false, message: 'Missão não encontrada.' });
        }
        if (!missionState.unlocked) {
            return res.status(403).json({
                success: false,
                message: `Essa missão desbloqueia após ${mission.unlockCompletedCount} missão(ões) concluída(s).`
            });
        }
        if (missionState.accepted) {
            return res.json({
                success: true,
                message: missionState.completed ? 'Essa missão já está concluída.' : 'Essa missão já foi aceita.',
                ...currentPayload
            });
        }

        await dbRunAsync(
            `INSERT OR IGNORE INTO user_missions (userId, missionKey, acceptedAt)
             VALUES (?, ?, CURRENT_TIMESTAMP)`,
            [req.user.id, missionKey]
        );

        const updatedPayload = await buildMissionPayload(req.user.id);
        const updatedMissionState = updatedPayload.missions.find((item) => item.key === missionKey);
        const autoCompleted = Boolean(updatedMissionState?.completed);

        res.json({
            success: true,
            message: autoCompleted
                ? 'Missão aceita e concluída na hora. Recompensa liberada!'
                : 'Missão aceita com sucesso!',
            ...updatedPayload
        });
    } catch (error) {
        console.error('Erro ao aceitar missão do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro ao aceitar missão.' });
    }
});

// ========== FIM DAS ROTAS PARA SELECAO DE CONQUISTAS ==========

// GET - Lista de membros com estatísticas e conquistas
router.get('/members', protect, checkBanStatus, async (req, res) => {
    try {
        const hasAccess = await canAccessMembersDirectory(req.user.id);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'A página de membros é restrita para administradores e moderadores.'
            });
        }

        const dbAll = (query, params = []) => new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        const dbGet = (query, params = []) => new Promise((resolve, reject) => {
            db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });

        const users = await dbAll(
            `SELECT id, firstName, lastName, nickname, avatar, profileTag, profileTagStyle, profileTagColor,
                    profileTagTextColor, profileTagSymbolStyle, profileTagBannerStyle,
                    profileTagGradientStart, profileTagGradientEnd, profileTagUseGradient, createdAt
               FROM users
               ORDER BY createdAt DESC`
        );

        const members = await Promise.all(users.map(async (user) => {
            const [rankComplete, stats, favoritesReceivedRow, favoritesMadeRow] = await Promise.all([
                Rank.getUserRankComplete(user.id),
                Download.getUserStats(user.id),
                dbGet(
                    `SELECT COUNT(*) as count
                     FROM download_favorites df
                     JOIN downloads d ON d.id = df.downloadId
                     WHERE d.userId = ?`,
                    [user.id]
                ),
                dbGet(
                    `SELECT COUNT(*) as count
                     FROM download_favorites
                     WHERE userId = ?`,
                    [user.id]
                )
            ]);

            const displayRanks = await getProfileDisplayRanks(user.id, rankComplete);
            const achievements = displayRanks.map((rank) => {
                if (!rank) return;
                return {
                    id: rank.id,
                    name: rank.name,
                    color: rank.color,
                    description: rank.description || '',
                    icon: rank.icon || '',
                    rankGroup: rank.rankGroup || '',
                    isFixed: Number(rank.isVisible) === 0
                };
            });

            return {
                id: user.id,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                nickname: user.nickname || '',
                avatar: user.avatar || '',
                profileTag: user.profileTag || '',
                profileTagStyle: user.profileTagStyle || '',
                profileTagColor: user.profileTagColor || '',
                profileTagTextColor: user.profileTagTextColor || '',
                profileTagSymbolStyle: user.profileTagSymbolStyle || '',
                profileTagBannerStyle: user.profileTagBannerStyle || '',
                profileTagGradientStart: user.profileTagGradientStart || '',
                profileTagGradientEnd: user.profileTagGradientEnd || '',
                profileTagUseGradient: normalizeProfileTagBool(user.profileTagUseGradient),
                createdAt: user.createdAt,
                stats: {
                    totalPostages: Number(stats?.totalPostages || 0),
                    totalLikes: Number(stats?.totalLikes || 0),
                    totalHearts: Number(stats?.totalHearts || 0),
                    totalFavoritesReceived: Number(favoritesReceivedRow?.count || 0),
                    totalFavoritesMade: Number(favoritesMadeRow?.count || 0)
                },
                achievements
            };
        }));

        res.json({ success: true, members });
    } catch (error) {
        console.error('Erro ao listar membros:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar membros' });
    }
});

// GET USER BY USERNAME (público) - DEVE VENTER DEPOIS DAS ROTAS /selected-ranks
router.get('/:username', async (req, res) => {
    try {
        const user = await User.findByNickname(req.params.username);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        const rank = await Rank.getUserRank(user.id);

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                banner: user.banner,
                bio: user.bio,
                profileTagline: user.profileTagline,
                profileTag: user.profileTag,
                profileTagStyle: user.profileTagStyle,
                profileTagColor: user.profileTagColor,
                profileTagTextColor: user.profileTagTextColor,
                profileTagSymbolStyle: user.profileTagSymbolStyle,
                profileTagBannerStyle: user.profileTagBannerStyle,
                profileTagGradientStart: user.profileTagGradientStart,
                profileTagGradientEnd: user.profileTagGradientEnd,
                profileTagUseGradient: normalizeProfileTagBool(user.profileTagUseGradient),
                createdAt: user.createdAt
            },
            rank
        });

    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// CHANGE PASSWORD
router.post('/change-password', protect, checkBanStatus, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Preencha todos os campos' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'As novas senhas não conferem' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'A senha deve ter no mínimo 6 caracteres' });
        }

        const user = await User.findById(userId);
        const isPasswordValid = await User.verifyPassword(currentPassword, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Senha atual incorreta' });
        }

        await User.updatePassword(userId, newPassword);

        res.json({
            success: true,
            message: 'Senha alterada com sucesso!'
        });

    } catch (error) {
        console.error('Erro ao mudar senha:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// SEND EMAIL CHANGE CODE
router.post('/send-email-code', protect, checkBanStatus, async (req, res) => {
    try {
        const { email } = req.body;
        const userId = req.user.id;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email não fornecido' });
        }

        // Gerar código de verificação (6 dígitos)
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Salvar o código no banco de dados
        await User.setEmailChangeCode(userId, code);

        const emailMessage = buildCodeEmail({
            title: 'Confirme o novo endereço de e-mail',
            intro: 'Foi solicitada a alteração do endereço de e-mail da sua conta HOLIDAY Guild. Use o código abaixo para confirmar que você tem acesso ao novo endereço.',
            codeLabel: 'CÓDIGO PARA ALTERAR O E-MAIL',
            code,
            expiresIn: '15 minutos',
            notice: 'Este código confirma o acesso ao novo endereço. Se você não iniciou esta alteração, ignore a mensagem e não compartilhe o código.',
            noticeTitle: 'Aviso de segurança'
        });

        try {
            await sendEmail(email, 'Confirme seu novo e-mail | HOLIDAY Guild', emailMessage.html, [], emailMessage.text);
        } catch (emailError) {
            console.error('Erro ao enviar email:', emailError);
            return res.status(500).json({ success: false, message: 'Erro ao enviar email' });
        }

        res.json({
            success: true,
            message: 'Código enviado para seu email!'
        });

    } catch (error) {
        console.error('Erro ao enviar código de email:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// REQUEST EMAIL CHANGE (creates admin ticket for approval)
router.post('/request-email-change', protect, checkBanStatus, async (req, res) => {
    try {
        const { newEmail, reason = '' } = req.body;
        const userId = req.user.id;

        if (!newEmail) {
            return res.status(400).json({ success: false, message: 'Informe o novo e-mail.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return res.status(400).json({ success: false, message: 'E-mail inválido.' });
        }

        const existingUser = await User.findByEmail(newEmail);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Este e-mail já está sendo usado.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        const existingRequest = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM admin_tickets WHERE userId = ? AND title = 'Pedido de troca de e-mail' LIMIT 1`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (existingRequest) {
            return res.status(400).json({ success: false, message: 'Você já possui um pedido de troca de e-mail pendente. Aguarde a análise do administrador.' });
        }

        await Notification.createAdminTicket(
            userId,
            userId,
            'Pedido de troca de e-mail',
            `Novo e-mail solicitado: ${newEmail}\n\nMotivo: ${String(reason || 'Nenhum motivo informado').trim()}`
        );

        const requestEmailMessage = buildNoticeEmail({
            title: 'Solicitação recebida',
            greeting: user.nickname || user.firstName,
            intro: 'Recebemos sua solicitação para trocar o endereço de e-mail da sua conta HOLIDAY Guild.',
            status: 'Em análise pela equipe',
            details: [{ label: 'Novo e-mail solicitado', value: newEmail }],
            notice: 'O endereço cadastrado só será alterado após a análise. Você receberá uma mensagem quando a equipe concluir a solicitação.',
            noticeTitle: 'O que acontece agora?'
        });

        try {
            await sendEmail(
                user.email,
                'Sua solicitação de troca de e-mail está em análise | HOLIDAY Guild',
                requestEmailMessage.html,
                [],
                requestEmailMessage.text
            );
        } catch (mailError) {
            console.error('[EMAIL] Falha ao notificar o usuário sobre o pedido de troca de e-mail:', mailError?.message || mailError);
        }

        await notifyAdminsAboutEmailChangeRequest(user, newEmail, reason);

        return res.json({ success: true, message: 'Pedido enviado para o administrador.' });
    } catch (error) {
        console.error('Erro ao solicitar troca de e-mail:', error);
        return res.status(500).json({ success: false, message: 'Erro ao solicitar troca de e-mail.' });
    }
});

// CHANGE EMAIL
router.post('/change-email', protect, checkBanStatus, async (req, res) => {
    try {
        const { newEmail, code } = req.body;
        const userId = req.user.id;

        if (!newEmail || !code) {
            return res.status(400).json({ success: false, message: 'Preencha todos os campos' });
        }

        // Validar formato do email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return res.status(400).json({ success: false, message: 'Email inválido' });
        }

        // Verificar se o novo email já existe
        const existingUser = await User.findByEmail(newEmail);
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Este email já está registrado' });
        }

        // Verificar o código
        const user = await User.findById(userId);
        if (!user.emailChangeCode || user.emailChangeCode !== code) {
            return res.status(400).json({ success: false, message: 'Código inválido' });
        }

        // Verificar se o código expirou
        const now = new Date();
        function normalizeExpiryDate(value) {
            if (value === null || value === undefined || value === '') return null;
            if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
            if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null;
            const normalized = String(value).trim();
            if (/^\d+$/.test(normalized)) return new Date(Number(normalized));
            const parsed = new Date(normalized);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
        const expiresAt = normalizeExpiryDate(user.emailChangeExpires);
        if (!expiresAt || now > expiresAt) {
            return res.status(400).json({ success: false, message: 'Código expirou. Solicite um novo código.' });
        }

        // Atualizar o email
        await User.updateEmail(userId, newEmail);

        res.json({
            success: true,
            message: 'Email alterado com sucesso!',
            user: {
                id: user.id,
                email: newEmail
            }
        });

    } catch (error) {
        console.error('Erro ao alterar email:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// PUT - Atualizar customTitle de um usuário (apenas para o fundador)
router.put('/:userId/custom-title', protect, checkBanStatus, async (req, res) => {
    try {
        const { userId } = req.params;
        const { customTitle, customTitleSubtitle } = req.body;
        const requestingUserId = req.user.id;

        // Verificar se o usuário solicitante é o fundador
        if (requestingUserId !== OWNER_USER_ID) {
            return res.status(403).json({ success: false, message: 'Apenas o fundador pode gerenciar títulos' });
        }

        // Validar o userId
        const targetUserId = parseInt(userId, 10);
        if (isNaN(targetUserId) || targetUserId <= 0) {
            return res.status(400).json({ success: false, message: 'ID de usuário inválido' });
        }

        // Validar customTitle
        const sanitizedTitle = customTitle ? String(customTitle).trim().substring(0, 100) : null;
        if (customTitle && (sanitizedTitle.length === 0 || sanitizedTitle.length > 100)) {
            return res.status(400).json({ success: false, message: 'O título deve ter entre 1 e 100 caracteres' });
        }

        // Validar customTitleSubtitle
        const sanitizedSubtitle = customTitleSubtitle ? String(customTitleSubtitle).trim().substring(0, 100) : null;
        if (customTitleSubtitle && (sanitizedSubtitle.length === 0 || sanitizedSubtitle.length > 100)) {
            return res.status(400).json({ success: false, message: 'O subtitle deve ter entre 1 e 100 caracteres' });
        }

        // Verificar se o usuário existe
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        // Atualizar o customTitle e customTitleSubtitle
        await User.updateProfile(targetUserId, { 
            customTitle: sanitizedTitle,
            customTitleSubtitle: sanitizedSubtitle
        });

        res.json({
            success: true,
            message: 'Título atualizado com sucesso!',
            user: {
                id: targetUserId,
                customTitle: sanitizedTitle,
                customTitleSubtitle: sanitizedSubtitle
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar customTitle:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

export default router;
