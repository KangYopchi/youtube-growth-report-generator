/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChannelInfo {
  id: string;
  title: string;
  description: string;
  customUrl: string;
  publishedAt: string;
  thumbnail: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  country: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface ChannelTimeSeriesEntry {
  day: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  subscribersGained: number;
  subscribersLost: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface VideoPerformanceEntry {
  videoId: string;
  title?: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  averageViewPercentage?: number;
  subscribersGained: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface TrafficSourceEntry {
  source: string;
  views: number;
  estimatedMinutesWatched: number;
}

export interface SearchTermEntry {
  term: string;
  views: number;
}

export interface DemographicsEntry {
  ageGroup: string;
  gender: string;
  viewerPercentage: number;
}

export interface AnalyticsData {
  timeSeries?: ChannelTimeSeriesEntry[];
  videoPerformance?: VideoPerformanceEntry[];
  trafficSources?: TrafficSourceEntry[];
  searchTerms?: SearchTermEntry[];
  demographics?: DemographicsEntry[];
}

export interface AnalysisPayload {
  channelUrl: string;
  geminiApiKey: string;
  youtubeApiKey: string;
  youtubeAccessToken?: string;
  analysisPeriod: '28d' | '90d' | '365d' | 'lifetime';
}

export interface AnalysisResult {
  channel: ChannelInfo;
  videos: VideoInfo[];
  analytics?: AnalyticsData;
  report: string; // Markdown formatted Korean text
  analysisPeriod: string;
  success: boolean;
  error?: string;
}
