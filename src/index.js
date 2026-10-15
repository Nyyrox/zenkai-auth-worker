const REPO = "Nyyrox/Zenkai";
const RELEASES = "https://github.com/" + REPO + "/releases/latest";
const WEB = "https://zenkaii.pages.dev/";
const DISCORD = "https://discord.gg/kHxHzZtH7";
const TELEGRAM = "https://t.me/StreamverseOfc";
const GITHUB = "https://github.com/" + REPO;
const SELF = "https://github.com/nyyrox2/Zenkai";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");

// Latest release from GitHub, cached 10 min at the edge.
// ponytail: Cache API instead of KV. Set a GITHUB_TOKEN secret if the shared 60/h limit ever bites.
async function getRelease(env, ctx) {
  const cache = caches.default;
  const key = new Request("https://zenkai.internal/release");
  const hit = await cache.match(key);
  if (hit) return hit.json();

  let rel = null;
  try {
    const r = await fetch("https://api.github.com/repos/" + REPO + "/releases/latest", {
      headers: {
        "User-Agent": "zenkai-site",
        Accept: "application/vnd.github+json",
        ...(env.GITHUB_TOKEN ? { Authorization: "Bearer " + env.GITHUB_TOKEN } : {})
      }
    });
    if (r.ok) {
      const d = await r.json();
      const apk = (d.assets || []).find((a) => /\.apk$/i.test(a.name));
      rel = { tag: d.tag_name, url: d.html_url, date: d.published_at, apk: apk && apk.browser_download_url, size: apk && apk.size };
    }
  } catch (_) {}

  if (!rel) {
    // API limited? The /releases/latest redirect still reveals the tag.
    try {
      const r = await fetch(RELEASES, { redirect: "manual", headers: { "User-Agent": "zenkai-site" } });
      const loc = r.headers.get("location") || "";
      if (loc.includes("/tag/")) rel = { tag: decodeURIComponent(loc.split("/tag/")[1]), url: loc };
    } catch (_) {}
  }

  if (rel) ctx.waitUntil(cache.put(key, new Response(JSON.stringify(rel), { headers: { "Cache-Control": "public, max-age=600" } })));
  return rel;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Android App Links verification (assetlinks.json)
    if (url.pathname === "/.well-known/assetlinks.json") {
      const assetlinks = [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: "com.nyyrox.aniverse",
            sha256_cert_fingerprints: [
              "8D:EA:25:2A:B0:B6:87:51:81:7E:06:E1:5C:D9:08:B4:E8:CC:69:03:F0:59:BE:07:5E:8E:19:58:AD:77:21:6D"
            ]
          }
        }
      ];
      return new Response(JSON.stringify(assetlinks, null, 2), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 2. Auth callback detection -> landing page shows the redirect sheet
    const isCallback =
      url.pathname.includes("/callback") ||
      url.pathname.includes("/login") ||
      url.searchParams.has("code") ||
      url.searchParams.has("access_token") ||
      url.searchParams.has("error");

    const rel = await getRelease(env, ctx);
    const tag = rel ? esc(rel.tag) : "";
    const apk = esc((rel && rel.apk) || RELEASES);
    const when = rel && rel.date ? new Date(rel.date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
    const mb = rel && rel.size ? Math.round(rel.size / 1048576) + " MB" : "";
    const status = rel ? "Latest release " + tag + (when ? " · " + when : "") : "Android app";
    const dlMeta = mb ? " · " + mb : "";

    // 3. Share links: /s/<anime|manga|novel>/<id>[?ep=N|ch=N]. Installed app opens via App Links;
    // otherwise this page offers Open (intent:// with APK fallback) and Download.
    // ponytail: ids are validated, so no escaping beyond the regex. No title/poster lookup.
    const m = url.pathname.match(/^\/s\/(anime|manga|novel)\/([\w-]{1,64})\/?$/);
    let share = null;
    if (m) {
      const q = ["ep", "ch"]
        .filter((k) => /^\d{1,5}$/.test(url.searchParams.get(k) || ""))
        .map((k) => k + "=" + url.searchParams.get(k))
        .join("&");
      const base = "intent://s/" + m[1] + "/" + m[2] + (q ? "?" + q : "") + "#Intent;scheme=aniverse;package=com.nyyrox.aniverse";
      // a: auto-open, stays on the page if the app is missing. b: button, falls back to the APK.
      share = { a: base + ";end", b: base + ";S.browser_fallback_url=" + encodeURIComponent((rel && rel.apk) || RELEASES) + ";end" };
    }

    // ponytail: one inline page, no build step, no assets to host. Logo is the repo's SVG, inlined.
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>ZENKAI • Anime, manga and novels for Android</title>
<meta name="description" content="Zenkai brings anime streaming, manga and novel reading together in one Android app. Download the latest APK.">
<meta name="theme-color" content="#07080b">
<meta property="og:title" content="ZENKAI">
<meta property="og:description" content="Anime, manga and novels in one Android app.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-58 -271 1000 1000'%3E%3Crect x='-58' y='-271' width='1000' height='1000' rx='230' fill='%2312141a'/%3E%3Cpath fill='%23c8102e' d='M728 0H301L173 151l135-94h254L0 454h577l137-155-144 98H187L728 0Z'/%3E%3Cpath fill='%23f2f2f2' d='M884 0h-93L248 377h93L884 0Z'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#07080b;--ink:#f3f5f9;--mute:rgba(226,232,243,.64);--blur:22px;--spring:cubic-bezier(.34,1.56,.64,1);--ease:cubic-bezier(.22,1,.36,1)}
*{box-sizing:border-box;margin:0;padding:0}
[hidden]{display:none!important}
html{scroll-behavior:smooth;scroll-padding-top:96px;-webkit-text-size-adjust:100%}
body{font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent}
:focus-visible{outline:2px solid #fff;outline-offset:3px;border-radius:12px}
svg.i{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
svg.b{width:28px;height:28px;flex:none;fill:currentColor}
.zl{display:block;flex:none;aspect-ratio:884/457}

/* liquid background: gradient blobs moving on the GPU (transform only), no filters */
.liquid{position:fixed;inset:0;z-index:-2;overflow:hidden;pointer-events:none;contain:strict}
.blob{position:absolute;border-radius:50%;background:radial-gradient(closest-side,var(--c),transparent);opacity:.62;will-change:transform;animation:drift var(--t,30s) ease-in-out infinite alternate}
.b1{width:90vmax;height:90vmax;left:-32vmax;top:-36vmax;--c:#7a2234;--dx:22vmax;--dy:14vmax}
.b2{width:80vmax;height:80vmax;right:-30vmax;top:-6vmax;--c:#3b4767;--dx:-18vmax;--dy:20vmax;--t:36s}
.b3{width:76vmax;height:76vmax;left:-4vmax;bottom:-40vmax;--c:#58344f;--dx:18vmax;--dy:-16vmax;--t:42s}
.b4{width:58vmax;height:58vmax;right:-14vmax;bottom:-12vmax;--c:#2d4558;--dx:-16vmax;--dy:-12vmax;--t:33s}
.veil{position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(120% 90% at 50% 8%,transparent 30%,rgba(7,8,11,.8))}
@keyframes drift{to{transform:translate3d(var(--dx),var(--dy),0) scale(1.16)}}

/* iOS-style liquid glass */
.glass{position:relative;background:linear-gradient(140deg,rgba(255,255,255,.11),rgba(255,255,255,.035));-webkit-backdrop-filter:blur(var(--blur)) saturate(145%);backdrop-filter:blur(var(--blur)) saturate(145%);border:1px solid rgba(255,255,255,.11);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(255,255,255,.05),0 22px 44px -20px rgba(0,0,0,.6)}
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:.5;transition:opacity .4s;background:radial-gradient(240px circle at var(--mx,28%) var(--my,0%),rgba(255,255,255,.16),transparent 62%)}
@media(hover:hover){.glass:hover::before{opacity:1}}

.nav{position:fixed;top:calc(env(safe-area-inset-top) + 12px);left:12px;right:12px;margin:0 auto;max-width:720px;z-index:20;display:flex;align-items:center;gap:4px;padding:8px 8px 8px 10px;border-radius:999px}
.brand{display:flex;align-items:center;gap:11px;font-weight:800;letter-spacing:.16em;font-size:13px;margin-right:auto}
.mark{display:grid;place-items:center;width:46px;height:32px;border-radius:12px;background:rgba(255,255,255,.07);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 0 0 1px rgba(255,255,255,.06)}
.mark .zl{width:26px}
.nav .l{padding:9px 14px;border-radius:999px;font-size:13px;font-weight:600;color:var(--mute);transition:background .3s,color .3s}
.nav .l:hover{background:rgba(255,255,255,.09);color:var(--ink)}
.nav .btn{height:40px;padding:0 18px;font-size:13px}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:54px;padding:0 26px;border-radius:999px;font-weight:700;font-size:15px;line-height:1;font-family:inherit;border:0;cursor:pointer;color:var(--ink);transition:transform .55s var(--spring)}
.btn:active{transform:scale(.94);transition-duration:.14s}
@media(hover:hover){.btn:hover{transform:scale(1.045)}}
.btn.p{color:#0a0c10;background:linear-gradient(180deg,#fff,#dde2ec);box-shadow:inset 0 1px 0 #fff,inset 0 -2px 6px rgba(0,0,0,.13),0 14px 30px -12px rgba(0,0,0,.7)}
.btn small{font:600 12px/1 inherit;font-family:inherit;opacity:.55}

.wrap{max-width:1160px;margin:0 auto;padding:0 24px}
.hero{min-height:100svh;display:grid;grid-template-columns:1.05fr .95fr;align-items:center;gap:40px;padding-top:112px;padding-bottom:64px}
.in{animation:rise .9s var(--ease) both;animation-delay:var(--d,0s)}
@keyframes rise{from{opacity:0;transform:translate3d(0,22px,0)}to{opacity:1;transform:none}}
.status{display:inline-flex;align-items:center;gap:9px;padding:8px 15px 8px 12px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--mute);margin-bottom:24px}
.dot{width:7px;height:7px;border-radius:50%;background:#8fd6b0;animation:breathe 3.4s ease-in-out infinite}
@keyframes breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.8)}}
h1{font-size:clamp(40px,6.2vw,78px);line-height:1.03;letter-spacing:-.045em;font-weight:800;text-wrap:balance;background:linear-gradient(180deg,#fff 25%,#a3adc1);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;padding-bottom:.08em}
.lead{max-width:46ch;margin:22px 0 34px;color:var(--mute);font-size:clamp(15px,1.6vw,18px);line-height:1.65}
.cta{display:flex;flex-wrap:wrap;gap:12px}

/* phone with standby animation */
.stage{position:relative;display:grid;place-items:center;min-height:640px}
.phone{width:292px;height:604px;border-radius:52px;padding:10px;background:linear-gradient(150deg,rgba(255,255,255,.22),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 40px 80px -30px rgba(0,0,0,.7);animation:float 9s ease-in-out infinite}
@keyframes float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-14px,0)}}
.screen{position:relative;height:100%;border-radius:42px;overflow:hidden;display:flex;flex-direction:column;align-items:center;padding:20px 16px 14px;background:radial-gradient(120% 70% at 50% 0%,#2a1d29,#0a0c12 72%)}
.island{width:86px;height:25px;border-radius:99px;background:#000;margin-bottom:24px}
.clock{font-size:58px;font-weight:800;letter-spacing:-.05em;line-height:1;font-variant-numeric:tabular-nums}
.date{font-size:12px;color:var(--mute);margin-top:7px;font-weight:600;min-height:1.2em}
.orb{position:relative;display:grid;place-items:center;width:108px;height:108px;margin-top:26px;border-radius:34px;background:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.03));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 0 0 1px rgba(255,255,255,.08);animation:orb 5.5s ease-in-out infinite}
.orb .zl{width:62px}
.orb::before,.orb::after{content:"";position:absolute;inset:0;border-radius:inherit;border:1px solid rgba(255,255,255,.25);opacity:0;animation:ripple 5.5s ease-out infinite}
.orb::after{animation-delay:2.75s}
@keyframes orb{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes ripple{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(2)}}
.tiles{position:relative;width:100%;height:158px;margin-top:auto}
.tile{position:absolute;inset:0;border-radius:26px;padding:18px;display:flex;flex-direction:column;justify-content:flex-end;gap:3px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 0 0 1px rgba(255,255,255,.07);opacity:0;animation:cycle 9s var(--ease) infinite both}
.tile::before{content:"";position:absolute;right:-40px;top:-44px;width:150px;height:150px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.22),transparent)}
.tile b{position:relative;font-size:18px;font-weight:800;letter-spacing:-.025em}
.tile span{position:relative;font-size:12.5px;color:rgba(255,255,255,.72)}
.t1{background:linear-gradient(150deg,#8a2a3e,#34121c)}
.t2{background:linear-gradient(150deg,#4b5a82,#1c2237);animation-delay:3s}
.t3{background:linear-gradient(150deg,#6e4563,#2a1827);animation-delay:6s}
@keyframes cycle{0%{opacity:0;transform:translate3d(0,18px,0) scale(.95)}7%,28%{opacity:1;transform:none}35%,100%{opacity:0;transform:translate3d(0,-18px,0) scale(.95)}}
.home{width:108px;height:4px;border-radius:9px;background:rgba(255,255,255,.5);margin-top:14px}
.chip{position:absolute;display:flex;align-items:center;gap:9px;padding:11px 16px 11px 12px;border-radius:999px;font-size:13px;font-weight:700;animation:float 7s ease-in-out infinite}
.chip svg{width:18px;height:18px}
.c1{left:0;top:19%}
.c2{right:0;bottom:17%;animation-delay:-3.5s}
.off,.off *,.off *::before,.off *::after{animation-play-state:paused!important}

section{padding:76px 0}
h2{font-size:clamp(28px,4vw,46px);line-height:1.08;letter-spacing:-.04em;font-weight:800;max-width:18ch;text-wrap:balance}
.sub{color:var(--mute);margin-top:14px;max-width:52ch;line-height:1.65}
.sub a{color:var(--ink);text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(255,255,255,.35)}
.bento{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-top:42px}
.cell{position:relative;display:flex;flex-direction:column;justify-content:flex-end;gap:8px;min-height:210px;padding:26px;border-radius:32px;overflow:hidden}
.cell h3{font-size:20px;font-weight:700;letter-spacing:-.025em;position:relative}
.cell p{color:var(--mute);font-size:14.5px;line-height:1.6;max-width:42ch;position:relative}
.ico{position:relative;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;margin-bottom:auto;background:rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
.art{position:absolute;right:-70px;top:-70px;width:280px;height:280px;border-radius:50%;opacity:.55;background:radial-gradient(closest-side,var(--c),transparent)}
.s4{grid-column:span 4;min-height:300px}.s2{grid-column:span 2}
.a1{--c:#9b2c42}.a2{--c:#5b6c9a}.a3{--c:#82507a}.a4{--c:#9a6a58}.a5{--c:#4f7488}
a.cell{transition:transform .6s var(--spring)}
a.cell:active{transform:scale(.97);transition-duration:.14s}
@media(hover:hover){a.cell:hover{transform:translateY(-6px) scale(1.015)}}

.install{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.install .btn{margin-top:30px}
ol{list-style:none;display:grid;gap:12px;counter-reset:s}
li{counter-increment:s;display:flex;gap:18px;align-items:center;padding:20px 22px;border-radius:26px;font-weight:600;line-height:1.5}
li::after{content:counter(s);order:-1;display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.3);font-weight:800}
li small{display:block;margin-top:2px;color:var(--mute);font-weight:500;font-size:13.5px}

.community{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:42px}
.soc{display:flex;flex-direction:column;gap:22px;padding:26px;border-radius:32px;transition:transform .6s var(--spring)}
.soc:active{transform:scale(.97);transition-duration:.14s}
@media(hover:hover){.soc:hover{transform:translateY(-6px) scale(1.015)}}
.logo{display:grid;place-items:center;width:58px;height:58px;border-radius:20px;color:var(--c);background:color-mix(in srgb,var(--c) 17%,transparent);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),inset 0 0 0 1px color-mix(in srgb,var(--c) 22%,transparent)}
.soc b{display:block;font-size:19px;letter-spacing:-.02em}
.soc div span{display:block;margin-top:5px;color:var(--mute);font-size:14px}

footer{padding:34px 0 calc(40px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.08);color:var(--mute);font-size:13px;font-weight:600}
footer .wrap{display:flex;flex-wrap:wrap;gap:14px 28px;align-items:center;justify-content:space-between}
footer nav{display:flex;gap:22px}
footer a:hover{color:var(--ink)}
footer p{flex:1 1 100%;font-weight:500;font-size:12px;line-height:1.6;opacity:.7;max-width:70ch}

/* auth redirect sheet */
.gate{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:20px;background:rgba(7,8,11,.62);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
.gcard{width:min(400px,100%);padding:36px 26px 26px;border-radius:36px;text-align:center;animation:rise .6s var(--ease) both}
.gcard h2{font-size:26px;margin:0 auto 8px}
.gcard p{color:var(--mute);font-size:14.5px;line-height:1.6;margin-bottom:26px}
.loader{position:relative;width:88px;height:88px;margin:0 auto 22px;filter:url(#goo)}
.loader i{position:absolute;left:50%;top:50%;width:28px;height:28px;margin:-14px;border-radius:50%;background:#fff;animation:orbit 1.9s var(--ease) infinite}
.loader i:nth-child(2){animation-delay:-.63s}.loader i:nth-child(3){animation-delay:-1.26s}
@keyframes orbit{0%{transform:rotate(0) translateX(26px)}50%{transform:rotate(180deg) translateX(7px)}100%{transform:rotate(360deg) translateX(26px)}}
.gcard .btn{width:100%;margin-top:10px}
.gcard .btn.p{margin-top:0}
.skip{margin-top:16px;background:none;border:0;color:var(--mute);font:600 13px inherit;font-family:inherit;cursor:pointer;padding:8px}

/* self-host */
.own{position:relative;display:grid;grid-template-columns:1.05fr .95fr;gap:40px;align-items:center;padding:44px;border-radius:44px;overflow:hidden}
.own::after{content:"";position:absolute;right:-120px;top:-120px;width:420px;height:420px;border-radius:50%;background:radial-gradient(closest-side,rgba(155,44,66,.55),transparent);pointer-events:none}
.own>*{position:relative;z-index:1}
.kick{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8fd6b0;margin-bottom:20px}
.own h2{max-width:16ch}
.perks{display:flex;flex-wrap:wrap;gap:10px;margin:26px 0 30px}
.perk{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:999px;font-size:13.5px;font-weight:700}
.perk svg{width:16px;height:16px;color:#8fd6b0}
.term{border-radius:28px;overflow:hidden;background:rgba(5,6,9,.72);border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 30px 60px -30px rgba(0,0,0,.8)}
.term .bar{display:flex;align-items:center;gap:7px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
.term .bar i{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.18)}
.term .bar i:nth-child(1){background:#ff5f57}.term .bar i:nth-child(2){background:#febc2e}.term .bar i:nth-child(3){background:#28c840}
.term .bar span{margin-left:auto;font-size:12px;font-weight:600;color:var(--mute)}
.term pre{margin:0;padding:20px 22px;font:500 13.5px/1.9 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-x:auto;color:#dfe5f1}
.term pre u{text-decoration:none;color:#6f7a90}
.term pre b{color:#8fd6b0;font-weight:600}
.term .ft{display:flex;align-items:center;gap:12px;padding:14px 18px;border-top:1px solid rgba(255,255,255,.07);font-size:12.5px;color:var(--mute);font-weight:600}
.term .ft .btn{height:36px;padding:0 16px;font-size:12.5px;margin-left:auto}
.fine{margin-top:16px;font-size:12px;line-height:1.6;color:var(--mute);opacity:.75;max-width:60ch}

@media(max-width:900px){
  .own{grid-template-columns:1fr;padding:30px 24px;gap:30px}
  .hero{grid-template-columns:1fr;padding-top:104px;gap:36px}
  .stage{min-height:600px}
  .install{grid-template-columns:1fr;gap:32px}
  .s4{grid-column:span 6}.s2{grid-column:span 3}
}
@media(max-width:640px){
  :root{--blur:12px}
  .nav .l{display:none}
  .s2{grid-column:span 6}
  .community{grid-template-columns:1fr}
  .own{border-radius:32px}
  .perk{flex:1 1 auto;justify-content:center}
  .cell{min-height:190px}
  .btn{height:52px}
  .cta .btn{flex:1 1 100%}
  .chip{display:none}
  section{padding:56px 0}
}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
  .tile{opacity:0}.t1{opacity:1}
}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="goo"><feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="g"/><feComposite in="SourceGraphic" in2="g" operator="atop"/></filter>
    <symbol id="zlogo" viewBox="0 0 884 457"><path fill="#c8102e" d="M728 0H301L173 151l135-94h254L0 454h577l137-155-144 98H187L728 0Z"/><path fill="#f2f2f2" d="M884 0h-93L248 377h93L884 0Z"/></symbol>
    <symbol id="play" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></symbol>
    <symbol id="manga" viewBox="0 0 24 24"><path d="M5 4.5A1.5 1.5 0 016.5 3H19v15H6.5A1.5 1.5 0 005 19.5zM5 19.5A1.5 1.5 0 006.5 21H19v-3"/></symbol>
    <symbol id="novel" viewBox="0 0 24 24"><path d="M4 6c3-1.5 5.5-1.5 8 0 2.5-1.5 5-1.5 8 0v12c-3-1.5-5.5-1.5-8 0-2.5-1.5-5-1.5-8 0zM12 6v12"/></symbol>
    <symbol id="lib" viewBox="0 0 24 24"><path d="M7 4h10v16l-5-3.5L7 20z"/></symbol>
    <symbol id="globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></symbol>
    <symbol id="dl" viewBox="0 0 24 24"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></symbol>
    <symbol id="check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
    <symbol id="offline" viewBox="0 0 24 24"><path d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M5 19h14"/></symbol>
    <symbol id="discord" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></symbol>
    <symbol id="telegram" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></symbol>
    <symbol id="github" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></symbol>
  </defs>
</svg>

<div class="liquid" aria-hidden="true"><i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i><i class="blob b4"></i></div>
<div class="veil" aria-hidden="true"></div>

<header class="nav glass">
  <a class="brand" href="#top" aria-label="ZENKAI home"><span class="mark"><svg class="zl" viewBox="0 0 884 457" aria-hidden="true"><use href="#zlogo"/></svg></span>ZENKAI</a>
  <a class="l" href="#features">Features</a>
  <a class="l" href="#install">Install</a>
  <a class="l" href="#selfhost">Self-host</a>
  <a class="l" href="#community">Community</a>
  <a class="btn p" href="${apk}" rel="noopener">Download</a>
</header>

<main id="top">
  <div class="wrap hero">
    <div>
      <div class="status glass in" style="--d:.05s"><span class="dot"></span>${status}</div>
      <h1 class="in" style="--d:.15s">Watch anime. Read manga and novels.</h1>
      <p class="lead in" style="--d:.3s">Zenkai puts anime streaming, manga and light novels in one focused Android app, with your library, downloads and account in sync.</p>
      <div class="cta in" style="--d:.45s">
        <a class="btn p" href="${apk}" rel="noopener"><svg class="i"><use href="#dl"/></svg>Download APK<small>${dlMeta.replace(" · ", "")}</small></a>
        <a class="btn glass" href="${WEB}" target="_blank" rel="noopener"><svg class="i"><use href="#globe"/></svg>Open web app</a>
      </div>
    </div>

    <div class="stage in" id="stage" style="--d:.35s" aria-hidden="true">
      <div class="phone">
        <div class="screen">
          <div class="island"></div>
          <div class="clock" id="clock">9:41</div>
          <div class="date" id="date"></div>
          <div class="orb"><svg class="zl" viewBox="0 0 884 457"><use href="#zlogo"/></svg></div>
          <div class="tiles">
            <div class="tile t1"><b>Anime</b><span>Servers, PiP and downloads</span></div>
            <div class="tile t2"><b>Manga</b><span>Your progress stays in sync</span></div>
            <div class="tile t3"><b>Novels</b><span>A quiet reader for long stories</span></div>
          </div>
          <div class="home"></div>
        </div>
      </div>
      <div class="chip glass c1"><svg class="i"><use href="#check"/></svg>Progress synced</div>
      <div class="chip glass c2"><svg class="i"><use href="#offline"/></svg>Ready offline</div>
    </div>
  </div>

  <section id="features">
    <div class="wrap">
      <h2>One place to watch and read</h2>
      <p class="sub">Everything you follow lives in the same app, with the same account.</p>
      <div class="bento">
        <article class="cell glass s4"><i class="art a1"></i><span class="ico"><svg class="i"><use href="#play"/></svg></span><h3>Anime</h3><p>Stream from multiple servers with Picture-in-Picture and caption translation for supported subtitles. Download episodes to watch offline.</p></article>
        <article class="cell glass s2"><i class="art a2"></i><span class="ico"><svg class="i"><use href="#manga"/></svg></span><h3>Manga</h3><p>Several viewer modes and reading directions. Progress syncs and chapters download for offline reading.</p></article>
        <article class="cell glass s2"><i class="art a3"></i><span class="ico"><svg class="i"><use href="#novel"/></svg></span><h3>Novels</h3><p>A clean, distraction-free reader built for long-form stories.</p></article>
        <article class="cell glass s2"><i class="art a4"></i><span class="ico"><svg class="i"><use href="#lib"/></svg></span><h3>Library and account</h3><p>A watchlist, a download manager with storage tracking, and one login.</p></article>
        <a class="cell glass s2" href="${WEB}" target="_blank" rel="noopener"><i class="art a5"></i><span class="ico"><svg class="i"><use href="#globe"/></svg></span><h3>Zenkai Web</h3><p>Prefer a bigger screen? Open the same experience in your browser.</p></a>
      </div>
    </div>
  </section>

  <section id="install">
    <div class="wrap install">
      <div>
        <h2>Install in three steps</h2>
        <p class="sub">Zenkai is distributed as an APK on GitHub, and each release is submitted to VirusTotal for an independent scan. See the <a href="${esc((rel && rel.url) || RELEASES)}" target="_blank" rel="noopener">release notes</a>.</p>
        <a class="btn p" href="${apk}" rel="noopener"><svg class="i"><use href="#dl"/></svg>Get ${tag || "the latest APK"}</a>
      </div>
      <ol>
        <li class="glass"><div>Download the APK<small>Tap the button and open the file when it finishes.</small></div></li>
        <li class="glass"><div>Allow the install<small>If Android asks, allow installs from your browser.</small></div></li>
        <li class="glass"><div>Open Zenkai and sign in<small>You will be sent back to the app automatically.</small></div></li>
      </ol>
    </div>
  </section>

  <section id="selfhost">
    <div class="wrap">
      <div class="own glass">
        <div>
          <span class="kick glass"><svg class="i" style="width:15px;height:15px"><use href="#globe"/></svg>Host it yourself</span>
          <h2>Run Zenkai on your own computer</h2>
          <p class="sub">Don&#39;t want to depend on anyone&#39;s server? Zenkai&#39;s web app is open source. Run your own private copy on a laptop, PC or even your phone, in a couple of minutes.</p>
          <div class="perks">
            <span class="perk glass"><svg class="i"><use href="#check"/></svg>0 ads</span>
            <span class="perk glass"><svg class="i"><use href="#check"/></svg>0 cost</span>
            <span class="perk glass"><svg class="i"><use href="#check"/></svg>No account needed</span>
            <span class="perk glass"><svg class="i"><use href="#check"/></svg>Your copy, your rules</span>
          </div>
          <div class="cta">
            <a class="btn p" href="${SELF}" target="_blank" rel="noopener"><svg class="b" style="width:20px;height:20px"><use href="#github"/></svg>Get the source</a>
            <a class="btn glass" href="${SELF}#run-it" target="_blank" rel="noopener">Read the guide</a>
          </div>
          <p class="fine">Needs Node.js 18 or newer. Zenkai hosts no video itself. Metadata comes from public services such as AniList and Jikan, so an internet connection is still required.</p>
        </div>
        <div class="term" role="group" aria-label="Self-host commands">
          <div class="bar"><i></i><i></i><i></i><span>terminal</span></div>
<pre id="cmds"><u># 1. grab the code</u>
git clone ${SELF}.git
cd Zenkai

<u># 2. install and start</u>
npm install
npm run dev

<u># 3. open it</u>
<b>http://localhost:5173</b></pre>
          <div class="ft">Works on Windows, macOS, Linux and Termux<button class="btn glass" type="button" id="cp">Copy</button></div>
        </div>
      </div>
    </div>
  </section>

  <section id="community">
    <div class="wrap">
      <h2>Join the community</h2>
      <p class="sub">Get help, hear about updates first and follow the code.</p>
      <div class="community">
        <a class="soc glass" style="--c:#7b88ff" href="${DISCORD}" target="_blank" rel="noopener"><span class="logo"><svg class="b" role="img" aria-label="Discord"><use href="#discord"/></svg></span><div><b>Discord</b><span>Community, support and discussion</span></div></a>
        <a class="soc glass" style="--c:#4fb8ec" href="${TELEGRAM}" target="_blank" rel="noopener"><span class="logo"><svg class="b" role="img" aria-label="Telegram"><use href="#telegram"/></svg></span><div><b>Telegram</b><span>Updates and announcements</span></div></a>
        <a class="soc glass" style="--c:#f3f5f9" href="${GITHUB}" target="_blank" rel="noopener"><span class="logo"><svg class="b" role="img" aria-label="GitHub"><use href="#github"/></svg></span><div><b>GitHub</b><span>Source code and releases</span></div></a>
      </div>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <span>ZENKAI${tag ? " " + tag : ""}</span>
    <nav><a href="${DISCORD}" target="_blank" rel="noopener">Discord</a><a href="${TELEGRAM}" target="_blank" rel="noopener">Telegram</a><a href="${GITHUB}" target="_blank" rel="noopener">GitHub</a></nav>
    <p>Zenkai hosts zero content and has no affiliation with the content providers available through the app.</p>
  </div>
</footer>

<div class="gate" id="gate" role="dialog" aria-modal="true" aria-labelledby="gt" hidden>
  <div class="gcard glass">
    <div class="loader" id="loader" aria-hidden="true"><i></i><i></i><i></i></div>
    <h2 id="gt">Opening ZENKAI</h2>
    <p id="gs">Connecting your account and sending you back to the app.</p>
    <a class="btn p" id="gopen" href="#" hidden>Open ZENKAI app</a>
    <a class="btn glass" href="${apk}" rel="noopener">Download latest APK</a>
    <button class="skip" id="skip" type="button">Stay on this page</button>
  </div>
</div>

<script>
(function () {
  var b = document.getElementById("cp"), c = document.getElementById("cmds");
  if (!b || !c) return;
  b.addEventListener("click", function () {
    var t = c.textContent.split(String.fromCharCode(10)).filter(function (l) { return l && l.charAt(0) !== "#" && l.indexOf("http") !== 0; }).join(String.fromCharCode(10));
    var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, done); else done();
  });
})();
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var params = (location.search || "") + (location.hash || "");
  var intent = ${JSON.stringify(share)};
  var deepLink = "aniverse://login-callback" + params;
  var gate = $("gate");

  $("gopen").href = intent ? intent.b : deepLink;

  if (intent) {
    gate.hidden = false;
    $("gt").textContent = "Opening in ZENKAI";
    $("gs").textContent = "Taking you to what was shared with you.";
    // ponytail: auto-open uses the intent without the APK fallback, so a missing app leaves this page open instead of bouncing to the download
    try { location.href = intent.a; } catch (_) {}
    setTimeout(function () {
      $("gopen").hidden = false;
      $("loader").hidden = true;
      $("gt").textContent = "Open in ZENKAI";
      $("gs").textContent = "Tap below to open it. No app yet? It takes you to the download.";
    }, 1500);
  } else if (params.length > 0 || ${isCallback ? "true" : "false"}) {
    gate.hidden = false;
    try { location.href = deepLink; } catch (_) {}
    setTimeout(function () {
      $("gopen").hidden = false;
      $("loader").hidden = true;
      $("gt").textContent = "Tap to open the app";
      $("gs").textContent = "If ZENKAI didn't open on its own, use the button below.";
    }, 1200);
  }
  $("skip").onclick = function () { gate.hidden = true; };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") gate.hidden = true; });

  function tick() {
    var d = new Date();
    $("clock").textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: false });
    $("date").textContent = d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
  }
  tick();
  setInterval(tick, 15000);

  // pause the phone's animations while it is off screen
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("off", !e.isIntersecting); });
    }).observe($("stage"));
  }

  // specular highlight follows the pointer across glass (mouse only)
  if (matchMedia("(hover:hover)").matches) {
    document.addEventListener("pointermove", function (e) {
      var g = e.target.closest && e.target.closest(".glass");
      if (!g) return;
      var r = g.getBoundingClientRect();
      g.style.setProperty("--mx", (e.clientX - r.left) + "px");
      g.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });
  }
})();
</script>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-cache" }
    });
  }
};
