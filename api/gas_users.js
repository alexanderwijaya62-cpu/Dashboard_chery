export default async function handler(req, res) {
  const targetUrl = process.env.VITE_GAS_USERS_URL;
  
  if (!targetUrl) {
    return res.status(500).json({ error: "No GAS URL configured in Server. Make sure to set VITE_GAS_USERS_URL in Vercel Environment." });
  }

  // Preserve query parameters, especially ?action=changePassword
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
      options.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

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
