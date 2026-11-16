하루 2.1 AI 통합 테스트판 (2026-11-16)

1. 이 ZIP을 풀면 index.html, app.js, style.css, voice-legacy.js, manifest.webmanifest, ai-bridge.js가 있습니다.
2. GitHub Pages 테스트 저장소 루트에 위 6개 파일을 함께 올리세요. 기존 데이터 백업(JSON)을 먼저 다운로드하세요.
3. Safari에서 테스트 사이트를 열고 설정(☰) → AI 서버 연결 테스트를 누르세요.
4. 성공하면 홈에서 “안녕, 오늘 기분이 어때?”처럼 일반 질문을 전송하세요.
5. “내일 오후 3시에 내과 예약해 줘”는 기존 규칙 기반 확인창으로 이동하고, 사용자가 확인해야 저장됩니다.
6. 일정 등록·수정·삭제, 음성 입력, 메모, 데이터 내보내기를 점검하세요.

중요:
- Worker는 https://haru-ai.nsunrang.workers.dev/chat 를 사용합니다.
- Worker는 Origin을 https://zm8f7btv8s-cyber.github.io 로 엄격히 검사합니다. 다른 도메인이나 file://로 열면 403 또는 CORS 오류가 납니다.
- API 키는 ZIP에 없고 Cloudflare Worker의 OPENAI_API_KEY secret에만 있어야 합니다.
- AI 일반 대화는 서버 연결, 일정·할 일·메모·작업 요청은 기존 로컬 규칙을 사용합니다. AI 기반 일정 추출은 아직 구현하지 않았습니다.
- 기존 저장소 키 haru.assistant.v2.foundation, haru.fresh.test.v1는 변경하지 않았습니다.
- 앱을 동일한 GitHub Pages 주소에서 실행할 때만 같은 브라우저의 localStorage를 공유합니다.
- 현재 Worker의 API 호출 성공은 아직 실제 검증하지 않았습니다.
- AI 질문은 서버로 전송되므로 비밀번호, 주민등록번호 등 민감한 정보는 입력하지 마세요.
