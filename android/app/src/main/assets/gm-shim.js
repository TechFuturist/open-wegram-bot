(function () {
    'use strict';
    var N = window.__hjShellNative;
    if (!N) {
        try { console.warn('[套壳] 原生桥 __hjShellNative 未就绪，GM_* 不可用'); } catch (e) { }
        return;
    }

    function parseJson(s) {
        if (s === null || s === undefined || s === '') return undefined;
        try { return JSON.parse(s); } catch (e) { return s; }
    }

    /* ---------------- 存储 ---------------- */

    window.GM_getValue = function (key, def) {
        try {
            var r = N.getValue(String(key));
            if (r === null) return def;
            var v = parseJson(r);
            return v === undefined ? def : v;
        } catch (e) { return def; }
    };

    window.GM_setValue = function (key, value) {
        try { N.setValue(String(key), JSON.stringify(value === undefined ? null : value)); } catch (e) { }
    };

    window.GM_deleteValue = function (key) {
        try { N.deleteValue(String(key)); } catch (e) { }
    };

    window.GM_listValues = function () {
        try { return JSON.parse(N.keys()) || []; } catch (e) { return []; }
    };

    /* ---------------- 样式 ---------------- */

    window.GM_addStyle = function (css) {
        var style = document.createElement('style');
        style.textContent = css;
        var tryAppend = function () {
            if (style.isConnected) return true;
            var parent = document.head || document.documentElement;
            if (parent) { parent.appendChild(style); return true; }
            return false;
        };
        if (!tryAppend()) {
            var iv = setInterval(function () { if (tryAppend()) clearInterval(iv); }, 5);
            setTimeout(function () { clearInterval(iv); }, 20000);
        }
        return style;
    };

    /* ---------------- 跨域请求 ---------------- */

    var callbacks = {}, seq = 0;

    function base64ToArrayBuffer(b64) {
        var bin = atob(b64);
        var len = bin.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
        return bytes.buffer;
    }

    window.__hjShellGmCallback = function (id, payload) {
        var d = callbacks[id];
        if (!d) return;
        delete callbacks[id];
        var res;
        try { res = JSON.parse(payload); } catch (e) { res = { error: 'bad payload' }; }
        var out = {
            readyState: 4,
            status: res.status || 0,
            statusText: res.statusText || '',
            responseHeaders: res.headers || {},
            responseText: res.responseText || '',
            finalUrl: res.finalUrl || '',
            context: d.context,
            response: res.responseBase64 ? base64ToArrayBuffer(res.responseBase64) : (res.responseText || '')
        };
        try {
            if (res.error) {
                if (typeof d.onerror === 'function') d.onerror(out);
            } else if (typeof d.onload === 'function') {
                d.onload(out);
            }
        } catch (e) {
            try { console.error('[套壳] GM_xmlhttpRequest 回调异常', e); } catch (_) { }
        }
    };

    window.GM_xmlhttpRequest = function (details) {
        var d = details || {};
        var id = ++seq;
        callbacks[id] = d;
        var req = {
            method: d.method || 'GET',
            url: d.url,
            headers: d.headers || {},
            data: (d.data === undefined || d.data === null) ? null : String(d.data),
            timeout: d.timeout || 30000,
            responseType: d.responseType || ''
        };
        try {
            if (typeof d.onloadstart === 'function') {
                d.onloadstart({ readyState: 1, status: 0, context: d.context, type: 'loadstart' });
            }
            N.httpRequest(id, JSON.stringify(req));
        } catch (e) {
            if (typeof d.onerror === 'function') {
                d.onerror({ error: String(e), status: 0, readyState: 0, context: d.context });
            }
        }
        return { abort: function () { try { N.abort(id); } catch (e) { } } };
    };

    /* ---------------- 新版 GM.* 命名空间（给以后改版的脚本留口子） ---------------- */

    window.GM = window.GM || {};
    window.GM.getValue = window.GM_getValue;
    window.GM.setValue = window.GM_setValue;
    window.GM.deleteValue = window.GM_deleteValue;
    window.GM.listValues = window.GM_listValues;
    window.GM.addStyle = window.GM_addStyle;
    window.GM.xmlHttpRequest = window.GM_xmlhttpRequest;
    window.GM.info = {
        script: { name: '海角 m3u8 脚本（套壳内嵌 · Android）', version: '7.15.0', namespace: 'haijiao-analyst' },
        scriptHandler: 'haijiao-shell 1.0.0-android'
    };

    window.unsafeWindow = window;
    window.__hjShell = {
        壳: 'haijiao-shell 1.0.0-android',
        注入时间: new Date().toLocaleString('zh-CN', { hour12: false })
    };
    try {
        var info = JSON.parse(N.info());
        window.__hjShell.脚本版本 = info.scriptVersion;
        window.__hjShell.脚本来源 = info.scriptSource;
        window.__hjShell.凭据注入 = info.patched ? ('成功 / ' + info.patchStrategy) : ('未生效 / ' + info.patchStrategy);
        window.GM.info.script.version = info.scriptVersion;
    } catch (e) { }

    // blob 下载回传通道
    window.__hjShellSaveBase64 = function (name, b64, mime) {
        try { N.saveBase64(name, b64, mime); } catch (e) { }
    };
})();
