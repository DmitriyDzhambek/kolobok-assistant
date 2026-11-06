import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share2, X } from "lucide-react";
import "./InstallPwaPrompt.css";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISSED_KEY = "kolobok_pwa_dismissed";
const DISMISSED_AT_KEY = "kolobok_pwa_dismissed_at";
const DISMISS_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function wasRecentlyDismissed(): boolean {
  try {
    if (window.localStorage.getItem(DISMISSED_KEY) !== "true") return false;
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY));
    if (!Number.isFinite(dismissedAt)) {
      window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
      return true;
    }
    if (Date.now() - dismissedAt < DISMISS_PERIOD_MS) return true;
    window.localStorage.removeItem(DISMISSED_KEY);
    window.localStorage.removeItem(DISMISSED_AT_KEY);
    return false;
  } catch (error) {
    console.error("Не удалось проверить настройку показа PWA-баннера:", error);
    return false;
  }
}

function saveDismissal(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "true");
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
  } catch (error) {
    console.error("Не удалось сохранить настройку PWA-баннера:", error);
  }
}

export function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [delayElapsed, setDelayElapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setIsIos(isIosDevice());
    setStandalone(isStandalone());
    setDismissed(wasRecentlyDismissed());

    const delay = window.setTimeout(() => setDelayElapsed(true), 10_000);
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => setStandalone(isStandalone());

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener,
    );
    window.addEventListener("appinstalled", handleAppInstalled);
    displayMode.addEventListener("change", handleDisplayModeChange);
    return () => {
      window.clearTimeout(delay);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayMode.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const dismiss = useCallback(() => {
    saveDismissal();
    setDismissed(true);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIos) dismiss();
      return;
    }

    setInstalling(true);
    try {
      const promptEvent = deferredPrompt;
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
        setDeferredPrompt(null);
        setDismissed(true);
      }
    } catch (error) {
      console.error("Не удалось открыть установку PWA:", error);
    } finally {
      setInstalling(false);
    }
  };

  const isVisible =
    delayElapsed &&
    !standalone &&
    !dismissed &&
    !installed &&
    (isIos || deferredPrompt !== null);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          className="install-pwa-prompt"
          role="dialog"
          aria-labelledby="install-pwa-title"
          aria-describedby="install-pwa-description"
          initial={{ opacity: 0, y: 38 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 280, damping: 26 }}
        >
          <img
            className="install-pwa-icon"
            src="/icon-192.png"
            alt=""
            width="54"
            height="54"
          />
          <div className="install-pwa-copy">
            <h2 id="install-pwa-title">Добавить Колобка на экран?</h2>
            <p id="install-pwa-description">
              Открывай ассистента в один клик без браузера.
            </p>
            {isIos && (
              <p className="install-pwa-ios-instructions">
                Нажмите <Share2 size={14} aria-hidden="true" /> «Поделиться» в Safari и
                выберите «На экран Домой».
              </p>
            )}
          </div>
          <div className="install-pwa-actions">
            <button
              type="button"
              className="install-pwa-primary"
              onClick={() => void handleInstallClick()}
              disabled={installing}
            >
              {isIos ? (
                "Понятно"
              ) : (
                <>
                  <Download size={16} aria-hidden="true" />
                  {installing ? "Открываю…" : "Установить"}
                </>
              )}
            </button>
            <button
              type="button"
              className="install-pwa-later"
              onClick={dismiss}
              aria-label="Напомнить об установке позже"
            >
              Позже
            </button>
          </div>
          <button
            type="button"
            className="install-pwa-close"
            onClick={dismiss}
            aria-label="Закрыть предложение установки"
          >
            <X size={17} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
