# apollo-gql-streaming-poc

Problem: Current gql implementations work for smaller datasets. However, in some cases,
average requests pull 600-1,000 large JSON objects. As a result, the gql server 
takes additional time to parse and handle the large dataset which can result in slow response times.


Solution: Use node http2 streams to stream the data to the client. This solution allows the client to reach a render ready 
state faster by incrementally handling the data as it comes in. If API supports streaming then the data can be 
piped back directly to the client. Otherwise, the data must be fetched and held in memory before being streamed.

Cons: Because this is not an official graphql specification, it is up to the client to handle the request properly. Additionally,
all data will be returned to the client. However, smart adapters can be implemented to ensure only the requested data is returned.

## How It Works

# Server Setup: 
- The BFF uses http2.createSecureServer with SSL certificates to establish an HTTP/2 server.

# Stream Handling: 

When a client request arrives (bffServer.on('stream', ...)), the BFF:

- Connects to the GraphQL server using http2.connect.

- Creates a new request (graphqlClient.request) to the GraphQL endpoint (/graphql).

- Pipes the client’s request body (e.g., a GraphQL query in JSON) to the GraphQL server if it’s a POST request.

# Response Piping:
- The GraphQL server’s response headers are forwarded to the client via clientStream.respond.

- Data chunks from the GraphQL server (graphqlReq.on('data')) are written to the client stream as they arrive.

- When the GraphQL stream ends, the client stream is closed.

# Error Handling: 
If the GraphQL server connection fails, the BFF returns a 500 error to the client.

# Cleanup: 
The connection to the GraphQL server is closed when the client stream ends.

# Future Improvements 
- support http1 
- support API streaming for a true end-to-end streaming solution
- implement batch fetching for APIs that support pagination (parallel batch fetching?) 
- implement pagination if client needs more control
- implement Zod runtime validations in BFF to ensure data wont break the UI render function
