import { WA_BASE_URL, WA_INSTANCE } from './waClient';

export function createSocketListener(instanceId, handlers) {
  const { onMessage, onConnect, onDisconnect, onError } = handlers || {};
  let socket = null;

  async function init() {
    try {
      const { io } = await import('socket.io-client');
      socket = io(WA_BASE_URL, {
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        if (onConnect) onConnect();
      });

      socket.on('disconnect', (reason) => {
        if (onDisconnect) onDisconnect(reason);
      });

      socket.on('connect_error', (err) => {
        if (onError) onError(err);
      });

      const eventName = `message:${instanceId || WA_INSTANCE}`;
      socket.on(eventName, (data) => {
        if (onMessage) onMessage(data);
      });
    } catch (err) {
      console.warn('WA Socket: socket.io-client not available', err);
    }
  }

  init();

  return {
    disconnect() {
      if (socket) socket.disconnect();
    },
  };
}
