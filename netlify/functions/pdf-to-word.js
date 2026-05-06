exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { fileBase64, filename } = body;
    const SECRET = '94OMEH5gibAm7FfZHe6cXPB4xcOgLIyZ';

    // Step 1: Upload file to ConvertAPI
    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const uploadRes = await fetch(`https://v2.convertapi.com/upload?Secret=${SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${filename || 'file.pdf'}"` },
      body: fileBuffer
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.FileId) throw new Error('Upload failed: ' + JSON.stringify(uploadData));

    // Step 2: Convert using FileId
    const convertRes = await fetch(`https://v2.convertapi.com/convert/pdf/to/docx?Secret=${SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Parameters: [
          { Name: 'File', FileValue: uploadData.FileId },
          { Name: 'StoreFile', Value: 'true' }
        ]
      })
    });
    const result = await convertRes.json();
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
