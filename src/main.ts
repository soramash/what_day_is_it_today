/**
 * 今日は何の日をSlackに投稿するGoogle Apps Script
 */

interface WikipediaResponse {
  query: {
    pages: {
      [key: string]: {
        pageid: number;
        title: string;
        revisions: Array<{
          contentformat: string;
          contentmodel: string;
          '*': string;
        }>;
      };
    };
  };
}

interface TodayInfo {
  date: string;
  events: string[];
  births: string[];
  deaths: string[];
}

/**
 * 今日の日付から月日の文字列を取得
 */
function getTodayDateString(): string {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  return `${month}月${day}日`;
}

/**
 * WikipediaのAPIから今日は何の日の情報を取得
 * warningに対応した新しいAPIパラメータを使用
 */
function fetchTodayInfo(): TodayInfo | null {
  const dateString = getTodayDateString();
  // warningに対応: rvslots=*を追加して新しいフォーマットを使用
  const url = `https://ja.wikipedia.org/w/api.php?format=json&action=query&prop=revisions&rvprop=content&rvslots=*&titles=${encodeURIComponent(dateString)}`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    
    // warningがある場合はログに出力（開発時のデバッグ用）
    if (data.warnings) {
      Logger.log('Wikipedia API warnings:', JSON.stringify(data.warnings, null, 2));
    }
    
    const pages = data.query.pages;
    const pageKey = Object.keys(pages)[0];
    
    if (pageKey === '-1' || !pages[pageKey].revisions) {
      Logger.log(`Wikipedia page not found for ${dateString}`);
      return null;
    }
    
    // 新しいAPIフォーマットに対応
    let content: string;
    const revision = pages[pageKey].revisions[0];
    
    if (revision.slots && revision.slots.main) {
      // 新しいフォーマット（rvslots=*使用時）
      content = revision.slots.main['*'];
    } else if (revision['*']) {
      // 従来のフォーマット（レガシー対応）
      content = revision['*'];
    } else {
      Logger.log('Could not extract content from Wikipedia response');
      return null;
    }
    
    return parseTodayInfo(dateString, content);
  } catch (error) {
    Logger.log(`Error fetching Wikipedia data: ${error}`);
    return null;
  }
}

/**
 * Wikipediaのページ内容を解析して今日の情報を抽出
 * 実際のWikipediaデータに合わせて正規表現を改善
 */
function parseTodayInfo(date: string, content: string): TodayInfo {
  const info: TodayInfo = {
    date: date,
    events: [],
    births: [],
    deaths: []
  };
  
  // WikitextのリンクやHTML要素を除去するヘルパー関数
  function cleanText(text: string): string {
    return text
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')  // [[リンク|表示テキスト]] → 表示テキスト
      .replace(/\[\[([^\]]+)\]\]/g, '$1')          // [[リンク]] → リンク
      .replace(/\{\{[^}]+\}\}/g, '')               // {{テンプレート}} を除去
      .replace(/<[^>]+>/g, '')                     // HTMLタグを除去
      .replace(/\([^)]*\*[^)]*\)/g, '')            // (* を含む括弧を除去
      .replace(/^[\s-]+|[\s-]+$/g, '')            // 先頭・末尾の空白やハイフンを除去
      .trim();
  }
  
  // できごと（歴史的な出来事）を抽出
  const eventsMatch = content.match(/== できごと ==([\s\S]*?)(?=== [^=]|$)/);
  if (eventsMatch) {
    const eventLines = eventsMatch[1].split('\n');
    for (const line of eventLines) {
      // より柔軟な年の表現に対応
      const match = line.match(/^\*\s*(?:\[\[)?(紀元前?\d+年?|\d+年?)(?:\]\])?\s*-?\s*(.+?)(?:\.\s*$|$)/);
      if (match && match[2]) {
        const year = match[1];
        let event = cleanText(match[2]);
        
        // 画像や複雑なテンプレート行をスキップ
        if (event && !event.includes('Image:') && 
            !event.includes('File:') && 
            !event.includes('multiple image') &&
            !event.includes('{{') &&
            event.length > 10 && event.length < 150) {
          info.events.push(`${year}: ${event}`);
        }
      }
    }
  }
  
  // 誕生日を抽出（誕生または誕生日セクション）
  const birthsMatch = content.match(/== 誕生(?:日)? ==([\s\S]*?)(?=== [^=]|$)/);
  if (birthsMatch) {
    const birthLines = birthsMatch[1].split('\n');
    for (const line of birthLines) {
      const match = line.match(/^\*\s*(?:\[\[)?(\d+年?)(?:\]\])?\s*-?\s*(.+?)(?:、(.+?))?(?:\(\+|（\+|$)/);
      if (match && match[2]) {
        const year = match[1];
        let person = cleanText(match[2]);
        let occupation = match[3] ? cleanText(match[3]) : '';
        
        if (person && person.length > 1 && person.length < 50) {
          const personInfo = occupation ? `${person}（${occupation}）` : person;
          info.births.push(`${year}: ${personInfo}`);
        }
      }
    }
  }
  
  // 忌日を抽出
  const deathsMatch = content.match(/== 忌日 ==([\s\S]*?)(?=== [^=]|$)/);
  if (deathsMatch) {
    // 「=== 人物 ===」セクションを取得
    const personSection = deathsMatch[1].match(/=== 人物 ===([\s\S]*?)(?:=== |$)/);
    const deathLines = (personSection ? personSection[1] : deathsMatch[1]).split('\n');
    
    for (const line of deathLines) {
      const match = line.match(/^\*\s*(?:\[\[)?(\d+年?)(?:\]\])?\s*-?\s*(.+?)(?:、(.+?))?(?:\(\*|（\*|$)/);
      if (match && match[2]) {
        const year = match[1];
        let person = cleanText(match[2]);
        let occupation = match[3] ? cleanText(match[3]) : '';
        
        if (person && person.length > 1 && person.length < 50) {
          const personInfo = occupation ? `${person}（${occupation}）` : person;
          info.deaths.push(`${year}: ${personInfo}`);
        }
      }
    }
  }
  
  Logger.log(`Parsed info: ${info.events.length} events, ${info.births.length} births, ${info.deaths.length} deaths`);
  return info;
}

/**
 * Slack投稿用のメッセージを整形
 */
function formatSlackMessage(info: TodayInfo): string {
  let message = `📅 *今日は何の日？* - ${info.date}\n\n`;
 
  if (info.events.length > 0) {
    message += '🏛️ *歴史的な出来事*\n';
    // 最大5件まで表示
    const eventsToShow = info.events.slice(0, 5);
    for (const event of eventsToShow) {
      message += `• ${event}\n`;
    }
    message += '\n';
  }
  
  if (info.births.length > 0) {
    message += '🎂 *誕生日*\n';
    // 最大5件まで表示
    const birthsToShow = info.births.slice(0, 5);
    for (const birth of birthsToShow) {
      message += `• ${birth}\n`;
    }
    message += '\n';
  }
  
  if (info.deaths.length > 0) {
    message += '🙏 *忌日*\n';
    // 最大3件まで表示
    const deathsToShow = info.deaths.slice(0, 3);
    for (const death of deathsToShow) {
      message += `• ${death}\n`;
    }
    message += '\n';
  }
  
  message += `\n_Powered by Wikipedia_`;
  
  return message;
}

/**
 * Slackにメッセージを投稿
 */
function postToSlack(message: string): void {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL');
  
  if (!webhookUrl) {
    Logger.log('SLACK_WEBHOOK_URL is not set in Script Properties');
    throw new Error('SLACK_WEBHOOK_URL is not configured');
  }
  
  const payload = {
    text: message,
    username: '今日は何の日Bot',
    icon_emoji: ':calendar:'
  };
  
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post' as GoogleAppsScript.URL_Fetch.HttpMethod,
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(webhookUrl, options);
    Logger.log(`Slack response: ${response.getResponseCode()}`);
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Slack API error: ${response.getContentText()}`);
    }
  } catch (error) {
    Logger.log(`Error posting to Slack: ${error}`);
    throw error;
  }
}

/**
 * メイン実行関数（毎朝実行される）
 */
function main(): void {
  Logger.log('Starting "今日は何の日" bot execution...');
  
  try {
    const todayInfo = fetchTodayInfo();
    
    if (!todayInfo) {
      Logger.log('Could not fetch today\'s information');
      return;
    }
    
    const message = formatSlackMessage(todayInfo);
    Logger.log(`Formatted message: ${message}`);
    
    postToSlack(message);
    Logger.log('Successfully posted to Slack');
    
  } catch (error) {
    Logger.log(`Error in main execution: ${error}`);
    
    // エラー時の簡単なメッセージを送信
    try {
      postToSlack(`❗ 今日は何の日Botでエラーが発生しました: ${error}`);
    } catch (slackError) {
      Logger.log(`Error posting error message to Slack: ${slackError}`);
    }
  }
}

/**
 * 手動テスト用関数
 */
function testBot(): void {
  Logger.log('Testing the bot...');
  main();
}

/**
 * 初期設定用関数（初回実行時に呼び出す）
 */
function setupSlackWebhook(): void {
  // スクリプトプロパティにSlack Webhook URLを設定する必要があります
  // Google Apps Scriptの画面で以下を実行:
  // PropertiesService.getScriptProperties().setProperty('SLACK_WEBHOOK_URL', 'YOUR_WEBHOOK_URL_HERE');
  
  Logger.log('Please set SLACK_WEBHOOK_URL in Script Properties');
  Logger.log('Go to: Extensions > Apps Script > Settings > Script Properties');
  Logger.log('Add property: SLACK_WEBHOOK_URL = your_slack_webhook_url');
}
