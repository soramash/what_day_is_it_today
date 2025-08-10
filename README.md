# 今日は何の日 Slack Bot

毎朝Slackに「今日は何の日」の情報を投稿するGoogle Apps Scriptプログラムです。
php.co.jpの「今日は何の日」データを取得し、わかりやすく整形してSlackに投稿します。

## 機能

- 🎉 記念日・行事・お祭りを表示（php.co.jpから取得）
- 🏛️ 歴史上の出来事をランダム5件表示（Wikipediaから取得）
- 🎂 今日が誕生日の有名人をランダム5件表示（Wikipediaから取得）
- 🌸 今日の誕生花を表示（whatistoday.cyou APIから取得）
- 🤖 毎朝自動でSlackに投稿
- ⚡ Google Apps Scriptで軽量動作

## セットアップ手順

### 1. 必要なツールのインストール

```bash
npm install -g @google/clasp
npm install
```

### 2. Google Apps Scriptプロジェクトの作成

```bash
# Googleアカウントにログイン
clasp login

# 新しいGoogle Apps Scriptプロジェクトを作成
clasp create --type standalone --title "今日は何の日Bot"

# コードをGoogle Apps Scriptにアップロード
npm run push
```

### 3. Slack Webhook URLの設定

1. [Slack API](https://api.slack.com/apps)でIncoming Webhookを作成
2. Google Apps Scriptの管理画面で「設定」→「スクリプトのプロパティ」を開く
3. 以下のプロパティを追加:
   - キー: `SLACK_WEBHOOK_URL`
   - 値: SlackのWebhook URL

### 4. 毎朝の自動実行を設定

1. Google Apps Scriptの管理画面で「トリガー」を開く
2. 「トリガーを追加」をクリック
3. 以下を設定:
   - 実行する関数: `main`
   - イベントのソース: 時間主導型
   - 時間ベースのトリガーのタイプ: 日タイマー
   - 時刻: 9時から10時（好みの時間帯）

## 使用方法

### 手動テスト

Google Apps Scriptの管理画面で以下の関数を実行してテストできます：

- `testBot` - ボット全体のテスト実行
- `testBirthFlowerApi` - 誕生花APIのテスト実行
- `testWikipediaApi` - Wikipedia APIのテスト実行
- `debugHtmlContent` - HTMLコンテンツの詳細確認（デバッグ用）

### 自動実行

設定したトリガーにより、毎朝自動的にSlackに投稿されます。

## プロジェクト構造

```
├── src/
│   ├── main.ts           # メインのTypeScriptコード
│   └── appsscript.json   # Google Apps Script設定
├── .clasp.json           # Clasp設定
├── tsconfig.json         # TypeScript設定
├── package.json          # npm設定
└── README.md            # このファイル
```

## 利用するデータソース

- [PHP研究所「今日は何の日」](https://www.php.co.jp/fun/today/) - 記念日・行事・お祭り情報を取得
- [Wikipedia](https://ja.wikipedia.org/) - 歴史的出来事と誕生日情報を取得
- [whatistoday.cyou API](https://api.whatistoday.cyou/v3/birthflower/) - 誕生花情報を取得
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks) - Slackへの投稿

## マルチソースデータ取得の仕組み

### 1. php.co.jp連携（記念日・行事・お祭り）
- php.co.jpの「今日は何の日」ページからHTMLスクレイピング
- 日付に応じて動的にURLを生成（例：`08-10.php`）
- ●マーカーで区切られた項目を抽出

### 2. Wikipedia連携（歴史的出来事・誕生日）
- Wikipedia MediaWiki APIを使用して今日のページを取得
- Wikitext形式のデータを解析して情報を抽出
- 多数のデータからランダムに5件ずつ選択してバラエティを実現

### 3. whatistoday.cyou API連携（誕生花）
- REST APIでJSON形式の誕生花情報を取得
- MMDD形式の日付でエンドポイントを指定（例：`/v3/birthflower/0810`）

### データ処理の特徴
- HTMLタグ、コメント、エンティティの適切な除去
- Wikitextマークアップのクリーンアップ
- ランダム抽出によるコンテンツの多様性確保

### TypeScript対応
- Google Apps Script用の型定義を使用
- コンパイル時の型チェック対応

## ライセンス

MIT License
