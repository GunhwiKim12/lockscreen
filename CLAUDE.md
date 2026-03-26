# CLAUDE.md

## Project
Solo Flip Mode app.
The user flips the phone face-down to enter a focus-like state.
The app shows an ongoing lock-screen surface while active.

## Stack
- React Native + Expo **development build** (NOT Expo Go — requires `expo prebuild` + native project)
- TypeScript
- iOS native bridge → ActivityKit Live Activity
- Android native bridge → ongoing notification (lock-screen visible)

## Product boundaries
Current scope is ONLY Flip Mode.
Do not implement:
- couple mode
- anonymous cheering
- backend / remote sync
- messaging / accounts

## Platform rules

### iOS
- Lock-screen surface = Live Activity (ActivityKit, iOS 16.2+)
- Keep UI glanceable; not a full lock-screen takeover
- Requires separate Widget Extension Xcode target

### Android
- Lock-screen surface = ongoing notification (IMPORTANCE_LOW, VISIBILITY_PUBLIC)
- Not wallpaper-based
- OEM caveat: MIUI/ColorOS may require manual lock-screen permission from user

## Motion rules
- DeviceMotion z-axis: `< -0.75` = face-down candidate, `> 0.75` = face-up candidate
- sustainMs = 1500ms before state transition, cooldownMs = 2000ms between sessions
- State machine: `idle → arming → active → cooldown → ended`

## App behavior
- User taps "Start Flip Mode" to arm detection
- Face-down sustained → session starts → lock-screen surface shown
- Face-up sustained → cooldown → session ends
- Local history persisted (up to 50 sessions); no cloud sync

---

## Current implementation status

### Files present and complete (pure TS/RN, no native wiring needed)
```
app/index.tsx                              entry point
src/core/types.ts                          domain types (FlipPhase, FlipSession, etc.)
src/core/lockSurface.ts                    ILockSurface interface
src/core/time.ts                           elapsed time utils
src/features/flip/flipThresholds.ts        default sensor config values
src/features/flip/FlipMachine.ts           state machine — owns all transition logic
src/features/flip/FlipService.ts           DeviceMotion → FlipMachine → LockSurface
src/features/flip/FlipSessionStore.ts      AsyncStorage persistence (up to 50 sessions)
src/features/flip/useFlipMode.ts           React hook for UI consumption
src/storage/localStore.ts                  AsyncStorage JSON wrapper
src/ui/FlipModeScreen.tsx                  main screen
src/ui/FlipStatusCard.tsx                  phase label + timer display
src/ui/SessionSummaryCard.tsx              session history row
```

### RN/TS 브리지 레이어 — 완료
```
src/native/LockSurfaceBridge.ts
  - NativeModules.LockSurfaceBridge (iOS) / NativeModules.LockSurfaceModule (Android) 호출
  - native 모듈 미연결 시 자동 mock fallback (console.log)
  - setLockSurface()로 테스트 주입 가능
```

### Android 네이티브 — 파일 완성 + 등록 완료
```
android/app/src/main/java/com/flipmode/app/locksurface/
  LockSurfaceChannel.kt          채널 등록 (IMPORTANCE_LOW, VISIBILITY_PUBLIC)
  LockSurfaceNotificationManager.kt  알림 빌드/표시/해제
  LockSurfaceModule.kt           RN NativeModule (start/update/cancel)
  LockSurfacePackage.kt          ReactPackage 구현
android/app/src/main/java/com/flipmode/app/MainApplication.kt
  - LockSurfacePackage() 등록 완료 (line 13 import, line 24 add)
android/app/src/main/AndroidManifest.xml
  - FOREGROUND_SERVICE, POST_NOTIFICATIONS 권한 포함 확인됨
```
→ Android는 `npx expo run:android`로 바로 빌드 가능

### iOS 네이티브 — 파일 존재, Xcode target 미연결
```
ios/FlipMode/LockSurfaceBridge.swift   Swift 구현 존재 (startActivity/updateActivity/endActivity)
ios/FlipMode/LockSurfaceBridge.m       Obj-C 브리지 헤더 존재 (RCT_EXTERN_MODULE)
  → 두 파일 모두 디스크에 있지만 project.pbxproj에 미등록
  → Xcode에서 FlipMode 타겟에 수동 추가 필요

ios/LockSurfaceWidgetExtension/
  LockSurfaceAttributes.swift    (FlipMode 메인 타겟에도 추가 필요 — 공유 타입)
  LockSurfaceLiveActivity.swift
  LockSurfaceWidget.swift
  → 파일 존재, Widget Extension Xcode 타겟 미생성
```

### iOS Xcode 수동 작업 목록
1. `ios/FlipMode.xcworkspace` 열기
2. `LockSurfaceBridge.swift` + `LockSurfaceBridge.m` → FlipMode 타겟에 추가
3. `LockSurfaceAttributes.swift` → FlipMode 타겟에도 추가 (공유 타입)
4. File → New → Target → Widget Extension → 이름 "LockSurfaceWidgetExtension"
5. Widget Extension 타겟에 `LockSurfaceAttributes.swift`, `LockSurfaceLiveActivity.swift`, `LockSurfaceWidget.swift` 추가
6. FlipMode 메인 타겟 → Build Phases → Embed App Extensions → LockSurfaceWidgetExtension 추가

### 현재 빌드 상태
- Android: 빌드 가능 (native 브리지 포함)
- iOS: expo run:ios로 빌드 가능하나 Live Activity 미작동 (Xcode target 미연결)

---

## Architecture rules
- FlipMachine.ts owns all state transitions; FlipService only feeds events
- LockSurfaceBridge.ts is a singleton factory; mock swappable via `setLockSurface()` in tests
- Native code handles only lock-screen surface lifecycle; no business logic in Swift/Kotlin
- Bridge interface: `start(payload)` / `update(payload)` / `end()` / `isActive()`

## Quality rules
Before saying a task is done:
1. Summarize changed files
2. List native files still requiring manual wiring (Xcode target / ReactPackage)
3. Manual test steps
4. Background execution limitations (DeviceMotion stops when JS thread is suspended)
5. Update this CLAUDE.md to reflect current state

## Output expectations
- Short plan first → code/file changes → test checklist → risks
