# TaskFlow – 양방향 AI 태스크 매니저 (PRD)

## 1. 제품 개요
TaskFlow는 PRD 문서를 AI가 자동으로 태스크로 분해하고, 개발 도중 요구사항이 바뀌면 영향을 분석해 태스크를 재구성해 주는 **로컬 CLI + 웹 대시보드** 도구입니다. 1인 개발자가 Claude Max만으로 손쉽게 프로젝트를 관리하도록 설계됐습니다. MIT 라이선스로 완전 오픈소스로 공개됩니다.

## 2. 해결하려는 문제
| Pain Point | 해결 방안 |
|------------|-----------|
|1. PRD ➜ 태스크 분해가 수동·번거롭다 | `parse-prd` 명령으로 자동 분해 & 마크다운 저장 |
|2. 요구사항 변경 시 태스크 일일이 수정 | `refine` 명령으로 영향 분석 → 업데이트 제안 |
|3. CLI만으로 진행 상황 파악이 어렵다 | 로컬 웹 대시보드에서 칸반·차트·그래프 시각화 |
|5. AI 설정 과정이 복잡하다 | Claude Code 인증만 있으면 별도 API 키 불필요 |

## 3. 목표 (Success Metrics)
1. 첫 사용-세팅(init → parse-prd → dashboard) 3 분 이내 완료
2. PRD 변경 후 영향 태스크 식별 정확도 90% 이상
3. 태스크 상태 변경이 웹 대시보드에 0.5 초 이내 반영 (SSE)
4. GitHub ★100 / PR 10건 확보 (첫 3개월)

## 4. 핵심 사용자
- **1인 개발자·사이드 프로젝트 빌더**
  - Terminal 작업에 익숙, 빠른 반복 개발 선호
  - Task Master AI·Vooster AI 사용 경험 有, 하지만 ‘양방향 피드백’과 ‘로컬 실행’을 원함

## 5. 주요 사용 시나리오 (MVP 중심)
1. **새 프로젝트 킥오프** – PRD를 태스크로 자동 분해해 초기 개발 시간을 절감
2. **기존 프로젝트 유지보수** – 변경된 요구사항을 반영해 태스크 업데이트 & 칸반 정리

## 6. 기능 정의
### 6.1 Must-Have (MVP)
| ID | 기능 | 설명 |
|----|------|------|
|F-001| `init` | .taskflow/ 디렉터리 및 config 생성 |
|F-002| `parse-prd` | PRD ➜ task-NNN.md + TASKS.md 인덱스 생성 |
|F-003| `list / show / set-status` | 태스크 조회·상태 변경 CLI |
|F-004| `dashboard` | localhost:4000 칸반 & 진행률 카드 |
|F-005| `refine` | 요구사항 변경 → 영향 태스크 자동 제안 |
|F-006| `brainstorm / expand` | 복잡한 태스크 서브태스크 분해 & 아키텍처 토론 |
|F-007| `next` | 의존성·우선순위 기반 다음 태스크 추천 |
|F-008| `loop` | 태스크 자동 실행 & 상태 업데이트 |

### 6.2 보강 기능 (선택)
| ID | 기능 | 설명 |
|A-001| 의존성 그래프 | D3 기반 방향 그래프 시각화 |
|A-002| 실시간 동기화 | CLI ↔ 웹 SSE 스트림 |
|A-003| 타임라인 차트 | 태스크 히스토리 시각화 |

## 7. 비기능 요구사항
- 퍼포먼스: 웹 초기 로드 ≤ 2 초, CLI 반응 ≤ 200 ms (AI 호출 제외)
- 보안: 모든 데이터는 로컬; 네트워크 호출은 Claude API만
- 호환성: Node 18+, macOS/Linux 우선, Windows best-effort
- 사용성: 단일 `task` 명령, 3단계 온보딩 완료

## 8. 기술 스택 (SuperNext Template 기본)
- Next.js 15 (App Router), Hono.js(server actions), TypeScript 5, TailwindCSS + shadcn/ui, lucide-react, @tanstack/react-query
- 저장: Markdown 파일(.md) – DB 불필요
- 실시간 통신: Server-Sent Events
- AI: @anthropic-ai/claude-agent-sdk (Claude Max)

## 9. 범위 & 제외
In-Scope: CLI 명령, 웹 대시보드, AI 피드백 루프, 실시간 동기화, 의존성 그래프, 타임라인 차트
Out-of-Scope: 멀티 유저, 클라우드 배포, 모바일 앱, DB 스키마

## 10. 릴리스 마일스톤 (MVP)
| 주차 | 목표 |
|------|------|
|1주차| CLI init, parse-prd, list/show 구현 |
|2주차| 웹 대시보드 (칸반 기본) |
|3주차| 요구사항 refine & 브레인스토밍 엔진 |
|4주차| SSE 실시간 연동, 의존성 그래프 |
|5주차| 타임라인 차트, 문서화 & GitHub 공개 |

## 11. 리스크 & 완화 전략
- Claude Max 독점 의존 → 추후 프로바이더 추상화 레이어 설계
- Windows 호환 이슈 → CI 환경에서 테스트 & 커뮤니티 기여 유도

---
본 문서는 TaskFlow MVP 개발을 위한 최종 PRD입니다.