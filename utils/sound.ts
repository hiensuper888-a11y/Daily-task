/**
 * Plays a pleasant "Success" chime using the Web Audio API.
 * This synthesizes sound on the fly, so no audio files are required.
 */
export const playSuccessSound = () => {
  // Support standard and webkit prefixed AudioContext
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const now = ctx.currentTime;

  // Create oscillators for a major chord (C Major: C, E, G)
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  
  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Stagger the start times slightly for a strumming effect
    const startTime = now + (index * 0.05);
    const duration = 0.8;

    osc.start(startTime);
    
    // Envelope: Attack -> Decay
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05); // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration); // Decay

    osc.stop(startTime + duration);
  });
};

/**
 * Plays a subtle "Notification" chime using the Web Audio API.
 */
export const playNotificationSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();
  const now = ctx.currentTime;

  // Master gain
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.4;
  masterGain.connect(ctx.destination);

  // First note (higher, shorter)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, now); // A5
  osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.1); // Slide up to A6
  
  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(1, now + 0.02);
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  
  osc1.connect(gain1);
  gain1.connect(masterGain);
  
  osc1.start(now);
  osc1.stop(now + 0.3);

  // Second note (lower, longer, slight delay)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1318.51, now + 0.1); // E6
  
  gain2.gain.setValueAtTime(0, now + 0.1);
  gain2.gain.linearRampToValueAtTime(0.8, now + 0.12);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
  
  osc2.connect(gain2);
  gain2.connect(masterGain);
  
  osc2.start(now + 0.1);
  osc2.stop(now + 0.6);
};