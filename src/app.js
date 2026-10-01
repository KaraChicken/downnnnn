const $=id=>document.getElementById(id);
let currentUrl="",currentTask=null;
function log(message){const el=$("log");el.textContent+="["+new Date().toLocaleTimeString()+"] "+message+"\n";el.scrollTop=el.scrollHeight;}
function status(message){$("status").textContent=message;}
function setBusy(busy){$("analyzeBtn").disabled=busy;$("downloadBtn").disabled=busy;}
window.ytDlp.onProgress(p=>{$("progressPanel").classList.remove("hidden");const n=Math.max(0,Math.min(100,p.percent||0));$("percent").textContent=n.toFixed(1)+"%";$("progressBar").style.width=n+"%";$("speed").textContent=p.speed||"—";$("size").textContent=p.downloaded||"—";$("eta").textContent=p.eta?"ETA "+p.eta:"—";});
window.ytDlp.onLog(p=>log(p));
window.ytDlp.onFinished(p=>{currentTask=null;setBusy(false);$("cancelBtn").disabled=false;$("progressText").textContent=p.success?"下載完成":"下載失敗";status(p.success?"下載完成":"下載失敗，請查看活動記錄");log(p.success?"完成："+(p.path||""):"失敗："+(p.error||"未知錯誤"));});
$("analyzeBtn").onclick=async()=>{const url=$("urlInput").value.trim();if(!url)return status("請先輸入網址");currentUrl=url;setBusy(true);status("正在解析…");log("解析："+url);try{const i=await window.ytDlp.analyzeUrl(url);$("thumbnail").src=i.thumbnail||"";$("title").textContent=i.title||"未知標題";$("channel").textContent=i.uploader||i.channel||"未知頻道";$("duration").textContent=i.duration_string||"—";$("videoId").textContent=i.id?"ID: "+i.id:"";$("videoCard").classList.remove("hidden");$("downloadPanel").classList.remove("hidden");status("解析完成");log("標題："+(i.title||"未知"));}catch(e){status("解析失敗");log("解析錯誤："+(e.message||e));}finally{setBusy(false);}};
$("folderBtn").onclick=async()=>{const selected=await window.ytDlp.selectFolder();if(selected)$("outputDir").value=selected;};
$("downloadBtn").onclick=async()=>{const outputDir=$("outputDir").value.trim();if(!outputDir)return status("請先選擇下載資料夾");if(!currentUrl)return status("請先解析網址");setBusy(true);status("開始下載…");$("progressPanel").classList.remove("hidden");$("progressText").textContent="下載中…";try{currentTask=await window.ytDlp.startDownload({url:currentUrl,outputDir,format:$("format").value});log("開始下載，格式："+$("format").value);}catch(e){setBusy(false);status("無法開始下載");log("啟動錯誤："+(e.message||e));}};
$("cancelBtn").onclick=async()=>{if(!currentTask)return;$("cancelBtn").disabled=true;try{await window.ytDlp.cancelDownload(currentTask);log("已要求取消下載");}catch(e){log("取消失敗："+(e.message||e));$("cancelBtn").disabled=false;}};
$("clearLog").onclick=()=>$("log").textContent="";
