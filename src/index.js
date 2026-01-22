const fs = require('fs');
const path = require('path');
const { extractJpegFromBmt } = require('./bmtExtractImage');
const { generateReport } = require('./reportGenerator');

const INPUT_DIR = String.raw`D:\TOOL GOOGLE ANTIGRAVITY\5. Tool Testo\1. Database\Image Site\KHO\1637\Testo Images`;
const OUTPUT_DIR = String.raw`D:\TOOL GOOGLE ANTIGRAVITY\5. Tool Testo\output`;
const REPORT_FILE = path.join(OUTPUT_DIR, 'Testo_Report.xlsx');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function main() {
    console.log("Starting Testo Report Tool...");

    if (!fs.existsSync(INPUT_DIR)) {
        console.error(`Input directory not found: ${INPUT_DIR}`);
        return;
    }

    const files = fs.readdirSync(INPUT_DIR).filter(f => f.toLowerCase().endsWith('.bmt'));

    if (files.length === 0) {
        console.log("No .BMT files found in input directory.");
        return;
    }

    console.log(`Found ${files.length} BMT files.`);

    const reportData = [];

    for (const file of files) {
        const fullPath = path.join(INPUT_DIR, file);
        const imageName = path.parse(file).name;
        const extractedImagePath = path.join(OUTPUT_DIR, `${imageName}.jpg`);

        // 1. Extract Image
        const success = extractJpegFromBmt(fullPath, extractedImagePath);

        if (success) {
            // 2. Prepare Data (Placeholder for now until we can parse BMT metadata)
            const fileStats = fs.statSync(fullPath);
            const date = fileStats.mtime.toISOString().split('T')[0]; // Use file modification time as fallback

            reportData.push({
                name: imageName,
                imagePath: extractedImagePath,
                date: date,
                maxTemp: "N/A", // Placeholder
                minTemp: "N/A"  // Placeholder
            });
        }
    }

    // 3. Generate Report
    if (reportData.length > 0) {
        console.log("Generating Excel Report...");
        await generateReport(reportData, REPORT_FILE);
        console.log("Done!");
    } else {
        console.log("No data to report.");
    }
}

main();
