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