const fs = require('fs');
const path = require('path');
const { parseBmt } = require('../src/bmtParser');

const bmtBaseDir = path.join(__dirname, '../1. Database/Testo/BMT');

const sites = fs.readdirSync(bmtBaseDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

console.log("=== CROSS-SITE STATISTICAL ANALYSIS ===\n");

const siteStats = [];

sites.forEach(site => {
    const siteDir = path.join(bmtBaseDir, site);
    const files = fs.readdirSync(siteDir).filter(f => f.toLowerCase().endsWith('.bmt'));

    if (files.length === 0) return;

    let totalMax = 0;
    let totalRange = 0;
    let validCount = 0;

    let maxTempInSite = -999;
    let maxRangeInSite = -999;

    files.forEach(file => {
        try {
            const bmtPath = path.join(siteDir, file);
            const parsed = parseBmt(bmtPath, null);
            if (parsed.success && parsed.metadata) {
                const max = parsed.metadata.tempMax;
                const range = parsed.metadata.tempMax - parsed.metadata.tempMin;

                totalMax += max;
                totalRange += range;
                validCount++;

                if (max > maxTempInSite) maxTempInSite = max;
                if (range > maxRangeInSite) maxRangeInSite = range;
            }
        } catch (e) { }
    });

    if (validCount > 0) {
        siteStats.push({
            site: site,
            count: validCount,
            avgMax: totalMax / validCount,
            avgRange: totalRange / validCount,
            maxTemp: maxTempInSite,
            maxRange: maxRangeInSite
        });
    }
});

// Sort by avgMax
siteStats.sort((a, b) => b.avgMax - a.avgMax);

console.table(siteStats);

console.log("\nPotential Classification (Based on Testo Patterns):");
console.log("- CABLE/HOTSPOTS: High avg max temp (>45°C), high max temp outliers");
console.log("- PV PANELS: Medium-high avg max temp (35-45°C), high temp range due to sky reflection");
console.log("- CABINET/INDOOR: Lower avg max temp (<35°C), low temp range");
