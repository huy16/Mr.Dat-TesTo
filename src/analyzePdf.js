const fs = require('fs');
let pdf = require('pdf-parse');

// Handle if it's a default export
if (typeof pdf !== 'function' && pdf.default) {
    pdf = pdf.default;
}

const filePath = String.raw`D:\TOOL GOOGLE ANTIGRAVITY\5. Tool Testo\1. Database\61214949.pdf`;
const dataBuffer = fs.readFileSync(filePath);

console.log("PDF Parse Export Type:", typeof pdf);
console.log("PDF Parse Keys:", Object.keys(pdf));

const entryPoint = pdf.PDFParse || pdf;
try {
    const uint8Array = new Uint8Array(dataBuffer);
    const parser = new entryPoint(uint8Array);
    console.log("Parser created.");

    // Check if it's a promise or object with text
    if (parser.text) {
        console.log("Text:", parser.text);
    } else if (typeof parser.getText === 'function') {
        const textPromise = parser.getText();
        if (textPromise instanceof Promise) {
            textPromise.then(t => console.log("Text content:\n", t));
        } else {
            console.log("Text content:\n", textPromise);
        }
    } else {
        console.log("Keys:", Object.keys(parser));
    }

} catch (e) {
    console.error("Instantiation error:", e);
}
