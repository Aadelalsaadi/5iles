exports.handler = async (event) => {
  const { url } = JSON.parse(event.body);
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment'
    },
    body: Buffer.from(buffer).toString('base64'),
    isBase64Encoded: true
  };
};
