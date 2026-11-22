# Regression checks

With the existing npm dependencies installed:

```sh
node --test tests/packaging.test.cjs
```

Browser checks require Python, Playwright, and its Chromium browser. They use
fixture API responses and never access saved credentials or external players.

```sh
python -m pip install playwright
python -m playwright install chromium
```

Start Vite in one terminal, then run the checks in another:

```sh
npx vite --host 127.0.0.1 --port 5173 --strictPort
python tests/browser/regressions.py
python tests/browser/browse_regressions.py
python tests/browser/modal_regressions.py
```

The browser checks cover keyboard selection and focus return, modal focus and
controller isolation, browse request races, exact episode resume, reduced
motion, stale-state handling, navigation scroll restoration, and responsive
viewport bounds. The packaging check uses electron-builder's actual file filter
to verify both preload scripts.
