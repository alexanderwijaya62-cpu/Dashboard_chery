const WA_BASE_URL = import.meta.env.VITE_WA_API_URL || 'http://localhost:3000';
const WA_KEY = import.meta.env.VITE_WA_KEY;
const WA_INSTANCE = import.meta.env.VITE_WA_INSTANCE || 'default';

async function sendMessage(payload) {
  const res = await fetch(`${WA_BASE_URL}/api/send-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: WA_KEY,
      instanceId: WA_INSTANCE,
      ...payload,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WA API error (${res.status}): ${err}`);
  }
  return res.json();
}

export function sendText(number, message, instanceId) {
  return sendMessage({ instanceId: instanceId || WA_INSTANCE, number, message });
}

export function sendImage(number, message, image, instanceId) {
  return sendMessage({ instanceId: instanceId || WA_INSTANCE, number, message, image });
}

export function sendDocument(number, message, document, fileName, instanceId) {
  return sendMessage({ instanceId: instanceId || WA_INSTANCE, number, message, document, fileName });
}

export { WA_BASE_URL, WA_KEY, WA_INSTANCE };
