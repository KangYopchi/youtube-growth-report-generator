/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Increase payload size support
app.use(express.json({ limit: '10mb' }));

// Configuration constants for easily adjustable parameters
const CONFIG = {
  DEFAULT_VIDEOS_FETCH_LIMIT: 50,
  DEFAULT_ANALYSIS_PERIOD: '90d',
  GEMINI_MODEL_NAME: 'gemini-3.5-flash',
};

/**
 * Normalizes and extracts channel identifier and resolution type from YouTube URL or raw input
 */
function parseYoutubeInput(input: string): { type: 'id' | 'handle' | 'user' | 'unknown'; value: string } {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return { type: 'unknown', value: '' };
  }

  // Check if it's a direct URL
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const pathname = url.pathname;

      // Case 1: https://www.youtube.com/channel/UCabc123...
      const channelMatch = pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
      if (channelMatch) {
        return { type: 'id', value: channelMatch[1] };
      }

      // Case 2: https://www.youtube.com/@somehandle
      const handleMatch = pathname.match(/\/(c\/)?(@[a-zA-Z0-9_.-]+)/);
      if (handleMatch) {
        // Exclude static words like @about, @videos if any, but regular handles are fine
        return { type: 'handle', value: handleMatch[2] };
      }

      // Case 3: https://www.youtube.com/user/someworld
      const userMatch = pathname.match(/\/user\/([a-zA-Z0-9_.-]+)/);
      if (userMatch) {
         return { type: 'user', value: userMatch[1] };
      }
      
      // Case 4: Any other path item starting with @ (e.g. /@myname)
      const parts = pathname.split('/').filter(p => p.startsWith('@'));
      if (parts.length > 0) {
        return { type: 'handle', value: parts[0] };
      }
    }
  } catch (e) {
    // URL parsing failed, treat as raw identifier
  }

  // Handle raw string input direct check
  if (trimmed.startsWith('UC') && trimmed.length === 24) {
    return { type: 'id', value: trimmed };
  } else if (trimmed.startsWith('@')) {
    return { type: 'handle', value: trimmed };
  }

  // Guessing default handle if it looks like username or user input
  if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return { type: 'handle', value: '@' + trimmed };
  }

  return { type: 'unknown', value: trimmed };
}

/**
 * Custom dates helper in YYYY-MM-DD
 */
function getDateRange(period: string, channelPublishedAt?: string): { startDate: string; endDate: string } {
  const end = new Date();
  const endDate = end.toISOString().split('T')[0];
  
  const start = new Date();
  if (period === '28d') {
    start.setDate(end.getDate() - 28);
  } else if (period === '365d') {
    start.setDate(end.getDate() - 365);
  } else if (period === 'lifetime') {
    if (channelPublishedAt) {
      return { startDate: channelPublishedAt.split('T')[0], endDate };
    } else {
      start.setFullYear(end.getFullYear() - 10);
    }
  } else {
    // Default to '90d'
    start.setDate(end.getDate() - 90);
  }
  
  const startDate = start.toISOString().split('T')[0];
  return { startDate, endDate };
}

// REST endpoints
app.post('/api/analyze', async (req, res) => {
  const { channelUrl, geminiApiKey, youtubeApiKey, youtubeAccessToken, analysisPeriod } = req.body;

  // Validation
  if (!channelUrl) {
    return res.status(400).json({ success: false, error: '유튜브 채널 URL 또는 식별자를 입력해주세요.' });
  }
  if (!youtubeApiKey) {
    return res.status(400).json({ success: false, error: 'YouTube Data API Key는 필수 입력 항목입니다.' });
  }
  if (!geminiApiKey) {
    return res.status(400).json({ success: false, error: 'Gemini API Key는 필수 입력 항목입니다.' });
  }

  const periodId = analysisPeriod || CONFIG.DEFAULT_ANALYSIS_PERIOD;
  const parsed = parseYoutubeInput(channelUrl);
  
  if (parsed.type === 'unknown' || !parsed.value) {
    return res.status(400).json({ success: false, error: '유효하지 않은 유튜브 채널 주소 형식입니다. 형식 예: https://www.youtube.com/@채널명 또는 채널 ID (UC...)' });
  }

  try {
    console.log(`Analyzing Youtube API. Resolver Input: type=${parsed.type}, value=${parsed.value}`);
    
    // 1. Fetch channel details from YouTube Data API v3
    let channelUrlApi = '';
    if (parsed.type === 'id') {
      channelUrlApi = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${parsed.value}&key=${youtubeApiKey}`;
    } else if (parsed.type === 'handle') {
      channelUrlApi = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forHandle=${parsed.value}&key=${youtubeApiKey}`;
    } else {
      channelUrlApi = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forUsername=${parsed.value}&key=${youtubeApiKey}`;
    }

    const channelRes = await fetch(channelUrlApi);
    if (!channelRes.ok) {
      const errorText = await channelRes.text();
      console.error('YouTube Channel API Error:', errorText);
      throw new Error('유튜브 채널 정보를 가져오는 도중 오류가 발생했습니다. YouTube Data API Key를 확인해 주세요.');
    }

    const channelData = await channelRes.json();
    if (!channelData.items || channelData.items.length === 0) {
      // If handle resolution failed without @, let's try handle with `@` logic as fallback
      if (parsed.type === 'handle' && !parsed.value.startsWith('@')) {
        const retryRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forHandle=%40${parsed.value}&key=${youtubeApiKey}`);
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          if (retryData.items && retryData.items.length > 0) {
            channelData.items = retryData.items;
          }
        }
      }
      
      if (!channelData.items || channelData.items.length === 0) {
        throw new Error('입력하신 정보로 유튜브 채널을 찾을 수 없습니다. 올바른 URL이나 핸들(@이름)을 입력하셨는지 확인해 주세요.');
      }
    }

    const channelItem = channelData.items[0];
    const channelId = channelItem.id;
    const channelInfo = {
      id: channelId,
      title: channelItem.snippet.title,
      description: channelItem.snippet.description || '',
      customUrl: channelItem.snippet.customUrl || '',
      publishedAt: channelItem.snippet.publishedAt,
      thumbnail: channelItem.snippet.thumbnails?.medium?.url || channelItem.snippet.thumbnails?.default?.url || '',
      subscriberCount: parseInt(channelItem.statistics?.subscriberCount || '0'),
      viewCount: parseInt(channelItem.statistics?.viewCount || '0'),
      videoCount: parseInt(channelItem.statistics?.videoCount || '0'),
      country: channelItem.snippet.country || 'N/A',
    };

    // 2. Fetch recent videos from current channel
    const uploadsPlaylistId = channelItem.contentDetails?.relatedPlaylists?.uploads;
    let videos: any[] = [];
    
    if (uploadsPlaylistId) {
      // Fetch PlaylistItems from Upload playlist
      const playlistItemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${CONFIG.DEFAULT_VIDEOS_FETCH_LIMIT}&key=${youtubeApiKey}`;
      const playlistRes = await fetch(playlistItemsUrl);
      if (playlistRes.ok) {
        const playlistData = await playlistRes.json();
        const playlistItems = playlistData.items || [];
        
        if (playlistItems.length > 0) {
          const videoIds = playlistItems.map((item: any) => item.contentDetails?.videoId).filter(Boolean);
          
          // Chunk call to get real stats
          const videosStatsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}&key=${youtubeApiKey}`;
          const videosStatsRes = await fetch(videosStatsUrl);
          if (videosStatsRes.ok) {
            const videosData = await videosStatsRes.json();
            videos = (videosData.items || []).map((item: any) => ({
              id: item.id,
              title: item.snippet.title,
              publishedAt: item.snippet.publishedAt,
              thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
              viewCount: parseInt(item.statistics?.viewCount || '0'),
              likeCount: parseInt(item.statistics?.likeCount || '0'),
              commentCount: parseInt(item.statistics?.commentCount || '0'),
            }));
          }
        }
      }
    }

    // 3. Optional: YouTube Analytics API calls
    let analyticsData: any = null;
    let analyticsWarning: string | null = null;

    if (youtubeAccessToken) {
      try {
        console.log('Querying YouTube Analytics API...');
        const { startDate, endDate } = getDateRange(periodId, channelInfo.publishedAt);
        const headers = { Authorization: `Bearer ${youtubeAccessToken}` };

        // Query 3.1: Daily time series
        const reportUrl1 = `https://youtubeanalytics.googleapis.com/v1/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares&dimensions=day&sort=day`;
        const rep1Response = await fetch(reportUrl1, { headers });
        let timeSeries: any[] = [];
        
        if (rep1Response.ok) {
          const rep1Data = await rep1Response.json();
          const headersList = (rep1Data.columnHeaders || []).map((h: any) => h.name);
          const rows = rep1Data.rows || [];
          
          timeSeries = rows.map((row: any[]) => {
            const entry: any = {};
            headersList.forEach((header: string, index: number) => {
              entry[header] = row[index];
            });
            return {
              day: entry.day,
              views: Number(entry.views || 0),
              estimatedMinutesWatched: Number(entry.estimatedMinutesWatched || 0),
              averageViewDuration: Number(entry.averageViewDuration || 0),
              subscribersGained: Number(entry.subscribersGained || 0),
              subscribersLost: Number(entry.subscribersLost || 0),
              likes: Number(entry.likes || 0),
              comments: Number(entry.comments || 0),
              shares: Number(entry.shares || 0),
            };
          });
        } else {
          const errText = await rep1Response.text();
          console.warn('Analytics report 1 (Daily series) failed:', errText);
        }

        // Query 3.2: Video-level metrics
        const reportUrl2 = `https://youtubeanalytics.googleapis.com/v1/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained,likes,comments,shares&dimensions=video&maxResults=30&sort=-views`;
        const rep2Response = await fetch(reportUrl2, { headers });
        let videoPerformance: any[] = [];
        
        if (rep2Response.ok) {
          const rep2Data = await rep2Response.json();
          const headersList = (rep2Data.columnHeaders || []).map((h: any) => h.name);
          const rows = rep2Data.rows || [];
          
          videoPerformance = rows.map((row: any[]) => {
            const entry: any = {};
            headersList.forEach((header: string, index: number) => {
              entry[header] = row[index];
            });
            return {
              videoId: entry.video,
              views: Number(entry.views || 0),
              estimatedMinutesWatched: Number(entry.estimatedMinutesWatched || 0),
              averageViewDuration: Number(entry.averageViewDuration || 0),
              subscribersGained: Number(entry.subscribersGained || 0),
              likes: Number(entry.likes || 0),
              comments: Number(entry.comments || 0),
              shares: Number(entry.shares || 0),
            };
          });

          // Match names to video ids
          videoPerformance = videoPerformance.map(item => {
            const matchedVideo = videos.find(v => v.id === item.videoId);
            return {
              ...item,
              title: matchedVideo ? matchedVideo.title : 'External/Older Video',
            };
          });
        }

        // Query 3.3: Traffic source distribution
        const reportUrl3 = `https://youtubeanalytics.googleapis.com/v1/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=views,estimatedMinutesWatched&dimensions=insightTrafficSourceType&sort=-views`;
        const rep3Response = await fetch(reportUrl3, { headers });
        let trafficSources: any[] = [];
        
        if (rep3Response.ok) {
          const rep3Data = await rep3Response.json();
          trafficSources = (rep3Data.rows || []).map((row: any[]) => ({
            source: row[0],
            views: Number(row[1] || 0),
            estimatedMinutesWatched: Number(row[2] || 0),
          }));
        }

        // Query 3.4: Search terms details (YT_SEARCH)
        const reportUrl4 = `https://youtubeanalytics.googleapis.com/v1/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=views&dimensions=insightTrafficSourceDetail&filters=insightTrafficSourceType==YT_SEARCH&maxResults=20&sort=-views`;
        const rep4Response = await fetch(reportUrl4, { headers });
        let searchTerms: any[] = [];
        
        if (rep4Response.ok) {
          const rep4Data = await rep4Response.json();
          searchTerms = (rep4Data.rows || []).map((row: any[]) => ({
            term: row[0],
            views: Number(row[1] || 0),
          }));
        }

        // Query 3.5: Demographics
        const reportUrl5 = `https://youtubeanalytics.googleapis.com/v1/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=viewerPercentage&dimensions=ageGroup,gender&sort=gender,ageGroup`;
        const rep5Response = await fetch(reportUrl5, { headers });
        let demographics: any[] = [];
        
        if (rep5Response.ok) {
          const rep5Data = await rep5Response.json();
          demographics = (rep5Data.rows || []).map((row: any[]) => ({
            ageGroup: row[0],
            gender: row[1],
            viewerPercentage: Number(row[2] || 0),
          }));
        }

        analyticsData = {
          timeSeries: timeSeries.length > 0 ? timeSeries : undefined,
          videoPerformance: videoPerformance.length > 0 ? videoPerformance : undefined,
          trafficSources: trafficSources.length > 0 ? trafficSources : undefined,
          searchTerms: searchTerms.length > 0 ? searchTerms : undefined,
          demographics: demographics.length > 0 ? demographics : undefined,
        };

        if (!analyticsData.timeSeries && !analyticsData.videoPerformance) {
          analyticsWarning = '유튜브 애널리틱스 API 데이터 호출 권한이 부족하거나 해당 기간 데이터가 부족하여 기본 스탯 데이터로 전환해 처리되었습니다.';
        }
      } catch (analyticsErr: any) {
        console.error('Failed to grab Analytics details:', analyticsErr);
        analyticsWarning = `YouTube 애널리틱스 데이터를 불러오는 중 실패했습니다: ${analyticsErr.message}. 기본 데이터셋만 활용합니다.`;
      }
    }

    // 4. Preprocess Data for Gemini
    // Calculate simple stats from items
    const totalViewsOnFetched = videos.reduce((acc, current) => acc + current.viewCount, 0);
    const avgViewsOnFetched = videos.length > 0 ? totalViewsOnFetched / videos.length : 0;
    
    // Find best and worst performing videos in the client details
    const sortedByViews = [...videos].sort((a, b) => b.viewCount - a.viewCount);
    const topVideos = sortedByViews.slice(0, 5).map(v => ({ title: v.title, views: v.viewCount, likes: v.likeCount, comments: v.commentCount }));
    const bottomVideos = sortedByViews.slice(-5).reverse().map(v => ({ title: v.title, views: v.viewCount, likes: v.likeCount, comments: v.commentCount }));

    const metricsSummary = {
      channelTitle: channelInfo.title,
      description: channelInfo.description,
      totalSubscribers: channelInfo.subscriberCount,
      totalViews: channelInfo.viewCount,
      totalVideos: channelInfo.videoCount,
      country: channelInfo.country,
      publishedAt: channelInfo.publishedAt,
      analysisPeriodSelected: periodId,
      avgViewsRecentVideos: Math.round(avgViewsOnFetched),
      topRecentVideos: topVideos,
      bottomRecentVideos: bottomVideos,
      analyticsData: analyticsData ? {
        trafficSourcesSummary: analyticsData.trafficSources ? analyticsData.trafficSources.slice(0, 5) : 'N/A',
        topSearchTermsSummary: analyticsData.searchTerms ? analyticsData.searchTerms.slice(0, 8) : 'N/A',
        demographicsSummary: analyticsData.demographics ? analyticsData.demographics.slice(0, 8) : 'N/A',
        timeSeriesDataKPIs: analyticsData.timeSeries ? {
          totalViewsInPeriod: analyticsData.timeSeries.reduce((acc: number, entry: any) => acc + entry.views, 0),
          totalMinutesWatched: analyticsData.timeSeries.reduce((acc: number, entry: any) => acc + entry.estimatedMinutesWatched, 0),
          netSubscribersGained: analyticsData.timeSeries.reduce((acc: number, entry: any) => acc + (entry.subscribersGained - entry.subscribersLost), 0),
        } : 'N/A'
      } : '기본 API 연동만 수행됨 (상세 애널리틱스 비인증)'
    };

    // 5. Query Gemini with aggregated JSON Context
    console.log('Sending aggregated metric schema to Gemini API...');
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const userPrompt = `
역할: 유튜브 성장 및 콘텐츠 전략 수석 전문가 (YouTube growth and content strategy expert)
목적: 아래의 실시간 유튜브 보드 통계 데이터를 면밀히 분석하고, 채널 성장에 필요한 구체적이고 바로 적용 가능한 핵심 전략 제안서인 “YouTube Growth Report”를 작성해주세요.

주의 사항 및 언어 요구사항:
- 모든 분석과 보고서는 매우 전문적이고 명확하며 세련된 한국어(Korean)로 작성되어야 합니다.
- 한국어를 사용하는 크리에이터나 채널 담당자가 곧바로 이해하고 즉각 실행할 수 있도록 실용적이고 액션 지향적인 어조(톤과 매너)를 유지하세요.

제공 데이터 (유튜브 채널 메트릭스 및 실적 정보 JSON):
${JSON.stringify(metricsSummary, null, 2)}

상세 분석 및 제안 요청 사항:
다음의 형식적 대분류 기호를 사용하여 각 전용 섹션을 심도 있게 발전시키고 생성해 주세요.

## EXECUTIVE SUMMARY
- 이 채널의 현재 종합 상태에 대한 요약과 전략적 전개 핵심 방향 요약.
- 크리에이터가 즉시 알아야 하는 시급한 문제 또는 성과 하이라이트 요약.

## CHANNEL OVERVIEW (KPI Snapshot)
- 채널의 기초 체력 진단 (지표 분석): 구독자 수 대비 영상 수, 최근 업로드 빈도, 전체 누적 조회수 추이 진단.
- 현재 채널의 긍정적인 신호와 성과 약점.
- 핵심 성과 지표(KPI) 테이블 양식 또는 가시성 있는 대푯값 분석을 통한 현재 레벨 평가.

## CONTENT & VIDEO PERFORMANCE INSIGHTS
- 가장 실적이 조율이 잘 된 최우수 비디오 비결 분석 (썸네일 카피라이팅, 제목, 핵심 키워드 유추 등).
- 미흡한 조회수를 달성한 비디오들의 문제점 진단 (피해야 할 타이틀, 개선점 및 리디렉션 제어 제언).
- 시청자들이 선호하는 콘텐츠 카테고리와, 즉시 반복 생산해야 하는 포맷 유형 제시.

## TRAFFIC, SEARCH, & AUDIENCE INSIGHTS
- 유입 경로 및 타겟 분석 (만약 추가 애널리틱스 데이터가 제공되었다면 분석하고, 그렇지 않다면 카테고리를 추측하여 타겟팅 작성).
- 강력한 유입이 일어나고 있는 검색어들을 바탕으로 한 키워드 최적화 제안.
- 주 시청자 인구 통계 데이터(성별, 연령대)를 고려한 콘텐츠 어조, 스타일, 연출 방향 조언.

## PROBLEMS & RISKS
- 현재 성장의 병목 현상 및 정체 요인 분석 (예: 낮은 조회율, 이탈률, 업로드 패턴 등).
- 채널의 유지관리 단계에서 제거해 나가야 할 구조적/내용적 위험 요소 분석.

## GROWTH STRATEGY & ACTION PLAN (향후 4-8주 실행 프로세스)
- 구체적인 채널 레벨업 성장을 위한 3단계 마스터 로드맵.
- 타겟 시청자를 사로잡을 수 있는 참신한 신규 콘텐츠 기획안/아이디어 3가지 (구체적인 제목 및 썸네일 컨셉카피 제안 포함).
- 향후 4-8주간 각 주차별(예: 1-2주차, 3-4주차, 5-6주차, 7-8주차) 크리에이터가 일별/주별 완료해야 하는 '체크리스트 기반 실행 가이드라인'.

자유롭고 정형화되지 않은 템플릿보다, 데이터 수치에 정확히 기반하여 한 단계 전문성을 높인 구체적이고 인사이트 가득한 제안서 리포트를 작성해 주십시오. 
`;

    const geminiRes = await ai.models.generateContent({
      model: CONFIG.GEMINI_MODEL_NAME,
      contents: userPrompt,
    });

    const markdownText = geminiRes.text || '성장 리포트 생성에 실패했습니다. AI 호출 값을 읽을 수 없습니다.';

    // 6. Return response
    return res.status(200).json({
      success: true,
      channel: channelInfo,
      videos: videos,
      analytics: analyticsData || undefined,
      report: markdownText,
      analysisPeriod: periodId === '28d' ? '최근 28일' : periodId === '90d' ? '최근 90일' : periodId === '365d' ? '최근 365일' : '전체 기간(Lifetime)',
      warning: analyticsWarning || undefined,
    });

  } catch (error: any) {
    console.error('API Server Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '리포트 요청을 처리하는 동안 내부 서버 오류가 발생했습니다.'
    });
  }
});


// Serve static Vite files or handle development routing
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: any, res: any) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
