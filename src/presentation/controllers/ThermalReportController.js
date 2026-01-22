const fs = require('fs');
const path = require('path');
const os = require('os');

class ThermalReportController {
    constructor(generateThermalReportUseCase) {
        this.generateThermalReportUseCase = generateThermalReportUseCase;
    }

    async handleUpload(req, res) {
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No files uploaded.');
        }

        const tempDir = path.join(os.tmpdir(), 'testo_processing');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        try {
            // remarks will be an array corresponding to files, or undefined
            // Multer text fields come in req.body. If multiple inputs have same name 'remarks', it's an array.
            let remarks = req.body.remarks || [];
            if (!Array.isArray(remarks)) remarks = [remarks];

            let conclusions = req.body.conclusions || [];
            if (!Array.isArray(conclusions)) conclusions = [conclusions];

            let recommendations = req.body.recommendations || [];
            if (!Array.isArray(recommendations)) recommendations = [recommendations];

            const reportTitle = req.body.reportTitle || "BÁO CÁO KẾT QUẢ KIỂM TRA NHIỆT";
            const deviceType = req.body.deviceType || "solar_panel";
            const result = await this.generateThermalReportUseCase.execute(req.files, remarks, conclusions, recommendations, tempDir, reportTitle, deviceType);

            res.download(result.reportPath, 'Testo_Thermal_Report.pdf', (err) => {
                if (err) console.error("Error sending file:", err);

                try {
                    result.cleanup();
                } catch (cleanupErr) {
                    console.error("Cleanup error:", cleanupErr);
                }
            });

        } catch (error) {
            console.error("Controller Error:", error);
            // Send detailed error to client for debugging
            res.status(500).send(`Error generating report: ${error.message}\n\nStack: ${error.stack}`);
        }
    }
}

module.exports = ThermalReportController;
