// ===== App - 단일 대시보드 오케스트레이터 =====

const App = (() => {
  let toastTimer = null;
  const DRAFT_KEY = 'blog_draft';
  const HISTORY_KEY = 'blog_history';
  const HISTORY_MAX = 5;

  // postState: { title, greeting, sections: [{heading, content, photos:[{dataUrl,name,width}], isQuote}] }
  let postState = null;

  // ===== Composer State =====
  let composeSections = [];
  let composeSectionCounter = 0;
  let currentWizardStep = 1;

  // ===== Photo Edit Mode =====
  let photoEditMode = false;

  // ===== AI Search State =====
  let aiSearchInfo = null;
  let aiSearchEnabled = false;

  // ===== Tag State =====
  let suggestedTags = [];
  let selectedTags = [];

  // ===== IndexedDB (사진 임시저장용) =====
  const DraftPhotoDB = (() => {
    const DB_NAME = 'blog_draft_db';
    const STORE = 'photos';
    let db = null;

    function open() {
      return new Promise((resolve, reject) => {
        if (db) { resolve(db); return; }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, { keyPath: 'key' });
        req.onsuccess = e => { db = e.target.result; resolve(db); };
        req.onerror = () => reject(req.error);
      });
    }

    async function save(sections) {
      try {
        const database = await open();
        await new Promise((resolve, reject) => {
          const tx = database.transaction(STORE, 'readwrite');
          const req = tx.objectStore(STORE).put({ key: 'draft', sections });
          req.onsuccess = resolve;
          req.onerror = reject;
        });
      } catch (e) { /* ignore */ }
    }

    async function load() {
      try {
        const database = await open();
        return await new Promise((resolve) => {
          const tx = database.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get('draft');
          req.onsuccess = () => resolve(req.result ? req.result.sections : null);
          req.onerror = () => resolve(null);
        });
      } catch (e) { return null; }
    }

    async function clear() {
      try {
        const database = await open();
        const tx = database.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete('draft');
      } catch (e) { /* ignore */ }
    }

    async function saveHistory(timestamp, sections) {
      try {
        const database = await open();
        await new Promise((resolve, reject) => {
          const tx = database.transaction(STORE, 'readwrite');
          const req = tx.objectStore(STORE).put({ key: `hist_${timestamp}`, sections });
          req.onsuccess = resolve;
          req.onerror = reject;
        });
      } catch (e) { /* ignore */ }
    }

    async function loadHistory(timestamp) {
      try {
        const database = await open();
        return await new Promise((resolve) => {
          const tx = database.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get(`hist_${timestamp}`);
          req.onsuccess = () => resolve(req.result ? req.result.sections : null);
          req.onerror = () => resolve(null);
        });
      } catch (e) { return null; }
    }

    async function deleteHistory(timestamp) {
      try {
        const database = await open();
        const tx = database.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(`hist_${timestamp}`);
      } catch (e) { /* ignore */ }
    }

    async function clearAllHistory(timestamps) {
      try {
        const database = await open();
        const tx = database.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        (timestamps || []).forEach(ts => store.delete(`hist_${ts}`));
      } catch (e) { /* ignore */ }
    }

    return { save, load, clear, saveHistory, loadHistory, deleteHistory, clearAllHistory };
  })();

  // ===== Draft / 임시저장 =====
  function saveDraft() {
    if (!postState) return;
    try {
      const draft = {
        title: postState.title,
        greeting: postState.greeting,
        sections: postState.sections.map(sec => ({
          heading: sec.heading,
          content: sec.content,
          isQuote: sec.isQuote,
        })),
        tags: postState.tags,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) { /* quota exceeded — ignore */ }

    // 사진은 IndexedDB에 별도 저장
    DraftPhotoDB.save(postState.sections.map(sec => sec.photos || []));
    updateLogBadge();
    updateAutoSaveIndicator();
  }

  function updateAutoSaveIndicator() {
    const el = document.getElementById('autosave-indicator');
    if (!el) return;
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    el.textContent = `자동저장 ${h}:${m}`;
    el.classList.remove('hidden');
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || !draft.title) return;
      const banner = document.getElementById('draft-banner');
      const titlePreview = document.getElementById('draft-title-preview');
      const timePreview = document.getElementById('draft-time-preview');
      if (titlePreview) titlePreview.textContent = draft.title;
      if (timePreview && draft.savedAt) {
        const mins = Math.round((Date.now() - draft.savedAt) / 60000);
        timePreview.textContent = mins < 1 ? '방금 전' : mins < 60 ? `${mins}분 전` : `${Math.floor(mins / 60)}시간 전`;
      }
      if (banner) banner.classList.remove('hidden');
    } catch (e) { /* ignore */ }
  }

  async function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || !draft.title) return;

      // IndexedDB에서 사진 불러오기
      const savedPhotos = await DraftPhotoDB.load();

      postState = {
        title: draft.title,
        greeting: draft.greeting || '',
        sections: (draft.sections || []).map((sec, idx) => ({
          heading: sec.heading || '',
          content: sec.content || '',
          isQuote: sec.isQuote || false,
          photos: (savedPhotos && savedPhotos[idx]) ? savedPhotos[idx] : [],
        })),
        tags: draft.tags || [],
      };
      document.getElementById('final-title').value = draft.title;
      document.getElementById('preview-section').classList.remove('hidden');
      document.getElementById('preview-loading').classList.add('hidden');
      document.getElementById('preview-content').classList.remove('hidden');
      renderPostState();
      document.getElementById('draft-banner').classList.add('hidden');
      const photoCount = (savedPhotos || []).flat().length;
      showToast(`임시저장된 글을 복원했습니다${photoCount > 0 ? ` (사진 ${photoCount}장 포함)` : ''}`);
      updateLogBadge();
      document.getElementById('preview-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      showToast('복원 실패: ' + e.message);
    }
  }

  function saveToHistory() {
    if (!postState || !postState.title) return;
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const history = raw ? JSON.parse(raw) : [];
      const photoCount = postState.sections.reduce((sum, sec) => sum + (sec.photos || []).length, 0);
      const ts = Date.now();
      const item = {
        title: postState.title,
        greeting: postState.greeting || '',
        sections: postState.sections.map(sec => ({
          heading: sec.heading || '',
          content: sec.content || '',
          isQuote: sec.isQuote || false,
        })),
        tags: postState.tags || [],
        photoCount,
        savedAt: ts,
      };

      // 같은 제목이면 이전 사진 데이터 삭제
      const duplicate = history.find(h => h.title === item.title);
      if (duplicate && duplicate.savedAt) DraftPhotoDB.deleteHistory(duplicate.savedAt);

      const filtered = history.filter(h => h.title !== item.title);
      filtered.unshift(item);
      const saved = filtered.slice(0, HISTORY_MAX);

      // 잘려나간 항목의 사진도 정리
      const removed = filtered.slice(HISTORY_MAX);
      removed.forEach(h => { if (h.savedAt) DraftPhotoDB.deleteHistory(h.savedAt); });

      localStorage.setItem(HISTORY_KEY, JSON.stringify(saved));

      // 사진을 IndexedDB에 저장 (타임스탬프 키)
      const photosPerSection = postState.sections.map(sec => sec.photos || []);
      DraftPhotoDB.saveHistory(ts, photosPerSection);
    } catch (e) { /* quota exceeded */ }
  }

  function clearDraft() {
    saveToHistory();
    localStorage.removeItem(DRAFT_KEY);
    DraftPhotoDB.clear();
    document.getElementById('draft-banner').classList.add('hidden');
    updateLogBadge();
  }

  // ===== 로그 패널 =====
  function updateLogBadge() {
    const btn = document.getElementById('btn-log');
    if (!btn) return;
    const hasDraft = !!localStorage.getItem(DRAFT_KEY);
    const hasHistory = (() => {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw && JSON.parse(raw).length > 0;
      } catch { return false; }
    })();
    if (hasDraft || hasHistory) {
      btn.style.color = '#2563eb';
      btn.style.fontWeight = '700';
    } else {
      btn.style.color = '';
      btn.style.fontWeight = '';
    }
  }

  async function showLogPanel() {
    const modal = document.getElementById('log-modal');
    const body = document.getElementById('log-modal-body');
    if (!modal || !body) return;

    const raw = localStorage.getItem(DRAFT_KEY);
    let html = '';

    if (raw) {
      try {
        const draft = JSON.parse(raw);
        const savedPhotos = await DraftPhotoDB.load();
        const photoCount = savedPhotos ? savedPhotos.flat().length : 0;
        const sectionCount = (draft.sections || []).length;
        let timeStr = '';
        if (draft.savedAt) {
          const mins = Math.round((Date.now() - draft.savedAt) / 60000);
          timeStr = mins < 1 ? '방금 전' : mins < 60 ? `${mins}분 전` : `${Math.floor(mins / 60)}시간 전`;
        }
        html = `
          <div style="background:#eff6ff;border-radius:8px;padding:12px 14px;margin-bottom:12px;">
            <div style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:4px;">📝 미완성 글 발견</div>
            <div style="font-size:13px;font-weight:600;color:#1f2937;margin-bottom:6px;">${escapeHtml(draft.title || '제목 없음')}</div>
            <div style="font-size:11px;color:#6b7280;display:flex;gap:10px;">
              <span>섹션 ${sectionCount}개</span>
              ${photoCount > 0 ? `<span>사진 ${photoCount}장</span>` : ''}
              ${timeStr ? `<span>${timeStr} 저장</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="App.restoreDraft();App.closeLogPanel();" style="flex:1;padding:9px;background:#2563eb;color:#fff;border-radius:8px;font-size:12px;font-weight:600;border:none;cursor:pointer;">↩ 복원하기</button>
            <button onclick="App.clearDraft();App.closeLogPanel();" style="padding:9px 14px;background:#f3f4f6;color:#6b7280;border-radius:8px;font-size:12px;border:none;cursor:pointer;">삭제</button>
          </div>`;
      } catch {
        html = `<p style="font-size:12px;color:#ef4444;">로그 데이터를 읽는 중 오류가 발생했습니다.</p>`;
      }
    } else {
      html = `<p style="font-size:12px;color:#9ca3af;text-align:center;padding:12px 0;">저장된 작업이 없습니다.</p>`;
    }

    // 히스토리 섹션
    try {
      const histRaw = localStorage.getItem(HISTORY_KEY);
      const history = histRaw ? JSON.parse(histRaw) : [];
      if (history.length > 0) {
        const relTime = (ts) => {
          const mins = Math.round((Date.now() - ts) / 60000);
          if (mins < 1) return '방금 전';
          if (mins < 60) return `${mins}분 전`;
          if (mins < 1440) return `${Math.floor(mins / 60)}시간 전`;
          return `${Math.floor(mins / 1440)}일 전`;
        };
        const histHtml = history.map((item, idx) => {
          const pc = item.photoCount || 0;
          return `
          <div class="history-item">
            <div class="history-item-info">
              <div class="history-item-title">${escapeHtml(item.title || '제목 없음')}</div>
              <div class="history-item-meta">
                <span>문단 ${(item.sections || []).length}개</span>
                ${pc > 0 ? `<span>사진 ${pc}장</span>` : ''}
                <span>${relTime(item.savedAt)}</span>
              </div>
            </div>
            <button class="history-restore-btn" onclick="App.restoreFromHistory(${idx})">복원</button>
          </div>`;
        }).join('');
        html += `
          <div class="history-section">
            <div class="history-section-header">
              <span>🕐 이전 글 히스토리</span>
              <button onclick="App.clearHistory()" class="history-clear-btn">전체 삭제</button>
            </div>
            <div class="history-list">${histHtml}</div>
          </div>`;
      }
    } catch { /* ignore */ }

    body.innerHTML = html;
    modal.classList.remove('hidden');
    modal.onclick = (e) => { if (e.target === modal) closeLogPanel(); };
  }

  async function restoreFromHistory(idx) {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const history = JSON.parse(raw);
      const item = history[idx];
      if (!item) return;

      // IndexedDB에서 사진 불러오기
      const savedPhotos = item.savedAt ? await DraftPhotoDB.loadHistory(item.savedAt) : null;

      postState = {
        title: item.title,
        greeting: item.greeting || '',
        sections: (item.sections || []).map((sec, si) => ({
          heading: sec.heading || '',
          content: sec.content || '',
          isQuote: sec.isQuote || false,
          photos: (savedPhotos && savedPhotos[si]) ? savedPhotos[si] : [],
        })),
        tags: item.tags || [],
      };
      document.getElementById('final-title').value = item.title;
      document.getElementById('preview-section').classList.remove('hidden');
      document.getElementById('preview-loading').classList.add('hidden');
      document.getElementById('preview-content').classList.remove('hidden');
      renderPostState();
      saveDraft();
      closeLogPanel();
      const photoCount = savedPhotos ? savedPhotos.flat().length : 0;
      showToast(`이전 글을 복원했습니다${photoCount > 0 ? ` (사진 ${photoCount}장 포함)` : ''}`);
      updateLogBadge();
      document.getElementById('preview-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      showToast('복원 실패: ' + e.message);
    }
  }

  function clearHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const history = raw ? JSON.parse(raw) : [];
      const timestamps = history.map(h => h.savedAt).filter(Boolean);
      DraftPhotoDB.clearAllHistory(timestamps);
    } catch (e) { /* ignore */ }
    localStorage.removeItem(HISTORY_KEY);
    updateLogBadge();
    showLogPanel();
  }

  function closeLogPanel() {
    const modal = document.getElementById('log-modal');
    if (modal) modal.classList.add('hidden');
  }

  // ===== Toast =====
  function showToast(msg, duration = 2500) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  // ===== 모바일 감지 =====
  function isMobile() {
    return window.matchMedia('(max-width: 640px)').matches;
  }

  // ===== 사진 팝업 =====
  function openPhotoModal() {
    if (postState && postState.sections && postState.sections.length) {
      enterPhotoEditMode();
    } else {
      photoEditMode = false;
    }
    updatePhotoModalButtons();
    if (isMobile()) currentWizardStep = 1;
    renderComposer();
    document.getElementById('photo-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function enterPhotoEditMode() {
    photoEditMode = true;
    syncEditedText();

    // 기존 문단 구조를 composer에 복원
    composeSections = [];
    composeSectionCounter = 0;
    PhotoManager.clear();

    postState.sections.forEach((sec, idx) => {
      composeSectionCounter++;
      const secId = 's' + composeSectionCounter;
      composeSections.push({
        id: secId,
        heading: sec.heading || '',
        content: sec.content || '',
      });

      // 기존 사진을 PhotoManager에 등록 + 섹션에 배치
      (sec.photos || []).forEach(photo => {
        const photoId = 'ph_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const allPhotos = PhotoManager.getAllPhotos();
        allPhotos.push({
          id: photoId,
          file: null,
          name: photo.name || 'photo',
          dataUrl: photo.dataUrl,
          sectionId: secId,
        });
      });
    });
  }

  function updatePhotoModalButtons() {
    const doneBtn = document.getElementById('btn-photo-done');
    if (doneBtn) {
      doneBtn.textContent = photoEditMode ? '💾 사진 저장' : '✓ 완료';
    }
    const addSecBtn = document.getElementById('btn-add-compose-section');
    if (addSecBtn) addSecBtn.classList.toggle('hidden', photoEditMode);
  }

  function closePhotoModal() {
    if (photoEditMode) {
      savePhotoEditToPost();
    }
    document.getElementById('photo-modal').classList.add('hidden');
    document.body.style.overflow = '';
    updatePhotoBadge();
  }

  function savePhotoEditToPost() {
    if (!postState || !photoEditMode) return;

    composeSections.forEach((sec, idx) => {
      if (idx < postState.sections.length) {
        const assignedPhotos = PhotoManager.getPhotosForSection(sec.id);
        postState.sections[idx].photos = assignedPhotos.map(p => ({
          dataUrl: p.dataUrl,
          name: p.name || 'photo',
          width: 'full',
        }));
      }
    });

    renderPostState();
    saveDraft();
    photoEditMode = false;
    showToast('사진 배치가 저장되었습니다');
  }

  function updatePhotoBadge() {
    const photos = PhotoManager.getAllPhotos();
    const total = photos.length;
    const assigned = photos.filter(p => p.sectionId).length;
    const badge = document.getElementById('photo-count-badge');
    if (total > 0) {
      badge.textContent = assigned > 0 ? `${total}장 (${assigned}장 배치)` : `${total}장`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function initSupabase() {
    const cfg = Settings.getSupabaseConfig();
    if (cfg && cfg.url && cfg.key) {
      SupabaseDB.init(cfg.url, cfg.key);
    }
  }

  // ===== Composer 초기화 =====
  function initComposer() {
    composeSections = [];
    composeSectionCounter = 0;
    for (let i = 0; i < 3; i++) {
      composeSectionCounter++;
      composeSections.push({ id: 's' + composeSectionCounter, heading: '', content: '' });
    }
  }

  function addComposeSection() {
    composeSectionCounter++;
    composeSections.push({ id: 's' + composeSectionCounter, heading: '', content: '' });
    renderComposer();
  }

  function removeComposeSection(secId) {
    if (composeSections.length <= 1) {
      showToast('최소 1개의 문단이 필요합니다');
      return;
    }
    PhotoManager.unassignAllForSection(secId);
    composeSections = composeSections.filter(s => s.id !== secId);
    renderComposer();
  }

  function updateSectionHeading(secId, value) {
    const sec = composeSections.find(s => s.id === secId);
    if (sec) sec.heading = value;
  }

  function updateSectionContent(secId, value) {
    const sec = composeSections.find(s => s.id === secId);
    if (sec) sec.content = value;
  }

  // ===== Composer 렌더링 =====
  function renderComposer() {
    renderPhotoStrip();
    renderSectionBuilder();
    updateComposerFooter();
    if (isMobile()) {
      updateWizardStepIndicator();
      renderWizardStep();
    }
  }

  function updateComposerFooter() {
    const photos = PhotoManager.getAllPhotos();
    const assigned = photos.filter(p => p.sectionId).length;
    const total = photos.length;
    const info = document.getElementById('composer-photo-info');
    if (info) info.textContent = `총 ${total}장 · ${assigned}장 배치됨`;
  }

  function renderPhotoStrip() {
    const photos = PhotoManager.getAllPhotos();
    const strip = document.getElementById('photo-strip');
    const empty = document.getElementById('photo-strip-empty');
    if (!strip) return;

    if (!photos.length) {
      strip.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    strip.innerHTML = photos.map(photo => {
      const secBtns = composeSections.map((sec, si) => {
        const active = photo.sectionId === sec.id;
        return `<button class="strip-section-btn${active ? ' active' : ''}" onclick="App.togglePhotoSection('${photo.id}', '${sec.id}')">${si + 1}</button>`;
      }).join('');

      const assignedSi = composeSections.findIndex(s => s.id === photo.sectionId);
      const assignedLabel = assignedSi >= 0 ? `<span class="strip-assigned-label">${assignedSi + 1}번 문단</span>` : '';

      return `
        <div class="strip-photo-card${photo.sectionId ? ' assigned' : ''}"
             draggable="true"
             ondragstart="App.onPhotoDragStart(event, '${photo.id}', this)"
             ondragend="App.onPhotoDragEnd(event, this)">
          <div class="strip-photo-img-wrap">
            <img class="strip-photo-img" src="${photo.dataUrl}" alt="" />
            ${assignedLabel}
          </div>
          <div class="strip-photo-footer">
            <div class="strip-section-btns">${secBtns}</div>
            <button class="strip-remove-btn" onclick="App.removeStripPhoto('${photo.id}')">✕</button>
          </div>
        </div>`;
    }).join('');
  }

  function saveGreeting(text) {
    Settings.saveGreeting(text);
  }

  function renderSectionBuilder() {
    const builder = document.getElementById('section-builder');
    if (!builder) return;

    const greetingVal = Settings.getGreeting();
    const greetingSection = `
      <div class="compose-section compose-greeting-fixed">
        <div class="compose-section-header">
          <span class="compose-section-num" style="background:#e0f2fe;color:#0284c7;">인사말</span>
          <span style="font-size:11px;color:#9ca3af;margin-left:6px;">고정 · 매 글 상단에 표시</span>
        </div>
        <textarea class="compose-section-content"
                  placeholder="고정 인사말 — 예: 안녕하세요 희정이에요 ♡"
                  oninput="App.saveGreeting(this.value)">${escapeHtml(greetingVal)}</textarea>
      </div>`;

    builder.innerHTML = (photoEditMode ? '' : greetingSection) + composeSections.map((sec, si) => {
      const assignedPhotos = PhotoManager.getPhotosForSection(sec.id);
      const photosHtml = assignedPhotos.length
        ? assignedPhotos.map(p => `
            <div class="compose-assigned-photo">
              <img class="compose-assigned-thumb" src="${p.dataUrl}" alt="" />
              <button class="compose-photo-del" onclick="App.unassignComposedPhoto('${p.id}')">✕</button>
            </div>`).join('')
        : `<span class="compose-drop-empty">드래그하거나<br/>번호 버튼으로 배치</span>`;

      if (photoEditMode) {
        const contentPreview = sec.content ? sec.content.slice(0, 60) + (sec.content.length > 60 ? '…' : '') : '';
        return `
          <div class="compose-section" id="csec-${sec.id}">
            <div class="compose-section-header">
              <span class="compose-section-num">${si + 1}</span>
              <span class="compose-section-heading-readonly">${escapeHtml(sec.heading || `문단 ${si + 1}`)}</span>
            </div>
            ${contentPreview ? `<div class="compose-section-preview">${escapeHtml(contentPreview)}</div>` : ''}
            <div class="compose-drop-zone"
                 ondragover="App.onSectionDragOver(event, this)"
                 ondragleave="App.onSectionDragLeave(event, this)"
                 ondrop="App.onSectionDrop(event, this, '${sec.id}')">
              ${photosHtml}
            </div>
          </div>`;
      }

      return `
        <div class="compose-section" id="csec-${sec.id}">
          <div class="compose-section-header">
            <span class="compose-section-num">${si + 1}</span>
            <input class="compose-section-heading"
                   type="text"
                   placeholder="소제목 (선택)"
                   value="${escapeAttr(sec.heading)}"
                   oninput="App.updateSectionHeading('${sec.id}', this.value)" />
            <button class="compose-section-del" onclick="App.removeComposeSection('${sec.id}')">✕</button>
          </div>
          <textarea class="compose-section-content"
                    placeholder="내용 메모 (선택) — AI가 참고해서 글을 씁니다"
                    oninput="App.updateSectionContent('${sec.id}', this.value)">${escapeHtml(sec.content || '')}</textarea>
          <div class="compose-drop-zone"
               ondragover="App.onSectionDragOver(event, this)"
               ondragleave="App.onSectionDragLeave(event, this)"
               ondrop="App.onSectionDrop(event, this, '${sec.id}')">
            ${photosHtml}
          </div>
        </div>`;
    }).join('');
  }

  // ===== Mobile Wizard =====
  function getWizardSteps() {
    if (photoEditMode) return ['사진추가', '사진배치'];
    return ['사진추가', '문단구성', '사진배치', '내용작성'];
  }

  function updateWizardStepIndicator() {
    const container = document.getElementById('wizard-steps');
    if (!container) return;
    const labels = getWizardSteps();
    const maxStep = labels.length;
    container.innerHTML = labels.map((label, i) => {
      const step = i + 1;
      const cls = step === currentWizardStep ? 'active' : (step < currentWizardStep ? 'completed' : '');
      const dot = step < currentWizardStep ? '✓' : step;
      return `<div class="wizard-step-item ${cls}">
        <div class="wizard-step-dot">${dot}</div>
        <span class="wizard-step-label">${label}</span>
      </div>`;
    }).join('');

    // 하단 버튼 상태 및 step 표시
    const prevBtn = document.getElementById('wizard-prev');
    const nextBtn = document.getElementById('wizard-next');
    const stepInfo = document.getElementById('wizard-step-info');
    if (prevBtn) prevBtn.disabled = (currentWizardStep === 1);
    if (stepInfo) stepInfo.textContent = `${currentWizardStep} / ${maxStep}`;
    if (nextBtn) {
      if (currentWizardStep === maxStep) {
        nextBtn.textContent = photoEditMode ? '💾 저장' : '완료 ✓';
        nextBtn.className = 'wizard-nav-btn wizard-nav-done';
      } else {
        nextBtn.textContent = '다음 →';
        nextBtn.className = 'wizard-nav-btn wizard-nav-next';
      }
    }
  }

  function renderWizardStep(resetScroll = false) {
    const body = document.getElementById('wizard-body');
    if (!body) return;
    const savedScroll = body.scrollTop;
    if (photoEditMode) {
      if (currentWizardStep === 1) body.innerHTML = renderWizardStep1HTML();
      else if (currentWizardStep === 2) body.innerHTML = renderWizardStep3HTML();
    } else {
      if (currentWizardStep === 1) body.innerHTML = renderWizardStep1HTML();
      else if (currentWizardStep === 2) body.innerHTML = renderWizardStep2HTML();
      else if (currentWizardStep === 3) body.innerHTML = renderWizardStep3HTML();
      else if (currentWizardStep === 4) body.innerHTML = renderWizardStep4HTML();
    }
    body.scrollTop = resetScroll ? 0 : savedScroll;
  }

  function renderWizardStep1HTML() {
    const photos = PhotoManager.getAllPhotos();
    const grid = photos.map(p => `
      <div class="wizard-photo-thumb">
        <img src="${p.dataUrl}" alt="" />
        <button class="wizard-photo-thumb-del" onclick="App.removeStripPhoto('${p.id}')">✕</button>
      </div>`).join('');
    return `
      <label for="photo-upload" class="wizard-photo-add-btn">
        <span class="icon">📸</span>
        <span>사진 추가하기</span>
      </label>
      <div class="wizard-photo-grid">${grid}</div>`;
  }

  function renderWizardStep2HTML() {
    const greetingVal = Settings.getGreeting();
    const sectionItems = composeSections.map((sec, si) => `
      <div class="wizard-section-item">
        <div class="wizard-section-badge">${si + 1}</div>
        <input class="wizard-section-name-input"
               type="text"
               placeholder="소제목 입력 (선택)"
               value="${escapeAttr(sec.heading)}"
               oninput="App.updateSectionHeading('${sec.id}', this.value)" />
        <button class="wizard-section-del-btn" onclick="App.removeComposeSection('${sec.id}')">✕</button>
      </div>`).join('');
    return `
      <div class="wizard-section-list">
        <div class="wizard-greeting-item">
          <span class="wizard-greeting-label">인사말</span>
          <span style="font-size:12px;color:#374151;">${escapeHtml(greetingVal) || '(미설정)'}</span>
        </div>
        ${sectionItems}
        <button class="wizard-section-add-btn" onclick="App.addComposeSection()">+ 문단 추가</button>
      </div>`;
  }

  function renderWizardStep3HTML() {
    const photos = PhotoManager.getAllPhotos();
    if (!photos.length) {
      return `<div style="text-align:center;padding:40px 0;color:#9ca3af;">
        <div style="font-size:2rem;margin-bottom:8px;">🖼️</div>
        <p style="font-size:13px;">사진을 먼저 추가해주세요</p>
      </div>`;
    }

    // 편집 모드: 문단별로 그룹핑해서 보여주기
    if (photoEditMode) {
      const sectionGroups = composeSections.map((sec, si) => {
        const secPhotos = photos.filter(p => p.sectionId === sec.id);
        const unassignedHtml = secPhotos.map(p => `
          <div class="wizard-photo-assign-item assigned">
            <img class="wizard-assign-thumb" src="${p.dataUrl}" alt="" />
            <button class="wizard-assign-none-btn" onclick="App.unassignComposedPhoto('${p.id}')" style="margin-left:auto;">해제</button>
          </div>`).join('');
        return `
          <div class="wizard-edit-section-group">
            <div class="wizard-edit-section-label">${si + 1}. ${escapeHtml(sec.heading || '문단 ' + (si + 1))}</div>
            ${unassignedHtml || '<div class="wizard-edit-empty">배치된 사진 없음</div>'}
          </div>`;
      }).join('');

      const unassigned = photos.filter(p => !p.sectionId);
      const unassignedItems = unassigned.map(p => {
        const secBtns = composeSections.map((sec, si) => {
          return `<button class="wizard-assign-btn" onclick="App.togglePhotoSection('${p.id}', '${sec.id}')">${si + 1}</button>`;
        }).join('');
        return `
          <div class="wizard-photo-assign-item">
            <img class="wizard-assign-thumb" src="${p.dataUrl}" alt="" />
            <div class="wizard-assign-btns">${secBtns}</div>
          </div>`;
      }).join('');

      return `
        ${sectionGroups}
        ${unassigned.length ? `
          <div class="wizard-edit-section-group" style="border-color:#fbbf24;">
            <div class="wizard-edit-section-label" style="color:#d97706;">미배치 사진 (${unassigned.length}장)</div>
            ${unassignedItems}
          </div>` : ''}`;
    }

    // 일반 모드: 기존 방식
    const items = photos.map(p => {
      const isAssigned = !!p.sectionId;
      const secBtns = composeSections.map((sec, si) => {
        const active = p.sectionId === sec.id;
        return `<button class="wizard-assign-btn${active ? ' active' : ''}"
                        onclick="App.togglePhotoSection('${p.id}', '${sec.id}')">${si + 1}</button>`;
      }).join('');
      return `
        <div class="wizard-photo-assign-item${isAssigned ? ' assigned' : ''}">
          <img class="wizard-assign-thumb" src="${p.dataUrl}" alt="" />
          <div class="wizard-assign-btns">
            ${secBtns}
            ${isAssigned ? `<button class="wizard-assign-none-btn" onclick="App.unassignComposedPhoto('${p.id}')">해제</button>` : ''}
          </div>
        </div>`;
    }).join('');
    return `<div class="wizard-photo-assign-list">${items}</div>`;
  }

  function renderWizardStep4HTML() {
    const greetingVal = Settings.getGreeting();
    const greetingSection = `
      <div class="wizard-content-section greeting-section">
        <div class="wizard-content-label">인사말 (고정)</div>
        <textarea class="wizard-content-textarea"
                  placeholder="고정 인사말 — 예: 안녕하세요 희정이에요 ♡"
                  oninput="App.saveGreeting(this.value)">${escapeHtml(greetingVal)}</textarea>
      </div>`;

    const sections = composeSections.map((sec, si) => {
      const assignedPhotos = PhotoManager.getPhotosForSection(sec.id);
      const photosHtml = assignedPhotos.map(p => `
        <div class="wizard-section-photo-wrap">
          <img class="wizard-section-photo-thumb" src="${p.dataUrl}" alt="" />
          <button class="wizard-section-photo-unassign" onclick="App.unassignComposedPhoto('${p.id}')">✕</button>
        </div>`).join('');
      return `
        <div class="wizard-content-section">
          <div class="wizard-content-label">문단 ${si + 1}</div>
          <input class="wizard-heading-input"
                 type="text"
                 placeholder="소제목 (선택)"
                 value="${escapeAttr(sec.heading)}"
                 oninput="App.updateSectionHeading('${sec.id}', this.value)" />
          <textarea class="wizard-content-textarea"
                    placeholder="내용 메모 — AI가 참고해서 글을 씁니다"
                    oninput="App.updateSectionContent('${sec.id}', this.value)">${escapeHtml(sec.content || '')}</textarea>
          ${assignedPhotos.length ? `<div class="wizard-section-photos">${photosHtml}</div>` : ''}
        </div>`;
    }).join('');

    return greetingSection + sections;
  }

  function wizardNext() {
    const maxStep = getWizardSteps().length;
    if (currentWizardStep < maxStep) {
      currentWizardStep++;
      updateWizardStepIndicator();
      renderWizardStep(true);
    } else {
      closePhotoModal();
    }
  }

  function wizardPrev() {
    if (currentWizardStep > 1) {
      currentWizardStep--;
      updateWizardStepIndicator();
      renderWizardStep(true);
    }
  }

  // ===== Photo-Section Actions =====
  function togglePhotoSection(photoId, secId) {
    const photo = PhotoManager.getAllPhotos().find(p => p.id === photoId);
    if (!photo) return;
    if (photo.sectionId === secId) {
      PhotoManager.unassignPhoto(photoId);
    } else {
      PhotoManager.assignToSection(photoId, secId);
    }
    renderComposer();
  }

  function unassignComposedPhoto(photoId) {
    PhotoManager.unassignPhoto(photoId);
    renderComposer();
  }

  function removeStripPhoto(photoId) {
    PhotoManager.removePhoto(photoId);
    renderComposer();
  }

  // ===== Drag Handlers =====
  function onPhotoDragStart(e, photoId, el) {
    PhotoManager.setDragPhotoId(photoId);
    e.dataTransfer.effectAllowed = 'move';
    el.style.opacity = '0.4';
  }

  function onPhotoDragEnd(e, el) {
    el.style.opacity = '';
    PhotoManager.setDragPhotoId(null);
  }

  function onSectionDragOver(e, el) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drag-over');
  }

  function onSectionDragLeave(e, el) {
    if (!el.contains(e.relatedTarget)) {
      el.classList.remove('drag-over');
    }
  }

  function onSectionDrop(e, el, secId) {
    e.preventDefault();
    el.classList.remove('drag-over');
    const photoId = PhotoManager.getDragPhotoId();
    if (photoId) {
      PhotoManager.assignToSection(photoId, secId);
      PhotoManager.setDragPhotoId(null);
      renderComposer();
    }
  }

  function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ===== 글 작성 =====
  async function writePost() {
    if (!BlogForm.validate()) return;

    const apiKey = Settings.getGeminiKey();
    if (!apiKey) {
      showToast('Gemini API 키를 설정 후 저장해주세요');
      return;
    }

    // 이미 작성된 글이 있으면, 새로 생성하기 전에 로그(이전 글 히스토리)에 백업
    // → "글 작성하기"를 실수로 눌러 완성 글이 덮어써져도 복구 가능
    if (postState && postState.sections && postState.sections.length) {
      syncEditedText();
      saveToHistory();
      showToast('기존 글을 로그에 백업했어요');
    }

    const formData = BlogForm.getFormData();

    // composeSections 기반으로 paragraphs 구성
    const paragraphs = composeSections.map(sec => ({
      photoCount: PhotoManager.getPhotosForSection(sec.id).length,
      photos: PhotoManager.getPhotosForSection(sec.id),
      heading: sec.heading,
      content: sec.content,
    }));

    const previewSection = document.getElementById('preview-section');
    previewSection.classList.remove('hidden');
    document.getElementById('preview-loading').classList.remove('hidden');
    document.getElementById('preview-content').classList.add('hidden');
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const [result, tags] = await Promise.all([
        Gemini.generatePost({
          title: formData.title,
          blogType: formData.type,
          keyword: formData.keyword,
          greetingContext: Settings.getGreeting(),
          paragraphs,
          placeInfo: aiSearchEnabled ? aiSearchInfo : null,
        }, apiKey),
        Gemini.generateTags({
          title: formData.title,
          blogType: formData.type,
          keyword: formData.keyword,
        }, apiKey).catch(() => []),
      ]);

      buildPostState(formData.title, result, paragraphs);
      renderPostState();
      document.getElementById('preview-loading').classList.add('hidden');
      document.getElementById('preview-content').classList.remove('hidden');

      if (tags.length > 0) showTagModal(tags);
    } catch (err) {
      document.getElementById('preview-loading').classList.add('hidden');
      document.getElementById('preview-content').classList.remove('hidden');
      document.getElementById('post-body').innerHTML = `<p style="color:#ef4444">글 생성 실패: ${err.message}</p>`;
      document.getElementById('post-title').textContent = formData.title;
    }
  }

  // ===== postState 구축 =====
  function buildPostState(title, result, paragraphs) {
    const generatedParagraphs = result.paragraphs || [];
    const sections = paragraphs.map((para, idx) => {
      const genPara = generatedParagraphs[idx] || {};
      return {
        heading: genPara.heading || para.heading || '',
        content: genPara.content || '',
        photos: para.photos.map(p => ({ dataUrl: p.dataUrl, name: (p.file && p.file.name) || 'photo', width: 'full' })),
        isQuote: false,
      };
    });

    postState = {
      title,
      greeting: result.greeting || '',
      sections,
      tags: [],
    };
    saveDraft();
  }

  // ===== HTML 유틸 =====
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function toEditable(str) {
    return escapeHtml(String(str)).replace(/\n/g, '<br>');
  }

  // ===== DOM → postState 동기화 =====
  function syncEditedText() {
    if (!postState) return;

    const greetEl = document.getElementById('greeting-edit');
    if (greetEl) {
      postState.greeting = greetEl.innerText;
    }

    postState.sections.forEach((sec, idx) => {
      const headEl = document.getElementById(`sec-head-${idx}`);
      const bodyEl = document.getElementById(`sec-body-${idx}`);
      if (headEl) sec.heading = headEl.innerText;
      if (bodyEl) sec.content = bodyEl.innerText;
    });
  }

  // ===== 문단별 사진 HTML =====
  function renderSectionPhotos(sec, idx) {
    if (!sec.photos.length) return '';
    const sectionCount = postState.sections.length;

    return sec.photos.map((photo, pIdx) => {
      const moveOptions = Array.from({ length: sectionCount }, (_, si) =>
        `<option value="${si}" ${si === idx ? 'selected' : ''}>문단 ${si + 1}</option>`
      ).join('');

      return `
        <div class="preview-photo-row" id="photo-row-${idx}-${pIdx}">
          <img class="preview-thumb ${photo.width === 'half' ? 'half-w' : 'full-w'}" src="${photo.dataUrl}" alt="사진" />
          <div class="preview-photo-btns">
            <button class="sec-btn" onclick="App.movePhoto(${idx},${pIdx},'up')" title="위로">↑</button>
            <button class="sec-btn" onclick="App.movePhoto(${idx},${pIdx},'down')" title="아래로">↓</button>
            <button class="sec-btn" onclick="App.togglePhotoWidth(${idx},${pIdx})" title="너비 전환">${photo.width === 'half' ? '↔ 전체' : '↔ 반폭'}</button>
            <select class="para-select" onchange="App.movePhotoToSection(${idx},${pIdx},parseInt(this.value))" title="문단 이동">
              ${moveOptions}
            </select>
            <button class="sec-btn btn-photo-del" onclick="App.removePreviewPhoto(${idx},${pIdx})" title="삭제">✕</button>
          </div>
        </div>`;
    }).join('');
  }

  // ===== postState 전체 렌더 =====
  function renderPostState() {
    if (!postState) return;

    document.getElementById('post-title').textContent = postState.title;

    const tagsArea = document.getElementById('post-tags-area');
    if (tagsArea) {
      if (postState.tags && postState.tags.length > 0) {
        tagsArea.innerHTML = postState.tags.map(t => `<span class="post-tag">#${escapeHtml(t)}</span>`).join('');
        tagsArea.classList.remove('hidden');
      } else {
        tagsArea.classList.add('hidden');
      }
    }

    const body = document.getElementById('post-body');
    const sectionCount = postState.sections.length;

    let html = '';

    // 인사말
    html += `
      <div class="section-editor section-greeting">
        <div class="section-editor-header">
          <span class="section-badge">인사말</span>
        </div>
        <div class="section-greeting-edit" id="greeting-edit" contenteditable="true">${toEditable(postState.greeting)}</div>
      </div>`;

    // 각 문단
    postState.sections.forEach((sec, idx) => {
      html += `
        <div class="section-editor ${sec.isQuote ? 'section-quote' : ''}" id="sec-${idx}">
          <div class="section-editor-header">
            <span class="section-badge">문단 ${idx + 1}</span>
            <div class="section-actions">
              <button class="sec-btn" onclick="App.moveSectionUp(${idx})" ${idx === 0 ? 'disabled' : ''} title="위로">↑</button>
              <button class="sec-btn" onclick="App.moveSectionDown(${idx})" ${idx === sectionCount - 1 ? 'disabled' : ''} title="아래로">↓</button>
              <button class="sec-btn" onclick="App.toggleQuote(${idx})" title="인용구 토글">${sec.isQuote ? '📝 일반' : '💬 인용구'}</button>
              <button class="sec-btn btn-regen" onclick="App.regenSection(${idx})" title="재생성">↺ 재생성</button>
              <button class="sec-btn btn-del-section" onclick="App.removeSection(${idx})" title="문단 삭제">🗑</button>
            </div>
          </div>
          <div class="section-heading-edit" id="sec-head-${idx}" contenteditable="true">${toEditable(sec.heading)}</div>
          <div class="section-content-edit" id="sec-body-${idx}" contenteditable="true">${toEditable(sec.content)}</div>
          <div class="section-photos-edit">
            ${renderSectionPhotos(sec, idx)}
          </div>
          <label class="btn-add-section-photo" title="이 문단에 사진 추가">
            📸 사진 추가
            <input type="file" accept="image/*" multiple hidden onchange="App.addPhotoToSection(${idx}, this)" />
          </label>
        </div>`;
    });

    // 문단 추가 버튼
    html += `<button class="btn-add-section" onclick="App.addSection()">+ 문단 추가</button>`;

    body.innerHTML = html;
  }

  // ===== 문단 이동 =====
  function moveSectionUp(idx) {
    syncEditedText();
    if (idx === 0) return;
    [postState.sections[idx - 1], postState.sections[idx]] = [postState.sections[idx], postState.sections[idx - 1]];
    renderPostState();
  }

  function moveSectionDown(idx) {
    syncEditedText();
    if (idx >= postState.sections.length - 1) return;
    [postState.sections[idx], postState.sections[idx + 1]] = [postState.sections[idx + 1], postState.sections[idx]];
    renderPostState();
  }

  // ===== 인용구 토글 =====
  function toggleQuote(idx) {
    syncEditedText();
    postState.sections[idx].isQuote = !postState.sections[idx].isQuote;
    renderPostState();
  }

  // ===== 문단 추가/삭제 =====
  function addSection() {
    syncEditedText();
    postState.sections.push({ heading: '소제목', content: '내용을 입력하세요', photos: [], isQuote: false });
    renderPostState();
  }

  function removeSection(idx) {
    syncEditedText();
    if (postState.sections.length <= 1) {
      showToast('최소 1개의 문단이 필요합니다');
      return;
    }
    postState.sections.splice(idx, 1);
    renderPostState();
  }

  // ===== 사진 조작 =====
  function movePhoto(sectionIdx, photoIdx, direction) {
    syncEditedText();
    const photos = postState.sections[sectionIdx].photos;
    if (direction === 'up' && photoIdx > 0) {
      [photos[photoIdx - 1], photos[photoIdx]] = [photos[photoIdx], photos[photoIdx - 1]];
    } else if (direction === 'down' && photoIdx < photos.length - 1) {
      [photos[photoIdx], photos[photoIdx + 1]] = [photos[photoIdx + 1], photos[photoIdx]];
    }
    renderPostState();
  }

  function movePhotoToSection(fromSection, photoIdx, toSection) {
    syncEditedText();
    if (fromSection === toSection) return;
    const photo = postState.sections[fromSection].photos.splice(photoIdx, 1)[0];
    postState.sections[toSection].photos.push(photo);
    renderPostState();
  }

  function togglePhotoWidth(sectionIdx, photoIdx) {
    syncEditedText();
    const photo = postState.sections[sectionIdx].photos[photoIdx];
    photo.width = photo.width === 'half' ? 'full' : 'half';
    renderPostState();
  }

  function removePreviewPhoto(sectionIdx, photoIdx) {
    syncEditedText();
    postState.sections[sectionIdx].photos.splice(photoIdx, 1);
    renderPostState();
  }

  function addPhotoToSection(sectionIdx, inputEl) {
    const files = Array.from(inputEl.files);
    if (!files.length || !postState) return;
    syncEditedText();

    const promises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > 1200) { h = Math.round(h * 1200 / w); w = 1200; }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve({
              dataUrl: canvas.toDataURL('image/jpeg', 0.85),
              name: file.name,
              width: 'full',
            });
          };
          img.onerror = () => resolve({ dataUrl: e.target.result, name: file.name, width: 'full' });
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(newPhotos => {
      postState.sections[sectionIdx].photos.push(...newPhotos);
      renderPostState();
      saveDraft();
      showToast(`문단 ${sectionIdx + 1}에 사진 ${newPhotos.length}장 추가`);
    });

    inputEl.value = '';
  }

  // ===== 문단 재생성 =====
  async function regenSection(idx) {
    syncEditedText();
    const apiKey = Settings.getGeminiKey();
    if (!apiKey) { showToast('Gemini API 키를 설정해주세요'); return; }

    const formData = BlogForm.getFormData();
    const sec = postState.sections[idx];
    const btn = document.querySelector(`#sec-${idx} .btn-regen`);
    if (btn) { btn.disabled = true; btn.textContent = '생성 중...'; }

    try {
      const result = await Gemini.regenerateParagraph({
        title: postState.title,
        blogType: formData.type || '',
        keyword: formData.keyword || '',
        heading: sec.heading,
        photoCount: sec.photos.length,
        sectionIndex: idx,
        totalSections: postState.sections.length,
        otherHeadings: postState.sections
          .filter((_, i) => i !== idx)
          .map(s => s.heading)
          .filter(Boolean),
      }, apiKey);

      if (result.heading) sec.heading = result.heading;
      if (result.content) sec.content = result.content;
      renderPostState();
      saveDraft();
      showToast(`문단 ${idx + 1} 재생성 완료`);
    } catch (err) {
      showToast('재생성 실패: ' + err.message);
      if (btn) { btn.disabled = false; btn.textContent = '↺ 재생성'; }
    }
  }

  // ===== 텍스트 복사 =====
  function copyText() {
    syncEditedText();
    if (!postState) return;

    let text = postState.title + '\n\n';
    if (postState.greeting) text += postState.greeting + '\n\n';
    postState.sections.forEach((sec, idx) => {
      text += `【문단 ${idx + 1}】\n`;
      if (sec.heading) text += sec.heading + '\n';
      if (sec.content) text += sec.content + '\n';
      text += '\n';
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text.trim())
        .then(() => showToast('클립보드에 복사되었습니다'))
        .catch(() => fallbackCopy(text.trim()));
    } else {
      fallbackCopy(text.trim());
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast('클립보드에 복사되었습니다');
    } catch {
      showToast('복사 실패 - 수동으로 복사해주세요');
    }
    document.body.removeChild(ta);
  }

  // ===== Supabase 저장 =====
  async function saveToSupabase() {
    syncEditedText();
    if (!SupabaseDB.isReady()) {
      showToast('Supabase 설정을 먼저 저장해주세요');
      return;
    }
    if (!postState) {
      showToast('먼저 글을 작성해주세요');
      return;
    }

    const formData = BlogForm.getFormData();
    const btn = document.getElementById('btn-save-supabase');
    btn.disabled = true;
    btn.textContent = '저장 중...';

    try {
      // 포스트 폴더명 한 번만 생성 (섹션 간 일관성 보장)
      const raw = (formData.keyword || postState.title || '');
      const postFolder = raw
        .replace(/[가-힣]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_\-]/g, '')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || `photos_${new Date().toISOString().slice(0,19).replace('T','_').replace(/:/g,'')}`;

      // 문단별 사진 업로드 후 URL을 section에 포함
      const sections = [];
      const allPhotoUrls = [];
      for (let si = 0; si < postState.sections.length; si++) {
        const sec = postState.sections[si];
        const secPhotoUrls = [];
        for (const photo of sec.photos) {
          const url = await SupabaseDB.uploadPhoto(photo.dataUrl, photo.name || 'photo', postFolder, si);
          secPhotoUrls.push(url);
          allPhotoUrls.push(url);
        }
        sections.push({
          heading: sec.heading,
          content: sec.content,
          isQuote: sec.isQuote,
          photos: secPhotoUrls,
        });
      }

      await SupabaseDB.savePost({
        title: postState.title,
        type: formData.type,
        keyword: formData.keyword,
        greeting: postState.greeting,
        sections,
        photoUrls: allPhotoUrls,
        tags: postState.tags || [],
      });

      // DB 저장 성공 → 기존 로그(임시저장) 삭제
      clearDraft();
      showToast('Supabase에 저장되었습니다 ✓ (로그 정리됨)');
    } catch (err) {
      showToast('저장 실패: ' + err.message, 5000);
    } finally {
      btn.disabled = false;
      btn.textContent = '☁️ DB 저장';
    }
  }

  // ===== AI 서치 =====
  async function aiSearch() {
    const keyword = document.getElementById('keyword-input').value.trim();
    if (!keyword) { showToast('키워드를 먼저 입력해주세요'); return; }

    const apiKey = Settings.getGeminiKey();
    if (!apiKey) { showToast('Gemini API 키를 설정해주세요'); return; }

    const btn = document.getElementById('btn-ai-search');
    const resultEl = document.getElementById('ai-search-result');
    btn.disabled = true;
    btn.textContent = '🔍 검색 중...';
    resultEl.classList.add('hidden');

    try {
      const info = await Gemini.searchPlace({ keyword }, apiKey);
      renderSearchResult(info);
      resultEl.classList.remove('hidden');
    } catch (err) {
      showToast('AI 서치 실패: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 AI 서치 — 주소·영업시간·주차 자동 검색';
    }
  }

  // 객체/배열로 온 값을 표시용 문자열로 변환
  function flattenVal(v) {
    if (v === null || v === undefined || v === 'null') return null;
    if (typeof v === 'object' && !Array.isArray(v)) {
      return Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(' / ');
    }
    if (Array.isArray(v)) return v.join(' / ');
    return String(v);
  }

  function renderSearchResult(info) {
    const resultEl = document.getElementById('ai-search-result');
    if (!info) { resultEl.innerHTML = ''; return; }

    // 상태 저장 (price 등 객체 필드를 문자열로 정규화)
    aiSearchInfo = { ...info };
    ['address','businessHours','closedDays','parking','phone','price','popularMenu','website'].forEach(k => {
      const flat = flattenVal(info[k]);
      aiSearchInfo[k] = flat;
    });

    const allRows = [
      ['📍', '주소', 'address', aiSearchInfo.address],
      ['🕐', '영업시간', 'businessHours', aiSearchInfo.businessHours],
      ['🚫', '휴무일', 'closedDays', aiSearchInfo.closedDays],
      ['🅿️', '주차', 'parking', aiSearchInfo.parking],
      ['📞', '전화', 'phone', aiSearchInfo.phone],
      ['💰', '가격대', 'price', aiSearchInfo.price],
      ['🍽️', '인기메뉴', 'popularMenu', aiSearchInfo.popularMenu],
      ['🌐', '홈페이지', 'website', aiSearchInfo.website],
    ].filter(([, , , v]) => v && v !== 'null' && v !== null);

    const mustKnow = Array.isArray(info.mustKnow) ? info.mustKnow : [];
    const mustKnowHtml = mustKnow.map((t, i) =>
      `<li><span class="ai-search-val ai-editable" contenteditable="true" data-must-know="${i}">${escapeHtml(t)}</span></li>`
    ).join('');

    const highlights = Array.isArray(info.blogHighlights) ? info.blogHighlights : [];
    const highlightsHtml = highlights.map((t, i) =>
      `<li><span class="ai-search-val ai-editable" contenteditable="true" data-highlight="${i}">${escapeHtml(t)}</span></li>`
    ).join('');

    const tips = info.tips && info.tips.length ? info.tips : [];
    const tipsItemsHtml = tips.map((t, i) =>
      `<li><span class="ai-search-val ai-editable" contenteditable="true" data-tip="${i}">${escapeHtml(t)}</span></li>`
    ).join('');

    resultEl.innerHTML = `
      <div class="ai-search-name-row">
        <span class="ai-search-title ai-editable" contenteditable="true" data-field="name">${escapeHtml(info.name || '')}</span>
      </div>
      <div class="ai-search-items">
        ${allRows.map(([icon, key, field, val]) => `
          <div class="ai-search-item">
            <span class="ai-search-icon">${icon}</span>
            <span class="ai-search-key">${key}</span>
            <span class="ai-search-val ai-editable" contenteditable="true" data-field="${field}">${escapeHtml(String(val))}</span>
          </div>`).join('')}
      </div>
      <div class="ai-search-tips">
        <span class="ai-search-tips-label">⚠️ 방문 전 필수 체크</span>
        <ul id="ai-search-mustknow-list">${mustKnowHtml}</ul>
        <button class="ai-search-add-tip" onclick="App.addSearchMustKnow()">+ 추가</button>
      </div>
      <div class="ai-search-tips">
        <span class="ai-search-tips-label">✨ 블로그 강조 포인트</span>
        <ul id="ai-search-highlights-list">${highlightsHtml}</ul>
        <button class="ai-search-add-tip" onclick="App.addSearchHighlight()">+ 추가</button>
      </div>
      <div class="ai-search-tips">
        <span class="ai-search-tips-label">💡 기타 팁</span>
        <ul id="ai-search-tips-list">${tipsItemsHtml}</ul>
        <button class="ai-search-add-tip" onclick="App.addSearchTip()">+ 추가</button>
      </div>
      <div class="ai-search-save-row">
        <button class="btn-search-save" onclick="App.saveSearchInfo()">💾 저장 — 글 작성 시 반영</button>
        <span id="search-save-indicator" class="hidden search-saved-label">✓ 저장됨</span>
      </div>`;
  }

  function saveSearchInfo() {
    if (!aiSearchInfo) return;

    const fields = ['name', 'address', 'businessHours', 'closedDays', 'parking', 'phone', 'price', 'popularMenu', 'website'];
    fields.forEach(field => {
      const el = document.querySelector(`[data-field="${field}"]`);
      const val = el ? el.innerText.trim() : null;
      aiSearchInfo[field] = val || null;
    });

    const tipEls = document.querySelectorAll('[data-tip]');
    aiSearchInfo.tips = Array.from(tipEls).map(el => el.innerText.trim()).filter(t => t);

    const mustKnowEls = document.querySelectorAll('[data-must-know]');
    aiSearchInfo.mustKnow = Array.from(mustKnowEls).map(el => el.innerText.trim()).filter(t => t);

    const highlightEls = document.querySelectorAll('[data-highlight]');
    aiSearchInfo.blogHighlights = Array.from(highlightEls).map(el => el.innerText.trim()).filter(t => t);

    const indicator = document.getElementById('search-save-indicator');
    if (indicator) {
      indicator.classList.remove('hidden');
      setTimeout(() => indicator.classList.add('hidden'), 3000);
    }
    showToast('서치 정보 저장 완료 — 글 작성 시 자동 반영됩니다');
  }

  function addSearchTip() {
    const list = document.getElementById('ai-search-tips-list');
    if (!list) return;
    const idx = list.children.length;
    const li = document.createElement('li');
    li.innerHTML = `<span class="ai-search-val ai-editable" contenteditable="true" data-tip="${idx}"></span>`;
    list.appendChild(li);
    li.querySelector('span').focus();
  }

  function addSearchMustKnow() {
    const list = document.getElementById('ai-search-mustknow-list');
    if (!list) return;
    const idx = list.children.length;
    const li = document.createElement('li');
    li.innerHTML = `<span class="ai-search-val ai-editable" contenteditable="true" data-must-know="${idx}"></span>`;
    list.appendChild(li);
    li.querySelector('span').focus();
  }

  function addSearchHighlight() {
    const list = document.getElementById('ai-search-highlights-list');
    if (!list) return;
    const idx = list.children.length;
    const li = document.createElement('li');
    li.innerHTML = `<span class="ai-search-val ai-editable" contenteditable="true" data-highlight="${idx}"></span>`;
    list.appendChild(li);
    li.querySelector('span').focus();
  }

  // ===== 태그 선택 =====
  function showTagModal(tags) {
    suggestedTags = tags;
    selectedTags = [];
    renderTagChips();
    document.getElementById('tag-modal').classList.remove('hidden');
  }

  function renderTagChips() {
    const list = document.getElementById('tag-list');
    if (!list) return;
    list.innerHTML = suggestedTags.map(tag => {
      const isSel = selectedTags.includes(tag);
      const isDisabled = !isSel && selectedTags.length >= 4;
      return `<button class="tag-chip${isSel ? ' selected' : ''}${isDisabled ? ' disabled' : ''}"
                      onclick="App.toggleTag('${escapeAttr(tag)}')">${escapeHtml(tag)}</button>`;
    }).join('');
    const countEl = document.getElementById('tag-count-info');
    if (countEl) countEl.textContent = `${selectedTags.length} / 4 선택됨`;
    const confirmBtn = document.getElementById('btn-confirm-tags');
    if (confirmBtn) confirmBtn.disabled = selectedTags.length < 1;
  }

  function toggleTag(tag) {
    const idx = selectedTags.indexOf(tag);
    if (idx >= 0) {
      selectedTags.splice(idx, 1);
    } else {
      if (selectedTags.length >= 4) return;
      selectedTags.push(tag);
    }
    renderTagChips();
  }

  function confirmTags() {
    if (postState) postState.tags = [...selectedTags];
    document.getElementById('tag-modal').classList.add('hidden');
    renderPostState();
    showToast(`태그 선택 완료: ${selectedTags.map(t => '#' + t).join(' ')}`);
  }

  function initEventListeners() {
    document.getElementById('btn-open-photos').addEventListener('click', openPhotoModal);
    document.getElementById('btn-close-photos').addEventListener('click', closePhotoModal);
    document.getElementById('btn-photo-done').addEventListener('click', closePhotoModal);

    document.getElementById('photo-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('photo-modal')) closePhotoModal();
    });

    document.getElementById('btn-add-compose-section').addEventListener('click', addComposeSection);
    document.getElementById('wizard-prev').addEventListener('click', wizardPrev);
    document.getElementById('wizard-next').addEventListener('click', wizardNext);
    document.getElementById('btn-write').addEventListener('click', writePost);
    document.getElementById('btn-copy').addEventListener('click', copyText);

    document.getElementById('btn-rewrite').addEventListener('click', () => {
      clearDraft();
      document.getElementById('preview-section').classList.add('hidden');
      postState = null;
    });

    document.getElementById('btn-save-supabase').addEventListener('click', saveToSupabase);
    document.getElementById('btn-confirm-tags').addEventListener('click', confirmTags);
    document.getElementById('btn-ai-search').addEventListener('click', aiSearch);

    document.getElementById('ai-search-toggle').addEventListener('change', (e) => {
      aiSearchEnabled = e.target.checked;
    });
  }

  function init() {
    initSupabase();
    BlogForm.init();
    PhotoManager.init();
    initComposer();
    initEventListeners();
    loadDraft();
    updateLogBadge();
    // 1분 자동저장
    setInterval(() => { if (postState) saveDraft(); }, 60000);
  }

  return {
    init, showToast,
    restoreDraft, clearDraft,
    saveGreeting,
    renderComposer,
    addComposeSection, removeComposeSection, updateSectionHeading, updateSectionContent,
    togglePhotoSection, unassignComposedPhoto, removeStripPhoto,
    onPhotoDragStart, onPhotoDragEnd, onSectionDragOver, onSectionDragLeave, onSectionDrop,
    moveSectionUp, moveSectionDown,
    toggleQuote, addSection, removeSection,
    movePhoto, movePhotoToSection,
    togglePhotoWidth, removePreviewPhoto,
    addPhotoToSection,
    regenSection,
    toggleTag, confirmTags,
    saveSearchInfo, addSearchTip, addSearchMustKnow, addSearchHighlight,
    wizardNext, wizardPrev,
    showLogPanel, closeLogPanel,
    restoreFromHistory, clearHistory,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
