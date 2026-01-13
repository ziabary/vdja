# tika-js

> Tika JavaScript / TypeScript Client

## Installation

* `npm install tika-js`
* `yarn add tika-js`

## Usage

```ts
import { createReadStream, createWriteStream } from 'fs'
import { TikaClient } from 'tika-js'

const client = new TikaClient({ host: 'http://127.0.0.1:9998' })

// Version
console.info('version', await client.getVersion())

// Extract Text
const txt = await client.getContent(createReadStream('data/input.pdf'), 'text/plain')

// Extract XML
const xml = await client.getContent(createReadStream('data/input.pdf'), 'text/xml')

// Extract HTML
const html = await client.getContent(createReadStream('data/input.pdf'), 'text/html')

// Extract JSON
const json = await client.getContent(createReadStream('data/input.pdf'), 'application/json')

// Pipe
await client.pipe(
  createReadStream('data/input.pdf'),
  createWriteStream('data/output.txt'),
  'text/plain' // 'text/xml' | 'text/html' | 'application/json'
)

main()
```
