import http2  from 'http2';
import fetch from 'node-fetch'; // For making the API call

// Function to fetch the access token from the authentication API
async function fetchAccessToken() {
  const response = await fetch('https://your-auth-api.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: 'your-client-id',
      client_secret: 'your-client-secret',
      grant_type: 'client_credentials', // Adjust based on your auth flow
    }),
  });
  const data = await response.json();
  return data.access_token;
}


// Create the BFF HTTP/2 server
const bffServer = http2.createServer();


// Handle incoming client streams
bffServer.on('stream', async (clientStream, headers) => {
  try {
    // Step 1: Fetch the access token
    // const accessToken = await fetchAccessToken();

    // Step 2: Connect to the GraphQL server
    const graphqlClient = http2.connect('http://localhost:3000', {
      rejectUnauthorized: false, // Only for dev with self-signed certs
    });

    // Step 3: Forward the request to the GraphQL server with the token
    const graphqlReq = graphqlClient.request({
      ':method': headers[':method'],
      ':path': '/graphql',
      'content-type': 'application/json',
      // 'authorization': `Bearer ${accessToken}`, // Set the Authorization header
    });

    // Pipe the client’s request body (e.g., GraphQL query) to the GraphQL server
    if (headers[':method'] === 'POST') {
      clientStream.pipe(graphqlReq);
    } else {
      graphqlReq.end();
    }

    // Pipe the GraphQL server’s response headers to the client
    graphqlReq.on('response', (responseHeaders) => {
      clientStream.respond(responseHeaders);
    });

    // Stream data from the GraphQL server to the client
    graphqlReq.on('data', (chunk) => {
      clientStream.write(chunk);
    });

    // End the client stream when the GraphQL response ends
    graphqlReq.on('end', () => {
      clientStream.end();
    });

    // Handle errors from the GraphQL server
    graphqlReq.on('error', (err) => {
      console.error('Error connecting to GraphQL server:', err);
      clientStream.respond({
        ':status': 500,
        'content-type': 'text/plain',
      });
      clientStream.end('Internal Server Error');
    });

    // Clean up the GraphQL client connection
    clientStream.on('close', () => {
      graphqlClient.close();
    });
  } catch (error) {
    // Handle errors from fetching the access token
    console.error('Error fetching access token:', error);
    clientStream.respond({
      ':status': 500,
      'content-type': 'text/plain',
    });
    clientStream.end('Failed to fetch access token');
  }
});

bffServer.listen(3001, () => {
  console.log('BFF server running on https://localhost:3001');
});
