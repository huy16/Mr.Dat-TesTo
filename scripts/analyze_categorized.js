const fs = require('fs');
const path = require('path');
const { parseBmt } = require('../src/bmtParser');

const siteDir = path.join(__dirname, '../1. Database/Testo/JPEG/Site 271');
const bmtBaseDir = path.join(__dirname, '../1. Database/Testo/BMT/Site 271');

const categories = ['CABINET', 'CABLE', 'PV'];

const results = {};

categories.forEach(category => {
    const catDir = path.join(siteDir, category);
    if (!fs.existsSync(catDir)) return;

    results[category] = [];
    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.jpg') && !f.includes('_real'));

    files.forEach(file => {
        const baseName = path.basename(file, '.jpg');
        const bmtPath = path.join(bmtBaseDir, `${baseName}.BMT`);

        if (fs.existsSync(bmtPath)) {
            try {
                // Parse just to get metadata
                const parsed = parseBmt(bmtPath, null);
                if (parsed.success && parsed.metadata) {
                    results[category].push({
                        file: baseName,
                        tempMax: parsed.metadata.tempMax,
                        tempMin: parsed.metadata.tempMin,
                        range: parsed.metadata.tempMax - parsed.metadata.tempMin,
                        emissivity: parsed.metadata.emissivity
                    });
                }
            } catch (e) {
                console.error(`Error parsing ${bmtPath}`, e.message);
            }
        }
    });
});

// Analyze patterns
console.log("=== METADATA ANALYSIS FOR SITE 271 ===");

Object.keys(results).forEach(cat => {
    const data = results[cat];
    if (data.length === 0) return;

    const maxTemps = data.map(d => d.tempMax);
    const ranges = data.map(d => d.range);

    const avgMax = maxTemps.reduce((a, b) => a + b, 0) / maxTemps.length;
    const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;

    console.log(`\n\n--- Category: ${cat} (${data.length} files) ---`);
    console.log(`Avg Max Temp: ${avgMax.toFixed(2)} °C`);
    console.log(`Avg Temp Range: ${avgRange.toFixed(2)} °C`);

    console.log(`\nDetails [Top 5 by max temp]:`);
    data.sort((a, b) => b.tempMax - a.tempMax).slice(0, 5).forEach(d => {
        console.log(`  ${d.file} -> Max: ${d.tempMax.toFixed(1)}, Range: ${d.range.toFixed(1)}`);
    });

    console.log(`Details [Bottom 5 by max temp]:`);
    data.sort((a, b) => a.tempMax - b.tempMax).slice(0, 5).forEach(d => {
        console.log(`  ${d.file} -> Max: ${d.tempMax.toFixed(1)}, Range: ${d.range.toFixed(1)}`);
    });
});
