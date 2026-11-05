import { useEffect, useState } from "react";

type CoinGeckoPriceResponse = {
  "the-open-network"?: {
    rub?: number;
  };
  tether?: {
    rub?: number;
  };
};

export type CryptoRates = {
  tonToRub: number;
  usdtToRub: number;
};

export type CryptoRatesState = CryptoRates & {
  isLoading: boolean;
  error: string | null;
  isFallback: boolean;
  lastUpdated: number | null;
};

const FALLBACK_RATES: CryptoRates = {
  tonToRub: 500,
  usdtToRub: 90,
};
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,tether&vs_currencies=rub";

export function useCryptoRates(): CryptoRatesState {
  const [state, setState] = useState<CryptoRatesState>({
    ...FALLBACK_RATES,
    isLoading: true,
    error: null,
    isFallback: true,
    lastUpdated: null,
  });

  useEffect(() => {
    let active = true;
    let isRequestInFlight = false;
    const controller = new AbortController();

    const updateRates = async () => {
      if (isRequestInFlight) return;
      isRequestInFlight = true;
      setState((current) => ({ ...current, isLoading: true, error: null }));

      try {
        const response = await fetch(COINGECKO_URL, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error(`CoinGecko вернул ошибку ${response.status}`);
        }

        const prices: CoinGeckoPriceResponse = await response.json();
        const tonToRub = prices["the-open-network"]?.rub;
        const usdtToRub = prices.tether?.rub;
        if (
          typeof tonToRub !== "number" ||
          !Number.isFinite(tonToRub) ||
          tonToRub <= 0 ||
          typeof usdtToRub !== "number" ||
          !Number.isFinite(usdtToRub) ||
          usdtToRub <= 0
        ) {
          throw new Error("CoinGecko вернул неполные данные о курсах");
        }

        if (active) {
          setState({
            tonToRub,
            usdtToRub,
            isLoading: false,
            error: null,
            isFallback: false,
            lastUpdated: Date.now(),
          });
        }
      } catch (requestError) {
        if (!active || controller.signal.aborted) return;
        console.error("Не удалось обновить курсы CoinGecko:", requestError);
        setState({
          ...FALLBACK_RATES,
          isLoading: false,
          error:
            requestError instanceof Error
              ? requestError.message
              : "Не удалось получить курсы криптовалют.",
          isFallback: true,
          lastUpdated: null,
        });
      } finally {
        isRequestInFlight = false;
      }
    };

    void updateRates();
    const intervalId = window.setInterval(
      () => void updateRates(),
      REFRESH_INTERVAL_MS,
    );

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  return state;
}

export default useCryptoRates;
