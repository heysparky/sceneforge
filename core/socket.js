const CHANNEL = 'module.sceneforge';

export function initSocket() {
  game.socket.on(CHANNEL, msg => {
    if (game.user.isGM) handleGM(msg).catch(console.error);
    else handlePlayer(msg);
  });
}

export function emit(msg) {
  game.socket.emit(CHANNEL, msg);
}

async function handleGM({ action, sceneId, senderId, payload }) {
  // handle player requests here
}

function handlePlayer({ action, payload }) {
  // handle GM broadcasts here
}
