"""Run with Vite on port 5173: python tests/browser/browse_regressions.py."""

import asyncio
import time
from urllib.parse import parse_qs, urlparse

from playwright.async_api import async_playwright, expect


BASE = "http://127.0.0.1:5173/tests/browser/browse_fixture.html"
MOVIE = {"id": 1, "title": "Fixture Movie", "media_type": "movie", "poster_path": "/poster.jpg"}


async def open_fixture(browser, api, *, reduced_motion=None):
    options = {"viewport": {"width": 900, "height": 600}}
    if reduced_motion:
        options["reduced_motion"] = reduced_motion
    page = await browser.new_page(**options)
    await page.route("https://api.themoviedb.org/**", api)
    await page.route("https://image.tmdb.org/**", lambda route: route.abort())
    await page.route("https://fonts.googleapis.com/**", lambda route: route.abort())
    await page.goto(BASE)
    await page.wait_for_function("typeof window.mountBrowse === 'function'")
    return page


async def browse_filters(browser):
    requests = []
    previous_page = asyncio.Event()
    release_previous_page = asyncio.Event()
    previous_page_returned = asyncio.Event()

    async def api(route):
        url = urlparse(route.request.url)
        if url.path == "/3/genre/tv/list":
            await route.fulfill(json={"genres": [{"id": 18, "name": "Drama"}]})
            return
        if url.path != "/3/discover/tv":
            await route.fulfill(json={})
            return
        params = parse_qs(url.query)
        sort = params["sort_by"][0]
        page_number = int(params["page"][0])
        requests.append((sort, page_number))
        if sort == "popularity.desc" and page_number == 2:
            previous_page.set()
            await release_previous_page.wait()
            await route.fulfill(json={"results": [{**MOVIE, "id": 2, "title": "Stale result"}]})
            previous_page_returned.set()
            return
        if sort == "first_air_date.desc":
            await route.fulfill(json={"results": [], "total_pages": 1})
            return
        await route.fulfill(json={"results": [MOVIE], "total_pages": 2})

    page = await open_fixture(browser, api)
    try:
        await page.evaluate("window.mountBrowse()")
        await expect(page.get_by_role("button", name=MOVIE["title"], exact=True)).to_be_visible()
        await asyncio.wait_for(previous_page.wait(), timeout=5)
        await page.get_by_text("Newest", exact=True).click()
        release_previous_page.set()
        await asyncio.wait_for(previous_page_returned.wait(), timeout=5)
        assert [request for request in requests if request[0] != "popularity.desc"] == [("first_air_date.desc", 1)], requests
        await expect(page.get_by_role("heading", name="No matching series")).to_be_visible()
        await expect(page.get_by_text("Stale result")).to_have_count(0)
        await page.get_by_role("button", name="Clear filters").click()
        await expect(page.get_by_role("button", name=MOVIE["title"], exact=True)).to_be_visible()
        print("PASS Browse resets to page one and ignores an older response")
    finally:
        release_previous_page.set()
        await page.close()


async def keyboard_card_actions(browser):
    page = await open_fixture(browser, lambda route: route.fulfill(json={}))
    try:
        await page.evaluate("movie => window.mountLibrary({saved: [movie]})", MOVIE)
        card = page.get_by_role("button", name=MOVIE["title"], exact=True)
        await card.focus()
        await page.keyboard.press("Tab")
        trigger = page.get_by_role("button", name="Options for Fixture Movie")
        await expect(trigger).to_be_focused()
        await page.keyboard.press("Enter")
        mark = page.get_by_role("menuitem", name="Mark as watched")
        await expect(mark).to_be_focused()
        bounds = await page.get_by_role("menu").bounding_box()
        assert 0 <= bounds["x"] < bounds["x"] + bounds["width"] <= 900
        assert 0 <= bounds["y"] < bounds["y"] + bounds["height"] <= 600
        await page.keyboard.press("Escape")
        await expect(trigger).to_be_focused()
        await page.keyboard.press("Enter")
        await page.keyboard.press("Enter")
        assert await page.evaluate("window.actions") == ["movie_1"]
        await expect(trigger).to_be_focused()
        print("PASS Card options support keyboard activation, dismissal, action, and focus return")
    finally:
        await page.close()


async def library_resume_and_filter(browser):
    page = await open_fixture(browser, lambda route: route.fulfill(json={}))
    try:
        episode = {"id": 40, "title": "Fixture Series", "media_type": "tv", "season": 2, "episode": 4}
        props = {
            "inProgress": [episode], "history": [{**episode, "watchedAt": time.time() * 1000}],
            "saved": [MOVIE], "progress": {"tv_40_s2e4": 36},
        }
        await page.evaluate("props => window.mountLibrary(props)", props)
        resume = page.get_by_role("button", name="Resume Fixture Series")
        await expect(resume).to_have_accessible_description("S2E4 · 36% watched")
        await resume.press("Enter")
        assert await page.evaluate("window.actions") == [{**episode, "autoplay": True}]
        history = page.get_by_role("button", name="Fixture Series S2E4", exact=False)
        await history.press("Enter")
        assert (await page.evaluate("window.actions"))[-1] == props["history"][0]

        search = page.get_by_role("searchbox", name="Filter library")
        await search.fill("not an existing title")
        await expect(page.get_by_role("heading", name="No matching items")).to_be_visible()
        await page.get_by_role("button", name="Clear filters", exact=True).click()
        await expect(search).to_be_focused()
        await expect(resume).to_be_visible()
        print("PASS Library resumes the exact episode and resets its title filter")
    finally:
        await page.close()


async def home_available_during_recommendations(browser):
    release_recommendations = asyncio.Event()

    async def api(route):
        path = urlparse(route.request.url).path
        if path == "/3/movie/11/recommendations":
            await release_recommendations.wait()
            await route.fulfill(json={"results": [{**MOVIE, "id": 4, "title": "Recommended Movie"}]})
        else:
            await route.fulfill(json={"results": []})

    page = await open_fixture(browser, api)
    try:
        props = {
            "history": [{"id": 11, "title": "Watched Movie", "watchedAt": time.time() * 1000}],
            "trending": [{**MOVIE, "backdrop_path": "/backdrop.jpg", "overview": "A movie."},
                         {**MOVIE, "id": 2, "title": "Another Movie", "overview": "A movie."}],
        }
        await page.evaluate("props => window.mountHome(props)", props)
        await expect(page.locator(".hero").get_by_text(MOVIE["title"], exact=True)).to_be_visible(timeout=2000)
        row = page.get_by_role("region", name="Trending movies")
        await row.get_by_role("button", name=MOVIE["title"], exact=True).focus()
        await page.keyboard.press("ArrowRight")
        await expect(row.get_by_role("button", name="Another Movie", exact=True)).to_be_focused()
        await row.get_by_role("button", name="Another Movie", exact=True).hover()
        preview = page.get_by_role("group", name="Another Movie", exact=True)
        await expect(preview).to_be_visible()
        bounds = await preview.bounding_box()
        assert 0 <= bounds["x"] < bounds["x"] + bounds["width"] <= 900
        assert 0 <= bounds["y"] < bounds["y"] + bounds["height"] <= 600
        await page.keyboard.press("Escape")
        await expect(preview).to_have_count(0)
        release_recommendations.set()
        await expect(page.get_by_role("heading", name="Recommended for you")).to_be_visible()
        await expect(page.locator(".hero").get_by_text("Trending now", exact=True)).to_be_visible()
        print("PASS Home hero renders before recommendations and row arrows move focus")
    finally:
        release_recommendations.set()
        await page.close()


async def hero_trailer_respects_system_reduced_motion(browser):
    video_requests = []

    async def api(route):
        path = urlparse(route.request.url).path
        if path == "/3/movie/1/videos":
            video_requests.append(path)
        await route.fulfill(json={"results": []})

    page = await open_fixture(browser, api, reduced_motion="reduce")
    try:
        props = {
            "history": [],
            "trending": [
                {**MOVIE, "backdrop_path": "/backdrop.jpg", "overview": "A movie."},
                {**MOVIE, "id": 2, "title": "Another Movie", "overview": "A movie."},
            ],
        }
        await page.evaluate("props => window.mountHome(props)", props)
        await expect(page.locator(".hero").get_by_text(MOVIE["title"], exact=True)).to_be_visible()
        await page.wait_for_timeout(300)
        assert video_requests == []
        await expect(page.locator("webview")).to_have_count(0)
        print("PASS Home trailer respects the system reduced-motion preference")
    finally:
        await page.close()


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        try:
            await asyncio.gather(
                browse_filters(browser), keyboard_card_actions(browser),
                library_resume_and_filter(browser), home_available_during_recommendations(browser),
                hero_trailer_respects_system_reduced_motion(browser),
            )
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
