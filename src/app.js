import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

const $ = (id) => document.getElementById(id);
let currentUrl = "";
let currentTask = null;

function log(message) {
  const el = $("log");
  el.textContent += `[${new Date().toLocaleTimeString()}] ${message}\n`;
  el.scrollTop = el.scrollHeight;
}
function status(message) { $("status").textContent = message; }
function setBusy(busy) { $("analyzeBtn").disabled = busy; $("downloadBtn").disabled = busy; }

async function init() {
  await listen("download-progress", ({ payload: p }) => {
    $("progressPanel").classList.remove("hidden");
    const percent = Math.max(0, Math.min(100, p.percent || 0));
    $("percent").textContent = `${percent.toFixed(1)}%`;
    $("progressBar").style.width = `${percent}%`;
    $("speed").textContent = p.speed || "—";
    $("size").textContent = p.downloaded || "—";
    $("eta").textContent = p.eta ? `ETA ${p.eta}` : "—";
    $("progressText").textContent = p.phase === "postprocess" ? "處理檔案中…" : "下載中…";
  });
  await listen("download-log", ({ payload }) => log(payload));
  await listen("download-finished", ({ payload }) => {
    currentTask = null; setBusy(false); $("cancelBtn").disabled = false;
    $("progressText").textContent = payload.success ? "下載完成" : "下載失敗";
    status(payload.success ? "下載完成" : "下載失敗，請查看活動記錄");
    log(payload.success ? `完成：${payload.path || ""}` : `失敗：${payload.error || "未知錯誤"}`);
  });
}

$("analyzeBtn").onclick = async () => {
  const url = $("urlInput").value.trim();
  if (!url) return status("請先輸入網址");
  currentUrl = url; setBusy(true); status("正在解析…"); log(`解析：${url}`);
  try {
    const info = await invoke("analyze_url", { url });
    $("thumbnail").src = info.thumbnail || "";
    $("title").textContent = info.title || "未知標題";
    $("channel").textContent = info.uploader || info.channel || "未知頻道";
    $("duration").textContent = info.duration_string || "—";
    $("videoId").textContent = info.id ? `ID: ${info.id}` : "";
    $("videoCard").classList.remove("hidden"); $("downloadPanel").classList.remove("hidden");
    status("解析完成"); log(`標題：${info.title || "未知"}`);
  } catch (e) { status("解析失敗"); log(`解析錯誤：${e}`); }
  finally { setBusy(false); }
};

$("folderBtn").onclick = async () => {
  const selected = await open({ directory: true, multiple: false, title: "選擇下載資料夾" });
  if (selected) $("outputDir").value = selected;
};

$("downloadBtn").onclick = async () => {
  const outputDir = $("outputDir").value.trim();
  if (!outputDir) return status("請先選擇下載資料夾");
  if (!currentUrl) return status("請先解析網址");
  setBusy(true); status("開始下載…"); $("progressPanel").classList.remove("hidden");
  try {
    currentTask = await invoke("start_download", { url: currentUrl, outputDir, format: $("format").value });
    log(`開始下載，格式：${$("format").value}`);
  } catch (e) { setBusy(false); status("無法開始下載"); log(`啟動錯誤：${e}`); }
};

$("cancelBtn").onclick = async () => {
  if (!currentTask) return;
  $("cancelBtn").disabled = true;
  try { await invoke("cancel_download", { taskId: currentTask }); log("已要求取消下載"); }
  catch (e) { log(`取消失敗：${e}`); $("cancelBtn").disabled = false; }
};
$("clearLog").onclick = () => $("log").textContent = "";
init();