// ===== Photo Module (data-only) =====
// 사진 데이터 관리 - UI 렌더링 없음

const PhotoManager = (() => {
  let photos = []; // { id, file, name, dataUrl, sectionId: null }
  let dragPhotoId = null;

  function init() {
    const uploadInput = document.getElementById('photo-upload');
    if (uploadInput) uploadInput.addEventListener('change', handleFileSelect);
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const promises = files.map(file =>
      readFileAsDataURL(file).then(dataUrl => ({
        id: 'ph_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        file,
        name: file.name,
        dataUrl,
        sectionId: null,
      }))
    );

    Promise.all(promises).then(newPhotos => {
      photos = [...photos, ...newPhotos];
      App.renderComposer();
    });

    e.target.value = '';
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resizeImage(e.target.result, 1200, 0.85).then(resolve).catch(() => resolve(e.target.result));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function resizeImage(dataUrl, maxWidth, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round(h * maxWidth / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function assignToSection(photoId, sectionId) {
    const p = photos.find(p => p.id === photoId);
    if (p) p.sectionId = sectionId;
  }

  function unassignPhoto(photoId) {
    const p = photos.find(p => p.id === photoId);
    if (p) p.sectionId = null;
  }

  // renderComposer를 호출하지 않음 - 호출측에서 처리
  function unassignAllForSection(sectionId) {
    photos.forEach(p => { if (p.sectionId === sectionId) p.sectionId = null; });
  }

  function removePhoto(photoId) {
    const idx = photos.findIndex(p => p.id === photoId);
    if (idx !== -1) photos.splice(idx, 1);
  }

  function getPhotosForSection(sectionId) {
    return photos.filter(p => p.sectionId === sectionId);
  }

  function getAllPhotos() {
    return photos;
  }

  function getDragPhotoId() { return dragPhotoId; }
  function setDragPhotoId(id) { dragPhotoId = id; }

  function clear() {
    photos = [];
    dragPhotoId = null;
  }

  return {
    init,
    assignToSection, unassignPhoto, unassignAllForSection,
    removePhoto,
    getPhotosForSection, getAllPhotos,
    getDragPhotoId, setDragPhotoId,
    clear,
  };
})();
