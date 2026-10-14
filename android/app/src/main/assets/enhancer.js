/*
 * 套壳播放增强层（桌面 Electron / 安卓 WebView 共用）
 * - 脚本自建播放器（video[id^="clean-core-player-"]）：包成舞台 + 底部工具条
 * - 站点自带播放器：不动它的 DOM，只加一个浮层工具条（重渲染也不会丢）
 * - 影院模式：把包裹播放器的祖先链撑满视口宽度（治「挤压」）
 * - 网页全屏：纯 CSS 铺满视口，任何环境都能用（原生全屏不支持时的兜底）
 * - 原生全屏：requestFullscreen（桌面直接可用；安卓由壳的 onShowCustomView 接管）
 */
(function () {
    'use strict';
    if (window.__hjShellEnhancerLoaded) return;
    window.__hjShellEnhancerLoaded = true;

    var SPEEDS = [1, 1.25, 1.5, 2, 0.75];
    var state = { speedIdx: 0, webfs: false, cinema: false, touched: [] };

    /* ------------------------------ 样式 ------------------------------ */

    var css = [
        /* 舞台（脚本自建播放器） */
        '.hj-shell-stage{position:relative;display:block;width:100%;max-width:100%;background:#0b0b0b;border-radius:12px;overflow:hidden;margin:10px 0;box-shadow:0 10px 30px rgba(0,0,0,.45)}',
        '.hj-shell-stage>video{display:block!important;width:100%!important;height:auto!important;min-height:0!important;max-height:78vh!important;background:#000;object-fit:contain}',
        /* 工具条 */
        '.hj-shell-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;background:#151515;border-top:1px solid #262626;font-size:13px}',
        '.hj-shell-tools button{appearance:none;-webkit-appearance:none;border:1px solid #333;background:#1d1d1d;color:#e8e8e8;border-radius:8px;padding:6px 10px;font-size:13px;line-height:1;cursor:pointer;white-space:nowrap}',
        '.hj-shell-tools button:hover{background:#2a2a2a;border-color:#4a4a4a}',
        '.hj-shell-tools button.on{background:#1e88e5;border-color:#1e88e5;color:#fff}',
        '.hj-shell-tools .hj-sp{flex:1}',
        '.hj-shell-tools .hj-hint{color:#8a8a8a;font-size:12px}',
        /* 浮动工具条（站点播放器用，固定在播放器右上角） */
        '.hj-shell-float{position:fixed;z-index:2147482000;display:flex;gap:6px;padding:6px;border-radius:10px;background:rgba(18,18,18,.86);backdrop-filter:blur(6px);box-shadow:0 4px 18px rgba(0,0,0,.4);opacity:.28;transition:opacity .18s}',
        '.hj-shell-float:hover{opacity:1}',
        '.hj-shell-float button{appearance:none;-webkit-appearance:none;border:1px solid #3a3a3a;background:#1d1d1d;color:#eaeaea;border-radius:7px;padding:5px 9px;font-size:12px;line-height:1;cursor:pointer}',
        '.hj-shell-float button:hover{background:#2d2d2d}',
        '.hj-shell-float button.on{background:#1e88e5;border-color:#1e88e5;color:#fff}',
        /* 网页全屏 */
        '.hj-shell-fs{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;z-index:2147483000!important;background:#000!important;display:flex!important;flex-direction:column!important;align-items:center;justify-content:center}',
        '.hj-shell-fs>video{width:100%!important;height:100%!important;max-height:100vh!important;object-fit:contain!important}',
        '.hj-shell-fs .hj-shell-tools{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.88));border:0}',
        'body.hj-shell-lock{overflow:hidden!important}',
        /* 影院模式：把包裹播放器的祖先链撑满视口 */
        '.hj-shell-wide{width:100vw!important;max-width:100vw!important;margin-left:calc(50% - 50vw)!important;margin-right:calc(50% - 50vw)!important;box-sizing:border-box!important;padding-left:0!important;padding-right:0!important}',
        '.hj-shell-wide video{width:100%!important;height:auto!important;max-height:88vh!important}',
        /* 海角视频页：站点把整页锁在 1000px、播放列只占 656px（右侧空栏），影院模式直接放开 */
        'body.hj-shell-cinema .video-detail-page{max-width:none!important;width:100%!important}',
        'body.hj-shell-cinema .main-row{display:block!important;width:100%!important}',
        'body.hj-shell-cinema .player-col{width:100%!important;max-width:100%!important}',
        'body.hj-shell-cinema .player-wrap{width:100%!important;max-width:100%!important}',
        'body.hj-shell-cinema video.player{width:100%!important;max-width:100%!important;height:auto!important;max-height:86vh!important}',
        /* 脚本的状态条（原文案）也顺眼一点 */
        '.hj-player-status{border-radius:8px;margin:0 0 8px!important}'
    ].join('\n');

    function injectStyle() {
        if (document.getElementById('hj-shell-player-css')) return;
        var s = document.createElement('style');
        s.id = 'hj-shell-player-css';
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    }

    /* ------------------------------ 工具 ------------------------------ */

    function isScriptPlayer(v) {
        return v && /^clean-core-player-/.test(String(v.id || ''));
    }

    function currentVideo() {
        var list = Array.prototype.slice.call(document.querySelectorAll('video'));
        if (!list.length) return null;
        // 优先正在播放的，其次面积最大的
        var playing = list.filter(function (v) { return !v.paused && v.readyState > 1; });
        var pool = playing.length ? playing : list;
        pool.sort(function (a, b) {
            var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            return (rb.width * rb.height) - (ra.width * ra.height);
        });
        return pool[0];
    }

    function requestNativeFullscreen(el) {
        var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen
            || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (!fn) return false;
        try {
            var p = fn.call(el);
            if (p && typeof p.then === 'function') {
                p.then(function () { }).catch(function () { toggleWebFs(true); });
            }
            return true;
        } catch (e) { return false; }
    }

    function exitNativeFullscreen() {
        var fn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
        if (fn) { try { fn.call(document); } catch (e) { } }
    }

    function inNativeFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
    }

    /* ------------------------------ 网页全屏 ------------------------------ */

    function webFsTarget(video) {
        if (isScriptPlayer(video) && video.parentElement && video.parentElement.classList.contains('hj-shell-stage')) {
            return video.parentElement;
        }
        return video;
    }

    function toggleWebFs(force) {
        var v = currentVideo();
        if (!v) return;
        var on = (typeof force === 'boolean') ? force : !state.webfs;
        var target = webFsTarget(v);
        if (on) {
            var rect = target.getBoundingClientRect();
            target.dataset.hjFsSaved = JSON.stringify({
                css: target.getAttribute('style') || '',
                cls: Array.prototype.slice.call(target.classList).filter(function (c) { return c !== 'hj-shell-fs'; }).join(' ')
            });
            target.classList.add('hj-shell-fs');
            document.body.classList.add('hj-shell-lock');
            state.webfs = true;
        } else {
            target.classList.remove('hj-shell-fs');
            document.body.classList.remove('hj-shell-lock');
            state.webfs = false;
        }
        state.touched.forEach(function (pair) { /* noop, 影院态单独管 */ });
        updateButtons();
        if (!on && inNativeFullscreen()) exitNativeFullscreen();
    }

    /* ------------------------------ 影院模式 ------------------------------ */

    /* 比例兜底：视频没加载元数据时浏览器按默认 300x150 渲染 → 会变成一条扁横条 */
    function shapeGuard() {
        var list = document.querySelectorAll('video');
        Array.prototype.forEach.call(list, function (v) {
            try {
                var r = v.getBoundingClientRect();
                if (r.width < 200) return;
                if (v.readyState >= 1 && v.videoWidth && v.videoHeight) {
                    var ar = (v.videoWidth / v.videoHeight).toFixed(4);
                    if (v.dataset.hjAr !== ar) {
                        v.dataset.hjAr = ar;
                        v.style.setProperty('aspect-ratio', ar, 'important');
                        if (window.__hjShellLog) window.__hjShellLog('播放增强：按真实比例 ' + ar + ' 校正播放器');
                    }
                    return;
                }
                if (v.dataset.hjShape === '1') return;
                var want = r.width / 1.7778;
                if (r.height < want * 0.6) {
                    v.dataset.hjShape = '1';
                    v.style.setProperty('aspect-ratio', '16 / 9', 'important');
                    v.style.setProperty('height', 'auto', 'important');
                    v.style.setProperty('background', '#000', 'important');
                    if (window.__hjShellLog) {
                        window.__hjShellLog('播放增强：视频未就绪，按 16:9 撑开（原高 ' + Math.round(r.height) + 'px → ' + Math.round(want) + 'px）');
                    }
                }
            } catch (e) { }
        });
    }

    function setCinema(on) {
        var v = currentVideo();
        if (!v) return;
        if (on) {
            if (state.cinema) return;
            document.body.classList.add('hj-shell-cinema');
            state.touched = [];
            var el = v.parentElement;
            var hops = 0;
            while (el && el !== document.body && el !== document.documentElement && hops < 5) {
                var r = el.getBoundingClientRect();
                if (r.width >= window.innerWidth - 4) break;   // 已经满宽就不用再往上撑
                state.touched.push({ el: el, cls: el.className });
                el.classList.add('hj-shell-wide');
                el = el.parentElement;
                hops++;
            }
            state.cinema = true;
        } else {
            document.body.classList.remove('hj-shell-cinema');
            state.touched.forEach(function (item) {
                try { item.el.classList.remove('hj-shell-wide'); } catch (e) { }
            });
            state.touched = [];
            state.cinema = false;
        }
        shapeGuard();
        updateButtons();
    }

    /* 窗口够宽、播放器却只占小半屏 → 自动进影院（治「挤压」，只做一次） */
    var autoCinemaDone = false;
    function maybeAutoCinema() {
        if (autoCinemaDone) return;
        var cfg = window.__hjShellConfig || {};
        if (cfg.autoCinema === false) { autoCinemaDone = true; return; }
        if (window.innerWidth < 1000) return;
        var v = currentVideo();
        if (!v) return;
        var r = v.getBoundingClientRect();
        if (r.width < 200) return;
        if (r.width < window.innerWidth * 0.7) {
            autoCinemaDone = true;
            setCinema(true);
            if (window.__hjShellLog) window.__hjShellLog('播放增强：播放器仅占 ' + Math.round(r.width) + '/' + window.innerWidth + '，已自动进入影院模式');
        } else {
            autoCinemaDone = true;
        }
    }

    /* ------------------------------ 倍速 / 画中画 ------------------------------ */

    function cycleSpeed() {
        var v = currentVideo();
        if (!v) return;
        state.speedIdx = (state.speedIdx + 1) % SPEEDS.length;
        var rate = SPEEDS[state.speedIdx];
        Array.prototype.forEach.call(document.querySelectorAll('video'), function (x) { try { x.playbackRate = rate; } catch (e) { } });
        updateButtons();
    }

    function togglePip() {
        var v = currentVideo();
        if (!v) return;
        try {
            if (document.pictureInPictureElement) document.exitPictureInPicture();
            else if (v.requestPictureInPicture) v.requestPictureInPicture();
            else alert('当前环境不支持画中画');
        } catch (e) { }
    }

    /* ------------------------------ UI 组装 ------------------------------ */

    var floatBar = null;

    function makeButtons(container) {
        container.innerHTML = '';
        var defs = [
            { key: 'full', label: '全屏', title: '原生全屏（安卓由套壳接管）', act: function () {
                var v = currentVideo();
                if (!v) return;
                if (inNativeFullscreen()) { exitNativeFullscreen(); return; }
                if (!requestNativeFullscreen(webFsTarget(v))) toggleWebFs(true);
                updateButtons();
            } },
            { key: 'webfs', label: '网页全屏', title: 'CSS 铺满视口，任何环境都可用', act: function () { toggleWebFs(); } },
            { key: 'cinema', label: '影院', title: '把播放器撑满整行宽度', act: function () { setCinema(!state.cinema); } },
            { key: 'pip', label: '画中画', title: '小窗悬浮播放', act: togglePip },
            { key: 'speed', label: '倍速', title: '点击循环切换倍速', act: cycleSpeed }
        ];
        defs.forEach(function (d) {
            var b = document.createElement('button');
            b.type = 'button';
            b.dataset.hjKey = d.key;
            b.textContent = d.label;
            b.title = d.title;
            b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); d.act(); });
            container.appendChild(b);
        });
    }

    function updateButtons() {
        var bars = document.querySelectorAll('.hj-shell-tools, .hj-shell-float');
        Array.prototype.forEach.call(bars, function (bar) {
            var speed = bar.querySelector('button[data-hj-key="speed"]');
            if (speed) speed.textContent = '倍速 ' + SPEEDS[state.speedIdx] + 'x';
            var wf = bar.querySelector('button[data-hj-key="webfs"]');
            if (wf) wf.classList.toggle('on', !!state.webfs);
            var ci = bar.querySelector('button[data-hj-key="cinema"]');
            if (ci) ci.classList.toggle('on', !!state.cinema);
            var fu = bar.querySelector('button[data-hj-key="full"]');
            if (fu) fu.classList.toggle('on', inNativeFullscreen());
        });
    }

    /* 脚本自建播放器：包舞台 + 常驻工具条 */
    function upgradeScriptPlayer(video) {
        if (!video || video.dataset.hjShellStage === '1') return;
        if (!isScriptPlayer(video)) return;
        var parent = video.parentElement;
        if (!parent) return;
        var stage = document.createElement('div');
        stage.className = 'hj-shell-stage';
        parent.insertBefore(stage, video);
        stage.appendChild(video);
        var tools = document.createElement('div');
        tools.className = 'hj-shell-tools';
        makeButtons(tools);
        stage.appendChild(tools);
        video.dataset.hjShellStage = '1';
        // 脚本给 video 上的行内样式会压制我们的 CSS，清掉关键几条
        video.style.minHeight = '';
        video.style.maxHeight = '';
        updateButtons();
        if (window.__hjShellLog) window.__hjShellLog('播放增强：已舞台化脚本播放器');
    }

    /* 站点播放器：浮动工具条（跟随播放器位置） */
    function ensureFloatBar() {
        var v = currentVideo();
        if (!v) {
            if (floatBar) { floatBar.remove(); floatBar = null; }
            return;
        }
        if (!floatBar || !floatBar.isConnected) {
            floatBar = document.createElement('div');
            floatBar.className = 'hj-shell-float';
            makeButtons(floatBar);
            document.body.appendChild(floatBar);
        }
        var rect = v.getBoundingClientRect();
        if (rect.width < 120 || rect.height < 80) { floatBar.style.display = 'none'; return; }
        floatBar.style.display = 'flex';
        var top = Math.max(8, rect.top + 8);
        var right = Math.max(8, window.innerWidth - rect.right + 8);
        floatBar.style.top = top + 'px';
        floatBar.style.right = right + 'px';
    }

    /* ------------------------------ 循环扫描 ------------------------------ */

    function scan() {
        injectStyle();
        var list = document.querySelectorAll('video');
        Array.prototype.forEach.call(list, function (v) {
            if (isScriptPlayer(v)) upgradeScriptPlayer(v);
        });
        // 有视频就显示浮动条（脚本播放器自带工具条时也可以留着，互不冲突）
        ensureFloatBar();
        shapeGuard();
        maybeAutoCinema();
    }

    setInterval(scan, 1200);
    document.addEventListener('DOMContentLoaded', scan);
    window.addEventListener('load', scan);
    window.addEventListener('resize', function () { ensureFloatBar(); });
    window.addEventListener('scroll', function () { ensureFloatBar(); }, true);
    document.addEventListener('fullscreenchange', updateButtons);
    document.addEventListener('webkitfullscreenchange', updateButtons);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && state.webfs) toggleWebFs(false);
        if ((e.key === 'f' || e.key === 'F') && e.altKey) { e.preventDefault(); toggleWebFs(); }
    });
    scan();
    if (window.__hjShellLog) window.__hjShellLog('播放增强层已加载');
})();
