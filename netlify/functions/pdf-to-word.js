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
    const response = await fetch('https://v2.convertapi.com/convert/pdf/to/docx?Secret=94OMEH5gibAm7FfZHe6cXPB4xcOgLIyZ', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Parameters: [{ Name: 'File', FileValue: url }] })
    });
    const result = await response.json();
    if (!result.Files) throw new Error(result.Message || 'Conversion failed');
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: result.Files[0].Url })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
