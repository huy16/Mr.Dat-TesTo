const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 3005;
const jpegDir = path.join(__dirname, '../1. Database/Testo/JPEG');

const server = http.createServer((req, res) => {
    // Basic routing
    if (req.url === '/') {
        // Generate main page with list of sites
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Thermal Image Viewer</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    .site-card { margin-bottom: 20px; border: 1px solid #ccc; padding: 10px; }
                    .thumbnails { display: flex; flex-wrap: wrap; gap: 10px; }
                    .thumb-container { text-align: center; border: 1px solid #eee; padding: 5px; }
                    .thumb-container img { width: 300px; height: 225px; object-fit: contain; background: #000; }
                    .label { font-size: 12px; margin-top: 5px; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>Thermal JPEG Viewer</h1>
        `;

        try {
            const sites = fs.readdirSync(jpegDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            sites.forEach(site => {
                html += `<div class="site-card">
                    <h2>${site}</h2>
                    <div class="thumbnails">`;

                const siteDir = path.join(jpegDir, site);

                // Get up to 10 images per site
                try {
                    const files = fs.readdirSync(siteDir)
                        .filter(f => f.endsWith('.jpg') && !f.includes('_real'))
                        .slice(0, 10); // Show 10 sample images

                    files.forEach(file => {
                        html += `
                            <div class="thumb-container">
                                <img src="/image/${encodeURIComponent(site)}/${encodeURIComponent(file)}" alt="${file}">
                                <div class="label">${file}</div>
                            </div>
                        `;
                    });
                } catch (e) {
                    html += `<p>Error reading images for ${site}</p>`;
                }

                html += `</div></div>`;
            });

        } catch (e) {
            html += `<p>Error reading JPEG directory: ${e.message}</p>`;
            console.error(e);
        }

        html += `</body></html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);

    } else if (req.url.startsWith('/image/')) {
        // Serve an image file
        try {
            const parts = req.url.split('/');
            const site = decodeURIComponent(parts[2]);
            const filename = decodeURIComponent(parts[3]);

            const imagePath = path.join(jpegDir, site, filename);

            if (fs.existsSync(imagePath)) {
                const stat = fs.statSync(imagePath);
                res.writeHead(200, {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': stat.size
                });

                const readStream = fs.createReadStream(imagePath);
                readStream.pipe(res);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Image not found');
            }
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
            console.error(e);
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`Viewer server running at http://localhost:${PORT}/`);
    console.log(`Looking for images in: ${jpegDir}`);
});
