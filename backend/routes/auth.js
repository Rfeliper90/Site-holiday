import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import validator from 'validator';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import Rank from '../models/Rank.js';
import AchievementNotification from '../models/AchievementNotification.js';
import { calculateRankProgress } from '../config/ranks.js';
import { protect, checkBanStatus } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rate-limit.js';
import { getJwtSecret } from '../config/jwt-secret.js';
import db from '../config/database.js';
import { canAccessMembersDirectory } from '../utils/staff-hierarchy.js';
import { googleClientId } from '../config/env.js';
import { buildCodeEmail } from '../utils/transactional-email.js';
import { sendEmail } from '../utils/mailer.js';

const router = express.Router();
const JWT_SECRET = getJwtSecret();
const GOOGLE_CLIENT_ID = String(googleClientId || '').trim();
const googleOAuthClient = new OAuth2Client();
const OWNER_USER_ID = 1;
const OWNER_EMAIL = 'sustmanrft@hotmail.com';
const FIXED_AUTO_RANK_KEY = 'fixed:auto';
const FIXED_MANUAL_RANK_KEY = 'fixed:manual';
const ALLOWED_FIXED_RANK_KEYS = new Set([FIXED_AUTO_RANK_KEY, FIXED_MANUAL_RANK_KEY]);
const TWO_FACTOR_ISSUER = 'HOLIDAY Guild';
const TWO_FACTOR_STEP_SECONDS = 30;
const TWO_FACTOR_DIGITS = 6;
const TWO_FACTOR_WINDOW = 2;
const TWO_FACTOR_LOGIN_TICKET_EXPIRATION = '10m';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TRUSTED_DEVICE_TOKEN_BYTES = 48;
const TWO_FACTOR_REMEMBER_DAY_OPTIONS = [0, 3, 7, 30, 90];
const TWO_FACTOR_DEFAULT_REMEMBER_DAYS = 3;
const TWO_FACTOR_METHOD_AUTHENTICATOR = 'authenticator';
const TWO_FACTOR_METHOD_EMAIL = 'email';
const TWO_FACTOR_LOGIN_METHODS = [TWO_FACTOR_METHOD_AUTHENTICATOR, TWO_FACTOR_METHOD_EMAIL];
const TWO_FACTOR_EMAIL_CODE_TTL_MINUTES = 10;
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

// Gerar token JWT
function generateToken(id) {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d'
    });
}

function getTwoFactorLoginSecret() {
    return `${JWT_SECRET}:2fa-login`;
}

function generateTwoFactorLoginTicket(id) {
    return jwt.sign(
        { id, purpose: '2fa_login' },
        getTwoFactorLoginSecret(),
        { expiresIn: TWO_FACTOR_LOGIN_TICKET_EXPIRATION }
    );
}

function generateGoogleSignupTicket(profile) {
    return jwt.sign(
        { ...profile, purpose: 'google_signup' },
        `${JWT_SECRET}:google-signup`,
        { expiresIn: '10m' }
    );
}

function decodeGoogleSignupTicket(ticket) {
    try {
        const decoded = jwt.verify(String(ticket || ''), `${JWT_SECRET}:google-signup`);
        if (!decoded || decoded.purpose !== 'google_signup' || !decoded.sub || !decoded.email) {
            return null;
        }
        return decoded;
    } catch {
        return null;
    }
}

function normalizeOtpCode(value) {
    return String(value || '').replace(/\s+/g, '').trim();
}

function normalizeAnimatedProfileTheme(value) {
    const raw = String(value || 'auto').trim();
    if (LEGACY_GIF_THEMES.has(raw)) return 'auto';
    return ALLOWED_ANIMATED_PROFILE_THEMES.has(raw) ? raw : 'auto';
}

function normalizeSelectedRankList(value) {
    const parsed = Array.isArray(value) ? value : (() => {
        try {
            return JSON.parse(String(value || '[]'));
        } catch {
            return [];
        }
    })();

    const unique = [];
    const seen = new Set();

    for (const entry of parsed) {
        if (typeof entry === 'number' && Number.isFinite(entry)) {
            const key = `n:${entry}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(entry);
            }
            continue;
        }

        if (typeof entry === 'string') {
            const trimmed = entry.trim();
            if (!trimmed) continue;
            const asNumber = Number(trimmed);
            const key = Number.isFinite(asNumber) ? `n:${asNumber}` : `s:${trimmed}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(asNumber || trimmed);
            }
        }
    }

    return unique;
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

function parseBirthDateUtc(birthDateIso) {
    const raw = String(birthDateIso || '').trim();
    if (!raw) return null;
    const birth = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(birth.getTime())) return null;
    return birth;
}

function getAgeFromBirthDateIso(birthDateIso) {
    const birth = parseBirthDateUtc(birthDateIso);
    if (!birth) return 0;

    const today = new Date();
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
        age -= 1;
    }

    return Math.max(0, age);
}

function isBirthdayTodayUtc(birthDateIso, referenceDate = new Date()) {
    const birth = parseBirthDateUtc(birthDateIso);
    if (!birth) return false;

    return (
        referenceDate.getUTCMonth() === birth.getUTCMonth() &&
        referenceDate.getUTCDate() === birth.getUTCDate()
    );
}

async function triggerBirthdayNotificationsIfNeeded(user) {
    if (!user?.id || !isBirthdayTodayUtc(user.birthDate)) return;

    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const userAge = getAgeFromBirthDateIso(user.birthDate);
    const updates = [];
    const updateParams = [];
    const parsedLastBirthdayYear = Number.parseInt(user.lastBirthdayNotificationYear, 10);
    const birthdayAlreadyNotifiedThisYear =
        Number.isInteger(parsedLastBirthdayYear) && parsedLastBirthdayYear === currentYear;

    if (!birthdayAlreadyNotifiedThisYear) {
        await AchievementNotification.createNotification(user.id, 'Aniversario', {
            message: `Feliz aniversario, @${user.nickname || 'membro'}! A HOLIDAY Guild deseja um dia incrivel para voce.`
        });
        updates.push('lastBirthdayNotificationYear = ?');
        updateParams.push(currentYear);
        user.lastBirthdayNotificationYear = currentYear;
    }

    const eighteenthBirthdayAlreadyNotified = Number(user.eighteenthBirthdayNotified) === 1;
    if (userAge === 18 && !eighteenthBirthdayAlreadyNotified) {
        await AchievementNotification.createNotification(user.id, 'Maioridade', {
            message: 'Parabens pelos 18 anos! Agora a opcao de postar conteudo +18 foi liberada para sua conta. Marque corretamente qualquer conteudo +18 para evitar punicoes.'
        });
        updates.push('eighteenthBirthdayNotified = 1');
        user.eighteenthBirthdayNotified = 1;
    }

    if (updates.length === 0) return;
    updateParams.push(user.id);
    await dbRun(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, updateParams);
}

function normalizeBooleanInput(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const raw = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'sim', 'on'].includes(raw)) return true;
        if (['0', 'false', 'no', 'nao', 'não', 'off'].includes(raw)) return false;
    }
    return fallback;
}

function isValidOtpCode(value) {
    return /^\d{6}$/.test(value);
}

function base32Encode(input) {
    const source = Buffer.isBuffer(input) ? input : Buffer.from(input || '');
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < source.length; i += 1) {
        value = (value << 8) | source[i];
        bits += 8;

        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

function base32Decode(value) {
    const normalized = String(value || '')
        .toUpperCase()
        .replace(/=+$/g, '')
        .replace(/[^A-Z2-7]/g, '');

    let bits = 0;
    let current = 0;
    const bytes = [];

    for (const char of normalized) {
        const idx = BASE32_ALPHABET.indexOf(char);
        if (idx < 0) continue;
        current = (current << 5) | idx;
        bits += 5;

        if (bits >= 8) {
            bytes.push((current >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }

    return Buffer.from(bytes);
}

function generateTwoFactorSecret() {
    return base32Encode(crypto.randomBytes(20));
}

function generateTotpCode(secret, timestampMs = Date.now()) {
    const key = base32Decode(secret);
    if (!key || key.length === 0) return '';

    const counter = Math.floor(timestampMs / 1000 / TWO_FACTOR_STEP_SECONDS);
    const counterBuffer = Buffer.alloc(8);
    const high = Math.floor(counter / 0x100000000);
    const low = counter >>> 0;
    counterBuffer.writeUInt32BE(high, 0);
    counterBuffer.writeUInt32BE(low, 4);

    const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    const otp = binary % (10 ** TWO_FACTOR_DIGITS);

    return String(otp).padStart(TWO_FACTOR_DIGITS, '0');
}

function safeStringEqual(a, b) {
    const left = Buffer.from(String(a || ''), 'utf8');
    const right = Buffer.from(String(b || ''), 'utf8');
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

function verifyTotpCode(secret, code) {
    const normalizedCode = normalizeOtpCode(code);
    if (!isValidOtpCode(normalizedCode)) return false;

    const now = Date.now();
    for (let offset = -TWO_FACTOR_WINDOW; offset <= TWO_FACTOR_WINDOW; offset += 1) {
        const generated = generateTotpCode(secret, now + (offset * TWO_FACTOR_STEP_SECONDS * 1000));
        if (generated && safeStringEqual(generated, normalizedCode)) {
            return true;
        }
    }

    return false;
}

function buildOtpAuthUri(email, secret) {
    const account = `${TWO_FACTOR_ISSUER}:${String(email || '').trim()}`;
    return `otpauth://totp/${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(TWO_FACTOR_ISSUER)}&algorithm=SHA1&digits=${TWO_FACTOR_DIGITS}&period=${TWO_FACTOR_STEP_SECONDS}`;
}

function parseTwoFactorMethod(value) {
    const method = String(value || '').trim().toLowerCase();
    if (!method) return TWO_FACTOR_METHOD_AUTHENTICATOR;
    return TWO_FACTOR_LOGIN_METHODS.includes(method) ? method : null;
}

function generateEmailOtpCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function getEmailOtpExpiryIso() {
    return new Date(Date.now() + TWO_FACTOR_EMAIL_CODE_TTL_MINUTES * 60 * 1000).toISOString();
}

function decodeTwoFactorLoginTicket(loginTicket) {
    const token = String(loginTicket || '').trim();
    if (!token) return { ok: false, message: 'Sessão de login 2FA inválida ou expirada.' };

    try {
        const payload = jwt.verify(token, getTwoFactorLoginSecret());
        if (!payload || payload.purpose !== '2fa_login' || !payload.id) {
            return { ok: false, message: 'Ticket de 2FA inválido.' };
        }
        return { ok: true, payload };
    } catch (error) {
        return { ok: false, message: 'Sessão de login 2FA inválida ou expirada.' };
    }
}

function parseRememberDays(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const integer = Math.trunc(parsed);
    return TWO_FACTOR_REMEMBER_DAY_OPTIONS.includes(integer) ? integer : null;
}

function getRememberDaysOrDefault(value) {
    return parseRememberDays(value) ?? TWO_FACTOR_DEFAULT_REMEMBER_DAYS;
}

function hashValue(raw) {
    return crypto.createHash('sha256').update(String(raw || ''), 'utf8').digest('hex');
}

function hashUserAgent(userAgent) {
    const normalized = String(userAgent || '').trim();
    if (!normalized) return null;
    return hashValue(normalized);
}

async function validateTrustedDevice(userId, rawToken, userAgent) {
    const normalizedToken = String(rawToken || '').trim();
    if (!normalizedToken) return null;

    const tokenHash = hashValue(normalizedToken);
    const uaHash = hashUserAgent(userAgent);
    const nowIso = new Date().toISOString();
    const device = await dbGet(
        `SELECT id, userAgentHash, expiresAt
         FROM trusted_devices
         WHERE userId = ?
           AND tokenHash = ?
           AND revokedAt IS NULL
           AND expiresAt > ?
         LIMIT 1`,
        [userId, tokenHash, nowIso]
    );

    if (!device) return null;
    if (device.userAgentHash && uaHash && device.userAgentHash !== uaHash) return null;

    await dbRun('UPDATE trusted_devices SET lastUsedAt = CURRENT_TIMESTAMP WHERE id = ?', [device.id]);
    return device;
}

async function createTrustedDevice(userId, userAgent, rememberDays) {
    const days = getRememberDaysOrDefault(rememberDays);
    if (days <= 0) {
        await dbRun('DELETE FROM trusted_devices WHERE userId = ?', [userId]);
        return null;
    }

    const rawToken = crypto.randomBytes(TRUSTED_DEVICE_TOKEN_BYTES).toString('hex');
    const tokenHash = hashValue(rawToken);
    const uaHash = hashUserAgent(userAgent);
    const expiresAtIso = new Date(Date.now() + (days * 24 * 60 * 60 * 1000)).toISOString();
    const nowIso = new Date().toISOString();

    await dbRun(
        `DELETE FROM trusted_devices
         WHERE userId = ?
           AND (expiresAt <= ? OR revokedAt IS NOT NULL)`,
        [userId, nowIso]
    );
    if (uaHash) {
        await dbRun(
            `DELETE FROM trusted_devices
             WHERE userId = ?
               AND userAgentHash = ?
               AND revokedAt IS NULL`,
            [userId, uaHash]
        );
    }

    await dbRun(
        `INSERT INTO trusted_devices (userId, tokenHash, userAgentHash, expiresAt)
         VALUES (?, ?, ?, ?)`,
        [userId, tokenHash, uaHash, expiresAtIso]
    );

    return { token: rawToken, expiresAt: expiresAtIso, rememberDays: days };
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
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

async function getActiveLoginBan(userId) {
    const ban = await dbGet(
        `SELECT id, banType, reason, expiresAt
         FROM bans
         WHERE userId = ? AND isActive = 1
         LIMIT 1`,
        [userId]
    );

    if (ban?.banType === 'suspension' && ban.expiresAt && new Date() > new Date(ban.expiresAt)) {
        await dbRun(`UPDATE bans SET isActive = 0 WHERE id = ?`, [ban.id]);
        return null;
    }

    return ban || null;
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

// MISSION AUTO-COMPLETION FOR FIRST 65 USERS
const FIRST_USER_LIMIT = 65;
const MEMBRO_BETA_RANK_NAME = 'Membro BETA';
const USER_MISSIONS_LIST = [
    { key: 'postagens_iniciais', flag: 'canUseAnimatedProfile' },
    { key: 'colecionador_de_postagens', flag: 'canOrderFixedRanks' },
    { key: 'popularidade_em_alta', flag: 'canChangeRankColor' },
    { key: 'voz_ativa', flag: 'canUseProfileTaglineLinks' },
    { key: 'favoritado_pela_guilda', flag: 'canUseExclusiveAnimatedThemes' },
    { key: 'criador_presente', flag: 'canUseAnimatedProfileCustomGif' }
];

// Garantir que o achievement "Membro BETA" existe
async function ensureMemboBetaRankExists() {
    try {
        const existing = await dbGet(
            `SELECT id FROM custom_ranks WHERE name = ?`,
            [MEMBRO_BETA_RANK_NAME]
        );
        
        if (existing) {
            console.log(`[BETA] Achievement "Membro BETA" já existe (ID: ${existing.id})`);
            return existing.id;
        }
        
        // Criar o achievement "Membro BETA"
        const rankId = await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO custom_ranks 
                    (name, color, icon, description, isVisible, canChangeOwnColor, rankGroup)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    MEMBRO_BETA_RANK_NAME,
                    '#8B5CF6', // Roxo (raro)
                    '',
                    'Membro fundador BETA',
                    1, // isVisible = Sim (selecionável para exibir)
                    1, // canChangeOwnColor = Pode customizar cor
                    'progression' // rankGroup (mutuamente exclusivo com outras de progressão)
                ],
                function(err) {
                    if (err) reject(err);
                    else {
                        console.log(`[BETA] ✓ Achievement "Membro BETA" criado (ID: ${this.lastID})`);
                        resolve(this.lastID);
                    }
                }
            );
        });
        
        return rankId;
    } catch (err) {
        console.error(`[BETA] ❌ Erro ao criar achievement:`, err.message);
        throw err;
    }
}

async function completeMissionsForFirstUsers(userId, username) {
    if (userId > FIRST_USER_LIMIT) return;
    
    try {
        console.log(`[MISSIONS] Auto-completando missões para usuário #${userId}...`);
        const now = new Date().toISOString();
        
        for (const mission of USER_MISSIONS_LIST) {
            // Inserir missão como completa
            await dbRun(
                `INSERT OR REPLACE INTO user_missions 
                    (userId, missionKey, acceptedAt, completedAt, rewardGrantedAt)
                    VALUES (?, ?, ?, ?, ?)`,
                [userId, mission.key, now, now, now]
            );
            
            // Conceder permissão de recompensa ao usuário
            await dbRun(
                `UPDATE users SET ${mission.flag} = 1 WHERE id = ?`,
                [userId]
            );
            
            console.log(`[MISSIONS] ✓ ${mission.key} → ${mission.flag} liberado`);
        }
        
        // Criar/garantir que o achievement "Membro BETA" existe
        const betaRankId = await ensureMemboBetaRankExists();
        
        // Atribuir "Membro BETA" com descrição customizada
        const customDescription = `Membro fundador BETA #${userId}`;
        await dbRun(
            `INSERT OR REPLACE INTO user_custom_ranks 
                (userId, customRankId, customDescription)
                VALUES (?, ?, ?)`,
            [userId, betaRankId, customDescription]
        );

        const userRow = await dbGet('SELECT selectedRanks FROM users WHERE id = ? LIMIT 1', [userId]);
        let selectedRanks = [];
        try {
            const parsed = JSON.parse(userRow?.selectedRanks || '[]');
            if (Array.isArray(parsed)) selectedRanks = parsed.map(Number).filter(Number.isInteger);
        } catch {
            selectedRanks = [];
        }
        if (!selectedRanks.includes(Number(betaRankId))) {
            selectedRanks.push(Number(betaRankId));
            await dbRun(
                `UPDATE users SET selectedRanks = ? WHERE id = ?`,
                [JSON.stringify(selectedRanks), userId]
            );
        }
        
        console.log(`[MISSIONS] ✓ "Membro BETA" atribuído ao usuário #${userId}`);
        console.log(`[MISSIONS] ✅ Todas as 6 missões foram auto-completadas para usuário #${userId}`);
    } catch (err) {
        console.error(`[MISSIONS] ❌ Erro ao completar missões para usuário #${userId}:`, err.message);
    }
}

function dedupeRanksByGroup(ranks = []) {
    const seenGroups = new Set();
    const result = [];
    for (const rank of ranks || []) {
        let groupKey = String(rank?.rankGroup || '').trim();
        const icon = String(rank?.icon || '').trim().toUpperCase();
        if (!groupKey && /^P\d+/.test(icon)) groupKey = 'post_achievement';
        if (!groupKey && /^L\d+/.test(icon)) groupKey = 'like_achievement';
        if (groupKey) {
            if (seenGroups.has(groupKey)) continue;
            seenGroups.add(groupKey);
        }
        result.push(rank);
    }
    return result;
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
            description: (rankComplete?.automatic || rankComplete?.automaticCompleted)?.description || 'Conquista automática concluída',
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
            backgroundImage: rankComplete.custom.backgroundImage || null,
            isVisible: 0,
            rankGroup: 'fixed_manual',
            icon: rankComplete.custom.icon || '',
            isFixed: true
        });
    }
    
    // Adicionar o rank automático atual, incluindo Membro Inicial.
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

async function getOrderedProfileDisplayRanks(userId, rankComplete, canOrderFixedRanks) {
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

    if (!canOrderFixedRanks) {
        savedOrder = savedOrder.filter((entry) => (
            typeof entry === 'number' ||
            (userHasBetaRank && entry === FIXED_AUTO_RANK_KEY)
        ));
    }

    const fixedRanks = (canOrderFixedRanks || userHasBetaRank)
        ? await buildFixedProfileRanks(userId, rankComplete, userHasBetaRank)
        : [];
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
        'membro novato', 'membro iniciado', 'membro aprendiz',
        'membro experiente', 'membro adepto', 'membro especialista', 'membro mestre', 'grande mestre',
        'membro lendário', 'membro mítico', 'membro transcendente', 'membro eterno', 'membro imortal'
    ]);
    
    const pushUnique = (rank, fallbackKey = null) => {
        if (!rank) return;

        const rankName = String(rank?.name || '').trim().toLowerCase();
        const uniqueKey = getDisplayRankUniqueKey(rank, fallbackKey);
        const rawId = rank?.id ?? fallbackKey;
        const isFixedAutoRank = String(rawId || '').trim() === FIXED_AUTO_RANK_KEY;
        const isProgressionRank = String(rank?.rankGroup || '').trim().toLowerCase() === 'progression';
        if (rankName === 'membro beta' && !userHasBetaRank) {
            return;
        }
        if (isProgressionRank && rankName !== 'membro beta' && !isFixedAutoRank) {
            return;
        }
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
        } else if (canOrderFixedRanks || (userHasBetaRank && entry === FIXED_AUTO_RANK_KEY)) {
            pushUnique(fixedByKey.get(String(entry)), entry);
        }
    }

    const selectedFallback = dedupeRanksByGroup(await Rank.getSelectedRanks(userId));
    (selectedFallback || []).forEach((rank) => pushUnique(rank, rank?.id));
    if ((canOrderFixedRanks || userHasBetaRank) && savedOrder.some((entry) => entry === FIXED_AUTO_RANK_KEY)) {
        fixedRanks.forEach((rank) => pushUnique(rank, rank?.id));
    }

    const finalOrdered = ordered.filter((rank) => {
        const rankId = String(rank?.id || '').trim();
        if (rankId === FIXED_AUTO_RANK_KEY && hasBetaOverrideSelected) return false;
        return true;
    });

    return dedupeRanksByGroup(finalOrdered);
}

// REGISTER
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, nickname, email, birthDate, password, confirmPassword, termsAccepted } = req.body;
        const acceptedTerms = normalizeBooleanInput(termsAccepted, false);

        // Validações básicas
        if (!firstName || !lastName || !nickname || !email || !birthDate || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Por favor, preencha todos os campos' });
        }

        // Validar primeiro nome
        if (firstName.trim().length < 2 || firstName.trim().length > 50) {
            return res.status(400).json({ success: false, message: 'Primeiro nome deve ter entre 2 e 50 caracteres' });
        }

        // Validar sobrenome
        if (lastName.trim().length < 2 || lastName.trim().length > 50) {
            return res.status(400).json({ success: false, message: 'Sobrenome deve ter entre 2 e 50 caracteres' });
        }

        // Validar nickname
        if (!nickname || nickname.trim().length < 1) {
            return res.status(400).json({ success: false, message: 'Nickname \u00e9 obrigat\u00f3rio' });
        }

        // Validar email
        if (!validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: 'Email inválido' });
        }

        const firstUser = await dbGet('SELECT id FROM users ORDER BY id ASC LIMIT 1');
        if (!firstUser && String(email).trim().toLowerCase() !== OWNER_EMAIL) {
            return res.status(403).json({
                success: false,
                message: 'A primeira conta do site deve ser cadastrada pelo fundador.'
            });
        }

        if (!acceptedTerms) {
            return res.status(400).json({ success: false, message: 'Você precisa aceitar os Termos de Uso para criar a conta' });
        }

        // Validar data de nascimento
        const age = getAgeFromBirthDateIso(birthDate);
        if (age < 18) {
            return res.status(400).json({ success: false, message: 'Cadastro permitido apenas para maiores de 18 anos' });
        }

        // Validar senhas
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'As senhas não conferem' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'A senha deve ter no mínimo 6 caracteres' });
        }

        // Verificar se email já existe
        const existingEmail = await User.findByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ success: false, message: 'Email já cadastrado' });
        }

        // Verificar se nickname já existe (case-insensitive)
        const existingNickname = await User.findByNickname(nickname.toLowerCase());
        if (existingNickname) {
            return res.status(400).json({ success: false, message: 'Nickname já existe' });
        }

        // Criar usuário
        const newUser = await User.create({ 
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            nickname: nickname.toLowerCase(),
            email: email.toLowerCase(),
            birthDate,
            password 
        });

        // Se for a primeira conta (ID 1), atribuir automaticamente "Fundador"
        if (newUser.id === 1) {
            await User.setManualRank(newUser.id, 'Fundador');
            console.log(`[AUTH] Primeira conta criada! conquista "Fundador" atribuído automaticamente`);
        }

        // Auto-completar missões para os primeiros 65 usuários
        await completeMissionsForFirstUsers(newUser.id, newUser.nickname);

        // Gerar código de verificação
        const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await User.setVerificationCode(email.toLowerCase(), verificationCode);

        // Enviar email
        let emailSent = true;
        try {
            const emailMessage = buildCodeEmail({
                title: 'Confirme seu endereço de e-mail',
                greeting: firstName.trim(),
                intro: 'Use o código abaixo para verificar seu endereço e concluir a ativação da sua conta na HOLIDAY Guild.',
                codeLabel: 'CÓDIGO DE VERIFICAÇÃO',
                code: verificationCode,
                expiresIn: '10 minutos',
                notice: 'Se você não criou uma conta na HOLIDAY Guild, ignore esta mensagem. Nenhuma ação será realizada sem o código.',
                noticeTitle: 'Não foi você?'
            });
            await sendEmail(email, 'Confirme seu e-mail | HOLIDAY Guild', emailMessage.html, [], emailMessage.text);
        } catch (emailError) {
            emailSent = false;
            console.log('Erro ao enviar email de verificação após criação:', emailError.message);
        }

        const token = generateToken(newUser.id);

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Usuário criado, mas não foi possível enviar o código de verificação por email. Verifique a configuração de email do servidor.'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Usuário criado! Verifique seu email.',
            token,
            user: newUser
        });

    } catch (error) {
        console.error('Erro no register:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

router.get('/google/config', (req, res) => {
    res.json({
        success: true,
        enabled: Boolean(GOOGLE_CLIENT_ID),
        clientId: GOOGLE_CLIENT_ID
    });
});

router.post('/google/login', loginRateLimiter, async (req, res) => {
    try {
        if (!GOOGLE_CLIENT_ID) {
            return res.status(503).json({ success: false, message: 'Login Google ainda não está configurado.' });
        }

        const credential = String(req.body?.credential || '').trim();
        if (!credential || credential.length > 10000) {
            return res.status(400).json({ success: false, message: 'Credencial Google inválida.' });
        }

        let profile;
        try {
            const ticket = await googleOAuthClient.verifyIdToken({
                idToken: credential,
                audience: GOOGLE_CLIENT_ID
            });
            profile = ticket.getPayload();
        } catch (verificationError) {
            console.warn('Credencial Google recusada:', verificationError.message);
            return res.status(401).json({ success: false, message: 'Não foi possível validar sua conta Google.' });
        }
        const email = String(profile?.email || '').trim().toLowerCase();
        const googleSubject = String(profile?.sub || '').trim();

        if (!googleSubject || !validator.isEmail(email) || profile?.email_verified !== true) {
            return res.status(401).json({ success: false, message: 'A conta Google precisa ter um e-mail verificado.' });
        }

        let user = await dbGet('SELECT * FROM users WHERE googleSubject = ?', [googleSubject]);
        if (user && Number(user.googleLoginEnabled ?? 1) !== 1) {
            return res.status(403).json({
                success: false,
                message: 'O login pelo Google está desativado para esta conta. Entre com seu e-mail ou nickname e senha.'
            });
        }
        if (!user) {
            user = await User.findByEmail(email);
            if (user) {
                if (Number(user.googleLoginEnabled ?? 1) !== 1) {
                    return res.status(403).json({
                        success: false,
                        message: 'O login pelo Google está desativado para esta conta. Entre com seu e-mail ou nickname e senha.'
                    });
                }
                if (user.googleSubject && user.googleSubject !== googleSubject) {
                    return res.status(409).json({
                        success: false,
                        message: 'Esta conta já está vinculada a outro Google. Entre pelo método vinculado.'
                    });
                }

                await dbRun(
                    `UPDATE users SET googleSubject = ?, emailVerified = 1
                     WHERE id = ? AND googleSubject IS NULL`,
                    [googleSubject, user.id]
                );
                user = await dbGet('SELECT * FROM users WHERE id = ?', [user.id]);
                if (!user || user.googleSubject !== googleSubject) {
                    return res.status(409).json({
                        success: false,
                        message: 'Esta conta já está vinculada a outro Google. Entre pelo método vinculado.'
                    });
                }
            }
        }

        if (!user) {
            const firstUser = await dbGet('SELECT id FROM users ORDER BY id ASC LIMIT 1');
            if (!firstUser && email !== OWNER_EMAIL) {
                return res.status(403).json({
                    success: false,
                    message: 'A primeira conta do site deve ser cadastrada pelo fundador.'
                });
            }

            const fullName = String(profile?.name || '').trim();
            const givenName = String(profile?.given_name || fullName.split(/\s+/)[0] || '').trim();
            const familyName = String(profile?.family_name || fullName.split(/\s+/).slice(1).join(' ') || '').trim();
            return res.json({
                success: true,
                needsProfileCompletion: true,
                googleSignupTicket: generateGoogleSignupTicket({
                    sub: googleSubject,
                    email,
                    firstName: givenName.slice(0, 50),
                    lastName: familyName.slice(0, 50)
                })
            });
        }

        const ban = await getActiveLoginBan(user.id);
        if (ban?.banType === 'permanent') {
            return res.status(403).json({ success: false, message: 'Sua conta foi banida permanentemente', banned: true, banType: 'permanent' });
        }
        if (ban?.banType === 'suspension' && ban.expiresAt) {
            const expiryDate = new Date(ban.expiresAt);
            const daysRemaining = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
            return res.status(403).json({
                success: false,
                message: `Sua conta foi suspensa por ${daysRemaining} dia(s). Motivo: ${ban.reason}`,
                banned: true,
                banType: 'suspension',
                daysRemaining
            });
        }

        const twoFactorEnabled = Boolean(user.twoFactorEnabled) && Boolean(user.twoFactorSecret);
        const trustedDeviceToken = String(req.body?.trustedDeviceToken || '').trim();
        const rememberDays = getRememberDaysOrDefault(user.twoFactorRememberDays);
        if (twoFactorEnabled) {
            const trustedDevice = rememberDays > 0 && trustedDeviceToken
                ? await validateTrustedDevice(user.id, trustedDeviceToken, req.get('user-agent'))
                : null;
            if (!trustedDevice) {
                return res.json({
                    success: true,
                    requiresTwoFactor: true,
                    message: 'Digite o código do Authenticator para concluir o login.',
                    loginTicket: generateTwoFactorLoginTicket(user.id),
                    twoFactorMethods: TWO_FACTOR_LOGIN_METHODS,
                    rememberDays,
                    rememberDayOptions: TWO_FACTOR_REMEMBER_DAY_OPTIONS,
                    clearTrustedDeviceToken: Boolean(trustedDeviceToken)
                });
            }
        }

        return res.json({ success: true, token: generateToken(user.id) });
    } catch (error) {
        console.error('Erro no login Google:', error);
        if (String(error?.code || '').startsWith('SQLITE_CONSTRAINT')) {
            return res.status(409).json({
                success: false,
                message: 'Esta conta Google já está vinculada a outro usuário.'
            });
        }
        return res.status(500).json({ success: false, message: 'Erro ao processar o login Google.' });
    }
});

router.post('/google/complete-profile', loginRateLimiter, async (req, res) => {
    try {
        const googleProfile = decodeGoogleSignupTicket(req.body?.googleSignupTicket);
        if (!googleProfile) {
            return res.status(401).json({ success: false, message: 'Sessão Google expirada. Tente novamente.' });
        }

        const nickname = String(req.body?.nickname || '').trim().toLowerCase();
        const birthDate = String(req.body?.birthDate || '').trim();
        if (!normalizeBooleanInput(req.body?.termsAccepted, false)) {
            return res.status(400).json({ success: false, message: 'Você precisa aceitar os Termos de Uso para criar a conta.' });
        }
        if (!/^[\p{L}\p{N}_.-]{3,20}$/u.test(nickname)) {
            return res.status(400).json({ success: false, message: 'O nickname deve ter de 3 a 20 caracteres e usar apenas letras, números, ponto, hífen ou sublinhado.' });
        }
        if (!validator.isISO8601(birthDate, { strict: true, strictSeparator: true }) || getAgeFromBirthDateIso(birthDate) < 18) {
            return res.status(400).json({ success: false, message: 'Cadastro permitido apenas para maiores de 18 anos. Informe uma data válida.' });
        }

        const firstUser = await dbGet('SELECT id FROM users ORDER BY id ASC LIMIT 1');
        if (!firstUser && googleProfile.email !== OWNER_EMAIL) {
            return res.status(403).json({
                success: false,
                message: 'A primeira conta do site deve ser cadastrada pelo fundador.'
            });
        }

        const existingEmail = await User.findByEmail(googleProfile.email);
        if (existingEmail) {
            return res.status(409).json({ success: false, message: 'Este e-mail já possui uma conta. Entre com Google novamente para vinculá-la.' });
        }
        if (await User.findByNickname(nickname)) {
            return res.status(409).json({ success: false, message: 'Este nickname já está em uso. Escolha outro.' });
        }

        const user = await User.create({
            firstName: String(googleProfile.firstName || 'Usuário').trim() || 'Usuário',
            lastName: String(googleProfile.lastName || '').trim(),
            nickname,
            email: googleProfile.email,
            birthDate,
            password: crypto.randomBytes(48).toString('base64url'),
            googleSubject: googleProfile.sub,
            emailVerified: 1
        });

        if (user.id === 1) {
            await User.setManualRank(user.id, 'Fundador');
        }
        await completeMissionsForFirstUsers(user.id, user.nickname);

        return res.json({ success: true, token: generateToken(user.id) });
    } catch (error) {
        console.error('Erro ao concluir cadastro Google:', error);
        if (String(error?.code || '').startsWith('SQLITE_CONSTRAINT')) {
            return res.status(409).json({ success: false, message: 'E-mail ou nickname já está em uso. Confira os dados e tente novamente.' });
        }
        return res.status(500).json({ success: false, message: 'Erro ao concluir o cadastro Google.' });
    }
});

// LOGIN
router.post('/login', loginRateLimiter, async (req, res) => {
    try {
        const { nickname, password } = req.body;

        if (!nickname || !password) {
            return res.status(400).json({ success: false, message: 'Nickname/Email e senha são obrigatórios' });
        }

        console.log(`[LOGIN] Tentando login com nickname: ${nickname}`);

        // Tentar encontrar o usuário por nickname ou email
        let user = await User.findByNickname(nickname.toLowerCase());
        
        // Se não encontrar por nickname, tenta por email
        if (!user) {
            console.log(`[LOGIN] Usuário não encontrado por nickname, tentando por email...`);
            user = await User.findByEmail(nickname);
        }

        if (!user) {
            console.log(`[LOGIN] Usuário não encontrado`);
            return res.status(401).json({ success: false, message: 'Nickname/Email ou senha incorretos' });
        }

        console.log(`[LOGIN] Usuário encontrado: ${user.nickname}, email verificado: ${user.emailVerified}`);

        if (!user.emailVerified) {
            console.log(`[LOGIN] Email não verificado`);
            return res.status(401).json({ 
                success: false, 
                message: 'Email não verificado. Verifique seu email antes de fazer login.',
                needsVerification: true,
                email: user.email
            });
        }

        console.log(`[LOGIN] Verificando senha...`);
        const isPasswordValid = await User.verifyPassword(password, user.password);
        console.log(`[LOGIN] Senha válida: ${isPasswordValid}`);
        
        if (!isPasswordValid) {
            console.log(`[LOGIN] Senha incorreta para o usuário ${user.nickname}`);
            return res.status(401).json({ success: false, message: 'Nickname/Email ou senha incorretos' });
        }

        const ban = await getActiveLoginBan(user.id);

        if (ban) {
            if (ban.banType === 'permanent') {
                console.log(`[LOGIN] Usuário ${user.nickname} está permanentemente banido`);
                return res.status(403).json({ 
                    success: false, 
                    message: 'Sua conta foi banida permanentemente',
                    banned: true,
                    banType: 'permanent'
                });
            }

            if (ban.banType === 'suspension' && ban.expiresAt) {
                const expiryDate = new Date(ban.expiresAt);
                const daysRemaining = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                console.log(`[LOGIN] Usuário ${user.nickname} está suspenso por ${daysRemaining} dias`);
                return res.status(403).json({ 
                    success: false, 
                    message: `Sua conta foi suspensa por ${daysRemaining} dia(s). Motivo: ${ban.reason}`,
                    banned: true,
                    banType: 'suspension',
                    daysRemaining: daysRemaining
                });
            }
        }

        const twoFactorEnabled = Boolean(user.twoFactorEnabled) && Boolean(user.twoFactorSecret);
        const trustedDeviceToken = String(req.body?.trustedDeviceToken || '').trim();
        const rememberDays = getRememberDaysOrDefault(user.twoFactorRememberDays);
        if (twoFactorEnabled) {
            let trustedDeviceValid = false;
            if (rememberDays > 0 && trustedDeviceToken) {
                const trustedDevice = await validateTrustedDevice(user.id, trustedDeviceToken, req.get('user-agent'));
                trustedDeviceValid = Boolean(trustedDevice);
            }

            if (!trustedDeviceValid) {
                const loginTicket = generateTwoFactorLoginTicket(user.id);
                return res.json({
                    success: true,
                    requiresTwoFactor: true,
                    message: 'Digite o código do Authenticator para concluir o login.',
                    loginTicket,
                    twoFactorMethods: TWO_FACTOR_LOGIN_METHODS,
                    rememberDays,
                    rememberDayOptions: TWO_FACTOR_REMEMBER_DAY_OPTIONS,
                    clearTrustedDeviceToken: Boolean(trustedDeviceToken)
                });
            }
        }

        const token = generateToken(user.id);
        const rank = await Rank.getUserRank(user.id);

        // Conceder automaticamente conquistas especiais ativas (se configurado)
        const awardedRanks = [];
        try {
            const nowIso = new Date().toISOString();
            const activeSpecials = await new Promise((resolve) => {
                db.all(
                    `SELECT id, name FROM custom_ranks WHERE isSpecial = 1 AND autoAwardOnLogin = 1 AND (eventStartDate IS NULL OR DATE(eventStartDate) <= DATE(?)) AND (eventEndDate IS NULL OR DATE(eventEndDate) >= DATE(?))`,
                    [nowIso, nowIso],
                    (err, rows) => {
                        if (err) return resolve([]);
                        resolve(rows || []);
                    }
                );
            });

            for (const r of activeSpecials) {
                const exists = await new Promise((resolve) => {
                    db.get(
                        `SELECT id FROM user_custom_ranks WHERE userId = ? AND customRankId = ? LIMIT 1`,
                        [user.id, r.id],
                        (err, row) => resolve(Boolean(row))
                    );
                });

                if (!exists) {
                    await new Promise((resolve) => {
                        db.run(
                            `INSERT INTO user_custom_ranks (userId, customRankId, assignedAt) VALUES (?, ?, CURRENT_TIMESTAMP)`,
                            [user.id, r.id],
                            () => resolve()
                        );
                    });

                    try {
                        const userRow = await new Promise((resolve) => {
                            db.get(
                                `SELECT selectedRanks FROM users WHERE id = ? LIMIT 1`,
                                [user.id],
                                (err, row) => resolve(row || null)
                            );
                        });

                        let selectedRanks = [];
                        if (userRow?.selectedRanks) {
                            try { selectedRanks = JSON.parse(userRow.selectedRanks) || []; } catch { selectedRanks = []; }
                        }
                        if (!selectedRanks.some((value) => Number(value) === Number(r.id))) {
                            selectedRanks.push(Number(r.id));
                            if (selectedRanks.length > 4) selectedRanks = selectedRanks.slice(-4);
                            await new Promise((resolve) => {
                                db.run(
                                    `UPDATE users SET selectedRanks = ? WHERE id = ?`,
                                    [JSON.stringify(selectedRanks), user.id],
                                    () => resolve()
                                );
                            });
                        }
                    } catch (selectionError) {
                        console.error('[LOGIN] Erro ao atualizar selectedRanks para conquista especial:', selectionError);
                    }

                    awardedRanks.push({ id: r.id, name: r.name });
                    // Criar notificação de conquista (se houver model/util disponível)
                    try {
                        await AchievementNotification.createNotification(user.id, r.name, {
                            message: `Você recebeu a conquista especial "${r.name}".`
                        });
                    } catch (e) {
                        // ignorar falha na notificação
                    }
                }
            }
        } catch (e) {
            console.error('[LOGIN] Erro ao conceder conquistas especiais:', e);
        }

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
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
                profileTagUseGradient: normalizeBooleanInput(user.profileTagUseGradient, false),
                showFullNameInMiniProfile: normalizeBooleanInput(user.showFullNameInMiniProfile, true),
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
                twoFactorEnabled: Boolean(user.twoFactorEnabled) && Boolean(user.twoFactorSecret),
                twoFactorRememberDays: rememberDays
            },
            rank,
            awardedRanks
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// TWO-FACTOR AUTHENTICATOR (OPTIONAL)
router.get('/2fa/status', protect, checkBanStatus, async (req, res) => {
    try {
        const user = await dbGet(
            'SELECT twoFactorEnabled, twoFactorSecret, twoFactorRememberDays FROM users WHERE id = ?',
            [req.user.id]
        );
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        res.json({
            success: true,
            enabled: Boolean(user.twoFactorEnabled) && Boolean(user.twoFactorSecret),
            methods: TWO_FACTOR_LOGIN_METHODS,
            rememberDays: getRememberDaysOrDefault(user.twoFactorRememberDays),
            rememberDayOptions: TWO_FACTOR_REMEMBER_DAY_OPTIONS
        });
    } catch (error) {
        console.error('Erro ao buscar status do 2FA:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

router.post('/2fa/settings', protect, checkBanStatus, async (req, res) => {
    try {
        const rememberDays = parseRememberDays(req.body?.rememberDays);
        if (rememberDays === null) {
            return res.status(400).json({
                success: false,
                message: 'Selecione um intervalo válido (Desativado, 3, 7, 30 ou 90 dias).'
            });
        }

        await dbRun('UPDATE users SET twoFactorRememberDays = ? WHERE id = ?', [rememberDays, req.user.id]);
        if (rememberDays === 0) {
            await dbRun('DELETE FROM trusted_devices WHERE userId = ?', [req.user.id]);
        }

        res.json({
            success: true,
            message: 'Intervalo de solicitação do 2FA atualizado.',
            rememberDays,
            rememberDayOptions: TWO_FACTOR_REMEMBER_DAY_OPTIONS
        });
    } catch (error) {
        console.error('Erro ao salvar configurações do 2FA:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

router.post('/2fa/setup', protect, checkBanStatus, async (req, res) => {
    try {
        const user = await dbGet(
            'SELECT email, twoFactorEnabled, twoFactorSecret, twoFactorRememberDays FROM users WHERE id = ?',
            [req.user.id]
        );
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        if (Boolean(user.twoFactorEnabled) && Boolean(user.twoFactorSecret)) {
            return res.status(400).json({ success: false, message: '2FA já está ativado para esta conta' });
        }

        const secret = generateTwoFactorSecret();
        const otpauthUri = buildOtpAuthUri(user.email, secret);

        await dbRun(
            'UPDATE users SET twoFactorTempSecret = ?, twoFactorEnabled = 0, twoFactorSecret = NULL WHERE id = ?',
            [secret, req.user.id]
        );

        res.json({
            success: true,
            message: 'Escaneie a chave no app Authenticator e confirme com o código de 6 dígitos.',
            secret,
            otpauthUri,
            rememberDays: getRememberDaysOrDefault(user.twoFactorRememberDays),
            rememberDayOptions: TWO_FACTOR_REMEMBER_DAY_OPTIONS
        });
    } catch (error) {
        console.error('Erro ao iniciar setup do 2FA:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

router.post('/2fa/enable', protect, checkBanStatus, async (req, res) => {
    try {
        const code = normalizeOtpCode(req.body?.code);
        if (!isValidOtpCode(code)) {
            return res.status(400).json({ success: false, message: 'Código inválido. Use 6 dígitos.' });
        }

        const user = await dbGet('SELECT twoFactorTempSecret FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }
        if (!user.twoFactorTempSecret) {
            return res.status(400).json({ success: false, message: 'Inicie a configuração do 2FA primeiro.' });
        }

        const valid = verifyTotpCode(user.twoFactorTempSecret, code);
        if (!valid) {
            return res.status(400).json({ success: false, message: 'Código inválido. Tente novamente.' });
        }

        await dbRun(
            `UPDATE users
             SET twoFactorEnabled = 1,
                 twoFactorSecret = twoFactorTempSecret,
                 twoFactorTempSecret = NULL,
                 twoFactorEmailCode = NULL,
                 twoFactorEmailExpires = NULL
             WHERE id = ?`,
            [req.user.id]
        );

        res.json({ success: true, message: '2FA ativado com sucesso!' });
    } catch (error) {
        console.error('Erro ao ativar 2FA:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

router.post('/2fa/disable', protect, checkBanStatus, async (req, res) => {
    try {
        const code = normalizeOtpCode(req.body?.code);
        if (!isValidOtpCode(code)) {
            return res.status(400).json({ success: false, message: 'Código inválido. Use 6 dígitos.' });
        }

        const user = await dbGet('SELECT twoFactorEnabled, twoFactorSecret FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }
        if (!Boolean(user.twoFactorEnabled) || !user.twoFactorSecret) {
            return res.json({ success: true, message: '2FA já está desativado.' });
        }

        const valid = verifyTotpCode(user.twoFactorSecret, code);
        if (!valid) {
            return res.status(400).json({ success: false, message: 'Código inválido. Não foi possível desativar.' });
        }

        await dbRun(
            `UPDATE users
             SET twoFactorEnabled = 0,
                 twoFactorSecret = NULL,
                 twoFactorTempSecret = NULL,
                 twoFactorEmailCode = NULL,
                 twoFactorEmailExpires = NULL
             WHERE id = ?`,
            [req.user.id]
        );
        await dbRun('DELETE FROM trusted_devices WHERE userId = ?', [req.user.id]);

        res.json({ success: true, message: '2FA desativado com sucesso.' });
    } catch (error) {
        console.error('Erro ao desativar 2FA:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

router.post('/2fa/send-email-code', loginRateLimiter, async (req, res) => {
    try {
        const loginTicket = String(req.body?.loginTicket || '').trim();
        const decoded = decodeTwoFactorLoginTicket(loginTicket);
        if (!decoded.ok) {
            return res.status(401).json({ success: false, message: decoded.message });
        }

        const user = await User.findById(decoded.payload.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }
        if (!Boolean(user.twoFactorEnabled) || !user.twoFactorSecret) {
            return res.status(400).json({ success: false, message: '2FA não está habilitado para esta conta.' });
        }

        const code = generateEmailOtpCode();
        const codeHash = hashValue(code);
        const expiresAt = getEmailOtpExpiryIso();

        await dbRun(
            `UPDATE users
             SET twoFactorEmailCode = ?,
                 twoFactorEmailExpires = ?
             WHERE id = ?`,
            [codeHash, expiresAt, user.id]
        );

        try {
            const emailMessage = buildCodeEmail({
                title: 'Confirme seu acesso à conta',
                intro: 'Use este código para concluir seu login na HOLIDAY Guild. O código é de uso único.',
                codeLabel: 'CÓDIGO DE LOGIN 2FA',
                code,
                expiresIn: `${TWO_FACTOR_EMAIL_CODE_TTL_MINUTES} minutos`,
                notice: 'Se você não iniciou este login, não informe o código a ninguém. Recomendamos alterar sua senha se suspeitar de acesso não autorizado.',
                noticeTitle: 'Você não tentou entrar?'
            });
            await sendEmail(user.email, 'Seu código de acesso | HOLIDAY Guild', emailMessage.html, [], emailMessage.text);
        } catch (emailError) {
            await dbRun(
                `UPDATE users
                 SET twoFactorEmailCode = NULL,
                     twoFactorEmailExpires = NULL
                 WHERE id = ?`,
                [user.id]
            );
            console.error('Erro ao enviar código 2FA por e-mail:', emailError);
            return res.status(502).json({
                success: false,
                message: 'Não foi possível enviar o código por e-mail agora. Tente novamente.'
            });
        }

        res.json({
            success: true,
            message: `Código enviado para ${user.email}. Verifique sua caixa de entrada.`
        });
    } catch (error) {
        console.error('Erro ao enviar código 2FA por e-mail:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

router.post('/2fa/verify-login', loginRateLimiter, async (req, res) => {
    try {
        const loginTicket = String(req.body?.loginTicket || '').trim();
        const code = normalizeOtpCode(req.body?.code);
        const method = parseTwoFactorMethod(req.body?.method);

        if (!loginTicket || !isValidOtpCode(code)) {
            return res.status(400).json({ success: false, message: 'Ticket e código de 6 dígitos são obrigatórios.' });
        }
        if (!method) {
            return res.status(400).json({ success: false, message: 'Método 2FA inválido.' });
        }

        const decoded = decodeTwoFactorLoginTicket(loginTicket);
        if (!decoded.ok) {
            return res.status(401).json({ success: false, message: decoded.message });
        }

        const user = await User.findById(decoded.payload.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        if (!Boolean(user.twoFactorEnabled) || !user.twoFactorSecret) {
            return res.status(400).json({ success: false, message: '2FA não está habilitado para esta conta.' });
        }

        if (method === TWO_FACTOR_METHOD_EMAIL) {
            const emailCodeHash = String(user.twoFactorEmailCode || '').trim();
            const emailCodeExpires = String(user.twoFactorEmailExpires || '').trim();
            if (!emailCodeHash || !emailCodeExpires) {
                return res.status(400).json({
                    success: false,
                    message: 'Solicite o código por e-mail antes de confirmar o login.'
                });
            }

            const expiresAt = new Date(emailCodeExpires);
            if (Number.isNaN(expiresAt.getTime()) || Date.now() > expiresAt.getTime()) {
                await dbRun(
                    `UPDATE users
                     SET twoFactorEmailCode = NULL,
                         twoFactorEmailExpires = NULL
                     WHERE id = ?`,
                    [user.id]
                );
                return res.status(401).json({ success: false, message: 'Código por e-mail expirado. Solicite um novo.' });
            }

            const codeHash = hashValue(code);
            const validEmailCode = safeStringEqual(codeHash, emailCodeHash);
            if (!validEmailCode) {
                return res.status(401).json({ success: false, message: 'Código de e-mail inválido.' });
            }
        } else {
            const validAuthCode = verifyTotpCode(user.twoFactorSecret, code);
            if (!validAuthCode) {
                return res.status(401).json({ success: false, message: 'Código do Authenticator inválido.' });
            }
        }

        await dbRun(
            `UPDATE users
             SET twoFactorEmailCode = NULL,
                 twoFactorEmailExpires = NULL
             WHERE id = ?`,
            [user.id]
        );

        const rememberDays = getRememberDaysOrDefault(user.twoFactorRememberDays);
        const trustedDevice = await createTrustedDevice(user.id, req.get('user-agent'), rememberDays);

        const token = generateToken(user.id);
        const rank = await Rank.getUserRank(user.id);

        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
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
                profileTagUseGradient: normalizeBooleanInput(user.profileTagUseGradient, false),
                showFullNameInMiniProfile: normalizeBooleanInput(user.showFullNameInMiniProfile, true),
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
                twoFactorEnabled: Boolean(user.twoFactorEnabled) && Boolean(user.twoFactorSecret),
                twoFactorRememberDays: rememberDays
            },
            rank,
            trustedDeviceToken: trustedDevice?.token || null,
            trustedDeviceExpiresAt: trustedDevice?.expiresAt || null
        });
    } catch (error) {
        console.error('Erro ao verificar login 2FA:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// VERIFY EMAIL
router.post('/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedCode = String(code || '').trim().toUpperCase();

        if (!normalizedEmail || !normalizedCode) {
            return res.status(400).json({ success: false, message: 'Email e código são obrigatórios' });
        }

        const user = await User.verifyEmail(normalizedEmail, normalizedCode);
        if (!user) {
            return res.status(400).json({ success: false, message: 'Código inválido ou expirado' });
        }

        // Gerar token e retornar para que o frontend possa realizar auto-login
        try {
            const token = generateToken(user.id);
            // Retornar também alguns dados do usuário para o frontend (sem campos sensíveis)
            const safeUser = {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                nickname: user.nickname,
                email: user.email,
                emailVerified: 1
            };

            return res.json({ success: true, message: 'Email verificado com sucesso!', token, user: safeUser });
        } catch (err) {
            console.error('Erro ao gerar token após verificação:', err);
            return res.status(500).json({ success: true, message: 'Email verificado, mas erro ao gerar token' });
        }

    } catch (error) {
        console.error('Erro na verificação:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// REENVIAR CÓDIGO DE VERIFICAÇÃO
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email \u00e9 obrigat\u00f3rio' });
        }

        const user = await User.findByEmail(email.toLowerCase());
        if (!user) {
            return res.status(400).json({ success: false, message: 'Email não encontrado' });
        }

        if (user.emailVerified) {
            return res.status(400).json({ success: false, message: 'Email já verificado' });
        }

        // Gerar novo código
        const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await User.setVerificationCode(email.toLowerCase(), verificationCode);

        // Enviar email
        try {
            const emailMessage = buildCodeEmail({
                title: 'Verifique seu endereço de e-mail',
                intro: 'Você solicitou um novo código para verificar seu endereço na HOLIDAY Guild. Use o código abaixo para continuar.',
                codeLabel: 'NOVO CÓDIGO DE VERIFICAÇÃO',
                code: verificationCode,
                expiresIn: '10 minutos',
                notice: 'Se você não solicitou este código, ignore a mensagem e não o compartilhe.',
                noticeTitle: 'Aviso de segurança'
            });
            await sendEmail(email, 'Novo código de verificação | HOLIDAY Guild', emailMessage.html, [], emailMessage.text);
        } catch (emailError) {
            console.log('Erro ao enviar email de reenviar verificação:', emailError.message);
            return res.status(500).json({
                success: false,
                message: 'Não foi possível reenviar o código. Verifique a configuração de email do servidor.'
            });
        }

        res.json({ success: true, message: 'Código reenviado para seu email!' });

    } catch (error) {
        console.error('Erro ao reenviar código:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        if (!normalizedEmail) {
            return res.status(400).json({ success: false, message: 'Email e obrigat\u00f3rio' });
        }

        if (!validator.isEmail(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'Esse e-mail não e um e-mail valido' });
        }

        const user = await User.findByEmail(normalizedEmail);
        if (!user) {
            return res.status(400).json({ success: false, message: 'Esse e-mail não esta cadastrado' });
        }

        const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await User.setResetCode(normalizedEmail, resetCode);

        try {
            const emailMessage = buildCodeEmail({
                title: 'Redefinição de senha solicitada',
                intro: 'Recebemos uma solicitação para alterar a senha da sua conta HOLIDAY Guild. Digite este código na página de recuperação para escolher uma nova senha.',
                codeLabel: 'CÓDIGO PARA REDEFINIR A SENHA',
                code: resetCode,
                expiresIn: '15 minutos',
                notice: 'Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanecerá a mesma. Nunca compartilhe este código.',
                noticeTitle: 'Proteja sua conta'
            });
            await sendEmail(normalizedEmail, 'Redefinição de senha | HOLIDAY Guild', emailMessage.html, [], emailMessage.text);
        } catch (emailError) {
            console.log('Erro ao enviar email:', emailError.message);
            return res.status(502).json({
                success: false,
                message: 'Não foi poss\u00edvel enviar o c\u00f3digo para este e-mail. Tente novamente.'
            });
        }

        res.json({
            success: true,
            message: 'C\u00f3digo enviado para seu e-mail!'
        });

    } catch (error) {
        console.error('Erro no forgot-password:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// RESET PASSWORD
// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword, confirmPassword } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        if (!normalizedEmail || !code || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Preencha todos os campos' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'As senhas não conferem' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'A senha deve ter no minimo 6 caracteres' });
        }

        const user = await User.verifyResetCode(normalizedEmail, code);
        if (!user) {
            return res.status(400).json({ success: false, message: 'C\u00f3digo inv\u00e1lido ou expirado' });
        }

        await User.updatePassword(user.id, newPassword);

        res.json({
            success: true,
            message: 'Senha alterada com sucesso!'
        });

    } catch (error) {
        console.error('Erro no reset-password:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// VERIFY RESET CODE (without changing password)
// VERIFY RESET CODE (without changing password)
router.post('/verify-reset-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        if (!normalizedEmail || !code) {
            return res.status(400).json({ success: false, message: 'Email e c\u00f3digo obrigat\u00f3rios' });
        }

        const user = await User.verifyResetCode(normalizedEmail, code);
        if (!user) {
            return res.status(400).json({ success: false, message: 'C\u00f3digo inv\u00e1lido ou expirado' });
        }

        res.json({
            success: true,
            message: 'C\u00f3digo validado com sucesso!'
        });

    } catch (error) {
        console.error('Erro em verify-reset-code:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// RESEND RESET CODE
// RESEND RESET CODE
router.post('/resend-reset', async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        if (!normalizedEmail) {
            return res.status(400).json({ success: false, message: 'Email obrigat\u00f3rio' });
        }

        if (!validator.isEmail(normalizedEmail)) {
            return res.status(400).json({ success: false, message: 'Esse e-mail não e um e-mail valido' });
        }

        const user = await User.findByEmail(normalizedEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Esse e-mail não esta cadastrado' });
        }

        const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await User.setResetCode(normalizedEmail, resetCode);

        try {
            const emailMessage = buildCodeEmail({
                title: 'Seu novo código de redefinição',
                intro: 'Conforme solicitado, geramos um novo código para redefinir a senha da sua conta HOLIDAY Guild. Use este código na página de recuperação.',
                codeLabel: 'NOVO CÓDIGO PARA REDEFINIR A SENHA',
                code: resetCode,
                expiresIn: '15 minutos',
                notice: 'Este novo código substitui o anterior. Se você não pediu outro código, ignore este e-mail e não compartilhe o código.',
                noticeTitle: 'Proteja sua conta'
            });
            await sendEmail(normalizedEmail, 'Novo código para redefinir sua senha | HOLIDAY Guild', emailMessage.html, [], emailMessage.text);
        } catch (emailError) {
            console.log('Erro ao reenviar email de reset:', emailError.message);
            return res.status(502).json({
                success: false,
                message: 'Não foi poss\u00edvel reenviar o c\u00f3digo agora. Tente novamente.'
            });
        }

        res.json({
            success: true,
            message: 'Novo c\u00f3digo enviado para seu e-mail'
        });

    } catch (error) {
        console.error('Erro em resend-reset:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

// GET USER PROFILE
// GET USER PROFILE
router.get('/profile', protect, checkBanStatus, async (req, res) => {
    try {
        console.log(`[AUTH] Buscando perfil para usuário ID: ${req.user.id}`);
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        console.log(`[AUTH] Usuário encontrado:`, { id: user.id, firstName: user.firstName, lastName: user.lastName, manualRank: user.manualRank });

        try {
            await triggerBirthdayNotificationsIfNeeded(user);
        } catch (birthdayError) {
            console.error('[AUTH] Erro ao gerar notificacoes de aniversario:', birthdayError);
        }

        const rank = await Rank.getUserRank(user.id);
        const rankComplete = await Rank.getUserRankComplete(user.id);
        const rankHistory = await Rank.getRankHistory(user.id);
        
        // Calcular progresso de dias
        const rankProgress = calculateRankProgress(user.createdAt);
        const rankAllowsOrderAll = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 1 as allowed
                 FROM user_custom_ranks ucr
                 JOIN custom_ranks cr ON cr.id = ucr.customRankId
                 WHERE ucr.userId = ? AND cr.canOrderAllRanks = 1
                 LIMIT 1`,
                [user.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(Boolean(row));
                }
            );
        });
        const rankAllowsAnimatedProfile = await new Promise((resolve, reject) => {
            db.get(
                `SELECT 1 as allowed
                 FROM user_custom_ranks ucr
                 JOIN custom_ranks cr ON cr.id = ucr.customRankId
                 WHERE ucr.userId = ? AND cr.canUseAnimatedProfile = 1
                 LIMIT 1`,
                [user.id],
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
                [user.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(Boolean(row));
                }
            );
        });
        const isOwner = Number(user.id) === OWNER_USER_ID || String(user.email || '').trim().toLowerCase() === OWNER_EMAIL;
        const pendingEmailChangeRequest = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM admin_tickets WHERE userId = ? AND title = 'Pedido de troca de e-mail' LIMIT 1`,
                [user.id],
                (err, row) => err ? reject(err) : resolve(Boolean(row))
            );
        });
        const canOrderFixedRanks =
            isOwner ||
            Number(user.canOrderFixedRanks) === 1 ||
            rankAllowsOrderAll;
        const canChangeRankColor =
            isOwner ||
            Number(user.canChangeRankColor) === 1 ||
            rankAllowsColorChange;
        const canUseAnimatedProfile =
            isOwner ||
            Number(user.canUseAnimatedProfile) === 1 ||
            rankAllowsAnimatedProfile;
        const canUseProfileTaglineLinks =
            isOwner ||
            Number(user.canUseProfileTaglineLinks) === 1;
        const canUseExclusiveAnimatedThemes =
            isOwner ||
            Number(user.canUseExclusiveAnimatedThemes) === 1;
        const canUseAnimatedProfileCustomGif =
            isOwner ||
            Number(user.canUseAnimatedProfileCustomGif) === 1;
        const animatedProfileTheme = normalizeAnimatedProfileTheme(user.animatedProfileTheme);
        const animatedProfileVisualMode = normalizeAnimatedProfileVisualMode(user.animatedProfileVisualMode);
        const animatedProfileGifUrl = normalizeAnimatedGifUrl(user.animatedProfileGifUrl);
        const animatedProfileGiphyId = String(user.animatedProfileGiphyId || '').trim();
        const animatedMiniProfileEnabled = canUseAnimatedProfile
            ? Number(user.animatedMiniProfileEnabled ?? user.animatedProfileEnabled) === 1
            : false;
        const animatedDownloadCardEnabled = canUseAnimatedProfile
            ? Number(user.animatedDownloadCardEnabled ?? user.animatedProfileEnabled) === 1
            : false;
        const userAge = getAgeFromBirthDateIso(user.birthDate);
        const isAdult = userAge >= 18;
        const showAdultPosts = isAdult ? Number(user.showAdultPosts) === 1 : false;
        const canAccessMembersPage = await canAccessMembersDirectory(user.id);

        // Obter conquistas na ordem oficial de exibição do perfil
        const selectedRanks = await getOrderedProfileDisplayRanks(user.id, rankComplete, canOrderFixedRanks);

        res.json({
            success: true,
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
                aqwCharPageUrl: user.aqwCharPageUrl || null,
                birthDate: user.birthDate,
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
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
                manualRank: user.manualRank,
                canUploadDownloads: Number(user.canUploadDownloads) === 1,
                canOrderFixedRanks,
                canChangeRankColor,
                canUseAnimatedProfile,
                canUseProfileTaglineLinks,
                canUseExclusiveAnimatedThemes,
                canUseAnimatedProfileCustomGif,
                canAccessMembersPage,
                isAdult,
                showAdultPosts,
                animatedProfileEnabled: animatedMiniProfileEnabled || animatedDownloadCardEnabled,
                animatedMiniProfileEnabled,
                animatedDownloadCardEnabled,
                animatedProfileTheme,
                animatedProfileVisualMode,
                animatedProfileGifUrl,
                animatedProfileGiphyId,
                twoFactorEnabled: Boolean(user.twoFactorEnabled) && Boolean(user.twoFactorSecret),
                twoFactorRememberDays: getRememberDaysOrDefault(user.twoFactorRememberDays)
            },
            rank,
            rankComplete,
            rankHistory,
            selectedRanks: selectedRanks || [],
            displayRanks: selectedRanks || [],
            rankProgress: {
                currentDays: rankProgress.currentDays,
                daysInCurrentRank: rankProgress.daysInCurrentRank,
                daysUntilNextRank: rankProgress.daysUntilNextRank,
                progressPercent: rankProgress.progressPercent,
                totalDaysInRank: rankProgress.totalDaysInRank
            }
        });

    } catch (error) {
        console.error('Erro ao buscar profile:', error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
});

export default router;
