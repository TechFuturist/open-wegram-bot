# 海角套壳 · Android

把海角站点的 m3u8 用户脚本装进一个独立 App：不用装 Kiwi/Tampermonkey，脚本在 **document-start** 阶段注入（等同油猴的 `document-start`），支持**脚本自动更新**和**账号注入槽**（脚本更新后账号不会丢）。

## 功能

| 能力 | 说明 |
| --- | --- |
| document-start 注入 | 用 AndroidX WebKit 的 `addDocumentStartJavaScript`，页面脚本执行前就到位；老 WebView 自动降级为「页面开始注入」 |
| 脚本自动更新 | 启动时若超过 `checkHours` 就拉一次远端（`scriptUrls` 依次尝试），失败自动沿用缓存/内置副本 |
| 凭据注入槽 | 把账号密码写进脚本 `HJ_ACCOUNT` 槽再注入；**换账号只需在菜单「账号设置」改一次**，脚本更新不覆盖 |
| GM_* 兼容 | `GM_getValue/setValue/deleteValue/listValues/addStyle/xmlhttpRequest`，并预留新版 `GM.*` 命名空间 |
| 跨域请求 | `GM_xmlhttpRequest` 走原生 HttpURLConnection（自动带 WebView 的 Cookie），不受页面 CORS 限制 |
| 下载落地 | http(s) 走系统 DownloadManager；blob: 由页面读成 base64 交原生写入 `Download/` |
| **播放全屏** | 壳实现了 `onShowCustomView/onHideCustomView`：站点播放器的全屏按钮真的能用了（横屏 + 沉浸式 + 常亮） |
| **播放增强** | 播放器右上角工具条：全屏／网页全屏／影院／画中画／倍速；视频未就绪时按 16:9 兜底，不再出现被压扁的横条 |
| 多入口 | 菜单「切换入口地址」在主站与镜像域名间切换 |
| 深链打开 | `adb shell am start -n com.haijiao.shell/.MainActivity --es url "https://haijiao.com/video/watch?id=9624"` |
| 配置外置 | `Download/config.json` 或 `/sdcard/Android/data/com.haijiao.shell/files/config.json` 覆盖内置配置 |

## 菜单

- **重新加载**：重载当前页面
- **检查脚本更新**：强制拉一次远端脚本，然后重载
- **账号设置**：填账号密码（写进 `HJ_ACCOUNT`），保存后自动重载
- **切换入口地址**：主站 / 镜像
- **导出配置文件**：把内置 config.json 写到外部目录供编辑
- **状态 / 关于**：脚本版本、来源、凭据注入状态、document-start 支持情况
- **清空脚本存储**：清 GM 存储与 WebStorage

## 构建

APK 由 GitHub Actions 构建（本机不需要 Android SDK）：

- 工作流：`.github/workflows/build-apk.yml`
- 触发：推送到分支 `haijiao-shell-android`（或手动 workflow_dispatch）
- 产物：`dist/haijiao-shell.apk`（同时作为 artifact 上传，并被自动提交回分支，方便无 token 取回）

本地构建（可选，需自备 JDK17 + Android SDK 35）：

```bash
cd android && gradle assembleDebug
```

## 账号安全

仓库里的 `assets/config.json` **不含**账号密码（留空）。账号两种填法：

1. App 内菜单「账号设置」（存 SharedPreferences，只在本机）
2. 把 `config.json` 放到 `Download/` 或 App 外部私有目录，填好 `account` 两行

## 目录

```
android/
├─ app/src/main/java/com/haijiao/shell/MainActivity.java   WebView + 注入 + 菜单
├─ app/src/main/java/com/haijiao/shell/GmBridge.java       GM_* 原生后端（存储/请求/下载）
├─ app/src/main/java/com/haijiao/shell/Config.java         配置加载与合并
├─ app/src/main/assets/gm-shim.js                          GM_* JS 垫片
├─ app/src/main/assets/bundled.user.js                     内置脚本副本（离线回退）
└─ app/src/main/assets/config.json                         默认配置（无账号）
```

---
套壳 v1.0.0 · 脚本来源：Greasy Fork #583742（m3u8提取+去广告+自动展开完整贴文+拦截登录弹窗+TS下载）
