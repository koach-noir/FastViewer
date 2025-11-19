# FastViewer リファクタリング計画

## 目的

### 短期目標
- App.tsxの肥大化を防ぎ、保守性を向上させる
- 画像読み込み・表示機能とUI/UX機能を疎結合にする

### 長期目標（雛形化）
- **UI/UXフレームワーク層を他プロジェクトへ転用可能にする**
- 例: テキストアニメーションプロジェクト、動画プレイヤープロジェクトなど
- 将来的にはフレームワーク層を独立したライブラリとして切り出し可能にする

## 現状の問題点

### App.tsx: 523行
単一ファイルに全機能が集約され、以下の責務が混在:
- 画像読み込み・ナビゲーション
- 自動再生ロジック
- UI表示レベル管理
- 通知システム
- キーボード操作
- UIレンダリング

### 課題
1. **強い結合度**: 根幹機能とUI/UXが分離されていない
2. **ファイル肥大化**: 新機能追加のたびに増加
3. **転用困難**: どの部分が再利用可能か不明確

## 新しいディレクトリ構造

```
src/
├── framework/                    # 【再利用可能】UI/UXフレームワーク層
│   ├── hooks/
│   │   ├── useDisplayLevel.ts   # 段階的UI表示システム (0→1→2→3)
│   │   ├── useAutoPlay.ts       # 自動再生システム（汎用）
│   │   ├── useNotification.ts   # 通知システム
│   │   └── useKeyboard.ts       # キーボード操作の基盤
│   ├── components/
│   │   ├── AutoPlayControls.tsx      # 再生/一時停止/速度/方向
│   │   ├── LoopControl.tsx           # ループトグル
│   │   ├── NavigationButtons.tsx     # 前/次ボタン（汎用）
│   │   └── Notification.tsx          # 通知表示
│   └── types.ts                      # 汎用的な型定義
│
├── features/                     # 【プロジェクト固有】コンテンツ機能
│   └── image-viewer/
│       ├── hooks/
│       │   └── useImageContent.ts    # 画像ロード・ナビゲーション
│       ├── components/
│       │   ├── ImageDisplay.tsx      # 画像表示
│       │   ├── ImageInfo.tsx         # シーン名、ページ情報
│       │   └── SceneNavigation.tsx   # シーン切り替え
│       ├── services/
│       │   └── imageService.ts       # Tauri API呼び出し
│       └── types.ts                  # 画像固有の型（ImageData, SceneInfo）
│
└── App.tsx                       # 統合層（frameworkとfeaturesを接続）
```

## 責務の分離

### Framework層（汎用UI/UX）
| モジュール | 責務 | 依存 |
|-----------|------|------|
| `useDisplayLevel` | マウスホバー検知、段階的UI表示制御 | なし |
| `useAutoPlay` | タイマー管理、速度/方向制御、一時停止 | `onNext`, `onPrev` コールバック |
| `useNotification` | 通知表示、自動消去タイマー | なし |
| `useKeyboard` | キーボードイベント管理 | コールバック関数群 |
| `AutoPlayControls` | 再生ボタン、速度スライダー、方向トグル | `useAutoPlay`の状態 |
| `Notification` | 通知メッセージのレンダリング | `useNotification`の状態 |

### Features層（画像ビューイング固有）
| モジュール | 責務 | 依存 |
|-----------|------|------|
| `imageService` | Tauri API呼び出しのラップ | `@tauri-apps/api` |
| `useImageContent` | 画像ロード、ページ/シーンナビゲーション | `imageService` |
| `ImageDisplay` | 画像のレンダリング | `ImageData` |
| `ImageInfo` | シーン名、ページ番号、ファイル名表示 | `SceneInfo`, `ImageData` |

### App.tsx（統合層）
- Framework層とFeatures層を接続
- 状態の受け渡しとイベントハンドラの結合
- 約100-150行に削減予定

## 実装方針：段階的・安全なリファクタリング

### 基本原則
- **各段階は小さく**: 1つの機能の抽出＋動作確認
- **こまめにコミット**: 各段階完了後に必ずコミット
- **デグレ発見時の後戻り**: `git reset --hard HEAD^` で前段階に戻る
- **影響範囲の最小化**: 独立性の高い機能から着手

---

## 実装段階

### 段階1: Service層の基礎 🟢 リスク：低

**目標**: Tauri API呼び出しを集約（最小限の変更）

#### タスク
- [ ] ディレクトリ作成: `src/features/image-viewer/services/`
- [ ] `imageService.ts` 作成
  - 既存のTauri `invoke` 呼び出しをラップする関数を作成
  - 関数一覧:
    - `loadSceneCollection(path: string)`
    - `getSceneInfo()`
    - `getImage(sceneIndex, pageIndex)`
    - `nextPage()`, `prevPage()`
    - `nextScene()`, `prevScene()`
    - `getSceneLoopEnabled()`, `setSceneLoopEnabled(enabled)`
- [ ] `App.tsx` を更新
  - `imageService` をインポート
  - 直接の `invoke` 呼び出しを `imageService` 経由に変更
  - **既存のロジックは変更しない**（単純なラップのみ）

#### 動作確認
- [ ] 画像の表示
- [ ] ページ送り/戻り（矢印キー、ボタン）
- [ ] シーン切り替え
- [ ] 自動再生
- [ ] シーンループトグル

#### コミットメッセージ例
```
refactor: add imageService layer for Tauri API calls

- Create features/image-viewer/services/imageService.ts
- Wrap all Tauri invoke calls
- Update App.tsx to use imageService
- No functional changes
```

**後戻りコスト**: 低（1ファイル追加、App.tsxの変更のみ）

---

### 段階2: 通知システムの分離 🟢 リスク：低

**目標**: 独立性の高い通知機能をFramework層へ抽出

#### タスク
- [ ] ディレクトリ作成: `src/framework/hooks/`, `src/framework/components/`
- [ ] `framework/hooks/useNotification.ts` 作成
  - App.tsx lines 28-30, 78-92 から抽出
  - `showNotification(message: string, duration?: number)` 関数
  - `notification` 状態
  - タイマー管理
- [ ] `framework/components/Notification.tsx` 作成
  - App.tsx lines 511-515 のJSXを抽出
  - スタイルも移行（App.cssから該当部分を抽出）
- [ ] `App.tsx` を更新
  - `useNotification` をインポートして使用
  - `<Notification>` コンポーネントを使用

#### 動作確認
- [ ] スペースバーで自動再生ON/OFF時に通知が表示される
- [ ] 通知が2秒後に自動消去される

#### コミットメッセージ例
```
refactor: extract notification system to framework layer

- Create framework/hooks/useNotification.ts
- Create framework/components/Notification.tsx
- Make notification system reusable for other projects
```

**後戻りコスト**: 低（2ファイル追加、App.tsxの小規模変更）

---

### 段階3: 画像コンテンツ管理の抽出 🟡 リスク：中

**目標**: 画像特有のステート管理とナビゲーションをFeatures層へ

#### タスク
- [ ] ディレクトリ作成: `src/features/image-viewer/hooks/`
- [ ] `features/image-viewer/hooks/useImageContent.ts` 作成
  - App.tsx lines 7-11, 37-175, 362-390 から抽出
  - ステート: `imageData`, `sceneInfo`, `loading`, `error`, `sceneLoopEnabled`
  - 関数: `loadInitialScene`, `handleNextPage`, `handlePrevPage`, `handleNextScene`, `handlePrevScene`, `handleSceneLoopToggle`
  - `imageService` を使用
  - `isNavigating` ref も含める
- [ ] `App.tsx` を更新
  - `useImageContent` をインポートして使用
  - ステートと関数をhookから取得

#### 動作確認
- [ ] 初期シーンの読み込み
- [ ] ページナビゲーション（全方向）
- [ ] シーンナビゲーション（全方向）
- [ ] シーンループトグルの動作
- [ ] ローディング状態の表示
- [ ] エラーハンドリング

#### コミットメッセージ例
```
refactor: extract image content management to useImageContent hook

- Create features/image-viewer/hooks/useImageContent.ts
- Move image loading and navigation logic from App.tsx
- Encapsulate image-specific state management
```

**後戻りコスト**: 中（ステート管理の移動のため、複数箇所に影響）

---

### 段階4: 自動再生システムの分離 🟡 リスク：中

**目標**: 自動再生機能をFramework層へ汎用化

#### タスク
- [ ] `framework/hooks/useAutoPlay.ts` 作成
  - App.tsx lines 12-17, 74-76, 177-198 から抽出
  - ステート: `isPlaying`, `speed`, `reverse`
  - 関数: `togglePlay`, `setSpeed`, `toggleReverse`, `pause(duration)`
  - コールバック: `onNext`, `onPrev` を受け取る
  - タイマー管理とアイドリング機能
- [ ] `framework/components/AutoPlayControls.tsx` 作成
  - App.tsx lines 466-497 のJSXを抽出
  - 再生/一時停止ボタン、速度スライダー、方向トグル
  - スタイルも移行
- [ ] `App.tsx` を更新
  - `useAutoPlay` をインポート、`useImageContent`のナビゲーション関数を渡す
  - `<AutoPlayControls>` コンポーネントを使用
  - キーボードハンドラで `pause` を呼び出す

#### 動作確認
- [ ] 自動再生の開始/停止
- [ ] 速度変更（0.5x〜3.0x）
- [ ] 方向切り替え（前進/後退）
- [ ] 手動操作時の1秒アイドリング
- [ ] スペースバーによるトグル

#### コミットメッセージ例
```
refactor: extract auto-play system to framework layer

- Create framework/hooks/useAutoPlay.ts with generic callbacks
- Create framework/components/AutoPlayControls.tsx
- Make auto-play system content-agnostic and reusable
```

**後戻りコスト**: 中（タイマーロジックの移動、複数コールバック連携）

---

### 段階5: 表示レベル管理の分離 🟠 リスク：中〜高

**目標**: 複雑な段階的UI表示システムをFramework層へ

#### タスク
- [ ] `framework/hooks/useDisplayLevel.ts` 作成
  - App.tsx lines 19-35, 200-319 から抽出
  - ステート: `displayLevel`
  - マウスホバー、マウスダウンイベント管理
  - 段階的遷移タイマー（level2Timer, level3Timer）
  - アイドルタイマー
  - シーン変更検知機能（`onSceneChange` コールバック）
- [ ] `App.tsx` を更新
  - `useDisplayLevel` をインポート
  - `sceneInfo.scene_index` の変化を監視して `onSceneChange` を呼び出す
  - `displayLevel` を各UIコンポーネントに渡す

#### 動作確認
- [ ] マウス移動で段階的にUI表示（0→1→2→3）
- [ ] マウスダウンで即座にレベル3へ
- [ ] 3秒アイドルでレベル0へ戻る
- [ ] シーン変更時、レベル0ならレベル1へ遷移
- [ ] レベル0でカーソル非表示
- [ ] 各レベルで適切なUI要素が表示/非表示

#### コミットメッセージ例
```
refactor: extract display level system to framework layer

- Create framework/hooks/useDisplayLevel.ts
- Implement progressive UI reveal with mouse interaction
- Support scene change detection for level transitions
```

**後戻りコスト**: 中〜高（複雑なタイマーロジック、多くのUIに影響）

---

### 段階6: キーボード操作の分離 🟢 リスク：低〜中

**目標**: キーボード操作をFramework層へ汎用化

#### タスク
- [ ] `framework/hooks/useKeyboard.ts` 作成
  - App.tsx lines 321-360 から抽出
  - キーマッピングを外部から注入: `{ [key: string]: () => void }`
  - `useEffect` でイベントリスナー登録/解除
- [ ] `App.tsx` を更新
  - `useKeyboard` をインポート
  - キーマッピングオブジェクトを作成して渡す
  - 既存の `useEffect` を削除

#### 動作確認
- [ ] 矢印キー（左/右/上/下）でページ送り
- [ ] スペースバーで自動再生トグル
- [ ] Escキー（将来の拡張用）

#### コミットメッセージ例
```
refactor: extract keyboard handling to framework layer

- Create framework/hooks/useKeyboard.ts
- Make key mapping configurable and content-agnostic
- Remove keyboard logic from App.tsx
```

**後戻りコスト**: 低〜中（イベントハンドラの移動、依存関係多い）

---

### 段階7: UIコンポーネントの分離 🟡 リスク：中

**目標**: 残りのUIコンポーネントを分離

#### タスク（Framework層）
- [ ] `framework/components/LoopControl.tsx` 作成
  - App.tsx lines 500-508 から抽出
  - プロパティ: `enabled`, `onToggle`, `displayLevel`
  - 汎用化（"Loop"という名前にする）

- [ ] `framework/components/NavigationButtons.tsx` 作成
  - App.tsx lines 436-463 から抽出（一部）
  - プロパティ: `onPrev`, `onNext`, `displayLevel`
  - シーンナビゲーションは含めない（Features層へ）

#### タスク（Features層）
- [ ] ディレクトリ作成: `src/features/image-viewer/components/`
- [ ] `features/image-viewer/components/ImageDisplay.tsx` 作成
  - App.tsx lines 401-411 から抽出
  - `imageData` を受け取って `<img>` をレンダリング

- [ ] `features/image-viewer/components/ImageInfo.tsx` 作成
  - App.tsx lines 413-433 から抽出
  - シーン名、総ページ数、ページ番号、ファイル名
  - `displayLevel` に応じた表示制御

- [ ] `features/image-viewer/components/SceneNavigation.tsx` 作成
  - App.tsx lines 437-440, 460-462 から抽出
  - シーン切り替えボタン

#### App.tsx更新
- [ ] 各コンポーネントをインポートして使用
- [ ] JSXを簡素化

#### 動作確認
- [ ] 全UIコンポーネントの表示
- [ ] 各ボタンの動作
- [ ] 表示レベルに応じた表示/非表示

#### コミットメッセージ例
```
refactor: extract UI components to framework and features layers

- Create reusable framework components (LoopControl, NavigationButtons)
- Create image-specific components (ImageDisplay, ImageInfo, SceneNavigation)
- Simplify App.tsx JSX structure
```

**後戻りコスト**: 中（多数のコンポーネント、CSS分離が必要な場合あり）

---

### 段階8: 型定義の整理 🟢 リスク：低

**目標**: 型定義を適切な場所へ移動

#### タスク
- [ ] `src/features/image-viewer/types.ts` 作成
  - 既存の `src/types.ts` の内容を移動
  - `ImageData`, `SceneInfo`, `SceneListItem`
- [ ] `src/framework/types.ts` 作成（必要に応じて）
  - 汎用的な型定義（現時点では空でもOK）
- [ ] `src/types.ts` を削除
- [ ] 各ファイルのimport文を更新
  - `./types` → `./features/image-viewer/types`

#### 動作確認
- [ ] TypeScriptのビルドエラーがない
- [ ] すべての型参照が正しく解決される

#### コミットメッセージ例
```
refactor: organize type definitions by layer

- Move image-specific types to features/image-viewer/types.ts
- Create framework/types.ts for future generic types
- Update all import statements
```

**後戻りコスト**: 低（型定義の移動とimport更新のみ）

---

## 段階完了後のApp.tsx（最終形）

最終的なApp.tsxは約100-150行に削減され、以下のような構造になります：

```tsx
// Imports
import { useImageContent } from './features/image-viewer/hooks/useImageContent';
import { useAutoPlay } from './framework/hooks/useAutoPlay';
import { useDisplayLevel } from './framework/hooks/useDisplayLevel';
import { useNotification } from './framework/hooks/useNotification';
import { useKeyboard } from './framework/hooks/useKeyboard';
// ... component imports

function App() {
  // Hooks
  const imageContent = useImageContent();
  const autoPlay = useAutoPlay(imageContent.nextPage, imageContent.prevPage);
  const displayLevel = useDisplayLevel(imageContent.sceneInfo?.scene_index);
  const notification = useNotification();

  // Keyboard mapping
  useKeyboard({
    'ArrowLeft': () => { autoPlay.pause(1000); imageContent.prevPage(); },
    'ArrowRight': () => { autoPlay.pause(1000); imageContent.nextPage(); },
    ' ': () => {
      autoPlay.togglePlay();
      notification.show(autoPlay.isPlaying ? 'Auto-play OFF' : 'Auto-play ON');
    }
  });

  // Render
  return (
    <div className={`app ${displayLevel.current === 0 ? 'hide-cursor' : ''}`}>
      <ImageDisplay imageData={imageContent.imageData} />
      <ImageInfo {...imageContent} displayLevel={displayLevel.current} />
      <NavigationButtons {...imageContent} displayLevel={displayLevel.current} />
      <SceneNavigation {...imageContent} displayLevel={displayLevel.current} />
      <AutoPlayControls {...autoPlay} displayLevel={displayLevel.current} />
      <LoopControl {...imageContent} displayLevel={displayLevel.current} />
      <Notification {...notification} />
    </div>
  );
}
```

---

## 他プロジェクトへの転用例

### テキストアニメーションプロジェクト

```
text-animation-app/
├── framework/           # FastViewerからコピー（変更なし）
│   ├── hooks/
│   ├── components/
│   └── types.ts
│
├── features/
│   └── text-animation/  # 新規作成
│       ├── hooks/
│       │   └── useTextContent.ts      # テキストロード
│       ├── components/
│       │   ├── TextDisplay.tsx        # テキスト表示
│       │   └── TextInfo.tsx           # テキスト情報
│       ├── services/
│       │   └── textService.ts         # API呼び出し
│       └── types.ts                   # TextData型など
│
└── App.tsx              # frameworkとtext-animationを接続
```

### 必要な変更
1. `features/` 配下を差し替え
2. App.tsx で統合コードを書き換え
3. `framework/` は**そのまま使用可能**

## メリット

### 短期的
- コードの保守性向上
- テストが容易に
- 新機能追加時の影響範囲が限定的

### 長期的
- **UI/UXフレームワークを複数プロジェクトで共有**
- 一貫したUX体験を提供
- フレームワーク改善が全プロジェクトに波及
- 将来的にnpmパッケージ化も可能

## 注意事項

### リファクタリング中
- 各フェーズごとに動作確認を実施
- 既存機能を壊さないことを最優先
- git でこまめにコミット

### フレームワーク設計
- **コンテンツの種類に依存しない**設計を心がける
- 画像、テキスト、動画など、どのコンテンツでも使えるように
- 具体的な実装は `features/` に閉じ込める

## 進捗管理

### 実装状況 ✅ 完了
- [x] **段階1**: Service層の基礎 🟢 → コミット: `56c0a29`
- [x] **段階2**: 通知システムの分離 🟢 → コミット: `1f2e076`
- [x] **段階3**: 画像コンテンツ管理の抽出 🟡 → コミット: `d27edee`
- [x] **段階4**: 自動再生システムの分離 🟡 → コミット: `c597860`
- [x] **段階5**: 表示レベル管理の分離 🟠 → コミット: `8e57af0`
- [x] **段階6**: キーボード操作の分離 🟢 → コミット: `dc2c767`
- [x] **段階7**: UIコンポーネントの分離 🟡 → コミット: `31e4c9b`
- [x] **段階8**: 型定義の整理 🟢 → コミット: `e989766`
- [x] **修正**: ナビゲーションボタンのレイアウト修正 → コミット: `a8efb7f`

### 最終結果

#### コード削減
- **App.tsx**: 523行 → 148行（**375行削減、72%の削減率**）
- **作成ファイル数**: 22ファイル（hooks: 6, components: 8, services: 1, types: 2, CSS: 5）

#### 実装ブランチ
- `claude/refactoring-implementation-016rZsk2kb9M8wpsk58GMBt6`
- 全9コミット（リファクタリング8段階 + バグ修正1件）

#### 最終確認
- [x] 全機能の動作テスト（ユーザー確認済み）
- [x] ナビゲーションボタン重複問題の修正
- [x] ビルド成功確認
- [x] ドキュメント更新（本ファイルに完了記録を追加）

#### 得られた成果
1. **保守性の向上**: 責務が明確に分離され、各モジュールが独立
2. **再利用性の確保**: Framework層が他プロジェクトへ転用可能
3. **テスト容易性**: 各hookとコンポーネントが独立してテスト可能
4. **可読性の向上**: App.tsxが薄い統合層として機能

#### 設計上の決定事項
- **段階7の調整**: `NavigationButtons.tsx`と`SceneNavigation.tsx`を作成したが、ボタン重複問題が発生したため、ナビゲーションコントロールはApp.tsx内にインラインで保持する設計に変更
- これにより、4つのナビゲーションボタン（Prev Scene, Prev, Next, Next Scene）が単一の`.navigation-controls`コンテナ内に配置され、元のレイアウトを維持

#### 最終的なファイル構造
```
src/
├── framework/                           # 再利用可能なUI/UXフレームワーク層
│   ├── hooks/
│   │   ├── useAutoPlay.ts              # 自動再生システム（汎用）
│   │   ├── useDisplayLevel.ts          # 段階的UI表示システム
│   │   ├── useKeyboard.ts              # キーボード操作基盤
│   │   └── useNotification.ts          # 通知システム
│   ├── components/
│   │   ├── AutoPlayControls.tsx        # 自動再生コントロール
│   │   ├── AutoPlayControls.css
│   │   ├── LoopControl.tsx             # ループトグル
│   │   ├── LoopControl.css
│   │   └── Notification.tsx            # 通知表示
│   └── types.ts                         # フレームワーク汎用型定義
│
├── features/                            # プロジェクト固有のコンテンツ機能
│   └── image-viewer/
│       ├── hooks/
│       │   └── useImageContent.ts      # 画像ロード・ナビゲーション
│       ├── components/
│       │   ├── ImageDisplay.tsx        # 画像表示
│       │   ├── ImageInfo.tsx           # シーン名・ページ情報
│       │   └── ImageInfo.css
│       ├── services/
│       │   └── imageService.ts         # Tauri API呼び出し
│       └── types.ts                     # 画像固有の型定義
│
├── App.tsx                              # 統合層（148行）
└── App.css                              # グローバルスタイル
```

### 凡例
- 🟢 リスク：低
- 🟡 リスク：中
- 🟠 リスク：中〜高
