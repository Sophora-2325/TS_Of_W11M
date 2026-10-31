var XL_WEB_GET_VIDEO_SRC_FN = (function () {
  "use strict";
  var fe = Object.defineProperty,
    pe = Object.defineProperties;
  var me = Object.getOwnPropertyDescriptors;
  var ce = Object.getOwnPropertySymbols;
  var ge = Object.prototype.hasOwnProperty,
    he = Object.prototype.propertyIsEnumerable;
  var ue = Math.pow,
    de = (t, r, e) =>
      r in t
        ? fe(t, r, {
            enumerable: !0,
            configurable: !0,
            writable: !0,
            value: e,
          })
        : (t[r] = e),
    ie = (t, r) => {
      for (var e in r || (r = {})) ge.call(r, e) && de(t, e, r[e]);
      if (ce) for (var e of ce(r)) he.call(r, e) && de(t, e, r[e]);
      return t;
    },
    se = (t, r) => pe(t, me(r));
  var K = (t, r, e) =>
    new Promise((i, o) => {
      var n = (u) => {
          try {
            s(e.next(u));
          } catch (c) {
            o(c);
          }
        },
        h = (u) => {
          try {
            s(e.throw(u));
          } catch (c) {
            o(c);
          }
        },
        s = (u) => (u.done ? i(u.value) : Promise.resolve(u.value).then(n, h));
      s((e = e.apply(t, r)).next());
    });
  function log$1(...t) {
    console.log("monkey_common", ...t);
  }
  function selectorOne(t, r = document) {
    try {
      return r.querySelector(t);
    } catch (e) {
      return (log$1("_selectorOne err", e), null);
    }
  }
  function selectorAll(t, r = document) {
    try {
      return r.querySelectorAll(t);
    } catch (e) {
      return (log$1("_selectorAll err", e), []);
    }
  }
  function getCptStyle(t, r = "", e = null) {
    if (!t) return "";
    const i = t.ownerDocument || document,
      o = i.defaultView || window;
    let n = o.getComputedStyle.bind(o);
    if (!String(o.getComputedStyle).includes("native code")) {
      const s = i.createElement("iframe");
      ((s.style.display = "none"), i.documentElement.appendChild(s));
      try {
        const u = s.contentWindow;
        u != null && u.getComputedStyle && (n = u.getComputedStyle.bind(u));
        const c = n(t, e);
        return r ? c[r] : c;
      } finally {
        s.remove();
      }
    }
    const h = n(t, e);
    return r ? h[r] : h;
  }
  function isVideoElement(t) {
    return t instanceof HTMLVideoElement;
  }
  function isIframeElement(t) {
    return t instanceof HTMLIFrameElement;
  }
  function getIframeDoc(t) {
    var r;
    try {
      return (
        (t == null ? void 0 : t.contentDocument) ||
        ((r = t == null ? void 0 : t.contentWindow) == null
          ? void 0
          : r.document) ||
        null
      );
    } catch (e) {
      log$1("getIframeDoc error", e == null ? void 0 : e.message);
    }
    return null;
  }
  function getParentEl(t, r = "BODY") {
    var o, n;
    if (!t) return null;
    let e = t.parentElement,
      i =
        (o = e == null ? void 0 : e.parentElement) == null
          ? void 0
          : o.childElementCount;
    for (; e && e.tagName !== r && i === 1;)
      ((e = e.parentElement),
        (i =
          (n = e == null ? void 0 : e.parentElement) == null
            ? void 0
            : n.childElementCount));
    return e && e.tagName === r ? t : e || t;
  }
  function getURL(t, r = void 0) {
    try {
      return new URL(t, r);
    } catch (e) {
      log$1("getURL error", t, e == null ? void 0 : e.message);
    }
    return {};
  }
  function isSameOrigin(t, r, e = void 0) {
    const i = getURL(t, e),
      o = getURL(r, e);
    return i.origin === o.origin;
  }
  function isBlob(t) {
    return /^blob:/.test(t);
  }
  function getScriptText(t) {
    if (!t || !t.length) return [];
    const r = [];
    return (
      Array.from(t).forEach((e) => {
        const i = clearScript(e.textContent);
        i && r.push(i);
      }),
      r
    );
  }
  function clearScript(t) {
    if (!t) return t;
    let r = t
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(new RegExp(`(?<![:"'])\\/\\/.*$`, "gm"), "");
    return ((r = r.replace(/<[^<>]+\/?>/gi, "")), r);
  }
  var freeGlobal =
    typeof global == "object" && global && global.Object === Object && global;
  const freeGlobal$1 = freeGlobal;
  var freeSelf =
      typeof self == "object" && self && self.Object === Object && self,
    root = freeGlobal$1 || freeSelf || Function("return this")();
  const root$1 = root;
  var Symbol$1 = root$1.Symbol;
  const Symbol$2 = Symbol$1;
  var objectProto$1 = Object.prototype,
    hasOwnProperty = objectProto$1.hasOwnProperty,
    nativeObjectToString$1 = objectProto$1.toString,
    symToStringTag$1 = Symbol$2 ? Symbol$2.toStringTag : void 0;
  function getRawTag(t) {
    var r = hasOwnProperty.call(t, symToStringTag$1),
      e = t[symToStringTag$1];
    try {
      t[symToStringTag$1] = void 0;
      var i = !0;
    } catch (n) {}
    var o = nativeObjectToString$1.call(t);
    return (
      i && (r ? (t[symToStringTag$1] = e) : delete t[symToStringTag$1]),
      o
    );
  }
  var objectProto = Object.prototype,
    nativeObjectToString = objectProto.toString;
  function objectToString(t) {
    return nativeObjectToString.call(t);
  }
  var nullTag = "[object Null]",
    undefinedTag = "[object Undefined]",
    symToStringTag = Symbol$2 ? Symbol$2.toStringTag : void 0;
  function baseGetTag(t) {
    return t == null
      ? t === void 0
        ? undefinedTag
        : nullTag
      : symToStringTag && symToStringTag in Object(t)
        ? getRawTag(t)
        : objectToString(t);
  }
  function isObjectLike(t) {
    return t != null && typeof t == "object";
  }
  var symbolTag = "[object Symbol]";
  function isSymbol(t) {
    return (
      typeof t == "symbol" || (isObjectLike(t) && baseGetTag(t) == symbolTag)
    );
  }
  var reWhitespace = /\s/;
  function trimmedEndIndex(t) {
    for (var r = t.length; r-- && reWhitespace.test(t.charAt(r)););
    return r;
  }
  var reTrimStart = /^\s+/;
  function baseTrim(t) {
    return t && t.slice(0, trimmedEndIndex(t) + 1).replace(reTrimStart, "");
  }
  function isObject(t) {
    var r = typeof t;
    return t != null && (r == "object" || r == "function");
  }
  var NAN = 0 / 0,
    reIsBadHex = /^[-+]0x[0-9a-f]+$/i,
    reIsBinary = /^0b[01]+$/i,
    reIsOctal = /^0o[0-7]+$/i,
    freeParseInt = parseInt;
  function toNumber(t) {
    if (typeof t == "number") return t;
    if (isSymbol(t)) return NAN;
    if (isObject(t)) {
      var r = typeof t.valueOf == "function" ? t.valueOf() : t;
      t = isObject(r) ? r + "" : r;
    }
    if (typeof t != "string") return t === 0 ? t : +t;
    t = baseTrim(t);
    var e = reIsBinary.test(t);
    return e || reIsOctal.test(t)
      ? freeParseInt(t.slice(2), e ? 2 : 8)
      : reIsBadHex.test(t)
        ? NAN
        : +t;
  }
  var now = function () {
    return root$1.Date.now();
  };
  const now$1 = now;
  var FUNC_ERROR_TEXT = "Expected a function",
    nativeMax = Math.max,
    nativeMin = Math.min;
  function debounce(t, r, e) {
    var i,
      o,
      n,
      h,
      s,
      u,
      c = 0,
      f = !1,
      _ = !1,
      S = !0;
    if (typeof t != "function") throw new TypeError(FUNC_ERROR_TEXT);
    ((r = toNumber(r) || 0),
      isObject(e) &&
        ((f = !!e.leading),
        (_ = "maxWait" in e),
        (n = _ ? nativeMax(toNumber(e.maxWait) || 0, r) : n),
        (S = "trailing" in e ? !!e.trailing : S)));
    function v(C) {
      var M = i,
        x = o;
      return ((i = o = void 0), (c = C), (h = t.apply(x, M)), h);
    }
    function I(C) {
      return ((c = C), (s = setTimeout(P, r)), f ? v(C) : h);
    }
    function E(C) {
      var M = C - u,
        x = C - c,
        a = r - M;
      return _ ? nativeMin(a, n - x) : a;
    }
    function p(C) {
      var M = C - u,
        x = C - c;
      return u === void 0 || M >= r || M < 0 || (_ && x >= n);
    }
    function P() {
      var C = now$1();
      if (p(C)) return U(C);
      s = setTimeout(P, E(C));
    }
    function U(C) {
      return ((s = void 0), S && i ? v(C) : ((i = o = void 0), h));
    }
    function F() {
      (s !== void 0 && clearTimeout(s), (c = 0), (i = u = o = s = void 0));
    }
    function b() {
      return s === void 0 ? h : U(now$1());
    }
    function T() {
      var C = now$1(),
        M = p(C);
      if (((i = arguments), (o = this), (u = C), M)) {
        if (s === void 0) return I(u);
        if (_) return (clearTimeout(s), (s = setTimeout(P, r)), v(u));
      }
      return (s === void 0 && (s = setTimeout(P, r)), h);
    }
    return ((T.cancel = F), (T.flush = b), T);
  }
  const SELECTOR_ALL = [
      [
        ".MacPlayer > table td#playleft > iframe",
        ".plist-body > h2 > a",
        "ul.anthology-list-play > li > a",
      ],
      [
        ".MacPlayer > table td#playleft > iframe",
        ".myui-panel__head > h1 > a",
        "ul.myui-content__list > li > a",
      ],
      [
        ".MacPlayer > table td#playleft > iframe",
        ".myui-panel-box > div > .myui-panel__head > h3.title",
        ".tab-content > .tab-pane > ul.myui-content__list > li > a.btn",
      ],
      [
        ".MacPlayer > table td#playleft > iframe",
        ".module-info-heading > h1 > a",
        ".module-play-list-content > a",
      ],
      [
        ".MacPlayer > table td#playleft > iframe",
        ".stui-player__detail > h1.title > a",
        "ul.stui-content__playlist > li > a",
      ],
      [
        ".vod-player-main .MacPlayer > table td#playleft > iframe",
        ".vod-player-main > div[class] > h1.title",
        ".play-content > ul.play-list-content > li.play-list-content-item > a",
      ],
      [
        "#media > .container div.relative > iframe.absolute",
        "#media > .container > h2",
      ],
      [
        "article div.detail-panel.border > div.w-full[style] > div.relative > iframe.absolute",
        "article header.detail-header.border > h1.font-bold",
      ],
      [
        "div.flex > div.flex-1 > div.relative.w-full[style] > iframe.absolute.w-full",
        "div[class*='py-2'] > div[class*='space-y'] > div.flex > span.text-white",
      ],
      [
        ".video-wrapper > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        "div.el-breadcrumb[style] > span.el-breadcrumb__item > span.el-breadcrumb__inner",
        ".change-route > p > a.cdn-btn",
      ],
      [
        "#app .w-full > .relative > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        "#app .w-full.flex > .w-full > div > .w-full.flex > span.font-bold[class*='text-']",
      ],
      [
        "#__next .w-full > .w-full.relative > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        "#__next > .w-full.flex > main.w-full > .w-full > h1.font-bold[class*='text-']",
      ],
      [
        ".v-player > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".v-details > .v-header > h1.sc-text",
      ],
      [
        ".panel-card .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".video-play > .panel-card > div.video-title",
      ],
      [
        ".video-play > div[class] > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".video-play > div.info-main > h2.title",
      ],
      [
        ".player-container > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".container > .video > div.title",
        ".container > .video > div.tags",
      ],
      [
        ".player-container > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".content > .title > span",
        ".content > .d-flex > .tags > span",
      ],
      [
        ".media > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".content > .title > span",
        ".content > span.van-tag",
      ],
      [
        ".video_content > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".uni-page-head > .uni-page-head-bd > .uni-page-head__title",
      ],
      [
        ".player-box > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".info-box .title > .actor-name > span",
      ],
      [
        ".v-video > .v-box-player > .player > .dplayer-video-wrap > video.dplayer-video",
        ".max > div#course-detail-info > div#video-title.v-t-title",
      ],
      [
        ".box > .v-video > .v-box-player > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        "body#page-detail > .box > div#course-detail-info > div.v-t-title",
      ],
      [
        "section > figure > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        "body > section > cite[style]",
      ],
      [
        ".vod-details-container .voddplayer > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".vod-details-container > div[class] > span.sc-text",
      ],
      [
        ".vod-details-container .voddplayer > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".container > .card > .card-header > h1.sc-text",
      ],
      [
        " main.container .aspect-video > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        "main.container > div[class] > div[class] > h1[class*='text']",
      ],
      [
        ".resource-detail > .play-box > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".resource-detail > .detail > div.flex > h2.video-title",
      ],
      [
        "body > #player1.xgplayer[style] > video",
        "body > div > p#titleH[style]",
        "body > #xl > div[style] > div[style]",
      ],
      [
        ".content > .vod-details-container > .plaryer-wrapper > div.xgplayer[style] > video",
        ".vod-details-container > .vod-info > .card-content > .vod-class > h1#titleH",
      ],
      [
        "#video div[class*='sc'] > div[class*='sc'] > #mse.xgplayer[style] > video",
        ".play-scroll div[class*='sc'] > a > div[class*='sc'] > h1.name",
      ],
      [
        ".player-video div[class*='play-list__PlayerVideoArea'] > .video-container > div[class*='video__Container'] > #mse.xgplayer[style] > video",
        "div[class*='vod-player__Layout'] > div[class*='player-detail__Container'] > div[class*='player-detail__Title'] > a > h1.title_name",
      ],
      [
        "div.xgplayer > video",
        ".play-box .play-box-side-header > .detail-title > a",
        ".source-list-box > .source-list-box-main > a.source-item > span",
      ],
      [
        "main.play-page section > .player-wrapper > div > div.xgplayer > video",
        "main.play-page section > article.video-info > h1.title",
      ],
      [
        "article.play_page .pppp_player > div.xgplayer > video",
        "article.play_page .video_info > div.title",
      ],
      [
        ".page > section > .playbox > .aivideoBox > div.xgplayer > video",
        ".page > div > .van-sticky > .hhh > span.title",
      ],
      [
        "div.van-list div.xgplayer > video",
        "div.van-list div.title > div[class*='color'] > div[class]",
      ],
      [
        ".main > .content > div.xgplayer > video",
        ".main > h1#titleH",
        '.main > #xl > div a[href*="type_Mid"]',
      ],
      [
        "main.dx-container .player-container > div.xgplayer > video",
        "main.dx-container div[class*='mt'] > h1.dx-title",
      ],
      [
        "div#video div[class] > div.xgplayer > video",
        ".play-scroll a[href] > div[class] > h1.name",
      ],
      [
        ".page > uni-view > uni-view > uni-view.playBox > .xgplayer > video",
        ".page > uni-view > uni-view uni-view.an_videoName",
      ],
      [
        "#__nuxt .v-responsive__content > div[style] > div[style] > #mse.xgplayer > video",
        "#__nuxt .v-container > div[class] > div[class] > h1.text-xl",
      ],
      [
        ".vdetail-page > section > .vBox > .xgplayer > video",
        ".vdetail-page .vdetail-social > .tab-content > .tab-pane > h2.vdetail-title",
      ],
      [
        ".vwbg > .myplayer > .xgplayer[style] > video",
        ".vwbg > .mymenu > a#hekund",
      ],
      [
        ".sorani-player-root[style] > .sorani-player-shell > .xgplayer > video",
        "div.flex[class*='svelte'] > div.flex[class*='svelte'] > div[class*='svelte'] > div.truncate[class*='text']",
      ],
      [
        ".play-video > .dplayer > .art-video-player > video.art-video",
        ".van-tab__pane > .play-detail > div.play-title",
      ],
      [
        ".play-video > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".van-tab__pane > .play-detail > div.play-title",
      ],
      [
        ".play_video > .dplayer > .art-video-player > video.art-video",
        ".play_scroll > .play_content > div.play_title",
      ],
      [
        ".play_video > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".play_scroll > .play_content > div.play_title",
      ],
      [
        ".box-content > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".box > div[class] > .tips > div.tips-title",
      ],
      ["body > iframe#app[src$='.xyz']", "body > div#loading"],
      [
        ".player-wrapper .art-player-container > .art-video-player > video.art-video",
        ".v-container > .v-card > div.v-card-title.whitespace-normal",
      ],
      [
        ".art-video-player > video.art-video",
        ".main-container > h1.novel-title",
      ],
      [
        ".relative > #artplayer > .art-video-player > video.art-video",
        'div[class*="xl"] > div > h2[class*="text"]',
      ],
      [
        ".video-player-container .player-box > .player-video-box > .art-video-player > video.art-video",
        ".video-player-container > .video-controller > .video-information > div.video-title",
      ],
      [
        "div[class*='AnimeDetail-module__ad_playerBox'] > div[class*='VideoPlayer-module__player'] > .art-video-player > video.art-video",
        "div[class*='AnimeDetail-module__ad_hero'] > div[class*='AnimeDetail-module__ad_info'] > h1[class*='AnimeDetail-module__ad_title']",
      ],
      [
        ".media > .videoBox > div.video-js > video.vjs-tech",
        ".container > .textBox > span.coteries",
      ],
      [
        ".video-detail .video-palyer .player-con > div.video-js > video.vjs-tech",
        ".video-detail .relative[style] > div.videoTitle",
      ],
      [
        ".video-detail .video-palyer .player-con > div.video-js > video.vjs-tech",
        ".video-palyer + div.break-all",
      ],
      [
        ".page-main .video-player div.video-js > video.vjs-tech",
        ".page-main > div.container > .player-name > .van-text-ellipsis",
      ],
      [
        "div.aspect-video > div.video-js > video.vjs-tech",
        "div.aspect-video.relative + div.font-bold",
      ],
      [
        "div[class^='mb'] > .video-player-wrap > video#player-wrap-v",
        "div[class^='mb'] + div[class^='mb'] > div.font-bold",
      ],
      [
        "li#playerdom > div.video-js > video.vjs-tech",
        "li#playerdom > div[style] > div[style] > span[style]",
      ],
      [
        ".video-wrapper > div.video-js > video.vjs-tech",
        ".video-group > div.title-content > h2",
      ],
      [
        ".container .video-box > div.video-js > video.vjs-tech",
        ".container div[class] > div.flex > h2[class*='text']",
      ],
      [
        ".play-wrapper > .videojs-content > div.video-js > video.vjs-tech",
        "#video__info > .title > div[class*='title'] > div.video_title",
      ],
      [
        ".migua .video-player > .player-con > div.video-js > video.vjs-tech",
        ".migua .video-detail > div.relative > div.videoTitle",
      ],
      [
        "#root .w-full.mx-auto > .w-full.relative > div.video-js > video.vjs-tech",
        "#root .w-full.mx-auto > div > .w-full.mx-auto > h4[class*='text-']",
      ],
      [
        ".player-wrapper > .video-wrapper > video",
        "uni-view.text-container > uni-text.long-text > span",
      ],
      [
        "#video > .player-wrapper > .video-wrapper > video",
        ".videoInfo > .desc_box > p.video_desc",
      ],
      [
        ".playArea > .playBox > #video > .video-js > video.vjs-tech",
        ".videoInfo > .desc_box > p.video_desc",
      ],
      [
        ".m4-main > .m4-player > .awp > video.awp-engine",
        ".m4-main > .m4-bread > ol > li.on",
      ],
      [
        ".w4-video > .w4-player > .awp > video.awp-engine",
        ".w4-bread > ol > li > h1",
        ".w4-video > .w4-episode > .w4-episode-head span",
      ],
      [
        "#player > .plyr > .plyr__video-wrapper > video#hls-video",
        ".wrap-heading > .wrap-title > h1.title",
      ],
      [
        ".video-container > .plyr > .plyr__video-wrapper > video#play-player",
        ".page .md-b > .b-a > .a-a",
      ],
      [
        ".player-container > .plyr > .plyr__video-wrapper > video",
        ".video-info > .info-header > .header-left > h4",
      ],
      [
        ".player-wrapper > .plyr > .plyr__video-wrapper > video",
        ".video-info > .info-header > .header-left > h1.h4",
      ],
      [
        ".main > .content > #player1 > .plyr > .plyr__video-wrapper > video",
        ".main > h1#titleH",
        '.main > #xl > div a[href*="type_Mid"]',
      ],
      [
        "div.relative > div[class*='aspect'] > .plyr > .plyr__video-wrapper > video",
        "div.flex > div[class*='flex'] > div[class*='mt-'] > h1[class*='text-']",
      ],
      [
        ".content > .content > .player_box > video#video",
        ".content > .content > h1.title",
      ],
      [
        ".vuecontainer > .container > .video-content > .play_video > video#video",
        ".vuecontainer > .container > .video-content > div.title",
      ],
      [
        ".pg-wrap > .pg-body > #video-container > video#video",
        ".pg-wrap > .pg-body > div[style] > b > span#name",
      ],
      [
        ".appel > .detail > #video-container > video#video",
        ".appel > .breadcrumbs > span > span#name",
      ],
      [
        "#page-video #player > iframe",
        "#page-video div > h1",
        "#details > div > .tab-detail",
      ],
      [
        ".main > #player > div[style] > iframe",
        ".main > #video-info > h1.title",
      ],
      [
        ".main .video-wrap .video-row > iframe",
        ".main .video-wrap .archive-title > h1 > b",
      ],
      [
        "#player-container > iframe#v2-player",
        ".narrow-center-box > .info-tags-container > h2",
      ],
      [
        "body > iframe#video[src^='https://video.isyour.love/player/getplayer']",
        "body > div.container > form input",
        "body > div.container > div.navbar > ul.nav > li.nav-item > a",
      ],
      [
        "body > div[id][style*='fixed'] > div[style*='fixed'] > iframe[style]",
        "body > div[id][style*='fixed'] > div[style*='color'] > div[style*='white-space']",
      ],
      [
        "#players > .player-wrapper > .player > iframe[class]",
        "body > .container > #main > h1[class]",
      ],
      [
        "#body > div[class][id] > div[style] > #olpcode > iframe",
        "#body > div[class][id] > div[style] > div.pptitle",
      ],
      [
        ".vodshowbox > .headerbox > #video-container > iframe#video-player",
        "#app > .vodshowbox > .infobox > h1",
      ],
      [
        ".dooplay_player > #playcontainer > #dooplay_player_response > .pframe > iframe.metaframe",
        ".content > .dooplay_player > h2",
      ],
      [
        "#content > .Gm-pic > .Gm-desc > p[style] > iframe",
        "#content > .downl_head > .info > .txt > h1.h1[title]",
      ],
      [
        "section.main > section.playbox > .playvideo > .player > iframe#cciframe",
        "section.main > section > section.mod_a > section.th_a > span.sMark",
      ],
      [
        ".container > .container-fluid > .video-player-container > .player-box > iframe#v2-player",
        ".container > .narrow-center-box > .info-tags-container > h1.h3",
      ],
      [
        ".container .hl-player-wrap > .MacPlayer > #playleft > iframe#playerMainFrame",
        ".hl-playinfo-wrap > .hl-vod-infos > .hl-infos-head > h2 > span.hl-infos-title",
      ],
      [
        ".publicAllContentBg > .videoBigBg > .madouym > .MacPlayer > iframe",
        ".van-collapse > .van-collapse-item > .van-cell > .van-cell__title > span",
      ],
      [
        "flt-platform-view > video[id$='player']",
        "flutter-view > flt-glass-pane > flt-platform-view",
      ],
      [
        ".video-player-live > #video-live > video",
        ".view-box #live-box-top > .header > .video-player-live",
      ],
      [
        "#video-content > #video-player-bg .video-bg-pic > video",
        "#video-content-metadata .video-title-container > .video-title > strong",
      ],
      [
        ".web-rtc-content-wrapper > .web-rtc-playing > .video-element-wrapper > video.video-element",
        ".visible-items > .header-sub-item-wrapper > a.viewcam-profile-menu-item > span.viewcam-profile-menu-item__label",
      ],
      [
        ".main-wrapper .player > .videoholder > div[style] > video.video-js",
        ".player > .videoholder > #description > .ui-tab-inner-wrapper > .card > h1",
      ],
      [
        ".player-layout > .player-panel > .player-viewport > video.player-video",
        ".player-layout > .player-panel > div.toolbar > div > h1#playerTitle",
      ],
      [
        ".play-box #player > div[style] > .container > video",
        ".play-container > .play-box > h1[class*='text']",
      ],
      [
        ".container > .video-container > .player-wrapper > .play_video  > video.video-player",
        ".container > .video-container > .video-header > h1.video-title",
      ],
      [
        ".watch-page > div.relative > media-controller.absolute[class*='player'] > video",
        "media-controller > .player-top-bar > a.flex[href*='title'] > p.truncate",
      ],
      [
        ".movie-detail-container .movie-detail-card > .video-player-block > .video-player > video.movie-video",
        "main.app-main-movie .movie-detail-container .movie-detail-card > .movie-title-bar > h1",
      ],
      [
        ".content > .content-box > .player-box > .video-js > video#player-container-id_html5_api",
        ".content > .content-box > .videopro > div.video-name",
      ],
      [
        "body[class] > #app > #player-box > .video-js > video#player-container-id_html5_api",
        "body[class] > #app > .v-title",
      ],
      [
        "body.app-container div[class] > div[id][class] > .video-js[style] > video.vjs-tech",
        "body.app-container div[class*='center'][style*='align-items'] > div > section[class] > div[class][style] > div",
      ],
      [
        "main[class*='flex'] > div[class] > div[class] > div.relative > video.object-contain",
        "main[class*='flex'] > div[class] > div[class] > h1[class*='text']",
      ],
      [
        "div.w-full > div.w-full > div.relative > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        "div.w-full > div[class*='min-'] > main > div > div[class] > div[class*='text-'] > div",
      ],
    ],
    SELECTOR_SPECS_SITE = [
      [
        ".v-player > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".v-details > .v-header > h1.sc-text",
      ],
      [
        ".player-container > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".container > .video > div.title",
        ".container > .video > div.tags",
      ],
      [
        ".player-container > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".content > .title > span",
        ".content > .d-flex > .tags > span",
      ],
      [
        ".media > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".content > .title > span",
        ".content > span.van-tag",
      ],
      [
        "div.xgplayer > video",
        ".vod-details-container div.vod-class > h1#titleH",
        ".vod-details-container #xl > div > a",
      ],
      [
        ".player-wrapper .art-player-container > .art-video-player > video.art-video",
        ".v-container > .v-card > div.v-card-title.whitespace-normal",
      ],
      [
        ".m4-main > .m4-player > .awp > video.awp-engine",
        ".m4-main > .m4-bread > ol > li.on",
      ],
      [
        "#player > .plyr > .plyr__video-wrapper > video#hls-video",
        ".wrap-heading > .wrap-title > h1.title",
      ],
      [
        ".play_video > .dplayer > .art-video-player > video.art-video",
        ".play_scroll > .play_content > div.play_title",
      ],
      [
        ".play_video > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".play_scroll > .play_content > div.play_title",
      ],
      [
        ".box-content > .dplayer > .dplayer-video-wrap > video.dplayer-video",
        ".box > div[class] > .tips > div.tips-title",
      ],
      [
        ".w4-video > .w4-player > .awp > video.awp-engine",
        ".w4-bread > ol > li > h1",
        ".w4-video > .w4-episode > .w4-episode-head span",
      ],
      [
        ".pg-wrap > .pg-body > #video-container > video#video",
        ".pg-wrap > .pg-body > div[style] > b > span#name",
      ],
      [
        ".appel > .detail > #video-container > video#video",
        ".appel > .breadcrumbs > span > span#name",
      ],
      [
        "body.app-container div[class] > div[id][class] > .video-js[style] > video.vjs-tech",
        "body.app-container div[class*='center'][style*='align-items'] > div > section[class] > div[class][style] > div",
      ],
    ],
    IS_SONE_SITE = {};
  typeof document.createElement("div").computedStyleMap == "function";
  function log(...t) {
    console.log("[x_video 1.1.147]", ...t);
  }
  function getVideoRealSize(t, r = !1) {
    const e = t.getBoundingClientRect();
    return e;
  }
  function getPageRect(t) {
    var r, e;
    if (t === "screen")
      return {
        width: screen.width,
        height: screen.height,
      };
    if (t === "inner")
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    if (t === "visual") {
      const i = window.visualViewport;
      return {
        width: (r = i == null ? void 0 : i.width) != null ? r : 0,
        height: (e = i == null ? void 0 : i.height) != null ? e : 0,
      };
    }
    if (t === "client") {
      const { width: i, height: o } =
        document.documentElement.getBoundingClientRect();
      return {
        width: i < 1 ? screen.width : i,
        height: o < 1 ? screen.height : o,
      };
    }
    return {
      width: 0,
      height: 0,
    };
  }
  function getPageStaticRect() {
    const t = [
        getPageRect("inner"),
        getPageRect("visual"),
        getPageRect("client"),
      ],
      r = (e) => {
        const i = e.filter((o) => o > 10);
        return i.length ? Math.min(...i) : 0;
      };
    return {
      width: r(t.map((e) => e.width)),
      height: r(t.map((e) => e.height)),
    };
  }
  function isElementFullyOutsideViewport(t, r) {
    const e = r || t.getBoundingClientRect(),
      i = getPageRect("screen").width;
    return e.right <= 0 || e.left >= i;
  }
  function nodeHtmlWithoutPoster(t) {
    return (t == null ? void 0 : t.tagName) !== "VIDEO" ||
      !(t != null && t.outerHTML)
      ? String(t != null ? t : "")
      : t.outerHTML.replace(
          /\s+poster\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
          "",
        );
  }
  function filterClientUrlBySiteSelector(t, r) {
    return clientUrlIfPrimaryIsElement(
      t,
      r,
      SELECTOR_ALL,
      "客户端视频链接被丢弃：站点视频相关选择器不在选择器组内",
      "客户端视频链接被丢弃：不是配置的那个视频元素",
    );
  }
  function useClientUrlBySpecsSiteSelector(t, r) {
    return clientUrlIfPrimaryIsElement(
      t,
      r,
      SELECTOR_SPECS_SITE,
      "非特殊站点：站点视频相关选择器不在选择器组内",
      "非特殊站点：不是配置的那个视频元素",
    );
  }
  function clientUrlIfPrimaryIsElement(t, r, e, i, o) {
    if (!t) return "";
    const n = getMatchedSitePrimarySelector(e);
    if (!n) return (log("_clientUrlIfPrimaryIsElement", i), "");
    const h = selectorOne(n);
    return h !== r
      ? (log("_clientUrlIfPrimaryIsElement", o, n, h, r), "")
      : isMankoSite() && t.includes("video.m3u8")
        ? ""
        : t;
  }
  function getMatchedSitePrimarySelector(t) {
    var r;
    for (const e of t)
      if (e.length && e.every((i) => selectorOne(i)))
        return (r = e[0]) != null ? r : "";
    return "";
  }
  function is9UUSite() {
    return IS_SONE_SITE.is9UUSite
      ? !0
      : selectorOne(
            ".dplayer-container > .dplayer-vip > .content > video.video-content",
          ) &&
          selectorOne(".back-title > span.text-ellipsis") &&
          selectorOne('.download-row > .col > span[class^="c"]')
        ? ((IS_SONE_SITE.is9UUSite = !0), !0)
        : !1;
  }
  function is91Site() {
    return IS_SONE_SITE.is91Site
      ? !0
      : selectorOne(
            ".post-content > .dplayer > .dplayer-video-wrap > video.dplayer-video",
          ) &&
          selectorOne(".post > h1.post-title") &&
          selectorOne(".post-content > h2")
        ? ((IS_SONE_SITE.is91Site = !0), !0)
        : !1;
  }
  function isYY8YSite() {
    return IS_SONE_SITE.isYY8YSite
      ? !0
      : selectorOne(".main > .content > .xgplayer > video") &&
          selectorOne(".main > h1#titleH") &&
          selectorOne('.main > #xl > div a[href*="type_Mid"]')
        ? ((IS_SONE_SITE.isYY8YSite = !0), !0)
        : !1;
  }
  function isPDAVSite() {
    return IS_SONE_SITE.isPDAVSite
      ? !0
      : selectorOne(
            ".main > .content > #player1 > .plyr > .plyr__video-wrapper > video",
          ) &&
          selectorOne(".main > h1#titleH") &&
          selectorOne('.main > #xl > div a[href*="type_Mid"]')
        ? ((IS_SONE_SITE.isPDAVSite = !0), !0)
        : !1;
  }
  function isAcfunSite1(t) {
    return IS_SONE_SITE.isAcfunSite1
      ? !0
      : /Ac_fun/i.test(t) &&
          selectorOne(
            "article.play_page .pppp_player > div.xgplayer > video",
          ) &&
          selectorOne("article.play_page .video_info > div.title")
        ? ((IS_SONE_SITE.isAcfunSite1 = !0), !0)
        : !1;
  }
  function isAcfunSite2(t) {
    return IS_SONE_SITE.isAcfunSite2
      ? !0
      : /Ac_fun/i.test(t) &&
          selectorOne(
            ".container > .media > .dy-videoBox > .video-js > video.vjs-tech",
          ) &&
          selectorOne(".dynamicItem > .container > .textWrap > .textBox")
        ? ((IS_SONE_SITE.isAcfunSite2 = !0), !0)
        : !1;
  }
  function isAcfunAiSite(t) {
    return IS_SONE_SITE.isAcfunAiSite
      ? !0
      : /Ac_fun/i.test(t) &&
          selectorOne(
            "main.content > .mediaBlock > .aivideoBox > div.xgplayer > video",
          ) &&
          selectorOne("main.content > .info > h1")
        ? ((IS_SONE_SITE.isAcfunAiSite = !0), !0)
        : !1;
  }
  function isYJSite() {
    return IS_SONE_SITE.isYJSite
      ? !0
      : selectorOne(
            ".container > .video-content > .play-content > video#video",
          ) && selectorOne(".container > .video-content > h1")
        ? ((IS_SONE_SITE.isYJSite = !0), !0)
        : !1;
  }
  function isA123TVSite() {
    return IS_SONE_SITE.isA123TVSite
      ? !0
      : selectorOne(".w4-video > .w4-player > .awp > video.awp-engine") &&
          selectorOne(".w4-bread > ol > li > h1") &&
          selectorOne(".w4-video > .w4-episode > .w4-episode-head span")
        ? ((IS_SONE_SITE.isA123TVSite = !0), !0)
        : !1;
  }
  function isSouAVSite(t) {
    return IS_SONE_SITE.isSouAVSite
      ? !0
      : /搜AV/i.test(t) &&
          selectorOne(
            ".dplayer#dplayerId > .dplayer-video-wrap > video.dplayer-video",
          ) &&
          selectorOne("div.flex.w-full > div.flex.w-full > p.truncate.w-full")
        ? ((IS_SONE_SITE.isSouAVSite = !0), !0)
        : !1;
  }
  function isMankoSite() {
    var r, e;
    if (IS_SONE_SITE.isMankoSite) return !0;
    const t =
      (e =
        (r = selectorOne('meta[property="og:site_name"]')) == null
          ? void 0
          : r.getAttribute("content")) == null
        ? void 0
        : e.trim();
    return (/Manko/i.test(t) &&
      selectorOne(
        "div.flex > div.flex-1 > div.relative.w-full[style] > iframe.absolute.w-full",
      ) &&
      selectorOne(
        "div[class*='py-2'] > div[class*='space-y'] > div.flex > span.text-white",
      )) ||
      /manko\.fun/i.test(location.hostname)
      ? ((IS_SONE_SITE.isMankoSite = !0), !0)
      : !1;
  }
  function isYues99Site() {
    return IS_SONE_SITE.isYues99Site
      ? !0
      : selectorOne(
            ".player-container > #dplayer.dplayer > .dplayer-video-wrap > video.dplayer-video",
          ) &&
          selectorOne(
            ".player-container > .player-side-panel > .panel-item > a.side-btn-link",
          )
        ? ((IS_SONE_SITE.isYues99Site = !0), !0)
        : !1;
  }
  function isGDSite(t) {
    return IS_SONE_SITE.isGDSite
      ? !0
      : /G點網/i.test(t) &&
          selectorOne(
            ".player-container > .dplayer > .dplayer-video-wrap > video.dplayer-video",
          ) &&
          (selectorOne(".container > .video > div.title") ||
            selectorOne(".content > .title > span"))
        ? ((IS_SONE_SITE.isGDSite = !0), !0)
        : !1;
  }
  function isAGESite(t) {
    return IS_SONE_SITE.isAGESite
      ? !0
      : /AGE/i.test(t) &&
          selectorOne(
            "section.container > .player-box > .player > iframe.embed-responsive-item",
          ) &&
          selectorOne("section.container > .detail-box > .bd > h2.g-box-title")
        ? ((IS_SONE_SITE.isAGESite = !0), !0)
        : !1;
  }
  function is18AVSite() {
    return IS_SONE_SITE.is18AVSite
      ? !0
      : selectorOne(
            ".video-wrap > .left > center .video-row iframe[id*='iframe'][src*='play.php']",
          ) && selectorOne(".video-wrap > .left > .archive-title > h1")
        ? ((IS_SONE_SITE.is18AVSite = !0), !0)
        : !1;
  }
  function isDYDSSite() {
    return IS_SONE_SITE.isDYDSSite
      ? !0
      : selectorOne(
            ".player-layout > .player-panel > .player-viewport > video.player-video",
          ) &&
          selectorOne(
            ".player-layout > .player-panel > div.toolbar > div > h1#playerTitle",
          )
        ? ((IS_SONE_SITE.isDYDSSite = !0), !0)
        : !1;
  }
  function isMFKPSite() {
    return IS_SONE_SITE.isMFKPSite
      ? !0
      : selectorOne(
            ".page > uni-view > uni-view > uni-view.playBox > .xgplayer > video",
          ) && selectorOne(".page > uni-view > uni-view uni-view.an_videoName")
        ? ((IS_SONE_SITE.isMFKPSite = !0), !0)
        : !1;
  }
  function isAVHAISite() {
    return IS_SONE_SITE.isAVHAISite
      ? !0
      : selectorOne(
            "#__nuxt .v-responsive__content > div[style] > div[style] > #mse.xgplayer > video",
          ) &&
          selectorOne(
            "#__nuxt .v-container > div[class] > div[class] > h1.text-xl",
          )
        ? ((IS_SONE_SITE.isAVHAISite = !0), !0)
        : !1;
  }
  function isSae8Site() {
    return IS_SONE_SITE.isSae8Site
      ? !0
      : selectorOne(".play-box #player > div[style] > .container > video") &&
          selectorOne(".play-container > .play-box > h1[class*='text']")
        ? ((IS_SONE_SITE.isSae8Site = !0), !0)
        : !1;
  }
  function isTvSmartSite() {
    return IS_SONE_SITE.isTvSmartSite
      ? !0
      : selectorOne(
            ".iptv-shell > .player-column > .player-frame > video#live-player",
          ) &&
          selectorOne(
            ".iptv-shell > .player-column > .now-playing > .now-copy > h1#now-title",
          ) &&
          selectorOne("button.channel-card.active")
        ? ((IS_SONE_SITE.isTvSmartSite = !0), !0)
        : !1;
  }
  function isGCQSite() {
    return IS_SONE_SITE.isGCQSite
      ? !0
      : (selectorOne(".pg-wrap > .pg-body > #video-container > video#video") &&
            selectorOne(".pg-wrap > .pg-body > div[style] > b > span#name")) ||
          (selectorOne(".appel > .detail > #video-container > video#video") &&
            selectorOne(".appel > .breadcrumbs > span > span#name"))
        ? ((IS_SONE_SITE.isGCQSite = !0), !0)
        : !1;
  }
  function is17Site() {
    return IS_SONE_SITE.is17Site
      ? !0
      : selectorOne(".player-wrapper > .plyr > .plyr__video-wrapper > video") &&
          selectorOne(".video-info > .info-header > .header-left > h1.h4")
        ? ((IS_SONE_SITE.is17Site = !0), !0)
        : !1;
  }
  function isAiWeiNaiSite() {
    return IS_SONE_SITE.isAiWeiNaiSite
      ? !0
      : selectorOne(
            ".play-wrapper > .videojs-content > div.video-js > video.vjs-tech",
          ) &&
          selectorOne(
            "#video__info > .title > div[class*='title'] > div.video_title",
          )
        ? ((IS_SONE_SITE.isAiWeiNaiSite = !0), !0)
        : !1;
  }
  function is618010Site() {
    return IS_SONE_SITE.is618010Site
      ? !0
      : selectorOne(".vwbg > .myplayer > .xgplayer[style] > video") &&
          selectorOne(".vwbg > .mymenu > a#hekund")
        ? ((IS_SONE_SITE.is618010Site = !0), !0)
        : !1;
  }
  function isXiuseSite() {
    return IS_SONE_SITE.isXiuseSite
      ? !0
      : (selectorOne(
            ".container > .video-container > .player-wrapper > .play_video  > video.video-player",
          ) &&
            selectorOne(
              ".container > .video-container > .video-header > h1.video-title",
            )) ||
          (selectorOne(
            ".vuecontainer > .container > .video-content > .play_video  > video#video",
          ) &&
            selectorOne(
              ".vuecontainer > .container > .video-content > div.title",
            ))
        ? ((IS_SONE_SITE.isXiuseSite = !0), !0)
        : !1;
  }
  function isHuMaoSite() {
    return IS_SONE_SITE.isHuMaoSite
      ? !0
      : selectorOne(
            ".uni-video-container > .plyr > .plyr__video-wrapper > video",
          ) &&
          selectorOne(".video-info-section > .video-title > .title-text > span")
        ? ((IS_SONE_SITE.isHuMaoSite = !0), !0)
        : !1;
  }
  function isPornCideSite() {
    return IS_SONE_SITE.isPornCideSite
      ? !0
      : selectorOne("body > #player > iframe.player") &&
          selectorOne("body > div.title") &&
          selectorOne("body > .back_video > div.preview > div.image > a > img")
        ? ((IS_SONE_SITE.isPornCideSite = !0), !0)
        : !1;
  }
  function isJPMSite() {
    return IS_SONE_SITE.isJPMSite
      ? !0
      : selectorOne(
            ".video-container > div[class*='el'] > div[class*='el'] > .video-player-wrapper > .xgplayer > video",
          ) &&
          selectorOne(
            ".video-container > div[class*='el'] > div[class*='el'] > div[class][style] > h2.video-detail__title",
          )
        ? ((IS_SONE_SITE.isJPMSite = !0), !0)
        : !1;
  }
  function isMacDogSite() {
    return IS_SONE_SITE.isMacDogSite
      ? !0
      : selectorOne(
            "div[class*='_playerWrap'] > div[class*='_playerInner'] > div[style] > .art-video-player > video.art-video",
          ) &&
          selectorOne(
            "main[class*='_main'] > section[class*='_info'] > div[class*='_header'] > h1[class*='_title']",
          )
        ? ((IS_SONE_SITE.isMacDogSite = !0), !0)
        : !1;
  }
  function isXHubSite() {
    return !1;
  }
  function isHongTaoSite() {
    return IS_SONE_SITE.isHongTaoSite
      ? !0
      : (selectorOne(
            "#app .w-full > .relative > .dplayer > .dplayer-video-wrap > video.dplayer-video",
          ) &&
            selectorOne(
              "#app .w-full.flex > .w-full > div > .w-full.flex > span.font-bold[class*='text-']",
            )) ||
          (selectorOne(
            "#__next .w-full > .w-full.relative > .dplayer > .dplayer-video-wrap > video.dplayer-video",
          ) &&
            selectorOne(
              "#__next > .w-full.flex > main.w-full > .w-full > h1.font-bold[class*='text-']",
            ))
        ? ((IS_SONE_SITE.isHongTaoSite = !0), !0)
        : !1;
  }
  function isKFTVSite() {
    return IS_SONE_SITE.isKFTVSite
      ? !0
      : selectorOne(
            ".watch-page > div.relative > media-controller.absolute[class*='player'] > video",
          ) &&
          selectorOne(
            "media-controller > .player-top-bar > a.flex[href*='title'] > p.truncate",
          )
        ? ((IS_SONE_SITE.isKFTVSite = !0), !0)
        : !1;
  }
  function isMaDouSite() {
    return IS_SONE_SITE.isMaDouSite
      ? !0
      : selectorOne(
            ".streamit-video-watch-plyr__xplayer > .plyr > .plyr__video-wrapper > video",
          ) &&
          selectorOne(
            ".details-parts > .streamit-video-detail-desc > div[class] > h3.streamit-video-detail-headline",
          )
        ? ((IS_SONE_SITE.isMaDouSite = !0), !0)
        : !1;
  }
  function isKanJuSite() {
    return IS_SONE_SITE.isKanJuSite
      ? !0
      : selectorOne(
            "div[class*='player-frame-stage'] > div[class*='player-frame'] > .art-video-player > video.art-video",
          ) &&
          selectorOne(
            ".movie-player-content-summary-heading > .movie-player-content-summary-leading > button > span.movie-player-content-summary-title",
          )
        ? ((IS_SONE_SITE.isKanJuSite = !0), !0)
        : !1;
  }
  function isMiGuaSite() {
    return IS_SONE_SITE.isMiGuaSite
      ? !0
      : selectorOne(
            ".migua .video-player > .player-con > .video-js > video.vjs-tech",
          ) &&
          selectorOne(".migua .video-detail > div.relative > div.videoTitle")
        ? ((IS_SONE_SITE.isMiGuaSite = !0), !0)
        : !1;
  }
  function isJavryoSite() {
    return IS_SONE_SITE.isJavryoSite
      ? !0
      : selectorOne(
            ".dooplay_player > #playcontainer > #dooplay_player_response > .pframe > iframe.metaframe",
          ) && selectorOne(".content > .dooplay_player > h2")
        ? ((IS_SONE_SITE.isJavryoSite = !0), !0)
        : !1;
  }
  function is7cSite() {
    return IS_SONE_SITE.is7cSite
      ? !0
      : selectorOne(
            "main.page-main > .video-detail-page__players > .video-custom-wrapper > .dplayer > .dplayer-video-wrap > video.dplayer-video",
          ) &&
          selectorOne(
            ".video-detail-page > main.page-main > h1.video-detail-page__title",
          )
        ? ((IS_SONE_SITE.is7cSite = !0), !0)
        : !1;
  }
  function isQiMaoSite() {
    return IS_SONE_SITE.isQiMaoSite
      ? !0
      : selectorOne(
            ".movie-detail-container .movie-detail-card > .video-player-block > .video-player > video.movie-video",
          ) &&
          selectorOne(
            "main.app-main-movie .movie-detail-container .movie-detail-card > .movie-title-bar > h1",
          )
        ? ((IS_SONE_SITE.isQiMaoSite = !0), !0)
        : !1;
  }
  function isMissAVSite() {
    return IS_SONE_SITE.isMissAVSite
      ? !0
      : selectorOne(
            "div.relative > div[class*='aspect'] > .plyr > .plyr__video-wrapper > video",
          ) &&
          selectorOne(
            "div.flex > div[class*='flex'] > div[class*='mt-'] > h1[class*='text-']",
          )
        ? ((IS_SONE_SITE.isMissAVSite = !0), !0)
        : !1;
  }
  function is18mhSite() {
    return IS_SONE_SITE.is18mhSite
      ? !0
      : selectorOne(
            "div[class*='video-detail-page__player'] > .video-detail-page__aspect-wrap > .player-container > .xgplayer > video",
          ) &&
          selectorOne(
            "main.app-content > .video-detail-page > .video-detail-page__main > h1.video-detail-page__title",
          )
        ? ((IS_SONE_SITE.is18mhSite = !0), !0)
        : !1;
  }
  function isWuSeSite() {
    return IS_SONE_SITE.isWuSeSite
      ? !0
      : selectorOne(
            ".resource-detail > .play-box > .dplayer > .dplayer-video-wrap > video.dplayer-video",
          ) &&
          selectorOne(".resource-detail > .detail > div.flex > h2.video-title")
        ? ((IS_SONE_SITE.isWuSeSite = !0), !0)
        : !1;
  }
  function isHuangDouSite() {
    return IS_SONE_SITE.isHuangDouSite
      ? !0
      : selectorOne(
            "body[class] > #app > #player-box > .video-js > video#player-container-id_html5_api",
          ) && selectorOne("body[class] > #app > .v-title")
        ? ((IS_SONE_SITE.isHuangDouSite = !0), !0)
        : !1;
  }
  function isMiTaoSite() {
    return IS_SONE_SITE.isMiTaoSite
      ? !0
      : selectorOne(
            "#root .w-full.mx-auto > .w-full.relative > div.video-js > video.vjs-tech",
          ) &&
          selectorOne(
            "#root .w-full.mx-auto > div > .w-full.mx-auto > h4[class*='text-']",
          )
        ? ((IS_SONE_SITE.isMiTaoSite = !0), !0)
        : !1;
  }
  function isMangoSite() {
    return IS_SONE_SITE.isMangoSite
      ? !0
      : (selectorOne("#video > .player-wrapper > .video-wrapper > video") &&
            selectorOne(".videoInfo > .desc_box > p.video_desc")) ||
          (selectorOne(
            ".playArea > .playBox > #video > .video-js > video.vjs-tech",
          ) &&
            selectorOne(".playArea > .videoInfo > .desc_box > p.video_desc")) ||
          (selectorOne(".playArea > .playBox > #video > video") &&
            selectorOne(".playArea > .videoInfo > .desc_box > p.video_desc"))
        ? ((IS_SONE_SITE.isMangoSite = !0), !0)
        : !1;
  }
  function isHanime1Site(t) {
    return IS_SONE_SITE.isHanime1Site
      ? !0
      : /Hanime/i.test(t) &&
          selectorOne(
            "#content-div > .video-show-width > #player-div-wrapper video#player",
          ) &&
          selectorOne(
            "#content-div > .video-show-width > #player-div-wrapper > h3.video-details-wrapper",
          )
        ? ((IS_SONE_SITE.isHanime1Site = !0), !0)
        : !1;
  }
  function isAVBigSite(t) {
    return !1;
  }
  function isJPSite() {
    return IS_SONE_SITE.isJPSite
      ? !0
      : (selectorOne(
            "#video div[class*='sc'] > div[class*='sc'] > #mse.xgplayer[style] > video",
          ) &&
            selectorOne(
              ".play-scroll div[class*='sc'] > a > div[class*='sc'] > h1.name",
            )) ||
          (selectorOne(
            ".player-video div[class*='play-list__PlayerVideoArea'] > .video-container > div[class*='video__Container'] > #mse.xgplayer[style] > video",
          ) &&
            selectorOne(
              "div[class*='vod-player__Layout'] > div[class*='player-detail__Container'] > div[class*='player-detail__Title'] > a > h1.title_name",
            ))
        ? ((IS_SONE_SITE.isJPSite = !0), !0)
        : !1;
  }
  function isBilibiliSite(t) {
    return IS_SONE_SITE.isBilibiliSite
      ? !0
      : /bilibili/i.test(t) &&
          selectorOne(
            "#bilibili-player .bpx-player-container > .bpx-player-primary-area > .bpx-player-video-area > .bpx-player-video-perch > .bpx-player-video-wrap > video",
          ) &&
          selectorOne(
            ".video-info-container > .video-info-title > .video-info-title-inner > h1.video-title",
          )
        ? ((IS_SONE_SITE.isBilibiliSite = !0), !0)
        : !1;
  }
  function isMiaoMiSite() {
    return IS_SONE_SITE.isMiaoMiSite
      ? !0
      : (selectorOne(
            "body.app-container div[class] > div[id][class] > .video-js[style] > video.vjs-tech",
          ) &&
            selectorOne(
              "body.app-container div[class*='center'][style*='align-items'] > div > section[class] > div[class][style] > div",
            )) ||
          (selectorOne(
            "main[class*='flex'] > div[class] > div[class] > div.relative > video.object-contain",
          ) &&
            selectorOne(
              "main[class*='flex'] > div[class] > div[class] > h1[class*='text']",
            )) ||
          (selectorOne(
            "div.w-full > div.w-full > div.relative > .dplayer > .dplayer-video-wrap > video.dplayer-video",
          ) &&
            selectorOne(
              "div.w-full > div[class*='min-'] > main > div > div[class] > div[class*='text-'] > div",
            ))
        ? ((IS_SONE_SITE.isMiaoMiSite = !0), !0)
        : !1;
  }
  function isMasexSite() {
    return IS_SONE_SITE.isMasexSite
      ? !0
      : selectorOne(
            ".vd-player-col > .vd-player-box > .plyr > .plyr__video-wrapper > video.vd-player",
          ) && selectorOne("main.page-main > .wrap > .vd-wrap > h1.vd-title")
        ? ((IS_SONE_SITE.isMasexSite = !0), !0)
        : !1;
  }
  function isDYRSSite() {
    return !1;
  }
  const isHttpOrHttps = (t) => /^https?:\/\//i.test(t),
    gDeviceType = (() => {
      const t = navigator.userAgent;
      return /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(t)
        ? /iPad|Android(?!.*Mobile)/i.test(t)
          ? "tablet"
          : "mobile"
        : "pc";
    })(),
    SRC_ATTRS = ["src", "data-original", "data-src", "data-url", "data-source"],
    VIDEO_SOURCE_REGEXP =
      /https?:\/\/[^\s?&=]+\.(mp4|m3u8)(\/?)($|\?([\w_-]+=[^\s?&]*)(&[\w_]+=[^\s?&]*)*)/i,
    VIDEO_SOURCE_REGEXP2 = /https?:\/\/[^\s?&=]+\.(mp4|m3u8)/i,
    gRegSetm3u8 =
      /setm3u8\(['"]([-_/a-zA-Z0-9\\]*)['"],['"]([-_/a-zA-Z0-9\\]+)['"].*\)/i,
    gRegHttpBlob = /^(https?:|blob:)/i,
    gVideoFrom = {
      src: "src",
      source: "source",
      parent: "parent",
      custom: "custom",
      script: "script",
      window: "window",
      iframe: "iframe",
      ajax: "ajax",
      blob: "blob",
      other: "other",
      client: "client",
      server: "server",
    };
  let gParams = {
      minSize: 0,
      supportFullScreen: !1,
      supportHiddenElement: !1,
      supportParent: !0,
      supportCustom: !0,
      supportScript: !0,
      supportWindow: !0,
      supportIframe: !0,
      supportAjax: !0,
    },
    gPageHref = "",
    gDocTitle = "",
    gAllScriptText = [],
    gGetVideoSucCB = null,
    gServerUrl = "",
    gHiddenElementMap = new WeakMap(),
    gSmallSizeElementMap = new WeakMap(),
    gCustomVideoMap = new Map(),
    gIframeWS = new WeakSet(),
    gOnlyVideo = null,
    gFetchIng = !1,
    gFetchInnerIng = !1,
    gGetMove = !1,
    gFetchUrlSite = "",
    gAjaxVideoUrl = "",
    scriptVideoMatchUrl = "",
    gDynamicObserver = !1,
    gElementObserver = null,
    gSizeObserver = null,
    gVisibleObserver = null,
    gAutoTimer = null,
    gAutoNum = 0,
    resetVideoNum = 0;
  function getVideoObj(t, r) {
    var y, A, $, W, q;
    const e = getAllTagEl(),
      i = t || e,
      {
        params: o = {},
        sucCB: n,
        watchCB: h,
        type: s = "init",
        customVideoMap: u = null,
        useClientUrl: c,
        serverUrl: f = "",
        getServerCB: _,
        reportCB: S,
      } = r;
    if (
      ((gParams = ie(ie({}, gParams), o)),
      log("_getVideoObj 开始", s, gParams),
      resetVideoNum >= 2 && isMasexSite())
    ) {
      log("_getVideoObj 结束", "Masex：重置视频超过 2 次，不再做替换");
      return;
    }
    if (s === "remove") {
      resetData();
      return;
    }
    let v = !1;
    if (
      (s.includes("attr_src") &&
        t.length === 1 &&
        (s === "attr_src" &&
          (A = (y = t[0]) == null ? void 0 : y.dataset) != null &&
          A.markClass &&
          (resetVideoNum++, h("resetVideo", t)),
        (v = !0)),
      (s === "init" || v) && resetData(),
      s === "init" &&
        ((gElementObserver = null),
        (gSizeObserver = null),
        (gVisibleObserver = null),
        (gAutoTimer = null),
        (gAutoNum = 0),
        (resetVideoNum = 0)),
      u && (gCustomVideoMap = u),
      !u &&
        !s.includes("attr") &&
        i.every((D) => {
          var V;
          return (
            gCustomVideoMap.has(
              (V = D == null ? void 0 : D.dataset) == null
                ? void 0
                : V.markNode,
            ) || /display:\s*none/.test(D.getAttribute("style"))
          );
        }))
    ) {
      log("_getVideoObj 结束", "元素已拿到了视频链接，不再重复获取");
      return;
    }
    ((gPageHref = getPageHref()),
      (gDocTitle = document.title),
      (gServerUrl = f || ""),
      (gGetVideoSucCB = n || null),
      h && startDynamicObserver(h, e),
      (gAllScriptText = getScriptText(selectorAll("script:not(:empty)"))));
    const I = [],
      E = [],
      p = [],
      P = [],
      { width: U, height: F } = getPageStaticRect();
    e.forEach((l) => {
      var D, V;
      isValidEl(l, getCptStyle(l), U / 2) &&
        (isVideoElement(l) &&
          (getElSrc(l) ||
            ((V = (D = selectorOne("source", l)) == null ? void 0 : D.src) !=
              null &&
              V.trim())) &&
          p.push(l),
        isIframeElement(l) && getElSrc(l) && P.push(l));
    });
    const b = p.length + P.length;
    (log("_getVideoObj validIframe validVideo", P, p), _ && b === 1 && _());
    const T = isXHubSite(),
      C = is7cSite(),
      M = is18mhSite(),
      x = isMiaoMiSite(),
      a =
        isMankoSite() ||
        isAcfunSite1(gDocTitle) ||
        isGCQSite() ||
        isPornCideSite() ||
        T;
    if (
      (i.forEach((l) => {
        var O, re, Y, w, H, J;
        const { opacity: D, display: V, visibility: z } = getCptStyle(l),
          j = l.getBoundingClientRect(),
          { width: k, height: X } = j;
        let R = !1;
        if (
          (u
            ? (R = !!(
                (O = l.dataset) != null &&
                O.markClass &&
                gCustomVideoMap.has(
                  (re = l.dataset) == null ? void 0 : re.markClass,
                )
              ))
            : (R = !!(
                (Y = l.dataset) != null &&
                Y.markNode &&
                gCustomVideoMap.has(
                  (w = l.dataset) == null ? void 0 : w.markNode,
                )
              )),
          !R && !a)
        ) {
          if (
            isIframeElement(l) &&
            !getElSrc(l) &&
            !((H = l.getAttribute("srcdoc")) != null && H.trim())
          ) {
            E.push({
              el: l,
              replaceable: !1,
              reason: "iframe 元素无 src 值",
            });
            return;
          }
          if (
            !gParams.supportHiddenElement &&
            (+D <= 0.1 ||
              V === "none" ||
              z === "hidden" ||
              isElementFullyOutsideViewport(l, j))
          )
            if (isA123TVSite() || x) log("元素不可见，跳过这条规则", +D, V, z);
            else {
              (gHiddenElementMap.has(l) ||
                gHiddenElementMap.set(l, {
                  opacity: D,
                  display: V,
                  visibility: z,
                }),
                E.push({
                  el: l,
                  replaceable: !1,
                  reason: "元素不可见",
                }));
              return;
            }
          if (
            (gHiddenElementMap.has(l) && gHiddenElementMap.delete(l),
            isLimit(k, X, U))
          ) {
            (gSmallSizeElementMap.has(l) ||
              (gSizeObserver && gSizeObserver.observe(l),
              gSmallSizeElementMap.set(l, {
                width: k,
                height: X,
              })),
              E.push({
                el: l,
                replaceable: !1,
                reason: "元素宽高不符合要求",
              }));
            return;
          }
          gSmallSizeElementMap.has(l) && gSmallSizeElementMap.delete(l);
          const ee = k >= U - 10 && X / F >= 0.8;
          if (!gParams.supportFullScreen && ee)
            if (isYues99Site() || isKFTVSite())
              log("满屏视频不替换，跳过这条规则", k, X);
            else {
              if (X >= F - 10) {
                (E.push({
                  el: l,
                  replaceable: !1,
                  reason: "满屏视频不替换",
                }),
                  log("满屏视频不替换", X, F));
                return;
              }
              const G = getParentEl(l);
              if (
                G &&
                G.className.includes("video_player") &&
                selectorAll(".video_player").length > 2
              ) {
                E.push({
                  el: l,
                  replaceable: !1,
                  reason: "多个满屏视频不替换",
                });
                return;
              }
            }
        }
        const g = isIframeElement(l);
        (S && S(g), (scriptVideoMatchUrl = ""));
        const {
          nodeUrl: N,
          videoUrl: d,
          videoFrom: L,
        } = getVideoSrc(l, p.length, P.length, s);
        let B = !1;
        if (
          (isVideo(d) ||
            (scriptVideoMatchUrl && scriptVideoMatchUrl === d && (B = !0),
            !B && gFetchUrlSite && gFetchUrlSite === d && (B = !0),
            !B &&
              getVideoStrCount(d) &&
              !isBlob(d) &&
              isAcfunSite2(gDocTitle) &&
              (B = !0),
            !B && (T || C || M) && (B = !0)),
          isVideo(d) || B)
        ) {
          let Z = d;
          if (isVideoElement(l)) {
            const ee =
              (J = l == null ? void 0 : l.getAttribute("src")) == null
                ? void 0
                : J.trim();
            isEndWithVideoOne(ee) &&
              !isBlob(ee) &&
              (Z = getFullUrl(ee, gPageHref));
          }
          (I.push({
            width: k,
            height: X,
            videoFrom: L,
            src: Z,
            nodeSrc: N || Z,
            tagNode: l,
          }),
            E.push({
              el: l,
              replaceable: !0,
            }));
        } else
          E.push({
            el: l,
            replaceable: !1,
            reason: "链接不符合要求",
          });
      }),
      I.length === 0 && c && typeof c == "function")
    ) {
      let l = null,
        D = "";
      if (
        (b === 1
          ? ((l = p[0] || P[0]),
            E.some((V) => V.el === l && !V.replaceable) && (l = null),
            (D = c(l == null ? void 0 : l.src)))
          : b === 0 &&
            i.length === 1 &&
            ((D = c(($ = i[0]) == null ? void 0 : $.src)),
            useClientUrlBySpecsSiteSelector(D, i[0]) && (l = i[0])),
        l &&
          !(
            (W = l.dataset) != null &&
            W.markClass &&
            gCustomVideoMap.has((q = l.dataset) == null ? void 0 : q.markClass)
          ))
      ) {
        const V = getDataFromClientOrServer(D, l);
        V && I.push(V);
      }
    }
    return (
      I.length === 0 &&
        i.forEach((l) => {
          I.push({
            width: 0,
            height: 0,
            src: "",
            nodeSrc: getElSrc(l),
            videoFrom: "",
            tagNode: l,
          });
        }),
      log("_getVideoObj 元素过滤情况:", ...E),
      u ||
        I.forEach((l, D) => {
          if (l.src) {
            const V = `mk_src_${D}_${Date.now()}`;
            (gCustomVideoMap.set(V, l.tagNode),
              (l.tagNode.dataset.markNode = V));
          }
        }),
      log("_getVideoObj 结束", "链接抓取结果:", ...I),
      {
        result: I,
        onlyVideo: gOnlyVideo,
      }
    );
  }
  function resetData() {
    ((gHiddenElementMap = new WeakMap()),
      (gSmallSizeElementMap = new WeakMap()),
      (gCustomVideoMap = new Map()),
      (gIframeWS = new WeakSet()),
      (gOnlyVideo = null),
      (gFetchIng = !1),
      (gFetchInnerIng = !1),
      (gGetMove = !1),
      (gFetchUrlSite = ""),
      (gAjaxVideoUrl = ""),
      (scriptVideoMatchUrl = ""));
  }
  function getDataFromClientOrServer(t, r) {
    const e = filterClientUrlBySiteSelector(t, r),
      i = gServerUrl || e;
    if (i) {
      const { width: o, height: n } = getVideoRealSize(r),
        h = {
          width: o,
          height: n,
          src: i,
          nodeSrc: getElSrc(r),
          tagNode: r,
        };
      return (
        gServerUrl
          ? ((h.isServerUrl = !0),
            (h.videoFrom = gVideoFrom.server),
            (gServerUrl = ""),
            log("服务端链接被使用", gServerUrl))
          : e &&
            ((h.isClientUrl = !0),
            (h.videoFrom = gVideoFrom.client),
            log("客户端链接被使用", e)),
        h
      );
    }
  }
  function getVideoSrc(t, r, e, i) {
    let o = {
      nodeUrl: "",
      videoUrl: "",
      videoFrom: "",
    };
    if (
      (log("_getVideoSrc 开始", nodeHtmlWithoutPoster(t)),
      isVideoElement(t) && (o = getUrlFromVideo(t, r, gAllScriptText)),
      isIframeElement(t) && (o = getUrlFromIframe(t, e)),
      gParams.supportWindow && !o.videoUrl && !gAjaxVideoUrl)
    ) {
      const n = getUrlFromStore(r + e);
      n && ((o.videoUrl = n), (o.videoFrom = gVideoFrom.window));
    }
    if (!isVideo(o.videoUrl) && !gAjaxVideoUrl) {
      const n = getUrlFromHtml(t, o.nodeUrl, r + e);
      n
        ? ((o.videoUrl = n), (o.videoFrom = gVideoFrom.custom))
        : scriptVideoMatchUrl &&
          ((o.videoUrl = scriptVideoMatchUrl),
          (o.videoFrom = gVideoFrom.script));
    }
    if (
      (!o.videoUrl && !gAjaxVideoUrl && getUrlFromFetch(t),
      !o.videoUrl && !gAjaxVideoUrl)
    ) {
      const n = getUrlFromOther(t, gAllScriptText);
      n && ((o.videoUrl = n), (o.videoFrom = gVideoFrom.other));
    }
    return (
      gAjaxVideoUrl &&
        (i === "ajax" || isMangoSite()) &&
        ((o.videoUrl = gAjaxVideoUrl),
        (o.videoFrom = gVideoFrom.ajax),
        (gAjaxVideoUrl = ""),
        isAGESite(gDocTitle) && (gFetchIng = !1)),
      o.videoUrl && (o.videoUrl = getFullUrl(o.videoUrl, gPageHref)),
      log(
        "_getVideoSrc 结果",
        `提取到的 src：${o.videoUrl}`,
        `初始 src：${o.nodeUrl}`,
        nodeHtmlWithoutPoster(t),
      ),
      o
    );
  }
  function getUrlFromAttr(t) {
    var o, n, h;
    const r = {
      nodeUrl: "",
      videoUrl: "",
      videoFrom: "",
    };
    if (!t) return r;
    const e = getElSrc(t, "all");
    let i = t.getAttribute("x_video_iframe_video_url");
    if (
      (i && (r.videoFrom = gVideoFrom.iframe),
      i ||
        ((i = getVideoSrcFromUrl(e)),
        getVideoStrCount(e) && !isBlob(e) && isAcfunSite2(gDocTitle) && (i = e),
        i && (r.videoFrom = gVideoFrom.src)),
      gParams.supportParent && !i)
    ) {
      let s = function (S) {
        var v, I, E, p, P, U;
        try {
          if (!S) return null;
          if (S.getAttribute("data-video_id") || S.getAttribute("data-video")) {
            let T =
              ((v = S.getAttribute("data-url")) == null ? void 0 : v.trim()) ||
              ((I = S.getAttribute("data-src")) == null ? void 0 : I.trim());
            if (isVideo(T))
              return {
                pVideoUrl: T,
                videoParent: S,
              };
            if (u && getVideoStrCount(T))
              return {
                pVideoUrl: T,
                videoParent: S,
              };
            T = "";
            let C = S.getAttribute("config") || S.getAttribute("data-config");
            if (C) {
              try {
                C = JSON.parse(C);
              } catch (M) {}
              C && typeof C == "object"
                ? (T =
                    (E = C == null ? void 0 : C.video) == null ? void 0 : E.url)
                : typeof C == "string" && (T = C);
            }
            if (isVideo(T))
              return {
                pVideoUrl: T,
                videoParent: S,
                dataConfig: C,
              };
          }
          if (S.getAttribute("data-poster") && S.getAttribute("data-title")) {
            let T =
              ((p = S.getAttribute("data-src")) == null ? void 0 : p.trim()) ||
              ((P = S.getAttribute("data-url")) == null ? void 0 : P.trim());
            if (isVideo(T))
              return {
                pVideoUrl: T,
                videoParent: S,
              };
          }
          const F = S.getAttribute("data-serialized-props");
          if (F) {
            const T = JSON.parse(F);
            if (isVideo(T == null ? void 0 : T.url))
              return {
                pVideoUrl: T.url,
                videoParent: S,
              };
          }
          const b = S.getAttribute("data-config");
          if (b) {
            const T = JSON.parse(atob(b)),
              C = (U = T == null ? void 0 : T.video) == null ? void 0 : U.url;
            if (isVideo(C))
              return {
                pVideoUrl: C,
                videoParent: S,
              };
          }
        } catch (F) {
          log("_getSrcFromParent error：", F == null ? void 0 : F.message);
        }
        return null;
      };
      const u = is18mhSite(),
        {
          pVideoUrl: c,
          videoParent: f,
          dataConfig: _,
        } = s(t.parentElement) ||
          s((o = t.parentElement) == null ? void 0 : o.parentElement) ||
          s(
            (h = (n = t.parentElement) == null ? void 0 : n.parentElement) ==
              null
              ? void 0
              : h.parentElement,
          ) || {
            pVideoUrl: "",
            videoParent: null,
            dataConfig: null,
          };
      if (c) {
        log("_getSrcFromParent suc", c);
        const S = evalJs(["CryptoJS"])[0],
          v = f.getAttribute("data-api");
        if (gParams.supportAjax && !gFetchInnerIng && v && S) {
          const I = v,
            E = f.getAttribute("data-key"),
            p = f.getAttribute("data-iv");
          I &&
            E &&
            p &&
            fetchUrl({
              dataApi: I,
              dataKey: E,
              dataIv: p,
              theCryptoJS: S,
              resType: "json",
              cb: (P) => {
                isVideo(P) &&
                  ((gAjaxVideoUrl = P),
                  gGetVideoSucCB &&
                    gGetVideoSucCB("ajax", Array.from([t]), gOnlyVideo));
              },
            });
        }
        if (gParams.supportAjax && !gFetchInnerIng && _ && S) {
          const I = _["data-api"],
            E = _["data-key"],
            p = _["data-iv"];
          I &&
            E &&
            p &&
            fetchUrl({
              dataApi: I,
              dataKey: E,
              dataIv: p,
              theCryptoJS: S,
              resType: "text",
              cb: (P) => {
                (/\.m3u8\.v1\.m3u8/.test(P) && is91Site()) ||
                  (isVideo(P) &&
                    ((gAjaxVideoUrl = P),
                    gGetVideoSucCB &&
                      gGetVideoSucCB("ajax", Array.from([t]), gOnlyVideo)));
              },
            });
        }
        gFetchInnerIng || ((i = c), (r.videoFrom = gVideoFrom.parent));
      }
    }
    return ((r.nodeUrl = e), (r.videoUrl = i), r);
  }
  function getUrlFromVideo(t, r, e) {
    var h, s, u, c, f, _;
    const i = getUrlFromAttr(t);
    if (i.videoUrl) return i;
    let o = "";
    const n = selectorOne("source", t);
    if (
      ((o =
        ((h = n == null ? void 0 : n.src) == null ? void 0 : h.trim()) ||
        ((s = n == null ? void 0 : n.getAttribute("data-src")) == null
          ? void 0
          : s.trim())),
      isVideo(o) || (o = ""),
      is9UUSite() &&
        /\.com\/[_\-a-z0-9]+\.mp4\/[_\-a-z0-9]+\.m3u8$/i.test(o) &&
        (o = ""),
      isHanime1Site(gDocTitle) && /\/jmpres\//i.test(o) && (o = ""),
      o && (i.videoFrom = gVideoFrom.source),
      gParams.supportScript && !o)
    ) {
      const S = isGCQSite();
      if (r === 1 || S) {
        const v = t.parentElement,
          I = v == null ? void 0 : v.parentElement,
          E = I == null ? void 0 : I.parentElement;
        let P = [
          (u = t.id) == null ? void 0 : u.trim(),
          (c = v == null ? void 0 : v.id) == null ? void 0 : c.trim(),
          (f = I == null ? void 0 : I.id) == null ? void 0 : f.trim(),
        ]
          .filter(Boolean)
          .join("|");
        (P ||
          (P =
            ((_ = E == null ? void 0 : E.id) == null ? void 0 : _.trim()) ||
            ""),
          P &&
            ((o = getUrlFromScript(P, e)),
            o && (i.videoFrom = gVideoFrom.script)));
      }
    }
    return (
      gParams.supportWindow &&
        !o &&
        r === 1 &&
        t.tagName === "VIDEO" &&
        ((o = getUrlFromWindow(t)), o && (i.videoFrom = gVideoFrom.window)),
      o && (i.videoUrl = o),
      i
    );
  }
  function getUrlFromIframe(t, r) {
    var o;
    const e = getUrlFromAttr(t);
    if (e.videoUrl) return e;
    let i = "";
    if (!i && !gIframeWS.has(t) && ((r === 1 && e.nodeUrl) || t.srcdoc)) {
      if (gParams.supportIframe) {
        let n = function (u, c) {
            if (u) {
              let f = "";
              if (
                ((f = getIframeChildUrl(u, "video")),
                f || (f = getIframeChildUrl(u, "iframe")),
                log("_getUrlFromIframe iframe onload 里面的 videoUrl", f),
                f)
              )
                return (
                  c.setAttribute("x_video_iframe_video_url", f),
                  gGetVideoSucCB &&
                    gGetVideoSucCB("onload", Array.from([c]), gOnlyVideo),
                  f
                );
            }
          },
          h = function (u, c) {
            var S, v;
            if (u) return;
            const f = Array.from(selectorAll("iframe", c)).filter(
              (I) => !/(loading)\.html/.test(I.getAttribute("src")),
            );
            if (f.length !== 1 || selectorAll("video", c).length) return;
            let _ = getIframeDoc(f[0]);
            _ && (S = _.body) != null && S.innerHTML
              ? n(_, t)
              : isSameOrigin(
                  gPageHref,
                  (v = f[0]) == null ? void 0 : v.getAttribute("src"),
                  gPageHref,
                ) &&
                (log("_getUrlFromIframe 监听 iframe2 onload"),
                f[0].addEventListener("load", () => {
                  ((_ = getIframeDoc(f[0])), n(_, t));
                }));
          },
          s = getIframeDoc(t);
        s && (o = s.body) != null && o.innerText
          ? h(n(s, t), s)
          : (isSameOrigin(gPageHref, t.getAttribute("src"), gPageHref) ||
              t.srcdoc) &&
            (log("_getUrlFromIframe 监听 iframe1 onload"),
            t.addEventListener("load", () => {
              ((s = getIframeDoc(t)), h(n(s, t), s));
            }));
      }
      ((i = getUrlFromWindow(t)), gIframeWS.add(t));
    }
    if (!i) {
      const n = t.getAttribute("src");
      if (
        gParams.supportAjax &&
        n &&
        n.includes(".php") &&
        t === selectorOne(".MacPlayer > table td#playleft > iframe")
      ) {
        const h = getURL(n, gPageHref),
          s = h.searchParams.get("vid"),
          u = h.pathname.split("/");
        s &&
          u[1] &&
          getUrlFromFetchElementSrc(t, s, `${h.origin}/${u[1]}/api.php`);
      }
    }
    return (i && ((e.videoUrl = i), (e.videoFrom = gVideoFrom.window)), e);
  }
  function getIframeChildUrl(t, r) {
    var i;
    const e = Array.from(selectorAll(r, t)).filter((o) => {
      var h;
      let n = "";
      if (r.includes("video")) {
        const s = getScriptText(selectorAll("script:not(:empty)", t));
        ((n = (h = getUrlFromVideo(o, 1, s)) == null ? void 0 : h.videoUrl),
          o.setAttribute("x_video_iframe_video_url", n));
      }
      if (
        (r.includes("iframe") && (n = getElSrc(o, "all")),
        n && getVideoStrCount(n))
      ) {
        const s = t.defaultView.getComputedStyle(o, null),
          u = t.defaultView.getComputedStyle(o.parentElement, null);
        if (isValidEl(o, s) && isValidEl(o, u)) return !0;
      }
    });
    if (e.length === 1) {
      const o = (i = getUrlFromAttr(e[0])) == null ? void 0 : i.videoUrl;
      return (o && isVideoElement(e[0]) && (gOnlyVideo = e[0]), o);
    }
    return "";
  }
  function getUrlFromScript(t, r) {
    var S, v, I, E, p, P, U;
    if (!gParams.supportScript || !r.length) return "";
    const e =
        /(new\s[a-zA-Z]{0,4}(window\.)?(player|plyr|hls))|(video\.src\s*=)/i,
      i = new RegExp(`['"]#?(${t})['"]`, "i"),
      o = /(\$|querySelector|getElementById)\(["']video["']\)/i,
      n = /['"]([-_/a-zA-Z0-9.,:\\]+\.(mp4|m3u8)[^;'"]*)['"]/gi,
      h =
        /(?:[{,]\s*["']?(?:url|source)["']?:\s*)([_.a-zA-Z0-9]+|atob\([-_/.="'a-zA-Z0-9]+\)|[_.a-zA-Z0-9]+\s*\+\s*atob\([-_/.="'a-zA-Z0-9]+\))[,}]/i,
      s =
        /(?:=\s*)([-_\.a-zA-Z0-9]+)(?:\s*\+\s*)(['"][-_/.:a-zA-Z0-9]+\.(mp4|m3u8)[^;'"]*['"])/i,
      u = /\.(src\s*=\s*|loadSource\()['"](https?:\/\/[^;'"]+)['"]/i;
    log("_getUrlFromScript", 1, t);
    let c = [];
    for (let F of r) {
      const b = getSpecialSiteScriptVideoUrl(F);
      if (b) return b;
      if (e.test(F) && (log("_getUrlFromScript", 2), i.test(F) || o.test(F))) {
        log("_getUrlFromScript", 3);
        const T = F.match(s);
        if (T && T.length >= 3) {
          const M = T[1],
            x = (S = T[2]) == null ? void 0 : S.replace(/^['"]+|['"]+$/g, ""),
            a = evalJs([M])[0];
          typeof a == "string" &&
            /^http/i.test(a) &&
            getVideoStrCount(x) &&
            (c.push(a + x), log("_getUrlFromScript", 31, a + x));
        }
        let C = F.match(n);
        if (C && C.length) {
          if (
            (/videoUrl\s*=\s*container\.dataset\.url/.test(F) &&
              /videoUrl,\s*container\)/.test(F) &&
              (C.length = 0),
            /['"]\s*\+\s*vid\.dataset\.id\s*\+\s*['"]/i.test(F))
          ) {
            const x = F.match(
              /=\s*['"]([^'"]+)['"]\s*\+\s*([^+]+)\s*\+\s*['"]([^'"]*\.(?:mp4|m3u8)[^'"]*)['"]/i,
            );
            if (
              x &&
              ((v = x[2]) == null ? void 0 : v.trim()) === "vid.dataset.id"
            ) {
              const a =
                (I = selectorOne("#vid")) == null ? void 0 : I.dataset.id;
              a && (c.push(`${x[1]}${a}${x[3]}`), (C.length = 0));
            }
          }
          const M = F.match(/(size:\s*\d{3,})/gi);
          (M && M.length === C.length ? c.push(C[0]) : c.push(...C),
            log("_getUrlFromScript", 32, C));
        }
        if (!C) {
          const M = (E = F.match(h)) == null ? void 0 : E[1];
          if (M) {
            log("_getUrlFromScript", 33, M);
            let x = "";
            getVideoStrCount(M) && (x = M);
            const a = evalJs([M]),
              y = a[0];
            if (
              (log("_getUrlFromScript", 34, y), !a.length && /atob\(/.test(F))
            ) {
              const A =
                (p = F.match(
                  new RegExp(`${M}\\s*=\\s*atob\\(([_a-zA-Z0-9]+)\\);`, "i"),
                )) == null
                  ? void 0
                  : p[1];
              let $ = "",
                W = "";
              (A &&
                ($ =
                  (P = F.match(
                    new RegExp(`${A}\\s*=\\s*['"]([-_a-zA-Z0-9=]+)['"]`, "i"),
                  )) == null
                    ? void 0
                    : P[1]),
                $ && (W = atob($)),
                log("_getUrlFromScript", 35, A, $, W),
                getVideoStrCount(W) && (x = W));
            }
            if (
              gParams.supportAjax &&
              !a.length &&
              !gGetMove &&
              M === "m3u8" &&
              /\/api\/getmovie\?type=/.test(F) &&
              /\$\.ajax/.test(F) &&
              /data\.m3u8/.test(F)
            ) {
              gGetMove = !0;
              const A = getURL(gPageHref).pathname;
              let $ = "";
              (A && ($ = A.split("/").filter(Boolean).pop()),
                log("_id:", $),
                $ &&
                  fetch(`/api/getmovie?type=1280&id=${$}`)
                    .then((q) => {
                      if (!q.ok)
                        throw new Error(`HTTP error! status: ${q.status}`);
                      return q.json();
                    })
                    .then((q) => {
                      const l = q == null ? void 0 : q.m3u8;
                      if (l && getVideoStrCount(l)) {
                        log("_getUrlFromScript", 36, l);
                        const D = selectorAll(`#${t} video`);
                        D.length === 1 &&
                          ((gAjaxVideoUrl = l),
                          gGetVideoSucCB &&
                            gGetVideoSucCB("ajax", Array.from(D), gOnlyVideo));
                      }
                    })
                    .catch((q) => {
                      log("getmovie Fetch error:", q);
                    }));
            }
            (!x && typeof y == "string" && getVideoStrCount(y) && (x = y),
              x && (c.push(x), log("_getUrlFromScript", 37, x)));
          }
        }
        if (!c.length) {
          const M = (U = F.match(u)) == null ? void 0 : U[2];
          M &&
            ((scriptVideoMatchUrl = M),
            c.push(M),
            log("_getUrlFromScript", 34, M));
        }
      }
    }
    log("_getUrlFromScript", 4, c);
    const f = [],
      _ = [];
    if (
      (c.forEach((F) => {
        const b = F.replace(/^['"]+|['"]+$/g, "");
        /^http/i.test(b)
          ? f.includes(b) || f.push(b)
          : _.includes(b) || _.push(b);
      }),
      log("_getUrlFromScript", 5, f, "result2", _),
      f.length + _.length === 1)
    )
      return f[0] || _[0];
    if (f.length === 1 && _.length === 1) {
      const { pathname: F, search: b, hash: T } = getURL(f[0], gPageHref),
        { pathname: C, search: M, hash: x } = getURL(_[0], gPageHref);
      if (F === C && b === M && T === x) {
        if (isVideo(f[0])) return f[0];
        if (isVideo(_[0])) return _[0];
      }
    }
    return "";
  }
  const WINDOW_PLAYER_GLOBAL_KEYS = [
    "zanpiancms_player",
    "$avdt",
    "__ARCHIVE_PLAYER__",
    "feizhu",
    "lele",
    "awpIns",
    "MIZHI",
    "APP_DATA",
    "playinfo",
    "mainPlayer",
    "myvideo",
    "VideoApp()",
    "videoConfig",
    "parent.videoConfig",
    "videojs.players",
    "xplayer.core",
    "Artplayer.instances",
    "dp",
    "dplayer",
    "player",
    "player_aaaa",
    "player_data",
    "MacPlayer",
    "parent.MacPlayer",
    "hls",
    "__NUXT__.data",
  ];
  function getUrlFromWindow(t) {
    var r, e, i, o, n, h, s, u, c, f, _, S, v, I, E, p, P, U, F, b, T;
    if (!gParams.supportWindow) return "";
    try {
      let C = evalJs(WINDOW_PLAYER_GLOBAL_KEYS);
      log("_getUrlFromWindow dplayerRes", C);
      let M = 1;
      if (!C.length && window.dPlayers) {
        const a = evalJs(["dPlayers"]);
        a &&
          ((C = a),
          Array.isArray(a[0]) &&
            a.length === 1 &&
            ((C = [...a[0]]), (M = C.length)));
      }
      for (const a of C)
        if ((log("_getUrlFromWindow dplayer", a), a)) {
          if (a._media && a.url) {
            const y = getIdClassSelector(a._media);
            if (y && selectorAll(y).length === 1) {
              const A = a.url;
              if (isVideo(A))
                return (log("_getUrlFromWindow from hls", A, y), A);
            }
          }
          if (a.Path && a.PlayUrl) {
            let y = selectorAll(`iframe[src*="${a.Path}"]`);
            if (
              (y.length || (y = selectorAll(`script[src*="${a.Path}"]`)),
              y && y.length === 1)
            ) {
              const A = a.PlayUrl;
              if (isVideo(A))
                return (log("_getUrlFromWindow from MacPlayer", A, y), A);
            }
          }
          if (a.container && a.video && a.options) {
            const y = getIdClassSelector(a.container),
              A = getIdClassSelector(a.video);
            if (
              y &&
              A &&
              selectorAll(`${t.tagName.toLowerCase()}${A}`).length === M &&
              a.video === t
            ) {
              const W = (r = a.options.video) == null ? void 0 : r.url,
                q =
                  a.options["data-api"] &&
                  a.options["data-iv"] &&
                  a.options["data-key"];
              if (isVideo(W) && !q)
                return (log("_getUrlFromWindow from DPlayer", M, W, y, A), W);
            }
          }
          if (a.el_ && a.options_) {
            const y = getIdClassSelector(a.el_);
            if (y && selectorAll(y).length === 1) {
              const A =
                ((i = (e = a.options_.sources) == null ? void 0 : e[0]) == null
                  ? void 0
                  : i.src) ||
                a.options_.source ||
                ((o = a.lastSource_) == null ? void 0 : o.player);
              if (isVideo(A))
                return (log("_getUrlFromWindow from videojs", A, y), A);
            }
          }
          if (a.config) {
            const y =
              getIdClassSelector(a.config.el) ||
              `${a.config.id ? "#" + a.config.id : ""}`;
            if (y && selectorAll(y).length === 1) {
              const A = a.config.url;
              if (isVideo(A))
                return (
                  log("_getUrlFromWindow from player.config.url", A, y),
                  A
                );
            }
          }
          if (a._options && a._options.id && a.tag === t) {
            const y = a._options.source;
            if (isVideo(y) && selectorOne(`#${a._options.id} > video`) === t)
              return (
                log("_getUrlFromWindow from player._options.source", y),
                y
              );
          }
          if (a.dp && a.dp.options && a.dp.video) {
            const y = getIdClassSelector(a.dp.video);
            if (y && selectorAll(y).length === 1) {
              const A =
                (h = (n = a.dp.options) == null ? void 0 : n.video) == null
                  ? void 0
                  : h.url;
              if (isVideo(A))
                return (log("_getUrlFromWindow from lele", A, y), A);
            }
          }
          if (a.art && a.art.options) {
            const y = `${a.art.option.container} video`;
            if (selectorAll(y).length === 1) {
              const A = (s = a.art.options) == null ? void 0 : s.url;
              if (isVideo(A))
                return (log("_getUrlFromWindow from MIZHI", A, y), A);
            }
          }
          if (a.content) {
            const y = evalJs(["CryptoJS"])[0];
            if (!y) return;
            const A = (W) => {
                const q = W.length;
                let l, D;
                q < 16
                  ? ((l = W.substring(0, q - 32)), (D = W.substring(q - 32)))
                  : ((l = W.substring(0, 16) + W.substring(48)),
                    (D = W.substring(16, 48)));
                const V = y.enc.Hex.parse(l),
                  z = y.enc.Base64.stringify(V),
                  j = y.enc.Hex.parse(D),
                  k = y.enc.Utf8.parse("WB0nMZHXlxNndORe"),
                  X = y.AES.decrypt(z, k, {
                    iv: j,
                    mode: y.mode.CFB,
                    padding: y.pad.NoPadding,
                  });
                return JSON.parse(X.toString(y.enc.Utf8));
              },
              $ = (W) => {
                try {
                  const q = new URL(W),
                    l = Math.floor(Date.now() / 1e3),
                    V = "psIBMQo9fjm2xlL6Vpr3IsQ8dWHS46" + q.pathname + l,
                    z = y.MD5(V).toString(),
                    j = new URLSearchParams(q.search);
                  return (
                    j.set("t", String(l)),
                    j.set("sign", z),
                    `${q.origin}${q.pathname}?${j}`
                  );
                } catch (q) {
                  return (log("鉴权失败:", q), W);
                }
              };
            try {
              const W = A(a.content),
                q = $(W[0].vod_play_url[0].list[0].h264);
              if (isVideo(q))
                return (log("_getUrlFromWindow from playinfo", q), q);
            } catch (W) {}
          }
          if (a.url && a.link && a.id && a.flag === "play") {
            let y = function (W) {
              var q, l, D, V, z, j, k;
              for (j = W.length, z = 0, k = ""; z < j;) {
                do q = A[W.charCodeAt(z++) & 255];
                while (z < j && q == -1);
                if (q == -1) break;
                do l = A[W.charCodeAt(z++) & 255];
                while (z < j && l == -1);
                if (l == -1) break;
                k += String.fromCharCode((q << 2) | ((l & 48) >> 4));
                do {
                  if (((D = W.charCodeAt(z++) & 255), D == 61)) return k;
                  D = A[D];
                } while (z < j && D == -1);
                if (D == -1) break;
                k += String.fromCharCode(((l & 15) << 4) | ((D & 60) >> 2));
                do {
                  if (((V = W.charCodeAt(z++) & 255), V == 61)) return k;
                  V = A[V];
                } while (z < j && V == -1);
                if (V == -1) break;
                k += String.fromCharCode(((D & 3) << 6) | V);
              }
              return k;
            };
            const A = new Array(
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              62,
              -1,
              -1,
              -1,
              63,
              52,
              53,
              54,
              55,
              56,
              57,
              58,
              59,
              60,
              61,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              0,
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9,
              10,
              11,
              12,
              13,
              14,
              15,
              16,
              17,
              18,
              19,
              20,
              21,
              22,
              23,
              24,
              25,
              -1,
              -1,
              -1,
              -1,
              -1,
              -1,
              26,
              27,
              28,
              29,
              30,
              31,
              32,
              33,
              34,
              35,
              36,
              37,
              38,
              39,
              40,
              41,
              42,
              43,
              44,
              45,
              46,
              47,
              48,
              49,
              50,
              51,
              -1,
              -1,
              -1,
              -1,
              -1,
            );
            let $ = a.url;
            if (
              (isVideo($) || ($ = unescape(a.url)),
              isVideo($) || ($ = unescape(y(a.url))),
              isVideo($))
            )
              return (log("_getUrlFromWindow from player_aaaa", $), $);
          }
          if ((u = a.player) != null && u.html) {
            const y = selectorAll(".video-iframe"),
              A = a.player.html.toString();
            if (
              y.length === 1 &&
              /video-iframe/gi.test(A) &&
              /new Artplayer/gi.test(A)
            ) {
              const $ = y[0].getAttribute("data-url");
              if (isVideo($))
                return (log("_getUrlFromWindow from feizhu.player.html", $), $);
            }
          }
          if (a.details && a.details.vod_data_tmp) {
            const y = evalJs(["CryptoJS"])[0];
            if (!y || a.details.vod_data_tmp[1] || !selectorOne("#player0"))
              return;
            const A = (q, l = "psIBMQo9fjm2xlL6Vpr3IsQ8dWHS46") => {
                const D = new URL(q),
                  V = Math.floor(Date.now() / 1e3),
                  z = !1,
                  j = l + D.pathname + V,
                  k = y.MD5(j).toString(),
                  X = new URLSearchParams(D.search);
                return (
                  X.set("sign", k),
                  X.set("t", z ? V.toString(16) : V.toString()),
                  `${D.origin}${D.pathname}?${X}`
                );
              },
              $ =
                (v =
                  (S =
                    (_ =
                      (f =
                        (c = a.details.vod_data_tmp[0]) == null
                          ? void 0
                          : c.vod_play_url) == null
                        ? void 0
                        : f[0]) == null
                      ? void 0
                      : _.list) == null
                    ? void 0
                    : S[0]) == null
                  ? void 0
                  : v.h264,
              W = A($);
            if (isVideo(W))
              return (
                log("_getUrlFromWindow from APP_DATA.details.vod_data_tmp", W),
                W
              );
          }
          if (a.c === "video" && a.hls && (I = a.cdns) != null && I[0]) {
            const y = selectorAll("#video-play_html5_api"),
              A = `https://${(E = a.cdns) == null ? void 0 : E[0]}${a.hls}`;
            if (y.length === 1 && isVideo(A))
              return (log("_getUrlFromWindow from $avdt", A), A);
          }
          if (a.opts && a.root && a.playerState) {
            const y = a.opts.src;
            if (isVideo(y)) return (log("_getUrlFromWindow from awpIns", y), y);
          }
          if (a.url && gDocTitle && gDocTitle.includes(a.title)) {
            const y = a.url;
            if (selectorAll("iframe#v2-player").length === 1 && isVideo(y))
              return (log("_getUrlFromWindow from videoConfig", y), y);
          }
          if (a.videoData && a.videoData.video_url && a.videoData.id) {
            const y = a.videoData.video_url;
            if (selectorAll("iframe#v2-player").length === 1 && isVideo(y))
              return (log("_getUrlFromWindow from VideoApp()", y), y);
          }
          if (a.url && a.fanhao && a.title) {
            const A = (function ($, W, q) {
              return $.startsWith("http")
                ? $
                : "https://m2cdn.playergo.top/" +
                    encodeURIComponent($) +
                    "/playlist.m3u8?fanhao=" +
                    encodeURIComponent(W) +
                    "&t=" +
                    encodeURIComponent(q);
            })(a.url, a.fanhao, a.title);
            if (isVideo(A))
              return (log("_getUrlFromWindow from parent.videoConfig", A), A);
          }
          if (
            a.PlayUrl &&
            "PlayType" in a &&
            "PlayIsLive" in a &&
            "FullUrl" in a &&
            "JsonUrl" in a
          ) {
            const y = a.PlayUrl;
            if (isVideo(y))
              return (log("_getUrlFromWindow from parent.MacPlayer", y), y);
          }
          if (a.sourceController && a.element) {
            const y = a.sourceController.hlsSource;
            if (isVideo(y) && t.parentElement === a.element)
              return (
                log(
                  "_getUrlFromWindow from xplayer.core.sourceController.hlsSource",
                  y,
                ),
                y
              );
          }
          if (Array.isArray(a) && a.length === 1) {
            const y = (p = a[0]) == null ? void 0 : p.hls;
            if (y && y.url && y.config && y._media === t) {
              const $ = y.url;
              if (isVideo($))
                return (
                  log("_getUrlFromWindow from Artplayer.instances[0].hls", $),
                  $
                );
            }
            const A = (P = a[0]) == null ? void 0 : P.option;
            if (A && A.url && ((U = a[0]) == null ? void 0 : U.video) === t) {
              const $ = A.url;
              if (isVideo($))
                return (
                  log(
                    "_getUrlFromWindow from Artplayer.instances[0].option",
                    $,
                  ),
                  $
                );
            }
          }
          if (
            a["player-mg"] &&
            a["player-mg"].el_ &&
            (F = a["player-mg"].lastSource_) != null &&
            F.player
          ) {
            const y = a["player-mg"].lastSource_.player;
            if (isVideo(y) && t.parentElement === a["player-mg"].el_)
              return (
                log(
                  "_getUrlFromWindow from videojs.players['player-mg'].lastSource_.player",
                  y,
                ),
                y
              );
          }
          if (
            a.rawPath &&
            window.App &&
            typeof window.App.replaceCdn == "function"
          ) {
            const A = (function ($) {
              if (!$) return "";
              var W = window.App.replaceCdn($);
              return /^https?:\/\//i.test(W) ? W : String(W).replace(/^\//, "");
            })(a.rawPath);
            if (isVideo(A))
              return (log("_getUrlFromWindow from __ARCHIVE_PLAYER__", A), A);
          }
          if (location.pathname.includes("/movie/")) {
            const y = location.pathname.split("/");
            let A = "";
            y && y.length === 4 && (A = `movie-detail-${y[2]}-${y[3]}`);
            const $ = a[A];
            if ($ && $.play_links && $.play_links.length > 0) {
              let W = $.play_links[0].m3v_url;
              if (((W = /^\//.test(W) ? W : `/${W}`), isVideo(W)))
                return (log("_getUrlFromWindow from __NUXT__.data", W), W);
            }
          }
        }
      const x = evalJs(["vid", "vfrom", "vpart", "now", "next"]);
      if (x.length === 5) {
        const [a, y, A, $, W] = x;
        if (a && $ && W) {
          const q = $;
          if (
            isVideo(q) &&
            (T = (b = t.parentElement) == null ? void 0 : b.className) !=
              null &&
            T.includes("player")
          )
            return (log("_getUrlFromWindow from now", q), q);
        }
      }
      return "";
    } catch (C) {
      return (log("_getUrlFromWindow error", C), "");
    }
  }
  function getUrlFromStore(t) {
    var i, o, n, h, s, u, c, f;
    if (!gParams.supportWindow) return "";
    const r = getPageStore();
    if ((log("_getUrlFromStore pageStore", r), !r || !r.root)) return "";
    const e =
      (n =
        (o = (i = r.root) == null ? void 0 : i.state) == null
          ? void 0
          : o.value) == null
        ? void 0
        : n.Detail;
    if (e && t === 1) {
      const _ = e.detailModel,
        S = String(
          (_ == null ? void 0 : _.playUrl) ||
            (_ == null ? void 0 : _.downUrl) ||
            "",
        ).trim();
      if (
        isVideo(S) &&
        gDocTitle.includes(
          (h = _ == null ? void 0 : _.videoDetail) == null ? void 0 : h.title,
        )
      )
        return (log("_getUrlFromStore from detailModel", S), S);
    }
    if (isSouAVSite(gDocTitle)) {
      const _ =
        (u = (s = r.root._s) == null ? void 0 : s.get("Detail")) == null
          ? void 0
          : u.getPlayUrl();
      return isVideo(_) ? (log("_getUrlFromStore from getPlayUrl", _), _) : "";
    }
    if (isAiWeiNaiSite()) {
      const _ =
          (f = (c = r.data) == null ? void 0 : c.$children) == null
            ? void 0
            : f.find((v) => {
                var I, E;
                return (E =
                  (I = v == null ? void 0 : v.$vnode) == null
                    ? void 0
                    : I.tag) == null
                  ? void 0
                  : E.includes("VideoPlayer");
              }),
        S =
          (_ == null ? void 0 : _.video.sources[240]) ||
          (_ == null ? void 0 : _.video.sources[480]);
      return isVideo(S)
        ? (log("_getUrlFromStore from video.sources", S), S)
        : "";
    }
    return "";
  }
  function getPageStore() {
    var t, r, e, i, o, n, h, s;
    try {
      const u = (v) => {
          var p, P, U;
          if (!v) return null;
          const I =
            (P = (p = v.config) == null ? void 0 : p.globalProperties) == null
              ? void 0
              : P.$pinia;
          if (I) return I;
          const E = (U = v._context) == null ? void 0 : U.provides;
          if (!E) return null;
          if (E.pinia) return E.pinia;
          for (const F of [
            ...Object.keys(E),
            ...Object.getOwnPropertySymbols(E),
          ]) {
            const b = E[F];
            if ((b == null ? void 0 : b._s) instanceof Map) return b;
          }
          return null;
        },
        c =
          document.querySelector("#app") ||
          document.querySelector("#root") ||
          document.querySelector("#__nuxt") ||
          document.querySelector("#__next");
      if (!c) return null;
      const f = c.__vue_app__;
      if (f) {
        const v = u(f);
        if (v)
          return {
            kind: "pinia",
            from: "vue3.$pinia",
            root: v,
          };
        const I =
          (r = (t = f.config) == null ? void 0 : t.globalProperties) == null
            ? void 0
            : r.$store;
        if (I)
          return {
            kind: "vuex",
            from: "vue3.$store",
            root: I,
            data: f,
          };
      }
      const _ = c.__vue__;
      if (_) {
        const v = (_.$root || _).$store || _.$store;
        if (v)
          return {
            kind: "vuex",
            from: "vue2.$store",
            root: v,
            data: _,
          };
      }
      try {
        const v = Object.keys(c).find(
          (U) =>
            U.startsWith("__reactFiber$") ||
            U.startsWith("__reactContainer$") ||
            U.startsWith("__reactInternalInstance$"),
        );
        let I = v ? c[v] : null;
        (I != null && I.current && (I = I.current),
          I ||
            (I =
              (i =
                (e = c._reactRootContainer) == null
                  ? void 0
                  : e._internalRoot) == null
                ? void 0
                : i.current));
        const E = I ? [I] : [],
          p = new Set();
        let P = 0;
        for (; E.length && P++ < 60;) {
          const U = E.shift();
          if (!U || p.has(U)) continue;
          p.add(U);
          const F =
            (o = U.memoizedProps || U.pendingProps) == null ? void 0 : o.store;
          if (F && typeof F.getState == "function")
            return {
              kind: "redux",
              from: "react.Provider.store",
              root: F,
              data: I,
            };
          (U.child && E.push(U.child), U.sibling && E.push(U.sibling));
        }
      } catch (v) {}
      const S = window;
      if ((n = S.__PINIA__) != null && n._s)
        return {
          kind: "pinia",
          from: "window.__PINIA__",
          root: S.__PINIA__,
        };
      if ((h = S.$nuxt) != null && h.$store)
        return {
          kind: "vuex",
          from: "window.$nuxt.$store",
          root: S.$nuxt.$store,
        };
      if ((s = S.store) != null && s.getState)
        return {
          kind: "redux",
          from: "window.store",
          root: S.store,
        };
    } catch (u) {
      log("_getPageStore error", u);
    }
    return null;
  }
  function getUrlFromHtml(t, r, e) {
    var o, n, h, s, u, c, f, _, S;
    if (!gParams.supportCustom || e !== 1) return "";
    let i = "";
    if (!r) {
      const v = selectorAll("#hlsPlayer"),
        I = v[0];
      if ((v == null ? void 0 : v.length) === 1 && I.tagName === "HLS-PLAYER") {
        const E = I.shadowRoot.querySelectorAll("video"),
          p = I.getAttribute("src");
        (E == null ? void 0 : E.length) === 1 &&
          isVideo(p) &&
          p === ((o = E[0]) == null ? void 0 : o.getAttribute("src")) &&
          (log("_getUrlFromHtml from hlsPlayer", p),
          (i = p),
          (gOnlyVideo = E[0]));
      }
    }
    if (!i) {
      let v = selectorAll(".playsource > a[playdata]"),
        I = (n = v[0]) == null ? void 0 : n.getAttribute("playdata"),
        E = "playdata";
      (I ||
        ((v = selectorAll("#player-tab > .nav-item > a[data-m3u8]")),
        (I = (h = v[0]) == null ? void 0 : h.getAttribute("data-m3u8")),
        (E = "data-m3u8")),
        v.length === 1 &&
          I &&
          /播放源|视频源|线路/i.test(
            (s = v[0].parentElement) == null ? void 0 : s.textContent,
          ) &&
          (u = v[0].textContent) != null &&
          u.trim() &&
          isVideo(I) &&
          (E === "playdata" &&
            selectorOne(".stui-player__video > .video-js > video.vjs-tech") &&
            selectorOne("#contentlist > div.single-strong") &&
            (log("_getUrlFromHtml from a[playdata]", I), (i = I)),
          E === "data-m3u8" &&
            selectorOne(".plyr > .plyr__video-wrapper > video#player") &&
            selectorOne('div[class] > h1[class^="text"][style]') &&
            (log("_getUrlFromHtml suc a[data-m3u8]", I), (i = I))));
    }
    if (!i)
      try {
        let v =
          (c = selectorOne("#app")) == null
            ? void 0
            : c.getAttribute("data-page");
        if (v) {
          v = JSON.parse(v);
          const I = v.props.hlsUrl;
          if (isVideo(I) && v.component === "Video") {
            const E = t.getAttribute("poster"),
              p = t.getAttribute("title");
            (v.props.video.cover_img === E || v.props.video.Name === p) &&
              (log("_getUrlFromHtml suc #app[data-page]", I), (i = I));
          }
        }
      } catch (v) {
        log(
          "_getUrlFromHtml error #app[data-page]",
          v == null ? void 0 : v.message,
        );
      }
    if (!i) {
      const v =
          selectorOne("meta[property='og:video:secure_url']") ||
          selectorOne("meta[property='og:video']"),
        I = v == null ? void 0 : v.getAttribute("content");
      isVideo(I) &&
        (((f = selectorOne("meta[property='og:image']")) == null
          ? void 0
          : f.getAttribute("content")) === t.getAttribute("poster") ||
          ((_ = selectorOne("meta[property='og:image:alt']")) == null
            ? void 0
            : _.getAttribute("content")) === t.getAttribute("title")) &&
        (log("_getUrlFromHtml suc meta[property]", I), (i = I));
    }
    if (!i)
      try {
        const v = selectorOne("mark#bfz");
        if (v) {
          const I = v.getAttribute("data-user-name") || "",
            E = String(I).match(/https?:\/\/[^\s"'<>]+/i);
          if (E) {
            const p = E[0].replace(/[),;]+$/, "");
            isVideo(p) && (log("_getUrlFromHtml suc mark#bfz", p), (i = p));
          }
        }
      } catch (v) {
        log("_getUrlFromHtml error mark#bfz", v == null ? void 0 : v.message);
      }
    if (!i)
      try {
        const v = selectorOne('a[href*="/m3u8-download?"]');
        if (v && isMacDogSite()) {
          const P = (F) => {
            if (!F) return "";
            try {
              const T =
                new URL(F, location.origin).searchParams.get("url") || "";
              return T ? decodeURIComponent(T).trim() : "";
            } catch (b) {
              const T = String(F).match(/[?&]url=([^&]+)/i);
              return T ? decodeURIComponent(T[1]).trim() : "";
            }
          };
          let U = v.getAttribute("href") || "";
          if (((U = P(U)), isVideo(U)))
            return (
              log("_getUrlFromHtml suc a[href*='/m3u8-download?']", U),
              U
            );
        }
        const I = selectorOne("a.mode-button-download[href]");
        if (I && isQiMaoSite()) {
          let P = I.getAttribute("href") || "";
          if (isVideo(P))
            return (
              log("_getUrlFromHtml suc a.mode-button-download[href]", P),
              P
            );
        }
        const E = selectorOne(
          'input[readonly][value*=".mp4"], input[readonly][value*=".m3u8"]',
        );
        if (E && isHongTaoSite()) {
          const P = E.getAttribute("value").trim();
          if (isVideo(P)) return (log("getUrlFromHtml suc input", P), P);
        }
        const p = selectorOne("div.no-scrollbar[contenteditable]");
        if (p && isHongTaoSite()) {
          const P = (S = p.textContent) == null ? void 0 : S.trim();
          if (isVideo(P)) return (log("getUrlFromHtml suc div", P), P);
        }
      } catch (v) {
        log("_getUrlFromHtml error 下载按钮", v == null ? void 0 : v.message);
      }
    return i || "";
  }
  function getUrlFromFetch(t) {
    if (
      !gParams.supportAjax ||
      (log("_getUrlFromFetch", 2, gFetchIng), gFetchIng)
    )
      return;
    const r = isAcfunSite1(gDocTitle) || isAcfunSite2(gDocTitle),
      e = is7cSite(),
      i = isWuSeSite(),
      o = isAVBigSite(),
      n = isMasexSite(),
      h = isDYRSSite(),
      s = (u) => {
        ((gFetchIng = !0),
          r && (gFetchIng = !1),
          u(
            (c) => {
              (isVideo(c) ||
                r ||
                isAcfunAiSite(gDocTitle) ||
                isGDSite(gDocTitle) ||
                e ||
                i ||
                o ||
                n ||
                h) &&
                ((gFetchUrlSite = c),
                (gAjaxVideoUrl = c),
                gGetVideoSucCB &&
                  gGetVideoSucCB("ajax", Array.from([t]), gOnlyVideo));
            },
            {
              node: t,
            },
          ));
      };
    if (r) return s(fetchFromAcfun);
    if (isAcfunAiSite(gDocTitle)) return s(fetchFromAcfunAI);
    if (isYY8YSite()) return s(fetchFromYY8Y);
    if (isPDAVSite()) return s(fetchFromPDAV);
    if (isYJSite()) return s(fetchFromYJ);
    if (isGDSite(gDocTitle)) return s(fetchFromGD);
    if (isAGESite(gDocTitle)) return s(fetchFromAGE);
    if (is18AVSite()) return s(fetchFrom18AV);
    if (isDYDSSite()) return s(fetchFromDYDS);
    if (isMFKPSite()) return s(fetchFromMFKP);
    if (isAVHAISite()) return s(fetchFromAVHAI);
    if (isSae8Site()) return s(fetchFromSae8);
    if (isTvSmartSite()) return s(fetchFromTvSmart);
    if (is17Site()) return s(fetchFrom17);
    if (is618010Site()) return s(fetchFrom618010);
    if (isXiuseSite()) return s(fetchFromXiuse);
    if (isHuMaoSite()) return s(fetchFromHuMao);
    if (isPornCideSite()) return s(fetchFromPornCide);
    if (isJPMSite()) return s(fetchFromJPM);
    if (isMaDouSite()) return s(fetchFromMaDou);
    if (isKanJuSite())
      return gDocTitle.includes("搜剧") ? s(fetchFromSouJu) : s(fetchFromKanJu);
    if (e) return s(fetchFrom7c);
    if (isQiMaoSite()) return s(fetchFromQiMao);
    if (i) return s(fetchFromWuSe);
    if (isHuangDouSite()) return s(fetchFromHuangDou);
    if (isMiTaoSite()) return s(fetchFromMiTao);
    if (isMangoSite()) return s(fetchFromMango);
    if (isBilibiliSite(gDocTitle)) return s(fetchFromBilibili);
    if (isJPSite()) return s(fetchFromJP);
    if (isMiaoMiSite()) return s(fetchFromMiaoMi);
    if (n) return s(fetchFromMasex);
    if (h) return s(fetchFromDYRS);
  }
  function getUrlFromOther(t, r) {
    if (isXHubSite()) {
      for (let e of r)
        if (/var\s+src\s*=/i.test(e)) {
          const i = e.match(/var\s+src\s*=\s*["']([^"']+)["']/i);
          if (i[1]) return (log("_getUrlFromOther from var src", i[1]), i[1]);
        }
    }
    return "";
  }
  function startDynamicObserver(t, r) {
    if (gDynamicObserver) return;
    gDynamicObserver = !0;
    const e = r || getAllTagEl();
    let i = ["video", "iframe"];
    (isSae8Site() && (i = ["video"]),
      isMankoSite() && (i = ["iframe"]),
      startMutationObserver(
        {
          triggerEl: document.documentElement,
          tags: i,
          attrs: SRC_ATTRS,
          callback: t,
        },
        t,
      ),
      startResizeObserver((n) => {
        t("resize", n);
      }),
      startVisibleObserver(e, t),
      autoRun(e, t));
    const o = window.XL_WEB_ANALYSIS_PLUGIN_EFFECT || {};
    ((o.cleanObservers = cleanupObservers),
      (window.XL_WEB_ANALYSIS_PLUGIN_EFFECT = o));
  }
  function startMutationObserver(t, r) {
    const { tags: e, attrs: i, callback: o } = t,
      n = t.triggerEl || document.body,
      h = e.map((c) => c.toUpperCase()),
      s = (c) => {
        var f, _, S, v, I;
        switch (c.type) {
          case "childList":
            ((f = c.addedNodes) != null &&
              f.length &&
              c.addedNodes.forEach((E) => {
                if (h.includes(E.nodeName)) o("add", [E]);
                else if (E.nodeName === "SOURCE") {
                  const p = E.parentElement;
                  p && p.nodeName === "VIDEO" && o("add", [p]);
                } else if (
                  E instanceof HTMLElement &&
                  selectorOne(e.join(","), E)
                ) {
                  const p = selectorAll(e.join(","), E);
                  p.length && o("add", Array.from(p));
                }
              }),
              (_ = c.removedNodes) != null &&
                _.length &&
                c.removedNodes.forEach((E) => {
                  if (!E.isConnected) {
                    if (h.includes(E.nodeName)) o("remove", [E]);
                    else if (
                      E instanceof HTMLElement &&
                      selectorOne(e.join(","), E)
                    ) {
                      const p = selectorAll(e.join(","), E);
                      p.length && o("remove", Array.from(p));
                    }
                  }
                }));
            break;
          case "attributes":
            if (h.includes(c.target.nodeName)) {
              const E = c.target,
                p = c.attributeName;
              if (p === "src") {
                const P = (S = c.oldValue) == null ? void 0 : S.trim(),
                  U = (v = E.getAttribute(p)) == null ? void 0 : v.trim();
                (P && P !== U && o("attr_src", [E]),
                  !P && U && o("attr_src_add", [E]));
              } else i.includes(p) && o("attr", [E]);
              p === "style" &&
                !((I = E.dataset) != null && I.markClass) &&
                E.getAttribute("x_video_el_visible") !==
                  String(isValidEl(E, getCptStyle(E))) &&
                (log("_startVisibleObserver", nodeHtmlWithoutPoster(E)),
                gVisibleObserver.unobserve(E),
                r("visibleChange", getAllTagEl()));
            }
            break;
        }
      },
      u = {
        lock: !1,
        lockCount: 0,
        callbackCount: 0,
        counterTime: Date.now(),
        limit: [100, 5, 1e3],
      };
    return (
      (gElementObserver = new MutationObserver((c) => {
        if (u.lock) return;
        u.callbackCount += 1;
        const f = Date.now(),
          [_, S, v] = u.limit;
        if (f - u.counterTime <= _) {
          if (u.callbackCount >= S) {
            ((u.lock = !0), (u.lockCount += 1));
            const E = ue(u.lockCount, 2) * v;
            (log(`节点观测器 频繁触发，${E}ms 后解锁`),
              setTimeout(() => {
                ((u.counterTime = Date.now()),
                  (u.callbackCount = 0),
                  (u.lock = !1),
                  log("节点观测器 已解锁"),
                  r("mutation", getAllTagEl()));
              }, E));
          }
        } else u.lockCount = 0;
        const I = new WeakSet();
        c.forEach((E) => {
          if (E.type === "attributes" && E.attributeName === "src") {
            if (I.has(E.target)) return;
            I.add(E.target);
          }
          s(E);
        });
      })),
      gElementObserver.observe(n, {
        childList: !0,
        attributeFilter: [...i, "style"],
        attributeOldValue: !0,
        subtree: !0,
      }),
      log("启用节点观测器:", h, i),
      () => {
        gElementObserver.disconnect();
      }
    );
  }
  function startResizeObserver(t) {
    return (
      (gSizeObserver = new ResizeObserver(
        debounce(
          (r) => {
            const e = [],
              i = getPageStaticRect().width;
            for (const o of r) {
              const n = o.target,
                { width: h, height: s } = o.contentRect,
                u = !isLimit(h, s, i);
              (log("startResizeObserver", n.nodeName, u), u && e.push(n));
            }
            e.length &&
              (t(e),
              e.forEach((o) => {
                gSizeObserver.unobserve(o);
              }));
          },
          100,
          {
            trailing: !0,
          },
        ),
      )),
      () => {
        gSizeObserver.disconnect();
      }
    );
  }
  function startVisibleObserver(t, r) {
    return (
      (gVisibleObserver = new IntersectionObserver(
        (e) => {
          e.forEach((i) => {
            const o = i.target;
            o.getAttribute("x_video_el_visible") !==
              String(isValidEl(o, getCptStyle(o))) &&
              (log("_startVisibleObserver", nodeHtmlWithoutPoster(o)),
              gVisibleObserver.unobserve(o),
              r("visibleChange", getAllTagEl()));
          });
        },
        {
          rootMargin: "0px 0px 0px 0px",
          threshold: [0.1],
        },
      )),
      t.forEach((e) => {
        (e.setAttribute(
          "x_video_el_visible",
          String(isValidEl(e, getCptStyle(e))),
        ),
          gVisibleObserver.observe(e));
      }),
      () => {
        gVisibleObserver.disconnect();
      }
    );
  }
  function autoRun(t, r) {
    (clearAutoRun(),
      (gAutoTimer = setTimeout(() => {
        gAutoNum += 1;
        const e = getAllTagEl();
        if (e.length !== t.length || gAutoNum > 10) {
          (log("_autoRun", e, t), clearAutoRun(), r("auto", e));
          return;
        }
        autoRun(t, r);
      }, 500)));
  }
  function clearAutoRun() {
    gAutoTimer && (clearTimeout(gAutoTimer), (gAutoTimer = null));
  }
  function cleanupObservers() {
    (gSizeObserver && (gSizeObserver.disconnect(), (gSizeObserver = null)),
      gVisibleObserver &&
        (gVisibleObserver.disconnect(), (gVisibleObserver = null)),
      gElementObserver &&
        (gElementObserver.disconnect(), (gElementObserver = null)),
      gAutoTimer && (clearTimeout(gAutoTimer), (gAutoTimer = null)));
  }
  function evalJs(t) {
    if (!(t != null && t.length)) return [];
    const r = [];
    for (const e of t) {
      if (!e) continue;
      let i;
      try {
        i = new Function(`return window.${e}`)();
      } catch (o) {
        continue;
      }
      i != null &&
        (typeof i == "string"
          ? r.push(i)
          : typeof i == "object" &&
            (i.nodeType === void 0 && r.push(i),
            "opts" in i &&
              "root" in i &&
              "playerState" in i &&
              r.push({
                opts: i.opts,
                root: i.root,
                playerState: i.playerState,
              })));
    }
    return r;
  }
  function getAllTagEl() {
    const t = ":not([data-mark-replace='close'])";
    return isMiGuaSite() || isMissAVSite()
      ? Array.from(selectorAll(`video${t}`))
      : isJavryoSite()
        ? Array.from(selectorAll(`iframe.metaframe${t}`))
        : isMankoSite()
          ? Array.from(selectorAll(`iframe${t}`))
          : Array.from(selectorAll(`video${t}, iframe${t}`));
  }
  function getIdClassSelector(t) {
    if (!t) return "";
    const { id: r, className: e } = t;
    let i = "";
    r && (i += `#${r}`);
    const o = e ? e.split(" ").join(".") : "";
    return (o && (i += `.${o}`), i);
  }
  function isLimit(t, r, e) {
    if (gParams.minSize) return t <= gParams.minSize || r <= gParams.minSize;
    const i = getMinSize();
    return gDeviceType === "mobile" && e
      ? t <= e / 2 || r <= i
      : t <= i || r <= i;
  }
  function getMinSize() {
    return gParams.minSize
      ? gParams.minSize
      : gDeviceType === "mobile"
        ? 100
        : 10;
  }
  function getPageHref() {
    var t, r;
    try {
      return (
        ((r = (t = window.top) == null ? void 0 : t.location) == null
          ? void 0
          : r.href) || location.href
      );
    } catch (e) {
      return location.href;
    }
  }
  function getElSrc(t, r = "src") {
    var o;
    const e = r === "all" ? SRC_ATTRS : [r];
    let i = "";
    for (const n of e) {
      const h = (o = t.getAttribute(n)) == null ? void 0 : o.trim();
      if (h) {
        if (r === "src" || isVideo(h)) return h;
        if (!isBlob(h) && /^[A-Za-z0-9+/]+={0,2}$/.test(h)) {
          const s = getAtobResult(h);
          if (isVideo(s)) return s;
        }
        n === "src" && !i && (i = h);
      }
    }
    return i;
  }
  function getAtobResult(t) {
    if (typeof t != "string" || t.length % 4 !== 0) return t;
    try {
      return atob(t);
    } catch (r) {}
    return t;
  }
  function getFullUrl(t, r) {
    return !t || gRegHttpBlob.test(t) ? t : getURL(t, r).href || "";
  }
  function getVideoSrcFromUrl(t) {
    if (!hasVideoStr(t)) return "";
    const r = t.replace(/&amp;/gi, "&");
    let e = r;
    try {
      const o = getLink(r);
      if (!o) return "";
      if (
        (o.href && !isHttpOrHttps(e) && (e = o.href), isVideo("", o.pathname))
      )
        return e;
      if (o instanceof URL) {
        let n = "";
        if (
          (o.searchParams.forEach((h) => {
            if (n) return;
            const [s = ""] =
              h.match(VIDEO_SOURCE_REGEXP) ||
              h.match(VIDEO_SOURCE_REGEXP2) ||
              [];
            s && (n = s);
          }),
          n)
        )
          return n;
      }
    } catch (o) {
      log("_getVideoSrcFromUrl error", o);
    }
    const [i = ""] =
      e.match(VIDEO_SOURCE_REGEXP) ||
      decodeURIComponentSafe(e).match(VIDEO_SOURCE_REGEXP) ||
      [];
    return i || "";
  }
  function getLink(t) {
    let r;
    try {
      r = window.top.location.origin;
    } catch (e) {
      r = location.origin;
    }
    return getURL(t, r);
  }
  function isValidEl(t, r, e = getMinSize(), i = getMinSize()) {
    if (!t || t.style.display === "none") return !1;
    const { opacity: o, display: n, visibility: h } = r,
      s = t.getBoundingClientRect(),
      { width: u, height: c } = s;
    return !(
      +o <= 0.1 ||
      n === "none" ||
      h === "hidden" ||
      isElementFullyOutsideViewport(t, s) ||
      u <= e ||
      c <= i
    );
  }
  function isVideo(t, r) {
    var i;
    if (!t && !r) return !1;
    const e = r || ((i = getLink(t)) == null ? void 0 : i.pathname);
    return e && isEndWithVideoOne(e) && !/https?(:|%3A)(\/\/|%2F%2F)/i.test(e);
  }
  function isEndWithVideoOne(t) {
    return /\.(?:mp4|m3u8)\/?$/i.test(t);
  }
  function isEndWithVideoTwo(t) {
    return /\.(?:mp4|m3u8)(\?|$)/i.test(t);
  }
  function getVideoStrCount(t) {
    var r;
    return (
      (t &&
        ((r = t.match(/\.(?:mp4|m3u8)(?=$|[/?#&\s])/gi)) == null
          ? void 0
          : r.length)) ||
      0
    );
  }
  function hasVideoStr(t) {
    return /\.(?:mp4|m3u8)/i.test(t);
  }
  function decodeURIComponentSafe(t) {
    try {
      return decodeURIComponent(t);
    } catch (r) {
      return t;
    }
  }
  function getSpecialSiteScriptVideoUrl(t) {
    if (!t) return "";
    let r = "";
    return /setm3u8\(['"]/i.test(t) && ((r = getUrlFromSetm3u8(t)), isVideo(r))
      ? (log("_getUrlFromScript from setm3u8", r), r)
      : /playFilteredHLS\(/i.test(t) && ((r = getUrlFromPlay(t)), r)
        ? (log("_getUrlFromScript from playFilteredHLS", r),
          (scriptVideoMatchUrl = r),
          r)
        : /html5player\(/i.test(t) &&
            ((r = getUrlFromHtml5Player(t)), isVideo(r))
          ? (log("_getUrlFromScript from html5player", r), r)
          : selectorOne("#__NUXT_DATA__") &&
              /UrlHls/i.test(t) &&
              ((r = getUrlFromUrlHls(t)), isVideo(r))
            ? (log("_getUrlFromScript from UrlHls", r), r)
            : /j_b64\s*=/i.test(t) && ((r = getUrlFromJB64(t)), isVideo(r))
              ? (log("_getUrlFromScript from j_b64", r), r)
              : /(function initVodDetailsWhenReady|new APP\.ArtDetails|new APP\.VodDetails)\(/i.test(
                    t,
                  ) && ((r = getUrlFromXhs(t)), isVideo(r))
                ? (log("_getUrlFromScript from initVodDetailsWhenReady", r), r)
                : /hash_id/i.test(t) &&
                    /space_hosts/i.test(t) &&
                    ((r = getUrlFromHashId(t)), isVideo(r))
                  ? (log("_getUrlFromScript from hash_id", r), r)
                  : selectorOne("#__NUXT_DATA__") &&
                      /master\.m3u8/i.test(t) &&
                      ((r = getUrlFromKMaster(t)), isVideo(r))
                    ? (log("_getUrlFromScript from master.m3u8", r), r)
                    : /decrypt91VideoUrl/i.test(t) &&
                        ((r = getUrlFromDecrypt(t)), isVideo(r))
                      ? (log("_getUrlFromScript from decrypt91VideoUrl", r), r)
                      : /videoSrc\s*=\s*["']/i.test(t) &&
                          /isVip\s*=/i.test(t) &&
                          ((r = getUrlFromHGTv(t)), isVideo(r))
                        ? (log("_getUrlFromScript from videoSrc", r), r)
                        : (/decodeURIComponent\(/.test(t) ||
                              /\$\.get\(atob\((['"])(.*?)\1\)\)/.test(t)) &&
                            ((r = getUrlFromAtob(t)), isVideo(r))
                          ? (log("_getUrlFromScript from atob", r), r)
                          : "";
  }
  function getUrlFromSetm3u8(t) {
    try {
      let r = function (b, T, C) {
          var M = "",
            x = "";
          n == "1"
            ? ((M = h), (x = c))
            : n == "2"
              ? ((M = s), (x = f))
              : n == "3" && ((M = u), (x = _));
          var a = M + b + "index.m3u8",
            y = "";
          return (
            v == "2000"
              ? (y = x + T + "index.m3u8")
              : (y = x + C + "index.m3u8"),
            (E && S == "1") || I == "0" ? y : p ? (P ? a : y) : U || F ? a : y
          );
        },
        e = "",
        i = "";
      const o = t.match(gRegSetm3u8);
      if ((o && o.length === 3 && ((e = o[1]), (i = o[2])), !i)) return "";
      const n = window.line1,
        h = window.h265m3u8path1,
        s = window.h265m3u8path2,
        u = window.h265m3u8path3,
        c = window.m3u8path1,
        f = window.m3u8path2,
        _ = window.m3u8path3,
        S = window.isUseH264ForIos,
        v = window.UseH264Bitrate,
        I = window.isUseH265,
        E = window.isIOS(),
        p = window.zplayer.isSupported(),
        P = window.zplayer.isCodecSupported("hvc1.1.6.L120.90"),
        U = window.zplayer.isNativeSupported(),
        F = window.zplayer.isCodecSupported("hvc1.1.6.L120.90");
      return r(e, i, "");
    } catch (r) {
      log("_getUrlFromSetm3u8 error", r == null ? void 0 : r.message);
    }
    return "";
  }
  function getUrlFromPlay(t) {
    try {
      const r = t.match(
        /playFilteredHLS\(\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/,
      );
      if (r && r[1] === "video" && r[2]) return r[2];
    } catch (r) {
      log("_getUrlFromPlay error", r == null ? void 0 : r.message);
    }
    return "";
  }
  function getUrlFromHtml5Player(t) {
    try {
      const r = (i) =>
          (t.match(new RegExp(`html5player\\.${i}\\('([^']+)'\\)`)) || [])[1] ||
          "",
        e = r("setVideoHLS") || r("setVideoUrlHigh") || r("setVideoUrlLow");
      if (/^https?:\/\//i.test(e)) return e;
    } catch (r) {
      log("_getUrlFromHtml5Player error", r == null ? void 0 : r.message);
    }
    return "";
  }
  function getUrlFromUrlHls(t) {
    try {
      const r = JSON.parse(t);
      if (!Array.isArray(r)) throw new Error("__NUXT_DATA__ 非数组");
      const e = r.find(
        (i) =>
          typeof i == "string" &&
          /^https?:\/\//i.test(i) &&
          /\.m3u8(\?|$)/i.test(i),
      );
      if (e) return e;
    } catch (r) {
      log("_getUrlFromUrlHls error", r == null ? void 0 : r.message);
    }
    return "";
  }
  function getUrlFromJB64(t) {
    var r;
    try {
      const e =
        (r = t.match(/j_b64\s*=\s*['"]([^'"]*)['"]/i)) == null ? void 0 : r[1];
      if (e) {
        const i = atob(e);
        return JSON.parse(i).m3;
      }
    } catch (e) {
      log("_getUrlFromUrlHls error", e == null ? void 0 : e.message);
    }
    return "";
  }
  function getUrlFromXhs(t) {
    try {
      return (function (e) {
        var b, T, C, M, x, a, y, A, $, W, q, l, D;
        if (!e) throw new Error("无 html");
        const i =
            e.match(
              /function initVodDetailsWhenReady\(\)\s*\{\s*var json = '([^']+)'/,
            ) ||
            e.match(/new APP\.ArtDetails\('([^']+)'\)/) ||
            e.match(/new APP\.VodDetails\('([^']+)'\)/),
          o = i && i[1];
        if (!o) throw new Error("无页内 encrypted json");
        const n = "UC2FmMyG928hRZY4",
          u = ((V, z) => {
            const j = new Uint8Array(V.length);
            for (let k = 0; k < V.length; k++) j[k] = V[k] ^ z[k % z.length];
            return j;
          })(
            ((V) => {
              V = V.replace(/-/g, "+").replace(/_/g, "/");
              const z = V.length % 4;
              z && (V += "=".repeat(4 - z));
              const j = atob(V),
                k = new Uint8Array(j.length);
              for (let X = 0; X < j.length; X++) k[X] = j.charCodeAt(X) & 255;
              return k;
            })(o),
            new TextEncoder().encode(n),
          ),
          c = u[0] || 0,
          f = u.subarray(1);
        let _;
        if (c === 1) {
          const V = window.pako;
          if (!V || !V.inflateRaw) throw new Error("缺 pako.inflateRaw");
          _ = V.inflateRaw(f);
        } else _ = f;
        const S = JSON.parse(new TextDecoder("utf-8").decode(_)),
          v =
            ((a =
              (x =
                (M =
                  (C =
                    (T =
                      (b = S == null ? void 0 : S.info) == null
                        ? void 0
                        : b.vod_data_array) == null
                      ? void 0
                      : T.vod_play_url) == null
                    ? void 0
                    : C[0]) == null
                  ? void 0
                  : M.list) == null
                ? void 0
                : x[0]) == null
              ? void 0
              : a.h264) ||
            ((D =
              (l =
                (q =
                  (W =
                    ($ =
                      (A =
                        (y = S == null ? void 0 : S.details) == null
                          ? void 0
                          : y.vod_data_tmp) == null
                        ? void 0
                        : A[0]) == null
                      ? void 0
                      : $.vod_play_url) == null
                    ? void 0
                    : W[0]) == null
                  ? void 0
                  : q.list) == null
                ? void 0
                : l[0]) == null
              ? void 0
              : D.h264);
        if (!v) throw new Error("无 h264");
        const I = "psIBMQo9fjm2xlL6Vpr3IsQ8dWHS46",
          E = new URL(v),
          p = Math.floor(Date.now() / 1e3),
          P = CryptoJS.MD5(I + E.pathname + p).toString(),
          U = new URLSearchParams(E.search);
        (U.set("sign", P), U.set("t", String(p)));
        const F = E.origin + E.pathname + "?" + U;
        if (!/\.m3u8(\?|$)/i.test(F)) throw new Error("非 m3u8");
        return {
          playUrl: F,
        };
      })(t).playUrl;
    } catch (r) {
      log("_getUrlFromXhs error", r == null ? void 0 : r.message);
    }
    return "";
  }
  function getUrlFromHashId(t) {
    try {
      const r = JSON.parse(t),
        e = r.hash_id,
        i = r.space_hosts[0][2],
        n = JSON.parse(selectorOne("#v3-public-data").textContent).config
          .web_hash.space_cdn_hash;
      return !e || !i || !n ? "" : `https://${i}/videos/${e}/g.m3u8?h=${n}`;
    } catch (r) {
      log("_getUrlFromHashId error", r == null ? void 0 : r.message);
    }
    return "";
  }
  function getUrlFromKMaster(t) {
    try {
      const r = location.pathname.split("/").filter(Boolean).pop() || "";
      if (!r) throw new Error("无 episodeId");
      const e = t;
      if (!e) return "";
      const i = e.replace(/\\u002F/g, "/").replace(/\\\//g, "/"),
        o = i.indexOf(`"${r}"`);
      if (o < 0) return "";
      const h = i.slice(o, o + 600).match(/https:\/\/[^"]+master\.m3u8[^"]*/);
      return (h && h[0]) || "";
    } catch (r) {
      log("_getUrlFromKMaster error", r == null ? void 0 : r.message);
    }
    return "";
  }
  function getUrlFromDecrypt(t) {
    try {
      const r = String(t || "").trim();
      if (!r) throw new Error("请传入 script 字符串");
      const e = r.match(
          /decrypt91VideoUrl\(\s*(?:\\)?['"]([^'"\\]+)(?:\\)?['"]\s*\)/,
        ),
        i = e ? e[1].trim() : "";
      if (!i) throw new Error("script 中无 decrypt91VideoUrl 密文");
      if (typeof CryptoJS > "u") throw new Error("页内无 CryptoJS");
      const o = CryptoJS.enc.Utf8.parse("BxJand%xf5h3sycH"),
        n = CryptoJS.AES.decrypt(i, o, {
          iv: o,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        })
          .toString(CryptoJS.enc.Utf8)
          .trim();
      if (isVideo(n)) return n;
    } catch (r) {
      log("_getUrlFromDecrypt error", r == null ? void 0 : r.message);
    }
    return "";
  }
  function getUrlFromHGTv(t) {
    try {
      const r = String(t || "").trim();
      if (!r) throw new Error("请传入 script 字符串");
      const e = r.match(/let\s+videoSrc\s*=\s*["']([^"']+\.m3u8[^"']*)["']/);
      if (!e) throw new Error("script 中无 videoSrc");
      const i = e[1].replace(/\\\//g, "/"),
        o = new URL(i, location.origin).href;
      if (isVideo(o)) return o;
    } catch (r) {
      log("_getUrlFromHGTv error", r == null ? void 0 : r.message);
    }
    return "";
  }
  function getUrlFromAtob(t) {
    try {
      const r = /\$\.get\(atob\((['"])(.*?)\1\)\)/;
      let e = t.match(r);
      if (!e) {
        const o = t.match(/decodeURIComponent\((['"])(.*?)\1\)/);
        o && (e = decodeURIComponent(o[2]).match(r));
      }
      if (!e) throw new Error("无 $.get(atob(…)) 播放地址");
      const i = atob(e[2]).trim();
      if (isVideo(i)) return i;
    } catch (r) {
      log("_getUrlFromAtob error", r == null ? void 0 : r.message);
    }
  }
  function fetchUrl(t) {
    if (gFetchInnerIng) return;
    gFetchInnerIng = !0;
    const {
      dataApi: r,
      dataKey: e,
      dataIv: i,
      theCryptoJS: o,
      resType: n,
      cb: h,
    } = t;
    (log("_fetchUrl req"),
      fetch(r, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((s) => {
          if (n === "json") return s.json();
          if (n === "text")
            return s.text().then((u) => ({
              text: u,
              status: s.status,
              ok: s.ok,
            }));
        })
        .then((s) => {
          let u = "";
          (n === "json" && (u = s.data), n === "text" && (u = s.text));
          let c = getUrlFromRes({
            theCryptoJS: o,
            payload: u,
            dataKey: e,
            dataIv: i,
          });
          function f(_) {
            return String(_ || "").replace(
              /\{\{DP_AB:(BURL|AURL):([A-Za-z0-9+/=]+)\}\}/g,
              (S, v, I) => {
                try {
                  return atob(I).replace(/^\//, "");
                } catch (E) {
                  return "";
                }
              },
            );
          }
          ((c = f(c)), log("_fetchUrl suc", s, `m3u8Url: ${c}`), h && h(c));
        })
        .catch((s) => {
          log("_fetchUrl error", s);
        }));
  }
  function getUrlFromRes(t) {
    let { theCryptoJS: r, payload: e, dataKey: i, dataIv: o } = t;
    if (typeof e == "string") {
      if (((e = e.trim()), /^https?:\/\//i.test(e))) return e;
      if (/^\s*<!doctype|^\s*<html/i.test(e)) {
        const c = e.match(
          /https?:\/\/[^"'\\s<>]+?\.(mp4|m3u8)(\?[^"'\\s<>]*)?/i,
        );
        if (c && c[0]) return c[0];
      }
      try {
        e = JSON.parse(e);
      } catch (c) {}
    }
    if (!e) return;
    let n = e;
    if (typeof e == "object") {
      const c = Number(e.code),
        f = Number(e.status),
        _ = e.data || e.url || e.play_url || e.playUrl || e.src || "";
      if (!_) return;
      if (typeof _ == "string" && /^https?:\/\//i.test(_)) return _;
      if (!(c === 200 || c === 1 || f === 0 || f === 200)) return;
      n = _;
    }
    const h = r.enc.Utf8.parse(i),
      s = r.enc.Utf8.parse(o);
    return r.AES.decrypt(n, h, {
      iv: s,
      mode: r.mode.CBC,
      padding: r.pad.Pkcs7,
    }).toString(r.enc.Utf8);
  }
  function getUrlFromFetchElementSrc(t, r, e) {
    return K(this, null, function* () {
      if (gFetchInnerIng) return;
      gFetchInnerIng = !0;
      const i = (function () {
        function p(l, D) {
          var V = (l & 65535) + (D & 65535),
            z = (l >> 16) + (D >> 16) + (V >> 16);
          return (z << 16) | (V & 65535);
        }
        function P(l, D) {
          return (l << D) | (l >>> (32 - D));
        }
        function U(l, D, V, z, j, k) {
          return p(P(p(p(D, l), p(z, k)), j), V);
        }
        function F(l, D, V, z, j, k, X) {
          return U((D & V) | (~D & z), l, D, j, k, X);
        }
        function b(l, D, V, z, j, k, X) {
          return U((D & z) | (V & ~z), l, D, j, k, X);
        }
        function T(l, D, V, z, j, k, X) {
          return U(D ^ V ^ z, l, D, j, k, X);
        }
        function C(l, D, V, z, j, k, X) {
          return U(V ^ (D | ~z), l, D, j, k, X);
        }
        function M(l, D) {
          ((l[D >> 5] |= 128 << (D % 32)),
            (l[(((D + 64) >>> 9) << 4) + 14] = D));
          var V,
            z,
            j,
            k,
            X,
            R = 1732584193,
            g = -271733879,
            N = -1732584194,
            d = 271733878;
          for (V = 0; V < l.length; V += 16)
            ((z = R),
              (j = g),
              (k = N),
              (X = d),
              (R = F(R, g, N, d, l[V], 7, -680876936)),
              (d = F(d, R, g, N, l[V + 1], 12, -389564586)),
              (N = F(N, d, R, g, l[V + 2], 17, 606105819)),
              (g = F(g, N, d, R, l[V + 3], 22, -1044525330)),
              (R = F(R, g, N, d, l[V + 4], 7, -176418897)),
              (d = F(d, R, g, N, l[V + 5], 12, 1200080426)),
              (N = F(N, d, R, g, l[V + 6], 17, -1473231341)),
              (g = F(g, N, d, R, l[V + 7], 22, -45705983)),
              (R = F(R, g, N, d, l[V + 8], 7, 1770035416)),
              (d = F(d, R, g, N, l[V + 9], 12, -1958414417)),
              (N = F(N, d, R, g, l[V + 10], 17, -42063)),
              (g = F(g, N, d, R, l[V + 11], 22, -1990404162)),
              (R = F(R, g, N, d, l[V + 12], 7, 1804603682)),
              (d = F(d, R, g, N, l[V + 13], 12, -40341101)),
              (N = F(N, d, R, g, l[V + 14], 17, -1502002290)),
              (g = F(g, N, d, R, l[V + 15], 22, 1236535329)),
              (R = b(R, g, N, d, l[V + 1], 5, -165796510)),
              (d = b(d, R, g, N, l[V + 6], 9, -1069501632)),
              (N = b(N, d, R, g, l[V + 11], 14, 643717713)),
              (g = b(g, N, d, R, l[V], 20, -373897302)),
              (R = b(R, g, N, d, l[V + 5], 5, -701558691)),
              (d = b(d, R, g, N, l[V + 10], 9, 38016083)),
              (N = b(N, d, R, g, l[V + 15], 14, -660478335)),
              (g = b(g, N, d, R, l[V + 4], 20, -405537848)),
              (R = b(R, g, N, d, l[V + 9], 5, 568446438)),
              (d = b(d, R, g, N, l[V + 14], 9, -1019803690)),
              (N = b(N, d, R, g, l[V + 3], 14, -187363961)),
              (g = b(g, N, d, R, l[V + 8], 20, 1163531501)),
              (R = b(R, g, N, d, l[V + 13], 5, -1444681467)),
              (d = b(d, R, g, N, l[V + 2], 9, -51403784)),
              (N = b(N, d, R, g, l[V + 7], 14, 1735328473)),
              (g = b(g, N, d, R, l[V + 12], 20, -1926607734)),
              (R = T(R, g, N, d, l[V + 5], 4, -378558)),
              (d = T(d, R, g, N, l[V + 8], 11, -2022574463)),
              (N = T(N, d, R, g, l[V + 11], 16, 1839030562)),
              (g = T(g, N, d, R, l[V + 14], 23, -35309556)),
              (R = T(R, g, N, d, l[V + 1], 4, -1530992060)),
              (d = T(d, R, g, N, l[V + 4], 11, 1272893353)),
              (N = T(N, d, R, g, l[V + 7], 16, -155497632)),
              (g = T(g, N, d, R, l[V + 10], 23, -1094730640)),
              (R = T(R, g, N, d, l[V + 13], 4, 681279174)),
              (d = T(d, R, g, N, l[V], 11, -358537222)),
              (N = T(N, d, R, g, l[V + 3], 16, -722521979)),
              (g = T(g, N, d, R, l[V + 6], 23, 76029189)),
              (R = T(R, g, N, d, l[V + 9], 4, -640364487)),
              (d = T(d, R, g, N, l[V + 12], 11, -421815835)),
              (N = T(N, d, R, g, l[V + 15], 16, 530742520)),
              (g = T(g, N, d, R, l[V + 2], 23, -995338651)),
              (R = C(R, g, N, d, l[V], 6, -198630844)),
              (d = C(d, R, g, N, l[V + 7], 10, 1126891415)),
              (N = C(N, d, R, g, l[V + 14], 15, -1416354905)),
              (g = C(g, N, d, R, l[V + 5], 21, -57434055)),
              (R = C(R, g, N, d, l[V + 12], 6, 1700485571)),
              (d = C(d, R, g, N, l[V + 3], 10, -1894986606)),
              (N = C(N, d, R, g, l[V + 10], 15, -1051523)),
              (g = C(g, N, d, R, l[V + 1], 21, -2054922799)),
              (R = C(R, g, N, d, l[V + 8], 6, 1873313359)),
              (d = C(d, R, g, N, l[V + 15], 10, -30611744)),
              (N = C(N, d, R, g, l[V + 6], 15, -1560198380)),
              (g = C(g, N, d, R, l[V + 13], 21, 1309151649)),
              (R = C(R, g, N, d, l[V + 4], 6, -145523070)),
              (d = C(d, R, g, N, l[V + 11], 10, -1120210379)),
              (N = C(N, d, R, g, l[V + 2], 15, 718787259)),
              (g = C(g, N, d, R, l[V + 9], 21, -343485551)),
              (R = p(R, z)),
              (g = p(g, j)),
              (N = p(N, k)),
              (d = p(d, X)));
          return [R, g, N, d];
        }
        function x(l) {
          var D,
            V = "",
            z = l.length * 32;
          for (D = 0; D < z; D += 8)
            V += String.fromCharCode((l[D >> 5] >>> (D % 32)) & 255);
          return V;
        }
        function a(l) {
          var D,
            V = [];
          for (V[(l.length >> 2) - 1] = void 0, D = 0; D < V.length; D += 1)
            V[D] = 0;
          var z = l.length * 8;
          for (D = 0; D < z; D += 8)
            V[D >> 5] |= (l.charCodeAt(D / 8) & 255) << (D % 32);
          return V;
        }
        function y(l) {
          return x(M(a(l), l.length * 8));
        }
        function A(l) {
          var D = "0123456789abcdef",
            V = "",
            z,
            j;
          for (j = 0; j < l.length; j += 1)
            ((z = l.charCodeAt(j)),
              (V += D.charAt((z >>> 4) & 15) + D.charAt(z & 15)));
          return V;
        }
        function $(l) {
          return unescape(encodeURIComponent(l));
        }
        function W(l) {
          return y($(l));
        }
        function q(l) {
          return A(W(l));
        }
        return q;
      })();
      function o(p) {
        return typeof globalThis.md5 == "function"
          ? globalThis.md5(String(p))
          : i(String(p));
      }
      const n =
        "PXhw7UT1B0a9kQDKZsjIASmOezxYG4CHo5Jyfg2b8FLpEvRr3WtVnlqMidu6cN";
      function h(p) {
        const P = atob(p);
        let U = "";
        const F = n;
        for (let b = 1; b < P.length; b += 3) {
          const T = P[b],
            C = F.indexOf(T);
          C === -1 ? (U += T) : (U += F[(C + 59) % 62]);
        }
        return U;
      }
      function s(p) {
        if (typeof TextDecoder < "u") {
          const P = new Uint8Array(p.length);
          for (let U = 0; U < p.length; U++) P[U] = p.charCodeAt(U);
          return new TextDecoder().decode(P);
        }
        return decodeURIComponent(escape(p));
      }
      function u(p) {
        const P = String(p).replace(/[^A-Za-z0-9+/=]/g, ""),
          U = atob(P);
        return s(U);
      }
      function c(p, P) {
        const U = typeof p == "string" ? p : String(p);
        for (let F = 0; F < U.length; F++) if (U[F] === P) return !0;
        return !1;
      }
      function f(p) {
        return typeof p == "string"
          ? p
          : Array.isArray(p)
            ? p.join("")
            : String(p);
      }
      function _(p, P, U) {
        const F = f(p),
          b = f(P);
        let T = "";
        const C = /^[a-zA-Z]$/;
        for (let M = 0; M < U.length; M++) {
          const x = U[M];
          if (C.test(x) && c(b, x)) {
            const a = F.indexOf(x);
            T += a >= 0 ? b[a] : x;
          } else T += x;
        }
        return T;
      }
      function S(p) {
        function P(F) {
          const b = p("test"),
            T = u(F);
          let C = "";
          const M = b.length;
          for (let x = 0; x < T.length; x++)
            C += String.fromCharCode(T.charCodeAt(x) ^ b.charCodeAt(x % M));
          return u(C);
        }
        function U(F) {
          const T = P(F).split("/"),
            C = T.slice(2).join("/"),
            M = u(C),
            x = JSON.parse(u(T[1])),
            a = JSON.parse(u(T[0]));
          return _(x, a, M);
        }
        return {
          get(F) {
            return U(F);
          },
          decodeSignedPath: U,
        };
      }
      function v() {
        return {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
        };
      }
      function I(p, P) {
        const U = S(P);
        let F = p.url != null ? String(p.url) : "";
        const b = Number(p.urlmode);
        return (b === 1 ? (F = U.get(F)) : b === 2 && (F = h(F)), F);
      }
      function E(p, P) {
        return K(this, null, function* () {
          try {
            const U = new URLSearchParams({
                vid: String(p),
              }).toString(),
              F = yield fetch(P, {
                method: "POST",
                headers: v(),
                body: U,
                credentials: "include",
              }),
              b = yield F.json();
            if (!(b && Number(b.code) === 200 && b.data)) {
              const M =
                b && b.message != null
                  ? String(b.message)
                  : `HTTP/API error (${F.status})`;
              throw new Error(M);
            }
            const C = I(b.data, o);
            return (
              log("_fetchVideoPlayUrl suc", C),
              {
                raw: b,
                url: C,
              }
            );
          } catch (U) {
            log("_fetchVideoPlayUrl error", U);
          }
          return {
            raw: null,
            url: "",
          };
        });
      }
      E(r, e).then((p) => {
        p.url &&
          isVideo(p.url) &&
          ((gAjaxVideoUrl = p.url),
          gGetVideoSucCB &&
            gGetVideoSucCB("ajax", Array.from([t]), gOnlyVideo));
      });
    });
  }
  function getVideoUrlsFronPerf() {
    const t = performance.getEntriesByType("resource");
    if (!t || t.length === 0) return [];
    let r = [];
    for (let e = 0; e < t.length; e++) {
      const i = t[e].name || "";
      isEndWithVideoTwo(i) && r.push(i);
    }
    if (r.length > 0) return r;
  }
  function fetchFromYY8Y(t) {
    return K(this, null, function* () {
      try {
        log("_fetchFromYY8Y start");
        const r = getURL(gPageHref),
          e = r.searchParams.get("type_Mid"),
          i = r.searchParams.get("id"),
          o = Number(r.searchParams.get("xl"));
        let n = null;
        if (!i || !e) {
          log("_fetchUrlFromYY8Y error：需要 id 和 type_Mid");
          return;
        }
        function h(S, v) {
          return K(this, null, function* () {
            const I = JSON.stringify(v),
              E = yield fetch(S, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: I,
              });
            if (!E.ok) {
              log("_fetchUrlFromYY8Y error：HTTP " + E.status + " " + S);
              return;
            }
            return E.json();
          });
        }
        if (
          !n &&
          ((n = (yield h("https://xmhk.7wzx9.com/getDataInit", {
            name: "John",
            age: 31,
            city: "New York",
          })).data.macVodLinkMap),
          !n)
        ) {
          log("_fetchUrlFromYY8Y error：getDataInit 未返回 macVodLinkMap");
          return;
        }
        const c = (yield h("https://xmhk.7wzx9.com/forward", {
          command: "WEB_GET_INFO_DETAIL",
          type_Mid: e,
          id: i,
          languageType: "CN",
        })).data.result;
        if (!c || !c.vod_url) {
          log("_fetchUrlFromYY8Y error：WEB_GET_INFO_DETAIL 无 vod_url");
          return;
        }
        const f = Math.floor(Math.random() * 2 + 1);
        let _ = "";
        (n != null &&
          (o == 1
            ? (_ = n[c.vod_server_id].LINK_1 + c.vod_url)
            : o == 2
              ? (_ = n[c.vod_server_id].LINK_2 + c.vod_url)
              : o == 3
                ? (_ = n[c.vod_server_id].LINK_3 + c.vod_url)
                : f == 1
                  ? (_ = n[c.vod_server_id].LINK_1 + c.vod_url)
                  : f == 2
                    ? (_ = n[c.vod_server_id].LINK_2 + c.vod_url)
                    : (_ = n[c.vod_server_id].LINK_1 + c.vod_url)),
          log("_fetchFromYY8Y suc：", _),
          t && t(_));
      } catch (r) {
        log("_fetchFromYY8Y error：", r == null ? void 0 : r.message);
      }
    });
  }
  function fetchFromPDAV(t) {
    return K(this, null, function* () {
      log("_fetchFromPDAV start");
      function r() {
        return K(this, null, function* () {
          var I, E;
          const e = new URL(location.href),
            i = e.searchParams.get("id"),
            o = e.searchParams.get("type_Mid"),
            n = Number(e.searchParams.get("xl")) || 0;
          if (!i || !o) throw new Error("需要 id 和 type_Mid");
          const h = (p, P) =>
              K(this, null, function* () {
                const U = yield fetch(p, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(P),
                });
                if (!U.ok) throw new Error("HTTP " + U.status + " " + p);
                return U.json();
              }),
            s = yield h("https://data.7wzx9.com/getDataInit", {
              name: "John",
              age: 31,
              city: "New York",
            }),
            u =
              (I = s == null ? void 0 : s.data) == null
                ? void 0
                : I.macVodLinkMap;
          if (!u) throw new Error("getDataInit 无 macVodLinkMap");
          const c = yield h("https://data.7wzx9.com/forward", {
              command: "WEB_GET_INFO_DETAIL",
              type_Mid: o,
              id: i,
              languageType: "CN",
            }),
            f = (E = c == null ? void 0 : c.data) == null ? void 0 : E.result;
          if (!(f != null && f.vod_url))
            throw new Error("WEB_GET_INFO_DETAIL 无 vod_url");
          const _ = u[f.vod_server_id] || u[String(f.vod_server_id)];
          if (!_) throw new Error("无线路 server " + f.vod_server_id);
          let S = _.LINK_1;
          n === 2
            ? (S = _.LINK_2 || S)
            : n === 3
              ? (S = _.LINK_3 || S)
              : n === 1 && (S = _.LINK_1 || S);
          const v = String(S || "").replace(/\/$/, "") + f.vod_url;
          if (!/^https?:\/\//i.test(v) || !/\.m3u8(\?|$)/i.test(v))
            throw new Error("拼接结果非 m3u8");
          return {
            playUrl: v,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromPDAV suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromPDAV error：", e == null ? void 0 : e.message);
        });
    });
  }
  let acfunSite1VideoUrl = "",
    acfunSite2VideoReq = [],
    acfunSite2VideoUrl = [];
  function fetchFromAcfun(t, r) {
    return K(this, null, function* () {
      var h, s, u, c;
      log("_fetchFromAcfun start");
      function e(f, _) {
        return K(this, null, function* () {
          var z;
          const S =
            String(_ || "video").toLowerCase() === "dynamic"
              ? "dynamic"
              : "video";
          let v = String(f != null ? f : "").trim();
          if (
            (!v &&
              S === "video" &&
              (v = String(
                ((z = location.pathname.match(/\/play\/(\d+)/i)) == null
                  ? void 0
                  : z[1]) || "",
              ).trim()),
            !v)
          )
            throw new Error(
              S === "dynamic"
                ? "需要 dynamicId（外部传入）"
                : "需要 id（传入或 /play/:id）",
            );
          const I = window.__PRODUCTION__SI_RI_ACFUN__CONF__ || {},
            E =
              String(I.VITE_GLOB_API_URL || "/api").replace(/\/+$/, "") ||
              "/api",
            p = String(I.VITE_GLOB_APP_VERSION || "1.9.6"),
            P = (
              String(I.VITE_GLOB_APP_SHORT_NAME || "si_ri_acfun") +
              "__production__" +
              p +
              "__"
            ).toUpperCase(),
            U = (j) => {
              try {
                return JSON.parse(j);
              } catch (k) {
                return null;
              }
            },
            F = (j) => {
              const k = U(j);
              return k && k.value !== void 0 ? k.value : k;
            },
            b = (j) => {
              var ee;
              if ((ee = window.CryptoJS) != null && ee.MD5)
                return window.CryptoJS.MD5(String(j)).toString();
              const k = (G, Q) => {
                  const te = (G & 65535) + (Q & 65535);
                  return (
                    (((G >> 16) + (Q >> 16) + (te >> 16)) << 16) | (te & 65535)
                  );
                },
                X = (G, Q) => (G << Q) | (G >>> (32 - Q)),
                R = (G, Q, te, oe, ne, ae) =>
                  k(X(k(k(Q, G), k(oe, ae)), ne), te),
                g = (G, Q, te, oe, ne, ae, le) =>
                  R((Q & te) | (~Q & oe), G, Q, ne, ae, le),
                N = (G, Q, te, oe, ne, ae, le) =>
                  R((Q & oe) | (te & ~oe), G, Q, ne, ae, le),
                d = (G, Q, te, oe, ne, ae, le) =>
                  R(Q ^ te ^ oe, G, Q, ne, ae, le),
                L = (G, Q, te, oe, ne, ae, le) =>
                  R(te ^ (Q | ~oe), G, Q, ne, ae, le),
                B = unescape(encodeURIComponent(String(j))),
                O = [];
              for (let G = 0; G < B.length * 8; G += 8)
                O[G >> 5] |= (B.charCodeAt(G / 8) & 255) << (G % 32);
              const re = B.length * 8;
              ((O[re >> 5] |= 128 << (re % 32)),
                (O[(((re + 64) >>> 9) << 4) + 14] = re));
              let Y = 1732584193,
                w = -271733879,
                H = -1732584194,
                J = 271733878;
              for (let G = 0; G < O.length; G += 16) {
                const [Q, te, oe, ne] = [Y, w, H, J];
                ((Y = g(Y, w, H, J, O[G], 7, -680876936)),
                  (J = g(J, Y, w, H, O[G + 1], 12, -389564586)),
                  (H = g(H, J, Y, w, O[G + 2], 17, 606105819)),
                  (w = g(w, H, J, Y, O[G + 3], 22, -1044525330)),
                  (Y = g(Y, w, H, J, O[G + 4], 7, -176418897)),
                  (J = g(J, Y, w, H, O[G + 5], 12, 1200080426)),
                  (H = g(H, J, Y, w, O[G + 6], 17, -1473231341)),
                  (w = g(w, H, J, Y, O[G + 7], 22, -45705983)),
                  (Y = g(Y, w, H, J, O[G + 8], 7, 1770035416)),
                  (J = g(J, Y, w, H, O[G + 9], 12, -1958414417)),
                  (H = g(H, J, Y, w, O[G + 10], 17, -42063)),
                  (w = g(w, H, J, Y, O[G + 11], 22, -1990404162)),
                  (Y = g(Y, w, H, J, O[G + 12], 7, 1804603682)),
                  (J = g(J, Y, w, H, O[G + 13], 12, -40341101)),
                  (H = g(H, J, Y, w, O[G + 14], 17, -1502002290)),
                  (w = g(w, H, J, Y, O[G + 15], 22, 1236535329)),
                  (Y = N(Y, w, H, J, O[G + 1], 5, -165796510)),
                  (J = N(J, Y, w, H, O[G + 6], 9, -1069501632)),
                  (H = N(H, J, Y, w, O[G + 11], 14, 643717713)),
                  (w = N(w, H, J, Y, O[G], 20, -373897302)),
                  (Y = N(Y, w, H, J, O[G + 5], 5, -701558691)),
                  (J = N(J, Y, w, H, O[G + 10], 9, 38016083)),
                  (H = N(H, J, Y, w, O[G + 15], 14, -660478335)),
                  (w = N(w, H, J, Y, O[G + 4], 20, -405537848)),
                  (Y = N(Y, w, H, J, O[G + 9], 5, 568446438)),
                  (J = N(J, Y, w, H, O[G + 14], 9, -1019803690)),
                  (H = N(H, J, Y, w, O[G + 3], 14, -187363961)),
                  (w = N(w, H, J, Y, O[G + 8], 20, 1163531501)),
                  (Y = N(Y, w, H, J, O[G + 13], 5, -1444681467)),
                  (J = N(J, Y, w, H, O[G + 2], 9, -51403784)),
                  (H = N(H, J, Y, w, O[G + 7], 14, 1735328473)),
                  (w = N(w, H, J, Y, O[G + 12], 20, -1926607734)),
                  (Y = d(Y, w, H, J, O[G + 5], 4, -378558)),
                  (J = d(J, Y, w, H, O[G + 8], 11, -2022574463)),
                  (H = d(H, J, Y, w, O[G + 11], 16, 1839030562)),
                  (w = d(w, H, J, Y, O[G + 14], 23, -35309556)),
                  (Y = d(Y, w, H, J, O[G + 1], 4, -1530992060)),
                  (J = d(J, Y, w, H, O[G + 4], 11, 1272893353)),
                  (H = d(H, J, Y, w, O[G + 7], 16, -155497632)),
                  (w = d(w, H, J, Y, O[G + 10], 23, -1094730640)),
                  (Y = d(Y, w, H, J, O[G + 13], 4, 681279174)),
                  (J = d(J, Y, w, H, O[G], 11, -358537222)),
                  (H = d(H, J, Y, w, O[G + 3], 16, -722521979)),
                  (w = d(w, H, J, Y, O[G + 6], 23, 76029189)),
                  (Y = d(Y, w, H, J, O[G + 9], 4, -640364487)),
                  (J = d(J, Y, w, H, O[G + 12], 11, -421815835)),
                  (H = d(H, J, Y, w, O[G + 15], 16, 530742520)),
                  (w = d(w, H, J, Y, O[G + 2], 23, -995338651)),
                  (Y = L(Y, w, H, J, O[G], 6, -198630844)),
                  (J = L(J, Y, w, H, O[G + 7], 10, 1126891415)),
                  (H = L(H, J, Y, w, O[G + 14], 15, -1416354905)),
                  (w = L(w, H, J, Y, O[G + 5], 21, -57434055)),
                  (Y = L(Y, w, H, J, O[G + 12], 6, 1700485571)),
                  (J = L(J, Y, w, H, O[G + 3], 10, -1894986606)),
                  (H = L(H, J, Y, w, O[G + 10], 15, -1051523)),
                  (w = L(w, H, J, Y, O[G + 1], 21, -2054922799)),
                  (Y = L(Y, w, H, J, O[G + 8], 6, 1873313359)),
                  (J = L(J, Y, w, H, O[G + 15], 10, -30611744)),
                  (H = L(H, J, Y, w, O[G + 6], 15, -1560198380)),
                  (w = L(w, H, J, Y, O[G + 13], 21, 1309151649)),
                  (Y = L(Y, w, H, J, O[G + 4], 6, -145523070)),
                  (J = L(J, Y, w, H, O[G + 11], 10, -1120210379)),
                  (H = L(H, J, Y, w, O[G + 2], 15, 718787259)),
                  (w = L(w, H, J, Y, O[G + 9], 21, -343485551)),
                  (Y = k(Y, Q)),
                  (w = k(w, te)),
                  (H = k(H, oe)),
                  (J = k(J, ne)));
              }
              const Z = (G) => {
                let Q = "";
                for (let te = 0; te < 4; te++)
                  Q += ((G >>> (te * 8)) & 255).toString(16).padStart(2, "0");
                return Q;
              };
              return Z(Y) + Z(w) + Z(H) + Z(J);
            },
            T = (j) => {
              const k = F(j),
                X = k && k.TOKEN__;
              return typeof X == "string" && X.length > 8
                ? X.trim()
                : X && typeof X.value == "string"
                  ? X.value.trim()
                  : "";
            };
          let C =
            T(sessionStorage.getItem(P + "COMMON__SESSION__KEY__")) ||
            T(sessionStorage.getItem("COMMON__SESSION__KEY__"));
          if (!C)
            for (let j = 0; j < sessionStorage.length && !C; j++) {
              const k = sessionStorage.key(j);
              k &&
                /COMMON__SESSION__KEY__/i.test(k) &&
                (C = T(sessionStorage.getItem(k)));
            }
          if (!C) throw new Error("未找到 TOKEN__，请先登录");
          const M =
              String(
                F(localStorage.getItem(P + "U__U__I__D__CACHE__")) || "",
              ).trim() ||
              localStorage.getItem("__web_sdk_device_id__") ||
              "h5_console",
            x =
              String(
                (U(localStorage.getItem("__web_sdk_sid__")) || {}).sid || "",
              ).trim() ||
              sessionStorage.getItem("__foya_request_sid__") ||
              sessionStorage.getItem("sid") ||
              "0",
            a = navigator.userAgent || "",
            y =
              localStorage.getItem("H5_CHANNEL") ||
              localStorage.getItem("chCode") ||
              "",
            A = /Android/i.test(a)
              ? "Android"
              : /iPhone|iPad|iPod/i.test(a)
                ? "iOS"
                : "PC",
            $ = (j) =>
              K(this, null, function* () {
                var N, d, L;
                const k =
                  sessionStorage.getItem("__session_decrypt_key__") ||
                  localStorage.getItem("__session_decrypt_key__") ||
                  C.slice(2, 18);
                if (!k || k.length < 16) throw new Error("缺少解密 key");
                if ((N = window.CryptoJS) != null && N.AES) {
                  const B = window.CryptoJS,
                    O = B.enc.Base64.stringify(B.enc.Base64.parse(j)),
                    re = B.AES.decrypt(O, B.enc.Utf8.parse(k), {
                      iv: B.enc.Utf8.parse(k),
                      mode: B.mode.CBC,
                      padding: B.pad.Pkcs7,
                    }).toString(B.enc.Utf8);
                  return (d = U(re)) != null ? d : re;
                }
                const X = new TextEncoder().encode(k.slice(0, 16)),
                  R = yield crypto.subtle.importKey("raw", X, "AES-CBC", !1, [
                    "decrypt",
                  ]),
                  g = new TextDecoder().decode(
                    yield crypto.subtle.decrypt(
                      {
                        name: "AES-CBC",
                        iv: X,
                      },
                      R,
                      Uint8Array.from(atob(j), (B) => B.charCodeAt(0)),
                    ),
                  );
                return (L = U(g)) != null ? L : g;
              }),
            W = (j, k) =>
              K(this, null, function* () {
                const X = String(Date.now()),
                  R = ie(
                    {
                      Accept: "application/json, text/plain, */*",
                      t: X,
                      s: b(X.slice(3, 8)),
                      "User-Mark": "xhp",
                      deviceId: M,
                      device: A,
                      appVersion: p,
                      sid: x,
                      aut: C,
                    },
                    y
                      ? {
                          channel: y,
                        }
                      : {},
                  ),
                  g = yield fetch(
                    E +
                      j +
                      "?" +
                      new URLSearchParams(
                        se(ie({}, k), {
                          _t: String(Date.now()),
                        }),
                      ),
                    {
                      method: "GET",
                      headers: R,
                      credentials: "include",
                    },
                  );
                let N = yield g.json().catch(() => null);
                if (!N) throw new Error("非 JSON " + j + " HTTP " + g.status);
                const d =
                  N.code != null && String(N.code).trim() !== ""
                    ? Number(N.code)
                    : NaN;
                if (!Number.isNaN(d) && d !== 200)
                  throw new Error(
                    "业务码 " +
                      N.code +
                      " " +
                      j +
                      ": " +
                      (N.msg || N.message || ""),
                  );
                if (
                  (N.encData &&
                    (N = se(ie({}, N), {
                      data: yield $(N.encData),
                    })),
                  !g.ok)
                )
                  throw new Error("HTTP " + g.status + " " + j);
                return N.data !== void 0 ? N.data : N;
              }),
            q = (j) =>
              location.origin +
              "/api/m3u8/h5/decode?path=" +
              encodeURIComponent(String(j).trim()),
            l = (j, k, X) => {
              const R = new URLSearchParams({
                path: String(j).trim(),
                auth_key: k,
              });
              return (
                X != null && String(X).trim() && R.set("id", String(X).trim()),
                location.origin + "/api/m3u8/decode/authPath?" + R
              );
            };
          return S === "dynamic"
            ? (() =>
                K(this, null, function* () {
                  const j = yield W("/community/dynamic/dynamicInfo", {
                      dynamicId: v,
                    }),
                    k =
                      j != null && j.video
                        ? j
                        : j != null &&
                            j.data &&
                            (j.data.video || j.data.dynamicId)
                          ? j.data
                          : j,
                    X =
                      k != null && k.video && typeof k.video == "object"
                        ? k.video
                        : null,
                    R = String(
                      (X == null ? void 0 : X.videoUrl) ||
                        (k == null ? void 0 : k.videoUrl) ||
                        "",
                    ).trim();
                  if (!R) {
                    const g =
                      Number(
                        (k == null ? void 0 : k.price) ||
                          (k == null ? void 0 : k.gold) ||
                          0,
                      ) > 0 && !(k != null && k.isUnlock);
                    throw new Error(
                      g
                        ? "动态未解锁 dynamicId=" + v
                        : "动态无 videoUrl dynamicId=" + v,
                    );
                  }
                  return {
                    kind: "dynamic",
                    videoId: v,
                    videoUrl: R,
                    authKey: "",
                    playUrl: q(R),
                    canWatch: !0,
                  };
                }))()
            : (() =>
                K(this, null, function* () {
                  var N, d, L;
                  const [j, k] = yield Promise.all([
                      W("/video/can/watch", {
                        videoId: v,
                      }),
                      W("/video/getVideoById", {
                        videoId: v,
                      }).catch(() => null),
                    ]),
                    X =
                      (j == null ? void 0 : j.videoUrl) ||
                      (k == null ? void 0 : k.videoUrl) ||
                      (k == null ? void 0 : k.previewUrl) ||
                      "",
                    R = String(
                      (j == null ? void 0 : j.authKey) ||
                        (k == null ? void 0 : k.authKey) ||
                        "",
                    ).trim(),
                    g =
                      (L =
                        (N = k == null ? void 0 : k.cdnRes) == null
                          ? void 0
                          : N.id) != null
                        ? L
                        : (d = j == null ? void 0 : j.cdnRes) == null
                          ? void 0
                          : d.id;
                  if (!X) throw new Error("未拿到 videoUrl videoId=" + v);
                  return {
                    kind: "video",
                    videoId: v,
                    videoUrl: X,
                    authKey: R,
                    cdnId: g,
                    playUrl: R ? l(X, R, g) : q(X),
                    canWatch: !!(j != null && j.canWatch),
                  };
                }))();
        });
      }
      const i =
        ((h = location.pathname.match(/\/play\/(\d+)/i)) == null
          ? void 0
          : h[1]) ||
        ((s = new URLSearchParams(location.search).get("id")) == null
          ? void 0
          : s.trim()) ||
        "";
      if (i) {
        if (acfunSite1VideoUrl) {
          setTimeout(() => {
            t && t(acfunSite1VideoUrl);
          }, 500);
          return;
        }
        e(i, "video")
          .then((f) => {
            (log("_fetchFromAcfun suc1：", f),
              f.playUrl &&
                f.playUrl.includes(".m3u8") &&
                ((acfunSite1VideoUrl = f.playUrl),
                setTimeout(() => {
                  t && t(f.playUrl);
                }, 500)));
          })
          .catch((f) => {
            log("_fetchFromAcfun error：", i, f == null ? void 0 : f.message);
          });
        return;
      }
      const o = r == null ? void 0 : r.node,
        n =
          ((c = String(
            ((u = o == null ? void 0 : o.getAttribute) == null
              ? void 0
              : u.call(o, "title")) ||
              (o == null ? void 0 : o.title) ||
              "",
          ).match(/dynamic-video-(\d+)/i)) == null
            ? void 0
            : c[1]) || "";
      if (n) {
        if (acfunSite2VideoReq.includes(n)) {
          const f = acfunSite2VideoUrl.find((_) => _.dynamicId === n);
          f && t && t(f.playUrl);
          return;
        }
        (acfunSite2VideoReq.push(n),
          e(n, "dynamic")
            .then((f) => {
              (log("_fetchFromAcfun suc2：", f),
                f.playUrl &&
                  f.playUrl.includes(".m3u8") &&
                  (acfunSite2VideoUrl.push({
                    dynamicId: n,
                    playUrl: f.playUrl,
                  }),
                  t && t(f.playUrl)));
            })
            .catch((f) => {
              log("_fetchFromAcfun error：", n, f == null ? void 0 : f.message);
            }));
      }
    });
  }
  function fetchFromAcfunAI(t, r) {
    return K(this, null, function* () {
      log("_fetchFromAcfunAI start");
      function e() {
        return K(this, null, function* () {
          var a, y, A, $, W;
          const i = String(
            new URLSearchParams(location.search).get("id") || "",
          ).trim();
          if (!/^\d+$/.test(i)) throw new Error("需要 URL ?id=");
          const o = window.__PRODUCTION__SI_RI_ACFUN__CONF__ || {},
            n =
              String(o.VITE_GLOB_API_URL || "/api").replace(/\/+$/, "") ||
              "/api",
            h = String(o.VITE_GLOB_APP_VERSION || "1.9.6"),
            s = (
              String(o.VITE_GLOB_APP_SHORT_NAME || "si_ri_acfun") +
              "__production__" +
              h +
              "__"
            ).toUpperCase(),
            u = (q) => {
              try {
                return JSON.parse(q);
              } catch (l) {
                return null;
              }
            },
            c = (q, l) => {
              const D = u(q.getItem(l));
              return D && D.value !== void 0 ? D.value : D;
            },
            f = (q) => {
              var Y;
              if ((Y = window.CryptoJS) != null && Y.MD5)
                return window.CryptoJS.MD5(String(q)).toString();
              const l = (w, H) => {
                  const J = (w & 65535) + (H & 65535);
                  return (
                    (((w >> 16) + (H >> 16) + (J >> 16)) << 16) | (J & 65535)
                  );
                },
                D = (w, H) => (w << H) | (w >>> (32 - H)),
                V = (w, H, J, Z, ee, G) => l(D(l(l(H, w), l(Z, G)), ee), J),
                z = (w, H, J, Z, ee, G, Q) =>
                  V((H & J) | (~H & Z), w, H, ee, G, Q),
                j = (w, H, J, Z, ee, G, Q) =>
                  V((H & Z) | (J & ~Z), w, H, ee, G, Q),
                k = (w, H, J, Z, ee, G, Q) => V(H ^ J ^ Z, w, H, ee, G, Q),
                X = (w, H, J, Z, ee, G, Q) => V(J ^ (H | ~Z), w, H, ee, G, Q),
                R = unescape(encodeURIComponent(String(q))),
                g = [];
              for (let w = 0; w < R.length * 8; w += 8)
                g[w >> 5] |= (R.charCodeAt(w / 8) & 255) << (w % 32);
              const N = R.length * 8;
              ((g[N >> 5] |= 128 << (N % 32)),
                (g[(((N + 64) >>> 9) << 4) + 14] = N));
              let d = 1732584193,
                L = -271733879,
                B = -1732584194,
                O = 271733878;
              for (let w = 0; w < g.length; w += 16) {
                const [H, J, Z, ee] = [d, L, B, O];
                ((d = z(d, L, B, O, g[w], 7, -680876936)),
                  (O = z(O, d, L, B, g[w + 1], 12, -389564586)),
                  (B = z(B, O, d, L, g[w + 2], 17, 606105819)),
                  (L = z(L, B, O, d, g[w + 3], 22, -1044525330)),
                  (d = z(d, L, B, O, g[w + 4], 7, -176418897)),
                  (O = z(O, d, L, B, g[w + 5], 12, 1200080426)),
                  (B = z(B, O, d, L, g[w + 6], 17, -1473231341)),
                  (L = z(L, B, O, d, g[w + 7], 22, -45705983)),
                  (d = z(d, L, B, O, g[w + 8], 7, 1770035416)),
                  (O = z(O, d, L, B, g[w + 9], 12, -1958414417)),
                  (B = z(B, O, d, L, g[w + 10], 17, -42063)),
                  (L = z(L, B, O, d, g[w + 11], 22, -1990404162)),
                  (d = z(d, L, B, O, g[w + 12], 7, 1804603682)),
                  (O = z(O, d, L, B, g[w + 13], 12, -40341101)),
                  (B = z(B, O, d, L, g[w + 14], 17, -1502002290)),
                  (L = z(L, B, O, d, g[w + 15], 22, 1236535329)),
                  (d = j(d, L, B, O, g[w + 1], 5, -165796510)),
                  (O = j(O, d, L, B, g[w + 6], 9, -1069501632)),
                  (B = j(B, O, d, L, g[w + 11], 14, 643717713)),
                  (L = j(L, B, O, d, g[w], 20, -373897302)),
                  (d = j(d, L, B, O, g[w + 5], 5, -701558691)),
                  (O = j(O, d, L, B, g[w + 10], 9, 38016083)),
                  (B = j(B, O, d, L, g[w + 15], 14, -660478335)),
                  (L = j(L, B, O, d, g[w + 4], 20, -405537848)),
                  (d = j(d, L, B, O, g[w + 9], 5, 568446438)),
                  (O = j(O, d, L, B, g[w + 14], 9, -1019803690)),
                  (B = j(B, O, d, L, g[w + 3], 14, -187363961)),
                  (L = j(L, B, O, d, g[w + 8], 20, 1163531501)),
                  (d = j(d, L, B, O, g[w + 13], 5, -1444681467)),
                  (O = j(O, d, L, B, g[w + 2], 9, -51403784)),
                  (B = j(B, O, d, L, g[w + 7], 14, 1735328473)),
                  (L = j(L, B, O, d, g[w + 12], 20, -1926607734)),
                  (d = k(d, L, B, O, g[w + 5], 4, -378558)),
                  (O = k(O, d, L, B, g[w + 8], 11, -2022574463)),
                  (B = k(B, O, d, L, g[w + 11], 16, 1839030562)),
                  (L = k(L, B, O, d, g[w + 14], 23, -35309556)),
                  (d = k(d, L, B, O, g[w + 1], 4, -1530992060)),
                  (O = k(O, d, L, B, g[w + 4], 11, 1272893353)),
                  (B = k(B, O, d, L, g[w + 7], 16, -155497632)),
                  (L = k(L, B, O, d, g[w + 10], 23, -1094730640)),
                  (d = k(d, L, B, O, g[w + 13], 4, 681279174)),
                  (O = k(O, d, L, B, g[w], 11, -358537222)),
                  (B = k(B, O, d, L, g[w + 3], 16, -722521979)),
                  (L = k(L, B, O, d, g[w + 6], 23, 76029189)),
                  (d = k(d, L, B, O, g[w + 9], 4, -640364487)),
                  (O = k(O, d, L, B, g[w + 12], 11, -421815835)),
                  (B = k(B, O, d, L, g[w + 15], 16, 530742520)),
                  (L = k(L, B, O, d, g[w + 2], 23, -995338651)),
                  (d = X(d, L, B, O, g[w], 6, -198630844)),
                  (O = X(O, d, L, B, g[w + 7], 10, 1126891415)),
                  (B = X(B, O, d, L, g[w + 14], 15, -1416354905)),
                  (L = X(L, B, O, d, g[w + 5], 21, -57434055)),
                  (d = X(d, L, B, O, g[w + 12], 6, 1700485571)),
                  (O = X(O, d, L, B, g[w + 3], 10, -1894986606)),
                  (B = X(B, O, d, L, g[w + 10], 15, -1051523)),
                  (L = X(L, B, O, d, g[w + 1], 21, -2054922799)),
                  (d = X(d, L, B, O, g[w + 8], 6, 1873313359)),
                  (O = X(O, d, L, B, g[w + 15], 10, -30611744)),
                  (B = X(B, O, d, L, g[w + 6], 15, -1560198380)),
                  (L = X(L, B, O, d, g[w + 13], 21, 1309151649)),
                  (d = X(d, L, B, O, g[w + 4], 6, -145523070)),
                  (O = X(O, d, L, B, g[w + 11], 10, -1120210379)),
                  (B = X(B, O, d, L, g[w + 2], 15, 718787259)),
                  (L = X(L, B, O, d, g[w + 9], 21, -343485551)),
                  (d = l(d, H)),
                  (L = l(L, J)),
                  (B = l(B, Z)),
                  (O = l(O, ee)));
              }
              const re = (w) => {
                let H = "";
                for (let J = 0; J < 4; J++)
                  H += ((w >>> (J * 8)) & 255).toString(16).padStart(2, "0");
                return H;
              };
              return re(d) + re(L) + re(B) + re(O);
            },
            S = (c(sessionStorage, s + "COMMON__SESSION__KEY__") || {}).TOKEN__,
            v = (
              typeof S == "string" ? S : (S == null ? void 0 : S.value) || ""
            ).trim();
          if (!v) throw new Error("未找到 TOKEN__，请先登录");
          const I =
              String(c(localStorage, s + "U__U__I__D__CACHE__") || "").trim() ||
              "h5_console",
            E =
              String(
                (u(localStorage.getItem("__web_sdk_sid__")) || {}).sid || "",
              ).trim() || "0",
            p = navigator.userAgent || "",
            P = /Android/i.test(p)
              ? "Android"
              : /iPhone|iPad|iPod/i.test(p)
                ? "iOS"
                : "PC",
            U =
              localStorage.getItem("H5_CHANNEL") ||
              localStorage.getItem("chCode") ||
              "";
          let b = yield ((q, l) =>
            K(this, null, function* () {
              var X;
              const D = String(Date.now()),
                V = ie(
                  {
                    Accept: "application/json, text/plain, */*",
                    t: D,
                    s: f(D.slice(3, 8)),
                    "User-Mark": "xhp",
                    deviceId: I,
                    device: P,
                    appVersion: h,
                    sid: E,
                    aut: v,
                  },
                  U
                    ? {
                        channel: U,
                      }
                    : {},
                ),
                z = yield fetch(
                  n +
                    q +
                    "?" +
                    new URLSearchParams(
                      se(ie({}, l), {
                        _t: D,
                      }),
                    ),
                  {
                    method: "GET",
                    headers: V,
                    credentials: "include",
                  },
                );
              let j = yield z.json().catch(() => null);
              if (!j) throw new Error("非 JSON " + q);
              const k =
                j.code != null && String(j.code).trim() !== ""
                  ? Number(j.code)
                  : NaN;
              if (!Number.isNaN(k) && k !== 200)
                throw new Error("业务码 " + j.code + ": " + (j.msg || ""));
              if (j.encData) {
                const R =
                    sessionStorage.getItem("__session_decrypt_key__") ||
                    localStorage.getItem("__session_decrypt_key__") ||
                    v.slice(2, 18),
                  g = new TextEncoder().encode(R.slice(0, 16)),
                  N = yield crypto.subtle.importKey("raw", g, "AES-CBC", !1, [
                    "decrypt",
                  ]),
                  d = new TextDecoder().decode(
                    yield crypto.subtle.decrypt(
                      {
                        name: "AES-CBC",
                        iv: g,
                      },
                      N,
                      Uint8Array.from(atob(j.encData), (L) => L.charCodeAt(0)),
                    ),
                  );
                j = se(ie({}, j), {
                  data: (X = u(d)) != null ? X : d,
                });
              }
              if (!z.ok) throw new Error("HTTP " + z.status);
              return j.data !== void 0 ? j.data : j;
            }))("/aiboxNew/square/detail", {
            id: i,
          });
          b != null &&
            b.data &&
            (b.data.playPath || b.data.squareId != null) &&
            (b = b.data);
          const T = String(
              (b == null ? void 0 : b.playPath) ||
                ((a = b == null ? void 0 : b.video) == null
                  ? void 0
                  : a.videoUrl) ||
                (b == null ? void 0 : b.videoUrl) ||
                "",
            ).trim(),
            C = String(
              (b == null ? void 0 : b.authKey) ||
                ((y = b == null ? void 0 : b.video) == null
                  ? void 0
                  : y.authKey) ||
                "",
            ).trim(),
            M =
              (W =
                (A = b == null ? void 0 : b.cdnRes) == null ? void 0 : A.id) !=
              null
                ? W
                : ($ = b == null ? void 0 : b.video) == null
                  ? void 0
                  : $.id;
          if (!T || !C || M == null || String(M).trim() === "")
            throw new Error("缺 playPath/authKey/cdnRes.id（id=" + i + "）");
          const x =
            location.origin +
            "/api/m3u8/decode/authPath?" +
            new URLSearchParams({
              path: T,
              auth_key: C,
              id: String(M).trim(),
            });
          return {
            id: i,
            playPath: T,
            authKey: C,
            cdnId: M,
            playUrl: x,
          };
        });
      }
      e()
        .then((i) => {
          (log("_fetchFromAcfunAI suc：", i),
            i.playUrl && i.playUrl.includes(".m3u8") && t && t(i.playUrl));
        })
        .catch((i) => {
          log("_fetchFromAcfunAI error：", i == null ? void 0 : i.message);
        });
    });
  }
  function fetchFromYJ(cb) {
    return K(this, null, function* () {
      try {
        log("_fetchFromYJ start");
        const group = eval("Group");
        if (!group || !group.novel_domain)
          throw new Error("需要 Group.novel_domain / Group.csstime");
        const m = String(location.href).match(/\/video\/(\d+)(?:\.htm)?/i),
          video_id = m ? m[1] : "";
        if (!video_id)
          throw new Error(
            "需要从 location.href 解析 video_id，如 /video/52576.htm",
          );
        const csstime = group.csstime != null ? String(group.csstime) : "",
          jsonUrl = "/video/" + video_id + ".json?" + csstime,
          resp = yield fetch(jsonUrl, {
            credentials: "include",
          });
        if (!resp.ok) throw new Error("HTTP " + resp.status + " " + jsonUrl);
        const data = yield resp.json(),
          serial_number = data && data.video && data.video.serial_number;
        if (!serial_number)
          throw new Error("未返回 video.serial_number：" + jsonUrl);
        const m3u8Url =
            group.novel_domain +
            "/m3u8/" +
            serial_number +
            "/index_domain.m3u8?" +
            csstime,
          result = {
            video_id,
            serial_number,
            m3u8Url,
            jsonUrl,
          };
        (log("_fetchFromYJ suc：", result), cb && cb(m3u8Url));
      } catch (t) {
        log("_fetchFromYJ error：", t == null ? void 0 : t.message);
      }
    });
  }
  function fetchFromGD(t) {
    return K(this, null, function* () {
      try {
        log("_fetchFromGD start");
        const r = String(location.pathname || "").match(/\/video\/(\d+)/),
          e = r && r[1];
        if (!e)
          throw new Error(
            "无法从 location 解析 video id，期望路径含 /video/{数字}",
          );
        const i = location.origin,
          o = i + "/apiv2/video/" + e,
          n = yield fetch(o);
        if (!n.ok) throw new Error("HTTP " + n.status + " " + o);
        const h = yield n.json();
        if (!h || String(h.code) !== "10000")
          throw new Error("接口失败: " + ((h && h.msg) || "unknown"));
        const s = h.data || {},
          u = Array.isArray(s.movie_m3u8_url) ? s.movie_m3u8_url : [];
        let c = "";
        for (let f = 0; f < u.length; f++) {
          const S = ((u[f] || {}).url || "").trim();
          if (S) {
            c = S.indexOf("http") === 0 ? S : i + S;
            break;
          }
        }
        if (!c) throw new Error("movie_m3u8_url 无可用 url（可能需登录/VIP）");
        (log("_fetchFromGD suc：", s), t && t(c));
      } catch (r) {
        log("_fetchFromGD error：", r == null ? void 0 : r.message);
      }
    });
  }
  function fetchFromAGE(t) {
    return K(this, null, function* () {
      log("_fetchFromAGE start");
      function r() {
        return K(this, null, function* () {
          const e = "https://api.agedm.io/v2/detail/",
            i = "https://jx.wuzhoupai.com:8443/m3u8/?url=",
            o = (x) => {
              const a = String(x || "").match(
                /var\s+Vurl\s*=\s*['"]([^'"]+)['"]/i,
              );
              return (a && a[1]) || "";
            },
            n = (x, a) =>
              K(this, null, function* () {
                const y = yield fetch(x);
                if (!y.ok) throw new Error("拉解析页 HTTP " + y.status);
                const A = o(yield y.text());
                if (!A) throw new Error("解析页缺少 Vurl");
                if (!/^https?:\/\//i.test(A)) return null;
                const $ = A.toLowerCase();
                return ie(
                  {
                    playUrl: A,
                    type: $.includes(".m3u8")
                      ? "m3u8"
                      : $.includes(".mp4")
                        ? "mp4"
                        : String(x).includes("/m3u8")
                          ? "m3u8"
                          : "",
                    playerUrl: x,
                    from: "parser-Vurl",
                  },
                  a || {},
                );
              }),
            h = () => {
              const x = [];
              document
                .querySelectorAll("#page-play, #app, .app-wapper")
                .forEach((A) => {
                  A.__vue__ && x.push(A.__vue__);
                });
              const a = new Set(),
                y = x.slice();
              for (; y.length;) {
                const A = y.shift();
                if (!A || a.has(A)) continue;
                if (
                  (a.add(A),
                  A.video &&
                    (A.video.PlayerUrls || A.video.playlists) &&
                    (A.AID != null || A.e != null))
                )
                  return A;
                const W = A.$children || [];
                for (let q = 0; q < W.length; q++) y.push(W[q]);
              }
              return null;
            },
            s = () => {
              const x =
                  document.querySelector(
                    '.video-source-box .van-tab__pane:not([style*="display: none"]) .van-grid-item--active .van-grid-item__text',
                  ) ||
                  document.querySelector(
                    ".video-source-box .van-grid-item--active .van-grid-item__text",
                  ),
                a = ((x && x.textContent) || "").match(/(\d+)/);
              return a ? Math.max(1, parseInt(a[1], 10)) : 0;
            },
            u = (x) =>
              new Set(
                Array.isArray(x)
                  ? x
                  : String(x || "")
                      .split(",")
                      .filter(Boolean),
              ),
            c =
              document.querySelector(
                "#playerIFrame iframe.embed-responsive-item",
              ) ||
              document.querySelector('iframe[src*="/m3u8/"]') ||
              document.querySelector('iframe[src*="/vip/"]'),
            f = (c && c.src) || "";
          if (/\/m3u8\/?\?/i.test(f)) {
            const x = yield n(f, {
              line: "iframe-m3u8",
            });
            if (x) return x;
          }
          const _ = String(location.href).match(
              /\/play\/([^/?#]+)\/(\d+)\/(\d+)/i,
            ),
            S = h();
          let v = _ ? decodeURIComponent(_[1]) : "",
            I = _ ? Math.max(1, parseInt(_[3], 10) || 1) : 1,
            E = "href",
            p = null,
            P = {},
            U = new Set(),
            F = "";
          if (
            (S &&
              (S.AID != null && S.AID !== "" && (v = String(S.AID)),
              (p = S.video.PlayerUrls || S.video.playlists || null),
              (P = S.playerJx || {}),
              (U = u(S.playerVip)),
              S.e != null &&
                Number(S.e) > 0 &&
                ((I = Math.max(1, Number(S.e))), (E = "vue.e")),
              p &&
                S.l != null &&
                (F =
                  Object.keys(p).filter(
                    (a) => Array.isArray(p[a]) && p[a].length,
                  )[Number(S.l)] || "")),
            E === "href")
          ) {
            const x = s();
            x > 0 && ((I = x), (E = "dom-active"));
          }
          if (!p) {
            if (!v)
              throw new Error("无 AID / playlists，href=" + location.href);
            const x = yield fetch(e + encodeURIComponent(v), {
              headers: {
                Accept: "application/json",
              },
            });
            if (!x.ok) throw new Error("detail API HTTP " + x.status);
            const a = yield x.json();
            ((p = (a.video && a.video.playlists) || {}),
              (P = a.player_jx || {}),
              (U = u(a.player_vip)));
          }
          const b = Object.keys(p);
          if (!b.length) throw new Error("无 playlists");
          if (!F) {
            const x = _ ? Math.max(1, parseInt(_[2], 10) || 1) : 1;
            F = b[x - 1] || b[0];
          }
          const T = P.zj || i;
          let C = b.filter((x) => !U.has(x));
          if (!C.length)
            throw new Error("仅有 VIP 线（/vip/），无法取直链。aid=" + v);
          C.indexOf(F) > 0 && (C = [F].concat(C.filter((x) => x !== F)));
          const M = [];
          for (let x = 0; x < C.length; x++) {
            const a = C[x],
              y = p[a];
            if (!Array.isArray(y) || !y.length) continue;
            const A = y[Math.min(I, y.length) - 1] || y[0],
              $ = Array.isArray(A) ? A[1] : "";
            if ($)
              try {
                const W = yield n(T + $, {
                  line: a,
                  aid: v,
                  epIndex: I,
                  epSource: E,
                  epTitle: Array.isArray(A) ? A[0] : "",
                });
                if (W) return W;
                M.push(a + ": Vurl 非直链");
              } catch (W) {
                M.push(a + ": " + (W && W.message ? W.message : W));
              }
          }
          throw new Error(
            "未取到直链。aid=" +
              v +
              " ep=" +
              I +
              "(" +
              E +
              ")；" +
              M.slice(0, 5).join("; "),
          );
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromAGE suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromAGE error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFrom18AV(t) {
    return K(this, null, function* () {
      log("_fetchFrom18AV start");
      function r() {
        return K(this, null, function* () {
          const e = document.querySelector(
            "iframe[id*='iframe'][src*='play.php']",
          );
          let i = (e && e.src) || "";
          if ((i.startsWith("//") && (i = "https:" + i), !i))
            throw new Error("未找到 play.php iframe");
          const o = yield fetch(i, {
            credentials: "include",
          });
          if (!o.ok) throw new Error("play.php HTTP " + o.status);
          const s = [
            ...(
              ((yield o.text()).match(/videoSources\s*=\s*\[([\s\S]*?)\];/) ||
                [])[1] || ""
            ).matchAll(/src:\s*['"]([^'"]+)['"][\s\S]*?size:\s*(\d+)/g),
          ].map((f) => ({
            src: f[1].startsWith("//") ? "https:" + f[1] : f[1],
            size: +f[2],
          }));
          if (!s.length) throw new Error("play.php 无 videoSources");
          const u = +new URL(i).searchParams.get("numresolution") || 0,
            c =
              s.find((f) => f.size === u) ||
              s.reduce((f, _) => (_.size > f.size ? _ : f));
          return {
            playUrl: c.src,
            size: c.size,
            sources: s,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFrom18AV suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFrom18AV error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromDYDS(t) {
    return K(this, null, function* () {
      log("_fetchFromDYDS start");
      function r() {
        return K(this, null, function* () {
          var f, _, S, v;
          const e = new URLSearchParams(location.search),
            i = e.get("source"),
            o = e.get("id");
          if (!i || !o) throw new Error("缺少 source 或 id");
          const n = yield fetch(
              `./backend/api/public/detail.php?${new URLSearchParams({
                source: i,
                id: o,
              })}`,
              {
                credentials: "omit",
              },
            ),
            { success: h, message: s, data: u } = yield n.json();
          if (!n.ok || !h) throw new Error(s || "detail 失败");
          const c =
            (v =
              (S =
                (_ =
                  (f = u == null ? void 0 : u.play_sources) == null
                    ? void 0
                    : f[+e.get("route") || 0]) == null
                  ? void 0
                  : _.episodes) == null
                ? void 0
                : S[+e.get("episode") || 0]) == null
              ? void 0
              : v.url;
          if (!c) throw new Error("未找到播放地址");
          return {
            playUrl: c,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromDYDS suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromDYDS error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromMFKP(t) {
    return K(this, null, function* () {
      log("_fetchFromMFKP start");
      function r() {
        return K(this, null, function* () {
          var c;
          const e = new URLSearchParams(location.search).get("id");
          if (!e) throw new Error("缺少 id");
          typeof CryptoJS > "u" &&
            (yield new Promise((f, _) => {
              const S = document.createElement("script");
              ((S.src =
                "https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js"),
                (S.onload = f),
                (S.onerror = () => _(new Error("crypto-js 加载失败"))),
                document.head.appendChild(S));
            }));
          const { issmssgUrl: i } = yield (yield fetch(
            "/static/config.json",
          )).json();
          if (!i) throw new Error("无 issmssgUrl");
          const o = (yield (yield fetch(
              `${i.replace(/\/$/, "")}/api/video/detail?vid=${e}`,
            )).text()).trim(),
            {
              code: n,
              msg: h,
              data: s,
            } = JSON.parse(
              CryptoJS.AES.decrypt(
                {
                  ciphertext: CryptoJS.enc.Base64.parse(o),
                },
                CryptoJS.enc.Utf8.parse("=^%7@84%0^!8892-"),
                {
                  mode: CryptoJS.mode.ECB,
                  padding: CryptoJS.pad.Pkcs7,
                },
              ).toString(CryptoJS.enc.Utf8),
            );
          if (String(n) !== "1") throw new Error(h || "detail 失败");
          const u =
            (c = s == null ? void 0 : s.video) == null ? void 0 : c.play_url;
          if (!u) throw new Error("无 play_url");
          return {
            playUrl: u,
            playUrl2: s.video.play_url2 || null,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromMFKP suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromMFKP error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromAVHAI(t) {
    return K(this, null, function* () {
      log("_fetchFromAVHAI start");
      function r() {
        return K(this, null, function* () {
          var e;
          try {
            const i = (location.pathname.match(/\/movies\/([^/?#]+)/) || [])[1];
            if (!i) throw new Error("缺少 /movies/:code");
            const o = yield (yield fetch(
              "/api/movies/" + encodeURIComponent(i),
            )).json();
            if (o.code !== 200) throw new Error(o.message || "movies 失败");
            const n =
                o.crypted === 1
                  ? JSON.parse(decodeURIComponent(atob(o.data)))
                  : o.data,
              h =
                (e = ((n == null ? void 0 : n.videos) || []).find(
                  (s) =>
                    (s == null ? void 0 : s.type) === "UrlHls" ||
                    /\.m3u8(\?|$)/i.test((s == null ? void 0 : s.value) || ""),
                )) == null
                  ? void 0
                  : e.value;
            if (!h) throw new Error("无 m3u8");
            return {
              playUrl: h,
            };
          } catch (i) {
            throw new Error(i && i.message ? i.message : String(i));
          }
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromAVHAI suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromAVHAI error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromSae8(t) {
    return K(this, null, function* () {
      log("_fetchFromSae8 start");
      function r() {
        return K(this, null, function* () {
          try {
            const e = (location.pathname.match(/\/movie\/([a-f0-9]+)/i) ||
              [])[1];
            if (!e) throw new Error("缺少 /movie/:id");
            const o = yield (yield fetch(
              `/api/getmovie?type=640&id=${encodeURIComponent(e)}`,
              {
                credentials: "include",
              },
            )).json();
            if (!o.m3u8) throw new Error(o.message || "无 m3u8");
            return {
              playUrl: /^https?:\/\//i.test(o.m3u8)
                ? o.m3u8
                : new URL(o.m3u8, location.origin).href,
            };
          } catch (e) {
            throw new Error(e && e.message ? e.message : String(e));
          }
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromSae8 suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromSae8 error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromTvSmart(t) {
    return K(this, null, function* () {
      log("_fetchFromTvSmart start");
      function r() {
        return K(this, null, function* () {
          var e, i;
          try {
            const o =
              ((i =
                (e = document.querySelector(".channel-card.active")) == null
                  ? void 0
                  : e.dataset) == null
                ? void 0
                : i.streamId) || "";
            if (!o) throw new Error("无正在播放频道（.channel-card.active）");
            const n = (c) => {
                let f = 2166136261;
                const _ = String(c || "");
                for (let S = 0; S < _.length; S++)
                  ((f ^= _.charCodeAt(S)), (f = Math.imul(f, 16777619)));
                return "s" + (f >>> 0).toString(36);
              },
              h = [
                "https://aapiiiiii.globalhub.cc:2096/api",
                "https://score.mty-bonus.com/api",
              ];
            let s = null,
              u = null;
            for (const c of h)
              try {
                const f = yield fetch(c + "/streams?_=" + Date.now(), {
                  cache: "no-store",
                  headers: {
                    Accept: "application/json",
                  },
                });
                if (!f.ok) throw new Error("HTTP " + f.status);
                s = yield f.json();
                break;
              } catch (f) {
                u = f;
              }
            if (!s) throw u || new Error("Worker API 不可用");
            for (const c of Object.values(s.sources || {})) {
              const f = (c && c.text) || "";
              for (const _ of String(f).split(/\r?\n/)) {
                const S = _.trim();
                if (!S || S.startsWith("#")) continue;
                const v = S.indexOf(",");
                if (v < 0) continue;
                const I = S.slice(v + 1).trim();
                if (I === "#genre#") continue;
                let E = "";
                try {
                  const p = new URL(I);
                  ((p.hash = ""), (E = p.href));
                } catch (p) {
                  continue;
                }
                if (
                  !(!/^https:/i.test(E) || !/\.m3u8?(?:$|[?#])/i.test(E)) &&
                  n(E) === o
                )
                  return {
                    playUrl: E,
                  };
              }
            }
            throw new Error("未匹配到 active streamId 的 m3u8");
          } catch (o) {
            throw new Error(o && o.message ? o.message : String(o));
          }
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromTvSmart suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromTvSmart error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFrom17(t) {
    return K(this, null, function* () {
      log("_fetchFrom17 start");
      function r() {
        return K(this, null, function* () {
          const e = (location.pathname.match(/\/lessons\/(\d+)/) || [])[1];
          if (!e) throw new Error("无 lesson id");
          const i = document.querySelector(
              'script[type="module"][src*="/assets/"]',
            ),
            o = (i && i.src) || i.getAttribute("src");
          if (!o) throw new Error("未找到 /assets 入口模块");
          const n = yield import(o);
          if (typeof n.c != "function")
            throw new Error("入口模块无 api export c");
          const h = yield n.c("/api/v1/courses/" + e);
          if (!h || h.code !== 0 || !h.data)
            throw new Error((h && h.message) || "获取电影详情失败");
          typeof n.d == "function" && n.d(h.data);
          let s = h.data.videoPath;
          if (!s || typeof s != "string") throw new Error("无 videoPath");
          try {
            const u = n.K && n.K.CDN_FAILOVER,
              c = u && typeof n.g == "function" && n.g(u),
              f = c && JSON.parse(c).videos.active;
            if (f) {
              const _ = new URL(s),
                S = new URL(String(f).includes("://") ? f : "https://" + f);
              ((_.protocol = S.protocol),
                (_.hostname = S.hostname),
                (s = _.toString()));
            }
          } catch (u) {}
          if (!isEndWithVideoTwo(s)) throw new Error("非 mp4/m3u8");
          return {
            playUrl: s,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFrom17 suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFrom17 error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFrom618010(t) {
    return K(this, null, function* () {
      log("_fetchFrom618010 start");
      function r() {
        return K(this, null, function* () {
          const e = new URLSearchParams(location.search),
            i = e.get("m") || "",
            o = e.get("v") || "";
          let n = "";
          if (i)
            try {
              const h = yield fetch(
                "https://h5.xxoo475.org/api/v2/vod/reqplay/" + i,
                {
                  signal: AbortSignal.timeout(5e3),
                },
              );
              if (!h.ok) throw new Error("reqplay HTTP " + h.status);
              const s = yield h.json(),
                u =
                  s.retcode === 3
                    ? s.data && s.data.httpurl_preview
                    : s.data && s.data.httpurl;
              if (!u) throw new Error("reqplay 无 httpurl");
              n = String(u).replace("?300", "");
            } catch (h) {
              const s = h && h.name;
              throw s === "TimeoutError" || s === "AbortError"
                ? new Error("请求超时")
                : new Error((h && h.message) || "请求失败");
            }
          else o && (n = o);
          if (!n) throw new Error("无 v/m");
          if (!isEndWithVideoTwo(n)) throw new Error("非 mp4/m3u8");
          return Promise.resolve({
            playUrl: n,
          });
        });
      }
      r()
        .then((e) => {
          (log("_fetchFrom618010 suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFrom618010 error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromXiuse(t) {
    return K(this, null, function* () {
      log("_fetchFromXiuse start");
      function r() {
        return K(this, null, function* () {
          const e = (location.pathname.match(/\/video\/(\d+)/) || [])[1];
          if (!e) throw new Error("无 video_id");
          const i = window.Group;
          if (!i || !i.novel_domain) throw new Error("无 Group.novel_domain");
          const o = yield fetch("/video/" + e + ".json?" + i.csstime, {
            signal: AbortSignal.timeout(5e3),
          });
          if (!o.ok) throw new Error("video.json HTTP " + o.status);
          const n = yield o.json(),
            h = n.video && n.video.serial_number;
          if (!h) throw new Error("无 serial_number");
          const s =
            i.novel_domain + "/m3u8/" + h + "/index_domain.m3u8?" + i.csstime;
          if (!/\.m3u8(\?|$)/i.test(s)) throw new Error("非 m3u8");
          return {
            playUrl: s,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromXiuse suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromXiuse error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromHuMao(t) {
    return K(this, null, function* () {
      log("_fetchFromHuMao start");
      function r() {
        return K(this, null, function* () {
          const i = new URLSearchParams(
            location.hash.split("?")[1] || location.search.replace(/^\?/, ""),
          ).get("vodId");
          if (!i) throw new Error("无 vodId");
          const o = "f6322fa1c064370ea40c8cdc20649f8e",
            n = (U) => {
              const F = U.length / 2,
                b = new Uint8Array(F);
              for (let T = 0; T < F; T++)
                b[T] = parseInt(U.substr(2 * T, 2), 16);
              return b;
            },
            h = (U) =>
              K(this, null, function* () {
                const F = Uint8Array.from(atob(String(U).trim()), (C) =>
                  C.charCodeAt(0),
                );
                if (F.length < 17) throw new Error("密文过短");
                const b = yield crypto.subtle.importKey(
                    "raw",
                    n(o),
                    {
                      name: "AES-CBC",
                    },
                    !1,
                    ["decrypt"],
                  ),
                  T = yield crypto.subtle.decrypt(
                    {
                      name: "AES-CBC",
                      iv: F.slice(0, 16),
                    },
                    b,
                    F.slice(16),
                  );
                return JSON.parse(new TextDecoder().decode(T));
              }),
            s = (U) =>
              K(this, null, function* () {
                const F = localStorage.getItem("accessToken") || "",
                  b = {
                    Accept: "application/json",
                  };
                F && (b.Authorization = "Bearer " + F);
                const C = yield (yield fetch(U, {
                  headers: b,
                  credentials: "include",
                  signal: AbortSignal.timeout(8e3),
                })).text();
                let M;
                try {
                  M = JSON.parse(C);
                } catch (x) {
                  M = yield h(C);
                }
                return (
                  M &&
                    typeof M.data == "string" &&
                    M.data.length > 100 &&
                    (M.data = yield h(M.data)),
                  M
                );
              }),
            u = (U, F) => {
              if (!U) return "";
              if (/^https?:\/\//i.test(U) || U.includes("auth_key=")) return U;
              const b = String(F || "").replace(/\/$/, "");
              return b ? b + (U.startsWith("/") ? U : "/" + U) : U;
            },
            c = yield s(
              "/api/vod/detail-signed/" +
                encodeURIComponent(i) +
                "?algorithm=md5",
            );
          if (!c || c.code !== 200 || !c.data)
            throw new Error((c && c.msg) || "detail-signed 失败");
          const f = c.data,
            _ = f.vodPlay && typeof f.vodPlay == "object" ? f.vodPlay : null;
          let S = null;
          _ && (S = _.maohu_player || _[Object.keys(_)[0]]);
          const v = Array.isArray(S) ? S : [],
            I = (v.find((U) => U && U.flag === "transcoded") || {}).url || "",
            E = (v.find((U) => U && U.flag === "preview") || {}).url || "",
            p = v.find(
              (U) =>
                U &&
                U.url &&
                (String(U.url).includes(".m3u8") ||
                  String(U.url).includes("/hls/")),
            );
          let P = (I || (p && p.url) || E || f.vodDown || "").split(
            "#preview$",
          )[0];
          if (P && !/^https?:\/\//i.test(P) && !P.includes("auth_key=")) {
            let U = "";
            try {
              const F = JSON.parse(
                localStorage.getItem("system_configs") || "null",
              );
              U = (F && F.play_cdn) || "";
            } catch (F) {}
            P = u(P, U);
          }
          if (!P) throw new Error("无 playUrl");
          if (!isEndWithVideoTwo(P) && !/\/hls\//i.test(P))
            throw new Error("非 mp4/m3u8");
          return {
            playUrl: P,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromHuMao suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromHuMao error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromPornCide(t) {
    return K(this, null, function* () {
      log("_fetchFromPornCide start");
      function r() {
        return K(this, null, function* () {
          const e = window.src_h || "",
            i = window.src_ || (window.src_d ? window.src_d + "/0" : ""),
            o = e || i;
          if (!o) throw new Error("无 src_ / src_h");
          const n = new URL(o, location.href).href,
            h = yield fetch(n, {
              headers: {
                Range: "bytes=0-0",
              },
              signal: AbortSignal.timeout(5e3),
            });
          h.body && h.body.cancel && h.body.cancel();
          const s = h.url || n;
          if (!isEndWithVideoTwo(s)) throw new Error("非 mp4/m3u8");
          return {
            playUrl: s,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromPornCide suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromPornCide error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromJPM(t) {
    log("_fetchFromJPM start");
    let r = 0;
    function e() {
      if (r >= 2) return;
      r++;
      const i = getVideoUrlsFronPerf(),
        o = i.filter((n) => /playlist/i.test(n));
      o.length > 0
        ? (log("_fetchFromJPM suc：", i, o), t && t(o[0]))
        : (setTimeout(() => {
            e();
          }, 500),
          log("_fetchFromJPM error：", "无 playUrl"));
    }
    setTimeout(() => {
      e();
    }, 500);
  }
  function fetchFromMaDou(t) {
    return K(this, null, function* () {
      var i, o;
      log("_fetchFromMaDou start");
      const r =
        (o = (i = evalJs(["__STREAMIT_ME_QUERY__"])) == null ? void 0 : i[0]) ==
        null
          ? void 0
          : o.videoUid;
      if (!r) return;
      function e(n) {
        return K(this, null, function* () {
          var b;
          if (((n = String(n || "").trim()), !n))
            throw new Error("无 videoUid");
          const s =
              (((b = location.pathname.match(/^(\/asian\/[^/]+)/)) == null
                ? void 0
                : b[1]) || "/asian/zh-CN") +
              "/api/video/stream?video_uid=" +
              encodeURIComponent(n),
            u = yield fetch(s, {
              credentials: "include",
            });
          if (!u.ok) throw new Error("stream HTTP " + u.status);
          const c = yield u.json(),
            f = Array.isArray(c.playlist) ? c.playlist : [];
          if (!f.length) throw new Error("playlist 为空");
          const _ = window.Hls,
            S = !!_ && typeof _.isSupported == "function" && !!_.isSupported();
          function v(T) {
            const C = T && T.playMode;
            return C == null || C === "" ? "" : String(C).trim().toLowerCase();
          }
          function I(T) {
            const C = String(T.urlType || T.type || "m3u8").toLowerCase();
            return C === "m3u8" || C === "qualityurls" || C === "hls";
          }
          function E(T) {
            return !T || T.native == null
              ? !0
              : T.native !== !1 &&
                  T.native !== "false" &&
                  T.native !== 0 &&
                  T.native !== "0";
          }
          function p(T) {
            return T
              ? I(T)
                ? v(T) === "streampipe"
                  ? !S
                  : !S && !E(T)
                : !1
              : !0;
          }
          const U = f.filter((T) => !p(T))[0] || null,
            F = String((U == null ? void 0 : U.url) || "").trim();
          if (!/^https?:\/\//i.test(F)) throw new Error("无可用 playlist 源");
          return {
            playUrl: F,
            videoUid: n,
          };
        });
      }
      e(r)
        .then((n) => {
          (log("_fetchFromMaDou suc：", n), t && t(n.playUrl));
        })
        .catch((n) => {
          log("_fetchFromMaDou error：", n == null ? void 0 : n.message);
        });
    });
  }
  function fetchFromKanJu(t) {
    return K(this, null, function* () {
      log("_fetchFromKanJu start");
      function r() {
        return K(this, null, function* () {
          var C, M, x;
          const e = "dianyingtiantang-frontend",
            i = "1.0.0",
            o = "dianyingtiantang-v2026.08.21.2-644c64f5a87d-web",
            n = "2026-07-05.library-v2.playback-v1",
            h =
              "557d0e4ae929f438da6bd84412374e6086b8af09b3fed54bf22601d5bf8c54a0",
            s = (a, y) =>
              K(this, null, function* () {
                const A = new TextEncoder(),
                  $ = yield crypto.subtle.importKey(
                    "raw",
                    A.encode(a),
                    {
                      name: "HMAC",
                      hash: "SHA-256",
                    },
                    !1,
                    ["sign"],
                  ),
                  W = yield crypto.subtle.sign("HMAC", $, A.encode(y));
                return [...new Uint8Array(W)]
                  .map((q) => q.toString(16).padStart(2, "0"))
                  .join("");
              }),
            u = () =>
              [...crypto.getRandomValues(new Uint8Array(16))]
                .map((a) => a.toString(16).padStart(2, "0"))
                .join(""),
            c = (A, ...$) =>
              K(this, [A, ...$], function* (a, y = {}) {
                const W = String(y.method || "GET").toUpperCase(),
                  q = new URL(a, location.origin),
                  l = String(Date.now()),
                  D = u(),
                  V = yield s(
                    h,
                    `${W}
${q.pathname}${q.search}
${l}
${D}`,
                  ),
                  z = new Headers(y.headers || {});
                return (
                  z.set("Accept", "application/json"),
                  z.has("x-ai-movie-client-name") ||
                    z.set("x-ai-movie-client-name", e),
                  z.has("x-ai-movie-client-version") ||
                    z.set("x-ai-movie-client-version", i),
                  z.has("x-ai-movie-build-version") ||
                    z.set("x-ai-movie-build-version", o),
                  z.has("x-ai-movie-protocol-version") ||
                    z.set("x-ai-movie-protocol-version", n),
                  z.set("x-ai-movie-timestamp", l),
                  z.set("x-ai-movie-nonce", D),
                  z.set("x-ai-movie-signature", V),
                  fetch(
                    q.toString(),
                    se(ie({}, y), {
                      method: W,
                      headers: z,
                      credentials: "include",
                    }),
                  )
                );
              }),
            f = location.pathname.split("/").filter(Boolean),
            _ = f[f.length - 1];
          if (!_ || !f.includes("player"))
            throw new Error("非 /player/{variantId} 页");
          const S = () => {
              var $, W, q, l;
              const a = document.querySelector(
                  "button.movie-button-primary[title^='第'], .movie-episode-quick-tab.movie-button-primary",
                ),
                y =
                  (a == null ? void 0 : a.getAttribute("title")) ||
                  ((a == null ? void 0 : a.textContent) || "").trim();
              let A =
                String(y).match(/第\s*(\d+)\s*集/) ||
                String(y).match(/^(\d+)$/);
              return A ||
                ((A =
                  (W =
                    ($ = document.querySelector(
                      ".react-player-panel-trigger",
                    )) == null
                      ? void 0
                      : $.textContent) == null
                    ? void 0
                    : W.match(/第\s*(\d+)\s*集/)),
                A) ||
                ((A =
                  (l = (q = document.body) == null ? void 0 : q.innerText) ==
                  null
                    ? void 0
                    : l.match(/当前：第\s*(\d+)\s*集/)),
                A)
                ? Number(A[1])
                : 0;
            },
            v = () => {
              var A;
              const y = (
                ((A = document.querySelector(
                  ".art-video-player[data-danmaku-segment]",
                )) == null
                  ? void 0
                  : A.getAttribute("data-danmaku-segment")) || ""
              ).match(/episode:yj:([a-f0-9]+)/i);
              return y ? "YJ-" + y[1] : "";
            },
            I = new URLSearchParams(location.search).get("episode"),
            E = I === "latest" ? -1 : Number(I) || S();
          let p = "";
          if (E !== 0) {
            const a = yield c(
              `/v1/catalog/${encodeURIComponent(_)}/episodes?limit=48&offset=0`,
            );
            if (!a.ok) throw new Error("episodes HTTP " + a.status);
            const y = yield a.json(),
              A = Array.isArray(y.episodes)
                ? y.episodes
                : Array.isArray(y.items)
                  ? y.items
                  : [];
            if (!A.length) throw new Error("无 episodes");
            let $ =
              E < 0
                ? A[A.length - 1]
                : A.find(
                    (W) =>
                      W.episode_number === E ||
                      W.number === E ||
                      String(W.title || W.display_name || "") === `第${E}集`,
                  );
            if (!$) throw new Error("未找到第 " + E + " 集");
            if (((p = String($.token || "").trim()), !p && $.id)) {
              const W = String($.id);
              p = W.startsWith("YJ-") ? W : "YJ-" + W.split(":").pop();
            }
          }
          if ((p || (p = v()), !p)) throw new Error("无 episode token");
          const P = yield c(`/v1/playback/resolve/${encodeURIComponent(p)}`);
          if (!P.ok) throw new Error("resolve HTTP " + P.status);
          const U = yield P.json(),
            F = Array.isArray(U.line_options) ? [...U.line_options] : [];
          if (!F.length) throw new Error("无 line_options");
          F.sort((a, y) => {
            const A = a.selected ? 1 : 0,
              $ = y.selected ? 1 : 0;
            return A !== $
              ? $ - A
              : (Number(y.preference_weight) || 0) -
                  (Number(a.preference_weight) || 0);
          });
          const b = (a) => /^https?:\/\//i.test(a) && isEndWithVideoTwo(a);
          let T = "";
          for (const a of F) {
            let y = String(a.resolve_ticket || a.url || "").trim();
            if ((y.startsWith("resolve://") && (y = y.slice(10)), !y)) continue;
            if (b(y))
              return {
                playUrl: y,
                token: p,
                line: a.label || a.display_label,
              };
            const A = yield c("/v1/playback/resolve-line", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ticket: y,
              }),
            });
            if (!A.ok) {
              T = "resolve-line HTTP " + A.status;
              continue;
            }
            const $ = yield A.json(),
              W = String(((C = $.line) == null ? void 0 : C.url) || "").trim();
            if (!b(W)) {
              T = "线路无 m3u8/mp4: " + (a.label || a.play_from || "");
              continue;
            }
            return {
              playUrl: W,
              token: $.token || p,
              line:
                ((M = $.line) == null ? void 0 : M.label) ||
                ((x = $.line) == null ? void 0 : x.display_label),
            };
          }
          throw new Error(T || "所有线路均无可用 playUrl");
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromKanJu suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromKanJu error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromSouJu(t) {
    return K(this, null, function* () {
      log("_fetchFromSouJu start");
      function r() {
        return K(this, null, function* () {
          var C;
          const e = "movie-search-frontend",
            i = "1.0.0",
            o = "aimovie-v2026.08.26.1-110354011227-web",
            n = "2026-07-05.library-v2.playback-v1",
            h =
              "f39d73aa7a6426203cdee1ef17b31d3b7ea8c23f4c59c62a3a8aa0f39ee5e79d",
            s = (M, x) =>
              K(this, null, function* () {
                const a = new TextEncoder(),
                  y = yield crypto.subtle.importKey(
                    "raw",
                    a.encode(M),
                    {
                      name: "HMAC",
                      hash: "SHA-256",
                    },
                    !1,
                    ["sign"],
                  ),
                  A = yield crypto.subtle.sign("HMAC", y, a.encode(x));
                return [...new Uint8Array(A)]
                  .map(($) => $.toString(16).padStart(2, "0"))
                  .join("");
              }),
            u = () =>
              [...crypto.getRandomValues(new Uint8Array(16))]
                .map((M) => M.toString(16).padStart(2, "0"))
                .join(""),
            c = (a, ...y) =>
              K(this, [a, ...y], function* (M, x = {}) {
                const A = String(x.method || "GET").toUpperCase(),
                  $ = new URL(M, location.origin),
                  W = String(Date.now()),
                  q = u(),
                  l = yield s(
                    h,
                    `${A}
${$.pathname}${$.search}
${W}
${q}`,
                  ),
                  D = new Headers(x.headers || {});
                return (
                  D.set("Accept", "application/json"),
                  D.has("x-ai-movie-client-name") ||
                    D.set("x-ai-movie-client-name", e),
                  D.has("x-ai-movie-client-version") ||
                    D.set("x-ai-movie-client-version", i),
                  D.has("x-ai-movie-build-version") ||
                    D.set("x-ai-movie-build-version", o),
                  D.has("x-ai-movie-protocol-version") ||
                    D.set("x-ai-movie-protocol-version", n),
                  D.set("x-ai-movie-timestamp", W),
                  D.set("x-ai-movie-nonce", q),
                  D.set("x-ai-movie-signature", l),
                  fetch(
                    $.toString(),
                    se(ie({}, x), {
                      method: A,
                      headers: D,
                      credentials: "include",
                    }),
                  )
                );
              }),
            f = location.pathname.split("/").filter(Boolean),
            _ = f[f.length - 1];
          if (!_ || !f.includes("player"))
            throw new Error("非 /player/{variantId} 页");
          const S = () => {
              var y, A;
              const M = document.querySelector(
                  "button.movie-button-primary[title^='第'], .movie-episode-quick-tab.movie-button-primary",
                ),
                x =
                  (M == null ? void 0 : M.getAttribute("title")) ||
                  ((M == null ? void 0 : M.textContent) || "").trim();
              let a =
                String(x).match(/第\s*(\d+)\s*集/) ||
                String(x).match(/^(\d+)$/);
              return a ||
                ((a =
                  (A =
                    (y = document.querySelector(
                      ".react-player-panel-trigger",
                    )) == null
                      ? void 0
                      : y.textContent) == null
                    ? void 0
                    : A.match(/第\s*(\d+)\s*集/)),
                a)
                ? Number(a[1])
                : 0;
            },
            v = () => {
              var a;
              const x = (
                ((a = document.querySelector(
                  ".art-video-player[data-danmaku-segment]",
                )) == null
                  ? void 0
                  : a.getAttribute("data-danmaku-segment")) || ""
              ).match(/episode:yj:([a-f0-9]+)/i);
              return x ? "YJ-" + x[1] : "";
            },
            I = new URLSearchParams(location.search).get("episode"),
            E = I === "latest" ? -1 : Number(I) || S();
          let p = "";
          if (E !== 0) {
            const M = yield c(
              `/v1/catalog/${encodeURIComponent(_)}/episodes?limit=48&offset=0`,
            );
            if (!M.ok) throw new Error("episodes HTTP " + M.status);
            const x = yield M.json(),
              a = Array.isArray(x.episodes)
                ? x.episodes
                : Array.isArray(x.items)
                  ? x.items
                  : [];
            if (!a.length) throw new Error("无 episodes");
            let y =
              E < 0
                ? a[a.length - 1]
                : a.find(
                    (A) =>
                      A.episode_number === E ||
                      A.number === E ||
                      String(A.title || A.display_name || "") === `第${E}集`,
                  );
            if (!y) throw new Error("未找到第 " + E + " 集");
            if (((p = String(y.token || "").trim()), !p && y.id)) {
              const A = String(y.id);
              p = A.startsWith("YJ-") ? A : "YJ-" + A.split(":").pop();
            }
          }
          if ((p || (p = v()), !p)) throw new Error("无 episode token");
          const P = yield c(`/v1/playback/resolve/${encodeURIComponent(p)}`);
          if (!P.ok) throw new Error("resolve HTTP " + P.status);
          const U = yield P.json(),
            F = Array.isArray(U.line_options) ? [...U.line_options] : [];
          if (!F.length) throw new Error("无 line_options");
          F.sort((M, x) => {
            const a = M.selected ? 1 : 0,
              y = x.selected ? 1 : 0;
            return a !== y
              ? y - a
              : (Number(x.preference_weight) || 0) -
                  (Number(M.preference_weight) || 0);
          });
          const b = (M) => /^https?:\/\//i.test(M) && isEndWithVideoTwo(M);
          let T = "";
          for (const M of F) {
            let x = String(M.resolve_ticket || M.url || "").trim();
            if ((x.startsWith("resolve://") && (x = x.slice(10)), !x)) continue;
            if (b(x))
              return {
                playUrl: x,
              };
            const a = yield c("/v1/playback/resolve-line", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ticket: x,
              }),
            });
            if (!a.ok) {
              T = "resolve-line HTTP " + a.status;
              continue;
            }
            const y = yield a.json(),
              A = String(((C = y.line) == null ? void 0 : C.url) || "").trim();
            if (!b(A)) {
              T = "线路无 m3u8/mp4";
              continue;
            }
            return {
              playUrl: A,
            };
          }
          throw new Error(T || "所有线路均无可用 playUrl");
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromSouJu suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromSouJu error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFrom7c(t) {
    return K(this, null, function* () {
      log("_fetchFrom7c start");
      function r() {
        return K(this, null, function* () {
          var y, A;
          const e = "9Mi5G39C2bKRZOZq",
            i = "7c",
            o =
              (location.hash.match(/videoDetail\/(\d+)/) || [])[1] ||
              (location.pathname.match(/videoDetail\/(\d+)/) || [])[1];
          if (!o) throw new Error("无 videoDetail id");
          const n = ($) =>
              /^https?:\/\//i.test($) &&
              $.includes(o) &&
              (/\/content\//i.test($) ||
                /\.m3u8(\?|$)/i.test($) ||
                /\.mp4(\?|$)/i.test($)),
            h = performance
              .getEntriesByType("resource")
              .map(($) => $.name)
              .filter(n)
              .pop();
          if (h)
            return {
              playUrl: h,
            };
          const s = new TextEncoder(),
            u = s.encode(e),
            c = yield crypto.subtle.importKey(
              "raw",
              u,
              {
                name: "AES-CBC",
              },
              !1,
              ["encrypt", "decrypt"],
            ),
            f = yield crypto.subtle.importKey(
              "raw",
              u,
              {
                name: "HMAC",
                hash: "SHA-1",
              },
              !1,
              ["sign"],
            ),
            _ = ($) => {
              const W = new Uint8Array($);
              let q = "";
              for (let l = 0; l < W.length; l++) q += String.fromCharCode(W[l]);
              return btoa(q);
            },
            S = ($) => Uint8Array.from(atob($), (W) => W.charCodeAt(0)),
            v = ($) =>
              K(this, null, function* () {
                const W = typeof $ == "string" ? s.encode($) : $;
                return _(
                  yield crypto.subtle.encrypt(
                    {
                      name: "AES-CBC",
                      iv: u,
                    },
                    c,
                    W,
                  ),
                );
              }),
            I = ($) =>
              K(this, null, function* () {
                return new TextDecoder().decode(
                  yield crypto.subtle.decrypt(
                    {
                      name: "AES-CBC",
                      iv: u,
                    },
                    c,
                    S($),
                  ),
                );
              }),
            E = yield v(
              JSON.stringify({
                id: o,
              }),
            ),
            p = Math.round(Math.random() * Math.pow(2, 63)),
            P = Date.now(),
            U = _(yield crypto.subtle.sign("HMAC", f, s.encode(E + p + P))),
            F = yield v(
              JSON.stringify({
                encrypted: !0,
                nonce: p,
                timestamp: P,
                sign: U,
                gzipped: !1,
              }),
            ),
            b = (
              localStorage.getItem("usedApiUrl") ||
              "https://7capiws.51colopay.cn"
            ).replace(/\/$/, ""),
            T = yield fetch(`${b}/mpr-client/resource/detail`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                M: i,
                "x-sys": "1",
                "x-token": F,
              },
              body: E,
            });
          if (!T.ok) throw new Error(`detail HTTP ${T.status}`);
          let C = yield T.text();
          try {
            C = yield I(C);
          } catch ($) {}
          const M = JSON.parse(C);
          if (M.code !== 200) throw new Error(M.message || "detail 失败");
          const x = M.body || {},
            a = String(
              ((y = x.gatewayPlayPathList) == null ? void 0 : y[0]) ||
                ((A = x.playPathList) == null ? void 0 : A[0]) ||
                "",
            ).trim();
          if (!a || !/^https?:\/\//i.test(a))
            throw new Error("无 gatewayPlayPathList");
          return {
            playUrl: a,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFrom7c suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFrom7c error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromQiMao(t) {
    return K(this, null, function* () {
      log("_fetchFromQiMao start");
      function r() {
        return K(this, null, function* () {
          var F;
          const e = (location.pathname.match(/\/movie\/(\d+)/) || [])[1];
          if (!e) throw new Error("无 movie id");
          const i = (b) => /^https?:\/\//i.test(b) && isEndWithVideoTwo(b),
            o = new TextEncoder(),
            n = new TextDecoder(),
            h = (b) => {
              const T = String(b || "")
                  .trim()
                  .replace(/\s+/g, "")
                  .replace(/-/g, "+")
                  .replace(/_/g, "/"),
                C = T.length % 4 ? "=".repeat(4 - (T.length % 4)) : "",
                M = atob(T + C),
                x = new Uint8Array(M.length);
              for (let a = 0; a < M.length; a++) x[a] = M.charCodeAt(a);
              return x;
            },
            s = (b) => {
              const T = o.encode(String(b || ""));
              let C = 2166136261;
              for (let M = 0; M < T.length; M++)
                ((C ^= T[M]), (C = Math.imul(C, 16777619) >>> 0));
              return C >>> 0;
            },
            u = (b) => {
              let T = b >>> 0;
              return (
                (T ^= (T << 13) >>> 0),
                (T ^= T >>> 17),
                (T ^= (T << 5) >>> 0),
                T >>> 0
              );
            },
            c = (b, T, C) => {
              let M = s(`${String(C || "")}|${String(T || "")}`) || 2166136261;
              const x = new Uint8Array(b.length);
              let a = 0;
              for (let y = 0; y < b.length; y++)
                (y & 3 || ((M = u(M)), (a = M)),
                  (x[y] = b[y] ^ ((a >>> (8 * (y & 3))) & 255)));
              return x;
            },
            f = () => localStorage.getItem("apiEncKey") || "Mumu2026#",
            _ = (b) => {
              const T = String(b || "").trim();
              if (!T.startsWith("ENC2.")) return T;
              const C = T.split(".");
              if (C.length !== 3) throw new Error("Invalid ENC2");
              const M = n.decode(c(h(C[2]), C[1], f()));
              return JSON.parse(M);
            },
            S =
              ((F = window.__RUNTIME_CONFIG__) == null
                ? void 0
                : F.siteProject) ||
              new URLSearchParams(location.search).get("project") ||
              "xs",
            I = yield fetch(
              `https://7maohd.xffll.com/api/movie/${encodeURIComponent(e)}?project=${encodeURIComponent(S)}`,
            );
          if (!I.ok) throw new Error("movie HTTP " + I.status);
          const p = (yield I.json()).data || {},
            P = {};
          for (const b of Object.keys(p))
            try {
              P[b] = _(p[b]);
            } catch (T) {
              P[b] = p[b];
            }
          const U = [
            P.h264m3u8url,
            P.h264m3u8url2,
            P.h264mp4url,
            P.h264mp4url2,
            P.h265m3u8url,
            P.h265mp4url,
          ]
            .map((b) => String(b || "").trim())
            .find(i);
          if (!U) throw new Error("无 h264m3u8url/mp4");
          return {
            playUrl: U,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromQiMao suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromQiMao error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromWuSe(t) {
    return K(this, null, function* () {
      log("_fetchFromWuSe start");
      function r() {
        return K(this, null, function* () {
          const e = (location.pathname.match(/\/(?:pwa\/)?video\/(\d+)/) ||
            [])[1];
          if (!e) throw new Error("pathname 无 movie_id");
          const i = {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            o = localStorage.getItem("G_TOKEN");
          o &&
            ((i["User-Id"] = localStorage.getItem("G_UID") || ""),
            (i["Auth-Token"] = o));
          const h = yield (yield fetch(
            new URL("/api/Webapi_v1/Resource/movieInfo", location.origin).href,
            {
              method: "POST",
              headers: i,
              body: "movie_id=" + encodeURIComponent(e),
              credentials: "include",
            },
          )).json();
          if (String(h.code) !== "10000")
            throw new Error("movieInfo 失败 code=" + h.code);
          const s = h.data && h.data.movie_m3u8_url;
          if (!Array.isArray(s) || !s.length)
            throw new Error("无 movie_m3u8_url（可能需购买/登录）");
          const u = document.querySelector(".lines .btn.active");
          if (!u) throw new Error("无 .btn.active");
          const c = Array.from(
              document.querySelectorAll(".lines .btn"),
            ).indexOf(u),
            f = s[c],
            _ = f && (f.url || "").trim();
          if (!_) throw new Error("当前线路 url 为空（极速/VIP 可能需登录）");
          return {
            playUrl: new URL(_, location.origin).href,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromWuSe suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromWuSe error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromHuangDou(t) {
    return K(this, null, function* () {
      log("_fetchFromHuangDou start");
      function r() {
        return K(this, null, function* () {
          const e =
            /(?:decrypt91VideoUrl|Common\.decrypt91VideoUrl)\(\s*(?:\\)?['"]([^'"\\]+)(?:\\)?['"]\s*\)/;
          function i(u) {
            const c = String(u || "").match(e);
            return c ? c[1].trim() : "";
          }
          function o(u) {
            if (
              window.Common &&
              typeof window.Common.decrypt91VideoUrl == "function"
            )
              return window.Common.decrypt91VideoUrl(u).trim();
            if (typeof CryptoJS > "u") throw new Error("页内无 CryptoJS");
            const c = CryptoJS.enc.Utf8.parse("BxJand%xf5h3sycH");
            return CryptoJS.AES.decrypt(u, c, {
              iv: c,
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            })
              .toString(CryptoJS.enc.Utf8)
              .trim();
          }
          function n(u) {
            if (!/^https?:\/\//i.test(u) || !isEndWithVideoTwo(u))
              throw new Error("解密结果非媒体链");
            return u;
          }
          const h = yield fetch(location.href, {
            credentials: "same-origin",
          });
          if (!h.ok) throw new Error("fetch 页面 HTML 失败 " + h.status);
          let s = i(yield h.text());
          if (!s) {
            const u = [...performance.getEntriesByType("resource")]
              .map((c) => c.name)
              .reverse()
              .find((c) => /\.m3u8(\?|$)/i.test(c));
            if (u)
              return {
                playUrl: u,
              };
            throw new Error("SSR HTML 无 decrypt91VideoUrl 密文");
          }
          return {
            playUrl: n(o(s)),
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromHuangDou suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromHuangDou error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromMiTao(t) {
    return K(this, null, function* () {
      log("_fetchFromMiTao start");
      function r() {
        return K(this, arguments, function* (e = location.href) {
          const i = (P) => {
              let U = 5381;
              for (let F = 0; F < P.length; F++)
                U = ((U << 5) + U + P.charCodeAt(F)) >>> 0;
              return U;
            },
            o = (P) => {
              const U = P.match(/window\.APP_DATA\s*=\s*(\{[\s\S]*?\});/);
              if (!U) throw new Error("无 APP_DATA");
              return JSON.parse(U[1]).data;
            };
          let n = window.APP_DATA && window.APP_DATA.data;
          const h = new URL(e).origin;
          if (!n) {
            const P = yield fetch(e, {
              credentials: "same-origin",
            });
            if (!P.ok) throw new Error("fetch 页面失败 " + P.status);
            n = o(yield P.text());
          }
          const s = n && n.m3u8,
            u = n && n.category_id;
          if (!s) throw new Error("无 m3u8 路径");
          const c = yield fetch(h + "/api/cfg", {
            credentials: "same-origin",
          });
          if (!c.ok) throw new Error("/api/cfg HTTP " + c.status);
          const f = yield c.json(),
            _ = f && f.data && f.data.m3u8_host;
          if (!_) throw new Error("无 m3u8_host");
          const S = typeof _ == "string" ? JSON.parse(_) : _,
            v = S[String(u)] || S.default || "",
            I = String(v)
              .split(",")
              .map((P) => P.trim())
              .filter(Boolean);
          if (!I.length) throw new Error("m3u8_host 列表为空");
          const p =
            "https://" +
            I[i(String(u || "default")) % I.length]
              .replace(/^https?:\/\//, "")
              .replace(/\/$/, "") +
            "/" +
            s.replace(/^\//, "");
          if (!/\.m3u8(\?|$)/i.test(p)) throw new Error("非 m3u8");
          return {
            playUrl: p,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromMiTao suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromMiTao error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromMango(t) {
    return K(this, null, function* () {
      log("_fetchFromMango start");
      function r() {
        return K(this, arguments, function* (e = location.href) {
          const i = "3492302601345106",
            o = "f34923d8ef8a427d",
            n = (F) => {
              const b = F.split("#")[1] || "",
                T = b.includes("?") ? b.split("?")[1] : "";
              return new URLSearchParams(T).get("watchId") || "";
            },
            h = () => localStorage.getItem("flag") || o,
            s = (F, b, T) =>
              K(this, null, function* () {
                const C = T || o,
                  M = yield crypto.subtle.importKey(
                    "raw",
                    new TextEncoder().encode(C),
                    {
                      name: "AES-CBC",
                    },
                    !1,
                    [F],
                  ),
                  x = new TextEncoder().encode(i);
                if (F === "encrypt") {
                  const A = yield crypto.subtle.encrypt(
                    {
                      name: "AES-CBC",
                      iv: x,
                    },
                    M,
                    new TextEncoder().encode(b),
                  );
                  return btoa(String.fromCharCode(...new Uint8Array(A)));
                }
                const a = Uint8Array.from(atob(b), (A) => A.charCodeAt(0)),
                  y = yield crypto.subtle.decrypt(
                    {
                      name: "AES-CBC",
                      iv: x,
                    },
                    M,
                    a,
                  );
                return new TextDecoder().decode(y);
              }),
            u = n(e);
          if (!u) throw new Error("无 watchId");
          const c = location.origin,
            f =
              JSON.parse(localStorage.getItem("inviteInfo") || "{}").mchCode ||
              "pingtai",
            _ = h(),
            S = {
              id: u,
              domain: c,
              jumpUrl: `${c}/?channelCode=${f}`,
              userId: sessionStorage.getItem("fingerprintId") || "",
              flag: _,
            },
            v = {
              "Content-Type": "application/json",
              device: "1",
            },
            I = sessionStorage.getItem("userInfo");
          if (I)
            try {
              const F = JSON.parse(I).token;
              F && (v.token = F);
            } catch (F) {}
          const p = yield (yield fetch("/proxy/api/front/res/play", {
            method: "POST",
            headers: v,
            body: JSON.stringify({
              param: yield s("encrypt", JSON.stringify(S), _),
            }),
          })).json();
          if (p.code !== 200) throw new Error(p.msg || "play 失败 " + p.code);
          const P = JSON.parse(yield s("decrypt", p.data, _)),
            U = String(yield s("decrypt", P, _)).trim();
          if (!/^https?:\/\//i.test(U)) throw new Error("非媒体 URL");
          return {
            playUrl: U,
            type: /\.m3u8(\?|$)/i.test(U) ? "hls" : "",
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromMango suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromMango error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromBilibili(t) {
    return K(this, null, function* () {
      log("_fetchFromBilibili start");
      function r() {
        return K(this, null, function* () {
          var u, c, f, _, S;
          const e = (v) => {
              var P;
              const I =
                (P = v == null ? void 0 : v.durl) == null ? void 0 : P[0];
              if (!I) return null;
              const E = [I.url, ...(I.backup_url || [])].filter(
                  (U) => typeof U == "string" && /^https?:\/\//i.test(U),
                ),
                p =
                  E.find(
                    (U) => /bilivideo\.com/i.test(U) && /\.mp4(\?|$)/i.test(U),
                  ) ||
                  E.find((U) => /\.mp4(\?|$)/i.test(U)) ||
                  null;
              return p
                ? {
                    playUrl: p,
                    quality: v.quality,
                    format: v.format,
                  }
                : null;
            },
            i =
              (location.pathname.match(/\/video\/(BV[\w]+)/i) || [])[1] ||
              new URLSearchParams(location.search).get("bvid");
          if (!i) throw new Error("无 bvid");
          let o =
            ((c =
              (u = window.__INITIAL_STATE__) == null ? void 0 : u.videoData) ==
            null
              ? void 0
              : c.cid) ||
            ((f = window.__INITIAL_STATE__) == null ? void 0 : f.cid) ||
            null;
          if (!o) {
            const v = yield fetch(
              `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(i)}`,
              {
                credentials: "include",
              },
            ).then((I) => I.json());
            o = (_ = v == null ? void 0 : v.data) == null ? void 0 : _.cid;
          }
          if (!o) throw new Error("无 cid");
          const n = [80, 64, 32, 16];
          let h;
          for (const v of n) {
            const I = yield fetch(
              `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(i)}&cid=${o}&qn=${v}&fnval=0`,
              {
                credentials: "include",
              },
            ).then((p) => p.json());
            h = I == null ? void 0 : I.code;
            const E = e(I == null ? void 0 : I.data);
            if (E) return E;
          }
          const s = e((S = window.__playinfo__) == null ? void 0 : S.data);
          if (s) return s;
          throw new Error("无整段 mp4（勿用 dash.m4s）。playurl code=" + h);
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromBilibili suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromBilibili error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromJP(t) {
    return K(this, null, function* () {
      log("_fetchFromJP start");
      function r() {
        return K(this, null, function* () {
          const e = (u) =>
              typeof u == "string" &&
              /^https?:\/\//i.test(u) &&
              /\.m3u8(\?|$)/i.test(u),
            i = (u) => {
              try {
                return JSON.parse(u || "null");
              } catch (c) {
                return null;
              }
            },
            o = (u) => {
              const c = (Array.isArray(u) ? u : []).filter((v) =>
                e(v == null ? void 0 : v.url),
              );
              if (!c.length) return null;
              const f = c.filter((v) => !v.needLogin),
                _ = f.length ? f : c;
              _.sort(
                (v, I) =>
                  (I.flag ? 1 : 0) - (v.flag ? 1 : 0) ||
                  (I.resolution || 0) - (v.resolution || 0),
              );
              const S = _[0];
              return {
                playUrl: S.url,
                resolution: S.resolution,
                resolutionName: S.resolutionName,
              };
            },
            n = () => {
              const u = i(sessionStorage.getItem("appResolution"));
              if (e(u == null ? void 0 : u.url))
                return {
                  playUrl: u.url,
                  resolution: u.resolution,
                  resolutionName: u.resolutionName,
                };
              const c = i(sessionStorage.getItem("resolutionList"));
              return o(c == null ? void 0 : c.list);
            },
            h = () => {
              const u = performance
                  .getEntriesByType("resource")
                  .map((f) => f.name)
                  .filter(e),
                c = u.find((f) => /\/index\.m3u8(\?|$)/i.test(f)) || u[0] || "";
              return c
                ? {
                    playUrl: c,
                  }
                : null;
            };
          let s = n() || h();
          if (!s)
            for (
              let u = 0;
              u < 10 &&
              (yield new Promise((c) => setTimeout(c, 300)),
              (s = n() || h()),
              !s);
              u++
            );
          if (!s)
            throw new Error(
              "无 m3u8：请等页面开播后再跑（读 appResolution / resolutionList）",
            );
          return s;
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromJP suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromJP error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromMiaoMi(t) {
    return K(this, null, function* () {
      log("_fetchFromMiaoMi start");
      function r() {
        return K(this, null, function* () {
          const e = getVideoUrlsFronPerf() || [],
            i =
              e.find((o) => /\/index\.m3u8(\?|$)/i.test(o)) ||
              e.find((o) => /\/hls\/\d+\/[^/]+\.m3u8(\?|$)/i.test(o)) ||
              e.find((o) => /\.m3u8(\?|$)/i.test(o)) ||
              "";
          if (!i) throw new Error("无 m3u8（请先播放）");
          return {
            playUrl: i,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromMiaoMi suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromMiaoMi error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromMasex(t) {
    return K(this, null, function* () {
      log("_fetchFromMasex start");
      function r() {
        return K(this, arguments, function* (e = location.href, i = 0) {
          var v, I, E;
          const o = (p) => {
              const P = p.match(/<video[^>]+id="plyrPlayer"[^>]+>/i);
              if (!P) throw new Error("无 #plyrPlayer");
              const U = P[0],
                F = (b) =>
                  (U.match(new RegExp("data-" + b + '="([^"]*)"', "i")) ||
                    [])[1];
              return {
                videoId: F("video-id"),
                isVip: F("is-vip") === "1",
                trailerUrl: F("trailer-url") || "",
              };
            },
            n = document.querySelector("#plyrPlayer");
          let h =
              ((v = n == null ? void 0 : n.dataset) == null
                ? void 0
                : v.videoId) || "",
            s =
              ((I = n == null ? void 0 : n.dataset) == null
                ? void 0
                : I.isVip) === "1",
            u =
              ((E = n == null ? void 0 : n.dataset) == null
                ? void 0
                : E.trailerUrl) || "";
          if (!h) {
            const p = yield fetch(e, {
              credentials: "same-origin",
            });
            if (!p.ok) throw new Error("fetch 页面失败 " + p.status);
            const P = o(yield p.text());
            ((h = P.videoId), (s = P.isVip), (u = P.trailerUrl));
          }
          if (!h) throw new Error("无 video-id");
          const c = () =>
              K(this, null, function* () {
                if (u)
                  return {
                    url: u,
                    type: "hls",
                    preview: !0,
                  };
                const p = yield fetch("/api/videos/" + h + "/trailer", {
                  credentials: "same-origin",
                });
                if (!p.ok || p.status === 204) return null;
                const P = yield p.json();
                return P && P.url
                  ? se(ie({}, P), {
                      preview: !0,
                    })
                  : null;
              }),
            _ = yield ((p) =>
              K(this, null, function* () {
                if (!s && u && p === 0) return c();
                const P = yield fetch("/api/videos/" + h + "/stream/" + p, {
                  credentials: "same-origin",
                });
                return P.status === 204
                  ? p === 0
                    ? c()
                    : null
                  : P.ok
                    ? P.json()
                    : null;
              }))(i);
          if (!_ || !_.url) throw new Error("无播放地址");
          const S = String(_.url).trim();
          if (!/^https?:\/\//i.test(S)) throw new Error("非媒体 URL");
          return {
            playUrl: S,
            preview: !!_.preview,
            type: _.type || (/\.m3u8(\?|$)/i.test(S) ? "hls" : ""),
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromMasex suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromMasex error：", e == null ? void 0 : e.message);
        });
    });
  }
  function fetchFromDYRS(t) {
    return K(this, null, function* () {
      log("_fetchFromDYRS start");
      function r() {
        return K(this, null, function* () {
          const e =
              window.xg_video_player_doc ||
              (window.parent && window.parent.xg_video_player_doc),
            i = e && e.aa;
          if (!i || !i.url) throw new Error("无 xg_video_player_doc.aa.url");
          let o = new URL(i.url, location.href).href;
          try {
            let n = o;
            for (let h = 0; h < 4; h++) {
              const s = yield fetch(n, {
                credentials: "include",
                redirect: "follow",
              });
              if (!s.ok) break;
              const u = yield s.text();
              if (((n = s.url), !u.includes("#EXTM3U"))) break;
              const c = [];
              let f = 0;
              for (const _ of u.split(`
`)) {
                const S = _.trim();
                if (S.startsWith("#EXT-X-STREAM-INF:")) {
                  const v = S.match(/BANDWIDTH=(\d+)/);
                  f = v ? +v[1] : 0;
                } else
                  S &&
                    !S.startsWith("#") &&
                    (S.includes("m3u8") ||
                      S.startsWith("/") ||
                      /^https?:/i.test(S)) &&
                    (c.push({
                      bw: f,
                      url: new URL(S, n).href,
                    }),
                    (f = 0));
              }
              if (!c.length) {
                o = n;
                break;
              }
              if (
                (c.sort((_, S) => {
                  const v = /\/api\/direct/.test(_.url) ? 1 : 0,
                    I = /\/api\/direct/.test(S.url) ? 1 : 0;
                  return I !== v ? I - v : S.bw - _.bw;
                }),
                (n = c[0].url),
                (o = n),
                /\.m3u8(\?|$)/i.test(n) && !/\/api\//.test(new URL(n).pathname))
              )
                break;
            }
          } catch (n) {}
          if (!/^https?:\/\//i.test(o)) throw new Error("无播放地址");
          return {
            playUrl: o,
          };
        });
      }
      r()
        .then((e) => {
          (log("_fetchFromDYRS suc：", e), t && t(e.playUrl));
        })
        .catch((e) => {
          log("_fetchFromDYRS error：", e == null ? void 0 : e.message);
        });
    });
  }
  function toVideoSrcItems(t) {
    var r, e;
    return (e =
      (r = t == null ? void 0 : t.result) == null
        ? void 0
        : r.map((i) => ({
            tagNode: i.tagNode,
            videoFrom: i.videoFrom,
            width: i.width,
            height: i.height,
            nodeSrc: i.nodeSrc,
            src: typeof i.src == "string" ? i.src : "",
          }))) != null
      ? e
      : [];
  }
  class GetVideoSrc {
    constructor(r) {
      this.options = r;
    }
    scan(r, e) {
      const i = e != null ? e : getAllTagEl();
      return getVideoObj(
        i,
        ie(
          ie({}, this.options),
          r !== void 0
            ? {
                type: r,
              }
            : {},
        ),
      );
    }
    getVideoUrls(r, e, i) {
      const o = toVideoSrcItems(this.scan(r, e));
      return i != null && i.includeEmptySrc
        ? o
        : o.filter((n) => !!n.src.trim());
    }
  }
  return GetVideoSrc;
})();
