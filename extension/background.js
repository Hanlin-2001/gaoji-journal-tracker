async function register(url){
  try{
    const parsed=new URL(url),match=`${parsed.protocol}//${parsed.host}/*`;
    const existing=await chrome.scripting.getRegisteredContentScripts();
    if(existing.some(x=>x.id==='gaoji-site-bridge'))await chrome.scripting.unregisterContentScripts({ids:['gaoji-site-bridge']});
    await chrome.scripting.registerContentScripts([{id:'gaoji-site-bridge',matches:[match],js:['site-bridge.js'],runAt:'document_idle'}]);
  }catch{}
}
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='configure-tracker')return register(message.url)});
chrome.runtime.onStartup.addListener(()=>chrome.storage.local.get('gaojiTrackerUrl',r=>r.gaojiTrackerUrl&&register(r.gaojiTrackerUrl)));
chrome.runtime.onInstalled.addListener(()=>chrome.storage.local.get('gaojiTrackerUrl',r=>r.gaojiTrackerUrl&&register(r.gaojiTrackerUrl)));
