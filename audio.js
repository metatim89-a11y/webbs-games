/**
 * Audio Engine (Procedural Web Audio API)
 * Generates low-latency sound effects to fix audio latency and missing assets.
 */

const AudioEngine = {
    ctx: null,
    enabled: true,
    
    // Default settings for various game sounds
    defaults: {
        click: { freq: 600, type: 'sine', duration: 0.1, vol: 0.1 },
        move: { freq: 400, type: 'triangle', duration: 0.15, vol: 0.1 },
        win: { freq: 523, type: 'square', duration: 0.3, vol: 0.1 },
        error: { freq: 200, type: 'sawtooth', duration: 0.3, vol: 0.1 }
    },
    settings: {},

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        
        // Robust settings loading with defaults fallback
        const saved = JSON.parse(localStorage.getItem('webbs_audio_settings')) || {};
        this.settings = {
            click: { ...this.defaults.click, ...(saved.click || {}) },
            move: { ...this.defaults.move, ...(saved.move || {}) },
            win: { ...this.defaults.win, ...(saved.win || {}) },
            error: { ...this.defaults.error, ...(saved.error || {}) }
        };
    },

    saveSettings() {
        localStorage.setItem('webbs_audio_settings', JSON.stringify(this.settings));
    },

    playTone(frequency, type, duration, vol = 0.1) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(frequency || 440, this.ctx.currentTime);
            
            gain.gain.setValueAtTime(vol || 0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + (duration || 0.1));

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + (duration || 0.1));
        } catch (e) {
            console.warn("AudioEngine error:", e);
        }
    },

    playClick() {
        const s = this.settings.click || this.defaults.click;
        this.playTone(s.freq, s.type, s.duration, s.vol);
    },

    playMove() {
        const s = this.settings.move || this.defaults.move;
        this.playTone(s.freq, s.type, s.duration, s.vol);
        setTimeout(() => this.playTone(s.freq * 1.5, s.type, s.duration, s.vol), 50);
    },

    playWin() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        
        const s = this.settings.win || this.defaults.win;
        [1, 1.25, 1.5, 2].forEach((ratio, i) => {
            setTimeout(() => this.playTone(s.freq * ratio, s.type, s.duration, s.vol), i * 150);
        });
    },

    playError() {
        const s = this.settings.error || this.defaults.error;
        this.playTone(s.freq, s.type, s.duration, s.vol);
        setTimeout(() => this.playTone(s.freq * 0.75, s.type, s.duration * 1.3, s.vol), 150);
    }
};

// Auto-init settings on load
AudioEngine.init();

// Global click listener to initialize audio and play click sound on buttons
document.addEventListener('click', (e) => {
    AudioEngine.init();
    
    // Safety check for closest() and ignore data-no-sound
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    
    if (target.closest('[data-no-sound]')) return;
    
    // Trigger on buttons or specific classes
    if (target.closest('button') || target.closest('.cell') || target.closest('.player-card')) {
        AudioEngine.playClick();
    }
});
