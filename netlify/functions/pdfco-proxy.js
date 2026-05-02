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
    const { endpoint, body } = JSON.parse(event.body);

    const requestBody = JSON.stringify(body);

    const data = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.pdf.co',
        path: `/v1/${endpoint}`,
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      }, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => resolve(JSON.parse(responseBody)));
      });
      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: true, message: err.message })
    };
  }
};
