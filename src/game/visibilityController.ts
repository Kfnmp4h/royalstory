export function subscribeToVisibility(
  source: Document,
  onChange: (hidden: boolean) => void,
): () => void {
  const report = () => onChange(source.hidden);
  source.addEventListener('visibilitychange', report);
  report();
  return () => source.removeEventListener('visibilitychange', report);
}
