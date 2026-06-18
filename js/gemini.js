// ===== Gemini API Module =====

const Gemini = (() => {
  const MODEL = 'gemini-2.5-flash';
  const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

  // ===== 블로그 유형별 프롬프트 =====
  const MZ_BASE = `당신은 20대 여성 네이버 블로거입니다. 실제로 방문한 사람이 친구한테 가볍게 얘기하듯, 자연스럽고 생생하게 작성해주세요.

[목표 톤 & 문체]
- 문장 하나 = 줄 하나 기준으로 줄바꿈, 가독성 최우선
- 문장 끝 마침표(.) 절대 사용 금지 — 마침표 없이 자연스럽게 끝내기
- 상황 설명으로 자연스럽게 시작: "~하다가 ~에 들렀어요", "~갔는데 마침~" 식으로
- 자연스러운 존댓말: ~요, ~에요, ~더라구요, ~는데요, ~답니다
- 감탄/감정 표현: "..♡", "ㅎㅎㅎ", "ㅎ,," 자연스럽게 사용 (ㅋㅋ, ㅋㅋㅋ 사용 금지)
- 음식/공간 묘사는 생생하게: "면에 착 감기는데", "과즙이 팡 터지는데", "살살 녹았답니다"
- 수다 떨듯 쿠션어 자연스럽게 활용: "근데 있죠~", "그래서요~", "진짜로~", "오 근데~" 식으로 중간중간 넣기
- 동행 반응 자연스럽게 포함: "남편이랑", "같이 간 친구도~"
- 금액 표기: 반드시 숫자+원 형식만 사용 (예: "22,000원", "15,000원") → "2만2천원", "1만5천원", "1만원" 등 한글 수 표현 절대 금지
- 마무리: "다음에 또 먹어보려해요", "재방문 각이에요" 같은 자연스러운 마무리
- 매장 주소·주차·운영시간 등 실용 정보는 글 마지막에 자연스럽게 정리

[절대 금지 - AI 냄새 나는 표현]
- "~이라고 해도 과언이 아니에요", "인상적이었어요", "눈길을 사로잡았어요"
- "~의 정석", "자연스럽게 녹아든", "한층 더", "한눈에"
- "솔직히 말씀드리면", "이처럼", "따라서" 같은 논문·발표체
- "하더라고요", "거든요", "~이래거든요", "~이랬거든요", "들었거든요"
- "~했네요" → 반드시 "~했어요" 또는 "~했답니다"로
- "~했잖아요" → 반드시 "~했어요"로
- "분위기까지 보통이 아니잖아요", "유명한 이유가 다 있구나" 같은 오버스러운 감탄
- "얼마나 맛있게요", "얼마나 완벽하게요" 식 과장 감탄형 절대 금지
- "너무 맛있었어요" → "맛있었어요", "진짜 맛있더라구요" 식으로 구체적으로
- "라인업이 정말 최고였어요", "퀄리티가 최고였어요" 같은 유행어성 과장 표현 금지 → 구체적 묘사로 대체
- "~하고요, ~되고요, ~이고요" 나열형 종결 → 각각 끊기
- 반말: "~야", "~지", "~거야", "~임"
- 광고성·협찬 표현
- 마침표(.) 사용 절대 금지
- 금액을 "2만원", "3만5천원", "1만원" 등 한글 수 표현으로 쓰는 것 절대 금지 → 반드시 "20,000원", "35,000원" 형식`;

  const TYPE_PROMPTS = {
    맛집: `${MZ_BASE}
맛집 후기 특화 규칙:
- 첫 문장: 왜 이 식당을 찾게 됐는지 상황(웨이팅, 대안 탐색, 지인 추천 등) 자연스럽게 시작
- 맛 묘사는 구체적으로: "고소하면서 짭쪼름한 게 밥이랑 잘 어울려요", "너무 맛도리인데요" 같은 표현
- 가격·메뉴명·인원 구체적으로: "2인 기준 35,000원", "기본 라멘 13,000원" 형식
- 웨이팅·예약 가능 여부·혼잡도 등 방문 전 궁금한 정보 포함
- 아쉬운 점도 솔직하게: "살짝 아쉬웠던 건~" 자연스럽게 (필수)
- 마무리: 누구에게 맞는지 명확히 ("데이트코스로 딱이에요" / "혼밥은 살짝 애매할 수 있어요" 등)`,

    육아정보: `${MZ_BASE}
육아정보 특화 규칙:
- 같은 육아맘/육아대디한테 말하듯 공감형 오프닝
- "저도 몰랐는데", "이거 진짜 꿀정보예요", "알고 나서 완전 편해졌어요" 같은 표현
- 복잡한 정보는 짧게 끊어서 읽기 쉽게
- 실제 경험담처럼: "저희 아이한테 써봤더니 진짜로 효과 있더라구요"
- 의학적 단정 표현 금지, 과도한 불안 조성 금지`,

    놀러간곳: `${MZ_BASE}
나들이/놀이 후기 특화 규칙:
- 방문한 분위기를 짧게 전달: "인스타 감성 뿜뿜!", "사진 찍기 좋은 곳이에요"
- "드라이브 겸 방문하기에도 너무 좋은 곳이에요", "생각보다 좋더라구요" 같은 표현
- 주차·입장료·운영시간 등 실용 정보 자연스럽게 포함
- 동행 반응 자연스럽게: "같이 간 친구도 만족했어요"
- 마무리: "방문하기에도 너무 좋은 곳이에요", "다음에 또 오고 싶어요"`,

    숙소: `${MZ_BASE}
숙소 후기 특화 규칙:
- 체크인부터 짧게 묘사: "방에 들어가니 뷰가 꽤 좋더라구요"
- 청결도·시설·뷰·가성비 솔직하게 평가
- "이 가격대면 나쁘지 않아요", "기대했던 것보단 살짝 아쉬운 부분도 있었어요"
- 장점과 아쉬운 점 균형 있게
- "커플 여행에 적합해요", "가족끼리 오기엔~" 식으로 상황별 추천`,

    일상: `${MZ_BASE}
일상 기록 특화 규칙:
- 일기처럼 편하게, 그날의 감정을 짧게 담아서
- "별거 아닌 것 같아도 되게 행복했어요" 같은 솔직한 표현
- 독자 공감: "다들 이럴 때 있잖아요" 자연스럽게
- 짧은 문장, 긍정적이고 따뜻한 마무리`,

    여행: `${MZ_BASE}
여행 후기 특화 규칙:
- 방문 분위기부터 짧게: "인스타 감성 뿜뿜!", "여기서 이렇게 좋을 줄 몰랐어요"
- 꼭 가봐야 할 스팟, 먹어야 할 음식 자연스럽게 포함
- "혼여도 이 코스 강추", "커플이라면 이건 필수" 같은 상황별 팁
- 실용 정보(교통, 숙소 팁, 계절) 자연스럽게 포함
- 마무리: "다음에 또 오고 싶은 곳이에요"`,

    카페: `${MZ_BASE}
카페 후기 특화 규칙:
- 분위기 묘사: "인스타 감성 뿜뿜!", "사진 찍기 좋은 브런치 맛집으로 완전 인정이에요"
- "드라이브 겸 방문하기에도 너무 좋은 곳이에요" 같은 표현
- 음료·디저트·식사 메뉴 다양하게 준비되어 있어요 식으로 간결하게 소개
- 음료 맛: "달달하면서 산뜻한 게 느끼하지 않아서 좋아요" 구체적으로
- 콘센트, 와이파이, 좌석 여유 등 실용 정보 포함`,

    제품리뷰: `${MZ_BASE}
제품 리뷰 특화 규칙:
- 구매 계기부터: 어떤 고민 때문에 샀는지, 어떤 제품과 비교했는지 자연스럽게
- 개봉기·첫인상·실사용 느낌을 순서대로 짧게
- 사용 기간·횟수·상황 구체적으로: "2주 동안 매일", "세 번 써봤는데" 형식
- "생각보다 만족스러워요", "가격이 착한 느낌이 들었어요" 솔직하게
- 예상과 달랐던 점·아쉬운 점 필수 포함
- "이런 분한테 추천드려요", "이런 분한테는 안 맞을 수도 있어요" 명확히
- 마무리: "다음에 또 구매할 것 같아요"`
  };

  async function call(prompt, apiKey) {
    const url = `${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 8192 }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API 오류 (${res.status})`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // 제목 3개 추천
  async function suggestTitles(keyword, blogType, apiKey) {
    const typeHint = TYPE_PROMPTS[blogType]
      ? `블로그 유형: ${blogType} (${blogType} 특성에 맞는 제목으로)`
      : `블로그 유형: ${blogType}`;

    const prompt = `당신은 MZ세대 감성의 네이버 블로그 작가입니다.
아래 키워드와 블로그 유형을 바탕으로 클릭하고 싶은 블로그 제목을 3개 추천해주세요.

키워드: ${keyword}
${typeHint}

조건:
- 한국어로 작성
- MZ세대가 클릭할 것 같은 자극적이고 친근한 제목
- 검색에 잘 걸리는 키워드 자연스럽게 포함
- "나만 알고 싶은", "솔직 후기", "진짜 찐" 같은 신뢰·호기심 유발 표현 활용 (다양하게)
- 이모지 1개 포함
- 각 제목은 줄바꿈으로만 구분 (번호나 기호 없이)
- 제목만 출력 (설명 없음)`;

    const text = await call(prompt, apiKey);
    return text.split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 3)
      .slice(0, 3);
  }

  // 블로그 글 생성
  async function generatePost(params, apiKey) {
    const { title, blogType, keyword, paragraphs, customPrompt, placeInfo, greetingContext } = params;

    // 문단별 사진 개수 정보 구성
    const paraInfo = paragraphs.map((p, i) => {
      let info = `문단${i + 1}: ${p.heading ? `소제목 "${p.heading}" ` : ''}사진 ${p.photoCount}장`;
      if (p.content && p.content.trim()) info += `\n  참고 내용: "${p.content.trim()}"`;
      return info;
    }).join('\n');

    // 유형별 프롬프트 선택 (customPrompt > TYPE_PROMPTS > 기본)
    const basePrompt = customPrompt
      || TYPE_PROMPTS[blogType]
      || `당신은 네이버 블로그 전문 작가입니다. 친근하고 읽기 쉬운 블로그 글을 작성해주세요.`;

    // 장소 정보 섹션 구성
    const placeSection = placeInfo ? (() => {
      // 마지막 문단 끝에 삽입할 포맷 블록
      const infoLines = [];
      const placeName = placeInfo.name || title.match(/[가-힣a-zA-Z\s]+카페|[가-힣a-zA-Z\s]+식당|[가-힣a-zA-Z\s]+레스토랑/)?.[0] || '';
      if (placeName) infoLines.push(placeName);
      if (placeInfo.address) infoLines.push(`\n🎀 주소 : ${placeInfo.address}`);
      if (placeInfo.businessHours) infoLines.push(`\n🪽영업시간 : ${placeInfo.businessHours}`);
      if (placeInfo.closedDays) infoLines.push(`(${placeInfo.closedDays})`);
      if (placeInfo.parking) infoLines.push(`\n🪽주차 : ${placeInfo.parking}`);
      if (placeInfo.phone) infoLines.push(`\n🪽전화 : ${placeInfo.phone}`);
      if (placeInfo.price) infoLines.push(`\n🪽가격대 : ${placeInfo.price}`);
      if (placeInfo.popularMenu) infoLines.push(`\n🪽인기메뉴 : ${placeInfo.popularMenu}`);
      if (placeInfo.mustKnow && placeInfo.mustKnow.length) infoLines.push(`\n🪽${placeInfo.mustKnow.join(' / ')}`);
      if (placeInfo.blogHighlights && placeInfo.blogHighlights.length) infoLines.push(`\n🩵${placeInfo.blogHighlights.join(' ')}`);
      if (placeInfo.tips && placeInfo.tips.length) infoLines.push(`\n🩵${placeInfo.tips.join(' ')}`);

      const infoBlock = infoLines.join('\n');
      return infoBlock
        ? `\n장소 정보 블록 (마지막 문단의 content 맨 끝에 아래 블록을 그대로 추가해주세요. 수정하지 말고 줄바꿈 포함 그대로):\n${infoBlock}`
        : '';
    })() : '';

    const companionLine = greetingContext
      ? `\n방문 맥락/인사말: "${greetingContext}" → 동행자, 방문 요일/시간, 계기 등 이 내용을 바탕으로 본문에 1~2회 자연스럽게 반영 (억지로 반복하지 말 것)`
      : '';

    const prompt = `${basePrompt}

아래 정보를 바탕으로 블로그 글을 작성해주세요.

제목: ${title}
블로그 유형: ${blogType}
키워드: ${keyword}${companionLine}
문단 구성:
${paraInfo}${placeSection}

글 작성 기준:
- 모든 문단 합산 총 1500~2000자 (공백 포함)로 작성, 문단별 분량은 균등하게
- 키워드("${keyword}")를 본문 전체에 걸쳐 자연스럽게 3~5회 노출 (제목 반복 금지, 문맥에 녹이기)
- 소제목도 키워드 연관 표현 활용
- 글 흐름 (5단계 필수): ① 독자가 왜 검색했는지 고민 제기 → ② 선택 기준 → ③ 실제 과정(가격·시간·인원 등 구체적 숫자 포함) → ④ 해결 결과 → ⑤ 추천 대상 명확히
- 아쉬운 점이나 주의사항 반드시 1개 이상 자연스럽게 포함 (좋은 말만 있는 글 금지)
- 추천 대상 명확히: "이런 분께 잘 맞아요" + "이런 분께는 조금 애매할 수 있어요" 형식으로
- 소제목 아래 첫 문장에 핵심 정보 먼저 — 네이버 AI 브리핑 노출 최적화

출력 형식 (JSON):
{
  "greeting": "인사말 (2-3문장, 위 문체 규칙에 맞게 친근하게)",
  "paragraphs": [
    {
      "heading": "문단 소제목",
      "content": "내용 (문단별 균등 분량, 위 문체 규칙 준수, 키워드 자연스럽게 포함)"
    }
  ]
}

추가 조건:
- MZ세대 말투로 자연스럽게, 위 문체 규칙 철저히 준수
- 키워드(${keyword})가 자연스럽게 2~3회 포함
- 각 문단은 사진과 어울리도록 자연스럽게 마무리
- 인사말은 "~하고요, ~이고요" 나열 절대 금지 → 짧게 끊어서 임팩트 있게 시작
- 각 문단의 '참고 내용'이 있으면 그 내용을 바탕으로 작성하고, 없으면 전체 흐름에 맞게 자연스럽게 작성
- 글자수 표시 절대 금지 (예: "(566자)", "(총 1800자)" 같은 표현 출력 금지)
- 장소 정보 블록이 제공된 경우: 마지막 문단(paragraphs의 마지막 요소) content 끝에 해당 블록을 줄바꿈(\n) 포함 그대로 붙여주세요. 요약하거나 대화체로 바꾸지 말고 원문 그대로
- JSON만 출력 (코드블록 없이)`;

    const text = await call(prompt, apiKey);

    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return { greeting: text, paragraphs: [] };
    }
  }

  // 단일 문단만 재생성 (전체 글이 아닌 해당 문단 하나만)
  async function regenerateParagraph(params, apiKey) {
    const { title, blogType, keyword, heading, photoCount, sectionIndex, totalSections, otherHeadings } = params;

    const basePrompt = TYPE_PROMPTS[blogType]
      || `당신은 네이버 블로그 전문 작가입니다. 친근하고 읽기 쉬운 블로그 글을 작성해주세요.`;

    const headingLine = heading
      ? `이 문단의 소제목: "${heading}" → 이 소제목 주제에 해당하는 내용만 작성`
      : '소제목은 이 문단 내용에 맞게 새로 지어주세요';

    const contextLine = (otherHeadings && otherHeadings.length)
      ? `\n전체 글의 다른 문단 소제목: ${otherHeadings.map(h => `"${h}"`).join(', ')}\n→ 전체 ${totalSections}개 문단 중 ${sectionIndex + 1}번째 문단이에요. 다른 문단과 내용이 겹치지 않게 이 문단 주제에만 집중해주세요.`
      : '';

    const prompt = `${basePrompt}

아래는 블로그 글의 '한 문단'만 다시 작성하는 작업이에요.
전체 글을 새로 쓰지 말고, 지정된 이 문단 하나만 작성해주세요.

제목: ${title}
블로그 유형: ${blogType}
키워드: ${keyword}
${headingLine}
사진 ${photoCount}장${contextLine}

작성 기준:
- 이 문단 하나만 작성 (분량: 공백 포함 약 200자) — 전체 글 분량(1500자 이상)으로 절대 쓰지 말 것
- 위 문체 규칙 철저히 준수
- 키워드("${keyword}")를 1회 정도만 자연스럽게 포함 (억지로 반복 금지)
- 이 문단 소제목 주제에서 벗어나지 말 것
- 글자수 표시 절대 금지

출력 형식 (JSON, 코드블록 없이):
{
  "heading": "문단 소제목",
  "content": "이 문단 내용만 (약 200자)"
}`;

    const text = await call(prompt, apiKey);
    const result = extractJson(text);
    if (result) return result;
    return { heading: heading || '', content: text.trim() };
  }

  // 태그 20개 추천
  async function generateTags({ title, blogType, keyword }, apiKey) {
    const prompt = `당신은 네이버 블로그 태그 전문가입니다.
아래 블로그 글에 어울리는 네이버 검색에 잘 걸리는 태그 20개를 추천해주세요.

제목: ${title}
블로그 유형: ${blogType}
키워드: ${keyword}

조건:
- 한국어로 작성
- # 없이 단어만
- 줄바꿈으로만 구분 (번호, 기호, 설명 없이)
- 태그 20개만 출력`;

    const text = await call(prompt, apiKey);
    return text.split('\n')
      .map(t => t.trim().replace(/^#/, '').replace(/^\d+\.\s*/, ''))
      .filter(t => t.length > 0)
      .slice(0, 20);
  }

  // 응답 텍스트에서 JSON 추출 헬퍼
  function extractJson(text) {
    const cleaned = text
      .replace(/```json\n?/g, '').replace(/```\n?/g, '')
      .replace(/\[\d+\]/g, '').trim();
    try { return JSON.parse(cleaned); } catch {}
    const start = cleaned.indexOf('{');
    if (start !== -1) {
      let depth = 0, end = -1;
      for (let i = start; i < cleaned.length; i++) {
        if (cleaned[i] === '{') depth++;
        else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end !== -1) { try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {} }
    }
    return null;
  }

  // 장소/업체 정보 검색 - 2단계: 1)구글서치 자연어 수집 → 2)JSON 정제
  async function searchPlace({ keyword }, apiKey) {
    const url = `${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;

    // 1단계: Google Search 그라운딩으로 자연어 정보 수집 (JSON 강제 없음)
    const step1Body = {
      contents: [{ parts: [{ text: `"${keyword}"을 구글 검색해서 블로그 후기 상위 3개를 읽고, 다음 항목을 자세히 정리해주세요:\n- 정식명칭, 주소, 영업시간, 브레이크타임, 휴무일, 주차, 전화번호\n- 가격대 (메뉴별 가격 포함)\n- 인기메뉴, 추천메뉴\n- 예약/웨이팅/현금 여부 등 방문 전 알아야 할 정보\n- 블로거들이 공통으로 강조하는 분위기·특징·추천 포인트\n- 공식 홈페이지나 SNS 주소` }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
    };

    const res1 = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(step1Body) });
    if (!res1.ok) {
      const err = await res1.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API 오류 (${res1.status})`);
    }
    const data1 = await res1.json();
    const parts1 = data1?.candidates?.[0]?.content?.parts || [];
    const rawText = parts1.map(p => p.text || '').join('').trim();

    console.log('[AI Search] step1 text:', rawText.slice(0, 400));

    if (!rawText) throw new Error('검색 결과를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.');

    // 2단계: 수집된 텍스트를 JSON으로 정제 (grounding 없이)
    const step2Prompt = `아래 장소 정보를 읽고 JSON 형식으로 정리해주세요. 코드블록 없이 JSON만 출력하세요.

[장소 정보]
${rawText}

[출력 형식]
{
  "name": "정식명칭",
  "address": "도로명 주소",
  "businessHours": "영업시간 (브레이크타임 포함)",
  "closedDays": "휴무일 (없으면 null)",
  "parking": "주차 정보",
  "phone": "전화번호",
  "price": "가격대 요약",
  "website": "홈페이지/SNS URL (없으면 null)",
  "popularMenu": "인기메뉴/추천메뉴",
  "mustKnow": ["방문 전 필수 사항1", "방문 전 필수 사항2"],
  "blogHighlights": ["블로그 강조 포인트1", "블로그 강조 포인트2"]
}`;

    const step2Body = {
      contents: [{ parts: [{ text: step2Prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    };

    const res2 = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(step2Body) });
    if (!res2.ok) {
      const err = await res2.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API 오류 (${res2.status})`);
    }
    const data2 = await res2.json();
    const parts2 = data2?.candidates?.[0]?.content?.parts || [];
    const jsonText = parts2.map(p => p.text || '').join('').trim();

    console.log('[AI Search] step2 json:', jsonText.slice(0, 400));

    const result = extractJson(jsonText);
    if (result) return result;

    console.error('[AI Search] JSON parse failed:', jsonText.slice(0, 200));
    return { name: keyword, tips: [] };
  }

  return { suggestTitles, generatePost, regenerateParagraph, generateTags, searchPlace };
})();
