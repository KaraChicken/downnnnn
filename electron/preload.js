const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("ytDlp", {
  selectFolder:()=>ipcRenderer.invoke("select-folder"),
  analyzeUrl:url=>ipcRenderer.invoke("analyze-url",url),
  startDownload:payload=>ipcRenderer.invoke("start-download",payload),
  cancelDownload:taskId=>ipcRenderer.invoke("cancel-download",taskId),
  onProgress:callback=>ipcRenderer.on("download-progress",(_e,p)=>callback(p)),
  onLog:callback=>ipcRenderer.on("download-log",(_e,p)=>callback(p)),
  onFinished:callback=>ipcRenderer.on("download-finished",(_e,p)=>callback(p))
});
