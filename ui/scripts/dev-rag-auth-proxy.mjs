import { createServer } from 'node:https';
import { request as upstreamRequest } from 'node:http';
import { readFile } from 'node:fs/promises';

const root='.secrets.t3.local';
const [cert,key]=await Promise.all([readFile(`${root}/rag-dev-cert.pem`),readFile(`${root}/rag-dev-key.pem`)]);
const server=createServer({cert,key},(request,response)=>{
  if(!request.url?.startsWith('/api/auth/')){response.writeHead(404).end();return;}
  const upstream=upstreamRequest({hostname:'127.0.0.1',port:3100,path:request.url,method:request.method,
    headers:{...request.headers,host:'auth.localhost:5174'}},result=>{
      response.writeHead(result.statusCode??502,result.headers);result.pipe(response);
    });
  upstream.setTimeout(30000,()=>upstream.destroy(new Error('UPSTREAM_TIMEOUT')));
  upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end();});
  request.pipe(upstream);
});
server.listen(5174,'127.0.0.1',()=>console.log('Auth TLS proxy READY https://auth.localhost:5174'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>{}));
