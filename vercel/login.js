// ========== LOGIN SCRIPT v2 - SUPER SIMPLES ==========

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

let resendCooldownTimer = null;
let resendInFlight = false;
const RESEND_COOLDOWN = 3000;

document.addEventListener('DOMContentLoaded', function() {
    console.log('=== DOM CARREGADO ===');
    const TRUSTED_DEVICE_TOKEN_KEY = 'holidayTrustedDeviceToken';

    // Se veio mensagem de redirecionamento (ex.: sessão inválida/bloqueada), exibir no formulário.
    const urlParams = new URLSearchParams(window.location.search);
    const messageParam = urlParams.get('message');
    const formErrorEl = document.getElementById('formError');
    if (messageParam && formErrorEl) {
        formErrorEl.textContent = messageParam;
    }
    
    // ===== TOGGLE DE SENHA =====
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    console.log(' Toggle button setup:', {toggleBtn, passwordInput});
    
    if (toggleBtn && passwordInput) {
        const updateToggleIcon = () => {
            const isVisible = passwordInput.type === 'text';
            const svg = isVisible ? VISIBILITY_ICON_EYE_OFF : VISIBILITY_ICON_EYE;
            toggleBtn.innerHTML = svg;
            console.log(' Login icon updated:', isVisible ? 'OFF' : 'EYE', 'SVG length:', svg.length);
            toggleBtn.setAttribute('aria-pressed', String(isVisible));
            toggleBtn.setAttribute('aria-label', isVisible ? 'Ocultar senha' : 'Mostrar senha');
        };

        updateToggleIcon();

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
            updateToggleIcon();
        });
    } else {
        console.warn(' Toggle button or password input not found!');
    }
    
    // ===== LOGIN =====
    const loginForm = document.getElementById('loginForm');
    const nicknameInput = document.getElementById('nickname');
    const rememberCheckbox = document.getElementById('rememberAccount');
    const formError = document.getElementById('formError');
    const twoFactorGroup = document.getElementById('twoFactorGroup');
    const twoFactorMethodGroup = document.getElementById('twoFactorMethodGroup');
    const twoFactorMethodAuthenticatorBtn = document.getElementById('twoFactorMethodAuthenticator');
    const twoFactorMethodEmailBtn = document.getElementById('twoFactorMethodEmail');
    const twoFactorCodeLabel = document.getElementById('twoFactorCodeLabel');
    const twoFactorCodeInput = document.getElementById('twoFactorCode');
    const sendTwoFactorEmailBtn = document.getElementById('sendTwoFactorEmailBtn');
    const twoFactorInfo = document.getElementById('twoFactorInfo');
    const resendVerificationBtn = document.getElementById('resendVerificationBtn');
    const verificationAssistInfo = document.getElementById('verificationAssistInfo');
    const formOptions = document.querySelector('.form-options');
    const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
    let pendingTwoFactorTicket = '';
    let pendingTwoFactorMethods = ['authenticator'];
    let currentTwoFactorMethod = 'authenticator';
    let pendingGoogleLogin = false;
    let pendingVerificationEmail = '';
    let verificationTimer = null;
    let lastResendTime = 0;

    const getTrustedDeviceToken = () => String(localStorage.getItem(TRUSTED_DEVICE_TOKEN_KEY) || '').trim();
    const clearTrustedDeviceToken = () => localStorage.removeItem(TRUSTED_DEVICE_TOKEN_KEY);
    const saveTrustedDeviceToken = (value) => {
        const token = String(value || '').trim();
        if (!token) {
            clearTrustedDeviceToken();
            return;
        }
        localStorage.setItem(TRUSTED_DEVICE_TOKEN_KEY, token);
    };

    const clearTwoFactorInfo = () => {
        if (!twoFactorInfo) return;
        twoFactorInfo.style.display = 'none';
        twoFactorInfo.textContent = '';
    };

    const setTwoFactorInfo = (message) => {
        if (!twoFactorInfo) return;
        twoFactorInfo.style.display = message ? 'block' : 'none';
        twoFactorInfo.textContent = message || '';
    };

    const clearVerificationAssistInfo = () => {
        if (!verificationAssistInfo) return;
        verificationAssistInfo.style.display = 'none';
        verificationAssistInfo.textContent = '';
    };

    const setVerificationResendState = (enabled, email = '') => {
        pendingVerificationEmail = enabled ? String(email || '').trim() : '';
        if (enabled && pendingVerificationEmail) {
            // Mostrar modal de verificação
            showVerifyModal(pendingVerificationEmail);
        } else {
            // Ocultar modal se desabilitando
            if (resendVerificationBtn) {
                resendVerificationBtn.style.display = enabled ? 'block' : 'none';
                resendVerificationBtn.disabled = false;
                resendVerificationBtn.textContent = 'Reenviar código de verificação';
                if (enabled && pendingVerificationEmail) {
                    resendVerificationBtn.title = `Reenviar código para ${pendingVerificationEmail}`;
                } else {
                    resendVerificationBtn.removeAttribute('title');
                }
            }
        }
        if (!enabled) {
            clearVerificationAssistInfo();
        }
    };

    const showVerifyModal = (email) => {
        const verifyModal = document.getElementById('verifyModal');
        const verifyEmail = document.getElementById('verifyEmail');
        const verifyForm = document.getElementById('verifyForm');
        const verificationCode = document.getElementById('verificationCode');
        
        if (!verifyModal || !verifyEmail || !verifyForm) return;
        
        verifyEmail.textContent = email;
        verificationCode.value = '';
        document.getElementById('verifyError').textContent = '';
        verifyModal.style.display = 'flex';
        verificationCode.focus();
        
        // Salvar email para função de reenvio usar
        localStorage.setItem('pendingVerificationEmail', email);
        lastResendTime = Date.now();
        localStorage.setItem('lastVerificationResend', lastResendTime.toString());
        startVerificationTimer();
        
        // Limpar evento anterior se existir
        verifyForm.onsubmit = null;
        verifyForm.addEventListener('submit', handleVerifySubmit);
    };

    const hideVerifyModal = () => {
        const verifyModal = document.getElementById('verifyModal');
        if (verifyModal) {
            verifyModal.style.display = 'none';
            clearVerificationTimer();
        }
    };

    const handleVerifySubmit = async (e) => {
        e.preventDefault();
        const verificationCode = document.getElementById('verificationCode');
        const verifyError = document.getElementById('verifyError');
        const code = verificationCode.value.trim();
        
        if (!code || code.length !== 6) {
            verifyError.textContent = 'Insira um código válido com 6 dígitos';
            return;
        }
        
        const result = await AuthAPI.verifyEmail(pendingVerificationEmail, code);
        if (result.success) {
            clearVerificationTimer();
            hideVerifyModal();
            // Se o backend retornou um token, armazenar e redirecionar para o perfil (auto-login)
            if (result.token) {
                try {
                    AuthAPI.setToken(result.token);
                } catch (e) {
                    console.warn('Erro ao salvar token para auto-login', e);
                }
                window.location.href = '/profile.html';
                return;
            }

            // Fallback: informar usuário para logar novamente
            formError.textContent = 'Email verificado! Faça login novamente.';
            // Limpar formulário
            nicknameInput.value = '';
            passwordInput.value = '';
        } else {
            verifyError.textContent = (result.message || 'Código inválido ou expirado');
        }
    };

    const startVerificationTimer = () => {
        let timeLeft = 600; // 10 minutos em segundos
        const timerElement = document.getElementById('verificationTimer');
        
        if (!timerElement) return;

        const updateTimerDisplay = () => {
            const minutes = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            timerElement.textContent = `Válido por ${minutes}:${secs.toString().padStart(2, '0')}`;
        };

        updateTimerDisplay();
        
        verificationTimer = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
                clearVerificationTimer();
                timerElement.textContent = 'Código expirado! Reenvie um novo código.';
                timerElement.style.color = '#FF0000';
                document.getElementById('verifyForm').style.pointerEvents = 'none';
                document.getElementById('verifyForm').style.opacity = '0.5';
            }
        }, 1000);
    };

    const clearVerificationTimer = () => {
        if (verificationTimer) {
            clearInterval(verificationTimer);
            verificationTimer = null;
        }
    };

    const normalizeTwoFactorMethods = (methods) => {
        const source = Array.isArray(methods) ? methods : [];
        const normalized = source
            .map((item) => String(item || '').trim().toLowerCase())
            .filter((item) => item === 'authenticator' || item === 'email');
        return normalized.length > 0 ? Array.from(new Set(normalized)) : ['authenticator'];
    };

    const setTwoFactorMethod = (method) => {
        const normalized = String(method || '').trim().toLowerCase();
        if (!pendingTwoFactorMethods.includes(normalized)) return;
        currentTwoFactorMethod = normalized;

        if (twoFactorMethodAuthenticatorBtn) {
            twoFactorMethodAuthenticatorBtn.classList.toggle('active', normalized === 'authenticator');
        }
        if (twoFactorMethodEmailBtn) {
            twoFactorMethodEmailBtn.classList.toggle('active', normalized === 'email');
        }

        if (twoFactorCodeLabel) {
            twoFactorCodeLabel.textContent = normalized === 'email'
                ? 'C\u00f3digo enviado por e-mail'
                : 'C\u00f3digo Authenticator (2FA)';
        }
        if (twoFactorCodeInput) {
            twoFactorCodeInput.placeholder = normalized === 'email'
                ? 'Digite o código recebido no e-mail'
                : 'Digite os 6 d\u00edgitos do Authenticator';
        }
        if (sendTwoFactorEmailBtn) {
            sendTwoFactorEmailBtn.style.display = normalized === 'email' ? 'block' : 'none';
        }
    };

    const setSubmitLoading = (loading, text = 'Entrar') => {
        if (!submitBtn) return;
        submitBtn.disabled = Boolean(loading);
        submitBtn.textContent = loading ? text : (pendingTwoFactorTicket ? 'Verificar código' : 'Entrar');
    };

    const setTwoFactorMode = (enabled, methods = []) => {
        const active = Boolean(enabled);
        pendingTwoFactorTicket = active ? pendingTwoFactorTicket : '';
        pendingTwoFactorMethods = active ? normalizeTwoFactorMethods(methods) : ['authenticator'];
        setVerificationResendState(false);

        if (twoFactorGroup) {
            twoFactorGroup.style.display = active ? 'block' : 'none';
        }
        if (twoFactorMethodGroup) {
            twoFactorMethodGroup.style.display = active && pendingTwoFactorMethods.length > 1 ? 'flex' : 'none';
        }
        if (twoFactorCodeInput) {
            twoFactorCodeInput.value = '';
            twoFactorCodeInput.required = active;
        }
        clearTwoFactorInfo();
        if (nicknameInput) {
            nicknameInput.readOnly = active;
            nicknameInput.required = !active;
        }
        if (passwordInput) {
            passwordInput.readOnly = active;
            passwordInput.required = !active;
        }
        if (rememberCheckbox) {
            rememberCheckbox.disabled = active;
        }
        if (formOptions) {
            formOptions.style.opacity = active ? '0.65' : '1';
            formOptions.style.pointerEvents = active ? 'none' : '';
        }
        if (submitBtn) {
            submitBtn.textContent = active ? 'Verificar código' : 'Entrar';
        }

        if (active) {
            if (pendingTwoFactorMethods.includes('authenticator')) {
                setTwoFactorMethod('authenticator');
            } else {
                setTwoFactorMethod(pendingTwoFactorMethods[0]);
            }
        } else {
            currentTwoFactorMethod = 'authenticator';
            setTwoFactorMethod('authenticator');
        }
    };

    window.addEventListener('holiday:google-login-result', (event) => {
        const result = event.detail || {};
        if (result.requiresTwoFactor && result.loginTicket) {
            pendingTwoFactorTicket = result.loginTicket;
            pendingGoogleLogin = true;
            if (result.clearTrustedDeviceToken) clearTrustedDeviceToken();
            setTwoFactorMode(true, result.twoFactorMethods);
            formError.textContent = result.message || 'Digite o código 2FA para continuar.';
            return;
        }

        if (result.success && result.token) {
            pendingGoogleLogin = false;
            setTwoFactorMode(false);
            AuthAPI.setToken(result.token);
            window.location.href = 'profile.html';
            return;
        }

        AuthAPI.removeToken();
        formError.textContent = result.message || 'Não foi possível entrar com Google.';
    });

    const sendTwoFactorEmailCode = async () => {
        if (!pendingTwoFactorTicket) {
            formError.textContent = 'Sessão 2FA inválida. Tente fazer login novamente.';
            return;
        }

        clearTwoFactorInfo();
        if (sendTwoFactorEmailBtn) {
            sendTwoFactorEmailBtn.disabled = true;
            sendTwoFactorEmailBtn.textContent = 'Enviando...';
        }

        try {
            const result = await AuthAPI.sendTwoFactorEmailCode(pendingTwoFactorTicket);
            if (result?.success) {
                formError.textContent = '';
                setTwoFactorInfo(result.message || 'C\u00f3digo enviado para seu e-mail.');
            } else {
                formError.textContent = result?.message || 'Erro ao enviar código por e-mail';
            }
        } catch (error) {
            console.error('Erro ao enviar código 2FA por e-mail:', error);
            formError.textContent = 'Erro ao enviar código por e-mail';
        } finally {
            if (sendTwoFactorEmailBtn) {
                sendTwoFactorEmailBtn.disabled = false;
                sendTwoFactorEmailBtn.textContent = 'Enviar código por e-mail';
            }
        }
    };
    setTwoFactorMode(false);

    // Carregar dados salvos
    const saved = localStorage.getItem('rememberMe');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            nicknameInput.value = data.nickname || '';
            passwordInput.value = data.password || '';
            rememberCheckbox.checked = true;
        } catch (e) {
            console.error('Erro ao carregar dados salvos:', e);
        }
    }
    
    // Verificar URL params
    const urlNick = urlParams.get('nickname');
    const urlPass = urlParams.get('password');
    if (urlNick && urlPass) {
        nicknameInput.value = urlNick;
        passwordInput.value = urlPass;
        console.log('? Formulário preenchido com params da URL');
    }

    if (twoFactorMethodAuthenticatorBtn) {
        twoFactorMethodAuthenticatorBtn.addEventListener('click', () => {
            setTwoFactorMethod('authenticator');
            clearTwoFactorInfo();
            formError.textContent = '';
        });
    }

    if (twoFactorMethodEmailBtn) {
        twoFactorMethodEmailBtn.addEventListener('click', () => {
            setTwoFactorMethod('email');
            clearTwoFactorInfo();
            formError.textContent = '';
        });
    }

    if (sendTwoFactorEmailBtn) {
        sendTwoFactorEmailBtn.addEventListener('click', async () => {
            formError.textContent = '';
            await sendTwoFactorEmailCode();
        });
    }

    if (resendVerificationBtn) {
        resendVerificationBtn.addEventListener('click', async () => {
            const email = String(pendingVerificationEmail || '').trim();
            if (!email) {
                formError.textContent = 'Não foi possível identificar o e-mail para reenviar o código.';
                return;
            }

            formError.textContent = '';
            clearVerificationAssistInfo();
            resendVerificationBtn.disabled = true;
            resendVerificationBtn.textContent = 'Reenviando...';

            try {
                const result = await AuthAPI.resendVerification(email);
                if (result?.success) {
                    if (verificationAssistInfo) {
                        verificationAssistInfo.style.display = 'block';
                        verificationAssistInfo.textContent = result.message || 'Novo código enviado para seu e-mail.';
                    }
                } else {
                    formError.textContent = result?.message || 'Erro ao reenviar código de verificação.';
                }
            } catch (error) {
                console.error('Erro ao reenviar verificação de e-mail:', error);
                formError.textContent = 'Erro ao reenviar código de verificação.';
            } finally {
                resendVerificationBtn.disabled = false;
                resendVerificationBtn.textContent = 'Reenviar código de verificação';
            }
        });
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('=== SUBMIT DO Formulário ===');

            const nickname = nicknameInput.value.trim();
            const password = passwordInput.value;
            formError.textContent = '';
            clearVerificationAssistInfo();

            // Etapa 2FA
            if (pendingTwoFactorTicket) {
                const code = String(twoFactorCodeInput?.value || '').replace(/\s+/g, '').trim();
                if (!/^\d{6}$/.test(code)) {
                    formError.textContent = currentTwoFactorMethod === 'email'
                        ? 'Digite o código de 6 d\u00edgitos enviado por e-mail'
                        : 'Digite o código de 6 d\u00edgitos do Authenticator';
                    return;
                }

                setSubmitLoading(true, 'Validando...');
                try {
                    const verifyResult = await AuthAPI.verifyTwoFactorLogin(
                        pendingTwoFactorTicket,
                        code,
                        currentTwoFactorMethod
                    );
                    if (verifyResult.success) {
                        if (verifyResult.trustedDeviceToken) {
                            saveTrustedDeviceToken(verifyResult.trustedDeviceToken);
                        } else {
                            clearTrustedDeviceToken();
                        }
                        if (!pendingGoogleLogin) {
                            if (rememberCheckbox.checked) {
                                localStorage.setItem('rememberMe', JSON.stringify({ nickname, password }));
                            } else {
                                localStorage.removeItem('rememberMe');
                            }
                        }

                        AuthAPI.setToken(verifyResult.token);
                        pendingGoogleLogin = false;
                        setTwoFactorMode(false);
                        setTimeout(() => {
                            window.location.href = 'profile.html';
                        }, 100);
                        return;
                    }

                    AuthAPI.removeToken();
                    formError.textContent = verifyResult.message || 'C\u00f3digo inválido';
                } catch (error) {
                    console.error('Erro na verificação 2FA:', error);
                    formError.textContent = 'Erro ao validar código';
                } finally {
                    setSubmitLoading(false);
                }
                return;
            }

            console.log('Dados:', { nickname, password: '***' });

            if (!nickname || !password) {
                formError.textContent = 'Preencha todos os campos';
                console.error('Campos vazios');
                return;
            }

            setSubmitLoading(true, 'Entrando...');

            try {
                // Impede reutilizaeeo de sessão anterior (ex.: outro usuário logado no mesmo navegador).
                AuthAPI.removeToken();
                const trustedDeviceToken = getTrustedDeviceToken();

                console.log('Enviando login para API...');
                const result = await AuthAPI.login(nickname, password, trustedDeviceToken);
                console.log('Resposta da API:', result);

                if (result.success && result.requiresTwoFactor) {
                    setVerificationResendState(false);
                    if (result.clearTrustedDeviceToken) {
                        clearTrustedDeviceToken();
                    }
                    if (!result.loginTicket) {
                        formError.textContent = 'Falha ao iniciar validaeeo 2FA';
                        setSubmitLoading(false);
                        return;
                    }
                    pendingTwoFactorTicket = result.loginTicket;
                    setTwoFactorMode(true, result.twoFactorMethods);
                    formError.textContent = result.message || 'Digite o código 2FA para continuar.';
                    setSubmitLoading(false);
                    return;
                }

                if (result.success) {
                    console.log('? Login bem-sucedido!');
                    setVerificationResendState(false);
                    
                    // Salvar dados
                    if (rememberCheckbox.checked) {
                        localStorage.setItem('rememberMe', JSON.stringify({ nickname, password }));
                    } else {
                        localStorage.removeItem('rememberMe');
                    }
                    
                    // Salvar token
                    AuthAPI.setToken(result.token);
                    console.log('? Token armazenado');
                    
                    // Redirecionar
                    console.log('Redirecionando para profile.html...');
                    setTimeout(() => {
                        window.location.href = 'profile.html';
                    }, 100);
                } else {
                    // Em falha de login (incluindo banimento), garantir que não exista token residual.
                    AuthAPI.removeToken();
                    formError.textContent = result.message || 'Erro ao fazer login';
                    if (result?.needsVerification) {
                        const verificationEmail = String(result?.email || nickname).trim();
                        if (verificationEmail) {
                            setVerificationResendState(true, verificationEmail);
                        } else {
                            setVerificationResendState(false);
                        }
                    } else {
                        setVerificationResendState(false);
                    }
                    console.error('Erro:', result.message);
                    setSubmitLoading(false);
                }
            } catch (error) {
                console.error('Erro na requisieeo:', error);
                formError.textContent = 'Erro ao conectar ao servidor';
                setVerificationResendState(false);
                setSubmitLoading(false);
            }
        });
    }
    
    console.log('=== SCRIPT PRONTO ===');
});

// Função global para reenviar código (chamada pelo onclick no HTML)
async function resendVerificationCode() {
    const now = Date.now();
    const verifyError = document.getElementById('verifyError');
    const resendBtn = document.getElementById('resendBtn');
    const pendingEmail = localStorage.getItem('pendingVerificationEmail') || '';
    const lastResendTimeFromStorage = parseInt(localStorage.getItem('lastVerificationResend') || '0', 10);

    if (resendInFlight) return;

    if (now - lastResendTimeFromStorage < RESEND_COOLDOWN) {
        const waitTime = Math.ceil((RESEND_COOLDOWN - (now - lastResendTimeFromStorage)) / 1000);
        if (verifyError) {
            verifyError.textContent = `Aguarde ${waitTime}s antes de reenviar`;
            verifyError.style.color = '#FF9800';
        }
        return;
    }

    if (!pendingEmail) {
        if (verifyError) verifyError.textContent = 'Email não encontrado';
        return;
    }

    resendInFlight = true;
    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.style.opacity = '0.6';
        resendBtn.textContent = 'Reenviando...';
    }
    if (verifyError) {
        verifyError.textContent = 'Enviando novo código...';
        verifyError.style.color = '#FBBF24';
    }

    try {
        const result = await AuthAPI.resendVerification(pendingEmail);

        if (result.success) {
            localStorage.setItem('lastVerificationResend', now.toString());
            if (verifyError) {
                verifyError.textContent = 'Novo código enviado!';
                verifyError.style.color = '#00FF00';
            }
            document.getElementById('verificationCode').value = '';
            document.getElementById('verificationCode').focus();
            startResendCooldown(resendBtn);
            restartVerificationTimer();
        } else {
            if (verifyError) {
                verifyError.textContent = '❌ ' + (result.message || 'Erro ao reenviar');
                verifyError.style.color = '#FF6B6B';
            }
            if (resendBtn) {
                resendBtn.disabled = false;
                resendBtn.style.opacity = '1';
                resendBtn.textContent = 'Reenviar Código';
            }
        }
    } catch (error) {
        console.error('Erro ao reenviar verificação:', error);
        if (verifyError) {
            verifyError.textContent = 'Erro ao reenviar código';
            verifyError.style.color = '#FF6B6B';
        }
        if (resendBtn) {
            resendBtn.disabled = false;
            resendBtn.style.opacity = '1';
            resendBtn.textContent = 'Reenviar Código';
        }
    } finally {
        resendInFlight = false;
    }
}

function startResendCooldown(button) {
    if (!button) return;

    clearInterval(resendCooldownTimer);
    let secondsLeft = Math.ceil(RESEND_COOLDOWN / 1000);

    const updateLabel = () => {
        button.disabled = true;
        button.style.opacity = '0.65';
        button.textContent = `Reenviar em ${secondsLeft}s`;
    };

    updateLabel();
    resendCooldownTimer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
            clearInterval(resendCooldownTimer);
            resendCooldownTimer = null;
            button.disabled = false;
            button.style.opacity = '1';
            button.textContent = 'Reenviar Código';
            return;
        }
        updateLabel();
    }, 1000);
}

function restartVerificationTimer() {
    const timerEl = document.getElementById('verificationTimer');
    if (!timerEl) return;

    let timeLeft = 600;
    const updateTimer = () => {
        const min = Math.floor(timeLeft / 60);
        const sec = timeLeft % 60;
        timerEl.textContent = `Válido por ${min}:${sec.toString().padStart(2, '0')}`;
    };

    updateTimer();
    if (window.verificationTimer) clearInterval(window.verificationTimer);
    window.verificationTimer = setInterval(() => {
        timeLeft -= 1;
        updateTimer();
        if (timeLeft <= 0) {
            clearInterval(window.verificationTimer);
        }
    }, 1000);
}
