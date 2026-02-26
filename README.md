# ChatGPT MCP File System

ChatGPT에서 MCP(Model Context Protocol)를 통해 로컬 파일 시스템에 안전하게 접근할 수 있도록 지원하는 서버 및 Tauri GUI 애플리케이션입니다.

---

## 🚀 주요 기능

### MCP 서버
- **9개 파일 시스템 도구**: 읽기, 쓰기, 삭제, 검색, 복사/이동, 디렉토리 관리 등.
- **강력한 보안**: 화이트리스트 기반 경로 검증(Path Traversal 방지).
- **다양한 Transport**: stdio, HTTP, SSE 지원.

### Tauri GUI
- **서버 제어**: 원클릭 서버 시작/중지 및 실시간 로그 모니터링.
- **경로 관리**: ChatGPT가 접근 가능한 폴더를 GUI에서 간편하게 추가/삭제.
- **자동화 & 편의성**: 앱 시작 시 자동 실행, ngrok 터널링 통합 설정.

---

## 🛠️ 설치 및 시작

### 요구사항
- **Node.js**: 18+ (pnpm 9+ 권장)
- **Rust**: 최신 스테이블 버전 (Tauri 빌드용)

### 빠른 시작 (개발 모드)
```bash
pnpm install
pnpm build
pnpm tauri dev
```

### 프로덕션 빌드 (Windows)
```bash
# 빌드
pnpm tauri build
```

**빌드 결과물:**
| 파일 | 설명 |
|------|------|
| `src-tauri/target/release/chatgpt-mcp-fs.exe` | **포터블 실행 파일** (설치 불필요) |
| `src-tauri/target/release/bundle/nsis/*.exe` | 설치 파일 |

**포터블 버전 사용:**
```bash
# exe 파일만 복사해서 어디서든 실행 가능
cp src-tauri/target/release/chatgpt-mcp-fs.exe ~/Desktop/

# USB 등에 담아서 이동하여 사용 가능
```

---

## 💡 사용 방법

1.  **앱 실행**: 로컬 서버를 구동하고 **[Add Folder]**를 통해 작업할 폴더를 등록합니다.
2.  **서버 시작**: **[Start]** 버튼을 눌러 SSE 엔드포인트(기본 포트 3000)를 활성화합니다.
3.  **ChatGPT 연결**:
    - 외부 접근이 필요한 경우 `ngrok http 3000`을 실행하여 HTTPS URL을 생성합니다.
    - ChatGPT 커넥터 설정에 `https://<ngrok-url>/sse`를 등록합니다.
4.  **테스트**: `npx @modelcontextprotocol/inspector`를 사용하여 도구 작동 여부를 즉시 확인할 수 있습니다.

---

## 🛡️ 보안 가이드

- **경로 검증**: 모든 요청은 `allowedFolders` 내에 있는지 엄격히 검사하며, 상위 디렉토리 접근(`../`)을 차단합니다.
- **권장사항**: 
  - `C:/`와 같은 루트 경로는 지양하고, 필요한 최소한의 프로젝트 폴더만 추가하십시오.
  - 시스템 폴더 및 민감한 정보가 포함된 경로는 노출하지 마십시오.

---

## 💻 구조 및 기술 스택

- **Monorepo**: pnpm 워크스페이스 기반
  - `packages/mcp-server`: TypeScript 기반 MCP SDK 서버
  - `src-tauri`: Rust 기반 GUI 백엔드
  - `src`: React + Zustand + Tailwind CSS 프론트엔드
- **주요 스택**: TypeScript, Rust (Tauri v2), React, Vite

---

## 📝 라이선스
MIT License
