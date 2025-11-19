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

## 実装フェーズ

### Phase 1: Service層の作成
**目標**: Tauri API呼び出しを集約、テスタビリティ向上

#### タスク
- [ ] `features/image-viewer/services/imageService.ts` 作成
- [ ] 以下の関数を実装:
  - `loadSceneCollection(path: string)`
  - `getSceneInfo()`
  - `getImage(sceneIndex, pageIndex)`
  - `nextPage()`, `prevPage()`
  - `nextScene()`, `prevScene()`
  - `getSceneLoopEnabled()`, `setSceneLoopEnabled(enabled)`
- [ ] App.tsxでimageServiceを使用するよう書き換え
- [ ] 動作確認

**成果物**: Tauri APIとReactが疎結合に

---

### Phase 2: Custom Hooksの抽出

#### 2-1: Framework hooks（汎用）
- [ ] `framework/hooks/useNotification.ts`
  - 現在のlines 28-30, 78-92を抽出
  - `showNotification(message, duration)` 関数
  - `notification` 状態

- [ ] `framework/hooks/useDisplayLevel.ts`
  - 現在のlines 19-35, 200-319を抽出
  - マウスホバー、マウスダウン検知
  - 段階的遷移タイマー管理
  - シーン変更時の自動遷移

- [ ] `framework/hooks/useAutoPlay.ts`
  - 現在のlines 12-17, 74-76, 177-198を抽出
  - `onNext`, `onPrev` をコールバックとして受け取る
  - 速度、方向、一時停止管理

- [ ] `framework/hooks/useKeyboard.ts`
  - 現在のlines 321-360を抽出
  - キーマッピングを外部から注入可能に

#### 2-2: Features hooks（画像固有）
- [ ] `features/image-viewer/hooks/useImageContent.ts`
  - 現在のlines 7-11, 37-175, 362-390を抽出
  - `imageService` を使用
  - ナビゲーション関数群を提供

**成果物**: ロジックとUIが分離、テスト可能に

---

### Phase 3: UIコンポーネントの分離

#### 3-1: Framework components（汎用）
- [ ] `framework/components/AutoPlayControls.tsx`
  - 再生/一時停止ボタン
  - 速度スライダー
  - 方向トグル

- [ ] `framework/components/LoopControl.tsx`
  - ループトグルボタン（汎用化）

- [ ] `framework/components/NavigationButtons.tsx`
  - 前/次ボタン（汎用）

- [ ] `framework/components/Notification.tsx`
  - 通知メッセージ表示

#### 3-2: Features components（画像固有）
- [ ] `features/image-viewer/components/ImageDisplay.tsx`
  - `<img>` タグのレンダリング

- [ ] `features/image-viewer/components/ImageInfo.tsx`
  - シーン名、総ページ数、ページ番号、ファイル名
  - 表示レベルに応じた出し分け

- [ ] `features/image-viewer/components/SceneNavigation.tsx`
  - シーン切り替えボタン

**成果物**: 各コンポーネントが小さく再利用可能に

---

### Phase 4: App.tsxの簡素化
- [ ] 抽出したhooksとcomponentsをインポート
- [ ] App.tsxで統合
- [ ] CSSの調整（必要に応じてコンポーネントごとに分割）
- [ ] 全機能の動作確認

**成果物**: App.tsx が約100-150行に削減

---

### Phase 5: 型定義の整理
- [ ] `framework/types.ts` 作成
  - 汎用的な型定義

- [ ] `features/image-viewer/types.ts` 作成
  - 既存の `src/types.ts` から移動
  - `ImageData`, `SceneInfo`, `SceneListItem`

**成果物**: 型定義が整理され、依存関係が明確に

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

## TODO

- [ ] Phase 1: Service層の作成
- [ ] Phase 2: Custom Hooksの抽出
- [ ] Phase 3: UIコンポーネントの分離
- [ ] Phase 4: App.tsxの簡素化
- [ ] Phase 5: 型定義の整理
- [ ] 全体テスト
- [ ] ドキュメント更新（README.mdにアーキテクチャ説明を追加）
