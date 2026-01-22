const fs = require('fs');
const path = require('path');

/**
 * Extract the first JPEG image from a BMT file (thermal image)
 */
function extractJpegFromBmt(bmtPath, outputPath) {
    try {
        const data = fs.readFileSync(bmtPath);

        // JPEG Magic Numbers: Start (FF D8), End (FF D9)
        const startMarker = Buffer.from([0xFF, 0xD8]);
        const endMarker = Buffer.from([0xFF, 0xD9]);

        const startIndex = data.indexOf(startMarker);
        if (startIndex === -1) {
            console.error(`No JPEG start marker found in ${bmtPath}`);
            return false;
        }

        // Search for end marker after startup
        let endIndex = data.indexOf(endMarker, startIndex);

        if (endIndex === -1) {
            console.error(`No JPEG end marker found in ${bmtPath}`);
            return false;
        }

        // Include the end marker (2 bytes)
        const jpegData = data.slice(startIndex, endIndex + 2);

        fs.writeFileSync(outputPath, jpegData);

        console.log(`Successfully extracted thermal image to ${outputPath}`);
        return true;

    } catch (e) {
        console.error(`Error processing ${bmtPath}: ${e.message}`);
        return false;
    }
}

/**
 * Extract ALL JPEG images from a BMT file
 * Returns an object with paths: { thermal: string, real: string | null }
 */
function extractAllJpegsFromBmt(bmtPath, outputDir) {
    try {
        const data = fs.readFileSync(bmtPath);
        const baseName = path.basename(bmtPath, path.extname(bmtPath));

        // JPEG Magic Numbers: Start (FF D8), End (FF D9)
        const startMarker = Buffer.from([0xFF, 0xD8]);
        const endMarker = Buffer.from([0xFF, 0xD9]);

        const results = {
            thermal: null,
            real: null
        };

        let searchStart = 0;
        let imageIndex = 0;

        while (searchStart < data.length) {
            const startIndex = data.indexOf(startMarker, searchStart);
            if (startIndex === -1) break;

            const endIndex = data.indexOf(endMarker, startIndex + 2);
            if (endIndex === -1) break;

            // Extract this JPEG
            const jpegData = data.slice(startIndex, endIndex + 2);

            if (imageIndex === 0) {
                // First image is thermal
                const thermalPath = path.join(outputDir, `${baseName}_thermal.jpg`);
                fs.writeFileSync(thermalPath, jpegData);
                results.thermal = thermalPath;
                console.log(`Extracted thermal image: ${thermalPath}`);
            } else if (imageIndex === 1) {
                // Second image is real/visible light
                const realPath = path.join(outputDir, `${baseName}_real.jpg`);
                fs.writeFileSync(realPath, jpegData);
                results.real = realPath;
                console.log(`Extracted real image: ${realPath}`);
            }

            imageIndex++;
            searchStart = endIndex + 2;

            // Most BMT files have only 2 images, stop after finding both
            if (imageIndex >= 2) break;
        }

        if (imageIndex === 0) {
            console.error(`No JPEG images found in ${bmtPath}`);
        } else {
            console.log(`Found ${imageIndex} image(s) in ${bmtPath}`);
        }

        return results;

    } catch (e) {
        console.error(`Error processing ${bmtPath}: ${e.message}`);
        return { thermal: null, real: null };
    }
}

// Test if run directly
if (require.main === module) {
    const testFile = String.raw`D:\TOOL GOOGLE ANTIGRAVITY\5. Tool Testo\1. Database\Image Site\KHO\1637\Testo Images\IR001366.BMT`;
    const outputDir = ".";

    if (fs.existsSync(testFile)) {
        const results = extractAllJpegsFromBmt(testFile, outputDir);
        console.log("Extraction results:", results);
    } else {
        console.error(`Test file not found: ${testFile}`);
    }
}

module.exports = { extractJpegFromBmt, extractAllJpegsFromBmt };
