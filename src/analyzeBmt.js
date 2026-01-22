const fs = require('fs');

const extractStrings = (filePath, minLength = 4) => {
    const data = fs.readFileSync(filePath);
    let currentString = "";
    const strings = [];

    for (let i = 0; i < data.length; i++) {
        const charCode = data[i];
        // Check for printable ASCII (32-126)
        if (charCode >= 32 && charCode <= 126) {
            currentString += String.fromCharCode(charCode);
        } else {
            if (currentString.length >= minLength) {
                strings.push(currentString);
            }
            currentString = "";
        }
    }
    if (currentString.length >= minLength) {
        strings.push(currentString);
    }
    return strings;
};

// Test
const testFile = String.raw`D:\TOOL GOOGLE ANTIGRAVITY\5. Tool Testo\1. Database\Image Site\KHO\1637\Testo Images\IR001366.BMT`;
if (fs.existsSync(testFile)) {
    const strs = extractStrings(testFile);
    console.log("Found strings:");
    // Print first 100 found strings
    console.log(strs.slice(0, 100).join('\n'));

    // Search for keywords
    console.log("\n--- Keywords Search ---");
    const keywords = ['Temp', 'Emissivity', 'deg', 'Date', 'Time', 'Testo'];
    keywords.forEach(kw => {
        const matches = strs.filter(s => s.includes(kw));
        if (matches.length > 0) {
            console.log(`Matches for '${kw}':`, matches);
        }
    });

} else {
    console.log("File not found");
}
