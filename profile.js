/**
 * ProfileManager handles player statistics, game history, and personal preferences.
 */
const ProfileManager = {
    // Save a game result
    recordResult(gameName, playerID, opponentID, result) {
        // result: 'win', 'loss', or 'draw'
        const history = JSON.parse(localStorage.getItem(`history_${playerID}`)) || [];
        const entry = {
            game: gameName,
            opponent: opponentID,
            result: result,
            timestamp: new Date().toLocaleString(),
            rawTime: new Date().getTime()
        };
        history.push(entry);
        localStorage.setItem(`history_${playerID}`, JSON.stringify(history));
        console.log(`Recorded ${result} for ${playerID} in ${gameName}`);
    },

    // Get stats for a player
    getStats(playerID) {
        const history = JSON.parse(localStorage.getItem(`history_${playerID}`)) || [];
        const stats = {
            total: history.length,
            wins: history.filter(h => h.result === 'win').length,
            losses: history.filter(h => h.result === 'loss').length,
            draws: history.filter(h => h.result === 'draw').length,
            history: [...history].reverse().slice(0, 10) // Last 10 games
        };
        stats.winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : 0;
        return stats;
    },

    // Save/Get personal preferences
    savePreferences(playerID, prefs) {
        // prefs: { favoriteAnimal, favoriteColor, favoriteGame }
        localStorage.setItem(`prefs_${playerID}`, JSON.stringify(prefs));
    },

    getPreferences(playerID) {
        const defaultPrefs = {
            favoriteAnimal: "None set",
            favoriteColor: "#ffffff",
            favoriteGame: "None set",
            allColors: []
        };
        return JSON.parse(localStorage.getItem(`prefs_${playerID}`)) || defaultPrefs;
    },

    resolveName(id) {
        if (!id) return "Unknown";
        if (id === 'cpu') return "Computer";
        if (id === 'guest') return "Guest";
        
        const defaults = { tim: 'Tim', arieal: 'Arieal', az: 'AZ', cassie: 'Cassie' };
        if (defaults[id]) return defaults[id];
        
        const approved = JSON.parse(localStorage.getItem('webbs_approved_players')) || [];
        const player = approved.find(p => p.id === id);
        return player ? player.name : id.charAt(0).toUpperCase() + id.slice(1);
    }
};

// Bug #2 Fix: Preload background and icon assets to prevent flickering on mobile
(function preloadAssets() {
    const isGameDir = window.location.pathname.includes('/games/');
    const basePath = isGameDir ? '../../' : '';
    const assets = [
        'assets/backgrounds/axolotl-pattern.svg',
        'assets/backgrounds/duck-pattern.svg',
        'assets/backgrounds/horse-pattern.svg',
        'assets/backgrounds/platypus-pattern.svg',
        'assets/icons/settings.svg'
    ];
    assets.forEach(src => {
        const img = new Image();
        img.src = basePath + src;
    });
})();
