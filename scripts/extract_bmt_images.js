/**
 * Extract JPEG images from BMT files for viewing
 * Usage: node scripts/extract_bmt_images.js <input_folder_or_file> [output_folder]
 * 
 * Examples:
 *   node scripts/extract_bmt_images.js "Database/BMT_Files"
 *   node scripts/extract_bmt_images.js "Database/BMT_Files/IR001366.BMT"
 *   node scripts/extract_bmt_images.js "Database/PV" "output/PV_images"
 */
const fs = require('fs');
const path = require('path');
const { parseBmt } = require('../src/bmtParser');

const input = process.argv[2];
const outputDir = process.argv[3] || path.join(__dirname, '../extracted_images');

if (!input) {
    console.log('Usage: node scripts/extract_bmt_images.js <input_folder_or_file> [output_folder]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/extract_bmt_images.js "1. Database"');
    console.log('  node scripts/extract_bmt_images.js "1. Database/IR001366.BMT"');
    process.exit(1);
}

const inputPath = path.resolve(input);

if (!fs.existsSync(inputPath)) {
    console.error(`Error: Path not found: ${inputPath}`);
    process.exit(1);
}

// Create output directory
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Collect BMT files
let bmtFiles = [];
if (fs.statSync(inputPath).isDirectory()) {
    const files = fs.readdirSync(inputPath);
    bmtFiles = files
        .filter(f => f.toLowerCase().endsWith('.bmt'))
        .map(f => path.join(inputPath, f));
} else {
    bmtFiles = [inputPath];
}

if (bmtFiles.length === 0) {
    console.log('No .BMT files found.');
    process.exit(0);
}

console.log(`Found ${bmtFiles.length} BMT file(s). Extracting images...\n`);

bmtFiles.forEach((filePath, index) => {
    const filename = path.basename(filePath, path.extname(filePath));
    const outputImagePath = path.join(outputDir, `${filename}.jpg`);

    const result = parseBmt(filePath, outputImagePath);

    if (result.success) {
        const m = result.metadata;
        console.log(`[${index + 1}/${bmtFiles.length}] ${filename}.BMT`);
        console.log(`   Thermal: ${outputImagePath}`);
        if (fs.existsSync(outputImagePath.replace('.jpg', '_real.jpg'))) {
            console.log(`   Real:    ${outputImagePath.replace('.jpg', '_real.jpg')}`);
        }
        console.log(`   Max: ${m.tempMax?.toFixed(1)}°C | Min: ${m.tempMin?.toFixed(1)}°C | Range: ${(m.tempMax - m.tempMin)?.toFixed(1)}°C | Emissivity: ${m.emissivity}`);
        console.log('');
    } else {
        console.log(`[${index + 1}/${bmtFiles.length}] ${filename}.BMT - FAILED: ${result.error}`);
    }
});

console.log(`\nDone! Images saved to: ${path.resolve(outputDir)}`);
console.log('Open the folder to view the extracted thermal images.');
