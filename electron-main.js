const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const logPath = path.join(process.cwd(), 'debug_log.txt');

function log(message) {
    try {
        fs.appendFileSync(logPath, `${new Date().toISOString()} - ${message}\n`);
    } catch (e) {
        // ignore
    }
}

log('App starting...');

let server;
try {
    log('Requiring server...');
    server = require('./src/server');
    log('Server required successfully.');
} catch (error) {
    log(`Failed to require server: ${error.stack}`);
    dialog.showErrorBox('Startup Error', `Failed to load server: ${error.message}`);
    process.exit(1);
}

let mainWindow;

function createWindow() {
    log('Creating window...');
    // Start the server
    try {
        server.start(0, (port) => {
            log(`Server started on port ${port}`);

            mainWindow = new BrowserWindow({
                width: 1280,
                height: 800,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                },
                icon: path.join(__dirname, 'public/assets/logo.png')
            });

            mainWindow.loadURL(`http://localhost:${port}`);

            mainWindow.on('closed', function () {
                mainWindow = null;
            });
        });
    } catch (err) {
        log(`Server start error: ${err.stack}`);
        dialog.showErrorBox('Server Error', `Failed to start server: ${err.message}`);
    }
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

process.on('uncaughtException', (error) => {
    log(`Uncaught Exception: ${error.stack}`);
    dialog.showErrorBox('Uncaught Exception', error.message);
});
