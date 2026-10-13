package com.haijiao.shell;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Environment;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * 配置：硬编码默认值 ← assets/config.json ← 外部 config.json（外部文件优先）
 * 账号密码优先级最高的是 App 内「账号设置」保存到 SharedPreferences 的值。
 */
public class Config {

    public String startUrl = "https://haijiao.com/";
    public List<String[]> alternates = new ArrayList<>();      // {名称, 地址}
    public List<String> scriptUrls = new ArrayList<>();
    public String accountUser = "";
    public String accountPass = "";
    public boolean autoUpdate = true;
    public int checkHours = 6;
    public String userAgent = "";
    public List<String> matchOrigins = new ArrayList<>();      // 注入范围，默认 {"*"}
    public String externalPath = "";

    private static final String DEFAULT_USER_AGENT =
            "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) "
                    + "Chrome/124.0.0.0 Mobile Safari/537.36";

    private static void applyJson(Config c, JSONObject o) {
        if (o == null) return;
        if (o.has("startUrl")) c.startUrl = o.optString("startUrl", c.startUrl);
        if (o.has("userAgent")) c.userAgent = o.optString("userAgent", c.userAgent);
        if (o.has("autoUpdate")) c.autoUpdate = o.optBoolean("autoUpdate", c.autoUpdate);
        if (o.has("checkHours")) c.checkHours = o.optInt("checkHours", c.checkHours);
        JSONArray alts = o.optJSONArray("alternates");
        if (alts != null) {
            List<String[]> list = new ArrayList<>();
            for (int i = 0; i < alts.length(); i++) {
                JSONObject a = alts.optJSONObject(i);
                if (a == null) continue;
                list.add(new String[]{a.optString("name", "入口" + (i + 1)), a.optString("url", "")});
            }
            if (!list.isEmpty()) c.alternates = list;
        }
        JSONArray urls = o.optJSONArray("scriptUrls");
        if (urls != null) {
            List<String> list = new ArrayList<>();
            for (int i = 0; i < urls.length(); i++) {
                String u = urls.optString(i, "");
                if (u != null && u.startsWith("http")) list.add(u);
            }
            if (!list.isEmpty()) c.scriptUrls = list;
        }
        JSONArray origins = o.optJSONArray("matchOrigins");
        if (origins != null) {
            List<String> list = new ArrayList<>();
            for (int i = 0; i < origins.length(); i++) list.add(origins.optString(i, ""));
            if (!list.isEmpty()) c.matchOrigins = list;
        }
        JSONObject acc = o.optJSONObject("account");
        if (acc != null) {
            c.accountUser = acc.optString("username", c.accountUser);
            c.accountPass = acc.optString("password", c.accountPass);
        }
    }

    private static JSONObject parse(String text) {
        try { return new JSONObject(text); } catch (Exception e) { return null; }
    }

    public static Config load(Context ctx, SharedPreferences prefs) {
        Config c = new Config();
        c.startUrl = "https://haijiao.com/";
        c.scriptUrls.add("https://update.greasyfork.org/scripts/583742/"
                + "m3u8%E6%8F%90%E5%8F%96+%E5%8E%BB%E5%B9%BF%E5%91%8A+%E8%87%AA%E5%8A%A8%E5%B1%95%E5%BC%80%E5%AE%8C%E6%95%B4%E5%B8%96%E6%96%87"
                + "+%E6%8B%A6%E6%88%AA%E7%99%BB%E5%BD%95%E5%BC%B9%E7%AA%97+TS%E4%B8%8B%E8%BD%BD.user.js");
        c.scriptUrls.add("https://greasyfork.org/scripts/583742/code/"
                + "m3u8%E6%8F%90%E5%8F%96%2B%E5%8E%BB%E5%B9%BF%E5%91%8A%2B%E8%87%AA%E5%8A%A8%E5%B1%95%E5%BC%80%E5%AE%8C%E6%95%B4%E8%B4%B4%E6%96%87"
                + "%2B%E6%8B%A6%E6%88%AA%E7%99%BB%E5%BD%95%E5%BC%B9%E7%AA%97%2BTS%E4%B8%8B%E8%BD%BD.user.js");
        c.alternates.add(new String[]{"海角主站", "https://haijiao.com/"});
        c.matchOrigins.add("*");
        c.userAgent = DEFAULT_USER_AGENT;

        // 1) assets 内置
        try (InputStream in = ctx.getAssets().open("config.json")) {
            applyJson(c, parse(new String(readAll(in), StandardCharsets.UTF_8)));
        } catch (Exception e) {
            Log.w("hj-shell", "assets/config.json 读取失败: " + e.getMessage());
        }

        // 2) 外部覆盖（外部文件管理器可编辑）
        for (File f : externalCandidates(ctx)) {
            if (f != null && f.isFile()) {
                try (InputStream in = new FileInputStream(f)) {
                    JSONObject o = parse(new String(readAll(in), StandardCharsets.UTF_8));
                    if (o != null) {
                        applyJson(c, o);
                        c.externalPath = f.getAbsolutePath();
                        Log.i("hj-shell", "已加载外部配置: " + f.getAbsolutePath());
                        break;
                    }
                } catch (Exception e) {
                    Log.w("hj-shell", "外部配置读取失败: " + f + " " + e.getMessage());
                }
            }
        }

        // 3) App 内设置的账号优先
        String u = prefs.getString("account_user", "");
        String p = prefs.getString("account_pass", "");
        if (u != null && !u.isEmpty()) c.accountUser = u;
        if (p != null && !p.isEmpty()) c.accountPass = p;

        if (c.userAgent == null || c.userAgent.isEmpty()) c.userAgent = DEFAULT_USER_AGENT;
        if (c.checkHours <= 0) c.checkHours = 6;
        return c;
    }

    public static File[] externalCandidates(Context ctx) {
        File ext = ctx.getExternalFilesDir(null);
        File dl = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        File dl2 = new File(Environment.getExternalStorageDirectory(), "Download");
        return new File[]{
                ext == null ? null : new File(ext, "config.json"),
                dl == null ? null : new File(dl, "config.json"),
                dl2 == null ? null : new File(dl2, "config.json"),
                new File(Environment.getExternalStorageDirectory(), "haijiao-shell/config.json")
        };
    }

    public static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        return bos.toByteArray();
    }
}
