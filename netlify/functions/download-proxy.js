const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  let url = event.queryStringParameters?.url;
  if (!url) return { statusCode: 400, body: 'Missing url' };
  
  try {
    url = decodeURIComponent(url);
  } catch(e) {}

  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'image/jpeg',
            'Content-Disposition': 'attachment; filename="page.jpg"'
          },
          body: buffer.toString('base64'),
          isBase64Encoded: true
        });
      });
      res.on('error', (err) => resolve({ statusCode: 500, body: err.message }));
    }).on('error', (err) => resolve({ statusCode: 500, body: err.message }));
  });
};
