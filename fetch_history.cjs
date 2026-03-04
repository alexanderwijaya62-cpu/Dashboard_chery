const https = require('https');

const url = "https://script.google.com/macros/s/AKfycbwA7qZH0FeyZTZAHsUsk217aU9WoCAhmMFEZ0eAAyvIqEOsZE81uTAA7kGWQI60NZFJIQ/exec?action=history";

https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, (res2) => {
            let data = '';
            res2.on('data', chunk => data += chunk);
            res2.on('end', () => console.log(data));
        });
    } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => console.log(data));
    }
}).on('error', (err) => {
    console.log("Error: " + err.message);
});
