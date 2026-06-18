// ===== Blog Form Module =====
// 글 작성 폼 (유형 선택, 키워드, 제목 추천)

const BlogForm = (() => {
  let selectedType = '';
  let selectedTitle = '';
  let suggestTimeout = null;

  function init() {
    // 글 유형 버튼
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedType = btn.dataset.type;
      });
    });

    // 제목 추천 버튼
    document.getElementById('btn-suggest-title').addEventListener('click', suggestTitles);

    // 키워드 엔터키
    document.getElementById('keyword-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        suggestTitles();
      }
    });
  }

  async function suggestTitles() {
    const keyword = document.getElementById('keyword-input').value.trim();
    if (!keyword) {
      App.showToast('키워드를 입력해주세요');
      return;
    }
    if (!selectedType) {
      App.showToast('글 유형을 먼저 선택해주세요');
      return;
    }

    const apiKey = Settings.getGeminiKey();
    if (!apiKey) {
      App.showToast('Gemini API 키를 설정해주세요');
      return;
    }

    const btn = document.getElementById('btn-suggest-title');
    const origText = btn.textContent;
    btn.textContent = '생성 중...';
    btn.disabled = true;

    const suggestionsEl = document.getElementById('title-suggestions');
    const titleList = document.getElementById('title-list');

    try {
      const titles = await Gemini.suggestTitles(keyword, selectedType, apiKey);
      titleList.innerHTML = titles.map((t, i) => `
        <button class="title-option" onclick="BlogForm.selectTitle(this, '${escapeHtml(t)}')">
          ${t}
        </button>
      `).join('');
      suggestionsEl.classList.remove('hidden');
    } catch (err) {
      App.showToast('제목 추천 실패: ' + err.message);
    } finally {
      btn.textContent = origText;
      btn.disabled = false;
    }
  }

  function selectTitle(el, title) {
    document.querySelectorAll('.title-option').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    selectedTitle = title;
    document.getElementById('final-title').value = title;
  }

  function escapeHtml(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  function getFormData() {
    return {
      type: selectedType,
      keyword: document.getElementById('keyword-input').value.trim(),
      title: document.getElementById('final-title').value.trim() || selectedTitle,
    };
  }

  function validate() {
    const data = getFormData();
    if (!data.type) { App.showToast('글 유형을 선택해주세요'); return false; }
    if (!data.keyword) { App.showToast('키워드를 입력해주세요'); return false; }
    if (!data.title) { App.showToast('제목을 입력하거나 추천받아주세요'); return false; }
    return true;
  }

  return { init, suggestTitles, selectTitle, getFormData, validate };
})();
