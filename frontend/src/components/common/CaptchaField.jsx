import { useEffect, useRef, useState } from "react";

const provider = import.meta.env.VITE_CAPTCHA_PROVIDER?.trim() || "";
const siteKey = import.meta.env.VITE_CAPTCHA_SITE_KEY?.trim() || "";
const isCaptchaEnabled = Boolean(provider && siteKey);

const providerConfig = {
  hcaptcha: {
    scriptId: "hcaptcha-script",
    scriptSrc: "https://js.hcaptcha.com/1/api.js?render=explicit",
    apiName: "hcaptcha",
  },
  recaptcha: {
    scriptId: "recaptcha-script",
    scriptSrc: "https://www.google.com/recaptcha/api.js?render=explicit",
    apiName: "grecaptcha",
  },
};

const loadProviderScript = () => {
  if (!isCaptchaEnabled) {
    return Promise.resolve(null);
  }

  const { scriptId, scriptSrc, apiName } = providerConfig[provider] || {};

  if (!scriptId || !scriptSrc || !apiName) {
    return Promise.reject(new Error("Unsupported captcha provider"));
  }

  if (window[apiName]) {
    return Promise.resolve(window[apiName]);
  }

  const existingScript = document.getElementById(scriptId);

  if (existingScript) {
    return new Promise((resolve) => {
      existingScript.addEventListener("load", () => resolve(window[apiName]), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");

    script.id = scriptId;
    script.src = scriptSrc;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window[apiName]);
    script.onerror = () => reject(new Error("Failed to load captcha widget"));
    document.head.appendChild(script);
  });
};

export function captchaIsRequired() {
  return isCaptchaEnabled;
}

export default function CaptchaField({ onTokenChange }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    onTokenChange("");

    if (!isCaptchaEnabled || !containerRef.current) {
      return undefined;
    }

    let active = true;

    loadProviderScript()
      .then((api) => {
        if (!active || !api || widgetIdRef.current !== null) {
          return;
        }

        const render = () => {
          widgetIdRef.current = api.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token) => onTokenChange(token || ""),
            "expired-callback": () => onTokenChange(""),
            "error-callback": () => {
              onTokenChange("");
              setError("Captcha challenge failed to load. Please retry.");
            },
          });
        };

        if (provider === "recaptcha" && typeof api.ready === "function") {
          api.ready(render);
          return;
        }

        render();
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || "Failed to load captcha widget");
        }
      });

    return () => {
      active = false;

      if (!window[providerConfig[provider]?.apiName] || widgetIdRef.current === null) {
        return;
      }

      try {
        window[providerConfig[provider].apiName].reset(widgetIdRef.current);
      } catch {
        // Ignore widget cleanup failures during route transitions.
      }
    };
  }, [onTokenChange]);

  if (!isCaptchaEnabled) {
    return null;
  }

  return (
    <div className="captcha-shell">
      <div ref={containerRef} className="captcha-widget" />
      {error ? <div className="auth-neo-error captcha-error">{error}</div> : null}
    </div>
  );
}
