const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const tasks = new Map();

function binary(name) {
  const packaged = path.join(process.resourcesPath, "bin", name);
  const dev = path.join(__dirname, "..", "bin", name);
  const candidate = app.isPackaged ? packaged : dev;
  if (!fs.existsSync(candidate)) throw new Error("找不到 " + name + "，請放入 bin/ 資料夾。");
  return candidate;
}
function createWindow() {
  const win = new BrowserWindow({
    width: 960, height: 820, minWidth: 620, minHeight: 650,
    backgroundColor: "#0b0f14",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.loadFile(path.join(__dirname, "..", "index.html"));
}
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"], title: "選擇下載資料夾" });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("analyze-url", async (_event, url) => {
  if (!/^https?:\/\//i.test(url)) throw new Error("只接受 http/https 網址");
  const ytdlp = binary(process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp");
  return new Promise((resolve, reject) => {
    execFile(ytdlp, ["--no-warnings","--skip-download","--dump-single-json","--no-playlist",url],
      { windowsHide: true, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr.trim() || error.message));
        try {
          const v = JSON.parse(stdout);
          resolve({id:v.id,title:v.title,uploader:v.uploader,channel:v.channel,thumbnail:v.thumbnail,duration_string:v.duration_string});
        } catch (e) { reject(new Error("JSON 解析失敗：" + e.message)); }
      });
  });
});
function formatArgs(format) {
  switch (format) {
    case "1080": return ["-f","bestvideo[height<=1080]+bestaudio/best[height<=1080]"];
    case "720": return ["-f","bestvideo[height<=720]+bestaudio/best[height<=720]"];
    case "480": return ["-f","bestvideo[height<=480]+bestaudio/best[height<=480]"];
    case "360": return ["-f","bestvideo[height<=360]+bestaudio/best[height<=360]"];
    case "audio": return ["-f","bestaudio/best","-x","--audio-format","m4a"];
    case "mp3": return ["-f","bestaudio/best","-x","--audio-format","mp3","--audio-quality","0"];
    default: return ["-f","bestvideo+bestaudio/best"];
  }
}
ipcMain.handle("start-download", async (event, {url,outputDir,format}) => {
  if (!/^https?:\/\//i.test(url)) throw new Error("只接受 http/https 網址");
  if (!fs.existsSync(outputDir)) throw new Error("下載資料夾不存在");
  const ytdlp=binary(process.platform==="win32"?"yt-dlp.exe":"yt-dlp");
  let ffmpeg=null; try { ffmpeg=binary(process.platform==="win32"?"ffmpeg.exe":"ffmpeg"); } catch {}
  const taskId=String(Date.now())+Math.random().toString(36).slice(2,8);
  const template=path.join(outputDir,"%(title)s [%(id)s].%(ext)s");
  const args=["--newline","--no-playlist","--progress-template","%(progress._percent_str)s|%(progress._speed_str)s|%(progress._downloaded_bytes_str)s|%(progress._eta_str)s","-o",template,...formatArgs(format)];
  if(ffmpeg) args.push("--ffmpeg-location",ffmpeg);
  args.push("--",url);
  const child=spawn(ytdlp,args,{windowsHide:true}); tasks.set(taskId,child);
  const sendLog=line=>event.sender.send("download-log",line);
  const parseLine=line=>{const p=line.split("|");if(p.length<4)return;event.sender.send("download-progress",{percent:Number.parseFloat(p[0].replace(/[^0-9.]/g,""))||0,speed:p[1].trim()||"—",downloaded:p[2].trim()||"—",eta:p[3].trim()||"—"});};
  child.stdout.on("data",d=>String(d).split(/\r?\n/).filter(Boolean).forEach(l=>{sendLog(l);parseLine(l);}));
  child.stderr.on("data",d=>String(d).split(/\r?\n/).filter(Boolean).forEach(sendLog));
  child.on("error",e=>{tasks.delete(taskId);event.sender.send("download-finished",{success:false,error:e.message});});
  child.on("close",code=>{tasks.delete(taskId);event.sender.send("download-finished",{success:code===0,path:outputDir,error:code===0?null:"yt-dlp 結束碼："+code});});
  return taskId;
});
ipcMain.handle("cancel-download",async(_event,taskId)=>{const child=tasks.get(taskId);if(!child)throw new Error("找不到下載任務");child.kill();return true;});
app.whenReady().then(()=>{createWindow();app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
