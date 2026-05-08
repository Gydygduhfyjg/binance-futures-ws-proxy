import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 3000;

const wss = new WebSocketServer({
  port: PORT
});

console.log(`[PROXY] Binance Futures WS Proxy Running on ${PORT}`);

wss.on('connection', (client, req) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const stream = url.searchParams.get('stream');

    if (!stream) {
      client.close();
      return;
    }

    const target = `wss://fstream.binance.com/ws/${stream.toLowerCase()}`;

    console.log(`[PROXY] CONNECT ${target}`);

    const binanceWS = new WebSocket(target);

    let isAlive = true;

    binanceWS.on('open', () => {
      console.log(`[BINANCE] OPEN ${stream}`);
    });

    binanceWS.on('message', (data) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data.toString());
      }
    });

    binanceWS.on('ping', () => {
      try {
        binanceWS.pong();
      } catch {}
    });

    binanceWS.on('close', (code, reason) => {
      console.log(`[BINANCE] CLOSED ${code} ${reason}`);
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    binanceWS.on('error', (err) => {
      console.error('[BINANCE ERROR]', err.message);
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    client.on('message', (msg) => {
      if (binanceWS.readyState === WebSocket.OPEN) {
        binanceWS.send(msg.toString());
      }
    });

    client.on('close', () => {
      console.log('[CLIENT] CLOSED');
      binanceWS.close();
    });

    client.on('error', () => {
      binanceWS.close();
    });

    const heartbeat = setInterval(() => {
      if (!isAlive) {
        clearInterval(heartbeat);
        binanceWS.terminate();
        client.terminate();
        return;
      }

      isAlive = false;

      try {
        client.ping();
      } catch {}
    }, 30000);

    client.on('pong', () => {
      isAlive = true;
    });

  } catch (err) {
    console.error('[PROXY ERROR]', err);
    client.close();
  }
});
