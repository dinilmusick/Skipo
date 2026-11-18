"""Exercise the production Node entrypoint and Vite bundle in a real browser."""
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as conditions
from selenium.webdriver.support.ui import WebDriverWait


def run(app):
    origin = "http://127.0.0.1:4177"
    with subprocess.Popen(
        ["node", "dist/providers/node/server.js"], cwd=app,
        env={**os.environ, "PORT": "4177"},
    ) as server:
        try:
            for _ in range(80):
                if server.poll() is not None:
                    raise RuntimeError(f"Node server exited with {server.returncode}")
                try:
                    with urlopen(origin + "/health", timeout=1) as response:
                        if response.status == 200:
                            break
                except URLError:
                    time.sleep(0.25)
            options = webdriver.ChromeOptions()
            options.add_argument("--headless=new")
            options.add_argument("--no-sandbox")
            with webdriver.Chrome(options=options) as browser:
                browser.get(origin)
                wait = WebDriverWait(browser, 20)
                for label in ["Continue as guest", "Mixer"]:
                    button = (By.XPATH, f'//button[normalize-space(.)="{label}"]')
                    wait.until(conditions.element_to_be_clickable(button)).click()
                wait.until(conditions.visibility_of_element_located((By.XPATH, '//h2[text()="Mixer"]')))
        finally:
            server.terminate()


if __name__ == "__main__":
    run(Path(sys.argv[1]).resolve())
