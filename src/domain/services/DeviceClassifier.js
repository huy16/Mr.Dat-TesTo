/**
 * Auto-classifies device type from BMT filename + thermal metadata.
 * Strategy: filename keyword match (priority) → metadata analysis (fallback)
 * Categories: solar_panel, cable, cabinet
 */
class DeviceClassifier {

    static CATEGORIES = {
        solar_panel: {
            keywords: ['pv', 'panel', 'solar', 'module', 'string', 'cell'],
            label: '🔆 PV Panel',
            sortOrder: 1,
            thresholds: { warning: 45, critical: 65 }
        },
        cable: {
            keywords: ['cable', 'ac', 'dc', 'wire', 'connector', 'junction', 'cb', 'dây', 'cap'],
            label: '🔌 AC/DC Cable',
            sortOrder: 2,
            thresholds: { warning: 70, critical: 90 }
        },
        cabinet: {
            keywords: ['cabinet', 'inverter', 'combiner', 'box', 'mdb', 'db', 'acb', 'tủ', 'inv'],
            label: '🗄️ Cabinet / Inverter',
            sortOrder: 3,
            thresholds: { warning: 60, critical: 80 }
        },
        device: {
            keywords: ['device', 'thiết bị', 'other', 'khác'],
            label: '🔧 Thiết bị',
            sortOrder: 4,
            thresholds: { warning: 50, critical: 70 } // Generic middle-ground thresholds
        }
    };

    /**
     * Primary: classify by filename keywords
     * @param {string} filename
     * @returns {string|null} Device type or null if no keyword match
     */
    static _matchFilename(filename) {
        const lowerName = filename.toLowerCase().replace(/[_\-\.]/g, ' ');

        for (const [type, config] of Object.entries(DeviceClassifier.CATEGORIES)) {
            for (const keyword of config.keywords) {
                if (lowerName.includes(keyword)) {
                    return type;
                }
            }
        }
        return null; // No keyword match
    }

    /**
     * Fallback: classify by thermal metadata analysis
     * 
     * Heuristics based on empirical structure:
     * - PV Panel: medium max temp (~30-40°C or higher with reflection), medium range (~8-15°C)
     * - Cable/Connection: high max temp (>40°C), wide range (>10°C) with significant hot spots
     * - Cabinet/Indoor: lower max temp (<35°C), very narrow temp range (<8°C)
     * 
     * @param {object} metadata - { tempMax, tempMin, emissivity, histogram }
     * @returns {string} Device type
     */
    static classifyByMetadata(metadata) {
        const { tempMax, tempMin, emissivity, histogram } = metadata;

        const maxT = parseFloat(tempMax);
        const minT = parseFloat(tempMin);
        const tempRange = maxT - minT;
        const emis = parseFloat(emissivity) || 0.95;

        // Score-based classification
        let scores = { solar_panel: 0, cable: 0, cabinet: 0, device: 1 }; // Device gets base point as general fallback

        // --- Simplified Temperature Range Analysis ---
        if (tempRange > 15) {
            // Wide range → likely PV with sky reflection or hot cable
            if (maxT > 45) scores.cable += 2;
            else scores.solar_panel += 2;
        } else if (tempRange < 8) {
            // Narrow range → localized inside controlled environments 
            scores.cabinet += 2;
            if (maxT > 35) scores.cable += 1;
        } else {
            // Medium range
            scores.solar_panel += 1;
            scores.cabinet += 1;
        }

        // --- Simplified Max Temperature Analysis ---
        if (maxT >= 50) {
            scores.cable += 2;
        } else if (maxT < 35) {
            scores.cabinet += 1;
            scores.solar_panel += 1;
        }

        // --- Emissivity ---
        if (emis < 0.90) {
            scores.cable += 1;
        } else {
            scores.solar_panel += 1;
        }

        // --- Histogram Shape Analysis ---
        if (histogram && histogram.length > 0) {
            const totalBins = histogram.length;
            const maxBinValue = Math.max(...histogram);
            const avgBinValue = histogram.reduce((a, b) => a + b, 0) / totalBins;

            // Peak ratio: how concentrated is the heat?
            const peakRatio = maxBinValue / (avgBinValue || 1);

            if (peakRatio > 6) {
                // Very sharp peak → localized hot spot → cable
                scores.cable += 3;
            } else if (peakRatio > 3) {
                // Moderate peak → could be cabinet (few components)
                scores.cabinet += 2;
                scores.cable += 1;
            } else {
                // Even distribution → large surface area → PV panel
                scores.solar_panel += 2;
            }

            // Count how many bins have significant values (>1% of pixels)
            const activeBins = histogram.filter(v => v > 1).length;
            const activeRatio = activeBins / totalBins;

            if (activeRatio > 0.5) {
                // Many active bins → wide distribution → PV panel
                scores.solar_panel += 2;
            } else if (activeRatio > 0.25) {
                // Medium → cabinet
                scores.cabinet += 1;
            } else {
                // Few active bins → concentrated → cable
                scores.cable += 1;
            }
        }

        // Return highest scoring category
        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        return sorted[0][0];
    }

    /**
     * Main classification: filename first, then metadata fallback
     * @param {string} filename
     * @param {object|null} metadata - Optional thermal metadata for fallback
     * @returns {string} Device type: 'solar_panel', 'cable', or 'cabinet'
     */
    static classify(filename, metadata = null) {
        // Priority 1: filename keyword match
        const filenameMatch = DeviceClassifier._matchFilename(filename);
        if (filenameMatch) {
            return filenameMatch;
        }

        // Priority 2: metadata-based analysis (if available)
        if (metadata && metadata.tempMax != null && metadata.tempMin != null) {
            return DeviceClassifier.classifyByMetadata(metadata);
        }

        // Final fallback: Generic Device
        return 'device';
    }

    /**
     * Get temperature thresholds for a device type
     * @param {string} deviceType
     * @returns {{ warning: number, critical: number }}
     */
    static getThresholds(deviceType) {
        const cat = DeviceClassifier.CATEGORIES[deviceType];
        return cat ? cat.thresholds : DeviceClassifier.CATEGORIES.device.thresholds;
    }

    /**
     * Get display label for a device type
     * @param {string} deviceType
     * @returns {string}
     */
    static getLabel(deviceType) {
        const cat = DeviceClassifier.CATEGORIES[deviceType];
        return cat ? cat.label : '🔧 Thiết bị';
    }

    /**
     * Get sort order for a device type (lower = first)
     * @param {string} deviceType
     * @returns {number}
     */
    static getSortOrder(deviceType) {
        const cat = DeviceClassifier.CATEGORIES[deviceType];
        return cat ? cat.sortOrder : 1;
    }

    /**
     * Sort thermal images by category then by filename
     * @param {Array} images - Array of ThermalImage objects with deviceType
     * @returns {Array} Sorted array
     */
    static sortByCategory(images) {
        return images.sort((a, b) => {
            const orderA = DeviceClassifier.getSortOrder(a.deviceType);
            const orderB = DeviceClassifier.getSortOrder(b.deviceType);
            if (orderA !== orderB) return orderA - orderB;
            return (a.filename || '').localeCompare(b.filename || '');
        });
    }
}

module.exports = DeviceClassifier;
