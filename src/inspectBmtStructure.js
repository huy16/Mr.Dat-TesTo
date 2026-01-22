const fs = require('fs');

const filename = String.raw`D:\TOOL GOOGLE ANTIGRAVITY\5. Tool Testo\1. Database\Image Site\KHO\1637\Testo Images\IR001373.BMT`;

function inspectBmt(filePath) {
    // Read entire file (small enough)
    const buffer = fs.readFileSync(filePath);

    // Find <ToFo>
    const tofoStart = buffer.indexOf('<ToFo version="');
    if (tofoStart === -1) {
        console.log("Could not find <ToFo> tag.");
        return;
    }

    console.log(`ToFo Start Offset: ${tofoStart}`);

    // Extract ToFo block
    const tofoEnd = buffer.indexOf('</ToFo>', tofoStart);
    const tofoBlock = buffer.subarray(tofoStart, tofoEnd + 7).toString();
    console.log("ToFo Block:\n", tofoBlock);

    const xmlSizeMatch = tofoBlock.match(/<xml size="(\d+)"/);
    const dataSizeMatch = tofoBlock.match(/<data size="(\d+)"/);

    if (!xmlSizeMatch || !dataSizeMatch) return;

    const xmlSize = parseInt(xmlSizeMatch[1]);
    const dataSize = parseInt(dataSizeMatch[1]);

    // Correct Hypothesis: [JPEG] [ToFo] [XML] [DATA]
    // ToFo starts immediately after JPEG (which we found at 5397)

    const tofoBlockLength = (tofoEnd + 7) - tofoStart;

    // Skip any newline/whitespace after ToFo?
    // Let's assume compact.

    let currentPtr = tofoStart + tofoBlockLength;

    // Check if there is padding/newline
    while (buffer[currentPtr] === 10 || buffer[currentPtr] === 13) {
        currentPtr++;
    }

    const xmlStart = currentPtr;
    console.log(`Calculated XML Start: ${xmlStart}`);

    const xmlContent = buffer.subarray(xmlStart, xmlStart + xmlSize).toString();
    fs.writeFileSync('xml_dump.txt', xmlContent);
    console.log("Dumped XML to xml_dump.txt");

    const dataStart = xmlStart + xmlSize;
    console.log(`Calculated Data Start: ${dataStart}`);

    // Start parsing XML to find offsets in Data
    const regex = /<item name="([^"]+)" type="[^"]+" size="(\d+)"/g;
    let match;
    let currentOffset = 0;

    console.log("--- Searching for TempMax/TempMin ---");

    while ((match = regex.exec(xmlContent)) !== null) {
        const name = match[1];
        const size = parseInt(match[2]);

        if (name === "Ir") {
            const valueOffset = dataStart + currentOffset;
            console.log(`Found Ir Data at DataOffset ${currentOffset} (FileOffset ${valueOffset}) Size: ${size}`);

            // Read potentially header?
            // cvmat usually: type (4), height (4), width (4)...
            // Let's dump first 32 bytes as integers
            const header = [];
            for (let i = 0; i < 8; i++) {
                header.push(buffer.readInt32LE(valueOffset + i * 4));
            }
            console.log("Ir Header (Int32s):", header);

            // Assume data starts after header? 
            // 86424 - 86400 (43200*2) = 24 bytes header?
            // 86424 - 307200 (320*240*4) -> Mismatch.
            // 240*180 = 43200 pixels. * 2 bytes = 86400. 
            // Header 24 bytes?

            const dataPayloadStart = valueOffset + 24;
            const pixelCount = (size - 24) / 2;

            let minVal = 65535;
            let maxVal = -65535;

            for (let i = 0; i < pixelCount; i++) {
                const val = buffer.readInt16LE(dataPayloadStart + i * 2);
                if (val < minVal) minVal = val;
                if (val > maxVal) maxVal = val;
            }

            console.log(`Ir Block Stats (Int16): Min=${minVal}, Max=${maxVal}`);
        }

        if (name === "TempMax" || name === "TempMin") {
            const valueOffset = dataStart + currentOffset;
            const value = buffer.readFloatLE(valueOffset);
            console.log(`Found ${name}: ${value} (K) -> ${(value - 273.15).toFixed(2)} C`);
        }

        // Also check DateTime (uint64)
        if (name === "DateTime") {
            const valueOffset = dataStart + currentOffset;
            // low-precision fetch
            const valLow = buffer.readUInt32LE(valueOffset);
            const valHigh = buffer.readUInt32LE(valueOffset + 4);
            // Convert Windows File Time (100-nanosecond intervals since Jan 1, 1601)?
            // Or OLE Automation Date?
            console.log(`Found DateTime (Raw) at DataOffset ${currentOffset}: ${valLow} ${valHigh}`);
        }

        currentOffset += size;
    }
}


inspectBmt(filename);
