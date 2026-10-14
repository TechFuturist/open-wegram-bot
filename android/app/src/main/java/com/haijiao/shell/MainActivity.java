package com.haijiao.shell;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.text.InputType;
import android.util.Log;
import android.view.KeyEvent;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebStorage;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.webkit.ScriptHandler;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 海角套壳 · Android
 * WebView + document-start 注入用户脚本（m3u8 提取/去广告/展开/TS下载），
 * 脚本自动更新（远端拉取→缓存→内置副本回退）+ 账号注入槽（脚本更新不丢账号）。
 */
public class MainActivity extends Activity {

    private static final String TAG = "hj-shell";

    private WebView webView;
    private FrameLayout rootLayout;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;
    private int originalOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
    private SharedPreferences prefs;
    private Config config;
    private GmBridge bridge;
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    private String scriptVersion = "0.0.0";
    private String scriptSource = "未加载";
    private boolean scriptPatched = false;
    private String patchStrategy = "";
    private String lastError = "";
    private long fetchedAt = 0L;
    private ScriptHandler scriptHandler;
    private boolean documentStartSupported = false;
    private boolean injected = false;

    private File cacheFile;
    private File patchedFile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("hj_shell", MODE_PRIVATE);
        config = Config.load(this, prefs);
        cacheFile = new File(getFilesDir(), "current.user.js");
        patchedFile = new File(getFilesDir(), "current.patched.js");
        scriptVersion = prefs.getString("script_version", "0.0.0");
        fetchedAt = prefs.getLong("script_fetched_at", 0L);

        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        rootLayout = new FrameLayout(this);
        webView = new WebView(this);
        rootLayout.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(rootLayout, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setupWebView();
        handleIntent(getIntent());
        loadScriptThenStart(false);
    }

    /** 支持从外部直接打开某个地址：am start --es url "https://..." */
    private void handleIntent(android.content.Intent intent) {
        if (intent == null) return;
        String u = intent.getStringExtra("url");
        if (u != null && !u.isEmpty()) {
            config.startUrl = u;
            shellLog("按 intent 打开：" + u);
        }
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String u = intent == null ? null : intent.getStringExtra("url");
        if (u != null && !u.isEmpty()) {
            config.startUrl = u;
            shellLog("按 intent 打开：" + u);
            webView.loadUrl(u);
        }
    }

    /* ------------------------------------------------------------------ */
    /* 全屏接管（HTML5 全屏 / 视频全屏都要宿主实现，否则按了没反应）        */
    /* ------------------------------------------------------------------ */

    private void applyImmersive(boolean on) {
        try {
            Window w = getWindow();
            if (on) {
                w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    w.setDecorFitsSystemWindows(false);
                    android.view.WindowInsetsController c = w.getInsetsController();
                    if (c != null) {
                        c.hide(android.view.WindowInsets.Type.systemBars());
                        c.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    }
                } else {
                    w.getDecorView().setSystemUiVisibility(
                            View.SYSTEM_UI_FLAG_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
                }
            } else {
                w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    w.setDecorFitsSystemWindows(true);
                    android.view.WindowInsetsController c = w.getInsetsController();
                    if (c != null) c.show(android.view.WindowInsets.Type.systemBars());
                } else {
                    w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
                }
            }
        } catch (Exception e) {
            shellLog("沉浸式切换失败：" + e.getMessage());
        }
    }

    private void enterFullscreenView(View view, WebChromeClient.CustomViewCallback callback) {
        if (customView != null) {
            if (callback != null) callback.onCustomViewHidden();
            return;
        }
        customView = view;
        customViewCallback = callback;
        try { originalOrientation = getRequestedOrientation(); } catch (Exception ignored) { }
        rootLayout.addView(customView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setVisibility(View.GONE);
        try { setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE); } catch (Exception ignored) { }
        applyImmersive(true);
        shellLog("进入全屏（宿主接管）");
    }

    private void exitFullscreenView() {
        if (customView == null) return;
        try { rootLayout.removeView(customView); } catch (Exception ignored) { }
        customView = null;
        webView.setVisibility(View.VISIBLE);
        if (customViewCallback != null) {
            try { customViewCallback.onCustomViewHidden(); } catch (Exception ignored) { }
            customViewCallback = null;
        }
        try { setRequestedOrientation(originalOrientation); } catch (Exception ignored) { }
        applyImmersive(false);
        shellLog("退出全屏");
    }

    /* ------------------------------------------------------------------ */
    /* WebView                                                             */
    /* ------------------------------------------------------------------ */

    private void setupWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(config.userAgent);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            s.setSafeBrowsingEnabled(false);
        }

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cm.setAcceptThirdPartyCookies(webView, true);
        }

        bridge = new GmBridge(this, webView, prefs, config.userAgent);
        webView.addJavascriptInterface(bridge, "__hjShellNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                injected = false;
                if (!documentStartSupported) {
                    // 老 WebView 兜底：页面开始时立刻补注入
                    injectLegacy();
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!documentStartSupported && !injected) injectLegacy();
                shellLog("页面加载完成：" + url);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage m) {
                if (m != null && m.message() != null && m.message().contains("海角")) {
                    shellLog("[页面] " + m.message());
                }
                return true;
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                enterFullscreenView(view, callback);
            }

            @Override
            public void onShowCustomView(View view, int requestedOrientation, CustomViewCallback callback) {
                enterFullscreenView(view, callback);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreenView();
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                // target=_blank 一律在本窗口打开，保证注入继续生效
                WebView.HitTestResult r = view.getHitTestResult();
                String url = r == null ? null : r.getExtra();
                if (url != null) {
                    view.loadUrl(url);
                    return false;
                }
                return false;
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                        String mimetype, long contentLength) {
                shellLog("[下载] 触发：" + url.substring(0, Math.min(120, url.length())));
                if (url.startsWith("blob:") || url.startsWith("data:")) {
                    saveBlobViaPage(url, mimetype, contentDisposition);
                } else {
                    downloadViaManager(url, userAgent, contentDisposition, mimetype);
                }
            }
        });

        documentStartSupported = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
        shellLog("document-start 注入支持：" + documentStartSupported
                + "（WebView " + (Build.VERSION.SDK_INT >= 26 ? WebView.getCurrentWebViewPackage() : "?") + "）");
    }

    private Set<String> originRules() {
        Set<String> set = new HashSet<>();
        if (config.matchOrigins == null || config.matchOrigins.isEmpty()) {
            set.add("*");
        } else {
            for (String o : config.matchOrigins) if (o != null && !o.isEmpty()) set.add(o);
        }
        return set;
    }

    /** 把 shim + 用户脚本 + 播放增强层注册成 document-start 注入 */
    private void applyInjection(String userScript) {
        String shim;
        try {
            shim = new String(Config.readAll(getAssets().open("gm-shim.js")), StandardCharsets.UTF_8);
        } catch (Exception e) {
            shim = "";
            shellLog("gm-shim.js 读取失败：" + e.getMessage());
        }
        String enhancer = "";
        try {
            enhancer = new String(Config.readAll(getAssets().open("enhancer.js")), StandardCharsets.UTF_8);
        } catch (Exception e) {
            shellLog("enhancer.js 读取失败：" + e.getMessage());
        }
        String full = shim + "\n;\n" + userScript + (enhancer.isEmpty() ? "" : ("\n;\n" + enhancer));
        if (documentStartSupported) {
            try {
                if (scriptHandler != null) scriptHandler.remove();
                scriptHandler = WebViewCompat.addDocumentStartJavaScript(webView, full, originRules());
                injected = true;
                shellLog("已注册 document-start 注入（" + full.length() + " 字符，范围 " + originRules() + "）");
            } catch (Exception e) {
                shellLog("注册注入失败：" + e.getMessage());
            }
        } else {
            prefs.edit().putString("pending_script", full).apply();
            shellLog("WebView 不支持 document-start，改用页面开始注入");
        }
    }

    private void injectLegacy() {
        String full = prefs.getString("pending_script", null);
        if (full == null) return;
        try {
            webView.evaluateJavascript(full, null);
            injected = true;
            shellLog("已用兜底方式注入脚本");
        } catch (Exception e) {
            shellLog("兜底注入失败：" + e.getMessage());
        }
    }

    /* ------------------------------------------------------------------ */
    /* 脚本获取 / 更新 / 凭据注入                                          */
    /* ------------------------------------------------------------------ */

    private void loadScriptThenStart(final boolean force) {
        io.execute(() -> {
            String base = null;
            String source;
            long ageH = fetchedAt > 0 ? (System.currentTimeMillis() - fetchedAt) / 3600000L : Long.MAX_VALUE;
            boolean needFetch = force || !cacheFile.isFile() || ageH >= config.checkHours;

            if (needFetch && config.autoUpdate) {
                String[] got = downloadScript();
                if (got != null) {
                    try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                        fos.write(got[0].getBytes(StandardCharsets.UTF_8));
                    } catch (Exception e) {
                        shellLog("缓存写入失败：" + e.getMessage());
                    }
                    fetchedAt = System.currentTimeMillis();
                    scriptVersion = got[1];
                    prefs.edit().putLong("script_fetched_at", fetchedAt)
                            .putString("script_version", scriptVersion).apply();
                    shellLog("脚本已更新到 v" + scriptVersion + "（来源 " + got[2] + "）");
                }
            }

            if (cacheFile.isFile()) {
                try {
                    base = readFile(cacheFile);
                    source = "远端缓存";
                } catch (Exception e) {
                    source = "读取缓存失败";
                }
            } else {
                try {
                    base = new String(Config.readAll(getAssets().open("bundled.user.js")), StandardCharsets.UTF_8);
                    source = "内置副本（离线回退）";
                    shellLog("无缓存，使用内置副本 v" + parseVersion(base));
                } catch (Exception e) {
                    source = "无可用脚本";
                }
            }

            if (base == null) {
                scriptSource = source;
                runOnUiThread(this::startPage);
                return;
            }

            scriptVersion = parseVersion(base);
            scriptSource = source;
            String patched = patchAccount(base, config.accountUser, config.accountPass);
            scriptPatched = patched != null;
            patchStrategy = scriptPatched ? "HJ_ACCOUNT 槽已写入 " + config.accountUser : "未配置账号（可在菜单「账号设置」里填）";
            if (patched == null) patched = base;
            try (FileOutputStream fos = new FileOutputStream(patchedFile)) {
                fos.write(patched.getBytes(StandardCharsets.UTF_8));
            } catch (Exception ignored) {
            }
            prefs.edit().putString("script_version", scriptVersion).apply();
            shellLog("脚本就绪：v" + scriptVersion + " 来源=" + scriptSource
                    + " 凭据注入=" + (scriptPatched ? "成功(" + config.accountUser + ")" : "未生效"));

            final String finalPatched = patched;
            runOnUiThread(() -> {
                applyInjection(finalPatched);
                startPage();
            });
        });
    }

    private void startPage() {
        String url = config.startUrl;
        shellLog("打开：" + url);
        webView.loadUrl(url);
    }

    private String[] downloadScript() {
        for (String url : config.scriptUrls) {
            try {
                String text = httpGet(url, 30000);
                if (text == null || text.length() < 500) throw new Exception("内容过短");
                if (!text.contains("==UserScript==")) throw new Exception("不是用户脚本");
                return new String[]{text, parseVersion(text), url};
            } catch (Exception e) {
                lastError = url + " → " + e.getMessage();
                shellLog("脚本下载失败：" + lastError);
            }
        }
        return null;
    }

    private static String httpGet(String url, int timeout) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(timeout);
        conn.setReadTimeout(timeout);
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) haijiao-shell/1.0");
        conn.setRequestProperty("Cache-Control", "no-cache");
        int code = conn.getResponseCode();
        InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        if (in == null) throw new Exception("HTTP " + code);
        byte[] body = Config.readAll(in);
        in.close();
        conn.disconnect();
        if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
        return new String(body, StandardCharsets.UTF_8);
    }

    private static String parseVersion(String code) {
        Matcher m = Pattern.compile("//\\s*@version\\s+([^\\s]+)").matcher(code);
        return m.find() ? m.group(1) : "0.0.0";
    }

    /** 返回注入后的脚本；账号没配或找不到槽位时返回 null */
    private static String patchAccount(String code, String user, String pass) {
        if (user == null || user.isEmpty() || pass == null || pass.isEmpty()) return null;
        String u = user.replace("\\", "\\\\").replace("'", "\\'");
        String p = pass.replace("\\", "\\\\").replace("'", "\\'");
        Pattern block = Pattern.compile("const\\s+HJ_ACCOUNT\\s*=\\s*\\{[\\s\\S]*?\\};");
        Matcher m = block.matcher(code);
        if (m.find()) {
            String rep = "const HJ_ACCOUNT = {\n        username: '" + u + "',\n        password: '" + p + "'\n    };";
            String out = m.replaceFirst(Matcher.quoteReplacement(rep));
            if (out.contains("username: '" + u + "'") && out.contains("password: '" + p + "'")) return out;
        }
        Pattern pair = Pattern.compile("username:\\s*'[^']*'\\s*,\\s*password:\\s*'[^']*'");
        Matcher m2 = pair.matcher(code);
        if (m2.find()) {
            String out = m2.replaceFirst(Matcher.quoteReplacement(
                    "username: '" + u + "',\n        password: '" + p + "'"));
            if (out.contains("username: '" + u + "'")) return out;
        }
        return null;
    }

    private static String readFile(File f) throws Exception {
        try (InputStream in = new java.io.FileInputStream(f)) {
            return new String(Config.readAll(in), StandardCharsets.UTF_8);
        }
    }

    /* ------------------------------------------------------------------ */
    /* 下载                                                                */
    /* ------------------------------------------------------------------ */

    private void downloadViaManager(String url, String userAgent, String contentDisposition, String mimetype) {
        try {
            String name = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimetype);
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null && !cookie.isEmpty()) r.addRequestHeader("Cookie", cookie);
            r.addRequestHeader("User-Agent", userAgent != null && !userAgent.isEmpty() ? userAgent : config.userAgent);
            if (mimetype != null && !mimetype.isEmpty()) r.setMimeType(mimetype);
            r.setTitle(name);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.enqueue(r);
                toast("已加入下载：" + name);
            }
        } catch (Exception e) {
            shellLog("[下载] 失败：" + e.getMessage());
            toast("下载失败：" + e.getMessage());
        }
    }

    private void saveBlobViaPage(String blobUrl, String mime, String contentDisposition) {
        String name = android.webkit.URLUtil.guessFileName(blobUrl, contentDisposition, mime);
        String js = "(function(){var u=" + JSONObject.quote(blobUrl) + ";"
                + "fetch(u).then(function(r){return r.blob();}).then(function(b){"
                + "var fr=new FileReader();fr.onload=function(){"
                + "window.__hjShellNative.saveBase64(" + JSONObject.quote(name) + ","
                + "fr.result.split(',')[1], b.type||'application/octet-stream');};"
                + "fr.readAsDataURL(b);}).catch(function(e){"
                + "window.__hjShellNative.log('blob 读取失败 '+e);});})();";
        webView.evaluateJavascript(js, null);
        toast("正在保存 blob 内容…");
    }

    /* ------------------------------------------------------------------ */
    /* 菜单                                                                */
    /* ------------------------------------------------------------------ */

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(0, 1, 0, "重新加载");
        menu.add(0, 2, 1, "检查脚本更新");
        menu.add(0, 3, 2, "账号设置");
        menu.add(0, 4, 3, "切换入口地址");
        menu.add(0, 5, 4, "导出配置文件");
        menu.add(0, 6, 5, "状态 / 关于");
        menu.add(0, 7, 6, "清空脚本存储");
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        switch (item.getItemId()) {
            case 1:
                webView.reload();
                return true;
            case 2:
                toast("正在检查脚本更新…");
                loadScriptThenStart(true);
                return true;
            case 3:
                showAccountDialog();
                return true;
            case 4:
                showEntryDialog();
                return true;
            case 5:
                exportConfig();
                return true;
            case 6:
                showStatus();
                return true;
            case 7:
                bridge.clearAll();
                WebStorage.getInstance().deleteAllData();
                toast("已清空脚本 GM 存储");
                return true;
            default:
                return super.onOptionsItemSelected(item);
        }
    }

    private void showAccountDialog() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (16 * getResources().getDisplayMetrics().density);
        box.setPadding(pad, pad, pad, pad);

        final EditText u = new EditText(this);
        u.setHint("账号 / 用户名");
        u.setText(config.accountUser);
        u.setInputType(InputType.TYPE_CLASS_TEXT);
        box.addView(u);

        final EditText p = new EditText(this);
        p.setHint("密码");
        p.setText(config.accountPass);
        p.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        box.addView(p);

        new AlertDialog.Builder(this)
                .setTitle("账号设置（注入到脚本 HJ_ACCOUNT）")
                .setView(box)
                .setPositiveButton("保存并重载", (DialogInterface d, int w) -> {
                    prefs.edit().putString("account_user", u.getText().toString().trim())
                            .putString("account_pass", p.getText().toString()).apply();
                    config = Config.load(this, prefs);
                    toast("已保存，正在重载脚本…");
                    loadScriptThenStart(false);
                })
                .setNegativeButton("取消", null)
                .show();
    }

    private void showEntryDialog() {
        final List<String[]> list = config.alternates == null ? new ArrayList<>() : config.alternates;
        if (list.isEmpty()) {
            toast("配置里没有其他入口");
            return;
        }
        String[] names = new String[list.size()];
        for (int i = 0; i < list.size(); i++) names[i] = list.get(i)[0] + "\n" + list.get(i)[1];
        new AlertDialog.Builder(this)
                .setTitle("选择入口")
                .setItems(names, (DialogInterface d, int which) -> {
                    String url = list.get(which)[1];
                    if (url != null && !url.isEmpty()) {
                        shellLog("切换入口：" + url);
                        webView.loadUrl(url);
                    }
                })
                .setNegativeButton("取消", null)
                .show();
    }

    private void exportConfig() {
        try {
            File dir = getExternalFilesDir(null);
            if (dir == null) throw new Exception("无外部目录");
            File out = new File(dir, "config.json");
            if (!out.exists()) {
                try (InputStream in = getAssets().open("config.json");
                     FileOutputStream fos = new FileOutputStream(out)) {
                    fos.write(Config.readAll(in));
                }
            }
            String path = out.getAbsolutePath();
            shellLog("配置文件位置：" + path);
            new AlertDialog.Builder(this)
                    .setTitle("配置文件")
                    .setMessage("外部配置路径（可用文件管理器编辑）：\n" + path
                            + "\n\n也可以放到 Download/config.json，改完在菜单里点「重新加载」生效。\n"
                            + "账号密码建议直接用菜单「账号设置」。")
                    .setPositiveButton("知道了", null)
                    .show();
        } catch (Exception e) {
            toast("导出失败：" + e.getMessage());
        }
    }

    private void showStatus() {
        String t = fetchedAt > 0
                ? new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.CHINA).format(new Date(fetchedAt))
                : "从未";
        String msg = "套壳 v1.0.0（Android）\n"
                + "脚本版本：" + scriptVersion + "\n"
                + "脚本来源：" + scriptSource + "\n"
                + "上次脚本更新：" + t + "\n"
                + "自动更新：" + (config.autoUpdate ? "开（每 " + config.checkHours + " 小时）" : "关") + "\n"
                + "凭据注入：" + (scriptPatched ? "成功 / " + patchStrategy : "未生效 / " + patchStrategy) + "\n"
                + "document-start：" + documentStartSupported + "\n"
                + "外部配置：" + (config.externalPath.isEmpty() ? "未使用" : config.externalPath) + "\n"
                + "最近下载错误：" + (lastError.isEmpty() ? "无" : lastError);
        new AlertDialog.Builder(this)
                .setTitle("状态 / 关于")
                .setMessage(msg)
                .setPositiveButton("知道了", null)
                .show();
    }

    public String statusJson() {
        try {
            JSONObject o = new JSONObject();
            o.put("shellVersion", "1.0.1-android");
            o.put("scriptVersion", scriptVersion);
            o.put("scriptSource", scriptSource);
            o.put("patched", scriptPatched);
            o.put("patchStrategy", patchStrategy);
            o.put("accountUser", config.accountUser);
            o.put("documentStart", documentStartSupported);
            o.put("autoCinema", config.autoCinema);
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    /* ------------------------------------------------------------------ */

    void shellLog(String msg) {
        Log.i(TAG, msg);
    }

    private void toast(final String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_SHORT).show());
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (customView != null) {   // 全屏中先退全屏
                exitFullscreenView();
                return true;
            }
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        try {
            if (scriptHandler != null) scriptHandler.remove();
        } catch (Exception ignored) {
        }
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.destroy();
        }
        io.shutdownNow();
        super.onDestroy();
    }
}
