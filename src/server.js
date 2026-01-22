const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Clean Architecture Imports
// Infrastructure (Adapters)
const BmtFileRepository = require('./infrastructure/services/BmtFileRepository');
const PuppeteerReportService = require('./infrastructure/services/PuppeteerReportService');

// Application (Use Cases)
const GenerateThermalReport = require('./application/use_cases/GenerateThermalReport');

// Presentation (Controllers)
const ThermalReportController = require('./presentation/controllers/ThermalReportController');

// --- Composition Root ---
// 1. Initialize Repositories/Services
const bmtRepository = new BmtFileRepository();
const reportService = new PuppeteerReportService();

// 2. Initialize Use Cases (Dependency Injection)
const generateThermalReportUseCase = new GenerateThermalReport(bmtRepository, reportService);

// 3. Initialize Controllers
const thermalReportController = new ThermalReportController(generateThermalReportUseCase);

// --- Framework Setup ---
const app = express();
const PORT = process.env.PORT || 3001;
const os = require('os');

const uploadDir = path.join(os.tmpdir(), 'testo_uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

// Serve static files from 'public' directory
// dealing with path resolution in both dev and production (asar)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Route binding
app.post('/upload', upload.array('files'), (req, res) => {
    thermalReportController.handleUpload(req, res);
});

const start = (portParam, callback) => {
    const portToUse = portParam || PORT;
    const server = app.listen(portToUse, () => {
        const address = server.address();
        const port = address.port;
        console.log(`Server running at http://localhost:${port}`);
        console.log('CLEAN ARCHITECTURE ENABLED');
        if (callback) callback(port);
    });
    return server;
};

// Auto-start if run directly
if (require.main === module) {
    start();
}

module.exports = { app, start };
