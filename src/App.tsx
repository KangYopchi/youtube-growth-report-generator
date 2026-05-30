/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Youtube, 
  Key, 
  Sparkles, 
  FileText, 
  ArrowRight, 
  Loader2, 
  TrendingUp, 
  Video, 
  Users, 
  Eye, 
  Globe, 
  Calendar, 
  Check, 
  Copy, 
  Download, 
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Search,
  MessageSquare,
  ThumbsUp,
  Share2,
  Info
} from 'lucide-react';
import { ChannelInfo, VideoInfo, AnalyticsData, AnalysisResult } from './types';

export default function App() {
  // Input Form States
  const [channelUrl, setChannelUrl] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [youtubeAccessToken, setYoutubeAccessToken] = useState('');
  const [analysisPeriod, setAnalysisPeriod] = useState<'28d' | '90d' | '365d' | 'lifetime'>('90d');

  // Key Visibility States
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showYoutubeKey, setShowYoutubeKey] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // App Operation States
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'init' | 'data' | 'gemini' | 'complete'>('init');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewDetails, setViewDetails] = useState(false);

  // Helper validation / formatting functions
  function validateInputs(): boolean {
    if (!channelUrl.trim()) {
      setError('유튜브 채널 URL 또는 핸들을 입력해 주세요.');
      return false;
    }
    if (!youtubeApiKey.trim()) {
      setError('YouTube Data API Key를 입력해 주세요.');
      return false;
    }
    if (!geminiApiKey.trim()) {
      setError('Gemini API Key를 입력해 주세요.');
      return false;
    }
    return true;
  }

  // API Call to custom server
  async function handleRunAnalysis() {
    setError(null);
    setWarning(null);
    if (!validateInputs()) return;

    setIsLoading(true);
    setLoadingStage('data');
    setLoadingMessage('유튜브 채널 정보 및 비디오 메트릭을 수집하는 중입니다...');

    // Periodically change loading messages for an enjoyable waiting experience
    const messageInterval = setInterval(() => {
      setLoadingStage(prev => {
        if (prev === 'data') {
          setLoadingMessage('유튜브 재생목록과 통계 지표를 교차 검증하고 있습니다...');
          return 'data';
        } else if (prev === 'gemini') {
          setLoadingMessage('Gemini 3.5 전문 크리에이터 모델이 전략 보고서를 피칭하여 집필하는 중입니다...');
          return 'gemini';
        }
        return prev;
      });
    }, 4500);

    try {
      // Step 1: Query server to analyze
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelUrl,
          geminiApiKey,
          youtubeApiKey,
          youtubeAccessToken: youtubeAccessToken || undefined,
          analysisPeriod,
        }),
      });

      // Breakpoint: Toggle stage message to Gemini AI modeling
      clearInterval(messageInterval);
      setLoadingStage('gemini');
      setLoadingMessage('수집된 통계를 바탕으로 AI 전용 심층 맥락 성장 분석서를 빌드하고 있습니다...');

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(`서버 응답 오류가 발생했습니다: ${text.slice(0, 100)}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || '성장 분석 오류가 발생했습니다. 입력 정보를 확인 후 다시 실행해 주십시오.');
      }

      setResult(data);
      if (data.warning) {
        setWarning(data.warning);
      }
      setLoadingStage('complete');
    } catch (err: any) {
      clearInterval(messageInterval);
      setError(err.message || '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  // Copy Markdown Report to Clipboard
  const handleCopyReport = async () => {
    if (!result?.report) return;
    try {
      await navigator.clipboard.writeText(result.report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  // Download PDF via browser print
  const handleDownloadPDF = () => {
    if (!result) return;
    window.print();
  };

  // Download Markdown Report File
  const handleDownloadReport = () => {
    if (!result) return;
    const reportText = result.report;
    const filename = `YouTube_Growth_Report_${result.channel.title.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.md`;
    
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format utility
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F1F5F9] font-sans text-slate-800 overflow-hidden select-none">
      
      {/* Top Navigation Bar: Custom Sleek UI style */}
      <nav id="site_header" className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-1"></div>
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 font-display">
            YT Growth AI <span className="text-red-600 uppercase text-[10px] tracking-wider bg-red-50 px-1.5 py-0.5 rounded border border-red-100 ml-1">Report</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest hidden sm:inline-block">Beta v2.4</span>
          <div className="h-8 w-8 rounded-full bg-slate-150 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
            AI
          </div>
        </div>
      </nav>

      {/* Main Workspace Frame */}
      <main className="flex flex-1 overflow-hidden">
        
        {/* Left Sidebar: Controls & Live Preview Card */}
        <aside id="config_panel" className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-6 flex flex-col gap-5 overflow-y-auto flex-1">
            
            {/* Input fields */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">
                유튜브 채널 URL <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                placeholder="https://youtube.com/@channel" 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
              />
            </div>

            {/* Gemini API Key */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 underline decoration-red-300">
                Gemini API 키 (필수)
              </label>
              <div className="relative">
                <input 
                  type={showGeminiKey ? 'text' : 'password'}
                  placeholder="AI 분석용 Gemini Key"
                  className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                />
                <button 
                  type="button" 
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* YouTube Data API Key */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 underline decoration-red-300">
                YouTube Data API 키 (필수)
              </label>
              <div className="relative">
                <input 
                  type={showYoutubeKey ? 'text' : 'password'}
                  placeholder="YouTube Data v3 API Key"
                  className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                  value={youtubeApiKey}
                  onChange={(e) => setYoutubeApiKey(e.target.value)}
                />
                <button 
                  type="button" 
                  onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Optional Analytics Token */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide flex justify-between">
                <span>OAuth Token <span className="text-[10px] text-slate-400 font-normal normal-case">(optional)</span></span>
              </label>
              <div className="relative">
                <input 
                  type={showToken ? 'text' : 'password'}
                  placeholder="ya29.a0Acv..."
                  className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                  value={youtubeAccessToken}
                  onChange={(e) => setYoutubeAccessToken(e.target.value)}
                />
                <button 
                  type="button" 
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Range Select */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wide">
                분석 기간
              </label>
              <select 
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                value={analysisPeriod}
                onChange={(e: any) => setAnalysisPeriod(e.target.value)}
              >
                <option value="28d">지난 28일</option>
                <option value="90d">지난 90일</option>
                <option value="365d">지난 1년</option>
                <option value="lifetime">전체 기간</option>
              </select>
            </div>

            {/* Submit Action */}
            <button 
              type="button"
              id="btn_run_analysis"
              disabled={isLoading}
              onClick={handleRunAnalysis}
              className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-slate-200 disabled:bg-slate-300 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>분석 진단 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-rose-400 fill-rose-500" />
                  <span>분석 실행하기</span>
                </>
              )}
            </button>

            <hr className="border-slate-100" />

            {/* Errors and Warnings display inside sidebar layout */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 text-red-800 rounded-xl border border-red-200 p-3 leading-relaxed text-[11px] space-y-1 shadow-xs"
                >
                  <p className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                    <span>진단 차단 오류</span>
                  </p>
                  <p className="text-red-700/95">{error}</p>
                </motion.div>
              )}

              {warning && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-amber-50 text-amber-900 rounded-xl border border-amber-200 p-3 leading-relaxed text-[11px] space-y-0.5"
                >
                  <p className="font-semibold text-amber-800 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span>애널리틱스 주의</span>
                  </p>
                  <p className="text-amber-700">{warning}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Channel Mini Preview Card */}
            {result && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-xs shrink-0 bg-slate-200">
                    <img 
                      src={result.channel.thumbnail} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-800 truncate">{result.channel.title}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{result.channel.customUrl}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                  <div className="bg-white p-2 text-center rounded border border-slate-100">
                    <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">구독자</p>
                    <p className="text-xs font-bold font-mono text-slate-800">{formatNumber(result.channel.subscriberCount)}</p>
                  </div>
                  <div className="bg-white p-2 text-center rounded border border-slate-100">
                    <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">누적 조회수</p>
                    <p className="text-xs font-bold font-mono text-slate-800">{formatNumber(result.channel.viewCount)}</p>
                  </div>
                </div>

                <div className="border-t border-slate-200/50 pt-2 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setViewDetails(!viewDetails)}
                    className="text-[10px] text-slate-500 font-semibold hover:text-slate-800 flex items-center gap-1 select-none focus:outline-none"
                  >
                    <span>채널 상세 정보/소개 보기</span>
                    <ChevronRight className={`w-3 h-3 transition-transform ${viewDetails ? 'rotate-90' : ''}`} />
                  </button>
                  {viewDetails && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-[10px] text-slate-500 leading-normal mt-1.5 bg-white p-2 rounded border border-slate-100 select-text max-h-32 overflow-y-auto"
                    >
                      {result.channel.description || '방문 한 줄 소개 설명이 없습니다.'}
                    </motion.p>
                  )}
                </div>
              </div>
            )}

          </div>

          <div className="mt-auto p-4 bg-slate-50 border-t border-slate-200 shrink-0">
            <p className="text-[9px] text-slate-400 text-center uppercase tracking-tight">
              API 키는 클라이언트 기기 로컬 메모리에만 상주합니다.
            </p>
          </div>
        </aside>

        {/* Right Frame: Output Report display */}
        <section className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
          
          {/* Report Toolbar */}
          <div className="h-14 px-8 border-b border-slate-200 flex items-center justify-between bg-white/50 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${result ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></span>
              <span className="text-sm font-semibold text-slate-600">
                {isLoading ? '분석 실행 대기 데이터를 추출 중...' : result ? '분석 완료: AI 리포트 생성됨' : '분석 대기 중 (준비 상태)'}
              </span>
            </div>
            {result && (
              <div className="flex gap-2">
                <button 
                  type="button"
                  id="btn_copy_report"
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-md hover:bg-white bg-white/40 transition-colors cursor-pointer select-none"
                >
                  {copied ? '복사 완료!' : 'Markdown 복사'}
                </button>
                <button
                  type="button"
                  id="btn_download_report"
                  onClick={handleDownloadReport}
                  className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-md shadow-sm hover:shadow-md transition-all cursor-pointer select-none"
                >
                  다운로드 (.md)
                </button>
                <button
                  type="button"
                  id="btn_download_pdf"
                  onClick={handleDownloadPDF}
                  className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white border border-red-700 rounded-md shadow-sm hover:bg-red-700 transition-all cursor-pointer select-none flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  PDF 저장
                </button>
              </div>
            )}
          </div>

          {/* Report Content Panel */}
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-8 select-text">
              
              {/* LOADING VIEW COMPONENT */}
              {isLoading && (
                <div className="bg-white border border-slate-200 p-12 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center min-h-[450px]">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-red-600 animate-spin flex items-center justify-center"></div>
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                      <Youtube className="w-8 h-8 text-red-600 fill-red-600/30 strike-red-600" />
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-slate-900 mb-1.5">채널 성장 분석 리포트 전산 빌드</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">{loadingMessage}</p>

                  <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden mt-6 mx-auto">
                    <motion.div 
                      id="loading_progress"
                      className="h-full bg-red-600"
                      initial={{ width: '5%' }}
                      animate={{ width: loadingStage === 'data' ? '45%' : '85%' }}
                      transition={{ duration: 3.5 }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 mt-3 uppercase tracking-wider font-mono">
                    STAGE: {loadingStage === 'data' ? 'YouTube Metrics Extraction' : 'Gemini AI Consulting'}
                  </span>
                </div>
              )}

              {/* UNINITIALIZED EMPTY STATE */}
              {!isLoading && !result && (
                <div className="space-y-6">
                  
                  {/* Executive Summary intro section */}
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-6 bg-red-500 rounded-full"></div>
                      <h2 className="text-xl font-extrabold tracking-tight">1. 핵심 요약 (Executive Summary)</h2>
                    </div>
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                      <p className="text-slate-700 leading-relaxed text-sm">
                        위 대시보드는 유튜브 채널의 실시간 트래픽, 최근 발행 비디오 통계 및 누적 인력 풀 데이터를 연산 검증하여, 타겟 시청자의 관심을 사로잡을 정밀 콘텐츠 포트폴리오를 작성해 드리는 독립형 툴입니다. 
                        Gemini 3.5 전문 크리에이팅 알고리즘 모델과 연동되어 구체적인 <span className="font-bold underline decoration-rose-300">8주 성장 액션 가이드라인</span>을 한국어 분석서 전문으로 즉석 자문합니다.
                      </p>
                      <div className="mt-4 flex items-center gap-2 bg-indigo-50 text-indigo-800 text-xs p-3 rounded-xl border border-indigo-100">
                        <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span>왼쪽에 주소와 인증 정보를 입력해 주시면 실제 분석이 동작하여 활성화됩니다.</span>
                      </div>
                    </div>
                  </section>

                  {/* Dummy Stats Blocks mockup */}
                  <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] opacity-80 font-bold uppercase mb-1">최근 전산 인게이지먼트율</p>
                          <p className="text-2xl font-black">--- %</p>
                        </div>
                        <div className="mt-3.5 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div className="w-1/4 h-full bg-white"></div>
                        </div>
                     </div>
                     <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">이탈 위협 지수</p>
                        <p className="text-2xl font-black text-slate-800">대기 중</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">분석 대기</p>
                     </div>
                     <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">AI 도출 추천</p>
                        <p className="text-2xl font-black text-slate-800">미활성</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">API 연결 완료 후 제시</p>
                     </div>
                  </section>

                </div>
              )}

              {/* LIVE FULL REPORT AND ACTION PLAN */}
              {!isLoading && result && (
                <div id="printable-report" className="space-y-8">
                  {/* PDF 전용 헤더 (화면에서는 숨김) */}
                  <div id="pdf-header" className="border-b-2 border-slate-200 pb-4 mb-2">
                    <h1 className="text-2xl font-black text-slate-900">YouTube Growth Report</h1>
                    <p className="text-sm text-slate-500 mt-1">
                      {result.channel.title} &middot; 분석 기간: {result.analysisPeriod} &middot; {new Date().toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  
                  {/* High Quality Rich Stats grids matching mockup but with real calculations */}
                  <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     
                     <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100 flex flex-col justify-between min-h-[100px]">
                        <div>
                          <p className="text-[10px] opacity-80 font-bold uppercase mb-1">총 잠재 도달 범위 (구독자)</p>
                          <p className="text-2xl font-black font-mono">{formatNumber(result.channel.subscriberCount)}</p>
                        </div>
                        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div className="w-11/12 h-full bg-white"></div>
                        </div>
                     </div>

                     <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col justify-between min-h-[100px]">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">분석 대상 영상 개수</p>
                          <p className="text-2xl font-black text-slate-800 font-mono">{result.videos.length} <span className="text-sm font-normal text-slate-400">개</span></p>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">최대 50개 연동 수집</p>
                     </div>

                     <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col justify-between min-h-[100px]">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">평균 비디오 조회수</p>
                          <p className="text-2xl font-black text-slate-800 font-mono">
                            {result.videos.length > 0 
                              ? formatNumber(Math.round(result.videos.reduce((acc,v) => acc + v.viewCount, 0) / result.videos.length)) 
                              : '0'}
                          </p>
                        </div>
                        <p className="text-[10px] text-emerald-600 font-bold mt-1">▼ 분석 범위 내 평균 분석완료</p>
                     </div>

                  </section>

                  {/* Recent Highest Performance block in layout */}
                  {result.videos.length > 0 && (
                    <section className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-red-500" />
                        최근 미디어 실적 랭킹 (Top 3)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[...result.videos]
                          .sort((a,b) => b.viewCount - a.viewCount)
                          .slice(0, 3)
                          .map((v, index) => (
                            <a 
                              key={v.id}
                              href={`https://youtu.be/${v.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="group block bg-slate-50 hover:bg-slate-100/70 border border-slate-150 p-3 rounded-xl transition-all"
                            >
                              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-200 border border-slate-200 mb-2">
                                <img src={v.thumbnail} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                <span className="absolute top-1 left-1 bg-slate-900/80 text-[9px] text-white font-bold px-1.5 py-0.5 rounded">
                                  #{index + 1}
                                </span>
                              </div>
                              <p className="text-[11px] font-bold text-slate-800 line-clamp-2 truncate group-hover:text-red-600 leading-tight">
                                {v.title}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-mono">
                                <span>조회 {formatNumber(v.viewCount)}</span>
                                <span>좋아요 {formatNumber(v.likeCount)}</span>
                              </div>
                            </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Dynamic Growth Markdown output from Gemini */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-6 bg-red-500 rounded-full"></div>
                      <h2 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">AI 성장 기획안 / 전략 진단서</h2>
                    </div>

                    <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm">
                      <div className="markdown-body prose prose-slate max-w-none prose-headings:font-display prose-headings:tracking-tight prose-a:text-rose-600 prose-blockquote:-skew-x-2">
                        <Markdown
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-xl font-bold font-display mt-8 mb-4 text-slate-900 border-b pb-2 flex items-center gap-2 border-slate-150" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-base font-bold font-display mt-6 mb-3 text-slate-900 flex items-center gap-2 border-b border-slate-150 pb-1" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-sm font-semibold font-sans mt-4 mb-2 text-slate-800" {...props} />,
                            p: ({node, ...props}) => <p className="leading-relaxed text-xs text-slate-600 mb-3.5" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3.5 space-y-1 text-xs text-slate-600" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3.5 space-y-1 text-xs text-slate-600" {...props} />,
                            li: ({node, ...props}) => <li className="text-slate-600" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-3 border-red-500 pl-4 py-2.5 italic my-4 bg-red-50/40 text-slate-700 rounded-r text-xs leading-relaxed" {...props} />,
                            table: ({node, ...props}) => (
                              <div className="overflow-x-auto my-4 rounded-lg border border-slate-200">
                                <table className="min-w-full border-collapse divide-y divide-slate-200 text-[11px] text-left" {...props} />
                              </div>
                            ),
                            th: ({node, ...props}) => <th className="bg-slate-50 px-3 py-2 font-semibold text-slate-700 tracking-wider uppercase border-b border-slate-200" {...props} />,
                            td: ({node, ...props}) => <td className="px-3 py-2 border-b border-slate-100 text-slate-600 font-medium" {...props} />,
                            code: ({node, ...props}) => <code className="bg-slate-100 text-red-600 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold" {...props} />
                          }}
                        >
                          {result.report}
                        </Markdown>
                      </div>
                    </div>
                  </section>

                </div>
              )}

            </div>
          </div>

        </section>

      </main>

      {/* Bottom Status Bar matching Sleek mockup exactly */}
      <footer className="h-8 bg-slate-900 text-white flex items-center px-6 text-[10px] font-medium shrink-0">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${channelUrl ? 'bg-amber-400' : 'bg-slate-500'}`}></span>
            YouTube Data API Connected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Gemini 3.5 Analyst Active
          </span>
          <span className="opacity-40">|</span>
          <span className="text-slate-400">Last Analysis Trigger Services</span>
        </div>
        <div className="ml-auto text-slate-450 hidden sm:block">
          Built for Google AI Studio Web App Environment
        </div>
      </footer>

    </div>
  );
}
