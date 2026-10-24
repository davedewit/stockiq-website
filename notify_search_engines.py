#!/usr/bin/env python3
"""Notify search engines about sitemap update"""
import requests
import json

# IndexNow API (works for Bing, Yandex, etc.)
def notify_indexnow():
    url = "https://api.indexnow.org/indexnow"
    data = {
        "host": "stockiq.tech",
        "key": "stockiq2026",
        "keyLocation": "https://stockiq.tech/stockiq2026.txt",
        "urlList": [
            "https://stockiq.tech/",
            "https://stockiq.tech/sitemap.xml"
        ]
    }
    # The daily screener pages change every day (24 Oct 2026): name each one
    import glob, os
    here = os.path.dirname(os.path.abspath(__file__))
    data["urlList"] += ["https://stockiq.tech/" + os.path.basename(p)
                        for p in sorted(glob.glob(os.path.join(here, "screener-*.html")) + glob.glob(os.path.join(here, "screeners-today.html")))]
    
    try:
        response = requests.post(url, json=data, headers={"Content-Type": "application/json"})
        if response.status_code in (200, 202):
            print("✅ IndexNow notification sent (Bing, Yandex)")
        else:
            print(f"⚠️  IndexNow response: {response.status_code}")
    except Exception as e:
        print(f"⚠️  IndexNow failed: {e}")

# Simple HTTP request to notify Google (they auto-discover via robots.txt)
def notify_google():
    print("\n📊 Google Search Console:")
    print("   Google automatically discovers sitemap updates via robots.txt")
    print("   Your sitemap is listed at: https://stockiq.tech/robots.txt")
    print("   Google will crawl it within 24-48 hours")
    print("\n   For immediate indexing, manually submit in Search Console:")
    print("   https://search.google.com/search-console")

if __name__ == '__main__':
    print("🔔 Notifying search engines about sitemap update...\n")
    notify_indexnow()
    notify_google()
    print("\n✅ Notifications complete!")
