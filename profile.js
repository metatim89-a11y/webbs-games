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
            favoriteGame: "None set"
        };
        return JSON.parse(localStorage.getItem(`prefs_${playerID}`)) || defaultPrefs;
    }
};
