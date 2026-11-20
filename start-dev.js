const { spawn } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');
const frontendDir = path.join(__dirname, 'frontend');

console.log('Starting Aurélie full-stack environment...');
console.log('1. Starting Backend API on http://localhost:4000');
const backend = spawn('npm.cmd', ['start'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true,
});

console.log('2. Starting Frontend Dev Server on http://localhost:5173');
const frontend = spawn('npm.cmd', ['run', 'dev', '--', '--host'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true,
});

const cleanup = () => {
  console.log('\nShutting down dev servers...');
  try { backend.kill(); } catch (e) {}
  try { frontend.kill(); } catch (e) {}
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

backend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Backend process exited with code ${code}`);
  }
});

frontend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Frontend process exited with code ${code}`);
  }
});
