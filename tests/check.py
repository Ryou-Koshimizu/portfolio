"""ポートフォリオの全件試験（実ブラウザ）。

Chromium と WebKit で、25 種の画面の大きさについて次を確かめる。
- 横はみ出し 0（ページ全体・各要素）
- ヘッダーの高さ 80px、ヒーローの高さ = 画面の高さ − 80px
- ヒーローの中身（肩書き・名前・説明・ボタン）が最初の画面に収まる
- コンソールのエラー 0、WebGL で描けている
- ページ内リンクの行き先がある
加えて、パソコン幅とスマホ幅で axe（WCAG 2.1 A/AA）の違反 0。

使い方: python3 tests/check.py   （失敗が1件でもあれば終了コード 1）
"""
import json
import pathlib
import sys
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()

SIZES = [
    (280, 653), (320, 568), (360, 640), (375, 667), (390, 844), (393, 852), (412, 915), (430, 932),
    (568, 320), (667, 375), (844, 390), (932, 430), (600, 960), (768, 1024), (820, 1180), (1024, 768),
    (1024, 1366), (1180, 820), (1280, 720), (1366, 768), (1440, 900), (1536, 864), (1920, 1080),
    (2560, 1440), (3840, 2160),
]

PROBE = """() => {
  const vw = innerWidth, vh = innerHeight, bad = [];
  const head = document.querySelector('.site-head').getBoundingClientRect();
  const hero = document.getElementById('top').getBoundingClientRect();
  if (Math.abs(head.height - 80) > 0.5) bad.push('header height ' + head.height);
  if (Math.abs(hero.height - (vh - 80)) > 1) bad.push('hero height ' + hero.height + ' (want ' + (vh - 80) + ')');
  if (Math.abs(hero.top - 80) > 1) bad.push('hero top ' + hero.top);
  for (const sel of ['.chip', '.name', '.lead', '.cta']) {
    const r = document.querySelector('#top ' + sel).getBoundingClientRect();
    if (r.top < 80 - 0.5 || r.bottom > vh + 0.5) bad.push(sel + ' outside first view ' + Math.round(r.top) + '-' + Math.round(r.bottom));
    if (r.left < -0.5 || r.right > vw + 0.5) bad.push(sel + ' wider than screen ' + Math.round(r.left) + '-' + Math.round(r.right));
  }
  for (const b of document.querySelectorAll('#top .cta .btn')) {
    const r = b.getBoundingClientRect();
    if (r.bottom > vh + 0.5) bad.push('button below first view');
  }
  const nav = document.querySelector('.nav').getBoundingClientRect();
  if (nav.left < 0 || nav.right > vw) bad.push('nav wider than screen ' + Math.round(nav.width));
  if (document.documentElement.scrollWidth > vw) bad.push('page scrollWidth ' + document.documentElement.scrollWidth);
  const track = document.getElementById('track');
  for (const el of track.querySelectorAll('*')) {
    if (el.closest('.marquee') || el.closest('.gl-text.giant')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > vw + 1 || r.left < -1) { bad.push('overflow ' + el.tagName + '.' + el.className + ' ' + Math.round(r.left) + '-' + Math.round(r.right)); break; }
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0 && !el.closest('.marquee')) {
      bad.push('text overflow ' + el.tagName + '.' + el.className); break;
    }
  }
  for (const a of document.querySelectorAll('a[href^="#"]')) {
    const id = a.getAttribute('href').slice(1);
    if (id && !document.getElementById(id)) bad.push('missing anchor #' + id);
  }
  if (!document.documentElement.classList.contains('gl')) bad.push('WebGL not active');
  return bad;
}"""


def main() -> int:
    failures = []
    checks = 0
    with sync_playwright() as p:
        for name, launcher in (("chromium", p.chromium), ("webkit", p.webkit)):
            browser = launcher.launch(headless=True)
            for w, h in SIZES:
                page = browser.new_page(viewport={"width": w, "height": h})
                errors = []
                page.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
                page.on("console", lambda m, errors=errors: errors.append(m.text) if m.type == "error" else None)
                page.goto(URL)
                page.wait_for_timeout(900)
                bad = page.evaluate(PROBE) + ["console: " + e for e in errors]
                checks += 1
                if bad:
                    failures.append(f"{name} {w}x{h}: " + "; ".join(bad))
                page.close()
            # axe
            for w, h in ((1440, 900), (390, 844)):
                page = browser.new_page(viewport={"width": w, "height": h})
                page.goto(URL)
                page.wait_for_timeout(600)
                page.evaluate("() => document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('in'))")
                page.wait_for_timeout(1600)
                page.add_script_tag(url="https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js")
                res = page.evaluate("() => axe.run(document, {runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa']}).then(r => r.violations.map(v => v.id + ' x' + v.nodes.length))")
                checks += 1
                if res:
                    failures.append(f"{name} axe {w}x{h}: " + ", ".join(res))
                page.close()
            browser.close()
    # 外へのリンク
    html = (ROOT / "index.html").read_text()
    import re
    for url in sorted(set(re.findall(r'<a[^>]+href="(https://[^"]+)"', html))):
        if "fonts.googleapis" in url:
            continue
        checks += 1
        try:
            req = urllib.request.Request(url, method="GET", headers={"User-Agent": "portfolio-check"})
            code = urllib.request.urlopen(req, timeout=20).status
        except Exception as e:  # noqa: BLE001
            code = getattr(e, "code", str(e))
        if code != 200:
            failures.append(f"link {url}: {code}")
    print(f"checks: {checks}, failures: {len(failures)}")
    for f in failures:
        print("  -", f)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
