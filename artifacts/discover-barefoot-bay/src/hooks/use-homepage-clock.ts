import { useEffect, useState } from "react";
import { homepageClockDelay } from "@/lib/homepage-events";

export function useHomepageClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      clearTimeout(timer);
      const current = new Date();
      setNow(current);
      timer = setTimeout(tick, homepageClockDelay(current));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    tick();
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}