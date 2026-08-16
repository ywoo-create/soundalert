import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Baby,
  Bell,
  CarFront,
  CheckCircle2,
  CircleStop,
  Flame,
  Info,
  Mic,
  Siren,
  Volume2,
} from "lucide-react";
import { AudioClassifier, FilesetResolver } from "@mediapipe/tasks-audio";
import { dangerLevel, findSoundRule } from "./soundRules";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@1.0.0/wasm";

const iconFor = (icon) => {
  if (icon === "car") return CarFront;
  if (icon === "siren") return Siren;
  if (icon === "fire") return Flame;
  if (icon === "baby") return Baby;
  if (icon === "bell") return Bell;
  if (icon === "warning") return AlertTriangle;
  return Volume2;
};

function analyzeCategories(categories, previousSituation, previousCount) {
  const top = [...categories]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => ({
      label: item.categoryName || item.displayName || "Unknown",
      score: Number(item.score || 0),
    }));

  const matches = top
    .map((prediction) => ({
      prediction,
      rule: findSoundRule(prediction.label),
    }))
    .filter((item) => item.rule);

  if (matches.length === 0) {
    const best = top[0] || { label: "주변 소리", score: 0 };
    return {
      situation: "unknown",
      displayName: "일반 소리",
      rawLabel: best.label,
      modelScore: Math.round(best.score * 1000) / 10,
      dangerScore: 0,
      dangerLevel: 1,
      color: "green",
      levelLabel: "안전",
      action: "특별한 위험 소리가 감지되지 않았습니다.",
      icon: "volume",
      persistence: 0,
      top5: top,
    };
  }

  // '위험도 × 모델 점수'가 가장 큰 상황 선택
  matches.sort(
    (a, b) =>
      b.rule.baseDanger * b.prediction.score -
      a.rule.baseDanger * a.prediction.score
  );

  const best = matches[0];
  const persistence =
    best.rule.situation === previousSituation ? previousCount + 1 : 1;

  let score = best.rule.baseDanger * best.prediction.score;

  // 같은 상황이 연속 감지되면 소폭 보정
  if (persistence >= 3) score += 10;
  else if (persistence >= 2) score += 5;

  // 동시에 여러 유의미한 위험음이 잡히면 보정
  if (matches.length >= 2) score += 5;

  score = Math.max(0, Math.min(100, score));
  const level = dangerLevel(score);

  return {
    situation: best.rule.situation,
    displayName: best.rule.displayName,
    rawLabel: best.prediction.label,
    modelScore: Math.round(best.prediction.score * 1000) / 10,
    dangerScore: Math.round(score * 10) / 10,
    dangerLevel: level.level,
    color: level.color,
    levelLabel: level.label,
    action: best.rule.action,
    icon: best.rule.icon,
    persistence,
    top5: top,
  };
}

export default function App() {
  const [running, setRunning] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [status, setStatus] = useState(
    "버튼을 누르면 브라우저에서 주변 소리를 분석합니다."
  );
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const classifierRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const persistenceSituationRef = useRef(null);
  const persistenceCountRef = useRef(0);
  const analyzingRef = useRef(false);

  const initClassifier = async () => {
    if (classifierRef.current) return classifierRef.current;

    setLoadingModel(true);
    setStatus("YAMNet 모델을 불러오는 중입니다...");

    try {
      const audioFiles = await FilesetResolver.forAudioTasks(WASM_URL);
      const classifier = await AudioClassifier.createFromOptions(audioFiles, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
        },
        maxResults: 10,
        // YAMNet 점수는 클래스별로 보정된 확률이 아니므로 낮은 단계에서 넓게 받고,
        // 프로젝트 규칙 단계에서 실제 알림 여부를 판단한다.
        scoreThreshold: 0.03,
      });

      classifierRef.current = classifier;
      return classifier;
    } finally {
      setLoadingModel(false);
    }
  };

  const stopDetection = async () => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      try {
        processorRef.current.disconnect();
      } catch {}
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        await audioContextRef.current.close();
      } catch {}
    }

    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    analyzingRef.current = false;

    setRunning(false);
    setStatus("소리 감지가 중지되었습니다.");
  };

  const startDetection = async () => {
    try {
      setError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "이 브라우저에서는 마이크 기능을 사용할 수 없습니다. Chrome 또는 Edge 최신 버전을 사용하세요."
        );
      }

      const classifier = await initClassifier();

      setStatus("마이크 권한을 요청하는 중입니다...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // YAMNet 권장 입력인 16 kHz에 가깝게 브라우저 오디오 컨텍스트 구성.
      // MediaPipe AudioClassifier가 필요한 전처리도 수행한다.
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 16000 });

      const source = audioContext.createMediaStreamSource(stream);
      // 공식 MediaPipe 웹 오디오 예시와 동일한 버퍼 크기
      const processor = audioContext.createScriptProcessor(16384, 1, 1);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (analyzingRef.current) return;

        analyzingRef.current = true;

        try {
          const input = new Float32Array(
            event.inputBuffer.getChannelData(0)
          );

          const classifications =
            audioContext.sampleRate === 16000
              ? classifier.classify(input)
              : classifier.classify(input, audioContext.sampleRate);

          const categories =
            classifications?.[0]?.classifications?.[0]?.categories || [];

          const analyzed = analyzeCategories(
            categories,
            persistenceSituationRef.current,
            persistenceCountRef.current
          );

          persistenceSituationRef.current = analyzed.situation;
          persistenceCountRef.current = analyzed.persistence;

          setResult(analyzed);
        } catch (classificationError) {
          setError(`오디오 분석 오류: ${classificationError.message}`);
        } finally {
          analyzingRef.current = false;
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setRunning(true);
      setStatus("실시간 감지 중 · 소리는 서버로 업로드하지 않습니다.");
    } catch (err) {
      setError(err?.message || String(err));
      setStatus("실시간 감지를 시작하지 못했습니다.");
      await stopDetection();
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const currentColor = result?.color || "green";
  const ResultIcon = iconFor(result?.icon);
  const StatusIcon =
    currentColor === "red"
      ? Siren
      : currentColor === "orange"
      ? AlertTriangle
      : currentColor === "yellow"
      ? Bell
      : CheckCircle2;

  return (
    <div className={`app theme-${currentColor}`}>
      <header className="topbar">
        <div>
          <div className="brand">SoundAlert</div>
          <div className="subtitle">
            청각장애인을 위한 실시간 생활 소리 알림
          </div>
        </div>
        <div className={`live-pill ${running ? "on" : ""}`}>
          <span className="dot" />
          {running ? "LIVE" : "OFF"}
        </div>
      </header>

      <main className="content">
        <section className="hero-card">
          <div className="status-row">
            <div className="status-icon">
              <StatusIcon size={22} />
            </div>
            <div>
              <div className="eyebrow">
                {result?.levelLabel || "준비"}
              </div>
              <h1>
                {result
                  ? result.displayName
                  : "주변의 중요한 소리를 실시간으로 알려드려요"}
              </h1>
            </div>
          </div>

          <div className="result-panel">
            <div className="big-icon">
              <ResultIcon size={45} />
            </div>

            <div className="result-main">
              <div className="result-name">
                {result?.displayName || "아직 감지된 소리가 없습니다"}
              </div>
              <div className="result-sub">
                {result
                  ? `YAMNet: ${result.rawLabel}`
                  : "감지를 시작하면 브라우저에서 YAMNet이 실행됩니다."}
              </div>
            </div>

            <div className="confidence">
              <strong>
                {result ? `${result.modelScore}%` : "-"}
              </strong>
              <span>인식 점수</span>
            </div>
          </div>

          <div className="score-row">
            <div>
              <span>위험도</span>
              <strong>
                {result ? `${result.dangerScore}/100` : "-"}
              </strong>
            </div>
            <div className={`level level-${currentColor}`}>
              {result?.levelLabel || "대기"}
            </div>
          </div>

          <div className="progress">
            <div
              className="progress-fill"
              style={{ width: `${result?.dangerScore || 0}%` }}
            />
          </div>

          <div className="action-card">
            <Info size={20} />
            <div>
              <div className="action-label">추천 행동</div>
              <div className="action-text">
                {result?.action ||
                  "실시간 감지를 시작하면 상황에 맞는 행동을 안내합니다."}
              </div>
            </div>
          </div>

          {result?.persistence >= 2 && (
            <div className="persistence">
              같은 상황이 연속 {result.persistence}회 감지되고 있습니다.
            </div>
          )}
        </section>

        <section className="control-card">
          <button
            className={`mic-button ${running ? "stop" : ""}`}
            onClick={running ? stopDetection : startDetection}
            disabled={loadingModel}
          >
            {running ? <CircleStop size={22} /> : <Mic size={22} />}
            {loadingModel
              ? "AI 모델 준비 중..."
              : running
              ? "실시간 소리 감지 끄기"
              : "실시간 소리 감지 시작"}
          </button>

          <div className="connection">
            <span className={`connection-dot ${running ? "good" : ""}`} />
            {status}
          </div>

          {error && (
            <div className="error-box">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="privacy-note">
            <CheckCircle2 size={16} />
            마이크 음성은 AI 서버로 전송하지 않고 현재 기기에서 분석합니다.
          </div>
        </section>

        <section className="history-card">
          <div className="section-title">
            <Volume2 size={19} />
            YAMNet 상위 예측
          </div>
          <div className="top-list">
            {(result?.top5 || []).map((item, index) => (
              <div className="top-item" key={`${item.label}-${index}`}>
                <span>{index + 1}</span>
                <div className="bar-wrap">
                  <div className="bar-label">
                    <span>{item.label}</span>
                    <strong>
                      {(item.score * 100).toFixed(1)}%
                    </strong>
                  </div>
                  <div className="bar">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.min(item.score * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {!result && (
              <div className="empty">
                감지를 시작하면 AI 분류 결과가 표시됩니다.
              </div>
            )}
          </div>
        </section>

        <footer>
          <span>MediaPipe · YAMNet · React · Vite</span>
          <span>On-device audio classification</span>
        </footer>
      </main>
    </div>
  );
}
