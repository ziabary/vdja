const { v4: uuidv4 } = require("uuid");

const activeRequests = new Map()
const totalRequests = new Map()
const stoppedRequests = new Map()

async function callVLLMStream(url, model, messages, params = {}) {
  const defaultParams = {
    max_tokens: 1500,
    temperature: 0.4,
    stream: true,
    ...params,
  };

  const response = await fetch(`${url}v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      ...defaultParams
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`vLLM error ${response.status}: ${errorText}`);
  }

  return response;
}

async function newCallVLLMStream(url, model, request_id, messages, params = {}) {
  const defaultParams = {
    temperature: 0.4,
    stream: params.stream,
    store:true,
    background: true,
    max_output_tokens: params.max_tokens || 2000,
  };

  const response = await fetch(`${url}v1/responses/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: messages,
      ...defaultParams,
      request_id
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`vLLM error ${response.status}: ${errorText}`);
  }
  if(process.env.DEBUG_MODE)
    console.log({started: request_id, msg: messages[messages.length-1].content.substring(0,50)})
  if(!activeRequests.get(url))   activeRequests.set(url, new Map());
  if(!totalRequests.get(url))    totalRequests.set(url, 0);
  if(!stoppedRequests.get(url))  stoppedRequests.set(url, 0);
  
  activeRequests.get(url).set(request_id, {
    time: Date.now(), 
    stream: defaultParams.stream,
    msg: messages[messages.length - 1].content
  });
  totalRequests.set(url, totalRequests.get(url)+1)

  return response;
}

function removeActiveRequest(url, reqID) {
  if(activeRequests.has(url)) {
    const ubar = activeRequests.get(url)
    if(ubar.has(reqID)) {
      ubar.delete(reqID)
    }
  }
}

async function checkRequestState(url, reqID) {
  try{
    const resp = await fetch(`${url}v1/responses/${reqID}`, {
      headers: { "Content-Type": "application/json" },
    });

    const json = (await resp.json())
    return json.status
  }catch(e){ 
    console.log(e)
    return "cancelled"
  }
}

async function stopRequest(url, reqID, autoStopped = false) {
  try{
    if(activeRequests.has(url) && activeRequests.get(url).has(reqID)) {
      const resp = await fetch(`${url}v1/responses/${reqID}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if(process.env.DEBUG_MODE)
        console.log({stopping:reqID, status: resp.status})
      
      const checkRemoved = async ()=>{
        const state = await checkRequestState(url, reqID)
        if(state === "queued")
          setTimeout(checkRemoved, 1000) 
        else {
          removeActiveRequest(url, reqID)
          stoppedRequests.set(url, (stoppedRequests.get(url) || 0) + 1)
        }
      }
      setTimeout(checkRemoved, 1000);
      if(resp.status === 200)
        return "Ok"
      else 
        return "Pending"
    } else 
      return "Not running"
  } catch(e) {
    console.error({e})
    return e.messages
  }
}

async function showMetrics(url, model) {
  try{
    const resp = await fetch(`${url}metrics`);
    const metrics = await resp.text()
    metrics.split("\n").forEach(m=>{
      if(m.startsWith("vllm:num_requests_running")
        || m.startsWith("vllm:num_requests_waiting")
      ) 
      console.log(m)
    })
  }catch(e) {
    console.log(url, " DISCONNECTED:", e.message)
  }  
}

const util = require('util');
deeplog = (obj) => console.log(util.inspect(obj, { showHidden: false, depth: null, colors: true }));
const startTime = new Date()
const shortText = (text)=>text.substring(0,50).replace(/\n/g,"\\n")+(text.length>50 ? "...":"")

function installMonitor(url, model) {
  setInterval(async ()=>{

    if(activeRequests.has(url)) {
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

      const uaq = activeRequests.get(url)
      const now = Date.now()
      for (const reqId of uaq.keys()) {
        const req = uaq.get(reqId)
        if(now - req.time > 60 * 1000) over60Sec++
        else if(now - req.time > 30 * 1000) over30Sec++
        else if(now - req.time > 20 * 1000) over20Sec++
        else if(now - req.time > 10 * 1000) over10Sec++
        else if(now - req.time > 5  * 1000) over5Sec++

        if(now - req.time > 30 * 1000) 
          stopRequest(url, reqId)
        
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
      duplicateMessages.forEach((v, k)=>dupMessageStr += `[${v}: ${k.length}] ${shortText(k)}\n`)
      //return
      console.log(`==========> ${new Date()} <==========
Monitoring ${url}: Started @ ${startTime.toLocaleString('fa-IR')}
     Total: ${totalRequests.get(url)}, Stopped: ${stoppedRequests.get(url)}, Active: ${uaq.size}
   Delayed: +60s: ${over60Sec}, +30s: ${over30Sec}, +20s: ${over20Sec}, +10s: ${over10Sec}, +5s: ${over5Sec}
    SumLen: ${SumActiveMessageLen}, maxLen: ${maxMessageLen ? maxMessageLen + " ->" : "0"} ${maxMessageLen ? shortText(longestMessage):""}
  dupCount: ${duplicateMessagesCount} ${duplicateMessagesCount ? `->\n ${dupMessageStr}`: ""}
`)
      if(over60Sec > 3)
        throw Error("WATCHDOG RESTART")
      await showMetrics(url, model)
      console.log("\n")
    }
  }, 1000)
}

module.exports = {
   callVLLMStream ,
    newCallVLLMStream, 
    checkRequestState,
     stopRequest,
      removeActiveRequest,
       installMonitor
      };