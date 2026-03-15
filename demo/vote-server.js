const http = require('http');
const os = require('os');
const { URL } = require('url');
const WebSocket = require('ws');

const PORT = Number(process.env.VOTE_PORT || 8787);
const LOCAL_IP = detectLocalIp();
const ACTIVE_WINDOW_MS = 30000;
const sessions = new Map();

function detectLocalIp() {
  const interfaces = os.networkInterfaces();
  const preferredPrefixes = ['192.168.', '10.', '172.'];
  let fallback = '';

  Object.keys(interfaces).forEach(function scanInterface(name) {
    (interfaces[name] || []).forEach(function scanAddress(address) {
      if (!address || address.family !== 'IPv4' || address.internal) {
        return;
      }

      if (!fallback) {
        fallback = address.address;
      }

      if (preferredPrefixes.some(function hasPrefix(prefix) { return address.address.indexOf(prefix) === 0; })) {
        fallback = address.address;
      }
    });
  });

  return fallback;
}

function createVoteCounts(choiceCounts) {
  return (choiceCounts || []).map(function makeStage(choiceCount) {
    return Array.from({ length: choiceCount }, function makeChoice() {
      return 0;
    });
  });
}

function normalizeIndex(value) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : null;
}

function touchHttpClient(session, clientId, role) {
  if (!clientId) {
    return;
  }

  session.httpClients.set(clientId, {
    role: role === 'audience' ? 'audience' : 'host',
    lastSeen: Date.now(),
  });
}

function ensureSession(sessionId, choiceCounts, stageIndex) {
  let session = sessions.get(sessionId);

  if (!session) {
    session = {
      stageIndex: typeof stageIndex === 'number' ? stageIndex : 0,
      choiceCounts: choiceCounts || [],
      voteCounts: createVoteCounts(choiceCounts || []),
      votesByClient: new Map(),
      wsClients: new Map(),
      httpClients: new Map(),
    };
    sessions.set(sessionId, session);
    return session;
  }

  if (Array.isArray(choiceCounts) && choiceCounts.length) {
    const needsReset =
      !Array.isArray(session.choiceCounts) ||
      session.choiceCounts.length !== choiceCounts.length ||
      choiceCounts.some(function compare(count, index) {
        return session.choiceCounts[index] !== count;
      });

    if (needsReset) {
      session.choiceCounts = choiceCounts.slice();
      session.voteCounts = createVoteCounts(choiceCounts);
      session.votesByClient = new Map();
    }
  }

  if (typeof stageIndex === 'number') {
    session.stageIndex = stageIndex;
  }

  return session;
}

function clientVotes(session, clientId) {
  return session.votesByClient.get(clientId) || {};
}

function currentAudienceCount(session) {
  const activeAudience = new Set();

  session.wsClients.forEach(function collectWs(client) {
    if (client.role === 'audience') {
      activeAudience.add(client.clientId);
    }
  });

  session.httpClients.forEach(function collectHttp(client, clientId) {
    if (client.role === 'audience' && Date.now() - client.lastSeen < ACTIVE_WINDOW_MS) {
      activeAudience.add(clientId);
    }
  });

  return activeAudience.size;
}

function buildState(sessionId, clientId) {
  const session = sessions.get(sessionId) || ensureSession(sessionId, [], 0);

  return {
    type: 'state',
    sessionId,
    stageIndex: session.stageIndex,
    voteCounts: session.voteCounts,
    audienceCount: currentAudienceCount(session),
    localIp: LOCAL_IP,
    clientVotes: clientVotes(session, clientId),
  };
}

function broadcastState(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  session.wsClients.forEach(function sendToClient(client, socket) {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(buildState(sessionId, client.clientId)));
  });
}

function removeSocket(socket) {
  let emptySessionId = null;

  sessions.forEach(function cleanupSession(session, sessionId) {
    if (!session.wsClients.has(socket)) {
      return;
    }

    session.wsClients.delete(socket);

    if (session.wsClients.size === 0 && session.httpClients.size === 0) {
      emptySessionId = sessionId;
      return;
    }

    broadcastState(sessionId);
  });

  if (emptySessionId) {
    sessions.delete(emptySessionId);
  }
}

function processMessage(message, socket) {
  if (!message || !message.type || !message.sessionId) {
    return null;
  }

  if (message.type === 'join') {
    const session = ensureSession(message.sessionId, message.choiceCounts, normalizeIndex(message.stageIndex));

    if (socket) {
      session.wsClients.set(socket, {
        clientId: message.clientId || `client-${Date.now()}`,
        role: message.role === 'audience' ? 'audience' : 'host',
      });
    }

    touchHttpClient(session, message.clientId, message.role);
    broadcastState(message.sessionId);
    return buildState(message.sessionId, message.clientId);
  }

  const session = sessions.get(message.sessionId);
  if (!session) {
    return null;
  }

  touchHttpClient(session, message.clientId, message.role);

  if (message.type === 'host_sync') {
    ensureSession(message.sessionId, message.choiceCounts, normalizeIndex(message.stageIndex));
    broadcastState(message.sessionId);
    return buildState(message.sessionId, message.clientId);
  }

  if (message.type === 'reset_votes') {
    const stageIndex = normalizeIndex(message.stageIndex);
    if (stageIndex === null || !session.voteCounts[stageIndex]) {
      return null;
    }

    session.voteCounts[stageIndex] = session.voteCounts[stageIndex].map(function clearVote() {
      return 0;
    });

    session.votesByClient.forEach(function clearClientVotes(votes) {
      delete votes[stageIndex];
    });

    broadcastState(message.sessionId);
    return buildState(message.sessionId, message.clientId);
  }

  if (message.type === 'vote') {
    const stageIndex = normalizeIndex(message.stageIndex);
    const choiceIndex = normalizeIndex(message.choiceIndex);
    const clientId = message.clientId;

    if (
      !clientId ||
      stageIndex === null ||
      choiceIndex === null ||
      !session.voteCounts[stageIndex] ||
      session.voteCounts[stageIndex][choiceIndex] === undefined
    ) {
      return null;
    }

    const votes = clientVotes(session, clientId);
    const previousChoice = normalizeIndex(votes[stageIndex]);

    if (previousChoice !== null && previousChoice === choiceIndex) {
      return buildState(message.sessionId, clientId);
    }

    if (previousChoice !== null && session.voteCounts[stageIndex][previousChoice] > 0) {
      session.voteCounts[stageIndex][previousChoice] -= 1;
    }

    session.voteCounts[stageIndex][choiceIndex] += 1;
    votes[stageIndex] = choiceIndex;
    session.votesByClient.set(clientId, votes);
    broadcastState(message.sessionId);
    return buildState(message.sessionId, clientId);
  }

  return buildState(message.sessionId, message.clientId);
}

function readJsonBody(req) {
  return new Promise(function resolveRequest(resolve, reject) {
    const chunks = [];

    req.on('data', function collect(chunk) {
      chunks.push(chunk);
    });

    req.on('end', function onEnd() {
      if (!chunks.length) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function writeJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

const server = http.createServer(function handleRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

  if (req.method === 'OPTIONS') {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/health') {
    writeJson(res, 200, { ok: true, localIp: LOCAL_IP });
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/state') {
    const sessionId = requestUrl.searchParams.get('sessionId');
    const clientId = requestUrl.searchParams.get('clientId') || '';

    if (!sessionId) {
      writeJson(res, 400, { error: 'sessionId required' });
      return;
    }

    const session = sessions.get(sessionId);
    if (session) {
      touchHttpClient(session, clientId, 'audience');
    }

    writeJson(res, 200, buildState(sessionId, clientId));
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/message') {
    readJsonBody(req)
      .then(function onBody(message) {
        const state = processMessage(message, null);

        if (!state) {
          writeJson(res, 400, { error: 'invalid message' });
          return;
        }

        writeJson(res, 200, state);
      })
      .catch(function onError(error) {
        writeJson(res, 400, { error: error.message });
      });
    return;
  }

  writeJson(res, 404, { error: 'not found' });
});

const wss = new WebSocket.Server({ server });

wss.on('connection', function onConnection(socket) {
  socket.on('message', function onMessage(raw) {
    let message = null;

    try {
      message = JSON.parse(String(raw));
    } catch (error) {
      return;
    }

    processMessage(message, socket);
  });

  socket.on('close', function onClose() {
    removeSocket(socket);
  });
});

server.listen(PORT, '0.0.0.0', function onListen() {
  console.log(`[vote-server] listening on http://0.0.0.0:${PORT} · LAN ${LOCAL_IP || 'unavailable'}`);
});
