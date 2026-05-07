exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  try {
    const { files } = JSON.parse(event.body);
    const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiNTBjOTFjZmQ2MzQ2Mzc0YzY4MGVmMjc3YWQzOWE0MjYzZmQwMmYzMjU5ZGMwNWRhZGE3MTBjM2Y0ZDgxMGEzZDlmZjVmZGI0ZDkxYmFjYWIiLCJpYXQiOjE3NzgwMDM5MjYuMTUzODk0LCJuYmYiOjE3NzgwMDM5MjYuMTUzODk1LCJleHAiOjQ5MzM2Nzc1MjYuMTQ3NDQ4LCJzdWIiOiI3NTQyMTMyOCIsInNjb3BlcyI6WyJ0YXNrLnJlYWQiLCJ0YXNrLndyaXRlIl19.YYu3EcjBijqRWn_IaKRVXMuqiai7lyKqnQ1VVHLHD0x1rJHjWA94LHPva5rEkni69LhUxqMDZDla5ejq9GLEoC0RJIQ9XFnNvY2SZcAv5PxGiau-xzS6x1a8OLTTyna-W9U5KFWwjY6r6NIMNu7f9StjDVPEkc7Hpx8PGgIA_CdBgv5-gbTIQtYMhdnl-_zKduBG-GSkoTpSdnXzyKOUv8wIsKt3o2VxMK1hIBb3R7XyuWHw8sxGVW33UIOq6K9VBr0H5e2RRta2lkyOXPUpurZ-uRGCuzs7RuraLihzKnvRSg4ruUJOT59bdhEvTU7MbFyxNTctZpK5GBkDRDBjimbBtajxYzYtzuLI7Az42Yu7Tne4TvR_wjkZWdNxnE_ipJQVtpb_RDVea2ZgclSAvrZdCYzIDMrKm9vwb8M52F7pQcpaoMABexpRAjLaxwhEs7l1vv1QDXZyQPH7N39GUwmZbPIx6pQpt9Wh9Khyycb0ymVmNDtVApTVbAMN8q56_ZgexDVoYJO2gSTdn5zWYv98mwY-vEFSjrl57NtWhSGTbecK8kS-8gdYVKDBJaU5ki6Wi3dhhFm8Z9TcPQ0lyum9LY_M7KCoqENnCxo6hmMvfNC8Xi0FInw97rArbRrlx1Xh0IHmOEGc40dDhe_VgDN9irLsaH3aiA-ZfFwVyDg';

    const tasks = {};
    files.forEach((file, i) => {
      tasks[`import-${i}`] = { operation: 'import/base64', file: file.base64, filename: file.name };
    });
    tasks['merge'] = { operation: 'merge', input: files.map((_, i) => `import-${i}`), output_format: 'pdf' };
    tasks['export-file'] = { operation: 'export/url', input: ['merge'] };

    const jobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks })
    });
    const job = await jobRes.json();

    if (!job.data) {
      return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'CloudConvert error: ' + JSON.stringify(job) }) };
    }

    const jobId = job.data.id;
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    };
  } catch (err) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
  }
};
