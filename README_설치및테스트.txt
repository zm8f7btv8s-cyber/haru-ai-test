하루 2.2 AI 일정 분석 테스트판 (2026-11-16)

1. 기존 하루 앱 > 하루의 기록 > 데이터 내보내기로 JSON 백업.
2. 이 폴더의 웹 파일 6개(index.html, app.js, ai-bridge.js, style.css, voice-legacy.js, manifest.webmanifest)를 기존 haru-ai-test 저장소의 루트에 업로드하고 커밋. README는 선택사항.
3. GitHub Pages 반영에 수 분이 걸릴 수 있음. Safari 새로고침.
4. 설정 > AI 서버 연결 테스트. 성공 확인.
5. 홈에서 '내일 오후 3시에 치과 예약해 줘' 입력 > 전송. AI 분석 확인창의 제목/날짜/시간을 검토 > 확인하고 저장.
6. 나의 일정에서 등록 확인, 수정/삭제 확인. '오늘 날씨가 어때?' 같은 일반 질문으로 AI 대화 테스트.
7. 설정 > API 크레딧 잔액·결제 관리 / API 사용량 확인 링크 테스트.
8. AI 분석이 실패하면 기존 규칙 기반 확인창으로 전환.

주의: AI는 날짜/시간을 틀릴 수 있으므로 저장 전에 반드시 확인. 일정은 기기 localStorage에 저장되며 서버에 자동 저장되지 않음. 기존 localStorage 키(haru.assistant.v2.foundation 및 haru.fresh.test.v1)는 변경하지 않음. API 키는 앱에 포함되지 않음. 서버는 기존 POST /chat만 사용.

실제 아이폰 및 AI 응답 테스트는 사용자가 배포 후 확인해야 함.
