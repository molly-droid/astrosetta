import { useEffect, useRef, useState } from 'react';
import { fetchExplanation } from '@/lib/explainIt';

export default function useExplanation(context, knowledgeDepth, scope = '') {
  const key = JSON.stringify([scope, knowledgeDepth, context]);
  const latestKey = useRef(key);
  latestKey.current = key;
  const request = useRef(0);
  const [state, setState] = useState(null);
  useEffect(() => {
    request.current += 1;
    setState(null);
    return () => { request.current += 1; };
  }, [key]);
  const current = state?.key === key ? state : null;
  const toggle = async () => {
    if (!context) return;
    if (current?.open) { setState({ ...current, open: false }); return; }
    if (current?.text || current?.loading) { setState({ ...current, open: true }); return; }
    const id = ++request.current;
    setState({ key, open: true, loading: true });
    try {
      const text = await fetchExplanation(context, knowledgeDepth);
      if (latestKey.current === key && request.current === id) {
        setState(previous => ({ ...previous, text, loading: false }));
      }
    } catch {
      if (latestKey.current === key && request.current === id) {
        setState(previous => ({ ...previous, loading: false, error: 'Unable to explain this reading. Select Explain it to try again.' }));
      }
    }
  };
  return { open: !!current?.open, text: current?.text || current?.error, loading: !!current?.loading, toggle };
}
