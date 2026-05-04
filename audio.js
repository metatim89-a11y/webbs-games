/**
 * Audio Engine (Procedural Web Audio API)
 * Generates low-latency sound effects to fix audio latency and missing assets.
 */

const AudioEngine = {
    ctx: null,
    enabled: true,
    
    // Default settings for the click sound
    settings: JSON.parse(localStorage.getItem('webbs_audio_settings')) || {
        click: { freq: 600, type: 'sine', duration: 0.1, vol: 0.1 }
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
        this.playTone(400, 'triangle', 0.15, 0.1);
        setTimeout(() => this.playTone(600, 'triangle', 0.15, 0.1), 50);
    },

    playWin() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'square', 0.3, 0.1), i * 150);
        });
    },

    playError() {
        this.playTone(200, 'sawtooth', 0.3, 0.1);
        setTimeout(() => this.playTone(150, 'sawtooth', 0.4, 0.1), 150);
    }
};

// Global click listener to initialize audio and play click sound on buttons
document.addEventListener('click', (e) => {
    AudioEngine.init();
    if (e.target.tagName === 'BUTTON' || e.target.classList.contains('cell') || e.target.classList.contains('player-card')) {
        AudioEngine.playClick();
    }
});
