const fs = require('fs');
const path = require('path');
const { parseBmt } = require('../src/bmtParser');
const DeviceClassifier = require('../src/domain/services/DeviceClassifier');

const siteDir = path.join(__dirname, '../1. Database/Testo/JPEG/Site 271');
const bmtBaseDir = path.join(__dirname, '../1. Database/Testo/BMT/Site 271');

const categories = ['CABINET', 'CABLE', 'PV'];

console.log("=== AUTO-CLASSIFICATION EVALUATION: SITE 271 ===\n");

let totalFiles = 0;
let correctFiles = 0;

categories.forEach(trueCategory => {
    const catDir = path.join(siteDir, trueCategory);
    if (!fs.existsSync(catDir)) return;

    // Convert directory names to expected classifier labels
    const expectedLabel = trueCategory === 'CABINET' ? 'cabinet' : (trueCategory === 'CABLE' ? 'cable' : 'solar_panel');

    let catCorrect = 0;
    let catTotal = 0;

    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.jpg') && !f.includes('_real'));

    console.log(`\n--- Evaluating ${files.length} images grouped in ${trueCategory} ---`);

    files.forEach(file => {
        const baseName = path.basename(file, '.jpg');
        const bmtPath = path.join(bmtBaseDir, `${baseName}.BMT`);

        if (fs.existsSync(bmtPath)) {
            catTotal++;
            try {
                const parsed = parseBmt(bmtPath, null);
                if (parsed.success && parsed.metadata) {

                    // Force classifyByMetadata ONLY (ignore filename to test thermal logic)
                    const predictedType = DeviceClassifier.classifyByMetadata(parsed.metadata);

                    if (predictedType === expectedLabel) {
                        catCorrect++;
                    } else {
                        // Print failures for inspection
                        const { tempMax, tempMin } = parsed.metadata;
                        const range = tempMax - tempMin;
                        console.log(`❌ ${baseName} failed: Predicted [${predictedType}] | Max: ${tempMax.toFixed(1)} | Range: ${range.toFixed(1)}`);
                    }
                }
            } catch (e) {
                console.error(`Error parsing ${bmtPath}`, e.message);
            }
        }
    });

    console.log(`Accuracy for ${trueCategory}: ${catCorrect}/${catTotal} (${(catCorrect / catTotal * 100).toFixed(1)}%)`);
    totalFiles += catTotal;
    correctFiles += catCorrect;
});

console.log(`\n======================================`);
console.log(`OVERALL ACCURACY: ${correctFiles}/${totalFiles} (${(correctFiles / totalFiles * 100).toFixed(1)}%)`);
console.log(`======================================`);
