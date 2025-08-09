/**
 * 設定とユーティリティ関数
 */

export interface SlackConfig {
  webhookUrl: string;
  username?: string;
  iconEmoji?: string;
  channel?: string;
}

export interface BotConfig {
  maxEventsToShow: number;
  maxBirthsToShow: number;
  maxDeathsToShow: number;
  includeEvents: boolean;
  includeBirths: boolean;
  includeDeaths: boolean;
}

/**
 * デフォルト設定
 */
export const DEFAULT_BOT_CONFIG: BotConfig = {
  maxEventsToShow: 5,
  maxBirthsToShow: 5,
  maxDeathsToShow: 3,
  includeEvents: true,
  includeBirths: true,
  includeDeaths: true
};

/**
 * スクリプトプロパティから設定を取得
 */
export function getSlackConfig(): SlackConfig {
  const properties = PropertiesService.getScriptProperties();
  const webhookUrl = properties.getProperty('SLACK_WEBHOOK_URL');
  
  if (!webhookUrl) {
    throw new Error('SLACK_WEBHOOK_URL is not configured in Script Properties');
  }
  
  return {
    webhookUrl,
    username: properties.getProperty('SLACK_USERNAME') || '今日は何の日Bot',
    iconEmoji: properties.getProperty('SLACK_ICON_EMOJI') || ':calendar:',
    channel: properties.getProperty('SLACK_CHANNEL') || undefined
  };
}

/**
 * Bot設定を取得（カスタマイズ可能）
 */
export function getBotConfig(): BotConfig {
  const properties = PropertiesService.getScriptProperties();
  
  return {
    maxEventsToShow: parseInt(properties.getProperty('MAX_EVENTS') || '5'),
    maxBirthsToShow: parseInt(properties.getProperty('MAX_BIRTHS') || '5'),
    maxDeathsToShow: parseInt(properties.getProperty('MAX_DEATHS') || '3'),
    includeEvents: properties.getProperty('INCLUDE_EVENTS') !== 'false',
    includeBirths: properties.getProperty('INCLUDE_BIRTHS') !== 'false',
    includeDeaths: properties.getProperty('INCLUDE_DEATHS') !== 'false'
  };
}
