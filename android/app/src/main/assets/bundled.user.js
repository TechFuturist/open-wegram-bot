// ==UserScript==
// @name        m3u8提取+去广告+自动展开完整贴文+拦截登录弹窗+TS下载
// @namespace   haijiao-analyst
// @version     7.15.0
// @author      coldhz
// @description 广告与弹窗过滤、贴文展开、M3U8 捕获与播放、TS 下载、视频中心、脚本看图（翻页/分辨率/保存）、GIF 异步解码与双管线取址分流。
// @license     MIT
// @match       *://*.haijiao.com/*
// @match       *://haijiao.com/*
// @match       *://*.hj260601647.top/*
// @match       *://hj260601647.top/*
// @match       *://909e156d1613fb.top/*
// @match       *://875e0acaa73219.top/*
// @match       *://e2e479b78947ca.top/*
// @match       *://d505e4292f65ec.top/*
// @match       *://727a690f3300a1.top/*
// @match       *://ecf0987860eebb.top/*
// @match       *://96671f9ac99075.top/*
// @match       *://a3209627d1cddd.top/*
// @match       *://*.top/*
// @exclude     *://anyrouter.top/*
// @exclude     *://*.anyrouter.top/*
// @include     /^https?:\/\/[0-9a-f]{6,24}\.top\//
// @include     /^https?:\/\/([a-z0-9-]+\.)?haijiao\.com\//
// @grant       GM_addStyle
// @grant       unsafeWindow
// @grant       GM_xmlhttpRequest
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @connect     *
// @run-at      document-start
// @downloadURL https://update.greasyfork.org/scripts/583742/m3u8%E6%8F%90%E5%8F%96%2B%E5%8E%BB%E5%B9%BF%E5%91%8A%2B%E8%87%AA%E5%8A%A8%E5%B1%95%E5%BC%80%E5%AE%8C%E6%95%B4%E8%B4%B4%E6%96%87%2B%E6%8B%A6%E6%88%AA%E7%99%BB%E5%BD%95%E5%BC%B9%E7%AA%97%2BTS%E4%B8%8B%E8%BD%BD.user.js
// @updateURL https://update.greasyfork.org/scripts/583742/m3u8%E6%8F%90%E5%8F%96%2B%E5%8E%BB%E5%B9%BF%E5%91%8A%2B%E8%87%AA%E5%8A%A8%E5%B1%95%E5%BC%80%E5%AE%8C%E6%95%B4%E8%B4%B4%E6%96%87%2B%E6%8B%A6%E6%88%AA%E7%99%BB%E5%BD%95%E5%BC%B9%E7%AA%97%2BTS%E4%B8%8B%E8%BD%BD.meta.js
// ==/UserScript==

(function() {
    'use strict';
    const HJ_CERTAIN_HOST_PATTERNS = [
        /(^|\.)haijiao\.com$/i,
        /(^|\.)hj260601647\.top$/i,
        /(^|\.)d505e4292f65ec\.top$/i,
        /(^|\.)727a690f3300a1\.top$/i
    ];
    const HJ_ROTATING_HOST_PATTERNS = [
        /^[0-9a-f]{6,24}\.top$/i
    ];
    const hjHostname = String(location.hostname || '').toLowerCase();
    const hjHostCertain = HJ_CERTAIN_HOST_PATTERNS.some(re => re.test(hjHostname));
    const hjHostRotating = !hjHostCertain && HJ_ROTATING_HOST_PATTERNS.some(re => re.test(hjHostname));
    const HJ_SCRIPT_VERSION = '7.15.0';
    try {
        const hjSeenHost = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
        const hjWillTakeOver = hjHostCertain || hjHostRotating;
        hjSeenHost.__hjSeen = {
            版本: HJ_SCRIPT_VERSION,
            域名: hjHostname,
            完整地址: String(location.href || ''),
            在可信清单内: hjHostCertain,
            是轮换域名形态: hjHostRotating,
            脚本是否接管: hjWillTakeOver
                ? '是（还会再问一次「要不要在此站启用」，或读取已记住的选择）'
                : '否 —— 本站域名形态不在脚本内置清单里，脚本什么都没做（设计如此）',
            到达时间: new Date().toISOString(),
            说明: '这条标记由脚本在进入页面时立即写入。看不到它 = 脚本管理器没有在本站注入脚本；'
                + '看得到它 = 脚本已到达，后续行为看 __hjTrust() / __hjImagePolicy()。'
        };
    } catch (e) { }
    if (!hjHostCertain && !hjHostRotating) {
        try {
            const hjLooksHaijiao = () => {
                try {
                    const text = String(document.title || '') + String(document.body ? String(document.body.innerText || '').slice(0, 400) : '');
                    return /海角/.test(text);
                } catch (e) { return false; }
            };
            const hjTellHostShapeSkip = () => {
                if (hjLooksHaijiao()) {
                    console.info('[海角脚本] 本站域名形态不在内置清单里（' + hjHostname + '），脚本已退出、什么都没做。'
                        + '若是站点又换了域名，请更新脚本（页面看起来确实是海角）。');
                }
            };
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                setTimeout(hjTellHostShapeSkip, 1500);
            } else {
                document.addEventListener('DOMContentLoaded', () => setTimeout(hjTellHostShapeSkip, 1500), { once: true });
            }
        } catch (e) { }
        return;
    }
    let hjConfirmProbe = null;
    let hjPendingOriginConfirm = null;
    function hjOriginKey(origin) { return 'hj_trusted_origin_v1:' + origin; }
    function hjOriginDeclineKey(origin) { return 'hj_origin_declined_v1:' + origin; }
    function hjTrustRead(key) {
        try {
            if (typeof GM_getValue === 'function' && GM_getValue(key, false) === true) return true;
        } catch (e) { }
        try {
            if (typeof localStorage !== 'undefined' && localStorage.getItem(key) === '1') return true;
        } catch (e) { }
        return false;
    }
    function hjTrustWrite(key, value) {
        let ok = false;
        try {
            if (typeof GM_setValue === 'function') { GM_setValue(key, value); ok = true; }
        } catch (e) { }
        try {
            if (typeof localStorage !== 'undefined') { localStorage.setItem(key, value ? '1' : ''); ok = true; }
        } catch (e) { }
        return ok;
    }
    function hjTrustClear(key) {
        try { if (typeof GM_deleteValue === 'function') GM_deleteValue(key); else if (typeof GM_setValue === 'function') GM_setValue(key, false); } catch (e) { }
        try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch (e) { }
        try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key); } catch (e) { }
    }
    function hjDeclinedThisSession(origin) {
        try { return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(hjOriginDeclineKey(origin)) === '1'; } catch (e) { return false; }
    }
    function hjMarkDeclined(origin) {
        try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(hjOriginDeclineKey(origin), '1'); } catch (e) { }
    }
    function hjNow() {
        try { if (typeof performance !== 'undefined' && performance.now) return performance.now(); } catch (e) { }
        return Date.now();
    }
    function hjApproveRotatingOrigin() {
        if (!hjHostRotating) return false;
        const origin = String(location.origin || '');
        if (!/^https?:\/\//i.test(origin)) return false;
        const key = hjOriginKey(origin);
        if (hjTrustRead(key)) return true;
        if (hjDeclinedThisSession(origin)) return false;
        let approve = false;
        let deny = false;
        let elapsed = -1;
        let withheld = false;                              
        let answer = '(未作答)';
        try {
            const t0 = hjNow();
            const raw = window.confirm('海角脚本：这个地址要运行脚本吗？\n\n' + origin
                + '\n\n确定 = 在本站启用（包含自动登录与后台请求，之后不再询问）'
                + '\n取消 = 本站完全不运行脚本');
            elapsed = Math.round(hjNow() - t0);
            answer = (raw === true) ? 'true' : (raw === false) ? 'false' : String(raw);
            approve = (raw === true);
            deny = (raw === false) && elapsed >= 250;
        } catch (e) {
            withheld = true;                              
        }
        hjConfirmProbe = { origin, approve, deny, elapsed, withheld, answer, at: Date.now() };
        if (approve) {
            if (!hjTrustWrite(key, true)) {
                console.warn('[海角脚本] 信任记录写不进去（GM 与 localStorage 都失败），下次访问可能会再问一次');
            }
            return true;
        }
        if (deny) {
            hjMarkDeclined(origin);
            console.info('[海角脚本] 你选择了不在此站运行脚本；本次会话不再询问（换域名会重新问）');
            return false;
        }
        console.warn('[海角脚本] 没能拿到明确答复（'
            + (withheld ? '对话框直接抛异常' : '返回 ' + answer + '，耗时 ' + elapsed + 'ms')
            + '）。不会当成"用户拒绝"：改为页面内浮层询问，确认后自动刷新。');
        hjPendingOriginConfirm = { origin, key };
        return false;
    }
    let hjOriginConfirmTries = 0;
    function hjDrawOriginConfirm() {
        const pending = hjPendingOriginConfirm;
        if (!pending) return false;
        try {
            if (typeof document === 'undefined' || !document.body) return false;
            if (document.getElementById('hj-origin-confirm')) return true;
            const esc = (s) => String(s).replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));
            const box = document.createElement('div');
            box.id = 'hj-origin-confirm';
            box.setAttribute('style', 'position:fixed;left:12px;right:12px;bottom:16px;z-index:2147483600;'
                + 'background:#1b1b1f;color:#eee;border-radius:12px;padding:16px 16px 12px;'
                + 'box-shadow:0 8px 28px rgba(0,0,0,.5);font-size:14px;line-height:1.6;text-align:left;'
                + 'max-width:520px;margin:0 auto;'
                + 'font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;');
            box.innerHTML = ''
                + '<div style="font-size:16px;font-weight:bold;margin-bottom:8px;">这个地址要运行海角脚本吗？</div>'
                + '<div style="color:#bdbdbd;font-size:13px;margin-bottom:12px;">站点轮换域名：<br>'
                + '<b style="color:#ffd54f;word-break:break-all;">' + esc(pending.origin) + '</b><br><br>'
                + '启用 → 在本站运行脚本（含自动登录与后台请求），并记住这个选择，之后不再询问。<br>'
                + '不启用 → 本页完全不运行脚本。</div>'
                + '<div style="display:flex;gap:10px;">'
                + '<button id="hj-oc-yes" style="flex:1;padding:10px 0;border:0;border-radius:8px;'
                + 'font-size:15px;font-weight:bold;background:#2f6fd0;color:#fff;">启用脚本</button>'
                + '<button id="hj-oc-no" style="flex:1;padding:10px 0;border:1px solid #555;border-radius:8px;'
                + 'font-size:15px;background:transparent;color:#ccc;">不启用</button></div>';
            document.body.appendChild(box);
            document.getElementById('hj-oc-yes').onclick = () => {
                const ok = hjTrustWrite(pending.key, true);
                box.remove();
                console.info('[海角脚本] 已在页面内确认该站点，刷新后生效（信任记录写入：' + (ok ? '成功' : '失败') + '）');
                try { location.reload(); } catch (e) { }
            };
            document.getElementById('hj-oc-no').onclick = () => {
                hjMarkDeclined(pending.origin);
                box.remove();
                console.info('[海角脚本] 用户选择不在此站点运行');
            };
            console.info('[海角脚本] 已弹出站点授权浮层（window.confirm 拿不到明确答复时的替代）');
            return true;
        } catch (e) { return false; }
    }
    function hjScheduleOriginConfirm() {
        const tick = () => {
            if (hjDrawOriginConfirm()) return;
            if (hjOriginConfirmTries++ > 60) return;
            try { setTimeout(tick, 300); } catch (e) { }
        };
        try { tick(); } catch (e) { }
    }
    try {
        unsafeWindow.__hjTrust = () => ({
            脚本版本: HJ_SCRIPT_VERSION,
            当前域名: hjHostname,
            在可信清单内: hjHostCertain,
            是轮换域名形态: hjHostRotating,
            本页已启用脚本: hjVerified,
            已记住的信任: (() => { try { return hjTrustRead(hjOriginKey(location.origin)); } catch (e) { return null; } })(),
            本次会话已拒绝: (() => { try { return hjDeclinedThisSession(location.origin); } catch (e) { return null; } })(),
            上一次询问: hjConfirmProbe,
            环境: {
                'GM_getValue（下划线版）': typeof GM_getValue === 'function',
                'GM_setValue（下划线版）': typeof GM_setValue === 'function',
                'GM_addStyle（下划线版）': typeof GM_addStyle === 'function',
                localStorage: (() => { try { return typeof localStorage !== 'undefined'; } catch (e) { return false; } })()
            },
            说明: '"上一次询问"里 approve/deny 都是 false 表示**没问到**（对话框抛异常、返回非布尔、或秒拒），'
                + '脚本会改弹页面内浮层；只有"明确布尔 false 且耗时 ≥250ms"才当成用户拒绝。'
                + '__hjTrustReset() 清掉本域名的信任记录（GM 与 localStorage 一起清）。'
        });
        unsafeWindow.__hjTrustReset = () => {
            hjTrustClear(hjOriginKey(location.origin));
            hjTrustClear(hjOriginDeclineKey(location.origin));
            console.info('[海角脚本] 已清除本域名的信任记录，刷新后重新询问');
            return unsafeWindow.__hjTrust();
        };
    } catch (e) { }
    let hjVerified = hjHostCertain || hjApproveRotatingOrigin();
    if (!hjVerified && !hjPendingOriginConfirm) {
        try {
            const origin = String(location.origin || '');
            const probe = hjConfirmProbe;
            const declinedByUser = !!(probe && probe.deny) || hjDeclinedThisSession(origin);
            const why = !/^https?:\/\//i.test(origin)
                ? '本页地址形态（' + origin + '）不是脚本能处理的 http(s) 页面。'
                : declinedByUser
                    ? '你已经对 ' + origin + ' 选过「不启用」。'
                    : '没能拿到「是否启用」的明确答复（对话框被浏览器扣下、返回了非布尔值、或秒级作答），'
                      + '页面内的确认条也没能画出来。';
            console.warn('[海角脚本 v' + HJ_SCRIPT_VERSION + '] 本页没有运行脚本：' + why
                + '在控制台执行 __hjTrustReset() 后刷新即可重新走一遍启用询问；'
                + '若连询问都不出现，请检查脚本管理器里是否把本站排除、或脚本是否被禁用。'
                + '（页面自身的功能一切正常，脚本只是停在入口没有接管。）');
        } catch (e) { }
        return;
    }
    if (!hjVerified && hjPendingOriginConfirm) {
        hjScheduleOriginConfirm();
        return;
    }
    const hjPendingCss = [];
    try {
        console.info('[海角脚本 v' + HJ_SCRIPT_VERSION + '] 已启动并接管本页'
            + '（域名 ' + hjHostname + '，'
            + (hjHostCertain ? '内置可信域名，无需询问' : '轮换域名，已获授权（或已记住选择）') + '）'
            + '。看不到本行说明脚本没被注入，见 __hjSeen / 诊断片段。');
    } catch (e) { }
    function hjInjectStyleNow(css) {
        try {
            if (!document.documentElement && !document.head) return false;
            if (typeof GM_addStyle === 'function') {
                const node = GM_addStyle(css);
                if (node !== null || !!document.querySelector('style')) return true;
            }
            const host = document.head || document.documentElement;
            const style = document.createElement('style');
            style.setAttribute('data-hj-style', '1');
            style.textContent = css;
            host.appendChild(style);
            return true;
        } catch (e) { return false; }
    }
    function hjAddStyle(css) {
        if (!hjVerified) { hjPendingCss.push(css); return; }
        if (hjInjectStyleNow(css)) return;
        hjPendingCss.push(css);
    }
    function hjFlushPendingCss() {
        if (!hjVerified) return;
        let guard = 0;
        while (hjPendingCss.length && guard++ < 200) {
            const css = hjPendingCss.shift();
            if (!hjInjectStyleNow(css)) { hjPendingCss.unshift(css); break; }
        }
    }
    function hjAllowActions() { return hjVerified; }
    let hjSkipSiteGate = true;
    const HJ_GATE_HOME_FLAG = 'hj_gate_to_home_v1';
    var hjWarmUpPromise = null;
    function hjIsSiteGatePage() {
        try {
            if (String((location.pathname || '/')) !== '/') return false;
            if (document.getElementById('app')) return false;
            if (document.querySelector('link[href*="/static/"], script[src*="/static/"]')) return false;
            const canvas = document.querySelector('body > canvas[tabindex], body > canvas');
            if (!canvas) return false;
            const rect = canvas.getBoundingClientRect();
            const vw = Number(window.innerWidth) || 0;
            const vh = Number(window.innerHeight) || 0;
            if (!vw || !vh) return false;
            return rect.width >= vw * 0.9 && rect.height >= vh * 0.9;
        } catch (e) { return false; }
    }
    function hjFindGateButtonRect(canvas) {
        try {
            const w = Number(canvas.width) || 0;
            const h = Number(canvas.height) || 0;
            if (!w || !h) return null;
            const ctx = canvas.getContext('2d');
            if (!ctx || typeof ctx.getImageData !== 'function') return null;
            const data = ctx.getImageData(0, 0, w, h).data;
            const step = 2;                                 
            const isOrange = (r, g, b) => r > 195 && g > 115 && g < 215 && b < 115;
            const rows = [];
            for (let y = 0; y < h; y += step) {
                let c = 0;
                for (let x = 0; x < w; x += step) {
                    const i = (y * w + x) * 4;
                    if (data[i + 3] < 200) continue;
                    if (isOrange(data[i], data[i + 1], data[i + 2])) c++;
                }
                rows.push({ y, c });
            }
            const bands = [];
            for (const row of rows) {
                if (!row.c) continue;
                const last = bands[bands.length - 1];
                if (last && row.y - last.yEnd <= step * 3) {
                    last.yEnd = row.y; last.total += row.c; last.peak = Math.max(last.peak, row.c);
                } else {
                    bands.push({ yStart: row.y, yEnd: row.y, total: row.c, peak: row.c });
                }
            }
            if (!bands.length) return null;
            const box = canvas.getBoundingClientRect();
            if (!box.width || !box.height) return null;
            const sx = box.width / w, sy = box.height / h;
            for (const band of bands) {
                let bx0 = Infinity, bx1 = -1;
                for (let y = band.yStart; y <= band.yEnd; y += step) {
                    for (let x = 0; x < w; x += step) {
                        const i = (y * w + x) * 4;
                        if (data[i + 3] < 200) continue;
                        if (!isOrange(data[i], data[i + 1], data[i + 2])) continue;
                        if (x < bx0) bx0 = x;
                        if (x > bx1) bx1 = x;
                    }
                }
                if (bx1 <= bx0) { band.ok = false; continue; }
                band.fill = band.peak / ((bx1 - bx0) / step + 1);
                band.css = {
                    left: box.left + bx0 * sx,
                    top: box.top + band.yStart * sy,
                    width: (bx1 - bx0 + step) * sx,
                    height: (band.yEnd - band.yStart + step) * sy
                };
                band.ok = band.fill >= 0.7
                    && band.css.width >= 40 && band.css.height >= 20
                    && band.css.width <= box.width * 0.95 && band.css.height <= box.height * 0.5;
            }
            const solid = bands.filter(b => b.ok);
            if (!solid.length) {
                console.info('[海角脚本] 警告页画布上有 ' + bands.length + ' 处橙色区域，'
                    + '没有一处像按钮（填充率/尺寸都不合格）→ 不猜测位置，改走站点自身出口');
                return null;
            }
            const best = solid.reduce((a, b) => (b.total > a.total ? b : a), solid[0]);
            return Object.assign({}, best.css, { fill: Math.round(best.fill * 100) / 100, bands: bands.length });
        } catch (e) { return null; }
    }
    function hjClickSiteGateButton(canvas, rect) {
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const opts = {
            bubbles: true, cancelable: true, composed: true,
            clientX: x, clientY: y, screenX: x, screenY: y,
            button: 0, buttons: 1, pointerId: 1, pointerType: 'touch', isPrimary: true
        };
        try {
            if (typeof PointerEvent === 'function') {
                canvas.dispatchEvent(new PointerEvent('pointerup', opts));
                return true;
            }
        } catch (e) { }
        try { canvas.dispatchEvent(new MouseEvent('pointerup', opts)); return true; } catch (e) { }
        try { canvas.dispatchEvent(new MouseEvent('click', opts)); return true; } catch (e) { }
        return false;
    }
    function hjGateGoHomeOnce(reason) {
        try {
            if (sessionStorage.getItem(HJ_GATE_HOME_FLAG) === '1') return false;
            sessionStorage.setItem(HJ_GATE_HOME_FLAG, '1');
        } catch (e) { }
        console.warn('[海角脚本] 警告页未能定位到按钮（' + reason + '），按其自身出口直接进入 /home');
        try { location.replace('/home'); return true; } catch (e) { return false; }
    }
    (function hjSiteGateSkipper() {
        try {
            if (!hjVerified) return;
            const HJ_GATE_BUDGET_MS = 5000;
            const HJ_GATE_RETRY_AFTER_MS = 1200;
            const HJ_GATE_WAIT_LOGIN_MS = 3000;
            const startedAt = Date.now();
            let firstDispatchAt = 0;
            let loginAwaited = false;
            const tick = () => {
                if (!hjSkipSiteGate) return;
                if (!hjIsSiteGatePage()) return;
                const canvas = document.querySelector('body > canvas[tabindex], body > canvas');
                const rect = canvas ? hjFindGateButtonRect(canvas) : null;
                if (rect && canvas) {
                    if (!loginAwaited && hjWarmUpPromise && Date.now() - startedAt < HJ_GATE_WAIT_LOGIN_MS) {
                        const settled = hjWarmUpPromise.then(() => true, () => true);
                        loginAwaited = true;
                        Promise.race([settled, new Promise(r => setTimeout(r, HJ_GATE_WAIT_LOGIN_MS))])
                            .then(() => { try { tick(); } catch (e) { } });
                        return;
                    }
                    if (!firstDispatchAt) {
                        console.info('[海角脚本] 站点入口是 canvas 画的成人警告页：按它自己的按钮位置点一次（自动确认）'
                            + '（矩形 ' + Math.round(rect.left) + ',' + Math.round(rect.top) + ' '
                            + Math.round(rect.width) + '×' + Math.round(rect.height)
                            + '，填充率 ' + rect.fill + '，画布上共 ' + rect.bands + ' 处橙色区域）');
                    }
                    if (hjClickSiteGateButton(canvas, rect) && !firstDispatchAt) firstDispatchAt = Date.now();
                }
                const waited = Date.now() - startedAt;
                if (firstDispatchAt && Date.now() - firstDispatchAt > HJ_GATE_RETRY_AFTER_MS) {
                    hjGateGoHomeOnce('派发的点击没让页面跳转（可能没落在它记的矩形里）');
                    return;
                }
                if (waited > HJ_GATE_BUDGET_MS + HJ_GATE_WAIT_LOGIN_MS) {
                    hjGateGoHomeOnce(firstDispatchAt ? '按钮点了但页面没动' : '按钮在 ' + Math.round((HJ_GATE_BUDGET_MS + HJ_GATE_WAIT_LOGIN_MS) / 1000) + ' 秒内没出现');
                    return;
                }
                setTimeout(tick, 150);
            };
            const start = () => { setTimeout(tick, 150); };
            let loading = false;
            try { loading = (document.readyState === 'loading'); } catch (e) { loading = true; }
            if (loading) { window.addEventListener('DOMContentLoaded', start); } else start();
        } catch (e) { }
    })();
    try {
        unsafeWindow.__hjSetSkipGate = (on) => {
            hjSkipSiteGate = on !== false;
            console.info('[海角脚本] 入口成人警告页自动进入：' + (hjSkipSiteGate ? '已开启（默认）' : '已关闭'));
            return { 自动进入警告页: hjSkipSiteGate, 当前是警告页: hjIsSiteGatePage() };
        };
    } catch (e) { }
    let capturedM3u8Url = '';
    let capturedVideoTitle = '';
    const btnId = 'hj-play-btn-mobile';
    const dlBtnId = 'hj-download-btn-mobile';
    const dlStatusId = 'hj-download-status-mobile';
    const segmentDownloadConcurrency = 10;
    const segmentRequestTimeoutMs = 90000;
    const segmentMaxRetries = 8;
    const segmentRetryBaseDelayMs = 800;
    const segmentRetryMaxDelayMs = 9000;
    const blockNoisyAnalyticsRequests = true;
    let blockHeavyPostImages = true;
    let allowPostImageThumbnails = true;
    function hjIsSlowNetwork() {
        try {
            const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (!c) return false;
            if (c.saveData === true) return true;
            const et = String(c.effectiveType || '').toLowerCase();
            return et === 'slow-2g' || et === '2g' || et === '3g';
        } catch (e) { return false; }
    }
    let hjRewritePostImageToMini = hjIsSlowNetwork();
    const hjSlowNetworkAtBoot = hjIsSlowNetwork();
    let hjBlockedImageCount = 0;
    let hjImageRewriteCount = 0;
    let hjAllowFullImageUntil = 0;
    const HJ_FULL_IMAGE_VIEW_MS = 15000;
    let hjGifDedupOn = true;
    let hjGifConcurrency = 0;                                        
    let hjGifDedupHits = 0;                           
    let hjGifDedupShared = 0;                         
    let hjGifDedupMiss = 0;                       
    let hjGifRoundKey = '';
    let hjGifQuota = 0;
    const hjGifQuotaUrls = new Set();
    let hjGifQuotaStub = 0;                                      
    const HJ_GIF_DEDUP_TTL_MS = 1500;
    const HJ_GIF_DEDUP_CACHE_MAX = 4;
    const hjGifDedup = new Map();
    let hjGifAsyncFill = true;                    
    let hjGifAsyncConcurrency = 3;                          
    const HJ_GIF_ASYNC_RETRY = 2;                        
    const HJ_GIF_BLOB_URL_MAX = 200;                             
    let hjGifAsyncStubbed = 0;                                      
    let hjGifAsyncDone = 0;                             
    let hjGifAsyncFail = 0;                     
    let hjGifAsyncNoElem = 0;                          
    let hjGifAsyncBytes = 0;                     
    let hjGifAsyncWorkerMs = 0;                                
    let hjGifAsyncMainMs = 0;                                              
    const hjGifAsyncQueued = new Set();
    const hjGifAsyncInfly = new Set();
    const hjGifAsyncFailed = new Map();
    const hjGifAsyncQueue = [];
    const hjGifBlobUrls = [];
    let hjGifWorkerPool = null;
    let hjGifWorkerSeq = 0;
    let hjGifAsyncActive = 0;
    const HJ_GIF_TASK_TIMEOUT_MS = 30000;
    let hjGifWorkerUnavailable = false;
    let hjGifGeneration = 0;
    const hjGifApplyTimers = new Set();
    let hjGif1x1Body = '';
    function hjGifStubBody() {
        if (!hjGif1x1Body) {
            hjGif1x1Body = hjB64EncodeWith(HJ_SITE_ALPHABET,
                'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        }
        return hjGif1x1Body;
    }
    const HJ_GIF_WORKER_SRC = [
        "var ALPHA='ABCD*EFGHIJKLMNOPQRSTUVWX#YZabcdefghijklmnopqrstuvwxyz1234567890';",
        "var LUT=(function(){var t=new Uint8Array(128).fill(255);for(var i=0;i<64;i++)t[ALPHA.charCodeAt(i)]=i;return t;})();",
        "function dec(s){s=String(s||'').trim();var n=s.length,out=new Uint8Array(((n+3)>>2)*3);",
        "var oi=0,acc=0,bits=0,i,c,v;for(i=0;i<n;i++){c=s.charCodeAt(i);if(c>127)continue;v=LUT[c];if(v===255)continue;",
        "acc=(acc<<6)|v;bits+=6;if(bits>=8){bits-=8;out[oi++]=(acc>>bits)&0xff;}}return out.subarray(0,oi);}",
        "function sniff(u){if(u[0]===0x47&&u[1]===0x49&&u[2]===0x46)return 'image/gif';",
        "if(u[0]===0x89&&u[1]===0x50&&u[2]===0x4e)return 'image/png';",
        "if(u[0]===0xff&&u[1]===0xd8)return 'image/jpeg';",
        "if(u[0]===0x52&&u[1]===0x49&&u[2]===0x46)return 'image/webp';return 'image/jpeg';}",
        "self.onmessage=function(e){var d=e.data,id=d.id,url=d.url,t0=performance.now();",
        "(async function(){",
        "try{var r=await fetch(url,{credentials:'omit'});if(!r.ok)throw new Error('HTTP '+r.status);",
        "var text=await r.text();var tNet=performance.now();",
        "var bytes=dec(text);var ascii=new TextDecoder('utf-8').decode(bytes);",
        "var ci=ascii.indexOf(',');var b64=(ci>=0?ascii.slice(ci+1):ascii).replace(/[\\r\\n\\s]/g,'');",
        "var raw=atob(b64);var img=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)img[i]=raw.charCodeAt(i);",
        "var tDec=performance.now();var blob=new Blob([img],{type:sniff(img)});",
        "self.postMessage({id:id,ok:true,blob:blob,netMs:Math.round(tNet-t0),decMs:Math.round(tDec-tNet),bytes:img.length,mime:blob.type});",
        "}catch(err){self.postMessage({id:id,ok:false,err:String((err&&err.message)||err)});}",
        "})();};"
    ].join('');
    function hjGifIsTargetUrl(url) {
        return /\/hjstore\/images\/[^?#]*\.gif\.txt(?:[?#]|$)/i.test(String(url || ''));
    }
    let hjGifAsyncNoAnchor = 0;
    const hjGifNoAnchorUrls = new Set();
    function hjGifAnchorReady(url) {
        try {
            if (hjGifNoAnchorUrls.has(String(url))) return false;
            return hjFindGifImgs(url).length > 0;
        } catch (e) { return false; }
    }
    function hjGifDedupTrim() {
        const completed = Array.from(hjGifDedup).filter(([, rec]) => typeof rec.text === 'string');
        while (completed.length > HJ_GIF_DEDUP_CACHE_MAX) {
            hjGifDedup.delete(completed.shift()[0]);
        }
    }
    function hjGifDedupGate(xhr, url) {
        if (!hjGifIsTargetUrl(url)) return false;
        if (hjGifWorkerUnavailable) return false;
        if (hjGifAsyncFill && !hjEnsureGifWorkers()) return false;
        if (hjGifAsyncFill) {
            if (!hjGifAnchorReady(url)) {
                hjGifAsyncNoAnchor++;
                return false;
            }
            hjGifAsyncStubbed++;
            try { hjStubXhrResponse(xhr, hjGifStubBody(), 'text/plain;charset=utf-8'); } catch (e) { }
            hjGifAsyncEnqueue(url);
            return true;
        }
        if (!hjGifDedupOn) return false;
        if (!hjGifQuotaUrls.has(url)) {
            if (hjGifQuotaUrls.size >= hjGifQuota) {
                hjGifQuotaStub++;
                try { hjStubXhrResponse(xhr, HJ_AD_STUB_BODY, 'text/plain;charset=utf-8'); } catch (e) { }
                return true;
            }
            hjGifQuotaUrls.add(url);
        }
        const rec = hjGifDedup.get(url);
        if (rec) {
            if (typeof rec.text === 'string' && (Date.now() - rec.doneAt) < HJ_GIF_DEDUP_TTL_MS) {
                hjGifDedupHits++;
                try { hjStubXhrResponse(xhr, rec.text, 'text/plain;charset=utf-8'); } catch (e) { }
                return true;
            }
            if (typeof rec.text !== 'string') {
                hjGifDedupShared++;
                rec.waiters.push(xhr);
                return true;
            }
        }
        const fresh = { text: undefined, doneAt: 0, waiters: [], settled: false };
        hjGifDedup.set(url, fresh);
        hjGifDedupMiss++;
        const settle = (text) => {
            if (fresh.settled) return;
            fresh.settled = true;
            clearTimeout(fresh.timer);
            const ws = fresh.waiters;
            fresh.waiters = [];
            if (typeof text !== 'string' || !text) {
                if (hjGifDedup.get(url) === fresh) hjGifDedup.delete(url);
                for (const w of ws) {
                    try { hjStubXhrResponse(w, '', 'text/plain;charset=utf-8'); } catch (e) { }
                }
                return;
            }
            fresh.text = text;
            fresh.doneAt = Date.now();
            for (const w of ws) {
                try { hjStubXhrResponse(w, text, 'text/plain;charset=utf-8'); } catch (e) { }
            }
            hjGifDedupTrim();
        };
        xhr.addEventListener('load', () => { try { settle(xhr.responseText); } catch (e) { settle(''); } }, { once: true });
        xhr.addEventListener('error', () => { settle(''); }, { once: true });
        xhr.addEventListener('timeout', () => { settle(''); }, { once: true });
        xhr.addEventListener('abort', () => { settle(''); }, { once: true });
        fresh.timer = setTimeout(() => settle(''), HJ_GIF_TASK_TIMEOUT_MS);
        return false;
    }
    function hjEnsureGifWorkers() {
        const n = Math.max(1, Math.min(4, Math.floor(hjGifAsyncConcurrency) || 3));
        if (hjGifWorkerPool && hjGifWorkerPool.length >= n) return hjGifWorkerPool;
        const pool = hjGifWorkerPool || [];
        let wUrl = '';
        try {
            if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL === 'undefined' || !URL.createObjectURL) throw new Error('Worker unavailable');
            wUrl = URL.createObjectURL(new Blob([HJ_GIF_WORKER_SRC], { type: 'text/javascript' }));
            for (let i = pool.length; i < n; i++) {
                const w = new Worker(wUrl);
                w.__hjBusy = false;
                w.__hjTask = null;
                w.onmessage = (e) => { hjGifWorkerDone(w, e.data); };
                w.onerror = (e) => {
                    try { console.warn('[海角脚本] GIF 补图 Worker 异常：' + ((e && e.message) || '')); } catch (err) { }
                    hjGifWorkerRelease(w, 'worker-error');
                };
                w.onmessageerror = () => hjGifWorkerRelease(w, 'message-error');
                pool.push(w);
            }
            hjGifWorkerPool = pool;
            console.info('[海角脚本] GIF 补图 Worker 池已就绪 ×' + n + '（动图将走独立线程解码）');
            return hjGifWorkerPool;
        } catch (e) {
            hjGifWorkerPool = pool;
            hjResetGifWorkers();
            console.warn('[海角脚本] GIF Worker 不可用，后续请求交回站点：' + ((e && e.message) || ''));
            hjGifWorkerUnavailable = true;
            hjGifAsyncFill = false;
            return null;
        } finally {
            if (wUrl) try { URL.revokeObjectURL(wUrl); } catch (e) { }
        }
    }
    function hjResetGifWorkers() {
        hjGifGeneration++;
        for (const timer of hjGifApplyTimers) clearTimeout(timer);
        hjGifApplyTimers.clear();
        for (const w of hjGifWorkerPool || []) {
            if (w.__hjTask) clearTimeout(w.__hjTask.timer);
            w.__hjTask = null;
            w.__hjBusy = false;
            w.onmessage = w.onerror = w.onmessageerror = null;
            try { w.terminate(); } catch (e) { }
        }
        hjGifWorkerPool = null;
        hjGifAsyncActive = 0;
        hjGifAsyncQueue.length = 0;
        hjGifAsyncQueued.clear();
        hjGifAsyncInfly.clear();
        hjGifAsyncFailed.clear();
    }
    function hjNormUrl(u) {
        try { return new URL(u, location.href).href; } catch (e) { return String(u || ''); }
    }
    function hjFindGifImgs(url) {
        const want = hjNormUrl(url);
        const out = [];
        let list = null;
        try { list = document.querySelectorAll('img[data-img_url], img[data-id]'); } catch (e) { return out; }
        for (const el of list) {
            const v = el.getAttribute('data-img_url') || el.getAttribute('data-id') || '';
            if (!v) continue;
            if (hjNormUrl(v) === want) out.push(el);
        }
        return out;
    }
    function hjApplyGifBlob(url, blob) {
        const t0 = performance.now();
        let els = hjFindGifImgs(url);
        if (!els.length) {
            const generation = hjGifGeneration;
            const timer = setTimeout(() => {
                hjGifApplyTimers.delete(timer);
                if (generation !== hjGifGeneration || !hjGifAsyncFill) return;
                const again = hjFindGifImgs(url);
                if (again.length) hjApplyGifBlobTo(url, blob, again);
                else {
                    hjGifAsyncNoElem++;
                    hjGifNoAnchorUrls.add(String(url));
                }
            }, 1500);
            hjGifApplyTimers.add(timer);
            return;
        }
        hjApplyGifBlobTo(url, blob, els);
        hjGifAsyncMainMs += performance.now() - t0;
    }
    function hjApplyGifBlobTo(url, blob, els) {
        let bUrl = '';
        try { bUrl = URL.createObjectURL(blob); } catch (e) { return; }
        hjGifBlobUrls.push(bUrl);
        while (hjGifBlobUrls.length > HJ_GIF_BLOB_URL_MAX) {
            const old = hjGifBlobUrls.shift();
            try { URL.revokeObjectURL(old); } catch (e) { }
        }
        let applied = 0;
        for (const el of els) {
            try {
                if (!el.isConnected) continue;
                el.src = bUrl;
                el.setAttribute('lazy', 'loaded');
                applied++;
            } catch (e) { }
        }
        if (applied) hjGifAsyncDone++;
    }
    function hjGifWorkerRelease(w, why) {
        const task = w && w.__hjTask;
        if (!task) {
            if (why && hjGifWorkerPool && hjGifWorkerPool.includes(w)) {
                w.onmessage = w.onerror = w.onmessageerror = null;
                try { w.terminate(); } catch (e) { }
                hjGifWorkerPool = hjGifWorkerPool.filter(item => item !== w);
                setTimeout(hjGifPump, 0);
            }
            return;
        }
        clearTimeout(task.timer);
        if (task) {
            hjGifAsyncInfly.delete(task.url);
            if (why) {
                hjGifAsyncFail++;
                const n = (hjGifAsyncFailed.get(task.url) || 0) + 1;
                hjGifAsyncFailed.set(task.url, n);
                if (n <= HJ_GIF_ASYNC_RETRY) {
                    hjGifAsyncQueued.add(task.url);
                    hjGifAsyncQueue.push(task.url);
                }
            }
        }
        if (w) { w.__hjBusy = false; w.__hjTask = null; }
        if (why && why !== 'response-error') {
            w.onmessage = w.onerror = w.onmessageerror = null;
            try { w.terminate(); } catch (e) { }
            if (hjGifWorkerPool) hjGifWorkerPool = hjGifWorkerPool.filter(item => item !== w);
        }
        if (hjGifAsyncActive > 0) hjGifAsyncActive--;
        setTimeout(hjGifPump, 0);
    }
    function hjGifWorkerDone(w, msg) {
        const task = w && w.__hjTask;
        if (!task || !msg || msg.id !== task.id) return;
        clearTimeout(task.timer);
        const url = task.url;
        hjGifAsyncInfly.delete(url);
        if (!msg.ok) {
            hjGifAsyncFail++;
            const n = (hjGifAsyncFailed.get(url) || 0) + 1;
            hjGifAsyncFailed.set(url, n);
            if (n <= HJ_GIF_ASYNC_RETRY) {
                hjGifAsyncQueued.add(url);
                hjGifAsyncQueue.push(url);
            }
            w.__hjBusy = false; w.__hjTask = null;
            if (hjGifAsyncActive > 0) hjGifAsyncActive--;
            setTimeout(hjGifPump, 0);
            return;
        }
        hjGifAsyncBytes += msg.bytes || 0;
        hjGifAsyncWorkerMs += (msg.netMs || 0) + (msg.decMs || 0);
        w.__hjBusy = false; w.__hjTask = null;
        if (hjGifAsyncActive > 0) hjGifAsyncActive--;
        try { hjApplyGifBlob(url, msg.blob); } catch (e) { }
        setTimeout(hjGifPump, 0);
    }
    function hjGifPump() {
        if (!hjGifAsyncFill) return;
        if (!hjGifAsyncQueue.length) return;
        const pool = hjEnsureGifWorkers();
        if (!pool) return;
        const max = Math.max(1, Math.min(4, Math.floor(hjGifAsyncConcurrency) || 3));
        for (const w of pool) {
            if (hjGifAsyncActive >= max) break;
            if (w.__hjBusy) continue;
            let url = '';
            while (hjGifAsyncQueue.length) {
                const cand = hjGifAsyncQueue.shift();
                hjGifAsyncQueued.delete(cand);
                if (!hjGifAsyncInfly.has(cand)) { url = cand; break; }
            }
            if (!url) break;
            hjGifAsyncInfly.add(url);
            w.__hjBusy = true;
            w.__hjTask = { url: url, id: ++hjGifWorkerSeq };
            w.__hjTask.timer = setTimeout(() => hjGifWorkerRelease(w, 'timeout'), HJ_GIF_TASK_TIMEOUT_MS);
            hjGifAsyncActive++;
            try { w.postMessage({ id: w.__hjTask.id, url: url }); }
            catch (e) { hjGifWorkerRelease(w, 'post-fail'); }
        }
    }
    function hjGifAsyncEnqueue(url) {
        if (!url || !hjGifAsyncFill) return;
        if ((hjGifAsyncFailed.get(url) || 0) > HJ_GIF_ASYNC_RETRY) return;
        if (hjGifAsyncQueued.has(url) || hjGifAsyncInfly.has(url)) return;
        hjGifAsyncQueued.add(url);
        hjGifAsyncQueue.push(url);
        setTimeout(hjGifPump, 0);
    }
    const hjAllowBuiltinLoginOverride = true;
    let hjBuiltinOverrideInflight = null;
    try {
        document.addEventListener('click', (e) => {
            const node = e.target;
            if (!node || typeof node.closest !== 'function') return;
            let hit = null;
            try {
                hit = node.closest('img, [data-img_url], .door-box-img, .imgcontainer, .listContainer,'
                    + ' .el-image, .el-image-viewer__wrapper, .van-image-preview, [class*="preview-image"],'
                    + ' [class*="viewer"]');
            } catch (err) { }
            if (!hit) {
                const self = node.closest('a, button, div, span, i, p');
                if (self && /查看大图|原图|大图/.test(String(self.textContent || '').slice(0, 30))) hit = self;
            }
            if (!hit) return;
            hjAllowFullImageUntil = Date.now() + HJ_FULL_IMAGE_VIEW_MS;
        }, true);
    } catch (e) { }
    let hjLastUserGestureAt = 0;
    let hjLastClickLabel = '';
    const HJ_MEANINGLESS_CLICK_LABEL = /^(取消|确定|关闭|关闭窗口|知道了|知道|好的|好|是|否|OK|ok|×|x|X)$/;
    try {
        document.addEventListener('click', (e) => {
            if (!e || e.isTrusted !== true) return;
            hjLastUserGestureAt = Date.now();
            try {
                const el = e.target && e.target.closest && e.target.closest('button, a, .van-button, [class*="btn"], [class*="like"], [class*="collect"], [class*="fav"]');
                const t = String((el && el.textContent) || '').replace(/\s+/g, '').slice(0, 8);
                if (t && HJ_MEANINGLESS_CLICK_LABEL.test(t)) hjLastClickLabel = '';
                else if (t) hjLastClickLabel = t;
            } catch (err) { }
        }, true);
    } catch (e) { }
    function hjRecentUserGesture(ms = 3000) {
        return (Date.now() - hjLastUserGestureAt) < ms;
    }
    function hjFindPageComponent(el) {
        try {
            let cur = el;
            while (cur) {
                if (cur.__vue__) {
                    let vm = cur.__vue__;
                    for (let depth = 0; depth < 6 && vm; depth++) {
                        if (vm.details || Array.isArray(vm.floorList) || Array.isArray(vm.commentList)) return vm;
                        vm = vm.$parent;
                    }
                }
                cur = cur.parentElement;
            }
        } catch (e) { }
        return null;
    }
    function hjUidByNickname(vm, nickname) {
        const name = String(nickname || '').trim();
        if (!vm || !name) return 0;
        const idOf = (o) => Number((o && (o.user_id || (o.user && o.user.id))) || 0);
        const nameOf = (o) => String((o && o.nickname) || '').trim();
        try {
            if (vm.details && vm.details.user && nameOf(vm.details.user) === name) {
                return Number(vm.details.user.id || 0);
            }
            for (const list of [vm.floorList, vm.commentList]) {
                if (!Array.isArray(list)) continue;
                for (const item of list) {
                    if (!item) continue;
                    if (nameOf(item) === name) return idOf(item);
                    if (item.quote && nameOf(item.quote) === name) return Number(item.quote.user_id || 0);
                    for (const sub of [item.floorComList, item.last_comment_list]) {
                        if (!Array.isArray(sub)) continue;
                        for (const s of sub) {
                            if (!s) continue;
                            if (nameOf(s) === name) return idOf(s);
                            if (s.quote && nameOf(s.quote) === name) return Number(s.quote.user_id || 0);
                        }
                    }
                }
            }
        } catch (e) { }
        return 0;
    }
    function hjExpandFullPostByOurselves(bottomBox) {
        try {
            const htmlBox = (bottomBox.parentElement && bottomBox.parentElement.querySelector('.html-box'))
                || document.querySelector('.html-box');
            if (!htmlBox) return false;
            htmlBox.classList.remove('ishide');
            try { bottomBox.style.display = 'none'; } catch (e) { }
            return true;
        } catch (e) { return false; }
    }
    try {
        document.addEventListener('click', (e) => {
            if (!hjAllowActions()) return;
            const node = e.target;
            if (!node || typeof node.closest !== 'function') return;
            let hit = null;
            try {
                hit = node.closest('.portraitcontainer, .user-box h1 > span, .user-box h1 > a');
            } catch (err) { }
            if (!hit) return;
            const vm = hjFindPageComponent(hit);
            if (!vm) return;
            try { if (vm.$store && vm.$store.state.isLogin) return; } catch (err) { }
            const span = hit.matches('h1 > span, h1 > a') ? hit : (hit.closest('.user-box') || hit.parentElement || {}).querySelector?.('h1 > span, h1 > a');
            const uid = hjUidByNickname(vm, span && span.textContent);
            if (!uid) return;
            try { e.stopPropagation(); e.preventDefault(); } catch (err) { }
            const nick = String((span && span.textContent) || '').trim();
            console.info('[海角脚本] 未登录点用户身份 → 直接进入对方主页（不经过站点登录门禁）：uid='
                + uid + '，' + nick);
            hjOpenUserProfile(vm, uid);
        }, true);
    } catch (e) { }
    function hjSiteIsLoggedIn() {
        try {
            const app = document.querySelector('#app');
            const vm = app && app.__vue__;
            if (!vm || !vm.$store || !vm.$store.state) return null;
            return vm.$store.state.isLogin === true;
        } catch (e) { return null; }
    }
    let hjProfileListForced = 0;
    function hjForceProfileList() {
        try {
            if (!hjAllowActions()) return false;
            if (!/^\/user\/userinfo/i.test(String(location.pathname || ''))) return false;
            const app = document.querySelector('#app');
            const root = app && app.__vue__;
            if (!root) return false;
            const seen = new Set();
            let forced = 0;
            const walk = (vm, depth) => {
                if (!vm || depth > 8 || seen.has(vm)) return;
                seen.add(vm);
                const d = vm.$data || vm._data || {};
                if (d && Object.prototype.hasOwnProperty.call(d, 'showlist')
                    && Object.prototype.hasOwnProperty.call(d, 'forumList')) {
                    if (d.showlist !== true) {
                        try { vm.showlist = true; forced++; } catch (e) { }
                    }
                }
                (vm.$children || []).forEach(c => walk(c, depth + 1));
            };
            walk(root, 0);
            if (forced) {
                hjProfileListForced++;
                if (hjProfileListForced === 1) {
                    console.info('[海角脚本] 主页帖子列表：已放行站点的渲染门禁（列表数据本就可匿名取得，不必等登录）');
                }
            }
            return forced > 0;
        } catch (e) { return false; }
    }
    async function hjPrimeAuthForNavigation() {
        try {
            if (hjReadOwnUserToken()) return true;                         
            const auth = await hjWithTimeout(hjEnsureAuth(), 6000);
            if (!auth || !auth.token || !auth.uid) return false;
            hjAuthCache = auth;
            hjPrimeSiteSession(auth);
            return true;
        } catch (e) { return false; }
    }
    function hjOpenUserProfile(vm, uid) {
        const fullPath = '/user/userinfo?uid=' + encodeURIComponent(String(uid));
        const openByRoute = () => {
            try {
                if (vm && vm.$router && typeof vm.$router.push === 'function') {
                    vm.$router.push({ path: '/user/userinfo', query: { uid: String(uid) } });
                    return;
                }
            } catch (e) { }
            try { location.href = fullPath; } catch (e) { }
        };
        const openByFullLoad = () => { try { location.href = fullPath; } catch (e) { } };
        if (hjSiteIsLoggedIn() === true) { openByRoute(); return; }
        const primedAtBoot = hjSiteSessionPrimedAtBoot;
        if (primedAtBoot) {
            console.info('[海角脚本] 存储里有凭据但站点自己算出来是未登录 → 不冒险走 SPA 路由，改整页打开');
        }
        showToast('正在准备登录态，马上打开 TA 的主页…');
        hjPrimeAuthForNavigation().then(ready => {
            console.info(ready
                ? '[海角脚本] 已先把凭据铺进站点会话，整页打开主页（这样帖子列表才会带凭据请求）'
                : '[海角脚本] 没拿到可用身份（后台登录失败/未配置账号），仍整页打开主页 —— '
                  + '列表数据本就可匿名取得，进去后脚本会放行站点的渲染门禁（见 hjForceProfileList）');
            openByFullLoad();
        });
    }
    try {
        document.addEventListener('click', (e) => {
            if (!hjAllowActions()) return;
            const node = e.target;
            if (!node || typeof node.closest !== 'function') return;
            let btn = null;
            try { btn = node.closest('.html-bottom-box button, .html-bottom-box'); } catch (err) { }
            if (!btn) return;
            const label = String(btn.textContent || '').trim().slice(0, 20);
            if (!/展开/.test(label)) return;
            let isLogin = null;
            try { const el = document.querySelector('#app'); isLogin = el && el.__vue__ && el.__vue__.$store.state.isLogin; } catch (err) { }
            if (isLogin !== false) return;
            if (!hjExpandFullPostByOurselves(btn.closest('.html-bottom-box') || btn)) return;
            try { e.stopPropagation(); e.preventDefault(); } catch (err) { }
            console.info('[海角脚本] 未登录点「展开完整贴文」→ 用我们自己的方式展开（不经过站点登录门禁）');
            try { expandAndCleanup(); } catch (err) { }
        }, true);
    } catch (e) { }
    let isDownloading = false;
    let downloadCancelRequested = false;
    let lastDownloadToastAt = 0;
    const activeDownloadAborters = new Set();
    const m3u8TextCache = new Map();
    let bestM3u8Candidate = null;
    let activePlaybackHls = null;
    let activePlaybackSession = null;
    let activePlaybackCleanup = null;
    let activePlaybackHost = null;
    let activePlaybackHostStyle = null;
    let activePlaybackHostCreatedByScript = false;
    let activePlaybackStyleUndo = [];
    let hjPlayerReattached = 0;                    
    let hjPlayerRevisible = 0;                          
    let hjRouteKey = null;
    let hjRouteGen = 0;
    const playbackManifestCache = new Map();
    const playbackManifestRequests = new Map();
    let lastPlaybackSelectionNote = '';
    let haijiaoKeyModulePromise = null;
    const haijiaoKeySeedCache = new Map();
    let hjPlayT0 = 0;
    let hjPlaySeq = 0;
    function hjPlayMark(step, extra) {
        const now = performance.now();
        if (!hjPlayT0) hjPlayT0 = now;
        const at = Math.round(now - hjPlayT0);
        const n = ++hjPlaySeq;
        const head = `[海角脚本 +${at}ms #${n}] ${step}`;
        if (extra !== undefined) console.info(head, extra);
        else console.info(head);
        return now;
    }
    const haijiaoTransformedKeyCache = new Map();
    let hjPreviewFallbackUrl = '';                     
    let hjDerivedFullM3u8Url = '';                                   
    const hjPipelineShapeCache = new Map();
    let hjDerivedVerifiedFullUrl = '';                              
    const hjSeenDomM3u8 = new Set();
    const hjDomFullPending = new Set();
    let hjPassTopicFullUrl = '';                                              
    const hjDomFullDone = new Set();
    let hjDomFullHref = '';                                                
    const hjRejectedTokens = new Set();
    hjAddStyle(`
                                          
                                                    
                                                                   
                                                                   
                                                            
                                                      
                                                                
        .addbox,
        .btnbox,
        .bigbox { display: none !important; }

                  
                                                                           
                                                       
                                                       
                                                                     
                                     
                                                  
                                                            
        .containeradvertising, [class*="advertising"],
        [class*="guanggao"], [class*="ads"], [id*="ads"],
        [class*="banner"], [id*="banner"],
        .float-box, .float-window, .couplet,
        .top-ad, .bottom-ad, .sidebar,
        .ad-container, .gg-box,
        iframe:not([src*="m3u8"]):not([src*="player"]):not([id*="play"]),
        .ad-box img, a[href*="bocai"]
        {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }

                                 
                                                                     
                                                          
                                                             
                                              
                                                                     
                                               
                                                              
                                             
                                      
                                                                 
        .preview-title:has(video) .video-div-btn,
        .preview-title:has(video) .preview-btn,
        .preview-title:has(video) .video-div-btn[data-url] {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }

                                                             
                                                    
                                        
                                                                                 
                                                         
                                                                                      
                                                            
                                                          
                                                
                                                      
                                
                                               
                                                           
        .sell-btn,
        .preview-title {
            border: none !important;
            background: transparent !important;
        }

                                             
        .html-box.ishide,
        .html-box.ishide[data-v-a89975f0] {
            display: block !important;
        }

                                       
        .html-box:not(.ishide) + .html-content,
        .html-box:not(.ishide) ~ .html-bottom-box {
            display: none !important;
        }

                                                                
                                                            
                                                                
        .van-dialog.luodiconfirm,
        .van-dialog.luodisconfirm,
        .announcement-popup,
        .el-dialog.luodiye_dialog,
        .el-dialog.announcement-dialog {
            display: none !important;
            visibility: hidden !important;
        }

                                
                                                                                            
                                                 
                                                      
                                                
                                     
                                             
                                                   

                             
                                 
                                                                 
                                                   
                                                       
                           
              
                                    
                                            
                                        

                                                
                                      
                                                                          
                                                                          
                                                                                       
                                                         
                                              

                                          
                                                                               
                                               
                                           
                                  

                                                    
                                                          
                                            
                                                                         
                                               
        .van-overlay {
            display: none !important;
        }

                                    
                                              
                                       
                                 
        .v-modal {
            display: none !important;
        }

                                                   
                                             
        body.el-popup-parent--hidden,
        body.van-overflow-hidden {
            overflow-y: auto !important;
            padding-right: 0 !important;
        }

        body { overflow-x: hidden; }
    `);
    hjAddStyle(`
        #${btnId}, #${dlBtnId} {
                                                                          
                                                               
            --hj-float-overlay: linear-gradient(145deg, #4ade80 0%, #10a35d 55%, #047857 100%);
        }
        #${btnId}::before,
        #${dlBtnId}::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            background-image: var(--hj-float-overlay);
            opacity: 0;
            transition: opacity 0.32s ease;
            pointer-events: none;
        }
        #${btnId}.played::before,
        #${dlBtnId}.done::before,
        #${dlBtnId}.busy::before { opacity: 1; }

                                                             
                                                                    
        #${btnId} .hj-float-icon,
        #${dlBtnId} .hj-float-icon {
            position: relative;
            z-index: 1;
            width: 24px;
            height: 24px;
            display: block;
            pointer-events: none;
        }
                                                              
        #${btnId} .hj-float-label,
        #${dlBtnId} .hj-float-label {
            position: relative;
            z-index: 1;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.4px;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
            pointer-events: none;
        }
        #${dlBtnId}.busy .hj-float-icon { width: 18px; height: 18px; }

        #${btnId} {
            position: fixed;
            bottom: 80px;
            right: 15px;
            width: 55px;
            height: 55px;
            box-sizing: border-box;
            padding: 0;
            border-radius: 50%;
                                                                    
                                             
            display: none;
            align-items: center;
            justify-content: center;
            color: #fff;
            background-color: #1e3c72;
            background-image: linear-gradient(145deg, #4d8bf5 0%, #1e3c72 58%, #14274d 100%);
            border: 1px solid rgba(255, 255, 255, 0.32);
            box-shadow: 0 8px 18px rgba(9, 24, 54, 0.46), 0 2px 6px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.30);
            z-index: 999999;
            cursor: pointer;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.26s ease;
        }
        #${btnId}.show { display: flex; }
                                                
        #${btnId}.active {
            transform: scale(0.9);
            box-shadow: 0 3px 9px rgba(9, 24, 54, 0.5), inset 0 2px 7px rgba(0, 0, 0, 0.34);
        }
        #${btnId}.played {
            border-color: rgba(255, 255, 255, 0.42);
            box-shadow: 0 8px 20px rgba(6, 118, 71, 0.48), 0 2px 6px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.36);
        }

        #${dlBtnId} {
            position: fixed;
            bottom: 145px;
            right: 15px;
            min-width: 55px;
            height: 55px;
            box-sizing: border-box;
                                                         
                                                           
            padding: 0 12px;
            gap: 6px;
            border-radius: 28px;
            display: none;
            align-items: center;
            justify-content: center;
            color: #fff;
            background-color: #d97706;
            background-image: linear-gradient(145deg, #fbbf24 0%, #f09a12 48%, #c2680a 100%);
            border: 1px solid rgba(255, 255, 255, 0.32);
            box-shadow: 0 8px 18px rgba(120, 63, 4, 0.42), 0 2px 6px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.34);
            z-index: 999999;
            cursor: pointer;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.26s ease;
        }
        #${dlBtnId}.show { display: flex; }
        #${dlBtnId}.active {
            transform: scale(0.9);
            box-shadow: 0 3px 9px rgba(120, 63, 4, 0.46), inset 0 2px 7px rgba(0, 0, 0, 0.32);
        }
        #${dlBtnId}.done {
            border-color: rgba(255, 255, 255, 0.42);
            box-shadow: 0 8px 20px rgba(6, 118, 71, 0.48), 0 2px 6px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.36);
        }
        #${dlBtnId}.busy {
            --hj-float-overlay: linear-gradient(145deg, #60a5fa 0%, #2563eb 52%, #1d4ed8 100%);
            border-color: rgba(255, 255, 255, 0.38);
            box-shadow: 0 8px 20px rgba(29, 78, 216, 0.46), 0 2px 6px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.34);
        }

                                           
                                                                          
                                     
        @keyframes hj-float-eq-bounce {
            0%, 100% { transform: scaleY(0.4); }
            50% { transform: scaleY(1); }
        }
        @keyframes hj-float-arc-spin {
            to { transform: rotate(360deg); }
        }
        #${btnId}.played .hj-eq-bar {
            transform-box: fill-box;
            transform-origin: 50% 50%;
            animation: hj-float-eq-bounce 0.9s ease-in-out infinite;
        }
        #${btnId}.played .hj-eq-b { animation-delay: 0.15s; }
        #${btnId}.played .hj-eq-c { animation-delay: 0.3s; }
        #${dlBtnId}.busy .hj-spin-arc {
            transform-box: view-box;
            transform-origin: 50% 50%;
            animation: hj-float-arc-spin 1.1s linear infinite;
        }
                                                
        @media (prefers-reduced-motion: reduce) {
            #${btnId}.played .hj-eq-bar,
            #${dlBtnId}.busy .hj-spin-arc { animation: none; }
        }

        #${dlStatusId} {
            position: fixed;
            left: 12px;
            right: 12px;
            bottom: 210px;
            z-index: 1000000;
            display: none;
            background: rgba(20,20,20,0.92);
            color: #fff;
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 13px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.45);
        }
        #${dlStatusId}.show { display: block; }
        #${dlStatusId} .hj-dl-title { margin-bottom: 7px; line-height: 1.35; word-break: break-all; }
        #${dlStatusId} .hj-dl-track { height: 6px; background: rgba(255,255,255,0.18); border-radius: 999px; overflow: hidden; }
        #${dlStatusId} .hj-dl-bar { height: 100%; width: 0%; background: linear-gradient(90deg, #00e676, #40c4ff); border-radius: 999px; transition: width .2s; }

        #hj-toast-mobile {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: #fff;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 1000000;
            font-size: 15px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
        }

                                                
                                                     
                                                

                                                             
                                                 
                                               
                                     
        #hj-no-account {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: min(420px, calc(100vw - 32px));
            max-height: calc(100vh - 40px);
            overflow: auto;
            background: #1e1e1e;
            color: #eee;
            border-radius: 14px;
            padding: 18px 18px 14px;
            z-index: 2147483000;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            font-size: 14px;
            line-height: 1.5;
        }
        #hj-no-account .hj-na-title { font-size: 17px; font-weight: bold; margin-bottom: 10px; text-align: center; }
                                
        #hj-no-account .hj-na-desc { color: #bdbdbd; font-size: 13px; margin-bottom: 12px; text-align: center; }
        #hj-no-account .hj-na-desc b { color: #ffd54f; }
        #hj-no-account .hj-na-help {
            display: none;
            background: #262626;
            border: 1px solid #3a3a3a;
            border-radius: 10px;
            padding: 11px 12px;
            margin-bottom: 12px;
            font-size: 13px;
            color: #d6d6d6;
        }
        #hj-no-account .hj-na-help.open { display: block; }
                                                   
                                                     
        #hj-no-account .hj-na-help .hj-na-step { margin-bottom: 7px; }
        #hj-no-account .hj-na-help .hj-na-step b { color: #90caf9; margin-right: 2px; }
        #hj-no-account .hj-na-help .hj-na-foot { margin-top: 9px; color: #8a8a8a; }
        #hj-no-account .hj-na-help code {
            display: block;
            margin: 6px 0;
            padding: 8px 10px;
            background: #141414;
            border-radius: 8px;
            color: #a5d6a7;
            font-family: Consolas, Menlo, monospace;
            font-size: 12px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        #hj-no-account .hj-na-btns { display: flex; gap: 10px; }
        #hj-no-account button {
            flex: 1;
            padding: 10px 12px;
            border-radius: 9px;
            border: 1px solid #3d3d3d;
            background: #2b2b2b;
            color: #eee;
            font-size: 14px;
            cursor: pointer;
        }
        #hj-no-account button.hj-na-primary { background: rgba(30,60,114,0.95); border-color: #3d5a8a; color: #fff; font-weight: bold; }

                                                                 
                                                          
                                        
                                     
    `);
    function markLandingDialogSeen() {
        try {
            if (sessionStorage.getItem('pageOpen') === null) {
                sessionStorage.setItem('pageOpen', '1');
            }
        } catch (e) { }
    }
    if (hjAllowActions()) markLandingDialogSeen();
    const VANT_NOT_LOGIN_TEXT = '您未登录，是否前往登录';
    const ELEMENT_TOKEN_EXPIRED_TEXTS = ['登录令牌已过期', '是否重新登录'];
    function getNodeText(el) {
        return String((el && el.textContent) || '');
    }
    function hjIsSiteLoginGate(node) {
        try { return !!node && getNodeText(node).includes(VANT_NOT_LOGIN_TEXT); } catch (e) { return false; }
    }
    let hjAutoSilencedLoginDialogs = 0;
    let hjLastLoginGateToastAt = 0;
    function hjNotifyLoginGate(action) {
        const now = Date.now();
        if (now - hjLastLoginGateToastAt < 4000) return;
        hjLastLoginGateToastAt = now;
        const who = action ? ('「' + action + '」') : '这个操作';
        showToast('未登录：' + who + '需要登录后才能用（页面头部的登录入口可以登录）');
    }
    function hjClosePassiveLoginWindow() {
        try {
            if (hjUserWantsLogin()) return;
            const lw = document.getElementById('hj_login__window__');
            if (!lw || !(lw.offsetWidth || lw.offsetHeight)) return;
            const closeBtn = lw.querySelector('.login-title-close') || lw.querySelector('.el-icon-close');
            if (closeBtn) closeBtn.click();
            else lw.style.display = 'none';
        } catch (e) { }
    }
    function silenceSiteDialogs() {
        document.querySelectorAll('.van-dialog').forEach(dialog => {
            if (!hjIsSiteLoginGate(dialog)) return;
            const cancelBtn = dialog.querySelector('.van-dialog__cancel')
                || dialog.querySelector('.van-dialog__footer .van-button:not(.van-dialog__confirm)');
            if (!cancelBtn) return;
            const stateKey = dialog.getAttribute('style') || '';
            if (dialog.dataset.hjSilentState === stateKey) return;
            dialog.dataset.hjSilentState = stateKey;
            hjAutoSilencedLoginDialogs++;
            if (hjRecentUserGesture()) hjNotifyLoginGate(hjLastClickLabel);
            try { cancelBtn.click(); } catch (e) { }
            try { requestAnimationFrame(() => { try { if (dialog.isConnected) cancelBtn.click(); } catch (e) { } }); } catch (e) { }
        });
        document.querySelectorAll('.el-message-box__wrapper').forEach(wrapper => {
            if (!hjIsSiteLoginGate(wrapper)) return;
            const cancelBtn = wrapper.querySelector('.el-message-box__btns .el-button:not(.el-button--primary)');
            const stateKey = wrapper.getAttribute('style') || '';
            if (wrapper.dataset.hjSilentState === stateKey) return;
            wrapper.dataset.hjSilentState = stateKey;
            hjAutoSilencedLoginDialogs++;
            if (hjRecentUserGesture()) hjNotifyLoginGate(hjLastClickLabel);
            if (cancelBtn) { try { cancelBtn.click(); } catch (e) { } }
            else { try { wrapper.remove(); document.querySelectorAll('.v-modal').forEach(m => m.remove()); } catch (e) { } }
        });
        document.querySelectorAll('.el-message-box__wrapper').forEach(wrapper => {
            const text = getNodeText(wrapper);
            if (!ELEMENT_TOKEN_EXPIRED_TEXTS.some(t => text.includes(t))) return;
            wrapper.remove();
            document.querySelectorAll('.v-modal').forEach(modal => modal.remove());
            console.warn('[海角脚本] 已静默「登录令牌已过期」弹窗，并阻止其触发的 /home 跳转');
            try {
                const staleAuth = hjReadBrowserToken();
                if (staleAuth && staleAuth.token) {
                    hjRejectedTokens.add(String(staleAuth.token));
                    console.info('[海角脚本] 站点已判定当前登录令牌过期，本次换址直接改用可用凭据');
                }
            } catch (e) { }
        });
    }
    const HJ_ACCOUNT = {
        username: '',
        password: ''
    };
    const HJ_AUTH_STORE = 'hj_script_auth_v1';
    const HJ_INJECTED_STORE = 'hj_script_injected_identity_v1';
    const HJ_VIDEO_URL_STORE = 'hj_script_video_url_v2';                                           
    const HJ_TOKEN_TTL_MS = 25 * 24 * 3600 * 1000;
    const HJ_VIDEO_URL_CACHE_MAX = 800;
    let hjAuthCache = null;                                
    let hjLogoutEpoch = 0;
    let hjTriedBrowserToken = '';
    let hjVideoUrlCache = null;                                           
    const hjInflightAttIds = new Set();
    let hjSignInInflight = null;
    let hjPassTopicInflight = null;
    let hjPassTopicFailedAt = 0;
    let hjFullIndexFailStreak = 0;
    let hjFullIndexFailAttId = 0;                                   
    let hjFullIndexCooldownUntil = 0;
    function hjStoreGet(key, fallback) {
        try {
            if (typeof GM_getValue === 'function') {
                const v = GM_getValue(key);
                if (v !== undefined && v !== null && v !== '') {
                    return typeof v === 'string' ? JSON.parse(v) : v;
                }
                return fallback;
            }
        } catch (e) { }
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    }
    function hjStoreSet(key, value) {
        const text = JSON.stringify(value);
        try {
            if (typeof GM_setValue === 'function') { GM_setValue(key, text); return; }
        } catch (e) { }
        try { localStorage.setItem(key, text); } catch (e) { }
    }
    function hjResolveAccount() {
        if (HJ_ACCOUNT.username && HJ_ACCOUNT.password) {
            return { username: String(HJ_ACCOUNT.username), password: String(HJ_ACCOUNT.password), source: 'baked' };
        }
        return null;
    }
    function hjClearAccount() {
        try { if (typeof GM_deleteValue === 'function') GM_deleteValue(HJ_AUTH_STORE); else hjStoreSet(HJ_AUTH_STORE, null); } catch (e) { }
        try { if (typeof GM_deleteValue === 'function') GM_deleteValue(HJ_INJECTED_STORE); else hjStoreSet(HJ_INJECTED_STORE, null); } catch (e) { }
        hjAuthCache = null;
        hjTriedBrowserToken = '';
        hjRejectedTokens.clear();
        hjVideoUrlCache = {};
        try { hjStoreSet(HJ_VIDEO_URL_STORE, {}); } catch (e) { }
        try { hjStoreSet(HJ_PASS_TOPIC_STORE, null); } catch (e) { }
        try { hjVideoUrlCache = {}; } catch (e) { }
        hjPassTopicFullUrl = '';
        capturedM3u8Url = '';
        hjPreviewFallbackUrl = '';
        hjDerivedFullM3u8Url = '';
        hjDerivedVerifiedFullUrl = '';
        hjVideoPassTopic = 0;
        hjVideoPassTopicInflight = null;
        hjPassTopicInflight = null;
        hjPassTopicFailedAt = 0;
        try {
            const inj = hjGetInjectedIdentityStale();
            if (inj && inj.token) {
                const cookieToken = (((document.cookie || '').match(/(?:^|;\s*)token=([^;]*)/) || [])[1]) || '';
                if (String(cookieToken) === String(inj.token)) {
                    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                    document.cookie = 'uid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                }
                try {
                    if (String(sessionStorage.getItem('token') || '') === String(inj.token)) {
                        sessionStorage.removeItem('token');
                        sessionStorage.removeItem('uid');
                        sessionStorage.removeItem('userInfo');
                    }
                } catch (e) { }
            }
        } catch (e) { }
        console.info('[海角脚本] 已清除脚本自己缓存的凭据（源码槽里的账号仍会继续生效，这是预期行为；'
            + '要换账号请直接在脚本里改 HJ_ACCOUNT 那两行）');
        return true;
    }
    function hjGetInjectedIdentityStale() {
        try { return hjGetInjectedIdentity(); } catch (e) { return null; }
    }
    function hjMd5(input) {
        const s = String(input);
        const bytes = [];
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            if (c < 0x80) bytes.push(c);
            else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
            else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
                const c2 = s.charCodeAt(++i);
                const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
                bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
            } else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
        }
        const bitLen = bytes.length * 8;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) bytes.push(0);
        const loLen = bitLen >>> 0;
        const hiLen = Math.floor(bitLen / 4294967296);
        for (let i = 0; i < 4; i++) bytes.push((loLen >>> (i * 8)) & 0xff);
        for (let i = 0; i < 4; i++) bytes.push((hiLen >>> (i * 8)) & 0xff);
        let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
        const S = [
            7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
            5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
            4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
            6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
        ];
        const K = [];
        for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
        for (let off = 0; off < bytes.length; off += 64) {
            const M = [];
            for (let i = 0; i < 16; i++) {
                M[i] = bytes[off + i * 4] | (bytes[off + i * 4 + 1] << 8) | (bytes[off + i * 4 + 2] << 16) | (bytes[off + i * 4 + 3] << 24);
            }
            let A = a0, B = b0, C = c0, D = d0;
            for (let i = 0; i < 64; i++) {
                let F, g;
                if (i < 16) { F = (B & C) | (~B & D); g = i; }
                else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
                else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
                else { F = C ^ (B | ~D); g = (7 * i) % 16; }
                F = (F + A + K[i] + M[g]) | 0;
                A = D; D = C; C = B;
                B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) | 0;
            }
            a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
        }
        const hex = (n) => {
            let out = '';
            for (let i = 0; i < 4; i++) out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
            return out;
        };
        return hex(a0) + hex(b0) + hex(c0) + hex(d0);
    }
    let hjSiteLoginPrimed = false;
    let hjSiteSessionPrimedAtBoot = false;
    let hjLoginIntentAt = 0;
    const HJ_LOGIN_INTENT_WINDOW_MS = 4000;
    try {
        document.addEventListener('click', (e) => {
            const node = e.target;
            if (!node || !node.closest) return;
            const el = node.closest('a, button, div, span, li, p');
            if (!el) return;
            try {
                const lw = document.getElementById('hj_login__window__');
                if (lw && lw.contains(el)) { hjLoginIntentAt = Date.now(); return; }
            } catch (err) { }
            const text = String(el.textContent || '').replace(/\s+/g, '');
            if (text === '登录' || text === '立即登录' || text === '去登录' || text === '登陆') {
                hjLoginIntentAt = Date.now();
                return;
            }
            const idc = String(el.id || '');
            if (/login|signin|signIn|logon/i.test(idc)) {
                hjLoginIntentAt = Date.now();
            }
        }, true);
    } catch (e) { }
    function hjUserWantsLogin() {
        return (Date.now() - hjLoginIntentAt) < HJ_LOGIN_INTENT_WINDOW_MS;
    }
    function hjPrimeSiteSession(auth, opts) {
        try {
            if (!auth || !auth.token || !auth.uid) return false;
            const overrideRejected = !!(opts && opts.overrideRejected);
            const ownToken = hjReadOwnUserToken();
            const mirroredOwn = !!ownToken && String(auth.token) === String(ownToken);
            if (ownToken && !mirroredOwn && !overrideRejected) return false;
            sessionStorage.setItem('token', String(auth.token));
            sessionStorage.setItem('uid', String(auth.uid));
            if (mirroredOwn) return true;                                               
            if (auth.user && typeof auth.user === 'object') {
                sessionStorage.setItem('userInfo', JSON.stringify(auth.user));
            }
            const injIdentity = hjGetInjectedIdentity();
            const cookieTokenNow = ((document.cookie || '').match(/(?:^|;\s*)token=([^;]*)/) || [])[1] || '';
            if (cookieTokenNow && !overrideRejected && (!injIdentity || String(cookieTokenNow) !== String(injIdentity.token))) {
                hjSiteLoginPrimed = true;
                return true;
            }
            document.cookie = 'token=' + encodeURIComponent(String(auth.token)) + '; path=/';
            document.cookie = 'uid=' + encodeURIComponent(String(auth.uid)) + '; path=/';
            document.cookie = 'NOTLOGIN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            hjMarkInjectedIdentity(auth.token, auth.uid);
            hjSiteLoginPrimed = true;
            return true;
        } catch (e) { }
        return false;
    }
    (function hjPrimeSiteSessionEarly() {
        try {
            if (!hjAllowActions()) return;
            if (hjReadOwnUserToken()) { hjSiteSessionPrimedAtBoot = true; return; }
            const cached = hjReadAuth();
            if (cached && cached.token && cached.uid && hjPrimeSiteSession(cached)) {
                hjSiteSessionPrimedAtBoot = true;
                return;
            }
            const bt = hjReadBrowserToken();
            if (bt && bt.token && bt.uid) {
                try {
                    sessionStorage.setItem('token', String(bt.token));
                    sessionStorage.setItem('uid', String(bt.uid));
                    hjSiteSessionPrimedAtBoot = true;
                    console.info('[海角脚本] 启动阶段已就绪：站点第一帧就会认这份登录态（无需刷新）');
                } catch (e) { }
            }
        } catch (e) { }
    })();
    async function hjWarmUpSiteLogin() {
        try {
            if (!hjAllowActions()) return;
            const atSiteGate = String(location.pathname || '/') === '/' && !document.getElementById('app');
            if (atSiteGate) {
                console.info('[海角脚本] 当前是站点入口警告页：只准备登录态，不自己刷新（马上会跳到 /home，凭据跟着走）');
            }
            const hadToken = !!sessionStorage.getItem('token');
            const auth = await hjEnsureAuth();
            if (!auth || !auth.token) return;
            const ownToken = hjReadOwnUserToken();
            if (ownToken && String(auth.token) !== String(ownToken)) return;
            hjAuthCache = auth;
            hjPrimeSiteSession(auth);
            if (hadToken) return;
            if (atSiteGate) {
                console.info('[海角脚本] 登录态已就绪（警告页不刷新，等站点自己跳到 /home）');
                return;
            }
            console.info('[海角脚本] 首次启用免登录搜索，立即刷新一次页面让站点接管登录态');
            try { location.reload(); } catch (e) { }
        } catch (e) { }
    }
    function hjReadAuth() {
        if (hjAuthCache) return hjAuthCache;
        const saved = hjStoreGet(HJ_AUTH_STORE, null);
        if (saved && saved.token && saved.uid) hjAuthCache = saved;
        return hjAuthCache;
    }
    function hjReadBrowserToken() {
        try {
            const cookie = document.cookie || '';
            const cookieToken = (cookie.match(/(?:^|;\s*)token=([^;]*)/) || [])[1];
            const cookieUid = (cookie.match(/(?:^|;\s*)uid=([^;]*)/) || [])[1];
            let sessionToken = '';
            let sessionUid = '';
            try {
                sessionToken = sessionStorage.getItem('token') || '';
                sessionUid = sessionStorage.getItem('uid') || '';
            } catch (e) { }
            const token = cookieToken || sessionToken;
            const uid = cookieUid || sessionUid;
            if (token && uid && token !== 'null' && token !== 'undefined') {
                return { token: String(token), uid: String(uid), fromBrowser: true, savedAt: Date.now() };
            }
        } catch (e) { }
        return null;
    }
    function hjGetInjectedIdentity() {
        const inj = hjStoreGet(HJ_INJECTED_STORE, null);
        return (inj && inj.token && inj.uid) ? inj : null;
    }
    function hjMarkInjectedIdentity(token, uid) {
        try { hjStoreSet(HJ_INJECTED_STORE, { token: String(token), uid: String(uid), savedAt: Date.now() }); } catch (e) { }
    }
    function hjReadOwnUserToken() {
        const inj = hjGetInjectedIdentity();
        const injToken = inj ? String(inj.token) : '';
        const isOwn = (v) => {
            const s = String(v == null ? '' : v);
            return !!s && s !== 'null' && s !== 'undefined' && s !== injToken;
        };
        try {
            const bt = hjReadBrowserToken();
            if (bt && isOwn(bt.token)) return String(bt.token);
            const cookieToken = (((document.cookie || '').match(/(?:^|;\s*)token=([^;]*)/) || [])[1]) || '';
            if (isOwn(cookieToken)) return String(cookieToken);
            let sessionToken = '';
            try { sessionToken = sessionStorage.getItem('token') || ''; } catch (e) { }
            if (isOwn(sessionToken)) return String(sessionToken);
        } catch (e) { }
        return '';
    }
    function hjSaveAuth(token, uid, user) {
        hjAuthCache = { token: String(token), uid: String(uid), savedAt: Date.now() };
        if (user && typeof user === 'object') hjAuthCache.user = user;
        hjStoreSet(HJ_AUTH_STORE, { token: hjAuthCache.token, uid: hjAuthCache.uid, savedAt: hjAuthCache.savedAt });
        return hjAuthCache;
    }
    function hjIsAuthFresh(auth) {
        return !!auth && !!auth.token && (Date.now() - Number(auth.savedAt || 0)) < HJ_TOKEN_TTL_MS;
    }
    let hjLastSignInNote = '';
    let hjLastSignInNoteAt = 0;
    function hjFreshSignInNote() {
        return (hjLastSignInNote && (Date.now() - hjLastSignInNoteAt) < 120000) ? hjLastSignInNote : '';
    }
    function hjNoteOnce(note) {
        const now = Date.now();
        if (hjLastSignInNote === note && hjLastSignInNoteAt && (now - hjLastSignInNoteAt) < 30000) return false;
        hjLastSignInNote = note;
        hjLastSignInNoteAt = now;
        return true;
    }
    async function hjSignIn() {
        const acc = hjResolveAccount();
        if (!acc) {
            const note = '未配置账号：服务端只给 30 秒试看（付费帖），免费视频连试看都没有（脚本里填上自己的账号即可）';
            if (hjNoteOnce(note)) console.warn('[海角脚本] 没有配置账号，无法登录换址：' + note);
            return null;
        }
        if (hjSignInInflight) return await hjSignInInflight;
        const epoch = hjLogoutEpoch;
        const run = (async () => {
        const ua = navigator.userAgent || '';
        const isApple = /Mac|iPhone|iPad|iPod|Macintosh/i.test((navigator.platform || '') + ' ' + ua);
        const res = await fetch('/api/login/signin', {
            method: 'POST',
            credentials: 'omit',
            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            body: JSON.stringify({
                username: acc.username,
                password: acc.password,
                captchaCode: '',
                captchaId: '',
                ref: '/',
                sign: hjMd5(acc.username + acc.password + ua),
                CaptchaImg: isApple ? 'i' : 'e'
            })
        });
        const text = await res.text();
        const data = decodeEncryptString(text);
        if (data && data.token && data.user && data.user.id) {
            if (epoch !== hjLogoutEpoch) return null;
            hjLastSignInNote = '';
            hjLastSignInNoteAt = 0;
            console.info('[海角脚本] 后台自动登录成功，取址凭据已刷新');
            const saved = hjSaveAuth(data.token, data.user.id, data.user);
            try { hjPrimeSiteSession(saved); } catch (e) { }
            return saved;
        }
        const failNote = '登录失败：账号或密码不对';
        if (hjNoteOnce(failNote)) console.warn('[海角脚本] ' + failNote + '（脚本里 HJ_ACCOUNT 那两行改成自己的账号密码后保存即可）');
        console.debug('[海角脚本] 登录被拒明细：', {
            http: res.status,
            message: (data && data.message) || '',
            errorCode: (data && data.errorCode),
            envelope: String(text || '').slice(0, 200)
        });
        return null;
        })();
        hjSignInInflight = run;
        try { return await run; }
        finally { if (hjSignInInflight === run) hjSignInInflight = null; }
    }
    async function hjEnsureAuth(forceRefresh = false) {
        const rejected = t => !!t && hjRejectedTokens.has(String(t));
        const browserAuth = hjReadBrowserToken();
        if (browserAuth && !rejected(browserAuth.token)) {
            hjTriedBrowserToken = String(browserAuth.token);
            return browserAuth;
        }
        const cached = hjReadAuth();
        if (hjIsAuthFresh(cached) && !rejected(cached.token)) return cached;
        if (!forceRefresh && !hjRejectedTokens.size && hjReadOwnUserToken()) return null;
        return await hjSignIn();
    }
    function hjGetVideoUrlCache() {
        if (!hjVideoUrlCache) {
            const saved = hjStoreGet(HJ_VIDEO_URL_STORE, null);
            hjVideoUrlCache = (saved && typeof saved === 'object') ? saved : {};
        }
        return hjVideoUrlCache;
    }
    function hjSaveVideoUrlCache(cache) {
        const keys = Object.keys(cache);
        if (keys.length > HJ_VIDEO_URL_CACHE_MAX) {
            keys.sort((a, b) => Number(cache[a].savedAt || 0) - Number(cache[b].savedAt || 0));
            for (const key of keys.slice(0, keys.length - HJ_VIDEO_URL_CACHE_MAX)) delete cache[key];
        }
        hjStoreSet(HJ_VIDEO_URL_STORE, cache);
    }
    const HJ_PASS_TOPIC_STORE = 'hj_script_pass_topic_v1';
    async function hjPickPassTopic(auth) {
        const nodes = ['888', '900', '972', '300'];
        let sawAnyTopic = 0, sawFreeTopic = 0, lastErr = '';
        for (const node of nodes) {
            try {
                const res = await fetch('/api/topic/node/topics?node_id=' + node + '&page=1&limit=20', {
                    method: 'GET',
                    credentials: 'omit',
                    headers: {
                        'X-User-Token': auth.token,
                        'X-User-Id': String(auth.uid),
                        'pcVer': '2'
                    }
                });
                const data = decodeEncryptString(await res.text());
                const results = (data && data.results) || [];
                sawAnyTopic += results.length;
                for (const t of results) {
                    if (Number(t.money_type) !== 0) continue;
                    sawFreeTopic++;
                    const picked = Number(t.topicId || t.id || 0);
                    if (picked) return picked;
                }
            } catch (e) { lastErr = String((e && e.message) || e); }
        }
        console.warn('[海角脚本] 未找到可用通行证帖（完整索引将无法换取）：', {
            扫描帖子数: sawAnyTopic, 其中免费: sawFreeTopic, 异常: lastErr || '(无异常)'
        });
        return 0;
    }
    async function hjGetPassTopicId(auth) {
        const cached = hjStoreGet(HJ_PASS_TOPIC_STORE, null);
        if (hjLogoutEpoch === 0 && cached && cached.topicId && (Date.now() - Number(cached.savedAt || 0)) < 24 * 3600 * 1000) {
            return Number(cached.topicId);
        }
        if (hjPassTopicFailedAt && Date.now() - hjPassTopicFailedAt < 30000) return 0;
        if (hjPassTopicInflight) return await hjPassTopicInflight;
        const run = (async () => {
            const epoch = hjLogoutEpoch;
            const picked = await hjPickPassTopic(auth);
            if (picked) {
                if (epoch !== hjLogoutEpoch) return 0;
                hjPassTopicFailedAt = 0;
                if (hjLogoutEpoch === 0) hjStoreSet(HJ_PASS_TOPIC_STORE, { topicId: picked, savedAt: Date.now() });
                console.info('[海角脚本] 通行证帖已选定 ' + picked + '（用于换取完整视频索引）');
            } else {
                hjPassTopicFailedAt = Date.now();
                console.info('[海角脚本] 通行证帖本次未选中，30 秒内不再重复扫描板块');
            }
            return picked;
        })();
        hjPassTopicInflight = run;
        try { return await run; }
        finally { if (hjPassTopicInflight === run) hjPassTopicInflight = null; }
    }
    async function hjRequestVideoUrl(attId, topicId, auth) {
        const passTopic = hjLogoutEpoch > 0 ? 0 : await hjGetPassTopicId(auth);
        const res = await fetch('/api/attachment', {
            method: 'POST',
            credentials: 'omit',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'X-User-Token': auth.token,
                'X-User-Id': String(auth.uid),
                'pcVer': '2'
            },
            body: JSON.stringify({
                id: Number(attId),
                resource_id: passTopic > 0 ? passTopic : Number(topicId),
                resource_type: 'topic',
                line: ''
            })
        });
        const text = await res.text();
        let raw = null;
        try { raw = JSON.parse(text); } catch (e) { }
        if (!raw) return { url: '' };
        if (Number(raw.errorCode) === 1 || raw.success === false) {
            if (auth && auth.token) hjRejectedTokens.add(String(auth.token));
            hjStoreSet(HJ_PASS_TOPIC_STORE, null);
            return { url: '', needReauth: true };
        }
        const data = decodeEncryptString(text);
        return { url: (data && data.remoteUrl) || '' };
    }
    async function hjProbeFullIndexByPreviewNaming(attId, previewUrl) {
        const preview = resolveUrl(previewUrl || '', location.href);
        if (!preview || !isPreviewM3u8Url(preview)) return '';
        const shapeKey = String(attId || '') || preview;
        if (hjPipelineShapeCache.get(shapeKey) === 'hash') return '';
        let text = getCachedM3u8Text(preview);
        if (!text) {
            try {
                text = await gmGet(preview, 'text', {}, { timeoutMs: 12000, preferFetch: true });
            } catch (e) {
                console.warn('[海角脚本] 试看索引读取失败，改用通行证法：', e && e.message);
                return '';
            }
            if (text) cacheM3u8Text(preview, text);
        }
        if (!/#EXTM3U/i.test(String(text || ''))) return '';
        const tsLine = String(text).split(/\r?\n/).map(line => line.trim())
            .find(line => line && !line.startsWith('#') && /\.ts(?:[?#]|$)/i.test(line));
        if (!tsLine) return '';
        const derived = deriveM3u8UrlFromSegmentLine(tsLine, preview);
        if (!derived) {
            hjPipelineShapeCache.set(shapeKey, 'hash');
            console.info('[海角脚本] 该帖为新管线（试看分片名为内容哈希，裁不出完整索引名），改走通行证法：' + tsLine);
            return '';
        }
        if (derived === preview || isPreviewM3u8Url(derived)) return '';
        try {
            const candidateText = await gmGet(derived, 'text', {}, { timeoutMs: 12000, preferFetch: true });
            if (!/#EXTM3U/i.test(String(candidateText || ''))) throw new Error('反推目标不是 M3U8');
            const info = analyzeM3u8TextForCandidate(candidateText, derived);
            const previewInfo = analyzeM3u8TextForCandidate(text, preview);
            if (!info || info.isMaster || !info.segmentCount) throw new Error('反推目标没有媒体分片');
            if (previewInfo && info.segmentCount <= previewInfo.segmentCount) throw new Error('段数不优于试看');
            hjPipelineShapeCache.set(shapeKey, 'legacy');
            console.info('[海角脚本] 试看命名反推命中（旧管线，无需通行证法）：' + derived +
                '（' + info.segmentCount + ' 段，试看 ' + (previewInfo ? previewInfo.segmentCount : '?') + ' 段）');
            return derived;
        } catch (e) {
            hjPipelineShapeCache.set(shapeKey, 'hash');
            console.info('[海角脚本] 该帖为新管线（试看分片名为内容哈希），反推不适用，改走通行证法：' +
                (e && e.message ? e.message : e));
            return '';
        }
    }
    async function hjFetchFullIndexByAttId(attId, previewUrl = '') {
        const id = Number(attId);
        if (!id) return '';
        const cache = hjGetVideoUrlCache();
        const key = 'att:' + id;
        if (cache[key] && cache[key].url) return cache[key].url;
        if (hjFullIndexFailAttId !== id) {
            hjFullIndexFailAttId = id;
            hjFullIndexFailStreak = 0;
            hjFullIndexCooldownUntil = 0;
        }
        const derived = await hjProbeFullIndexByPreviewNaming(id, previewUrl);
        if (derived) {
            hjDerivedVerifiedFullUrl = derived;
            cache[key] = { url: derived, topicId: 0, savedAt: Date.now() };
            hjSaveVideoUrlCache(cache);
            hjFullIndexFailStreak = 0;
            hjFullIndexCooldownUntil = 0;
            return derived;
        }
        if (hjFullIndexCooldownUntil > Date.now()) return '';
        const url = await hjFetchFullIndexByAttIdInner(id, key, cache);
        if (url) {
            if (hjFullIndexFailStreak) console.info('[海角脚本] 完整索引换址恢复正常');
            hjFullIndexFailStreak = 0;
            hjFullIndexCooldownUntil = 0;
            return url;
        }
        hjFullIndexFailStreak++;
        if (hjFullIndexFailStreak >= 3) {
            hjFullIndexCooldownUntil = Date.now() + 5 * 60 * 1000;
            console.warn('[海角脚本] 完整索引换址连续失败 ' + hjFullIndexFailStreak +
                ' 次，5 分钟内不再重试（本次及此后几次播放为 30 秒预览）。');
        }
        return '';
    }
    async function hjFetchFullIndexByAttIdInner(id, key, cache) {
        let auth = await hjEnsureAuth();
        if (!auth) return '';
        let result = await hjRequestVideoUrl(id, 0, auth);
        if (result.needReauth) {
            auth = await hjEnsureAuth(true);
            if (!auth) return '';
            result = await hjRequestVideoUrl(id, 0, auth);
        }
        if (!result.url) return '';
        if (isPreviewM3u8Url(result.url)) return '';
        cache[key] = { url: result.url, topicId: 0, savedAt: Date.now() };
        hjSaveVideoUrlCache(cache);
        return result.url;
    }
    try {
        unsafeWindow.__hjAccount = () => {
            const tail = (t) => (t ? '…' + String(t).slice(-8) : '(无)');
            const ageMin = (ts) => Number(ts) ? Math.round((Date.now() - Number(ts)) / 60000) + ' 分钟前' : '(无时间戳)';
            const browser = hjReadBrowserToken();
            const cached = hjReadAuth();
            const own = hjReadOwnUserToken();
            const inj = hjGetInjectedIdentity();
            const cookieToken = (((document.cookie || '').match(/(?:^|;\s*)token=([^;]*)/) || [])[1]) || '';
            const acc = hjResolveAccount();
            return {
                源码槽账密: HJ_ACCOUNT.username
                    ? HJ_ACCOUNT.username + '（脚本正文里写着的那份）'
                    : '(空 —— 发行版形态：脚本里填上自己的账号即可)',
                取址时实际会用: acc
                    ? (acc.username + '（来源：源码槽）')
                    : '(没有 —— 未配置账号时服务端只下发 30 秒试看，免费视频连试看都没有；控制台 __hjSetupHelp() 看配置方法)',
                站点浏览器凭据: browser ? { uid: browser.uid, token尾: tail(browser.token), 是脚本自己铺的吗: String(browser.token) === String(inj && inj.token) } : '(无)',
                站点cookie: cookieToken ? (String(cookieToken) === String(inj && inj.token) ? '脚本铺的那一份' : '用户自己登录留下的一份') : '(无)',
                脚本缓存凭据: cached ? { uid: cached.uid, token尾: tail(cached.token), 写入于: ageMin(cached.savedAt), 还在25天有效期内: hjIsAuthFresh(cached) } : '(无)',
                用户自有登录: own ? tail(own) : '(无 —— 站点界面处于未登录)',
                上次取身份的结果: hjLastSignInNote || '(正常)',
                已被拒token数: hjRejectedTokens.size,
                登录态自愈: hjHealReport
                    ? ('本页试过：' + (hjHealReport.跳过 ? '跳过（' + hjHealReport.跳过 + '）' : (hjHealReport.刷新 ? '已换凭据并刷新' : '(未完成)')))
                      + '｜站点当时是未登录=' + hjHealReport.siteIsLogin
                      + (hjHealReport.suspect尾 ? '｜手上有份凭据…' + hjHealReport.suspect尾 : '｜手上没有浏览器凭据')
                      + (hjHealReport.站点校验 ? '｜站点校验=' + hjHealReport.站点校验 : '')
                      + (hjHealReport.换到 ? '｜换到…' + hjHealReport.换到 : '')
                      + (hjHealReport.铺进去 ? '｜铺会话=' + hjHealReport.铺进去 : '')
                    : '(本页还没跑过 —— 它只在"站点算出来未登录"时才会介入)',
                本轮是否登录过: hjSignInInflight ? '正在登录' : (hjAuthCache && (Date.now() - Number(hjAuthCache.savedAt || 0)) < 600000 ? '是（' + ageMin(hjAuthCache.savedAt) + '）' : '否/很久以前'),
                自动收掉的登录提示次数: hjAutoSilencedLoginDialogs,
                说明: '① 站点浏览器凭据 与 ② 脚本缓存凭据 任一有效，就不会再登录一次（控制台因此看不到「后台自动登录成功」）'
                    + '，但取址用的**仍然是脚本账号的身份**，不是匿名。'
                    + '换账号：直接在脚本里改 HJ_ACCOUNT 那两行（控制台改不了脚本正文）；'
                    + '清掉脚本缓存的凭据：__hjAccountClear()（源码槽里的账号会立刻重新生效，这是预期行为）'
            };
        };
    } catch (e) { }
    function hjSetupHelpHtml() {
        const step = (n, html) => '<div class="hj-na-step"><b>' + n + '.</b> ' + html + '</div>';
        return ''
            + step(1, '在脚本列表里找到本脚本，点右侧的「<b>编辑</b>」；')
            + step(2, '按 <b>Ctrl+F</b>（手机上是页面内搜索）搜 <b>HJ_ACCOUNT</b>，会看到这两行：')
            + '<code>username: \'\','
            + '\npassword: \'\',</code>'
            + step(3, '把两个 <b>\'\'</b> 里分别改成你的海角账号和密码（保留引号）；')
            + step(4, '按 <b>Ctrl+S</b> 保存，回到海角页面刷新一次就好了。')
            + '<div class="hj-na-foot"><b>不想把密码写进脚本？</b>换方式二：'
            + '直接在站点上登录一次就够了 —— 脚本会沿用你浏览器里的那份登录态取址，'
            + '不需要往脚本里填任何东西。代价是站点登录态会过期（站点自己会弹「登录令牌已过期」），'
            + '过期后再登录一次即可。</div>'
            + '<div class="hj-na-foot">还没有账号？在站点注册一个即可。'
            + '账号只写在你自己浏览器里的这份脚本中，不会发给任何第三方。</div>';
    }
    function hjOpenNoAccountNotice(opts) {
        const auto = !(opts && opts.manual === true);
        try {
            if (document.getElementById('hj-no-account')) return true;
            if (!document.body) return false;
            const box = document.createElement('div');
            box.id = 'hj-no-account';
            box.innerHTML = ''
                + '<div class="hj-na-title">未配置账号：免费视频看不了，付费帖也只有 30 秒试看</div>'
                + '<div class="hj-na-desc">'
                + '视频地址由服务端按身份下发。现在既没配账号、浏览器也没登录，服务端就不会下发完整地址：'
                + '出售帖只剩 <b>30 秒试看</b>（<code>_i_preview.m3u8</code>），'
                + '<b>免费视频连试看都没有</b>（播放器停在 0:00）。'
                + '配一个账号、或直接在站点登录一次，就能正常观看。'
                + '</div>'
                + '<div class="hj-na-help" id="hj-na-help">' + hjSetupHelpHtml() + '</div>'
                + '<div class="hj-na-btns">'
                + '<button id="hj-na-how" class="hj-na-primary">如何配置</button>'
                + '<button id="hj-na-ok">知道了</button>'
                + '</div>';
            document.body.appendChild(box);
            const help = document.getElementById('hj-na-help');
            document.getElementById('hj-na-how').onclick = () => {
                const open = help.classList.toggle('open');
                document.getElementById('hj-na-how').textContent = open ? '收起说明' : '如何配置';
            };
            document.getElementById('hj-na-ok').onclick = () => {
                box.remove();
                console.info('[海角脚本] 已关闭「未配置账号」提示（随时可用控制台 __hjSetupHelp() 再看一次）');
            };
            if (auto) {
                help.classList.add('open');
                document.getElementById('hj-na-how').textContent = '收起说明';
            }
            console.info('[海角脚本] 已提示「当前未配置账号」（' + (auto ? '自动' : '手动') + '打开）');
            return true;
        } catch (e) { return false; }
    }
    function hjHasUsableIdentity() {
        try {
            if (hjResolveAccount()) return true;                             
            if (hjReadOwnUserToken()) return true;                               
            const bt = hjReadBrowserToken();
            if (bt && bt.token) return true;                                                          
            const cached = hjReadAuth();
            if (hjIsAuthFresh(cached)) return true;                           
        } catch (e) { }
        return false;
    }
    const HJ_HEAL_FLAG = 'hj_site_login_healed_v1';
    let hjHealInflight = false;
    let hjHealReport = null;
    const tail = (t) => (t ? String(t).slice(-6) : null);
    function hjReadBrowserTokenRaw() {
        try {
            const cookie = document.cookie || '';
            const cookieToken = (cookie.match(/(?:^|;\s*)token=([^;]*)/) || [])[1];
            let sessionToken = '';
            try { sessionToken = sessionStorage.getItem('token') || ''; } catch (e) { }
            const t = cookieToken || sessionToken;
            return (t && t !== 'null' && t !== 'undefined') ? String(t) : '';
        } catch (e) { return ''; }
    }
    async function hjVerifyTokenWithSite(token, uid) {
        try {
            if (!token) return false;
            const res = await fetch('/api/user/current', {
                method: 'GET',
                credentials: 'omit',
                cache: 'no-store',
                headers: {
                    'X-User-Token': String(token),
                    'X-User-Id': String(uid || ''),
                    'pcVer': '2'
                }
            });
            const data = decodeEncryptString(await res.text());
            const user = data && (data.user || (data.data && data.data.user) || data);
            const gotUid = user && (user.id || user.userId || user.uid);
            return !!gotUid;
        } catch (e) { return false; }
    }
    async function hjHealSiteLoginOnce() {
        const rep = { at: Date.now(), siteIsLogin: hjSiteIsLoggedIn(), suspect尾: null, 站点校验: null, 换到: null, 铺进去: null, 刷新: false };
        hjHealReport = rep;
        try {
            if (!hjAllowActions() || hjHealInflight) { rep.跳过 = '不允许操作/已在处理中'; return false; }
            if (hjSiteIsLoggedIn() !== false) { rep.跳过 = '站点不是"未登录"（已是登录态或读不到状态）'; return false; }
            try {
                if (sessionStorage.getItem(HJ_HEAL_FLAG) === '1') { rep.跳过 = '本会话已自愈过一次'; return false; }
                sessionStorage.setItem(HJ_HEAL_FLAG, '1');
            } catch (e) { }
            hjHealInflight = true;
            const suspectToken = hjReadBrowserTokenRaw();
            const suspect = suspectToken ? { token: suspectToken } : null;
            rep.suspect尾 = tail(suspectToken);
            if (suspectToken) {
                const ok = await hjVerifyTokenWithSite(suspectToken, (hjReadBrowserToken() || {}).uid);
                rep.站点校验 = ok ? '有效' : '站点否认';
                if (ok) {
                    hjHealInflight = false;
                    console.info('[海角脚本] 站点界面还是未登录，但凭据经站点校验有效 → 说明只是渲染慢，不刷新');
                    return false;
                }
                hjRejectedTokens.add(String(suspectToken));
                console.info('[海角脚本] 站点不认这份浏览器凭据（已按站点接口校验）→ 换一份可用凭据');
            } else {
                rep.站点校验 = '(没有浏览器凭据可校验)';
            }
            const auth = await hjWithTimeout(hjEnsureAuth(true), 8000);
            hjHealInflight = false;
            rep.换到 = tail(auth && auth.token);
            if (!auth || !auth.token || !auth.uid) { rep.跳过 = '没换到可用凭据'; return false; }
            if (suspectToken && String(auth.token) === String(suspectToken)) {
                rep.跳过 = '换到的还是那份被站点否认的凭据';
                console.warn('[海角脚本] 自愈没换到新凭据（拿到的还是那份已被站点否认的 token），不做无谓刷新');
                return false;
            }
            hjAuthCache = auth;
            rep.铺进去 = hjPrimeSiteSession(auth, { overrideRejected: true }) ? '成功' : '失败';
            if (rep.铺进去 !== '成功') { rep.跳过 = '凭据没铺进站点会话'; return false; }
            console.info('[海角脚本] 站点当前是未登录、已换到可用凭据 → 铺进会话并刷新一次');
            rep.刷新 = true;
            try { location.reload(); } catch (e) { }
            return true;
        } catch (e) { hjHealInflight = false; rep.异常 = String((e && e.message) || e); return false; }
    }
    function hjMaybeNoticeNoAccount() {
        try {
            if (hjHasUsableIdentity()) return false;
            try {
                if (sessionStorage.getItem('hj_no_account_notice') === '1') return false;
                sessionStorage.setItem('hj_no_account_notice', '1');
            } catch (e) { }
            return hjOpenNoAccountNotice({ manual: false });
        } catch (e) { return false; }
    }
    try { unsafeWindow.__hjSetupHelp = () => hjOpenNoAccountNotice({ manual: true }); } catch (e) { }
    try { unsafeWindow.__hjAccountClear = () => hjClearAccount(); } catch (e) { }
    try {
        unsafeWindow.__hjSiteLogout = () => {
            const cleared = [];
            hjLogoutEpoch++;
            try { m3u8TextCache.clear(); playbackManifestCache.clear(); playbackManifestRequests.forEach(x => x.abort?.()); playbackManifestRequests.clear(); } catch (e) { }
            try {
                ['token', 'uid', 'userInfo'].forEach(k => {
                    document.cookie = k + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                    cleared.push('cookie.' + k);
                });
                document.cookie = 'NOTLOGIN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            } catch (e) { }
            try {
                ['token', 'uid', 'userInfo'].forEach(k => { sessionStorage.removeItem(k); cleared.push('session.' + k); });
                localStorage.removeItem('token'); localStorage.removeItem('uid');
                sessionStorage.removeItem('hj_no_account_notice');
            } catch (e) { }
            hjClearAccount();
            hjPassTopicFailedAt = 0;
            hjPassTopicInflight = null;
            hjVideoPassTopic = 0;
            hjVideoPassTopicInflight = null;
            console.info('[海角脚本] 已清除站点登录态与脚本缓存：' + cleared.join(', ') + '；即将刷新');
            try { setTimeout(() => location.reload(), 400); } catch (e) { }
            return '已清除，刷新后就是一个身份都没有的状态';
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjProbeFullIndex = async (attId) => {
            const lines = [];
            const push = (k, v) => {
                const s = k + ': ' + (v && typeof v === 'object' ? JSON.stringify(v) : String(v));
                lines.push(s); console.log('[probe]', s);
            };
            try {
                const id = Number(attId) || getSoldContentAttId();
                push('附件 id', id || '(未取到)');
                if (!id) return lines.join('\n');
                try {
                    const previewEl = document.querySelector('.preview-btn[data-url], .video-div[data-url], .video-div-btn[data-url]');
                    const previewUrl = previewEl ? resolveUrl(previewEl.getAttribute('data-url') || '', location.href) : '';
                    push('试看地址', previewUrl || '(DOM 上未找到)');
                    const shapeKey = String(id);
                    const shape = hjPipelineShapeCache.get(shapeKey) || '(未判定)';
                    push('管线形态(缓存)', shape);
                    if (previewUrl) {
                        const derivedFast = await hjProbeFullIndexByPreviewNaming(id, previewUrl);
                        push('反推快速路径', derivedFast ? '✅ ' + derivedFast : '❌ 不适用（通行证法）');
                        push('管线形态(本次实测)', hjPipelineShapeCache.get(shapeKey) || '(未判定)');
                    }
                } catch (e) { push('快速路径异常', String((e && e.message) || e)); }
                const raw = hjReadBrowserToken();
                push('浏览器 token', raw ? { uid: raw.uid, tail: String(raw.token).slice(-8) } : '(无)');
                const own = hjReadOwnUserToken();
                push('用户自有 token', own ? String(own).slice(-8) : '(无)');
                const c = hjReadAuth();
                push('脚本缓存凭据', c ? { uid: c.uid, tail: String(c.token).slice(-8), fresh: hjIsAuthFresh(c) } : '(无)');
                push('已被拒 token 数', hjRejectedTokens.size);
                push('通行证帖缓存', hjStoreGet(HJ_PASS_TOPIC_STORE, null));
                let auth = await hjEnsureAuth();
                push('第一次身份', auth ? { uid: auth.uid, tail: String(auth.token).slice(-8) } : '(无 → 取址必然失败)');
                if (!auth) return lines.join('\n');
                const pass = await hjGetPassTopicId(auth);
                push('通行证帖', pass || '(未选中)');
                const post = t => fetch('/api/attachment', {
                    method: 'POST', credentials: 'omit',
                    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'X-User-Token': t.token, 'X-User-Id': String(t.uid), 'pcVer': '2' },
                    body: JSON.stringify({ id, resource_id: pass > 0 ? pass : 0, resource_type: 'topic', line: '' })
                });
                let res = await post(auth);
                let txt = await res.text();
                let outer = null; try { outer = JSON.parse(txt); } catch (e) { }
                push('HTTP', res.status);
                push('信封', outer ? { errorCode: outer.errorCode, success: outer.success, message: outer.message, isEncrypted: outer.isEncrypted } : String(txt).slice(0, 120));
                let data = decodeEncryptString(txt);
                push('remoteUrl', (data && data.remoteUrl) || '(无)');
                if (Number(outer && outer.errorCode) === 1) {
                    if (auth.token) hjRejectedTokens.add(String(auth.token));
                    const auth2 = await hjEnsureAuth(true);
                    push('被拒后换的身份', auth2 ? { uid: auth2.uid, tail: String(auth2.token).slice(-8) } : '(无)');
                    if (auth2) {
                        res = await post(auth2); txt = await res.text();
                        try { outer = JSON.parse(txt); } catch (e) { }
                        push('重试信封', outer ? { errorCode: outer.errorCode, success: outer.success } : String(txt).slice(0, 80));
                        data = decodeEncryptString(txt);
                        push('重试 remoteUrl', (data && data.remoteUrl) || '(无)');
                    }
                }
            } catch (e) { push('异常', String((e && e.message) || e)); }
            return lines.join('\n');
        };
    } catch (e) { }
    function getSoldContentAttId() {
        try {
            const el = document.querySelector('.video-div[data-id], .preview-btn[data-id], .video-div-btn[data-id]');
            const id = Number((el && el.getAttribute('data-id')) || 0);
            return Number.isFinite(id) ? id : 0;
        } catch (e) { return 0; }
    }
    function hjWithTimeout(promise, ms, fallback = '') {
        return Promise.race([
            Promise.resolve(promise).catch(() => fallback),
            new Promise(resolve => setTimeout(() => resolve(fallback), ms))
        ]);
    }
    async function hjResolveVideoUrl(attId, topicId) {
        if (!attId || !topicId) return '';
        const cache = hjGetVideoUrlCache();
        if (cache[attId] && cache[attId].url) return cache[attId].url;
        if (hjInflightAttIds.has(attId)) return '';
        hjInflightAttIds.add(attId);
        try {
            let auth = await hjEnsureAuth();
            if (!auth) return '';
            let result = await hjRequestVideoUrl(attId, topicId, auth);
            if (result.needReauth) {
                auth = await hjEnsureAuth(true);
                if (!auth) return '';
                result = await hjRequestVideoUrl(attId, topicId, auth);
            }
            if (!result.url) return '';
            cache[attId] = { url: result.url, topicId: topicId, savedAt: Date.now() };
            hjSaveVideoUrlCache(cache);
            return result.url;
        } catch (e) {
            console.warn('[海角脚本] 免登录取址失败：', e && e.message);
            return '';
        } finally {
            hjInflightAttIds.delete(attId);
        }
    }
    async function hjHandleLockedVideoAttachment(att, topicId) {
        const url = await hjResolveVideoUrl(att.id, topicId);
        if (!url) return;
        console.info('[海角脚本] 未登录状态下已换到播放地址：' + url);
        try {
            const res = await fetch(url, { credentials: 'omit', cache: 'no-store' });
            const content = await res.text();
            handleM3u8TextCapture(content, url, true);
        } catch (e) { }
    }
    function cleanUpAds() {
        if (hjGifRoundKey !== location.href) {
            hjGifRoundKey = location.href;
            hjGifQuotaUrls.clear();
            for (const [k, v] of hjGifDedup) {
                if (!v.waiters.length) hjGifDedup.delete(k);
            }
        }
        try {
            const now = Date.now();
            for (const [k, v] of hjGifDedup) {
                if (typeof v.text === 'string' && now - v.doneAt > HJ_GIF_DEDUP_TTL_MS * 4) hjGifDedup.delete(k);
            }
        } catch (e) { }
        document.querySelectorAll('div[style*="z-index: 999"]').forEach(div => div.remove());
        document.querySelectorAll('div[style*="position: fixed"]').forEach(div => {
            if (div.id !== btnId && div.id !== dlBtnId && div.id !== dlStatusId && div.id !== 'hj-toast-mobile') {
                if (div.querySelector('iframe') || div.querySelector('img')) {
                    div.style.display = 'none';
                }
            }
        });
        const ownTokenForWindow = hjReadOwnUserToken();
        const ownTokenRejected = !!ownTokenForWindow && hjRejectedTokens.has(String(ownTokenForWindow));
        const shouldSilenceLoginWindow = (!ownTokenForWindow && hjSiteLoginPrimed) || ownTokenRejected;
        if (shouldSilenceLoginWindow) {
            if (/(?:^|;\s*)NOTLOGIN=/.test(document.cookie || '')) {
                document.cookie = 'NOTLOGIN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            }
            if (hjAuthCache && hjAuthCache.token && !/(?:^|;\s*)token=/.test(document.cookie || '')) {
                hjPrimeSiteSession(hjAuthCache);
            }
            const lw = document.getElementById('hj_login__window__');
            if (lw && (lw.offsetWidth || lw.offsetHeight) && !hjUserWantsLogin()) {
                const closeBtn = lw.querySelector('.login-title-close') || lw.querySelector('.el-icon-close');
                if (closeBtn) { closeBtn.click(); } else { lw.style.display = 'none'; }
            }
        }
        if (ownTokenRejected && hjAllowBuiltinLoginOverride && !hjBuiltinOverrideInflight) {
            const cookieTokenNow2 = (((document.cookie || '').match(/(?:^|;\s*)token=([^;]*)/) || [])[1]) || '';
            if (String(cookieTokenNow2) !== String((hjAuthCache && hjAuthCache.token) || '')) {
                hjBuiltinOverrideInflight = (async () => {
                    try {
                        const auth = await hjSignIn();
                        if (auth && auth.token) {
                            hjAuthCache = auth;
                            if (hjPrimeSiteSession(auth, { overrideRejected: true })) {
                                console.info('[海角脚本] 用户凭据已被站点拒绝，已改用内置账号接管站点登录态（大图/搜索等不再要求登录）');
                            }
                        }
                    } catch (e) { } finally { hjBuiltinOverrideInflight = null; }
                })();
            }
        }
    }
    function harvestM3u8FromDom() {
        try {
            if (!hjAllowActions()) return;
            if (!hjIsPlayableRoute()) return;
            if (hjDomFullHref !== location.href) {
                hjDomFullHref = location.href;
                hjDomFullDone.clear();
                hjPassTopicFullUrl = '';
                hjDerivedVerifiedFullUrl = '';                         
            }
            document.querySelectorAll('.preview-btn[data-url], .video-div[data-url], .video-div-btn[data-url]').forEach(el => {
                if (!el.isConnected || el.getClientRects().length === 0) return;
                const url = el.getAttribute('data-url') || '';
                if (!url || !/\.m3u8(?:[?#]|$)/i.test(url)) return;
                const resolved = resolveUrl(url, location.href);
                const attId = Number(el.getAttribute('data-id') || (el.dataset && el.dataset.id) || 0);
                if (attId && isPreviewM3u8Url(resolved)) {
                    const doneKey = attId + '|' + resolved;
                    if (hjDomFullDone.has(doneKey) || hjDomFullPending.has(attId)) return;
                    hjDomFullDone.add(doneKey);
                    hjDomFullPending.add(attId);
                    const startedGen = hjRouteGen;
                    const startedHref = location.href;
                    hjFetchFullIndexByAttId(attId, resolved)
                        .then(full => {
                            if (!full) { hjDomFullDone.delete(doneKey); return; }
                            if (startedGen !== hjRouteGen || location.href !== startedHref) {
                                console.info('[海角脚本] 换页了，丢弃上一次的取址结果（不在本页登记、不拉索引）：' + full);
                                return;
                            }
                            if (hjPassTopicFullUrl === full) return;
                            console.info('[海角脚本] 完整索引已就绪（附件 ' + attId + '，来源见上方分流日志）：' + full);
                            hjPassTopicFullUrl = full;
                            updateState(full);
                            gmGetText(full)
                                .then(text => { if (/#EXTM3U/i.test(String(text || ''))) handleM3u8TextCapture(text, full, true); })
                                .catch(() => { });
                            try {
                                const live = activePlaybackSession;
                                if (live && live.pageUrl === location.href
                                    && live.sourceUrl && isPreviewM3u8Url(live.sourceUrl)) {
                                    console.info('[海角脚本] 完整索引就绪，自动从 30 秒预览切换到完整视频');
                                    showToast('已取到完整视频，正在切换…');
                                    const playBtn = document.getElementById(btnId);
                                    destroyActivePlayback();
                                    replaceAndPlayVideo(playBtn);
                                }
                            } catch (e) { }
                        })
                        .catch(() => { })
                        .finally(() => { hjDomFullPending.delete(attId); });
                    return;
                }
                if (hjSeenDomM3u8.has(resolved)) return;
                hjSeenDomM3u8.add(resolved);
                const plainGen = hjRouteGen;
                const plainHref = location.href;
                gmGetText(resolved)
                    .then(text => {
                        if (plainGen !== hjRouteGen || location.href !== plainHref) return;
                        if (/#EXTM3U/i.test(String(text || ''))) handleM3u8TextCapture(text, resolved, true);
                    })
                    .catch(() => { });
            });
        } catch (e) { }
    }
    function expandAndCleanup() {
        document.querySelectorAll('.html-box.ishide').forEach(el => {
            el.classList.remove('ishide');
        });
        document.querySelectorAll('.html-box:not(.ishide)').forEach(fullBox => {
            const prevSibling = fullBox.previousElementSibling;
            if (prevSibling && prevSibling.classList.contains('html-content')) {
                prevSibling.style.display = 'none';
            }
            const nextSibling = fullBox.nextElementSibling;
            if (nextSibling && nextSibling.classList.contains('html-bottom-box')) {
                nextSibling.style.display = 'none';
            }
        });
        silenceSiteDialogs();
        releaseBodyScrollLock();
        harvestM3u8FromDom();
    }
    let lastScrollUnlockAt = 0;
    function releaseBodyScrollLock() {
        const now = Date.now();
        if (now - lastScrollUnlockAt < 1200) return;        
        lastScrollUnlockAt = now;
        try {
            const body = document.body;
            if (!body) return;
            const html = document.documentElement;
            const lockedByClass = body.classList.contains('el-popup-parent--hidden')
                || body.classList.contains('van-overflow-hidden')
                || body.classList.contains('van-popup-open');
            const lockedByInline = body.style.overflow === 'hidden'
                || body.style.overflowY === 'hidden'
                || (html && (html.style.overflow === 'hidden' || html.style.overflowY === 'hidden'));
            const paddedByModal = !!body.style.paddingRight;
            if (!lockedByClass && !lockedByInline && !paddedByModal) return;
            const hasVisibleLayer = Array.from(document.querySelectorAll('.van-overlay, .el-dialog__wrapper, .el-message-box__wrapper'))
                .some(el => el.offsetWidth || el.offsetHeight);
            if (hasVisibleLayer) return;
            if (body.style.overflow === 'hidden') body.style.overflow = '';
            if (body.style.overflowY === 'hidden') body.style.overflowY = '';
            if (body.style.paddingRight) body.style.paddingRight = '';
            body.classList.remove('el-popup-parent--hidden', 'van-overflow-hidden', 'van-popup-open');
            if (html) {
                if (html.style.overflow === 'hidden') html.style.overflow = '';
                if (html.style.overflowY === 'hidden') html.style.overflowY = '';
            }
            if (body.style.overflowY === '' && getComputedStyle(body).overflowY === 'hidden') {
                body.style.setProperty('overflow-y', 'auto', 'important');
            }
            document.querySelectorAll('.pagescroll-box, .van-list').forEach(node => {
                if (node.style.overflow === 'hidden') node.style.overflow = '';
                if (node.style.overflowY === 'hidden') node.style.overflowY = '';
            });
        } catch (e) { }
    }
    let mainObserver = null;
    function initMainObserver() {
        if (mainObserver) return;
        mainObserver = new MutationObserver((mutations) => {
            checkPlaybackRoute();
            let needAction = false;
            let needSilence = false;
            let needUnlock = false;
            for (const mut of mutations) {
                const target = mut.target?.nodeType === 1 ? mut.target : mut.target?.parentElement;
                if (target?.closest?.('.hj-player-status, [id^="clean-core-player-"]')) continue;
                if (mut.addedNodes.length > 0) {
                    needAction = true;
                    break;
                }
                if (mut.type === 'attributes') {
                    if (mut.attributeName === 'class') {
                        needAction = true;
                        break;
                    }
                    if (mut.attributeName === 'style') {
                        needSilence = true;
                        needUnlock = true;
                    }
                }
            }
            if (needSilence) silenceSiteDialogs();
            if (needAction) {
                expandAndCleanup();
            }
            if (needUnlock) releaseBodyScrollLock();
        });
        mainObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']                                          
        });
    }
    function putM3u8CacheEntry(url, text) {
        if (!url) return;
        m3u8TextCache.set(url, String(text));
    }
    function cacheM3u8Text(url, text) {
        if (!url || !text || !/#EXTM3U/i.test(String(text))) return;
        const value = String(text);
        rememberPlaybackManifest(url, value);
        try {
            const u = new URL(url, location.href);
            putM3u8CacheEntry(u.href, value);
            u.hash = '';
            putM3u8CacheEntry(u.href, value);
            u.search = '';
            putM3u8CacheEntry(u.href, value);
        } catch (e) {
            putM3u8CacheEntry(url, value);
        }
        while (m3u8TextCache.size > 60) {
            const firstKey = m3u8TextCache.keys().next().value;
            if (!firstKey) break;
            m3u8TextCache.delete(firstKey);
        }
    }
    function getCachedM3u8Text(url) {
        if (!url) return '';
        try {
            const u = new URL(url, location.href);
            const exact = m3u8TextCache.get(u.href);
            if (exact) return exact;
            u.hash = '';
            const noHash = m3u8TextCache.get(u.href);
            if (noHash) return noHash;
            u.search = '';
            const noQuery = m3u8TextCache.get(u.href);
            if (noQuery) return noQuery;
            if (isIOSLikeSafari()) return '';
            return m3u8TextCache.get(url) || '';
        } catch (e) {
            return m3u8TextCache.get(url) || '';
        }
    }
    function analyzeM3u8TextForCandidate(text, url) {
        const value = String(text || '');
        if (!/#EXTM3U/i.test(value)) return null;
        const upper = value.toUpperCase();
        const isMaster = /#EXT-X-STREAM-INF/i.test(value);
        const hasEndList = /#EXT-X-ENDLIST/i.test(value);
        let variantCount = 0;
        let maxBandwidth = 0;
        let segmentCount = 0;
        let duration = 0;
        let score = 1;
        if (isMaster) {
            for (const rawLine of value.split(/\r?\n/)) {
                const line = rawLine.trim();
                if (!line.toUpperCase().startsWith('#EXT-X-STREAM-INF')) continue;
                variantCount++;
                const attrs = parseM3u8Attributes(line.slice(line.indexOf(':') + 1));
                const bw = Number(attrs.BANDWIDTH || attrs['AVERAGE-BANDWIDTH'] || 0);
                if (Number.isFinite(bw) && bw > maxBandwidth) maxBandwidth = bw;
            }
            score = 600000 + variantCount * 5000 + Math.round(maxBandwidth / 1000);
        } else {
            try {
                const media = parseMediaPlaylist(value, url || location.href);
                segmentCount = media.segments.length;
                duration = getMediaDurationSeconds(media);
            } catch (e) {
                let pendingDuration = 0;
                for (const rawLine of value.split(/\r?\n/)) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    if (line.toUpperCase().startsWith('#EXTINF')) {
                        const m = line.match(/^#EXTINF:([0-9.]+)/i);
                        pendingDuration = m ? Number(m[1]) || 0 : 0;
                    } else if (!line.startsWith('#')) {
                        segmentCount++;
                        duration += pendingDuration;
                        pendingDuration = 0;
                    }
                }
            }
            score = Math.round(duration * 1000) + segmentCount * 100 + (hasEndList ? 1000 : 0);
            if (segmentCount <= 1 && duration > 0 && duration < 90) score = Math.max(1, score - 20000);
        }
        return { isMaster, hasEndList, variantCount, maxBandwidth, segmentCount, duration, score };
    }
    function getBestKnownM3u8Candidate(includeCurrent = true) {
        let best = includeCurrent && bestM3u8Candidate && !isPreviewM3u8Url(bestM3u8Candidate.url) ? { ...bestM3u8Candidate } : null;
        for (const [url, text] of m3u8TextCache) {
            const info = analyzeM3u8TextForCandidate(text, url);
            if (!info) continue;
            const urlLooksM3u8 = /\.m3u8(?:[?#]|$)/i.test(String(url || ''));
            const looksLikeShortApiPreview = !urlLooksM3u8 && !info.isMaster && info.segmentCount <= 1 && info.duration > 0 && info.duration < 90;
            if (looksLikeShortApiPreview) continue;
            if (isPreviewM3u8Url(url)) continue;
            const candidate = {
                url: resolveUrl(url, location.href),
                text: String(text),
                ...info,
                score: info.score - (urlLooksM3u8 ? 0 : 2000000),
                reason: 'cache-scan',
                time: Date.now()
            };
            if (!best || candidate.score > best.score) best = candidate;
        }
        return best;
    }
    function rememberM3u8Candidate(url, text, reason = 'capture', allowStateUpdate = true) {
        if (!url || !text) return false;
        const info = analyzeM3u8TextForCandidate(text, url);
        if (!info) return false;
        const candidate = {
            url: resolveUrl(url, location.href),
            text: String(text),
            ...info,
            reason,
            time: Date.now()
        };
        if (isPreviewM3u8Url(candidate.url)) {
            console.info('[海角脚本] 忽略 preview M3U8 候选，避免覆盖完整视频：', {
                url: candidate.url,
                reason,
                segments: candidate.segmentCount,
                duration: candidate.duration
            });
            return false;
        }
        const prev = bestM3u8Candidate;
        const prevLooksPreview = !!prev && !prev.isMaster && prev.segmentCount <= 1 && prev.duration > 0 && prev.duration < 90;
        const candidateLooksFullerMedia = !candidate.isMaster && !!prev && !prev.isMaster && (
            candidate.segmentCount > prev.segmentCount || candidate.duration > prev.duration + 30
        );
        const shouldReplace = !prev
            || candidate.score > prev.score + 500
            || prevLooksPreview
            || candidateLooksFullerMedia;
        if (shouldReplace) {
            bestM3u8Candidate = candidate;
            console.info('[海角脚本] 更新最佳 M3U8 候选：', {
                url: candidate.url,
                reason,
                isMaster: candidate.isMaster,
                segments: candidate.segmentCount,
                duration: candidate.duration,
                score: candidate.score
            });
            if (allowStateUpdate || !capturedM3u8Url || prevLooksPreview) {
                updateState(candidate.url);
            }
            return true;
        }
        return false;
    }
    function getPreferredDownloadM3u8Url(fallbackUrl) {
        if (isPreviewM3u8Url(fallbackUrl)) {
            hjPreviewFallbackUrl = fallbackUrl;
            const fullFromPreview = deriveFullM3u8UrlFromPreview(fallbackUrl);
            if (fullFromPreview && fullFromPreview !== fallbackUrl) {
                rememberDerivedFullM3u8Candidate(fullFromPreview);
                console.info('[海角脚本] 下载目标为预览索引，已登记完整索引候选（待验证）：', { preview: fallbackUrl, candidate: fullFromPreview });
            }
            if (capturedM3u8Url && !isPreviewM3u8Url(capturedM3u8Url)) return capturedM3u8Url;
        }
        const best = getBestKnownM3u8Candidate(true);
        if (!best) return fallbackUrl;
        const fallbackText = fallbackUrl ? getCachedM3u8Text(fallbackUrl) : '';
        const fallbackInfo = fallbackText ? analyzeM3u8TextForCandidate(fallbackText, fallbackUrl) : null;
        const fallbackLooksPreview = fallbackInfo && !fallbackInfo.isMaster && fallbackInfo.segmentCount <= 1 && fallbackInfo.duration > 0 && fallbackInfo.duration < 90;
        const fallbackLooksM3u8 = /\.m3u8(?:[?#]|$)/i.test(String(fallbackUrl || ''));
        const bestLooksM3u8 = /\.m3u8(?:[?#]|$)/i.test(String(best.url || ''));
        if (fallbackLooksM3u8 && !bestLooksM3u8) return fallbackUrl;
        if (!fallbackUrl || fallbackLooksPreview || best.score > (fallbackInfo?.score || 0) + 500) {
            if (best.url !== capturedM3u8Url) updateState(best.url);
            return best.url;
        }
        return fallbackUrl;
    }
    function isSuspiciousShortMedia(media) {
        const segments = media?.segments || [];
        const duration = getMediaDurationSeconds(media);
        return segments.length <= 1 && duration > 0 && duration < 90;
    }
    function isPreviewM3u8Url(url) {
        const raw = String(url || '').toLowerCase();
        if (!raw) return false;
        let path = raw;
        try {
            path = decodeURIComponent(new URL(raw, location.href).pathname.toLowerCase());
        } catch (e) { }
        return /(?:^|[\/_\-.])preview(?:[\/_\-.]|$)/i.test(path)
            || /_preview\.m3u8(?:[?#]|$)/i.test(raw)
            || /_i_preview\.m3u8(?:[?#]|$)/i.test(raw);
    }
    function deriveFullM3u8UrlFromPreview(previewUrl) {
        if (!previewUrl || !isPreviewM3u8Url(previewUrl)) return '';
        try {
            const u = new URL(previewUrl, location.href);
            const oldPath = u.pathname;
            let newPath = oldPath
                .replace(/_i_preview\.m3u8$/i, '_i.m3u8')
                .replace(/_preview\.m3u8$/i, '.m3u8')
                .replace(/[-.]preview\.m3u8$/i, '.m3u8');
            newPath = newPath.replace(/\/preview\//ig, '/');
            if (newPath && newPath !== oldPath) {
                u.pathname = newPath;
                return u.href;
            }
        } catch (e) { }
        return String(previewUrl)
            .replace(/_i_preview\.m3u8([?#]|$)/i, '_i.m3u8$1')
            .replace(/_preview\.m3u8([?#]|$)/i, '.m3u8$1')
            .replace(/[-.]preview\.m3u8([?#]|$)/i, '.m3u8$1');
    }
    function rememberDerivedFullM3u8Candidate(url) {
        if (!url || isPreviewM3u8Url(url)) return;
        hjDerivedFullM3u8Url = resolveUrl(url, location.href);
    }
    function deriveNonIosM3u8Url(url) {
        if (!url) return '';
        try {
            const u = new URL(url, location.href);
            const oldPath = u.pathname;
            const newPath = oldPath.replace(/_i\.m3u8$/i, '.m3u8');
            if (newPath && newPath !== oldPath) {
                u.pathname = newPath;
                return u.href;
            }
        } catch (e) { }
        return String(url).replace(/_i\.m3u8([?#]|$)/i, '.m3u8$1');
    }
    function getDownloadM3u8CandidateUrls(primaryUrl) {
        const urls = [];
        const add = (url) => {
            if (!url) return;
            const resolved = resolveUrl(url, location.href);
            if (!urls.includes(resolved)) urls.push(resolved);
        };
        const normalizedPrimary = isPreviewM3u8Url(primaryUrl) ? deriveFullM3u8UrlFromPreview(primaryUrl) : primaryUrl;
        add(normalizedPrimary);
        if (isIOSLikeSafari()) {
            const nonIosUrl = deriveNonIosM3u8Url(normalizedPrimary);
            if (nonIosUrl && nonIosUrl !== normalizedPrimary) add(nonIosUrl);
        }
        return urls;
    }
    function deriveM3u8UrlFromSegmentLine(tsLine, baseUrl) {
        const raw = String(tsLine || '').trim();
        if (!raw || !/\.ts(?:[?#]|$)/i.test(raw)) return '';
        try {
            const u = new URL(raw, baseUrl || location.href);
            const oldPath = u.pathname;
            const newPath = oldPath.replace(/([A-Za-z0-9_-]*?_?)\d+\.ts$/i, '$1.m3u8');
            if (newPath && newPath !== oldPath) {
                u.pathname = newPath;
                return u.href;
            }
        } catch (e) { }
        const m = raw.match(/^(.*?)([A-Za-z0-9_-]*?_?)\d+\.ts([?#].*)?$/i);
        if (m) return resolveUrl(`${m[1]}${m[2]}.m3u8${m[3] || ''}`, baseUrl || location.href);
        return '';
    }
    const getRealVideoSrc = (content, requestUrl) => {
        if (!content) return "";
        try {
            const requestLooksM3u8 = /\.m3u8(?:[?#]|$)/i.test(requestUrl || '');
            const requestIsPreview = isPreviewM3u8Url(requestUrl);
            if (content.includes("#EXTM3U")) {
                const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
                const tsLine = lines.find(line => !line.startsWith('#') && /\.ts(?:[?#]|$)/i.test(line));
                if (requestLooksM3u8 && !requestIsPreview) {
                    cacheM3u8Text(requestUrl, content);
                    return requestUrl;
                }
                if (tsLine) {
                    const derivedUrl = deriveM3u8UrlFromSegmentLine(tsLine, requestUrl);
                    if (derivedUrl && !isPreviewM3u8Url(derivedUrl)) return derivedUrl;
                }
                if (requestIsPreview) {
                    const fullFromPreview = deriveFullM3u8UrlFromPreview(requestUrl);
                    if (fullFromPreview && fullFromPreview !== requestUrl) return fullFromPreview;
                }
            } else {
                const lines = content.split(/\r?\n/);
                const tsLine = lines.find(line => /\.ts(?:[?#]|$)/i.test(line));
                const derivedUrl = deriveM3u8UrlFromSegmentLine(tsLine, requestUrl);
                if (derivedUrl) return derivedUrl;
            }
        } catch (e) { }
        return "";
    };
    function handleM3u8TextCapture(content, requestUrl, allowStateUpdate = true) {
        if (!content || !requestUrl || !/#EXTM3U/i.test(String(content))) return '';
        cacheM3u8Text(requestUrl, content);
        const requestLooksM3u8 = /\.m3u8(?:[?#]|$)/i.test(requestUrl);
        const requestIsPreview = isPreviewM3u8Url(requestUrl);
        if (requestLooksM3u8 && !requestIsPreview) {
            rememberM3u8Candidate(requestUrl, content, 'real-m3u8-fetch', allowStateUpdate);
        }
        const videoSrc = getRealVideoSrc(content, requestUrl);
        if (videoSrc) {
            const info = analyzeM3u8TextForCandidate(content, requestUrl);
            const looksLikeApiPreview = !requestLooksM3u8 && info && !info.isMaster && info.segmentCount <= 1 && info.duration > 0 && info.duration < 90;
            if (requestIsPreview && !isPreviewM3u8Url(videoSrc)) {
                rememberDerivedFullM3u8Candidate(videoSrc);
                updateState(requestUrl);
                console.info('[海角脚本] 预览索引已登记，推导出的完整索引候选待验证：', {
                    preview: requestUrl,
                    candidate: videoSrc,
                    duration: info?.duration,
                    segments: info?.segmentCount
                });
            } else if (looksLikeApiPreview) {
                updateState(videoSrc);
                console.warn('[海角脚本] API 返回疑似试看首片段，仅保存 m3u8 地址，不缓存短列表：', { videoSrc, duration: info.duration, segments: info.segmentCount });
            } else {
                cacheM3u8Text(videoSrc, content);
                rememberM3u8Candidate(videoSrc, content, requestLooksM3u8 ? 'derived-from-real-m3u8' : 'derived-from-api', allowStateUpdate);
            }
        } else if (!requestLooksM3u8) {
            rememberM3u8Candidate(requestUrl, content, 'api-m3u8-body', allowStateUpdate);
        }
        return (bestM3u8Candidate?.url || videoSrc || requestUrl);
    }
    const bareDecode = (text) => {
        try {
            let s = String(text == null ? '' : text).trim();
            for (let i = 0; i < 6; i++) {
                try { return JSON.parse(s); } catch (e) { }
                if (!/^[A-Za-z0-9+/=\s]+$/.test(s)) break;
                const bin = atob(s.replace(/\s+/g, ''));
                const bytes = new Uint8Array(bin.length);
                for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
                s = new TextDecoder('utf-8').decode(bytes).trim();
            }
            return JSON.parse(s);
        } catch (e) { return null; }
    };
    const decodeEncryptString = (text) => {
        let data = text;
        try {
            if (typeof text === 'string') {
                let tmpDataObj = null;
                try { tmpDataObj = JSON.parse(text); } catch(e){}
                if (tmpDataObj) {
                    if (tmpDataObj.data && typeof tmpDataObj.data === 'object') {
                        data = tmpDataObj.data;
                    } else if (tmpDataObj.data && typeof tmpDataObj.data === 'string') {
                        data = bareDecode(tmpDataObj.data);
                    }
                }
            }
        } catch (error) { }
        return data;
    };
    function updateCapturedTitleFromData(data) {
        if (!data || typeof data !== 'object') return;
        const candidates = [
            data.title,
            data.subject,
            data.name,
            data.topicTitle,
            data.topic?.title,
            data.post?.title,
            data.data?.title
        ];
        for (const value of candidates) {
            const text = sanitizeFileName(stripSiteSuffix(value || ''));
            if (text && text.length >= 2 && !/^(详情|帖子详情|加载中|海角)$/i.test(text)) {
                capturedVideoTitle = text;
                return;
            }
        }
    }
    function getHookRequestUrl(input) {
        try {
            const NativeRequest = unsafeWindow.Request || window.Request;
            if (typeof input === 'string') return input;
            if (input instanceof URL || (unsafeWindow.URL && input instanceof unsafeWindow.URL)) return input.href;
            if (NativeRequest && input instanceof NativeRequest) return input.url || '';
            return input?.url || '';
        } catch (e) {
            return '';
        }
    }
    function shouldBlockNoisyRequestUrl(url) {
        if (!blockNoisyAnalyticsRequests || !url) return false;
        if (!hjAllowActions()) return false;
        try {
            const u = new URL(url, location.href);
            const host = u.hostname.toLowerCase();
            const path = u.pathname.toLowerCase();
            if ((host === 'www.google-analytics.com' || host.endsWith('.google-analytics.com'))
                && (/\/(g|j)\/collect$/i.test(path) || path === '/collect')) return true;
            if ((host === 'www.google.com' || host === 'google.com') && path === '/g/collect') return true;
            if (host === 'stats.g.doubleclick.net' || host.endsWith('.stats.g.doubleclick.net')) return true;
        } catch (e) {
            const raw = String(url).toLowerCase();
            return /google-analytics\.com\/(?:g|j)\/collect/.test(raw)
                || /google\.com\/g\/collect/.test(raw)
                || /stats\.g\.doubleclick\.net/.test(raw);
        }
        return false;
    }
    const HJ_SITE_VIEWER_SEL = '.el-image-viewer__wrapper, .van-image-preview, .van-image-preview__overlay,'
        + ' [class*="image-viewer" i], [class*="imageviewer" i],'
        + ' [class*="big-img" i], [class*="bigimg" i]';
    function hjImageViewerOpen() {
        try {
            return !!document.querySelector(HJ_SITE_VIEWER_SEL);
        } catch (e) { return false; }
    }
    const HJ_B64_STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const HJ_SITE_ALPHABET = 'ABCD*EFGHIJKLMNOPQRSTUVWX#YZabcdefghijklmnopqrstuvwxyz1234567890';
    function hjB64EncodeWith(alphabet, text) {
        const bytes = [];
        for (let i = 0; i < text.length; i++) {
            const c = text.charCodeAt(i);
            if (c < 0x80) bytes.push(c);
            else if (c < 0x800) { bytes.push(0xc0 | (c >> 6)); bytes.push(0x80 | (c & 0x3f)); }
            else { bytes.push(0xe0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3f)); bytes.push(0x80 | (c & 0x3f)); }
        }
        let out = '';
        for (let i = 0; i < bytes.length; i += 3) {
            const b0 = bytes[i];
            const has1 = i + 1 < bytes.length;
            const b1 = has1 ? bytes[i + 1] : 0;
            const has2 = i + 2 < bytes.length;
            const b2 = has2 ? bytes[i + 2] : 0;
            out += alphabet[b0 >> 2];
            out += alphabet[((b0 & 0x03) << 4) | (b1 >> 4)];
            out += has1 ? alphabet[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
            out += has2 ? alphabet[b2 & 0x3f] : '=';
        }
        return out;
    }
    const HJ_SITE_DECODE_TABLE = (() => {
        const t = Object.create(null);
        for (let i = 0; i < 64; i++) t[HJ_SITE_ALPHABET[i]] = i;
        return t;
    })();
    const HJ_SITE_LUT = (() => {
        const t = new Uint8Array(128).fill(255);
        for (let i = 0; i < 64; i++) t[HJ_SITE_ALPHABET.charCodeAt(i)] = i;
        return t;
    })();
    let hjUpgradeFullImage = true;
    let hjLastImageClickUrl = '';
    let hjNativeFetch = null;
    let hjViewerUpgrading = false;
    let hjViewerUpgradeDone = 0;
    let hjViewerAppliedUrl = '';
    let hjViewerAppliedSrc = '';
    let hjViewerPollTimer = null;
    const hjFullImageCache = new Map();
    const HJ_FULL_IMAGE_CACHE_MAX = 6;
    const hjAttachUrlById = new Map();
    let hjAttachMapTopicId = '';
    let hjAttachMapPromise = null;
    function hjRecordAttachments(data) {
        try {
            const topicId = data && data.id != null ? String(data.id) : '';
            const currentPid = hjCurrentPostId ? hjCurrentPostId() : '';
            if (topicId && currentPid && topicId !== currentPid) return;
            const list = data && data.attachments;
            if (!Array.isArray(list)) return;
            if (topicId && hjAttachMapTopicId !== topicId) hjAttachUrlById.clear();
            for (const a of list) {
                if (!a || a.id == null) continue;
                const u = a.remoteUrl || a.imgUrl || a.img_url || '';
                if (u && /\/hjstore\/images\//.test(String(u))) hjAttachUrlById.set(String(a.id), String(u));
            }
            if (data && data.id != null) hjAttachMapTopicId = String(data.id);
        } catch (e) { }
    }
    function hjResolveImageUrl(node) {
        if (!node || typeof node.closest !== 'function') return '';
        let hit = null;
        try { hit = node.closest('[data-img_url]'); } catch (e) { }
        if (hit) {
            const u = hit.getAttribute('data-img_url') || '';
            if (/\/hjstore\/images\//.test(u)) return u;
        }
        let byId = null;
        try { byId = node.closest('[data-id]'); } catch (e) { }
        if (!byId) { try { byId = node.closest('img'); } catch (e) { } }
        if (byId && byId.getAttribute) {
            const raw = byId.getAttribute('data-id');
            if (raw && /^\d+$/.test(String(raw))) {
                const u = hjAttachUrlById.get(String(raw));
                if (u) return u;
            }
        }
        return '';
    }
    let hjAttachMapGeneration = 0;
    function hjCurrentPostId() {
        return (String(location.search || '').match(/[?&]pid=(\d+)/) || [])[1] || '';
    }
    async function hjEnsureAttachMap() {
        const pid = hjCurrentPostId();
        if (!pid) return false;
        if (hjAttachMapTopicId === pid && hjAttachUrlById.size) return true;
        if (hjAttachMapPromise) {
            const pending = hjAttachMapPromise;
            await pending;
            if (hjAttachMapTopicId === pid && hjAttachUrlById.size) return true;
        }
        const generation = hjAttachMapGeneration;
        let promise;
        promise = (async () => {
            try {
                const f = hjNativeFetch || fetch;
                const r = await f('/api/topic/' + pid, { credentials: 'include' });
                if (!r.ok || generation !== hjAttachMapGeneration || hjCurrentPostId() !== pid) return;
                const j = await r.json();
                if (!j || j.errorCode || generation !== hjAttachMapGeneration || hjCurrentPostId() !== pid) return;
                let s = j.data;
                if (typeof s !== 'string') return;
                for (let i = 0; i < 4 && /^[A-Za-z0-9+/=]+$/.test(s); i++) {
                    const bin = atob(s), bytes = new Uint8Array(bin.length);
                    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
                    s = new TextDecoder('utf-8').decode(bytes);
                }
                if (generation === hjAttachMapGeneration && hjCurrentPostId() === pid) {
                    hjAttachUrlById.clear();
                    hjAttachMapTopicId = '';
                    hjRecordAttachments(JSON.parse(s));
                }
            } catch (e) { }
            finally { if (hjAttachMapPromise === promise) hjAttachMapPromise = null; }
        })();
        hjAttachMapPromise = promise;
        await promise;
        return hjAttachMapTopicId === pid && hjAttachUrlById.size > 0;
    }
    let hjCoinImageUnlock = true;
    let hjCoinRunning = false;
    let hjCoinSlotsBuilt = 0;
    let hjCoinFilled = 0;
    let hjCoinFailed = 0;
    let hjCoinBytes = 0;
    let hjCoinPasses = 0;
    let hjCoinHostEl = null;
    let hjCoinObserver = null;
    let hjCoinRouteKey = '';
    let hjCoinGeneration = 0;
    let hjCoinRouteGeneration = -1;
    let hjCoinRetryTimer = null;
    let hjCoinPumpPending = false;
    let hjCoinSellEl = null;
    const hjCoinSellUndo = new Map();
    const hjCoinDone = new Set();
    const hjCoinInflight = new Set();
    const hjCoinFailedIds = new Set();
    const hjCoinFailCount = new Map();
    const hjCoinRetryAt = new Map();
    const hjCoinByUrl = new Map();
    const hjCoinSlots = new Map();
    const hjCoinQueue = new Map();
    const hjCoinControllers = new Map();
    let hjCoinTopicBodyIds = new Set();
    let hjCoinTopicBodyImgTags = 0;
    const hjCoinOriginalRecordAttachments = hjRecordAttachments;
    hjRecordAttachments = function (data) {
        const rawTopic = data && (data.id != null ? data.id : data.topicId);
        const topic = rawTopic != null ? String(rawTopic) : '';
        const pid = hjCurrentPostId();
        if (topic && pid && topic !== pid) return;
        const ids = new Set();
        let imgTags = 0;
        const collect = value => {
            if (typeof value !== 'string') return;
            const re = /(?:data-id|data-attachment-id)=["'](\d+)["']/gi;
            let m;
            while ((m = re.exec(value))) ids.add(m[1]);
            const imgs = value.match(/<img[\s>]/gi);
            if (imgs) imgTags += imgs.length;
        };
        collect(data && data.content);
        collect(data && data.body);
        collect(data && data.html);
        collect(data && data.content_html);
        hjCoinTopicBodyIds = ids;
        hjCoinTopicBodyImgTags = imgTags;
        const result = hjCoinOriginalRecordAttachments(data);
        if (pid && hjAttachUrlById.size && !hjAttachMapTopicId) hjAttachMapTopicId = pid;
        if (typeof hjAudioRecordAttachments === 'function') hjAudioRecordAttachments(data);
        return result;
    };
    const HJ_COIN_MAX_RETRY = 3;
    const HJ_COIN_MAX_ACTIVE = 2;
    const HJ_COIN_SLOT_ATTR = 'data-hj-coin-slot';
    const HJ_COIN_HOST_ATTR = 'data-hj-coin-host';
    let hjCoinSellHideSkipped = 0;                                     
    function hjElementCarriesPlayback(el) {
        if (!el) return false;
        try {
            if (el.querySelector && el.querySelector('video, .hj-player-status, [id^="clean-core-player-"]')) return true;
            if (activePlaybackHost && (el === activePlaybackHost || (el.contains && el.contains(activePlaybackHost)) || (activePlaybackHost.contains && activePlaybackHost.contains(el)))) return true;
            const v = activePlaybackSession && activePlaybackSession.video;
            if (v && el.contains && el.contains(v)) return true;
        } catch (e) { }
        return false;
    }
    function hjHidePromptLinesOnly(el) {
        let hid = 0;
        try {
            el.querySelectorAll('.sell_line1, .sell_line2, [data-sell]').forEach(node => {
                if (hjElementCarriesPlayback(node)) return;
                if (!hjCoinSellUndo.has(node)) hjCoinSellUndo.set(node, {
                    value: node.style.getPropertyValue('display'),
                    priority: node.style.getPropertyPriority('display')
                });
                node.style.setProperty('display', 'none', 'important');
                hid++;
            });
        } catch (e) { }
        return hid;
    }
    function hjCoinUnhidePlaybackAncestors() {
        let restored = 0;
        try {
            for (const [el, old] of Array.from(hjCoinSellUndo.entries())) {
                if (!el || !el.isConnected) continue;
                if (!hjElementCarriesPlayback(el)) continue;
                if (old.value) el.style.setProperty('display', old.value, old.priority);
                else el.style.removeProperty('display');
                hjCoinSellUndo.delete(el);
                restored++;
            }
        } catch (e) { }
        return restored;
    }
    function hjCoinIsTargetPage() {
        return /^\/post\/details(?:\/|$)/.test(String(location.pathname || ''));
    }
    function hjCoinResetState() {
        hjCoinGeneration++;
        hjCoinRouteKey = hjCurrentPostId();
        hjCoinRouteGeneration = hjRouteGen;
        if (hjCoinObserver) hjCoinObserver.disconnect();
        hjCoinObserver = null;
        clearTimeout(hjCoinRetryTimer);
        hjCoinRetryTimer = null;
        for (const controller of hjCoinControllers.values()) controller.abort();
        hjCoinControllers.clear();
        hjCoinQueue.clear();
        hjCoinSlots.clear();
        hjCoinTopicBodyIds = new Set();
        hjCoinTopicBodyImgTags = 0;
        hjCoinPumpPending = false;
        if (hjCoinHostEl) hjCoinHostEl.remove();
        hjCoinHostEl = null;
        hjCoinSellEl = null;
        for (const [el, old] of hjCoinSellUndo) {
            if (old.value) el.style.setProperty('display', old.value, old.priority);
            else el.style.removeProperty('display');
        }
        hjCoinSellUndo.clear();
        for (const made of hjCoinByUrl.values()) {
            if (made.blob) { try { URL.revokeObjectURL(made.src); } catch (e) { } }
        }
        hjCoinByUrl.clear();
        hjCoinDone.clear();
        hjCoinInflight.clear();
        hjCoinFailedIds.clear();
        hjCoinFailCount.clear();
        hjCoinRetryAt.clear();
        hjCoinSlotsBuilt = 0;
        hjCoinFilled = 0;
        hjCoinFailed = 0;
        hjCoinBytes = 0;
        hjCoinPasses = 0;
        hjCoinRunning = false;
    }
    function hjCoinEnsureRouteState() {
        if (hjCurrentPostId() !== hjCoinRouteKey || hjRouteGen !== hjCoinRouteGeneration
            || !hjCoinIsTargetPage() || (!hjCoinImageUnlock && hjCoinHostEl)
            || (hjCoinHostEl && !hjCoinHostEl.isConnected)) hjCoinResetState();
    }
    try { unsafeWindow.__hjCoinDebug = () => ({ pid: hjCurrentPostId(), routeKey: hjCoinRouteKey, routeGen: hjCoinRouteGeneration, attachGen: hjAttachMapGeneration, attachTopic: hjAttachMapTopicId, attachSize: hjAttachUrlById.size, bodyIds: hjCoinTopicBodyIds.size, bodyImgTags: hjCoinTopicBodyImgTags, host: !!hjCoinHostEl, running: hjCoinRunning }); } catch (e) { }
    function hjCoinContextCurrent(ctx) {
        return hjCoinImageUnlock && hjCoinIsTargetPage() && ctx.pid === hjCurrentPostId()
            && ctx.pid === hjAttachMapTopicId && ctx.generation === hjCoinGeneration
            && ctx.routeGeneration === hjRouteGen && ctx.attachGeneration === hjAttachMapGeneration;
    }
    function hjCoinTaskCurrent(task) {
        return hjCoinContextCurrent(task) && task.host === hjCoinHostEl && task.host.isConnected
            && task.slot.isConnected && task.slot.parentNode === task.host
            && hjCoinSlots.get(task.id) === task && hjAttachUrlById.get(task.id) === task.url;
    }
    function hjCoinBodyIds() {
        const ids = new Set(hjCoinTopicBodyIds);
        try {
            const selectors = HJ_PAID_BOX_SEL.split(',').map(x => x.trim() + ' img[data-id]');
            for (const img of document.querySelectorAll(selectors.join(', '))) {
                if (!img.isConnected || !img.getClientRects().length || img.closest('[' + HJ_COIN_HOST_ATTR + ']')) continue;
                const id = String(img.getAttribute('data-id') || '');
                if (/^\d+$/.test(id) && hjAttachUrlById.has(id)) ids.add(id);
            }
        } catch (e) { }
        return ids;
    }
    function hjCoinEnsureHost(ctx) {
        if (!hjCoinContextCurrent(ctx)) return null;
        if (hjCoinHostEl && hjCoinHostEl.isConnected) return hjCoinHostEl;
        const sell = Array.from(document.querySelectorAll('.sell-btn')).find(el => el.isConnected && el.getClientRects().length);
        if (!sell) return null;
        const block = sell.closest('p, li, section, article, div') || sell;
        if (!block.parentNode) return null;
        const host = document.createElement('div');
        host.setAttribute(HJ_COIN_HOST_ATTR, ctx.pid);
        host.style.cssText = 'margin:14px 0;';
        block.parentNode.insertBefore(host, block.nextSibling);
        hjCoinHostEl = host;
        hjCoinSellEl = sell;
        return host;
    }
    function hjCoinBuildSlots(list, host, ctx) {
        for (const item of list) {
            if (hjCoinDone.has(item.id) || hjCoinFailedIds.has(item.id)) continue;
            const existing = hjCoinSlots.get(item.id);
            if (existing && existing.slot.isConnected) continue;
            const slot = document.createElement('div');
            slot.setAttribute(HJ_COIN_SLOT_ATTR, item.id);
            slot.style.cssText = 'box-sizing:border-box;min-height:300px;margin:12px auto;padding:18px 12px;'
                + 'text-align:center;color:#888;border:1px dashed #bbb;border-radius:8px;font-size:13px;background:rgba(0,0,0,0.02);';
            slot.textContent = '金币图 ' + (hjCoinSlotsBuilt + 1) + '（滚动到这里自动加载）';
            host.appendChild(slot);
            hjCoinSlotsBuilt++;
            const task = { ...ctx, id: item.id, url: item.url, slot, host, near: false };
            hjCoinSlots.set(item.id, task);
            if (hjCoinObserver) hjCoinObserver.observe(slot);
            else hjCoinConsider(task);
        }
        if (host.childElementCount && hjCoinContextCurrent(ctx) && hjCoinSellEl && hjCoinSellEl.isConnected) {
            if (hjElementCarriesPlayback(hjCoinSellEl)) {
                hjCoinSellHideSkipped++;
                hjHidePromptLinesOnly(hjCoinSellEl);
            } else {
                if (!hjCoinSellUndo.has(hjCoinSellEl)) hjCoinSellUndo.set(hjCoinSellEl, {
                    value: hjCoinSellEl.style.getPropertyValue('display'),
                    priority: hjCoinSellEl.style.getPropertyPriority('display')
                });
                hjCoinSellEl.style.setProperty('display', 'none', 'important');
            }
        }
    }
    function hjCoinSlotsHas(id) {
        const task = hjCoinSlots.get(String(id));
        return !!task && hjCoinTaskCurrent(task);
    }
    function hjCoinPriority(task) {
        const r = task.slot.getBoundingClientRect();
        const height = window.innerHeight || document.documentElement.clientHeight;
        if (r.bottom >= 0 && r.top <= height) return 0;
        return r.top > height ? r.top - height : -r.bottom;
    }
    function hjCoinConsider(task) {
        if (!hjCoinTaskCurrent(task)) return;
        const r = task.slot.getBoundingClientRect();
        const height = window.innerHeight || document.documentElement.clientHeight;
        task.near = r.bottom >= -400 && r.top <= height + 400;
        if (!task.near || hjCoinDone.has(task.id) || hjCoinFailedIds.has(task.id)
            || hjCoinInflight.has(task.id) || Date.now() < (hjCoinRetryAt.get(task.id) || 0)) {
            hjCoinQueue.delete(task.id);
            return;
        }
        hjCoinQueue.set(task.id, task);
        hjCoinSchedulePump();
    }
    function hjCoinSchedulePump() {
        if (hjCoinPumpPending) return;
        hjCoinPumpPending = true;
        const generation = hjCoinGeneration;
        Promise.resolve().then(() => {
            if (generation !== hjCoinGeneration) return;
            hjCoinPumpPending = false;
            hjCoinPump();
        });
    }
    function hjCoinPump() {
        if (!hjCoinImageUnlock) return;
        const candidates = [];
        for (const [id, task] of hjCoinQueue) {
            if (!hjCoinTaskCurrent(task) || !task.near) hjCoinQueue.delete(id);
            else candidates.push({ task, priority: hjCoinPriority(task) });
        }
        candidates.sort((a, b) => a.priority - b.priority);
        for (const { task } of candidates) {
            if (hjCoinControllers.size >= HJ_COIN_MAX_ACTIVE) break;
            hjCoinQueue.delete(task.id);
            hjCoinFillOne(task.id, task.url, task);
        }
    }
    function hjCoinArmRetry() {
        clearTimeout(hjCoinRetryTimer);
        hjCoinRetryTimer = null;
        let earliest = Infinity;
        for (const [id, deadline] of hjCoinRetryAt) {
            const task = hjCoinSlots.get(id);
            if (task && hjCoinTaskCurrent(task) && !hjCoinFailedIds.has(id)) earliest = Math.min(earliest, deadline);
        }
        if (!Number.isFinite(earliest)) return;
        const generation = hjCoinGeneration;
        hjCoinRetryTimer = setTimeout(() => {
            if (generation !== hjCoinGeneration) return;
            hjCoinRetryTimer = null;
            for (const [id, deadline] of hjCoinRetryAt) {
                if (deadline > Date.now()) continue;
                hjCoinRetryAt.delete(id);
                const task = hjCoinSlots.get(id);
                if (!task || !hjCoinTaskCurrent(task)) continue;
                if (hjCoinObserver) hjCoinObserver.observe(task.slot);
                hjCoinConsider(task);
            }
            hjCoinArmRetry();
        }, Math.max(0, earliest - Date.now()));
    }
    function hjCoinMarkFail(id, slot, why, task) {
        if (!task || !hjCoinTaskCurrent(task)) return;
        const n = (hjCoinFailCount.get(id) || 0) + 1;
        hjCoinFailCount.set(id, n);
        if (n >= HJ_COIN_MAX_RETRY) {
            hjCoinFailedIds.add(id);
            hjCoinFailed++;
            hjCoinRetryAt.delete(id);
            slot.textContent = '金币图加载失败（已尝试 ' + n + ' 次）：' + why;
        } else {
            hjCoinRetryAt.set(id, Date.now() + Math.min(30000, 2000 * Math.pow(2, n - 1)));
            slot.textContent = '金币图加载失败（第 ' + n + ' 次，稍后重试）';
            hjCoinArmRetry();
        }
    }
    async function hjCoinFillOne(id, url, task = hjCoinSlots.get(String(id))) {
        if (!task || !hjCoinTaskCurrent(task) || hjCoinDone.has(id) || hjCoinInflight.has(id)
            || hjCoinFailedIds.has(id) || hjCoinControllers.size >= HJ_COIN_MAX_ACTIVE) return;
        const controller = new AbortController();
        hjCoinControllers.set(id, controller);
        hjCoinInflight.add(id);
        if (hjCoinObserver) hjCoinObserver.unobserve(task.slot);
        task.slot.textContent = '金币图加载中…';
        const timeout = setTimeout(() => controller.abort(), 30000);
        let made = null;
        let owned = false;
        try {
            made = hjCoinByUrl.get(url);
            if (!made) {
                const r = await hjNativeFetch(url, { credentials: 'omit', cache: 'force-cache', signal: controller.signal });
                if (!hjCoinTaskCurrent(task)) return;
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const text = await r.text();
                if (!hjCoinTaskCurrent(task)) return;
                const bytes = text ? hjSiteImageTextToBytes(text) : null;
                if (!bytes) throw new Error('解码失败');
                made = hjBytesToViewerSrc(bytes);
                owned = true;
                if (!made || !made.src) throw new Error('图像地址创建失败');
                if (!hjCoinTaskCurrent(task)) return;
                hjCoinBytes += bytes.length;
            }
            if (!hjCoinTaskCurrent(task)) return;
            const img = document.createElement('img');
            img.setAttribute('src', made.src);
            img.setAttribute('data-id', id);
            img.setAttribute('data-hj-coin', '1');
            img.setAttribute('title', '点击查看大图');
            img.style.cssText = 'display:block;max-width:100%;height:auto;margin:12px auto;';
            task.host.replaceChild(img, task.slot);
            hjCoinByUrl.set(url, made);
            owned = false;
            hjCoinDone.add(id);
            hjCoinRetryAt.delete(id);
            hjCoinFilled++;
        } catch (e) {
            if (hjCoinTaskCurrent(task)) hjCoinMarkFail(id, task.slot, String(e && e.message || e), task);
        } finally {
            clearTimeout(timeout);
            if (owned && made && made.blob) { try { URL.revokeObjectURL(made.src); } catch (e) { } }
            if (hjCoinControllers.get(id) === controller) {
                hjCoinControllers.delete(id);
                hjCoinInflight.delete(id);
                hjCoinSchedulePump();
            }
        }
    }
    async function hjUnlockCoinImages() {
        hjCoinEnsureRouteState();
        if (!hjCoinImageUnlock || hjCoinRunning || !hjCoinIsTargetPage() || !hjNativeFetch) return;
        const ctx = { pid: hjCurrentPostId(), generation: hjCoinGeneration,
            routeGeneration: hjRouteGen, attachGeneration: hjAttachMapGeneration };
        if (!ctx.pid) return;
        hjCoinRunning = true;
        try {
            hjCoinPasses++;
            if (hjAttachMapTopicId !== ctx.pid || !hjAttachUrlById.size) await hjEnsureAttachMap();
            if (!hjCoinContextCurrent(ctx)) return;
            const bodyIds = hjCoinBodyIds();
            if (!bodyIds.size && hjCoinTopicBodyImgTags > 0) return;
            const list = [];
            for (const [id, url] of hjAttachUrlById) {
                if (!bodyIds.has(id)) list.push({ id, url });
            }
            if (!list.length) return;
            const host = hjCoinEnsureHost(ctx);
            if (!host) return;
            if (!hjCoinObserver) hjCoinInstallObserver();
            hjCoinBuildSlots(list, host, ctx);
            if (!hjCoinObserver) {
                for (const task of hjCoinSlots.values()) hjCoinConsider(task);
            }
        } catch (e) {
            console.warn('[海角脚本] 金币图铺位异常', e);
        } finally {
            if (ctx.generation === hjCoinGeneration) hjCoinRunning = false;
        }
    }
    function hjCoinInstallObserver() {
        if (typeof IntersectionObserver !== 'function') return;
        try {
            const generation = hjCoinGeneration;
            hjCoinObserver = new IntersectionObserver(entries => {
                if (generation !== hjCoinGeneration) return;
                for (const en of entries) {
                    const id = String(en.target.getAttribute(HJ_COIN_SLOT_ATTR) || '');
                    const task = hjCoinSlots.get(id);
                    if (!task || task.slot !== en.target || !hjCoinTaskCurrent(task)) continue;
                    task.near = en.isIntersecting;
                    if (en.isIntersecting) hjCoinConsider(task);
                    else hjCoinQueue.delete(id);
                }
            }, { rootMargin: '400px 0px' });
        } catch (e) { hjCoinObserver = null; }
    }
    let hjAudioUnlock = true;
    let hjAudioRunning = false;
    let hjAudioHostEl = null;
    let hjAudioRouteKey = '';
    let hjAudioRouteGeneration = 0;
    let hjAudioGeneration = 0;
    let hjAudioBuilt = 0;
    let hjAudioPasses = 0;
    let hjAudioMapTopicId = '';
    let hjAudioAttachTriedAt = 0;
    let hjAudioNodeId = '';
    let hjAudioNodeVipLimit = -1;
    const hjAudioUrlById = new Map();
    const hjAudioBuiltIds = new Set();
    const HJ_AUDIO_HOST_ATTR = 'data-hj-audio-host';
    const HJ_AUDIO_ITEM_ATTR = 'data-hj-audio';
    const HJ_VIP_AD_SEL = '.vipbtn, .vipbtnprompt, .vipalert-box, .containers';
    const HJ_VIP_AD_TEXT = /升级\s*VIP|开通\s*VIP\s*会员|尊享\s*\d+\s*大权益/;
    const HJ_VIP_AD_ATTR = 'data-hj-vip-ad';
    let hjVipAdHidden = 0;
    const hjVipAdUndo = new Map();
    function hjVipAdContentUnlocked() {
        return (hjAudioBuilt > 0 || hjMediaBuilt > 0 || hjLiteRecovered > 0);
    }
    function hjVipAdCarriesPlayback(el) {
        return typeof hjElementCarriesPlayback === 'function' && hjElementCarriesPlayback(el);
    }
    function hjVipAdWorthHiding(el) {
        if (!el || !el.isConnected) return false;
        if (el.classList && (el.classList.contains('pagecontainer')
            || el.classList.contains('publicContainer'))) return false;
        if (hjVipAdCarriesPlayback(el)) return false;
        try {
            if (el.querySelector('video, audio, [' + HJ_AUDIO_HOST_ATTR + '], [data-hj-media-slot]')) return false;
        } catch (e) { }
        const text = String(el.textContent || '');
        if (!HJ_VIP_AD_TEXT.test(text)) return false;
        try { if (el.querySelector(HJ_BODY_EDITOR_SEL)) return false; } catch (e) { }
        return true;
    }
    function hjHideVipAdBlocks() {
        if (!hjAudioUnlock || !hjAudioIsTargetPage()) return 0;
        if (!hjVipAdContentUnlocked()) return 0;             
        let hid = 0;
        try {
            for (const el of document.querySelectorAll(HJ_VIP_AD_SEL)) {
                if (el.getAttribute(HJ_VIP_AD_ATTR) === '1') continue;
                if (!hjVipAdWorthHiding(el)) continue;
                hjVipAdUndo.set(el, {
                    value: el.style.getPropertyValue('display'),
                    priority: el.style.getPropertyPriority('display')
                });
                el.setAttribute(HJ_VIP_AD_ATTR, '1');
                el.style.setProperty('display', 'none', 'important');
                hid++;
            }
        } catch (e) { }
        if (hid) {
            hjVipAdHidden += hid;
            console.info('[海角脚本] 内容已由脚本补出，收掉 ' + hid + ' 处 VIP 推广提示（外容器未动）');
        }
        return hid;
    }
    function hjVipAdRestore() {
        try {
            for (const [el, old] of hjVipAdUndo) {
                if (!el) continue;
                if (old.value) el.style.setProperty('display', old.value, old.priority);
                else el.style.removeProperty('display');
                el.removeAttribute(HJ_VIP_AD_ATTR);
            }
        } catch (e) { }
        hjVipAdUndo.clear();
    }
    const HJ_REPLY_API = '/comment/reply_list';
    let hjReplyToastMuted = false;
    function hjStopReplySpinner(vm, data) {
        try {
            if (!vm || !vm._data) return 0;
            const refused = !data || data.success === false || data.errorCode === 1;
            if (!refused) return 0;                                 
            let n = 0;
            if (vm.loading !== false) { vm.loading = false; n++; }
            if ('finished' in vm._data && vm.finished !== true) { vm.finished = true; n++; }
            if ('skeletonLoading' in vm._data && vm.skeletonLoading !== false) { vm.skeletonLoading = false; n++; }
            if (n) {
                console.info('[海角脚本] 回复区被 VIP 门禁拒绝，已停掉「加载中/骨架屏」'
                    + '（清 ' + n + ' 个状态位；站点的失败出口缺失，见 REFERENCE §35.16）');
            }
            return n;
        } catch (e) { return 0; }
    }
    function hjMuteReplyToast() {
        if (hjReplyToastMuted) return true;
        try {
            const app = document.querySelector('#app');
            const root = app && app.__vue__;
            const Base = root && root.$options && root.$options._base;
            const proto = Base && Base.prototype;
            const orig = proto && proto.MyGet;
            if (typeof orig !== 'function' || proto.__hjReplyToastPatched) return false;
            proto.MyGet = function (url, onOk, onFail, showToast, onFinally) {
                if (typeof url === 'string' && url.indexOf(HJ_REPLY_API) >= 0) {
                    const self = this;
                    let settled = false;
                    const ok2 = function () {
                        settled = true;
                        return onOk && onOk.apply(this, arguments);
                    };
                    const fail2 = function () {
                        settled = true;
                        try { hjStopReplySpinner(self, arguments[0]); } catch (e) { }
                        return onFail && onFail.apply(this, arguments);
                    };
                    const fin2 = function () {
                        if (!settled) { try { hjStopReplySpinner(self, null); } catch (e) { } }
                        return onFinally && onFinally.apply(this, arguments);
                    };
                    return orig.call(this, url, ok2, fail2, false, fin2);
                }
                return orig.apply(this, arguments);
            };
            proto.__hjReplyToastPatched = true;
            hjReplyToastMuted = true;
            console.info('[海角脚本] 已压制「需要更高等级VIP才能查看回复」浮层，并补上回复区的失败出口'
                + '（清 loading/finished/skeletonLoading；接口与其它分支逻辑不变）');
            return true;
        } catch (e) { }
        return false;
    }
    const HJ_REPLY_TOAST_TEXT = /^\s*需要更高等级\s*VIP\s*才能查看回复\s*$/;
    const HJ_REPLY_TOAST_ATTR = 'data-hj-rt';
    function hjReplyToastShell(el) {
        try {
            const v = el.closest && el.closest('.van-toast, .van-popup');
            if (v) return v;
        } catch (e) { }
        let cur = el;
        for (let i = 0; i < 5 && cur && cur.parentNode && cur.parentNode.nodeType === 1; i++) {
            const p = cur.parentNode;
            const pos = String((p.style && p.style.position) || '');
            if (pos === 'fixed' || pos === 'absolute') return p;
            cur = p;
        }
        return el;
    }
    function hjSweepReplyToast() {
        let removed = 0;
        try {
            for (const el of document.querySelectorAll('div, span, p')) {
                if (!el.isConnected) continue;
                if (!HJ_REPLY_TOAST_TEXT.test(String(el.textContent || ''))) continue;
                const shell = hjReplyToastShell(el);
                if (shell.getAttribute(HJ_REPLY_TOAST_ATTR) === '1') continue;
                shell.setAttribute(HJ_REPLY_TOAST_ATTR, '1');
                shell.style.setProperty('display', 'none', 'important');
                removed++;
            }
        } catch (e) { }
        return removed;
    }
    const HJ_REPLY_PATCH_TICK = 50;                 
    const HJ_REPLY_PATCH_WINDOW = 15000;                           
    const HJ_REPLY_SWEEP_TICK = 150;                     
    const HJ_REPLY_SWEEP_WINDOW = 8000;                                   
    function hjReplyToastRace() {
        let stopAt = Date.now() + HJ_REPLY_PATCH_WINDOW;
        const patchTimer = setInterval(() => {
            try {
                if (hjMuteReplyToast() || Date.now() > stopAt) clearInterval(patchTimer);
            } catch (e) { clearInterval(patchTimer); }
        }, HJ_REPLY_PATCH_TICK);
        let sweepStop = Date.now() + HJ_REPLY_SWEEP_WINDOW;
        const sweepTimer = setInterval(() => {
            try {
                if (hjMuteReplyToast()) hjSweepReplyToast();
                if (Date.now() > sweepStop) clearInterval(sweepTimer);
            } catch (e) { clearInterval(sweepTimer); }
        }, HJ_REPLY_SWEEP_TICK);
    }
    function hjRecordNodeInfo(data) {
        try {
            const rawTopic = data && (data.id != null ? data.id : data.topicId);
            const topic = rawTopic != null ? String(rawTopic) : '';
            const pid = hjCurrentPostId();
            if (topic && pid && topic !== pid) return;
            const node = data && data.node;
            if (!node || node.nodeId == null) return;
            hjAudioNodeId = String(node.nodeId);
            hjAudioNodeVipLimit = Number(node.vipLimit || 0);
        } catch (e) { }
    }
    function hjAudioRecordAttachments(data) {
        try {
            const rawTopic = data && (data.id != null ? data.id : data.topicId);
            const topic = rawTopic != null ? String(rawTopic) : '';
            const pid = hjCurrentPostId();
            if (topic && pid && topic !== pid) return;
            hjRecordNodeInfo(data);
            const list = data && data.attachments;
            if (!Array.isArray(list)) return;
            if (topic && hjAudioMapTopicId && hjAudioMapTopicId !== topic) {
                hjAudioUrlById.clear();
                hjAudioBuiltIds.clear();
            }
            for (const a of list) {
                if (!a || a.id == null || a.category !== 'audio') continue;
                const u = a.remoteUrl || a.url || a.audioUrl || '';
                if (u && /\/hjstore\/audio\//.test(String(u))) hjAudioUrlById.set(String(a.id), String(u));
            }
            if (topic) hjAudioMapTopicId = topic;
        } catch (e) { }
    }
    function hjAudioIsTargetPage() {
        return /^\/post\/details(?:\/|$)/.test(String(location.pathname || ''));
    }
    const HJ_BODY_EDITOR_SEL = '.article.ql-editor, .ql-editor.reset-html-box, .html-box .ql-editor,'
        + ' .article-content .ql-editor, .topic-content .ql-editor, .ql-editor';
    function hjBodyEditor() {
        try {
            for (const el of document.querySelectorAll(HJ_BODY_EDITOR_SEL)) {
                if (!el.isConnected) continue;
                if (el.closest && el.closest('#editor')) continue;                     
                if (el.classList && el.classList.contains('ql-blank')) continue;
                return el;
            }
        } catch (e) { }
        try { return document.querySelector('.html-box, .preview-title, .html-content, .post-content'); } catch (e) { }
        return null;
    }
    function hjAudioBodyIds() {
        const ids = new Set();
        try {
            const scope = hjBodyEditor() || document;
            for (const el of scope.querySelectorAll('audio[data-id]')) {
                if (!el.isConnected) continue;
                const id = String(el.getAttribute('data-id') || '');
                if (/^\d+$/.test(id)) ids.add(id);
            }
        } catch (e) { }
        return ids;
    }
    function hjAudioResetState() {
        hjAudioGeneration++;
        hjAudioRouteKey = hjCurrentPostId();
        hjAudioRouteGeneration = hjRouteGen;
        hjAudioBuiltIds.clear();
        try { if (hjMediaObserver) hjMediaObserver.disconnect(); } catch (e) { }
        hjMediaObserver = null;
        hjMediaBusy = false;
        hjMediaPending = [];
        hjMediaBuilt = 0;
        hjMediaFilled = 0;
        hjMediaFailed = 0;
        hjMediaBuiltIds.clear();
        hjLiteTriedPid = '';
        hjLiteRecovered = 0;
        hjLiteReason = 'idle';
        hjVipAdRestore();
        if (hjAudioHostEl) { try { hjAudioHostEl.remove(); } catch (e) { } }
        hjAudioHostEl = null;
        try {
            for (const r of document.querySelectorAll('[' + HJ_AUDIO_DL_ROW + ']')) if (r.isConnected) r.remove();
        } catch (e) { }
        hjAudioRunning = false;
        hjAudioBuilt = 0;
        hjAudioPasses = 0;
    }
    function hjAudioEnsureRouteState() {
        if (hjCurrentPostId() !== hjAudioRouteKey || hjRouteGen !== hjAudioRouteGeneration
            || !hjAudioIsTargetPage() || (!hjAudioUnlock && hjAudioHostEl)
            || (hjAudioHostEl && !hjAudioHostEl.isConnected)) hjAudioResetState();
    }
    function hjAudioContextCurrent(ctx) {
        return hjAudioUnlock && hjAudioIsTargetPage() && ctx.pid === hjCurrentPostId()
            && ctx.pid === hjAudioMapTopicId && ctx.generation === hjAudioGeneration
            && ctx.routeGeneration === hjRouteGen && ctx.attachGeneration === hjAttachMapGeneration;
    }
    const HJ_BODY_CONTAINER_SEL = '.html-box, .preview-title, .html-content, .post-content,'
        + ' .article-content, .topic-content, .floor_box';
    function hjAudioHostAnchor() {
        const editor = hjBodyEditor();
        if (!editor) return null;
        let container = null;
        try { container = editor.closest(HJ_BODY_CONTAINER_SEL); } catch (e) { }
        if (container && container.parentNode && container.parentNode !== document.body) return container;
        return editor;
    }
    function hjAudioEnsureHost(ctx) {
        if (!hjAudioContextCurrent(ctx)) return null;
        if (hjAudioHostEl && hjAudioHostEl.isConnected) return hjAudioHostEl;
        let anchor = hjAudioHostAnchor();
        if (!anchor) { try { anchor = document.querySelector('#details-page .floor_box'); } catch (e) { } }
        if (!anchor || !anchor.parentNode) return null;
        const host = document.createElement('div');
        host.setAttribute(HJ_AUDIO_HOST_ATTR, ctx.pid);
        host.style.cssText = 'margin:14px 0;';
        anchor.parentNode.insertBefore(host, anchor.nextSibling);
        hjAudioHostEl = host;
        return host;
    }
    const HJ_AUDIO_DL_BTN = 'data-hj-audio-dl';
    const HJ_AUDIO_DL_URL = 'data-hj-audio-dl-url';
    const hjAudioDlBusy = new Set();
    function hjAudioFileName(btn, url) {
        let base = '';
        try {
            base = String(document.title || '').replace(/[-_|]\s*海角.*$/, '').trim();
        } catch (e) { }
        if (!base) base = 'haijiao_audio';
        base = base.replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'haijiao_audio';
        const id = String((btn && btn.getAttribute(HJ_AUDIO_DL_BTN)) || '').replace(/\D/g, '');
        const ext = /\.m4a(\?|$)/i.test(url) ? 'm4a' : 'mp3';
        return base + (id ? '-音频' + id : '') + '.' + ext;
    }
    function hjAudioIosSavePanel(blob, filename, objectUrl, sizeText) {
        const old = document.getElementById('hj-audio-ios-panel');
        if (old) old.remove();
        const panel = document.createElement('div');
        panel.id = 'hj-audio-ios-panel';
        panel.style.cssText = 'position:fixed;left:10px;right:10px;bottom:12px;z-index:1000002;'
            + 'background:rgba(12,12,12,.96);color:#fff;border-radius:14px;'
            + 'box-shadow:0 6px 24px rgba(0,0,0,.5);padding:14px;font-size:14px;line-height:1.45;';
        const title = document.createElement('div');
        title.textContent = '音频已就绪，等待保存';
        title.style.cssText = 'font-weight:700;font-size:16px;margin-bottom:6px;';
        const nameLine = document.createElement('div');
        nameLine.textContent = '文件名：' + filename + '（' + sizeText + '）';
        nameLine.style.cssText = 'word-break:break-all;margin-bottom:8px;';
        const why = document.createElement('div');
        why.textContent = 'iOS 的原生播放器没有下载项。点「存储到文件」会打开系统分享面板，'
            + '在那里选“存储到文件”；若分享不可用，就点「打开音频」，再用 Safari 的分享按钮保存。';
        why.style.cssText = 'opacity:.86;margin-bottom:10px;';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
        const mkBtn = (cls, text, bg, flex) => {
            const b = document.createElement('button');
            b.setAttribute('type', 'button');
            b.className = cls;
            b.textContent = text;
            b.style.cssText = 'border:0;border-radius:10px;padding:10px;color:#fff;font-weight:700;'
                + 'background:' + bg + ';' + flex;
            return b;
        };
        const shareBtn = mkBtn('hj-audio-share', '存储到文件', '#34c759', 'flex:1;min-width:130px;');
        const openBtn = mkBtn('hj-audio-open', '打开音频', '#007aff', 'flex:1;min-width:96px;');
        const closeBtn = mkBtn('hj-audio-close', '关闭', '#555', 'width:72px;font-weight:400;');
        row.appendChild(shareBtn);
        row.appendChild(openBtn);
        row.appendChild(closeBtn);
        panel.appendChild(title);
        panel.appendChild(nameLine);
        panel.appendChild(why);
        panel.appendChild(row);
        document.body.appendChild(panel);
        shareBtn.addEventListener('click', async () => {
            shareBtn.disabled = true;
            shareBtn.textContent = '正在打开…';
            try {
                const ok = await hjAudioIosShare(blob, filename);
                if (ok) { panel.remove(); return; }
                throw new Error('分享面板不可用');
            } catch (e) {
                shareBtn.disabled = false;
                shareBtn.textContent = '存储到文件';
                if (e && (e.name === 'AbortError' || /abort|cancel|取消/i.test(String(e.message || '')))) return;
                console.warn('[海角脚本] iOS 分享失败，改为打开音频：', e && (e.message || e));
                if (typeof openBlobUrlInNewTab === 'function') openBlobUrlInNewTab(objectUrl);
            }
        });
        openBtn.addEventListener('click', () => {
            if (typeof openBlobUrlInNewTab === 'function') openBlobUrlInNewTab(objectUrl);
            else { try { window.location.href = objectUrl; } catch (e) { } }
        });
        closeBtn.addEventListener('click', () => panel.remove());
        return panel;
    }
    async function hjAudioIosShare(blob, filename) {
        const nav = (typeof getPageNavigator === 'function' && getPageNavigator())
            || (typeof navigator !== 'undefined' ? navigator : null);
        if (!nav || typeof nav.share !== 'function') return false;
        let FileCtor = null;
        try {
            FileCtor = (typeof unsafeWindow !== 'undefined' && unsafeWindow && unsafeWindow.File)
                || (typeof File !== 'undefined' ? File : null);
        } catch (e) { FileCtor = null; }
        if (typeof FileCtor !== 'function') return false;
        const file = new FileCtor([blob], filename, { type: blob.type || 'audio/mpeg' });
        const data = { files: [file] };
        if (typeof nav.canShare === 'function') {
            let ok = false;
            try { ok = nav.canShare(data); } catch (e) { ok = false; }
            if (!ok) return false;
        }
        await nav.share(data);
        return true;
    }
    async function hjAudioDownload(btn) {
        if (!btn || !btn.isConnected) return;
        const url = String(btn.getAttribute(HJ_AUDIO_DL_URL) || '');
        if (!url) return;
        const key = String(btn.getAttribute(HJ_AUDIO_DL_BTN) || url);
        if (hjAudioDlBusy.has(key)) return;
        hjAudioDlBusy.add(key);
        const label = btn.querySelector('span') || btn;
        const setText = (s) => { try { label.textContent = s; } catch (e) { } };
        const setBusy = (on) => {
            try {
                btn.disabled = !!on;
                btn.style.opacity = on ? '0.72' : '1';
                btn.style.cursor = on ? 'progress' : 'pointer';
            } catch (e) { }
        };
        setBusy(true);
        setText('准备中…');
        try {
            const f = (typeof hjNativeFetch === 'function' && hjNativeFetch) || fetch;
            const r = await f(url, { credentials: 'omit' });
            if (!r || !r.ok) throw new Error('HTTP ' + ((r && r.status) || '?'));
            const total = Number((r.headers && r.headers.get && r.headers.get('content-length')) || 0);
            let blob;
            if (r.body && typeof r.body.getReader === 'function' && total > 0) {
                const reader = r.body.getReader();
                const chunks = [];
                let got = 0;
                for (;;) {
                    const step = await reader.read();
                    if (step.done) break;
                    if (step.value) { chunks.push(step.value); got += step.value.byteLength; }
                    setText('下载 ' + Math.min(99, Math.round(got * 100 / total)) + '%');
                }
                blob = new Blob(chunks, { type: 'audio/mpeg' });
            } else {
                blob = await r.blob();
            }
            if (!blob || !blob.size) throw new Error('空文件');
            const filename = hjAudioFileName(btn, url);
            const sizeText = (typeof formatBytes === 'function') ? formatBytes(blob.size) : (blob.size + ' B');
            if (typeof isIOSLikeSafari === 'function' && isIOSLikeSafari()) {
                const objUrl = URL.createObjectURL(blob);
                hjAudioIosSavePanel(blob, filename, objUrl, sizeText);
                setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch (e) { } }, 10 * 60 * 1000);
                setText('已就绪');
                setTimeout(() => setText('下载'), 2500);
                return;
            }
            setText('保存中…');
            const objUrl = URL.createObjectURL(blob);
            if (typeof triggerAnchorDownload === 'function') triggerAnchorDownload(objUrl, filename);
            else {
                const a = document.createElement('a');
                a.href = objUrl; a.download = filename; a.style.display = 'none';
                document.body.appendChild(a); a.click();
                setTimeout(() => a.remove(), 1000);
            }
            setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch (e) { } }, 10000);
            setText('已保存 ' + sizeText);
            setTimeout(() => setText('下载'), 2500);
        } catch (e) {
            console.warn('[海角脚本] 音频下载失败：', e && (e.message || e));
            setText('重试');
            setTimeout(() => setText('下载'), 2000);
        } finally {
            setBusy(false);
            hjAudioDlBusy.delete(key);
        }
    }
    function hjAudioMakeSaveRow(item) {
        const row = document.createElement('div');
        row.style.cssText = 'margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
        const btn = document.createElement('button');
        btn.setAttribute('type', 'button');
        btn.setAttribute(HJ_AUDIO_DL_BTN, String(item.id));
        btn.setAttribute(HJ_AUDIO_DL_URL, String(item.url));
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" '
            + 'aria-hidden="true" style="vertical-align:-1px;margin-right:4px">'
            + '<path d="M12 3a1 1 0 0 1 1 1v9.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.4l3.3 3.3V4a1 1 0 0 1 1-1z"/>'
            + '<path d="M5 19a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z"/></svg>'
            + '<span>下载</span>';
        btn.title = '保存这条音频到本地（iOS 会打开分享面板，选“存储到文件”）';
        btn.style.cssText = 'padding:4px 12px;border:1px solid #b8860b;border-radius:14px;background:#fffdf5;'
            + 'color:#b8860b;font-size:12px;line-height:18px;cursor:pointer;';
        const hint = document.createElement('span');
        hint.textContent = typeof isIOSLikeSafari === 'function' && isIOSLikeSafari()
            ? 'iOS 原生播放器没有下载项，用这个按钮保存'
            : '';
        hint.style.cssText = 'font-size:11px;color:#9e9e9e;';
        row.appendChild(btn);
        if (hint.textContent) row.appendChild(hint);
        return row;
    }
    function hjAudioPlayerRow(item) {
        const wrap = document.createElement('div');
        wrap.setAttribute(HJ_AUDIO_ITEM_ATTR, item.id);
        wrap.style.cssText = 'margin:12px 0;padding:10px 12px;border:1px solid #e4e4e4;border-radius:8px;background:#fafafa;';
        const cap = document.createElement('div');
        cap.textContent = item.caption || '音频（脚本解锁）';
        cap.style.cssText = 'font-size:12px;color:#888;margin-bottom:6px;';
        const audio = document.createElement('audio');
        audio.setAttribute('controls', 'controls');
        audio.setAttribute('preload', 'none');
        audio.setAttribute('data-id', item.id);
        audio.setAttribute('src', item.url);
        audio.style.cssText = 'width:100%;';
        wrap.appendChild(cap);
        wrap.appendChild(audio);
        wrap.appendChild(hjAudioMakeSaveRow(item));
        return wrap;
    }
    const HJ_AUDIO_ADOPT_ATTR = 'data-hj-audio-adopted';
    const HJ_AUDIO_DL_ROW = 'data-hj-audio-dl-row';
    let hjAudioAdopted = 0;
    let hjAudioAdoptErr = '';
    function hjAudioAdoptNative() {
        const ed = hjBodyEditor();
        if (!ed || !ed.isConnected) return 0;
        let n = 0;
        try {
            for (const a of ed.querySelectorAll('audio')) {
                if (!a || !a.isConnected) continue;
                if (a.getAttribute(HJ_AUDIO_ADOPT_ATTR)) continue;
                if (a.closest('[' + HJ_AUDIO_ITEM_ATTR + ']')) { a.setAttribute(HJ_AUDIO_ADOPT_ATTR, 'own'); continue; }
                const id = String(a.getAttribute('data-id') || '').replace(/\D/g, '');
                let url = id ? String(hjAudioUrlById.get(id) || '') : '';
                if (!url) {
                    const raw = String(a.getAttribute('src') || a.currentSrc || '');
                    if (raw) { try { url = new URL(raw, location.href).href; } catch (e) { url = raw; } }
                }
                if (!url) { a.setAttribute(HJ_AUDIO_ADOPT_ATTR, 'no-url'); continue; }
                const row = document.createElement('div');
                row.setAttribute(HJ_AUDIO_DL_ROW, id || '1');
                const host = (a.parentNode && a.parentNode !== ed && a.parentNode.nodeName !== 'BODY') ? a.parentNode : a;
                row.appendChild(hjAudioMakeSaveRow({ id: id, url: url }));
                if (host.parentNode) host.parentNode.insertBefore(row, host.nextSibling);
                else if (a.parentNode) a.parentNode.insertBefore(row, a.nextSibling);
                a.setAttribute(HJ_AUDIO_ADOPT_ATTR, '1');
                hjAudioAdopted++;
                n++;
            }
        } catch (e) {
            hjAudioAdoptErr = String((e && e.message) || e);
            console.warn('[海角脚本] 认领原生播放器失败：', e);
        }
        return n;
    }
    function hjAudioBuildPlayers(list, host, ctx) {
        for (const item of list) {
            if (!hjAudioContextCurrent(ctx)) return;
            if (hjAudioBuiltIds.has(item.id)) continue;
            if (host.querySelector('[' + HJ_AUDIO_ITEM_ATTR + '="' + item.id + '"]')) { hjAudioBuiltIds.add(item.id); continue; }
            host.appendChild(hjAudioPlayerRow(item));
            hjAudioBuiltIds.add(item.id);
            hjAudioBuilt++;
        }
    }
    const HJ_MEDIA_MAX_IMAGES = 6;
    const HJ_MEDIA_SLOT_ATTR = 'data-hj-media-slot';
    let hjMediaObserver = null;
    let hjMediaBusy = false;
    let hjMediaBuilt = 0;
    let hjMediaFilled = 0;
    let hjMediaFailed = 0;
    let hjMediaPending = [];
    const hjMediaBuiltIds = new Set();
    function hjMediaBodyImageIds() {
        const ids = new Set();
        try {
            const scope = hjBodyEditor() || document;
            for (const img of scope.querySelectorAll('img[data-id]')) {
                if (!img.isConnected) continue;
                const id = String(img.getAttribute('data-id') || '');
                if (/^\d+$/.test(id)) ids.add(id);
            }
        } catch (e) { }
        return ids;
    }
    function hjMediaHasImagePlaceholder() {
        try {
            const ed = hjBodyEditor();
            return !!ed && String(ed.textContent || '').indexOf('[图片]') >= 0;
        } catch (e) { return false; }
    }
    function hjMediaStrippedImages() {
        const body = hjMediaBodyImageIds();
        const out = [];
        for (const [id, url] of hjAttachUrlById) {
            if (body.has(id) || !/\/hjstore\/images\//.test(String(url))) continue;
            try {
                if (typeof hjCoinSlots !== 'undefined' && hjCoinSlots.has(id)) continue;
                if (typeof hjCoinDone !== 'undefined' && hjCoinDone.has(id)) continue;
                if (typeof hjCoinFailedIds !== 'undefined' && hjCoinFailedIds.has(id)) continue;
            } catch (e) { }
            out.push({ id, url });
            if (out.length >= HJ_MEDIA_MAX_IMAGES) break;
        }
        return out;
    }
    function hjMediaEnsureObserver() {
        if (hjMediaObserver || typeof IntersectionObserver !== 'function') return;
        try {
            hjMediaObserver = new IntersectionObserver(entries => {
                for (const en of entries) if (en.isIntersecting) hjMediaPump();
            }, { rootMargin: '400px 0px' });
        } catch (e) { hjMediaObserver = null; }
    }
    function hjMediaPump() {
        if (hjMediaBusy || !hjMediaPending.length) return;
        const task = hjMediaPending.shift();
        if (!task || !task.slot.isConnected) { hjMediaPump(); return; }
        hjMediaBusy = true;
        hjMediaFillOne(task).catch(() => { }).then(() => {
            hjMediaBusy = false;
            hjMediaPump();
        });
    }
    async function hjMediaFillOne(task) {
        const f = hjNativeFetch || fetch;
        task.slot.textContent = '图片加载中…';
        try {
            const r = await f(task.url, { credentials: 'omit', cache: 'force-cache' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const text = await r.text();
            if (!task.slot.isConnected) return;
            const bytes = hjSiteImageTextToBytes(text);
            if (!bytes) throw new Error('解码失败');
            const made = hjBytesToViewerSrc(bytes);
            if (!made || !made.src) throw new Error('图像地址创建失败');
            const img = document.createElement('img');
            img.setAttribute('src', made.src);
            img.setAttribute('data-id', task.id);
            img.setAttribute('data-hj-media', '1');
            img.setAttribute('title', '点击查看大图');
            img.style.cssText = 'display:block;max-width:100%;height:auto;margin:12px auto;';
            task.slot.replaceWith(img);
            hjMediaFilled++;
        } catch (e) {
            hjMediaFailed++;
            if (task.slot.isConnected) task.slot.textContent = '图片加载失败：' + String(e && e.message || e);
        }
    }
    function hjMediaBuildSlots(list, host) {
        hjMediaEnsureObserver();
        for (const item of list) {
            if (hjMediaBuiltIds.has(item.id)) continue;
            hjMediaBuiltIds.add(item.id);
            const slot = document.createElement('div');
            slot.setAttribute(HJ_MEDIA_SLOT_ATTR, item.id);
            slot.style.cssText = 'box-sizing:border-box;min-height:260px;margin:12px auto;padding:18px 12px;'
                + 'text-align:center;color:#888;border:1px dashed #bbb;border-radius:8px;font-size:13px;background:rgba(0,0,0,0.02);';
            slot.textContent = '图片（脚本解锁，滚动到这里自动加载）';
            host.appendChild(slot);
            hjMediaBuilt++;
            if (hjMediaObserver) hjMediaObserver.observe(slot);
            hjMediaPending.push({ id: item.id, url: item.url, slot });
        }
        if (!hjMediaObserver) hjMediaPump();
    }
    let hjLiteRecovered = 0;
    let hjLiteTriedPid = '';
    let hjLiteRunning = false;
    let hjLiteReason = 'idle';
    const hjLiteNodeCache = new Map();
    const HJ_LITE_MAX_PAGES = 8;                                                 
    const HJ_LITE_PAGE_SIZE = 100;                                                  
    const HJ_LITE_PARALLEL = 3;                                                
    const HJ_LITE_TTL = 300000;                              
    const HJ_LITE_TTL_PARTIAL = 30000;                     
    const HJ_LITE_TTL_EMPTY = 8000;                                      
    const HJ_LITE_HOST_ATTR = 'data-hj-lite';
    const HJ_LITE_CAP = 203;
    function hjLiteIsTruncated() {
        const ed = hjBodyEditor();
        if (!ed) return false;
        const t = String(ed.textContent || '').trim();
        if (!t) return false;
        return /(?:\.{3}|…)$/.test(t);
    }
    function hjLiteBodyText() {
        const ed = hjBodyEditor();
        if (!ed) return '';
        return String(ed.textContent || '').replace(/\s+/g, ' ').trim();
    }
    function hjLiteIsCapped(s) {
        const t = String(s || '').replace(/\s+$/, '');
        return t.endsWith('...') || t.endsWith('\u2026');
    }
    const HJ_LITE_MARK_RE = /\[[^\[\]]{0,24}\]/g;
    function hjLiteStripMarks(s) {
        return String(s || '').replace(HJ_LITE_MARK_RE, '');
    }
    function hjLitePrefixOk(body, lite) {
        const head = hjLiteStripMarks(String(body || '')).replace(/\s+/g, '')
            .replace(/(?:\.{3}|…)+$/, '');
        if (!head) return true;                                            
        const l = hjLiteStripMarks(String(lite || '')).replace(/\s+/g, '');
        return l.startsWith(head.slice(0, 40));
    }
    async function hjLiteNodeMap(nodeId) {
        const hit = hjLiteNodeCache.get(nodeId);
        if (hit && Date.now() - hit.at < hit.ttl) return { byId: hit.byId, complete: hit.complete };
        const f = hjNativeFetch || fetch;
        const byId = new Map();
        let pages = 0;
        let complete = false;
        let broke = false;
        const fetchPage = async (pg) => {
            const url = '/api/topic/node/topics?page=' + pg
                + '&nodeId=' + encodeURIComponent(nodeId)
                + '&type=1&limit=' + HJ_LITE_PAGE_SIZE;
            const r = await f(url, { credentials: 'include' });
            if (!r || !r.ok) return null;
            const j = await r.json();
            let s = j && j.data;
            if (typeof s === 'string') {
                for (let i = 0; i < 6 && /^[A-Za-z0-9+/=]+$/.test(s); i++) {
                    const bin = atob(s), bytes = new Uint8Array(bin.length);
                    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
                    s = new TextDecoder('utf-8').decode(bytes);
                }
            } else if (s && typeof s === 'object') {
                s = JSON.stringify(s);
            }
            if (typeof s !== 'string') return null;
            const res = (JSON.parse(s).results) || [];
            for (const t of res) {
                if (t && t.topicId != null && typeof t.liteContent === 'string') {
                    byId.set(String(t.topicId), t.liteContent);
                }
            }
            return res.length;
        };
        try {
            const n1 = await fetchPage(1);
            if (n1 === null) { broke = true; } else {
                pages++;
                if (n1 < HJ_LITE_PAGE_SIZE) complete = true;
            }
            while (!complete && !broke && pages < HJ_LITE_MAX_PAGES) {
                const wave = [];
                for (let i = 1; i <= HJ_LITE_PARALLEL && pages + i <= HJ_LITE_MAX_PAGES; i++) {
                    wave.push(fetchPage(pages + i));
                }
                const counts = await Promise.all(wave);
                for (const c of counts) {
                    if (c === null) { broke = true; break; }
                    pages++;
                    if (c < HJ_LITE_PAGE_SIZE) { complete = true; break; }
                }
            }
        } catch (e) { }
        const ttl = complete ? HJ_LITE_TTL : (pages ? HJ_LITE_TTL_PARTIAL : HJ_LITE_TTL_EMPTY);
        hjLiteNodeCache.set(nodeId, { at: Date.now(), ttl, complete, byId });
        if (hjLiteNodeCache.size > 8) {
            const oldest = [...hjLiteNodeCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
            if (oldest) hjLiteNodeCache.delete(oldest[0]);
        }
        return { byId, complete };
    }
    function hjLiteCtxCurrent(ctx) {
        return hjAudioUnlock && hjAudioIsTargetPage() && ctx.pid === hjCurrentPostId()
            && ctx.generation === hjAudioGeneration && ctx.routeGeneration === hjRouteGen;
    }
    function hjLiteEnsureHost(ctx) {
        if (hjAudioHostEl && hjAudioHostEl.isConnected) {
            if (String(hjAudioHostEl.getAttribute(HJ_AUDIO_HOST_ATTR) || '') === String(ctx.pid)) {
                return hjAudioHostEl;
            }
            try { hjAudioHostEl.remove(); } catch (e) { }
            hjAudioHostEl = null;
        }
        const anchor = hjAudioHostAnchor();
        if (!anchor || !anchor.parentNode) return null;
        const host = document.createElement('div');
        host.setAttribute(HJ_AUDIO_HOST_ATTR, ctx.pid);
        host.style.cssText = 'margin:14px 0;';
        anchor.parentNode.insertBefore(host, anchor.nextSibling);
        hjAudioHostEl = host;
        return host;
    }
    function hjLiteRender(text, ctx, host) {
        if (!hjLiteCtxCurrent(ctx)) return;
        if (!host || !host.isConnected) return;
        if (host.querySelector('[' + HJ_LITE_HOST_ATTR + ']')) return;
        const capped = hjLiteIsCapped(text);
        const box = document.createElement('div');
        box.setAttribute(HJ_LITE_HOST_ATTR, ctx.pid);
        box.style.cssText = 'margin:12px 0;padding:10px 12px;border:1px solid #e4e4e4;border-radius:8px;'
            + 'background:#fafafa;line-height:1.7;word-break:break-word;';
        const cap = document.createElement('div');
        cap.textContent = capped
            ? '正文补回 · 列表接口（服务端上限 ' + HJ_LITE_CAP + ' 字，非全文）'
            : '完整正文 · 列表接口补回';
        cap.style.cssText = 'font-size:12px;color:#888;margin-bottom:6px;';
        const body = document.createElement('div');
        body.textContent = text;
        const foot = document.createElement('div');
        foot.textContent = capped
            ? '详情接口只肯给前 100 字；以上是站内能取到的最长版本（上限 ' + HJ_LITE_CAP + ' 字，'
              + '再往后服务端不下发）。'
            : '此帖正文未触服务端 ' + HJ_LITE_CAP + ' 字上限，以上即为全文。';
        foot.style.cssText = 'font-size:12px;color:#9e9e9e;margin-top:8px;';
        box.appendChild(cap);
        box.appendChild(body);
        box.appendChild(foot);
        host.appendChild(box);
        hjLiteReason = capped ? 'recovered-capped' : 'recovered-full';
        hjLiteRecovered++;
    }
    async function hjUnlockLiteContent() {
        if (!hjAudioUnlock || hjLiteRunning) return;
        if (!hjAudioIsTargetPage()) return;
        const pid = hjCurrentPostId();
        if (!pid || pid === hjLiteTriedPid) return;
        if (!hjLiteIsTruncated()) { hjLiteReason = 'not-truncated'; return; }
        if (!(hjAudioNodeVipLimit >= 1)) { hjLiteReason = 'board-not-trimmed'; return; }
        if (!hjAudioNodeId) { hjLiteReason = 'no-node'; return; }                    
        hjLiteRunning = true;
        hjLiteTriedPid = pid;
        const ctx = { pid: pid, generation: hjAudioGeneration,
            routeGeneration: hjRouteGen, attachGeneration: hjAttachMapGeneration };
        try {
            const got = await hjLiteNodeMap(hjAudioNodeId);
            if (!hjLiteCtxCurrent(ctx)) { hjLiteReason = 'stale'; return; }
            const lite = String(got.byId.get(String(pid)) || '').replace(/\s+/g, ' ').trim();
            if (!lite) {
                hjLiteReason = got.complete ? 'not-in-list' : 'list-incomplete';
                if (!got.complete) hjLiteTriedPid = '';
                return;
            }
            const body = hjLiteBodyText();
            if (body && lite.length <= body.length + 5) { hjLiteReason = 'no-gain'; return; }
            if (body && !hjLitePrefixOk(body, lite)) { hjLiteReason = 'prefix-mismatch'; return; }
            const host = hjLiteEnsureHost(ctx);
            if (!host) { hjLiteReason = 'no-host'; return; }
            hjLiteRender(lite, ctx, host);
        } catch (e) {
            hjLiteReason = 'error';
        } finally {
            hjLiteRunning = false;
        }
    }
    async function hjUnlockAudios() {
        hjAudioEnsureRouteState();
        if (!hjAudioUnlock || hjAudioRunning || !hjAudioIsTargetPage()) return;
        const ctx = { pid: hjCurrentPostId(), generation: hjAudioGeneration,
            routeGeneration: hjRouteGen, attachGeneration: hjAttachMapGeneration };
        if (!ctx.pid) return;
        hjAudioRunning = true;
        try {
            hjAudioPasses++;
            if (hjAudioMapTopicId !== ctx.pid && Date.now() - hjAudioAttachTriedAt > 60000) {
                hjAudioAttachTriedAt = Date.now();
                if (typeof hjEnsureAttachMap === 'function' && hjNativeFetch) await hjEnsureAttachMap();
            }
            if (!hjAudioContextCurrent(ctx)) return;
            try { hjAudioAdoptNative(); } catch (e) { }
            const body = hjAudioBodyIds();
            const list = [];
            for (const [id, url] of hjAudioUrlById) {
                if (body.has(id) || hjAudioBuiltIds.has(id)) continue;
                list.push({ id, url });
            }
            const imgs = (hjMediaHasImagePlaceholder() && hjAttachUrlById.size) ? hjMediaStrippedImages() : [];
            if (!list.length && !imgs.length) return;
            const host = hjAudioEnsureHost(ctx);
            if (!host) return;
            if (list.length) hjAudioBuildPlayers(list, host, ctx);
            if (imgs.length) hjMediaBuildSlots(imgs, host);
        } catch (e) {
            console.warn('[海角脚本] 音频解锁异常', e);
        } finally {
            if (ctx.generation === hjAudioGeneration) hjAudioRunning = false;
        }
    }
    try {
        unsafeWindow.__hjSetAudioUnlock = (on) => {
            hjAudioUnlock = !!on;
            hjAudioResetState();
            if (hjAudioUnlock) { try { hjUnlockAudios(); } catch (e) { } }
            return hjAudioUnlock;
        };
        unsafeWindow.__hjAudioDebug = () => ({
            pid: hjCurrentPostId(), routeKey: hjAudioRouteKey, routeGen: hjAudioRouteGeneration,
            currentRouteGen: hjRouteGen, attachTopic: hjAttachMapTopicId,
            attachSize: hjAttachUrlById.size, audioUrls: hjAudioUrlById.size,
            bodyIds: [...hjAudioBodyIds()], builtIds: [...hjAudioBuiltIds], built: hjAudioBuilt,
            audioMapTopic: hjAudioMapTopicId, host: !!hjAudioHostEl, passes: hjAudioPasses, running: hjAudioRunning,
            listRows: hjAudioListRows, listPlays: hjAudioListPlays, listCache: [...hjAudioListNodeCache.keys()],
            listCaptured: [...hjListRowMap.entries()].map(([k, v]) => k + ':' + v.size),
            listCapturedKeys: (() => {
                const m = hjListRowMap.get(hjAudioListRoute() ? hjAudioListRoute().nodeId : '');
                return m ? [...m.keys()].slice(0, 100) : [];
            })(),
            listDetailCache: [...hjAudioListDetailCache.keys()],
            listSeq: [...hjListTitleSeq.entries()].map(([k, v]) => k + ':' + v.size),
            listKills: hjAudioListKills, listKillReason: hjAudioListKillReason, listErr: hjAudioListErr,
            adopted: hjAudioAdopted, adoptErr: hjAudioAdoptErr, fit: hjAudioFitFixed,
            imagePlaceholder: hjMediaHasImagePlaceholder(), mediaBuilt: hjMediaBuilt,
            mediaFilled: hjMediaFilled, mediaFailed: hjMediaFailed,
            node: hjAudioNodeId, vipLimit: hjAudioNodeVipLimit, liteRecovered: hjLiteRecovered,
            liteCache: [...hjLiteNodeCache.keys()], liteTriedPid: hjLiteTriedPid,
            liteRunning: hjLiteRunning, liteTruncated: hjLiteIsTruncated(),
            liteReason: hjLiteReason, liteCap: HJ_LITE_CAP,
            vipAdHidden: hjVipAdHidden, vipAdHiddenNow: hjVipAdUndo.size,
            vipAdUnlocked: hjVipAdContentUnlocked(), replyToastMuted: hjReplyToastMuted,
            liteCacheDetail: [...hjLiteNodeCache.entries()].map(([k, v]) =>
                ({ node: k, pages: v.byId.size, complete: v.complete }))
        });
    } catch (e) { }
    let hjAudioListNodeCache = new Map();
    let hjAudioListRows = 0;
    let hjAudioListPlays = 0;
    let hjAudioListPlayer = null;
    let hjAudioListKills = 0;
    let hjAudioListKillReason = '';
    const HJ_AUDIO_LIST_BTN = 'data-hj-audio-play';
    const HJ_AUDIO_LIST_URL = 'data-hj-audio-url';
    const HJ_AUDIO_LIST_PID = 'data-hj-audio-pid';
    const HJ_AUDIO_LIST_ANCHOR = 'data-hj-audio-anchor';
    const HJ_AUDIO_LIST_ANCHOR_V = '1';
    const HJ_AUDIO_LIST_ON = 'data-hj-audio-on';
    const HJ_AUDIO_OPEN_BTN = 'data-hj-audio-open';
    const HJ_AUDIO_LIST_TTL = 120000;
    const HJ_LIST_ROW_SEARCH = 'search';
    const HJ_LIST_ROW_ES = 'es';
    const HJ_AUDIO_ICON_SEL = '.title-icon-audio, .titleicon-audio, .titleicon, .title-icon';
    const HJ_AUDIO_ROW_SEL = '.list-item, .content-box, .hjbox-container, tr';
    function hjAudioListRoute() {
        const path = String(location.pathname || '');
        const isPc = /^\/article(?:\/|$)/.test(path);
        const isMobile = /^\/forum\/forumlist(?:\/|$)/.test(path);
        const isSearch = /^\/search(?:\/|$)/.test(path);
        const isEs = /^\/es(?:\/|$)/.test(path);
        const page = (String(location.search || '').match(/[?&]page=(\d+)/) || [])[1] || '1';
        if (isSearch) return { nodeId: HJ_LIST_ROW_SEARCH, page: String(page), layout: 'search', selfFetch: false };
        if (isEs) return { nodeId: HJ_LIST_ROW_ES, page: String(page), layout: 'es', selfFetch: false };
        if (!isPc && !isMobile) return null;
        const m = String(location.search || '').match(/[?&]nodeId=(\d+)/);
        if (!m) return null;
        return { nodeId: m[1], page: String(page), layout: isPc ? 'pc' : 'mobile', selfFetch: true };
    }
    function hjAudioIconAnchors() {
        const out = [];
        try {
            for (const ic of document.querySelectorAll(HJ_AUDIO_ICON_SEL)) {
                const anchor = ic.parentElement;
                if (!anchor || !anchor.isConnected) continue;
                if (!hjAudioNormTitle(hjAudioRowTitle(anchor))) continue;
                if (out.some(x => x.anchor === anchor)) continue;
                out.push({ row: ic.closest(HJ_AUDIO_ROW_SEL) || anchor, anchor, viaIcon: String(ic.className || '') });
            }
        } catch (e) { }
        return out;
    }
    function hjAudioListRowNodes() {
        const out = [];
        try {
            for (const tr of document.querySelectorAll('table tbody tr')) {
                if (!tr.isConnected) continue;
                const anchor = tr.querySelector('a.td-title') || tr.querySelector('td a');
                if (anchor) out.push({ row: tr, anchor, where: 'anchor' });
            }
            if (!out.length) {
                for (const box of document.querySelectorAll('.van-list .content-box, .van-clearfix > .content-box')) {
                    if (!box.isConnected) continue;
                    const title = box.querySelector('.content-title');
                    if (title) out.push({ row: box, anchor: title, where: 'anchor' });
                }
            }
            for (const extra of hjAudioIconAnchors()) {
                if (out.some(x => x.anchor === extra.anchor)) continue;
                out.push(extra);
            }
            if (!out.length) {
                for (const box of document.querySelectorAll('.list.hjbox-container, .list-item')) {
                    if (!box.isConnected) continue;
                    let best = null, bestLen = 0;
                    for (const el of box.querySelectorAll('a,div,span,h1,h2,h3,p')) {
                        if (!el.isConnected || el.children.length > 3) continue;
                        const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
                        if (t.length <= bestLen || t.length < 6) continue;
                        if (/^最新回帖|^\d{2}-\d{2}\s/.test(t)) continue;                
                        best = el; bestLen = t.length;
                    }
                    if (best) out.push({ row: box, anchor: best, where: 'search-fallback' });
                }
            }
        } catch (e) { }
        return out;
    }
    function hjAudioRowTitle(anchor) {
        if (!anchor) return '';
        let txt = '';
        try {
            for (const n of anchor.childNodes) {
                if (n.nodeType === 3) { txt += n.textContent || ''; continue; }
                if (n.nodeType !== 1) continue;
                if (n.hasAttribute && (n.hasAttribute(HJ_AUDIO_LIST_BTN) || n.hasAttribute(HJ_AUDIO_LIST_ON))) continue;
                txt += n.textContent || '';
            }
        } catch (e) { }
        if (txt.replace(/\s+/g, '')) return txt;
        return String(anchor.textContent || '');
    }
    function hjAudioNormTitle(s) {
        return String(s || '').replace(/\s+/g, '').replace(/…$/, '').trim();
    }
    function hjAudioTitleSkeleton(s) {
        return String(s || '').replace(/\s+/g, '').replace(/[.．。]{2,}|…/g, '').trim();
    }
    const HJ_AUDIO_SKEL_MIN = 8;
    function hjAudioListMatch(anchor, byTitle) {
        const key = hjAudioNormTitle(hjAudioRowTitle(anchor));
        if (!key) return null;
        const exact = byTitle.get(key);
        if (exact) return exact;
        const skel = hjAudioTitleSkeleton(key);
        if (skel.length < HJ_AUDIO_SKEL_MIN) return null;
        let hit = null, n = 0;
        for (const it of byTitle.values()) {
            if (!it || !it.skel) continue;
            if (it.skel.startsWith(skel)) { hit = it; if (++n > 1) return null; }
        }
        return n === 1 ? hit : null;
    }
    function hjAudioRowQualifies(t) {
        if (!t) return false;
        if (t.hasAudio === true) return true;
        const att = t.attachments;
        if (!Array.isArray(att)) return false;
        return att.some(a => a && a.category === 'audio'
            && a.remoteUrl && /\/hjstore\/audio\//.test(String(a.remoteUrl)));
    }
    const HJ_AUDIO_LIST_PAGE_SIZE = 100;
    const HJ_AUDIO_LIST_MAX_PAGES = 10;                               
    const HJ_AUDIO_LIST_WAVE = 3;
    const hjListRowMap = new Map();
    const HJ_LIST_ROW_BOARDS = 12;                          
    function hjListRowItem(t) {
        const att = Array.isArray(t && t.attachments)
            ? t.attachments.find(x => x && x.category === 'audio'
                && x.remoteUrl && /\/hjstore\/audio\//.test(String(x.remoteUrl)))
            : null;
        return {
            pid: t && t.topicId != null ? String(t.topicId) : '',
            id: att ? String(att.id) : '',
            url: att ? String(att.remoteUrl) : '',
            title: hjAudioNormTitle(t && t.title),
            skel: hjAudioTitleSkeleton(t && t.title)
        };
    }
    function hjExtractRows(data) {
        if (Array.isArray(data)) return data;
        if (!data || typeof data !== 'object') return null;
        if (Array.isArray(data.results)) return data.results;
        if (Array.isArray(data.list)) return data.list;
        if (Array.isArray(data.topics)) return data.topics;
        return null;
    }
    const hjListTitleSeq = new Map();
    let hjListTitleSeqAt = 0;
    const HJ_LIST_TITLE_SEQ_TTL = 45000;
    function hjRecordListRows(nodeId, results, opts) {
        try {
            const key = String(nodeId || '');
            if (!key || !Array.isArray(results)) return 0;
            let m = hjListRowMap.get(key);
            if (!m) { m = new Map(); hjListRowMap.set(key, m); }
            let added = 0;
            for (const t of results) {
                if (!hjAudioRowQualifies(t)) continue;
                const item = hjListRowItem(t);
                const title = item.title;
                if (!title || m.has(title)) continue;
                m.set(title, item);
                added++;
            }
            if (opts && opts.dup) {
                if (!hjListTitleSeq.has(key) || Date.now() - hjListTitleSeqAt > HJ_LIST_TITLE_SEQ_TTL) {
                    hjListTitleSeq.set(key, new Map());
                }
                hjListTitleSeqAt = Date.now();
                const byTitle = hjListTitleSeq.get(key);
                for (const t of results) {
                    if (!hjAudioRowQualifies(t)) continue;
                    const item = hjListRowItem(t);
                    const title = item.title;
                    if (!title) continue;
                    const arr = byTitle.get(title);
                    if (!arr) { byTitle.set(title, [item]); continue; }
                    if (arr.some(x => x.pid && item.pid && x.pid === item.pid)) continue;
                    arr.push(item);
                }
            }
            if (hjListRowMap.size > HJ_LIST_ROW_BOARDS) {
                const oldest = hjListRowMap.keys().next();
                if (!oldest.done && String(oldest.value) !== key) {
                    hjListRowMap.delete(oldest.value);
                    hjListTitleSeq.delete(oldest.value);
                }
            }
            return added;
        } catch (e) { return 0; }
    }
    async function hjAudioListNodeMap(route, needRows) {
        const key = route.nodeId + ':' + route.page;
        let entry = hjAudioListNodeCache.get(key);
        const fresh = entry && Date.now() - entry.at < entry.ttl;
        if (fresh && (entry.complete || entry.pages >= HJ_AUDIO_LIST_MAX_PAGES)) return entry.byTitle;
        const need = Math.min(HJ_AUDIO_LIST_MAX_PAGES,
            Math.max(1, Math.ceil(((Number(needRows) || 0) + 20) / HJ_AUDIO_LIST_PAGE_SIZE)));
        if (fresh && entry.pages >= need) return entry.byTitle;
        const byTitle = fresh ? entry.byTitle : new Map();
        let pages = fresh ? entry.pages : 0;
        let complete = fresh ? entry.complete : false;
        let broke = false;
        const startPage = pages + 1;
        const target = Math.max(need, startPage);
        const f = hjNativeFetch || fetch;
        const fetchPage = async (pg) => {
            const url = '/api/topic/node/topics?page=' + pg
                + '&nodeId=' + encodeURIComponent(route.nodeId)
                + '&type=0&limit=' + HJ_AUDIO_LIST_PAGE_SIZE;
            const r = await f(url, { credentials: 'include' });
            if (!r || !r.ok) return null;
            const j = await r.json();
            let s = j && j.data;
            if (typeof s === 'string') {
                for (let i = 0; i < 6 && /^[A-Za-z0-9+/=]+$/.test(s); i++) {
                    const bin = atob(s), bytes = new Uint8Array(bin.length);
                    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
                    s = new TextDecoder('utf-8').decode(bytes);
                }
            } else if (s && typeof s === 'object') {
                s = JSON.stringify(s);
            }
            if (typeof s !== 'string') return null;
            const res = (JSON.parse(s).results) || [];
            for (const t of res) {
                if (!hjAudioRowQualifies(t)) continue;
                const att = Array.isArray(t.attachments)
                    ? t.attachments.find(x => x && x.category === 'audio'
                        && x.remoteUrl && /\/hjstore\/audio\//.test(String(x.remoteUrl)))
                    : null;
                const title = hjAudioNormTitle(t.title);
                if (title && !byTitle.has(title)) {
                    byTitle.set(title, {
                        pid: t.topicId != null ? String(t.topicId) : '',
                        id: att ? String(att.id) : '',
                        url: att ? String(att.remoteUrl) : '',
                        skel: hjAudioTitleSkeleton(t.title)
                    });
                }
            }
            return res.length;
        };
        try {
            for (let pg = startPage; pg <= target && !broke && !complete; pg += HJ_AUDIO_LIST_WAVE) {
                const wave = [];
                for (let i = 0; i < HJ_AUDIO_LIST_WAVE && pg + i <= target; i++) wave.push(fetchPage(pg + i));
                const counts = await Promise.all(wave);
                for (const c of counts) {
                    if (c === null) { broke = true; break; }
                    pages++;
                    if (c < HJ_AUDIO_LIST_PAGE_SIZE) { complete = true; break; }
                }
            }
        } catch (e) { }
        const ttl = complete ? HJ_AUDIO_LIST_TTL : (pages ? 30000 : 8000);
        hjAudioListNodeCache.set(key, { at: Date.now(), ttl, byTitle, pages, complete });
        if (hjAudioListNodeCache.size > 24) {
            const oldest = [...hjAudioListNodeCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
            if (oldest) hjAudioListNodeCache.delete(oldest[0]);
        }
        return byTitle;
    }
    const hjAudioListDetailCache = new Map();
    const HJ_AUDIO_LIST_DETAIL_TTL = 300000;
    async function hjAudioListFetchAudios(pid) {
        const hit = hjAudioListDetailCache.get(String(pid));
        if (hit && Date.now() - hit.at < HJ_AUDIO_LIST_DETAIL_TTL) return hit.audios;
        const f = hjNativeFetch || fetch;
        const r = await f('/api/topic/' + encodeURIComponent(pid), { credentials: 'include' });
        if (!r || !r.ok) throw new Error('HTTP ' + ((r && r.status) || '?'));
        const j = await r.json();
        let s = j && j.data;
        if (typeof s === 'string') {
            for (let i = 0; i < 6 && /^[A-Za-z0-9+/=]+$/.test(s); i++) {
                const bin = atob(s), bytes = new Uint8Array(bin.length);
                for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
                s = new TextDecoder('utf-8').decode(bytes);
            }
        } else if (s && typeof s === 'object') {
            s = JSON.stringify(s);
        }
        const audios = [];
        if (typeof s === 'string') {
            const pl = JSON.parse(s);
            for (const a of (pl.attachments || [])) {
                if (!a || a.category !== 'audio') continue;
                const u = a.remoteUrl || a.url || '';
                if (u && /\/hjstore\/audio\//.test(String(u))) audios.push({ id: String(a.id), url: String(u) });
            }
        }
        hjAudioListDetailCache.set(String(pid), { at: Date.now(), audios });
        if (hjAudioListDetailCache.size > 40) {
            const oldest = [...hjAudioListDetailCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
            if (oldest) hjAudioListDetailCache.delete(oldest[0]);
        }
        return audios;
    }
    function hjAudioListSetBtnState(btn, on) {
        if (!btn) return;
        const label = btn.querySelector('span');
        if (on) {
            btn.setAttribute(HJ_AUDIO_LIST_ON, '1');
            if (btn.isConnected) {
                btn.style.background = '#fff3d6';
                btn.style.borderColor = '#b8860b';
            }
            btn.title = '收起这次试听（再点本按钮，或点页面其他地方）';
            if (label) label.textContent = '收起';
        } else {
            btn.removeAttribute(HJ_AUDIO_LIST_ON);
            if (btn.isConnected) {
                btn.style.background = '';
                btn.style.borderColor = '#d0a24c';
            }
            btn.title = '脚本解锁：就地播放这篇音频（不购买、不消耗任何余额）';
            if (label) label.textContent = '试听';
        }
    }
    function hjAudioListSyncBtnStates() {
        let n = 0;
        try {
            for (const b of document.querySelectorAll('[' + HJ_AUDIO_LIST_ON + ']')) {
                if (hjAudioListPlayer && hjAudioListPlayer.btn === b) continue;
                hjAudioListSetBtnState(b, false);
                n++;
            }
        } catch (e) { }
        return n;
    }
    function hjAudioListKill(reason) {
        const cur = hjAudioListPlayer;
        hjAudioListPlayer = null;
        if (!cur) return false;
        try { if (cur.audio) cur.audio.pause(); } catch (e) { }
        try { cur.box.remove(); } catch (e) { }
        try { if (cur.cell && cur.cell.isConnected) cur.cell.remove(); } catch (e) { }
        try { hjAudioListSetBtnState(cur.btn, false); } catch (e) { }
        hjAudioListKills++;
        hjAudioListKillReason = String(reason || '');
        return true;
    }
    function hjAudioListReap() {
        const cur = hjAudioListPlayer;
        if (!cur) return;
        let why = '';
        if (!cur.row || !cur.row.isConnected) why = 'row-gone';
        else if (!cur.box || !cur.box.isConnected) why = 'box-detached';
        else if (!hjAudioElContains(cur.row, cur.box)) why = 'box-moved-out-of-row';
        else if (!cur.btn || !cur.btn.isConnected) why = 'btn-gone';
        else {
            const route = hjAudioListRoute();
            if (!route) why = 'left-list-page';
            else if (cur.layout && route.layout !== cur.layout) why = 'layout-changed';
        }
        if (why) hjAudioListKill(why);
    }
    function hjAudioListBoxHost(btn) {
        let row = null;
        try { row = btn.closest(HJ_AUDIO_ROW_SEL); } catch (e) { row = null; }
        if (!row) {
            let n = btn.parentNode;
            let guard = 0;
            while (n && n.nodeType === 1 && guard++ < 30) {
                const t = String(n.tagName || '').toUpperCase();
                const cls = ' ' + String(n.className || '') + ' ';
                if (t === 'TR' || cls.indexOf(' content-box ') >= 0 || cls.indexOf(' list-item ') >= 0) { row = n; break; }
                n = n.parentNode;
            }
        }
        let anchor = null;
        try { anchor = btn.closest('[' + HJ_AUDIO_LIST_ANCHOR + ']'); } catch (e) { anchor = null; }
        let host = null;
        if (anchor && anchor.parentElement && anchor.parentElement !== document.body
            && anchor.parentElement !== document.documentElement) host = anchor.parentElement;
        if (!host) {
            const up = btn.parentElement;
            if (up && up.parentElement && up.parentElement !== document.body
                && up.parentElement !== document.documentElement) host = up.parentElement;
        }
        if (!host) host = row || btn.parentNode;
        if (!host) return null;
        return { row: row || host, host: host };
    }
    function hjAudioListMoreRow(pid, total) {
        const more = document.createElement('div');
        more.style.cssText = 'font-size:12px;color:#9e9e9e;padding:6px 0 0;';
        more.textContent = total > 1
            ? '试听只播第 1 个（这篇共 ' + total + ' 个音频）。'
            : '试听只播第 1 个音频。';
        const link = document.createElement('a');
        link.setAttribute(HJ_AUDIO_OPEN_BTN, '1');
        link.setAttribute('href', '/post/details?pid=' + encodeURIComponent(pid));
        link.textContent = ' 进帖听全部';
        link.style.cssText = 'color:#b8860b;font-weight:600;';
        more.appendChild(link);
        return more;
    }
    function hjAudioElCount(el) {
        if (!el) return 0;
        if (typeof el.childElementCount === 'number') return el.childElementCount;
        if (el.children && typeof el.children.length === 'number') return el.children.length;
        if (Array.isArray(el.childNodes)) return el.childNodes.filter(n => n && n.nodeType === 1).length;
        return 0;
    }
    function hjAudioElContains(root, node) {
        if (!root || !node) return false;
        if (typeof root.contains === 'function') {
            try { return !!root.contains(node); } catch (e) { }
        }
        let n = node;
        let guard = 0;
        while (n && guard++ < 200) { if (n === root) return true; n = n.parentNode; }
        return false;
    }
    let hjAudioListErr = '';
    function hjAudioListToggle(btn) {
        try { hjAudioListToggleInner(btn); }
        catch (e) {
            hjAudioListErr = String((e && e.message) || e);
            console.warn('[海角脚本] 试听展开失败：', e);
        }
    }
    function hjAudioListToggleInner(btn) {
        if (!btn || !btn.isConnected) return;
        const url = String(btn.getAttribute(HJ_AUDIO_LIST_URL) || '');
        const pid = String(btn.getAttribute(HJ_AUDIO_LIST_PID) || '');
        const attId = String(btn.getAttribute(HJ_AUDIO_LIST_BTN) || '');
        if (!url && !pid) return;
        hjAudioListReap();
        if (hjAudioListPlayer && hjAudioListPlayer.btn === btn) { hjAudioListKill('toggle-same-btn'); return; }
        if (hjAudioListPlayer) hjAudioListKill('toggle-other-btn');
        const spot = hjAudioListBoxHost(btn);
        if (!spot) return;
        const box = document.createElement('div');
        box.setAttribute(HJ_AUDIO_ITEM_ATTR, attId || pid);
        box.style.cssText = 'padding:6px 0 10px;width:100%;box-sizing:border-box;';
        spot.host.appendChild(box);
        hjAudioListPlays++;
        const route = hjAudioListRoute();
        hjAudioListPlayer = {
            box, audio: null, btn, row: spot.row, cell: spot.cell,
            layout: route ? route.layout : ''
        };
        hjAudioListSetBtnState(btn, true);
        const playFirst = () => {
            const a = box.querySelector('audio');
            if (!a) return;
            hjAudioListPlayer.audio = a;
            try { const p = a.play(); if (p && p.catch) p.catch(() => { }); } catch (e) { }
        };
        if (url) {
            box.appendChild(hjAudioPlayerRow({ id: attId, url: url, pid: pid }));
            if (pid) box.appendChild(hjAudioListMoreRow(pid, 0));
            playFirst();
            return;
        }
        const hint = document.createElement('div');
        hint.textContent = '正在取音频地址…';
        hint.style.cssText = 'font-size:12px;color:#888;padding:4px 0;';
        box.appendChild(hint);
        hjAudioListFetchAudios(pid).then(audios => {
            if (!box.isConnected) return;
            hint.remove();
            if (!audios.length) {
                const none = document.createElement('div');
                none.textContent = '这篇帖没有可取的音频（可能只在下辖附件里）';
                none.style.cssText = 'font-size:12px;color:#c00;padding:4px 0;';
                box.appendChild(none);
                return;
            }
            box.appendChild(hjAudioPlayerRow(audios[0]));
            if (pid) box.appendChild(hjAudioListMoreRow(pid, audios.length));
            playFirst();
        }).catch(e => {
            if (!box.isConnected) return;
            hint.textContent = '取音频地址失败：' + ((e && e.message) || e) + '（点按钮可重试）';
            hint.style.color = '#c00';
        });
    }
    try {
        document.addEventListener('click', (ev) => {
            try {
                const t = ev.target;
                if (!t || typeof t.closest !== 'function') return;
                const dl = t.closest('[' + HJ_AUDIO_DL_BTN + ']');
                if (dl) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    hjAudioDownload(dl);
                    return;
                }
                if (t.closest('[' + HJ_AUDIO_OPEN_BTN + ']')) return;
                const btn = t.closest('[' + HJ_AUDIO_LIST_BTN + ']');
                if (btn) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    hjAudioListToggle(btn);
                    return;
                }
                if (t.closest('[' + HJ_AUDIO_ITEM_ATTR + ']')) ev.stopPropagation();
            } catch (e) { }
        }, true);
    } catch (e) { }
    const HJ_AUDIO_FIT_ATTR = 'data-hj-audio-fit';
    const HJ_AUDIO_FIT_MAX = 6;
    const HJ_AUDIO_FIT_MAX_ROWS = 300;
    let hjAudioFitFixed = 0;
    let hjAudioFitChecked = 0;
    function hjAudioFitButtons() {
        let fixed = 0, checked = 0;
        try {
            const btns = document.querySelectorAll('[' + HJ_AUDIO_LIST_BTN + ']');
            for (let i = 0; i < btns.length && i < HJ_AUDIO_FIT_MAX_ROWS; i++) {
                const btn = btns[i];
                const anchor = btn.parentElement;
                if (!anchor || !anchor.isConnected) continue;
                checked++;
                const cs = getComputedStyle(anchor);
                if (cs.overflow !== 'hidden' && cs.overflowY !== 'hidden') continue;             
                const prev = Number(anchor.getAttribute(HJ_AUDIO_FIT_ATTR) || 0) || 0;
                if (prev >= HJ_AUDIO_FIT_MAX) continue;
                const ar = anchor.getBoundingClientRect();
                const br = btn.getBoundingClientRect();
                const borderB = parseFloat(cs.borderBottomWidth) || 0;
                const over = br.bottom - (ar.bottom - borderB);
                if (over <= 0.5) continue;                                                        
                const add = Math.min(6, Math.ceil(over) + 1);
                const cur = parseFloat(cs.paddingBottom) || 0;
                anchor.style.paddingBottom = (cur + add) + 'px';
                anchor.setAttribute(HJ_AUDIO_FIT_ATTR, String(prev + add));
                fixed++;
            }
        } catch (e) { }
        hjAudioFitFixed += fixed;
        hjAudioFitChecked += checked;
        return fixed;
    }
    function hjAudioInjectButtons(rows, byTitle) {
        if (!byTitle || !byTitle.size) return 0;
        let n = 0;
        for (const row of rows) {
            const anchor = row && row.anchor;
            if (!anchor || !anchor.isConnected) continue;
            if (anchor.querySelector('[' + HJ_AUDIO_LIST_BTN + ']')) continue;
            const item = hjAudioListMatch(anchor, byTitle);
            if (!item) continue;
            hjAudioListAppendButton(anchor, item);
            n++;
        }
        if (n) { try { hjAudioFitButtons(); } catch (e) { } }
        return n;
    }
    function hjAudioInjectByOrder(rows, byTitle) {
        if (!byTitle || !byTitle.size) return 0;
        const used = new Map();
        let n = 0;
        for (const row of rows) {
            const anchor = row && row.anchor;
            if (!anchor || !anchor.isConnected) continue;
            if (anchor.querySelector('[' + HJ_AUDIO_LIST_BTN + ']')) continue;
            const title = hjAudioNormTitle(hjAudioRowTitle(anchor));
            if (!title) continue;
            const arr = byTitle.get(title);
            if (!arr || !arr.length) continue;
            const k = used.get(title) || 0;
            if (k >= arr.length) continue;
            used.set(title, k + 1);
            hjAudioListAppendButton(anchor, arr[k]);
            n++;
        }
        if (n) { try { hjAudioFitButtons(); } catch (e) { } }
        return n;
    }
    async function hjUnlockListAudios() {
        if (!hjAudioUnlock) return;
        try { hjAudioListReap(); } catch (e) { }
        try { hjAudioListSyncBtnStates(); } catch (e) { }
        try { hjAudioFitButtons(); } catch (e) { }
        const route = hjAudioListRoute();
        if (!route) return;
        const pending = () => hjAudioListRowNodes()
            .filter(r => r.anchor.isConnected && !r.anchor.querySelector('[' + HJ_AUDIO_LIST_BTN + ']'));
        let rows = pending();
        if (!rows.length) return;
        if (route.layout === 'search' || route.layout === 'es') {
            const byTitle = hjListTitleSeq.get(String(route.nodeId));
            if (byTitle && byTitle.size) hjAudioInjectByOrder(rows, byTitle);
            return;
        }
        const captured = hjListRowMap.get(String(route.nodeId)) || null;
        if (captured && captured.size) hjAudioInjectButtons(rows, captured);
        rows = pending();
        if (!rows.length) return;
        if (!route.selfFetch) return;
        const byTitle = await hjAudioListNodeMap(route, hjAudioListRowNodes().length);
        if (!hjAudioListRoute()) return;
        hjAudioInjectButtons(pending(), byTitle);
    }
    function hjAudioListAppendButton(anchor, item) {
        if (!anchor || !item) return;
        if (anchor.querySelector('[' + HJ_AUDIO_LIST_BTN + ']')) return;
        {
            const btn = document.createElement('span');
            btn.setAttribute(HJ_AUDIO_LIST_BTN, item.id || item.pid || '');
            if (item.pid) btn.setAttribute(HJ_AUDIO_LIST_PID, item.pid);
            if (item.url) btn.setAttribute(HJ_AUDIO_LIST_URL, item.url);
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" '
                + 'aria-hidden="true" style="vertical-align:-1px;margin-right:3px"><path d="M8 5v14l11-7z"/></svg>'
                + '<span>试听</span>';
            btn.title = '脚本解锁：就地播放这篇音频（不购买、不消耗任何余额）';
            btn.style.cssText = 'display:inline-block;margin-left:8px;padding:0 8px;border:1px solid #d0a24c;'
                + 'border-radius:10px;color:#b8860b;font-size:12px;line-height:18px;height:20px;'
                + 'box-sizing:border-box;cursor:pointer;vertical-align:middle;';
            try { anchor.setAttribute(HJ_AUDIO_LIST_ANCHOR, HJ_AUDIO_LIST_ANCHOR_V); } catch (e) { }
            anchor.appendChild(btn);
            hjAudioListRows++;
        }
    }
    function hjSiteImageTextToBytes(text) {
        const s = String(text || '');
        const n = s.length;
        if (n < 44) return null;
        const lut = HJ_SITE_LUT;
        const out = new Uint8Array((n * 3 >> 2) + 8);
        let o = 0, buf = 0, bits = 0;
        for (let i = 0; i < n; i++) {
            const c = s.charCodeAt(i);
            if (c === 10 || c === 13 || c === 32 || c === 9) continue;          
            if (c === 61) break;                                                           
            const v = c < 128 ? lut[c] : 255;
            if (v === 255) return null;                         
            buf = (buf << 6) | v;
            bits += 6;
            if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xff; }
        }
        if (o < 32) return null;
        let head = '';
        for (let i = 0; i < 32 && i < o; i++) head += String.fromCharCode(out[i]);
        if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(head)) return null;
        return out.subarray(0, o);
    }
    function hjAsciiBytesToString(bytes) {
        let str = '';
        const CHUNK = 8192;
        for (let i = 0; i < bytes.length; i += CHUNK) {
            str += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
        }
        return str;
    }
    function hjSiteImageTextToDataUri(text) {
        const bytes = hjSiteImageTextToBytes(text);
        return bytes ? hjAsciiBytesToString(bytes) : '';
    }
    const HJ_STD_LUT = (() => {
        const t = new Uint8Array(128).fill(255);
        const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        for (let i = 0; i < 64; i++) t[A.charCodeAt(i)] = i;
        return t;
    })();
    function hjDataUriBytesToImageBytes(bytes) {
        let comma = -1;
        for (let i = 0; i < bytes.length && i < 64; i++) if (bytes[i] === 44) { comma = i; break; }
        if (comma < 0) return null;
        const lut = HJ_STD_LUT;
        const out = new Uint8Array(((bytes.length - comma) * 3 >> 2) + 8);
        let o = 0, buf = 0, bits = 0;
        for (let i = comma + 1; i < bytes.length; i++) {
            const c = bytes[i];
            if (c === 10 || c === 13 || c === 32 || c === 9) continue;
            if (c === 61) break;
            const v = c < 128 ? lut[c] : 255;
            if (v === 255) return null;
            buf = (buf << 6) | v;
            bits += 6;
            if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xff; }
        }
        return o > 0 ? out.subarray(0, o) : null;
    }
    function hjSniffImageMime(bytes) {
        if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
        if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
        if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
        if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
        if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
        return 'image/jpeg';
    }
    function hjBytesToViewerSrc(bytes) {
        try {
            const img = hjDataUriBytesToImageBytes(bytes);
            if (img && typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
                return { src: URL.createObjectURL(new Blob([img], { type: hjSniffImageMime(img) })), blob: true };
            }
        } catch (e) { }
        return { src: hjAsciiBytesToString(bytes), blob: false };
    }
    function hjMiniToFullUrl(url) {
        const raw = String(url || '');
        if (!raw || raw.indexOf('/hjstore/images/') === -1) return '';
        const m = raw.match(/^(.*?)_mini(\.(?:gif|jpe?g|png|webp|bmp))\.txt((?:[?#].*)?)$/i);
        if (!m) return '';
        return m[1] + m[2] + '.txt' + (m[3] || '');
    }
    async function hjFetchImageText(url) {
        try {
            const f = hjNativeFetch || fetch;
            const r = await f(url, { credentials: 'omit', cache: 'force-cache' });
            if (!r.ok) return '';
            return await r.text();
        } catch (e) { return ''; }
    }
    async function hjUpgradeViewerImage() {
        if (!hjUpgradeFullImage || hjViewerUpgrading) return;
        if (!hjImageViewerOpen()) return;
        const from = hjLastImageClickUrl;
        if (!from) return;
        const byMini = hjMiniToFullUrl(from);
        const byRewrite = (hjRewritePostImageToMini && !byMini
            && /\/hjstore\/images\/[^?#]*\.(?:jpe?g|png|webp|bmp)\.txt/i.test(from)) ? from : '';
        const fullUrl = byMini || byRewrite;
        if (!fullUrl) return;
        const viewerNow = document.querySelector('.el-image-viewer__wrapper');
        if (!viewerNow) return;
        const imgNow = viewerNow.querySelector('.el-image-viewer__canvas img') || viewerNow.querySelector('img');
        if (imgNow && fullUrl === hjViewerAppliedUrl && imgNow.getAttribute('src') === hjViewerAppliedSrc) return;
        hjViewerUpgrading = true;
        try {
            let src = hjFullImageCache.get(fullUrl);
            if (!src) {
                const text = await hjFetchImageText(fullUrl);
                const bytes = hjSiteImageTextToBytes(text);
                if (bytes) {
                    const made = hjBytesToViewerSrc(bytes);
                    if (made && made.src) {
                        src = made.src;
                        if (hjFullImageCache.size >= HJ_FULL_IMAGE_CACHE_MAX) {
                            const oldestKey = hjFullImageCache.keys().next().value;
                            const oldest = hjFullImageCache.get(oldestKey);
                            hjFullImageCache.delete(oldestKey);
                            if (oldest && oldest.blob) { try { URL.revokeObjectURL(oldest.src); } catch (e) { } }
                        }
                        hjFullImageCache.set(fullUrl, { src, blob: made.blob });
                    }
                }
            }
            const srcValue = src && typeof src === 'object' ? src.src : src;
            if (!srcValue) {
                console.info('[海角脚本] 查看大图升级失败（完整图取不到或解码失败），保留缩略图', from.slice(-46));
                return;
            }
            const v2 = document.querySelector('.el-image-viewer__wrapper');
            if (!v2) return;
            const img = v2.querySelector('.el-image-viewer__canvas img') || v2.querySelector('img');
            if (!img) return;
            img.setAttribute('src', srcValue);
            hjViewerAppliedUrl = fullUrl;
            hjViewerAppliedSrc = srcValue;
            hjViewerUpgradeDone++;
            console.info('[海角脚本] 查看大图已升级为完整图', {
                from: from.slice(-46),
                srcKind: (src && typeof src === 'object' && src.blob) ? 'blob' : 'dataURI',
                srcLen: srcValue.length
            });
        } catch (e) {
            console.warn('[海角脚本] 查看大图升级异常', e);
        } finally {
            hjViewerUpgrading = false;
        }
    }
    let hjOwnViewerEnabled = true;
    let hjOwnViewerPriority = true;                                         
    let hjOwnViewerSiteHidden = [];
    let hjOwnViewerSiteSquelched = 0;                      
    let hjOwnViewerSiteOpenBlocked = 0;                                      
    let hjOwnViewerSiteForceClosed = 0;                           
    let hjOwnViewerSiteLockLeft = 0;                                               
    let hjOwnViewerEl = null;
    let hjOwnViewerList = [];
    let hjOwnViewerAt = 0;
    let hjOwnViewerSeq = 0;
    let hjOwnViewerShown = 0;
    let hjOwnViewerTimer = null;                                   
    let hjOwnViewerPendingImg = null;                              
    const HJ_OWN_VIEWER_DELAY = 260;                           
    const HJ_PAID_BOX_SEL = '.html-box, .html-content, .details-body, .post-content, .article-content,'
        + ' .topic-content, .ql-editor, .article, .floor_box, .floor-show';
    const HJ_VIEWER_BOX_SEL = '.html-box, .html-content, .details-body, .post-content, .article-content,'
        + ' .topic-content, .ql-editor, .article';
    function hjPaidBoxImgSelector() {
        return HJ_VIEWER_BOX_SEL.split(',').map(s => s.trim()).filter(Boolean).map(s => s + ' img').join(', ');
    }
    function hjOwnViewerIsBodyImage(img) {
        if (!img || !img.getAttribute) return false;
        const src = String(img.getAttribute('src') || '');
        if (/^data:image\/svg\+xml/i.test(src)) return false;                                   
        if (/\/images\/emoji\//i.test(src)) return false;                                 
        if (/\/system\//i.test(src)) return false;                                             
        if (/\/static\//i.test(src)) return false;                            
        if (/\/loading\.gif|\/loading\.[0-9a-f]+\.gif/i.test(src)) return false;
        if (/^data:image\/gif;base64,R0lGODlhAQAB/i.test(src)) return false;            
        try { if (img.closest('[data-hj-coin-host]')) return true; } catch (e) { }
        const dataId = String(img.getAttribute('data-id') || '');
        if (/^\d+$/.test(dataId)) {
            if (hjAttachUrlById && hjAttachUrlById.size) {
                if (!hjAttachUrlById.has(dataId)) return false;
            }
            return true;
        }
        try {
            const byUrl = img.closest('[data-img_url]');
            if (byUrl) {
                const u = String(byUrl.getAttribute('data-img_url') || '');
                if (/\/hjstore\/images\//.test(u) && !/_mini\./i.test(u)) return true;
            }
        } catch (e) { }
        return false;
    }
    function hjOwnViewerCollect() {
        const out = [];
        let nodes = null;
        try { nodes = document.querySelectorAll(hjPaidBoxImgSelector()); } catch (e) { return out; }
        for (const img of nodes) {
            if (!img.isConnected) continue;
            const src = String(img.getAttribute('src') || '');
            if (!src) continue;
            if (!hjOwnViewerIsBodyImage(img)) continue;
            const r = img.getBoundingClientRect();
            if (r.width < 40 && r.height < 40 && !(img.naturalWidth >= 200)) continue;
            out.push(img);
        }
        return out;
    }
    function hjOwnViewerStyle() {
        hjAddStyle(`
            #hj-own-viewer {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.93);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 2147483000;
                touch-action: none;
                -webkit-tap-highlight-color: transparent;
            }
            #hj-own-viewer.hj-own-open { display: flex; }
            #hj-own-viewer img {
                max-width: 96vw;
                max-height: 92vh;
                object-fit: contain;
                display: block;
            }
            #hj-own-viewer .hj-own-close {
                position: absolute; top: 12px; right: 16px;
                width: 40px; height: 40px; line-height: 38px; text-align: center;
                font-size: 26px; color: #fff; cursor: pointer; user-select: none;
                background: rgba(255,255,255,0.14); border-radius: 50%;
            }
                                                           
            #hj-own-viewer .hj-own-save {
                position: absolute; top: 16px; right: 66px;
                height: 32px; line-height: 32px; padding: 0 14px;
                font-size: 13px; color: #fff; cursor: pointer; user-select: none;
                background: rgba(255,255,255,0.14); border-radius: 16px;
            }
            #hj-own-viewer .hj-own-save:active { background: rgba(255,255,255,0.26); }
                                 
            #hj-own-viewer img.hj-own-actual { max-width: none; max-height: none; cursor: zoom-out; }
            #hj-own-viewer img { cursor: zoom-in; }
            #hj-own-viewer .hj-own-nav {
                position: absolute; top: 50%; transform: translateY(-50%);
                width: 46px; height: 72px; line-height: 70px; text-align: center;
                font-size: 30px; color: #fff; cursor: pointer; user-select: none;
                background: rgba(255,255,255,0.10); border-radius: 6px;
            }
            #hj-own-viewer .hj-own-prev { left: 8px; }
            #hj-own-viewer .hj-own-next { right: 8px; }
            #hj-own-viewer .hj-own-count {
                position: absolute; left: 0; right: 0; bottom: 14px;
                text-align: center; color: rgba(255,255,255,0.75); font-size: 13px;
            }
        `);
    }
    function hjOwnViewerSiteNodes() {
        const out = [];
        try {
            for (const el of document.querySelectorAll(HJ_SITE_VIEWER_SEL)) {
                if (!el || !el.isConnected) continue;
                if (el === hjOwnViewerEl) continue;
                if (hjOwnViewerEl && hjOwnViewerEl.contains(el)) continue;
                const cs = getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                out.push(el);
            }
        } catch (e) { }
        return out;
    }
    function hjOwnViewerSilenceSite() {
        const nodes = hjOwnViewerSiteNodes();
        for (const el of nodes) {
            try {
                hjOwnViewerSiteHidden.push([el, el.style.getPropertyValue('display'), el.style.getPropertyPriority('display')]);
                el.style.setProperty('display', 'none', 'important');
            } catch (e) { }
        }
        if (nodes.length) hjOwnViewerSiteSquelched += nodes.length;
        return nodes.length;
    }
    function hjOwnViewerVueInstances() {
        const out = [];
        try {
            const host = document.querySelector('#app') || document.body;
            const root = host && host.__vue__;
            if (!root) return out;
            const stack = [root];
            for (let guard = 0; stack.length && guard < 30000; guard++) {
                const vm = stack.pop();
                if (!vm) continue;
                out.push(vm);
                const kids = vm.$children;
                if (kids) for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
            }
        } catch (e) { }
        return out;
    }
    function hjOwnViewerForceCloseSite() {
        let tried = 0, ok = 0;
        const found = [];
        for (const vm of hjOwnViewerVueInstances()) {
            try {
                const name = String((vm.$options && (vm.$options.name || vm.$options._componentTag)) || '');
                const props = vm.$props || {};
                const looksPreview = /ImagePreview|ImageViewer/i.test(name)
                    || (props && ('images' in props) && (('value' in props) || ('show' in props)));
                if (!looksPreview) continue;
                found.push(name || '(无名)');
                tried++;
                try { vm.$emit('input', false); } catch (e) { }
                try { vm.$emit('close'); } catch (e) { }
                try { if (vm.value === true) vm.value = false; } catch (e) { }
                try { if (vm.$props && vm.$props.value === true) vm.$props.value = false; } catch (e) { }
                try { if (vm.visible === true) vm.visible = false; } catch (e) { }
                try {
                    const p = vm.$parent;
                    if (p && p.$data) {
                        for (const k of Object.keys(p.$data)) {
                            if (p.$data[k] === true && /show|visible|preview/i.test(k)) p.$data[k] = false;
                        }
                    }
                } catch (e) { }
                ok++;
            } catch (e) { }
        }
        if (tried) hjOwnViewerSiteForceClosed += tried;
        return { tried, ok, found };
    }
    function hjOwnViewerVerifySiteClosed() {
        const list = hjOwnViewerSiteHidden;
        hjOwnViewerSiteHidden = [];
        let closedBySite = 0, stillOpen = 0;
        const rehide = [];
        for (const [el, value, priority] of list) {
            try {
                if (!el || !el.isConnected) continue;
                if (value) el.style.setProperty('display', value, priority);
                else el.style.removeProperty('display');
                const visible = getComputedStyle(el).display !== 'none';
                if (visible) {
                    stillOpen++;
                    rehide.push([el, value, priority]);
                    el.style.setProperty('display', 'none', 'important');
                } else closedBySite++;
            } catch (e) { }
        }
        hjOwnViewerSiteHidden = rehide;
        return { closedBySite, stillOpen };
    }
    function hjOwnViewerRestoreSite() {
        const list = hjOwnViewerSiteHidden;
        hjOwnViewerSiteHidden = [];
        for (const [el, value, priority] of list) {
            try {
                if (value) el.style.setProperty('display', value, priority);
                else el.style.removeProperty('display');
            } catch (e) { }
        }
    }
    let hjOwnViewerSiteObserver = null;
    function hjOwnViewerWatchSite() {
        if (!hjOwnViewerPriority || hjOwnViewerSiteObserver || !document.body) return;
        try {
            hjOwnViewerSiteObserver = new MutationObserver(() => {
                if (!hjOwnViewerEl || !hjOwnViewerEl.classList.contains('hj-own-open')) { hjOwnViewerUnwatchSite(); return; }
                hjOwnViewerSilenceSite();
            });
            hjOwnViewerSiteObserver.observe(document.body, { childList: true, subtree: true });
        } catch (e) { hjOwnViewerSiteObserver = null; }
    }
    function hjOwnViewerUnwatchSite() {
        if (!hjOwnViewerSiteObserver) return;
        try { hjOwnViewerSiteObserver.disconnect(); } catch (e) { }
        hjOwnViewerSiteObserver = null;
    }
    function hjOwnViewerEnsure() {
        if (hjOwnViewerEl && document.body && document.body.contains(hjOwnViewerEl)) return hjOwnViewerEl;
        if (!document.body) return null;
        if (!hjOwnViewerEl) hjOwnViewerStyle();
        const el = document.createElement('div');
        el.id = 'hj-own-viewer';
        el.innerHTML = ''
            + '<img alt="">'
            + '<div class="hj-own-prev hj-own-nav">‹</div>'
            + '<div class="hj-own-next hj-own-nav">›</div>'
            + '<div class="hj-own-count"></div>'
            + '<div class="hj-own-save">保存</div>'
            + '<div class="hj-own-close">×</div>';
        document.body.appendChild(el);
        hjOwnViewerEl = el;
        el.querySelector('.hj-own-close').addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation(); hjOwnViewerClose();
        });
        el.querySelector('.hj-own-save').addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation(); hjOwnViewerSave();
        });
        el.querySelector('img').addEventListener('click', (ev) => {
            ev.stopPropagation();
            const img = ev.currentTarget;
            img.classList.toggle('hj-own-actual');
        });
        el.querySelector('img').addEventListener('load', () => hjOwnViewerCountText());
        el.querySelector('.hj-own-prev').addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation(); hjOwnViewerStep(-1);
        });
        el.querySelector('.hj-own-next').addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation(); hjOwnViewerStep(1);
        });
        el.addEventListener('click', (ev) => {
            if (ev.target === el) hjOwnViewerClose();
        });
        let tx = 0, ty = 0;
        el.addEventListener('touchstart', (ev) => {
            const t = ev.touches && ev.touches[0];
            if (!t) return;
            tx = t.clientX; ty = t.clientY;
        }, { passive: true });
        el.addEventListener('touchend', (ev) => {
            const t = (ev.changedTouches && ev.changedTouches[0]);
            if (!t) return;
            const dx = t.clientX - tx, dy = t.clientY - ty;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) hjOwnViewerStep(dx < 0 ? 1 : -1);
        }, { passive: true });
        return el;
    }
    function hjOwnViewerCountText() {
        const el = hjOwnViewerEl;
        if (!el) return;
        const nth = el.querySelector('.hj-own-count');
        if (!nth) return;
        const total = hjOwnViewerList.length;
        const img = el.querySelector('img');
        let size = '';
        if (img && img.naturalWidth) size = ' · ' + img.naturalWidth + '×' + img.naturalHeight;
        nth.textContent = (total > 1 ? ((hjOwnViewerAt + 1) + ' / ' + total) : (total === 1 ? '1 / 1' : '')) + size;
    }
    function hjOwnViewerSave() {
        const node = hjOwnViewerList[hjOwnViewerAt];
        const el = hjOwnViewerEl;
        if (!node || !el) return;
        const img = el.querySelector('img');
        const src = String((img && img.getAttribute('src')) || '');
        if (!src) return;
        let ext = 'jpg';
        const m = /^data:image\/([a-z0-9.+-]+)/i.exec(src);
        if (m) ext = m[1].toLowerCase().replace('jpeg', 'jpg');
        try {
            const a = document.createElement('a');
            a.href = src;
            a.download = 'hj-post-image-' + (hjCurrentPostId() || 'x') + '-' + (hjOwnViewerAt + 1) + '.' + ext;
            document.body.appendChild(a);
            a.click();
            a.remove();
            showToast('已保存当前图片');
        } catch (e) {
            console.warn('[海角脚本] 保存当前图片失败：', e);
            showToast('保存失败：' + (e && e.message ? e.message : e));
        }
    }
    function hjOwnViewerRender() {
        const el = hjOwnViewerEl;
        if (!el) return;
        const img = el.querySelector('img');
        const node = hjOwnViewerList[hjOwnViewerAt];
        if (!node || !img) return;
        img.classList.remove('hj-own-actual');
        img.setAttribute('src', String(node.getAttribute('src') || ''));
        hjOwnViewerCountText();        const many = hjOwnViewerList.length > 1;
        el.querySelector('.hj-own-prev').style.display = many ? '' : 'none';
        el.querySelector('.hj-own-next').style.display = many ? '' : 'none';
        let fullUrl = hjResolveImageUrl(node);
        const seq = hjOwnViewerSeq;
        if (!fullUrl && hjEnsureAttachMap) {
            hjEnsureAttachMap().then(ok => {
                if (!ok || seq !== hjOwnViewerSeq) return;
                const late = hjResolveImageUrl(node);
                if (!late) return;
                if (hjOwnViewerList[hjOwnViewerAt] !== node) return;
                hjOwnViewerUpgradeOne(node, img, late, seq);
            }).catch(() => { });
            return;
        }
        if (!fullUrl || !hjFetchImageText) return;
        hjOwnViewerUpgradeOne(node, img, fullUrl, seq);
    }
    function hjOwnViewerUpgradeOne(node, img, fullUrl, seq) {
        if (!fullUrl || !hjFetchImageText) return;
        Promise.resolve().then(async () => {
            try {
                let made = hjFullImageCache.get(fullUrl);
                if (!made) {
                    const text = await hjFetchImageText(fullUrl);
                    const bytes = text ? hjSiteImageTextToBytes(text) : null;
                    if (!bytes) return;
                    made = hjBytesToViewerSrc(bytes);
                    if (!made || !made.src) return;
                    hjFullImageCache.set(fullUrl, made);
                }
                if (seq !== hjOwnViewerSeq) return;
                const cur = hjOwnViewerList[hjOwnViewerAt];
                if (cur !== node || !img.isConnected) return;
                if (String(img.getAttribute('src') || '') !== made.src) img.setAttribute('src', made.src);
            } catch (e) { }
        });
    }
    function hjOwnViewerClose() {
        hjOwnViewerSeq++;
        if (hjOwnViewerTimer !== null) { clearTimeout(hjOwnViewerTimer); hjOwnViewerTimer = null; }
        if (hjViewerPollTimer !== null) { clearInterval(hjViewerPollTimer); hjViewerPollTimer = null; }
        hjOwnViewerUnwatchSite();
        hjOwnViewerForceCloseSite();
        setTimeout(() => {
            try {
                const v = hjOwnViewerVerifySiteClosed();
                if (v.stillOpen) {
                    hjOwnViewerSiteLockLeft += v.stillOpen;
                    console.warn('[海角脚本] 站点查看器没能关闭（' + v.stillOpen + ' 个节点仍可见）——'
                        + '它可能仍拦着手势滚动；已把它重新隐藏，若页面滑不动请刷新一次并反馈');
                }
            } catch (e) { }
        }, 80);
        if (hjOwnViewerEl) hjOwnViewerEl.classList.remove('hj-own-open');
        hjOwnViewerList = [];
        hjOwnViewerAt = 0;
        hjOwnViewerPendingImg = null;
        hjLastImageClickUrl = '';
        hjViewerAppliedUrl = '';
        hjViewerAppliedSrc = '';
    }
    function hjOwnViewerStep(delta) {
        if (!hjOwnViewerEl || !hjOwnViewerEl.classList.contains('hj-own-open')) return;
        if (hjOwnViewerList.length < 2) return;
        hjOwnViewerAt = (hjOwnViewerAt + delta + hjOwnViewerList.length) % hjOwnViewerList.length;
        hjOwnViewerRender();
    }
    function hjOwnViewerOpenAt(list, at) {
        const el = hjOwnViewerEnsure();
        if (!el || !list.length) return false;
        hjOwnViewerSeq++;
        hjOwnViewerList = list;
        hjOwnViewerAt = Math.max(0, Math.min(at, list.length - 1));
        el.classList.add('hj-own-open');
        hjOwnViewerShown++;
        if (hjOwnViewerPriority) { hjOwnViewerSilenceSite(); hjOwnViewerWatchSite(); }
        hjOwnViewerRender();
        try { silenceSiteDialogs(); hjClosePassiveLoginWindow(); } catch (e) { }
        return true;
    }
    const hjOwnViewerDiag = { calls: 0, lastReason: '', lastAt: 0, lastNode: '', inBox: null, listSize: 0, at: -1 };
    function hjOwnViewerFallback(node) {
        const miss = (why) => {
            hjOwnViewerDiag.calls++;
            hjOwnViewerDiag.lastReason = why;
            hjOwnViewerDiag.lastAt = Date.now();
            return false;
        };
        if (!hjOwnViewerEnabled) return miss('功能已关闭');
        if (!/\/post\/details/.test(String(location.pathname || ''))) return miss('非帖子页');
        if (hjImageViewerOpen()) {
            if (!hjOwnViewerPriority) return miss('站点查看器已开（让路）');
            hjOwnViewerSilenceSite();
        }
        if (hjOwnViewerEl && hjOwnViewerEl.classList.contains('hj-own-open')) return miss('本脚本查看器已开');
        let img = null;
        try { img = (node && node.tagName === 'IMG') ? node : (node && node.closest ? node.closest('img') : null); } catch (e) { }
        hjOwnViewerDiag.lastNode = (node && node.tagName ? node.tagName.toLowerCase() + '.' + String(node.className || '').slice(0, 30) : 'null');
        if (!img) {
            try {
                const pool = hjOwnViewerCollect().filter((x) => {
                    const r = x.getBoundingClientRect();
                    return r.width >= 80 && r.height >= 80 && r.bottom > 0 && r.top < (window.innerHeight || 900);
                });
                pool.sort((a, b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height)
                    - (a.getBoundingClientRect().width * a.getBoundingClientRect().height));
                img = pool[0] || null;
                if (img) hjOwnViewerDiag.lastReason = '目标非图，回退到视口最大正文图';
            } catch (e) { }
        }
        if (!img) return miss('目标不是图，且找不到可见正文图（target=' + hjOwnViewerDiag.lastNode + '）');
        let inBox = false;
        try { inBox = hjOwnViewerIsBodyImage(img); } catch (e) { }
        hjOwnViewerDiag.inBox = inBox;
        if (!inBox) return miss('不是正文附件图（头像/表情/列表封面等不进查看器）');
        const list = hjOwnViewerCollect();
        const at = list.indexOf(img);
        hjOwnViewerDiag.listSize = list.length;
        hjOwnViewerDiag.at = at;
        if (at < 0) return miss('图不在收集列表里（列表 ' + list.length + ' 张）');
        hjOwnViewerDiag.calls++;
        hjOwnViewerDiag.lastReason = '接管';
        hjOwnViewerDiag.lastAt = Date.now();
        hjOwnViewerOpenAt(list, at);
        return true;
    }
    try {
        unsafeWindow.__hjSetOwnViewer = (on) => {
            hjOwnViewerEnabled = on !== false;
            if (!hjOwnViewerEnabled) hjOwnViewerClose();
            console.info('[海角脚本] 脚本自带查看器：' + (hjOwnViewerEnabled ? '已开启（点正文图由脚本接管）' : '已关闭'));
            return unsafeWindow.__hjImagePolicy ? unsafeWindow.__hjImagePolicy() : null;
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjSetOwnViewerPriority = (on) => {
            hjOwnViewerPriority = on !== false;
            if (!hjOwnViewerPriority) { hjOwnViewerUnwatchSite(); hjOwnViewerRestoreSite(); }
            console.info('[海角脚本] 查看大图策略：' + (hjOwnViewerPriority ? '脚本优先（收掉站点查看器）' : '站点优先（脚本让路）'));
            return unsafeWindow.__hjImagePolicy ? unsafeWindow.__hjImagePolicy() : null;
        };
    } catch (e) { }
    try {
        document.addEventListener('keydown', (ev) => {
            const open = hjOwnViewerEl && hjOwnViewerEl.classList.contains('hj-own-open');
            if (!open) return;
            if (ev.key === 'Escape') hjOwnViewerClose();
            else if (ev.key === 'ArrowLeft') hjOwnViewerStep(-1);
            else if (ev.key === 'ArrowRight') hjOwnViewerStep(1);
        }, true);
    } catch (e) { }
    try {
        document.addEventListener('click', (e) => {
            const n = e.target;
            if (!n || typeof n.closest !== 'function') return;
            if (n.closest('#hj-own-viewer')) return;
            const clickedImg = n.tagName === 'IMG' ? n : n.closest('img');
            if (!clickedImg || !clickedImg.isConnected || !hjOwnViewerIsBodyImage(clickedImg)) return;
            const clickGeneration = hjAttachMapGeneration;
            const clickSequence = hjOwnViewerSeq;
            if (!hjUpgradeFullImage && !hjOwnViewerEnabled) return;
            if (hjOwnViewerPriority && /\/post\/details/.test(String(location.pathname || ''))) {
                try {
                    e.stopPropagation();
                    hjOwnViewerSiteOpenBlocked++;
                } catch (err) { }
            }
            const direct = hjResolveImageUrl(n);
            if (direct) hjLastImageClickUrl = direct;
            if (hjViewerPollTimer !== null) { clearInterval(hjViewerPollTimer); hjViewerPollTimer = null; }
            let tries = 0;
            hjViewerPollTimer = setInterval(() => {
                if (++tries > 40 || !hjUpgradeFullImage) { clearInterval(hjViewerPollTimer); hjViewerPollTimer = null; return; }
                if (!hjLastImageClickUrl) return;
                if (!hjImageViewerOpen()) return;
                clearInterval(hjViewerPollTimer); hjViewerPollTimer = null;
                hjUpgradeViewerImage();
            }, 100);
            if (!direct) {
                hjEnsureAttachMap().then(ok => {
                    if (!ok || clickGeneration !== hjAttachMapGeneration || clickSequence !== hjOwnViewerSeq) return;
                    const u = hjResolveImageUrl(clickedImg);
                    if (u) hjLastImageClickUrl = u;
                }).catch(() => { });
            }
            try {
                if (!e.isTrusted) {                               }
                const t = e.target;
                const im = (t && t.tagName === 'IMG') ? t : (t && t.closest ? t.closest('img') : null);
                const aim = im || hjOwnViewerPendingImg || t;
                if (im) hjOwnViewerPendingImg = im;
                if (hjOwnViewerTimer !== null) clearTimeout(hjOwnViewerTimer);
                hjOwnViewerTimer = setTimeout(() => {
                    hjOwnViewerTimer = null;
                    if (!hjOwnViewerPriority && hjImageViewerOpen()) return;
                    hjOwnViewerFallback(aim);
                }, hjOwnViewerPriority ? 0 : HJ_OWN_VIEWER_DELAY);
            } catch (e) { }
        }, true);
    } catch (e) { }
    function toPostImageFullUrl(url) {
        if (!blockHeavyPostImages || !allowPostImageThumbnails) return '';
        if (Date.now() >= hjAllowFullImageUntil) return '';
        if (!hjImageViewerOpen()) return '';
        if (!url) return '';
        const raw = String(url);
        try {
            const abs = new URL(raw, location.href);
            const path = abs.pathname;
            if (path.indexOf('/hjstore/images/') === -1) return '';
            const m = path.match(/^(.*?)_mini(\.(?:gif|jpe?g|png|webp|bmp))\.txt$/i);
            if (!m) return '';
            abs.pathname = m[1] + m[2] + '.txt';
            return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
                ? abs.href
                : (abs.pathname + abs.search + abs.hash);
        } catch (e) {
            const m = raw.match(/^((?:[a-z][a-z0-9+.-]*:\/\/[^/?#]*)?\/hjstore\/images\/[^?#]*?)_mini(\.(?:gif|jpe?g|png|webp|bmp))\.txt((?:[?#].*)?)$/i);
            if (!m) return '';
            return m[1] + m[2] + '.txt' + (m[3] || '');
        }
    }
    function rewritePostImageUrl(url) {
        if (!blockHeavyPostImages || !allowPostImageThumbnails) return '';
        if (Date.now() < hjAllowFullImageUntil) {
            return toPostImageFullUrl(url);
        }
        return toPostImageMiniUrl(url);
    }
    function toPostImageMiniUrl(url) {
        if (!blockHeavyPostImages || !allowPostImageThumbnails) return '';
        if (!hjRewritePostImageToMini) return '';
        if (Date.now() < hjAllowFullImageUntil) return '';
        if (!url) return '';
        const raw = String(url);
        try {
            const abs = new URL(raw, location.href);
            const path = abs.pathname;
            if (path.indexOf('/hjstore/images/') === -1) return '';
            const m = path.match(/^(.*?)(\.(?:gif|jpe?g|png|webp|bmp))\.txt$/i);
            if (!m) return '';
            if (/^\.gif$/i.test(m[2])) return '';
            if (/_mini$/i.test(m[1])) return '';
            abs.pathname = m[1] + '_mini' + m[2] + '.txt';
            return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
                ? abs.href
                : (abs.pathname + abs.search + abs.hash);
        } catch (e) {
            const m = raw.match(/^((?:[a-z][a-z0-9+.-]*:\/\/[^/?#]*)?\/hjstore\/images\/[^?#]*?)(\.(?:gif|jpe?g|png|webp|bmp))\.txt((?:[?#].*)?)$/i);
            if (!m) return '';
            if (/^\.gif$/i.test(m[2])) return '';
            if (/_mini$/i.test(m[1])) return '';
            return m[1] + '_mini' + m[2] + '.txt' + (m[3] || '');
        }
    }
    function shouldBlockHeavyImageRequest(url) {
        if (!blockHeavyPostImages || !url) return false;
        let path = '';
        let raw = '';
        try {
            path = new URL(url, location.href).pathname.toLowerCase();
        } catch (e) {
            raw = String(url).toLowerCase();
            path = raw;
        }
        const isTarget = path.includes('/hjstore/images/')
            && /\.(?:gif|jpe?g|png|webp|bmp)\.txt(?:[?#]|$)/.test(path);
        if (!isTarget) return false;
        if (allowPostImageThumbnails && Date.now() < hjAllowFullImageUntil) return false;
        if (/_mini\.(?:gif|jpe?g|png|webp|bmp)\.txt(?:[?#]|$)/.test(path)) {
            return !allowPostImageThumbnails;
        }
        if (/\.gif\.txt(?:[?#]|$)/.test(path)) {
            if (!allowPostImageThumbnails) return true;
            return false;
        }
        return hjRewritePostImageToMini;
    }
    function makeBlockedFetchResponse() {
        const ResponseCtor = unsafeWindow.Response || window.Response;
        return new ResponseCtor(null, {
            status: 204,
            statusText: 'No Content',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
    }
    function makeBlockedXhrResponse(xhr) {
        const def = (key, value) => {
            try { Object.defineProperty(xhr, key, { configurable: true, value }); } catch (e) { }
        };
        let type = '';
        try { type = xhr.responseType || ''; } catch (e) { }
        def('readyState', 4);
        def('status', 204);
        def('statusText', 'No Content');
        def('responseURL', '');
        if (type === '' || type === 'text') {
            def('responseText', '');
            def('response', '');
        } else {
            def('response', null);
        }
        try { xhr.getAllResponseHeaders = () => ''; } catch (e) { }
        try { xhr.getResponseHeader = () => null; } catch (e) { }
        try { xhr.dispatchEvent(new Event('readystatechange')); } catch (e) { }
        try { xhr.dispatchEvent(new Event('load')); } catch (e) { }
        try { xhr.dispatchEvent(new Event('loadend')); } catch (e) { }
    }
    let hjBlockAdBanners = true;
    let hjAdBlockedCount = 0;                        
    let hjAdApiBlockedCount = 0;                          
    const HJ_AD_EMPTY_DATA = (() => {
        let s = '[]';
        for (let i = 0; i < 3; i++) s = hjB64EncodeWith(HJ_B64_STD, s);
        return s;
    })();
    const HJ_AD_EMPTY_BODY = '{"isEncrypted":true,"errorCode":0,"message":"","success":true,"data":"'
        + HJ_AD_EMPTY_DATA + '"}';
    const HJ_AD_STUB_BODY = hjB64EncodeWith(
        HJ_SITE_ALPHABET,
        'data:image/jpeg;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    );
    function isAdBannerApiUrl(url) {
        return /\/api\/banner\/banner_list(?:[?#]|$)/i.test(String(url || ''));
    }
    function isAdBannerRequestUrl(url) {
        return /\/hjstore\/system\/banner\/[^/?#]+\.(?:gif|jpe?g|png|webp|bmp)\.txt(?:[?#]|$)/i.test(String(url || ''));
    }
    function hjAdStubFor(url) {
        if (!hjBlockAdBanners || !url) return null;
        if (isAdBannerApiUrl(url)) {
            hjAdApiBlockedCount++;
            return { body: HJ_AD_EMPTY_BODY, contentType: 'application/json;charset=utf-8' };
        }
        if (isAdBannerRequestUrl(url)) {
            hjAdBlockedCount++;
            return { body: HJ_AD_STUB_BODY, contentType: 'text/plain;charset=utf-8' };
        }
        return null;
    }
    function hjStubXhrResponse(xhr, body, contentType) {
        const def = (key, value) => {
            try { Object.defineProperty(xhr, key, { configurable: true, value }); } catch (e) { }
        };
        const ct = contentType || 'text/plain;charset=utf-8';
        let type = '';
        try { type = xhr.responseType || ''; } catch (e) { }
        def('readyState', 4);
        def('status', 200);
        def('statusText', 'OK');
        def('responseURL', '');
        if (type === '' || type === 'text') {
            def('responseText', body);
            def('response', body);
        } else {
            def('response', null);
        }
        try { xhr.getAllResponseHeaders = () => 'content-type: ' + ct + '\r\n'; } catch (e) { }
        try { xhr.getResponseHeader = (h) => (/^content-type$/i.test(String(h)) ? ct : null); } catch (e) { }
        def('responseXML', null);
        try { xhr.dispatchEvent(new Event('readystatechange')); } catch (e) { }
        try { xhr.dispatchEvent(new Event('load')); } catch (e) { }
        try { xhr.dispatchEvent(new Event('loadend')); } catch (e) { }
    }
    function hjStubFetchResponse(body, contentType) {
        const ResponseCtor = unsafeWindow.Response || window.Response;
        return new ResponseCtor(body, {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': contentType || 'text/plain;charset=utf-8' }
        });
    }
    let hjBlockAvatars = true;
    let hjAvatarBlocked = 0;
    const HJ_AVATAR_STUB = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">'
        + '<rect width="96" height="96" fill="#e9ebee"/>'
        + '<circle cx="48" cy="37" r="16" fill="#b9bec6"/>'
        + '<path d="M48 59c-17 0-30 10-33 25h66c-3-15-16-25-33-25z" fill="#b9bec6"/>'
        + '</svg>'
    );
    function isAvatarAssetUrl(url) {
        if (typeof url !== 'string' || url.length < 8) return false;
        if (url.charCodeAt(0) === 100) return false;
        return /\/images\/common\/avatar\/\d+\.jpg(?:[?#]|$)/i.test(url)
            || /\/imgs\/headicon\/[^/?#]+\.(?:jpe?g|png|webp|gif)(?:[?#]|$)/i.test(url)
            || /\/hjstore\/avatar\/[A-Za-z0-9_/-]+\.txt(?:[?#]|$)/i.test(url);
    }
    function isAvatarSlot(el) {
        try {
            if (el && el.classList && el.classList.contains('portrait')) return true;
            return !!(el && el.closest && el.closest('.portraitcontainer'));
        } catch (e) { return false; }
    }
    function hjAvatarStubFor(el, value) {
        if (!hjBlockAvatars || typeof value !== 'string') return '';
        if (isAvatarAssetUrl(value)) return HJ_AVATAR_STUB;
        if (value.charCodeAt(0) === 100 && /^data:image\//i.test(value) && isAvatarSlot(el)) {
            return HJ_AVATAR_STUB;
        }
        return '';
    }
    try {
        const hjOrigSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function (name, value) {
            if (hjBlockAvatars && name === 'src' && typeof value === 'string') {
                const stub = hjAvatarStubFor(this, value);
                if (stub) { hjAvatarBlocked++; return hjOrigSetAttribute.call(this, name, stub); }
            }
            return hjOrigSetAttribute.apply(this, arguments);
        };
    } catch (e) { }
    try {
        const hjImgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        if (hjImgSrcDesc && hjImgSrcDesc.get && hjImgSrcDesc.set) {
            Object.defineProperty(HTMLImageElement.prototype, 'src', {
                configurable: true,
                enumerable: hjImgSrcDesc.enumerable,
                get: hjImgSrcDesc.get,
                set: function (value) {
                    if (hjBlockAvatars && typeof value === 'string') {
                        const stub = hjAvatarStubFor(this, value);
                        if (stub) { hjAvatarBlocked++; return hjImgSrcDesc.set.call(this, stub); }
                    }
                    return hjImgSrcDesc.set.call(this, value);
                }
            });
        }
    } catch (e) { }
    function isAvatarChainUrl(url) {
        return /\/hjstore\/avatar\/[A-Za-z0-9_/-]+\.txt(?:[?#]|$)/i.test(String(url || ''));
    }
    function hjLocalStubFor(url) {
        const ad = hjAdStubFor(url);
        if (ad) return ad;
        if (hjBlockAvatars && isAvatarChainUrl(url)) {
            hjAvatarBlocked++;
            return { body: HJ_AD_STUB_BODY, contentType: 'text/plain;charset=utf-8' };
        }
        return null;
    }
    async function handleApiResponse(text, url) {
        try {
            if (url.includes("/api/address/")) {
                if (/#EXTM3U/i.test(String(text || ''))) {
                    handleM3u8TextCapture(text, url, true);
                } else {
                    const videoSrc = getRealVideoSrc(text, url);
                    if (videoSrc) updateState(videoSrc);
                }
            }
            else if (url.includes('/api/topic/node/topics')) {
                const nodeMatch = String(url).match(/[?&]nodeId=(\d+)/);
                if (nodeMatch) {
                    const data = decodeEncryptString(text);
                    const rows = hjExtractRows(data);
                    if (rows) hjRecordListRows(nodeMatch[1], rows);
                }
            }
            else if (url.includes('/api/topic/search')) {
                const data = decodeEncryptString(text);
                const rows = hjExtractRows(data);
                if (rows) {
                    hjRecordListRows(/searchV2/.test(String(url)) ? HJ_LIST_ROW_ES : HJ_LIST_ROW_SEARCH,
                        rows, { dup: true });
                }
            }
            else if (/\/api\/topic\/\d+/.test(url)) {
                const data = decodeEncryptString(text);
                updateCapturedTitleFromData(data);
                hjRecordAttachments(data);
                if (data?.attachments) {
                    const topicId = (String(url).match(/\/api\/topic\/(\d+)/) || [])[1] || data.id;
                    for (const element of data.attachments) {
                        if (element.category !== "video") continue;
                        if (element.remoteUrl) {
                            fetch(element.remoteUrl, { credentials: 'same-origin', cache: 'no-store' })
                                .then(res => res.text())
                                .then(content => {
                                    handleM3u8TextCapture(content, element.remoteUrl, true);
                                }).catch(() => {});
                        } else if (element.id && topicId) {
                            hjHandleLockedVideoAttachment(element, topicId);
                        }
                    }
                }
            }
        } catch (e) { }
    }
    const originalXHR = unsafeWindow.XMLHttpRequest;
    unsafeWindow.XMLHttpRequest = new Proxy(originalXHR, {
      construct(target, args, newTarget) {
        const xhr = Reflect.construct(target, args, newTarget);
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        let requestUrl = '';
        xhr.open = function(method, url) {
            requestUrl = url || '';
            const rewritten = rewritePostImageUrl(requestUrl);
            if (rewritten) {
                hjImageRewriteCount++;
                requestUrl = rewritten;
                const args = Array.prototype.slice.call(arguments);
                args[1] = rewritten;
                return originalOpen.apply(this, args);
            }
            return originalOpen.apply(this, arguments);
        };
        xhr.send = function() {
            const adStub = hjLocalStubFor(requestUrl);
            if (adStub) {
                hjStubXhrResponse(xhr, adStub.body, adStub.contentType);
                return;
            }
            if (shouldBlockHeavyImageRequest(requestUrl)) {
                hjBlockedImageCount++;
                makeBlockedXhrResponse(xhr);
                return;
            }
            if (hjAllowActions() && (requestUrl.includes("/api/address/") || requestUrl.includes("/api/topic/"))) {
                xhr.addEventListener('load', function() {
                    setTimeout(() => handleApiResponse(xhr.responseText, requestUrl), 0);
                });
            }
            if (hjGifDedupGate(xhr, requestUrl)) {
                return;
            }
            return originalSend.apply(this, arguments);
        };
        return xhr;
      }
    });
    const originalFetch = unsafeWindow.fetch;
    hjNativeFetch = originalFetch;
    unsafeWindow.fetch = function(input, init) {
        const fetchArgs = Array.prototype.slice.call(arguments);
        let url = getHookRequestUrl(input);
        const rewritten = rewritePostImageUrl(url);
        if (rewritten) {
            if (typeof input === 'string' || input instanceof URL ||
                (unsafeWindow.URL && input instanceof unsafeWindow.URL)) {
                input = rewritten;
            } else if (typeof input === 'object' && input !== null) {
                try {
                    const RequestCtor = unsafeWindow.Request || Request;
                    input = new RequestCtor(rewritten, input);
                } catch (e) {
                    console.warn('[海角脚本] 图片改写跳过（无法重建 Request）', e);
                }
            }
            if (getHookRequestUrl(input) === rewritten) {
                hjImageRewriteCount++;
                url = rewritten;
                fetchArgs[0] = input;
            }
        }
        if (shouldBlockNoisyRequestUrl(url)) {
            return Promise.resolve(makeBlockedFetchResponse());
        }
        const adStub = hjLocalStubFor(url);
        if (adStub) {
            return Promise.resolve(hjStubFetchResponse(adStub.body, adStub.contentType));
        }
        if (shouldBlockHeavyImageRequest(url)) {
            hjBlockedImageCount++;
            return Promise.resolve(makeBlockedFetchResponse());
        }
        return originalFetch.apply(this, fetchArgs).then(response => {
            if (hjAllowActions() && (url.includes("/api/address/") || url.includes("/api/topic/") || /\.m3u8(?:[?#]|$)/i.test(url))) {
                const cloned = response.clone();
                cloned.text().then(text => {
                    if (/\.m3u8(?:[?#]|$)/i.test(url) || /#EXTM3U/i.test(text)) {
                        handleM3u8TextCapture(text, url, false);
                    }
                    if (url.includes("/api/address/") || url.includes("/api/topic/")) {
                        handleApiResponse(text, url);
                    }
                }).catch(() => {});
            }
            return response;
        });
    };
    try {
        const nav = unsafeWindow.navigator;
        const originalSendBeacon = nav?.sendBeacon;
        if (typeof originalSendBeacon === 'function') {
            nav.sendBeacon = function(url, data) {
                if (shouldBlockNoisyRequestUrl(url)) return true;
                return originalSendBeacon.apply(this, arguments);
            };
        }
    } catch (e) { }
    try { unsafeWindow.__hjImgBlocked = () => hjBlockedImageCount; } catch (e) { }
    try {
        unsafeWindow.__hjDialogPolicy = () => {
            const dialogs = [...document.querySelectorAll('.van-dialog, .el-dialog, .el-message-box__wrapper')];
            const visible = (d) => {
                if (!d.isConnected) return false;
                const cs = getComputedStyle(d);
                return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0;
            };
            let isLogin = null;
            try {
                const root = document.querySelector('#app') || document.body;
                const vm = root && root.__vue__;
                isLogin = (vm && vm.$store) ? vm.$store.state.isLogin : null;
            } catch (e) { }
            const gate = dialogs.find(d => hjIsSiteLoginGate(d));
            return {
                站点登录态: isLogin === null ? '读不到（非站点页面）' : (isLogin ? '已登录（登录门禁不会弹）' : '未登录（点用户名/点赞/收藏会弹登录提示）'),
                登录门禁: !gate ? '当前不存在'
                    : (visible(gate) ? '可见 ✓（用户可以点「登录」）'
                        : '当前不可见（Vant 弹窗是单例，关掉后 DOM 节点会留在原地 display:none —— 这本身正常）'),
                弹窗清单: dialogs.map(d => ({
                    类名: String(d.className || '').slice(0, 60),
                    可见: visible(d),
                    文案: getNodeText(d).replace(/\s+/g, ' ').trim().slice(0, 40)
                })),
                说明: '脚本不再移除站点的登录提示；判据只认文案，不认 newconfirm 类名。'
                    + '7.13.29 起任何登录门禁提示都自动点「取消」收掉（用户要求：页面上已有登录入口），'
                    + '收掉时会给一句 toast 说明，避免变成"点了没反应"。',
                自动收掉的登录提示次数: hjAutoSilencedLoginDialogs,
                最近一次用户点击: hjLastUserGestureAt
                    ? Math.round((Date.now() - hjLastUserGestureAt) / 1000) + ' 秒前'
                        + (hjLastClickLabel ? '（「' + hjLastClickLabel + '」）' : '')
                    : '(还没点过)'
            };
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjImagePolicy = () => ({
            rewritten: hjImageRewriteCount,
            blocked: hjBlockedImageCount,
            adBlocked: hjAdBlockedCount,
            adApiBlocked: hjAdApiBlockedCount,
            policy: !blockHeavyPostImages ? 'full（放行原图）'
                : (allowPostImageThumbnails ? 'mini（旧开关组合；实际改写见 rewriteMini）' : 'block（掐断，正文无图）'),
            rewriteMini: hjRewritePostImageToMini
                ? ('开（' + (hjSlowNetworkAtBoot ? '慢网络自动开启' : '手动开启') + '，省流量，点开看大图会卡一下）')
                : '关（默认，完整图，查看大图零延迟）',
            profileListForced: hjProfileListForced,
            ownViewer: (hjOwnViewerEnabled ? '开' : '关')
                + ' / 策略 ' + (hjOwnViewerPriority ? '脚本优先' : '站点优先（让路）')
                + ' / 已接管 ' + hjOwnViewerShown + ' 次'
                + ' / 收掉站点查看器 ' + hjOwnViewerSiteSquelched + ' 次'
                + ' / 拦下站点打开 ' + hjOwnViewerSiteOpenBlocked + ' 次'
                + ' / 真关闭站点 ' + hjOwnViewerSiteForceClosed + ' 次'
                + ' / 站点仍开着 ' + hjOwnViewerSiteLockLeft + ' 次'
                + ' / 判定 ' + hjOwnViewerDiag.calls + ' 次' + (hjOwnViewerDiag.lastReason ? ('（' + hjOwnViewerDiag.lastReason + '）') : '')
                + ' / 升级开关 ' + (hjUpgradeFullImage ? '开' : '关'),
            coinImages: (hjCoinImageUnlock ? '开' : '关')
                + ' / 铺位 ' + hjCoinSlotsBuilt
                + ' / 已取回 ' + hjCoinFilled
                + ' / 待重试 ' + hjCoinFailCount.size
                + ' / 放弃 ' + hjCoinFailed
                + ' / 已解码 ' + (hjCoinBytes / 1048576).toFixed(1) + 'MB'
                + ' / 巡逻 ' + hjCoinPasses + ' 趟',
            gif: '去重命中 ' + hjGifDedupHits + ' / 共享 ' + hjGifDedupShared
                + ' / 走网络 ' + hjGifDedupMiss
                + ' / 超名额1×1 ' + hjGifQuotaStub
                + '（已占名额 ' + hjGifQuotaUrls.size + '/' + hjGifQuota
                + '，保留 ' + hjGifDedup.size + ' 条，' + (hjGifDedupOn ? '开' : '关') + '）',
            gifAsync: (hjGifAsyncFill ? '开' : '关（已回退旧机制）')
                + ' 并发' + hjGifAsyncConcurrency
                + ' / 顶1×1 ' + hjGifAsyncStubbed
                + ' / 已成图 ' + hjGifAsyncDone
                + ' / 失败 ' + hjGifAsyncFail
                + ' / 未找到元素 ' + hjGifAsyncNoElem
                + ' / 未接管(无锚点) ' + hjGifAsyncNoAnchor
                + ' / Worker ' + Math.round(hjGifAsyncWorkerMs) + 'ms'
                + ' / 主线程 ' + Math.round(hjGifAsyncMainMs) + 'ms'
                + ' / 已补 ' + (hjGifAsyncBytes / 1048576).toFixed(1) + 'MB'
                + ' / 队列 ' + hjGifAsyncQueue.length + ' 在飞 ' + hjGifAsyncInfly.size,
            fullImageView: Date.now() < hjAllowFullImageUntil ? '窗口开着' : '否',
            ads: hjBlockAdBanners ? '静默顶掉（不请求）' : '放行（照常请求）',
            avatars: hjBlockAvatars ? '零请求（本地剪影占位）' : '放行（照常请求）',
            avatarBlocked: hjAvatarBlocked,
            fullImageViewUpgrade: hjUpgradeFullImage ? '开（点击后换成完整图）' : '关（保留缩略图）',
            viewerUpgraded: hjViewerUpgradeDone,
            viewerSrcKind: (() => {
                const v = hjFullImageCache.get(hjViewerAppliedUrl);
                return v ? (v.blob ? 'blob URL' : 'data URI') : '(尚未升级过)';
            })(),
            lastClickedImage: hjLastImageClickUrl ? hjLastImageClickUrl.slice(-52) : '(尚未点过图)',
            playerGuard: hjPlayerReattached + ' 次放回 / ' + hjPlayerRevisible + ' 次重新显示',
            coinSellHideSkipped: hjCoinSellHideSkipped
        });
    } catch (e) { }
    try {
        unsafeWindow.__hjViewerList = () => {
            const list = hjOwnViewerCollect();
            const htmlBoxOf = (img) => {
                for (const sel of HJ_VIEWER_BOX_SEL.split(',').map(s => s.trim()).filter(Boolean)) {
                    try { if (img.closest(sel)) return sel; } catch (e) { }
                }
                return '(不在正文容器)';
            };
            const why = (img) => {
                const dataId = String(img.getAttribute('data-id') || '');
                if (/^\d+$/.test(dataId)) return '数字 data-id=' + dataId;
                if (img.closest('[data-hj-coin-host]')) return '金币图槽位';
                const byUrl = img.closest('[data-img_url]');
                if (byUrl) return 'data-img_url';
                return '未知（不该出现，请反馈）';
            };
            return {
                总数: list.length,
                说明: '这是点正文图后查看器会翻的图。正常应只有正文附件图（含金币图），'
                    + '**不该**出现头像、表情包、页面底部帖子列表的封面。',
                清单: list.map((img, i) => ({
                    序号: i + 1,
                    dataId: String(img.getAttribute('data-id') || '(无)'),
                    src头: String(img.getAttribute('src') || '').slice(0, 30),
                    src形态: /^blob:/.test(String(img.getAttribute('src') || '')) ? 'blob(已升级为完整图)'
                        : (/^data:image\//.test(String(img.getAttribute('src') || '')) ? 'data-uri' : 'http'),
                    原始尺寸: img.naturalWidth + '×' + img.naturalHeight,
                    显示尺寸: Math.round(img.getBoundingClientRect().width) + '×' + Math.round(img.getBoundingClientRect().height),
                    判定依据: why(img),
                    所属容器: htmlBoxOf(img)
                }))
            };
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjSetGifDedup = (on) => {
            hjGifDedupOn = on !== false;
            if (!hjGifDedupOn) hjGifDedup.clear();
            console.info('[海角脚本] GIF 去重：' + (hjGifDedupOn ? '已开启' : '已关闭'));
            return unsafeWindow.__hjImagePolicy();
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjSetMaxGif = (n) => {
            const v = Math.max(0, Math.floor(Number(n)));
            if (!Number.isFinite(v)) return '用法：__hjSetMaxGif(0)（0 = 不加载动图，播放最快）';
            hjGifQuota = v;
            console.info('[海角脚本] GIF 名额已设为 ' + v + '；刷新页面后生效。'
                + '注意：异步补图（默认开）下本开关不参与判定 —— 站点侧一律只拿 1×1，'
                + '真图由 Worker 回填；要试旧机制请先 __hjSetGifAsyncFill(false)。');
            return unsafeWindow.__hjImagePolicy();
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjSetGifAsyncFill = (on) => {
            hjGifAsyncFill = on !== false;
            hjGifWorkerUnavailable = false;
            if (!hjGifAsyncFill) {
                hjResetGifWorkers();
                console.info('[海角脚本] GIF 异步补图已关闭 → 回退旧的去重 + 配额机制');
            } else {
                console.info('[海角脚本] GIF 异步补图已开启（站点侧只拿 1×1，真图走 Worker 回填）');
            }
            return unsafeWindow.__hjImagePolicy();
        };
        unsafeWindow.__hjSetGifAsyncConcurrency = (n) => {
            const v = Math.max(1, Math.min(4, Math.floor(Number(n)) || 3));
            hjGifAsyncConcurrency = v;
            setTimeout(hjGifPump, 0);
            console.info('[海角脚本] GIF 补图并发已设为 ' + v + '（对后续任务生效）');
            return unsafeWindow.__hjImagePolicy();
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjSetBlockAds = (on) => {
            hjBlockAdBanners = on !== false;
            console.info('[海角脚本] 广告位零请求：' + (hjBlockAdBanners ? '已开启' : '已关闭'));
            return unsafeWindow.__hjImagePolicy();
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjSetBlockAvatars = (on) => {
            hjBlockAvatars = on !== false;
            console.info('[海角脚本] 头像零请求：' + (hjBlockAvatars ? '已开启' : '已关闭'));
            return unsafeWindow.__hjImagePolicy();
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjSetFullImageView = (on) => {
            hjUpgradeFullImage = on !== false;
            console.info('[海角脚本] 查看大图升级：' + (hjUpgradeFullImage ? '已开启' : '已关闭'));
            return unsafeWindow.__hjImagePolicy();
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjSetCoinImageUnlock = (on) => {
            hjCoinImageUnlock = on !== false;
            if (!hjCoinImageUnlock && hjCoinObserver) { try { hjCoinObserver.disconnect(); } catch (e) { } }
            console.info('[海角脚本] 金币图解锁：' + (hjCoinImageUnlock ? '已开启（懒加载）' : '已关闭'));
            return unsafeWindow.__hjImagePolicy();
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjSetRewriteMini = (on) => {
            hjRewritePostImageToMini = on === true;
            console.info('[海角脚本] 正文图缩略化改写：' + (hjRewritePostImageToMini
                ? '已开启（省流量，点开看大图会卡一下）' : '已关闭（完整图，查看大图零延迟）'));
            return unsafeWindow.__hjImagePolicy();
        };
    } catch (e) { }
    try {
        unsafeWindow.__hjImageMode = (mode) => {
            const m = String(mode == null ? '' : mode).toLowerCase().trim();
            if (m === 'mini') { blockHeavyPostImages = true; allowPostImageThumbnails = true; }
            else if (m === 'full') { blockHeavyPostImages = false; allowPostImageThumbnails = true; }
            else if (m === 'block') { blockHeavyPostImages = true; allowPostImageThumbnails = false; }
            else return '未知模式：' + mode + '（可选 mini / full / block）';
            console.info('[海角脚本] 图片策略已切换：', unsafeWindow.__hjImagePolicy().policy);
            return unsafeWindow.__hjImagePolicy();
        };
    } catch (e) { }
    function refreshActionButtons() {
        hjSyncActionButtons();
    }
    function updateState(src) {
        if (!src) return;
        const preview = isPreviewM3u8Url(src);
        if (preview) {
            if (capturedM3u8Url && !isPreviewM3u8Url(capturedM3u8Url)) {
                console.info('[海角脚本] 忽略 preview M3U8 状态覆盖：', src);
                return;
            }
            hjPreviewFallbackUrl = src;
            const derived = deriveFullM3u8UrlFromPreview(src);
            if (derived && derived !== src) rememberDerivedFullM3u8Candidate(derived);
        }
        if (src === capturedM3u8Url) { refreshActionButtons(); return; }
        capturedM3u8Url = src;
        refreshActionButtons();
        showToast(preview
            ? '该视频为帖内「出售内容」：未购买时服务端只下发 30 秒预览，可播放/下载预览'
            : '已捕获完整 M3U8 索引，可播放或下载 TS');
    }
    function showToast(msg) {
        let toast = document.getElementById('hj-toast-mobile');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'hj-toast-mobile';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 3000);
    }
    function installHlsErrorProbe(HlsCtor) {
        try {
            if (!HlsCtor?.prototype || HlsCtor.prototype.__hjErrorProbe) return;
            const proto = HlsCtor.prototype;
            const originalTrigger = proto.trigger;
            if (typeof originalTrigger !== 'function') return;
            proto.trigger = function (type, data) {
                try {
                    if (type === 'hlsError') {
                        const detail = data?.details || data?.type || 'unknown';
                        const level = data?.fatal ? 'fatal' : 'nonfatal';
                        const line = `[海角脚本] HLS 事件 hlsError: ${data?.type}/${detail}/${level}`;
                        if (detail === 'fragParsingError') console.error(line + '（解密/解析失败，已按密钥路径排查）', data);
                        else if (detail === 'bufferStalledError' || detail === 'bufferSeekOverHole' || detail === 'bufferNudgeOnStall') {
                            console.debug(line);
                        }
                        else if (data?.fatal) console.error(line, data);
                        else console.warn(line);
                    }
                } catch (e) { }
                return originalTrigger.apply(this, arguments);
            };
            proto.__hjErrorProbe = true;
            console.info('[海角脚本] HLS 错误探针已安装（真实事件名 hlsError）');
        } catch (e) { }
    }
    function destroyActivePlayback() {
        activePlaybackSession = null;
        const cleanup = activePlaybackCleanup;
        activePlaybackCleanup = null;
        try { cleanup?.(); } catch (e) { }
        try { activePlaybackHls?.destroy?.(); } catch (e) { }
        activePlaybackHls = null;
        hjTeardownPlayerDom();
    }
    function hjTeardownPlayerDom() {
        const host = activePlaybackHost;
        try {
            if (host) {
                host.querySelectorAll('.hj-player-status, [id^="clean-core-player-"]').forEach(node => node.remove());
            }
        } catch (e) { }
        for (const [el, prop, value, priority] of activePlaybackStyleUndo || []) {
            try {
                if (value) el.style.setProperty(prop, value, priority);
                else el.style.removeProperty(prop);
            } catch (e) { }
        }
        activePlaybackStyleUndo = [];
        try {
            if (host && activePlaybackHostStyle !== null) host.style.cssText = activePlaybackHostStyle;
            if (host && activePlaybackHostCreatedByScript) host.remove();
        } catch (e) { }
        activePlaybackHost = null;
        activePlaybackHostStyle = null;
        activePlaybackHostCreatedByScript = false;
    }
    function hjCurrentRouteKey() {
        try {
            const u = new URL(location.href);
            const path = String(u.pathname || '');
            const pid = u.searchParams.get('pid') || u.searchParams.get('id') || '';
            return pid ? path + '|' + pid : path;
        } catch (e) {
            return String(location.href || '');
        }
    }
    function hjResetPagePlaybackState(reason) {
        destroyActivePlayback();
        if (typeof hjOwnViewerClose === 'function') hjOwnViewerClose();
        if (typeof hjAttachMapGeneration !== 'undefined') hjAttachMapGeneration++;
        if (typeof hjAttachUrlById !== 'undefined') hjAttachUrlById.clear();
        if (typeof hjAttachMapTopicId !== 'undefined') hjAttachMapTopicId = '';
        if (typeof hjAttachMapPromise !== 'undefined') hjAttachMapPromise = null;
        if (typeof hjCoinResetState === 'function') hjCoinResetState();
        capturedVideoTitle = '';
        bestM3u8Candidate = null;
        lastPlaybackSelectionNote = '';
        if (!isDownloading) {
            capturedM3u8Url = '';
            hjPreviewFallbackUrl = '';
            hjDerivedFullM3u8Url = '';
            hjDerivedVerifiedFullUrl = '';
            hjPassTopicFullUrl = '';
            hjSeenDomM3u8.clear();
        }
        hjDomFullDone.clear();
        hjDomFullHref = '';
        hjVcLastRoute = '';
        try { hjSyncActionButtons(); } catch (e) { }
    }
    function hjSetFloatIcon(el, kind, label) {
        if (!el) return;
        const icons = {
            play: `<svg class="hj-float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M9.6 5.9 18.6 12 9.6 18.1Z"/>
                    </svg>`,
            playing: `<svg class="hj-float-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <rect class="hj-eq-bar hj-eq-a" x="4.4" y="8.6" width="3" height="6.8" rx="1.5"/>
                        <rect class="hj-eq-bar hj-eq-b" x="10.5" y="5.4" width="3" height="13.2" rx="1.5"/>
                        <rect class="hj-eq-bar hj-eq-c" x="16.6" y="8.6" width="3" height="6.8" rx="1.5"/>
                    </svg>`,
            download: `<svg class="hj-float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M12 4.2v10.2"/>
                        <path d="m7.6 10.2 4.4 4.4 4.4-4.4"/>
                        <path d="M4.8 15.6v2.2a2.2 2.2 0 0 0 2.2 2.2h10a2.2 2.2 0 0 0 2.2-2.2v-2.2"/>
                    </svg>`,
            downloading: `<svg class="hj-float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                        <path class="hj-spin-arc" d="M20.8 12a8.8 8.8 0 1 1-2.6-6.2"/>
                        <rect x="9.4" y="9.4" width="5.2" height="5.2" rx="1.4" fill="currentColor" stroke="none"/>
                    </svg>`,
            done: `<svg class="hj-float-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20.6 12a8.6 8.6 0 1 1-2.6-6.1"/>
                        <path d="m8.4 11.9 2.5 2.6 5-5.6"/>
                    </svg>`,
            cancel: `<svg class="hj-float-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <rect x="7" y="7" width="10" height="10" rx="2.6"/>
                    </svg>`
        };
        const labels = { downloading: '取消下载' };
        const aria = { play: '播放', playing: '正在播放', download: '下载', downloading: '取消下载', done: '下载完成', cancel: '已取消' };
        const shape = icons[kind] || icons.play;
        const text = typeof label === 'string' ? label : (labels[kind] || '');
        try { el.setAttribute('data-hj-icon', icons[kind] ? kind : 'play'); } catch (e) { }
        try { el.setAttribute('data-hj-label', text); } catch (e) { }
        try { el.setAttribute('aria-label', text || aria[kind] || aria.play); } catch (e) { }
        try { el.textContent = text; } catch (e) { }
        try { el.innerHTML = shape + (text ? '<span class="hj-float-label">' + text + '</span>' : ''); } catch (e) { }
    }
    function hjSyncActionButtons() {
        const btn = document.getElementById(btnId);
        if (btn) {
            if (capturedM3u8Url && !isDownloading) {
                btn.classList.add('show');
                btn.classList.remove('played');
                hjSetFloatIcon(btn, 'play');
            } else {
                btn.classList.remove('show', 'played');
                hjSetFloatIcon(btn, 'play');
            }
        }
        const dlBtn = document.getElementById(dlBtnId);
        if (dlBtn) {
            if (isDownloading) {
                dlBtn.classList.add('show', 'busy');
                dlBtn.classList.remove('done');
                hjSetFloatIcon(dlBtn, 'downloading');
            } else if (capturedM3u8Url) {
                dlBtn.classList.add('show');
                dlBtn.classList.remove('busy', 'done');
                hjSetFloatIcon(dlBtn, 'download');
            } else {
                dlBtn.classList.remove('show', 'busy', 'done');
                hjSetFloatIcon(dlBtn, 'download');
            }
        }
        const dlPanel = document.getElementById(dlStatusId);
        if (dlPanel && !isDownloading) dlPanel.classList.remove('show');
        if (!hjIsPlayableRoute()) {
            if (btn) {
                btn.classList.remove('show', 'played');
                hjSetFloatIcon(btn, 'play');
            }
            if (dlBtn && !isDownloading) dlBtn.classList.remove('show');
        }
    }
    function hjIsPlayableRoute() {
        try {
            const path = String(location.pathname || '');
            return /^\/post(\/|$)/i.test(path) || /^\/video(\/|$)/i.test(path);
        } catch (e) { return false; }
    }
    let hjLastSearchKeyword = '';
    let hjSearchPrevPath = '';
    let hjSearchRestorePending = false;
    let hjSearchRestoreTries = 0;
    let hjSearchRestoreDeadline = 0;
    let hjSearchRestoreRunning = false;
    let hjSearchRestoreGen = 0;
    const HJ_SEARCH_RESTORE_MAX_TRIES = 6;
    const HJ_SEARCH_RESTORE_WINDOW_MS = 15000;
    const HJ_SEARCH_RESTORE_VERIFY_MS = 900;                             
    const HJ_SEARCH_POPULATED_MIN_CHARS = 600;                         
    function hjIsSearchRoute() {
        return /^\/search(?:\/|$)/.test(String(location.pathname || ''));
    }
    function hjSearchLooksPopulated() {
        try {
            const body = document.body;
            if (!body) return false;
            const text = String(body.innerText || '');
            return text.length > HJ_SEARCH_POPULATED_MIN_CHARS;
        } catch (e) { return false; }
    }
    function hjReadSearchInput() {
        try {
            return document.querySelector('input[placeholder="搜索"]')
                || document.querySelector('.van-search input')
                || null;
        } catch (e) { return null; }
    }
    function hjSearchRememberKeyword(kw) {
        const text = String(kw == null ? '' : kw).trim();
        if (!text) return false;
        if (!hjIsSearchRoute()) return false;
        hjLastSearchKeyword = text;
        return true;
    }
    function hjSearchCaptureKeyword() {
        if (!hjIsSearchRoute()) return false;
        const input = hjReadSearchInput();
        if (!input) return false;
        const text = String(input.value || '').trim();
        if (!text || text === hjLastSearchKeyword) return false;
        hjLastSearchKeyword = text;
        return true;
    }
    function hjSearchNoteRouteChange() {
        try {
            const path = String(location.pathname || '');
            const prev = hjSearchPrevPath;
            hjSearchPrevPath = path;
            if (/^\/search/.test(prev)) {
                const input = hjReadSearchInput();
                const text = input ? String(input.value || '').trim() : '';
                if (text) hjLastSearchKeyword = text;
            }
            if (/^\/search/.test(prev) && /^\/(post|video)/.test(path) && hjLastSearchKeyword) {
                hjSearchRestorePending = true;
                hjSearchRestoreTries = 0;
                hjSearchRestoreDeadline = Date.now() + HJ_SEARCH_RESTORE_WINDOW_MS;
                return;
            }
            if (/^\/search/.test(path) && hjSearchRestorePending) {
                if (Date.now() > hjSearchRestoreDeadline) { hjSearchRestorePending = false; return; }
                setTimeout(() => { try { hjSearchRestoreTryNow(); } catch (e) { } }, 600);
                return;
            }
        } catch (e) { }
    }
    async function hjSearchRestoreIfLost() {
        if (hjSearchRestoreRunning) return false;
        if (!hjSearchRestorePending) return false;
        if (!hjIsSearchRoute()) return false;
        if (!hjLastSearchKeyword) return false;
        if (Date.now() > hjSearchRestoreDeadline) { hjSearchRestorePending = false; return false; }
        if (hjSearchRestoreTries >= HJ_SEARCH_RESTORE_MAX_TRIES) { hjSearchRestorePending = false; return false; }
        const input = hjReadSearchInput();
        if (!input) return false;                                       
        const current = String(input.value || '');
        if (current.trim()) {
            if (current.trim() === hjLastSearchKeyword || hjSearchLooksPopulated()) {
                hjSearchRestorePending = false;
                hjSearchRestoreTries = 0;
            }
            return false;                                             
        }
        hjSearchRestoreRunning = true;
        try {
            hjSearchRestoreTries++;
            let wrote = false;
            try {
                const proto = (typeof window !== 'undefined' && window.HTMLInputElement)
                    ? window.HTMLInputElement.prototype : null;
                const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
                if (desc && typeof desc.set === 'function') { desc.set.call(input, hjLastSearchKeyword); wrote = true; }
            } catch (e) { }
            if (!wrote) { try { input.value = hjLastSearchKeyword; } catch (e) { } }
            try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { }
            try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { }
            try {
                for (const type of ['keydown', 'keypress', 'keyup']) {
                    input.dispatchEvent(new KeyboardEvent(type, {
                        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
                    }));
                }
            } catch (e) { }
            try {
                const icon = document.querySelector('.van-icon-search');
                if (icon) icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            } catch (e) { }
            const gen = ++hjSearchRestoreGen;
            const kw = hjLastSearchKeyword;
            try {
                setTimeout(() => {
                    try {
                        if (gen !== hjSearchRestoreGen) return;
                        if (!hjSearchRestorePending) return;
                        const el = hjReadSearchInput();
                        const kept = !!el && String(el.value || '').trim() === kw;
                        const grew = hjSearchLooksPopulated();
                        if (kept && grew) {
                            console.info('[海角脚本] 搜索页返回后结果丢了，已按上次关键词重放搜索：「' + kw + '」');
                            hjSearchRestorePending = false;
                            hjSearchRestoreTries = 0;
                            return;
                        }
                        if (hjSearchRestoreTries >= HJ_SEARCH_RESTORE_MAX_TRIES) {
                            hjSearchRestorePending = false;
                            hjSearchRestoreTries = 0;
                            return;
                        }
                        console.info('[海角脚本] 搜索重放尚未生效（组件未就绪或值被回滚），稍后重试');
                    } catch (e) { }
                }, HJ_SEARCH_RESTORE_VERIFY_MS);
            } catch (e) { }
            return true;                               
        } finally {
            hjSearchRestoreRunning = false;
        }
    }
    function hjSearchRestoreTryNow() {
        try { hjSearchRestoreIfLost(); } catch (e) { }
    }
    function hjSyncRouteState(reason) {
        const key = hjCurrentRouteKey();
        if (key === hjRouteKey) return false;
        const first = hjRouteKey === null;
        hjRouteKey = key;
        hjRouteGen++;
        try { hjSearchNoteRouteChange(); } catch (e) { }
        if (first) return true;                           
        console.info('[海角脚本] 路由变化（' + reason + '），清理上一页的播放状态：' + key);
        hjResetPagePlaybackState(reason);
        return true;
    }
    function checkPlaybackRoute() {
        hjSyncRouteState('轮询');
        if (activePlaybackSession && activePlaybackSession.pageUrl !== location.href) destroyActivePlayback();
        for (const entry of playbackManifestRequests.values()) {
            if (entry.pageUrl !== location.href) entry.abort();
        }
    }
    try {
        const nativeHistory = (typeof unsafeWindow !== 'undefined' && unsafeWindow.history) || window.history;
        for (const name of ['pushState', 'replaceState']) {
            const original = nativeHistory[name];
            if (typeof original !== 'function') continue;
            nativeHistory[name] = function () {
                const result = original.apply(this, arguments);
                try { setTimeout(() => { try { hjSyncRouteState(name); } catch (e) { } }, 0); } catch (e) { }
                return result;
            };
        }
    } catch (e) { }
    function playbackManifestKey(url) {
        const resolved = new URL(url, location.href);
        resolved.hash = '';
        return resolved.href;
    }
    function rememberPlaybackManifest(url, text, finalUrl = url) {
        const key = playbackManifestKey(url);
        if (!/#EXTM3U/i.test(text)) { playbackManifestCache.delete(key); return; }
        const ttl = /#EXT-X-ENDLIST/i.test(text) ? 60000 : /#EXT-X-STREAM-INF/i.test(text) ? 15000 : 0;
        if (!ttl) { playbackManifestCache.delete(key); return; }
        playbackManifestCache.delete(key);
        playbackManifestCache.set(key, { text, url: finalUrl, expiresAt: Date.now() + ttl });
        while (playbackManifestCache.size > 12) playbackManifestCache.delete(playbackManifestCache.keys().next().value);
    }
    function getCachedPlaybackManifest(url) {
        const key = playbackManifestKey(url);
        const value = playbackManifestCache.get(key);
        if (value && value.expiresAt > Date.now()) return value;
        playbackManifestCache.delete(key);
        return null;
    }
    function getPlaybackManifest(url) {
        const key = playbackManifestKey(url);
        const cached = getCachedPlaybackManifest(key);
        if (cached) return Promise.resolve(cached);
        const pending = playbackManifestRequests.get(key);
        if (pending?.pageUrl === location.href) return pending.promise;
        if (pending) pending.abort();
        const Loader = createGmHlsLoaderClass();
        const loader = new Loader();
        const entry = { pageUrl: location.href, abort: () => loader.abort(), promise: null };
        entry.promise = new Promise((resolve, reject) => {
            loader.load({ url: key, type: 'manifest', responseType: 'text' }, { timeout: 12000 }, {
                onSuccess: response => {
                    const text = String(response.data || '');
                    if (!/#EXTM3U/i.test(text)) return reject(new Error('响应不是 M3U8'));
                    const result = { text, url: response.url || key };
                    rememberPlaybackManifest(key, text, result.url);
                    if (result.url !== key) rememberPlaybackManifest(result.url, text);
                    resolve(result);
                },
                onError: error => reject(new Error(error.text || '索引请求失败')),
                onTimeout: () => reject(new Error('索引请求超时')),
                onAbort: () => reject(makeAbortError('播放索引请求已取消'))
            });
        }).finally(() => {
            if (playbackManifestRequests.get(key) === entry) playbackManifestRequests.delete(key);
            loader.destroy();
        });
        playbackManifestRequests.set(key, entry);
        return entry.promise;
    }
    function warmPlaybackOnIntent() {
        if (document.hidden || navigator.connection?.saveData || activePlaybackSession) return;
        const url = capturedM3u8Url;
        if (!url) return;
        hjPrewarmKeyModule();
        getPlaybackManifest(url).catch(() => {});
    }
    let hjKeyPrewarmStarted = false;
    function hjPrewarmKeyModule() {
        if (hjKeyPrewarmStarted) return;
        hjKeyPrewarmStarted = true;
        let tries = 0;
        const tick = () => {
            let factory = null;
            try { factory = unsafeWindow.createModule || window.createModule; } catch (e) { }
            if (typeof factory === 'function') {
                const t = performance.now();
                getHaijiaoKeyModule().then(() => {
                    console.info('[海角脚本] wasm 密钥模块已提前编译（点击播放时将零等待命中缓存）',
                        { ms: Math.round(performance.now() - t) });
                }).catch(() => {
                    hjKeyPrewarmStarted = false;
                });
                return;
            }
            if (++tries > 150) return;                               
            setTimeout(tick, 200);
        };
        tick();
    }
    try { hjPrewarmKeyModule(); } catch (e) { }
    function canStartPlayback(video, ahead) {
        if (video.readyState < 2) return false;
        if (ahead >= 0.6) return true;                             
        const remaining = video.duration - video.currentTime;
        if (Number.isFinite(remaining) && remaining > 0 && remaining <= 0.6 && ahead >= Math.max(0.05, remaining - 0.05)) return true;
        return video.readyState >= 3;                                       
    }
    function getPlaybackM3u8CandidateUrls(primaryUrl) {
        const urls = [];
        const add = (url, allowPreview = false) => {
            if (!url) return;
            const resolved = resolveUrl(url, location.href);
            if (!resolved || urls.includes(resolved)) return;
            if (!allowPreview && isPreviewM3u8Url(resolved)) return;
            urls.push(resolved);
        };
        const normalized = isPreviewM3u8Url(primaryUrl) ? deriveFullM3u8UrlFromPreview(primaryUrl) : primaryUrl;
        add(hjDerivedVerifiedFullUrl);
        add(hjPassTopicFullUrl);
        add(hjDerivedFullM3u8Url);
        add(normalized);
        const best = getBestKnownM3u8Candidate(true);
        add(best?.url);
        add(deriveNonIosM3u8Url(normalized));
        add(deriveNonIosM3u8Url(best?.url));
        add(primaryUrl, true);
        add(hjPreviewFallbackUrl, true);
        return urls;
    }
    async function selectPlayableM3u8Url(primaryUrl, isCurrent = () => true) {
        const candidates = getPlaybackM3u8CandidateUrls(primaryUrl);
        const fallback = candidates[0] || primaryUrl;
        let lastError = null;
        let fullIndexUnavailable = false;
        lastPlaybackSelectionNote = '';
        hjPlayMark('选址开始', { candidates: candidates.length, primary: primaryUrl });
        for (const url of candidates) {
            if (!isCurrent()) return '';
            const t = performance.now();
            try {
                const cached = !!getCachedPlaybackManifest(url);
                const manifest = await getPlaybackManifest(url);
                if (!isCurrent()) return '';
                const text = manifest.text;
                hjPlayMark('候选索引已取回', { url, ms: Math.round(performance.now() - t), cached, bytes: String(text || '').length });
                if (!/#EXTM3U/i.test(String(text || ''))) throw new Error('响应不是 M3U8');
                const info = analyzeM3u8TextForCandidate(text, url);
                if (!info || (!info.isMaster && info.segmentCount === 0)) throw new Error('M3U8 没有媒体流');
                rememberM3u8Candidate(manifest.url, text, 'playback-preflight', true);
                console.info('[海角脚本] 播放前索引验证成功：', { url, isMaster: info.isMaster, duration: info.duration, segments: info.segmentCount });
                return manifest.url;
            } catch (e) {
                lastError = e;
                if (!isPreviewM3u8Url(url)) {
                    fullIndexUnavailable = true;
                    console.warn('[海角脚本] 完整索引候选不可用（出售内容未购买时属预期），继续尝试下一个：', { url, error: e?.message || e });
                } else {
                    console.warn('[海角脚本] 预览索引候选不可用，继续尝试下一个：', { url, error: e?.message || e });
                }
            }
        }
        const previewOnly = Boolean(primaryUrl && isPreviewM3u8Url(primaryUrl));
        lastPlaybackSelectionNote = hjFreshSignInNote()
            ? hjFreshSignInNote()
            : (previewOnly || fullIndexUnavailable)
                ? '该帖为出售内容，当前身份未购买，服务端仅下发 30 秒预览（完整索引不下发）'
                : '未找到可用的 M3U8 索引';
        if (!hjHasUsableIdentity()) { try { hjMaybeNoticeNoAccount(); } catch (e) { } }
        console.warn('[海角脚本] 所有 M3U8 候选均不可用：', { note: lastPlaybackSelectionNote, error: lastError?.message || String(lastError || '') });
        return '';
    }
    function getHaijiaoKeyVersion() {
        try { return String(JSON.parse(sessionStorage.getItem('config') || '{}').kversion || ''); }
        catch (e) { return ''; }
    }
    function rewriteHaijiaoKeyUrl(url) {
        const source = String(url || '');
        if (!/\.key(?:v[^/?#]*)?(?:[?#]|$)/i.test(source)) return source;
        const version = getHaijiaoKeyVersion();
        try {
            const u = new URL(source, location.href);
            u.pathname = u.pathname.replace(/\.key(?:v[^/]*)?$/i, `.keyv${version}`);
            return u.href;
        } catch (e) {
            return source.replace(/\.key(?:v[^/?#]*)?(?=[?#]|$)/i, `.keyv${version}`);
        }
    }
    function deriveHaijiaoKeySeedUrl(playlistUrl) {
        try {
            const u = new URL(playlistUrl, location.href);
            u.pathname = u.pathname.replace(/\.m3u8$/i, '.jpg');
            u.search = ''; u.hash = '';
            return u.href;
        } catch (e) { return String(playlistUrl || '').replace(/\.m3u8(?:[?#].*)?$/i, '.jpg'); }
    }
    function decodeBase64Bytes(text) {
        if (typeof text !== 'string') {
            throw new Error('密钥种子必须是字符串，收到 ' +
                (text === null ? 'null' : (text && text.constructor ? text.constructor.name : typeof text)) +
                '（通道应把文本请求解码成字符串）');
        }
        const binary = atob(String(text || '').trim());
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }
    async function getHaijiaoKeyModule() {
        if (!haijiaoKeyModulePromise) {
            haijiaoKeyModulePromise = (async () => {
                const t = performance.now();
                hjPlayMark('wasm 密钥模块开始编译（createModule）');
                const factory = unsafeWindow.createModule || window.createModule;
                if (typeof factory !== 'function') throw new Error('页面密钥转换模块 createModule 不可用');
                const mod = await factory();
                hjPlayMark('wasm 密钥模块编译完成', { ms: Math.round(performance.now() - t) });
                return mod;
            })().catch(e => { haijiaoKeyModulePromise = null; throw e; });
        } else {
            hjPlayMark('wasm 密钥模块命中缓存，跳过编译');
        }
        return await haijiaoKeyModulePromise;
    }
    async function getHaijiaoKeySeed(playlistUrl) {
        const seedUrl = deriveHaijiaoKeySeedUrl(playlistUrl);
        if (!haijiaoKeySeedCache.has(seedUrl)) {
            haijiaoKeySeedCache.set(seedUrl, (async () => {
                const t = performance.now();
                hjPlayMark('密钥种子开始下载', { url: seedUrl });
                const response = await requestPlaybackResource({ url: seedUrl, type: 'manifest' }, 15000, { preferFetch: true }).promise;
                const bytes = decodeBase64Bytes(response.data);
                if (!bytes.length) throw new Error('海角密钥种子为空');
                hjPlayMark('密钥种子下载完成', { url: seedUrl, bytes: bytes.length, ms: Math.round(performance.now() - t) });
                return bytes;
            })().catch(e => { haijiaoKeySeedCache.delete(seedUrl); throw e; }));
        } else {
            hjPlayMark('密钥种子命中缓存', { url: seedUrl });
        }
        return await haijiaoKeySeedCache.get(seedUrl);
    }
    async function createHaijiaoKeyTransformer(playlistUrl) {
        const t = performance.now();
        hjPlayMark('密钥转换器准备开始（wasm 与种子并行）');
        const [module, seed] = await Promise.all([getHaijiaoKeyModule(), getHaijiaoKeySeed(playlistUrl)]);
        hjPlayMark('密钥转换器准备完成', { seedBytes: seed.length, ms: Math.round(performance.now() - t) });
        return rawKey => {
            const input = rawKey instanceof Uint8Array ? rawKey : new Uint8Array(normalizeArrayBuffer(rawKey));
            const keyPtr = module._malloc(input.length), seedPtr = module._malloc(seed.length);
            try {
                module.HEAPU8.set(input, keyPtr); module.HEAPU8.set(seed, seedPtr);
                module.ccall('jquery_key', null, ['number','number','number','number'], [keyPtr,input.length,seedPtr,seed.length]);
                return new Uint8Array(module.HEAPU8.buffer, keyPtr, input.length).slice();
            } finally { module._free(keyPtr); module._free(seedPtr); }
        };
    }
    function playbackRequestKind(context) {
        const decryptData = context.frag?.decryptdata || context.frag?.decryptData;
        if (context.type === 'key' || (decryptData?.uri && context.url === decryptData.uri && context.url !== context.frag?.url) || /\.key(?:v[^/?#]*)?(?:[?#]|$)/i.test(context.url || '')) return 'key';
        if (context.isSidxRequest) return 'other';                                       
        if (['manifest', 'level', 'audioTrack', 'subtitleTrack'].includes(context.type) || /\.m3u8(?:[?#]|$)/i.test(context.url || '')) return 'text';
        return context.frag || context.type === 'fragment' || context.type === 'frag' ? 'fragment' : 'other';
    }
    const playbackFetchFallbackUntil = new Map();
    function playbackLoadError(message, extra = {}) { return Object.assign(new Error(message), extra); }
    function hjDecodeFetchPayload(bytes, wantsText) {
        return wantsText ? new TextDecoder('utf-8').decode(bytes) : bytes.buffer;
    }
    function requestPlaybackResource(context, timeout, { preferFetch = false, onProgress = null, maxBytes = Infinity } = {}) {
        let settled = false, controller = null, gmRequest = null, deadlineTimer = null, gmTimer = null;
        let rejectPromise;
        const timing = { start: performance.now(), first: 0, end: 0 };
        const kind = playbackRequestKind(context), wantsText = kind === 'text';
        const url = kind === 'key' ? rewriteHaijiaoKeyUrl(context.url) : context.url;
        const headers = { ...(context.headers || {}) };
        const hasRange = Number.isFinite(context.rangeEnd) && context.rangeEnd > 0;
        const rangeStart = Number(context.rangeStart || 0), rangeEnd = Number(context.rangeEnd);
        if (hasRange) headers.Range = `bytes=${rangeStart}-${rangeEnd - 1}`;                                 
        const elapsed = () => performance.now() - timing.start;
        const remaining = () => timeout > 0 ? Math.max(1, timeout - elapsed()) : 0;
        const cleanup = () => { clearTimeout(deadlineTimer); clearTimeout(gmTimer); };
        const stopNetwork = () => { try { controller?.abort(); } catch (_) {} try { gmRequest?.abort?.(); } catch (_) {} };
        const reject = error => {
            if (settled) return;
            settled = true; timing.end = performance.now(); cleanup(); stopNetwork(); rejectPromise(error);
        };
        const progress = (loaded, total) => {
            if (settled) return;
            if (loaded > 0 && !timing.first) timing.first = performance.now();
            if (loaded > maxBytes) return reject(playbackLoadError('预取分片超过内存上限', { tooLarge: true }));
            onProgress?.({ loaded, total, timing: { ...timing } });
        };
        const checkRange = (data, status, getHeader) => {
            if (!hasRange) return data;
            const length = rangeEnd - rangeStart;
            if (status === 206) {
                const contentRange = getHeader('content-range');
                const match = contentRange && /^bytes\s+(\d+)-(\d+)\/(?:\d+|\*)$/i.exec(contentRange.trim());
                if (data.byteLength !== length || (contentRange && (!match || Number(match[1]) !== rangeStart || Number(match[2]) !== rangeEnd - 1))) {
                    throw playbackLoadError('分片 Range 响应范围或长度不匹配', { status });
                }
                return data;
            }
            if (status === 200 && data.byteLength >= rangeEnd) return data.slice(rangeStart, rangeEnd);
            throw playbackLoadError('服务器未返回可安全截取的 Range 响应', { status });
        };
        const promise = new Promise((resolve, rejectFn) => {
            rejectPromise = rejectFn;
            const finish = (data, finalUrl, status, getHeader) => {
                if (settled) return;
                try {
                    if (!wantsText) data = checkRange(data, status, getHeader);
                    const loaded = wantsText ? new TextEncoder().encode(data).byteLength : data.byteLength;
                    if (loaded > maxBytes) throw playbackLoadError('预取分片超过内存上限', { tooLarge: true });
                    timing.end = performance.now();
                    if (!timing.first) timing.first = timing.end;
                    settled = true; cleanup();
                    resolve({ data, url: finalUrl || url, status, loaded, total: loaded, timing: { ...timing }, cached: false });
                } catch (error) { reject(error); }
            };
            if (hasRange && (!Number.isInteger(rangeStart) || !Number.isInteger(rangeEnd) || rangeStart < 0 || rangeEnd <= rangeStart)) {
                reject(playbackLoadError('无效的分片字节范围')); return;
            }
            if (timeout > 0) deadlineTimer = setTimeout(() => reject(playbackLoadError('请求超时', { timeout: true })), timeout);
            const useGm = () => {
                if (settled) return;
                if (typeof GM_xmlhttpRequest !== 'function') return reject(playbackLoadError('GM 请求接口不可用'));
                const gmTimeout = remaining() || 60000;
                gmTimer = setTimeout(() => reject(playbackLoadError('GM 请求超时', { timeout: true })), gmTimeout);
                try {
                    gmRequest = GM_xmlhttpRequest({
                        method: 'GET', url, headers, responseType: wantsText ? 'text' : 'arraybuffer', timeout: gmTimeout,
                        onprogress: event => progress(Number(event.loaded || 0), Number(event.total || 0)),
                        onload: async response => {
                            if (settled) return;
                            if (response.status < 200 || response.status >= 300) return reject(playbackLoadError('HTTP ' + response.status, { status: response.status, response }));
                            try {
                                const data = wantsText ? String(response.responseText ?? response.response ?? '') : await normalizeArrayBufferAsync(response.response ?? response.responseText);
                                const responseHeaders = String(response.responseHeaders || '').split(/\r?\n/);
                                finish(data, response.finalUrl, response.status, name => {
                                    const line = responseHeaders.find(line => line.slice(0, line.indexOf(':')).toLowerCase() === name);
                                    return line ? line.slice(line.indexOf(':') + 1).trim() : null;
                                });
                            } catch (error) { reject(error); }
                        },
                        onerror: response => reject(playbackLoadError('GM HLS 请求失败', { status: response?.status || 0, response })),
                        ontimeout: () => reject(playbackLoadError('请求超时', { timeout: true })),
                        onabort: () => reject(playbackLoadError('请求已取消', { aborted: true }))
                    });
                    if (settled) stopNetwork();
                } catch (error) { reject(error); }
            };
            let origin = '';
            try { origin = new URL(url, location.href).origin; } catch (_) {}
            if (!preferFetch || typeof fetch !== 'function' || (playbackFetchFallbackUntil.get(origin) || 0) > Date.now()) { useGm(); return; }
            controller = new AbortController();
            (async () => {
                try {
                    const response = await fetch(url, { signal: controller.signal, headers, credentials: 'omit', cache: 'default' });
                    if (settled) return;
                    if (!response.ok) throw playbackLoadError('HTTP ' + response.status, { status: response.status });
                    const total = Number(response.headers.get('content-length') || 0);
                    if (total > maxBytes) throw playbackLoadError('预取分片超过内存上限', { tooLarge: true });
                    let data;
                    if (response.body?.getReader) {
                        const reader = response.body.getReader(), chunks = [];
                        let loaded = 0;
                        while (!settled) {
                            const chunk = await reader.read();
                            if (settled) return;
                            if (chunk.done) break;
                            loaded += chunk.value.byteLength;
                            progress(loaded, total);
                            if (settled) return;
                            chunks.push(chunk.value);
                        }
                        if (settled) return;
                        const bytes = new Uint8Array(loaded);
                        let offset = 0;
                        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
                        data = hjDecodeFetchPayload(bytes, wantsText);
                    } else {
                        const buf = await response.arrayBuffer();
                        progress(buf.byteLength, total);
                        data = hjDecodeFetchPayload(new Uint8Array(buf), wantsText);
                    }
                    finish(data, response.url, response.status, name => response.headers.get(name));
                } catch (error) {
                    if (settled) return;
                    if (error?.name === 'AbortError') return reject(playbackLoadError('请求已取消', { aborted: true }));
                    if (error instanceof TypeError || error?.name === 'TypeError') {
                        if (origin) {
                            for (const [key, expiry] of playbackFetchFallbackUntil) if (expiry <= Date.now()) playbackFetchFallbackUntil.delete(key);
                            if (playbackFetchFallbackUntil.size >= 32) playbackFetchFallbackUntil.delete(playbackFetchFallbackUntil.keys().next().value);
                            playbackFetchFallbackUntil.set(origin, Date.now() + 60000);
                        }
                        useGm();
                    } else reject(error);
                }
            })();
        });
        return { promise, abort: () => reject(playbackLoadError('请求已取消', { aborted: true })) };
    }
    function createPlaybackFragmentPool() {
        const MAX_ACTIVE = 4, LOOK_AHEAD = 4, MAX_CACHE_BYTES = 24 * 1024 * 1024, MAX_CACHE_ITEMS = 8;
        const MAX_PREFETCH_BYTES = 6 * 1024 * 1024;
        const MAX_SPECULATIVE = 2;
        let specActive = 0;
        const entries = new Map();
        let fragments = [], wanted = new Set(), active = 0, cacheBytes = 0, destroyed = false;
        let hits = 0, joined = 0, networkLoads = 0;
        const keyOf = context => JSON.stringify([context.url, context.rangeEnd > 0 ? (context.rangeStart || 0) : null, context.rangeEnd > 0 ? context.rangeEnd : null,
            Object.entries(context.headers || {}).sort((a, b) => a[0].localeCompare(b[0]))]);
        const simple = frag => frag && (!frag.type || frag.type === 'main') && Number.isFinite(frag.sn) &&
            !!frag.url && !frag.gap && !frag.byteRange?.length && !(frag.byteRangeEndOffset > 0);
        const remove = entry => {
            if (entries.get(entry.key) !== entry) return;
            entries.delete(entry.key);
            if (entry.state === 'done') cacheBytes -= entry.result.data.byteLength;
            if (entry.state === 'loading') {
                active--; if (entry.spec) specActive--;
                entry.state = 'cancelled'; entry.request.abort();
            }
        };
        const trim = () => {
            let count = [...entries.values()].filter(entry => entry.state === 'done').length;
            for (const entry of entries.values()) {
                if (entry.state === 'done' && (!wanted.has(entry.key) || cacheBytes > MAX_CACHE_BYTES || count > MAX_CACHE_ITEMS)) {
                    remove(entry); count--;
                }
            }
        };
        const deliver = (entry, error, result) => {
            for (const consumer of [...entry.consumers]) {
                clearTimeout(consumer.timer); entry.consumers.delete(consumer);
                if (error) consumer.reject(error);
                else consumer.resolve({ ...result, data: result.data.slice(0) });
            }
        };
        const pump = () => {
            if (destroyed) return;
            while (active < MAX_ACTIVE) {
                const pending = [...entries.values()].filter(entry => entry.state === 'queued');
                const demanded = pending.find(entry => entry.consumers.size);
                const entry = demanded || pending.find(entry => wanted.has(entry.key));
                if (!entry) break;
                if (!demanded) {
                    if (specActive >= MAX_SPECULATIVE) break;
                }
                active++; networkLoads++; entry.state = 'loading';
                entry.spec = entry.consumers.size === 0;
                if (entry.spec) specActive++;
                entry.request = requestPlaybackResource(entry.context, entry.timeout, {
                    preferFetch: true, maxBytes: entry.spec ? MAX_PREFETCH_BYTES : Infinity,
                    onProgress: value => { for (const consumer of entry.consumers) consumer.progress?.(value); }
                });
                entry.request.promise.then(result => {
                    if (entry.state !== 'loading') return;
                    active--; if (entry.spec) specActive--;
                    entry.state = 'done'; entry.result = result; cacheBytes += result.data.byteLength;
                    deliver(entry, null, result); trim(); pump();
                }, error => {
                    if (entry.state !== 'loading') return;
                    active--; if (entry.spec) specActive--;
                    if (entry.spec && error.tooLarge && entry.consumers.size) {
                        entry.state = 'queued'; pump(); return;
                    }
                    entries.delete(entry.key); entry.state = 'failed'; deliver(entry, error); pump();
                });
            }
        };
        const add = (context, timeout) => {
            const key = keyOf(context);
            let entry = entries.get(key);
            if (!entry) {
                entry = { key, context, timeout, state: 'queued', consumers: new Set(), result: null, request: null, spec: false };
                entries.set(key, entry);
            }
            return entry;
        };
        const setWindow = context => {
            const key = keyOf(context);
            const eligible = simple(context.frag) && !context.part && !(context.rangeEnd > 0) && !Object.keys(context.headers || {}).length;
            if (!eligible) return;
            const index = eligible ? fragments.findIndex(frag => frag.url === context.url) : -1;
            const upcoming = index < 0 ? [] : fragments.slice(index + 1, index + 1 + LOOK_AHEAD);
            wanted = new Set([key, ...upcoming.filter(simple).map(frag => keyOf({ url: frag.url, frag }))]);
            for (const entry of entries.values()) if (!wanted.has(entry.key) && !entry.consumers.size) remove(entry);
            for (const frag of upcoming) if (simple(frag)) add({ url: frag.url, frag }, 12000);
        };
        return {
            setFragments(value, prefetchStart = false) {
                if (destroyed) return;
                fragments = Array.isArray(value) ? value : [];
                wanted = new Set();
                for (const entry of entries.values()) if (!entry.consumers.size) remove(entry);
                if (prefetchStart && simple(fragments[0])) {
                    const context = { url: fragments[0].url, frag: fragments[0] };
                    add(context, 12000); setWindow(context); pump();                  
                }
            },
            load(context, timeout, onProgress) {
                if (destroyed) return { promise: Promise.reject(playbackLoadError('分片池已销毁', { aborted: true })), abort() {} };
                setWindow(context);
                const entry = add(context, timeout);
                if (entry.state === 'done') {
                    hits++; pump();
                    return { promise: Promise.resolve({ ...entry.result, data: entry.result.data.slice(0), cached: true }), abort() {} };
                }
                if (entry.state === 'loading') joined++;
                let consumer;
                const promise = new Promise((resolve, reject) => { consumer = { resolve, reject, progress: onProgress, timer: null }; entry.consumers.add(consumer); });
                const cancel = error => {
                    if (!entry.consumers.delete(consumer)) return;
                    clearTimeout(consumer.timer); consumer.reject(error);
                    if (!entry.consumers.size) { wanted.delete(entry.key); remove(entry); }
                    pump();
                };
                if (timeout > 0) consumer.timer = setTimeout(() => cancel(playbackLoadError('请求超时', { timeout: true })), timeout);
                if (active >= MAX_ACTIVE && entry.state === 'queued') {
                    const victim = [...entries.values()].find(other => other.state === 'loading' && !other.consumers.size);
                    if (victim) remove(victim);
                }
                pump();
                return { promise, abort: () => cancel(playbackLoadError('请求已取消', { aborted: true })) };
            },
            destroy() {
                if (destroyed) return;
                destroyed = true; wanted.clear(); fragments = [];
                for (const entry of [...entries.values()]) { deliver(entry, playbackLoadError('分片池已销毁', { aborted: true })); remove(entry); }
            },
            snapshot() { return { active, specActive, maxSpec: MAX_SPECULATIVE, entries: entries.size, cacheBytes, hits, joined, networkLoads, maxActive: MAX_ACTIVE, lookAhead: LOOK_AHEAD }; }
        };
    }
    function createGmHlsLoaderClass({ fragmentPool = null, transformKey = null, getManifest = null } = {}) {
        if (transformKey && typeof transformKey.then === 'function') Promise.resolve(transformKey).catch(() => {});
        return class GmHlsLoader {
            constructor() { this.request = null; this.stats = null; this.context = null; this._cancel = null; }
            destroy() { this.abort(); this.context = null; }
            abort() { this._cancel?.(); this._cancel = null; this.request = null; }
            load(context, config, callbacks) {
                this.abort(); this.context = context;
                const started = performance.now(), kind = playbackRequestKind(context), sn = context.frag?.sn;
                const logThis = kind !== 'fragment' || sn == null || sn < 8 || sn % 50 === 0;
                const label = kind + (sn == null ? '' : '#' + sn);
                const shortUrl = String(context.url || '').replace(/^https?:\/\/[^/]+/, '');
                const timeout = Number.isFinite(config?.timeout) ? Math.max(0, config.timeout) : (kind === 'text' ? 20000 : 45000);
                const stats = this.stats = {
                    aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 0, bwEstimate: 0,
                    trequest: started, tfirst: 0, tload: 0,
                    loading: { start: started, first: 0, end: 0 }, parsing: { start: 0, end: 0 }, buffering: { start: 0, first: 0, end: 0 }
                };
                let done = false, timer = null;
                const finishState = () => { done = true; clearTimeout(timer); this._cancel = null; this.request = null; };
                const fail = error => {
                    if (done) return;
                    const request = this.request; finishState(); request?.abort();
                    stats.loading.end = stats.tload = performance.now();
                    if (error.aborted) { stats.aborted = true; callbacks.onAbort?.(stats, context, null); return; }
                    hjPlayMark('请求失败 ' + label, { ms: Math.round(performance.now() - started), text: error.message, status: error.status || 0, url: shortUrl });
                    if (error.timeout && callbacks.onTimeout) callbacks.onTimeout(stats, context, error.response || null);
                    else callbacks.onError({ code: error.status || 0, text: error.message || String(error) }, context, error.response || null, stats);
                };
                this._cancel = () => fail(playbackLoadError('请求已取消', { aborted: true }));
                if (timeout > 0) timer = setTimeout(() => fail(playbackLoadError('请求超时', { timeout: true })), timeout);
                if (logThis) hjPlayMark('请求开始 ' + label, { url: shortUrl });
                const progress = value => {
                    if (done) return;
                    stats.loaded = value.loaded; stats.total = value.total;
                    stats.loading.first = stats.tfirst = value.timing.first;
                };
                (async () => {
                    try {
                        let result = null;
                        if (kind === 'text' && getManifest) {
                            const cached = await getManifest(context.url);
                            if (done) return;
                            if (cached && typeof cached.text === 'string') {
                                const now = performance.now(), loaded = new TextEncoder().encode(cached.text).byteLength;
                                result = { data: cached.text, url: cached.url || context.url, status: 200, loaded, total: loaded, timing: { start: started, first: now, end: now }, cached: true };
                            }
                        }
                        if (!result) {
                            if (done) return;
                            const remaining = timeout > 0 ? Math.max(1, timeout - (performance.now() - started)) : 0;
                            const request = kind === 'fragment' && fragmentPool
                                ? fragmentPool.load(context, remaining, progress)
                                : requestPlaybackResource(context, remaining, { preferFetch: kind === 'fragment' || kind === 'key', onProgress: progress });
                            this.request = request;
                            result = await request.promise;
                        }
                        if (done) return;
                        if (kind === 'key' && transformKey) {
                            const keyWaitAt = performance.now();
                            const transform = await transformKey;
                            if (done) return;
                            result.data = await normalizeArrayBufferAsync(await transform(new Uint8Array(result.data)));
                            if (!done) hjPlayMark('密钥准备及转换等待完成', { ms: Math.round(performance.now() - keyWaitAt) });
                        }
                        if (done) return;
                        stats.loaded = stats.total = result.loaded;
                        stats.loading.start = stats.trequest = result.timing.start;
                        stats.loading.first = stats.tfirst = result.timing.first;
                        stats.loading.end = stats.tload = result.timing.end;
                        stats.chunkCount = 1;
                        stats.bwEstimate = 8000 * result.loaded / Math.max(1, result.timing.end - result.timing.start);
                        finishState();
                        if (logThis) hjPlayMark('请求完成 ' + label, {
                            ms: Math.round(performance.now() - started), bytes: stats.loaded, status: result.status, cached: result.cached,
                            networkMs: Math.round(result.timing.end - result.timing.start), ttfbMs: Math.round(result.timing.first - result.timing.start)
                        });
                        callbacks.onSuccess({ url: result.url || context.url, data: result.data }, stats, context, null);
                    } catch (error) { fail(error); }
                })();
            }
        };
    }
    function getNativeHaijiaoM3u8Url(url) {
        try {
            const u = new URL(url, location.href);
            const prefix = getHaijiaoKeyVersion() || '0';
            if (!u.hostname.startsWith(prefix)) u.hostname = prefix + u.hostname;
            return u.href;
        } catch (e) { return url; }
    }
    function getMediaErrorText(error) {
        const code = Number(error?.code || 0);
        return ({1:'播放被终止',2:'媒体网络请求失败',3:'媒体解码失败',4:'媒体格式或地址不受支持'})[code]
            || error?.message || '未知媒体错误';
    }
    function attachPlaybackDiagnostics(video, url, setPlayerStatus = () => {}, signal) {
        const clickedAt = hjPlayT0;
        let firstPlaying = false, waitingAt = 0, stalls = 0, waitMs = 0, frameId = null;
        const reportFrame = (_, metadata) => hjPlayMark('首帧已呈现', {
            clickToFrameMs: Math.round(performance.now() - clickedAt), mediaTime: metadata.mediaTime,
            droppedFrames: video.getVideoPlaybackQuality?.().droppedVideoFrames || 0
        });
        if (typeof video.requestVideoFrameCallback === 'function') frameId = video.requestVideoFrameCallback(reportFrame);
        signal?.addEventListener('abort', () => { if (frameId !== null) video.cancelVideoFrameCallback?.(frameId); }, { once: true });
        const eventText={loadstart:'正在请求媒体索引...',loadedmetadata:'媒体信息已加载，请点击视频播放',canplay:'媒体已缓冲，可以播放',playing:'正在播放完整视频',waiting:'网络缓冲中...',stalled:'媒体加载停滞，正在等待网络...',suspend:'浏览器暂停了媒体预加载'};
        for (const name of ['loadstart','loadedmetadata','loadeddata','canplay','canplaythrough','playing','waiting','stalled','suspend','seeking','seeked','pause','play','error']) {
            video.addEventListener(name, () => {
                if (name === 'waiting' && firstPlaying && !video.seeking && !video.paused && !waitingAt) waitingAt = performance.now();
                if (name === 'pause' || name === 'seeking') waitingAt = 0;
                if (name === 'playing') {
                    if (!firstPlaying) {
                        firstPlaying = true;
                        hjPlayMark('首次 playing', { clickToPlayingMs: Math.round(performance.now() - clickedAt), firstFrameFallback: frameId === null });
                    }
                    if (waitingAt) {
                        const elapsed = performance.now() - waitingAt;
                        waitingAt = 0; waitMs += elapsed; stalls++;
                        hjPlayMark('缓冲卡顿恢复', { stalls, stallMs: Math.round(elapsed), totalStallMs: Math.round(waitMs), droppedFrames: video.getVideoPlaybackQuality?.().droppedVideoFrames || 0 });
                    }
                }
                const base = {
                    url,
                    currentSrc: video.currentSrc,
                    currentTime: video.currentTime,
                    readyState: video.readyState,
                    networkState: video.networkState,
                    ahead: (() => {
                        try {
                            const b = video.buffered;
                            for (let i = 0; i < b.length; i++) {
                                if (b.start(i) - 0.25 <= video.currentTime && video.currentTime <= b.end(i)) return +(b.end(i) - video.currentTime).toFixed(2);
                            }
                        } catch (e) { }
                        return 0;
                    })()
                };
                hjPlayMark('VIDEO ' + name, base);
                if(name==='error') {
                    const message=getMediaErrorText(video.error);
                    console.error('[海角脚本] VIDEO 播放错误：',{...base,code:video.error?.code,message:video.error?.message});
                    setPlayerStatus(`播放失败：${message}（错误码 ${video.error?.code || 0}）`,true);
                } else {
                    console.debug(`[海角脚本] VIDEO ${name}:`,base);
                    if(eventText[name]) setPlayerStatus(eventText[name],false);
                }
            },{passive:true, signal});
        }
    }
    async function replaceAndPlayVideo(btn) {
        const previous = activePlaybackSession;
        if (previous?.pageUrl === location.href && previous.sourceUrl === capturedM3u8Url && !previous.failed) {
            if (previous.pending) return;
            if (previous.video?.isConnected && !previous.video.error) {
                previous.video.play().catch(() => showToast('请点击视频播放键继续'));
                return;
            }
        }
        destroyActivePlayback();
        const session = activePlaybackSession = { pageUrl: location.href, sourceUrl: capturedM3u8Url, pending: true, failed: false, video: null };
        try {
            await startPlaybackSession(btn, session);
        } catch (e) {
            if (activePlaybackSession === session) {
                destroyActivePlayback();
                console.error('[海角脚本] 播放准备失败：', e);
                showToast('播放准备失败：' + (e?.message || e));
            }
        } finally { session.pending = false; }
    }
    function hjAnchorBefore(el) {
        if (!el || !el.parentNode || el === document.body) return null;
        let target = el;
        const INLINE = ['span', 'a', 'em', 'strong', 'i', 'b', 'u', 'small', 'label', 'font', 'sub', 'sup', 'code', 'abbr'];
        const TEXT_BLOCK = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'address', 'legend', 'button', 'label'];
        const MAX_HOPS = 12;
        let hops = 0;
        for (; hops < MAX_HOPS; hops++) {
            const p = target.parentNode;
            if (!p || p === document.body) return null;
            const tag = String(p.tagName || '').toLowerCase();
            if (!INLINE.includes(tag) && !TEXT_BLOCK.includes(tag)) break;
            target = p;
        }
        if (hops >= MAX_HOPS) return null;                             
        return { node: target.parentNode, before: target };
    }
    function hjResolvePlaybackHostAnchor() {
        const entry = document.querySelector('.preview-btn, .video-div-btn[data-url], .video-div-btn');
        if (entry) {
            let entryBox = null;
            try { entryBox = entry.closest('.preview-title'); } catch (e) { }
            const a = hjAnchorBefore(entryBox || entry);
            if (a) return { mode: 'play-entry', node: a.node, before: a.before };
        }
        const sellBtn = document.querySelector('.sell-btn');
        if (sellBtn) {
            let tight = null;
            try { tight = sellBtn.closest('p, li'); } catch (e) { }
            const a = hjAnchorBefore(tight || sellBtn);
            if (a) return { mode: 'sell-inline', node: a.node, before: a.before };
        }
        const box = document.querySelector('.html-box, .preview-title, .html-content, .post-content');
        if (box && box.parentNode && box.parentNode !== document.body) {
            return { mode: 'content-box-outer', node: box.parentNode, before: box };
        }
        if (box) return { mode: 'content-box-inner', node: box, before: box.firstChild };
        return { mode: 'body-tail', node: document.body, before: null };
    }
    function makePlayerVisibleAgain(node) {
        try {
            let cur = node;
            for (let i = 0; i < 6 && cur && cur !== document.body && cur !== document.documentElement; i++) {
                const cs = getComputedStyle(cur);
                if (cs.display === 'none') {
                    activePlaybackStyleUndo.push([cur, 'display', cur.style.getPropertyValue('display'), cur.style.getPropertyPriority('display')]);
                    cur.style.setProperty('display', 'block', 'important');
                }
                if (cur.offsetHeight === 0 && (cs.height === '0px' || cs.maxHeight === '0px')) {
                    activePlaybackStyleUndo.push([cur, 'height', cur.style.getPropertyValue('height'), cur.style.getPropertyPriority('height')]);
                    cur.style.setProperty('height', 'auto', 'important');
                }
                cur = cur.parentElement;
            }
        } catch (e) { }
    }
    function hjEnsurePlaybackHost(rememberedHost) {
        const siteHost = document.querySelector('.show-video-box, #playvid, .video-div, .dplayer, [id^="video_"]');
        if (siteHost) return { container: siteHost, created: false, mode: 'site-host' };
        if (rememberedHost) return { container: rememberedHost, created: false, mode: 'remembered' };
        const anchor = hjResolvePlaybackHostAnchor();
        const host = document.createElement('div');
        host.style.margin = '15px 0';
        if (!anchor.node || anchor.mode === 'body-tail') {
            document.body.appendChild(host);
        } else if (anchor.before && anchor.before.parentNode === anchor.node) {
            anchor.node.insertBefore(host, anchor.before);
        } else {
            anchor.node.appendChild(host);
        }
        return { container: host, created: true, mode: anchor.mode };
    }
    async function startPlaybackSession(btn, session) {
        const isCurrent = () => activePlaybackSession === session && session.pageUrl === location.href;
        hjPlayT0 = performance.now();
        hjPlaySeq = 0;
        hjPlayMark('点击播放', { captured: capturedM3u8Url, gifDedup: hjGifDedupOn ? '开' : '关' });
        showToast(isPreviewM3u8Url(capturedM3u8Url)
            ? '该帖为「出售内容」：服务端只下发 30 秒预览，正在验证并启动播放器...'
            : '正在验证完整 M3U8 并启动播放器...');
        const nativePlayEntry = (() => {
            try {
                return document.querySelector('.video-div-btn[data-url], .preview-btn[data-url], .video-div-btn, .preview-btn');
            } catch (e) { return null; }
        })();
        const nativeEntryParent = nativePlayEntry ? nativePlayEntry.parentElement : null;
        if (isPreviewM3u8Url(session.sourceUrl)) {
            const soldAttId = getSoldContentAttId();
            if (soldAttId) {
                const tFull = performance.now();
                hjPlayMark('出售内容：等待完整索引换址', { attId: soldAttId });
                showToast('正在获取完整视频索引...');
                const full = await hjWithTimeout(hjFetchFullIndexByAttId(soldAttId, session.sourceUrl), 8000);
                if (!isCurrent()) return;
                if (full && !isPreviewM3u8Url(full)) {
                    hjPassTopicFullUrl = full;
                    updateState(full);
                    session.sourceUrl = full;
                    hjPlayMark('出售内容：已拿到完整索引', { ms: Math.round(performance.now() - tFull), url: full });
                } else {
                    hjPlayMark('出售内容：完整索引未取到，回退 30 秒预览', { ms: Math.round(performance.now() - tFull) });
                    console.warn('[海角脚本] 完整索引换址未成功，本次播放 30 秒预览');
                }
            }
        }
        const tSelect = performance.now();
        const targetM3u8 = await selectPlayableM3u8Url(session.sourceUrl, isCurrent);
        if (!isCurrent()) return;
        hjPlayMark('选址结束', { ms: Math.round(performance.now() - tSelect), url: targetM3u8 || '(无)' });
        if (!targetM3u8) {
            session.failed = true;
            const note = lastPlaybackSelectionNote || '未找到可用的 M3U8 索引';
            showToast(note);
            if (nativePlayEntry) {
                try {
                    console.warn('[海角脚本] 自建链选址失败，改由站点原生播放器接管：', note);
                    nativePlayEntry.click();
                } catch (e) { }
            }
            return;
        }
        updateState(targetM3u8);
        session.sourceUrl = targetM3u8;
        const rememberedHost = (() => {
            const media = document.querySelector('video');
            if (!media) return null;
            let node = media.parentElement;
            for (let i = 0; i < 3 && node; i++) {
                if (node === document.body || node === document.documentElement) break;
                if (node.offsetHeight > 80) return node;
                node = node.parentElement;
            }
            const fallback = media.parentElement;
            return fallback && fallback !== document.body ? fallback : null;
        })();
        document.querySelectorAll('video').forEach(v => {
            try { v.pause(); v.removeAttribute('src'); v.load(); } catch(e) {}
            const shell = v.closest('.video-div, .dplayer, [id^="video_"]');
            if (shell) shell.innerHTML = '';
            else v.remove();
        });
        document.querySelectorAll('.sell_line1,.sell_line2').forEach(el=>el.style.display='none');
        document.querySelectorAll('.video-div-btn').forEach(btn => {
            const host = btn.parentElement;
            if (host && host.querySelector('video')) btn.style.display = 'none';
            else btn.style.removeProperty('display');
        });
        document.querySelectorAll('.preview-title').forEach(el => {
            Array.from(el.children).forEach(child => {
                if (/(^|\s)video-div-btn(\s|$)/.test(String(child.className || ''))) return;
                const carriesPlayer = (child.querySelector && child.querySelector('video'))
                    || /(^|\s)video-div(\s|$)/.test(String(child.className || ''))
                    || String(child.id || '').startsWith('video_');
                if (!carriesPlayer) child.style.display = 'none';
            });
        });
        const hostPick = hjEnsurePlaybackHost(rememberedHost);
        const targetContainer = hostPick.container;
        const hostCreatedByScript = hostPick.created;
        activePlaybackHost = targetContainer;
        activePlaybackHostCreatedByScript = hostCreatedByScript;
        activePlaybackHostStyle = targetContainer.style.cssText;
        activePlaybackStyleUndo = [];
        const unhid = hjCoinUnhidePlaybackAncestors();
        if (unhid) hjPlayMark('点播放时还原了承载播放器的被藏祖先', { n: unhid, mode: hostPick.mode });
        targetContainer.innerHTML=''; targetContainer.style.cssText+=';display:block!important;visibility:visible!important;height:auto!important;min-height:220px!important;margin-bottom:0!important';
        makePlayerVisibleAgain(targetContainer);
        const id='clean-core-player-'+Date.now();
        targetContainer.innerHTML=`<div class="hj-player-status" style="color:#00e676;padding:10px;font-weight:bold;background:#222;text-align:center;white-space:pre-wrap;word-break:break-all">完整视频索引已验证，正在准备播放器...</div><video id="${id}" controls playsinline webkit-playsinline preload="auto" style="display:block;width:100%;min-height:220px;max-height:80vh;background:#000;touch-action:pan-y"></video>`;
        const video=targetContainer.querySelector(`#${id}`);
        session.video = video;
        const events = new AbortController();
        const listen = (name, handler, options = {}) => video.addEventListener(name, handler, { ...options, signal: events.signal });
        const retryTimers = new Set();
        let fragmentPool = null;
        let hasPlayed = false;
        let startupTimer = 0;
        activePlaybackCleanup = () => {
            events.abort();
            clearTimeout(startupTimer);
            if (domGuardTimer) { clearInterval(domGuardTimer); domGuardTimer = 0; }
            for (const timer of retryTimers) clearTimeout(timer);
            fragmentPool?.destroy();
            try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) { }
        };
        const statusEl=targetContainer.querySelector('.hj-player-status');
        const guardAnchor = { host: targetContainer, parent: targetContainer.parentNode, next: targetContainer.nextSibling };
        let domGuardTimer = setInterval(() => {
            if (!isCurrent()) return;
            try {
                const host = guardAnchor.host;
                if (!host) return;
                if (!host.isConnected) {
                    const parent = (guardAnchor.parent && guardAnchor.parent.isConnected) ? guardAnchor.parent
                        : (targetContainer.parentNode && targetContainer.parentNode.isConnected ? targetContainer.parentNode : document.body);
                    if (!parent) return;
                    const next = (guardAnchor.next && guardAnchor.next.isConnected && guardAnchor.next.parentNode === parent) ? guardAnchor.next : null;
                    parent.insertBefore(host, next);
                    hjPlayMark('播放器宿主被站点摘掉，已放回原位', { mode: host === targetContainer ? 'host' : 'other' });
                }
                if (!video.isConnected) {
                    host.appendChild(video);
                    if (statusEl && !statusEl.isConnected) host.insertBefore(statusEl, video);
                    hjPlayerReattached++;
                    hjPlayMark('播放器元素被站点摘掉，已放回宿主接续播放', { n: hjPlayerReattached, currentTime: +video.currentTime.toFixed(2) });
                } else if (host.isConnected) {
                    const rect = video.getBoundingClientRect();
                    if (rect.height < 20 || getComputedStyle(video).display === 'none') {
                        hjPlayerRevisible++;
                        targetContainer.style.display = 'block';
                        targetContainer.style.visibility = 'visible';
                        targetContainer.style.minHeight = targetContainer.style.minHeight || '220px';
                        video.style.display = 'block';
                        video.style.visibility = 'visible';
                        try { makePlayerVisibleAgain(targetContainer); } catch (e) { }
                        hjPlayMark('播放器被站点重新藏起来，已重新显示', { n: hjPlayerRevisible, h: Math.round(rect.height) });
                    }
                }
            } catch (e) { }
        }, 500);
        const setPlayerStatus=(message,isError=false)=>{
            if(!statusEl || !isCurrent())return;
            if (isError) statusEl.hidden = false;
            if (statusEl.textContent === message && statusEl.dataset.error === String(isError)) return;
            statusEl.dataset.error = String(isError);
            statusEl.textContent=message;
            statusEl.style.color=isError?'#ff5252':'#00e676';
            statusEl.style.background=isError?'#351616':'#222';
        };
        let nativeFallbackTried = false;
        let ownChainProgressed = false;                                     
        const trySiteNativePlayback = (reason) => {
            if (ownChainProgressed) {
                console.info('[海角脚本] 自建链已有进展，忽略站点原生回退：', reason);
                return false;
            }
            if (nativeFallbackTried || !nativePlayEntry) return false;
            try {
                if (!nativePlayEntry.isConnected) {
                    (nativeEntryParent || targetContainer || document.body).appendChild(nativePlayEntry);
                }
                nativeFallbackTried = true;
                console.warn('[海角脚本] 自建播放链不可用，回退站点原生播放器：', { reason, url: targetM3u8 });
                setPlayerStatus(`脚本播放链本次不可用（${reason}）。已恢复站点原生播放器入口，请点击视频区域用站点自带播放器播放。`, false);
                showToast(`脚本播放链不可用（${reason}），请点击页面上的视频区域用站点自带播放器播放`);
                nativePlayEntry.click();
                return true;
            } catch (e) {
                console.error('[海角脚本] 站点原生播放器回退失败：', e);
                return false;
            }
        };
        attachPlaybackDiagnostics(video,targetM3u8,setPlayerStatus,events.signal);
        let playRequested = false;
        let autoplayBlocked = false;
        const bufferedAhead = () => {
            try {
                const b = video.buffered;
                for (let i = 0; i < b.length; i++) {
                    if (b.start(i) - 0.25 <= video.currentTime && video.currentTime <= b.end(i)) {
                        return b.end(i) - video.currentTime;
                    }
                }
            } catch (e) { }
            return 0;
        };
        let userPaused = false;
        const tryPlay = () => {
            if (!isCurrent() || userPaused || autoplayBlocked || playRequested || video.ended) return;
            if (!canStartPlayback(video, bufferedAhead())) return;
            playRequested = true;
            hjPlayMark('调用 video.play()', { readyState: video.readyState, ahead: +bufferedAhead().toFixed(2), currentTime: +video.currentTime.toFixed(2) });
            video.play().catch(e => {
                if (!isCurrent()) return;
                playRequested = false;
                if (e && e.name === 'AbortError') return;                     
                autoplayBlocked = true;                        
                console.warn('[海角脚本] 自动播放未开始：', e);
                setPlayerStatus('媒体已准备好，请点击视频中央或播放键开始播放');
            });
        };
        listen('pause', () => {
            playRequested = false;
            if (!video.ended) { userPaused = true; hjPlayMark('保留暂停意图', { ahead: +bufferedAhead().toFixed(2) }); }
        });
        listen('play', () => { userPaused = false; autoplayBlocked = false; playRequested = true; });
        listen('playing', () => {
            hasPlayed = true;
            markStarted();
            if (statusEl) statusEl.hidden = true;
            btn.classList.add('played');
            hjSetFloatIcon(btn, 'playing');
        });
        listen('waiting', () => { if (statusEl && !video.paused) statusEl.hidden = false; });
        for (const name of ['loadeddata', 'canplay', 'progress']) listen(name, tryPlay);
        let startupFinished = false;
        const armStartupWatch = () => {
            if (startupTimer) return;
            startupTimer = setTimeout(() => {
                if (!isCurrent() || startupFinished || userPaused || autoplayBlocked) return;
                const message = `连接媒体超时 (readyState=${video.readyState}, networkState=${video.networkState})${isPreviewM3u8Url(targetM3u8) ? '\n该帖为出售内容，未购买时服务端仅下发 30 秒预览。' : ''}
请将此提示截图反馈。`;
                console.error('[海角脚本] 移动端播放启动超时：', { url: targetM3u8, readyState: video.readyState, networkState: video.networkState, userAgent: navigator.userAgent });
                setPlayerStatus(message, true);
                trySiteNativePlayback('自建链启动超时');
            }, 45000);
        };
        const markStarted = () => { startupFinished = true; if (startupTimer) clearTimeout(startupTimer); };
        listen('error', markStarted, { once: true });
        const startHlsJs=async(HlsCtor)=>{
            if(!HlsCtor?.isSupported?.()) return false;
            setPlayerStatus('正在并行准备密钥模块与媒体流...');
            let transformPromise = null;
            const transformKey = raw => {
                if (!transformPromise) transformPromise = createHaijiaoKeyTransformer(targetM3u8);
                return transformPromise.then(transform => {
                    if (!isCurrent()) throw makeAbortError();
                    return transform(raw);
                });
            };
            if (/#EXT-X-KEY:.*METHOD=AES-128/i.test(getCachedPlaybackManifest(targetM3u8)?.text || '')) {
                transformPromise = createHaijiaoKeyTransformer(targetM3u8);
                transformPromise.catch(() => {});
            }
            fragmentPool = createPlaybackFragmentPool();
            const hls=activePlaybackHls=new HlsCtor({
                loader:createGmHlsLoaderClass({ fragmentPool, transformKey: Promise.resolve(transformKey), getManifest:getPlaybackManifest }),
                enableWorker:true,lowLatencyMode:false,autoStartLoad:true,
                startFragPrefetch:false,
                maxBufferLength:30,maxMaxBufferLength:60,backBufferLength:15,maxBufferSize:32*1024*1024,
                maxBufferHole:0.5,nudgeOffset:0.1,nudgeMaxRetry:8,
                manifestLoadingTimeOut:30000,levelLoadingTimeOut:30000,fragLoadingTimeOut:60000,
                manifestLoadingMaxRetry:2,levelLoadingMaxRetry:3,fragLoadingMaxRetry:6
            });
            try { hls.config.maxLoadingDelay = 4; hls.config.maxFragLookUpTolerance = 0.25; } catch (e) { }
            let nr=0,mr=0;
            hls.on(HlsCtor.Events.MEDIA_ATTACHED,()=>{hjPlayMark('播放器已挂上 video，开始拉流');armStartupWatch();setPlayerStatus('播放器已连接，正在读取完整索引...');});
            hls.on(HlsCtor.Events.MANIFEST_LOADING,()=>{hjPlayMark('开始读取 M3U8 清单');setPlayerStatus('正在读取完整 M3U8 索引...');});
            hls.on(HlsCtor.Events.MANIFEST_PARSED,(_e,data)=>{
                ownChainProgressed=true;
                hjPlayMark('HLS 清单解析完成', { levels: data?.levels?.length || 0, url: targetM3u8 });
                setPlayerStatus('完整索引解析成功，正在缓冲前几秒...');
            });
            hls.on(HlsCtor.Events.LEVEL_LOADED,(_e,data)=>{
                hjPlayMark('媒体级清单加载完成', { fragments: data?.details?.fragments?.length || 0, totalduration: data?.details?.totalduration });
                fragmentPool.setFragments(data?.details?.live === false && !navigator.connection?.saveData ? data.details.fragments : [], !hasPlayed && video.currentTime === 0);
            });
            hls.on(HlsCtor.Events.KEY_LOADING,()=>{hjPlayMark('开始请求加密密钥');setPlayerStatus('正在请求并转换视频密钥...');});
            hls.on(HlsCtor.Events.KEY_LOADED,(_event,data)=>{
                const decryptData=data?.frag?.decryptdata || data?.frag?.decryptData;
                if(!decryptData?.key){ hjPlayMark('密钥回调但 key 为空', { sn: data?.frag?.sn }); return; }
                hjPlayMark('AES 密钥就绪（loader 已转换）', { sn: data?.frag?.sn, bytes: decryptData.key.byteLength });
                if (!hasPlayed) setPlayerStatus('视频密钥已准备，正在解密媒体分片...');
            });
            hls.on(HlsCtor.Events.FRAG_LOADING,(_e,data)=>{ if (!hasPlayed) setPlayerStatus('正在加载媒体分片 #' + (data?.frag?.sn ?? '?')); });
            hls.on(HlsCtor.Events.FRAG_BUFFERED,(_e,data)=>{
                ownChainProgressed=true;
                const ahead=bufferedAhead();
                const sn = data?.frag?.sn;
                if (sn == null || sn < 8 || sn % 50 === 0 || ahead < 1.2) {
                    hjPlayMark('分片已解密并写入缓冲 #' + sn, { ahead: +ahead.toFixed(2), readyState: video.readyState, currentTime: +video.currentTime.toFixed(2), prefetch:fragmentPool.snapshot() });
                }
                if(!hasPlayed && !userPaused && !autoplayBlocked) setPlayerStatus(`已缓冲 ${ahead.toFixed(1)} 秒，正在准备起播...`);
                tryPlay();
            });
            hls.on(HlsCtor.Events.ERROR,(_event,data)=>{
                if (!isCurrent()) return;
                const detail=data?.details || data?.type || '未知错误';
                const stall = detail==='bufferStalledError' || detail==='bufferSeekOverHole' || detail==='bufferNudgeOnStall';
                if(stall && !data?.fatal){
                    console.warn('[海角脚本] HLS 缓冲停滞（非致命，继续等分片）：', detail);
                    return;
                }
                console.error('[海角脚本] HLS 错误：',{url:targetM3u8,type:data?.type,details:data?.details,fatal:data?.fatal,response:data?.response,error:data?.error});
                const previewHint = isPreviewM3u8Url(targetM3u8)
                    ? '\n（当前为出售贴的 30 秒预览：该帖未购买，服务端不下发完整索引）'
                    : '';
                setPlayerStatus('HLS ' + (data?.fatal ? '致命' : '') + '错误：' + detail + previewHint, !!data?.fatal);
                if(!data?.fatal)return;
                if(data.type===HlsCtor.ErrorTypes.NETWORK_ERROR && nr++<2){
                    setPlayerStatus(`媒体网络错误，正在第 ${nr} 次重试...`,true);
                    const timer = setTimeout(() => { retryTimers.delete(timer); if (isCurrent()) hls.startLoad(); },700*nr);
                    retryTimers.add(timer); return;
                }
                if(data.type===HlsCtor.ErrorTypes.MEDIA_ERROR && data?.details!=='fragParsingError' && mr++<2){setPlayerStatus('媒体解码错误，正在恢复...',true);hls.recoverMediaError();return;}
                markStarted();
                session.failed = true;
                trySiteNativePlayback(`HLS ${detail}`);
            });
            hls.loadSource(targetM3u8); hls.attachMedia(video);
            return true;
        };
        const H=unsafeWindow.Hls || window.Hls;
        installHlsErrorProbe(H);
        if(H?.isSupported?.()) {
            await startHlsJs(H);
        } else if(video.canPlayType('application/vnd.apple.mpegurl')) {
            const nativeUrl=getNativeHaijiaoM3u8Url(targetM3u8);
            console.info('[海角脚本] 移动端使用站点原生 HLS 地址：',{source:targetM3u8,nativeUrl,kversion:getHaijiaoKeyVersion()});
            setPlayerStatus('当前手机仅支持原生 HLS，正在连接移动端媒体线路...');
            armStartupWatch();
            video.src=nativeUrl;
            video.load();
        } else {
            setPlayerStatus('当前浏览器既不支持 MSE/hls.js，也不支持原生 HLS',true);
            markStarted();
        }
    }
    function createOrGetDownloadStatus() {
        let panel = document.getElementById(dlStatusId);
        if (!panel) {
            panel = document.createElement('div');
            panel.id = dlStatusId;
            panel.innerHTML = '<div class="hj-dl-title"></div><div class="hj-dl-track"><div class="hj-dl-bar"></div></div>';
            document.body.appendChild(panel);
        }
        return panel;
    }
    function setDownloadStatus(message, percent) {
        const panel = createOrGetDownloadStatus();
        const title = panel.querySelector('.hj-dl-title');
        const bar = panel.querySelector('.hj-dl-bar');
        panel.classList.add('show');
        if (title) title.textContent = message || '';
        if (bar && typeof percent === 'number') {
            const safe = Math.max(0, Math.min(100, percent));
            bar.style.width = safe.toFixed(1) + '%';
        }
    }
    function hideDownloadStatus(delay = 2500) {
        setTimeout(() => {
            const panel = document.getElementById(dlStatusId);
            if (panel) panel.classList.remove('show');
        }, delay);
    }
    function maybeToast(message, minInterval = 1800) {
        const now = Date.now();
        if (now - lastDownloadToastAt > minInterval) {
            lastDownloadToastAt = now;
            showToast(message);
        }
    }
    function resolveUrl(url, baseUrl) {
        try {
            return new URL((url || '').trim(), baseUrl || location.href).href;
        } catch (e) {
            return (url || '').trim();
        }
    }
    function parseM3u8Attributes(text) {
        const attrs = {};
        if (!text) return attrs;
        text.replace(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/gi, (_, key, value) => {
            attrs[key.toUpperCase()] = String(value || '').replace(/^"|"$/g, '');
            return '';
        });
        return attrs;
    }
    function parseByteRange(value, state) {
        if (!value) return null;
        const m = String(value).replace(/"/g, '').match(/^(\d+)(?:@(\d+))?$/);
        if (!m) return null;
        const length = Number(m[1]);
        const start = m[2] != null ? Number(m[2]) : (state.nextByteRangeStart || 0);
        const end = start + length - 1;
        state.nextByteRangeStart = end + 1;
        return { start, end };
    }
    function normalizeArrayBuffer(response) {
        if (response instanceof ArrayBuffer) return response;
        if (ArrayBuffer.isView(response)) {
            return response.buffer.slice(response.byteOffset, response.byteOffset + response.byteLength);
        }
        if (typeof response === 'string') {
            const arr = new Uint8Array(response.length);
            for (let i = 0; i < response.length; i++) arr[i] = response.charCodeAt(i) & 0xff;
            return arr.buffer;
        }
        return response;
    }
    async function normalizeArrayBufferAsync(response) {
        if (response instanceof ArrayBuffer || ArrayBuffer.isView(response) || typeof response === 'string') {
            return normalizeArrayBuffer(response);
        }
        if (response && typeof response.arrayBuffer === 'function' && typeof response.size === 'number') {
            return await response.arrayBuffer();
        }
        if (response && response.buffer instanceof ArrayBuffer) {
            return response.buffer.slice(response.byteOffset || 0, (response.byteOffset || 0) + (response.byteLength || response.buffer.byteLength));
        }
        return response || new ArrayBuffer(0);
    }
    function makeAbortError(message = '下载已取消') {
        const err = new Error(message);
        err.name = 'AbortError';
        return err;
    }
    function throwIfDownloadCancelled() {
        if (downloadCancelRequested) throw makeAbortError();
    }
    function registerDownloadAborter(aborter) {
        if (typeof aborter !== 'function') return () => {};
        activeDownloadAborters.add(aborter);
        return () => activeDownloadAborters.delete(aborter);
    }
    function abortActiveDownloadRequests() {
        activeDownloadAborters.forEach(abort => {
            try { abort(); } catch (e) { }
        });
        activeDownloadAborters.clear();
    }
    function cancellableSleep(ms) {
        throwIfDownloadCancelled();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                unregister();
                resolve();
            }, ms);
            const unregister = registerDownloadAborter(() => {
                clearTimeout(timer);
                unregister();
                reject(makeAbortError());
            });
        });
    }
    function isSameOriginUrl(url) {
        try {
            return new URL(url, location.href).origin === location.origin;
        } catch (e) {
            return false;
        }
    }
    function validateDownloadRange(headers, status, responseHeaders, buffer) {
        const requested = Object.entries(headers || {}).find(([name]) => name.toLowerCase() === 'range')?.[1];
        if (!requested) return buffer;
        const expected = /^bytes=(\d+)-(\d+)$/.exec(String(requested));
        if (!expected) return buffer;
        const start = Number(expected[1]), end = Number(expected[2]);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
            throw new Error('Range 请求头格式非法');
        }
        if (status !== 206) throw new Error('Range 响应无效：需要 206，实际 ' + status);
        const getHeader = name => typeof responseHeaders?.get === 'function'
            ? responseHeaders.get(name)
            : String(responseHeaders || '').split(/\r?\n/).find(line => line.slice(0, line.indexOf(':')).trim().toLowerCase() === name.toLowerCase())?.split(':').slice(1).join(':').trim();
        const contentRange = getHeader('Content-Range') || '';
        const actual = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(contentRange);
        if (!contentRange) {
            if (buffer.byteLength === end - start + 1) return buffer;
            throw new Error('Range 响应缺少 Content-Range（跨源不可见），且字节数 ' +
                buffer.byteLength + ' 与请求区间 ' + (end - start + 1) + ' 不符');
        }
        if (!actual) throw new Error('Range 响应无效：Content-Range 格式不可识别（' + contentRange.slice(0, 60) + '）');
        const actualStart = Number(actual[1]), actualEnd = Number(actual[2]);
        const size = actual[3] === '*' ? null : Number(actual[3]);
        if (![actualStart, actualEnd].every(Number.isSafeInteger) || actualStart !== start) {
            throw new Error('Range 响应起点与请求不符');
        }
        const truncatedAtEof = size !== null && actualEnd === size - 1;
        if (actualEnd !== end && !truncatedAtEof) {
            throw new Error('Range 响应终点与请求不符（请求 ' + end + '，返回 ' + actualEnd + '）');
        }
        if (size !== null && (!Number.isSafeInteger(size) || size <= actualEnd)) {
            throw new Error('Range 响应总长度标记异常');
        }
        if (buffer.byteLength !== actualEnd - actualStart + 1) {
            throw new Error('Range 响应字节数与 Content-Range 区间不符');
        }
        return buffer;
    }
    async function fetchGet(url, responseType = 'text', headers = {}, timeoutMs = 20000) {
        throwIfDownloadCancelled();
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let timeoutId = null;
        let timedOut = false;
        const unregister = controller ? registerDownloadAborter(() => controller.abort()) : (() => {});
        try {
            if (controller) {
                timeoutId = setTimeout(() => {
                    timedOut = true;
                    controller.abort();
                }, timeoutMs);
            }
            const res = await originalFetch.call(unsafeWindow, url, {
                method: 'GET',
                headers,
                credentials: 'same-origin',
                cache: 'no-store',
                signal: controller?.signal
            });
            throwIfDownloadCancelled();
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            if (responseType !== 'arraybuffer') return await res.text();
            const buffer = await normalizeArrayBufferAsync(await res.arrayBuffer());
            throwIfDownloadCancelled();
            return validateDownloadRange(headers, res.status, res.headers, buffer);
        } catch (e) {
            if (downloadCancelRequested) throw makeAbortError();
            if (timedOut) throw new Error('网络请求超时');
            if (e?.name === 'AbortError') throw makeAbortError(e?.message || '请求已中止');
            throw e;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            unregister();
        }
    }
    function gmGet(url, responseType = 'text', headers = {}, options = {}) {
        throwIfDownloadCancelled();
        const timeoutMs = options.timeoutMs || (responseType === 'text' ? 15000 : 45000);
        const preferFetch = !!options.preferFetch;
        const forceGM = !!options.forceGM;
        if (!forceGM && (preferFetch || (isIOSLikeSafari() && responseType === 'text' && isSameOriginUrl(url))) && typeof fetch === 'function') {
            return fetchGet(url, responseType, headers, timeoutMs);
        }
        if (typeof GM_xmlhttpRequest === 'function') {
            return new Promise((resolve, reject) => {
                let settled = false;
                let request = null;
                const finish = (fn, value) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(killerTimer);
                    unregister();
                    fn(value);
                };
                const abortRequest = () => {
                    try { request?.abort?.(); } catch (e) { }
                    finish(reject, makeAbortError());
                };
                const unregister = registerDownloadAborter(abortRequest);
                const killerTimer = setTimeout(() => {
                    try { request?.abort?.(); } catch (e) { }
                    finish(reject, new Error('网络请求超时'));
                }, timeoutMs + 2000);
                try {
                    request = GM_xmlhttpRequest({
                        method: 'GET',
                        url,
                        responseType,
                        headers,
                        timeout: timeoutMs,
                        onload: (res) => {
                            if (downloadCancelRequested) {
                                finish(reject, makeAbortError());
                                return;
                            }
                            if ((res.status >= 200 && res.status < 300) || res.status === 0 || res.status === 206) {
                                if (responseType === 'text') {
                                    finish(resolve, res.responseText ?? res.response);
                                } else {
                                    normalizeArrayBufferAsync(res.response ?? res.responseText)
                                        .then(buf => {
                                            throwIfDownloadCancelled();
                                            finish(resolve, validateDownloadRange(headers, res.status, res.responseHeaders, buf));
                                        })
                                        .catch(err => finish(reject, err));
                                }
                            } else {
                                finish(reject, new Error(`HTTP ${res.status} ${res.statusText || ''}`.trim()));
                            }
                        },
                        onerror: () => finish(reject, new Error('网络请求失败')),
                        ontimeout: () => finish(reject, new Error('网络请求超时')),
                        onabort: () => finish(reject, makeAbortError())
                    });
                } catch (e) {
                    finish(reject, e);
                }
            });
        }
        return fetchGet(url, responseType, headers, timeoutMs);
    }
    async function retryRequest(factory, times = 3) {
        let lastErr = null;
        for (let i = 0; i < times; i++) {
            throwIfDownloadCancelled();
            try {
                return await factory();
            } catch (e) {
                if (downloadCancelRequested || isAbortLikeError(e)) throw makeAbortError();
                lastErr = e;
                if (i >= times - 1) break;
                await cancellableSleep(600 * (i + 1));
            }
        }
        throw lastErr || new Error('请求失败');
    }
    async function iosFetchFirstGet(url, responseType = 'text', headers = {}, timeoutMs = 12000) {
        throwIfDownloadCancelled();
        if (typeof fetch === 'function') {
            try {
                return await fetchGet(url, responseType, headers, timeoutMs);
            } catch (e) {
                if (downloadCancelRequested || isAbortLikeError(e)) throw makeAbortError();
                console.warn(`iOS fetch ${responseType} 失败，尝试 GM_xmlhttpRequest 兜底：`, e);
            }
        }
        return await gmGet(url, responseType, headers, { timeoutMs, forceGM: true });
    }
    function gmGetText(url) {
        if (isIOSLikeSafari()) {
            return retryRequest(() => iosFetchFirstGet(url, 'text', {}, 8000), 1);
        }
        return retryRequest(() => gmGet(url, 'text', {}, { timeoutMs: 20000 }), 2);
    }
    function gmGetArrayBuffer(url, range, options = {}) {
        const headers = range ? { Range: `bytes=${range.start}-${range.end}` } : {};
        const timeoutMs = options.timeoutMs || segmentRequestTimeoutMs;
        if (isIOSLikeSafari()) {
            return (async () => {
                try {
                    return await gmGet(url, 'arraybuffer', headers, { timeoutMs, forceGM: true });
                } catch (e) {
                    if (downloadCancelRequested || isAbortLikeError(e)) throw makeAbortError();
                    console.warn('iOS GM arraybuffer 失败，尝试 fetch 兜底：', e);
                    return await fetchGet(url, 'arraybuffer', headers, timeoutMs);
                }
            })();
        }
        return gmGet(url, 'arraybuffer', headers, { timeoutMs });
    }
    async function resolveMediaPlaylist(m3u8Url) {
        let currentUrl = m3u8Url;
        let selectedVariant = null;
        for (let hop = 0; hop < 5; hop++) {
            setDownloadStatus(`读取播放列表：${currentUrl}`, 2 + hop * 3);
            let text = getCachedM3u8Text(currentUrl);
            if (text) {
                const cachedInfo = analyzeM3u8TextForCandidate(text, currentUrl);
                const cachedLooksPreview = cachedInfo && !cachedInfo.isMaster && cachedInfo.segmentCount <= 1 && cachedInfo.duration > 0 && cachedInfo.duration < 90;
                if (cachedLooksPreview && /\.m3u8(?:[?#]|$)/i.test(currentUrl)) {
                    setDownloadStatus(`缓存疑似首片段，重新读取完整播放列表：${currentUrl}`, 4 + hop * 3);
                    try {
                        const freshText = await gmGetText(currentUrl);
                        if (/#EXTM3U/i.test(freshText)) {
                            const freshInfo = analyzeM3u8TextForCandidate(freshText, currentUrl);
                            if (!freshInfo || freshInfo.score >= cachedInfo.score || freshInfo.segmentCount > cachedInfo.segmentCount) {
                                text = freshText;
                                cacheM3u8Text(currentUrl, text);
                                rememberM3u8Candidate(currentUrl, text, 'fresh-after-short-cache', true);
                            }
                        }
                    } catch (e) {
                        console.warn('[海角脚本] 重新读取完整 m3u8 失败，暂用缓存：', e);
                    }
                } else {
                    setDownloadStatus(`使用已缓存播放列表：${currentUrl}`, 4 + hop * 3);
                }
            } else {
                text = await gmGetText(currentUrl);
                cacheM3u8Text(currentUrl, text);
                rememberM3u8Candidate(currentUrl, text, 'download-fetch', true);
            }
            if (!/#EXTM3U/i.test(text)) throw new Error('返回内容不是有效 M3U8');
            if (/#EXT-X-STREAM-INF/i.test(text)) {
                const lines = text.split(/\r?\n/);
                const variants = [];
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line.toUpperCase().startsWith('#EXT-X-STREAM-INF')) continue;
                    const attrs = parseM3u8Attributes(line.slice(line.indexOf(':') + 1));
                    let next = '';
                    for (let j = i + 1; j < lines.length; j++) {
                        const candidate = lines[j].trim();
                        if (candidate && !candidate.startsWith('#')) {
                            next = candidate;
                            break;
                        }
                    }
                    if (next) {
                        let area = 0;
                        if (attrs.RESOLUTION && /^\d+x\d+$/i.test(attrs.RESOLUTION)) {
                            const [w, h] = attrs.RESOLUTION.toLowerCase().split('x').map(Number);
                            area = w * h;
                        }
                        const variantUrl = resolveUrl(next, currentUrl);
                        const variant = {
                            url: variantUrl,
                            bandwidth: Number(attrs.BANDWIDTH || attrs['AVERAGE-BANDWIDTH'] || 0),
                            averageBandwidth: Number(attrs['AVERAGE-BANDWIDTH'] || 0),
                            area,
                            codecs: attrs.CODECS || ''
                        };
                        variants.push(variant);
                    }
                }
                if (!variants.length) throw new Error('主 M3U8 中没有找到可下载的视频流');
                variants.sort((a, b) => (b.bandwidth - a.bandwidth) || (b.area - a.area));
                for (const variant of variants) {
                    try {
                        setDownloadStatus(`检查 TS 分片流：${variant.url}`, 5 + hop * 3);
                        let variantText = getCachedM3u8Text(variant.url);
                        if (!variantText) {
                            variantText = await gmGetText(variant.url);
                            cacheM3u8Text(variant.url, variantText);
                            rememberM3u8Candidate(variant.url, variantText, 'variant-fetch', false);
                        }
                        if (!/#EXTM3U/i.test(variantText) || /#EXT-X-STREAM-INF/i.test(variantText)) continue;
                        const media = parseMediaPlaylist(variantText, variant.url);
                        const variantIsRawTs = media.segments.length > 0
                            && !media.hasMap
                            && media.segments.every(seg => isLikelyTsSegment(seg.url))
                            && !isSuspiciousShortMedia(media);
                        if (variantIsRawTs) {
                            selectedVariant = variant;
                            return { url: variant.url, text: variantText, variant: selectedVariant };
                        }
                        console.warn('[海角脚本] 跳过非 TS 分片变体：', {
                            url: variant.url,
                            hasMap: media.hasMap,
                            segments: media.segments.length,
                            firstSegment: media.segments[0]?.url
                        });
                    } catch (e) {
                        console.warn('[海角脚本] 检查 TS 变体失败，继续下一个：', { url: variant.url, error: e?.message || e });
                    }
                }
                selectedVariant = variants[0];
                currentUrl = selectedVariant.url;
                continue;
            }
            return { url: currentUrl, text, variant: selectedVariant };
        }
        throw new Error('M3U8 嵌套层级过深');
    }
    function parseMediaPlaylist(text, playlistUrl) {
        const lines = text.split(/\r?\n/);
        const segments = [];
        let sequence = 0;
        let currentKey = null;
        let currentMap = null;
        let pendingRange = null;
        let pendingDuration = 0;
        const rangeState = { nextByteRangeStart: 0 };
        let hasMap = false;
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            if (line.toUpperCase().startsWith('#EXTINF')) {
                const m = line.match(/^#EXTINF:([0-9.]+)/i);
                const d = m ? Number(m[1]) : 0;
                pendingDuration = Number.isFinite(d) ? d : 0;
                continue;
            }
            if (line.toUpperCase().startsWith('#EXT-X-MEDIA-SEQUENCE')) {
                const n = Number(line.split(':')[1]);
                if (Number.isFinite(n)) sequence = n;
                continue;
            }
            if (line.toUpperCase().startsWith('#EXT-X-KEY')) {
                const attrs = parseM3u8Attributes(line.slice(line.indexOf(':') + 1));
                const method = (attrs.METHOD || '').toUpperCase();
                if (!method || method === 'NONE') {
                    currentKey = null;
                } else {
                    currentKey = {
                        method,
                        uri: attrs.URI ? resolveUrl(attrs.URI, playlistUrl) : '',
                        iv: attrs.IV || '',
                        playlistUrl
                    };
                }
                continue;
            }
            if (line.toUpperCase().startsWith('#EXT-X-MAP')) {
                const attrs = parseM3u8Attributes(line.slice(line.indexOf(':') + 1));
                const mapRangeState = { nextByteRangeStart: 0 };
                currentMap = attrs.URI ? {
                    url: resolveUrl(attrs.URI, playlistUrl),
                    range: attrs.BYTERANGE ? parseByteRange(attrs.BYTERANGE, mapRangeState) : null
                } : null;
                hasMap = !!currentMap;
                continue;
            }
            if (line.toUpperCase().startsWith('#EXT-X-BYTERANGE')) {
                pendingRange = parseByteRange(line.slice(line.indexOf(':') + 1), rangeState);
                continue;
            }
            if (line.startsWith('#')) continue;
            segments.push({
                url: resolveUrl(line, playlistUrl),
                sequence,
                key: currentKey ? { ...currentKey } : null,
                map: currentMap ? { ...currentMap } : null,
                range: pendingRange,
                duration: pendingDuration
            });
            pendingRange = null;
            pendingDuration = 0;
            sequence++;
        }
        return { playlistUrl, segments, hasMap };
    }
    function getMediaDurationSeconds(media) {
        return (media?.segments || []).reduce((sum, seg) => {
            const d = Number(seg.duration);
            return sum + (Number.isFinite(d) && d > 0 ? d : 0);
        }, 0);
    }
    function parseResponseHeaders(headersText) {
        const headers = {};
        String(headersText || '').split(/\r?\n/).forEach(line => {
            const idx = line.indexOf(':');
            if (idx > 0) headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
        });
        return headers;
    }
    function gmHeadContentLength(url) {
        throwIfDownloadCancelled();
        const timeoutMs = 4000;
        if (typeof GM_xmlhttpRequest === 'function') {
            return new Promise((resolve, reject) => {
                let settled = false;
                let request = null;
                const finish = (fn, value) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(killerTimer);
                    unregister();
                    fn(value);
                };
                const abortRequest = () => {
                    try { request?.abort?.(); } catch (e) { }
                    finish(reject, makeAbortError());
                };
                const unregister = registerDownloadAborter(abortRequest);
                const killerTimer = setTimeout(() => {
                    try { request?.abort?.(); } catch (e) { }
                    finish(reject, new Error('HEAD 请求超时'));
                }, timeoutMs + 1000);
                try {
                    request = GM_xmlhttpRequest({
                        method: 'HEAD',
                        url,
                        timeout: timeoutMs,
                        onload: (res) => {
                            if (downloadCancelRequested) {
                                finish(reject, makeAbortError());
                                return;
                            }
                            if (!((res.status >= 200 && res.status < 300) || res.status === 0)) {
                                finish(reject, new Error(`HEAD HTTP ${res.status}`));
                                return;
                            }
                            const headers = parseResponseHeaders(res.responseHeaders);
                            const len = Number(headers['content-length']);
                            if (Number.isFinite(len) && len >= 0) {
                                finish(resolve, len);
                                return;
                            }
                            const range = headers['content-range'];
                            const m = range && range.match(/\/\s*(\d+)\s*$/);
                            if (m) {
                                const total = Number(m[1]);
                                if (Number.isFinite(total) && total >= 0) {
                                    finish(resolve, total);
                                    return;
                                }
                            }
                            finish(reject, new Error('HEAD 未返回 Content-Length'));
                        },
                        onerror: () => finish(reject, new Error('HEAD 请求失败')),
                        ontimeout: () => finish(reject, new Error('HEAD 请求超时')),
                        onabort: () => finish(reject, makeAbortError())
                    });
                } catch (e) {
                    finish(reject, e);
                }
            });
        }
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let timeoutId = null;
        let timedOut = false;
        const unregister = controller ? registerDownloadAborter(() => controller.abort()) : (() => {});
        return (async () => {
            try {
                if (controller) {
                    timeoutId = setTimeout(() => {
                        timedOut = true;
                        controller.abort();
                    }, timeoutMs);
                }
                const res = await originalFetch.call(unsafeWindow, url, { method: 'HEAD', credentials: 'same-origin', cache: 'no-store', signal: controller?.signal });
                throwIfDownloadCancelled();
                if (!res.ok) throw new Error(`HEAD HTTP ${res.status}`);
                const len = Number(res.headers.get('content-length'));
                if (!Number.isFinite(len) || len < 0) throw new Error('HEAD 未返回 Content-Length');
                return len;
            } catch (e) {
                if (downloadCancelRequested) throw makeAbortError();
                if (timedOut) throw new Error('HEAD 请求超时');
                if (e?.name === 'AbortError') throw makeAbortError();
                throw e;
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
                unregister();
            }
        })();
    }
    async function getRemoteContentLength(url, range) {
        if (range && Number.isFinite(range.start) && Number.isFinite(range.end)) {
            return Math.max(0, range.end - range.start + 1);
        }
        return await gmHeadContentLength(url);
    }
    async function runPool(items, limit, worker) {
        let cursor = 0;
        const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
            while (cursor < items.length) {
                if (downloadCancelRequested) throw new Error('下载已取消');
                const index = cursor++;
                await worker(items[index], index);
            }
        });
        await Promise.all(workers);
    }
    async function estimateMediaDownloadSize(media, variant) {
        const segments = media?.segments || [];
        const duration = getMediaDurationSeconds(media);
        if (!segments.length) {
            media.estimatedBytes = 0;
            media.estimatedSizeExact = false;
            media.durationSeconds = duration;
            return { bytes: 0, exact: false, text: '未知', duration };
        }
        let exactByRange = true;
        let rangeBytes = 0;
        const mapKeys = new Set();
        for (const seg of segments) {
            if (seg.map) {
                const mapKey = `${seg.map.url}#${seg.map.range?.start || 0}-${seg.map.range?.end || ''}`;
                if (!mapKeys.has(mapKey)) {
                    mapKeys.add(mapKey);
                    if (seg.map.range && Number.isFinite(seg.map.range.start) && Number.isFinite(seg.map.range.end)) {
                        rangeBytes += Math.max(0, seg.map.range.end - seg.map.range.start + 1);
                    } else {
                        exactByRange = false;
                    }
                }
            }
            if (seg.range && Number.isFinite(seg.range.start) && Number.isFinite(seg.range.end)) {
                const len = Math.max(0, seg.range.end - seg.range.start + 1);
                seg.estimatedBytes = len;
                rangeBytes += len;
            } else {
                exactByRange = false;
                break;
            }
        }
        if (exactByRange && rangeBytes > 0) {
            media.estimatedBytes = rangeBytes;
            media.estimatedSizeExact = true;
            media.durationSeconds = duration;
            setDownloadStatus(`视频大小：${formatBytes(rangeBytes)}`, 100);
            return { bytes: rangeBytes, exact: true, text: formatBytes(rangeBytes), duration, segmentCount: segments.length };
        }
        const bandwidth = Number(variant?.bandwidth || variant?.averageBandwidth || 0);
        if (duration > 0 && bandwidth > 0) {
            const bytes = Math.max(1, Math.round(duration * bandwidth / 8));
            media.estimatedBytes = bytes;
            media.estimatedSizeExact = false;
            media.durationSeconds = duration;
            setDownloadStatus(`视频大小估算：${formatBytes(bytes)}`, 100);
            return { bytes, exact: false, text: `约 ${formatBytes(bytes)}`, duration, segmentCount: segments.length, method: 'bandwidth' };
        }
        const sampleIndexes = [];
        const sampleCount = Math.min(3, segments.length);
        if (sampleCount === 1) {
            sampleIndexes.push(0);
        } else {
            for (let i = 0; i < sampleCount; i++) {
                const idx = Math.round(i * (segments.length - 1) / (sampleCount - 1));
                if (!sampleIndexes.includes(idx)) sampleIndexes.push(idx);
            }
        }
        let done = 0;
        let knownBytes = 0;
        let knownDuration = 0;
        let knownCount = 0;
        setDownloadStatus('正在快速估算视频大小：0%', 0);
        await runPool(sampleIndexes, Math.min(3, sampleIndexes.length), async (segIndex) => {
            const seg = segments[segIndex];
            try {
                const size = await getRemoteContentLength(seg.url, seg.range);
                if (Number.isFinite(size) && size > 0) {
                    seg.estimatedBytes = size;
                    knownBytes += size;
                    knownDuration += Number(seg.duration) || 0;
                    knownCount++;
                }
            } catch (e) {
            } finally {
                done++;
                const pct = (done / sampleIndexes.length) * 100;
                setDownloadStatus(`正在快速估算视频大小：${pct.toFixed(1)}%`, pct);
            }
        });
        let bytes = 0;
        if (knownBytes > 0 && duration > 0 && knownDuration > 0) {
            bytes = Math.round(knownBytes / knownDuration * duration);
        } else if (knownBytes > 0 && knownCount > 0) {
            bytes = Math.round(knownBytes / knownCount * segments.length);
        }
        media.estimatedBytes = bytes;
        media.estimatedSizeExact = false;
        media.durationSeconds = duration;
        return {
            bytes,
            exact: false,
            text: bytes > 0 ? `约 ${formatBytes(bytes)}` : '未知',
            duration,
            segmentCount: segments.length,
            method: 'sample'
        };
    }
    function hexToBytes(hex) {
        let clean = String(hex || '').replace(/^0x/i, '').replace(/[^0-9a-f]/gi, '');
        if (clean.length % 2) clean = '0' + clean;
        const out = new Uint8Array(clean.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
        return out;
    }
    function sequenceToIv(sequence) {
        const iv = new Uint8Array(16);
        let n = BigInt(sequence || 0);
        for (let i = 15; i >= 0; i--) {
            iv[i] = Number(n & 0xffn);
            n >>= 8n;
        }
        return iv;
    }
    const aesKeyCache = new Map();
    async function getAesCryptoKey(keyInfo) {
        if (!keyInfo?.uri) throw new Error('加密分片缺少密钥地址');
        if (aesKeyCache.has(keyInfo.uri)) return await aesKeyCache.get(keyInfo.uri);
        const keyPromise = (async () => {
            const requestUrl = rewriteHaijiaoKeyUrl(keyInfo.uri);
            const rawKey = new Uint8Array(normalizeArrayBuffer(await gmGetArrayBuffer(requestUrl)));
            const cacheKey = `${requestUrl}|${keyInfo.playlistUrl || ''}`;
            let transformedKey = haijiaoTransformedKeyCache.get(cacheKey);
            if (!transformedKey) {
                transformedKey = (await createHaijiaoKeyTransformer(keyInfo.playlistUrl || capturedM3u8Url))(rawKey);
                haijiaoTransformedKeyCache.set(cacheKey, transformedKey);
            }
            return await crypto.subtle.importKey('raw', normalizeArrayBuffer(transformedKey), { name: 'AES-CBC' }, false, ['decrypt']);
        })();
        aesKeyCache.set(keyInfo.uri, keyPromise);
        try {
            return await keyPromise;
        } catch (e) {
            aesKeyCache.delete(keyInfo.uri);
            throw e;
        }
    }
    async function decryptSegmentIfNeeded(buffer, keyInfo, sequence) {
        if (!keyInfo) return buffer;
        if ((keyInfo.method || '').toUpperCase() !== 'AES-128') {
            throw new Error(`暂不支持的 HLS 加密方式：${keyInfo.method}`);
        }
        const cryptoKey = await getAesCryptoKey(keyInfo);
        const ivBytes = keyInfo.iv ? hexToBytes(keyInfo.iv) : sequenceToIv(sequence);
        const iv = new Uint8Array(16);
        iv.set(ivBytes.slice(Math.max(0, ivBytes.length - 16)), Math.max(0, 16 - ivBytes.length));
        return await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, normalizeArrayBuffer(buffer));
    }
    async function downloadSegmentPayload(segment) {
        const buf = await normalizeArrayBufferAsync(await gmGetArrayBuffer(segment.url, segment.range, { timeoutMs: segmentRequestTimeoutMs }));
        return await decryptSegmentIfNeeded(buf, segment.key, segment.sequence);
    }
    function compactErrorMessage(e) {
        return String(e?.message || e || '未知错误').replace(/\s+/g, ' ').slice(0, 180);
    }
    function getSegmentRetryDelayMs(attempt) {
        const backoff = Math.round(segmentRetryBaseDelayMs * Math.pow(1.55, Math.max(0, attempt - 1)));
        const jitter = Math.floor(Math.random() * 350);
        return Math.min(segmentRetryMaxDelayMs, backoff + jitter);
    }
    let lastSegmentRetryStatusAt = 0;
    async function downloadSegmentPayloadWithRetry(segment, index, total) {
        let lastErr = null;
        for (let attempt = 1; attempt <= segmentMaxRetries; attempt++) {
            throwIfDownloadCancelled();
            try {
                const payload = await downloadSegmentPayload(segment);
                if (attempt > 1) {
                    console.info(`[海角脚本] 分片 ${index + 1}/${total} 第 ${attempt} 次尝试成功`);
                }
                return payload;
            } catch (e) {
                if (downloadCancelRequested || isAbortLikeError(e)) throw makeAbortError();
                lastErr = e;
                if (attempt >= segmentMaxRetries) break;
                const delay = getSegmentRetryDelayMs(attempt);
                const errMsg = compactErrorMessage(e);
                console.warn(`[海角脚本] 分片 ${index + 1}/${total} 第 ${attempt} 次下载失败，${(delay / 1000).toFixed(1)} 秒后重试`, {
                    url: segment?.url,
                    error: errMsg
                });
                const now = Date.now();
                if (now - lastSegmentRetryStatusAt > 700) {
                    lastSegmentRetryStatusAt = now;
                    setDownloadStatus(`分片 ${index + 1}/${total} 下载失败，正在重试 ${attempt + 1}/${segmentMaxRetries}：${errMsg}`);
                }
                await cancellableSleep(delay);
            }
        }
        const err = new Error(`分片 ${index + 1}/${total} 连续 ${segmentMaxRetries} 次下载失败：${compactErrorMessage(lastErr)}。建议把并发调到 6~8 后重试。`);
        err.originalError = lastErr;
        err.segmentIndex = index;
        err.segmentUrl = segment?.url || '';
        throw err;
    }
    function sanitizeFileName(name) {
        return String(name || '')
            .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
            .replace(/[\x00-\x1f]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/[. ]+$/g, '')
            .trim();
    }
    function stripSiteSuffix(title) {
        return String(title || '')
            .replace(/\s*[-_|｜—–]+\s*(海角.*|haijiao.*)$/i, '')
            .replace(/^(海角.*?|haijiao.*?)\s*[-_|｜—–]+\s*/i, '')
            .replace(/\s*[-_|｜—–]+\s*(详情|帖子详情|视频详情)$/i, '');
    }
    function isGoodTitleText(text) {
        return !!text
            && text.length >= 2
            && !/^(详情|帖子详情|加载中|海角|倫理之愛|伦理之爱)$/i.test(text)
            && !/(售价|鑽石|钻石|已购买|购买|99\+|评论|点赞|浏览)/i.test(text);
    }
    function readElementOwnText(el) {
        if (!el) return '';
        const own = Array.from(el.childNodes || [])
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent || '')
            .join(' ')
            .trim();
        if (own) return own;
        const directSpan = Array.from(el.children || []).find(child => child.tagName && child.tagName.toLowerCase() === 'span');
        if (directSpan && (directSpan.textContent || '').trim()) return directSpan.textContent.trim();
        try {
            const clone = el.cloneNode(true);
            clone.querySelectorAll('small, .extra, .currency, .buypost-btn, .title-type, [class*="extra"], [class*="currency"], [class*="tag"]').forEach(node => node.remove());
            return (clone.textContent || '').trim();
        } catch (e) {
            return (el.textContent || '').trim();
        }
    }
    function getDomTitleText() {
        const selectors = [
            '.title-box .title-text', '.title-text',
            'h2.position-relative > span:first-child', 'h2 > span:first-child', '.position-relative > span:first-child',
            '.post-title', '.topic-title', '.article-title', '.detail-title', '.content-title',
            '[class*="title-text"]', '[class*="post-title"]', '[class*="topic-title"]', '[class*="article-title"]', '[class*="detail-title"]',
            'h1', 'h2'
        ];
        for (const selector of selectors) {
            const nodes = document.querySelectorAll(selector);
            for (const el of nodes) {
                const text = sanitizeFileName(stripSiteSuffix(readElementOwnText(el)));
                if (isGoodTitleText(text)) return text;
            }
        }
        return '';
    }
    function getPageTitleForFilename() {
        const domTitle = getDomTitleText();
        if (domTitle) return domTitle;
        const captured = sanitizeFileName(stripSiteSuffix(capturedVideoTitle || ''));
        if (isGoodTitleText(captured)) return captured;
        const meta = document.querySelector('meta[property="og:title"], meta[name="twitter:title"], meta[name="title"]');
        const metaTitle = sanitizeFileName(stripSiteSuffix(meta?.content || ''));
        if (isGoodTitleText(metaTitle)) return metaTitle;
        return sanitizeFileName(stripSiteSuffix(document.title || '')) || 'haijiao_video';
    }
    function buildDownloadFileName() {
        const title = getPageTitleForFilename().slice(0, 100) || 'haijiao_video';
        return /\.ts$/i.test(title) ? title : `${title.replace(/\.[A-Za-z0-9]{1,8}$/i, '')}.ts`;
    }
    function replaceFileExtension(filename, extension) {
        const ext = String(extension || '').replace(/^\./, '') || 'ts';
        const base = String(filename || 'haijiao_video').replace(/\.[A-Za-z0-9]{1,8}$/i, '');
        return `${base}.${ext}`;
    }
    function getPageNavigator() {
        return (unsafeWindow && unsafeWindow.navigator) || window.navigator || navigator;
    }
    function isIOSLikeSafari() {
        const nav = getPageNavigator();
        const ua = String(nav.userAgent || '');
        const platform = String(nav.platform || '');
        return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && Number(nav.maxTouchPoints || 0) > 1);
    }
    function escapeHtml(text) {
        return String(text || '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }
    function openBlobUrlInNewTab(url) {
        let opened = null;
        try { opened = window.open(url, '_blank'); } catch (e) { }
        if (opened) return true;
        try {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 1000);
            return true;
        } catch (e) { }
        try {
            window.location.href = url;
            return true;
        } catch (e) { }
        return false;
    }
    async function shareVideoBlob(blob, filename) {
        const nav = getPageNavigator();
        const FileCtor = unsafeWindow.File || window.File;
        if (typeof nav.share !== 'function') throw new Error('当前浏览器没有可调用的分享面板');
        if (typeof FileCtor !== 'function') throw new Error('当前浏览器不支持 File 分享');
        const fileType = blob?.type || 'video/mp2t';
        const file = new FileCtor([blob], filename, { type: fileType });
        let shareData = { files: [file] };
        if (typeof nav.canShare === 'function') {
            let canShare = false;
            try { canShare = nav.canShare(shareData); } catch (e) { canShare = false; }
            if (!canShare) {
                const titledShareData = { files: [file], title: filename };
                try { canShare = nav.canShare(titledShareData); } catch (e) { canShare = false; }
                if (canShare) shareData = titledShareData;
            }
            if (!canShare) throw new Error('当前浏览器不能直接分享此视频文件');
        }
        await nav.share(shareData);
    }
    function showIosSavePanel(blob, filename, objectUrl) {
        const oldPanel = document.getElementById('hj-ios-save-panel-mobile');
        if (oldPanel) oldPanel.remove();
        const panel = document.createElement('div');
        const isRawTs = /\.ts$/i.test(filename) || blob?.type === 'video/mp2t';
        const outputKind = isRawTs ? '原始 TS 视频' : '视频文件';
        panel.id = 'hj-ios-save-panel-mobile';
        panel.style.cssText = [
            'position:fixed', 'left:10px', 'right:10px', 'bottom:12px',
            'z-index:1000002', 'background:rgba(12,12,12,.96)', 'color:#fff',
            'border-radius:14px', 'box-shadow:0 6px 24px rgba(0,0,0,.5)',
            'padding:14px', 'font-size:14px', 'line-height:1.45'
        ].join(';');
        panel.innerHTML = `
            <div style="font-weight:700;font-size:16px;margin-bottom:6px;">${outputKind} 已生成，等待保存</div>
            <div style="word-break:break-all;margin-bottom:8px;">文件名：${escapeHtml(filename)}（${formatBytes(blob.size)}）</div>
            <div style="opacity:.86;margin-bottom:10px;">
                iOS Safari 没有 showSaveFilePicker，不能像电脑 Chrome 那样边下载边写入“文件”。
                当前已使用 iOS 兼容模式生成${outputKind}，请点击“分享/存到文件”，在系统分享面板里选择“存储到文件”。
                如果分享不可用，就点“打开视频”，再用 Safari 自带分享按钮保存。
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" class="hj-ios-share" style="flex:1;min-width:120px;border:0;border-radius:10px;padding:10px;background:#34c759;color:#fff;font-weight:700;">分享/存到文件</button>
                <button type="button" class="hj-ios-open" style="flex:1;min-width:92px;border:0;border-radius:10px;padding:10px;background:#007aff;color:#fff;font-weight:700;">打开视频</button>
                <button type="button" class="hj-ios-close" style="width:72px;border:0;border-radius:10px;padding:10px;background:#555;color:#fff;">关闭</button>
            </div>
        `;
        document.body.appendChild(panel);
        const shareBtn = panel.querySelector('.hj-ios-share');
        const openBtn = panel.querySelector('.hj-ios-open');
        const closeBtn = panel.querySelector('.hj-ios-close');
        if (shareBtn) {
            shareBtn.addEventListener('click', async () => {
                shareBtn.disabled = true;
                shareBtn.textContent = '正在打开...';
                try {
                    await shareVideoBlob(blob, filename);
                    shareBtn.textContent = '已打开分享';
                    showToast('已打开系统分享面板，请选择“存储到文件”');
                } catch (e) {
                    shareBtn.disabled = false;
                    shareBtn.textContent = '分享/存到文件';
                    if (isAbortLikeError(e)) {
                        showToast('已取消分享');
                    } else {
                        console.warn('iOS 分享失败，改为打开 Blob 视频：', e);
                        showToast('分享不可用，改为打开视频页面');
                        openBlobUrlInNewTab(objectUrl);
                    }
                }
            });
        }
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                const ok = openBlobUrlInNewTab(objectUrl);
                showToast(ok ? '已打开视频，请用 Safari 分享按钮保存' : '打开失败，请尝试“分享/存到文件”');
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => panel.remove());
        }
    }
    function triggerAnchorDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
    }
    async function saveBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        if (isIOSLikeSafari()) {
            showIosSavePanel(blob, filename, url);
            setTimeout(() => {
                try { URL.revokeObjectURL(url); } catch (e) { }
            }, 10 * 60 * 1000);
            const kind = 'TS';
            return { mode: 'ios-panel', message: `${kind} 已生成，请点击页面底部“分享/存到文件”保存` };
        }
        try {
            triggerAnchorDownload(url, filename);
            setTimeout(() => {
                try { URL.revokeObjectURL(url); } catch (e) { }
            }, 10000);
            const kind = 'TS';
            return { mode: 'download', message: `浏览器已开始保存 ${kind}` };
        } catch (e) {
            console.warn('a[download] 保存失败，改为打开 Blob URL：', e);
            const ok = openBlobUrlInNewTab(url);
            setTimeout(() => {
                try { URL.revokeObjectURL(url); } catch (err) { }
            }, 60 * 1000);
            const kind = 'TS';
            return { mode: 'open', message: ok ? `已打开 ${kind}，请在新页面保存` : `${kind} 已生成，但自动打开失败` };
        }
    }
    function getNativeSavePicker() {
        if (typeof unsafeWindow.showSaveFilePicker === 'function') {
            return { picker: unsafeWindow.showSaveFilePicker, target: unsafeWindow };
        }
        if (typeof window.showSaveFilePicker === 'function') {
            return { picker: window.showSaveFilePicker, target: window };
        }
        return null;
    }
    function canUseNativeFileWriter() {
        return !!getNativeSavePicker() && typeof WritableStream !== 'undefined';
    }
    function isAbortLikeError(e) {
        return e?.name === 'AbortError' || /abort|cancel|取消/i.test(String(e?.message || e || ''));
    }
    async function openTsFileHandle(filename) {
        const pickerInfo = getNativeSavePicker();
        if (!pickerInfo) return null;
        const { picker, target } = pickerInfo;
        return await picker.call(target, {
            suggestedName: replaceFileExtension(filename, 'ts'),
            types: [{
                description: 'TS 视频文件',
                accept: { 'video/mp2t': ['.ts'] }
            }],
            excludeAcceptAllOption: false
        });
    }
    async function getFileSnapshot(fileHandle) {
        if (!fileHandle || typeof fileHandle.getFile !== 'function') return null;
        try {
            const file = await fileHandle.getFile();
            return { name: file.name, size: file.size, lastModified: file.lastModified };
        } catch (e) {
            return null;
        }
    }
    async function cleanupPickedFileQuietly(fileHandle, initialSnapshot) {
        if (!fileHandle) return false;
        try {
            const current = await getFileSnapshot(fileHandle);
            if ((!initialSnapshot || initialSnapshot.size === 0) && current && current.size === 0 && typeof fileHandle.remove === 'function') {
                await fileHandle.remove();
                return true;
            }
        } catch (e) { }
        return false;
    }
    async function writeChunkToFile(writer, chunk) {
        if (!writer || !chunk) return;
        const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        if (!data.byteLength) return;
        await writer.write(data);
    }
    async function abortWritableQuietly(writer) {
        if (!writer) return;
        try { await writer.abort(); } catch (e) { }
    }
    function isLikelyTsSegment(url) {
        return /\.ts(?:[?#]|$)/i.test(url);
    }
    function formatDuration(seconds) {
        seconds = Math.max(0, Math.round(Number(seconds) || 0));
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const sec = seconds % 60;
        return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
            : `${m}:${String(sec).padStart(2, '0')}`;
    }
    function formatBytes(bytes) {
        bytes = Number(bytes) || 0;
        if (bytes <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = bytes;
        let unit = 0;
        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024;
            unit++;
        }
        return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
    }
    function formatPercent(percent) {
        const safe = Math.max(0, Math.min(100, Number(percent) || 0));
        return safe >= 99.95 ? '100' : safe.toFixed(1);
    }
    function formatProgressStatus(prefix, percent, doneBytes, totalBytes, concurrency) {
        const pct = formatPercent(percent);
        const sizePart = totalBytes > 0 ? `，${formatBytes(doneBytes)}/${formatBytes(totalBytes)}` : '';
        const concurrencyPart = concurrency > 1 ? `，并发${concurrency}路` : '';
        return `${prefix}：${pct}%${sizePart}${concurrencyPart}`;
    }
    function getSegmentDuration(media, index) {
        const d = Number(media?.segments?.[index]?.duration);
        if (Number.isFinite(d) && d > 0) return d;
        const durations = (media?.segments || []).map(seg => Number(seg.duration)).filter(v => Number.isFinite(v) && v > 0);
        if (durations.length) return durations.reduce((a, b) => a + b, 0) / durations.length;
        return 6;
    }
    function getEffectiveConcurrency(total) {
        const configured = Number(segmentDownloadConcurrency) || 1;
        return Math.max(1, Math.min(configured, total || 1));
    }
    function getEffectiveDownloadConcurrency(total, saveMode = 'native') {
        const configured = Number(segmentDownloadConcurrency) || 1;
        return Math.max(1, Math.min(configured, total || 1));
    }
    async function processSegmentsInOrder(media, concurrency, onSegment) {
        const total = media.segments.length;
        const limit = getEffectiveConcurrency(Math.min(concurrency || segmentDownloadConcurrency, total));
        const results = new Map();
        let nextToDownload = 0;
        let nextToConsume = 0;
        let bufferedBytes = 0;
        const maxAhead = Math.max(1, limit * 2);
        const maxBufferedBytes = 16 * 1024 * 1024;
        let failed = null;
        let finished = false;
        const assertActive = () => {
            if (failed) throw failed;
            if (finished || downloadCancelRequested) throw makeAbortError();
        };
        const waiters = new Set();
        const notify = () => {
            const pending = Array.from(waiters);
            waiters.clear();
            pending.forEach(resolve => resolve());
        };
        const waitForResult = () => new Promise(resolve => { waiters.add(resolve); });
        let rejectCancelled;
        const cancelled = new Promise((_, reject) => { rejectCancelled = reject; });
        cancelled.catch(() => {});
        const unregister = registerDownloadAborter(() => {
            failed = failed || makeAbortError();
            rejectCancelled(failed);
            notify();
        });
        const worker = async () => {
            while (!failed && !downloadCancelRequested) {
                while (!failed && !downloadCancelRequested && nextToDownload < total &&
                    (nextToDownload >= nextToConsume + maxAhead || bufferedBytes >= maxBufferedBytes)) {
                    await waitForResult();
                }
                if (failed || downloadCancelRequested) break;
                const index = nextToDownload++;
                if (index >= total) break;
                try {
                    const payload = await downloadSegmentPayloadWithRetry(media.segments[index], index, total);
                    if (failed || downloadCancelRequested) break;
                    results.set(index, payload);
                    bufferedBytes += Number(payload?.byteLength) || 0;
                    notify();
                } catch (e) {
                    failed = isAbortLikeError(e) ? makeAbortError(e?.message || '下载已取消') : e;
                    notify();
                    break;
                }
            }
        };
        const workers = Array.from({ length: limit }, () => worker());
        try {
            for (let index = 0; index < total; index++) {
                while (!results.has(index)) {
                    if (downloadCancelRequested) throw makeAbortError();
                    if (failed) throw failed;
                    await waitForResult();
                }
                const payload = results.get(index);
                if (downloadCancelRequested) throw makeAbortError();
                if (failed) throw failed;
                await Promise.race([onSegment(index, payload, limit, assertActive), cancelled]);
                results.delete(index);
                bufferedBytes -= Number(payload?.byteLength) || 0;
                nextToConsume = index + 1;
                notify();
            }
            await Promise.all(workers);
            if (failed) throw failed;
        } catch (e) {
            if (!failed) failed = e;
            abortActiveDownloadRequests();
            throw e;
        } finally {
            finished = true;
            unregister();
            results.clear();
            bufferedBytes = 0;
            notify();
        }
    }
    async function downloadTsHlsAsRawTs(media, filename, saveMode = 'ios-memory') {
        const chunks = [];
        let inputBytesDone = 0;
        let mediaTimeSeconds = 0;
        const estimatedBytes = Number(media.estimatedBytes) || 0;
        const total = media.segments.length;
        const concurrency = getEffectiveDownloadConcurrency(total, saveMode);
        const outputName = replaceFileExtension(filename, 'ts');
        console.info('[海角脚本] TS 直存模式：多线程下载分片并按顺序合并为原始 TS。', {
            outputName,
            segments: total,
            playlistUrl: media.playlistUrl
        });
        await processSegmentsInOrder(media, concurrency, async (i, payload, limit, assertActive) => {
            assertActive();
            const data = new Uint8Array(await normalizeArrayBufferAsync(payload));
            assertActive();
            if (!data.byteLength) throw new Error(`分片 ${i + 1} 数据为空`);
            inputBytesDone += data.byteLength;
            chunks.push(data);
            mediaTimeSeconds += getSegmentDuration(media, i);
            const percent = estimatedBytes > 0
                ? Math.min(99.9, (inputBytesDone / estimatedBytes) * 100)
                : ((i + 1) / total) * 100;
            setDownloadStatus(formatProgressStatus('TS 分片下载中', percent, inputBytesDone, estimatedBytes, limit), percent);
            maybeToast(`下载进度 ${formatPercent(percent)}%`);
        });
        if (!chunks.length) throw new Error('没有下载到 TS 数据');
        setDownloadStatus('正在合成原始 TS 文件：99%', 99);
        const blob = new Blob(chunks, { type: 'video/mp2t' });
        const saveResult = await saveBlob(blob, outputName);
        const actionHint = saveResult?.mode === 'ios-panel' ? '，请点页面底部“分享/存到文件”' : '';
        setDownloadStatus(`已生成：${outputName} (${formatBytes(blob.size)}，时长约 ${formatDuration(mediaTimeSeconds)})${actionHint}`, 100);
    }
    async function downloadTsHlsAsRawTsToDisk(media, filename, fileHandle, initialSnapshot) {
        let writer = null;
        let bytesWritten = 0;
        let inputBytesDone = 0;
        let mediaTimeSeconds = 0;
        const estimatedBytes = Number(media.estimatedBytes) || 0;
        const total = media.segments.length;
        const concurrency = getEffectiveConcurrency(total);
        const outputName = replaceFileExtension(filename, 'ts');
        const ensureWriter = async (assertActive) => {
            assertActive();
            if (!writer) {
                const opened = await fileHandle.createWritable();
                try { assertActive(); } catch (e) {
                    await abortWritableQuietly(opened);
                    throw e;
                }
                writer = opened;
            }
            return writer;
        };
        try {
            await processSegmentsInOrder(media, concurrency, async (i, payload, limit, assertActive) => {
                assertActive();
                const data = new Uint8Array(await normalizeArrayBufferAsync(payload));
                assertActive();
                if (!data.byteLength) throw new Error(`分片 ${i + 1} 数据为空`);
                const w = await ensureWriter(assertActive);
                assertActive();
                await writeChunkToFile(w, data);
                assertActive();
                bytesWritten += data.byteLength;
                inputBytesDone += data.byteLength;
                mediaTimeSeconds += getSegmentDuration(media, i);
                const percent = estimatedBytes > 0
                    ? Math.min(99.9, (inputBytesDone / estimatedBytes) * 100)
                    : ((i + 1) / total) * 100;
                setDownloadStatus(formatProgressStatus('TS 分片写入中', percent, inputBytesDone, estimatedBytes, limit), percent);
                maybeToast(`下载进度 ${formatPercent(percent)}%`);
            });
            if (!bytesWritten) throw new Error('没有下载到 TS 数据');
            setDownloadStatus('正在关闭 TS 文件：99%', 99);
            if (writer) await writer.close();
            setDownloadStatus(`已保存：${outputName} (${formatBytes(bytesWritten)}，时长约 ${formatDuration(mediaTimeSeconds)})`, 100);
        } catch (e) {
            await abortWritableQuietly(writer);
            if (isAbortLikeError(e)) await cleanupPickedFileQuietly(fileHandle, initialSnapshot);
            throw e;
        }
    }
    async function buildDownloadInfoFromM3u8Url(m3u8Url, filename) {
        if (isPreviewM3u8Url(m3u8Url)) {
            const fullFromPreview = deriveFullM3u8UrlFromPreview(m3u8Url);
            if (fullFromPreview && fullFromPreview !== m3u8Url) {
                console.warn('[海角脚本] 解析前发现 preview M3U8，改用完整索引候选：', { preview: m3u8Url, full: fullFromPreview });
                m3u8Url = fullFromPreview;
            }
        }
        const playlist = await resolveMediaPlaylist(m3u8Url);
        const media = parseMediaPlaylist(playlist.text, playlist.url);
        if (!media.segments.length) throw new Error('M3U8 中没有找到视频分片');
        const parsedDuration = getMediaDurationSeconds(media);
        const allTs = media.segments.every(seg => isLikelyTsSegment(seg.url));
        setDownloadStatus(`已解析播放列表：${media.segments.length} 个分片，时长约 ${parsedDuration > 0 ? formatDuration(parsedDuration) : '未知'}`, 8);
        console.info('[海角脚本] 下载解析结果：', {
            inputUrl: m3u8Url,
            playlistUrl: playlist.url,
            segments: media.segments.length,
            duration: parsedDuration,
            hasMap: media.hasMap,
            allTs,
            firstSegment: media.segments[0]?.url,
            variant: playlist.variant
        });
        const sizeInfo = await estimateMediaDownloadSize(media, playlist.variant);
        return {
            filename: filename || buildDownloadFileName(),
            playlist,
            media,
            allTs,
            sizeInfo,
            sizeText: sizeInfo.text,
            durationText: sizeInfo.duration > 0 ? formatDuration(sizeInfo.duration) : '未知',
            segmentCount: media.segments.length
        };
    }
    async function prepareCurrentM3u8DownloadInfo(filename) {
        if (!capturedM3u8Url) throw new Error('尚未捕获到 M3U8 地址');
        let targetUrl = getPreferredDownloadM3u8Url(capturedM3u8Url);
        const candidateUrls = getDownloadM3u8CandidateUrls(targetUrl);
        let info = null;
        let selectedUrl = '';
        let lastError = null;
        for (const candidateUrl of candidateUrls) {
            try {
                const candidateInfo = await buildDownloadInfoFromM3u8Url(candidateUrl, filename);
                const candidateIsTs = candidateInfo.allTs && !candidateInfo.media.hasMap;
                if (!info) {
                    info = candidateInfo;
                    selectedUrl = candidateUrl;
                }
                if (candidateIsTs && !isSuspiciousShortMedia(candidateInfo.media)) {
                    info = candidateInfo;
                    selectedUrl = candidateUrl;
                    break;
                }
                console.warn('[海角脚本] 当前候选不是可直存的 TS 分片流，继续尝试备用索引：', {
                    candidateUrl,
                    allTs: candidateInfo.allTs,
                    hasMap: candidateInfo.media.hasMap,
                    segments: candidateInfo.segmentCount,
                    duration: candidateInfo.sizeInfo?.duration
                });
            } catch (e) {
                lastError = e;
                console.warn('[海角脚本] 下载候选 M3U8 解析失败，尝试下一个：', { candidateUrl, error: e?.message || e });
            }
        }
        if (!info) throw lastError || new Error('没有可用的下载 M3U8');
        if (isSuspiciousShortMedia(info.media)) {
            const better = getBestKnownM3u8Candidate(true);
            if (better && better.url && better.url !== selectedUrl) {
                console.warn('[海角脚本] 当前播放列表疑似只有首片段，尝试切换到最佳候选：', better);
                try {
                    const retryInfo = await buildDownloadInfoFromM3u8Url(better.url, filename);
                    if (!isSuspiciousShortMedia(retryInfo.media) || retryInfo.segmentCount > info.segmentCount) {
                        updateState(better.url);
                        info = retryInfo;
                    }
                } catch (e) {
                    console.warn('[海角脚本] 最佳候选重试失败，继续使用当前列表：', e);
                }
            }
        }
        return info;
    }
    async function downloadCurrentM3u8AsTs(saveContext = {}) {
        if (!capturedM3u8Url) throw new Error('尚未捕获到 M3U8 地址');
        aesKeyCache.clear();
        haijiaoTransformedKeyCache.clear();
        const filename = replaceFileExtension(saveContext.filename || buildDownloadFileName(), 'ts');
        const fileHandle = saveContext.fileHandle || null;
        const initialSnapshot = saveContext.initialSnapshot || null;
        const saveMode = saveContext.saveMode || (fileHandle ? 'native' : (isIOSLikeSafari() ? 'ios-memory' : 'memory'));
        try {
            const info = saveContext.downloadInfo || await prepareCurrentM3u8DownloadInfo(filename);
            const media = info.media;
            const allTs = info.allTs && !media.hasMap;
            if (!allTs) {
                throw new Error('当前播放列表不是 TS 分片流，无法直存为 .ts');
            }
            if (fileHandle) {
                setDownloadStatus(`准备低内存 TS 下载：0%（${info.sizeText}，并发 ${getEffectiveConcurrency(media.segments.length)} 路）`, 0);
                await downloadTsHlsAsRawTsToDisk(media, filename, fileHandle, initialSnapshot);
            } else {
                const concurrency = getEffectiveDownloadConcurrency(media.segments.length, saveMode);
                const prefix = saveMode === 'ios-memory' ? '准备 iOS TS 兼容保存' : '准备内存合成 TS';
                setDownloadStatus(`${prefix}：0%（${info.sizeText}，并发 ${concurrency} 路）`, 0);
                await downloadTsHlsAsRawTs(media, filename, saveMode);
            }
        } catch (e) {
            if (fileHandle) await cleanupPickedFileQuietly(fileHandle, initialSnapshot);
            throw e;
        }
    }
    async function handleDownloadButtonClick(dlBtn) {
        dlBtn.classList.add('active');
        setTimeout(() => dlBtn.classList.remove('active'), 100);
        if (isDownloading) {
            if (confirm('当前正在下载，是否取消？')) {
                downloadCancelRequested = true;
                abortActiveDownloadRequests();
                dlBtn.classList.remove('done');
                dlBtn.classList.add('busy');
                hjSetFloatIcon(dlBtn, 'downloading', '取消中');
                setDownloadStatus('正在取消下载：已中止当前网络请求...', 0);
                showToast('正在取消下载...');
            }
            return;
        }
        if (!capturedM3u8Url) {
            showToast('后台尚未捕获到 M3U8，先等待页面加载或点播放探寻。');
            return;
        }
        if (isPreviewM3u8Url(capturedM3u8Url)) {
            showToast('该帖为「出售内容」：服务端只下发 30 秒预览，将下载预览片段');
        }
        const filename = buildDownloadFileName();
        const supportsNativeWriter = canUseNativeFileWriter();
        const iosCompatMode = isIOSLikeSafari() && !supportsNativeWriter;
        const fallbackMode = iosCompatMode ? 'ios-memory' : 'memory';
        isDownloading = true;
        downloadCancelRequested = false;
        dlBtn.classList.add('busy');
        dlBtn.classList.remove('done');
        hjSetFloatIcon(dlBtn, 'downloading', '0%');
        setDownloadStatus(
            supportsNativeWriter
                ? '准备低内存保存：请选择 TS 保存位置...'
                : (iosCompatMode ? 'iOS TS兼容保存：正在读取视频信息...' : '低内存写盘不可用：正在读取视频信息...'),
            0
        );
        let nativeFileHandle = null;
        let initialSnapshot = null;
        let downloadInfo = null;
        const progressTimer = setInterval(() => {
            const bar = document.querySelector(`#${dlStatusId} .hj-dl-bar`);
            if (bar && isDownloading) {
                const width = Number((bar.style.width || '0').replace('%', '')) || 0;
                hjSetFloatIcon(dlBtn, 'downloading', Math.floor(width) + '%');
            }
        }, 300);
        try {
            if (supportsNativeWriter) {
                nativeFileHandle = await openTsFileHandle(filename);
                if (!nativeFileHandle) throw new Error('没有拿到文件句柄');
                initialSnapshot = await getFileSnapshot(nativeFileHandle);
                setDownloadStatus('正在读取视频信息：0%', 0);
                downloadInfo = await prepareCurrentM3u8DownloadInfo(filename);
                const sizeLine = downloadInfo.sizeText || '未知';
                const durationLine = downloadInfo.durationText || '未知';
                const promptText = `是否开始低内存下载并保存为 TS？

默认文件名：${filename}
视频大小：${sizeLine}
视频时长：${durationLine}
分片数量：${downloadInfo.segmentCount}
并发下载：${getEffectiveConcurrency(downloadInfo.media.segments.length)} 路

注：将直接合并原始 TS 分片。`;
                if (!confirm(promptText)) {
                    const cleaned = await cleanupPickedFileQuietly(nativeFileHandle, initialSnapshot);
                    setDownloadStatus(cleaned ? '已取消下载，0KB占位文件已清理' : '已取消下载', 0);
                    showToast(cleaned ? '已取消下载，0KB占位文件已清理' : '已取消下载');
                    hideDownloadStatus(2500);
                    return;
                }
                await downloadCurrentM3u8AsTs({ filename, fileHandle: nativeFileHandle, initialSnapshot, downloadInfo, saveMode: 'native' });
                dlBtn.classList.remove('busy');
                dlBtn.classList.add('done');
                hjSetFloatIcon(dlBtn, 'done');
                showToast('TS 已低内存保存到文件');
                hideDownloadStatus(3500);
                return;
            }
            const secureHint = (window.isSecureContext || unsafeWindow.isSecureContext) ? '' : '当前页面不是安全上下文(HTTPS)，';
            const unsupportedReason = `${secureHint}浏览器未暴露 showSaveFilePicker，无法启用真正的低内存直写。`;
            setDownloadStatus(iosCompatMode ? 'iOS TS兼容保存：正在读取视频信息：0%' : '内存 TS 保存：正在读取视频信息：0%', 0);
            downloadInfo = await prepareCurrentM3u8DownloadInfo(filename);
            const sizeLine = downloadInfo.sizeText || '未知';
            const durationLine = downloadInfo.durationText || '未知';
            const concurrency = getEffectiveDownloadConcurrency(downloadInfo.media.segments.length, fallbackMode);
            const promptText = iosCompatMode
                ? `iOS Safari TS 兼容保存说明：

${unsupportedReason}

脚本将改用 TS 直存兼容模式：
1. 先多线程下载分片并在内存中合成 TS
2. 完成后页面底部会出现“分享/存到文件”按钮
3. 点击后在系统分享面板里选择“存储到文件”

默认文件名：${filename}
视频大小：${sizeLine}
视频时长：${durationLine}
分片数量：${downloadInfo.segmentCount}
并发下载：${concurrency} 路

注意：此模式会占用手机内存，视频越大越容易被 Safari 刷新；建议先下载较小视频测试。

是否继续？`
                : `当前浏览器不支持低内存文件直写：
${unsupportedReason}

将改用内存合成 TS 后再保存。

默认文件名：${filename}
视频大小：${sizeLine}
视频时长：${durationLine}
分片数量：${downloadInfo.segmentCount}
并发下载：${concurrency} 路

是否继续？`;
            if (iosCompatMode) {
                console.info('[海角脚本] iOS TS 兼容模式跳过 confirm，直接开始内存合成。', promptText);
                setDownloadStatus(`iOS TS兼容保存：开始下载（${sizeLine}，${downloadInfo.segmentCount} 个分片）`, 0);
            } else if (!confirm(promptText)) {
                setDownloadStatus('已取消下载', 0);
                showToast('已取消下载');
                hideDownloadStatus(2500);
                return;
            }
            await downloadCurrentM3u8AsTs({ filename, downloadInfo, saveMode: fallbackMode });
            dlBtn.classList.remove('busy');
            dlBtn.classList.add('done');
            hjSetFloatIcon(dlBtn, 'done');
            showToast(iosCompatMode ? 'TS 已生成，请点击底部“分享/存到文件”' : 'TS 已生成，浏览器开始保存');
            hideDownloadStatus(iosCompatMode ? 10000 : 3500);
        } catch (e) {
            console.error('TS下载失败：', e);
            dlBtn.classList.remove('busy', 'done');
            hjSetFloatIcon(dlBtn, 'download');
            const cleaned = nativeFileHandle ? await cleanupPickedFileQuietly(nativeFileHandle, initialSnapshot) : false;
            const msg = isAbortLikeError(e)
                ? (cleaned ? '已取消下载，0KB占位文件已清理' : '已取消下载/保存')
                : (nativeFileHandle
                    ? `低内存保存失败：${e?.message || e}`
                    : `${iosCompatMode ? 'iOS兼容保存失败' : '下载失败'}：${e?.message || e}`);
            setDownloadStatus(msg, isAbortLikeError(e) ? 0 : 100);
            showToast(msg);
            hideDownloadStatus(isAbortLikeError(e) ? 2500 : 7000);
        } finally {
            clearInterval(progressTimer);
            abortActiveDownloadRequests();
            isDownloading = false;
            downloadCancelRequested = false;
        }
    }
    const HJ_VC_PAGE_SIZE = 100;
    let hjVcState = null;
    let hjVcPanelEl = null;
    let hjVcBusy = false;
    let hjVcLastRoute = '';
    hjAddStyle(`
        #hj-vc-root { z-index: 999998; }
                                                  
                                        
        #hj-vc-launcher {
            position: fixed;
            left: 15px;
            bottom: 15px;
            width: 55px;
            height: 55px;
            border-radius: 50%;
            background-color: rgba(30, 60, 114, 0.95);
            color: #fff;
            border: 2px solid rgba(255,255,255,0.3);
            z-index: 999998;
            font-size: 22px;
            text-align: center;
            line-height: 51px;
            user-select: none;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
            -webkit-tap-highlight-color: transparent;
        }
        #hj-vc-launcher.hj-vc-on { background-color: rgba(46, 139, 87, 0.95); }
        #hj-vc-panel {
            position: fixed;
            left: 12px;
            bottom: 82px;
            width: min(420px, calc(100vw - 24px));
            max-height: 70vh;
            display: flex;
            flex-direction: column;
            background: rgba(20,20,20,0.95);
            color: #fff;
            border-radius: 12px;
            z-index: 999998;
            box-shadow: 0 6px 20px rgba(0,0,0,0.55);
            overflow: hidden;
            font-size: 13px;
        }
        #hj-vc-panel.hj-vc-hidden { display: none; }
        #hj-vc-panel .hj-vc-head { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: rgba(30,60,114,0.95); }
        #hj-vc-panel .hj-vc-title { font-weight: bold; }
        #hj-vc-panel .hj-vc-close { cursor: pointer; font-size: 18px; line-height: 1; padding: 0 4px; }
        #hj-vc-panel .hj-vc-status { padding: 7px 12px; color: #bdbdbd; line-height: 1.4; word-break: break-all; }
        #hj-vc-panel .hj-vc-status.hj-vc-err { color: #ff5252; }
        #hj-vc-panel .hj-vc-list { overflow-y: auto; flex: 1; }
        #hj-vc-panel .hj-vc-item { padding: 8px 12px; border-top: 1px solid rgba(255,255,255,0.08); }
        #hj-vc-panel .hj-vc-item-title { line-height: 1.35; word-break: break-all; }
        #hj-vc-panel .hj-vc-item-meta { display: flex; gap: 8px; align-items: center; margin: 4px 0 6px; color: #9e9e9e; font-size: 12px; }
        #hj-vc-panel .hj-vc-item-id { margin-left: auto; }
        #hj-vc-panel .hj-vc-tag-free { color: #00e676; }
        #hj-vc-panel .hj-vc-tag-lock { color: #da7e00; }
        #hj-vc-panel .hj-vc-item-actions { display: flex; gap: 8px; }
        #hj-vc-panel .hj-vc-btn {
            flex: 1;
            padding: 6px 10px;
            border: 1px solid rgba(255,255,255,0.25);
            border-radius: 8px;
            background: rgba(30,60,114,0.95);
            color: #fff;
            font-size: 12px;
            cursor: pointer;
        }
        #hj-vc-panel .hj-vc-btn:active { transform: scale(0.97); }
        #hj-vc-panel .hj-vc-dl { background: rgba(218, 126, 0, 0.95); }
        #hj-vc-panel .hj-vc-foot { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-top: 1px solid rgba(255,255,255,0.08); }
        #hj-vc-panel .hj-vc-count { color: #9e9e9e; font-size: 12px; margin-left: auto; }
    `);
    function hjVcEnsureState() {
        if (!hjVcState) {
            hjVcState = { rows: [], page: 0, total: 0, loading: false, hasMore: true, lastError: '' };
        }
        return hjVcState;
    }
    function hjVcB64ToUtf8(b64) {
        const bin = atob(String(b64 || ''));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch (e) { return bin; }
    }
    function hjVcDecodePayload(text) {
        try {
            const outer = JSON.parse(String(text || ''));
            if (outer && typeof outer.data === 'string' && outer.isEncrypted) {
                let cur = outer.data;
                for (let i = 0; i < 6 && typeof cur === 'string'; i++) {
                    let next = null;
                    try { next = hjVcB64ToUtf8(cur); } catch (e) { break; }
                    if (!next || next === cur) break;
                    cur = next;
                    try { return JSON.parse(cur); } catch (e) { }
                }
                return cur;
            }
            return outer;
        } catch (e) { return null; }
    }
    function hjVcIsAuthFailure(decoded, rawText) {
        try {
            if (decoded && (Number(decoded.errorCode) === 1 || decoded.success === false)) {
                const msg = String(decoded.message || '');
                if (/请先登录|登录|令牌|token/i.test(msg)) return true;
                if (!msg && decoded.data === null && decoded.success === false) return true;
            }
            if (typeof rawText === 'string' && /请先登录/.test(rawText)) return true;
        } catch (e) { }
        return false;
    }
    async function hjVcApi(path, auth, method = 'GET', body = null, _retried = false) {
        const doFetch = async (a) => {
            const res = await fetch(path, {
                method: method,
                credentials: 'omit',
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                    'X-User-Token': a.token,
                    'X-User-Id': String(a.uid),
                    'pcVer': '2'
                },
                body: body ? JSON.stringify(body) : undefined
            });
            const text = await res.text();
            return { status: res.status, data: hjVcDecodePayload(text), raw: text };
        };
        const out = await doFetch(auth);
        if (_retried || !hjVcIsAuthFailure(out.data, out.raw)) return out;
        console.warn('[海角脚本] 视频中心请求遇到身份失效，强制重登后重试：', path);
        let fresh = null;
        try { fresh = await hjEnsureAuth(true); } catch (e) { }
        if (!fresh || !fresh.token || String(fresh.token) === String(auth.token)) return out;
        try {
            const retry = await hjVcApi(path, fresh, method, body, true);
            if (!hjVcIsAuthFailure(retry.data, retry.raw)) return retry;
            return retry;
        } catch (e) {
            return out;
        }
    }
    async function hjVcFetchPoolPage(page) {
        const auth = await hjEnsureAuth();
        if (!auth || !auth.token) {
            return { ok: false, reason: '当前没有可用身份（未登录且内置账号不可用），无法读取视频中心索引' };
        }
        let r = null;
        try {
            r = await hjVcApi('/api/video-center/video/list?page=' + page + '&limit=' + HJ_VC_PAGE_SIZE + '&sort=desc', auth);
        } catch (e) {
            return { ok: false, reason: '视频中心列表请求失败：' + (e && e.message ? e.message : e) };
        }
        const d = r.data;
        if (!d || !Array.isArray(d.results)) {
            return { ok: false, reason: '视频中心列表接口返回结构不符（HTTP ' + r.status + '，请稍后重试）' };
        }
        return { ok: true, rows: d.results, total: Number((d.page && d.page.total) || 0) };
    }
    async function hjVcResolveFullIndex(entry, auth) {
        const d = await hjVcApi('/api/video-center/video/detail?id=' + entry.id, auth);
        const detail = d.data;
        if (!detail || !detail.attachment_id) {
            return { ok: false, reason: '视频中心详情接口未返回附件信息（HTTP ' + d.status + '）' };
        }
        const canPlay = detail.can_play === true || Number(detail.access_type) === 1;
        const vcPassTopic = await hjGetPassTopicId(auth);
        const vcAttBody = vcPassTopic > 0
            ? { id: detail.attachment_id, resource_id: vcPassTopic, resource_type: 'topic', line: '' }
            : { id: detail.attachment_id, resource_id: detail.id, resource_type: 'video_center', line: '' };
        const a = await hjVcApi('/api/attachment', auth, 'POST', vcAttBody);
        const payload = a.data;
        const url = payload && (payload.remoteUrl || (payload.data && payload.data.remoteUrl));
        if (url) return { ok: true, url: String(url), detail };
        const msg = (payload && payload.message) || '';
        if (!canPlay) {
            return { ok: false, needUnlock: true, reason: msg || '该视频需观影券或购买后才能播放，服务端不下发播放地址' };
        }
        return { ok: false, reason: msg || '取址失败：服务端未返回播放地址（HTTP ' + a.status + '）' };
    }
    function hjVcLockTarget(url, title) {
        hjDerivedFullM3u8Url = '';
        hjDerivedVerifiedFullUrl = '';                             
        hjPreviewFallbackUrl = '';
        hjPassTopicFullUrl = '';                                 
        bestM3u8Candidate = null;
        hjSeenDomM3u8.clear();
        if (title) capturedVideoTitle = String(title).replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 60) || capturedVideoTitle;
        updateState(url);
    }
    function hjVcShortTitle(title, max = 28) {
        const t = String(title || '').replace(/\s+/g, ' ').trim();
        return t.length > max ? t.slice(0, max) + '…' : t;
    }
    function hjVcSetPanelStatus(text, isError = false) {
        if (!hjVcPanelEl) return;
        const el = hjVcPanelEl.querySelector('#hj-vc-status');
        if (!el) return;
        el.textContent = String(text || '');
        el.classList.toggle('hj-vc-err', !!isError);
    }
    function hjVcRenderList() {
        if (!hjVcPanelEl) return;
        const st = hjVcEnsureState();
        const list = hjVcPanelEl.querySelector('#hj-vc-list');
        if (!list) return;
        list.innerHTML = st.rows.map((row, idx) => {
            const secs = Number(row.duration_seconds || 0);
            const free = Number(row.access_type) === 1 || row.can_play === true;
            return '<div class="hj-vc-item">'
                + '<div class="hj-vc-item-title">' + escapeHtml(hjVcShortTitle(row.title, 34)) + '</div>'
                + '<div class="hj-vc-item-meta">'
                + '<span>' + escapeHtml(formatDuration(secs)) + '</span>'
                + '<span class="' + (free ? 'hj-vc-tag-free' : 'hj-vc-tag-lock') + '">' + (free ? '可直接播放' : '需解锁') + '</span>'
                + '<span class="hj-vc-item-id">#' + escapeHtml(String(row.id)) + '</span>'
                + '</div>'
                + '<div class="hj-vc-item-actions">'
                + '<button class="hj-vc-btn hj-vc-play" data-idx="' + idx + '">播放完整版</button>'
                + '<button class="hj-vc-btn hj-vc-dl" data-idx="' + idx + '">下载</button>'
                + '</div></div>';
        }).join('');
        list.querySelectorAll('.hj-vc-play').forEach(b => {
            b.onclick = () => hjVcUse(st.rows[Number(b.dataset.idx)], 'play');
        });
        list.querySelectorAll('.hj-vc-dl').forEach(b => {
            b.onclick = () => hjVcUse(st.rows[Number(b.dataset.idx)], 'download');
        });
        const count = hjVcPanelEl.querySelector('#hj-vc-count');
        if (count) count.textContent = '已加载 ' + st.rows.length + (st.total ? ' / ' + st.total : '');
    }
    async function hjVcLoadMore() {
        const st = hjVcEnsureState();
        if (st.loading) return;
        if (!st.hasMore) {
            hjVcSetPanelStatus('已到末尾：共 ' + st.rows.length + ' 条');
            return;
        }
        st.loading = true;
        hjVcSetPanelStatus('正在拉取第 ' + (st.page + 1) + ' 页 ...');
        try {
            const r = await hjVcFetchPoolPage(st.page + 1);
            if (!r.ok) {
                st.hasMore = false;
                st.lastError = r.reason;
                hjVcSetPanelStatus(r.reason, true);
                return;
            }
            st.page += 1;
            if (r.total) st.total = r.total;
            st.rows = st.rows.concat(r.rows);
            st.hasMore = r.rows.length > 0 && (!st.total || st.rows.length < st.total);
            st.lastError = '';
            hjVcRenderList();
            hjVcSetPanelStatus('第 ' + st.page + ' 页就绪：本页 ' + r.rows.length + ' 条，累计 ' + st.rows.length + ' 条');
        } catch (e) {
            st.lastError = String(e && e.message ? e.message : e);
            hjVcSetPanelStatus('列表拉取失败：' + st.lastError, true);
        } finally {
            st.loading = false;
        }
    }
    async function hjVcUse(entry, action) {
        if (!entry) return;
        if (hjVcBusy) { showToast('视频中心正在取址，请稍候'); return; }
        hjVcBusy = true;
        try {
            const auth = await hjEnsureAuth();
            if (!auth || !auth.token) {
                hjVcSetPanelStatus('当前没有可用身份，无法取址', true);
                showToast('当前没有可用身份，无法取址');
                return;
            }
            hjVcSetPanelStatus('正在取址：' + hjVcShortTitle(entry.title, 20) + ' ...');
            const r = await hjVcResolveFullIndex(entry, auth);
            if (!r.ok) {
                hjVcSetPanelStatus(r.reason, true);
                showToast(r.reason);
                return;
            }
            if (isPreviewM3u8Url(r.url)) {
                hjVcSetPanelStatus('服务端本次下发的是 30 秒预览索引（非完整版），已按实际地址继续', true);
            }
            hjVcLockTarget(r.url, entry.title);
            const secs = Number((r.detail && r.detail.duration_seconds) || entry.duration_seconds || 0);
            hjVcSetPanelStatus('已取到完整索引：时长约 ' + formatDuration(secs) + '，文件 ' + r.url.split('/').pop());
            if (action === 'download') {
                const dlBtn = document.getElementById(dlBtnId);
                if (!dlBtn) { showToast('下载按钮不可用，请刷新页面'); return; }
                handleDownloadButtonClick(dlBtn);
            } else {
                const btn = document.getElementById(btnId);
                if (!btn) { showToast('播放按钮不可用，请刷新页面'); return; }
                await replaceAndPlayVideo(btn);
            }
        } catch (e) {
            const msg = '视频中心处理失败：' + (e && e.message ? e.message : e);
            hjVcSetPanelStatus(msg, true);
            console.warn('[海角脚本] ' + msg);
        } finally {
            hjVcBusy = false;
        }
    }
    function hjVcTogglePanel(force) {
        const wrap = hjVcEnsureUi();
        if (!wrap) return;
        const panel = wrap.querySelector('#hj-vc-panel');
        const launcher = wrap.querySelector('#hj-vc-launcher');
        if (!panel) return;
        const show = typeof force === 'boolean' ? force : panel.classList.contains('hj-vc-hidden');
        panel.classList.toggle('hj-vc-hidden', !show);
        if (launcher) launcher.classList.toggle('hj-vc-on', show);
        if (show) {
            const st = hjVcEnsureState();
            if (!st.rows.length && !st.loading) hjVcLoadMore();
            else hjVcRenderList();
        }
    }
    function hjVcEnsureUi() {
        if (hjVcPanelEl && document.body && document.body.contains(hjVcPanelEl)) return hjVcPanelEl;
        if (!document.body) return null;
        const wrap = document.createElement('div');
        wrap.id = 'hj-vc-root';
        wrap.innerHTML = ''
            + '<div id="hj-vc-panel" class="hj-vc-hidden">'
            + '<div class="hj-vc-head"><span class="hj-vc-title">视频中心 · 完整索引</span><span class="hj-vc-close">×</span></div>'
            + '<div id="hj-vc-status" class="hj-vc-status">点「加载更多」拉取列表</div>'
            + '<div id="hj-vc-list" class="hj-vc-list"></div>'
            + '<div class="hj-vc-foot"><button class="hj-vc-btn" id="hj-vc-more">加载更多</button><span class="hj-vc-count" id="hj-vc-count"></span></div>'
            + '</div>';
        document.body.appendChild(wrap);
        hjVcPanelEl = wrap;
        const launcher = wrap.querySelector('#hj-vc-launcher');
        const closeBtn = wrap.querySelector('.hj-vc-close');
        const moreBtn = wrap.querySelector('#hj-vc-more');
        if (launcher) launcher.onclick = () => hjVcTogglePanel();
        if (closeBtn) closeBtn.onclick = () => hjVcTogglePanel(false);
        if (moreBtn) moreBtn.onclick = () => hjVcLoadMore();
        return wrap;
    }
    function hjVcIsActiveRoute() {
        return false;
    }
    function hjVcRouteWatch() {
        try {
            const wrap = document.getElementById('hj-vc-root');
            if (wrap) { wrap.style.display = 'none'; wrap.remove(); }
            hjVcPanelEl = null;
            hjVcLastRoute = location.pathname + location.search;
        } catch (e) { }
    }
    function hjVcInit() {
        if (!hjAllowActions()) return;
        if (!hjVcIsActiveRoute()) return;
        const wrap = hjVcEnsureUi();
        if (!wrap) return;
        wrap.style.display = '';
        const st = hjVcEnsureState();
        if (!st.rows.length && !st.loading) hjVcLoadMore();
    }
    let hjVideoPassTopic = 0;
    let hjVideoPassTopicInflight = null;
    let hjVideoPatchCount = 0;
    let hjVideoRewriteCount = 0;
    let hjVideoNoIdentitySends = 0;
    const HJ_VIDEO_HOLD_MS = 8000;
    let hjVideoHoldLogged = false;
    function hjVideoTicketRoute() {
        try {
            if (/^\/(video|watch|videoPage|videoList|videoCategories)(\/|$)/i.test(String(location.pathname || ''))) return true;
        } catch (e) { }
        return hjIsVideoSpaDoc();
    }
    function hjIsVideoSpaDoc() {
        try {
            const app = document.querySelector('#app');
            const vm = app && app.__vue__;
            const router = vm && (vm.$router || (vm.$root && vm.$root.$router));
            const routes = router && router.options ? router.options.routes : null;
            if (!Array.isArray(routes)) return false;
            const hasVideoRoute = (arr) => arr.some((x) => {
                if (!x) return false;
                if (String(x.path || '') === '/video' && /^videos$/i.test(String(x.name || ''))) return true;
                return Array.isArray(x.children) && hasVideoRoute(x.children);
            });
            return hasVideoRoute(routes);
        } catch (e) { return false; }
    }
    function hjVideoWatchPush(router, id) {
        if (!router || !id) return null;
        const query = { videoid: id, id: id };
        const names = ['watch', 'videoWatch'];
        for (let i = 0; i < names.length; i++) {
            try {
                const r = router.resolve({ name: names[i], query: query });
                const matched = r && r.route ? r.route.matched : null;
                if (matched && matched.length && String(r.route.name) === names[i]) {
                    router.push({ name: names[i], query: query });
                    return names[i];
                }
            } catch (e) { }
        }
        try {
            const rr = router.resolve('/video/watch');
            const real = rr && rr.route && rr.route.matched
                ? rr.route.matched.some((m) => String(m.path || '') !== '*') : false;
            if (real) {
                router.push({ path: '/video/watch', query: { videoid: id } });
                return 'path:/video/watch';
            }
        } catch (e) { }
        return null;
    }
    function hjVideoEnsurePassTopic() {
        if (hjLogoutEpoch > 0 || hjVideoPassTopic > 0 || hjVideoPassTopicInflight) return;
        hjVideoPassTopicInflight = (async () => {
            try {
                const auth = await hjEnsureAuth();
                if (!auth || !auth.token) return;
                const id = await hjGetPassTopicId(auth);
                if (id > 0) {
                    hjVideoPassTopic = id;
                    console.info('[海角脚本] 观影券绕过就绪：通行证帖 ' + id + '（付费视频的取址请求将换址换取完整索引）');
                }
            } catch (e) { }
            finally { hjVideoPassTopicInflight = null; }
        })();
    }
    function hjVideoPatchAnonymousWatch() {
        try {
            const app = document.querySelector('#app');
            const root = app && app.__vue__;
            if (!root) return 0;
            const stack = [root];
            let repaired = 0;
            for (let guard = 0; stack.length && guard < 8000; guard++) {
                const c = stack.pop();
                try {
                    const video = c && (c.video || (c.$data && c.$data.video));
                    const free = !!video && (video.can_play === true || Number(video.access_type) === 1);
                    const hasAttachment = !!(video && video.attachment_id);
                    const hasUrl = !!(video && video.remoteUrl);
                    if (free && hasAttachment && !hasUrl && !c.__hjAnonWatchRepair && typeof c.getAttachment === 'function') {
                        c.__hjAnonWatchRepair = true;
                        c.getAttachment();
                        repaired++;
                    }
                    const kids = c && c.$children;
                    if (kids) for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
                } catch (e) { }
            }
            if (repaired) console.info('[海角脚本] 匿名免费视频播放页已补发取址请求：' + repaired + ' 个组件实例');
            return repaired;
        } catch (e) { return 0; }
    }
    function hjVideoPatchListGate() {
        const app = document.querySelector('#app');
        const root = app && app.__vue__;
        if (!root) return 0;
        const stack = [root];
        let patched = 0;
        for (let guard = 0; stack.length && guard < 8000; guard++) {
            const c = stack.pop();
            try {
                const router = c && (c.$router || (c.$root && c.$root.$router));
                if (c && router && !c.__hjVideoGate && typeof c.openVideo === 'function') {
                    c.__hjVideoGate = true;
                    c.__hjVideoPlayOrig = c.openVideo;
                    c.openVideo = function (videoId) {
                        if (videoId && hjVideoWatchPush(router, videoId)) return;
                        return c.__hjVideoPlayOrig.apply(this, arguments);
                    };
                    patched++;
                } else if (c && router && !c.__hjVideoGate && typeof c.videoPlay === 'function' && Array.isArray(c.videoList)) {
                    c.__hjVideoGate = true;
                    c.__hjVideoPlayOrig = c.videoPlay;
                    c.videoPlay = function (row) {
                        if (row && row.id) {
                            hjVideoWatchPush(router, row.id);
                            return;
                        }
                        return c.__hjVideoPlayOrig.apply(this, arguments);
                    };
                    patched++;
                }
                const kids = c && c.$children;
                if (kids) for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
            } catch (e) { }
        }
        if (patched) {
            hjVideoPatchCount += patched;
            console.info('[海角脚本] 观影券门禁已放行（列表页 ' + patched + ' 个组件实例）：付费视频点击即播，不再弹购买框');
        }
        return patched;
    }
    function hjVideoHookXhrRealm(win) {
        try {
            if (!win || !win.XMLHttpRequest) return false;
            const proto = win.XMLHttpRequest.prototype;
            if (!proto || proto.__hjVideoHooked) return false;
            proto.__hjVideoHooked = true;
            const origOpen = proto.open;
            const origSend = proto.send;
            proto.open = function (m, u) {
                try { this.__hjVideoUrl = String(u || ''); } catch (e) { }
                return origOpen.apply(this, arguments);
            };
            proto.send = function (body) {
                try {
                    if (typeof body === 'string' && String(this.__hjVideoUrl || '').indexOf('/api/attachment') >= 0) {
                        const obj = JSON.parse(body);
                        if (obj && obj.resource_type === 'video_center') {
                            if (hjVideoPassTopic > 0) {
                                obj.resource_id = hjVideoPassTopic;
                                obj.resource_type = 'topic';
                                hjVideoRewriteCount++;
                                return origSend.call(this, JSON.stringify(obj));
                            }
                            if (!hjHasUsableIdentity()) {
                                hjVideoNoIdentitySends++;
                                return origSend.call(this, body);
                            }
                            hjVideoEnsurePassTopic();
                            if (!hjVideoHoldLogged) {
                                hjVideoHoldLogged = true;
                                console.info('[海角脚本] 观影券绕过：取址请求已暂缓发出，等通行证帖就绪（最多 ' + HJ_VIDEO_HOLD_MS + ' 毫秒）');
                            }
                            const self = this;
                            const raw = body;
                            const started = Date.now();
                            const timer = setInterval(() => {
                                try {
                                    if (hjVideoPassTopic > 0) {
                                        clearInterval(timer);
                                        const sent = Object.assign({}, obj, { resource_id: hjVideoPassTopic, resource_type: 'topic' });
                                        hjVideoRewriteCount++;
                                        origSend.call(self, JSON.stringify(sent));
                                    } else if (Date.now() - started > HJ_VIDEO_HOLD_MS) {
                                        clearInterval(timer);
                                        origSend.call(self, raw);
                                    }
                                } catch (e) { }
                            }, 120);
                            try { this.addEventListener('abort', () => clearInterval(timer), { once: true }); } catch (e) { }
                            return;
                        }
                    }
                } catch (e) { }
                return origSend.call(this, body);
            };
            return true;
        } catch (e) { return false; }
    }
    function hjVideoInstallXhrRewrite() {
        let realms = 0;
        try { if (hjVideoHookXhrRealm(typeof unsafeWindow !== 'undefined' ? unsafeWindow : null)) realms++; } catch (e) { }
        try { if (hjVideoHookXhrRealm(window)) realms++; } catch (e) { }
        if (realms) console.info('[海角脚本] 观影券绕过：已接管 ' + realms + ' 个 XMLHttpRequest 原型（取址请求将换址）');
        return realms;
    }
    function hjVideoUnlockTickets() {
        if (!hjAllowActions()) return;
        if (!hjVideoTicketRoute()) return;
        hjVideoEnsurePassTopic();
        hjVideoPatchListGate();
        hjVideoPatchAnonymousWatch();
    }
    hjVideoInstallXhrRewrite();
    try { hjReplyToastRace(); } catch (e) { }
    function init() {
        if (document.getElementById(btnId)) return;
        if (!hjVerified) return;
        hjFlushPendingCss();
        hjRouteKey = hjCurrentRouteKey();
        hjSearchPrevPath = String(location.pathname || '');
        const btn = document.createElement('div');
        btn.id = btnId;
        hjSetFloatIcon(btn, 'play');
        for (const event of ['pointerenter', 'pointerdown', 'focus']) btn.addEventListener(event, warmPlaybackOnIntent, { passive: true });
        btn.onclick = function() {
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 100);
            if (!hjIsPlayableRoute()) {
                console.warn('[海角脚本] 当前不在帖子详情页，忽略播放请求：' + location.pathname);
                return;
            }
            if (capturedM3u8Url) {
                replaceAndPlayVideo(btn);
            } else {
                showToast('后台尚未捕获到完整数据的索引参数，请等待刷新或播放原视频探寻。');
            }
        };
        document.body.appendChild(btn);
        const dlBtn = document.createElement('div');
        dlBtn.id = dlBtnId;
        hjSetFloatIcon(dlBtn, 'download');
        dlBtn.onclick = function() {
            if (!isDownloading && !hjIsPlayableRoute()) {
                console.warn('[海角脚本] 当前不在帖子详情页，忽略下载请求');
                return;
            }
            handleDownloadButtonClick(dlBtn);
        };
        document.body.appendChild(dlBtn);
        refreshActionButtons();
        expandAndCleanup();
        initMainObserver();
        setInterval(() => {
            checkPlaybackRoute();
            cleanUpAds();
            releaseBodyScrollLock();
            try { hjSearchCaptureKeyword(); } catch (e) { }
            try { hjSearchRestoreIfLost(); } catch (e) { }
        }, 2000);
        setInterval(() => {
            try { hjForceProfileList(); } catch (e) { }
            try { hjUnlockCoinImages(); } catch (e) { }
            try { hjUnlockAudios(); } catch (e) { }
            try { hjUnlockListAudios(); } catch (e) { }
            try { hjUnlockLiteContent(); } catch (e) { }
            try { hjHideVipAdBlocks(); } catch (e) { }
            try { hjMuteReplyToast(); } catch (e) { }
            try { hjSweepReplyToast(); } catch (e) { }
        }, 2000);
        hjVcRouteWatch();
        setInterval(hjVcRouteWatch, 2000);
        if (typeof hjVideoUnlockTickets === 'function') {
            hjVideoUnlockTickets();
            setInterval(hjVideoUnlockTickets, 2000);
        }
        setTimeout(() => { try { hjHealSiteLoginOnce(); } catch (e) { } }, 2600);
        setTimeout(() => { try { hjMaybeNoticeNoAccount(); } catch (e) { } }, 2500);
    }
    try { hjWarmUpPromise = hjWarmUpSiteLogin(); } catch (e) { }
    try {
        if (hjVideoTicketRoute()) hjVideoEnsurePassTopic();
    } catch (e) { }
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.addEventListener('popstate', () => {
        hjSyncRouteState('popstate');
        checkPlaybackRoute();
        setTimeout(() => {
            expandAndCleanup();
            cleanUpAds();
            hjVcRouteWatch();
            if (typeof hjVideoUnlockTickets === 'function') hjVideoUnlockTickets();
            hjSyncActionButtons();
        }, 500);
    });
})();
