const puppeteer = require('puppeteer');
const fs = require('fs');

async function generatePdfReport(dataList, outputPath) {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    let htmlContent = `
    <html>
    <head>
        <style>
            @page { size: A4; margin: 20px; }
            body { font-family: sans-serif; padding: 20px; color: #000; font-size: 11px; }
            .header-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .logo-section { width: 40%; }
            .logo-text { font-size: 40px; font-weight: 900; color: #0056b3; font-family: Arial, sans-serif; line-height: 1; }
            .logo-sub { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #000; margin-top: 5px; }
            .company-info { width: 55%; text-align: right; font-size: 10px; line-height: 1.3; }
            .title { text-align: center; font-weight: bold; font-size: 18px; margin: 20px 0; text-decoration: none; color: #000; text-transform: uppercase; }
            
            .meta-table { width: 100%; border-top: 2px solid #000; border-bottom: 2px solid #000; margin-bottom: 15px; }
            .meta-table td { padding: 5px 0; vertical-align: top; }
            .meta-label { font-weight: bold; width: 100px; }
            .meta-val { width: 200px; }
            
            .images-row { display: flex; gap: 10px; margin-bottom: 10px; height: 280px; }
            .image-box { flex: 1; position: relative; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .image-box img { max-width: 100%; max-height: 100%; }
            .image-label { position: absolute; top: 5px; left: 5px; background: rgba(255,255,255,0.7); padding: 2px 5px; font-size: 10px; font-weight: bold; border: 1px solid #999; }
            .scale-bar { position: absolute; right: 5px; top: 20px; bottom: 20px; width: 20px; background: linear-gradient(to top, blue, green, yellow, red); border: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between; font-size: 9px; align-items: center; }
            .scale-val { background: rgba(255,255,255,0.8); padding: 0 2px; }

            .section-title { font-weight: bold; font-size: 12px; margin-bottom: 5px; margin-top: 15px; }
            .params-grid { display: grid; grid-template-columns: auto auto auto; gap: 5px 20px; font-size: 11px; margin-bottom: 15px; border-bottom: 1px solid #000; padding-bottom: 10px; }
            .param-row { display: contents; }
            .param-label { font-weight: bold; }
            
            table.data-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
            table.data-table th { border: 1px solid #000; background-color: #f0f0f0; padding: 4px; font-weight: bold; text-align: center; }
            table.data-table td { border: 1px solid #000; padding: 4px; text-align: center; }
            table.data-table td.left { text-align: left; }
            
            .chart-container { width: 100%; height: 120px; border: 1px solid #eee; position: relative; margin-top: 5px; }
            .chart-stats { text-align: right; font-size: 10px; margin-bottom: 2px; color: #555; }
        </style>
    </head>
    <body>
    `;

    for (const [index, item] of dataList.entries()) {
        const thermalImgBase64 = fs.existsSync(item.imagePath) ? fs.readFileSync(item.imagePath).toString('base64') : '';
        const realImgBase64 = (item.realImagePath && fs.existsSync(item.realImagePath)) ? fs.readFileSync(item.realImagePath).toString('base64') : '';

        // Generate synthetic histogram SVG
        const min = parseFloat(item.minTemp) || 20;
        const max = parseFloat(item.maxTemp) || 40;
        const avg = parseFloat(item.centerTemp) || (min + max) / 2;
        const range = max - min;

        // Create 20 bars for histogram simulation (Bell curve-ish around "avg")
        // Just purely cosmetic to match look
        let barsHtml = '';
        for (let i = 0; i < 40; i++) {
            const x = i * 2.5; // percent width
            // Random height influenced by gaussian around center
            const pos = i / 40;
            // Peak at 33% (cold side) or 66% (hot side) depending on data? 
            // Let's just make a generic distribution shape
            const dist = Math.exp(-Math.pow((pos - 0.5) * 4, 2));
            const h = 10 + (dist * 80) + (Math.random() * 10);
            const color = `hsl(${240 - (pos * 240)}, 100%, 50%)`; // Blue to Red

            barsHtml += `<rect x="${x}%" y="${100 - h}%" width="2%" height="${h}%" fill="${color}" />`;
        }

        let remarksStyle = '';
        const severity = item.severity || 'Normal';

        switch (severity) {
            case 'Critical':
                remarksStyle = 'background-color: #fee2e2; color: #991b1b; font-weight: bold;';
                break;
            case 'Warning':
                remarksStyle = 'background-color: #ffedd5; color: #9a3412; font-weight: bold;';
                break;
            case 'Normal':
            default:
                remarksStyle = 'background-color: #d1fae5; color: #065f46; font-weight: bold;';
                break;
        }

        htmlContent += `
        <div class="report-page ${index < dataList.length - 1 ? 'page-break' : ''}">
            <div class="header-container">
                <div class="logo-section">
                    <div class="logo-text"></div>
                    <div class="logo-sub"></div>
                </div>
                <div class="company-info">
                    <!-- Company info removed -->
                </div>
            </div>

            <div class="title">AC BOX CABINET TEMPERATURE</div>

            <table class="meta-table">
                <tr>
                    <td class="meta-label">File:</td> <td class="meta-val">${item.name}.BMT</td>
                    <td class="meta-label" style="text-align:right">Date:</td> <td class="meta-val" style="text-align:right">${item.date}</td>
                </tr>
                <tr>
                    <td class="meta-label">Lens type:</td> <td class="meta-val">35° x 26°</td>
                    <td class="meta-label" style="text-align:right">Time:</td> <td class="meta-val" style="text-align:right">12:00:00 PM</td>
                </tr>
            </table>

            <div class="images-row">
                <div class="image-box">
                    ${thermalImgBase64 ? `<img src="data:image/jpeg;base64,${thermalImgBase64}"/>` : '<span>No Thermal Image</span>'}
                    <div class="image-label">CS1</div>
                    <div class="scale-bar">
                         <div class="scale-val" style="position:absolute; top:0;">${item.maxTemp}</div>
                         <div class="scale-val" style="position:absolute; bottom:0;">${item.minTemp}</div>
                    </div>
                </div>
                <div class="image-box">
                     ${realImgBase64 ? `<img src="data:image/jpeg;base64,${realImgBase64}"/>` : '<span>No Real Image</span>'}
                </div>
            </div>

            <div class="section-title">Thông số hình ảnh / Picture parameters:</div>
            <div class="params-grid">
               <div class="param-row"><div class="param-label">Độ phát xạ / Emissivity:</div> <div>${item.emissivity}</div> <div></div></div>
               <div class="param-row"><div class="param-label">Nhiệt độ phản chiếu / Refl. temp. [°C]:</div> <div>${item.reflectedTemp}</div> <div></div></div>
               <div class="param-row"><div class="param-label">Cường độ ánh sáng / Intensity [W/m2]:</div> <div>500</div> <div></div></div>
            </div>

            <div class="section-title">Các điểm ảnh / Picture markings</div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="text-align:left">Measurement Objects</th>
                        <th>Temp. [°C]</th>
                        <th>Emiss.</th>
                        <th>Refl. temp. [°C]</th>
                        <th style="text-align:left">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="left">Measure point 1</td>
                        <td>${item.centerTemp}</td>
                        <td>${item.emissivity}</td>
                        <td>${item.reflectedTemp}</td>
                        <td class="left" style="${remarksStyle}">${severity}</td>
                    </tr>
                    <tr>
                        <td class="left">Cold spot 1</td>
                        <td>${item.minTemp}</td>
                        <td>${item.emissivity}</td>
                        <td>${item.reflectedTemp}</td>
                        <td class="left">-</td>
                    </tr>
                    <tr>
                        <td class="left">Hot spot 1</td>
                        <td>${item.maxTemp}</td>
                        <td>${item.emissivity}</td>
                        <td>${item.reflectedTemp}</td>
                        <td class="left">-</td>
                    </tr>
                </tbody>
            </table>

            <div class="section-title">Biểu đồ nhiệt / Histogram:</div>
            <div class="chart-stats">
                 Minimum: ${item.minTemp} °C Maximum: ${item.maxTemp} °C Average: ${avg.toFixed(1)} °C
            </div>
            <div class="chart-container">
                 <svg width="100%" height="100%" preserveAspectRatio="none">
                     ${barsHtml}
                     <!-- Grid Lines -->
                     <line x1="0" y1="20%" x2="100%" y2="20%" stroke="#eee" stroke-width="1" />
                     <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#eee" stroke-width="1" />
                     <line x1="0" y1="80%" x2="100%" y2="80%" stroke="#eee" stroke-width="1" />
                     
                     <!-- X Axis Labels (Simulated) -->
                     <text x="0" y="95%" font-size="10" fill="#555">${(min).toFixed(1)}</text>
                     <!-- Removed middle value as requested -->
                     <text x="95%" y="95%" font-size="10" fill="#555" text-anchor="end">${(max).toFixed(1)}</text>
                 </svg>
            </div>
        </div>
        `;
    }

    htmlContent += `</body></html>`;

    await page.setContent(htmlContent);
    await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '30px', bottom: '30px', left: '30px', right: '30px' }
    });

    await browser.close();
    console.log(`PDF Generated: ${outputPath}`);
}

module.exports = { generatePdfReport };
