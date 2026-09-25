import { useSearchParams } from 'react-router-dom';

/**
 * useTabUrl — syncs a tab value to a URL query parameter.
 * Preserves other existing search params when updating.
 *
 * @param {string} paramName — the query param name (e.g. 'tab', 'view', 'section')
 * @param {string} defaultValue — fallback when param is absent
 * @returns {[string, (v: string) => void]} [value, setValue]
 */
export function useTabUrl(paramName, defaultValue) {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(paramName) || defaultValue;

  const setValue = (newValue) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(paramName, newValue);
      return next;
    }, { replace: true });
  };

  return [value, setValue];
}