/**
 * 今日は何の日をSlackに投稿するGoogle Apps Script
 * php.co.jpのデータを使用
 */

interface TodayInfo {
  date: string;
  events: string[];        // 記念日・行事・お祭り（php.co.jp）
  historical: string[];    // 歴史上の出来事（Wikipedia）
  births: string[];        // 今日の誕生日（Wikipedia）
  birthFlower?: string;    // 誕生花（whatistoday.cyou）
}

interface WikipediaResponse {
  query: {
    pages: {
      [key: string]: {
        pageid: number;
        title: string;
        revisions: Array<{
          contentformat: string;
          contentmodel: string;
          '*'?: string;
          slots?: {
            main: {
              '*': string;
            };
          };
        }>;
      };
    };
  };
}

/**
 * 今日の日付から月日の文字列を取得（MM-DD形式）
 */
function getTodayDateString(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${month}-${day}`;
}

/**
 * 表示用の日付文字列を取得（M月D日形式）
 */
function getTodayDisplayString(): string {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  return `${month}月${day}日`;
}

/**
 * 誕生花の情報をwhatistoday.cyou APIから取得
 */
function fetchBirthFlower(): string | null {
  const dateString = getTodayDateString().replace('-', ''); // MMDD形式に変換
  const url = `https://api.whatistoday.cyou/v3/birthflower/${dateString}`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    
    Logger.log(`Fetched birth flower data from: ${url}`);
    
    // APIレスポンスから誕生花情報を抽出
    if (data && data.flower) {
      return data.flower;
    }
    
    return null;
  } catch (error) {
    Logger.log(`Error fetching birth flower data: ${error}`);
    return null;
  }
}

/**
 * WikipediaのAPIから今日の情報を取得
 */
function fetchWikipediaInfo(): { historical: string[]; births: string[] } {
  const dateString = getTodayDisplayString(); // M月D日形式
  const url = `https://ja.wikipedia.org/w/api.php?format=json&action=query&prop=revisions&rvprop=content&rvslots=*&titles=${encodeURIComponent(dateString)}`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    
    Logger.log(`Fetched Wikipedia data from: ${url}`);
    
    const pages = data.query.pages;
    const pageKey = Object.keys(pages)[0];
    
    if (pageKey === '-1' || !pages[pageKey].revisions) {
      Logger.log(`Wikipedia page not found for ${dateString}`);
      return { historical: [], births: [] };
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
      return { historical: [], births: [] };
    }
    
    return parseWikipediaContent(content);
  } catch (error) {
    Logger.log(`Error fetching Wikipedia data: ${error}`);
    return { historical: [], births: [] };
  }
}

/**
 * Wikipediaのページ内容を解析して歴史的出来事と誕生日を抽出
 */
function parseWikipediaContent(content: string): { historical: string[]; births: string[] } {
  const result = { historical: [] as string[], births: [] as string[] };
  
  // WikitextのリンクやHTML要素を除去するヘルパー関数
  function cleanWikiText(text: string): string {
    return text
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')  // [[リンク|表示テキスト]] → 表示テキスト
      .replace(/\[\[([^\]]+)\]\]/g, '$1')          // [[リンク]] → リンク
      .replace(/\{\{[^}]+\}\}/g, '')               // {{テンプレート}} を除去
      .replace(/<[^>]+>/g, '')                     // HTMLタグを除去
      .replace(/\([^)]*\*[^)]*\)/g, '')            // (* を含む括弧を除去
      .replace(/^[\s-]+|[\s-]+$/g, '')            // 先頭・末尾の空白やハイフンを除去
      .trim();
  }
  
  try {
    // できごと（歴史的な出来事）を抽出
    const eventsMatch = content.match(/== できごと ==([\s\S]*?)(?=== [^=]|$)/);
    if (eventsMatch) {
      const eventLines = eventsMatch[1].split('\n');
      for (const line of eventLines) {
        const match = line.match(/^\*\s*(?:\[\[)?(紀元前?\d+年?|\d+年?)(?:\]\])?\s*-?\s*(.+?)(?:\.\s*$|$)/);
        if (match && match[2]) {
          const year = match[1];
          let event = cleanWikiText(match[2]);
          
          // 画像や複雑なテンプレート行をスキップ
          if (event && !event.includes('Image:') && 
              !event.includes('File:') && 
              !event.includes('multiple image') &&
              !event.includes('{{') &&
              event.length > 10 && event.length < 150) {
            result.historical.push(`${year}: ${event}`);
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
          let person = cleanWikiText(match[2]);
          let occupation = match[3] ? cleanWikiText(match[3]) : '';
          
          if (person && person.length > 1 && person.length < 50) {
            const personInfo = occupation ? `${person}（${occupation}）` : person;
            result.births.push(`${year}: ${personInfo}`);
          }
        }
      }
    }
  } catch (error) {
    Logger.log(`Error parsing Wikipedia content: ${error}`);
  }
  
  return result;
}

/**
 * 配列からランダムに指定された数の要素を抽出
 */
function getRandomItems<T>(array: T[], count: number): T[] {
  if (array.length <= count) {
    return array;
  }
  
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, count);
}

/**
 * 年代情報を含む項目を時系列順にソート
 * 形式: "YYYY年: 内容" または "紀元前YYYY年: 内容"
 */
function sortByYear(items: string[]): string[] {
  return items.sort((a, b) => {
    // 年代部分を抽出する関数
    function extractYear(item: string): number {
      const bcMatch = item.match(/^紀元前(\d+)年?:/);
      if (bcMatch) {
        return -parseInt(bcMatch[1]); // 紀元前は負の数値として扱う
      }
      
      const adMatch = item.match(/^(\d+)年?:/);
      if (adMatch) {
        return parseInt(adMatch[1]);
      }
      
      return 0; // 年代が抽出できない場合は0とする
    }
    
    const yearA = extractYear(a);
    const yearB = extractYear(b);
    
    return yearA - yearB; // 昇順（古い順）にソート
  });
}

/**
 * 今日は何の日の情報をすべてのソースから取得
 */
function fetchTodayInfo(): TodayInfo | null {
  const dateString = getTodayDateString(); // MM-DD形式
  const displayString = getTodayDisplayString(); // M月D日形式
  
  try {
    // php.co.jpから記念日・行事・お祭り情報を取得
    const phpUrl = `https://www.php.co.jp/fun/today/${dateString}.php`;
    const phpResponse = UrlFetchApp.fetch(phpUrl);
    const htmlContent = phpResponse.getContentText();
    
    Logger.log(`Fetched PHP data from: ${phpUrl}`);
    
    // php.co.jpのデータを解析
    const phpInfo = parsePhpTodayInfo(displayString, htmlContent);
    
    // Wikipediaから歴史的出来事と誕生日情報を取得
    const wikiInfo = fetchWikipediaInfo();
    
    // 誕生花の情報を取得
    const birthFlower = fetchBirthFlower();
    
    // ランダムに抽出してから時系列順にソート
    const randomHistorical = getRandomItems(wikiInfo.historical, 5);
    const randomBirths = getRandomItems(wikiInfo.births, 5);
    
    // すべての情報を統合
    const todayInfo: TodayInfo = {
      date: displayString,
      events: phpInfo.events,
      historical: sortByYear(randomHistorical), // ランダム抽出後に時系列ソート
      births: sortByYear(randomBirths),         // ランダム抽出後に時系列ソート
      birthFlower: birthFlower || undefined
    };
    
    return todayInfo;
  } catch (error) {
    Logger.log(`Error fetching today's information: ${error}`);
    return null;
  }
}

/**
 * php.co.jpのページ内容を解析して記念日・行事・お祭り情報を抽出
 */
function parsePhpTodayInfo(date: string, htmlContent: string): { events: string[] } {
  const info = { events: [] as string[] };
  
  // HTMLタグを除去し、テキストを整理するヘルパー関数
  function cleanText(text: string): string {
    return text
      .replace(/<!--[\s\S]*?-->/g, '')   // HTMLコメント（完全）を除去
      .replace(/<!--[\s\S]*/g, '')       // HTMLコメント（開始タグのみ）を除去
      .replace(/-->/g, '')               // HTMLコメント（終了タグのみ）を除去
      .replace(/<[^>]+>/g, '')           // HTMLタグを除去
      .replace(/&nbsp;/g, ' ')           // &nbspを空白に
      .replace(/&amp;/g, '&')            // &ampを&に
      .replace(/&lt;/g, '<')             // &ltを<に
      .replace(/&gt;/g, '>')             // &gtを>に
      .replace(/&quot;/g, '"')          // &quotを"に
      .trim();
  }
  
  try {
    // 記念日・行事・お祭りを抽出
    // 実際のデータ: 「●帽子の日（ハットの日）（協同組合東京帽子協会）,●健康ハートの日...」
    const eventsRegex = /記念日・行事・お祭り[\s\S]*?●([\s\S]*?)(?=歴史上の出来事|今日の誕生日|$)/;
    const eventsMatch = htmlContent.match(eventsRegex);
    if (eventsMatch) {
      let eventsText = cleanText(eventsMatch[1]);
      // カンマで区切り、●を含む項目を処理
      const eventItems = eventsText.split(',').filter(item => item.trim().length > 0);
      for (let item of eventItems) {
        item = item.replace(/^●\s*/, '').trim(); // 先頭の●を除去
        if (item.length > 0 && item.length < 100) { // 長すぎる項目を除外
          info.events.push(item);
        }
      }
    }
    
  } catch (error) {
    Logger.log(`Error parsing PHP HTML content: ${error}`);
  }
  
  Logger.log(`Parsed PHP info: ${info.events.length} events`);
  return info;
}

/**
 * Slack投稿用のメッセージを整形
 */
function formatSlackMessage(info: TodayInfo): string {
  let message = `📅 *今日は何の日？* - ${info.date}\n\n`;
 
  if (info.events.length > 0) {
    message += '🎉 *記念日・行事・お祭り*\n';
    // 最大5件まで表示
    const eventsToShow = info.events.slice(0, 5);
    for (const event of eventsToShow) {
      message += `• ${event}\n`;
    }
    message += '\n';
  }
  
  if (info.historical.length > 0) {
    message += '🏛️ *歴史上の出来事*\n';
    // 最大5件まで表示
    const historicalToShow = info.historical.slice(0, 5);
    for (const historical of historicalToShow) {
      message += `• ${historical}\n`;
    }
    message += '\n';
  }
  
  if (info.births.length > 0) {
    message += '🎂 *今日の誕生日*\n';
    // 最大5件まで表示
    const birthsToShow = info.births.slice(0, 5);
    for (const birth of birthsToShow) {
      message += `• ${birth}\n`;
    }
    message += '\n';
  }
  
  if (info.birthFlower) {
    message += '🌸 *誕生花*\n';
    message += `• ${info.birthFlower}\n\n`;
  }
  
  message += `\n_Powered by php.co.jp, Wikipedia & whatistoday.cyou_`;
  
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
 * 誕生花APIのテスト用関数
 */
function testBirthFlowerApi(): void {
  Logger.log('Testing Birth Flower API...');
  
  const birthFlower = fetchBirthFlower();
  if (birthFlower) {
    Logger.log(`Birth flower: ${birthFlower}`);
  } else {
    Logger.log('Failed to fetch birth flower');
  }
}

/**
 * Wikipedia APIのテスト用関数
 */
function testWikipediaApi(): void {
  Logger.log('Testing Wikipedia API...');
  
  const wikiInfo = fetchWikipediaInfo();
  Logger.log(`Historical events found: ${wikiInfo.historical.length}`);
  Logger.log(`Births found: ${wikiInfo.births.length}`);
  
  if (wikiInfo.historical.length > 0) {
    Logger.log('Sample historical events:');
    wikiInfo.historical.slice(0, 3).forEach((event, index) => {
      Logger.log(`  ${index + 1}. ${event}`);
    });
  }
  
  if (wikiInfo.births.length > 0) {
    Logger.log('Sample births:');
    wikiInfo.births.slice(0, 3).forEach((birth, index) => {
      Logger.log(`  ${index + 1}. ${birth}`);
    });
  }
}

/**
 * デバッグ用：HTMLコンテンツの詳細確認
 */
function debugHtmlContent(): void {
  const dateString = getTodayDateString();
  const url = `https://www.php.co.jp/fun/today/${dateString}.php`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const htmlContent = response.getContentText();
    
    Logger.log(`URL: ${url}`);
    Logger.log(`HTML Content length: ${htmlContent.length}`);
    Logger.log('HTML Content preview:');
    Logger.log(htmlContent.substring(0, 2000)); // 最初の2000文字を表示
    
    // HTMLコメントの確認
    const commentMatches = htmlContent.match(/<!--[\s\S]*?-->/g);
    if (commentMatches) {
      Logger.log(`Found ${commentMatches.length} HTML comments:`);
      commentMatches.forEach((comment, index) => {
        Logger.log(`Comment ${index + 1}: ${comment.substring(0, 100)}...`);
      });
    } else {
      Logger.log('No HTML comments found');
    }
    
    // 記念日セクションを検索
    const eventsMatch = htmlContent.match(/記念日・行事・お祭り[\s\S]*?●([^歴史]+)/);
    if (eventsMatch) {
      Logger.log('Events match found:');
      Logger.log(eventsMatch[1]);
    } else {
      Logger.log('Events section not found');
    }
    
    // 歴史的出来事セクションを検索
    const historicalMatch = htmlContent.match(/歴史上の出来事[\s\S]*?▼([^今日]+)/);
    if (historicalMatch) {
      Logger.log('Historical match found:');
      Logger.log(historicalMatch[1]);
    } else {
      Logger.log('Historical section not found');
    }
    
    // 誕生日セクションを検索
    const birthsMatch = htmlContent.match(/今日の誕生日[\s\S]*?▼([^クローズアップ]+)/);
    if (birthsMatch) {
      Logger.log('Births match found:');
      Logger.log(birthsMatch[1]);
    } else {
      Logger.log('Births section not found');
    }
    
  } catch (error) {
    Logger.log(`Debug error: ${error}`);
  }
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
