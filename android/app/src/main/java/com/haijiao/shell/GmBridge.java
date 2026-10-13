package com.haijiao.shell;

import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** 用户脚本的 GM_* 原生后端：存储 + 跨域请求 + 下载落地 */
public class GmBridge {

    private final MainActivity activity;
    private final WebView webView;
    private final SharedPreferences store;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private final ConcurrentHashMap<Integer, HttpURLConnection> live = new ConcurrentHashMap<>();
    private final String ua;

    public GmBridge(MainActivity activity, WebView webView, SharedPreferences store, String ua) {
        this.activity = activity;
        this.webView = webView;
        this.store = store;
        this.ua = ua;
    }

    /* ---------------- 存储 ---------------- */

    @JavascriptInterface
    public String getValue(String key) {
        try {
            return store.contains(key) ? store.getString(key, null) : null;
        } catch (Exception e) {
            return null;
        }
    }

    @JavascriptInterface
    public void setValue(String key, String jsonValue) {
        store.edit().putString(key, jsonValue).apply();
    }

    @JavascriptInterface
    public void deleteValue(String key) {
        store.edit().remove(key).apply();
    }

    @JavascriptInterface
    public String keys() {
        try {
            return new JSONArray(store.getAll().keySet()).toString();
        } catch (Exception e) {
            return "[]";
        }
    }

    @JavascriptInterface
    public void clearAll() {
        store.edit().clear().apply();
    }

    @JavascriptInterface
    public void log(String msg) {
        activity.shellLog("[脚本] " + msg);
    }

    @JavascriptInterface
    public String info() {
        return activity.statusJson();
    }

    /* ---------------- 跨域请求 ---------------- */

    @JavascriptInterface
    public void httpRequest(final int id, final String reqJson) {
        pool.execute(() -> {
            JSONObject out = new JSONObject();
            HttpURLConnection conn = null;
            try {
                JSONObject req = new JSONObject(reqJson);
                String url = req.optString("url", "");
                String method = req.optString("method", "GET").toUpperCase();
                String data = req.isNull("data") ? null : req.optString("data", null);
                int timeout = req.optInt("timeout", 30000);
                boolean wantBinary = "arraybuffer".equalsIgnoreCase(req.optString("responseType", ""))
                        || "blob".equalsIgnoreCase(req.optString("responseType", ""));
                JSONObject headers = req.optJSONObject("headers");

                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setRequestMethod(method);
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(Math.max(5000, timeout));
                conn.setReadTimeout(Math.max(5000, timeout));
                conn.setRequestProperty("User-Agent", ua);
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null && !cookie.isEmpty()) conn.setRequestProperty("Cookie", cookie);
                if (headers != null) {
                    for (Iterator<String> it = headers.keys(); it.hasNext(); ) {
                        String k = it.next();
                        if (k == null) continue;
                        String lk = k.toLowerCase();
                        if (lk.equals("host") || lk.equals("content-length") || lk.equals("connection")) continue;
                        conn.setRequestProperty(k, headers.optString(k, ""));
                    }
                }
                if (data != null && !method.equals("GET") && !method.equals("HEAD")) {
                    conn.setDoOutput(true);
                    byte[] body = data.getBytes(StandardCharsets.UTF_8);
                    if (conn.getRequestProperty("Content-Type") == null) {
                        conn.setRequestProperty("Content-Type", "application/json;charset=UTF-8");
                    }
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body);
                    }
                }
                live.put(id, conn);

                int status = conn.getResponseCode();
                InputStream in = (status >= 400) ? conn.getErrorStream() : conn.getInputStream();
                byte[] body = in == null ? new byte[0] : Config.readAll(in);
                if (in != null) in.close();

                JSONObject rh = new JSONObject();
                for (Map.Entry<String, List<String>> e : conn.getHeaderFields().entrySet()) {
                    if (e.getKey() == null || e.getValue() == null) continue;
                    rh.put(e.getKey().toLowerCase(), join(e.getValue()));
                }
                // 把响应里的 Set-Cookie 回写进 WebView 的 cookie 罐
                List<String> setCookies = conn.getHeaderFields().get("Set-Cookie");
                if (setCookies != null) {
                    for (String sc : setCookies) {
                        try { CookieManager.getInstance().setCookie(url, sc); } catch (Exception ignored) { }
                    }
                }

                out.put("status", status);
                out.put("statusText", conn.getResponseMessage() == null ? "" : conn.getResponseMessage());
                out.put("headers", rh);
                out.put("responseText", new String(body, StandardCharsets.UTF_8));
                out.put("finalUrl", conn.getURL() == null ? url : conn.getURL().toString());
                if (wantBinary) out.put("responseBase64", Base64.encodeToString(body, Base64.NO_WRAP));
            } catch (Exception e) {
                try {
                    out.put("status", 0);
                    out.put("error", String.valueOf(e.getMessage()));
                } catch (Exception ignored) { }
            } finally {
                live.remove(id);
                if (conn != null) conn.disconnect();
            }
            final String payload = out.toString();
            webView.post(() -> {
                try {
                    webView.evaluateJavascript(
                            "window.__hjShellGmCallback(" + id + "," + JSONObject.quote(payload) + ");", null);
                } catch (Exception ignored) { }
            });
        });
    }

    @JavascriptInterface
    public void abort(int id) {
        HttpURLConnection c = live.remove(id);
        if (c != null) {
            try { c.disconnect(); } catch (Exception ignored) { }
        }
    }

    private static String join(List<String> values) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append(values.get(i));
        }
        return sb.toString();
    }

    /* ---------------- 下载落地（blob/data: 由页面读出 base64 后交回来） ---------------- */

    @JavascriptInterface
    public void saveBase64(final String name, final String base64, final String mime) {
        try {
            final byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            final Context ctx = activity;
            final String m = (mime == null || mime.isEmpty()) ? "application/octet-stream" : mime;
            final String fname = (name == null || name.isEmpty()) ? ("hj-" + System.currentTimeMillis()) : name;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, fname);
                cv.put(MediaStore.Downloads.MIME_TYPE, m);
                Uri uri = ctx.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) throw new Exception("MediaStore 插入失败");
                try (OutputStream os = ctx.getContentResolver().openOutputStream(uri)) {
                    os.write(bytes);
                }
                activity.shellLog("[下载] 已保存到 Download/" + fname + "（" + bytes.length + " 字节）");
            } else {
                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("无法创建下载目录");
                File out = new File(dir, fname);
                try (FileOutputStream fos = new FileOutputStream(out)) {
                    fos.write(bytes);
                }
                MediaScannerConnection.scanFile(ctx, new String[]{out.getAbsolutePath()}, null, null);
                activity.shellLog("[下载] 已保存到 " + out.getAbsolutePath() + "（" + bytes.length + " 字节）");
            }
        } catch (Exception e) {
            Log.e("hj-shell", "saveBase64 失败", e);
            activity.shellLog("[下载] 保存失败：" + e.getMessage());
        }
    }
}
