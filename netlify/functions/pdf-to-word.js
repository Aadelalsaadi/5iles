const pdfParse = require('pdf-parse');
const { Document, Paragraph, TextRun, Packer } = require('docx');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  try {
    const { fileBase64, filename } = JSON.parse(event.body);
    const pdfBytes = Buffer.from(fileBase64, 'base64');
    
    // Extract text from PDF
    const pdfData = await pdfParse(pdfBytes);
    const text = pdfData.text;
    
    // Split into lines and create paragraphs
    const lines = text.split('\n');
    const paragraphs = lines.map(line => new Paragraph({
      children: [new TextRun({ text: line })]
    }));

    // Create Word document
    const doc = new Document({
      sections: [{ properties: {}, children: paragraphs }]
    });

    const docxBuffer = await Packer.toBuffer(doc);
    const base64Result = docxBuffer.toString('base64');

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: base64Result })
    };
  } catch (err) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
  }
};
