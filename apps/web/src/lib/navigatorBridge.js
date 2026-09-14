// Lightweight bridge so any component can open the Chart Navigator with a
// pre-filled question. FloatingNavigator listens for this event.
export function askNavigator(question) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('astrosetta:ask-navigator', { detail: { question } }));
}