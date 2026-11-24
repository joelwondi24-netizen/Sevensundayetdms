import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  EN_DICTIONARY,
  RTL_LANGUAGE_CODES,
  STATIC_LOCALE_CODES,
  WORLD_LANGUAGES,
  findWorldLanguage,
  type WorldLanguage,
} from './languages';

interface I18nContextValue {
  lang: string;
  currentLanguage: WorldLanguage;
  dir: 'ltr' | 'rtl';
  defaultLanguage: string;
  enabledLanguages: string[];
  rtlAuto: boolean;
  isTranslating: boolean;
  coveragePercent: (code: string) => number;
  favorites: string[];
  recents: string[];
  toggleFavorite: (code: string) => void;
  setLanguage: (code: string, persistForUser?: boolean) => Promise<void>;
  syncUserLanguagePreference: (userLang?: string) => void;
  refreshConfig: () => Promise<void>;
  translateMissingWithAi: (targetCode?: string) => Promise<{ cached: number; generated: number }>;
  t: (key: string, fallback?: string, vars?: Record<string, string | number>) => string;
  allDictionaryKeys: string[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

const LS_LANG_KEY = 'ss_etms_lang';
const LS_FAV_KEY = 'ss_etms_lang_favs';
const LS_RECENT_KEY = 'ss_etms_lang_recents';

function readJsonArray(key: string, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LS_LANG_KEY);
      return saved && saved.trim() ? saved.trim() : 'en';
    } catch {
      return 'en';
    }
  });
  const [defaultLanguage, setDefaultLanguage] = useState<string>('en');
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>([]);
  const [rtlAuto, setRtlAuto] = useState<boolean>(true);
  const [staticPack, setStaticPack] = useState<Record<string, string>>(EN_DICTIONARY);
  const [serverOverrides, setServerOverrides] = useState<Record<string, string>>({});
  const [coverageCounts, setCoverageCounts] = useState<Record<string, number>>({});
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>(() =>
    readJsonArray(LS_FAV_KEY, ['en', 'am', 'om', 'ti', 'ar', 'zh-CN'])
  );
  const [recents, setRecents] = useState<string[]>(() => readJsonArray(LS_RECENT_KEY, ['en', 'am']));

  const totalKeys = useMemo(() => Object.keys(EN_DICTIONARY).length, []);
  const staticCacheRef = useRef<Map<string, Record<string, string>>>(new Map([['en', EN_DICTIONARY]]));

  const currentLanguage = useMemo(() => findWorldLanguage(lang), [lang]);
  const dir: 'ltr' | 'rtl' = useMemo(() => {
    if (!rtlAuto) return 'ltr';
    const base = lang.split('-')[0].toLowerCase();
    return currentLanguage.dir === 'rtl' || RTL_LANGUAGE_CODES.has(lang.toLowerCase()) || RTL_LANGUAGE_CODES.has(base)
      ? 'rtl'
      : 'ltr';
  }, [lang, currentLanguage.dir, rtlAuto]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const loadStaticLocale = useCallback(async (code: string): Promise<Record<string, string>> => {
    if (staticCacheRef.current.has(code)) {
      return staticCacheRef.current.get(code)!;
    }
    if (!STATIC_LOCALE_CODES.has(code)) {
      return {};
    }
    try {
      const res = await fetch(`/locales/${encodeURIComponent(code)}.json`, { cache: 'no-cache' });
      if (res.ok) {
        const json = (await res.json()) as Record<string, string>;
        staticCacheRef.current.set(code, json);
        return json;
      }
    } catch {
      // ignore network error and fall back gracefully
    }
    return {};
  }, []);

  const loadConfigForLang = useCallback(
    async (targetCode: string) => {
      try {
        const token = sessionStorage.getItem('ss_etms_token') || localStorage.getItem('ss_etms_token') || '';
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`/api/i18n/config?lang=${encodeURIComponent(targetCode)}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setDefaultLanguage(String(data.default_language || 'en'));
          setEnabledLanguages(Array.isArray(data.enabled_languages) ? data.enabled_languages : []);
          setRtlAuto(data.rtl_auto !== false);
          setServerOverrides(data.translations && typeof data.translations === 'object' ? data.translations : {});
          const map: Record<string, number> = {};
          if (Array.isArray(data.coverage_counts)) {
            for (const c of data.coverage_counts) {
              if (c?.lang_code) map[String(c.lang_code)] = Number(c.count || 0);
            }
          }
          setCoverageCounts(map);
        }
      } catch {
        // non-blocking
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const pack = await loadStaticLocale(lang);
      if (active) setStaticPack(pack);
      await loadConfigForLang(lang);
    })();
    return () => {
      active = false;
    };
  }, [lang, loadStaticLocale, loadConfigForLang]);

  const setLanguage = useCallback(
    async (code: string, persistForUser = true) => {
      const clean = String(code || 'en').trim();
      setLangState(clean);
      try {
        localStorage.setItem(LS_LANG_KEY, clean);
        const nextRecents = [clean, ...recents.filter((c) => c !== clean)].slice(0, 6);
        setRecents(nextRecents);
        localStorage.setItem(LS_RECENT_KEY, JSON.stringify(nextRecents));
      } catch {
        // ignore storage errors
      }

      if (persistForUser) {
        const token = sessionStorage.getItem('ss_etms_token') || localStorage.getItem('ss_etms_token') || '';
        if (token) {
          fetch('/api/i18n/user-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lang_code: clean }),
          }).catch(() => {});
        }
      }
    },
    [recents]
  );

  const syncUserLanguagePreference = useCallback(
    (userLang?: string) => {
      const savedLocal = (() => {
        try {
          return localStorage.getItem(LS_LANG_KEY) || '';
        } catch {
          return '';
        }
      })();
      if (userLang && userLang.trim() && !savedLocal) {
        void setLanguage(userLang.trim(), false);
      }
    },
    [setLanguage]
  );

  const toggleFavorite = useCallback((code: string) => {
    setFavorites((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      try {
        localStorage.setItem(LS_FAV_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const translateMissingWithAi = useCallback(
    async (targetCode?: string): Promise<{ cached: number; generated: number }> => {
      const target = (targetCode || lang).trim();
      if (!target || target === 'en') return { cached: 0, generated: 0 };
      const meta = findWorldLanguage(target);
      const staticForTarget = await loadStaticLocale(target);
      const missingPayload: Record<string, string> = {};
      for (const [k, enVal] of Object.entries(EN_DICTIONARY)) {
        if (!staticForTarget[k] && !(target === lang && serverOverrides[k])) {
          missingPayload[k] = enVal;
        }
      }
      if (Object.keys(missingPayload).length === 0) {
        return { cached: totalKeys, generated: 0 };
      }
      setIsTranslating(true);
      try {
        const token = sessionStorage.getItem('ss_etms_token') || localStorage.getItem('ss_etms_token') || '';
        const res = await fetch('/api/i18n/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            target_lang: target,
            target_lang_name: meta.name,
            keys: missingPayload,
          }),
        });
        if (!res.ok) return { cached: 0, generated: 0 };
        const data = await res.json();
        if (target === lang && data.translations) {
          setServerOverrides((prev) => ({ ...prev, ...data.translations }));
        }
        await loadConfigForLang(lang);
        return {
          cached: Number(data.cached || 0),
          generated: Number(data.generated || 0),
        };
      } finally {
        setIsTranslating(false);
      }
    },
    [lang, loadStaticLocale, serverOverrides, totalKeys, loadConfigForLang]
  );

  const coveragePercent = useCallback(
    (code: string): number => {
      if (code === 'en' || STATIC_LOCALE_CODES.has(code)) return 100;
      const dbCnt = coverageCounts[code] || 0;
      return Math.min(100, Math.round((dbCnt / Math.max(1, totalKeys)) * 100));
    },
    [coverageCounts, totalKeys]
  );

  const refreshConfig = useCallback(async () => {
    await loadConfigForLang(lang);
  }, [lang, loadConfigForLang]);

  const t = useCallback(
    (key: string, fallback?: string, vars?: Record<string, string | number>): string => {
      let text =
        serverOverrides[key] ||
        staticPack[key] ||
        EN_DICTIONARY[key] ||
        fallback ||
        key;
      if (vars) {
        for (const [vk, vv] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${vk}\\}`, 'g'), String(vv));
        }
      }
      return text;
    },
    [serverOverrides, staticPack]
  );

  const allDictionaryKeys = useMemo(() => Object.keys(EN_DICTIONARY), []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      currentLanguage,
      dir,
      defaultLanguage,
      enabledLanguages,
      rtlAuto,
      isTranslating,
      coveragePercent,
      favorites,
      recents,
      toggleFavorite,
      setLanguage,
      syncUserLanguagePreference,
      refreshConfig,
      translateMissingWithAi,
      t,
      allDictionaryKeys,
    }),
    [
      lang,
      currentLanguage,
      dir,
      defaultLanguage,
      enabledLanguages,
      rtlAuto,
      isTranslating,
      coveragePercent,
      favorites,
      recents,
      toggleFavorite,
      setLanguage,
      syncUserLanguagePreference,
      refreshConfig,
      translateMissingWithAi,
      t,
      allDictionaryKeys,
    ]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      lang: 'en',
      currentLanguage: WORLD_LANGUAGES[0],
      dir: 'ltr',
      defaultLanguage: 'en',
      enabledLanguages: [],
      rtlAuto: true,
      isTranslating: false,
      coveragePercent: () => 100,
      favorites: ['en', 'am', 'om'],
      recents: ['en'],
      toggleFavorite: () => {},
      setLanguage: async () => {},
      syncUserLanguagePreference: () => {},
      refreshConfig: async () => {},
      translateMissingWithAi: async () => ({ cached: 0, generated: 0 }),
      t: (key: string, fallback?: string) => EN_DICTIONARY[key] || fallback || key,
      allDictionaryKeys: Object.keys(EN_DICTIONARY),
    };
  }
  return ctx;
}

export const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    lang,
    currentLanguage,
    enabledLanguages,
    favorites,
    recents,
    toggleFavorite,
    setLanguage,
    coveragePercent,
    translateMissingWithAi,
    isTranslating,
    t,
  } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const availablePool = useMemo(() => {
    if (enabledLanguages.length === 0) return WORLD_LANGUAGES;
    const set = new Set(enabledLanguages);
    set.add('en');
    const filtered = WORLD_LANGUAGES.filter((l) => set.has(l.code));
    return filtered.length > 0 ? filtered : WORLD_LANGUAGES;
  }, [enabledLanguages]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return availablePool.filter((l) => {
      if (regionFilter !== 'All' && l.region !== regionFilter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
      );
    });
  }, [availablePool, query, regionFilter]);

  const favoriteItems = useMemo(
    () => availablePool.filter((l) => favorites.includes(l.code)),
    [availablePool, favorites]
  );

  const recentItems = useMemo(
    () => recents.map((c) => availablePool.find((l) => l.code === c)).filter(Boolean) as WorldLanguage[],
    [availablePool, recents]
  );

  const currentCov = coveragePercent(lang);

  return (
    <div ref={containerRef} className="relative z-40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="language-switcher-trigger"
        title={t('app.selectLanguage')}
        className={`flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-xs font-medium'
        }`}
      >
        <span className="text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider">{currentLanguage.code}</span>
        {!compact && <span className="max-w-[110px] truncate">{currentLanguage.nativeName}</span>}
        {currentLanguage.dir === 'rtl' && (
          <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            RTL
          </span>
        )}
        <svg className="w-3.5 h-3.5 opacity-60 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[92vw] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden z-50">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {t('app.selectLanguage')} ({WORLD_LANGUAGES.length}+)
              </span>
              {currentCov < 100 && lang !== 'en' && (
                <button
                  type="button"
                  disabled={isTranslating}
                  onClick={() => void translateMissingWithAi(lang)}
                  className="text-[11px] font-semibold px-2 py-1 rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {isTranslating ? t('app.translating') : t('app.translateWithAi')}
                </button>
              )}
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('app.searchLanguages')}
              autoFocus
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex flex-wrap gap-1">
              {['All', 'Ethiopia & Horn', 'Global Major', 'Asia-Pacific', 'Middle East & Africa', 'Europe & Americas'].map((reg) => (
                <button
                  key={reg}
                  type="button"
                  onClick={() => setRegionFilter(reg)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    regionFilter === reg
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300/70'
                  }`}
                >
                  {reg === 'All' ? t('common.all') : reg}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {!query && regionFilter === 'All' && favoriteItems.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  ★ {t('app.favorites')}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {favoriteItems.map((item) => {
                    const active = item.code === lang;
                    return (
                      <button
                        key={`fav-${item.code}`}
                        type="button"
                        onClick={() => {
                          void setLanguage(item.code);
                          setOpen(false);
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                          active
                            ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold border border-sky-200 dark:border-sky-800'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span className="truncate">{item.nativeName}</span>
                        <span className="text-[10px] font-mono opacity-60 ml-1">{item.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!query && regionFilter === 'All' && recentItems.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('app.recentlyUsed')}
                </div>
                <div className="flex flex-wrap gap-1 px-1">
                  {recentItems.map((item) => (
                    <button
                      key={`rec-${item.code}`}
                      type="button"
                      onClick={() => {
                        void setLanguage(item.code);
                        setOpen(false);
                      }}
                      className={`px-2 py-1 rounded text-[11px] border ${
                        item.code === lang
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {item.nativeName} ({item.code})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-1.5">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('app.allLanguages')} ({filteredList.length})
              </div>
              {filteredList.map((item) => {
                const active = item.code === lang;
                const isFav = favorites.includes(item.code);
                const cov = coveragePercent(item.code);
                return (
                  <div
                    key={item.code}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      active ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void setLanguage(item.code);
                        setOpen(false);
                      }}
                      className="flex-1 flex items-center justify-between text-left min-w-0 pr-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {item.nativeName}{' '}
                          <span className="text-[11px] opacity-65 font-normal">· {item.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {item.dir === 'rtl' && (
                          <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            RTL
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            cov === 100
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : cov > 0
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {cov}%
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 w-10 text-right">{item.code}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.code);
                      }}
                      className={`px-1 text-sm ${isFav ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                      title="Toggle Favorite"
                    >
                      ★
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
