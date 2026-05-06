const ConvertAPI = require('convertapi');

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
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { url } = body;
    const convertapi = new ConvertAPI('94OMEH5gibAm7FfZHe6cXPB4xcOgLIyZ', { conversionTimeout: 60 });
    const result = await convertapi.convert('docx', { File: url }, 'pdf');
    const fileUrl = result.files[0].url;
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fileUrl })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
