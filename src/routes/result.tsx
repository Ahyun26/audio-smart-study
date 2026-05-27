import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak, stopSpeaking } from "@/lib/speak";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [{ title: "AI 학습 노트" }],
  }),
  component: Result,
});

// n8n webhook이 반환한 결과를 sessionStorage에서 읽어 NOTE 기본값과 병합
function loadAnalysis(): typeof DEFAULT_NOTE {
  if (typeof window === "undefined") return DEFAULT_NOTE;
  try {
    const raw = sessionStorage.getItem("analysis_result");
    if (!raw) return DEFAULT_NOTE;
    const parsed = JSON.parse(raw);
    const data = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!data || typeof data !== "object") return DEFAULT_NOTE;
    return { ...DEFAULT_NOTE, ...data } as typeof DEFAULT_NOTE;
  } catch {
    return DEFAULT_NOTE;
  }
}

const DEFAULT_NOTE = {
  subject: "회로이론",
  docType: "강의자료 + 강의 녹음",
  pages: 5,
  tables: 3,
  uploadedAt: "2026.05.26",
  title: "회로이론 AI 학습 노트",
  keywords: ["전압", "전류", "저항", "옴의 법칙"],
  emphasis: {
    concept: "옴의 법칙",
    descriptionParagraphs: [
      "옴의 법칙은 전압(V), 전류(I), 저항(R) 사이 관계를 설명하는 회로이론의 가장 기본적인 법칙이다.",
      "전압은 전하를 이동시키는 힘이고, 전류는 실제로 흐르는 전하량을 의미한다. 저항은 전류가 흐르는 것을 방해하는 요소이다.",
      "옴의 법칙은 이러한 세 요소가 서로 어떤 관계를 가지는지 설명하며 아래 식으로 나타낼 수 있다.",
    ],
    formula: "V = I × R",
    professorPoints: [
      "시험에서 자주 출제되는 핵심 개념",
      "공식 자체 암기보다 개념 관계 이해가 더 중요",
      "이후 직렬회로, 병렬회로 계산에서도 반복적으로 사용됨",
      "문제를 풀 때 전압, 전류, 저항 중 무엇을 구해야 하는지 먼저 파악해야 함",
    ],
    why: "옴의 법칙은 회로 해석의 가장 기본 개념이며, 이후 학습할 대부분 내용의 기반이 된다.",
  },
  concepts: [
    {
      name: "전압 (Voltage)",
      definition:
        "전압은 전하를 이동시키기 위한 전기적인 힘이다. 쉽게 비유하면 물이 높은 곳에서 낮은 곳으로 흐르기 위해 필요한 압력과 비슷한 역할을 한다.",
      features: ["단위: Volt(V)", "기호: V", "전류를 발생시키는 원인"],
      example:
        "건전지가 9V라는 것은 전하를 이동시키는 힘이 9V라는 의미이다.",
    },
    {
      name: "전류 (Current)",
      definition:
        "전류는 단위 시간 동안 흐르는 전하의 양을 의미한다. 전압이 높아지면 일반적으로 더 많은 전하가 이동하게 되어 전류가 증가한다.",
      features: ["단위: Ampere(A)", "기호: I", "전자의 흐름과 관련"],
      example:
        "전류가 증가한다는 것은 전선 내부를 이동하는 전하량이 많아진다는 의미이다.",
    },
    {
      name: "저항 (Resistance)",
      definition:
        "저항은 전류 흐름을 방해하는 요소이다. 저항이 커질수록 전류는 흐르기 어려워진다.",
      features: ["단위: Ohm(Ω)", "기호: R"],
      example:
        "좁은 수도관에서는 물 흐름이 어려운 것처럼, 저항이 높으면 전류 흐름도 감소한다.",
    },
  ],
  visuals: [
    {
      kind: "그래프 1",
      title: "전압-전류 관계 그래프",
      axes: { x: "전압(V)", y: "전류(A)" },
      interpretation:
        "그래프가 오른쪽 위 방향의 직선 형태를 가지므로 전압과 전류가 비례 관계임을 알 수 있다. 전압이 증가하면 전류도 함께 증가한다는 의미이다.",
      points: [
        "직선 형태 → 비례 관계",
        "기울기가 클수록 전류 증가 속도가 큼",
        "옴의 법칙 이해에 사용되는 대표 그래프",
      ],
      examNote: "그래프 형태만 보고도 비례 관계인지 판단할 수 있어야 함",
    },
    {
      kind: "표 1",
      title: "저항값 비교 표",
      axes: null,
      interpretation:
        "표에는 저항값 증가에 따른 전류 변화가 나타나 있다. 저항이 증가할수록 전류가 감소하는 경향을 확인할 수 있다.",
      points: [
        "저항 증가 → 전류 감소",
        "가장 큰 저항값: 100Ω",
        "가장 작은 저항값: 10Ω",
      ],
      examNote:
        "왜 저항 증가 시 전류 감소가 발생하는지 이유를 설명할 수 있어야 함",
    },
  ],
  flow: ["전압 증가", "전류 증가", "저항 증가 시 전류 감소"],
  questions: [
    { tag: "서술형", q: "옴의 법칙에서 전압과 전류 관계를 설명하세요." },
    { tag: "단답형", q: "저항이 증가하면 전류는 어떻게 변하나요?" },
    { tag: "서술형", q: "왜 교수님이 옴의 법칙을 중요하다고 강조했을까요?" },
    {
      tag: "객관식",
      q: "다음 상황에서 어떤 개념이 적용되는지 설명해보세요.",
    },
  ],
};

function Result() {
  const navigate = useNavigate();
  const [playing, setPlaying] = useState<"full" | "key" | null>(null);
  const NOTE_DATA = useMemo(() => loadAnalysis(), []);
  // 로컬 alias로 기존 JSX 그대로 사용 가능하도록
  const note = NOTE_DATA;

  const announcement =
    "분석이 완료되었습니다. 교수님 강조 내용과 핵심 개념이 정리되었습니다. 이해도 확인 문제도 생성되었습니다.";

  const fullText = `${NOTE.title}. 교수님 강조 개념은 ${NOTE.emphasis.concept}. ${NOTE.emphasis.descriptionParagraphs.join(" ")} 공식은 ${NOTE.emphasis.formula}. 교수님 강조 포인트, ${NOTE.emphasis.professorPoints.join(", ")}. 핵심 내용 정리. ${NOTE.concepts
    .map((c) => `${c.name}. ${c.definition} 특징, ${c.features.join(", ")}. 예시, ${c.example}`)
    .join(". ")}. 시각자료 해석. ${NOTE.visuals.map((v) => `${v.kind} ${v.title}. ${v.interpretation}`).join(" ")} 이해도 확인 문제. ${NOTE.questions.map((q, i) => `${i + 1}번. ${q.q}`).join(" ")}`;

  const keyText = `핵심만 들려드립니다. 교수님이 강조한 개념은 ${NOTE.emphasis.concept}입니다. ${NOTE.emphasis.descriptionParagraphs[0]} 공식은 ${NOTE.emphasis.formula} 입니다. 교수님 강조 포인트는, ${NOTE.emphasis.professorPoints.join(", ")} 입니다.`;

  const play = (kind: "full" | "key") => {
    stopSpeaking();
    setPlaying(kind);
    speak(kind === "full" ? fullText : keyText, { interrupt: true });
  };

  const stop = () => {
    stopSpeaking();
    setPlaying(null);
    speak("재생을 중지했습니다.");
  };

  return (
    <AppShell title="AI 학습 노트" back={{ to: "/" }}>
      <VoiceAnnouncer message={announcement} />

      <div className="flex-1 flex flex-col gap-8 max-w-2xl mx-auto w-full pb-40">
        {/* 문서 정보 */}
        <section
          aria-label="문서 정보"
          className="rounded-2xl border-2 border-border bg-card px-6 py-5"
        >
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            문서 정보
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-lg">
            <Row label="과목" value={NOTE.subject} />
            <Row label="유형" value={NOTE.docType} />
            <Row label="전체" value={`${NOTE.pages}페이지`} />
            <Row label="표" value={`${NOTE.tables}개 포함`} />
            <Row label="업로드" value={NOTE.uploadedAt} full />
          </dl>
        </section>

        {/* 자동 생성 제목 */}
        <header className="border-b-4 border-foreground pb-4">
          <p className="text-base font-semibold text-primary">
            AI 자동 생성 학습 노트
          </p>
          <h2 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight">
            # {NOTE.title}
          </h2>
        </header>

        {/* 핵심 키워드 */}
        <section aria-label="핵심 키워드">
          <SectionTitle icon="📌">핵심 키워드</SectionTitle>
          <ul className="mt-4 flex flex-wrap gap-3" role="list">
            {NOTE.keywords.map((k) => (
              <li
                key={k}
                className="px-5 py-3 rounded-full bg-accent text-accent-foreground border-2 border-primary/30 text-xl font-bold"
              >
                #{k}
              </li>
            ))}
          </ul>
        </section>

        {/* 교수님 강조 내용 */}
        <section
          aria-label="교수님 강조 내용"
          className="rounded-3xl border-4 border-primary bg-primary/5 p-7 shadow-[var(--shadow-card)]"
        >
          <SectionTitle icon="⭐" highlight>
            교수님 강조 내용
          </SectionTitle>
          <p className="mt-5 text-sm font-bold text-primary uppercase tracking-wider">
            중요 개념
          </p>
          <h3 className="mt-1 text-3xl font-extrabold">
            {NOTE.emphasis.concept}
          </h3>

          <p className="mt-5 text-base font-bold text-muted-foreground uppercase tracking-wider">
            설명
          </p>
          <div className="mt-2 space-y-3 text-xl leading-relaxed">
            {NOTE.emphasis.descriptionParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-foreground text-background px-6 py-5 text-center">
            <p className="text-sm font-bold uppercase tracking-wider opacity-70">
              공식
            </p>
            <p className="mt-1 text-3xl font-extrabold tracking-wide">
              {NOTE.emphasis.formula}
            </p>
          </div>

          <p className="mt-6 text-base font-bold text-muted-foreground uppercase tracking-wider">
            교수님 강조 포인트
          </p>
          <ul className="mt-3 space-y-2" role="list">
            {NOTE.emphasis.professorPoints.map((p) => (
              <li
                key={p}
                className="flex gap-3 text-xl leading-relaxed font-medium"
              >
                <span aria-hidden className="text-primary font-extrabold">
                  ✓
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-2xl bg-card border-2 border-dashed border-primary/40 px-5 py-4">
            <p className="text-sm font-bold text-primary uppercase tracking-wider">
              중요한 이유
            </p>
            <p className="mt-1 text-lg font-medium">{NOTE.emphasis.why}</p>
          </div>
        </section>

        {/* 핵심 내용 정리 */}
        <section aria-label="핵심 내용 정리">
          <SectionTitle icon="📝">핵심 내용 정리</SectionTitle>
          <div className="mt-5 space-y-8">
            {NOTE.concepts.map((c) => (
              <article
                key={c.name}
                className="border-l-4 border-primary pl-5"
              >
                <h3 className="text-2xl font-extrabold">{c.name}</h3>

                <p className="mt-4 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  개념
                </p>
                <p className="mt-2 text-xl leading-relaxed">{c.definition}</p>

                <p className="mt-5 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  특징
                </p>
                <ul className="mt-2 space-y-2" role="list">
                  {c.features.map((p) => (
                    <li
                      key={p}
                      className="flex gap-3 text-xl leading-relaxed"
                    >
                      <span aria-hidden className="text-primary font-bold">
                        −
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-5 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  예시
                </p>
                <p className="mt-2 text-lg leading-relaxed italic text-foreground/90 bg-muted rounded-xl px-4 py-3">
                  {c.example}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* 시각자료 해석 */}
        <section aria-label="시각자료 해석">
          <SectionTitle icon="📊">시각자료 해석</SectionTitle>
          <div className="mt-5 space-y-6">
            {NOTE.visuals.map((v) => (
              <article
                key={v.title}
                className="rounded-2xl border-2 border-border bg-card p-6"
              >
                <p className="text-sm font-bold text-primary uppercase tracking-wider">
                  [{v.kind}]
                </p>
                <h3 className="mt-1 text-2xl font-extrabold">{v.title}</h3>

                {v.axes && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted px-4 py-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase">
                        가로축
                      </p>
                      <p className="mt-1 text-lg font-bold">{v.axes.x}</p>
                    </div>
                    <div className="rounded-xl bg-muted px-4 py-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase">
                        세로축
                      </p>
                      <p className="mt-1 text-lg font-bold">{v.axes.y}</p>
                    </div>
                  </div>
                )}

                <p className="mt-5 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  해석
                </p>
                <p className="mt-2 text-lg leading-relaxed">
                  {v.interpretation}
                </p>

                <p className="mt-5 text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  핵심 포인트
                </p>
                <ul className="mt-2 space-y-2" role="list">
                  {v.points.map((p) => (
                    <li key={p} className="flex gap-3 text-lg leading-relaxed">
                      <span aria-hidden className="text-primary font-bold">
                        •
                      </span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">
                    시험 포인트
                  </p>
                  <p className="mt-1 text-lg font-medium">{v.examNote}</p>
                </div>
              </article>
            ))}
          </div>
        </section>


        {/* 개념 관계 시각화 */}
        <section aria-label="개념 관계 시각화">
          <SectionTitle icon="🧠">개념 관계 시각화</SectionTitle>
          <ol
            className="mt-5 flex flex-col items-center gap-2"
            role="list"
            aria-label="개념 흐름도"
          >
            {NOTE.flow.map((step, i) => (
              <li key={step} className="flex flex-col items-center w-full">
                <div className="w-full max-w-xs text-center px-6 py-4 rounded-2xl bg-card border-2 border-foreground text-xl font-bold">
                  {step}
                </div>
                {i < NOTE.flow.length - 1 && (
                  <span
                    aria-hidden
                    className="text-3xl font-bold text-primary leading-none my-1"
                  >
                    ↓
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* 이해도 확인 문제 */}
        <section aria-label="이해도 확인 문제">
          <SectionTitle icon="❓">이해도 확인 문제</SectionTitle>
          <ol className="mt-5 space-y-4" role="list">
            {NOTE.questions.map((item, i) => (
              <li
                key={i}
                className="rounded-2xl border-2 border-border bg-card p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-extrabold text-primary">
                    Q{i + 1}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-muted text-sm font-bold text-muted-foreground">
                    {item.tag}
                  </span>
                </div>
                <p className="mt-3 text-xl leading-relaxed font-medium">
                  {item.q}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <button
          onClick={() => {
            stopSpeaking();
            navigate({ to: "/" });
          }}
          className="mt-2 text-lg font-semibold text-muted-foreground underline underline-offset-4 py-3"
        >
          새 문서 분석하기
        </button>
      </div>

      {/* 하단 고정 액션바 */}
      <div
        className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t-2 border-border px-4 py-3"
        role="region"
        aria-label="듣기 및 질문"
      >
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-2">
          <ActionButton
            onClick={() => (playing === "full" ? stop() : play("full"))}
            ariaLabel="전체 읽기"
            active={playing === "full"}
          >
            🔊 <span className="block text-sm mt-1">전체 읽기</span>
          </ActionButton>
          <ActionButton
            onClick={() => (playing === "key" ? stop() : play("key"))}
            ariaLabel="핵심만 듣기"
            active={playing === "key"}
          >
            📌 <span className="block text-sm mt-1">핵심만 듣기</span>
          </ActionButton>
          <ActionButton
            onClick={() => speak("질문 기능은 곧 제공됩니다.")}
            ariaLabel="질문하기"
          >
            💬 <span className="block text-sm mt-1">질문하기</span>
          </ActionButton>
        </div>
      </div>
    </AppShell>
  );
}

function Row({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2 flex gap-3" : "flex gap-3"}>
      <dt className="font-semibold text-muted-foreground min-w-16">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

function SectionTitle({
  icon,
  children,
  highlight,
}: {
  icon: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <h2
      className={`flex items-center gap-3 ${
        highlight ? "text-3xl" : "text-2xl"
      } font-extrabold`}
    >
      <span aria-hidden className="text-3xl">
        {icon}
      </span>
      <span>{children}</span>
    </h2>
  );
}

function ActionButton({
  onClick,
  children,
  ariaLabel,
  active,
}: {
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`min-h-16 rounded-2xl text-2xl font-bold flex flex-col items-center justify-center px-2 py-2 transition-all border-2 ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground border-border hover:bg-accent"
      } focus-visible:outline-4 focus-visible:outline-ring focus-visible:outline-offset-2`}
    >
      {children}
    </button>
  );
}
