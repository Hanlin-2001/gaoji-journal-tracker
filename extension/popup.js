const DEFAULT_SITE='https://gaoji-journal-track.de5.net/';
const input=document.getElementById('site-url');
const message=document.getElementById('message');
chrome.storage.local.get(['gaojiPublisherSync','gaojiOmegaSync','gaojiTrackerUrl'],result=>{
  const payload=result.gaojiPublisherSync||result.gaojiOmegaSync;
  input.value=result.gaojiTrackerUrl||DEFAULT_SITE;
  document.getElementById('status').textContent=payload?.syncedAt?`最近同步 ${Array.isArray(payload.manuscripts)?payload.manuscripts.length:0} 篇：${new Date(payload.syncedAt).toLocaleString()}`:'尚未同步。请进入 Omega 作者工作台并打开稿件状态列表。';
});
async function saveSite(){
  try{
    const url=new URL(input.value.trim());
    if(!['https:','http:'].includes(url.protocol))throw new Error();
    const origin=`${url.protocol}//${url.host}/*`;
    const granted=await chrome.permissions.request({origins:[origin]});
    if(!granted){message.textContent='未获得该网址的访问权限。';return false}
    await chrome.storage.local.set({gaojiTrackerUrl:url.href});
    await chrome.runtime.sendMessage({type:'configure-tracker',url:url.href});
    message.textContent='网址已保存，插件可以连接新网站。';
    return true;
  }catch{message.textContent='请输入完整网址，例如 https://example.com/';return false}
}
document.getElementById('save-site').addEventListener('click',saveSite);
document.getElementById('open-site').addEventListener('click',async()=>{if(await saveSite())chrome.tabs.create({url:new URL(input.value.trim()).href})});
