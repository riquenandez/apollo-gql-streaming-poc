import { ApolloServer } from '@apollo/server';
import http2 from 'node:http2';

// Define the GraphQL schema
// this design choice allows for the server to work in accordance to grapql open spec
const typeDefs = `
   type RenderState {
       ready: Boolean!
       state: String!
   }
  "stream will only return last object of entire stream to reduce network congestion"
  type UserStream {
      render: RenderState!
      user: User 
  }
  type User {
    id: ID!
    name: String!
    email: String
  }
  type Query {
    userStream: UserStream!
    users: [User!]
  }
`;

// Simulated data source (e.g., CRM)
async function fetchUsers(): Promise<Array<any>> {
  const items: Array<any> = [];
  for (let i = 0; i < 1000; i++) {
    // Simulate async fetch with a small delay
     items.push({ id: i, name: `User${i}`, data: `Large data chunk ${i}` })
  }
  return new Promise((resolve, reject) => {
      setTimeout(() => {
          resolve(items);
      }, 600)
  })
}

const http2Server = http2.createServer();

const resolvers = {
  Query: {
    userStream: async (_: any, __: any, context: any) => {
        const { stream } = context;
        return new Promise(async (resolve, reject) => {

            try {
                // Set response headers for NDJSON streaming
                stream.respond({
                    ':status': 200,
                    'content-type': 'application/x-ndjson',
                });

               const batchSize = 50;

               let batch = [];
               const data = await fetchUsers()

               // Stream data in batches
               for (const obj of data) {
                   batch.push(obj);
                   if (batch.length === batchSize) {
                       stream.write(batch.map(o => JSON.stringify(o)).join('\n') + '\n');
                       batch = [];
                   }
               }

               // Send any remaining data
               if (batch.length > 0) {
                   stream.write(batch.map(o => JSON.stringify(o)).join('\n') + '\n');
               }

               stream.end();
               resolve([])
           } catch (error) {
               console.log('error', error);
               stream.respond({
                   ':status': 500,
                   'content-type': 'text/plain',
               });
               stream.end('Internal Server Error');
               reject();
           }
       })
    },
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

http2Server.on('stream', async (stream, headers) => {
  const method = headers[':method'];
  const path = headers[':path'];

  if (method === 'POST' && path === '/graphql') {
    try {

      // Collect request body
      let body = '';

      stream.on('data', chunk => { body += chunk.toString(); });

      await new Promise(resolve => stream.on('end', resolve)); // Wait for body
      const { query, variables, operationName } = JSON.parse(body);

      const contextValue = { stream };
      const result = await server.executeOperation(
        { query, variables, operationName },
        { contextValue }
      );

      // If resolver didn't handle the stream, send default JSON response
      if (!stream.writableEnded) {
        stream.respond({
          ':status': 200,
          'content-type': 'application/json',
        });
        stream.end(JSON.stringify(result));
      }

    } catch (error) {
      stream.respond({
        ':status': 500,
        'content-type': 'text/plain',
      });
      stream.end('Internal Server Error');
    }
  } else {
    stream.respond({
      ':status': 404,
      'content-type': 'text/plain',
    });
    stream.end('Not Found');
  }
});

http2Server.listen(3000, () => {
  console.log('GQL server running on https://localhost:3000/graphql');
});
