const https = require('https');
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }
  try {
    const API_KEY = 'alsaadi.legend@gmail.com_7FtrjwweCnnIMe5Kxo8hkWeFREJzYGaHjQK4C7a3OkR2XaK7daD3DVgozSoKAtyj';
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
const { filename, fileBase64 } = body;

    const presignData = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.pdf.co',
        path: `/v1/file/upload/get-presigned-url?name=${encodeURIComponent(filename)}&encrypt=false`,
        method: 'GET',
        headers: { 'x-api-key': API_KEY }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));
      });
      req.on('error', reject);
      req.end();
    });

    if (presignData.error) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(presignData)
      };
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const uploadUrl = new URL(presignData.presignedUrl);

    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: uploadUrl.hostname,
        path: uploadUrl.pathname + uploadUrl.search,
        method: 'PUT',
        headers: {
          'Content-Length': fileBuffer.length,
          'Content-Type': 'application/octet-stream'
        }
      }, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.write(fileBuffer);
      req.end();
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: presignData.url, error: false })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: true, message: err.message })
    };
  }
};
