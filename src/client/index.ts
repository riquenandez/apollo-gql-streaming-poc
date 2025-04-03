import http2 from 'node:http2';

/**
 * Browser Client
 */
const client = http2.connect('http://localhost:3001', { rejectUnauthorized: false });

const req = client.request({
  ':method': 'POST',
  ':path': '/graphql',
  'content-type': 'application/json',
});

req.write(JSON.stringify({ query: '{ UserStream { render, user { id name email} } }' }));
req.end();

req.on('response', (headers) => {
  console.time('req time');
  console.log('Headers:', headers);
});

let buffer: string | undefined = '' ;
req.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = (buffer as string).split('\n');
  // why is this needed?
  buffer = lines.pop(); // Keep incomplete line in buffer
  lines.forEach((line) => {
    if (line) {
      const obj = JSON.parse(line);
      // console.log('Received object:', obj);
      // Process incrementally (e.g., update UI)
    }
  });
});

req.on('end', () => {
  // this is the entire object
  // if (buffer) {
  //   const obj = JSON.parse(buffer);
  //   //console.log('Received object:', obj);
  // }
  console.log('Stream ended');
  console.timeEnd('req time');
  client.close();
});
