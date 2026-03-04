export default async function handler(req, res) {
  const targetUrl = process.env.VITE_GAS_URL;
  
  if (!targetUrl) {
    return res.status(500).json({ error: "No GAS URL configured in Server. Make sure to set VITE_GAS_URL in Vercel Environment." });
  }

  // Preserve query parameters, especially ?action=...
  const urlObj = new URL(targetUrl);
  if (req.query) {
    for (const key in req.query) {
      urlObj.searchParams.set(key, req.query[key]);
    }
  }

  try {
    const options = {
      method: req.method,
    };
    
    if (req.method === 'POST') {
      // Vercel serverless parses req.body automatically into an object if it's JSON.
      // We must stringify it again because GAS expects raw JSON text sometimes based on your App.jsx implementation.
      options.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    // Call the original Google Apps Script
    const proxyResponse = await fetch(urlObj.toString(), options);
    const contentType = proxyResponse.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await proxyResponse.json();
      return res.status(proxyResponse.status).json(data);
    } else {
      const text = await proxyResponse.text();
      try {
        const data = JSON.parse(text);
        return res.status(proxyResponse.status).json(data);
      } catch (e) {
        return res.status(proxyResponse.status).send(text);
      }
    }
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to fetch from Google Script" });
  }
}
