# SoundAlert Free Web

청각장애인을 위한 실시간 생활 소리 알림 웹앱입니다.

## 핵심 변경점

기존 Python / FastAPI / TensorFlow Hub 서버 대신,
브라우저에서 MediaPipe Audio Classifier + YAMNet TFLite를 직접 실행합니다.

따라서 최종 사용자는:
- Python 설치 불필요
- Anaconda 설치 불필요
- FastAPI 서버 실행 불필요
- 앱 설치 불필요
- URL 접속 + 마이크 허용만 하면 사용 가능

## 로컬 개발

Node.js만 있으면 됩니다.

```bash
npm install
npm run dev
```

## GitHub Pages 무료 배포

1. GitHub에서 Public repository를 하나 생성합니다.
   예: soundalert

2. 이 폴더의 파일을 모두 저장소 루트에 업로드합니다.
   `.github` 폴더도 반드시 포함합니다.

3. GitHub 저장소:
   Settings → Pages → Build and deployment → Source에서
   `GitHub Actions`를 선택합니다.

4. Actions 탭에서 배포가 완료될 때까지 기다립니다.

5. URL 예:
   `https://YOUR-ID.github.io/soundalert/`

이후 main 브랜치에 코드를 수정해서 올릴 때마다 자동 재배포됩니다.

## Render Static Site 무료 배포

GitHub 저장소를 Render에 연결한 뒤 Static Site로 만들 수 있습니다.

Build Command:
```text
npm install && npm run build
```

Publish Directory:
```text
dist
```

또는 저장소의 `render.yaml`을 Blueprint로 사용할 수 있습니다.

## 사용 기술

- React
- Vite
- MediaPipe Tasks Audio
- Google YAMNet TFLite
- Lucide React
- Web Audio API / getUserMedia

## 주의

YAMNet의 출력 score는 일반적인 의미의 보정된 확률값이 아니므로,
UI에서는 "정확도" 대신 "인식 점수"로 표현합니다.

전자레인지 완료음과 재난문자 고유 알림음을 더 정확히 구분하려면,
추후 프로젝트 전용 학습 모델을 추가하는 것이 좋습니다.
