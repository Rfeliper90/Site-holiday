// API Configuration
function normalizeApiBase(rawUrl) {
    const sanitized = String(rawUrl || '').trim().replace(/\/+$/, '');
    if (!sanitized) return '';
    return /\/api$/i.test(sanitized) ? sanitized : `${sanitized}/api`;
}

function resolveApiUrl() {
    const runtimeOverride = typeof window !== 'undefined' ? window.HOLIDAY_API_URL : '';
    const fromRuntime = normalizeApiBase(runtimeOverride);
    if (fromRuntime) return fromRuntime;

    const hasWindow = typeof window !== 'undefined' && window.location;
    if (!hasWindow) return 'http://localhost:8080/api';

    const hostname = String(window.location.hostname || '').toLowerCase();
    const protocol = String(window.location.protocol || '').toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isLocalFile = protocol === 'file:';

    if (isLocalhost) {
        if (window.location.port === '5000') {
            return 'http://localhost:8080/api';
        }
        return `${window.location.origin}/api`;
    }

    if (isLocalFile) {
        return 'http://localhost:8080/api';
    }

    if (window.location.origin) {
        return `${window.location.origin}/api`;
    }

    return 'https://guildaholiday.discloud.dev/api';
}

function withNoCacheParam(url) {
    const value = String(url || '').trim();
    if (!value) return value;
    const token = `_t=${Date.now()}`;
    return `${value}${value.includes('?') ? '&' : '?'}${token}`;
}

const API_URL = resolveApiUrl();

class AuthAPI {
    static getToken() {
        return localStorage.getItem('token');
    }

    static setToken(token) {
        localStorage.setItem('token', token);
        if (typeof AuthManager !== 'undefined') {
            AuthManager.notifyStateChange();
        }
    }

    static removeToken() {
        localStorage.removeItem('token');
        if (typeof AuthManager !== 'undefined') {
            AuthManager.notifyStateChange();
        }
    }

    static getHeaders(withAuth = false) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (withAuth) {
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    // Links da comunidade (Discord/WhatsApp)
    static async getSocialLinks() {
        try {
            const response = await fetch(`${API_URL}/admin/social-links`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar links da comunidade:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateSocialLinks(whatsappUrl, discordUrl, whatsappTooltip = null, discordTooltip = null, whatsappEnabled = null, discordEnabled = null, navbarButtons = null) {
        try {
            const payload = { whatsappUrl, discordUrl };
            if (typeof whatsappTooltip === 'string') payload.whatsappTooltip = whatsappTooltip;
            if (typeof discordTooltip === 'string') payload.discordTooltip = discordTooltip;
            if (typeof whatsappEnabled === 'boolean') payload.whatsappEnabled = whatsappEnabled;
            if (typeof discordEnabled === 'boolean') payload.discordEnabled = discordEnabled;
            if (Array.isArray(navbarButtons)) {
                payload.navbarButtons = navbarButtons
                    .filter((button) => button && typeof button.label === 'string' && String(button.label).trim() && typeof button.url === 'string' && String(button.url).trim())
                    .map((button) => {
                        const rawPosition = typeof button.position === 'string' ? String(button.position).trim() : '';
                        return {
                            label: String(button.label).trim(),
                            url: String(button.url).trim(),
                            icon: typeof button.icon === 'string' ? String(button.icon).trim() : '',
                            description: typeof button.description === 'string' ? String(button.description).trim() : '',
                            position: rawPosition || 'beforeLogin',
                            enabled: Boolean(button.enabled)
                        };
                    });
            }

            console.debug('[AUTH-API] Sending social-links payload:', payload);
            const response = await fetch(`${API_URL}/admin/social-links`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar links da comunidade:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getAchievementBackgrounds() {
        try {
            const response = await fetch(withNoCacheParam(`${API_URL}/admin/achievement-backgrounds`), {
                method: 'GET',
                headers: this.getHeaders(),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar fundos de conquistas:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async uploadAchievementBackground(file) {
        try {
            const formData = new FormData();
            formData.append('backgroundImage', file);

            const token = this.getToken();
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const response = await fetch(`${API_URL}/admin/achievement-backgrounds/upload`, {
                method: 'POST',
                headers,
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao enviar fundo de conquistas:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateAchievementGroupBackground(groupKey, backgroundImageUrl = '') {
        try {
            const response = await fetch(`${API_URL}/admin/achievement-backgrounds/group`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ groupKey, backgroundImageUrl })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar fundo por categoria:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateCustomAchievementBackground(rankId, backgroundImageUrl = '') {
        try {
            const response = await fetch(`${API_URL}/admin/achievement-backgrounds/custom/${rankId}`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ backgroundImageUrl })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar fundo da conquista personalizada:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateAchievementCardAnimationMode(groupKey, rankName, animationMode = 'hover') {
        try {
            const response = await fetch(`${API_URL}/admin/achievement-backgrounds/animation-mode`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ groupKey, rankName, animationMode })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar modo de animação da conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getManualRankOverrides() {
        try {
            const response = await fetch(withNoCacheParam(`${API_URL}/admin/manual-rank-overrides`), {
                method: 'GET',
                headers: this.getHeaders(true),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar overrides de conquistas manuais:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateManualRankOverride(rankName, payload = {}) {
        try {
            const response = await fetch(`${API_URL}/admin/manual-rank-overrides`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({
                    rankName,
                    name: payload?.name,
                    description: payload?.description,
                    customText: payload?.customText,
                    color: payload?.color,
                    backgroundImage: payload?.backgroundImage
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar override de conquista manual:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Autenticação
    static async register(firstName, lastName, nickname, email, birthDate, password, confirmPassword, termsAccepted = false) {
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ firstName, lastName, nickname, email, birthDate, password, confirmPassword, termsAccepted })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro na requisieeo de registro:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async login(nickname, password, trustedDeviceToken = '') {
        try {
            const payload = { nickname, password };
            if (trustedDeviceToken) {
                payload.trustedDeviceToken = trustedDeviceToken;
            }
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro na requisieeo de login:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getGoogleAuthConfig() {
        try {
            const response = await fetch(`${API_URL}/auth/google/config`, {
                method: 'GET',
                headers: this.getHeaders(),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao carregar configuração do Google:', error);
            return { success: false, message: 'Erro ao conectar ao servidor' };
        }
    }

    static async loginWithGoogle(credential, trustedDeviceToken = '') {
        try {
            const response = await fetch(`${API_URL}/auth/google/login`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ credential, trustedDeviceToken })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro no login Google:', error);
            return { success: false, message: 'Erro ao conectar ao servidor' };
        }
    }

    static async completeGoogleProfile(googleSignupTicket, nickname, birthDate, termsAccepted) {
        try {
            const response = await fetch(`${API_URL}/auth/google/complete-profile`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ googleSignupTicket, nickname, birthDate, termsAccepted })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao concluir cadastro Google:', error);
            return { success: false, message: 'Erro ao conectar ao servidor' };
        }
    }

    static async verifyTwoFactorLogin(loginTicket, code, method = 'authenticator') {
        try {
            const response = await fetch(`${API_URL}/auth/2fa/verify-login`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ loginTicket, code, method })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro na verificação 2FA do login:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async sendTwoFactorEmailCode(loginTicket) {
        try {
            const response = await fetch(`${API_URL}/auth/2fa/send-email-code`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ loginTicket })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao enviar código 2FA por email:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async verifyEmail(email, code) {
        try {
            const response = await fetch(`${API_URL}/auth/verify-email`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ email, code })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro na verificação de email:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async resendVerification(email) {
        try {
            const response = await fetch(`${API_URL}/auth/resend-verification`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ email })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao reenviar verificação:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async forgotPassword(email) {
        try {
            const response = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ email })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro na recuperação de senha:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async resetPassword(email, code, newPassword, confirmPassword) {
        try {
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ email, code, newPassword, confirmPassword })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao resetar senha:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async verifyResetCode(email, code) {
        try {
            const response = await fetch(`${API_URL}/auth/verify-reset-code`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ email, code })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao verificar código de reset:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async resendReset(email) {
        try {
            const response = await fetch(`${API_URL}/auth/resend-reset`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({ email })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao reenviar código de reset:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Perfil do usuário
    static async getProfile() {
        try {
            const response = await fetch(`${API_URL}/auth/profile`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getMembers() {
        try {
            const response = await fetch(`${API_URL}/users/members`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar membros:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getUserMissions() {
        try {
            const response = await fetch(`${API_URL}/users/missions`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar missões:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async acceptUserMission(missionKey) {
        try {
            const response = await fetch(`${API_URL}/users/missions/${encodeURIComponent(missionKey)}/accept`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao aceitar missão:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateProfile(formData) {
        try {
            // Para FormData, não enviar Content-Type (navegador faz isso automaticamente)
            const headers = {
                'Authorization': `Bearer ${this.getToken()}`
            };

            const response = await fetch(`${API_URL}/users/profile`, {
                method: 'PUT',
                headers: headers,
                body: formData
            });
            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            const isJson = contentType.includes('application/json');
            const payload = isJson
                ? await response.json()
                : { success: false, message: `Erro ${response.status}` };

            if (!response.ok && (!payload || payload.success !== false)) {
                return {
                    success: false,
                    message: payload?.message || `Erro ${response.status}`
                };
            }

            return payload;
        } catch (error) {
            console.error('Erro ao atualizar perfil:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateBio(bio) {
        try {
            const response = await fetch(`${API_URL}/users/profile`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ bio })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar bio:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getUserByNickname(nickname) {
        try {
            const response = await fetch(`${API_URL}/users/${nickname}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async changePassword(currentPassword, newPassword, confirmPassword) {
        try {
            const response = await fetch(`${API_URL}/users/change-password`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao mudar senha:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getTwoFactorStatus() {
        try {
            const response = await fetch(`${API_URL}/auth/2fa/status`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter status do 2FA:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async setupTwoFactor() {
        try {
            const response = await fetch(`${API_URL}/auth/2fa/setup`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao iniciar setup do 2FA:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async enableTwoFactor(code) {
        try {
            const response = await fetch(`${API_URL}/auth/2fa/enable`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ code })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao ativar 2FA:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async disableTwoFactor(code) {
        try {
            const response = await fetch(`${API_URL}/auth/2fa/disable`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ code })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao desativar 2FA:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateTwoFactorSettings(rememberDays) {
        try {
            const response = await fetch(`${API_URL}/auth/2fa/settings`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ rememberDays })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar configurações do 2FA:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async sendEmailChangeCode(email) {
        try {
            const response = await fetch(`${API_URL}/users/send-email-code`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ email })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao enviar código de email:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async changeEmail(newEmail, code) {
        try {
            const response = await fetch(`${API_URL}/users/change-email`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ newEmail, code })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao alterar email:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async requestEmailChange(newEmail, reason = '') {
        try {
            const response = await fetch(`${API_URL}/users/request-email-change`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ newEmail, reason })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao solicitar troca de email:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async approveEmailChange(userId, newEmail) {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/approve-email-change`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ newEmail })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao aprovar troca de email:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async cancelEmailChangeRequest(userId) {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/cancel-email-change-request`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao cancelar pedido de troca de email:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Funeees de Admin
    static async getAdminUsers() {
        try {
            const response = await fetch(`${API_URL}/admin/users`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async searchGoogleLoginUsers(query) {
        try {
            const params = new URLSearchParams({ q: String(query || '').trim() });
            const response = await fetch(`${API_URL}/admin/users/google-login?${params.toString()}`, {
                method: 'GET',
                headers: this.getHeaders(true),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar contas vinculadas ao Google:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async searchAdminTabAccessUsers(query) {
        try {
            const params = new URLSearchParams({ q: String(query || '').trim() });
            const response = await fetch(`${API_URL}/admin/tab-access/users?${params.toString()}`, {
                method: 'GET',
                headers: this.getHeaders(true),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar usuários para permissões das abas:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async updateAdminTabAccessPermissions(userId, permissions) {
        try {
            const response = await fetch(`${API_URL}/admin/tab-access/users/${encodeURIComponent(userId)}`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ permissions })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao salvar permissões individuais das abas:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async sendPasswordForGoogleUser(userId) {
        try {
            const response = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/password-login`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({})
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao enviar senha para conta Google:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async setGoogleLoginForUser(userId, enabled) {
        try {
            const response = await fetch(`${API_URL}/admin/users/${encodeURIComponent(userId)}/google-login`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ enabled: Boolean(enabled) })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao alterar login Google da conta:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async updateUserEmailStatus(userId, emailVerified) {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/email-status`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ emailVerified })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar status de email:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async sendAdminEmail(userId, subject, message, mediaUrl = '', mediaType = '', attachments = null) {
        try {
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('message', message);
            formData.append('mediaUrl', mediaUrl);
            formData.append('mediaType', mediaType);

            const fileList = Array.isArray(attachments) ? attachments : (attachments ? [attachments] : []);
            fileList.forEach((file) => {
                if (file) formData.append('attachments', file);
            });

            const headers = {};
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${API_URL}/admin/users/${userId}/send-email`, {
                method: 'POST',
                headers,
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao enviar email para usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async sendAdminEmailToAll(subject, message, mediaUrl = '', mediaType = '', attachments = null) {
        try {
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('message', message);
            formData.append('mediaUrl', mediaUrl);
            formData.append('mediaType', mediaType);

            const fileList = Array.isArray(attachments) ? attachments : (attachments ? [attachments] : []);
            fileList.forEach((file) => {
                if (file) formData.append('attachments', file);
            });

            const headers = {};
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${API_URL}/admin/emails/send-to-all`, {
                method: 'POST',
                headers,
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao enviar email para todos:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async setUserRank(userId, rankName) {
        try {
            const response = await fetch(`${API_URL}/admin/set-rank`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ userId, rankName })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atribuir conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async removeUserRank(userId) {
        try {
            const response = await fetch(`${API_URL}/admin/remove-rank`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ userId })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao remover conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async renameAccount(firstName, lastName) {
        try {
            const response = await fetch(`${API_URL}/admin/rename-account`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ firstName, lastName })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao renomear conta:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async deleteUserAccount(userId) {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao excluir conta:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async removeUserAvatar(userId) {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/remove-avatar`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao remover avatar do usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async removeUserAnimatedBackground(userId) {
        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/remove-animated-background`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao remover fundo animado do usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async sendUserTicket(userId, title, message, attachment = null) {
        try {
            const token = this.getToken();
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const formData = new FormData();
            formData.append('title', String(title || ''));
            formData.append('message', String(message || ''));
            if (attachment) {
                formData.append('attachment', attachment);
            }

            const response = await fetch(`${API_URL}/admin/users/${userId}/send-ticket`, {
                method: 'POST',
                headers,
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao enviar ticket para o usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async sendTicketToAll(title, message, attachment = null, options = {}) {
        try {
            const token = this.getToken();
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const formData = new FormData();
            formData.append('title', String(title || ''));
            formData.append('message', String(message || ''));
            formData.append('recipientGroup', String(options?.recipientGroup || 'all'));
            if (options?.customRankId) {
                formData.append('customRankId', String(options.customRankId));
            }
            if (attachment) {
                formData.append('attachment', attachment);
            }

            const response = await fetch(`${API_URL}/admin/tickets/send-to-all`, {
                method: 'POST',
                headers,
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao enviar ticket para todos:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Gerenciamento de conquistas Customizáveis
    static async getCustomRanks() {
        try {
            const response = await fetch(`${API_URL}/ranks/custom`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar conquistas:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getDefaultRanks() {
        try {
            const response = await fetch(`${API_URL}/ranks/default`, {
                method: 'GET',
                headers: this.getHeaders(),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar conquistas padrão:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async createCustomRank(
        name,
        color,
        description = '',
        customText = '',
        backgroundImageUrl = '',
        backgroundImageFile = null,
        enableAdminPanel = false,
        isVisible = true,
        canManageDownloads = false,
        canOrderAllRanks = false,
        canUseAnimatedProfile = false,
        canChangeOwnColor = false
    ) {
        try {
            const body = JSON.stringify({ 
                name, 
                color, 
                description, 
                customText, 
                backgroundImageUrl,
                enableAdminPanel,
                isVisible,
                canManageDownloads,
                canOrderAllRanks,
                canUseAnimatedProfile,
                canChangeOwnColor
            });

            const response = await fetch(`${API_URL}/ranks/custom`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: body
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao criar conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async uploadCustomRankBackground(file) {
        try {
            const formData = new FormData();
            formData.append('backgroundImage', file);

            const headers = {};
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const uploadEndpoints = [
                `${API_URL}/ranks/custom/upload-background`,
                `${API_URL}/ranks/cust-upload-background`,
                `${API_URL}/ranks/cust_upload_background`
            ];

            let response = null;
            for (let i = 0; i < uploadEndpoints.length; i++) {
                response = await fetch(uploadEndpoints[i], {
                    method: 'POST',
                    headers,
                    body: formData
                });
                if (response.status !== 404) {
                    break;
                }
            }

            let payload = null;
            try {
                payload = await response.json();
            } catch (parseError) {
                const fallbackMessage = response.status === 404
                    ? 'Rota de upload não encontrada (404).'
                    : `Falha no upload (HTTP ${response.status}).`;
                return { success: false, status: response.status, message: fallbackMessage };
            }

            if (!response.ok) {
                return {
                    success: false,
                    status: response.status,
                    message: payload?.message || `Falha no upload (HTTP ${response.status}).`
                };
            }

            return payload;
        } catch (error) {
            console.error('Erro ao enviar imagem da conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateCustomRank(
        rankId,
        name,
        color,
        description = '',
        customText = '',
        backgroundImageUrl = '',
        enableAdminPanel = false,
        isVisible = true,
        canManageDownloads = false,
        canOrderAllRanks = false,
        canUseAnimatedProfile = false,
        canChangeOwnColor = false
    ) {
        try {
            const response = await fetch(`${API_URL}/ranks/custom/${rankId}`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({
                    name,
                    color,
                    description,
                    customText,
                    backgroundImageUrl,
                    enableAdminPanel,
                    isVisible,
                    canManageDownloads,
                    canOrderAllRanks,
                    canUseAnimatedProfile,
                    canChangeOwnColor
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getCustomRanks() {
        try {
            const response = await fetch(`${API_URL}/ranks/custom`, {
                method: 'GET',
                headers: this.getHeaders(),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar conquistas customizáveis:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getAllCustomRanks() {
        try {
            const response = await fetch(`${API_URL}/ranks/custom/all`, {
                method: 'GET',
                headers: this.getHeaders(true),
                cache: 'no-store'
            });
            const data = await response.json();
            console.log('getAllCustomRanks response:', data);
            return data;
        } catch (error) {
            console.error('Erro ao buscar todos os conquistas:', error);
            return { success: false, message: 'Erro de conexeo: ' + error.message };
        }
    }

    static async getSpecialEvents() {
        try {
            const response = await fetch(`${API_URL}/admin/events`, {
                method: 'GET',
                headers: this.getHeaders(true),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar eventos especiais:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async createSpecialEvent(formData) {
        try {
            const token = this.getToken();
            const response = await fetch(`${API_URL}/admin/events`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao criar evento especial:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateSpecialEventStatus(eventId, action) {
        try {
            const response = await fetch(`${API_URL}/admin/events/${eventId}`, {
                method: 'PATCH',
                headers: this.getHeaders(true),
                body: JSON.stringify({ action })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar status do evento:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getCustomRanksByGroup(group) {
        try {
            const safeGroup = encodeURIComponent(String(group || '').trim());
            const response = await fetch(`${API_URL}/ranks/custom/group/${safeGroup}`, {
                method: 'GET',
                headers: this.getHeaders(true),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar conquistas customizadas por grupo:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getStaffHierarchy() {
        try {
            const response = await fetch(`${API_URL}/admin/staff-hierarchy`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar hierarquia da staff:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateStaffHierarchy(rankId, payload = {}) {
        try {
            const response = await fetch(`${API_URL}/admin/staff-hierarchy/${rankId}`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({
                    isStaffRole: Boolean(payload?.isStaffRole),
                    hierarchyLevel: Number.parseInt(payload?.hierarchyLevel, 10) || 0,
                    enableAdminPanel: Boolean(payload?.enableAdminPanel),
                    canViewStaffHierarchy: Boolean(payload?.canViewStaffHierarchy),
                    canViewMembersPage: Boolean(payload?.canViewMembersPage),
                    adminPanelTabs: Object.fromEntries(
                        Object.entries(payload?.adminPanelTabs || {}).map(([key, enabled]) => [key, Boolean(enabled)])
                    )
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao salvar hierarquia da staff:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async deleteCustomRank(rankId) {
        try {
            const response = await fetch(`${API_URL}/ranks/custom/${rankId}`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao deletar conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async addUserCustomRank(userId, customRankId) {
        try {
            const response = await fetch(`${API_URL}/ranks/user/${userId}/add`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ customRankId })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atribuir conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async addUserDefaultRank(userId, defaultKey) {
        try {
            const response = await fetch(`${API_URL}/ranks/user/${userId}/add-default`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ defaultKey })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atribuir conquista padrão:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async removeUserCustomRank(userId, customRankId) {
        try {
            const response = await fetch(`${API_URL}/ranks/user/${userId}/remove/${customRankId}`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao remover conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async hideUserFixedRank(userId, fixedRankId) {
        try {
            const response = await fetch(`${API_URL}/ranks/user/${userId}/hide-fixed-rank`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ fixedRankId })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao ocultar rank fixo:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getUserCustomRanks(userId) {
        try {
            const response = await fetch(withNoCacheParam(`${API_URL}/ranks/user/${userId}`), {
                method: 'GET',
                headers: this.getHeaders(),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar conquistas do usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getUserAllRanks(userId) {
        try {
            const response = await fetch(withNoCacheParam(`${API_URL}/ranks/user/${userId}/full`), {
                method: 'GET',
                headers: this.getHeaders(true),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar todas as conquistas do usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Downloads
    static async getDownloads() {
        try {
            const response = await fetch(`${API_URL}/downloads`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar downloads:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async canPostDownload() {
        try {
            const response = await fetch(`${API_URL}/downloads/can-post`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao verificar permissão:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getMyDownloadReaction(downloadId) {
        try {
            const response = await fetch(`${API_URL}/downloads/${downloadId}/my-reaction`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter reação:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async deleteDownload(downloadId) {
        try {
            const response = await fetch(`${API_URL}/downloads/${downloadId}`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao deletar download:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateDownload(downloadId, data) {
        try {
            const response = await fetch(`${API_URL}/downloads/${downloadId}`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar download:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getUserMiniProfile(userId) {
        try {
            const response = await fetch(`${API_URL}/downloads/user-profile/${userId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar perfil do usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Selecionar conquistas customizáveis para exibir no perfil (máximo 4)
    static async selectProfileRanks(rankIds) {
        try {
            // rankIds deve ser um array com ate 4 IDs de custom ranks
            const response = await fetch(`${API_URL}/users/selected-ranks`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ rankIds: rankIds || [] })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao selecionar conquistas:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Recuperar conquistas selecionados do perfil do usuário
    static async getSelectedProfileRanks() {
        try {
            const response = await fetch(`${API_URL}/users/selected-ranks`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar conquistas selecionados:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Atualizar a seleção para exibir/ocultar uma conquista no perfil
    static async updateProfileRankDisplay(rankId, display) {
        try {
            // Primeiro, buscar a lista atual de conquistas selecionadas
            const currentResponse = await this.getSelectedProfileRanks();
            if (!currentResponse.success) {
                return { success: false, message: 'Erro ao buscar seleção atual' };
            }

            // Pegar apenas os IDs numéricos explícitos da lista atual.
            // Não preservamos chaves fixas automáticas aqui, porque elas devem
            // refletir apenas a seleção efetiva do usuário no checkbox.
            const currentIds = (currentResponse.rankIds || [])
                .filter((id) => typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id)))
                .map((id) => Number(id));

            const rankIdNum = Number(rankId);
            let newRankIds;

            if (display) {
                // Adicionar à lista se não estiver lá
                if (!currentIds.some((id) => Number(id) === rankIdNum)) {
                    newRankIds = [...currentIds, rankIdNum];
                } else {
                    newRankIds = currentIds;
                }
            } else {
                // Remover da lista
                newRankIds = currentIds.filter((id) => Number(id) !== rankIdNum);
            }

            // Salvar apenas a lista numérica explícita da seleção atual.
            const payloadToSave = [...new Set(newRankIds.filter(Number.isFinite))];

            return await this.selectProfileRanks(payloadToSave);
        } catch (error) {
            console.error('Erro ao atualizar exibição da conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateMyRankColor(rankId, color) {
        try {
            const response = await fetch(`${API_URL}/users/rank-color`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ rankId, color })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar cor da conquista:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Banir ou suspender usuário
    static async banUser(userIdentifier, banType, banDays, reason) {
        try {
            const response = await fetch(`${API_URL}/admin/ban-user`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ userIdentifier, banType, banDays, reason })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao banir usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Obter lista de banimentos
    static async getBans() {
        try {
            const response = await fetch(`${API_URL}/admin/bans`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar banimentos:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Desbanir usuário
    static async unbanUser(banId) {
        try {
            const response = await fetch(`${API_URL}/admin/unban/${banId}`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao desbanir usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Conceder permissão de postagem
    static async grantPostPermission(userIdentifier) {
        try {
            const response = await fetch(`${API_URL}/admin/grant-post-permission`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ userIdentifier })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao conceder permissão:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Remover permissão de postagem
    static async revokePostPermission(userIdentifier) {
        try {
            const response = await fetch(`${API_URL}/admin/revoke-post-permission`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ userIdentifier })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao remover permissão:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async grantFixedRankOrderPermission(userIdentifier) {
        try {
            const response = await fetch(`${API_URL}/admin/grant-fixed-rank-order`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ userIdentifier })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao conceder permissão de ordenação fixa:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async revokeFixedRankOrderPermission(userIdentifier) {
        try {
            const response = await fetch(`${API_URL}/admin/revoke-fixed-rank-order`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ userIdentifier })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao remover permissão de ordenação fixa:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getDownloadUploadSettings() {
        try {
            const response = await fetch(`${API_URL}/admin/download-upload-settings`, {
                method: 'GET'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao carregar configuração de envio de arquivos:', error);
            return { success: false, enabled: false };
        }
    }

    static async updateDownloadUploadSettings(enabled) {
        try {
            const response = await fetch(`${API_URL}/admin/download-upload-settings`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ enabled: Boolean(enabled) })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao salvar configuração de envio de arquivos:', error);
            return { success: false, message: 'Erro de conexao' };
        }
    }

    // Listar usuários com permissão de postagem
    static async getUsersWithPostPermission() {
        try {
            const response = await fetch(`${API_URL}/admin/users-with-post-permission`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao listar usuários:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async setUserPermissions(userIdentifier, permissions = {}) {
        try {
            const response = await fetch(`${API_URL}/admin/set-user-permissions`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ userIdentifier, permissions })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao salvar permissões do usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getAnimatedProfileSettings() {
        try {
            const response = await fetch(`${API_URL}/users/animated-profile-settings`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar configuração de card animado:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateAnimatedProfileSettings(settingsOrEnabled, animatedProfileTheme = 'auto') {
        const payload = (settingsOrEnabled && typeof settingsOrEnabled === 'object')
            ? settingsOrEnabled
            : {
                animatedProfileEnabled: Boolean(settingsOrEnabled),
                animatedMiniProfileEnabled: Boolean(settingsOrEnabled),
                animatedDownloadCardEnabled: Boolean(settingsOrEnabled),
                animatedProfileTheme
            };
        try {
            const response = await fetch(`${API_URL}/users/animated-profile-settings`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao salvar configuração de card animado:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async getGiphyApiKey() {
        try {
            const response = await fetch(`${API_URL}/gifs/config`, {
                method: 'GET',
                headers: this.getHeaders(),
                cache: 'no-store'
            });
            const contentType = String(response.headers.get('content-type') || '').toLowerCase();
            if (!contentType.includes('application/json')) {
                return {
                    success: false,
                    message: 'A busca de GIFs ainda não está ativa no backend. Reinicie o servidor local.'
                };
            }
            const data = await response.json();
            return response.ok
                ? data
                : { success: false, message: data?.message || 'Busca de GIFs indisponível.' };
        } catch (error) {
            console.error('Erro ao carregar configuração do GIPHY:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async fetchGiphyAnimatedGifs(endpoint, query = '', limit = 18, offset = 0) {
        try {
            const config = await this.getGiphyApiKey();
            if (!config?.success || !config?.apiKey) {
                return { success: false, message: config?.message || 'Configure a chave de API do GIPHY.' };
            }

            const params = new URLSearchParams({
                api_key: config.apiKey,
                limit: String(Math.min(Math.max(Number(limit) || 18, 1), 50)),
                offset: String(Math.max(Number(offset) || 0, 0)),
                rating: 'g',
                lang: 'pt'
            });
            if (endpoint === 'search') {
                const normalizedQuery = String(query || '').trim();
                if (!normalizedQuery) return { success: false, message: 'Digite algo para buscar GIF.' };
                params.set('q', normalizedQuery);
            }

            const response = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params.toString()}`, {
                method: 'GET',
                cache: 'no-store'
            });
            const data = await response.json();
            if (!response.ok) {
                console.error(`[GIPHY] Respondeu HTTP ${response.status}`);
                return { success: false, message: 'O GIPHY não conseguiu concluir a busca. Verifique a chave de API.' };
            }

            const results = Array.isArray(data?.data)
                ? data.data.map((gif) => ({
                    gifId: String(gif?.id || ''),
                    gifUrl: String(gif?.images?.original?.url || ''),
                    previewUrl: String(gif?.images?.fixed_width_small?.url || gif?.images?.preview_gif?.url || ''),
                    title: String(gif?.title || '')
                })).filter((gif) => gif.gifId && gif.gifUrl && gif.previewUrl)
                : [];
            const nextOffset = Number(data?.pagination?.offset || 0) + Number(data?.pagination?.count || 0);
            const totalCount = Number(data?.pagination?.total_count || 0);
            return {
                success: true,
                results,
                next: nextOffset < totalCount ? String(nextOffset) : ''
            };
        } catch (error) {
            console.error('Erro ao buscar GIFs no GIPHY:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async searchAnimatedGifs(query, limit = 18, offset = 0) {
        return this.fetchGiphyAnimatedGifs('search', query, limit, offset);
    }

    static async getTrendingAnimatedGifs(limit = 18, offset = 0) {
        return this.fetchGiphyAnimatedGifs('trending', '', limit, offset);
    }

    static async uploadAnimatedProfileGif(file) {
        try {
            const formData = new FormData();
            formData.append('gif', file);

            const token = this.getToken();
            const response = await fetch(`${API_URL}/users/animated-profile/upload-gif`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao enviar GIF personalizado:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Obter conquistas de postagem
    static async getPostageRanks() {
        try {
            const response = await fetch(`${API_URL}/downloads/ranks/all`, {
                method: 'GET',
                headers: this.getHeaders(),
                cache: 'no-store'
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter conquistas de postagem:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Sincronizar conquistas de conquista por quantidade de postagens
    static async syncPostAchievementRanks() {
        try {
            const response = await fetch(`${API_URL}/downloads/post-conquistas/sync`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao sincronizar conquistas de postagens:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async syncLikeAchievementRanks() {
        try {
            const response = await fetch(`${API_URL}/downloads/like-conquistas/sync`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao sincronizar conquistas de likes:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // ========== DOWNLOADS E POSTAGENS ==========

    // Criar postagem
    static async createDownload(name, description, link) {
        try {
            // Suportar tanto formato antigo (link enico) quanto novo (array)
            let body;
            if (typeof link === 'object' && link.links) {
                body = { name, description, ...link, links: link.links };
            } else if (Array.isArray(link)) {
                body = { name, description, links: link };
            } else if (typeof link === 'object') {
                body = { name, description, ...link };
            } else {
                body = { name, description, links: [link] };
            }

            const response = await fetch(`${API_URL}/downloads`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify(body)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao criar download:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Upload de arquivo compactado (.zip/.rar) para usar como link do download
    static async uploadDownloadFile(file) {
        let token = '';
        let pendingUploadId = '';
        try {
            token = localStorage.getItem('token') || '';
            if (!token) {
                return { success: false, message: 'Faça login para enviar arquivos.' };
            }

            const hostname = String(window.location.hostname || '').toLowerCase();
            const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
            const parseApiResponse = async (response, operation) => {
                const text = await response.text();
                let result;
                try {
                    result = JSON.parse(text);
                } catch {
                    const detail = text.replace(/\s+/g, ' ').trim().slice(0, 180);
                    throw new Error(
                        detail
                            ? `${operation} falhou (HTTP ${response.status}): ${detail}`
                            : `${operation} falhou (HTTP ${response.status}).`
                    );
                }

                if (!response.ok || result?.success === false) {
                    throw new Error(result?.message || `${operation} falhou (HTTP ${response.status}).`);
                }
                return result;
            };

            if (isLocal) {
                const form = new FormData();
                form.append('file', file);
                const response = await fetch(`${API_URL}/downloads/upload-file`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: form
                });
                return await parseApiResponse(response, 'Upload do arquivo');
            }

            const ticketResponse = await fetch(`${API_URL}/downloads/upload-ticket`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type,
                    size: file.size
                })
            });
            const ticketResult = await parseApiResponse(ticketResponse, 'Preparação do upload');
            const upload = ticketResult.upload;
            pendingUploadId = String(upload?.uploadId || '');
            if (!upload?.uploadId || !upload?.uploadUrl || !upload?.headers) {
                throw new Error('O servidor não retornou os dados necessários para enviar o arquivo.');
            }

            const storageResponse = await fetch(upload.uploadUrl, {
                method: 'PUT',
                headers: upload.headers,
                body: file
            });
            if (!storageResponse.ok) {
                const detail = (await storageResponse.text()).replace(/\s+/g, ' ').trim().slice(0, 180);
                throw new Error(
                    detail
                        ? `O armazenamento recusou o arquivo (HTTP ${storageResponse.status}): ${detail}`
                        : `O armazenamento recusou o arquivo (HTTP ${storageResponse.status}).`
                );
            }

            const completeResponse = await fetch(`${API_URL}/downloads/upload-complete`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ uploadId: upload.uploadId })
            });
            const completeResult = await parseApiResponse(completeResponse, 'Confirmação do upload');
            pendingUploadId = '';
            return completeResult;
        } catch (error) {
            if (pendingUploadId && token) {
                try {
                    await fetch(`${API_URL}/downloads/upload/${encodeURIComponent(pendingUploadId)}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                } catch (cleanupError) {
                    console.error('Erro ao limpar upload incompleto do R2:', cleanupError);
                }
            }
            console.error('Erro ao enviar arquivo do download:', error);
            return { success: false, message: error?.message || 'Erro de conexão durante o upload.' };
        }
    }

    static async abortDownloadFile(uploadId) {
        const safeUploadId = String(uploadId || '').trim();
        if (!safeUploadId) return { success: true };

        try {
            const response = await fetch(`${API_URL}/downloads/upload/${encodeURIComponent(safeUploadId)}`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch {
                const detail = responseText.replace(/\s+/g, ' ').trim().slice(0, 180);
                throw new Error(
                    detail
                        ? `Não foi possível limpar o arquivo (HTTP ${response.status}): ${detail}`
                        : `Não foi possível limpar o arquivo (HTTP ${response.status}).`
                );
            }
            if (!response.ok || result?.success === false) {
                throw new Error(result?.message || `Não foi possível limpar o arquivo (HTTP ${response.status}).`);
            }
            return result;
        } catch (error) {
            console.error('Erro ao limpar arquivo temporário de download:', error);
            return { success: false, message: error?.message || 'Erro de conexão ao limpar o arquivo.' };
        }
    }

    // Verificar permissão de postagem
    static async checkCanPostDownloads() {
        try {
            const response = await fetch(`${API_URL}/downloads/can-post`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao verificar permissão:', error);
            return { success: false, canPost: false };
        }
    }

    // Verificar permissão de gerenciar downloads (editar/excluir)
    static async checkCanManageDownloads() {
        try {
            const response = await fetch(`${API_URL}/downloads/can-manage`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao verificar permissão:', error);
            return { success: false, canManage: false };
        }
    }

    // Obter perfil do usuário com conquistas de postagem
    static async getUserPostageProfile(userId) {
        try {
            const response = await fetch(`${API_URL}/downloads/user-profile/${userId}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter perfil:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Obter todos os downloads
    static async getAllDownloads() {
        try {
            const response = await fetch(`${API_URL}/downloads`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter downloads:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Obter downloads com conquistas
    static async getDownloadsWithRanks() {
        try {
            const response = await fetch(`${API_URL}/downloads/list/with-ranks`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter downloads:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Dar reação/like em um download
    static async addDownloadReaction(downloadId, reactionType) {
        try {
            const response = await fetch(`${API_URL}/downloads/${downloadId}/reaction`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ reactionType })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao adicionar reação:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Adicionar/remover favorito
    static async toggleDownloadFavorite(downloadId) {
        try {
            const response = await fetch(`${API_URL}/downloads/${downloadId}/favorite`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao adicionar favorito:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Verificar se e favorito
    static async checkIsFavorite(downloadId) {
        try {
            const response = await fetch(`${API_URL}/downloads/${downloadId}/is-favorite`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao verificar favorito:', error);
            return { success: false, isFavorite: false };
        }
    }

    // Obter favoritos do usuário
    static async getFavoriteDownloads() {
        try {
            const response = await fetch(`${API_URL}/downloads/favorites/list`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter favoritos:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Obter downloads de um usuário específico
    static async getUserDownloads(userId) {
        try {
            const response = await fetch(`${API_URL}/downloads/user/${userId}/downloads`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter downloads do usuário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Obter estatísticas do usuário (postagens, likes, etc)
    static async getUserDownloadStats(userId) {
        try {
            const response = await fetch(`${API_URL}/downloads/user/${userId}/stats`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async checkAdminPermission() {
        try {
            const response = await fetch(`${API_URL}/admin/check-permission`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao verificar permissão de admin:', error);
            return { success: false, hasAccess: false, canViewStaffHierarchy: false };
        }
    }

    // ===================== Comentários =====================

    // Adicionar comentário (texto + anexo opcional)
    static async addDownloadComment(downloadId, content, options = {}) {
        try {
            const attachment = options?.attachment || null;
            const formData = new FormData();
            formData.append('content', String(content || ''));
            if (attachment) {
                formData.append('attachment', attachment);
            }

            const token = this.getToken();
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_URL}/downloads/${downloadId}/comments`, {
                method: 'POST',
                headers,
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao adicionar comentário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Obter comentários de um download
    static async getDownloadComments(downloadId) {
        try {
            const response = await fetch(`${API_URL}/downloads/${downloadId}/comments`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter comentários:', error);
            return { success: false, comments: [] };
        }
    }

    // Editar comentário
    static async updateDownloadComment(commentId, content) {
        try {
            const response = await fetch(`${API_URL}/downloads/comments/${commentId}`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ content: String(content || '') })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao editar comentário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Deletar comentário
    static async deleteDownloadComment(commentId) {
        try {
            const response = await fetch(`${API_URL}/downloads/comments/${commentId}`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao deletar comentário:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async pinComment(commentId, isPinned) {
        try {
            console.log('[API PIN] Enviando pedido:', { commentId, isPinned, url: `${API_URL}/downloads/comments/${commentId}/pin` });
            const token = this.getToken();
            console.log('[API PIN] Token presente?', !!token);

            const response = await fetch(`${API_URL}/downloads/comments/${commentId}/pin`, {
                method: 'PATCH',
                headers: this.getHeaders(true),
                body: JSON.stringify({ isPinned })
            });

            console.log('[API PIN] Status da resposta:', response.status, response.statusText);
            
            if (!response.ok) {
                const text = await response.text();
                console.error('[API PIN] Resposta com erro:', text);
                try {
                    const errorData = JSON.parse(text);
                    return { success: false, message: errorData.message || 'Erro ao fixar' };
                } catch {
                    return { success: false, message: `Erro ${response.status}: ${response.statusText}` };
                }
            }

            const data = await response.json();
            console.log('[API PIN] Resposta de sucesso:', data);
            return data;
        } catch (error) {
            console.error('[API PIN] Exceção:', error);
            return { success: false, message: 'Erro de conexão ao fixar comentário' };
        }
    }

    static async addCommentReaction(commentId, emoji) {
        try {
            console.log('[API REACTION] Enviando pedido:', { commentId, emoji, url: `${API_URL}/downloads/comments/${commentId}/reactions` });
            const token = this.getToken();
            console.log('[API REACTION] Token presente?', !!token);

            const response = await fetch(`${API_URL}/downloads/comments/${commentId}/reactions`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ emoji })
            });

            console.log('[API REACTION] Status da resposta:', response.status, response.statusText);
            
            if (!response.ok) {
                const text = await response.text();
                console.error('[API REACTION] Resposta com erro:', text);
                try {
                    const errorData = JSON.parse(text);
                    return { success: false, message: errorData.message || 'Erro ao adicionar reação' };
                } catch {
                    return { success: false, message: `Erro ${response.status}: ${response.statusText}` };
                }
            }

            const data = await response.json();
            console.log('[API REACTION] Resposta de sucesso:', data);
            return data;
        } catch (error) {
            console.error('[API REACTION] Exceção:', error);
            return { success: false, message: 'Erro de conexão ao adicionar reação' };
        }
    }

    // ===================== NOTIFICAÇÕES =====================

    // Obter notificaeees não lidas
    static async getUnreadNotifications() {
        try {
            const response = await fetch(`${API_URL}/downloads/notifications/unread`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter notificaeees:', error);
            return { success: false, notifications: [], unreadCount: 0 };
        }
    }

    // Obter todas as notificaeees
    static async getAllNotifications(limit = 50, offset = 0) {
        try {
            const response = await fetch(`${API_URL}/downloads/notifications/all?limit=${limit}&offset=${offset}`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter notificaeees:', error);
            return { success: false, notifications: [] };
        }
    }

    // Contar notificaeees não lidas
    static async getNotificationCount() {
        try {
            const response = await fetch(`${API_URL}/downloads/notifications/count`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao contar notificaeees:', error);
            return { success: false, unreadCount: 0 };
        }
    }

    // Marcar notificação como lida
    static async markNotificationAsRead(notificationId) {
        try {
            const response = await fetch(`${API_URL}/downloads/notifications/${notificationId}/read`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao marcar como lida:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Marcar todas as notificaeees como lidas
    static async markAllNotificationsAsRead() {
        try {
            const response = await fetch(`${API_URL}/downloads/notifications/mark-all-read`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao marcar todas como lidas:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async deleteNotification(notificationId) {
        try {
            const response = await fetch(`${API_URL}/downloads/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao excluir notificação:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async deleteAllNotifications() {
        try {
            const response = await fetch(`${API_URL}/downloads/notifications/all`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao excluir todas as notificações:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // Configurações de notificaeees do usuário
    static async getNotificationSettings() {
        try {
            const response = await fetch(`${API_URL}/users/notification-settings`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter configurações de notificaeees:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateNotificationSettings(settings) {
        try {
            const response = await fetch(`${API_URL}/users/notification-settings`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify(settings || {})
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar configurações de notificaeees:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async parseProfileAnimationSettingsResponse(response) {
        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            console.error('Resposta inválida ao consultar preferência de animações:', {
                status: response.status,
                error
            });
            return {
                success: false,
                message: response.status === 404
                    ? 'A rota não existe no backend publicado. Atualize o backend na Discloud.'
                    : `Resposta inválida do servidor (HTTP ${response.status}).`
            };
        }

        if (!response.ok) {
            const message = response.status === 404
                ? 'A rota não existe no backend publicado. Atualize o backend na Discloud.'
                : payload?.message || `Erro HTTP ${response.status}`;
            console.error('Erro HTTP ao consultar preferência de animações:', response.status, response.url);
            return { success: false, message };
        }

        return payload;
    }

    static async getProfileAnimationSettings() {
        try {
            const response = await fetch(withNoCacheParam(`${API_URL}/users/profile-animation-settings`), {
                method: 'GET',
                headers: this.getHeaders(true),
                cache: 'no-store'
            });
            return await this.parseProfileAnimationSettingsResponse(response);
        } catch (error) {
            console.error('Erro ao obter preferência de animações do perfil:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async updateProfileAnimationSettings(profileAnimationMode) {
        try {
            const response = await fetch(`${API_URL}/users/profile-animation-settings`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ profileAnimationMode }),
                cache: 'no-store'
            });
            return await this.parseProfileAnimationSettingsResponse(response);
        } catch (error) {
            console.error('Erro ao salvar preferência de animações do perfil:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async getAdultPostSettings() {
        try {
            const response = await fetch(`${API_URL}/users/adult-post-settings`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao obter configurações +18:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    static async updateAdultPostSettings(showAdultPosts) {
        try {
            const response = await fetch(`${API_URL}/users/adult-post-settings`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ showAdultPosts: Boolean(showAdultPosts) })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao salvar configurações +18:', error);
            return { success: false, message: 'Erro de conexeo' };
        }
    }

    // ====== ENDPOINTS DE SUSPENSÃO DE POSTAGENS ======

    // Suspender uma postagem
    static async suspendDownload(downloadId, reason) {
        try {
            const response = await fetch(`${API_URL}/admin/suspend-download/${downloadId}`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ reason })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao suspender download:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    // Obter postagens suspensas
    static async getSuspendedDownloads() {
        try {
            const response = await fetch(`${API_URL}/admin/suspended-downloads`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar postagens suspensas:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    // Desuspender uma postagem (reabrir para review)
    static async unsuspendDownload(downloadId) {
        try {
            const response = await fetch(`${API_URL}/admin/unsuspend-download/${downloadId}`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao desuspender download:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    // Remover postagem suspensa
    static async deleteSuspendedDownload(downloadId) {
        try {
            const response = await fetch(`${API_URL}/admin/delete-suspended-download/${downloadId}`, {
                method: 'DELETE',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao deletar download suspensa:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    // Enviar postagem suspensa para revisão
    static async requestDownloadReview(downloadId, reviewMessage) {
        try {
            const response = await fetch(`${API_URL}/admin/request-download-review/${downloadId}`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({ message: reviewMessage })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao enviar para revisão:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    // Obter postagens suspensas do usuário
    static async getSuspendedPostsUser() {
        try {
            const response = await fetch(`${API_URL}/downloads/suspended`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar postagens suspensas:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async submitSuspendedPostForReview(downloadId) {
        try {
            const response = await fetch(`${API_URL}/downloads/${downloadId}/submit-for-review`, {
                method: 'POST',
                headers: this.getHeaders(true),
                body: JSON.stringify({})
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao submeter postagem suspensa para revisão:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async checkCanSuspendPosts() {
        try {
            const response = await fetch(`${API_URL}/admin/check-can-suspend`, {
                method: 'GET',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao verificar permissão de suspensão:', error);
            return { success: false, canSuspend: false };
        }
    }

    static async updateCustomTitle(userId, customTitle, customTitleSubtitle) {
        try {
            const response = await fetch(`${API_URL}/users/${userId}/custom-title`, {
                method: 'PUT',
                headers: this.getHeaders(true),
                body: JSON.stringify({ 
                    customTitle: customTitle || null,
                    customTitleSubtitle: customTitleSubtitle || null
                })
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao atualizar título customizado:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async syncPostAchievementRanks() {
        try {
            const response = await fetch(`${API_URL}/ranks/sync/post-achievements`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao sincronizar conquistas de postagens:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }

    static async syncLikeAchievementRanks() {
        try {
            const response = await fetch(`${API_URL}/ranks/sync/like-achievements`, {
                method: 'POST',
                headers: this.getHeaders(true)
            });
            return await response.json();
        } catch (error) {
            console.error('Erro ao sincronizar conquistas de likes:', error);
            return { success: false, message: 'Erro de conexão' };
        }
    }
}
