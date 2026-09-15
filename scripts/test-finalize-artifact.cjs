const http = require('http');
const crypto = require('crypto');

const secret = 'oxCE5ZodcbOpdlc5uHV/RPiJNVoW0uxWyrFcpbelxtCET4rodjVSasyRqwHOJ2DAc98+sx19x2CDnXpwhRcahw==';
const now = Math.floor(Date.now() / 1000);

const payload = {
  sub: 'lenam911400@gmail.com',
  userId: 7,
  activeRole: 'STUDENT',
  roles: ['STUDENT'],
  iat: now,
  exp: now + 3600
};

function createJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'utf8')).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

const token = createJwt(payload, secret);
console.log('Generated JWT token:', token.slice(0, 25) + '...');

const agreementId = 'a4c6586f-0b5c-4552-94b5-919da71b407a';

function makeRequest(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8083,
      path: path,
      method: method,
      headers: {
        'Cookie': `access_token=${token}`,
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('1. Fetching document view to get CSRF token and verify auth...');
  const getRes = await makeRequest('GET', `/api/contracts/agreements/${agreementId}/document-view`);
  console.log(`GET Status: ${getRes.statusCode}`);
  
  let xsrfToken = null;
  const setCookies = getRes.headers['set-cookie'] || [];
  for (const c of setCookies) {
    const m = c.match(/XSRF-TOKEN=([^;]+)/);
    if (m) xsrfToken = m[1];
  }
  console.log('CSRF Token found:', xsrfToken);

  console.log('2. Calling finalize endpoint...');
  const postHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `access_token=${token}` + (xsrfToken ? `; XSRF-TOKEN=${xsrfToken}` : '')
  };
  if (xsrfToken) {
    postHeaders['X-XSRF-TOKEN'] = xsrfToken;
  }

  const postRes = await makeRequest('POST', `/api/contracts/agreements/${agreementId}/document-artifact/finalize`, postHeaders);
  console.log(`POST Status: ${postRes.statusCode}`);
  console.log('POST Body:', postRes.body);

  console.log('3. Testing PDF download...');
  const pdfRes = await makeRequest('GET', `/api/contracts/agreements/${agreementId}/document-artifact/download?format=pdf`);
  console.log(`PDF Download Status: ${pdfRes.statusCode}, Content-Length: ${pdfRes.headers['content-length']}, Content-Type: ${pdfRes.headers['content-type']}`);

  console.log('4. Testing DOCX download...');
  const docxRes = await makeRequest('GET', `/api/contracts/agreements/${agreementId}/document-artifact/download?format=docx`);
  console.log(`DOCX Download Status: ${docxRes.statusCode}, Content-Length: ${docxRes.headers['content-length']}, Content-Type: ${docxRes.headers['content-type']}`);
}

run().catch(console.error);


