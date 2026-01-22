const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
    // Changes the cache location for Puppeteer to a local folder
    // which helps Render cache the browser between builds
    cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
