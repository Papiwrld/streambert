"""Run with Vite on port 5173: python tests/browser/regressions.py.

Requires Python Playwright and its Chromium browser. API responses are fixtures;
no credentials, external players, or user data are used.
"""
import asyncio
from urllib.parse import parse_qs, urlparse

from playwright.async_api import async_playwright, expect

BASE = "http://127.0.0.1:5173"
SERIES = {
    "id": 123, "name": "Fixture Series", "media_type": "tv",
    "original_language": "en", "genres": [], "genre_ids": [],
    "first_air_date": "2020-01-01", "overview": "A test series.",
    "seasons": [{"season_number": n, "episode_count": 3} for n in (1, 2)],
}


async def fixture(browser, delayed_details=False, delayed_rating=False):
    page = await browser.new_page(viewport={"width": 1280, "height": 800})
    page.set_default_timeout(5000)
    await page.add_init_script("localStorage.setItem('streambert_playerSource', '\"videasy\"')")

    async def api(route):
        path = urlparse(route.request.url).path
        data = {"results": [], "cast": [], "crew": []}
        if path == "/3/tv/123":
            if delayed_details:
                await asyncio.sleep(0.7)
            data = SERIES
        elif path == "/3/tv/123/content_ratings" and delayed_rating:
            await asyncio.sleep(0.7)
            data = {"results": [{"iso_3166_1": "US", "rating": "TV-MA"}]}
        elif "/season/" in path:
            season = int(path.rsplit("/", 1)[1])
            data = {"id": season, "episodes": [
                {"id": season * 10 + n, "episode_number": n,
                 "season_number": season, "name": f"Episode {n}",
                 "air_date": "2020-01-01", "overview": "", "runtime": 40}
                for n in (1, 2, 3)
            ]}
        await route.fulfill(json=data)

    await page.route("https://api.themoviedb.org/**", api)
    await page.route("https://image.tmdb.org/**", lambda route: route.abort())
    await page.goto(BASE + "/tests/browser/fixture.html")
    await page.wait_for_function("typeof window.mountTV === 'function'")
    return page


async def dropdown_keyboard(browser):
    page = await fixture(browser)
    try:
        await page.evaluate("mountSettings()")
        select = page.locator(".lumen-select").first
        await select.locator("button").first.click()
        option = select.get_by_role("option").nth(1)
        label = await option.inner_text()
        await option.focus()
        await page.keyboard.press("Enter")
        await expect(select.locator(".lumen-select__trigger")).to_have_text(label.strip(), timeout=1500)
        await expect(select.get_by_role("listbox")).to_have_count(0)
        await expect(select.locator(".lumen-select__trigger")).to_be_focused(timeout=1000)
    finally:
        await page.close()


async def explicit_episode(browser):
    page = await fixture(browser)
    try:
        await page.evaluate("item => mountTV(item)", {**SERIES, "season": 1, "episode": 3, "autoplay": True})
        await page.wait_for_function("playHistory.length > 0")
        history = await page.evaluate("playHistory.map(h => [h.season, h.episode])")
        assert history == [[1, 3]], f"Expected S1E3, got {history}"
    finally:
        await page.close()


async def dropdown_arrow_keys(browser):
    page = await fixture(browser)
    try:
        await page.evaluate("mountSettings()")
        select = page.locator(".lumen-select").first
        trigger = select.locator(".lumen-select__trigger")
        await trigger.focus()
        await page.keyboard.press("ArrowDown")
        await expect(select.get_by_role("option").first).to_be_focused()
        await page.keyboard.press("ArrowDown")
        option = select.get_by_role("option").nth(1)
        await expect(option).to_be_focused()
        label = (await option.inner_text()).strip()
        await page.keyboard.press("Space")
        await expect(trigger).to_have_text(label)
        await expect(trigger).to_be_focused()
        await page.keyboard.press("ArrowUp")
        await page.keyboard.press("End")
        await expect(select.get_by_role("option").last).to_be_focused()
        await page.keyboard.press("Escape")
        await expect(trigger).to_be_focused()
        await expect(select.get_by_role("listbox")).to_have_count(0)
    finally:
        await page.close()


async def delayed_season_selection(browser):
    page = await fixture(browser, delayed_details=True)
    try:
        watched = {f"tv_123_s1e{n}": True for n in (1, 2, 3)}
        await page.evaluate("([item, watched]) => mountTV(item, watched)", [{**SERIES, "autoplay": True}, watched])
        await page.wait_for_function("playHistory.some(h => h.season === 2)", timeout=2500)
        history = await page.evaluate("playHistory.map(h => [h.season, h.episode])")
        assert history == [[2, 1]], f"Expected only S2E1, got {history}"
        await expect(page.locator(".player-wrap")).to_be_visible()
    finally:
        await page.close()


async def settings_preserves_drafts(browser):
    page = await fixture(browser)
    try:
        await page.evaluate("mountSettings()")
        select = page.locator(".lumen-select").first
        await select.locator(".lumen-select__trigger").click()
        await select.get_by_role("option", name="Deutsch (de-DE)", exact=True).click()
        search = page.get_by_placeholder("Filter settings…")
        await search.fill("playback")
        await search.fill("")
        await expect(select.locator(".lumen-select__trigger")).to_have_text("Deutsch (de-DE)")
        assert await page.evaluate("localStorage.getItem('streambert_tmdbLang')") is None
    finally:
        await page.close()


async def settings_navigation_clear_of_header(browser):
    page = await fixture(browser)
    try:
        await page.emulate_media(reduced_motion="reduce")
        for width, height in ((900, 600), (1050, 700)):
            await page.set_viewport_size({"width": width, "height": height})
            await page.evaluate("mountSettings()")
            await page.get_by_role("button", name="Playback", exact=True).click()
            await page.wait_for_function("""() => {
              const nav = document.querySelector('.settings-nav').getBoundingClientRect();
              const heading = document.querySelector('[data-section-id=playback] h2').getBoundingClientRect();
              const main = document.querySelector('.main');
              return heading.top >= nav.bottom + 8 && heading.bottom < innerHeight
                && main.scrollWidth === main.clientWidth && getComputedStyle(main).scrollBehavior === 'auto';
            }""", timeout=2000)
    finally:
        await page.close()


async def settings_navigation_clear_of_sidebar(browser):
    page = await fixture(browser)
    try:
        await page.set_viewport_size({"width": 1280, "height": 800})
        await page.evaluate("mountSettings()")
        playback = page.get_by_role("button", name="Playback", exact=True)
        bounds = await playback.bounding_box()
        await page.mouse.move(bounds["x"] + 8, bounds["y"] + bounds["height"] / 2)
        await page.wait_for_timeout(250)
        assert await page.evaluate("""([x, y]) => {
          const top = document.elementFromPoint(x, y);
          return top instanceof HTMLElement && !top.closest('.sidebar');
        }""", [bounds["x"] + 8, bounds["y"] + bounds["height"] / 2])
        await playback.click()
        await expect(playback).to_have_attribute("aria-current", "location")
    finally:
        await page.close()


async def appearance_revert_restores_all_controls(browser):
    page = await fixture(browser)
    try:
        await page.evaluate("mountSettings()")
        controller = page.get_by_role("switch", name="Controller support", exact=True)
        await expect(controller).to_have_attribute("aria-checked", "true")
        await controller.click()
        await page.get_by_role("button", name="Large", exact=True).click()
        await page.get_by_role("button", name="Revert changes", exact=True).click()
        await expect(controller).to_have_attribute("aria-checked", "true")
        await expect(page.get_by_role("button", name="Normal", exact=True)).to_have_class("lumen-segmented__btn lumen-segmented__btn--active")
        assert await page.evaluate("localStorage.getItem('streambert_gamepadEnabled')") is None
    finally:
        await page.close()


async def restricted_autoplay_waits_for_rating(browser):
    page = await fixture(browser, delayed_rating=True)
    try:
        await page.evaluate("localStorage.setItem('streambert_ageLimit', '12')")
        await page.evaluate("item => mountTV(item)", {**SERIES, "autoplay": True})
        await expect(page.get_by_role("button", name="Checking rating…")).to_be_disabled()
        await expect(page.get_by_role("button", name="Restricted", exact=True)).to_be_disabled()
        assert await page.evaluate("playHistory.length") == 0
        await expect(page.locator(".player-wrap")).to_have_count(0)
    finally:
        await page.close()


async def episode_opens_watch_view_in_place(browser):
    page = await fixture(browser)
    try:
        await page.set_viewport_size({"width": 1280, "height": 560})
        await page.evaluate("item => mountTV(item)", SERIES)
        season = page.get_by_role("button", name="Season: Season 1")
        await season.click()
        async with page.expect_response("**/season/2**"):
            await page.get_by_role("option", name="Season 2").click()
        await expect(page.get_by_role("button", name="Season: Season 2")).to_be_focused()
        await expect(page.locator(".loader")).to_have_count(0)
        row = page.get_by_role("button", name="Episode 3: Episode 3", exact=True)
        await expect(row).to_be_visible()
        await row.scroll_into_view_if_needed()
        main = page.locator(".main")
        before = await main.evaluate("element => element.scrollTop")
        assert before > 0, "fixture page should be scrolled to the episode list"
        await row.click()
        await page.wait_for_function("playHistory.some(h => h.season === 2 && h.episode === 3)")
        watch = page.get_by_role("region", name="Watching Fixture Series")
        await expect(watch).to_be_visible()
        assert abs(await main.evaluate("element => element.scrollTop") - before) <= 1
        await page.keyboard.press("Escape")
        await expect(watch).to_have_count(0)
        assert abs(await main.evaluate("element => element.scrollTop") - before) <= 1
        await expect(row).to_be_focused()
        # The picked season is remembered when the show is opened again
        await page.reload()
        await page.wait_for_function("typeof window.mountTV === 'function'")
        await page.evaluate("item => mountTV(item)", SERIES)
        await expect(page.get_by_role("button", name="Season: Season 2")).to_be_visible()
    finally:
        await page.close()


async def thumbs_rating_is_saved(browser):
    page = await fixture(browser)
    try:
        await page.evaluate("item => mountTV(item)", SERIES)
        like = page.get_by_role("button", name="I like this")
        await like.click()
        await expect(like).to_have_attribute("aria-pressed", "true")
        saved = await page.evaluate("JSON.parse(localStorage.getItem('streambert_thumbs'))")
        assert saved == {"tv_123": 1}, saved
        await page.get_by_role("button", name="Not for me").click()
        await expect(like).to_have_attribute("aria-pressed", "false")
        saved = await page.evaluate("JSON.parse(localStorage.getItem('streambert_thumbs'))")
        assert saved == {"tv_123": -1}, saved
    finally:
        await page.close()


async def back_restores_scroll_position(browser):
    page = await browser.new_page(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
    try:
        await page.goto(BASE)
        await page.get_by_role("button", name="Skip for now").click()
        await page.get_by_role("button", name="Settings", exact=True).click()
        await page.get_by_role("button", name="Playback", exact=True).click()
        main = page.locator(".main")
        await page.wait_for_function("document.querySelector('.main').scrollTop > 400")
        previous_scroll = await main.evaluate("element => element.scrollTop")
        await page.get_by_role("button", name="Library", exact=True).first.click()
        await expect(page.get_by_role("heading", name="Library", exact=True)).to_be_visible()
        assert await main.evaluate("element => element.scrollTop") == 0
        await page.get_by_role("button", name="Back", exact=True).click()
        await page.wait_for_function("previous => Math.abs(document.querySelector('.main').scrollTop - previous) <= 1", arg=previous_scroll)
    finally:
        await page.close()


async def catalog_fixture(browser, api, age_limit=None):
    page = await browser.new_page(viewport={"width": 1280, "height": 800}, reduced_motion="reduce")
    page.set_default_timeout(5000)
    if age_limit is not None:
        await page.add_init_script(f"localStorage.setItem('streambert_ageLimit', '{age_limit}')")
    await page.route("https://api.themoviedb.org/**", api)
    await page.route("https://image.tmdb.org/**", lambda route: route.abort())
    await page.route("https://fonts.googleapis.com/**", lambda route: route.abort())
    await page.goto(BASE, wait_until="domcontentloaded")
    token = page.locator(".apikey-box input")
    await token.fill("fixture-key")
    await token.press("Enter")
    return page


def movie(item_id, title):
    return {"id": item_id, "title": title, "media_type": "movie", "poster_path": "/poster.jpg"}


async def recommendation_honors_age_limit(browser):
    release_rating = asyncio.Event()

    async def api(route):
        path = urlparse(route.request.url).path
        data = {"results": []}
        if path == "/3/discover/movie":
            data = {"results": [movie(1, "Fixture film")], "total_pages": 1}
        elif path == "/3/movie/1":
            data = movie(1, "Fixture film")
        elif path == "/3/movie/1/recommendations":
            data = {"results": [movie(2, "R-rated recommendation"), movie(3, "Family recommendation")]}
        elif path == "/3/movie/2/release_dates":
            await release_rating.wait()
            data = {"results": [{"iso_3166_1": "US", "release_dates": [{"certification": "R", "type": 3}]}]}
        await route.fulfill(json=data)

    page = await catalog_fixture(browser, api, age_limit=12)
    try:
        await page.get_by_role("button", name="Movies", exact=True).click()
        async with page.expect_request("**/movie/2/release_dates?**", timeout=3000) as rating_request:
            await page.get_by_role("button", name="Fixture film", exact=True).press("Enter")
        assert (await rating_request.value).headers["authorization"] == "Bearer fixture-key"
        restricted = page.get_by_role("button", name="R-rated recommendation", exact=True)
        await expect(restricted).to_have_count(0)
        release_rating.set()
        await expect(page.get_by_role("button", name="Family recommendation", exact=True)).to_be_visible()
        await expect(restricted).to_have_count(0)
    finally:
        release_rating.set()
        await page.close()


async def back_restores_browse_results(browser):
    pages = []

    async def api(route):
        url = urlparse(route.request.url)
        params = parse_qs(url.query)
        data = {"results": []}
        if url.path == "/3/genre/movie/list":
            data = {"genres": [{"id": 18, "name": "Drama"}]}
        elif url.path == "/3/discover/movie":
            genre = params.get("with_genres", [None])[0]
            number = int(params["page"][0])
            pages.append((genre, number))
            items = [movie(i, f"Drama film {i}") for i in range(number * 20, (number + 1) * 20)]
            data = {"results": items if genre else [], "total_pages": 2 if genre else 1}
        elif url.path == "/3/movie/59":
            data = movie(59, "Drama film 59")
        await route.fulfill(json=data)

    page = await catalog_fixture(browser, api)
    try:
        await page.get_by_role("button", name="Movies", exact=True).click()
        drama = page.get_by_role("button", name="Drama", exact=True)
        await drama.click()
        await page.get_by_role("button", name="Load more").click()
        title = page.get_by_role("button", name="Drama film 59", exact=True)
        await title.scroll_into_view_if_needed()
        main = page.locator(".main")
        scroll = await main.evaluate("element => element.scrollTop")
        assert scroll > 400
        assert ("18", 2) in pages, pages
        before_back = list(pages)
        await title.click()
        await expect(page.get_by_role("heading", name="Movies", exact=True)).to_have_count(0)
        await page.get_by_role("button", name="Back", exact=True).click()
        await expect(drama).to_have_attribute("aria-pressed", "true", timeout=1500)
        await expect(title).to_be_in_viewport()
        assert abs(await main.evaluate("element => element.scrollTop") - scroll) <= 1
        assert pages == before_back, pages
    finally:
        await page.close()


async def search_drops_stale_results_and_retries(browser):
    fail = True

    async def api(route):
        nonlocal fail
        url = urlparse(route.request.url)
        if url.path != "/3/search/multi":
            return await route.fulfill(json={"results": []})
        query = parse_qs(url.query)["query"][0]
        if query == "new query" and fail:
            fail = False
            return await route.fulfill(status=500, json={})
        title = "Old result" if query == "old query" else "New result"
        await route.fulfill(json={"results": [movie(1, title)]})

    page = await catalog_fixture(browser, api)
    try:
        await page.get_by_role("button", name="Search", exact=True).click()
        dialog = page.get_by_role("dialog", name="Search")
        field = dialog.get_by_role("textbox", name="Search")
        await field.fill("old query")
        old_result = dialog.get_by_role("button", name="Old result", exact=True)
        await expect(old_result).to_be_visible()
        await field.fill("new query")
        assert not await old_result.is_visible(), "Prior query's result is still clickable"
        await expect(dialog.get_by_role("alert")).to_have_text("Couldn't load search results.")
        await expect(old_result).to_have_count(0)
        await dialog.get_by_role("button", name="Try again").click()
        await expect(dialog.get_by_role("button", name="New result", exact=True)).to_be_visible()
    finally:
        await page.close()


async def disabling_backups_preserves_saved_fields(browser):
    page = await browser.new_page()
    original = {"enabled": True, "path": "C:/fixture-original", "frequency": "weekly", "keepCount": 5,
                "lastRun": "2026-11-21T10:00:00.000Z"}
    try:
        await page.add_init_script("""window.writes = []; window.electron = {
          secureGet: async () => null,
          getAppVersion: async () => '0.0.0',
          getScheduledBackupSettings: async () => window.backupSettings,
          setScheduledBackupSettings: async data => {
            window.writes.push(data);
            window.backupSettings = data;
            return {ok: true};
          }
        }""")
        await page.route("https://fonts.googleapis.com/**", lambda route: route.abort())
        await page.goto(BASE + "/tests/browser/fixture.html", wait_until="domcontentloaded")
        await page.wait_for_function("typeof mountSettings === 'function'")
        await page.evaluate("settings => { window.backupSettings = settings; mountSettings(); }", original)
        await page.get_by_placeholder("/home/you/Backups").fill("C:/fixture-unsaved")
        backup_switch = page.get_by_role("switch", name="Scheduled backups")
        await backup_switch.click()
        await page.wait_for_function("writes.length > 0")
        assert await page.evaluate("writes") == [{**original, "enabled": False}]
        await expect(backup_switch).to_have_attribute("aria-checked", "false")
        await backup_switch.click()
        await expect(page.get_by_placeholder("/home/you/Backups")).to_have_value("C:/fixture-unsaved")
        await page.get_by_role("button", name="Save schedule").click()
        await page.wait_for_function("writes.length === 2")
        assert await page.evaluate("writes.at(-1)") == {**original, "path": "C:/fixture-unsaved"}
    finally:
        await page.close()


async def main():
    failures = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for test in (dropdown_keyboard, dropdown_arrow_keys, explicit_episode, delayed_season_selection,
                         episode_opens_watch_view_in_place, thumbs_rating_is_saved,
                         settings_preserves_drafts, settings_navigation_clear_of_header,
                         settings_navigation_clear_of_sidebar,
                         appearance_revert_restores_all_controls, restricted_autoplay_waits_for_rating,
                         back_restores_scroll_position, recommendation_honors_age_limit,
                         back_restores_browse_results, search_drops_stale_results_and_retries,
                         disabling_backups_preserves_saved_fields):
                try:
                    await test(browser)
                    print(f"PASS {test.__name__}")
                except Exception as error:
                    failures.append(test.__name__)
                    print(f"FAIL {test.__name__}: {error}")
        finally:
            await browser.close()
    assert not failures, f"Failed: {', '.join(failures)}"


if __name__ == "__main__":
    asyncio.run(main())
