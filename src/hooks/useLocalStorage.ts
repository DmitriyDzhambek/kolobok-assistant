import { useCallback, useEffect, useState } from "react";

type ValueValidator<T> = (value: unknown) => value is T;

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  isValue?: ValueValidator<T>,
): readonly [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved === null) return initialValue;
      const parsed: unknown = JSON.parse(saved);
      if (isValue && !isValue(parsed)) {
        console.warn(`Значение localStorage "${key}" имеет неверный формат.`);
        return initialValue;
      }
      return parsed as T;
    } catch (error) {
      console.error(`Не удалось прочитать localStorage "${key}":`, error);
      return initialValue;
    }
  });

  const updateValue = useCallback((nextValue: T) => {
    setValue(nextValue);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Не удалось сохранить localStorage "${key}":`, error);
    }
  }, [key, value]);

  return [value, updateValue] as const;
}
