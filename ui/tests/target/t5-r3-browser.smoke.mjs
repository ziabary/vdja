import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,X509Certificate} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import WebSocket from 'ws';

async function until(work,label,attempts=150){for(let attempt=0;attempt<attempts;attempt++){
  try{const value=await work();if(value)return value;}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
}throw new Error(`TIMEOUT: ${label}`);}

test('legacy RAG browser route, Legacy Key return and optional real document answer',
  {skip:process.env.T5_R3_REQUIRE_BROWSER!=='1',timeout:180000},async()=>{
    const cert=new X509Certificate(await readFile('.secrets.t3.local/rag-dev-cert.pem'));
    const pin=createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('base64');
    const root=await mkdtemp(join(tmpdir(),'t5-r3-browser-'));
    const file=join(root,'rag-parity-synthetic.txt');
    await writeFile(file,'The synthetic project codename is BLUE-HERON-742. This is a non-confidential browser smoke document.\n');
    const chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
      '--no-first-run',`--ignore-certificate-errors-spki-list=${pin}`,'--no-proxy-server',
      '--host-resolver-rules=MAP app.localhost 127.0.0.1,MAP auth.localhost 127.0.0.1',
      '--remote-debugging-port=0',`--user-data-dir=${join(root,'profile')}`,'about:blank'],{stdio:'ignore'});
    let socket;
    try{
      const port=Number((await until(()=>readFile(join(root,'profile','DevToolsActivePort'),'utf8'),'Chrome startup')).split('\n')[0]);
      const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page=pages.find(item=>item.type==='page');assert.ok(page?.webSocketDebuggerUrl);
      socket=new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
      let next=0;const pending=new Map();
      socket.on('message',raw=>{const message=JSON.parse(raw.toString());if(!message.id)return;
        const entry=pending.get(message.id);if(!entry)return;pending.delete(message.id);
        if(message.error)entry.reject(new Error(message.error.message));else entry.resolve(message.result);});
      const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
      const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
        if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;};
      await send('Page.enable');await send('Runtime.enable');await send('DOM.enable');
      await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
      await send('Page.navigate',{url:'https://app.localhost:5173/rag'});
      await until(()=>evaluate('location.pathname === "/login" && location.search.includes("back=rag")'),'RAG login redirect');
      await until(()=>evaluate('document.querySelector("#login-legacy-key") !== null'),'legacy key form');
      await until(()=>evaluate('!document.querySelector("form button[type=submit]")?.disabled'),'login readiness');
      assert.equal(await evaluate('document.querySelector(".login-actions button[type=button]")?.textContent.includes("تولید کلید جدید")'),true);
      await evaluate('document.querySelector(".login-actions button[type=button]").click()');
      assert.equal(await evaluate('document.querySelector("#login-legacy-key").value.length'),32);
      await evaluate('document.querySelector("form button[type=submit]").click()');
      await until(()=>evaluate('location.pathname === "/rag" && document.querySelector("#rag-question") !== null'),'RAG workspace');
      const view=await evaluate('document.body.innerText');
      assert.match(view,/چت‌های شما/);assert.match(view,/اسناد شما/);assert.match(view,/سایر خدمات/);
      const emptyComposer=await evaluate('(()=>{const box=document.querySelector("#rag-question").getBoundingClientRect();return{top:box.top,height:innerHeight,centered:document.querySelector(".rag-main").classList.contains("rag-start")};})()');
      assert.ok(emptyComposer.centered&&emptyComposer.top>emptyComposer.height*.25&&emptyComposer.top<emptyComposer.height*.75,'empty composer should be near the middle');
      if(process.env.T5_R3_SCREENSHOT_PATH){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
        await writeFile(process.env.T5_R3_SCREENSHOT_PATH,Buffer.from(shot.data,'base64'));}
      if(process.env.T5_R3_REQUIRE_MODEL!=='1'){
        console.log('RAG_BROWSER_LOGIN_AND_LAYOUT=PASS ACTUAL_MODEL_FLOW=NOT_VERIFIED');return;
      }
      assert.ok(!view.includes('مدل موردنیاز برای پرسش از اسناد هنوز تنظیم نشده است.'),'real model bindings required');
      await until(()=>evaluate('!document.querySelector("#rag-new-chat")?.disabled'),'personal RAG ready');
      await evaluate('document.querySelector("#rag-new-chat").click()');
      await until(()=>evaluate('document.querySelectorAll(".rag-row.active").length===1'),'new chat');
      const dom=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#rag-upload'});
      await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});
      await until(()=>evaluate('document.body.innerText.includes("rag-parity-synthetic.txt")'),'document sidebar',300);
      await until(()=>evaluate('document.querySelector(".rag-sidebar")?.innerText.includes("آماده")'),'document processing',300);
      await evaluate(`(()=>{const input=document.querySelector('#rag-question');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'What is the synthetic project codename?');
        input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#rag-send').click();return true;})()`);
      await until(()=>evaluate('document.querySelectorAll(".rag-assistant .markdown-view").length>0'),'answer',300);
      const answeredComposer=await evaluate('(()=>{const box=document.querySelector("#rag-question").getBoundingClientRect();return{bottom:box.bottom,height:innerHeight,centered:document.querySelector(".rag-main").classList.contains("rag-start")};})()');
      assert.ok(!answeredComposer.centered&&answeredComposer.height-answeredComposer.bottom<150,'answered composer should stay at the bottom');
      await until(()=>evaluate('document.querySelector(".rag-citations button") !== null'),'authorized citation',300);
      assert.match(await evaluate('document.querySelector(".rag-assistant").innerText'),/BLUE-HERON-742/);
      await send('Page.reload');
      await until(()=>evaluate('location.pathname==="/rag" && document.body.innerText.includes("rag-parity-synthetic.txt")'),'document persists');
      await until(()=>evaluate('document.querySelector(".rag-row-main") !== null'),'chat persists');
      await evaluate('document.querySelector(".rag-row-main").click()');
      await until(()=>evaluate('document.querySelectorAll(".rag-message").length>=2'),'messages persist');
      await evaluate('document.querySelector("#rag-new-chat").click()');
      await until(()=>evaluate('document.querySelectorAll(".rag-message").length===0'),'new chat clears transcript');
      console.log('RAG_BROWSER_END_TO_END=PASS');
    }finally{socket?.close();chrome.kill('SIGTERM');await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);
      await rm(root,{recursive:true,force:true}).catch(()=>{});}
  });
