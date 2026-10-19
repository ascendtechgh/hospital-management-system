import { useEffect, useState } from 'react';

export function useLocalDate() {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    let timer;
    function scheduleMidnight() {
      const now = new Date();
      const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(() => {
        setToday(new Date());
        scheduleMidnight();
      }, nextDay.getTime() - now.getTime());
    }
    scheduleMidnight();
    return () => window.clearTimeout(timer);
  }, []);

  return today;
}
