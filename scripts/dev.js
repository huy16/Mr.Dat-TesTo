const { spawn, exec } = require('child_process');

const PORT = process.env.PORT || 3001;
const URL = `http://localhost:${PORT}`;

console.log(`Starting development server...`);

// Start the server with node --watch
const serverProcess = spawn('node', ['--watch', 'src/server.js'], {
    stdio: 'pipe',
    shell: true
});

let browserOpened = false;

serverProcess.stdout.on('data', (data) => {
    process.stdout.write(data);

    // Check if server is ready
    if (!browserOpened && data.toString().includes(`http://localhost:${PORT}`)) {
        browserOpened = true;
        console.log(`Opening browser at ${URL}`);
        if (process.platform === 'win32') {
            exec(`start ${URL}`);
        } else if (process.platform === 'darwin') {
            exec(`open ${URL}`);
        } else {
            exec(`xdg-open ${URL}`);
        }
    }
});

serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
});

serverProcess.on('exit', (code) => {
    process.exit(code || 0);
});
