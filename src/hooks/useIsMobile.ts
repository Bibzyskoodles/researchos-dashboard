import { useEffect, useState } from "react";

// Small viewport hook for responsive layout switches in inline-styled components
// (no CSS media queries available). Defaults to a tablet/phone breakpoint.
export function useIsMobile(breakpoint = 820): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}
