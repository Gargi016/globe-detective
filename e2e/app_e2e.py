"""Whole-app checks: every route, globe rendering, Home search and selection, 404, accessibility (axe-core),
console errors, persistence across reload, mobile overflow. Needs `npm run build && npx vite preview --port 4173`."""
import json, os, re
from playwright.sync_api import sync_playwright

ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AXE = open(os.path.join(ROOT, 'node_modules/axe-core/axe.min.js')).read()
BASE = 'http://localhost:4173/#/'
fails = []

def check(name, ok, detail=''):
    print(('  ok   ' if ok else '  FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''))
    if not ok: fails.append(name)

ROUTES = [('', 'Globe Detective', 'Home'), ('timeline', 'Timeline', 'Timeline'), ('detective', 'Detective', 'Detective'),
          ('challenge', 'Challenge', 'Challenge'), ('profile', 'Profile', 'Profile'), ('about', 'About', 'About')]

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': 1280, 'height': 850})
    pg = ctx.new_page(); pg.set_default_timeout(90000)
    errors = []
    # Network failures to third-party hosts (fonts) are environment-dependent and are not app errors.
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)[:200]))
    pg.on('console', lambda m: errors.append('CONSOLE ' + m.text[:200]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)

    print('== every route renders, with a title, a heading, a current nav link and no axe violations')
    for path, title, label in ROUTES:
        pg.goto(BASE + path); pg.wait_for_selector('main h1', state='attached'); pg.wait_for_timeout(2500)
        check(f'/{path}: title', title.lower() in pg.title().lower(), pg.title())
        check(f'/{path}: one h1', pg.locator('main h1').count() == 1, str(pg.locator('main h1').count()))
        cur = pg.locator('.nav__link[aria-current="page"]')
        check(f'/{path}: nav marks current page', cur.count() == 1 and label.lower() in cur.inner_text().lower(), cur.all_inner_texts().__str__())
        pg.evaluate(AXE)
        v = pg.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa','best-practice']}).then(r=>r.violations.map(x=>x.id+':'+x.nodes[0].target.join(' ')))")
        check(f'/{path}: axe violations none', v == [], str(v))

    print('== unknown address')
    pg.goto(BASE + 'nonsense'); pg.wait_for_selector('main h1', state='attached')
    check('404 page shown', 'not found' in pg.inner_text('main h1').lower())
    check('404 offers links back', pg.locator('main a[href="#/"]').count() >= 1)
    check('404 has no current nav link', pg.locator('.nav__link[aria-current="page"]').count() == 0)

    print('== skip link and focus management')
    pg.goto(BASE + 'about'); pg.reload(); pg.wait_for_selector('main h1', state='attached')
    pg.keyboard.press('Tab')
    check('skip link is first focusable', pg.evaluate('document.activeElement.className') == 'skip-link', pg.evaluate('document.activeElement.className'))
    pg.keyboard.press('Enter')
    check('skip link moves focus to main', pg.evaluate('document.activeElement.id') == 'main')
    check('skip link keeps the route', pg.evaluate('location.hash') == '#/about')
    pg.get_by_role('link', name='Profile').first.click(); pg.wait_for_selector('.profile', state='attached')
    check('navigation moves focus to main', pg.evaluate('document.activeElement.id') == 'main')
    check('navigation is announced', 'profile' in pg.locator('p.sr-only[role=status]').inner_text().lower())

    print('== globe rendering and Home search/selection')
    pg.goto(BASE); pg.wait_for_selector('canvas', state='attached')
    pg.wait_for_function("document.querySelector('.globe-loader')?.dataset.visible === 'false'")
    box = pg.locator('canvas').bounding_box()
    check('globe canvas has real size', box['width'] > 400 and box['height'] > 300, str(box))
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(pg.locator('canvas').screenshot())).convert('RGB').resize((64, 64))
    check('canvas drew something (not blank)', len(set(img.getdata())) > 40, str(len(set(img.getdata()))))
    inp = pg.get_by_role('combobox'); inp.click(); inp.fill('burma')
    check('search finds Burma', any('burma' in t.lower() or 'myanmar' in t.lower() for t in pg.get_by_role('option').all_inner_texts()))
    inp.fill('zzzz'); check('search empty state', pg.locator('.search__empty').count() == 1)
    inp.fill('fran'); inp.press('Enter'); pg.wait_for_selector('.panel__title')
    check('selecting opens the country panel', 'france' in pg.inner_text('.panel__title').lower())
    for name in ['Zoom in', 'Zoom out', 'Reset view']:
        btn = pg.get_by_role('button', name=name); btn.click(); check(f'{name} works', btn.is_enabled())
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check('Escape clears selection', pg.locator('.panel__title').count() == 0)

    print('== globe pages unmount cleanly when navigating repeatedly')
    for _ in range(3):
        for r in ['timeline', 'detective', '']:
            pg.goto(BASE + r); pg.wait_for_selector('canvas', state='attached'); pg.wait_for_timeout(400)
    check('canvas count stays at 1', pg.locator('canvas').count() == 1, str(pg.locator('canvas').count()))

    print('== persistence across reload')
    pg.goto(BASE + 'profile'); pg.wait_for_selector('.profile', state='attached')
    pg.get_by_role('button', name='Rename').click(); pg.fill('#profile-name', 'Persist Test'); pg.get_by_role('button', name='Save').click()
    pg.reload(); pg.wait_for_selector('.profile', state='attached')
    check('profile name survives reload', 'persist test' in pg.inner_text('[data-testid=profile-name]').lower())
    pg.evaluate("localStorage.setItem('globe-detective:profile:v1','{broken')")
    pg.reload(); pg.wait_for_selector('.profile', state='attached')
    check('corrupt storage recovers to defaults', 'anonymous detective' in pg.inner_text('[data-testid=profile-name]').lower())
    pg.evaluate("localStorage.clear()")

    print('== reduced motion is honoured')
    pg2 = b.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce').new_page()
    pg2.goto(BASE + 'about'); pg2.wait_for_selector('main h1', state='attached')
    check('page animation is effectively off', pg2.evaluate("parseFloat(getComputedStyle(document.querySelector('.page')).animationDuration) < 0.01"))

    print('== mobile (390 px and 360 px)')
    for w in (390, 360):
        m = b.new_context(viewport={'width': w, 'height': 800}, has_touch=True, is_mobile=True).new_page(); m.set_default_timeout(90000)
        for path, _, _ in ROUTES:
            m.goto(BASE + path); m.wait_for_selector('main h1', state='attached'); m.wait_for_timeout(1200)
            sw = m.evaluate('document.documentElement.scrollWidth')
            check(f'{w}px /{path}: no horizontal overflow', sw <= w, str(sw))
        m.goto(BASE); m.wait_for_selector('canvas', state='attached')
        gb = m.locator('canvas').bounding_box()
        check(f'{w}px globe has real size', gb['width'] > w * 0.8 and gb['height'] > 250, str(gb))

    check('no console or page errors', not errors, str(errors[:3]))
    b.close()

print('\nFAILED:', fails if fails else 'none')
raise SystemExit(1 if fails else 0)
