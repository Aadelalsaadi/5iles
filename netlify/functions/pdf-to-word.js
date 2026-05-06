exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { fileBase64, filename } = body;
    const response = await fetch(
      'https://v2.convertapi.com/convert/pdf/to/docx?Secret=94OMEH5gibAm7FfZHe6cXPB4xcOgLIyZ',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Parameters: [
            { Name: 'File', FileValue: fileBase64, FileValueName: filename || 'file.pdf' },
          { Name: 'StoreFile', Value: 'true' }
        ]
      }
    );
    const result = await response.json();
    if (!result.Files || !result.Files[0]) throw new Error(result.Message || JSON.stringify(result));
    const fileRes = await fetch(result.Files[0].Url);
const buffer = await fileRes.arrayBuffer();
const base64 = Buffer.from(buffer).toString('base64');
return {
  statusCode: 200,
  headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  body: JSON.stringify({ base64, filename: result.Files[0].FileName })
};
  } catch (err) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: err.message }) };
  }
};
