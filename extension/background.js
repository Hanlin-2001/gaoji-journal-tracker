const DEFAULT_SITE='https://gaoji-journal-track.de5.net/';
const LEGACY_SITES=new Set([
  'https://journal-tracker-whl-0909.lovely-fig-1475.chatgpt.site/',
  'https://hanlin-2001.github.io/gaoji-journal-tracker/'
]);
async function register(url){
  try{
    const parsed=new URL(url),match=`${parsed.protocol}//${parsed.host}/*`;
    const existing=await chrome.scripting.getRegisteredContentScripts();
    if(existing.some(x=>x.id==='gaoji-site-bridge'))await chrome.scripting.unregisterContentScripts({ids:['gaoji-site-bridge']});
    if(parsed.origin===new URL(DEFAULT_SITE).origin)return;
    await chrome.scripting.registerContentScripts([{id:'gaoji-site-bridge',matches:[match],js:['site-bridge.js'],runAt:'document_idle'}]);
  }catch{}
}
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='configure-tracker')return register(message.url)});
chrome.runtime.onStartup.addListener(()=>chrome.storage.local.get('gaojiTrackerUrl',r=>r.gaojiTrackerUrl&&register(r.gaojiTrackerUrl)));
chrome.runtime.onInstalled.addListener(()=>chrome.storage.local.get('gaojiTrackerUrl',async r=>{
  const url=!r.gaojiTrackerUrl||LEGACY_SITES.has(r.gaojiTrackerUrl)?DEFAULT_SITE:r.gaojiTrackerUrl;
  if(url!==r.gaojiTrackerUrl)await chrome.storage.local.set({gaojiTrackerUrl:url});
  await register(url);
}));
