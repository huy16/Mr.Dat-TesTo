const fs = require('fs');
const path = require('path');
const IBmtRepository = require('../../domain/repositories/IBmtRepository');
const ThermalImage = require('../../domain/entities/ThermalImage');

class BmtFileRepository extends IBmtRepository {
    async parse(filePath, outputDir, originalFileName) {
        try {
            const buffer = fs.readFileSync(filePath);
            // Use provided original name (stripping extension if needed) or fallback to path extraction
            const originalName = originalFileName ? path.parse(originalFileName).name : path.parse(filePath).name;
            const stats = fs.statSync(filePath); // For creation time fallback

            // 1. Find <ToFo> tag
            const tofoStart = buffer.indexOf('<ToFo version="');
            if (tofoStart === -1) {
                throw new Error("Invalid BMT file: No ToFo tag found.");
            }

            // 2. Extract Images
            let thermalImageBuffer = null;
            let realImageBuffer = null;
            let thermalImagePath = null;
            let realImagePath = null;

            // Find ALL JPEG images in the entire file
            const jpegImages = [];
            let searchIdx = 0;
            const jpegStartMarker = Buffer.from([0xFF, 0xD8]);
            const jpegEndMarker = Buffer.from([0xFF, 0xD9]);

            while (searchIdx < buffer.length) {
                const startIdx = buffer.indexOf(jpegStartMarker, searchIdx);
                if (startIdx === -1) break;

                const endIdx = buffer.indexOf(jpegEndMarker, startIdx + 2);
                if (endIdx === -1) break;

                jpegImages.push({
                    start: startIdx,
                    end: endIdx + 2,
                    size: (endIdx + 2) - startIdx
                });

                searchIdx = endIdx + 2;
            }

            console.log(`[BMT Parse] Found ${jpegImages.length} JPEG(s) in file`);
            jpegImages.forEach((img, i) => console.log(`  JPEG ${i + 1}: pos ${img.start}, size ${img.size} bytes`));

            if (jpegImages.length > 0) {
                // First image is Thermal
                thermalImageBuffer = buffer.subarray(jpegImages[0].start, jpegImages[0].end);

                if (outputDir) {
                    thermalImagePath = path.join(outputDir, `${originalName}.jpg`);
                    fs.writeFileSync(thermalImagePath, thermalImageBuffer);
                }

                // Find the Real Image: typically the largest JPEG after the first one
                // In Testo BMT files, the 2nd largest image is usually the visible light photo
                if (jpegImages.length > 1) {
                    // Sort remaining images by size (descending) and pick the largest
                    const remainingImages = jpegImages.slice(1).sort((a, b) => b.size - a.size);
                    const realImg = remainingImages[0];

                    realImageBuffer = buffer.subarray(realImg.start, realImg.end);

                    if (outputDir) {
                        realImagePath = path.join(outputDir, `${originalName}_real.jpg`);
                        fs.writeFileSync(realImagePath, realImageBuffer);
                        console.log(`[BMT Parse] Extracted real image: ${realImg.size} bytes`);
                    }
                }
            }

            // 3. Parse ToFo block
            const tofoEnd = buffer.indexOf('</ToFo>', tofoStart);
            const tofoBlockLength = (tofoEnd + 7) - tofoStart;
            let currentPtr = tofoStart + tofoBlockLength;

            // Skip whitespace
            while (currentPtr < buffer.length && (buffer[currentPtr] === 10 || buffer[currentPtr] === 13)) {
                currentPtr++;
            }

            const xmlStart = currentPtr;

            // Re-read ToFo to get XML Size
            const tofoBlock = buffer.subarray(tofoStart, tofoEnd + 7).toString();
            const xmlSizeMatch = tofoBlock.match(/<xml size="(\d+)"/);
            if (!xmlSizeMatch) throw new Error("XML size not found");
            const xmlSize = parseInt(xmlSizeMatch[1]);

            const dataStart = xmlStart + xmlSize;

            // 4. Parse XML
            const xmlContent = buffer.subarray(xmlStart, xmlStart + xmlSize).toString();
            const regex = /<item name="([^"]+)" type="[^"]+" size="(\d+)"/g;

            let match;
            let currentOffset = 0;
            const meta = {
                tempMax: null,
                tempMin: null,
                centerTemp: null,
                reflectedTemp: null,
                emissivity: null,
                dateTime: null
            };

            while ((match = regex.exec(xmlContent)) !== null) {
                const name = match[1];
                const size = parseInt(match[2]);
                const valueOffset = dataStart + currentOffset;

                // Extract Values (Little Endian)
                if (name === "TempMax") {
                    meta.tempMax = buffer.readFloatLE(valueOffset) - 273.15;
                } else if (name === "TempMin") {
                    meta.tempMin = buffer.readFloatLE(valueOffset) - 273.15;
                } else if (name === "EmissivityValue") {
                    meta.emissivity = buffer.readFloatLE(valueOffset);
                } else if (name === "ReflectedTemperature") {
                    meta.reflectedTemp = buffer.readFloatLE(valueOffset) - 273.15;
                } else if (name === "Temp" || name === "Temperature") {
                    if (!meta.centerTemp) {
                        meta.centerTemp = buffer.readFloatLE(valueOffset) - 273.15;
                    }
                } else if (name === "DateTime") {
                    const ts = buffer.readUInt32LE(valueOffset);
                    if (ts > 946684800 && ts < 2000000000) {
                        meta.dateTime = new Date(ts * 1000);
                    }
                }

                else if (name === "Ir") {
                    const valueOffset = dataStart + currentOffset;
                    // Ir Header skip (24 bytes)
                    const dataPayloadStart = valueOffset + 24;
                    const pixelCount = (size - 24) / 2;

                    let minVal = 65535;
                    let maxVal = -65535;
                    let minIdx = 0;
                    let maxIdx = 0;
                    // We don't need to keep the whole array in memory if we just want histogram, 
                    // but we need min/max first to define bins.
                    // So 2 passes: 1. Stats, 2. Histogram.
                    // To avoid large memory alloc, we can just read twice or Alloc.
                    // Alloc is 43200 * 2 bytes = 86KB. Cheap.
                    const rawValues = new Int16Array(pixelCount);

                    for (let i = 0; i < pixelCount; i++) {
                        const val = buffer.readInt16LE(dataPayloadStart + i * 2);
                        rawValues[i] = val;
                        if (val < minVal) { minVal = val; minIdx = i; }
                        if (val > maxVal) { maxVal = val; maxIdx = i; }
                    }

                    // Calculate Spots Coordinates (assuming 4:3 aspect ratio)
                    const aspect = 4 / 3;
                    // width * height = pixelCount; width/height = aspect => width^2 / aspect = pixelCount => width = sqrt(pixelCount * aspect)
                    const width = Math.round(Math.sqrt(pixelCount * aspect));
                    const height = Math.round(width / aspect);

                    const getCoords = (idx) => {
                        const x = (idx % width);
                        const y = Math.floor(idx / width);
                        return {
                            x: (x / width) * 100,
                            y: (y / height) * 100
                        };
                    };

                    meta.spots = {
                        hot: getCoords(maxIdx),
                        cold: getCoords(minIdx)
                    };

                    meta.rawStats = { minVal, maxVal, rawValues };
                }

                currentOffset += size;
            }

            // Compute Histogram
            let histogram = [];
            if (meta.rawStats && meta.tempMin !== null && meta.tempMax !== null) {
                const rawRange = meta.rawStats.maxVal - meta.rawStats.minVal;
                if (rawRange > 0) {
                    const bins = new Array(40).fill(0);
                    const rawBinSize = rawRange / 40;

                    for (let i = 0; i < meta.rawStats.rawValues.length; i++) {
                        let binIdx = Math.floor((meta.rawStats.rawValues[i] - meta.rawStats.minVal) / rawBinSize);
                        if (binIdx >= 40) binIdx = 39;
                        if (binIdx < 0) binIdx = 0;
                        bins[binIdx]++;
                    }

                    const total = meta.rawStats.rawValues.length;
                    histogram = bins.map(count => (count / total) * 100);
                }
            }

            // Fallback for date
            if (!meta.dateTime) meta.dateTime = stats.birthtime;

            // Return Entity
            return new ThermalImage(
                null, // ID generated elsewhere or not needed
                originalName,
                meta.dateTime.toISOString().split('T')[0],
                meta.tempMax !== null ? meta.tempMax.toFixed(1) : "N/A",
                meta.tempMin !== null ? meta.tempMin.toFixed(1) : "N/A",
                meta.centerTemp !== null ? meta.centerTemp.toFixed(1) : "N/A",
                meta.reflectedTemp !== null ? meta.reflectedTemp.toFixed(1) : "20.0",
                meta.emissivity !== null ? meta.emissivity.toFixed(2) : "N/A",
                thermalImagePath,
                realImagePath,
                "", // Default remarks
                "Normal", // Default severity
                histogram,
                meta.spots
            );

        } catch (e) {
            console.error(`BmtRepository Error (${filePath}):`, e.message);
            throw e;
        }
    }
}


module.exports = BmtFileRepository;
