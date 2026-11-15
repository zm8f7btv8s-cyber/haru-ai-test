하루 2.0 전송/저장 오류 수정판

원인: app.js가 proposal 다이얼로그 DOM보다 먼저 실행되어 null.onclick 예외로 중단됨.
수정: 두 스크립트를 모든 다이얼로그 뒤로 이동하고 캐시 버전을 갱신함.
기존 localStorage 데이터 키와 음성 인식 로직 변경 없음.
haru-ai-test에 모든 파일을 업로드해 테스트하세요.
