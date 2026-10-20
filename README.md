# Ryou Koshimizu — Portfolio

**AIを組み込んだ業務システムを、要件定義から本番運用まで一人で開発するフリーランスエンジニアのポートフォリオです。**

公開ページ: <https://ryou-koshimizu.github.io/portfolio/>

## 載せている実績

| 実績 | 言語・技術 | リポジトリ |
| --- | --- | --- |
| 暖簾AI（本番運用中の自社サービス） | OAuth 連携・Stripe 課金・WordPress プラグイン・GitHub 連携 | <https://noren-ai.jp> |
| 日本語データ分析エージェント | TypeScript・Next.js・PostgreSQL・Claude API | [japanese-data-agent](https://github.com/Ryou-Koshimizu/japanese-data-agent) |
| 請求書AIワークフロー | TypeScript・Next.js・PostgreSQL RLS・Stripe | [japanese-invoice-workflow](https://github.com/Ryou-Koshimizu/japanese-invoice-workflow) |
| 社内ナレッジ検索AI（RAG） | Python・FastAPI・SQLite FTS5・Claude API | [japanese-knowledge-rag](https://github.com/Ryou-Koshimizu/japanese-knowledge-rag) |
| 日本の業務 MCP サーバー | Go・MCP・WebAssembly | [japan-business-mcp](https://github.com/Ryou-Koshimizu/japan-business-mcp) |
| 備品発注ワークフロー | TypeScript・Next.js・PostgreSQL RLS とトリガー | [japanese-procurement-workflow](https://github.com/Ryou-Koshimizu/japanese-procurement-workflow) |
| LINE AI 受付・予約ボット | TypeScript・Hono・Cloudflare Workers・D1・Claude API | [line-ai-reception](https://github.com/Ryou-Koshimizu/line-ai-reception) |

## このページの作り

- 素の HTML・CSS・JavaScript（ビルドなし・依存なし）。
- ガラスは WebGL で描画。画面の各パネルの位置に合わせて、厚いガラスの縁での屈折・色の分散・すりガラス・ポインタの光を描く。
- ヒーローの丸いレンズは名前の文字を拡大して曲げ、スクロールするとナビの印へ溶けて合わさる。
- スクロールは JavaScript で動かし、ガラスと文字を同じフレームで描く（ガラスが文字から遅れない）。
- 動きを減らす設定では、止まった1枚で見せる。WebGL が使えないときは CSS のガラスで表示。

## 試験

```sh
python3 tests/check.py
```

Chromium と WebKit で、25種類の画面の大きさ（280x653〜3840x2160、横向きのスマホを含む）を確かめる。

- 横のはみ出し・文字の欠けが0件
- ヘッダーが80px、ヒーローが画面の高さ − 80px で、ヒーローの中身が最初の画面に収まる
- コンソールのエラーが0件、WebGL で描けている
- axe（WCAG 2.1 A/AA）の違反が0件
- ページ内リンク・外へのリンクが有効

## ライセンス

コードは MIT。文章と実績の記載は Ryou Koshimizu に帰属します。
