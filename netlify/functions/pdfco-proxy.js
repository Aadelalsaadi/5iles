const https = require('https');

function pdfcoRequest(path, body) {
  const API_KEY = 'alsaadi.legend@gmail.com_7FtrjwweCnnIMe5Kxo8hkWeFREJzYGaHjQK4C7a3OkR2XaK7daD3DVgozSoKAtyj';
  const requestBody = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.pdf.co',
      path,
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

function pdfcoGet(path) {
  const API_KEY = 'alsaadi.legend@gmail.com_7FtrjwweCnnIMe5Kxo8hkWeFREJzYGaHjQK4C7a3OkR2XaK7daD3DVgozSoKAtyj';
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.pdf.co',
      path,
      method: 'GET',
      headers: { 'x-api-key': API_KEY }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    const { endpoint, body } = JSON.parse(event.body);

    // Start async job
    const jobData = await pdfcoRequest(`/v1/${endpoint}`, { ...body, async: true });

    if (jobData.error) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(jobData)
      };
    }

    // Poll for result (max 50 seconds)
    const jobId = jobData.jobId;
    let result;
    for (let i = 0; i < 4; i++) {
      await sleep(4000);
      result = await pdfcoGet(`/v1/job/check?jobid=${jobId}`);
      if (result.status === 'success') break;
      if (result.status === 'error') break;
    }

    // Job check returns urls array, normalize to match direct response format
    const normalized = {
      error: result.status !== 'success',
      message: result.status !== 'success' ? (result.status || 'Job failed') : undefined,
      url: result.url || (result.urls && result.urls[0]),
      urls: result.urls,
      status: result.status
    };

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(normalized)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: true, message: err.message })
    };
  }
};
