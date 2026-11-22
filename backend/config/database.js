import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const configuredDbPath = process.env.DATABASE_PATH || process.env.DB_PATH;
const DB_PATH = configuredDbPath
    ? path.resolve(projectRoot, configuredDbPath)
    : path.join(projectRoot, 'database', 'holiday.db');
const dbDir = path.dirname(DB_PATH);

// Criar pasta de database se n�o existir
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const DEFAULT_WHATSAPP_URL = 'https://chat.whatsapp.com/EDqaY8udJmFCTVCTex3b5p';
const DEFAULT_DISCORD_URL = 'https://discord.gg/KEc4ZdR3';

export const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('[DB] Erro ao conectar:', err);
    } else {
        console.log('[DB] ✓ Conectado ao SQLite');
    }
});

// Configurar para usar promises
db.serialize(() => {
    // Configuracoes globais do site (editaveis no painel admin)
    db.run(`
        CREATE TABLE IF NOT EXISTS site_settings (
            settingKey TEXT PRIMARY KEY,
            settingValue TEXT NOT NULL,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Tabela site_settings:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('whatsapp_url', ?)
    `, [DEFAULT_WHATSAPP_URL], (err) => {
        if (err) {
            console.log('seed whatsapp_url:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('discord_url', ?)
    `, [DEFAULT_DISCORD_URL], (err) => {
        if (err) {
            console.log('seed discord_url:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('whatsapp_tooltip', 'WhatsApp')
    `, (err) => {
        if (err) {
            console.log('seed whatsapp_tooltip:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('discord_tooltip', 'Discord')
    `, (err) => {
        if (err) {
            console.log('seed discord_tooltip:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('whatsapp_enabled', '1')
    `, (err) => {
        if (err) {
            console.log('seed whatsapp_enabled:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('discord_enabled', '1')
    `, (err) => {
        if (err) {
            console.log('seed discord_enabled:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('navbar_buttons', '[]')
    `, (err) => {
        if (err) {
            console.log('seed navbar_buttons:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('download_uploads_enabled', '0')
    `, (err) => {
        if (err) {
            console.log('seed download_uploads_enabled:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('achievement_bg_progression', '')
    `, (err) => {
        if (err) {
            console.log('seed achievement_bg_progression:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('achievement_bg_like', '')
    `, (err) => {
        if (err) {
            console.log('seed achievement_bg_like:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('achievement_bg_post', '')
    `, (err) => {
        if (err) {
            console.log('seed achievement_bg_post:', err.message);
        }
    });

    db.run(`
        INSERT OR IGNORE INTO site_settings (settingKey, settingValue)
        VALUES ('achievement_bg_progression_cards', '{}')
    `, (err) => {
        if (err) {
            console.log('seed achievement_bg_progression_cards:', err.message);
        }
    });
    // Tabela de usu�rios
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            nickname TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            birthDate TEXT NOT NULL,
            googleSubject TEXT,
            googleLoginEnabled BOOLEAN NOT NULL DEFAULT 1,
            avatar TEXT,
            banner TEXT,
            bio TEXT DEFAULT '',
            aqwCharPageUrl TEXT DEFAULT NULL,
            profileTagline TEXT DEFAULT '',
            profileTag TEXT DEFAULT '',
            profileTagStyle TEXT DEFAULT '',
            profileTagColor TEXT DEFAULT '',
            profileTagTextColor TEXT DEFAULT '',
            profileTagSymbolStyle TEXT DEFAULT '',
            profileTagBannerStyle TEXT DEFAULT '',
            profileTagGradientStart TEXT DEFAULT '',
            profileTagGradientEnd TEXT DEFAULT '',
            profileTagUseGradient BOOLEAN DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            emailVerified BOOLEAN DEFAULT 0,
            verificationCode TEXT,
            verificationExpires DATETIME,
            resetCode TEXT,
            resetExpires DATETIME,
            manualRank TEXT DEFAULT NULL,
            manualRankColor TEXT DEFAULT NULL,
            isAdmin BOOLEAN DEFAULT 0,
            canPostDownloads BOOLEAN DEFAULT 1,
            canUploadDownloads BOOLEAN DEFAULT 0,
            canOrderFixedRanks BOOLEAN DEFAULT 0,
            canAccessAdminPanel BOOLEAN DEFAULT 0,
            adminTabRanks BOOLEAN NOT NULL DEFAULT 0,
            adminTabEvents BOOLEAN NOT NULL DEFAULT 0,
            adminTabAppearance BOOLEAN NOT NULL DEFAULT 0,
            adminTabUsers BOOLEAN NOT NULL DEFAULT 0,
            adminTabAccount BOOLEAN NOT NULL DEFAULT 0,
            adminTabSendmail BOOLEAN NOT NULL DEFAULT 0,
            adminTabStaffHierarchy BOOLEAN NOT NULL DEFAULT 0,
            adminTabPostPermissions BOOLEAN NOT NULL DEFAULT 0,
            adminTabNavbar BOOLEAN NOT NULL DEFAULT 0,
            adminTabBans BOOLEAN NOT NULL DEFAULT 0,
            adminTabSuspendedPosts BOOLEAN NOT NULL DEFAULT 0,
            canManageDownloads BOOLEAN DEFAULT 0,
            canUseAnimatedProfile BOOLEAN DEFAULT 0,
            canChangeRankColor BOOLEAN DEFAULT 0,
            canUseProfileTaglineLinks BOOLEAN DEFAULT 0,
            canUseExclusiveAnimatedThemes BOOLEAN DEFAULT 0,
            canUseAnimatedProfileCustomGif BOOLEAN DEFAULT 0,
            showAdultPosts BOOLEAN DEFAULT 0,
            showFullNameInMiniProfile BOOLEAN DEFAULT 1,
            profileAnimationMode TEXT NOT NULL DEFAULT 'normal',
            animatedProfileEnabled BOOLEAN DEFAULT 1,
            animatedMiniProfileEnabled BOOLEAN DEFAULT 1,
            animatedDownloadCardEnabled BOOLEAN DEFAULT 0,
            animatedProfileTheme TEXT DEFAULT 'auto',
            animatedProfileVisualMode TEXT DEFAULT 'theme',
            animatedProfileGifUrl TEXT DEFAULT NULL,
            animatedProfileGiphyId TEXT DEFAULT NULL,
            avatarScale REAL DEFAULT 1,
            avatarOffsetX REAL DEFAULT 50,
            avatarOffsetY REAL DEFAULT 50,
            bannerScale REAL DEFAULT 1,
            bannerOffsetX REAL DEFAULT 50,
            bannerOffsetY REAL DEFAULT 50,
            customTitle TEXT DEFAULT NULL,
            customTitleSubtitle TEXT DEFAULT NULL,
            lastBirthdayNotificationYear INTEGER DEFAULT NULL,
            eighteenthBirthdayNotified BOOLEAN DEFAULT 0
        )
    `, (err) => {
        if (err) {
            console.error('Tabela users:', err.message);
        }
    });

    // Tabela de conquistas
    db.run(`
        CREATE TABLE IF NOT EXISTS ranks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            rankLevel INTEGER NOT NULL,
            rankName TEXT NOT NULL,
            color TEXT NOT NULL,
            icon TEXT NOT NULL,
            achievedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Tabela ranks:', err.message);
        }
    });

    // Migra��o: Permitir adicionar columns para bancos antigos (seguro se j� existe)
    db.run(`ALTER TABLE users ADD COLUMN manualRank TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('manualRank:', err.message);
        } 
    });

    db.run(`ALTER TABLE users ADD COLUMN googleSubject TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('googleSubject migration:', err.message);
        }
    });
    db.run(`ALTER TABLE users ADD COLUMN googleLoginEnabled BOOLEAN NOT NULL DEFAULT 1`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('googleLoginEnabled migration:', err.message);
        }
    });
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_subject ON users(googleSubject) WHERE googleSubject IS NOT NULL`, (err) => {
        if (err) {
            console.error('googleSubject index:', err.message);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN manualRankColor TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('manualRankColor:', err.message);
        } 
    });

    db.run(`ALTER TABLE users ADD COLUMN hiddenProgressionRanks TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('hiddenProgressionRanks:', err.message);
        } 
    });

    // Migra��o: Adicionar colunas para mudan�a de email com c�digo de verifica��o
    db.run(`ALTER TABLE users ADD COLUMN emailChangeCode TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('emailChangeCode:', err.message);
        } 
    });

    db.run(`ALTER TABLE users ADD COLUMN emailChangeExpires DATETIME DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('emailChangeExpires:', err.message);
        } 
    });

    // Tabela de conquistas customiz�veis
    db.run(`
        CREATE TABLE IF NOT EXISTS custom_ranks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL,
            icon TEXT NOT NULL,
            description TEXT,
            customText TEXT,
            backgroundImage TEXT,
            canUseAnimatedProfile BOOLEAN DEFAULT 0,
            canChangeOwnColor BOOLEAN DEFAULT 0,
            isDefault BOOLEAN DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Tabela custom_ranks:', err.message);
        }
    });

    // Adicionar coluna banner para conquistas customiz�veis (DEPOIS de criar a tabela)
    db.run(`ALTER TABLE custom_ranks ADD COLUMN banner TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('banner column:', err.message);
        } 
    });

    // Adicionar colunas para novos campos de conquistas
    db.run(`ALTER TABLE custom_ranks ADD COLUMN customText TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('customText column:', err.message);
        } 
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN backgroundImage TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('backgroundImage column:', err.message);
        } 
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN enableAdminPanel BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('enableAdminPanel column:', err.message);
        } 
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN canManageDownloads BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canManageDownloads column:', err.message);
        } 
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN canOrderAllRanks BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canOrderAllRanks column:', err.message);
        } 
    });
    db.run(`ALTER TABLE custom_ranks ADD COLUMN canUseAnimatedProfile BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canUseAnimatedProfile column:', err.message);
        } 
    });
    db.run(`ALTER TABLE custom_ranks ADD COLUMN canChangeOwnColor BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canChangeOwnColor column:', err.message);
        } 
    });
    db.run(`ALTER TABLE custom_ranks ADD COLUMN rankGroup TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('rankGroup column:', err.message);
        } 
    });
    db.run(`ALTER TABLE custom_ranks ADD COLUMN isStaffRole BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('isStaffRole column:', err.message);
        } 
    });
    db.run(`ALTER TABLE custom_ranks ADD COLUMN hierarchyLevel INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('hierarchyLevel column:', err.message);
        } 
    });
    db.run(`ALTER TABLE custom_ranks ADD COLUMN canViewStaffHierarchy BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canViewStaffHierarchy column:', err.message);
        } 
    });
    for (const [column, defaultValue] of [
        ['adminPanelTabRanks', 1],
        ['adminPanelTabEvents', 0],
        ['adminPanelTabAppearance', 0],
        ['adminPanelTabUsers', 0],
        ['adminPanelTabAccount', 0],
        ['adminPanelTabSendmail', 0],
        ['adminPanelTabPostPermissions', 1],
        ['adminPanelTabNavbar', 0],
        ['adminPanelTabBans', 1],
        ['adminPanelTabSuspendedPosts', 1]
    ]) {
        db.run(`ALTER TABLE custom_ranks ADD COLUMN ${column} BOOLEAN NOT NULL DEFAULT ${defaultValue}`, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error(`[DB] Erro ao adicionar ${column} em custom_ranks:`, err.message);
            }
        });
    }
    db.run(`ALTER TABLE custom_ranks ADD COLUMN canViewMembersPage BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canViewMembersPage column:', err.message);
        } 
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN isVisible BOOLEAN DEFAULT 1`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('isVisible column:', err.message);
        } 
    });

    // Colunas para suporte a conquistas/eventos especiais (sazonais)
    db.run(`ALTER TABLE custom_ranks ADD COLUMN isSpecial BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('isSpecial column:', err.message);
        }
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN themeName TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('themeName column:', err.message);
        }
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN themeCssUrl TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('themeCssUrl column:', err.message);
        }
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN eventStartDate DATETIME DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('eventStartDate column:', err.message);
        }
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN eventEndDate DATETIME DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('eventEndDate column:', err.message);
        }
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN autoAwardOnLogin BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('autoAwardOnLogin column:', err.message);
        }
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN emailSubject TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('emailSubject column:', err.message);
        }
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN emailBody TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('emailBody column:', err.message);
        }
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN eventCategory TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('eventCategory column:', err.message);
        }
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN eventAttachments TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('eventAttachments column:', err.message);
        }
    });

    db.run(`ALTER TABLE custom_ranks ADD COLUMN emailBroadcastSent BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('emailBroadcastSent column:', err.message);
        }
    });
    
    // Marca eventos que foram gerados automaticamente a partir de templates
    db.run(`ALTER TABLE custom_ranks ADD COLUMN generatedFromTemplate BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('generatedFromTemplate column:', err.message);
        }
    });

    db.run(`DELETE FROM custom_ranks WHERE isSpecial = 1 AND (generatedFromTemplate = 1 OR themeName IN ('natal', 'ano-novo', 'carnaval', 'pascoa', 'halloween', 'dia-dos-namorados'))`, (err) => {
        if (err) {
            console.log('cleanup annual special ranks error:', err.message);
        }
    });

    db.run(`ALTER TABLE users ADD COLUMN selectedRanks TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('selectedRanks column:', err.message);
        } 
    });

    // Adicionar permiss�o de postagem de downloads
    db.run(`ALTER TABLE users ADD COLUMN canPostDownloads BOOLEAN DEFAULT 1`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canPostDownloads column:', err.message);
        } 
    });

    db.run(`ALTER TABLE users ADD COLUMN canUploadDownloads BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canUploadDownloads column:', err.message);
        }
    });

    // Adicionar n�vel de conquista por postagens
    db.run(`ALTER TABLE users ADD COLUMN postageRankLevel INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('postageRankLevel column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN canOrderFixedRanks BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canOrderFixedRanks column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN canAccessAdminPanel BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canAccessAdminPanel column:', err.message);
        } 
    });
    for (const column of [
        'adminTabRanks',
        'adminTabEvents',
        'adminTabAppearance',
        'adminTabUsers',
        'adminTabAccount',
        'adminTabSendmail',
        'adminTabStaffHierarchy',
        'adminTabPostPermissions',
        'adminTabNavbar',
        'adminTabBans',
        'adminTabSuspendedPosts'
    ]) {
        db.run(`ALTER TABLE users ADD COLUMN ${column} BOOLEAN NOT NULL DEFAULT 0`, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error(`${column} migration:`, err.message);
            }
        });
    }
    db.run(`ALTER TABLE users ADD COLUMN canManageDownloads BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canManageDownloads(user) column:', err.message);
        } else if (!err) {
            console.log('Coluna canManageDownloads(user) adicionada com sucesso');
        }
    });
    db.run(`ALTER TABLE users ADD COLUMN canUseAnimatedProfile BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canUseAnimatedProfile(user) column:', err.message);
        } else if (!err) {
            console.log('Coluna canUseAnimatedProfile(user) adicionada com sucesso');
        }
    });
    db.run(`ALTER TABLE users ADD COLUMN canChangeRankColor BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canChangeRankColor(user) column:', err.message);
        } else if (!err) {
            console.log('Coluna canChangeRankColor(user) adicionada com sucesso');
        }
    });
    db.run(`ALTER TABLE users ADD COLUMN canUseProfileTaglineLinks BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canUseProfileTaglineLinks(user) column:', err.message);
        } else if (!err) {
            console.log('Coluna canUseProfileTaglineLinks(user) adicionada com sucesso');
        }
    });
    db.run(`ALTER TABLE users ADD COLUMN canUseExclusiveAnimatedThemes BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canUseExclusiveAnimatedThemes(user) column:', err.message);
        } else if (!err) {
            console.log('Coluna canUseExclusiveAnimatedThemes(user) adicionada com sucesso');
        }
    });
    db.run(`ALTER TABLE users ADD COLUMN canUseAnimatedProfileCustomGif BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('canUseAnimatedProfileCustomGif(user) column:', err.message);
        } else if (!err) {
            console.log('Coluna canUseAnimatedProfileCustomGif(user) adicionada com sucesso');
        }
    });
    db.run(`ALTER TABLE users ADD COLUMN showAdultPosts BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('showAdultPosts column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN showFullNameInMiniProfile BOOLEAN DEFAULT 1`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('showFullNameInMiniProfile column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileAnimationMode TEXT NOT NULL DEFAULT 'normal'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileAnimationMode column:', err.message);
        }
    });
    db.run(`ALTER TABLE users ADD COLUMN lastBirthdayNotificationYear INTEGER DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('lastBirthdayNotificationYear column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN eighteenthBirthdayNotified BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('eighteenthBirthdayNotified column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN animatedProfileEnabled BOOLEAN DEFAULT 1`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('animatedProfileEnabled column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN animatedMiniProfileEnabled BOOLEAN DEFAULT 1`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('animatedMiniProfileEnabled column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN animatedDownloadCardEnabled BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('animatedDownloadCardEnabled column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN animatedProfileTheme TEXT DEFAULT 'auto'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('animatedProfileTheme column:', err.message);
        } 
    });

    db.run(`ALTER TABLE users ADD COLUMN animatedProfileVisualMode TEXT DEFAULT 'theme'`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('animatedProfileVisualMode column:', err.message);
        } 
    });

    db.run(`ALTER TABLE users ADD COLUMN animatedProfileGifUrl TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('animatedProfileGifUrl column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN animatedProfileGiphyId TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('animatedProfileGiphyId column:', err.message);
        }
    });
    db.run(
        `UPDATE users
         SET animatedMiniProfileEnabled = COALESCE(animatedMiniProfileEnabled, animatedProfileEnabled, 1),
             animatedDownloadCardEnabled = COALESCE(animatedDownloadCardEnabled, animatedProfileEnabled, 0)
         WHERE 1 = 1`,
        (err) => {
            if (err) {
                console.log('animated profile split sync:', err.message);
            }
        }
    );
    db.run(`ALTER TABLE users ADD COLUMN disableCommentNotifications BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('disableCommentNotifications column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN disableLikeNotifications BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('disableLikeNotifications column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN disableAchievementNotifications BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('disableAchievementNotifications column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN disableAllNotifications BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('disableAllNotifications column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN disableTeamEmailNotifications BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('disableTeamEmailNotifications column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN twoFactorEnabled BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('twoFactorEnabled column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN twoFactorSecret TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('twoFactorSecret column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN twoFactorTempSecret TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('twoFactorTempSecret column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN twoFactorRememberDays INTEGER DEFAULT 3`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('twoFactorRememberDays column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN twoFactorEmailCode TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('twoFactorEmailCode column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN twoFactorEmailExpires DATETIME DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('twoFactorEmailExpires column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileTagline TEXT DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileTagline column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileTag TEXT DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileTag column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileTagStyle TEXT DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileTagStyle column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileTagColor TEXT DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileTagColor column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileTagTextColor TEXT DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileTagTextColor column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileTagSymbolStyle TEXT DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileTagSymbolStyle column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileTagBannerStyle TEXT DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileTagBannerStyle column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileTagGradientStart TEXT DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileTagGradientStart column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileTagGradientEnd TEXT DEFAULT ''`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileTagGradientEnd column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN profileTagUseGradient BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('profileTagUseGradient column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN aqwCharPageUrl TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('aqwCharPageUrl column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN avatarScale REAL DEFAULT 1`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('avatarScale column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN avatarOffsetX REAL DEFAULT 50`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('avatarOffsetX column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN avatarOffsetY REAL DEFAULT 50`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('avatarOffsetY column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN bannerScale REAL DEFAULT 1`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('bannerScale column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN bannerOffsetX REAL DEFAULT 50`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('bannerOffsetX column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN bannerOffsetY REAL DEFAULT 50`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('bannerOffsetY column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN customTitle TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('customTitle column:', err.message);
        } 
    });
    db.run(`ALTER TABLE users ADD COLUMN customTitleSubtitle TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('customTitleSubtitle column:', err.message);
        }
    });
    // Tabela de junção: usuários com múltiplos conquistas customizáveis
    db.run(`
        CREATE TABLE IF NOT EXISTS user_custom_ranks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            customRankId INTEGER NOT NULL,
            customColor TEXT DEFAULT NULL,
            assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id),
            FOREIGN KEY(customRankId) REFERENCES custom_ranks(id),
            UNIQUE(userId, customRankId)
        )
    `, (err) => {
        if (err) {
            console.error('Tabela user_custom_ranks:', err.message);
        }
    });
    db.run(`ALTER TABLE user_custom_ranks ADD COLUMN customColor TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('customColor(user_custom_ranks) column:', err.message);
        } else if (!err) {
            console.log('Coluna customColor(user_custom_ranks) adicionada com sucesso');
        }
    });

    db.run(`ALTER TABLE user_custom_ranks ADD COLUMN customDescription TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('customDescription(user_custom_ranks) column:', err.message);
        } else if (!err) {
            console.log('Coluna customDescription(user_custom_ranks) adicionada com sucesso');
        }
    });

    // Dispositivos confi�veis para pular 2FA por alguns dias
    db.run(`
        CREATE TABLE IF NOT EXISTS trusted_devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            tokenHash TEXT NOT NULL UNIQUE,
            userAgentHash TEXT DEFAULT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            lastUsedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            expiresAt DATETIME NOT NULL,
            revokedAt DATETIME DEFAULT NULL,
            FOREIGN KEY(userId) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Tabela trusted_devices:', err.message);
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(userId)`, (err) => {
        if (err) {
            console.log('idx_trusted_devices_user_id:', err.message);
        }
    });

    // Tabela de downloads/postagens
    db.run(`
        CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            link TEXT NOT NULL,
            isAdult BOOLEAN DEFAULT 0,
            membersOnly BOOLEAN DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Tabela downloads:', err.message);
        }
    });

    db.run(`ALTER TABLE downloads ADD COLUMN isAdult BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('isAdult column:', err.message);
        } 
    });

    db.run(`ALTER TABLE downloads ADD COLUMN membersOnly BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('membersOnly column:', err.message);
        } 
    });

    // Migra��o: Adicionar coluna para m�ltiplos links
    db.run(`ALTER TABLE downloads ADD COLUMN links_json TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('links_json column:', err.message);
        } 
    });
    db.run(`
        CREATE TABLE IF NOT EXISTS postage_ranks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rankLevel INTEGER NOT NULL UNIQUE,
            minPostages INTEGER NOT NULL,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            icon TEXT NOT NULL,
            description TEXT
        )
    `, (err) => {
        if (err) {
            console.error('Tabela postage_ranks:', err.message);
        } else {
            // Inserir dados padr�o dos conquistas de postagem
            db.run(`SELECT COUNT(*) as count FROM postage_ranks`, (err, row) => {
                if (row && row.count === 0) {
                    const rankData = [
                        [1, 5, 'Iniciante', '#60A5FA', '*', 'Primeiro conquista - 5 postagens'],
                        [2, 15, 'Aprendiz', '#F59E0B', '**', 'Segundo conquista - 15 postagens'],
                        [3, 30, 'Profissional', '#8B5CF6', '***', 'Terceiro conquista - 30 postagens'],
                        [4, 50, 'Lenda', '#EC4899', '****', 'Quarto conquista - 50 postagens'],
                        [5, 75, 'Grande Lenda', '#F97316', '*****', 'Quinto conquista - 75 postagens'],
                        [6, 105, 'Mestre', '#06B6D4', '+++', 'Sexto conquista - 105 postagens'],
                        [7, 140, 'Supremo', '#10B981', '++++', 'S�timo conquista - 140 postagens'],
                        [8, 180, 'Divino', '#6366F1', '+++++', 'Oitavo conquista - 180 postagens'],
                        [9, 235, 'Lend�rio', '#D946EF', 'LENDARIO', 'Nono conquista - 235 postagens'],
                        [10, 300, 'Infinito', '#FCD34D', 'MASTER', 'D�cimo conquista - 300 postagens']
                    ];

                    rankData.forEach(([level, minPostages, name, color, icon, description]) => {
                        db.run(
                            `INSERT INTO postage_ranks (rankLevel, minPostages, name, color, icon, description) VALUES (?, ?, ?, ?, ?, ?)`,
                            [level, minPostages, name, color, icon, description]
                        );
                    });
                }
            });
        }
    });

    // Tabela de favoritos de downloads
    db.run(`
        CREATE TABLE IF NOT EXISTS download_favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            downloadId INTEGER NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id),
            FOREIGN KEY(downloadId) REFERENCES downloads(id),
            UNIQUE(userId, downloadId)
        )
    `, (err) => {
        if (err) {
            console.error('Tabela download_favorites:', err.message);
        }
    });

    // Tabela de rea��es (likes, cora��es) - INDEPENDENTES
    db.run(`
        CREATE TABLE IF NOT EXISTS download_reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            downloadId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            reactionType TEXT NOT NULL CHECK(reactionType IN ('like', 'heart')),
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(downloadId) REFERENCES downloads(id),
            FOREIGN KEY(userId) REFERENCES users(id),
            UNIQUE(downloadId, userId, reactionType)
        )
    `, (err) => {
        if (err) {
            console.error('Tabela download_reactions:', err.message);
        }
    });

    // Historico permanente de likes recebidos (n�o reduz com exclusao de postagem)
    db.run(`
        CREATE TABLE IF NOT EXISTS download_like_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ownerUserId INTEGER NOT NULL,
            fromUserId INTEGER NOT NULL,
            downloadId INTEGER NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(ownerUserId, fromUserId, downloadId)
        )
    `, (err) => {
        if (err) {
            console.error('Tabela download_like_history:', err.message);
        }
    });

    // Backfill inicial do historico com likes atuais
    db.run(`
        INSERT OR IGNORE INTO download_like_history (ownerUserId, fromUserId, downloadId, createdAt)
        SELECT d.userId, dr.userId, dr.downloadId, dr.createdAt
        FROM download_reactions dr
        JOIN downloads d ON d.id = dr.downloadId
        WHERE dr.reactionType = 'like'
    `, (err) => {
        if (err) {
            console.log('download_like_history backfill:', err.message);
        }
    });

    // Tabela de banimentos
    db.run(`
        CREATE TABLE IF NOT EXISTS bans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            banType TEXT NOT NULL CHECK(banType IN ('suspension', 'permanent')),
            suspensionDays INTEGER DEFAULT NULL,
            reason TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            expiresAt DATETIME DEFAULT NULL,
            isActive BOOLEAN DEFAULT 1,
            FOREIGN KEY(userId) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error('Tabela bans:', err.message);
        }
    });

    // Tabela de coment�rios nas postagens
    db.run(`
        CREATE TABLE IF NOT EXISTS download_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            downloadId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            content TEXT NOT NULL,
            attachmentPath TEXT DEFAULT NULL,
            attachmentOriginalName TEXT DEFAULT NULL,
            attachmentMime TEXT DEFAULT NULL,
            attachmentSize INTEGER DEFAULT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(downloadId) REFERENCES downloads(id) ON DELETE CASCADE,
            FOREIGN KEY(userId) REFERENCES users(id)
        )
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('Tabela download_comments:', err.message);
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS download_upload_reservations (
            uploadId TEXT PRIMARY KEY,
            userId INTEGER NOT NULL,
            objectKey TEXT NOT NULL UNIQUE,
            originalName TEXT NOT NULL,
            contentType TEXT NOT NULL,
            expectedSize INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'uploaded', 'attached')),
            downloadId INTEGER DEFAULT NULL,
            expiresAt INTEGER DEFAULT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(downloadId) REFERENCES downloads(id) ON DELETE SET NULL
        )
    `, (err) => {
        if (err) {
            console.error('Tabela download_upload_reservations:', err.message);
        }
    });

    db.run(
        `ALTER TABLE download_upload_reservations
         ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`,
        (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Migração download_upload_reservations.status:', err.message);
            }
        }
    );

    db.run(
        `ALTER TABLE download_upload_reservations
         ADD COLUMN downloadId INTEGER DEFAULT NULL`,
        (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Migração download_upload_reservations.downloadId:', err.message);
            }
        }
    );

    db.run(`
        CREATE INDEX IF NOT EXISTS idx_download_upload_reservations_expiry
        ON download_upload_reservations(expiresAt)
    `, (err) => {
        if (err) {
            console.error('Índice download_upload_reservations:', err.message);
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS user_missions (
            userId INTEGER NOT NULL,
            missionKey TEXT NOT NULL,
            acceptedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            completedAt DATETIME DEFAULT NULL,
            rewardGrantedAt DATETIME DEFAULT NULL,
            PRIMARY KEY (userId, missionKey),
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('Tabela user_missions:', err.message);
        }
    });

    db.run(`ALTER TABLE download_comments ADD COLUMN attachmentPath TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('attachmentPath column:', err.message);
        } 
    });

    db.run(`ALTER TABLE download_comments ADD COLUMN attachmentOriginalName TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('attachmentOriginalName column:', err.message);
        } 
    });

    db.run(`ALTER TABLE download_comments ADD COLUMN attachmentMime TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('attachmentMime column:', err.message);
        } 
    });

    db.run(`ALTER TABLE download_comments ADD COLUMN attachmentSize INTEGER DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('attachmentSize column:', err.message);
        } 
    });

    db.run(`ALTER TABLE download_comments ADD COLUMN isPinned BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('isPinned column:', err.message);
        } 
    });

    db.run(`ALTER TABLE download_comments ADD COLUMN pinnedBy INTEGER DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('pinnedBy column:', err.message);
        } 
    });

    db.run(`ALTER TABLE download_comments ADD COLUMN pinnedAt DATETIME DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('pinnedAt column:', err.message);
        } 
    });

    // Tabela de rea��es em coment�rios
    db.run(`
        CREATE TABLE IF NOT EXISTS comment_reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            commentId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            emoji TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(commentId, userId, emoji),
            FOREIGN KEY(commentId) REFERENCES download_comments(id) ON DELETE CASCADE,
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('Tabela comment_reactions:', err.message);
        }
    });

    // Tabela de notifica��es
    db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            fromUserId INTEGER NOT NULL,
            downloadId INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('like', 'heart', 'comment')),
            commentId INTEGER,
            isRead BOOLEAN DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id),
            FOREIGN KEY(fromUserId) REFERENCES users(id),
            FOREIGN KEY(downloadId) REFERENCES downloads(id) ON DELETE CASCADE,
            FOREIGN KEY(commentId) REFERENCES download_comments(id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('Tabela notifications:', err.message);
        }
    });

    // Tabela de notifica��es de conquistas
    db.run(`
        CREATE TABLE IF NOT EXISTS achievement_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            rankName TEXT NOT NULL,
            message TEXT DEFAULT '',
            awardedByUserId INTEGER,
            relatedDownloadId INTEGER,
            isRead BOOLEAN DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(awardedByUserId) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(relatedDownloadId) REFERENCES downloads(id) ON DELETE SET NULL
        )
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('Tabela achievement_notifications:', err.message);
        }
    });

    db.run(`
        CREATE INDEX IF NOT EXISTS idx_achievement_notifications_user_read
        ON achievement_notifications(userId, isRead, createdAt)
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('Index achievement_notifications:', err.message);
        }
    });

    // Tabela de tickets/inbox enviados pelo admin
    db.run(`
        CREATE TABLE IF NOT EXISTS admin_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            fromUserId INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            attachmentPath TEXT DEFAULT NULL,
            attachmentOriginalName TEXT DEFAULT NULL,
            attachmentMime TEXT DEFAULT NULL,
            attachmentSize INTEGER DEFAULT NULL,
            isBroadcast BOOLEAN DEFAULT 0,
            isRead BOOLEAN DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(fromUserId) REFERENCES users(id) ON DELETE SET NULL
        )
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('Tabela admin_tickets:', err.message);
        }
    });

    db.run(`
        CREATE INDEX IF NOT EXISTS idx_admin_tickets_user_read
        ON admin_tickets(userId, isRead, createdAt)
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('Index admin_tickets:', err.message);
        }
    });

    db.run(`ALTER TABLE admin_tickets ADD COLUMN attachmentPath TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('admin_tickets attachmentPath:', err.message);
        }
    });

    db.run(`ALTER TABLE admin_tickets ADD COLUMN attachmentOriginalName TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('admin_tickets attachmentOriginalName:', err.message);
        }
    });

    db.run(`ALTER TABLE admin_tickets ADD COLUMN attachmentMime TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('admin_tickets attachmentMime:', err.message);
        }
    });

    db.run(`ALTER TABLE admin_tickets ADD COLUMN attachmentSize INTEGER DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('admin_tickets attachmentSize:', err.message);
        }
    });

    db.run(`ALTER TABLE admin_tickets ADD COLUMN isBroadcast BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('admin_tickets isBroadcast:', err.message);
        }
    });

    db.run(`ALTER TABLE admin_tickets ADD COLUMN ticketColor TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('admin_tickets ticketColor:', err.message);
        }
    });

    db.run(`ALTER TABLE admin_tickets ADD COLUMN fromUserHierarchyLevel INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('admin_tickets fromUserHierarchyLevel:', err.message);
        }
    });

    // Tabela para suspens�o de postagens por admin
    db.run(`
        CREATE TABLE IF NOT EXISTS download_suspensions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            downloadId INTEGER NOT NULL UNIQUE,
            userId INTEGER NOT NULL,
            suspendedBy INTEGER NOT NULL,
            reason TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('suspended', 'under_review', 'resolved')),
            userTicketId INTEGER,
            reviewTicketId INTEGER,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolvedAt DATETIME DEFAULT NULL,
            FOREIGN KEY(downloadId) REFERENCES downloads(id) ON DELETE CASCADE,
            FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(suspendedBy) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(userTicketId) REFERENCES admin_tickets(id) ON DELETE SET NULL
        )
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('Tabela download_suspensions:', err.message);
        }
    });

    // Adicionar colunas ao downloads para controlar status de suspens�o
    db.run(`ALTER TABLE downloads ADD COLUMN suspensionStatus TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('suspensionStatus column:', err.message);
        } 
    });

    db.run(`ALTER TABLE downloads ADD COLUMN suspendedAt DATETIME DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('suspendedAt column:', err.message);
        } 
    });

    db.run(`ALTER TABLE downloads ADD COLUMN suspensionReason TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('suspensionReason column:', err.message);
        } 
    });

    db.run(`ALTER TABLE download_suspensions ADD COLUMN userMessage TEXT DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('userMessage column:', err.message);
        } 
    });

    db.run(`ALTER TABLE download_suspensions ADD COLUMN reviewTicketId INTEGER DEFAULT NULL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.log('reviewTicketId column:', err.message);
        }
    });

    db.run(`
        UPDATE download_suspensions
        SET reviewTicketId = userTicketId,
            userTicketId = (
                SELECT suspensionTicket.id
                FROM admin_tickets suspensionTicket
                WHERE suspensionTicket.userId = download_suspensions.userId
                  AND suspensionTicket.fromUserId = download_suspensions.suspendedBy
                  AND suspensionTicket.title = 'Postagem Suspensa'
                  AND suspensionTicket.id != download_suspensions.userTicketId
                  AND NOT EXISTS (
                      SELECT 1
                      FROM download_suspensions linkedSuspension
                      WHERE linkedSuspension.id != download_suspensions.id
                        AND linkedSuspension.userTicketId = suspensionTicket.id
                  )
                ORDER BY ABS(julianday(suspensionTicket.createdAt) - julianday(download_suspensions.createdAt)),
                         suspensionTicket.id DESC
                LIMIT 1
            )
        WHERE reviewTicketId IS NULL
          AND userTicketId IN (
              SELECT id
              FROM admin_tickets
              WHERE title = 'Solicitação de Revisão de Postagem'
          )
    `, (err) => {
        if (err) {
            console.error('Migração das notificações de revisão:', err.message);
        }
    });

    // Index para performance
    db.run(`
        CREATE INDEX IF NOT EXISTS idx_download_suspensions_status
        ON download_suspensions(status, createdAt)
    `, (err) => {
        if (err && !err.message.includes('already exists')) {
            console.error('Index download_suspensions:', err.message);
        }
    });

    console.log('? Banco de dados inicializado');
});

export default db;
