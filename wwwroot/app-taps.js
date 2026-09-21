import { createGarden } from './garden-scene.js?v=note-lights-2';
const $=id=>document.getElementById(id);
let garden, mode='idle', context=null, stream=null, source=null, capture=null, cameraStream=null;
let generation=0, revision=0, frames=[], timer=null, posting=false, session=null, heard=0, disposed=false, cameraStarting=false;
const message=text=>{$('notice').textContent=text;$('notice').hidden=!text;};
try {garden=createGarden($('garden'));}catch(error){message('3D rendering could not start. Try Chrome or Edge.');$('listen').disabled=true;$('test').disabled=true;}
function status(text){$('mode').textContent=text;$('sound-state').textContent=text;}
async function listInputs(){
    const devices=await navigator.mediaDevices.enumerateDevices(),selected=$('source').value;
    $('source').replaceChildren(new Option('Default input',''));
    devices.filter(d=>d.kind==='audioinput').forEach((d,i)=>$('source').add(new Option(d.label||`Input ${i+1}`,d.deviceId)));
    if([...$('source').options].some(o=>o.value===selected))$('source').value=selected;
}
async function stop(){
    generation++;clearInterval(timer);timer=null;frames=[];const oldSession=session;session=null;mode='idle';if(oldSession)fetch('/api/listen/'+oldSession,{method:'DELETE'}).catch(()=>{});
    if(capture){capture.port.onmessage=null;capture.disconnect();capture=null;}
    source?.disconnect();source=null;stream?.getTracks().forEach(t=>t.stop());stream=null;
    const old=context;context=null;if(old&&old.state!=='closed')await old.close();
    $('listen').textContent='♪ Listen';$('source').disabled=false;$('test').disabled=false;
    $('meter-fill').style.width='0%';status(heard?`${heard} plants · stopped`:'Ready');
}
async function sendBatch(token){
    if(posting||!frames.length||token!==generation)return;
    posting=true;const batch=frames.splice(0,4),version=revision;const pcm=new ArrayBuffer(batch.length*1024),view=new DataView(pcm);let at=0;for(const block of batch)for(const sample of block.samples){view.setInt16(at,sample,true);at+=2;}
    try{
        const response=await fetch(`/api/audio/${session}?sampleRate=16000&sequence=${batch[0].sequence}&gain=${Number($('gain').value)}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:pcm,signal:AbortSignal.timeout(5000)});
        if(!response.ok)throw new Error('The tap detector disconnected.');
        const result=await response.json();if(token!==generation||version!==revision)return;
        for(const event of result.events){garden.addTap(event.color,event.strength,event.kind,event.size,event.brightness,event.attack);heard++;$('empty-hint').hidden=true;$('analysis').textContent=`${event.sound} · ${event.pitchHz>0?Math.round(event.pitchHz)+' Hz':'unpitched'} · brightness ${Math.round(event.centroidHz)} Hz`;}
        status(result.calibrating?'One quiet moment…':`${mode==='test'?'Test signal': 'Listening'} · ${heard} ${heard===1?'plant':'plants'}`);
    }catch(error){if(token===generation){await stop();message('Audio connection stopped. Click Listen to reconnect.');}}
    finally{posting=false;}
}
async function start(test=false){
    if(mode!=='idle'){await stop();if(!test)return;}
    const token=++generation;mode='starting';message('');$('listen').textContent='Cancel';$('test').disabled=true;status('Connecting…');
    let acquired=null;
    try{
        const localContext=new AudioContext({sampleRate:16000});context=localContext;await localContext.resume();
        if(token!==generation)return;if(localContext.sampleRate!==16000)throw new Error('16 kHz audio is unavailable. Try Chrome or Edge.');
        if(!test){
            if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone access is unavailable.');
            const device=$('source').value;
            acquired=await navigator.mediaDevices.getUserMedia({audio:{deviceId:device?{exact:device}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
            if(token!==generation){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;
        }
        await localContext.audioWorklet.addModule('/tap-capture.js');if(token!==generation)return;
        const response=await fetch('/api/listen',{method:'POST'});if(!response.ok)throw new Error('The C# detector is unavailable.');
        const connected=await response.json();if(token!==generation)return;session=connected.id;
        capture=new AudioWorkletNode(localContext,'tap-capture');capture.connect(localContext.destination);
        capture.port.onmessage=({data})=>{
            if(token!==generation)return;
            frames.push(data);if(frames.length>24)frames.splice(0,frames.length-24);
            $('meter-fill').style.width=`${Math.min(100,data.peak*Number($('gain').value)*300)}%`;
        };
        if(test){
            const rate=localContext.sampleRate,buffer=localContext.createBuffer(1,rate*4,rate),samples=buffer.getChannelData(0);
            for(let i=0;i<1600;i++){const t=i/rate;samples[12800+i]=.25*Math.sin(2*Math.PI*140*t)*Math.exp(-t*60);}
            let previous=0;for(let i=0;i<1200;i++){const t=i/rate,noise=Math.random()*2-1;samples[25600+i]=.24*(noise-previous)*Math.exp(-t*55);previous=noise;}
            for(let i=0;i<11200;i++){const t=i/rate,fade=Math.min(1,t/.045)*Math.min(1,(.7-t)/.06);samples[38400+i]=fade*(.14*Math.sin(2*Math.PI*220*t)+.035*Math.sin(2*Math.PI*440*t));}
            source=localContext.createBufferSource();source.buffer=buffer;source.connect(capture);source.start();
            source.onended=()=>setTimeout(()=>{if(token===generation)stop();},350);
        }else{
            source=localContext.createMediaStreamSource(acquired);source.connect(capture);
            await listInputs();if(token!==generation)return;
            acquired.getAudioTracks()[0].addEventListener('ended',()=>{if(token===generation){stop();message('Microphone disconnected. Choose an input and try again.');}});
        }
        mode=test?'test':'live';$('listen').textContent='■ Stop';$('source').disabled=true;status(test?'Test signal':'One quiet moment…');
        timer=setInterval(()=>sendBatch(token),48);
    }catch(error){
        acquired?.getTracks().forEach(t=>t.stop());if(token!==generation)return;await stop();
        message(error.name==='NotAllowedError'?'Allow microphone access, then tap your desk. If this browser blocks it, open http://localhost:5196 in Chrome or Edge.':`Could not start: ${error.message}`);
    }
}
$('listen').addEventListener('click',()=>start());
$('test').addEventListener('click',()=>start(true));
$('reset').addEventListener('click',()=>{revision++;frames=[];heard=0;garden.clear();$('empty-hint').hidden=false;status(mode==='live'?'Listening · 0 plants':'Ready');});
$('view').addEventListener('click',()=>garden.resetView());
$('rotate').addEventListener('change',()=>garden?.setAutoRotate($('rotate').checked));
$('camera').addEventListener('click',async()=>{
    if(cameraStarting)return;
    if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;$('video').srcObject=null;$('video').hidden=true;$('camera-empty').hidden=false;$('camera').textContent='Enable camera';$('camera-state').textContent='Camera off';return;}
    cameraStarting=true;$('camera').disabled=true;
    try{const acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:960},height:{ideal:720}},audio:false});if(disposed){acquired.getTracks().forEach(t=>t.stop());return;}cameraStream=acquired;$('video').srcObject=acquired;await $('video').play();$('video').hidden=false;$('camera-empty').hidden=true;$('camera').textContent='Camera off';$('camera-state').textContent='You · live';}
    catch(error){cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null;message('Camera unavailable. You can still use the microphone to grow the garden.');}
    finally{cameraStarting=false;$('camera').disabled=false;}
});
window.addEventListener('pagehide',()=>{disposed=true;stop();cameraStream?.getTracks().forEach(t=>t.stop());garden?.dispose();});
navigator.mediaDevices?.addEventListener('devicechange',()=>listInputs().catch(()=>{}));
