import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UI_LABELS } from '../utils/ethiopianCalendar';
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
  translateText: (text: string, targetCode?: string) => Promise<string>;
  t: (key: string, fallback?: string, vars?: Record<string, string | number>) => string;
  allDictionaryKeys: string[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

const LS_LANG_KEY = 'ss_etms_lang';
const LS_FAV_KEY = 'ss_etms_lang_favs';
const LS_RECENT_KEY = 'ss_etms_lang_recents';
const LS_PHRASE_PREFIX = 'ss_etms_phrases_v1_';

interface TrackedTextState {
  original: string;
  lastApplied: string | null;
}

type TrackedAttrMap = Record<string, { original: string; lastApplied: string | null }>;

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'KBD', 'SAMP']);
const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;

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

function loadLocalPhraseCache(langCode: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!langCode || langCode === 'en') return map;
  try {
    const raw = localStorage.getItem(`${LS_PHRASE_PREFIX}${langCode}`);
    if (!raw) return map;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.trim()) map.set(k, v);
      }
    }
  } catch {
    // ignore corrupted cache
  }
  return map;
}

function persistLocalPhraseCache(langCode: string, map: Map<string, string>): void {
  if (!langCode || langCode === 'en') return;
  try {
    const entries = Array.from(map.entries());
    const sliced = entries.length > 1800 ? entries.slice(entries.length - 1800) : entries;
    const obj: Record<string, string> = {};
    for (const [k, v] of sliced) obj[k] = v;
    localStorage.setItem(`${LS_PHRASE_PREFIX}${langCode}`, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
}

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.closest('.notranslate, [data-no-translate="true"], [contenteditable="true"], .recharts-surface')) {
    return true;
  }
  return false;
}

function shouldTranslatePhrase(core: string): boolean {
  const trimmed = core.trim();
  if (!trimmed || trimmed.length > 1200) return false;
  // Must contain at least 2 Unicode letters
  if (!/\p{L}{2,}/u.test(trimmed)) return false;
  // Keep short all-uppercase technical codes/abbreviations verbatim (ETB, GRN, GIN, ID, OT, TCP/IP, ADMS, K40, etc.)
  if (/^[A-Z0-9/+.\-_]{1,6}$/.test(trimmed)) return false;
  // Emails
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  // URLs or API paths
  if (/^(?:https?:\/\/|wss?:\/\/|\/[a-z0-9_.-])/i.test(trimmed)) return false;
  // IPs / Host:Port
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?$/.test(trimmed)) return false;
  // Timezones like Africa/Addis_Ababa
  if (/^[A-Za-z_]+\/[A-Za-z_]+$/.test(trimmed)) return false;
  // Serial / code identifiers without spaces (SS-EMP-001, DEV-K40-01, etc.)
  if (/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)+$/.test(trimmed)) return false;
  // Currency amounts / pure numbers + units
  if (/^(?:ETB|USD|EUR|GBP|BIRR)?\s*[+-]?[\d,.]+(?:\s*(?:ms|sec|s|min|m|hr|hrs|h|%|°C|kg|g|pcs|px))?$/i.test(trimmed)) {
    return false;
  }
  // ISO Dates / Times
  if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(trimmed)) return false;
  if (/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?$/i.test(trimmed)) return false;
  // Exact hardware model token
  if (/^zkteco(?:\s+k40)?$/i.test(trimmed)) return false;
  return true;
}

function splitWhitespace(raw: string): { lead: string; core: string; trail: string } {
  const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m) return { lead: '', core: raw, trail: '' };
  return { lead: m[1] || '', core: m[2] || '', trail: m[3] || '' };
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

  // Full-platform live DOM translation refs
  const activeLangRef = useRef<string>(lang);
  activeLangRef.current = lang;
  const phraseMapsRef = useRef<Map<string, Map<string, string>>>(new Map());
  const textStateMapRef = useRef<WeakMap<Text, TrackedTextState>>(new WeakMap());
  const trackedTextsRef = useRef<Set<Text>>(new Set());
  const attrStateMapRef = useRef<WeakMap<Element, TrackedAttrMap>>(new WeakMap());
  const trackedAttrsRef = useRef<Set<Element>>(new Set());
  const pendingQueueRef = useRef<Set<string>>(new Set());
  const inFlightPhrasesRef = useRef<Set<string>>(new Set());
  const isApplyingDomRef = useRef<boolean>(false);
  const scanTimerRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const autoKeyTranslatedRef = useRef<Set<string>>(new Set());

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

  const getPhraseMap = useCallback((targetLang: string): Map<string, string> => {
    let m = phraseMapsRef.current.get(targetLang);
    if (!m) {
      m = loadLocalPhraseCache(targetLang);
      phraseMapsRef.current.set(targetLang, m);
    }
    return m;
  }, []);

  // Values already translated via staticPack / serverOverrides / UI_LABELS so DOM scanner won't double-translate them
  const alreadyLocalizedSet = useMemo(() => {
    const s = new Set<string>();
    if (lang === 'en') return s;
    for (const v of Object.values(staticPack)) {
      if (typeof v === 'string' && v.trim()) s.add(v.trim());
    }
    for (const v of Object.values(serverOverrides)) {
      if (typeof v === 'string' && v.trim()) s.add(v.trim());
    }
    const uiSub = lang.startsWith('zh') ? 'zh' : lang;
    const uiDict = (UI_LABELS as Record<string, Record<string, string>>)[uiSub];
    if (uiDict) {
      for (const v of Object.values(uiDict)) {
        if (typeof v === 'string' && v.trim()) s.add(v.trim());
      }
    }
    return s;
  }, [lang, staticPack, serverOverrides]);

  const alreadyLocalizedRef = useRef<Set<string>>(alreadyLocalizedSet);
  alreadyLocalizedRef.current = alreadyLocalizedSet;

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

  const loadConfigForLang = useCallback(async (targetCode: string) => {
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
  }, []);

  // Apply cached phrases to tracked nodes or restore original English cleanly
  const applyCachedDomTranslations = useCallback(
    (targetLang: string) => {
      const phraseMap = targetLang !== 'en' ? getPhraseMap(targetLang) : null;
      isApplyingDomRef.current = true;
      try {
        // 1) Text nodes
        for (const node of Array.from(trackedTextsRef.current)) {
          if (!node.isConnected) {
            trackedTextsRef.current.delete(node);
            continue;
          }
          const rec = textStateMapRef.current.get(node);
          if (!rec) continue;
          const current = node.nodeValue ?? '';
          if (rec.lastApplied !== null && current !== rec.lastApplied && current !== rec.original) {
            rec.original = current;
            rec.lastApplied = null;
          }
          if (targetLang === 'en') {
            if (current !== rec.original) {
              node.nodeValue = rec.original;
            }
            rec.lastApplied = rec.original;
          } else if (phraseMap) {
            const { lead, core, trail } = splitWhitespace(rec.original);
            const translated = phraseMap.get(core);
            if (translated) {
              const nextVal = `${lead}${translated}${trail}`;
              if (current !== nextVal) {
                node.nodeValue = nextVal;
              }
              rec.lastApplied = nextVal;
            } else if (rec.lastApplied && current === rec.lastApplied && current !== rec.original) {
              // Restore English while new language is fetching so old language doesn't linger
              node.nodeValue = rec.original;
              rec.lastApplied = null;
            }
          }
        }

        // 2) Attributes
        for (const el of Array.from(trackedAttrsRef.current)) {
          if (!el.isConnected) {
            trackedAttrsRef.current.delete(el);
            continue;
          }
          const recMap = attrStateMapRef.current.get(el);
          if (!recMap) continue;
          for (const attr of TRANSLATABLE_ATTRS) {
            const rec = recMap[attr];
            if (!rec) continue;
            const current = el.getAttribute(attr);
            if (current === null) continue;
            if (rec.lastApplied !== null && current !== rec.lastApplied && current !== rec.original) {
              rec.original = current;
              rec.lastApplied = null;
            }
            if (targetLang === 'en') {
              if (current !== rec.original) {
                el.setAttribute(attr, rec.original);
              }
              rec.lastApplied = rec.original;
            } else if (phraseMap) {
              const { lead, core, trail } = splitWhitespace(rec.original);
              const translated = phraseMap.get(core);
              if (translated) {
                const nextVal = `${lead}${translated}${trail}`;
                if (current !== nextVal) {
                  el.setAttribute(attr, nextVal);
                }
                rec.lastApplied = nextVal;
              } else if (rec.lastApplied && current === rec.lastApplied && current !== rec.original) {
                el.setAttribute(attr, rec.original);
                rec.lastApplied = null;
              }
            }
          }
        }
      } finally {
        isApplyingDomRef.current = false;
      }
    },
    [getPhraseMap]
  );

  const flushTranslationQueue = useCallback(async () => {
    const targetLang = activeLangRef.current;
    if (!targetLang || targetLang === 'en') {
      pendingQueueRef.current.clear();
      return;
    }
    const batch = Array.from(pendingQueueRef.current).filter((s) => !inFlightPhrasesRef.current.has(s));
    pendingQueueRef.current.clear();
    if (batch.length === 0) return;

    const meta = findWorldLanguage(targetLang);
    const phraseMap = getPhraseMap(targetLang);

    // Send in chunks of up to 75 unique phrases
    setIsTranslating(true);
    try {
      for (let i = 0; i < batch.length; i += 75) {
        if (activeLangRef.current !== targetLang) break;
        const slice = batch.slice(i, i + 75);
        slice.forEach((s) => inFlightPhrasesRef.current.add(s));
        try {
          const token = sessionStorage.getItem('ss_etms_token') || localStorage.getItem('ss_etms_token') || '';
          const res = await fetch('/api/i18n/translate-batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              target_lang: targetLang,
              target_lang_name: meta.name,
              texts: slice,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { translations?: Record<string, string> };
            if (data.translations) {
              for (const [src, tr] of Object.entries(data.translations)) {
                if (typeof tr === 'string' && tr.trim()) {
                  phraseMap.set(src, tr.trim());
                }
              }
              persistLocalPhraseCache(targetLang, phraseMap);
              if (activeLangRef.current === targetLang) {
                applyCachedDomTranslations(targetLang);
              }
            }
          }
        } catch {
          // non-blocking
        } finally {
          slice.forEach((s) => inFlightPhrasesRef.current.delete(s));
        }
      }
    } finally {
      if (activeLangRef.current === targetLang) {
        setIsTranslating(false);
      }
    }
  }, [applyCachedDomTranslations, getPhraseMap]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      void flushTranslationQueue();
    }, 55);
  }, [flushTranslationQueue]);

  const scanAndTranslateDom = useCallback(() => {
    const targetLang = activeLangRef.current;
    if (!document.body) return;

    if (targetLang === 'en') {
      applyCachedDomTranslations('en');
      return;
    }

    const phraseMap = getPhraseMap(targetLang);
    const localizedSkip = alreadyLocalizedRef.current;

    isApplyingDomRef.current = true;
    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode() as Text | null;
      while (node) {
        const parentEl = node.parentElement;
        if (parentEl && !shouldSkipElement(parentEl)) {
          const current = node.nodeValue ?? '';
          let rec = textStateMapRef.current.get(node);
          if (!rec) {
            // Do not capture strings that already came directly from staticPack/UI_LABELS/cache
            const trimmedCurrent = current.trim();
            if (trimmedCurrent && !localizedSkip.has(trimmedCurrent)) {
              rec = { original: current, lastApplied: null };
              textStateMapRef.current.set(node, rec);
              trackedTextsRef.current.add(node);
            }
          } else {
            if (rec.lastApplied !== null && current !== rec.lastApplied && current !== rec.original) {
              // React updated this node with new source text
              const trimmedCurrent = current.trim();
              if (localizedSkip.has(trimmedCurrent)) {
                rec.original = current;
                rec.lastApplied = current;
              } else {
                rec.original = current;
                rec.lastApplied = null;
              }
            }
          }

          if (rec) {
            const { lead, core, trail } = splitWhitespace(rec.original);
            if (core && !localizedSkip.has(core) && shouldTranslatePhrase(core)) {
              const cached = phraseMap.get(core);
              if (cached) {
                const nextVal = `${lead}${cached}${trail}`;
                if (node.nodeValue !== nextVal) {
                  node.nodeValue = nextVal;
                }
                rec.lastApplied = nextVal;
              } else if (!inFlightPhrasesRef.current.has(core)) {
                pendingQueueRef.current.add(core);
              }
            }
          }
        }
        node = walker.nextNode() as Text | null;
      }

      // Scan translatable attributes on elements
      const selector = TRANSLATABLE_ATTRS.map((a) => `[${a}]`).join(',');
      const elements = document.body.querySelectorAll(selector);
      elements.forEach((el) => {
        if (shouldSkipElement(el)) return;
        let recMap = attrStateMapRef.current.get(el);
        for (const attr of TRANSLATABLE_ATTRS) {
          const current = el.getAttribute(attr);
          if (!current) continue;
          let rec = recMap?.[attr];
          if (!rec) {
            const trimmed = current.trim();
            if (!trimmed || localizedSkip.has(trimmed)) continue;
            if (!recMap) {
              recMap = {};
              attrStateMapRef.current.set(el, recMap);
              trackedAttrsRef.current.add(el);
            }
            rec = { original: current, lastApplied: null };
            recMap[attr] = rec;
          } else if (rec.lastApplied !== null && current !== rec.lastApplied && current !== rec.original) {
            rec.original = current;
            rec.lastApplied = null;
          }

          const { lead, core, trail } = splitWhitespace(rec.original);
          if (core && !localizedSkip.has(core) && shouldTranslatePhrase(core)) {
            const cached = phraseMap.get(core);
            if (cached) {
              const nextVal = `${lead}${cached}${trail}`;
              if (current !== nextVal) {
                el.setAttribute(attr, nextVal);
              }
              rec.lastApplied = nextVal;
            } else if (!inFlightPhrasesRef.current.has(core)) {
              pendingQueueRef.current.add(core);
            }
          }
        }
      });
    } finally {
      isApplyingDomRef.current = false;
    }

    if (pendingQueueRef.current.size > 0) {
      scheduleFlush();
    }
  }, [applyCachedDomTranslations, getPhraseMap, scheduleFlush]);

  const scheduleDomScan = useCallback(() => {
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
    }
    scanTimerRef.current = window.setTimeout(() => {
      scanTimerRef.current = null;
      scanAndTranslateDom();
    }, 35);
  }, [scanAndTranslateDom]);

  // Observe DOM mutations so modals, tabs, tables, toasts, and dynamic text translate immediately
  useEffect(() => {
    if (!document.body) return;
    const observer = new MutationObserver(() => {
      if (isApplyingDomRef.current) return;
      if (activeLangRef.current === 'en') return;
      scheduleDomScan();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'],
    });
    return () => {
      observer.disconnect();
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [scheduleDomScan]);

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

  // Load locale pack, server config, server phrase cache, and run full-platform DOM translation whenever lang changes
  useEffect(() => {
    let active = true;
    pendingQueueRef.current.clear();

    // Immediately restore English or apply local cache for the newly selected language so old language never lingers
    applyCachedDomTranslations(lang);

    (async () => {
      const pack = await loadStaticLocale(lang);
      if (active) setStaticPack(pack);
      await loadConfigForLang(lang);

      if (lang !== 'en') {
        try {
          const res = await fetch(`/api/i18n/phrase-cache?lang=${encodeURIComponent(lang)}`);
          if (res.ok && active) {
            const data = (await res.json()) as { phrases?: Record<string, string> };
            if (data.phrases) {
              const m = getPhraseMap(lang);
              for (const [src, tr] of Object.entries(data.phrases)) {
                if (typeof tr === 'string' && tr.trim()) m.set(src, tr.trim());
              }
              persistLocalPhraseCache(lang, m);
            }
          }
        } catch {
          // ignore
        }

        if (active && !STATIC_LOCALE_CODES.has(lang) && !autoKeyTranslatedRef.current.has(lang)) {
          autoKeyTranslatedRef.current.add(lang);
          void translateMissingWithAi(lang);
        }
      }

      if (active) {
        scheduleDomScan();
      }
    })();

    return () => {
      active = false;
    };
  }, [lang, loadStaticLocale, loadConfigForLang, getPhraseMap, applyCachedDomTranslations, scheduleDomScan, translateMissingWithAi]);

  const translateText = useCallback(
    async (text: string, targetCode?: string): Promise<string> => {
      const clean = String(text || '').trim();
      const target = (targetCode || activeLangRef.current || 'en').trim();
      if (!clean || !target || target === 'en') return text;

      const phraseMap = getPhraseMap(target);
      const cached = phraseMap.get(clean);
      if (cached) return cached;

      const meta = findWorldLanguage(target);
      try {
        const token = sessionStorage.getItem('ss_etms_token') || localStorage.getItem('ss_etms_token') || '';
        const res = await fetch('/api/i18n/translate-batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            target_lang: target,
            target_lang_name: meta.name,
            texts: [clean],
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { translations?: Record<string, string> };
          const translated = data.translations?.[clean];
          if (translated && translated.trim()) {
            phraseMap.set(clean, translated.trim());
            persistLocalPhraseCache(target, phraseMap);
            return translated.trim();
          }
        }
      } catch {
        // fallback below
      }
      return text;
    },
    [getPhraseMap]
  );

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
      translateText,
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
      translateText,
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
      translateText: async (text: string) => text,
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
        <span data-no-translate="true" className="text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider">
          {currentLanguage.code}
        </span>
        {!compact && (
          <span data-no-translate="true" className="max-w-[110px] truncate">
            {currentLanguage.nativeName}
          </span>
        )}
        {isTranslating && (
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" aria-hidden="true" />
        )}
        {currentLanguage.dir === 'rtl' && (
          <span data-no-translate="true" className="px-1 py-0.5 text-[9px] font-bold rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
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
                <div className="grid grid-cols-2 gap-1" data-no-translate="true">
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
                <div className="flex flex-wrap gap-1 px-1" data-no-translate="true">
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
              <div data-no-translate="true">
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
        </div>
      )}
    </div>
  );
};
