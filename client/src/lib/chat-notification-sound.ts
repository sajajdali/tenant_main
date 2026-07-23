let audioContextRef: AudioContext | null = null;
let lastPlayAt = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!audioContextRef) {
    audioContextRef = new AudioContextClass();
  }

  return audioContextRef;
}

export async function playChatNotificationSound() {
  const now = Date.now();

  if (now - lastPlayAt < 700) {
    return;
  }

  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  const startedAt = context.currentTime;
  const gainNode = context.createGain();
  const oscillator = context.createOscillator();
  const harmonic = context.createOscillator();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(920, startedAt);
  oscillator.frequency.exponentialRampToValueAtTime(760, startedAt + 0.18);

  harmonic.type = "triangle";
  harmonic.frequency.setValueAtTime(1380, startedAt);
  harmonic.frequency.exponentialRampToValueAtTime(1120, startedAt + 0.16);

  gainNode.gain.setValueAtTime(0.0001, startedAt);
  gainNode.gain.exponentialRampToValueAtTime(0.08, startedAt + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.24);

  oscillator.connect(gainNode);
  harmonic.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startedAt);
  harmonic.start(startedAt);
  oscillator.stop(startedAt + 0.24);
  harmonic.stop(startedAt + 0.2);

  lastPlayAt = now;
}
