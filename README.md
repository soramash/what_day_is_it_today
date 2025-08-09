# 今日は何の日 Slack Bot

毎朝Slackに「今日は何の日」の情報を投稿するGoogle Apps Scriptプログラムです。
Wikipediaから情報を取得し、わかりやすく整形してSlackに投稿します。

## 機能

- 📅 今日の日付に関連する歴史的な出来事を表示
- 🎂 今日が誕生日の有名人を表示  
- 🙏 今日が忌日の有名人を表示
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

Google Apps Scriptの管理画面で `testBot` 関数を実行してテストできます。

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

## 利用するAPI

- [Wikipedia API](https://ja.wikipedia.org/w/api.php) - 今日は何の日の情報を取得
  - MediaWiki API Warningに対応済み（`rvslots=*`パラメータ使用）
  - 新旧両フォーマットに対応
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks) - Slackへの投稿

## 改善点

### MediaWiki API対応
- Wikipedia APIのwarningに対応し、`rvslots=*`パラメータを使用して新しいAPIフォーマットに対応
- レガシーフォーマットとの後方互換性も維持
- より堅牢なエラーハンドリング

### データ解析の強化
- Wikitext形式の複雑なマークアップを適切に処理
- 画像やテンプレートタグを除去してクリーンなテキストを抽出
- 職業情報も含めた人物情報の表示

### TypeScript対応
- Google Apps Script用の型定義を使用
- コンパイル時の型チェック対応

## ライセンス

MIT License
