"use client";

import { useEffect } from "react";

export function checkIsInAppBrowser(): { isInApp: boolean; isLine: boolean; isIOS: boolean; isAndroid: boolean } {
  if (typeof window === "undefined" || !navigator?.userAgent) {
    return { isInApp: false, isLine: false, isIOS: false, isAndroid: false };
  }

  const ua = navigator.userAgent;
  const isLine = /Line\//i.test(ua) || /Line/i.test(ua);
  const isFB = /FBAN|FBAV/i.test(ua);
  const isInstagram = /Instagram/i.test(ua);
  const isWeChat = /MicroMessenger/i.test(ua);
  const isOtherInApp = /BytedanceWebview|musical_ly|Snapchat/i.test(ua);
  const isInApp = isLine || isFB || isInstagram || isWeChat || isOtherInApp;

  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  return { isInApp, isLine, isIOS, isAndroid };
}

export default function InAppBrowserHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const { isLine } = checkIsInAppBrowser();

    // Solution 1: If opened inside LINE, automatically redirect to bypass in-app WebView
    if (isLine) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get("openExternalBrowser") !== "1") {
          url.searchParams.set("openExternalBrowser", "1");
          window.location.replace(url.toString());
        }
      } catch (e) {
        // Fallback for relative or malformed URLs
        if (!window.location.href.includes("openExternalBrowser=1")) {
          const sep = window.location.href.includes("?") ? "&" : "?";
          window.location.replace(window.location.href + sep + "openExternalBrowser=1");
        }
      }
    }
  }, []);

  return null;
}
