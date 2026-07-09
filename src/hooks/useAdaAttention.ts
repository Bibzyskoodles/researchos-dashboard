// Ada movement is disabled — position is fixed at bottom-right.
// useAdaAttention is kept as a no-op so call sites don't need to change.
export function useAdaAttention(
  _target: { x: number; y: number },
  _opts?: { delay?: number; returnAfterMs?: number }
) {}
