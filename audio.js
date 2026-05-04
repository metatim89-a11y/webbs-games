/**
 * Audio Engine (Procedural Web Audio API)
 * Generates low-latency sound effects to fix audio latency and missing assets.
 */

const AudioEngine = {
    ctx: null,
    enabled: true,
    
    // Default settings for various game sounds
    settings: JSON.parse(localStorage.getItem('webbs_audio_settings')) || {
        click: { freq: 600, type: 'sine', duration: 0.1, vol: 0.1 },
        move: { freq: 400, type: 'triangle', duration: 0.15, vol: 0.1 },
        win: { freq: 523, type: 'square', duration: 0.3, vol: 0.1 },
        error: { freq: 200, type: 'sawtooth', duration: 0.3, vol: 0.1 }
    },

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
    },

    saveSettings() {
        localStorage.setItem('webbs_audio_settings', JSON.stringify(this.settings));
    },

    playTone(frequency, type, duration, vol = 0.1) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playClick() {
        const s = this.settings.click;
        this.playTone(s.freq, s.type, s.duration, s.vol);
    },

    playMove() {
        const s = this.settings.move || { freq: 400, type: 'triangle', duration: 0.15, vol: 0.1 };
        this.playTone(s.freq, s.type, s.duration, s.vol);
        setTimeout(() => this.playTone(s.freq * 1.5, s.type, s.duration, s.vol), 50);
    },

    playWin() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        
        const s = this.settings.win || { freq: 523, type: 'square', duration: 0.3, vol: 0.1 };
        // Generate a major arpeggio based on the root frequency
        [1, 1.25, 1.5, 2].forEach((ratio, i) => {
            setTimeout(() => this.playTone(s.freq * ratio, s.type, s.duration, s.vol), i * 150);
        });
    },

    playError() {
        const s = this.settings.error || { freq: 200, type: 'sawtooth', duration: 0.3, vol: 0.1 };
        this.playTone(s.freq, s.type, s.duration, s.vol);
        setTimeout(() => this.playTone(s.freq * 0.75, s.type, s.duration * 1.3, s.vol), 150);
    }
};

// Global click listener to initialize audio and play click sound on buttons
document.addEventListener('click', (e) => {
    AudioEngine.init();
    if (e.target.tagName === 'BUTTON' || e.target.classList.contains('cell') || e.target.classList.contains('player-card')) {
        AudioEngine.playClick();
    }
});
