/** Cloudflare Turnstile (free bot check) for the sign-in form. The site key is public by design. */
export const TURNSTILE_SITEKEY = '0x4AAAAAAGDGo0fE8e_HYL59';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

let loading: Promise<TurnstileApi> | null = null;

export const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Bot check failed to load.')));
    script.onerror = () => { loading = null; reject(new Error('Bot check could not load. Check your connection or ad blocker.')); };
    document.head.appendChild(script);
  });
  return loading;
};
