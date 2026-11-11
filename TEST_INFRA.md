# E2E Test Infra: Kairo Production Readiness & Multi-Provider Architecture

## Test Philosophy
- Opaque-box, requirement-driven testing. No dependency on internal module implementation details.
- Systematic 4-tier methodology:
  1. Category-Partition (Tier 1: Feature coverage)
  2. Boundary Value Analysis (Tier 2: Boundary & corner cases)
  3. Pairwise Combinatorial Testing (Tier 3: Cross-feature interactions)
  4. Real-World Workload Testing (Tier 4: Realistic student & deep-work workflows)
  5. White-box Adversarial Coverage Hardening (Tier 5: Stress testing, regression defense)

---

## Feature Inventory Coverage Matrix
| # | Feature | Requirement Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|-------------------|:------:|:------:|:------:|:------:|
| 1 | Keyboard Shortcuts (M, 1/2/3) | R1 | 5 | 5 | ✓ | ✓ |
| 2 | Subtask Completion Reversion | R1 | 5 | 5 | ✓ | ✓ |
| 3 | Time Capsule Tomorrow Rollover | R1 | 5 | 5 | ✓ | ✓ |
| 4 | Finish Estimate Parameters | R1 | 5 | 5 | ✓ | ✓ |
| 5 | Timer Reset Duration Preservation | R1 | 5 | 5 | ✓ | ✓ |
| 6 | Audio Oscillator Gain Modulation | R1 | 5 | 5 | ✓ | ✓ |
| 7 | Palette Normalization Alignment | R1 | 5 | 5 | ✓ | ✓ |
| 8 | Audio URL Object Revocation | R1 | 5 | 5 | ✓ | ✓ |
| 9 | Text Audit Self-Contained Server | R1, R3 | 5 | 5 | ✓ | ✓ |
| 10| Modular AI Provider Architecture | R2 | 5 | 5 | ✓ | ✓ |
| 11| Anthropic Claude Provider Adapter | R2 | 5 | 5 | ✓ | ✓ |
| 12| Dedicated OpenAI & Custom Adapters| R2 | 5 | 5 | ✓ | ✓ |
| 13| Local Ollama & OpenRouter Adapters| R2 | 5 | 5 | ✓ | ✓ |
| 14| Client-Side PDF/Doc Text Extractor| R2 | 5 | 5 | ✓ | ✓ |
| 15| Zero-Config Offline Heuristic AST | R2 | 5 | 5 | ✓ | ✓ |
| 16| Backward Compatibility Facades | R2 | 5 | 5 | ✓ | ✓ |
| 17| Washi CSS Token Integrity | R3 | 5 | 5 | ✓ | ✓ |
| 18| Modal 860px Width Framing | R3 | 5 | 5 | ✓ | ✓ |
| 19| WCAG AA Contrast Compliance | R3 | 5 | 5 | ✓ | ✓ |
| 20| In-Modal Provider Switcher & FAQ | R2, R3 | 5 | 5 | ✓ | ✓ |
| 21| Washi/Sumi SVG Iconography | R3 | 5 | 5 | ✓ | ✓ |
| 22| Sidebar AI Task/Project Slicing | R1, R2 | 5 | 5 | ✓ | ✓ |

---

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Student Study Plan from PDF Syllabus | F10, F14, F15, F18, F20, F21 | High |
| 2 | Offline Deep-Work Session with Custom Pomodoro Lengths | F1, F4, F5, F15, F17, F19 | High |
| 3 | Time Capsule Creation & Next-Morning Unlock Schedule | F3, F7, F17, F19 | Medium |
| 4 | Multi-Provider Switching (Ollama -> Gemini -> Claude -> Offline) | F10, F11, F12, F13, F15, F20 | High |
| 5 | Master Mute & Soundscape Preset Switching during Active Timer | F1, F6, F8, F17 | Medium |

---

## Test Architecture & Execution
- Unit & Integration Test Runner: `npm test` (`tsx --test tests/*.test.ts`)
- Typecheck: `npm run typecheck` (`tsc --noEmit`)
- Visual & Text Audit: `npm run audit:text` (`node scripts/audit_text_placement.cjs`)
- Production Build: `npm run build` (`vite build`)
- End-to-End Suite: `npm run check` (`npm run typecheck && npm run test && npm run build`)
- Visual Verification: `node scripts/full_pass_verification.cjs`, `node scripts/verify_capsule_alignment.cjs`
