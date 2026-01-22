const fs = require('fs');

/**
 * Parses a Testo .BMT file to extract the embedded JPEG and metadata.
 * Structure: [JPEG Image] [ToFo Tag] [XML Schema] [Binary Data]
 */
function parseBmt(filePath, outputImagePath) {
    try {
        const buffer = fs.readFileSync(filePath);

        // 1. Find <ToFo> tag
        const tofoStart = buffer.indexOf('<ToFo version="');
        if (tofoStart === -1) {
            throw new Error("Invalid BMT file: No ToFo tag found.");
        }

        // 2. Extract Images
        // Testo BMTs often contain the Thermal Image (first) and optionally a Real Image (second).
        // They are separated by JPEG headers.

        let thermalImageBuffer = null;
        let realImageBuffer = null;

        // Find all JPEG starts
        const jpegStarts = [];
        let searchIdx = 0;
        while (searchIdx < tofoStart) {
            const idx = buffer.indexOf(Buffer.from([0xFF, 0xD8]), searchIdx);
            if (idx === -1 || idx >= tofoStart) break;
            jpegStarts.push(idx);
            searchIdx = idx + 2;
        }

        if (jpegStarts.length > 0) {
            // First image is usually Thermal
            const end1 = jpegStarts.length > 1 ? jpegStarts[1] : tofoStart;
            thermalImageBuffer = buffer.subarray(jpegStarts[0], end1);

            if (outputImagePath) {
                fs.writeFileSync(outputImagePath, thermalImageBuffer);
            }

            // Second image (Real Image)
            if (jpegStarts.length > 1) {
                const end2 = tofoStart;
                realImageBuffer = buffer.subarray(jpegStarts[1], end2);

                // Save Real Image if path provided
                if (outputImagePath) {
                    const realPath = outputImagePath.replace('.jpg', '_real.jpg');
                    fs.writeFileSync(realPath, realImageBuffer);
                }
            }
        }

        // 3. Parse ToFo block to get sizes
        const tofoEnd = buffer.indexOf('</ToFo>', tofoStart);
        const tofoBlock = buffer.subarray(tofoStart, tofoEnd + 7).toString();

        const xmlSizeMatch = tofoBlock.match(/<xml size="(\d+)"/);
        const dataSizeMatch = tofoBlock.match(/<data size="(\d+)"/);

        if (!xmlSizeMatch || !dataSizeMatch) {
            throw new Error("Invalid ToFo block: sizes not found.");
        }

        const xmlSize = parseInt(xmlSizeMatch[1]);
        const dataSize = parseInt(dataSizeMatch[1]);

        // 4. Calculate Offsets (Forward Layout: JPEG... -> ToFo -> XML -> DATA)
        const tofoBlockLength = (tofoEnd + 7) - tofoStart;
        let currentPtr = tofoStart + tofoBlockLength;

        // Skip whitespace/newlines
        while (currentPtr < buffer.length && (buffer[currentPtr] === 10 || buffer[currentPtr] === 13)) {
            currentPtr++;
        }

        const xmlStart = currentPtr;
        const dataStart = xmlStart + xmlSize;

        // 5. Parse XML to map Data offsets
        const xmlContent = buffer.subarray(xmlStart, xmlStart + xmlSize).toString();
        const regex = /<item name="([^"]+)" type="[^"]+" size="(\d+)"/g;

        let match;
        let currentOffset = 0;
        const metadata = {
            tempMax: null,
            tempMin: null,
            emissivity: null,
            reflectedTemp: null,
            dateTime: null,
            measurePoints: []
        };

        // We will enable strict parsing for Measure Points if we can find the pattern
        // Pattern logic: <group name="MeasurementObjects"> ... <item name="Temp" ...>
        // For simplicity, we search for "Temp" within a context or just grab all "Temp" fields?
        // The XML structure is hierarchical. RegEx is brittle.
        // But let's try to detect "Measure point 1" which might be an object Name.

        while ((match = regex.exec(xmlContent)) !== null) {
            const name = match[1];
            const size = parseInt(match[2]);
            const valueOffset = dataStart + currentOffset;

            // Extract Values (Little Endian)
            if (name === "TempMax") {
                const k = buffer.readFloatLE(valueOffset);
                metadata.tempMax = k - 273.15;
            } else if (name === "TempMin") {
                const k = buffer.readFloatLE(valueOffset);
                metadata.tempMin = k - 273.15;
            } else if (name === "EmissivityValue") {
                metadata.emissivity = buffer.readFloatLE(valueOffset);
            } else if (name === "DateTime") {
                const ts = buffer.readUInt32LE(valueOffset);
                if (ts > 946684800 && ts < 2000000000) {
                    metadata.dateTime = new Date(ts * 1000).toISOString().split('T')[0];
                } else {
                    metadata.dateTime = new Date().toISOString().split('T')[0];
                }
            } else if (name === "Temp" || name === "Temperature") {
                // Potential Center Spot or other points. 
                // We'd need to know if we are inside a MeasurementObject.
                // For now, let's just grab the FIRST "Temperature" that appears 
                // (often the main center spot if defined early).
                if (!metadata.centerTemp) {
                    const k = buffer.readFloatLE(valueOffset);
                    metadata.centerTemp = k - 273.15;
                }
            } else if (name === "ReflectedTemperature") {
                const k = buffer.readFloatLE(valueOffset);
                metadata.reflectedTemp = k - 273.15;
            } else if (name === "Ir") {
                const valueOffset = dataStart + currentOffset;
                // Header skip (24 bytes for 240x180, or dependent on Type)
                const dataPayloadStart = valueOffset + 24;
                const pixelCount = (size - 24) / 2;

                let minVal = 65535;
                let maxVal = -65535;
                const rawValues = new Int16Array(pixelCount);

                for (let i = 0; i < pixelCount; i++) {
                    const val = buffer.readInt16LE(dataPayloadStart + i * 2);
                    rawValues[i] = val;
                    if (val < minVal) minVal = val;
                    if (val > maxVal) maxVal = val;
                }

                metadata.rawStats = { minVal, maxVal, rawValues };
            }

            currentOffset += size;
        }

        // Post-process: Compute Histogram if we have Raw Data & Temp Range
        if (metadata.rawStats && metadata.tempMin !== null && metadata.tempMax !== null) {
            const rawRange = metadata.rawStats.maxVal - metadata.rawStats.minVal;
            const tempRange = metadata.tempMax - metadata.tempMin;

            // Avoid division by zero
            if (rawRange > 0 && tempRange > 0) {
                const bins = new Array(40).fill(0);
                // Bin size in Raw Units
                const rawBinSize = rawRange / 40;

                for (let i = 0; i < metadata.rawStats.rawValues.length; i++) {
                    const val = metadata.rawStats.rawValues[i];
                    // Map to 0-39
                    let binIdx = Math.floor((val - metadata.rawStats.minVal) / rawBinSize);
                    if (binIdx >= 40) binIdx = 39;
                    if (binIdx < 0) binIdx = 0;
                    bins[binIdx]++;
                }

                // Store Histogram (Counts + Normalized %)
                // Also store the exact bin temp ranges?
                // For simplified display, we just need the counts.
                const total = metadata.rawStats.rawValues.length;
                const histogramPercentage = bins.map(count => (count / total) * 100);

                // Also smooth it? Or raw? Testo usually shows raw.
                metadata.histogram = histogramPercentage;
            }
        }

        // Clean up large array
        if (metadata.rawStats) delete metadata.rawStats.rawValues;

        return { success: true, metadata };

    } catch (e) {
        console.error(`Error parsing BMT ${filePath}:`, e.message);
        return { success: false, error: e.message };
    }
}

module.exports = { parseBmt };
