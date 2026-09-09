const KEYS=['gaojiPublisherSync','gaojiOmegaSync'];
function deliver(payload){if(!payload)return;document.documentElement.setAttribute('data-gaoji-extension-sync',encodeURIComponent(JSON.stringify(payload)));document.dispatchEvent(new Event('gaoji-extension-sync'))}
function load(){chrome.storage.local.get(KEYS,result=>{deliver(result.gaojiPublisherSync||result.gaojiOmegaSync)})}
document.addEventListener('gaoji-extension-request',load);
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;for(const key of KEYS)if(changes[key]?.newValue){deliver(changes[key].newValue);break}});
load();
