(function() {
    const allowedModes = new Set(['normal', 'pause', 'off']);
    let currentMode = 'normal';
    let loadPromise = null;

    function applyMode(mode) {
        if (!allowedModes.has(mode)) {
            throw new TypeError('Modo de animação de perfil inválido');
        }
        currentMode = mode;
        document.documentElement.dataset.profileAnimationMode = mode;
        window.dispatchEvent(new CustomEvent('profile-animation-mode-change', {
            detail: { mode }
        }));
        return mode;
    }

    async function load() {
        if (loadPromise) return loadPromise;
        if (typeof AuthAPI === 'undefined' || !AuthAPI.getToken()) {
            return applyMode('normal');
        }

        loadPromise = (async () => {
            const result = await AuthAPI.getProfileAnimationSettings();
            if (!result?.success || !result.settings) {
                throw new Error(result?.message || 'Resposta inválida ao carregar a preferência de animações.');
            }
            return applyMode(result.settings.profileAnimationMode);
        })();

        return loadPromise;
    }

    function setMode(mode) {
        if (!allowedModes.has(mode)) {
            throw new TypeError('Modo de animação de perfil inválido');
        }
        return applyMode(mode);
    }

    window.ProfileAnimationPreferences = {
        getMode: () => currentMode,
        load,
        setMode
    };
})();
