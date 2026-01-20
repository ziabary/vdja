const { v4: uuidv4 } = require("uuid");
const md5 = require('md5')

const { stripText: stripText } = require("./common");
const configManager = require('./configManager')

const activeRequests = new Map()
const totalRequests = new Map()
const stoppedRequests = new Map()


async function startNewChat(
  apiRes,
  server, 
  requestId,
  messages, 
  handlers= {
    onChunk: undefined, 
    onChunkDelta: undefined, 
    onDone: undefined,  
    onError: undefined,   
  }) {
  
  const llmParams = {
    temperature: server.temperature,
    stream: true,
    store:true,
    background: true,
    max_output_tokens: server.maxTokens || 2000,
  };

  const llmResponse = await fetch(`${server.url}/v1/responses/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: server.model,
      input: messages,
      ...llmParams,
      request_id: requestId
    }),
  });

  if (!llmResponse.ok) {
    const errorText = await llmResponse.text();
    throw new Error(`LLM error (${llmResponse.status}): ${errorText}`);
  }

  if(configManager.active().isDebugging)
    console.log({startNewChat:{server: server.url, requestId, msg: stripText(messages[messages.length-1].content)}})

  if(!activeRequests.get(server.url))   activeRequests.set(server.url, new Map());
  if(!totalRequests.get(server.url))    totalRequests.set(server.url, 0);
  if(!stoppedRequests.get(server.url))  stoppedRequests.set(server.url, 0);
  
  activeRequests.get(server.url).set(requestId, {
    time: Date.now(), 
    stream: llmParams.stream,
    msg: messages[messages.length - 1].content
  });
  totalRequests.set(server.url, totalRequests.get(server.url)+1) 

  const chatReader = llmResponse.body.getReader();
  readerWithTimeout = () =>{
    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        checkRequestState(server, requestId).then(status => {
          if(status === "cancelled") {
            chatReader.cancel().catch(() => {}); // Try to cancel the reader
            resolve({ done: true, value: null, cancelled: true });  
          }
        })
      }, 1000);

      chatReader.read()
        .then(({ done, value }) => {
          clearTimeout(timer);
          resolve({ done, value });
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  await processChatStream(readerWithTimeout, apiRes, requestId, handlers)
}

function removeActiveRequest(server, reqID) {
  if(configManager.active().isDebugging)
    console.log({removeActiveRequest:{url: server.url, reqID}})
  if(activeRequests.has(server.url)) {
    const requests = activeRequests.get(server.url)
    if(requests.has(reqID)) 
      requests.delete(reqID)
  }
}

async function checkRequestState(server, reqID) {
  try{
    const response = await fetch(`${server.url}/v1/responses/${reqID}`, {
      headers: { "Content-Type": "application/json" },
    });

    const json = (await response.json())
    return json.status
  }catch(ex){ 
    console.log({checkRequestState: ex})
    return "cancelled"
  }
}

async function stopRequest(server, reqID) {
  try{
    if(activeRequests.has(server.url) && activeRequests.get(server.url).has(reqID)) {
      const resp = await fetch(`${server.url}/v1/responses/${reqID}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if(configManager.active().isDebugging)
        console.log({stopRequest:{server: server.url, reqID, status: resp.status}})
      
      const checkRemoved = async ()=>{
        const state = await checkRequestState(server, reqID)
        if(state === "queued")
          setTimeout(checkRemoved, 1000) 
        else {
          removeActiveRequest(server.url, reqID)
          stoppedRequests.set(server.url, (stoppedRequests.get(server.url) || 0) + 1)
        }
      }
      setTimeout(checkRemoved, 1000);
      if(resp.status === 200)
        return "OK"
      else 
        return "PENDING"
    } else 
      return "NOT_RUNNING"
  } catch(ex) {
    console.error({stopRequest: ex})
    return e.messages
  }
}

async function showMetrics(server) {
  try{
    const resp = await fetch(`${server.url}/metrics`);
    const metrics = await resp.text()
    metrics.split("\n").forEach(m=>{
      if(m.startsWith("vllm:num_requests_running")
        || m.startsWith("vllm:num_requests_waiting")
      ) 
      console.info(m)
    })
    console.log("\n")
  }catch(ex) {
    console.error(server.url, " DISCONNECTED:", ex.message)
  }  
}


function sendStreamHeadersIfNeeded(apiRes) {
  if(apiRes.headersSent) return
  apiRes.setHeader("Content-Type", "text/event-stream");
  apiRes.setHeader("Cache-Control", "no-cache");
  apiRes.setHeader("Connection", "keep-alive");  
  apiRes.flushHeaders();
}

async function processChatStream(chatReader, apiRes, reqId, {onChunk, onChunkDelta, onDone, onError}) {
  const decoder = new TextDecoder();
  try {
    let isDraining = false;

    while (true) {
      const { done, value, cancelled } = await chatReader()
      console.log({ done, cancelled })
      if (done) {
        if(onDone && await onDone(cancelled)) 
          return

        sendStreamHeadersIfNeeded(apiRes)
        if(configManager.active().isDebugging)
          console.log({processChatStream:{ done, cancelled, reqId }})
        if(cancelled)
          apiRes.write(`\ndata: [CANCELLED:${reqId}]\n\n`)
        apiRes.write(`data: [DONE:${reqId}]\n\n`);
        apiRes.end();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      if(onChunk && await onChunk(chunk))
        return

      chunk.split("\n").forEach(async (line) => {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              sendStreamHeadersIfNeeded(apiRes)
              if (!apiRes.write("data: "+JSON.stringify({delta: data.delta, cid: data.content_index}) + "\n")) {
                if (!isDraining) {
                  isDraining = true
                  apiRes.on("drain", ()=>{isDraining = false})
                }
                await new Promise((resolve) => {apiRes.once("drain", resolve);}); 
              }
              onChunkDelta && await onChunkDelta(data.delta)
            }
          } catch(ex) {
            console.error({chunkSend: ex})
          }
        }
      });  
    }
  } catch (ex) {
    console.error({processStream: ex})

    if (onError && await onError(ex))
      return

    if (!apiRes.headersSent) 
      apiRes.status(500).json({ error: ex.message });
    else {
      apiRes.write("data: [STREAM ERROR]: " + ex.message)
      apiRes.end()
    }
  }
}


const startTime = new Date()
const installedMonitors = new Set()

function installMonitor(server) {
  if(installedMonitors.has(server.url)) return

  return

  installedMonitors.add(server.url)
  setInterval(async ()=>{

    if(activeRequests.has(server.url)) {
      let over5Sec = 0
      let over10Sec = 0
      let over20Sec = 0
      let over30Sec = 0
      let over60Sec = 0
      let maxMessageLen=0
      let longestMessage = ""
      let messages = new Set
      let duplicateMessagesCount = 0
      let duplicateMessages = new Map
      let SumActiveMessageLen = 0

      const uaq = activeRequests.get(server.url)
      const now = Date.now()
      for (const reqId of uaq.keys()) {
        const req = uaq.get(reqId)
        if(now - req.time > 60 * 1000) over60Sec++
        else if(now - req.time > 30 * 1000) over30Sec++
        else if(now - req.time > 20 * 1000) over20Sec++
        else if(now - req.time > 10 * 1000) over10Sec++
        else if(now - req.time > 5  * 1000) over5Sec++

        if(server.maxDelayed &&  now - req.time > server.maxDelayed * 1000) 
          stopRequest(server.url, reqId)
        
        SumActiveMessageLen += req.msg.length
        if(req.msg.length > maxMessageLen) {
          maxMessageLen = req.msg.length
          longestMessage = req.msg
        }
        if(messages.has(req.msg)){
          duplicateMessagesCount++
          duplicateMessages.set(req.msg, (duplicateMessages.has(req.msg) ? duplicateMessages.get(req.msg) : 1) + 1)
        }
        messages.add(req.msg)
      }
      dupMessageStr = ''
      duplicateMessages.forEach((v, k)=>dupMessageStr += `[${v}: ${k.length}] ${stripText(k)}\n`)
      //return
      console.log(`==========> ${new Date()} <==========
Monitoring ${server.url}: Started @ ${startTime.toLocaleString('fa-IR')}
     Total: ${totalRequests.get(server.url)}, Stopped: ${stoppedRequests.get(server.url)}, Active: ${uaq.size}
   Delayed: +60s: ${over60Sec}, +30s: ${over30Sec}, +20s: ${over20Sec}, +10s: ${over10Sec}, +5s: ${over5Sec}
    SumLen: ${SumActiveMessageLen}, maxLen: ${maxMessageLen ? maxMessageLen + " ->" : "0"} ${maxMessageLen ? stripText(longestMessage):""}
  dupCount: ${duplicateMessagesCount} ${duplicateMessagesCount ? `->\n ${dupMessageStr}`: ""}
`)
      if(over60Sec > configManager.active().app.watchdogMaxTrigger)
          throw new Error("WATCHDOG TRIGGERED")
      await showMetrics(server)
    }
  }, 1000)
}

module.exports = {
   startNewChat ,
   checkRequestState,
   stopRequest,
   removeActiveRequest,
   installMonitor,
   genReqId: (usr_key)=>md5(uuidv4()+ "_" + usr_key)
};