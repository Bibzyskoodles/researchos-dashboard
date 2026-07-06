import { useEffect, useRef } from "react";
import { useAda } from "../ada/AdaContext";

const HOME = { x: 0.92, y: 0.88 };

export function useAdaAttention(
  target: { x: number; y: number },
  { delay = 2000, returnAfterMs = 5000 }: { delay?: number; returnAfterMs?: number } = {}
) {
  const { setPosition, store } = useAda();
  const didFly = useRef(false);

  useEffect(() => {
    didFly.current = false;
  }, [target.x, target.y]);

  useEffect(() => {
    if (didFly.current) return;
    if (store.isOpen) return;

    const flyTimer = setTimeout(() => {
      didFly.current = true;
      setPosition(target.x, target.y);

      const returnTimer = setTimeout(() => {
        setPosition(HOME.x, HOME.y);
      }, returnAfterMs);

      return () => clearTimeout(returnTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, delay);

    return () => clearTimeout(flyTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, returnAfterMs, store.isOpen]);
}
