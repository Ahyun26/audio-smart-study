const markdown = $('Document Parse').first().json.content.markdown;
const elements = $('Document Parse').first().json.elements || [];
const mode = $('Webhook').first().json.body.mode || 'summary';
const question = $('Webhook').first().json.body.user_question || '';

const tableCount = elements.filter(e => e.category === 'table').length;
const imageCount = elements.filter(e => e.category === 'figure').length;

let prompt = null;
let directText = null;

if (mode === 'summary') {
  prompt = `아래 문서를 단계별로 정밀 분석하여 시각장애 학생을 위한 '친절한 학습 노트'를 작성해주세요.

### 분석 지침
1단계 [주제 파악]: 문서의 종류(강의자료, 논문 등)와 핵심 제목을 도출하세요.
2단계 [내용 추출]: 핵심 개념과 중요 키워드를 3개 이상 뽑으세요.
3단계 [정보 확인]: 시험 일정이나 과제 기한이 언급되었다면 놓치지 말고 기록하세요.
4단계 [데이터 해석]: 표가 있다면 행/열을 나열하지 말고, "이 표는 ~을 보여줍니다"로 시작하여 의미를 해석하세요.

### 작성 규칙 (중요!)
- 모든 내용은 자연스러운 구어체(~해요, ~입니다)로 작성하세요.
- JSON 형식이 아닌, 아래 구조의 일반 텍스트로만 출력하세요.

### 출력 양식
[제목]: (AI가 생성한 직관적인 제목)
[주제]: (문서의 주요 과목이나 분야)

[핵심 요약]:
(전체 내용을 2~3문장으로 친절하게 설명해주세요.)

[중요 포인트]:
- 키워드: (핵심 키워드 나열)
- 주요 개념: (가장 중요한 문장 하나)

[알림 사항]:
- 일정/기한: (시험이나 과제 날짜, 없으면 '확인된 일정 없음')
- 표 설명: (문서 내 표가 있다면 그 의미를 설명, 없으면 생략)

### 문서
${markdown.substring(0, 800)}`;

} else if (mode === 'read_all') {
  prompt = `아래 문서를 처음부터 끝까지 전달해주세요.

### 규칙
- 본문 내용을 순서대로 빠짐없이 전달하세요.
- 표가 나오면 행/열 나열 대신 "이 표는 ~을 보여줍니다"로 의미를 설명하세요.
- 마크다운 기호(|, #, * 등)는 제거하세요.
- 자연스러운 구어체로 작성하세요.

### 문서
${markdown.substring(0, 2000)}`;

} else if (mode === 'qa') {
  prompt = `아래 문서를 바탕으로 질문에 답하세요.

### 답변 규칙
- 구어체로 2~3문장으로 답하세요.
- 문서에 없는 내용은 답하지 마세요.
- 표가 관련된 질문이면 의미 중심으로 설명하세요.


### 문서
${markdown.substring(0, 1000)}

### 질문
${question}`;
}

const solarBody = JSON.stringify({
  model: "solar-pro3-260323",
  messages: [
    {
      role: "system",
      content: `당신은 시각장애 대학생의 학습을 돕는 문서 분석 전문가입니다.
표를 설명할 때는 절대 행과 열을 나열하지 마세요.
반드시 "이 표는 ~을 보여줍니다"로 시작해서 의미를 먼저 설명하세요.
모든 답변은 자연스러운 구어체로 작성하세요.`
    },
    {
      role: "user",
      content: prompt || ''
    }
  ],
  max_tokens: 400,
  temperature: 0.3
});

return { prompt, directText, tableCount, imageCount, solarBody, mode };
