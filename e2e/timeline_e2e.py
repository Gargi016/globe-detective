import re, sys
from playwright.sync_api import sync_playwright
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
import tempfile
SS = tempfile.gettempdir() + "/"
errors = []
fails = []
def check(name, ok, detail=""):
    print(("  ok   " if ok else "  FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    if not ok: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={"width": 1366, "height": 900}); pg.set_default_timeout(90000)
    pg.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)[:200]))
    pg.on("console", lambda m: errors.append("CONSOLE " + m.text[:160]) if m.type == "error" and "ERR_TUNNEL" not in m.text and "Failed to load resource" not in m.text else None)

    def goto_year(y, a=None, gw=None):
        q = f"year={y}" + (f"&a={a}" if a else "") + (f"&gw={gw}" if gw else "")
        pg.goto(f"http://localhost:4173/#/timeline?{q}", wait_until="domcontentloaded")
        pg.reload(wait_until="domcontentloaded", timeout=90000)
        pg.wait_for_function("document.querySelector('.snapshot-line')?.innerText.includes('polygons') || document.querySelector('.snapshot-line')?.innerText.includes('No data')", timeout=40000)
        pg.wait_for_timeout(1800)

    print("== Timeline page loads with a snapshot")
    goto_year(1980)
    check("snapshot line shows 1 Jan 1980", "1 Jan 1980" in pg.locator(".snapshot-line").inner_text(), pg.locator(".snapshot-line").inner_text())
    n_poly = int(re.search(r"(\d+) polygons", pg.locator(".snapshot-line").inner_text()).group(1))
    check("1980 has plausible polygon count", 120 <= n_poly <= 200, str(n_poly))
    check("legend shows independent count", pg.locator(".legend__count").first.count() == 1)
    check("canvas present", pg.locator("canvas").count() >= 1)

    print("== Hover tooltip uses the historical name")
    box = pg.locator("canvas").first.bounding_box()
    pg.mouse.move(box["x"] + box["width"]/2, box["y"] + box["height"]/2); pg.wait_for_timeout(800)
    tip = pg.evaluate("document.querySelector('.globe-tooltip')?.innerText") or ""
    print("   tooltip:", tip.replace("\n", " | "))
    check("tooltip present", tip != "")

    print("== Eight case files")
    expected = {"Soviet Union": "Soviet Union", "Yugoslavia": "Yugoslavia", "Czechoslovakia": "Czechoslovakia", "East Germany": "East Germany", "West Germany": "West Germany", "Ceylon": "Ceylon", "Burma": "Burma", "Rhodesia": "Rhodesia"}
    for label, name in expected.items():
        pg.get_by_role("button", name=label, exact=True).click()
        pg.wait_for_selector(".panel__title", timeout=15000); pg.wait_for_timeout(900)
        title = pg.locator(".panel__title").inner_text()
        year = pg.locator("#timeline-year").input_value()
        badge = pg.locator(".name-line").locator("xpath=preceding::span[contains(@class,'badge')][1]").inner_text() if pg.locator(".name-line").count() else "?"
        srcs = pg.locator(".panel__section .sources a").count()
        check(f"case '{label}' -> {year}: panel title '{title}', badge {badge}, sources {srcs}", title == name and srcs > 0, f"title={title}")

    print("== Names change with the year (same entity, different year)")
    for y, expect in [(1950, "Southern Rhodesia"), (1970, "Rhodesia"), (1979, "Rhodesia (British-supervised transition)"), (1981, "Zimbabwe")]:
        goto_year(y, a=("end" if y == 1979 else None), gw=552)
        t = pg.locator(".panel__title").inner_text()
        check(f"gw 552 in {y}: '{t}'", t == expect, t)
    goto_year(1960, gw=552)
    warn = pg.locator(".callout--warn").inner_text() if pg.locator(".callout--warn").count() else ""
    check("Rhodesia 1960 -> 'Not present' explanation (federation gap)", "Not present" in warn, warn[:80])
    check("...and the federation note is shown", "Federation" in pg.locator(".notes").inner_text() if pg.locator(".notes").count() else False)

    print("== Missing coverage")
    for y, word in [(1850, "before"), (2020, "after"), (1885, "before"), (2026, "after")]:
        goto_year(y)
        notice = pg.locator(".coverage").inner_text() if pg.locator(".coverage").count() else ""
        line = pg.locator(".snapshot-line").inner_text()
        legend_counts = pg.locator(".legend__count").count()
        check(f"{y}: coverage notice shown, no polygons, no legend counts", "outside dataset coverage" in notice.lower() and "no data" in line.lower() and legend_counts == 0, notice[:60] + " | " + line)
    check("2026 notice offers modern borders link", pg.locator(".coverage a[href='#/']").count() == 1)
    goto_year(1886); check("1886 is covered", pg.locator(".coverage").count() == 0 and "1 Jan 1886" in pg.locator(".snapshot-line").inner_text())
    goto_year(2019, a="end"); check("2019-12-31 is covered", pg.locator(".coverage").count() == 0 and "31 Dec 2019" in pg.locator(".snapshot-line").inner_text())
    goto_year(1700); pg.get_by_role("button", name="Go to 1886").click(); pg.wait_for_timeout(1500)
    check("'Go to 1886' button works", pg.locator("#timeline-year").input_value() == "1886" and pg.locator(".coverage").count() == 0)

    print("== Timeline controls")
    goto_year(1960)
    pg.locator(".track__slider").focus(); pg.keyboard.press("ArrowRight"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(500)
    check("slider keyboard: 1960 -> 1962", pg.locator("#timeline-year").input_value() == "1962", pg.locator("#timeline-year").input_value())
    pg.get_by_role("button", name="Forward 10 years").click(); pg.wait_for_timeout(500); check("+10 -> 1972", pg.locator("#timeline-year").input_value() == "1972")
    pg.get_by_role("button", name="Back 1 year").click(); pg.wait_for_timeout(500); check("-1 -> 1971", pg.locator("#timeline-year").input_value() == "1971")
    pg.get_by_role("button", name="31 Dec").click(); pg.wait_for_timeout(600)
    check("anchor 31 Dec shows date", "31 Dec 1971" in pg.locator(".timebar__date").inner_text(), pg.locator(".timebar__date").inner_text())
    pg.get_by_role("button", name="1 Jan").click()
    inp = pg.locator("#timeline-year"); inp.fill("1914"); pg.wait_for_timeout(1200)
    check("typing a year works", "1 Jan 1914" in pg.locator(".timebar__date").inner_text())
    pg.get_by_role("button", name="Notable ▸").click(); pg.wait_for_timeout(600)
    nxt = pg.locator("#timeline-year").input_value(); check(f"'Notable ▸' jumps forward ({nxt})", int(nxt) > 1914)

    print("== Changes tab")
    goto_year(1990); pg.get_by_role("tab", name="Changes").click(); pg.wait_for_timeout(500)
    txt = pg.locator(".tabs__panel").inner_text()
    check("1990 changes mention East Germany ends", "East Germany ends" in txt, txt[:200])
    goto_year(1972); pg.get_by_role("tab", name="Changes").click(); pg.wait_for_timeout(400)
    txt = pg.locator(".tabs__panel").inner_text()
    check("1972 lists Ceylon → Sri Lanka with sources", "Ceylon → Sri Lanka" in txt and pg.locator(".change .sources a").count() > 0)
    goto_year(1948); pg.get_by_role("tab", name="Changes").click(); pg.wait_for_timeout(400)
    txt = pg.locator(".tabs__panel").inner_text()
    check("1948 lists Burma and Ceylon status changes", "Colony → Independent" in txt.replace("colony → independent", "Colony → Independent") or "colony → independent" in txt, txt[:300])
    pg.locator(".change__btn").first.click(); pg.wait_for_timeout(800)
    check("clicking a change opens its entity card", pg.locator(".panel__title").count() == 1)

    print("== Find tab")
    goto_year(2000); pg.get_by_role("tab", name="Find").click()
    pg.locator("#entity-finder").fill("east germany"); pg.wait_for_timeout(300)
    check("finder lists East Germany as not in this snapshot", "not in this snapshot" in pg.locator(".finder__list").inner_text())
    pg.locator(".finder__item").first.click(); pg.wait_for_timeout(1500)
    y = pg.locator("#timeline-year").input_value()
    check(f"picking absent state opens nearest year ({y}) and selects it", y == "1990" and "East Germany" in pg.locator(".panel__title").inner_text(), y + " " + (pg.locator(".panel__title").inner_text() if pg.locator(".panel__title").count() else "no title"))
    pg.get_by_role("tab", name="Find").click(); pg.locator("#entity-finder").fill("ceylon"); pg.wait_for_timeout(300)
    check("finder finds Ceylon by old name (shown as Sri Lanka in 1990)", "Sri Lanka" in pg.locator(".finder__list").inner_text(), pg.locator(".finder__list").inner_text()[:100])

    print("== Deep link + URL sync")
    goto_year(1965, gw=775)
    check("deep link restores year and entity", pg.locator("#timeline-year").input_value() == "1965" and "Burma" in pg.locator(".panel__title").inner_text())
    pg.get_by_role("button", name="Forward 1 year").click(); pg.wait_for_timeout(400)
    check("URL updates with year", "year=1966" in pg.evaluate("location.hash"), pg.evaluate("location.hash"))

    print("== Regression: Home page still works")
    pg.goto("http://localhost:4173/#/", wait_until="domcontentloaded"); pg.reload(wait_until="domcontentloaded", timeout=90000)
    pg.wait_for_selector("canvas", timeout=30000)
    pg.wait_for_function("document.querySelector('.globe-loader')?.dataset.visible === 'false'", timeout=40000)
    inp = pg.get_by_role("combobox"); inp.click(); inp.fill("brazil"); inp.press("Enter"); pg.wait_for_selector(".panel__title")
    check("Home: search + selection + panel", pg.locator(".panel__title").inner_text() == "Brazil")
    check("Home: still modern (no timeline UI)", pg.locator(".timebar").count() == 0)

    print("== Mobile layout")
    m = b.new_page(viewport={"width": 390, "height": 844})
    m.on("pageerror", lambda e: errors.append("MOBILE PAGEERROR " + str(e)[:200]))
    m.goto("http://localhost:4173/#/timeline?year=1965&gw=552", wait_until="domcontentloaded")
    m.wait_for_function("document.querySelector('.snapshot-line')?.innerText.includes('polygons')", timeout=40000); m.wait_for_timeout(2500)
    sw = m.evaluate("document.documentElement.scrollWidth")
    check(f"mobile: no horizontal overflow ({sw}/390)", sw <= 390)
    gb = m.locator(".globe-view").bounding_box()
    check(f"mobile: globe has real size ({gb['width']:.0f}x{gb['height']:.0f})", gb["width"] > 300 and gb["height"] > 300)
    b.close()

print("\nERRORS:", errors[:8] if errors else "none")
print("FAILED:", fails if fails else "none")
