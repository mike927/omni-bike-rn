// Sends the same broadcasts as Metro's `r` and `m` keys, so agents can drive Metro without its TTY.
const port = process.env.RCT_METRO_PORT ?? '8081';
const methods = { reload: 'reload', menu: 'devMenu' };
const command = process.argv[2];
const method = methods[command];

if (!method) {
  console.error(`Usage: node scripts/metro.mjs <${Object.keys(methods).join('|')}>`);
  process.exit(1);
}

const socket = new WebSocket(`ws://localhost:${port}/message`);
const timeout = setTimeout(() => {
  console.error(`Metro did not answer on :${port}`);
  process.exit(1);
}, 3000);

socket.addEventListener('open', () => {
  clearTimeout(timeout);
  socket.send(JSON.stringify({ version: 2, method }));
  process.stdout.write(`Sent ${method} to apps connected to Metro on :${port}\n`);
  socket.close();
});

socket.addEventListener('error', () => {
  clearTimeout(timeout);
  console.error(`Metro is not reachable on :${port}`);
  process.exit(1);
});
