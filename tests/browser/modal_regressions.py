"""Run modal regressions with Vite on port 5173 and Playwright Chromium."""
import asyncio

from playwright.async_api import async_playwright, expect


BASE = "http://127.0.0.1:5173"


async def open_app(page):
    await page.goto(BASE)
    await page.get_by_role("button", name="Skip for now").click()


async def open_fixture(page, *, download_path=None):
    if download_path:
        await page.add_init_script(
            f"localStorage.setItem('streambert_downloadPath', JSON.stringify({download_path!r}))"
        )
    await page.goto(BASE + "/tests/browser/modal_fixture.html")


async def search_focus(page):
    await open_app(page)
    search = page.get_by_role("button", name="Search", exact=True)
    await search.click()

    dialog = page.get_by_role("dialog", name="Search", exact=True)
    field = dialog.get_by_role("textbox", name="Search")
    await expect(field).to_be_focused()
    await page.locator(".sidebar-btn").first.evaluate("(element) => element.focus()")
    await expect(field).to_be_focused()

    await page.keyboard.press("Shift+Tab")
    await expect(dialog.get_by_role("button", name="Open settings")).to_be_focused(timeout=1500)
    await page.keyboard.press("Tab")
    await expect(field).to_be_focused()

    await page.keyboard.press("Tab")
    await expect(dialog.get_by_role("button", name="Close")).to_be_focused()
    await page.keyboard.press("Escape")
    await expect(dialog).to_have_count(0)
    await expect(search).to_be_focused()


async def shortcuts_focus(page):
    await open_app(page)
    search = page.get_by_role("button", name="Search", exact=True)
    await search.focus()
    await page.keyboard.press("?")

    dialog = page.get_by_role("dialog", name="Keyboard shortcuts")
    await expect(dialog.get_by_role("button", name="Close")).to_be_focused(timeout=1500)
    await page.keyboard.press("Control+f")
    await expect(page.locator(".search-box")).to_have_count(0)
    await page.keyboard.press("?")
    await expect(dialog).to_have_count(0)
    await expect(search).to_be_focused()


async def nested_subtitles(page):
    await open_fixture(page, download_path="/test/downloads")
    trigger = page.get_by_role("button", name="Open download")
    await trigger.click()
    parent = page.get_by_role("dialog", name="Download", exact=True)
    browse = parent.get_by_role("button", name="Add / change")
    await browse.evaluate("(button) => gamepad.setGamepadFocus(button, { scroll: false })")
    assert await page.evaluate("gamepad.confirmGamepadFocus()")

    child = page.get_by_role("dialog", name="Browse subtitles")
    child_close = child.get_by_role("button", name="Close")
    await expect(child_close).to_be_focused()
    await expect(page.locator(".gamepad-focused")).to_have_count(0)
    assert await parent.evaluate("(dialog) => dialog.closest('[inert]') !== null")
    await browse.evaluate("(button) => button.focus()")
    await expect(child_close).to_be_focused()
    await page.keyboard.press("Shift+Tab")
    await expect(child.get_by_role("button", name="Done")).to_be_focused()
    await page.keyboard.press("Tab")
    await expect(child_close).to_be_focused()
    await page.evaluate("gamepad.ensureInitialFocus(); gamepad.moveGamepadFocus('down')")
    await expect(child.locator(".gamepad-focused")).to_have_count(1)

    subtitle = child.get_by_role("button", name="Fixture subtitles", exact=False)
    await subtitle.focus()
    await expect(subtitle).to_have_attribute("aria-pressed", "true")
    await page.keyboard.press("Space")
    await expect(subtitle).to_have_attribute("aria-pressed", "false")
    await page.keyboard.press("Space")
    await expect(subtitle).to_have_attribute("aria-pressed", "true")

    await page.evaluate("gamepad.ensureInitialFocus()")
    await expect(subtitle).to_have_class("lumen-sub-row lumen-sub-row--selected gamepad-focused")
    assert await page.evaluate("gamepad.dismissActiveOverlay()")
    await expect(child).to_have_count(0)
    await expect(browse).to_be_focused()
    await expect(page.locator(".gamepad-focused")).to_have_count(0)

    await browse.click()
    await expect(child_close).to_be_focused()
    await page.keyboard.press("Escape")
    await expect(child).to_have_count(0)
    await expect(browse).to_be_focused()
    await page.keyboard.press("Escape")
    await expect(parent).to_have_count(0)
    await expect(trigger).to_be_focused()


async def download_pending(page):
    await open_fixture(page)
    trigger = page.get_by_role("button", name="Open download")
    await trigger.click()
    folder_dialog = page.get_by_role("dialog", name="Set download folder")
    field = folder_dialog.get_by_role("textbox", name="Download folder")
    await expect(field).to_be_focused()
    await field.fill("/test/downloads")
    await expect(folder_dialog).to_be_visible()
    await folder_dialog.get_by_role("button", name="Confirm").click()

    dialog = page.get_by_role("dialog", name="Download", exact=True)
    await dialog.get_by_role("button", name="Start download").click()
    await expect(dialog.get_by_role("button", name="Close")).to_be_disabled()
    await page.keyboard.press("Escape")
    assert await page.evaluate("gamepad.dismissActiveOverlay()")
    await page.mouse.click(5, 5)
    await expect(dialog).to_be_visible()

    await page.evaluate("window.failDownload()")
    await expect(dialog.get_by_role("alert")).to_have_text("Downloader unavailable")
    await page.keyboard.press("Escape")
    await expect(dialog).to_have_count(0)
    await expect(trigger).to_be_focused()


async def update_pending(page):
    await open_fixture(page)
    trigger = page.get_by_role("button", name="Open update")
    await trigger.click()
    dialog = page.get_by_role("dialog", name="Update available")
    cancel = dialog.get_by_role("button", name="Cancel download")
    await dialog.get_by_role("button", name="Install update").click()
    await expect(cancel).to_be_visible()
    await page.keyboard.press("Escape")
    await page.mouse.click(5, 5)
    assert await page.evaluate("gamepad.dismissActiveOverlay()")
    await expect(dialog).to_be_visible()
    assert await page.evaluate("window.cancelledUpdates") == 0

    await cancel.click()
    await expect(dialog).to_have_count(0)
    await expect(trigger).to_be_focused()
    assert await page.evaluate("window.cancelledUpdates") == 1

    await trigger.click()
    await dialog.get_by_role("button", name="Install update").click()
    await page.evaluate('window.updateProgress({ percent: 100, label: "Installing…" })')
    await expect(cancel).to_have_count(0)
    await page.keyboard.press("Escape")
    await expect(dialog).to_be_visible()
    await page.evaluate("window.finishUpdate()")
    await expect(dialog.get_by_role("status")).to_contain_text("installer is running")
    await page.keyboard.press("Escape")
    await expect(trigger).to_be_focused()


async def destructive_initial_focus(page):
    await open_fixture(page)
    trigger = page.get_by_role("button", name="Open confirmation")
    await trigger.click()
    dialog = page.get_by_role("dialog", name="Downloads in progress")
    await expect(dialog.get_by_role("button", name="Keep downloading")).to_be_focused()
    await expect(dialog).to_have_accessible_description(
        "2 active downloads will be cancelled and incomplete files will be deleted."
    )
    await page.keyboard.press("Enter")
    await expect(dialog).to_have_count(0)
    await expect(trigger).to_be_focused()


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        try:
            checks = (
                search_focus, shortcuts_focus, nested_subtitles, download_pending,
                update_pending, destructive_initial_focus,
            )
            for check in checks:
                page = await browser.new_page(viewport={"width": 1280, "height": 800})
                try:
                    await check(page)
                    print(f"PASS {check.__name__}")
                finally:
                    await page.close()
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
