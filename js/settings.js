// ===== Settings Module =====
// localStorage에 설정 저장/불러오기

const Settings = (() => {
  const KEY = 'blog_auto_settings';

  function encode(str) {
    try { return btoa(unescape(encodeURIComponent(str))); } catch { return str; }
  }
  function decode(str) {
    try { return decodeURIComponent(escape(atob(str))); } catch { return str; }
  }

  function save(data) {
    const encoded = {
      blogId: encode(data.blogId || ''),
      blogPw: encode(data.blogPw || ''),
      supabaseUrl: encode(data.supabaseUrl || ''),
      supabaseKey: encode(data.supabaseKey || ''),
      geminiApi: encode(data.geminiApi || ''),
    };
    localStorage.setItem(KEY, JSON.stringify(encoded));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const encoded = JSON.parse(raw);
      return {
        blogId: decode(encoded.blogId || ''),
        blogPw: decode(encoded.blogPw || ''),
        supabaseUrl: decode(encoded.supabaseUrl || ''),
        supabaseKey: decode(encoded.supabaseKey || ''),
        geminiApi: decode(encoded.geminiApi || ''),
      };
    } catch {
      return null;
    }
  }

  function isConfigured() {
    if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.geminiKey) return true;
    const s = load();
    return s && s.geminiApi && s.geminiApi.length > 0;
  }

  function getGeminiKey() {
    if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.geminiKey) return APP_CONFIG.geminiKey;
    const s = load();
    return s ? s.geminiApi : '';
  }

  function getSupabaseConfig() {
    // APP_CONFIG가 있으면 하드코딩된 값 우선 사용
    if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseKey) {
      return { url: APP_CONFIG.supabaseUrl, key: APP_CONFIG.supabaseKey };
    }
    const s = load();
    if (!s) return null;
    return { url: s.supabaseUrl, key: s.supabaseKey };
  }

  function getGreeting() {
    return localStorage.getItem('blog_greeting') || '';
  }

  function saveGreeting(text) {
    localStorage.setItem('blog_greeting', text);
  }

  return { save, load, isConfigured, getGeminiKey, getSupabaseConfig, getGreeting, saveGreeting };
})();
