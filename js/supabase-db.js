// ===== Supabase Module (Firestore + Storage 대체) =====

const SupabaseDB = (() => {
  let client = null;

  function init(url, key) {
    try {
      if (!url || !key) return false;
      if (typeof supabase === 'undefined') return false;
      client = supabase.createClient(url, key);
      return true;
    } catch (e) {
      console.error('Supabase init:', e);
      return false;
    }
  }

  // 영문 슬러그 생성: YYYYMMDD_HHMMSS_keyword
  function generateSlug(keyword, type) {
    const now = new Date();
    const ts = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0') + '_'
      + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0')
      + String(now.getSeconds()).padStart(2, '0');
    const kw = (keyword || type || '')
      .replace(/[가-힣]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .toLowerCase()
      .slice(0, 20) || 'post';
    return `${ts}_${kw}`;
  }

  // Firestore 대신 Postgres에 글 저장
  async function savePost(data) {
    if (!client) throw new Error('Supabase가 초기화되지 않았습니다');
    const { data: result, error } = await client
      .from('blog_posts')
      .insert({
        title: data.title,
        blog_type: data.type,
        keyword: data.keyword,
        greeting: data.greeting,
        sections: data.sections,
        photo_urls: data.photoUrls || [],
        tags: data.tags || [],
        slug: generateSlug(data.keyword, data.type),
        status: 'ready',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return result.id;
  }

  // Firebase Storage 대신 Supabase Storage에 사진 업로드
  // postFolder: app.js에서 한 번 계산된 폴더명, sectionIndex: 섹션 번호
  async function uploadPhoto(dataUrl, name, postFolder, sectionIndex) {
    if (!client) throw new Error('Supabase가 초기화되지 않았습니다');
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ext = blob.type.split('/')[1] || 'jpg';
    // 파일명: 원본에서 확장자 제거 후 새 확장자 붙이기 (이중 확장자 방지)
    const baseName = name.replace(/\.[^.]+$/, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const secFolder = `sec${sectionIndex ?? 0}`;
    const path = `${postFolder}/${secFolder}/${Date.now()}_${baseName}.${ext}`;

    const bucket = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.storageBucket) ? APP_CONFIG.storageBucket : 'blog-photos';
    const { error } = await client.storage
      .from(bucket)
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw new Error(error.message);

    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  function isReady() { return client !== null; }

  return { init, savePost, uploadPhoto, isReady };
})();
