let preferredVoice = null;
let voicesLoaded = false;

const findVoice = () => {
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    voicesLoaded = true;
    const idVoices = voices.filter(v => v.lang.startsWith('id'));
    const microsoftId = idVoices.find(v => v.name.toLowerCase().includes('microsoft'));
    const googleId = idVoices.find(v => v.name.toLowerCase().includes('google'));
    return microsoftId || googleId || idVoices[0] || null;
  } catch {
    return null;
  }
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    preferredVoice = findVoice();
  };
}

const getVoice = () => {
  if (!voicesLoaded) preferredVoice = findVoice();
  return preferredVoice;
};

export const speak = (text) => {
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.1;
      utterance.pitch = 0.95;
      utterance.volume = 1;
      const voice = getVoice();
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
      return true;
    }
  } catch {}
  return false;
};

export const speakWithFallback = async (text) => {
  if (speak(text)) return;
  try {
    const url = `/api/tts?text=${encodeURIComponent(text)}`;
    const audio = new Audio(url);
    audio.volume = 1;
    await audio.play();
  } catch {}
};
