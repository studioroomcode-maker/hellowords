import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  Dimensions,
  Platform,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Rect, Text as SvgText, G, Line } from 'react-native-svg';
import { FontAwesome } from '@expo/vector-icons';
import { format, subMonths, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, isSameMonth, isSameDay, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useClubStore } from '../../stores/clubStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useMatchStore } from '../../stores/matchStore';
import { getMemberNames, saveMemberName } from '../../services/localData';
import { Card, Select, SegmentedTabs, Footer, Button, ProgressBar, Checkbox } from '../../components/ui';
import { colors as tkColors, spacing, radius, typography, MAX_WIDTH } from '../../theme/tokens';

// 성별에 따른 이름 뱃지 색상
const GENDER_COLORS = {
  male: { bg: tkColors.male.bg, text: tkColors.male.text },
  female: { bg: tkColors.female.bg, text: tkColors.female.text },
  default: { bg: tkColors.bg, text: tkColors.text },
};
import { getSessionDates, getSession, getSessionsForMonth, saveSession as saveSessionService, deleteSession } from '../../services/sessions';
import { Session, Match, MatchResult, PlayerStats, SidePosition } from '../../types';
import {
  aggregateStats,
  getRankingByPoints,
  getRankingByWinRate,
  getDetailedPlayerStats,
  getPartnerStats,
  getOpponentStats,
  getMonthlyBests,
  getAttendance,
  getSideStats,
  findBestPartner,
  findRival,
  findNemesis,
  getStatsByOpponentAttribute,
  getMonthlyTrend,
  OpponentStats,
  PartnerStats,
  MonthlyBests,
  AttendanceInfo,
  SideStats,
  GroupStats,
  MonthlyTrendData,
} from '../../utils/stats';
import { calculateDailyStats, findMVP, buildDailyReport } from '../../utils/scoring';
import { createDisplayNameFn } from '../../utils/displayName';
import { generateAnimalProfile } from '../../utils/animalProfile';
import { generateAnimalProfileAI, generateResultAnalysisAI, recognizeScoresFromImage, ScoreRecognitionResult } from '../../services/gemini';
import * as ImagePicker from 'expo-image-picker';
import { analyzeResultDay } from '../../utils/matchAnalysis';
import { calculateMatchProbability, getHeadToHead } from '../../utils/stats';
import * as Clipboard from 'expo-clipboard';

type TabType = 'daily' | 'monthly' | 'personal' | 'ranking';

// 선수 이름 뱃지 컴포넌트
const PlayerNameBadge = ({ name, gender }: { name: string; gender?: '남' | '여' }) => {
  const colors = gender === '남' ? GENDER_COLORS.male
    : gender === '여' ? GENDER_COLORS.female
    : GENDER_COLORS.default;

  return (
    <View style={[styles.nameBadge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.nameBadgeText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
    </View>
  );
};

// 승률 차트 컴포넌트
const WinRateChart = ({ wins, draws, losses, winRate }: {
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}) => {
  const total = wins + draws + losses;
  if (total === 0) return null;

  const winPercent = (wins / total) * 100;
  const drawPercent = (draws / total) * 100;
  const lossPercent = (losses / total) * 100;

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>승/무/패 분포</Text>

      {/* Stacked horizontal bar */}
      <View style={chartStyles.barContainer}>
        <View style={[chartStyles.barSegment, chartStyles.barWin, { flex: winPercent || 0.1 }]}>
          {winPercent >= 15 && <Text style={chartStyles.barText}>{wins}승</Text>}
        </View>
        <View style={[chartStyles.barSegment, chartStyles.barDraw, { flex: drawPercent || 0.1 }]}>
          {drawPercent >= 15 && <Text style={chartStyles.barText}>{draws}무</Text>}
        </View>
        <View style={[chartStyles.barSegment, chartStyles.barLoss, { flex: lossPercent || 0.1 }]}>
          {lossPercent >= 15 && <Text style={chartStyles.barText}>{losses}패</Text>}
        </View>
      </View>

      {/* Legend */}
      <View style={chartStyles.legend}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#10b981' }]} />
          <Text style={chartStyles.legendText}>승 {winPercent.toFixed(0)}%</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#94a3b8' }]} />
          <Text style={chartStyles.legendText}>무 {drawPercent.toFixed(0)}%</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={chartStyles.legendText}>패 {lossPercent.toFixed(0)}%</Text>
        </View>
      </View>
    </View>
  );
};

// 월별 승률 추이 차트 컴포넌트
const MonthlyTrendChart = ({ data }: { data: MonthlyTrendData[] }) => {
  if (data.length === 0) return null;

  // Find max win rate for scaling
  const maxRate = Math.max(...data.map(d => d.winRate), 0.5);
  const chartHeight = 120;

  return (
    <View style={trendStyles.container}>
      <Text style={trendStyles.title}>월별 승률 추이</Text>

      <View style={trendStyles.chartArea}>
        {/* Y-axis labels */}
        <View style={trendStyles.yAxis}>
          <Text style={trendStyles.yAxisLabel}>100%</Text>
          <Text style={trendStyles.yAxisLabel}>50%</Text>
          <Text style={trendStyles.yAxisLabel}>0%</Text>
        </View>

        {/* Chart bars */}
        <View style={trendStyles.barsContainer}>
          {/* 50% reference line */}
          <View style={[trendStyles.referenceLine, { bottom: chartHeight * 0.5 }]} />

          {data.map((item, index) => {
            const barHeight = (item.winRate / 1) * chartHeight;
            const monthLabel = item.month.substring(5); // 'MM'
            const isAbove50 = item.winRate >= 0.5;

            return (
              <View key={item.month} style={trendStyles.barColumn}>
                <View style={trendStyles.barWrapper}>
                  <View
                    style={[
                      trendStyles.trendBar,
                      {
                        height: barHeight,
                        backgroundColor: isAbove50 ? '#10b981' : '#f59e0b',
                      },
                    ]}
                  >
                    <Text style={trendStyles.barValue}>
                      {(item.winRate * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
                <Text style={trendStyles.monthLabel}>{monthLabel}월</Text>
                <Text style={trendStyles.gamesLabel}>{item.games}경기</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

// 차트별 색상 팔레트
const CHART_COLORS = {
  side: ['#3b82f6', '#8b5cf6'],  // 파랑, 보라
  gender: ['#3b82f6', '#ec4899'],  // 파랑(남), 핑크(여)
  hand: ['#f97316', '#06b6d4'],  // 오렌지, 시안
  ntrp: '#8b5cf6',  // 보라
  mbti: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#84cc16', '#06b6d4', '#6366f1', '#a855f7', '#d946ef', '#fb923c', '#fbbf24'],
};

// 통계 차트 컴포넌트 (타입별 최적화)
const StatsChart = ({ data, type }: { data: any[]; type: 'side' | 'gender' | 'hand' | 'ntrp' | 'mbti' }) => {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 40, 500);

  // NTRP별: 라인 차트 (추세 표시)
  if (type === 'ntrp') {
    // NTRP 숫자 순으로 정렬
    const sortedData = [...data].sort((a, b) => {
      const aNum = parseFloat(a.group) || 0;
      const bNum = parseFloat(b.group) || 0;
      return aNum - bNum;
    });

    const chartHeight = 160;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;
    const graphWidth = chartWidth - paddingLeft - paddingRight;
    const graphHeight = chartHeight - paddingTop - paddingBottom;

    const maxRate = 100;

    const points = sortedData.map((item, index) => {
      const x = paddingLeft + (index / Math.max(sortedData.length - 1, 1)) * graphWidth;
      const y = paddingTop + graphHeight - ((item.winRate * 100) / maxRate) * graphHeight;
      return { x, y, item };
    });

    return (
      <View style={barChartStyles.container}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Y축 가이드라인 */}
          {[0, 25, 50, 75, 100].map((rate) => {
            const y = paddingTop + graphHeight - (rate / maxRate) * graphHeight;
            return (
              <G key={rate}>
                <Line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#21262D" strokeWidth={1} />
                <SvgText x={paddingLeft - 5} y={y + 4} fontSize={10} fill="#94a3b8" textAnchor="end">{rate}%</SvgText>
              </G>
            );
          })}
          {/* 50% 기준선 강조 */}
          <Line x1={paddingLeft} y1={paddingTop + graphHeight / 2} x2={chartWidth - paddingRight} y2={paddingTop + graphHeight / 2} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4,4" />
          {/* 라인 그래프 */}
          {points.length > 1 && (
            <G>
              {/* 그라데이션 라인 */}
              <G>
                {points.map((p, i) => {
                  if (i === 0) return null;
                  const prev = points[i - 1];
                  return (
                    <Line key={i} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke={CHART_COLORS.ntrp} strokeWidth={3} />
                  );
                })}
              </G>
              {/* 데이터 포인트 */}
              {points.map((p, i) => (
                <G key={i}>
                  <Rect x={p.x - 8} y={p.y - 8} width={16} height={16} rx={8} fill={CHART_COLORS.ntrp} />
                  <SvgText x={p.x} y={p.y + 4} fontSize={9} fill="#ffffff" textAnchor="middle" fontWeight="bold">
                    {(p.item.winRate * 100).toFixed(0)}
                  </SvgText>
                </G>
              ))}
            </G>
          )}
          {/* X축 라벨 */}
          {points.map((p, i) => (
            <SvgText key={i} x={p.x} y={chartHeight - 10} fontSize={11} fill="#94A3B8" textAnchor="middle" fontWeight="600">
              {p.item.group}
            </SvgText>
          ))}
        </Svg>
      </View>
    );
  }

  // 코트 사이드별: 비교 막대 (가로) - 파랑/보라 색상
  if (type === 'side') {
    const labelWidth = 60;
    const barAreaWidth = 240;
    const maxRate = 100;

    return (
      <View style={barChartStyles.container}>
        {data.map((item, index) => {
          const barWidth = (item.winRate / maxRate) * barAreaWidth;
          const barColor = CHART_COLORS.side[index % CHART_COLORS.side.length];
          return (
            <View key={index} style={barChartStyles.barRowInline}>
              <Text style={[barChartStyles.label, { width: labelWidth }]}>{item.label}</Text>
              <View style={[barChartStyles.barContainer, { width: barAreaWidth }]}>
                <View style={[barChartStyles.bar, { width: Math.max(barWidth, 2), backgroundColor: barColor }]} />
                <View style={barChartStyles.barLine50} />
              </View>
              <Text style={barChartStyles.valueInline}>{item.winRate.toFixed(0)}%</Text>
              <Text style={barChartStyles.statsInline}>
                {item.wins}승 {item.draws}무 {item.losses}패({item.games}경기)
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  // 성별/주손별: 가로 막대 차트 (코트 사이드별과 동일한 스타일)
  if (type === 'gender' || type === 'hand') {
    const labelWidth = 60;
    const barAreaWidth = 240;
    const maxRate = 100;
    const colorPalette = type === 'gender' ? CHART_COLORS.gender : CHART_COLORS.hand;

    return (
      <View style={barChartStyles.container}>
        {data.map((item, index) => {
          const barWidth = (item.winRate * 100 / maxRate) * barAreaWidth;
          const barColor = colorPalette[index % colorPalette.length];
          return (
            <View key={index} style={barChartStyles.barRowInline}>
              <Text style={[barChartStyles.label, { width: labelWidth }]}>{item.group}</Text>
              <View style={[barChartStyles.barContainer, { width: barAreaWidth }]}>
                <View style={[barChartStyles.bar, { width: Math.max(barWidth, 2), backgroundColor: barColor }]} />
                <View style={barChartStyles.barLine50} />
              </View>
              <Text style={barChartStyles.valueInline}>{(item.winRate * 100).toFixed(0)}%</Text>
              <Text style={barChartStyles.statsInline}>
                {item.wins}승 {item.draws}무 {item.losses}패({item.games}경기)
              </Text>
            </View>
          );
        })}
      </View>
    );
  }

  // MBTI별: 세로 막대 차트 (0%부터 시작, 다양한 색상)
  if (type === 'mbti') {
    const chartHeight = 180;
    const paddingBottom = 60;
    const paddingTop = 25;
    const barMaxHeight = chartHeight - paddingBottom - paddingTop;
    const barWidth = Math.min(28, (chartWidth - 20) / data.length - 6);

    // 승률 순으로 정렬
    const sortedData = [...data].sort((a, b) => b.winRate - a.winRate);
    const totalWidth = sortedData.length * (barWidth + 8);
    const startX = (chartWidth - totalWidth) / 2;

    return (
      <View style={barChartStyles.container}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* 배경 가이드라인 */}
          {[0, 50, 100].map((rate) => {
            const y = paddingTop + barMaxHeight - (rate / 100) * barMaxHeight;
            return (
              <G key={rate}>
                <Line x1={10} y1={y} x2={chartWidth - 10} y2={y} stroke="#21262D" strokeWidth={1} />
                {rate > 0 && (
                  <SvgText x={8} y={y + 4} fontSize={9} fill="#94a3b8" textAnchor="end">{rate}%</SvgText>
                )}
              </G>
            );
          })}
          {/* 막대들 */}
          {sortedData.map((item, index) => {
            const barHeight = Math.max(item.winRate * barMaxHeight, 2);
            const x = startX + index * (barWidth + 8);
            const y = paddingTop + barMaxHeight - barHeight;
            const color = CHART_COLORS.mbti[index % CHART_COLORS.mbti.length];
            return (
              <G key={index}>
                {/* 막대 */}
                <Rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill={color} />
                {/* 승률 값 */}
                <SvgText x={x + barWidth / 2} y={y - 5} fontSize={10} fill="#F1F5F9" textAnchor="middle" fontWeight="bold">
                  {(item.winRate * 100).toFixed(0)}%
                </SvgText>
                {/* MBTI 라벨 */}
                <SvgText x={x + barWidth / 2} y={chartHeight - 30} fontSize={9} fill="#94A3B8" textAnchor="middle" fontWeight="600">
                  {item.group}
                </SvgText>
                {/* 경기수 */}
                <SvgText x={x + barWidth / 2} y={chartHeight - 16} fontSize={8} fill="#94a3b8" textAnchor="middle">
                  {item.games}경기
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
    );
  }

  // 기본: 수평 막대 차트
  const labelWidth = 70;
  const valueWidth = 50;
  const barAreaWidth = chartWidth - labelWidth - valueWidth - 20;
  const maxRate = 100;

  return (
    <View style={barChartStyles.container}>
      {data.map((item, index) => {
        const barWidth = ((item.winRate * 100) / maxRate) * barAreaWidth;
        const barColor = item.winRate >= 0.5 ? '#10b981' : '#f59e0b';
        return (
          <View key={index} style={barChartStyles.barRow}>
            <Text style={[barChartStyles.label, { width: labelWidth }]} numberOfLines={1}>{item.group || item.label}</Text>
            <View style={[barChartStyles.barContainer, { width: barAreaWidth }]}>
              <View style={[barChartStyles.bar, { width: Math.max(barWidth, 2), backgroundColor: barColor }]} />
              <View style={barChartStyles.barLine50} />
            </View>
            <Text style={[barChartStyles.value, { width: valueWidth }]}>{(item.winRate * 100).toFixed(0)}%</Text>
          </View>
        );
      })}
      <View style={barChartStyles.legend}>
        <View style={barChartStyles.legendItem}>
          <View style={[barChartStyles.legendDot, { backgroundColor: '#10b981' }]} />
          <Text style={barChartStyles.legendText}>50% 이상</Text>
        </View>
        <View style={barChartStyles.legendItem}>
          <View style={[barChartStyles.legendDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={barChartStyles.legendText}>50% 미만</Text>
        </View>
      </View>
    </View>
  );
};

const barChartStyles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: tkColors.text,
  },
  barContainer: {
    height: 24,
    backgroundColor: tkColors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  barLine50: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: tkColors.textTertiary,
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.text,
    textAlign: 'right',
  },
  barRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  valueInline: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.text,
    marginLeft: spacing.sm,
    minWidth: 36,
  },
  statsInline: {
    fontSize: 12,
    color: tkColors.textSecondary,
    marginLeft: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: tkColors.textSecondary,
  },
  detailsContainer: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: tkColors.border,
    paddingTop: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tkColors.textSecondary,
    flex: 1,
  },
  detailText: {
    fontSize: 13,
    color: tkColors.textSecondary,
  },
  // 라인 차트용 스타일
  chartDescription: {
    fontSize: 12,
    color: tkColors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  // 도넛 차트용 스타일
  donutRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
  },
  donutItem: {
    alignItems: 'center',
  },
  donutLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.text,
    marginTop: spacing.sm,
  },
  donutDetail: {
    fontSize: 12,
    color: tkColors.textTertiary,
    marginTop: 2,
  },
  // 세로 막대 차트용 스타일
  verticalBarContainer: {
    position: 'relative',
    width: '100%',
  },
  verticalBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: tkColors.textTertiary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  baselineLabel: {
    fontSize: 10,
    color: tkColors.textTertiary,
    position: 'absolute',
    left: -2,
    top: -14,
  },
  verticalBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
    paddingBottom: 50,
    paddingTop: 20,
  },
  verticalBarItem: {
    alignItems: 'center',
  },
  verticalBar: {
    borderRadius: 4,
  },
  verticalBarValue: {
    fontSize: 11,
    fontWeight: '700',
    color: tkColors.text,
    marginBottom: 4,
  },
  verticalBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: tkColors.textSecondary,
    marginTop: 6,
    maxWidth: 40,
    textAlign: 'center',
  },
  verticalBarGames: {
    fontSize: 9,
    color: tkColors.textTertiary,
    marginTop: 2,
  },
});

const trendStyles = StyleSheet.create({
  container: {
    backgroundColor: tkColors.bg,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: tkColors.textSecondary,
    marginBottom: spacing.lg,
  },
  chartArea: {
    flexDirection: 'row',
  },
  yAxis: {
    width: 36,
    height: 120,
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  yAxisLabel: {
    fontSize: 10,
    color: tkColors.textTertiary,
    textAlign: 'right',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    position: 'relative',
  },
  referenceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: tkColors.textTertiary,
    borderStyle: 'dashed',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  trendBar: {
    width: '70%',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    minHeight: 20,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '700',
    color: tkColors.white,
  },
  monthLabel: {
    fontSize: 11,
    color: tkColors.textSecondary,
    marginTop: 6,
    fontWeight: '600',
  },
  gamesLabel: {
    fontSize: 9,
    color: tkColors.textTertiary,
    marginTop: 2,
  },
});

const chartStyles = StyleSheet.create({
  container: {
    backgroundColor: tkColors.bg,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  title: {
    ...typography.bodyMedium,
    color: tkColors.textSecondary,
    marginBottom: spacing.md,
  },
  barContainer: {
    flexDirection: 'row',
    height: 40,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  barSegment: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 2,
  },
  barWin: {
    backgroundColor: tkColors.success,
  },
  barDraw: {
    backgroundColor: tkColors.textTertiary,
  },
  barLoss: {
    backgroundColor: tkColors.error,
  },
  barText: {
    fontSize: 13,
    fontWeight: '700',
    color: tkColors.white,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    ...typography.captionMedium,
    color: tkColors.textSecondary,
  },
  winRateSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: tkColors.border,
  },
  winRateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  winRateLabel: {
    ...typography.bodyMedium,
    color: tkColors.textSecondary,
  },
  winRateValue: {
    fontSize: 20,
    fontWeight: '800',
    color: tkColors.primary,
  },
  winRateBarBg: {
    height: 12,
    backgroundColor: tkColors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  winRateBarFill: {
    height: '100%',
    backgroundColor: tkColors.primary,
    borderRadius: 6,
  },
});

export default function RecordsScreen() {
  const { user } = useAuthStore();
  const { clubCode, club, isAdmin } = useClubStore();
  const isFeatureDisabled = useClubStore(s => s.isFeatureDisabled);
  const { players } = usePlayerStore();
  const bumpSessionVersion = useMatchStore(s => s.bumpSessionVersion);
  const sessionVersion = useMatchStore(s => s.sessionVersion);

  const displayNameMode = club?.settings?.displayNameMode;
  const dn = useMemo(() => createDisplayNameFn(players, displayNameMode), [players, displayNameMode]);

  // 섹션 제한
  const sr = club?.settings?.sectionRestrictions || {};
  const isSectionRestricted = (key: string) => !isAdmin && sr[key];
  const { player: playerParam } = useLocalSearchParams<{ player?: string }>();
  const navigation = useNavigation();

  // 탭 포커스 시 날짜별 탭으로 리셋 + 세션 데이터 갱신
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!playerParam) {
        setActiveTab('daily');
      }
      loadSessionDates();
    });
    return unsubscribe;
  }, [navigation, playerParam, clubCode]);

  // 본인 선수 이름 (개인별 selfOnly 용)
  const [myPlayerName, setMyPlayerName] = useState<string | null>(null);
  useEffect(() => {
    if (clubCode && user?.email) {
      getMemberNames(clubCode).then(async (names) => {
        let name = names[user.email!.toLowerCase()] || null;
        // memberNames에 없으면 players에서 email로 찾아서 매핑 복구
        if (!name && players.length > 0) {
          const linked = players.find(p => p.email?.toLowerCase() === user.email!.toLowerCase());
          if (linked) {
            name = linked.name;
            await saveMemberName(clubCode, user.email!, linked.name);
          }
        }
        setMyPlayerName(name);
      });
    }
  }, [clubCode, user?.email, players]);

  // 선수 이름 → 선수 정보 맵
  const rosterByName = useMemo(() => {
    const map: Record<string, typeof players[0]> = {};
    for (const p of players) {
      map[p.name] = p;
    }
    return map;
  }, [players]);

  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [sessionDates, setSessionDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [monthlyStats, setMonthlyStats] = useState<Record<string, PlayerStats>>({});
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [monthlyBests, setMonthlyBests] = useState<MonthlyBests | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceInfo>({});
  const [rankingViewMode, setRankingViewMode] = useState<'all' | 'group'>('all');
  const [rankingPeriod, setRankingPeriod] = useState<'monthly' | 'all'>('monthly');
  const [rankingCriteria, setRankingCriteria] = useState<'points' | 'winRate' | 'scoreTotal' | 'scoreAvg' | 'attendance' | 'scoreDiff'>('points');
  const [prevMonthStats, setPrevMonthStats] = useState<Record<string, PlayerStats>>({});
  const [prevMonthAttendance, setPrevMonthAttendance] = useState<AttendanceInfo>({});
  const [monthlySessions, setMonthlySessions] = useState<Record<string, any>>({});

  // 동물 프로필 (AI / 오프라인)
  const [aiAnimalProfile, setAiAnimalProfile] = useState<{ emoji: string; animal: string; title: string; description: string } | null>(null);
  const [isLoadingAnimal, setIsLoadingAnimal] = useState(false);
  const aiProfileCacheRef = useRef<Record<string, { hash: string; profile: any }>>({});

  // Daily tab: match vs individual view toggle
  const [dailyViewMode, setDailyViewMode] = useState<'match' | 'individual'>('match');

  // 점수 편집용 로컬 상태
  const [editResults, setEditResults] = useState<Record<string, MatchResult>>({});
  const [editSchedule, setEditSchedule] = useState<Match[]>([]);
  const [scorePicker, setScorePicker] = useState<{ matchIndex: number; team: 't1' | 't2' } | null>(null);
  const [lockedCourts, setLockedCourts] = useState<Record<number, boolean>>({});
  const [isRecognizingScore, setIsRecognizingScore] = useState(false);
  const [scoreRecognitionResult, setScoreRecognitionResult] = useState<ScoreRecognitionResult | null>(null);
  const [showScoreConfirmModal, setShowScoreConfirmModal] = useState(false);
  const [showDeleteSessionConfirm, setShowDeleteSessionConfirm] = useState(false);

  // 경기총평
  const [resultAnalysis, setResultAnalysis] = useState<{ title: string; summary: string } | null>(null);
  const [isAiResultAnalysis, setIsAiResultAnalysis] = useState(false);
  const [isLoadingResultAnalysis, setIsLoadingResultAnalysis] = useState(false);

  // 게임순서 변경/삭제
  const [showGameReorder, setShowGameReorder] = useState(false);
  const [swapGameA, setSwapGameA] = useState(0);
  const [swapGameB, setSwapGameB] = useState(0);
  const [deleteGameIndex, setDeleteGameIndex] = useState(0);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // 당일 선수 수정
  const [showPlayerEdit, setShowPlayerEdit] = useState(false);
  const [swapOldName, setSwapOldName] = useState<string | null>(null);
  const [swapNewName, setSwapNewName] = useState<string | null>(null);
  const [editGameIdx, setEditGameIdx] = useState<number>(0);
  const [editTeam1, setEditTeam1] = useState<string[]>([]);
  const [editTeam2, setEditTeam2] = useState<string[]>([]);

  // JPG 저장 모드
  const [isSavingJpg, setIsSavingJpg] = useState(false);
  // 빈 점수표 템플릿
  const [includePlayerNames, setIncludePlayerNames] = useState(true);
  const [showScoreTemplate, setShowScoreTemplate] = useState(false);

  // 전적 모달
  const [recordModal, setRecordModal] = useState<{
    visible: boolean;
    player: string;
    partner: string | null;
    opponents: string[];
    filterMode: 'all' | 'recent5';
  }>({ visible: false, player: '', partner: null, opponents: [], filterMode: 'all' });

  // 전체 세션 (승률 계산용)
  const [allSessions, setAllSessions] = useState<Record<string, Session>>({});
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // 제한된 탭이면 첫 번째 허용 탭으로 전환
  useEffect(() => {
    const allTabs: TabType[] = ['daily', 'monthly', 'personal', 'ranking'];
    const available = allTabs.filter((t) => !isSectionRestricted(`records.${t}`));
    if (available.length > 0 && isSectionRestricted(`records.${activeTab}`)) {
      setActiveTab(available[0]);
    }
  }, [sr, isAdmin]);

  // 제한된 뷰모드면 전환
  useEffect(() => {
    if (isSectionRestricted('records.daily.matchView') && dailyViewMode === 'match') {
      setDailyViewMode('individual');
    } else if (isSectionRestricted('records.daily.individualView') && dailyViewMode === 'individual') {
      setDailyViewMode('match');
    }
  }, [sr, isAdmin]);

  // selfOnly 모드 또는 이메일 연동 시: 자동으로 본인 선택
  useEffect(() => {
    if (myPlayerName && !selectedPlayer && !playerParam) {
      setSelectedPlayer(myPlayerName);
    }
  }, [myPlayerName]);

  // JPG 저장용 refs
  const matchCardRefA = useRef<View>(null);
  const matchCardRefB = useRef<View>(null);
  const indivCardRefA = useRef<View>(null);
  const indivCardRefB = useRef<View>(null);
  const scoreTemplateRef = useRef<View>(null);
  const aiResultLoadedRef = useRef(false);
  const lastResultAiKeyRef = useRef('');

  const saveAsJpg = async (ref: React.RefObject<View>, filename: string) => {
    if (!ref.current) {
      const msg = '저장할 대상이 없습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
      return;
    }
    setIsSavingJpg(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      if (Platform.OS === 'web') {
        const { toJpeg } = await import('html-to-image');
        const dataUrl = await toJpeg(ref.current as unknown as HTMLElement, {
          quality: 0.95,
          backgroundColor: '#ffffff',
        });
        const link = document.createElement('a');
        link.download = `${filename}.jpg`;
        link.href = dataUrl;
        link.click();
      } else {
        const uri = await captureRef(ref, { format: 'jpg', quality: 0.9 });
        const { shareAsync } = await import('expo-sharing');
        await shareAsync(uri, { mimeType: 'image/jpeg' });
      }
    } catch (e) {
      const msg = '이미지 저장에 실패했습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
    } finally {
      setIsSavingJpg(false);
    }
  };

  const handleSaveScoreTemplate = async () => {
    setShowScoreTemplate(true);
    await new Promise(r => setTimeout(r, 300));
    await saveAsJpg(scoreTemplateRef, `점수표_${selectedDate}`);
    setShowScoreTemplate(false);
  };

  // Personal tab: all-time vs monthly toggle
  const [personalPeriod, setPersonalPeriod] = useState<'all' | 'monthly'>('all');
  const [allTimeSessions, setAllTimeSessions] = useState<Record<string, any>>({});
  const [allTimeStats, setAllTimeStats] = useState<Record<string, PlayerStats>>({});
  const [allTimeAttendance, setAllTimeAttendance] = useState<AttendanceInfo>({});
  const [isLoadingAllTime, setIsLoadingAllTime] = useState(false);

  // Group stats sorting
  const [groupSortColumn, setGroupSortColumn] = useState<'games' | 'wld' | 'winRate'>('games');
  const [groupSortAsc, setGroupSortAsc] = useState(false); // false = descending (default)

  // Chart modal state
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [chartModalData, setChartModalData] = useState<{ title: string; data: any[]; type: 'side' | 'gender' | 'hand' | 'ntrp' | 'mbti' }>({ title: '', data: [], type: 'side' });

  // Opponent stats sorting
  const [oppSortColumn, setOppSortColumn] = useState<'games' | 'wld' | 'winRate'>('games');
  const [oppSortAsc, setOppSortAsc] = useState(false);

  // Partner stats sorting
  const [partnerSortColumn, setPartnerSortColumn] = useState<'games' | 'wld' | 'winRate'>('games');
  const [partnerSortAsc, setPartnerSortAsc] = useState(false);

  // Handle player param from navigation
  useEffect(() => {
    if (playerParam) {
      const decodedPlayer = decodeURIComponent(playerParam);
      setSelectedPlayer(decodedPlayer);
      setActiveTab('personal');
    }
  }, [playerParam]);

  // Load session dates (clubCode 변경 또는 다른 탭에서 세션 저장 시 갱신)
  useEffect(() => {
    if (clubCode) {
      loadSessionDates();
    }
  }, [clubCode, sessionVersion]);

  const loadSessionDates = async () => {
    if (!clubCode) return;
    const dates = await getSessionDates(clubCode);
    setSessionDates(dates);
    if (dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[0]);
    }
  };

  // Load selected session (세션 저장 시에도 갱신)
  useEffect(() => {
    if (clubCode && selectedDate) {
      loadSession();
    }
  }, [clubCode, selectedDate, sessionVersion]);

  const loadSession = async () => {
    if (!clubCode || !selectedDate) return;
    setIsLoading(true);
    const session = await getSession(clubCode, selectedDate);
    setSelectedSession(session);
    setIsLoading(false);
  };

  // ── selectedSession → 편집 상태 동기화 ──
  useEffect(() => {
    if (selectedSession) {
      setEditSchedule([...selectedSession.schedule]);
      setEditResults({ ...selectedSession.results });
      setShowGameReorder(false);
      setDeleteConfirmIndex(null);
      setShowDeleteSessionConfirm(false);
      setLockedCourts({});
    } else {
      setEditSchedule([]);
      setEditResults({});
    }
  }, [selectedSession]);

  // 편집용 활성 경기
  const activeEditMatches = useMemo(() =>
    editSchedule.filter(m => m.gameType !== '삭제'),
  [editSchedule]);

  const editCompletedCount = useMemo(() =>
    activeEditMatches.filter((_, i) => {
      // 원본 인덱스 매핑 필요
      const origIdx = editSchedule.indexOf(activeEditMatches[i]);
      const r = editResults[String(origIdx + 1)];
      return r?.t1 !== null && r?.t1 !== undefined;
    }).length,
  [activeEditMatches, editResults, editSchedule]);

  // AI 호출용: 양팀 점수 모두 입력된 경기 수 (t1 AND t2)
  const editFullyCompletedCount = useMemo(() =>
    activeEditMatches.filter((_, i) => {
      const origIdx = editSchedule.indexOf(activeEditMatches[i]);
      const r = editResults[String(origIdx + 1)];
      return r?.t1 != null && r?.t2 != null;
    }).length,
  [activeEditMatches, editResults, editSchedule]);

  // 조별 분리 로직
  const groupedEditMatches = useMemo(() => {
    if (!selectedSession?.groupOnly || !selectedSession?.groupsSnapshot) return null;
    const snapshot = selectedSession.groupsSnapshot;
    const groups: Record<string, { match: Match; idx: number }[]> = {};
    editSchedule.forEach((m, i) => {
      if (m.gameType === '삭제') return;
      const g = snapshot[m.team1[0]] || '미배정';
      if (!groups[g]) groups[g] = [];
      groups[g].push({ match: m, idx: i });
    });
    return groups;
  }, [editSchedule, selectedSession?.groupOnly, selectedSession?.groupsSnapshot]);

  // 완료율
  const editCompletionPercent = activeEditMatches.length > 0
    ? Math.round((editCompletedCount / activeEditMatches.length) * 100)
    : 0;

  // 오늘의 하이라이트 데이터
  const highlightData = useMemo(() => {
    if (editCompletedCount === 0) return null;
    const memberSet = new Set(players.map(p => p.name));
    const session: Session = { schedule: editSchedule, results: editResults };
    const stats = calculateDailyStats(session, memberSet);
    const mvp = findMVP(stats);
    const attendees = Object.keys(stats).filter(n => stats[n].games > 0);
    const totalGames = activeEditMatches.filter((_, i) => {
      const origIdx = editSchedule.indexOf(activeEditMatches[i]);
      const r = editResults[String(origIdx + 1)];
      return r?.t1 !== null && r?.t1 !== undefined;
    }).length;
    const undefeated = attendees.filter(n => stats[n].losses === 0 && stats[n].games > 0);
    const shutouts: Record<string, number> = {};
    editSchedule.forEach((match, idx) => {
      if (match.gameType === '삭제') return;
      const r = editResults[String(idx + 1)];
      if (!r || r.t1 === null) return;
      if (r.t1 === 0) match.team2.forEach(n => { if (memberSet.has(n)) shutouts[n] = (shutouts[n] || 0) + 1; });
      if (r.t2 === 0) match.team1.forEach(n => { if (memberSet.has(n)) shutouts[n] = (shutouts[n] || 0) + 1; });
    });
    const maxShutouts = Math.max(0, ...Object.values(shutouts));
    const shutoutLeaders = Object.entries(shutouts)
      .filter(([_, c]) => c === maxShutouts && maxShutouts > 0)
      .map(([n]) => n);
    return { stats, mvp, attendees, totalGames, undefeated, shutoutLeaders, maxShutouts };
  }, [editCompletedCount, editSchedule, editResults, players]);

  // 대진표에 등장하는 선수 목록
  const dayPlayerNames = useMemo(() => {
    const names = new Set<string>();
    for (const m of editSchedule) {
      if (m.gameType === '삭제') continue;
      m.team1.forEach(n => { if (n) names.add(n); });
      m.team2.forEach(n => { if (n) names.add(n); });
    }
    return Array.from(names).sort();
  }, [editSchedule]);

  // roster 선수 목록
  const rosterNames = useMemo(() => players.map(p => p.name).sort(), [players]);

  // 게임 라벨
  const getGameLabel = (m: Match, idx: number) => {
    const t1 = m.team1.map(dn).join(' / ');
    const t2 = m.team2.map(dn).join(' / ');
    return `${idx + 1}번 (${m.gameType}, 코트 ${m.court}) ${t1} vs ${t2}`;
  };

  // 점수 입력 / 잠금 제한 (sectionRestrictions 또는 구독 등급)
  const scoreInputDisabled = isSectionRestricted('records.daily.inputDisabled') || isFeatureDisabled('disableScoreEdit');
  const lockDisabled = isSectionRestricted('records.daily.lockDisabled');

  // 디버그: 하이라이트/총평 조건 (브라우저 콘솔에서 확인)
  useEffect(() => {
    console.log('[Highlight Debug]', {
      hasSession: !!selectedSession,
      activeMatches: activeEditMatches.length,
      completedCount: editCompletedCount,
      playersCount: players.length,
      mvp: highlightData?.mvp?.name || '(없음)',
      featureDisabled: isFeatureDisabled('disableHighlights'),
      resultAnalysis: resultAnalysis ? 'O' : 'X',
    });
  }, [selectedSession, editCompletedCount, players, highlightData, resultAnalysis]);

  // ── 경기총평 (오프라인 + AI 통합) ──
  useEffect(() => {
    if (!selectedSession || editCompletedCount === 0) {
      setResultAnalysis(null);
      setIsAiResultAnalysis(false);
      aiResultLoadedRef.current = false;
      lastResultAiKeyRef.current = '';
      return;
    }
    const tempSession: Session = {
      schedule: editSchedule,
      results: editResults,
    };
    const analysis = analyzeResultDay(tempSession);

    // AI 결과가 이미 로드되어 있으면 오프라인으로 덮어쓰지 않음
    if (!aiResultLoadedRef.current) {
      setResultAnalysis({ title: '', summary: analysis.overallVerdict });
    }

    // AI 호출: editFullyCompletedCount 또는 selectedDate가 바뀔 때만
    const aiKey = `${editFullyCompletedCount}-${selectedDate}`;
    if (aiKey === lastResultAiKeyRef.current) return;
    lastResultAiKeyRef.current = aiKey;
    aiResultLoadedRef.current = false;
    setResultAnalysis({ title: '', summary: analysis.overallVerdict });
    setIsAiResultAnalysis(false);

    const apiKey = club?.settings?.geminiApiKey;
    if (!apiKey || !clubCode || isFeatureDisabled('disableAIAnalysis')) return;

    setIsLoadingResultAnalysis(true);
    generateResultAnalysisAI(apiKey, analysis, clubCode, selectedDate)
      .then(result => {
        if (result) {
          aiResultLoadedRef.current = true;
          setResultAnalysis(result);
          setIsAiResultAnalysis(true);
        }
      })
      .finally(() => setIsLoadingResultAnalysis(false));
  }, [editResults, editSchedule, editCompletedCount, editFullyCompletedCount, selectedDate]);

  // ── 핸들러: 점수 변경 ──
  const handleEditScoreSelect = useCallback((matchIdx: number, team: 't1' | 't2', value: number | null) => {
    setEditResults(prev => ({
      ...prev,
      [String(matchIdx + 1)]: { ...(prev[String(matchIdx + 1)] || { t1: null, t2: null }), [team]: value },
    }));
  }, []);

  // ── 사진으로 점수 인식 ──
  const handlePhotoScore = async (source?: 'camera' | 'gallery') => {
    const geminiApiKey = club?.settings?.geminiApiKey;
    if (!geminiApiKey) {
      const msg = 'Gemini API 키가 설정되지 않았습니다.\n설정 > AI 설정에서 API 키를 입력해주세요.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
      return;
    }

    // 모바일: 소스 미지정 시 선택 다이얼로그
    if (!source && Platform.OS !== 'web') {
      Alert.alert('사진으로 점수입력', '이미지를 어디서 가져올까요?', [
        { text: '카메라로 촬영', onPress: () => handlePhotoScore('camera') },
        { text: '갤러리에서 선택', onPress: () => handlePhotoScore('gallery') },
        { text: '취소', style: 'cancel' },
      ]);
      return;
    }

    const useCamera = source === 'camera';
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        const msg = '카메라 권한이 필요합니다.';
        Alert.alert('권한 필요', msg);
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const msg = '갤러리 접근 권한이 필요합니다.';
        Platform.OS === 'web' ? alert(msg) : Alert.alert('권한 필요', msg);
        return;
      }
    }

    const pickerResult = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
    if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

    const asset = pickerResult.assets[0];
    let base64Data = asset.base64 || null;

    if (!base64Data && asset.uri) {
      try {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch {
        const msg = '이미지를 읽을 수 없습니다.';
        Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
        return;
      }
    }
    if (!base64Data) {
      const msg = '이미지 데이터를 가져올 수 없습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
      return;
    }

    const matchContext = activeEditMatches.map((m, idx) => ({
      matchNumber: idx + 1,
      team1: m.team1,
      team2: m.team2,
    }));

    const uri = asset.uri || '';
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    console.log('[PhotoScore] base64 length:', base64Data.length, 'mimeType:', mimeType, 'matches:', matchContext.length);
    setIsRecognizingScore(true);
    try {
      const result = await recognizeScoresFromImage(geminiApiKey, base64Data, mimeType, matchContext);
      console.log('[PhotoScore] Result:', result ? `${result.matches.length} matches, rawText: ${result.rawText?.slice(0, 100)}` : 'null');
      if (result && result.matches.length > 0) {
        setScoreRecognitionResult(result);
        setShowScoreConfirmModal(true);
      } else if (result && result.rawText) {
        // AI가 사진을 읽었지만 대진표와 매칭 실패
        const msg = `사진은 읽었으나 대진표와 매칭되는 점수를 찾지 못했습니다.\n\nAI가 읽은 내용:\n${result.rawText.slice(0, 200)}`;
        Platform.OS === 'web' ? alert(msg) : Alert.alert('매칭 실패', msg);
      } else {
        const msg = '사진에서 점수를 인식할 수 없습니다.\n더 선명한 사진을 사용해주세요.';
        Platform.OS === 'web' ? alert(msg) : Alert.alert('인식 실패', msg);
      }
    } catch (e: any) {
      console.warn('[PhotoScore] Error:', e?.message, e);
      const msg = e?.message === 'QUOTA_EXCEEDED'
        ? 'Gemini API 할당량이 초과되었습니다.\n1~2분 후 다시 시도해주세요.'
        : e?.message === 'API_KEY_INVALID'
        ? 'Gemini API 키가 유효하지 않습니다.\n설정에서 키를 확인해주세요.'
        : `점수 인식 중 오류가 발생했습니다.\n${e?.message || ''}`;
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
    } finally {
      setIsRecognizingScore(false);
    }
  };

  // ── 핸들러: 점수 저장 ──
  const handleSaveEditedSession = useCallback(async () => {
    if (!clubCode || !selectedDate) return;
    try {
      const success = await saveSessionService(clubCode, selectedDate, {
        schedule: editSchedule,
        results: editResults,
      });
      if (success) {
        // 로컬 상태 갱신
        setSelectedSession(prev => prev ? { ...prev, schedule: editSchedule, results: editResults } : prev);
        bumpSessionVersion();
        const msg = '점수가 저장되었습니다.';
        Platform.OS === 'web' ? alert(msg) : Alert.alert('저장 완료', msg);
      } else {
        const msg = '저장에 실패했습니다.';
        Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
      }
    } catch (e) {
      const msg = `저장 실패: ${e}`;
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
    }
  }, [clubCode, selectedDate, editSchedule, editResults, bumpSessionVersion]);

  // ── 핸들러: 게임 순서 교환 ──
  const handleEditGameSwap = useCallback(() => {
    if (swapGameA === swapGameB) {
      const msg = '같은 게임이라서 교환할 게 없습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('안내', msg);
      return;
    }
    setEditSchedule(prev => {
      const next = [...prev];
      const courtA = next[swapGameA].court;
      const courtB = next[swapGameB].court;
      [next[swapGameA], next[swapGameB]] = [next[swapGameB], next[swapGameA]];
      next[swapGameA] = { ...next[swapGameA], court: courtA };
      next[swapGameB] = { ...next[swapGameB], court: courtB };
      return next;
    });
    setEditResults(prev => {
      const next = { ...prev };
      const keyA = String(swapGameA + 1);
      const keyB = String(swapGameB + 1);
      const temp = next[keyA];
      next[keyA] = next[keyB];
      next[keyB] = temp;
      return next;
    });
  }, [swapGameA, swapGameB]);

  // ── 핸들러: 게임 삭제 ──
  const handleEditGameDelete = useCallback((index: number) => {
    setEditSchedule(prev => {
      const next = [...prev];
      next[index] = { ...next[index], gameType: '삭제' as any };
      return next;
    });
    // 결과 제거
    setEditResults(prev => {
      const next = { ...prev };
      delete next[String(index + 1)];
      return next;
    });
    setDeleteConfirmIndex(null);
  }, []);

  // 사이드 변경 핸들러
  const handleSideChange = useCallback((matchIdx: number, playerName: string, side: SidePosition) => {
    setEditResults(prev => {
      const key = String(matchIdx + 1);
      const current = prev[key] || { t1: null, t2: null };
      const currentSides = current.sides || {};
      const match = editSchedule[matchIdx];
      const team1 = match?.team1 || [];
      const team2 = match?.team2 || [];
      const isTeam1 = team1.includes(playerName);
      const teammates = isTeam1 ? team1 : team2;
      const partner = teammates.find(p => p !== playerName);

      if (currentSides[playerName] === side) {
        const newSides = { ...currentSides };
        delete newSides[playerName];
        if (partner) delete newSides[partner];
        return { ...prev, [key]: { ...current, sides: newSides } };
      }

      const oppositeSide: SidePosition = side === '포(듀스)' ? '백(애드)' : '포(듀스)';
      const newSides = { ...currentSides, [playerName]: side };
      if (partner) newSides[partner] = oppositeSide;
      return { ...prev, [key]: { ...current, sides: newSides } };
    });
  }, [editSchedule]);

  // 일괄 선수 교체
  const handlePlayerSwapAll = useCallback(async () => {
    if (!swapOldName || !swapNewName || swapOldName === swapNewName) {
      const msg = '기존/새 이름이 같거나 선택되지 않았습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
      return;
    }
    setEditSchedule(prev => prev.map(m => ({
      ...m,
      team1: m.team1.map(n => n === swapOldName ? swapNewName : n),
      team2: m.team2.map(n => n === swapOldName ? swapNewName : n),
    })));
    const msg = `'${swapOldName}' → '${swapNewName}' 교체 완료! 점수 저장을 눌러주세요.`;
    Platform.OS === 'web' ? alert(msg) : Alert.alert('완료', msg);
  }, [swapOldName, swapNewName]);

  // 한 게임만 선수 변경
  const handlePlayerSwapOne = useCallback(async () => {
    if (editGameIdx < 0 || editGameIdx >= editSchedule.length) return;
    const allPlayers = [...editTeam1, ...editTeam2].filter(n => n);
    if (allPlayers.length !== new Set(allPlayers).size) {
      const msg = '같은 선수가 중복되어 있습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
      return;
    }
    setEditSchedule(prev => {
      const next = [...prev];
      next[editGameIdx] = { ...next[editGameIdx], team1: editTeam1, team2: editTeam2 };
      return next;
    });
    const msg = `${editGameIdx + 1}번 게임 선수 변경 완료! 점수 저장을 눌러주세요.`;
    Platform.OS === 'web' ? alert(msg) : Alert.alert('완료', msg);
  }, [editGameIdx, editTeam1, editTeam2, editSchedule]);

  // 게임 삭제 확인 UI
  const handleGameDeleteRequest = useCallback((index: number) => {
    setDeleteConfirmIndex(index);
  }, []);

  // 게임 삭제 실행
  const handleGameDeleteExecute = useCallback((index: number) => {
    handleEditGameDelete(index);
    if (deleteGameIndex >= editSchedule.length - 1) {
      setDeleteGameIndex(Math.max(0, editSchedule.length - 2));
    }
  }, [handleEditGameDelete, deleteGameIndex, editSchedule.length]);

  // 대진표 텍스트 복사
  const copyScheduleAsText = useCallback(async () => {
    const maxCourt = Math.max(...activeEditMatches.map(m => m.court || 1), 1);
    const lines: string[] = [];
    const allPlayersInSession = new Set<string>();
    activeEditMatches.forEach(m => {
      m.team1.forEach(n => allPlayersInSession.add(n));
      m.team2.forEach(n => allPlayersInSession.add(n));
    });
    const fullRoster = [...allPlayersInSession];
    const totalRounds = Math.ceil(activeEditMatches.length / maxCourt);
    for (let round = 0; round < totalRounds; round++) {
      const roundMatches = activeEditMatches.slice(round * maxCourt, (round + 1) * maxCourt);
      const roundPlaying = new Set<string>();
      for (const match of roundMatches) {
        const courtNum = match.court || 1;
        lines.push(`${round + 1}게임 코트${courtNum} : ${match.team1.map(dn).join(',')} vs ${match.team2.map(dn).join(',')}`);
        match.team1.forEach(n => roundPlaying.add(n));
        match.team2.forEach(n => roundPlaying.add(n));
      }
      const resting = fullRoster.filter(n => !roundPlaying.has(n));
      if (resting.length > 0) {
        lines.push(`쉬는사람: ${resting.map(dn).join(',')}`);
      }
      if (round < totalRounds - 1) lines.push('');
    }
    const text = lines.join('\n');
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }
      const msg = '클립보드에 복사되었습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('알림', msg);
    } catch (e: any) {
      const msg = '클립보드 복사에 실패했습니다.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('오류', msg);
    }
  }, [activeEditMatches, dn]);

  // editGameIdx 변경 시 해당 게임의 선수 정보 로드
  useEffect(() => {
    if (editSchedule.length > 0 && editGameIdx >= 0 && editGameIdx < editSchedule.length) {
      const m = editSchedule[editGameIdx];
      setEditTeam1([...m.team1]);
      setEditTeam2([...m.team2]);
    }
  }, [editGameIdx, editSchedule]);

  // 전체 세션 로드 (전적 계산용)
  const loadAllSessions = useCallback(async () => {
    if (!clubCode) return;
    setSessionsLoading(true);
    try {
      const dates = await getSessionDates(clubCode);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const recentDates = dates.filter(d => new Date(d) >= sixMonthsAgo);
      const sessionPromises = recentDates.map(async (date) => {
        const session = await getSession(clubCode, date);
        return { date, session };
      });
      const results = await Promise.all(sessionPromises);
      const sessions: Record<string, Session> = {};
      for (const { date, session } of results) {
        if (session) sessions[date] = session;
      }
      setAllSessions(sessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  }, [clubCode]);

  useEffect(() => {
    if (clubCode && activeTab === 'daily') {
      loadAllSessions();
    }
  }, [clubCode, activeTab]);

  // 점수 카드 ref (JPG 저장용)
  const editScoreCardRef = useRef<View>(null);

  // Load monthly stats (also needed for personal tab)
  useEffect(() => {
    if (clubCode && (activeTab === 'monthly' || activeTab === 'personal' || activeTab === 'ranking')) {
      loadMonthlyStats();
    }
  }, [clubCode, selectedMonth, activeTab]);

  const loadMonthlyStats = async () => {
    if (!clubCode) return;
    setIsLoading(true);
    const [year, month] = selectedMonth.split('-').map(Number);
    const sessions = await getSessionsForMonth(clubCode, year, month);
    const memberSet = new Set(players.map((p) => p.name));
    const stats = aggregateStats(sessions, memberSet);
    const bests = getMonthlyBests(sessions, memberSet, rosterByName);
    const attendance = getAttendance(sessions, memberSet);
    setMonthlyStats(stats);
    setMonthlyBests(bests);
    setAttendanceData(attendance);
    setMonthlySessions(sessions);
    // 조별 생성 세션이 있으면 기본 조별 보기
    const hasGroupSession = Object.values(sessions).some((s: any) => s.groupOnly);
    if (hasGroupSession && club?.settings?.useGroups !== false) {
      setRankingViewMode('group');
    }
    setIsLoading(false);
  };

  // Load previous month stats for ranking comparison
  useEffect(() => {
    if (!clubCode || activeTab !== 'ranking' || rankingPeriod !== 'monthly') return;
    (async () => {
      const [y, m] = selectedMonth.split('-').map(Number);
      const prev = subMonths(new Date(y, m - 1, 1), 1);
      const pYear = prev.getFullYear();
      const pMonth = prev.getMonth() + 1;
      const sessions = await getSessionsForMonth(clubCode, pYear, pMonth);
      const memberSet = new Set(players.map((p) => p.name));
      setPrevMonthStats(aggregateStats(sessions, memberSet));
      setPrevMonthAttendance(getAttendance(sessions, memberSet));
    })();
  }, [clubCode, selectedMonth, activeTab, rankingPeriod]);

  // Load all-time stats for personal tab
  const loadAllTimeStats = async () => {
    if (!clubCode || Object.keys(allTimeSessions).length > 0) return; // Already loaded
    setIsLoadingAllTime(true);
    try {
      const dates = await getSessionDates(clubCode);
      const sessions: Record<string, any> = {};

      // Load all sessions
      for (const date of dates) {
        const session = await getSession(clubCode, date);
        if (session) {
          sessions[date] = session;
        }
      }

      const memberSet = new Set(players.map((p) => p.name));
      const stats = aggregateStats(sessions, memberSet);
      const attendance = getAttendance(sessions, memberSet);

      setAllTimeSessions(sessions);
      setAllTimeStats(stats);
      setAllTimeAttendance(attendance);
    } catch (error) {
      console.error('Error loading all-time stats:', error);
    } finally {
      setIsLoadingAllTime(false);
    }
  };

  // Load all-time stats when personal/ranking tab needs it
  useEffect(() => {
    if (clubCode && activeTab === 'personal' && personalPeriod === 'all') {
      loadAllTimeStats();
    }
    if (clubCode && activeTab === 'ranking' && rankingPeriod === 'all') {
      loadAllTimeStats();
    }
  }, [clubCode, activeTab, personalPeriod, rankingPeriod]);

  // Gemini AI 동물 프로필 비동기 로드
  useEffect(() => {
    if (activeTab !== 'personal' || !selectedPlayer || !clubCode) return;
    const apiKey = club?.settings?.geminiApiKey;
    if (!apiKey || isFeatureDisabled('disableAIAnalysis')) {
      setAiAnimalProfile(null);
      return;
    }

    // 선수 변경 시 이전 AI 결과 즉시 초기화
    setAiAnimalProfile(null);

    const sessions = personalPeriod === 'all' ? allTimeSessions : monthlySessions;
    const stats = personalPeriod === 'all' ? allTimeStats : monthlyStats;
    const attendance = personalPeriod === 'all' ? allTimeAttendance : attendanceData;

    if (!stats[selectedPlayer] || Object.keys(sessions).length === 0) return;

    const detailed = getDetailedPlayerStats(sessions, selectedPlayer);
    if (!detailed || detailed.games === 0) return;

    const bp = findBestPartner(sessions, selectedPlayer);
    const nm = findNemesis(sessions, selectedPlayer);

    // MVP count
    let mvp = 0;
    for (const date of Object.keys(sessions)) {
      const sess = sessions[date];
      const ap = new Set<string>();
      sess.schedule.forEach((m: any) => { m.team1.forEach((p: string) => ap.add(p)); m.team2.forEach((p: string) => ap.add(p)); });
      const ds = calculateDailyStats(sess, ap);
      if (findMVP(ds)?.name === selectedPlayer) mvp++;
    }

    // 해시로 변경 감지
    const hash = `${detailed.games}-${detailed.wins}-${detailed.losses}-${detailed.draws}-${mvp}`;
    const cached = aiProfileCacheRef.current[selectedPlayer];
    if (cached && cached.hash === hash) {
      setAiAnimalProfile(cached.profile);
      return;
    }

    let cancelled = false;
    setIsLoadingAnimal(true);

    generateAnimalProfileAI(apiKey, selectedPlayer, {
      winRate: detailed.winRate,
      games: detailed.games,
      wins: detailed.wins,
      losses: detailed.losses,
      draws: detailed.draws,
      avgScoreFor: detailed.avgScoreFor,
      avgScoreAgainst: detailed.avgScoreAgainst,
      scoreDiff: detailed.scoreDiff,
      longestWinStreak: detailed.longestWinStreak,
      longestLossStreak: detailed.longestLossStreak,
      recentForm: detailed.recentForm,
      bestPartnerName: bp ? bp.partner : undefined,
      bestPartnerWinRate: bp ? bp.winRate : undefined,
      nemesisName: nm ? nm.opponent : undefined,
      nemesisWinRate: nm ? nm.winRate : undefined,
      attendanceDays: attendance[selectedPlayer] || 0,
      mvpCount: mvp,
    }, clubCode).then((result) => {
      if (cancelled) return;
      if (result) {
        aiProfileCacheRef.current[selectedPlayer] = { hash, profile: result };
        setAiAnimalProfile(result);
      } else {
        setAiAnimalProfile(null);
      }
    }).finally(() => {
      if (!cancelled) setIsLoadingAnimal(false);
    });

    return () => { cancelled = true; };
  }, [selectedPlayer, personalPeriod, activeTab, allTimeSessions, monthlySessions, club?.settings?.geminiApiKey]);

  // Date options for select
  const dateOptions = sessionDates.map((d) => ({
    label: format(new Date(d), 'M월 d일 (EEE)', { locale: ko }),
    value: d,
  }));

  // Month options (last 6 months)
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      label: format(date, 'yyyy년 M월', { locale: ko }),
      value: format(date, 'yyyy-MM'),
    };
  });

  // Player options (selfOnly 모드: 본인만 표시)
  const playerOptions = useMemo(() => {
    if (isSectionRestricted('records.personal.selfOnly') && myPlayerName) {
      return [{ label: dn(myPlayerName), value: myPlayerName }];
    }
    return players.map((p) => ({
      label: dn(p.name),
      value: p.name,
    }));
  }, [players, sr, isAdmin, myPlayerName, dn]);

  // Daily stats
  const memberSet = new Set(players.map((p) => p.name));
  const dailyStats = selectedSession
    ? calculateDailyStats(selectedSession, memberSet)
    : {};
  const dailyMVP = findMVP(dailyStats);
  const dailyRanking = Object.values(dailyStats).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.scoreFor - b.scoreAgainst) - (a.scoreFor - a.scoreAgainst);
  });

  // Monthly ranking
  const monthlyRanking = getRankingByPoints(monthlyStats);

  // Render tabs
  const renderTabContent = () => {
    switch (activeTab) {
      case 'daily':
        // Navigate to previous/next available date
        const goToPrevDate = () => {
          const currentIdx = sessionDates.indexOf(selectedDate);
          if (currentIdx < sessionDates.length - 1) {
            setSelectedDate(sessionDates[currentIdx + 1]);
          }
        };
        const goToNextDate = () => {
          const currentIdx = sessionDates.indexOf(selectedDate);
          if (currentIdx > 0) {
            setSelectedDate(sessionDates[currentIdx - 1]);
          }
        };

        // Calendar days for the month
        const calendarDays = eachDayOfInterval({
          start: startOfMonth(calendarMonth),
          end: endOfMonth(calendarMonth),
        });
        const firstDayOfWeek = getDay(startOfMonth(calendarMonth));
        const selectedDateDisplay = selectedDate
          ? format(new Date(selectedDate), 'M월 d일 (EEEE)', { locale: ko })
          : '날짜를 선택하세요';

        return (
          <>
            {/* Date Navigation */}
            <View style={styles.dateNavRow}>
              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={goToPrevDate}
                disabled={sessionDates.indexOf(selectedDate) >= sessionDates.length - 1}
              >
                <FontAwesome name="chevron-left" size={16} color={sessionDates.indexOf(selectedDate) >= sessionDates.length - 1 ? 'rgba(0,0,0,0.3)' : tkColors.black} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.datePickerBtn}
                onPress={() => {
                  if (selectedDate) {
                    setCalendarMonth(new Date(selectedDate));
                  }
                  setShowDatePicker(true);
                }}
              >
                <FontAwesome name="calendar" size={14} color={tkColors.black} style={{ marginRight: 8 }} />
                <Text style={styles.dateText}>{selectedDateDisplay}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={goToNextDate}
                disabled={sessionDates.indexOf(selectedDate) <= 0}
              >
                <FontAwesome name="chevron-right" size={16} color={sessionDates.indexOf(selectedDate) <= 0 ? 'rgba(0,0,0,0.3)' : tkColors.black} />
              </TouchableOpacity>
            </View>

            {/* Date picker modal */}
            <Modal
              visible={showDatePicker}
              animationType="fade"
              transparent
              onRequestClose={() => setShowDatePicker(false)}
            >
              <TouchableOpacity
                style={styles.datePickerOverlay}
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
              >
                <View style={styles.datePickerModal}>
                  {/* Month navigation */}
                  <View style={styles.calendarHeader}>
                    <TouchableOpacity onPress={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                      <FontAwesome name="chevron-left" size={16} color={tkColors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={styles.calendarMonthText}>
                      {format(calendarMonth, 'yyyy년 M월', { locale: ko })}
                    </Text>
                    <TouchableOpacity onPress={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                      <FontAwesome name="chevron-right" size={16} color={tkColors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Weekday headers */}
                  <View style={styles.calendarWeekdays}>
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                      <Text key={day} style={[styles.calendarWeekday, i === 0 && styles.calendarSunday, i === 6 && styles.calendarSaturday]}>
                        {day}
                      </Text>
                    ))}
                  </View>

                  {/* Calendar days */}
                  <View style={styles.calendarDays}>
                    {/* Empty cells for first week */}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <View key={`empty-${i}`} style={styles.calendarDayCell} />
                    ))}
                    {calendarDays.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const hasSession = sessionDates.includes(dateStr);
                      const isSelected = dateStr === selectedDate;
                      const dayOfWeek = getDay(day);

                      return (
                        <TouchableOpacity
                          key={dateStr}
                          style={[
                            styles.calendarDayCell,
                            hasSession && styles.calendarDayHasSession,
                            isSelected && styles.calendarDaySelected,
                          ]}
                          onPress={() => {
                            if (hasSession) {
                              setSelectedDate(dateStr);
                              setShowDatePicker(false);
                            }
                          }}
                          disabled={!hasSession}
                        >
                          <Text style={[
                            styles.calendarDayText,
                            !hasSession && styles.calendarDayDisabled,
                            hasSession && styles.calendarDayEnabled,
                            isSelected && styles.calendarDaySelectedText,
                            dayOfWeek === 0 && styles.calendarSunday,
                            dayOfWeek === 6 && styles.calendarSaturday,
                          ]}>
                            {format(day, 'd')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Today button */}
                  <TouchableOpacity
                    style={styles.todayBtn}
                    onPress={() => {
                      const today = format(new Date(), 'yyyy-MM-dd');
                      if (sessionDates.includes(today)) {
                        setSelectedDate(today);
                      } else if (sessionDates.length > 0) {
                        setSelectedDate(sessionDates[0]);
                      }
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={styles.todayBtnText}>최근 기록으로 이동</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>

            {selectedSession && activeEditMatches.length > 0 ? (
              <>
                {/* Progress */}
                <Card>
                  <View style={styles.scProgressRow}>
                    <Text style={styles.scProgressLabel}>{editCompletedCount}/{activeEditMatches.length} 완료</Text>
                    <Text style={styles.scProgressPercent}>{editCompletionPercent}%</Text>
                  </View>
                  <ProgressBar
                    progress={editCompletionPercent / 100}
                    color={editCompletionPercent === 100 ? tkColors.success : tkColors.primary}
                    height={4}
                    style={{ marginTop: 8 }}
                  />
                </Card>

                {/* 오늘의 하이라이트 */}
                {!isFeatureDisabled('disableHighlights') && highlightData && highlightData.mvp && (
                  <Card title="⭐ 오늘의 하이라이트" style={{ marginTop: 4 }}>
                    <View style={{ gap: 6 }}>
                      <View style={styles.scHighlightRow}>
                        <Text style={styles.scHighlightEmoji}>📊</Text>
                        <Text style={styles.scHighlightLabel}>오늘 경기</Text>
                        <Text style={styles.scHighlightValue}>
                          출석 {highlightData.attendees.length}명, 총 {highlightData.totalGames}게임
                        </Text>
                      </View>
                      <View style={styles.scHighlightRow}>
                        <Text style={styles.scHighlightEmoji}>🏆</Text>
                        <Text style={styles.scHighlightLabel}>MVP</Text>
                        <Text style={styles.scHighlightValue}>
                          {dn(highlightData.mvp.name)} ({highlightData.mvp.stats.wins}승 {highlightData.mvp.stats.draws}무 {highlightData.mvp.stats.losses}패, 득실차 {highlightData.mvp.stats.scoreFor - highlightData.mvp.stats.scoreAgainst > 0 ? '+' : ''}{highlightData.mvp.stats.scoreFor - highlightData.mvp.stats.scoreAgainst})
                        </Text>
                      </View>
                      {highlightData.undefeated.length > 0 && (
                        <View style={styles.scHighlightRow}>
                          <Text style={styles.scHighlightEmoji}>🔥</Text>
                          <Text style={styles.scHighlightLabel}>무패</Text>
                          <Text style={styles.scHighlightValue}>{highlightData.undefeated.map(dn).join(', ')}</Text>
                        </View>
                      )}
                      {highlightData.shutoutLeaders.length > 0 && (
                        <View style={styles.scHighlightRow}>
                          <Text style={styles.scHighlightEmoji}>🥖</Text>
                          <Text style={styles.scHighlightLabel}>제빵</Text>
                          <Text style={styles.scHighlightValue}>{highlightData.shutoutLeaders.map(dn).join(', ')} ({highlightData.maxShutouts}회)</Text>
                        </View>
                      )}
                    </View>
                  </Card>
                )}

                {/* 경기 결과 총평 카드 */}
                {editCompletedCount > 0 && resultAnalysis && (
                  <Card style={{ marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ ...typography.section, color: tkColors.text, flex: 1 }}>경기 총평</Text>
                      {isAiResultAnalysis && (
                        <View style={{ backgroundColor: tkColors.male.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, color: tkColors.primary, fontWeight: '700' }}>AI</Text>
                        </View>
                      )}
                    </View>
                    {resultAnalysis.title ? (
                      <Text style={{ ...typography.body, fontWeight: '700', color: tkColors.text, marginBottom: 6, fontSize: 14 }}>
                        "{resultAnalysis.title}"
                      </Text>
                    ) : null}
                    <Text style={{ ...typography.caption, color: tkColors.textSecondary, lineHeight: 20 }}>
                      {resultAnalysis.summary}
                    </Text>
                    {isLoadingResultAnalysis && (
                      <Text style={{ ...typography.caption, color: tkColors.textTertiary, marginTop: 4 }}>AI 분석 중...</Text>
                    )}
                  </Card>
                )}

                {/* 대진별/개인별 보기 토글 */}
                <View style={styles.dailyViewToggle}>
                  <TouchableOpacity
                    style={[styles.dailyViewBtn, dailyViewMode === 'match' && styles.dailyViewBtnActive]}
                    onPress={() => setDailyViewMode('match')}
                  >
                    <Text style={[styles.dailyViewBtnText, dailyViewMode === 'match' && styles.dailyViewBtnTextActive]}>
                      대진별 보기
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dailyViewBtn, dailyViewMode === 'individual' && styles.dailyViewBtnActive]}
                    onPress={() => setDailyViewMode('individual')}
                  >
                    <Text style={[styles.dailyViewBtnText, dailyViewMode === 'individual' && styles.dailyViewBtnTextActive]}>
                      개인별 보기
                    </Text>
                  </TouchableOpacity>
                </View>

                {dailyViewMode === 'match' ? (
                <>
                <View ref={matchCardRefA}>
                {isSavingJpg && (
                  <View style={styles.scJpgWatermark}>
                    <Text style={styles.scJpgWatermarkText}>{selectedDate}  {club?.name || ''} 점수표</Text>
                  </View>
                )}
                {(() => {
                  const groupsSnapshot = selectedSession?.groupsSnapshot;
                  const groupOnly = selectedSession?.groupOnly;
                  const getMatchGroup = (m: typeof activeEditMatches[0]) =>
                    groupsSnapshot?.[m.team1[0]] || '미배정';

                  const renderMatchCards = (matches: typeof activeEditMatches, indexMap: number[], displayOffset = 0) => {
                    const actualCourtCount = matches.reduce((max, m) => Math.max(max, m.court || 1), 1);
                    const courtGroups: typeof matches[] = [];
                    for (let i = 0; i < matches.length; i += actualCourtCount) {
                      courtGroups.push(matches.slice(i, i + actualCourtCount));
                    }
                    return courtGroups.map((group, groupIndex) => (
                      <Card key={groupIndex} style={[styles.scScoreCard, isSavingJpg && { paddingVertical: spacing.xs }]}>
                        {group.map((match, matchIndexInGroup) => {
                          const localIdx = groupIndex * actualCourtCount + matchIndexInGroup;
                          const globalIndex = indexMap[localIdx];
                          const displayIndex = displayOffset + localIdx;
                          return renderSingleMatch(match, globalIndex, matchIndexInGroup, displayIndex);
                        })}
                      </Card>
                    ));
                  };

                  if (club?.settings?.useGroups !== false && groupOnly && groupsSnapshot && Object.keys(groupsSnapshot).length > 0) {
                    const groupMap: Record<string, { match: typeof activeEditMatches[0]; idx: number }[]> = {};
                    activeEditMatches.forEach((m, i) => {
                      const origIdx = editSchedule.indexOf(m);
                      const g = getMatchGroup(m);
                      if (!groupMap[g]) groupMap[g] = [];
                      groupMap[g].push({ match: m, idx: origIdx });
                    });
                    const sortedGroups = Object.keys(groupMap).sort();
                    return sortedGroups.map(gName => {
                      const items = groupMap[gName];
                      return (
                        <View key={gName}>
                          <Text style={styles.scGroupHeader}>{gName} 대진</Text>
                          {renderMatchCards(items.map(x => x.match), items.map(x => x.idx))}
                        </View>
                      );
                    });
                  }

                  const allIndexMap = activeEditMatches.map(m => editSchedule.indexOf(m));
                  return renderMatchCards(activeEditMatches, allIndexMap);

                  function renderSingleMatch(match: typeof activeEditMatches[0], globalIndex: number, matchIndexInGroup: number, displayIndex?: number) {
                    const displayNum = (displayIndex ?? globalIndex) + 1;
                    const result = editResults[String(globalIndex + 1)] || { t1: null, t2: null };
                    const isDoubles = match.team1.length === 2 && match.team2.length === 2;
                    const isCourtLocked = !!lockedCourts[globalIndex];
                    const isDisabled = scoreInputDisabled || isCourtLocked;

                    const prob = calculateMatchProbability(allSessions, match.team1, match.team2, rosterByName);
                    const team1Prob = prob?.hasEnoughData && prob.team1WinRate !== null
                      ? Math.max(10, Math.round(prob.team1WinRate * 100))
                      : null;
                    const team2Prob = prob?.hasEnoughData && prob.team2WinRate !== null
                      ? Math.max(10, Math.round(prob.team2WinRate * 100))
                      : null;

                    return (
                      <View
                        key={globalIndex}
                        style={[
                          styles.scMatchContainer,
                          matchIndexInGroup > 0 && styles.scMatchBorder,
                          isSavingJpg && { paddingVertical: 4 },
                        ]}
                      >
                        <View style={styles.scMatchHeader}>
                          <Text style={[styles.scMatchNo, isCourtLocked && { color: tkColors.textTertiary }]}>
                            {displayNum}번 경기 · 코트 {match.court}
                          </Text>
                          {!isSavingJpg && !lockDisabled && (
                            <TouchableOpacity
                              style={styles.scLockBtn}
                              onPress={() => setLockedCourts(prev => ({ ...prev, [globalIndex]: !prev[globalIndex] }))}
                            >
                              <FontAwesome name={isCourtLocked ? 'lock' : 'unlock-alt'} size={12} color={isCourtLocked ? tkColors.error : tkColors.textTertiary} />
                            </TouchableOpacity>
                          )}
                        </View>

                        <View style={styles.scTeams}>
                          <View style={styles.scTeamCol1}>
                            {match.team1.map((playerName: string, pIdx: number) => {
                              const playerGender = rosterByName[playerName]?.gender;
                              const nameStyle = playerGender === '남' ? styles.scTeamNameMale
                                : playerGender === '여' ? styles.scTeamNameFemale
                                : styles.scTeamName;
                              const partner = isDoubles ? match.team1.find((p: string) => p !== playerName) : null;
                              return (
                                <View key={pIdx} style={styles.scPlayerRowLeft}>
                                  {!isSavingJpg && (
                                  <TouchableOpacity
                                    style={styles.scRecordBtnSmall}
                                    onPress={() => setRecordModal({
                                      visible: true,
                                      player: playerName,
                                      partner: partner || null,
                                      opponents: match.team2,
                                      filterMode: 'all',
                                    })}
                                  >
                                    <FontAwesome name="bar-chart" size={9} color="#3b82f6" />
                                  </TouchableOpacity>
                                  )}
                                  <Text style={nameStyle} numberOfLines={1} ellipsizeMode="tail">{dn(playerName)}</Text>
                                  {isDoubles && (
                                    <View style={[styles.scSideToggle, isCourtLocked && { opacity: 0.4 }]}>
                                      <TouchableOpacity
                                        style={[styles.scSideBtn, result.sides?.[playerName] === '백(애드)' && styles.scSideBtnActive]}
                                        onPress={() => !isDisabled && handleSideChange(globalIndex, playerName, '백(애드)')}
                                        disabled={isDisabled}
                                      >
                                        <Text style={[styles.scSideBtnText, result.sides?.[playerName] === '백(애드)' && styles.scSideBtnTextActive]}>백</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.scSideBtn, result.sides?.[playerName] === '포(듀스)' && styles.scSideBtnActive]}
                                        onPress={() => !isDisabled && handleSideChange(globalIndex, playerName, '포(듀스)')}
                                        disabled={isDisabled}
                                      >
                                        <Text style={[styles.scSideBtnText, result.sides?.[playerName] === '포(듀스)' && styles.scSideBtnTextActive]}>포</Text>
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>

                          <View style={styles.scInputCol}>
                            {!isSavingJpg && (
                            <Text style={[styles.scProbText, team1Prob !== null && team2Prob !== null && team1Prob > team2Prob && styles.scProbTextHigh]}>
                              {team1Prob !== null ? `${team1Prob}%` : '-'}
                            </Text>
                            )}
                            <TouchableOpacity
                              style={[styles.scDropdown, isCourtLocked && { opacity: 0.4 }]}
                              onPress={() => !isDisabled && setScorePicker({ matchIndex: globalIndex, team: 't1' })}
                              disabled={isDisabled}
                            >
                              <Text style={styles.scDropdownText}>{result.t1 ?? '-'}</Text>
                              <FontAwesome name="caret-down" size={10} color={tkColors.textTertiary} />
                            </TouchableOpacity>
                            <Text style={styles.scColon}>:</Text>
                            <TouchableOpacity
                              style={[styles.scDropdown, isCourtLocked && { opacity: 0.4 }]}
                              onPress={() => !isDisabled && setScorePicker({ matchIndex: globalIndex, team: 't2' })}
                              disabled={isDisabled}
                            >
                              <Text style={styles.scDropdownText}>{result.t2 ?? '-'}</Text>
                              <FontAwesome name="caret-down" size={10} color={tkColors.textTertiary} />
                            </TouchableOpacity>
                            {!isSavingJpg && (
                            <Text style={[styles.scProbText, team1Prob !== null && team2Prob !== null && team2Prob > team1Prob && styles.scProbTextHigh]}>
                              {team2Prob !== null ? `${team2Prob}%` : '-'}
                            </Text>
                            )}
                          </View>

                          <View style={styles.scTeamCol2}>
                            {match.team2.map((playerName: string, pIdx: number) => {
                              const playerGender = rosterByName[playerName]?.gender;
                              const nameStyle = playerGender === '남' ? styles.scTeamNameMale
                                : playerGender === '여' ? styles.scTeamNameFemale
                                : styles.scTeamName;
                              const partner = isDoubles ? match.team2.find((p: string) => p !== playerName) : null;
                              return (
                                <View key={pIdx} style={styles.scPlayerRowRight}>
                                  {isDoubles && (
                                    <View style={[styles.scSideToggle, isCourtLocked && { opacity: 0.4 }]}>
                                      <TouchableOpacity
                                        style={[styles.scSideBtn, result.sides?.[playerName] === '백(애드)' && styles.scSideBtnActive]}
                                        onPress={() => !isDisabled && handleSideChange(globalIndex, playerName, '백(애드)')}
                                        disabled={isDisabled}
                                      >
                                        <Text style={[styles.scSideBtnText, result.sides?.[playerName] === '백(애드)' && styles.scSideBtnTextActive]}>백</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.scSideBtn, result.sides?.[playerName] === '포(듀스)' && styles.scSideBtnActive]}
                                        onPress={() => !isDisabled && handleSideChange(globalIndex, playerName, '포(듀스)')}
                                        disabled={isDisabled}
                                      >
                                        <Text style={[styles.scSideBtnText, result.sides?.[playerName] === '포(듀스)' && styles.scSideBtnTextActive]}>포</Text>
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                  <Text style={nameStyle} numberOfLines={1} ellipsizeMode="tail">{dn(playerName)}</Text>
                                  {!isSavingJpg && (
                                  <TouchableOpacity
                                    style={styles.scRecordBtnSmall}
                                    onPress={() => setRecordModal({
                                      visible: true,
                                      player: playerName,
                                      partner: partner || null,
                                      opponents: match.team1,
                                      filterMode: 'all',
                                    })}
                                  >
                                    <FontAwesome name="bar-chart" size={9} color="#3b82f6" />
                                  </TouchableOpacity>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    );
                  }
                })()}
                </View>

                {activeEditMatches.length > 0 && !scoreInputDisabled && (
                <TouchableOpacity
                  style={styles.photoScoreBtn}
                  onPress={() => handlePhotoScore()}
                  disabled={isRecognizingScore}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="image" size={14} color={tkColors.white} />
                  <Text style={styles.photoScoreBtnText}>
                    {isRecognizingScore ? 'AI 인식 중...' : '사진으로 점수입력'}
                  </Text>
                  {isRecognizingScore && <ActivityIndicator size="small" color={tkColors.white} style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                )}

                {activeEditMatches.length > 0 && (
                <View style={styles.scoreTemplBtnRow}>
                  <Checkbox
                    checked={includePlayerNames}
                    onPress={() => setIncludePlayerNames(p => !p)}
                    label="선수 이름 포함"
                  />
                  <TouchableOpacity
                    style={styles.scoreTemplBtn}
                    onPress={handleSaveScoreTemplate}
                    disabled={showScoreTemplate}
                    activeOpacity={0.7}
                  >
                    <FontAwesome name="file-text-o" size={13} color={tkColors.textSecondary} />
                    <Text style={styles.scoreTemplBtnText}>
                      {showScoreTemplate ? '저장 중...' : '빈 점수표 저장'}
                    </Text>
                  </TouchableOpacity>
                </View>
                )}

                <View style={styles.saveRow}>
                  <TouchableOpacity style={styles.saveJpgBtn} onPress={() => saveAsJpg(matchCardRefA, `점수입력_${selectedDate}`)}>
                    <FontAwesome name="camera" size={12} color={tkColors.textSecondary} />
                    <Text style={styles.saveJpgText}>JPG 저장</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveJpgBtn} onPress={copyScheduleAsText}>
                    <FontAwesome name="copy" size={12} color={tkColors.textSecondary} />
                    <Text style={styles.saveJpgText}>텍스트 복사</Text>
                  </TouchableOpacity>
                </View>

                <Button
                  title="점수 저장"
                  onPress={handleSaveEditedSession}
                  fullWidth
                  size="large"
                  style={{ marginTop: 8 }}
                />

                {/* 당일 선수 수정 섹션 */}
                {isAdmin && (
                <Card style={{ marginTop: 12 }}>
                  <TouchableOpacity
                    style={styles.scEditSectionHeader}
                    onPress={() => setShowPlayerEdit(!showPlayerEdit)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <FontAwesome
                        name={showPlayerEdit ? 'chevron-down' : 'chevron-right'}
                        size={12}
                        color={tkColors.textSecondary}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.scEditSectionTitle}>당일 선수 수정</Text>
                    </View>
                  </TouchableOpacity>

                  {showPlayerEdit && (
                    <View style={styles.scEditSectionContent}>
                      {dayPlayerNames.length === 0 ? (
                        <Text style={styles.scEditCaption}>대진표에 선수 정보가 없습니다.</Text>
                      ) : (
                        <>
                          <Select
                            label="바꿀 선수(기존)"
                            value={swapOldName}
                            options={dayPlayerNames.map(n => ({ label: dn(n), value: n }))}
                            onChange={(v) => setSwapOldName(v as string)}
                          />
                          <Select
                            label="변경할 선수(새)"
                            value={swapNewName}
                            options={
                              (rosterNames.length > 0 ? rosterNames : dayPlayerNames)
                                .filter(n => n !== swapOldName)
                                .map(n => ({ label: dn(n), value: n }))
                            }
                            onChange={(v) => setSwapNewName(v as string)}
                          />
                          <TouchableOpacity style={styles.scEditApplyBtn} onPress={handlePlayerSwapAll}>
                            <Text style={styles.scEditApplyBtnText}>변경 적용</Text>
                          </TouchableOpacity>
                          <Text style={styles.scEditCaption}>
                            ※ 적용하면 대진표에서 해당 이름이 전부 교체됩니다. 점수 저장을 눌러주세요.
                          </Text>
                        </>
                      )}

                      <View style={styles.scEditDivider} />

                      <Text style={styles.scEditSubTitle}>한 게임만 선수 변경</Text>
                      {editSchedule.length === 0 ? (
                        <Text style={styles.scEditCaption}>게임이 없어서 수정할 수 없습니다.</Text>
                      ) : (
                        <>
                          <Select
                            label="수정할 게임"
                            value={editGameIdx}
                            options={editSchedule.map((m, i) => ({
                              label: getGameLabel(m, i),
                              value: i,
                            }))}
                            onChange={(v) => setEditGameIdx(v as number)}
                          />
                          {editSchedule[editGameIdx] && (
                            <>
                              {editSchedule[editGameIdx].team1.length === 2 ? (
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.scEditTeamLabel}>팀1</Text>
                                    <Select label="팀1-1" value={editTeam1[0] || null}
                                      options={[...new Set([...rosterNames, ...dayPlayerNames])].filter(n => n && n !== editTeam1[1] && n !== editTeam2[0] && n !== editTeam2[1]).sort().map(n => ({ label: dn(n), value: n }))}
                                      onChange={(v) => setEditTeam1([v as string, editTeam1[1] || ''])} />
                                    <Select label="팀1-2" value={editTeam1[1] || null}
                                      options={[...new Set([...rosterNames, ...dayPlayerNames])].filter(n => n && n !== editTeam1[0] && n !== editTeam2[0] && n !== editTeam2[1]).sort().map(n => ({ label: dn(n), value: n }))}
                                      onChange={(v) => setEditTeam1([editTeam1[0] || '', v as string])} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.scEditTeamLabel}>팀2</Text>
                                    <Select label="팀2-1" value={editTeam2[0] || null}
                                      options={[...new Set([...rosterNames, ...dayPlayerNames])].filter(n => n && n !== editTeam1[0] && n !== editTeam1[1] && n !== editTeam2[1]).sort().map(n => ({ label: dn(n), value: n }))}
                                      onChange={(v) => setEditTeam2([v as string, editTeam2[1] || ''])} />
                                    <Select label="팀2-2" value={editTeam2[1] || null}
                                      options={[...new Set([...rosterNames, ...dayPlayerNames])].filter(n => n && n !== editTeam1[0] && n !== editTeam1[1] && n !== editTeam2[0]).sort().map(n => ({ label: dn(n), value: n }))}
                                      onChange={(v) => setEditTeam2([editTeam2[0] || '', v as string])} />
                                  </View>
                                </View>
                              ) : (
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <View style={{ flex: 1 }}>
                                    <Select label="팀1 선수" value={editTeam1[0] || null}
                                      options={[...new Set([...rosterNames, ...dayPlayerNames])].filter(n => n && n !== editTeam2[0]).sort().map(n => ({ label: dn(n), value: n }))}
                                      onChange={(v) => setEditTeam1([v as string])} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Select label="팀2 선수" value={editTeam2[0] || null}
                                      options={[...new Set([...rosterNames, ...dayPlayerNames])].filter(n => n && n !== editTeam1[0]).sort().map(n => ({ label: dn(n), value: n }))}
                                      onChange={(v) => setEditTeam2([v as string])} />
                                  </View>
                                </View>
                              )}
                              <TouchableOpacity style={styles.scEditApplyBtn} onPress={handlePlayerSwapOne}>
                                <Text style={styles.scEditApplyBtnText}>이 게임만 변경 적용</Text>
                              </TouchableOpacity>
                              <Text style={styles.scEditCaption}>
                                ※ 선택한 1게임만 선수 구성을 바꿉니다. 점수 저장을 눌러주세요.
                              </Text>
                            </>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </Card>
                )}

                {/* 게임 순서 변경 및 삭제 섹션 */}
                {isAdmin && (
                <Card style={{ marginTop: 8 }}>
                  <TouchableOpacity
                    style={styles.scEditSectionHeader}
                    onPress={() => setShowGameReorder(!showGameReorder)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <FontAwesome
                        name={showGameReorder ? 'chevron-down' : 'chevron-right'}
                        size={12}
                        color={tkColors.textSecondary}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.scEditSectionTitle}>게임 순서 변경 및 삭제</Text>
                    </View>
                  </TouchableOpacity>

                  {showGameReorder && (
                    <View style={styles.scEditSectionContent}>
                      {editSchedule.length <= 1 ? (
                        <Text style={styles.scEditCaption}>게임이 1개라서 순서를 바꿀 수 없습니다.</Text>
                      ) : (
                        <>
                          <Select
                            label="교환할 게임 A"
                            value={swapGameA}
                            options={editSchedule.map((m, i) => ({ label: getGameLabel(m, i), value: i }))}
                            onChange={(v) => setSwapGameA(v as number)}
                          />
                          <Select
                            label="교환할 게임 B"
                            value={swapGameB}
                            options={editSchedule.map((m, i) => ({ label: getGameLabel(m, i), value: i }))}
                            onChange={(v) => setSwapGameB(v as number)}
                          />
                          <TouchableOpacity style={styles.scEditApplyBtn} onPress={handleEditGameSwap}>
                            <Text style={styles.scEditApplyBtnText}>순서 변경 적용</Text>
                          </TouchableOpacity>
                          <Text style={styles.scEditCaption}>
                            ※ 선택한 두 게임의 순서를 서로 교환합니다. (점수도 해당 게임과 같이 교환)
                          </Text>
                        </>
                      )}

                      <View style={styles.scEditDivider} />

                      <Text style={styles.scEditSubTitle}>게임 삭제</Text>
                      {editSchedule.length === 0 ? (
                        <Text style={styles.scEditCaption}>삭제할 게임이 없습니다.</Text>
                      ) : (
                        <>
                          <Select
                            label="삭제할 게임"
                            value={deleteGameIndex}
                            options={editSchedule.map((m, i) => ({ label: getGameLabel(m, i), value: i }))}
                            onChange={(v) => { setDeleteGameIndex(v as number); setDeleteConfirmIndex(null); }}
                          />
                          <TouchableOpacity
                            style={styles.scEditDeleteBtn}
                            onPress={() => handleGameDeleteRequest(deleteGameIndex)}
                          >
                            <Text style={styles.scEditDeleteBtnText}>선택 게임 삭제</Text>
                          </TouchableOpacity>

                          {deleteConfirmIndex !== null && deleteConfirmIndex === deleteGameIndex && (
                            <View style={{ marginTop: 8 }}>
                              <Text style={styles.scEditDeleteWarning}>
                                {getGameLabel(editSchedule[deleteConfirmIndex], deleteConfirmIndex)}
                                {'\n'}정말 삭제하시겠습니까?
                              </Text>
                              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                <TouchableOpacity
                                  style={[styles.scEditDeleteBtn, { flex: 1 }]}
                                  onPress={() => handleGameDeleteExecute(deleteConfirmIndex)}
                                >
                                  <Text style={styles.scEditDeleteBtnText}>네, 삭제합니다</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.scEditCancelBtn, { flex: 1 }]}
                                  onPress={() => setDeleteConfirmIndex(null)}
                                >
                                  <Text style={styles.scEditCancelBtnText}>취소</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </Card>
                )}

                {/* 오늘 게임 전체 삭제 */}
                {isAdmin && (
                <View style={{ marginTop: 12 }}>
                  {!showDeleteSessionConfirm ? (
                    <TouchableOpacity
                      style={styles.scDeleteSessionBtn}
                      onPress={() => setShowDeleteSessionConfirm(true)}
                    >
                      <FontAwesome name="trash" size={14} color="#fff" />
                      <Text style={styles.scDeleteSessionBtnText}>오늘 게임 전체 삭제</Text>
                    </TouchableOpacity>
                  ) : (
                    <Card style={{ borderColor: tkColors.error, borderWidth: 1 }}>
                      <Text style={styles.scDeleteSessionWarning}>
                        {selectedDate} 대진이 삭제됩니다.{'\n'}삭제하시겠습니까?
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <TouchableOpacity
                          style={[styles.scDeleteSessionConfirmBtn, { flex: 1 }]}
                          onPress={async () => {
                            if (!clubCode || !selectedDate) return;
                            const ok = await deleteSession(clubCode, selectedDate);
                            if (ok) {
                              setShowDeleteSessionConfirm(false);
                              setSelectedSession(null);
                              setEditSchedule([]);
                              setEditResults({});
                              bumpSessionVersion();
                              await loadSessionDates();
                            }
                          }}
                        >
                          <Text style={styles.scDeleteSessionConfirmBtnText}>예</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.scDeleteSessionCancelBtn, { flex: 1 }]}
                          onPress={() => setShowDeleteSessionConfirm(false)}
                        >
                          <Text style={styles.scDeleteSessionCancelBtnText}>아니오</Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  )}
                </View>
                )}
                </>
                ) : (
                /* 개인별 보기 */
                <>
                {(() => {
                  const groupsSnapshot = selectedSession?.groupsSnapshot;
                  const groupOnly = selectedSession?.groupOnly;

                  const renderIndivTable = (ranking: typeof dailyRanking, title?: string) => (
                    <Card title={title || '개인별 스코어'} style={{ marginTop: spacing.sm }}>
                      <View style={styles.indivTable}>
                        {ranking.map((stat, rankIndex) => {
                          const playerGender = rosterByName[stat.name]?.gender;
                          const playedGames: { myScore: number; oppScore: number; isWin: boolean; isDraw: boolean; gameNum: number }[] = [];
                          activeEditMatches.forEach((match) => {
                            const origIdx = editSchedule.indexOf(match);
                            const r = editResults[String(origIdx + 1)];
                            const inT1 = match.team1.includes(stat.name);
                            const inT2 = match.team2.includes(stat.name);
                            if (!inT1 && !inT2) return;
                            if (!r || r.t1 === null || r.t1 === undefined) {
                              playedGames.push({ myScore: -1, oppScore: -1, isWin: false, isDraw: false, gameNum: origIdx + 1 });
                              return;
                            }
                            const myScore = inT1 ? r.t1 : r.t2;
                            const oppScore = inT1 ? r.t2 : r.t1;
                            playedGames.push({ myScore, oppScore, isWin: myScore > oppScore, isDraw: myScore === oppScore, gameNum: origIdx + 1 });
                          });
                          return (
                            <View key={stat.name} style={styles.indivRow}>
                              <View style={styles.indivNameCol}>
                                <Text style={styles.indivRank}>{rankIndex + 1}</Text>
                                <TouchableOpacity
                                  onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(stat.name)}`)}
                                >
                                  <PlayerNameBadge name={dn(stat.name)} gender={playerGender} />
                                </TouchableOpacity>
                              </View>
                              <View style={styles.indivGamesCol}>
                                {playedGames.map((game, gi) => (
                                  <View key={gi} style={[
                                    styles.indivGameCell,
                                    game.myScore === -1 ? styles.cellNoResult :
                                      game.isWin ? styles.cellWin :
                                      game.isDraw ? styles.cellDraw : styles.cellLoss
                                  ]}>
                                    <Text style={styles.indivGameNum}>{game.gameNum}</Text>
                                    <Text style={styles.indivGameScore}>
                                      {game.myScore === -1 ? '-' : `${game.myScore}:${game.oppScore}`}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                              <View style={styles.indivSummaryCol}>
                                <Text style={styles.indivRecord}>
                                  {stat.wins}승{stat.draws}무{stat.losses}패
                                </Text>
                                <Text style={[
                                  styles.indivDiff,
                                  stat.scoreFor - stat.scoreAgainst > 0 && styles.statDiffPositive,
                                  stat.scoreFor - stat.scoreAgainst < 0 && styles.statDiffNegative
                                ]}>
                                  {stat.scoreFor - stat.scoreAgainst > 0 ? '+' : ''}{stat.scoreFor - stat.scoreAgainst}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </Card>
                  );

                  if (club?.settings?.useGroups !== false && groupOnly && groupsSnapshot && Object.keys(groupsSnapshot).length > 0) {
                    const groupNames = [...new Set(Object.values(groupsSnapshot))].sort();
                    return (
                      <View ref={indivCardRefA}>
                        {groupNames.map(gName => {
                          const groupRanking = dailyRanking.filter(s => (groupsSnapshot[s.name] || '미배정') === gName);
                          if (groupRanking.length === 0) return null;
                          return <React.Fragment key={gName}>{renderIndivTable(groupRanking, `${gName} 개인별 스코어`)}</React.Fragment>;
                        })}
                      </View>
                    );
                  }
                  return (
                    <View ref={indivCardRefA}>
                      {renderIndivTable(dailyRanking)}
                    </View>
                  );
                })()}
                <View style={styles.saveRow}>
                  <TouchableOpacity style={styles.saveJpgBtn} onPress={() => saveAsJpg(indivCardRefA, `개인별스코어_${selectedDate}`)}>
                    <FontAwesome name="camera" size={12} color={tkColors.textSecondary} />
                    <Text style={styles.saveJpgText}>JPG 저장</Text>
                  </TouchableOpacity>
                </View>
                </>
                )}
              </>
            ) : (
              <Card>
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {isLoading ? '로딩중...' : '선택한 날짜에 경기 기록이 없습니다.'}
                  </Text>
                </View>
              </Card>
            )}

            {/* Score Recognition Confirmation Modal */}
            <Modal
              visible={showScoreConfirmModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowScoreConfirmModal(false)}
            >
              <View style={styles.scoreRecogOverlay}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => setShowScoreConfirmModal(false)}
                />
                <View style={styles.scoreRecogModal}>
                  <Text style={styles.scoreRecogTitle}>AI 점수 인식 결과</Text>
                  {scoreRecognitionResult?.rawText ? (
                    <Text style={styles.scoreRecogRawText}>{scoreRecognitionResult.rawText}</Text>
                  ) : null}
                  <ScrollView style={{ maxHeight: 350 }}>
                    {scoreRecognitionResult?.matches.map((match) => {
                      const scheduleMatch = activeEditMatches[match.matchNumber - 1];
                      if (!scheduleMatch) return null;
                      const isLow = match.confidence === 'low';
                      const isMed = match.confidence === 'medium';
                      return (
                        <View
                          key={match.matchNumber}
                          style={[styles.scoreRecogItem, isLow && styles.scoreRecogItemWarn]}
                        >
                          <Text style={styles.scoreRecogMatchNo}>
                            {match.matchNumber}번 경기{isLow ? ' (불확실)' : isMed ? ' (?)' : ''}
                          </Text>
                          <Text style={styles.scoreRecogTeams}>
                            {scheduleMatch.team1.map(n => dn(n)).join(', ')} vs {scheduleMatch.team2.map(n => dn(n)).join(', ')}
                          </Text>
                          <Text style={styles.scoreRecogScore}>
                            {match.team1Score ?? '-'} : {match.team2Score ?? '-'}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.scoreRecogActions}>
                    <TouchableOpacity
                      style={styles.scoreRecogCancelBtn}
                      onPress={() => setShowScoreConfirmModal(false)}
                    >
                      <Text style={styles.scoreRecogCancelText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.scoreRecogApplyBtn}
                      onPress={() => {
                        if (!scoreRecognitionResult) return;
                        setEditResults(prev => {
                          const next = { ...prev };
                          for (const m of scoreRecognitionResult.matches) {
                            if (m.team1Score != null && m.team2Score != null) {
                              const sm = activeEditMatches[m.matchNumber - 1];
                              if (sm) {
                                const origIdx = editSchedule.indexOf(sm);
                                if (origIdx >= 0) {
                                  next[String(origIdx + 1)] = { t1: m.team1Score, t2: m.team2Score };
                                }
                              }
                            }
                          }
                          return next;
                        });
                        setShowScoreConfirmModal(false);
                        const applied = scoreRecognitionResult.matches.filter(m => m.team1Score != null && m.team2Score != null).length;
                        setScoreRecognitionResult(null);
                        const msg = `${applied}경기 점수가 입력되었습니다.\n"점수 저장" 버튼을 눌러 저장하세요.`;
                        Platform.OS === 'web' ? alert(msg) : Alert.alert('완료', msg);
                      }}
                    >
                      <Text style={styles.scoreRecogApplyText}>점수 적용</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* 빈 점수표 템플릿 (화면 밖 - 캡처용) */}
            {showScoreTemplate && (
              <View style={styles.scoreTemplOffscreen}>
                <View ref={scoreTemplateRef} style={styles.scoreTemplSheet}>
                  <Text style={styles.scoreTemplTitle}>
                    {club?.name || '테니스 클럽'}  {selectedDate}  경기 점수표
                  </Text>
                  <View style={styles.scoreTemplTable}>
                    <View style={[styles.scoreTemplRow, styles.scoreTemplHeaderRow]}>
                      <Text style={[styles.scoreTemplCell, styles.scoreTemplNumCell, styles.scoreTemplHeaderText]}>#</Text>
                      <Text style={[styles.scoreTemplCell, styles.scoreTemplNameCell, styles.scoreTemplHeaderText]}>팀 1</Text>
                      <Text style={[styles.scoreTemplCell, styles.scoreTemplScoreCell, styles.scoreTemplHeaderText]}>점수</Text>
                      <Text style={[styles.scoreTemplCell, styles.scoreTemplNameCell, styles.scoreTemplHeaderText]}>팀 2</Text>
                    </View>
                    {activeEditMatches.map((m, idx) => (
                      <View key={idx} style={[styles.scoreTemplRow, idx % 2 === 1 && styles.scoreTemplRowAlt]}>
                        <Text style={[styles.scoreTemplCell, styles.scoreTemplNumCell]}>{idx + 1}</Text>
                        <Text style={[styles.scoreTemplCell, styles.scoreTemplNameCell]}>
                          {includePlayerNames ? m.team1.map(n => dn(n)).join(', ') : '________'}
                        </Text>
                        <Text style={[styles.scoreTemplCell, styles.scoreTemplScoreCell, styles.scoreTemplScoreText]}>
                          ____  :  ____
                        </Text>
                        <Text style={[styles.scoreTemplCell, styles.scoreTemplNameCell]}>
                          {includePlayerNames ? m.team2.map(n => dn(n)).join(', ') : '________'}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.scoreTemplFooter}>
                    점수를 기입 후 사진을 찍어 앱에서 "사진으로 점수입력"으로 인식하세요
                  </Text>
                </View>
              </View>
            )}

            {/* Score Picker Modal */}
            <Modal
              visible={scorePicker !== null}
              transparent
              animationType="fade"
              onRequestClose={() => setScorePicker(null)}
            >
              <TouchableOpacity
                style={styles.scorePickerOverlay}
                activeOpacity={1}
                onPress={() => setScorePicker(null)}
              >
                <View style={styles.scorePickerContainer} onStartShouldSetResponder={() => true}>
                  <Text style={styles.scorePickerTitle}>점수 선택</Text>
                  <View style={styles.scorePickerGrid}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[
                          styles.scorePickerItem,
                          scorePicker && editResults[String(scorePicker.matchIndex + 1)]?.[scorePicker.team] === v && styles.scorePickerItemActive,
                        ]}
                        onPress={() => {
                          if (scorePicker) {
                            handleEditScoreSelect(scorePicker.matchIndex, scorePicker.team, v);
                            setScorePicker(null);
                          }
                        }}
                      >
                        <Text style={[
                          styles.scorePickerItemText,
                          scorePicker && editResults[String(scorePicker.matchIndex + 1)]?.[scorePicker.team] === v && styles.scorePickerItemTextActive,
                        ]}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Record Modal */}
            <Modal
              visible={recordModal.visible}
              transparent
              animationType="fade"
              onRequestClose={() => setRecordModal({ ...recordModal, visible: false })}
            >
              <TouchableOpacity style={styles.scorePickerOverlay} activeOpacity={1} onPress={() => setRecordModal({ ...recordModal, visible: false })}>
                <View style={styles.scRecordContainer} onStartShouldSetResponder={() => true}>
                  <Text style={styles.scRecordTitle}>
                    {dn(recordModal.player)} 전적
                  </Text>
                  <View style={styles.scRecordFilterRow}>
                    <TouchableOpacity
                      style={[styles.scRecordFilterBtn, recordModal.filterMode === 'all' && styles.scRecordFilterBtnActive]}
                      onPress={() => setRecordModal({ ...recordModal, filterMode: 'all' })}
                    >
                      <Text style={[styles.scRecordFilterBtnText, recordModal.filterMode === 'all' && styles.scRecordFilterBtnTextActive]}>전체</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.scRecordFilterBtn, recordModal.filterMode === 'recent5' && styles.scRecordFilterBtnActive]}
                      onPress={() => setRecordModal({ ...recordModal, filterMode: 'recent5' })}
                    >
                      <Text style={[styles.scRecordFilterBtnText, recordModal.filterMode === 'recent5' && styles.scRecordFilterBtnTextActive]}>최근 5경기</Text>
                    </TouchableOpacity>
                  </View>
                  {/* 파트너 전적 */}
                  {recordModal.partner && (
                    <View style={styles.scRecordSection}>
                      <Text style={styles.scRecordSectionTitle}>파트너 전적 ({dn(recordModal.partner)})</Text>
                      {(() => {
                        const h2h = getHeadToHead(allSessions, recordModal.player, recordModal.partner,
                          recordModal.filterMode === 'recent5' ? { limitPartner: 5 } : undefined);
                        if (h2h.asPartner.games === 0) return <Text style={styles.scRecordNoData}>기록 없음</Text>;
                        const winRate = Math.round((h2h.asPartner.wins / h2h.asPartner.games) * 100);
                        return (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.scRecordStatText}>
                              {h2h.asPartner.wins}승 {h2h.asPartner.draws}무 {h2h.asPartner.losses}패 ({h2h.asPartner.games}경기)
                            </Text>
                            <Text style={[styles.scRecordWinRateSmall, winRate >= 50 ? styles.scRecordWinRateHigh : styles.scRecordWinRateLow]}>
                              승률 {winRate}%
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* 상대 전적 */}
                  <View style={styles.scRecordSection}>
                    <Text style={styles.scRecordSectionTitle}>상대 전적</Text>
                    {sessionsLoading ? (
                      <Text style={styles.scRecordNoData}>데이터 로딩중...</Text>
                    ) : Object.keys(allSessions).length === 0 ? (
                      <Text style={styles.scRecordNoData}>저장된 경기 기록 없음</Text>
                    ) : (
                      recordModal.opponents.map((opp) => {
                        const h2h = getHeadToHead(allSessions, recordModal.player, opp,
                          recordModal.filterMode === 'recent5' ? { limitPartner: 5, limitOpponent: 5 } : undefined);
                        if (h2h.asOpponent.games === 0) {
                          return (
                            <View key={opp} style={styles.scRecordOpponentRow}>
                              <Text style={styles.scRecordOpponentName}>{dn(opp)}</Text>
                              <Text style={styles.scRecordNoData}>기록 없음</Text>
                            </View>
                          );
                        }
                        const winRate = h2h.asOpponent.games > 0
                          ? Math.round((h2h.asOpponent.wins / h2h.asOpponent.games) * 100) : 0;
                        return (
                          <View key={opp} style={styles.scRecordOpponentRow}>
                            <Text style={styles.scRecordOpponentName}>{dn(opp)}</Text>
                            <Text style={styles.scRecordStatText}>
                              {h2h.asOpponent.wins}승 {h2h.asOpponent.draws}무 {h2h.asOpponent.losses}패
                            </Text>
                            <Text style={[styles.scRecordWinRateSmall, winRate >= 50 ? styles.scRecordWinRateHigh : styles.scRecordWinRateLow]}>
                              {winRate}%
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                  <TouchableOpacity style={styles.scRecordCloseBtn} onPress={() => setRecordModal({ ...recordModal, visible: false })}>
                    <Text style={styles.scRecordCloseBtnText}>닫기</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          </>
        );

      case 'monthly':

        // Get sorted dates for the month
        const monthlyDates = Object.keys(monthlySessions).sort((a, b) => b.localeCompare(a));

        return (
          <>
            <Select
              label="월 선택"
              value={selectedMonth}
              options={monthOptions}
              onChange={(v) => setSelectedMonth(v as string)}
            />

            {/* Monthly Bests - 선수별 */}
            {!isSectionRestricted('records.monthly.playerBests') && monthlyBests && (monthlyBests.mvp || monthlyBests.scoreDiffKing || monthlyBests.peacemaker) && (
              <Card title="🏅 선수별 BEST">
                <View style={styles.playerBestsList}>
                  {monthlyBests.mvp && (
                    <View style={styles.playerBestRow}>
                      <Text style={styles.playerBestEmoji}>🏆</Text>
                      <Text style={styles.playerBestLabel}>MVP</Text>
                      <Text style={styles.playerBestValue}>
                        {dn(monthlyBests.mvp.name)} (승점 {monthlyBests.mvp.points}점, 참석 {monthlyBests.mvp.attendance}일, 득실차 {monthlyBests.mvp.scoreDiff > 0 ? '+' : ''}{monthlyBests.mvp.scoreDiff})
                      </Text>
                    </View>
                  )}
                  {monthlyBests.scoreDiffKing && (
                    <View style={styles.playerBestRow}>
                      <Text style={styles.playerBestEmoji}>🎯</Text>
                      <Text style={styles.playerBestLabel}>격차왕</Text>
                      <Text style={styles.playerBestValue}>
                        {dn(monthlyBests.scoreDiffKing.name)} (평균 득점 {monthlyBests.scoreDiffKing.avgFor.toFixed(2)}, 평균 실점 {monthlyBests.scoreDiffKing.avgAgainst.toFixed(2)}, 격차 {monthlyBests.scoreDiffKing.avgDiff.toFixed(2)})
                      </Text>
                    </View>
                  )}
                  {monthlyBests.peacemaker && (
                    <View style={styles.playerBestRow}>
                      <Text style={styles.playerBestEmoji}>🕊️</Text>
                      <Text style={styles.playerBestLabel}>평화주의자</Text>
                      <Text style={styles.playerBestValue}>
                        {dn(monthlyBests.peacemaker.name)} ({monthlyBests.peacemaker.draws}무)
                      </Text>
                    </View>
                  )}
                  {monthlyBests.friendshipKing && (
                    <View style={styles.playerBestRow}>
                      <Text style={styles.playerBestEmoji}>🤝</Text>
                      <Text style={styles.playerBestLabel}>우정왕</Text>
                      <Text style={styles.playerBestValue}>
                        {monthlyBests.friendshipKing.names.map(dn).join(', ')} (만난 파트너 수 {monthlyBests.friendshipKing.count}명)
                      </Text>
                    </View>
                  )}
                  {monthlyBests.attendanceKing && (
                    <View style={styles.playerBestRow}>
                      <Text style={styles.playerBestEmoji}>👑</Text>
                      <Text style={styles.playerBestLabel}>출석왕</Text>
                      <Text style={styles.playerBestValue}>
                        {monthlyBests.attendanceKing.names.map(dn).join(', ')} (참석 {monthlyBests.attendanceKing.days}일)
                      </Text>
                    </View>
                  )}
                  {monthlyBests.winStreakKing && (
                    <View style={styles.playerBestRow}>
                      <Text style={styles.playerBestEmoji}>🔥</Text>
                      <Text style={styles.playerBestLabel}>연승왕</Text>
                      <Text style={styles.playerBestValue}>
                        {dn(monthlyBests.winStreakKing.name)} (최대 {monthlyBests.winStreakKing.streak}연승)
                      </Text>
                    </View>
                  )}
                  {monthlyBests.bakeryKing && (
                    <View style={styles.playerBestRow}>
                      <Text style={styles.playerBestEmoji}>🥖</Text>
                      <Text style={styles.playerBestLabel}>제빵왕</Text>
                      <Text style={styles.playerBestValue}>
                        {dn(monthlyBests.bakeryKing.name)} (상대를 0점으로 이긴 경기 {monthlyBests.bakeryKing.count}번)
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            )}

            {/* 순위표 전체/조별 토글 */}
            {(() => {
              const canShowGroup = club?.settings?.useGroups !== false
                && !isSectionRestricted('records.monthly.groupRanking')
                && (isAdmin || !club?.settings?.hideGroupFromMembers);
              const groups = club?.settings?.groups || [];
              return (
              <>
              {canShowGroup && (
                <View style={styles.groupFilterRow}>
                  <TouchableOpacity
                    style={[styles.groupFilterBtn, rankingViewMode === 'all' && styles.groupFilterBtnActive]}
                    onPress={() => setRankingViewMode('all')}
                  >
                    <Text style={[styles.groupFilterText, rankingViewMode === 'all' && styles.groupFilterTextActive]}>전체</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.groupFilterBtn, rankingViewMode === 'group' && styles.groupFilterBtnActive]}
                    onPress={() => setRankingViewMode('group')}
                  >
                    <Text style={[styles.groupFilterText, rankingViewMode === 'group' && styles.groupFilterTextActive]}>조별</Text>
                  </TouchableOpacity>
                </View>
              )}

              {rankingViewMode === 'all' || !canShowGroup ? (
                monthlyRanking.length > 0 ? (
                <Card>
                  <View style={styles.monthlyTitleRow}>
                    <Text style={styles.monthlyTitleText}>월간 순위표</Text>
                    <Text style={styles.monthlyTitleSub}>승=3점, 무=1점, 패=0점</Text>
                  </View>
                  <View style={styles.monthlyTableHeader}>
                    <Text style={[styles.monthlyCell, styles.cellRank]}>#</Text>
                    <Text style={[styles.monthlyCell, styles.cellName]}>이름</Text>
                    <Text style={[styles.monthlyCell, styles.cellPoints]}>승점</Text>
                    <Text style={[styles.monthlyCell, styles.cellDays]}>출석</Text>
                    <Text style={[styles.monthlyCell, styles.cellGames]}>경기</Text>
                    <Text style={[styles.monthlyCell, styles.cellWLD]}>승/무/패</Text>
                    <Text style={[styles.monthlyCell, styles.cellRate]}>승률</Text>
                  </View>
                  {monthlyRanking.map((stat, index) => {
                    const points = stat.wins * 3 + stat.draws * 1;
                    return (
                    <View key={stat.name} style={styles.monthlyTableRow}>
                      <Text style={[styles.monthlyCell, styles.cellRank]}>{index + 1}</Text>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(stat.name)}`)}
                      >
                        <Text style={[styles.monthlyCell, styles.cellName]}>{dn(stat.name)}</Text>
                      </TouchableOpacity>
                      <Text style={[styles.monthlyCell, styles.cellPoints, styles.monthlyPoints]}>{points}</Text>
                      <Text style={[styles.monthlyCell, styles.cellDays]}>{attendanceData[stat.name] || 0}일</Text>
                      <Text style={[styles.monthlyCell, styles.cellGames]}>{stat.games}</Text>
                      <Text style={[styles.monthlyCell, styles.cellWLD]}>
                        {stat.wins}/{stat.draws}/{stat.losses}
                      </Text>
                      <Text style={[styles.monthlyCell, styles.cellRate, styles.monthlyWinRate]}>
                        {(stat.winRate * 100).toFixed(0)}%
                      </Text>
                    </View>
                    );
                  })}
                </Card>
                ) : null
              ) : (
                groups.map((groupName) => {
                  const groupRanking = monthlyRanking.filter((stat) => {
                    const player = players.find((p) => p.name === stat.name);
                    return player?.group === groupName;
                  });
                  if (groupRanking.length === 0) return null;
                  return (
                  <Card key={groupName}>
                    <View style={styles.monthlyTitleRow}>
                      <Text style={styles.monthlyTitleText}>{groupName} 순위표</Text>
                      <Text style={styles.monthlyTitleSub}>{groupRanking.length}명</Text>
                    </View>
                    <View style={styles.monthlyTableHeader}>
                      <Text style={[styles.monthlyCell, styles.cellRank]}>#</Text>
                      <Text style={[styles.monthlyCell, styles.cellName]}>이름</Text>
                      <Text style={[styles.monthlyCell, styles.cellPoints]}>승점</Text>
                      <Text style={[styles.monthlyCell, styles.cellDays]}>출석</Text>
                      <Text style={[styles.monthlyCell, styles.cellGames]}>경기</Text>
                      <Text style={[styles.monthlyCell, styles.cellWLD]}>승/무/패</Text>
                      <Text style={[styles.monthlyCell, styles.cellRate]}>승률</Text>
                    </View>
                    {groupRanking.map((stat, index) => {
                      const points = stat.wins * 3 + stat.draws * 1;
                      return (
                      <View key={stat.name} style={styles.monthlyTableRow}>
                        <Text style={[styles.monthlyCell, styles.cellRank]}>{index + 1}</Text>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(stat.name)}`)}
                        >
                          <Text style={[styles.monthlyCell, styles.cellName]}>{dn(stat.name)}</Text>
                        </TouchableOpacity>
                        <Text style={[styles.monthlyCell, styles.cellPoints, styles.monthlyPoints]}>{points}</Text>
                        <Text style={[styles.monthlyCell, styles.cellDays]}>{attendanceData[stat.name] || 0}일</Text>
                        <Text style={[styles.monthlyCell, styles.cellGames]}>{stat.games}</Text>
                        <Text style={[styles.monthlyCell, styles.cellWLD]}>
                          {stat.wins}/{stat.draws}/{stat.losses}
                        </Text>
                        <Text style={[styles.monthlyCell, styles.cellRate, styles.monthlyWinRate]}>
                          {(stat.winRate * 100).toFixed(0)}%
                        </Text>
                      </View>
                      );
                    })}
                  </Card>
                  );
                })
              )}
              </>
              );
            })()}

            {monthlyRanking.length > 0 ? (
              <>
                {/* 월간 경기 결과 */}
                <Card title="📅 월간 경기 결과">
                  {monthlyDates.map((dateStr) => {
                    const session = monthlySessions[dateStr];
                    if (!session || !session.schedule) return null;
                    const activeMatches = session.schedule
                      .filter((m: any) => m.gameType !== '삭제');
                    if (activeMatches.length === 0) return null;

                    const maxCourt = Math.max(...activeMatches.map((m: any) => m.court || 1));

                    return (
                      <View key={dateStr} style={styles.monthlyDateSection}>
                        <Text style={styles.monthlyDateHeader}>
                          {format(new Date(dateStr), 'M월 d일 (E)', { locale: ko })}
                        </Text>
                        <View style={styles.monthlyMatchesTable}>
                          {activeMatches.map((match: any, matchIdx: number) => {
                            const result = session.results?.[String(matchIdx + 1)];
                            const hasResult = result && result.t1 !== null && result.t1 !== undefined;
                            const t1Win = hasResult && result.t1 > result.t2;
                            const t2Win = hasResult && result.t2 > result.t1;
                            const courtNum = match.court || 1;
                            const isNewRound = matchIdx > 0 && courtNum === 1;
                            const roundNum = Math.floor(matchIdx / maxCourt) + 1;

                            return (
                              <React.Fragment key={matchIdx}>
                                {isNewRound && (
                                  <View style={styles.monthlyRoundDivider}>
                                    <View style={styles.roundDividerLine} />
                                    <Text style={styles.roundDividerText}>{roundNum}라운드</Text>
                                    <View style={styles.roundDividerLine} />
                                  </View>
                                )}
                                <View style={styles.monthlyMatchRow}>
                                  <Text style={styles.monthlyMatchNum}>{matchIdx + 1}-{courtNum}코트</Text>
                                <View style={styles.monthlyMatchTeam}>
                                  <View style={styles.monthlyMatchTeamPlayers}>
                                    {match.team1.map((playerName: string, pIdx: number) => {
                                      const gender = rosterByName[playerName]?.gender;
                                      const colors = gender === '남' ? GENDER_COLORS.male
                                        : gender === '여' ? GENDER_COLORS.female
                                        : GENDER_COLORS.default;
                                      return (
                                        <View key={pIdx} style={[styles.monthlyPlayerBadge, { backgroundColor: colors.bg }]}>
                                          <Text style={[styles.monthlyPlayerText, { color: colors.text }]}>{dn(playerName)}</Text>
                                        </View>
                                      );
                                    })}
                                  </View>
                                </View>
                                <View style={styles.monthlyMatchScore}>
                                  {hasResult ? (
                                    <View style={styles.monthlyScoreRow}>
                                      <Text style={[
                                        styles.monthlyMatchScoreNum,
                                        t1Win && styles.scoreWinNum,
                                        t2Win && styles.scoreLoseNum
                                      ]}>
                                        {result.t1}
                                      </Text>
                                      <Text style={styles.monthlyScoreColon}>:</Text>
                                      <Text style={[
                                        styles.monthlyMatchScoreNum,
                                        t2Win && styles.scoreWinNum,
                                        t1Win && styles.scoreLoseNum
                                      ]}>
                                        {result.t2}
                                      </Text>
                                    </View>
                                  ) : (
                                    <Text style={styles.monthlyMatchScoreEmpty}>-</Text>
                                  )}
                                </View>
                                <View style={styles.monthlyMatchTeam}>
                                  <View style={styles.monthlyMatchTeamPlayers}>
                                    {match.team2.map((playerName: string, pIdx: number) => {
                                      const gender = rosterByName[playerName]?.gender;
                                      const colors = gender === '남' ? GENDER_COLORS.male
                                        : gender === '여' ? GENDER_COLORS.female
                                        : GENDER_COLORS.default;
                                      return (
                                        <View key={pIdx} style={[styles.monthlyPlayerBadge, { backgroundColor: colors.bg }]}>
                                          <Text style={[styles.monthlyPlayerText, { color: colors.text }]}>{dn(playerName)}</Text>
                                        </View>
                                      );
                                    })}
                                  </View>
                                </View>
                              </View>
                              </React.Fragment>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </Card>

                {/* Monthly Bests - 카테고리별 */}
                {monthlyBests && monthlyBests.categoryBests && (
                  monthlyBests.categoryBests.hand ||
                  monthlyBests.categoryBests.racket ||
                  monthlyBests.categoryBests.ageGroup ||
                  monthlyBests.categoryBests.gender ||
                  monthlyBests.categoryBests.mbti
                ) && (
                  <Card title="🎁 카테고리별 BEST">
                    <View style={styles.categoryBestsList}>
                      {monthlyBests.categoryBests.hand && (
                        <View style={styles.categoryBestRow}>
                          <Text style={styles.categoryBestLabel}>주손</Text>
                          <Text style={styles.categoryBestValue}>
                            {monthlyBests.categoryBests.hand.value} (승률 {monthlyBests.categoryBests.hand.winRate}%, 경기수 {monthlyBests.categoryBests.hand.games})
                          </Text>
                        </View>
                      )}
                      {monthlyBests.categoryBests.racket && (
                        <View style={styles.categoryBestRow}>
                          <Text style={styles.categoryBestLabel}>라켓</Text>
                          <Text style={styles.categoryBestValue}>
                            {monthlyBests.categoryBests.racket.value} (승률 {monthlyBests.categoryBests.racket.winRate}%, 경기수 {monthlyBests.categoryBests.racket.games})
                          </Text>
                        </View>
                      )}
                      {monthlyBests.categoryBests.ageGroup && (
                        <View style={styles.categoryBestRow}>
                          <Text style={styles.categoryBestLabel}>연령대</Text>
                          <Text style={styles.categoryBestValue}>
                            {monthlyBests.categoryBests.ageGroup.value} (승률 {monthlyBests.categoryBests.ageGroup.winRate}%, 경기수 {monthlyBests.categoryBests.ageGroup.games})
                          </Text>
                        </View>
                      )}
                      {monthlyBests.categoryBests.gender && (
                        <View style={styles.categoryBestRow}>
                          <Text style={styles.categoryBestLabel}>성별</Text>
                          <Text style={styles.categoryBestValue}>
                            {monthlyBests.categoryBests.gender.value} (승률 {monthlyBests.categoryBests.gender.winRate}%, 경기수 {monthlyBests.categoryBests.gender.games})
                          </Text>
                        </View>
                      )}
                      {monthlyBests.categoryBests.mbti ? (
                        <View style={styles.categoryBestRow}>
                          <Text style={styles.categoryBestLabel}>MBTI</Text>
                          <Text style={styles.categoryBestValue}>
                            {monthlyBests.categoryBests.mbti.value} (승률 {monthlyBests.categoryBests.mbti.winRate}%, 경기수 {monthlyBests.categoryBests.mbti.games})
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.categoryBestRow}>
                          <Text style={styles.categoryBestLabel}>MBTI</Text>
                          <Text style={styles.categoryBestValueMuted}>데이터 부족</Text>
                        </View>
                      )}
                    </View>
                  </Card>
                )}

              </>
            ) : (
              <Card>
                <View style={styles.emptyState}>
                  <FontAwesome name="line-chart" size={40} color={tkColors.textTertiary} />
                  <Text style={styles.emptyText}>해당 월에 기록이 없습니다</Text>
                </View>
              </Card>
            )}
          </>
        );

      case 'personal':
        // Choose data source based on period selection
        const currentSessions = personalPeriod === 'all' ? allTimeSessions : monthlySessions;
        const currentStats = personalPeriod === 'all' ? allTimeStats : monthlyStats;
        const currentAttendance = personalPeriod === 'all' ? allTimeAttendance : attendanceData;
        const isLoadingPersonal = personalPeriod === 'all' ? isLoadingAllTime : isLoading;

        // Get detailed stats for selected player
        const detailedStats = selectedPlayer && Object.keys(currentSessions).length > 0
          ? getDetailedPlayerStats(currentSessions, selectedPlayer)
          : null;
        const playerOpponentStats = selectedPlayer && Object.keys(currentSessions).length > 0
          ? getOpponentStats(currentSessions, selectedPlayer)
          : [];
        const playerPartnerStats = selectedPlayer && Object.keys(currentSessions).length > 0
          ? getPartnerStats(currentSessions, selectedPlayer)
          : [];
        const bestPartner = selectedPlayer && Object.keys(currentSessions).length > 0
          ? findBestPartner(currentSessions, selectedPlayer)
          : null;
        const rival = selectedPlayer && Object.keys(currentSessions).length > 0
          ? findRival(currentSessions, selectedPlayer)
          : null;
        const nemesis = selectedPlayer && Object.keys(currentSessions).length > 0
          ? findNemesis(currentSessions, selectedPlayer)
          : null;

        // MVP 횟수 계산 (동물 프로필 + 표시용 공용)
        const mvpCount = (() => {
          let count = 0;
          const dates = Object.keys(currentSessions).sort();
          for (const date of dates) {
            const sess = currentSessions[date];
            const allPlayers = new Set<string>();
            sess.schedule.forEach((m) => { m.team1.forEach((p) => allPlayers.add(p)); m.team2.forEach((p) => allPlayers.add(p)); });
            const ds = calculateDailyStats(sess, allPlayers);
            const mvp = findMVP(ds);
            if (mvp?.name === selectedPlayer) count++;
          }
          return count;
        })();

        // 동물 프로필: AI 결과 우선, 없으면 오프라인 템플릿
        const offlineProfile = detailedStats && detailedStats.games > 0
          ? generateAnimalProfile({
              winRate: detailedStats.winRate,
              games: detailedStats.games,
              wins: detailedStats.wins,
              losses: detailedStats.losses,
              draws: detailedStats.draws,
              avgScoreFor: detailedStats.avgScoreFor,
              avgScoreAgainst: detailedStats.avgScoreAgainst,
              scoreDiff: detailedStats.scoreDiff,
              longestWinStreak: detailedStats.longestWinStreak,
              longestLossStreak: detailedStats.longestLossStreak,
              recentForm: detailedStats.recentForm,
              bestPartnerName: bestPartner ? bestPartner.partner : undefined,
              bestPartnerWinRate: bestPartner ? bestPartner.winRate : undefined,
              nemesisName: nemesis ? nemesis.opponent : undefined,
              nemesisWinRate: nemesis ? nemesis.winRate : undefined,
              attendanceDays: currentAttendance[selectedPlayer] || 0,
              mvpCount,
            })
          : null;
        const animalProfile = aiAnimalProfile || offlineProfile;

        return (
          <>
            <Select
              label="선수 선택"
              value={selectedPlayer}
              options={playerOptions}
              onChange={(v) => setSelectedPlayer(v as string)}
              placeholder="선수를 선택하세요"
            />

            {/* Period toggle */}
            <View style={styles.periodToggleRow}>
              <TouchableOpacity
                style={[styles.periodToggleBtn, personalPeriod === 'all' && styles.periodToggleBtnActive]}
                onPress={() => setPersonalPeriod('all')}
              >
                <Text style={[styles.periodToggleText, personalPeriod === 'all' && styles.periodToggleTextActive]}>
                  전체 기록
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodToggleBtn, personalPeriod === 'monthly' && styles.periodToggleBtnActive]}
                onPress={() => setPersonalPeriod('monthly')}
              >
                <Text style={[styles.periodToggleText, personalPeriod === 'monthly' && styles.periodToggleTextActive]}>
                  월별 기록
                </Text>
              </TouchableOpacity>
            </View>

            {/* Month selector - only show when monthly is selected */}
            {personalPeriod === 'monthly' && (
              <Select
                label="월 선택"
                value={selectedMonth}
                options={monthOptions}
                onChange={(v) => setSelectedMonth(v as string)}
              />
            )}

            {/* Loading indicator */}
            {isLoadingPersonal && (
              <Card>
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>데이터 로딩중...</Text>
                </View>
              </Card>
            )}

            {selectedPlayer && currentStats[selectedPlayer] && !isLoadingPersonal && (
              <>
                {/* 동물 프로필 카드 */}
                {animalProfile && (
                  <View style={styles.animalProfileCard}>
                    <Text style={styles.animalEmoji}>{isLoadingAnimal ? '✨' : animalProfile.emoji}</Text>
                    <View style={styles.animalInfo}>
                      <View style={styles.animalTitleRow}>
                        <Text style={styles.animalTitle}>
                          {isLoadingAnimal ? 'AI 분석 중...' : animalProfile.title}
                        </Text>
                        {aiAnimalProfile && !isLoadingAnimal && (
                          <View style={styles.aiBadge}>
                            <Text style={styles.aiBadgeText}>AI</Text>
                          </View>
                        )}
                      </View>
                      {!isLoadingAnimal && (
                        <>
                          <Text style={styles.animalName}>
                            "{animalProfile.animal}" {dn(selectedPlayer)}
                          </Text>
                          <Text style={styles.animalDesc}>{animalProfile.description}</Text>
                        </>
                      )}
                    </View>
                  </View>
                )}

                <Card title={`📊 ${dn(selectedPlayer)} ${personalPeriod === 'all' ? '전체' : format(new Date(selectedMonth), 'M월', { locale: ko })} 통계`}>
                  <View style={styles.personalStats}>
                    <View style={styles.personalStatItem}>
                      <Text style={styles.personalStatValue}>
                        {currentStats[selectedPlayer].games}
                      </Text>
                      <Text style={styles.personalStatLabel}>경기</Text>
                    </View>
                    <View style={styles.personalStatItem}>
                      <Text style={styles.personalStatValue}>
                        {currentStats[selectedPlayer].wins}
                      </Text>
                      <Text style={styles.personalStatLabel}>승</Text>
                    </View>
                    <View style={styles.personalStatItem}>
                      <Text style={styles.personalStatValue}>
                        {currentStats[selectedPlayer].draws}
                      </Text>
                      <Text style={styles.personalStatLabel}>무</Text>
                    </View>
                    <View style={styles.personalStatItem}>
                      <Text style={styles.personalStatValue}>
                        {currentStats[selectedPlayer].losses}
                      </Text>
                      <Text style={styles.personalStatLabel}>패</Text>
                    </View>
                    <View style={styles.personalStatItem}>
                      <Text style={[styles.personalStatValue, { color: tkColors.primary }]}>
                        {(currentStats[selectedPlayer].winRate * 100).toFixed(0)}%
                      </Text>
                      <Text style={styles.personalStatLabel}>승률</Text>
                    </View>
                  </View>

                  <View style={styles.personalExtraStats}>
                    <View style={styles.extraStatRow}>
                      <Text style={styles.extraStatLabel}>득실차</Text>
                      <Text style={styles.extraStatValue}>
                        {currentStats[selectedPlayer].scoreFor - currentStats[selectedPlayer].scoreAgainst}
                      </Text>
                    </View>
                    <View style={styles.extraStatRow}>
                      <Text style={styles.extraStatLabel}>일일 MVP</Text>
                      <Text style={[styles.extraStatValue, { color: tkColors.warning }]}>
                        {mvpCount}회
                      </Text>
                    </View>
                    <View style={styles.extraStatRow}>
                      <Text style={styles.extraStatLabel}>총 득점 / 실점</Text>
                      <Text style={styles.extraStatValue}>
                        {currentStats[selectedPlayer].scoreFor} / {currentStats[selectedPlayer].scoreAgainst}
                      </Text>
                    </View>
                    <View style={styles.extraStatRow}>
                      <Text style={styles.extraStatLabel}>평균 득점 / 실점</Text>
                      <Text style={styles.extraStatValue}>
                        {detailedStats ? detailedStats.avgScoreFor.toFixed(1) : '-'} / {detailedStats ? detailedStats.avgScoreAgainst.toFixed(1) : '-'}
                      </Text>
                    </View>
                    <View style={styles.extraStatRow}>
                      <Text style={styles.extraStatLabel}>출석일수</Text>
                      <Text style={styles.extraStatValue}>
                        {currentAttendance[selectedPlayer] || 0}일
                      </Text>
                    </View>
                  </View>

                  {/* Win Rate Chart */}
                  <WinRateChart
                    wins={currentStats[selectedPlayer].wins}
                    draws={currentStats[selectedPlayer].draws}
                    losses={currentStats[selectedPlayer].losses}
                    winRate={currentStats[selectedPlayer].winRate}
                  />

                  {/* Monthly Trend Chart - only show for all-time data */}
                  {personalPeriod === 'all' && (() => {
                    const trendData = getMonthlyTrend(allTimeSessions, selectedPlayer, 6);
                    if (trendData.length >= 2) {
                      return <MonthlyTrendChart data={trendData} />;
                    }
                    return null;
                  })()}
                </Card>

                {/* Matchup Highlights */}
                {(bestPartner || rival || nemesis) && (
                  <Card title="🤝 매치업 하이라이트">
                    <View style={styles.matchupGrid}>
                      {bestPartner && (
                        <View style={[styles.matchupItem, styles.matchupBestPartner]}>
                          <Text style={styles.matchupEmoji}>💍</Text>
                          <Text style={styles.matchupLabel}>천생연분</Text>
                          <Text style={styles.matchupName}>{dn(bestPartner.partner)}</Text>
                          <Text style={styles.matchupValue}>
                            {(bestPartner.winRate * 100).toFixed(0)}% ({bestPartner.games}경기)
                          </Text>
                        </View>
                      )}
                      {rival && (
                        <View style={[styles.matchupItem, styles.matchupRival]}>
                          <Text style={styles.matchupEmoji}>⚖️</Text>
                          <Text style={styles.matchupLabel}>라이벌</Text>
                          <Text style={styles.matchupName}>{dn(rival.opponent)}</Text>
                          <Text style={styles.matchupValue}>
                            {(rival.winRate * 100).toFixed(0)}% ({rival.games}경기)
                          </Text>
                        </View>
                      )}
                      {nemesis && (
                        <View style={[styles.matchupItem, styles.matchupNemesis]}>
                          <Text style={styles.matchupEmoji}>🧨</Text>
                          <Text style={styles.matchupLabel}>천적</Text>
                          <Text style={styles.matchupName}>{dn(nemesis.opponent)}</Text>
                          <Text style={styles.matchupValue}>
                            {(nemesis.winRate * 100).toFixed(0)}% ({nemesis.games}경기)
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card>
                )}

                {/* Opponent Stats Table - Scrollable */}
                {playerOpponentStats.length > 0 && (() => {
                  const handleOppSortClick = (column: 'games' | 'wld' | 'winRate') => {
                    if (oppSortColumn === column) {
                      setOppSortAsc(!oppSortAsc);
                    } else {
                      setOppSortColumn(column);
                      setOppSortAsc(false);
                    }
                  };
                  const sortedOppStats = [...playerOpponentStats].sort((a, b) => {
                    let cmp = 0;
                    if (oppSortColumn === 'games') cmp = a.games - b.games;
                    else if (oppSortColumn === 'wld') cmp = a.wins - b.wins;
                    else cmp = a.winRate - b.winRate;
                    return oppSortAsc ? cmp : -cmp;
                  });
                  return (
                    <Card title={`상대별 승률 (${playerOpponentStats.length}명)`}>
                      <View style={styles.statsTableHeader}>
                        <Text style={[styles.statsTableCell, styles.cellOppName]}>상대</Text>
                        <TouchableOpacity onPress={() => handleOppSortClick('games')}>
                          <Text style={[styles.statsTableCell, styles.cellOppGames, styles.sortableHeader]}>
                            경기 {oppSortColumn === 'games' ? (oppSortAsc ? '↑' : '↓') : ''}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleOppSortClick('wld')}>
                          <Text style={[styles.statsTableCell, styles.cellOppWLD, styles.sortableHeader]}>
                            승/무/패 {oppSortColumn === 'wld' ? (oppSortAsc ? '↑' : '↓') : ''}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleOppSortClick('winRate')}>
                          <Text style={[styles.statsTableCell, styles.cellOppRate, styles.sortableHeader]}>
                            승률 {oppSortColumn === 'winRate' ? (oppSortAsc ? '↑' : '↓') : ''}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.scrollableTable} nestedScrollEnabled>
                        {sortedOppStats.map((opp) => (
                          <View key={opp.opponent} style={styles.statsTableRow}>
                            <Text style={[styles.statsTableCell, styles.cellOppName]}>{dn(opp.opponent)}</Text>
                            <Text style={[styles.statsTableCell, styles.cellOppGames]}>{opp.games}</Text>
                            <Text style={[styles.statsTableCell, styles.cellOppWLD]}>
                              {opp.wins}/{opp.draws}/{opp.losses}
                            </Text>
                            <Text style={[
                              styles.statsTableCell,
                              styles.cellOppRate,
                              opp.winRate >= 0.5 ? styles.winRateHigh : styles.winRateLow
                            ]}>
                              {(opp.winRate * 100).toFixed(0)}%
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </Card>
                  );
                })()}

                {/* Partner Stats Table - Scrollable */}
                {playerPartnerStats.length > 0 && (() => {
                  const handlePartnerSortClick = (column: 'games' | 'wld' | 'winRate') => {
                    if (partnerSortColumn === column) {
                      setPartnerSortAsc(!partnerSortAsc);
                    } else {
                      setPartnerSortColumn(column);
                      setPartnerSortAsc(false);
                    }
                  };
                  const sortedPartnerStats = [...playerPartnerStats].sort((a, b) => {
                    let cmp = 0;
                    if (partnerSortColumn === 'games') cmp = a.games - b.games;
                    else if (partnerSortColumn === 'wld') cmp = a.wins - b.wins;
                    else cmp = a.winRate - b.winRate;
                    return partnerSortAsc ? cmp : -cmp;
                  });
                  return (
                    <Card title={`파트너별 승률 (${playerPartnerStats.length}명)`}>
                      <View style={styles.statsTableHeader}>
                        <Text style={[styles.statsTableCell, styles.cellOppName]}>파트너</Text>
                        <TouchableOpacity onPress={() => handlePartnerSortClick('games')}>
                          <Text style={[styles.statsTableCell, styles.cellOppGames, styles.sortableHeader]}>
                            경기 {partnerSortColumn === 'games' ? (partnerSortAsc ? '↑' : '↓') : ''}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handlePartnerSortClick('wld')}>
                          <Text style={[styles.statsTableCell, styles.cellOppWLD, styles.sortableHeader]}>
                            승/무/패 {partnerSortColumn === 'wld' ? (partnerSortAsc ? '↑' : '↓') : ''}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handlePartnerSortClick('winRate')}>
                          <Text style={[styles.statsTableCell, styles.cellOppRate, styles.sortableHeader]}>
                            승률 {partnerSortColumn === 'winRate' ? (partnerSortAsc ? '↑' : '↓') : ''}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.scrollableTable} nestedScrollEnabled>
                        {sortedPartnerStats.map((partner) => (
                          <View key={partner.partner} style={styles.statsTableRow}>
                            <Text style={[styles.statsTableCell, styles.cellOppName]}>{dn(partner.partner)}</Text>
                            <Text style={[styles.statsTableCell, styles.cellOppGames]}>{partner.games}</Text>
                            <Text style={[styles.statsTableCell, styles.cellOppWLD]}>
                              {partner.wins}/{partner.draws}/{partner.losses}
                            </Text>
                            <Text style={[
                              styles.statsTableCell,
                              styles.cellOppRate,
                              partner.winRate >= 0.5 ? styles.winRateHigh : styles.winRateLow
                            ]}>
                              {(partner.winRate * 100).toFixed(0)}%
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </Card>
                  );
                })()}

                {/* Court Side Stats */}
                {(() => {
                  const sideStats = getSideStats(currentSessions, selectedPlayer);
                  const hasSideData = sideStats.deuce.games > 0 || sideStats.ad.games > 0;
                  if (!hasSideData) return null;

                  const sideChartData = [
                    { label: '포(듀스)', group: '포(듀스)', winRate: sideStats.deuce.winRate * 100, wins: sideStats.deuce.wins, draws: sideStats.deuce.draws, losses: sideStats.deuce.losses, games: sideStats.deuce.games },
                    { label: '백(애드)', group: '백(애드)', winRate: sideStats.ad.winRate * 100, wins: sideStats.ad.wins, draws: sideStats.ad.draws, losses: sideStats.ad.losses, games: sideStats.ad.games },
                  ];

                  return (
                    <Card title="🎾 코트 사이드별 승률">
                      <StatsChart data={sideChartData} type="side" />
                    </Card>
                  );
                })()}

                {/* Group-based Stats */}
                {(() => {
                  const genderStats = getStatsByOpponentAttribute(currentSessions, selectedPlayer, rosterByName, 'gender');
                  const handStats = getStatsByOpponentAttribute(currentSessions, selectedPlayer, rosterByName, 'hand');
                  const ntrpStats = getStatsByOpponentAttribute(currentSessions, selectedPlayer, rosterByName, 'ntrp');
                  const mbtiStats = getStatsByOpponentAttribute(currentSessions, selectedPlayer, rosterByName, 'mbti');

                  const handleSortClick = (column: 'games' | 'wld' | 'winRate') => {
                    if (groupSortColumn === column) {
                      setGroupSortAsc(!groupSortAsc);
                    } else {
                      setGroupSortColumn(column);
                      setGroupSortAsc(false); // Start with descending
                    }
                  };

                  const sortData = (data: GroupStats[]) => {
                    const sorted = [...data].sort((a, b) => {
                      let cmp = 0;
                      if (groupSortColumn === 'games') {
                        cmp = a.games - b.games;
                      } else if (groupSortColumn === 'wld') {
                        cmp = a.wins - b.wins;
                      } else {
                        cmp = a.winRate - b.winRate;
                      }
                      return groupSortAsc ? cmp : -cmp;
                    });
                    return sorted;
                  };

                  const openGroupChart = (title: string, data: GroupStats[], chartType: 'gender' | 'hand' | 'ntrp' | 'mbti') => {
                    setChartModalData({
                      title,
                      data: data.map(item => ({ ...item, group: item.group })),
                      type: chartType,
                    });
                    setChartModalVisible(true);
                  };

                  const renderGroupChart = (title: string, data: GroupStats[], chartType: 'gender' | 'hand' | 'ntrp' | 'mbti') => {
                    if (data.length === 0) return null;
                    return (
                      <Card title={title}>
                        <StatsChart data={data} type={chartType} />
                      </Card>
                    );
                  };

                  return (
                    <>
                      {renderGroupChart('성별별 상대 승률', genderStats, 'gender')}
                      {renderGroupChart('주손별 상대 승률', handStats, 'hand')}
                      {renderGroupChart('NTRP별 상대 승률', ntrpStats, 'ntrp')}
                      {renderGroupChart('MBTI별 상대 승률', mbtiStats, 'mbti')}
                    </>
                  );
                })()}
              </>
            )}

            {!selectedPlayer && (
              <Card>
                <View style={styles.emptyState}>
                  <FontAwesome name="user" size={40} color={tkColors.textTertiary} />
                  <Text style={styles.emptyText}>선수를 선택해주세요</Text>
                </View>
              </Card>
            )}

      {/* Record Modal */}
      <Modal
        visible={recordModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRecordModal({ ...recordModal, visible: false })}
      >
        <TouchableOpacity style={styles.scorePickerOverlay} activeOpacity={1} onPress={() => setRecordModal({ ...recordModal, visible: false })}>
          <View style={styles.scRecordContainer} onStartShouldSetResponder={() => true}>
            <Text style={styles.scRecordTitle}>
              {dn(recordModal.player)} 전적
            </Text>

            <View style={styles.scRecordFilterRow}>
              <TouchableOpacity
                style={[styles.scRecordFilterBtn, recordModal.filterMode === 'all' && styles.scRecordFilterBtnActive]}
                onPress={() => setRecordModal({ ...recordModal, filterMode: 'all' })}
              >
                <Text style={[styles.scRecordFilterBtnText, recordModal.filterMode === 'all' && styles.scRecordFilterBtnTextActive]}>전체</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.scRecordFilterBtn, recordModal.filterMode === 'recent5' && styles.scRecordFilterBtnActive]}
                onPress={() => setRecordModal({ ...recordModal, filterMode: 'recent5' })}
              >
                <Text style={[styles.scRecordFilterBtnText, recordModal.filterMode === 'recent5' && styles.scRecordFilterBtnTextActive]}>최근 5경기</Text>
              </TouchableOpacity>
            </View>

            {/* 파트너 전적 */}
            {recordModal.partner && (
              <View style={styles.scRecordSection}>
                <Text style={styles.scRecordSectionTitle}>파트너 전적 ({dn(recordModal.partner)})</Text>
                {(() => {
                  const h2h = getHeadToHead(allSessions, recordModal.player, recordModal.partner,
                    recordModal.filterMode === 'recent5' ? { limitPartner: 5 } : undefined);
                  if (h2h.asPartner.games === 0) return <Text style={styles.scRecordNoData}>기록 없음</Text>;
                  const winRate = Math.round((h2h.asPartner.wins / h2h.asPartner.games) * 100);
                  return (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.scRecordStatText}>
                        {h2h.asPartner.wins}승 {h2h.asPartner.draws}무 {h2h.asPartner.losses}패 ({h2h.asPartner.games}경기)
                      </Text>
                      <Text style={[styles.scRecordWinRateSmall, winRate >= 50 ? styles.scRecordWinRateHigh : styles.scRecordWinRateLow]}>
                        승률 {winRate}%
                      </Text>
                    </View>
                  );
                })()}
              </View>
            )}

            {/* 상대 전적 */}
            <View style={styles.scRecordSection}>
              <Text style={styles.scRecordSectionTitle}>상대 전적</Text>
              {sessionsLoading ? (
                <Text style={styles.scRecordNoData}>데이터 로딩중...</Text>
              ) : Object.keys(allSessions).length === 0 ? (
                <Text style={styles.scRecordNoData}>저장된 경기 기록 없음</Text>
              ) : (
                recordModal.opponents.map((opp) => {
                  const h2h = getHeadToHead(allSessions, recordModal.player, opp,
                    recordModal.filterMode === 'recent5' ? { limitPartner: 5, limitOpponent: 5 } : undefined);
                  if (h2h.asOpponent.games === 0) {
                    return (
                      <View key={opp} style={styles.scRecordOpponentRow}>
                        <Text style={styles.scRecordOpponentName}>{dn(opp)}</Text>
                        <Text style={styles.scRecordNoData}>기록 없음</Text>
                      </View>
                    );
                  }
                  const winRate = h2h.asOpponent.games > 0
                    ? Math.round((h2h.asOpponent.wins / h2h.asOpponent.games) * 100) : 0;
                  return (
                    <View key={opp} style={styles.scRecordOpponentRow}>
                      <Text style={styles.scRecordOpponentName}>{dn(opp)}</Text>
                      <Text style={styles.scRecordStatText}>
                        {h2h.asOpponent.wins}승 {h2h.asOpponent.draws}무 {h2h.asOpponent.losses}패
                      </Text>
                      <Text style={[styles.scRecordWinRateSmall, winRate >= 50 ? styles.scRecordWinRateHigh : styles.scRecordWinRateLow]}>
                        {winRate}%
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            <TouchableOpacity style={styles.scRecordCloseBtn} onPress={() => setRecordModal({ ...recordModal, visible: false })}>
              <Text style={styles.scRecordCloseBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

            {/* Score Picker Modal */}
            <Modal
              visible={scorePicker !== null}
              transparent
              animationType="fade"
              onRequestClose={() => setScorePicker(null)}
            >
              <TouchableOpacity
                style={styles.scorePickerOverlay}
                activeOpacity={1}
                onPress={() => setScorePicker(null)}
              >
                <View style={styles.scorePickerContainer}>
                  <Text style={styles.scorePickerTitle}>점수 선택</Text>
                  <View style={styles.scorePickerGrid}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[
                          styles.scorePickerItem,
                          scorePicker && editResults[String(scorePicker.matchIndex + 1)]?.[scorePicker.team] === v && styles.scorePickerItemActive,
                        ]}
                        onPress={() => {
                          if (scorePicker) {
                            handleEditScoreSelect(scorePicker.matchIndex, scorePicker.team, v);
                            setScorePicker(null);
                          }
                        }}
                      >
                        <Text style={[
                          styles.scorePickerItemText,
                          scorePicker && editResults[String(scorePicker.matchIndex + 1)]?.[scorePicker.team] === v && styles.scorePickerItemTextActive,
                        ]}>{v}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Chart Modal */}
            <Modal
              visible={chartModalVisible}
              animationType="fade"
              transparent
              onRequestClose={() => setChartModalVisible(false)}
            >
              <TouchableOpacity
                style={styles.chartModalOverlay}
                activeOpacity={1}
                onPress={() => setChartModalVisible(false)}
              >
                <View style={styles.chartModalContainer}>
                  <View style={styles.chartModalHeader}>
                    <Text style={styles.chartModalTitle}>{chartModalData.title}</Text>
                    <TouchableOpacity onPress={() => setChartModalVisible(false)}>
                      <FontAwesome name="times" size={20} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                  <StatsChart data={chartModalData.data} type={chartModalData.type} />
                </View>
              </TouchableOpacity>
            </Modal>
          </>
        );

      case 'ranking': {
        const rkStats = rankingPeriod === 'all' ? allTimeStats : monthlyStats;
        const rkAttendance = rankingPeriod === 'all' ? allTimeAttendance : attendanceData;
        const rkLoading = rankingPeriod === 'all' ? isLoadingAllTime : isLoading;

        const CRITERIA_OPTIONS = [
          { key: 'points' as const, label: '승점' },
          { key: 'winRate' as const, label: '승률' },
          { key: 'scoreTotal' as const, label: '총득점' },
          { key: 'scoreAvg' as const, label: '평균득점' },
          { key: 'attendance' as const, label: '출석일수' },
          { key: 'scoreDiff' as const, label: '득실차' },
        ];

        const sortByCriteria = (stats: Record<string, PlayerStats>, att: AttendanceInfo, criteria: typeof rankingCriteria) => {
          const arr = Object.values(stats).filter(s => s.games > 0);
          return arr.sort((a, b) => {
            switch (criteria) {
              case 'points': return b.points - a.points || b.winRate - a.winRate;
              case 'winRate': return b.winRate - a.winRate || b.games - a.games;
              case 'scoreTotal': return b.scoreFor - a.scoreFor || b.games - a.games;
              case 'scoreAvg': return (b.scoreFor / b.games) - (a.scoreFor / a.games) || b.games - a.games;
              case 'attendance': return (att[b.name] || 0) - (att[a.name] || 0) || b.games - a.games;
              case 'scoreDiff': return (b.scoreFor - b.scoreAgainst) - (a.scoreFor - a.scoreAgainst) || b.games - a.games;
              default: return 0;
            }
          });
        };

        const getStatValue = (stat: PlayerStats, att: AttendanceInfo, criteria: typeof rankingCriteria): string => {
          switch (criteria) {
            case 'points': return `${stat.points}점`;
            case 'winRate': return `${(stat.winRate * 100).toFixed(0)}%`;
            case 'scoreTotal': return `${stat.scoreFor}점`;
            case 'scoreAvg': return stat.games > 0 ? `${(stat.scoreFor / stat.games).toFixed(1)}점` : '0점';
            case 'attendance': return `${att[stat.name] || 0}일`;
            case 'scoreDiff': { const d = stat.scoreFor - stat.scoreAgainst; return `${d >= 0 ? '+' : ''}${d}`; }
            default: return '';
          }
        };

        const currentRanking = sortByCriteria(rkStats, rkAttendance, rankingCriteria);
        const prevRanking = rankingPeriod === 'monthly' ? sortByCriteria(prevMonthStats, prevMonthAttendance, rankingCriteria) : [];

        const getRankChange = (name: string, currentIdx: number): number | null => {
          if (rankingPeriod !== 'monthly' || prevRanking.length === 0) return null;
          const prevIdx = prevRanking.findIndex(s => s.name === name);
          if (prevIdx < 0) return null;
          return prevIdx - currentIdx;
        };

        const top3 = currentRanking.slice(0, 3);
        const myRankIdx = myPlayerName ? currentRanking.findIndex(s => s.name === myPlayerName) : -1;
        const myStat = myRankIdx >= 0 ? currentRanking[myRankIdx] : null;
        const canShowGroupRk = club?.settings?.useGroups !== false
          && !isSectionRestricted('records.monthly.groupRanking')
          && (isAdmin || !club?.settings?.hideGroupFromMembers);
        const rkGroups = club?.settings?.groups || [];
        const boardList = rankingViewMode === 'group' && canShowGroupRk
          ? null : currentRanking;

        const getInitial = (name: string) => name.charAt(0);
        const getPhoto = (name: string) => rosterByName[name]?.photoURL || null;

        const renderAvatar = (name: string, size: number, br: number, textStyle: any) => {
          const photo = getPhoto(name);
          if (photo) {
            return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: br }} />;
          }
          return <Text style={textStyle}>{getInitial(dn(name))}</Text>;
        };

        const renderRankChange = (change: number | null) => {
          if (change === null) return null;
          if (change > 0) return (
            <View style={styles.rkChangeRow}>
              <FontAwesome name="caret-up" size={12} color={tkColors.success} />
              <Text style={[styles.rkChangeText, { color: tkColors.success }]}>{change}</Text>
            </View>
          );
          if (change < 0) return (
            <View style={styles.rkChangeRow}>
              <FontAwesome name="caret-down" size={12} color={tkColors.error} />
              <Text style={[styles.rkChangeText, { color: tkColors.error }]}>{Math.abs(change)}</Text>
            </View>
          );
          return (
            <View style={styles.rkChangeRow}>
              <Text style={[styles.rkChangeText, { color: tkColors.textTertiary }]}>-</Text>
            </View>
          );
        };

        const renderRow = (stat: PlayerStats, index: number, showYouExpand: boolean) => {
          const isMe = stat.name === myPlayerName;
          const diff = stat.scoreFor - stat.scoreAgainst;
          const photo = getPhoto(stat.name);
          const change = getRankChange(stat.name, index);
          return (
            <View key={stat.name}>
              <TouchableOpacity
                style={[styles.rkRow, isMe && styles.rkRowMe]}
                onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(stat.name)}`)}
              >
                <Text style={[styles.rkRowRank, isMe && styles.rkRowRankMe]}>{index + 1}</Text>
                {isMe ? (
                  <View style={styles.rkRowYouBadge}><Text style={styles.rkRowYouText}>나</Text></View>
                ) : photo ? (
                  <Image source={{ uri: photo }} style={styles.rkRowAvatarImg} />
                ) : (
                  <View style={styles.rkRowAvatar}>
                    <Text style={styles.rkRowAvatarText}>{getInitial(dn(stat.name))}</Text>
                  </View>
                )}
                <View style={styles.rkRowInfo}>
                  <Text style={styles.rkRowName}>{dn(stat.name)}</Text>
                  <Text style={styles.rkRowRecord}>{stat.wins}승 - {stat.losses}패</Text>
                </View>
                <View style={styles.rkRowRight}>
                  <Text style={styles.rkRowPoints}>{getStatValue(stat, rkAttendance, rankingCriteria)}</Text>
                  {renderRankChange(change)}
                </View>
              </TouchableOpacity>
              {isMe && showYouExpand && (
                <View style={styles.rkYouStats}>
                  <View style={styles.rkYouStatCard}>
                    <Text style={styles.rkYouStatLabel}>승률</Text>
                    <Text style={styles.rkYouStatValue}>{(stat.winRate * 100).toFixed(0)}%</Text>
                    <View style={styles.rkProgressBar}>
                      <View style={[styles.rkProgressFill, { width: `${Math.min(stat.winRate * 100, 100)}%` }]} />
                    </View>
                  </View>
                  <View style={styles.rkYouStatCard}>
                    <Text style={styles.rkYouStatLabel}>경기수</Text>
                    <Text style={styles.rkYouStatValue}>{stat.games}</Text>
                    <Text style={styles.rkYouStatSub}>{stat.wins}승 {stat.draws}무 {stat.losses}패</Text>
                  </View>
                  <View style={styles.rkYouStatCard}>
                    <Text style={styles.rkYouStatLabel}>득실차</Text>
                    <Text style={[styles.rkYouStatValue, { color: diff >= 0 ? tkColors.success : tkColors.error }]}>
                      {diff >= 0 ? '+' : ''}{diff}
                    </Text>
                    <Text style={styles.rkYouStatSub}>{stat.scoreFor}득 {stat.scoreAgainst}실</Text>
                  </View>
                </View>
              )}
            </View>
          );
        };

        return (
          <>
            {/* Period Toggle */}
            <View style={styles.rkPeriodRow}>
              <TouchableOpacity
                style={[styles.rkPeriodBtn, rankingPeriod === 'monthly' && styles.rkPeriodBtnActive]}
                onPress={() => setRankingPeriod('monthly')}
              >
                <Text style={[styles.rkPeriodText, rankingPeriod === 'monthly' && styles.rkPeriodTextActive]}>월간</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rkPeriodBtn, rankingPeriod === 'all' && styles.rkPeriodBtnActive]}
                onPress={() => setRankingPeriod('all')}
              >
                <Text style={[styles.rkPeriodText, rankingPeriod === 'all' && styles.rkPeriodTextActive]}>전체</Text>
              </TouchableOpacity>
            </View>

            {/* Month Selector (월간 only) */}
            {rankingPeriod === 'monthly' && (
              <View style={styles.rkMonthRow}>
                <Select
                  label=""
                  value={selectedMonth}
                  options={monthOptions}
                  onChange={(v) => setSelectedMonth(v as string)}
                />
              </View>
            )}

            {/* Criteria Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rkCriteriaScroll} contentContainerStyle={styles.rkCriteriaContent}>
              {CRITERIA_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.rkCriteriaBtn, rankingCriteria === opt.key && styles.rkCriteriaBtnActive]}
                  onPress={() => setRankingCriteria(opt.key)}
                >
                  <Text style={[styles.rkCriteriaText, rankingCriteria === opt.key && styles.rkCriteriaTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {rkLoading ? (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={tkColors.primary} />
              </View>
            ) : currentRanking.length === 0 ? (
              <Text style={styles.rkEmpty}>데이터가 없습니다</Text>
            ) : (
            <>
            {/* Podium - Top 3 */}
            {top3.length >= 3 && (
              <View style={styles.rkPodium}>
                {/* #2 */}
                <TouchableOpacity style={styles.rkPodiumCol} onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(top3[1].name)}`)}>
                  <View style={styles.rkAvatarWrap2}>
                    <View style={styles.rkAvatar2}>
                      {renderAvatar(top3[1].name, 60, 14, styles.rkAvatarText2)}
                    </View>
                    <View style={styles.rkRankBadge2}><Text style={styles.rkRankBadgeText}>#2</Text></View>
                  </View>
                  <Text style={styles.rkPodiumName} numberOfLines={1}>{dn(top3[1].name)}</Text>
                  <Text style={styles.rkPodiumPts}>{getStatValue(top3[1], rkAttendance, rankingCriteria)}</Text>
                </TouchableOpacity>
                {/* #1 */}
                <TouchableOpacity style={styles.rkPodiumCol} onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(top3[0].name)}`)}>
                  <View style={styles.rkAvatarWrap1}>
                    <View style={styles.rkAvatar1}>
                      {renderAvatar(top3[0].name, 76, 18, styles.rkAvatarText1)}
                    </View>
                    <View style={styles.rkRankBadge1}><Text style={styles.rkRankBadge1Text}>#1</Text></View>
                    <View style={styles.rkTrophy}><Text style={{ fontSize: 12 }}>🏆</Text></View>
                  </View>
                  <Text style={styles.rkPodiumName1} numberOfLines={1}>{dn(top3[0].name)}</Text>
                  <Text style={styles.rkPodiumPts1}>{getStatValue(top3[0], rkAttendance, rankingCriteria)}</Text>
                </TouchableOpacity>
                {/* #3 */}
                <TouchableOpacity style={styles.rkPodiumCol} onPress={() => router.push(`/(tabs)/records?player=${encodeURIComponent(top3[2].name)}`)}>
                  <View style={styles.rkAvatarWrap3}>
                    <View style={styles.rkAvatar3}>
                      {renderAvatar(top3[2].name, 60, 14, styles.rkAvatarText2)}
                    </View>
                    <View style={styles.rkRankBadge3}><Text style={styles.rkRankBadgeText}>#3</Text></View>
                  </View>
                  <Text style={styles.rkPodiumName} numberOfLines={1}>{dn(top3[2].name)}</Text>
                  <Text style={styles.rkPodiumPts}>{getStatValue(top3[2], rkAttendance, rankingCriteria)}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* My Current Rank */}
            {myStat && (
              <View style={styles.rkMyCard}>
                <View style={styles.rkMyHeader}>
                  <Text style={styles.rkMyLabel}>내 현재 순위</Text>
                  <FontAwesome name="line-chart" size={14} color={tkColors.primary} />
                </View>
                <View style={styles.rkMyBody}>
                  <Text style={styles.rkMyRank}>#{myRankIdx + 1}</Text>
                  <View style={styles.rkMyDivider} />
                  <View style={styles.rkMyStats}>
                    <View style={styles.rkMyStatItem}>
                      <Text style={styles.rkMyStatLabel}>승점</Text>
                      <Text style={styles.rkMyStatValue}>{myStat.points}</Text>
                    </View>
                    <View style={styles.rkMyStatItem}>
                      <Text style={styles.rkMyStatLabel}>승률</Text>
                      <Text style={[styles.rkMyStatValue, { color: tkColors.primary }]}>{(myStat.winRate * 100).toFixed(0)}%</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Leaderboard Header */}
            <View style={styles.rkBoardHeader}>
              <Text style={styles.rkBoardTitle}>리더보드</Text>
              {canShowGroupRk && (
                <View style={styles.rkFilterRow}>
                  <TouchableOpacity
                    style={[styles.rkFilterBtn, rankingViewMode === 'all' && styles.rkFilterBtnActive]}
                    onPress={() => setRankingViewMode('all')}
                  >
                    <Text style={[styles.rkFilterText, rankingViewMode === 'all' && styles.rkFilterTextActive]}>전체</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rkFilterBtn, rankingViewMode === 'group' && styles.rkFilterBtnActive]}
                    onPress={() => setRankingViewMode('group')}
                  >
                    <Text style={[styles.rkFilterText, rankingViewMode === 'group' && styles.rkFilterTextActive]}>조별</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Leaderboard List */}
            {boardList ? (
              <View style={styles.rkBoardList}>
                {boardList.map((stat, index) => renderRow(stat, index, true))}
              </View>
            ) : (
              rkGroups.map((groupName) => {
                const groupRanking = currentRanking.filter((stat) => {
                  const player = players.find((p) => p.name === stat.name);
                  return player?.group === groupName;
                });
                if (groupRanking.length === 0) return null;
                return (
                  <View key={groupName} style={{ marginBottom: spacing.lg }}>
                    <Text style={styles.rkGroupTitle}>{groupName}</Text>
                    <View style={styles.rkBoardList}>
                      {groupRanking.map((stat, index) => renderRow(stat, index, false))}
                    </View>
                  </View>
                );
              })
            )}
            </>
            )}
          </>
        );
      }
    }
  };

  // 구독 등급 제한
  if (isFeatureDisabled('disableRecords')) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tkColors.bg }}>
        <FontAwesome name="lock" size={48} color={tkColors.textTertiary} />
        <Text style={{ marginTop: 16, fontSize: 16, color: tkColors.textTertiary, fontWeight: '600' }}>이 기능은 현재 사용할 수 없습니다</Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: tkColors.textTertiary }}>클럽 등급을 업그레이드하면 이용할 수 있습니다</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Header */}
      <View style={styles.tabHeaderContainer}>
        <View style={styles.tabHeaderInner}>
          <SegmentedTabs
            tabs={[
              { key: 'daily', label: '날짜별' },
              { key: 'monthly', label: '월간' },
              { key: 'personal', label: '개인별' },
              { key: 'ranking', label: '랭킹' },
            ].filter((t) => {
              if (isSectionRestricted(`records.${t.key}`)) return false;
              if (t.key === 'personal' && isFeatureDisabled('disablePersonalStats')) return false;
              if (t.key === 'ranking' && isFeatureDisabled('disableRanking')) return false;
              if (t.key === 'monthly' && isFeatureDisabled('disableStats')) return false;
              return true;
            })}
            activeKey={activeTab}
            onTabPress={(key) => setActiveTab(key as TabType)}
          />
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {renderTabContent()}
        <Footer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tkColors.bg,
  },
  tabHeaderContainer: {
    backgroundColor: tkColors.navy,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 0,
  },
  tabHeaderInner: {
    maxWidth: MAX_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  // 이름 뱃지 스타일
  nameBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    maxWidth: 70,
  },
  nameBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dailyReportCard: {
    backgroundColor: tkColors.warningBg,
    marginTop: spacing.md,
  },
  dailyReportLine: {
    ...typography.bodyMedium,
    color: tkColors.warning,
    lineHeight: 22,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.borderLight,
    backgroundColor: tkColors.card,
  },
  statRank: {
    width: 28,
    fontSize: 15,
    fontWeight: '700',
    color: tkColors.textSecondary,
    textAlign: 'center',
  },
  statName: {
    flex: 1,
    ...typography.section,
    color: tkColors.text,
    marginLeft: spacing.sm,
  },
  statDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statGames: {
    fontSize: 14,
    color: tkColors.textSecondary,
    marginRight: 10,
    fontWeight: '500',
  },
  statRecord: {
    fontSize: 14,
    color: tkColors.textSecondary,
    marginRight: 10,
    fontWeight: '600',
  },
  statWinRate: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.accent,
    backgroundColor: tkColors.navy,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    width: 50,
    textAlign: 'center',
  },
  statDiff: {
    fontSize: 15,
    fontWeight: '700',
    color: tkColors.textSecondary,
    width: 44,
    textAlign: 'right',
  },
  statDiffPositive: {
    color: tkColors.success,
  },
  statDiffNegative: {
    color: tkColors.error,
  },
  matchTable: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: tkColors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: tkColors.card,
  },
  matchTableHeader: {
    flexDirection: 'row',
    backgroundColor: tkColors.navy,
    borderBottomWidth: 0,
    paddingVertical: 10,
  },
  matchTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: tkColors.borderLight,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: tkColors.card,
  },
  matchTableCell: {
    paddingHorizontal: 4,
  },
  cellGame: {
    width: 28,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: tkColors.textSecondary,
  },
  cellTeam: {
    flex: 1,
    paddingHorizontal: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  cellTeam1: {
    justifyContent: 'flex-end',
  },
  cellTeam2: {
    justifyContent: 'flex-start',
  },
  cellTeamHeader: {
    flex: 1,
    paddingHorizontal: 6,
  },
  cellTeam1Header: {
    alignItems: 'flex-end',
  },
  cellTeam2Header: {
    alignItems: 'flex-start',
  },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    color: tkColors.white,
  },
  cellScoreHeader: {
    width: 70,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: tkColors.white,
  },
  cellScore: {
    width: 65,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  cellScoreCol: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  matchNoLabel: {
    fontSize: 10,
    color: tkColors.textTertiary,
    fontWeight: '600',
    marginBottom: 3,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWinner: {
    // Style removed - no longer highlighting winner team background
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    color: tkColors.text,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '800',
    color: tkColors.textSecondary,
    width: 20,
    textAlign: 'center',
  },
  scoreWinner: {
    color: tkColors.success,
  },
  scoreLoss: {
    color: tkColors.error,
  },
  scoreDraw: {
    color: tkColors.textTertiary,
  },
  scoreColon: {
    fontSize: 16,
    fontWeight: '700',
    color: tkColors.textTertiary,
    marginHorizontal: 4,
  },
  // Round divider styles
  roundDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: tkColors.bg,
  },
  roundDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: tkColors.border,
  },
  roundDividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: tkColors.textSecondary,
    paddingHorizontal: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: tkColors.textTertiary,
    marginTop: spacing.md,
  },
  personalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    borderBottomWidth: 0,
    backgroundColor: tkColors.navy,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  personalStatItem: {
    alignItems: 'center',
    minWidth: 44,
  },
  personalStatValue: {
    ...typography.stat,
    fontSize: 22,
    color: tkColors.white,
  },
  personalStatLabel: {
    ...typography.captionMedium,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing.xs,
  },
  personalExtraStats: {
    paddingTop: spacing.sm,
  },
  extraStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.borderLight,
  },
  extraStatLabel: {
    fontSize: 15,
    color: tkColors.textSecondary,
    fontWeight: '500',
  },
  extraStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: tkColors.text,
  },
  // ── Ranking Tab Styles ──
  rkPeriodRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.md,
  },
  rkPeriodBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  rkPeriodBtnActive: {
    backgroundColor: tkColors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  rkPeriodText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  rkPeriodTextActive: {
    color: tkColors.primary,
    fontWeight: '700',
  },
  rkMonthRow: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  rkCriteriaScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: spacing.md,
  },
  rkCriteriaContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  rkCriteriaBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: tkColors.border,
  },
  rkCriteriaBtnActive: {
    backgroundColor: 'rgba(212,255,0,0.12)',
    borderColor: 'rgba(212,255,0,0.3)',
  },
  rkCriteriaText: {
    fontSize: 12,
    fontWeight: '500',
    color: tkColors.textSecondary,
  },
  rkCriteriaTextActive: {
    color: tkColors.primary,
    fontWeight: '700',
  },
  rkRowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rkChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rkChangeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rkEmpty: {
    fontSize: 15,
    color: tkColors.textTertiary,
    textAlign: 'center',
    paddingVertical: 48,
  },
  // Podium
  rkPodium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
  },
  rkPodiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  rkAvatarWrap1: {
    position: 'relative',
    marginBottom: 16,
  },
  rkAvatar1: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: tkColors.navy,
    borderWidth: 4,
    borderColor: tkColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4FF00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  rkAvatarText1: {
    fontSize: 28,
    fontWeight: '800',
    color: tkColors.primary,
  },
  rkRankBadge1: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -18,
    backgroundColor: tkColors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rkRankBadge1Text: {
    fontSize: 12,
    fontWeight: '900',
    color: tkColors.black,
  },
  rkTrophy: {
    position: 'absolute',
    top: -10,
    right: -8,
    backgroundColor: '#FACC15',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tkColors.bg,
  },
  rkPodiumName1: {
    fontSize: 14,
    fontWeight: '900',
    color: tkColors.text,
    textAlign: 'center',
    width: '100%',
  },
  rkPodiumPts1: {
    fontSize: 12,
    fontWeight: '700',
    color: tkColors.primary,
    marginTop: 2,
  },
  rkAvatarWrap2: {
    position: 'relative',
    marginBottom: 12,
  },
  rkAvatar2: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: tkColors.navy,
    borderWidth: 2,
    borderColor: tkColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rkAvatarText2: {
    fontSize: 22,
    fontWeight: '700',
    color: tkColors.textSecondary,
  },
  rkRankBadge2: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -14,
    backgroundColor: tkColors.navyLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  rkRankBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: tkColors.text,
  },
  rkAvatarWrap3: {
    position: 'relative',
    marginBottom: 12,
  },
  rkAvatar3: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: tkColors.navy,
    borderWidth: 2,
    borderColor: 'rgba(194,120,62,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rkRankBadge3: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -14,
    backgroundColor: 'rgba(194,120,62,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  rkPodiumName: {
    fontSize: 12,
    fontWeight: '700',
    color: tkColors.text,
    textAlign: 'center',
    width: '100%',
  },
  rkPodiumPts: {
    fontSize: 10,
    fontWeight: '500',
    color: tkColors.textSecondary,
    marginTop: 2,
  },
  // My Rank Card
  rkMyCard: {
    backgroundColor: tkColors.navyLight,
    borderRadius: 24,
    padding: 20,
    marginHorizontal: spacing.md,
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: tkColors.border,
  },
  rkMyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rkMyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: tkColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rkMyBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rkMyRank: {
    fontSize: 36,
    fontWeight: '900',
    color: tkColors.text,
  },
  rkMyDivider: {
    width: 1,
    height: 40,
    backgroundColor: tkColors.border,
    marginHorizontal: 16,
  },
  rkMyStats: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  rkMyStatItem: {},
  rkMyStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: tkColors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  rkMyStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: tkColors.text,
  },
  // Leaderboard
  rkBoardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  rkBoardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tkColors.text,
  },
  rkFilterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  rkFilterBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: tkColors.bg,
  },
  rkFilterBtnActive: {
    backgroundColor: tkColors.navy,
  },
  rkFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: tkColors.textSecondary,
  },
  rkFilterTextActive: {
    color: tkColors.primary,
  },
  rkGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tkColors.textSecondary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rkBoardList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tkColors.navyLight,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tkColors.border,
  },
  rkRowMe: {
    backgroundColor: 'rgba(212,255,0,0.05)',
    borderColor: 'rgba(212,255,0,0.2)',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  rkRowRank: {
    width: 28,
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.textTertiary,
  },
  rkRowRankMe: {
    color: tkColors.primary,
    fontWeight: '900',
  },
  rkRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: tkColors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rkRowAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: tkColors.textSecondary,
  },
  rkRowAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: 12,
  },
  rkRowYouBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: tkColors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rkRowYouText: {
    fontSize: 12,
    fontWeight: '800',
    color: tkColors.primary,
  },
  rkRowInfo: {
    flex: 1,
  },
  rkRowName: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.text,
  },
  rkRowRecord: {
    fontSize: 10,
    color: tkColors.textSecondary,
    marginTop: 1,
  },
  rkRowPoints: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.text,
  },
  // YOU expanded stats
  rkYouStats: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 16,
    paddingTop: 8,
    backgroundColor: 'rgba(212,255,0,0.05)',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(212,255,0,0.2)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  rkYouStatCard: {
    flex: 1,
    backgroundColor: tkColors.navy,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tkColors.border,
  },
  rkYouStatLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: tkColors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rkYouStatValue: {
    fontSize: 13,
    fontWeight: '700',
    color: tkColors.text,
  },
  rkYouStatSub: {
    fontSize: 8,
    color: tkColors.textTertiary,
    marginTop: 4,
  },
  rkProgressBar: {
    width: '100%',
    height: 4,
    backgroundColor: tkColors.border,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  rkProgressFill: {
    height: '100%',
    backgroundColor: tkColors.primary,
    borderRadius: 2,
  },
  // Group filter styles
  // Date navigation styles
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dateNavBtn: {
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: tkColors.primary,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: tkColors.primary,
    borderRadius: radius.full,
    borderWidth: 0,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: tkColors.black,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: tkColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  datePickerModal: {
    backgroundColor: tkColors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  calendarMonthText: {
    fontSize: 17,
    fontWeight: '700',
    color: tkColors.text,
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: tkColors.textTertiary,
    paddingVertical: spacing.sm,
  },
  calendarSunday: {
    color: tkColors.error,
  },
  calendarSaturday: {
    color: tkColors.primary,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  calendarDayDisabled: {
    color: tkColors.textTertiary,
  },
  calendarDayEnabled: {
    color: tkColors.text,
  },
  calendarDayHasSession: {
    backgroundColor: tkColors.male.bg,
  },
  calendarDaySelected: {
    backgroundColor: tkColors.primary,
  },
  calendarDaySelectedText: {
    color: tkColors.white,
    fontWeight: '700',
  },
  todayBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: tkColors.bg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  todayBtnText: {
    ...typography.bodyMedium,
    color: tkColors.primary,
  },
  modeIndicator: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: tkColors.navy,
    borderRadius: radius.full,
    marginBottom: spacing.md,
    borderWidth: 0,
  },
  modeIndicatorText: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: tkColors.accent,
  },
  groupSectionCard: {
    marginTop: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: tkColors.primary,
  },
  groupFilterRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  groupFilterBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: tkColors.bg,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },
  groupFilterBtnActive: {
    backgroundColor: tkColors.navy,
  },
  groupFilterText: {
    ...typography.captionMedium,
    color: tkColors.textSecondary,
  },
  groupFilterTextActive: {
    color: tkColors.accent,
  },
  // Period toggle styles (for personal tab)
  animalProfileCard: {
    backgroundColor: tkColors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: tkColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  animalEmoji: {
    fontSize: 48,
    marginRight: spacing.md,
    marginTop: 2,
  },
  animalInfo: {
    flex: 1,
  },
  animalTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 2,
    gap: spacing.xs,
  },
  animalTitle: {
    ...typography.headingSmall,
    color: tkColors.primary,
  },
  aiBadge: {
    backgroundColor: tkColors.navy,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  aiBadgeText: {
    color: tkColors.accent,
    fontSize: 10,
    fontWeight: '700' as const,
  },
  animalName: {
    ...typography.bodyMedium,
    color: tkColors.text,
    fontWeight: '600' as const,
    marginBottom: spacing.xs,
  },
  animalDesc: {
    ...typography.bodyMedium,
    color: tkColors.textSecondary,
    lineHeight: 20,
  },
  periodToggleRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: tkColors.bg,
    borderRadius: radius.full,
    padding: 4,
  },
  periodToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  periodToggleBtnActive: {
    backgroundColor: tkColors.navy,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  periodToggleText: {
    ...typography.bodyMedium,
    color: tkColors.textSecondary,
  },
  periodToggleTextActive: {
    color: tkColors.accent,
    fontWeight: '600',
  },
  // Monthly bests styles
  bestsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  bestItem: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: tkColors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tkColors.border,
    alignItems: 'center',
  },
  bestEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  bestLabel: {
    fontSize: 11,
    color: tkColors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  bestName: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.text,
    textAlign: 'center',
  },
  bestValue: {
    fontSize: 12,
    color: tkColors.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  // Category bests styles
  categoryBestsList: {
    gap: 8,
  },
  categoryBestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.borderLight,
  },
  categoryBestLabel: {
    width: 60,
    fontSize: 13,
    fontWeight: '600',
    color: tkColors.textSecondary,
  },
  categoryBestValue: {
    flex: 1,
    fontSize: 13,
    color: tkColors.text,
  },
  categoryBestValueMuted: {
    flex: 1,
    fontSize: 13,
    color: tkColors.textTertiary,
    fontStyle: 'italic',
  },
  // Player bests styles
  playerBestsList: {
    gap: 4,
  },
  playerBestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.borderLight,
  },
  playerBestEmoji: {
    fontSize: 16,
    width: 24,
    marginRight: 4,
  },
  playerBestLabel: {
    width: 70,
    fontSize: 13,
    fontWeight: '600',
    color: tkColors.textSecondary,
  },
  playerBestValue: {
    flex: 1,
    fontSize: 13,
    color: tkColors.text,
    lineHeight: 18,
  },
  // Monthly table styles
  monthlyTableHeader: {
    flexDirection: 'row',
    backgroundColor: tkColors.borderLight,
    borderRadius: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.border,
  },
  monthlyTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.borderLight,
    backgroundColor: tkColors.card,
    alignItems: 'center',
  },
  monthlyCell: {
    fontSize: 12,
    color: tkColors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  cellRank: {
    width: 22,
    fontWeight: '700',
    color: tkColors.textSecondary,
  },
  cellName: {
    flex: 1,
    textAlign: 'left',
    paddingLeft: 4,
    fontWeight: '600',
    color: tkColors.text,
    fontSize: 13,
  },
  cellDays: {
    width: 32,
    color: tkColors.success,
    fontWeight: '600',
  },
  cellGames: {
    width: 28,
  },
  cellWLD: {
    width: 58,
  },
  cellRate: {
    width: 36,
  },
  monthlyWinRate: {
    fontWeight: '700',
    color: tkColors.primary,
  },
  monthlyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthlyTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: tkColors.text,
  },
  monthlyTitleSub: {
    fontSize: 11,
    color: tkColors.textSecondary,
    fontWeight: '500',
  },
  cellPoints: {
    width: 30,
  },
  monthlyPoints: {
    fontWeight: '700',
    color: tkColors.warning,
  },
  // Monthly matches table styles
  monthlyDateSection: {
    marginBottom: spacing.lg,
  },
  monthlyDateHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.text,
    backgroundColor: tkColors.borderLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  monthlyMatchesTable: {
    borderWidth: 1,
    borderColor: tkColors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  monthlyMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: tkColors.borderLight,
    backgroundColor: tkColors.card,
  },
  monthlyRoundDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    backgroundColor: tkColors.bg,
  },
  monthlyMatchNum: {
    width: 56,
    fontSize: 11,
    fontWeight: '600',
    color: tkColors.textTertiary,
    textAlign: 'center',
    paddingVertical: 10,
  },
  monthlyMatchTeam: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  monthlyMatchTeamWin: {
    backgroundColor: tkColors.successBg,
  },
  monthlyMatchTeamPlayers: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  monthlyPlayerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  monthlyPlayerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthlyMatchTeamText: {
    fontSize: 13,
    fontWeight: '500',
    color: tkColors.textSecondary,
    textAlign: 'center',
  },
  monthlyMatchTeamTextWin: {
    color: tkColors.success,
    fontWeight: '600',
  },
  monthlyMatchScore: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  monthlyMatchScoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.text,
  },
  monthlyMatchScoreEmpty: {
    fontSize: 14,
    color: tkColors.textTertiary,
  },
  monthlyScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthlyMatchScoreNum: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.textSecondary,
    minWidth: 14,
    textAlign: 'center',
  },
  monthlyScoreColon: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.textTertiary,
    marginHorizontal: 2,
  },
  scoreWinNum: {
    color: tkColors.success,
  },
  scoreLoseNum: {
    color: tkColors.error,
  },
  // Matchup highlight styles
  matchupGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  matchupItem: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  matchupBestPartner: {
    backgroundColor: tkColors.warningBg,
    borderColor: '#5F4B00',
  },
  matchupRival: {
    backgroundColor: '#0D1B2A',
    borderColor: '#1E3A5F',
  },
  matchupNemesis: {
    backgroundColor: tkColors.errorBg,
    borderColor: '#5F1E1E',
  },
  matchupEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  matchupLabel: {
    fontSize: 11,
    color: tkColors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  matchupName: {
    fontSize: 15,
    fontWeight: '700',
    color: tkColors.text,
    textAlign: 'center',
  },
  matchupValue: {
    fontSize: 12,
    color: tkColors.textSecondary,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  // Stats table styles
  statsTableHeader: {
    flexDirection: 'row',
    backgroundColor: tkColors.borderLight,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.border,
    alignItems: 'center',
  },
  statsTableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.borderLight,
    backgroundColor: tkColors.card,
    alignItems: 'center',
  },
  scrollableTable: {
    maxHeight: 240,
  },
  statsTableCell: {
    fontSize: 14,
    color: tkColors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  cellOppName: {
    flex: 1,
    textAlign: 'left',
    fontWeight: '600',
    color: tkColors.text,
    fontSize: 15,
  },
  cellOppGames: {
    width: 52,
    textAlign: 'center',
  },
  cellOppWLD: {
    width: 80,
    textAlign: 'center',
  },
  cellOppRate: {
    width: 60,
    fontWeight: '700',
    textAlign: 'center',
  },
  sortableHeader: {
    color: tkColors.primary,
    fontWeight: '600',
  },
  winRateHigh: {
    color: tkColors.success,
    backgroundColor: tkColors.successBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
    fontSize: 14,
  },
  winRateLow: {
    color: tkColors.error,
    backgroundColor: tkColors.errorBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
    fontSize: 14,
  },
  // Side stats styles
  sideStatsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: tkColors.bg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  sideStatBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  sideStatDivider: {
    width: 1,
    backgroundColor: tkColors.border,
  },
  sideStatLabel: {
    fontSize: 15,
    color: tkColors.textSecondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  sideStatValue: {
    fontSize: 36,
    fontWeight: '800',
    color: tkColors.primary,
    marginBottom: spacing.sm,
  },
  sideStatDetail: {
    fontSize: 14,
    color: tkColors.textSecondary,
    fontWeight: '600',
  },
  sideStatGames: {
    fontSize: 13,
    color: tkColors.textTertiary,
    marginTop: 6,
    fontWeight: '500',
  },
  // Chart button and modal styles
  chartBtn: {
    padding: 6,
    backgroundColor: tkColors.primaryBg,
    borderRadius: radius.sm,
  },
  chartModalOverlay: {
    flex: 1,
    backgroundColor: tkColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartModalContainer: {
    backgroundColor: tkColors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 400,
  },
  chartModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  chartModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tkColors.text,
  },
  // Daily view toggle styles
  dailyViewToggle: {
    flexDirection: 'row',
    backgroundColor: tkColors.navy,
    borderRadius: radius.sm,
    padding: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  dailyViewBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  dailyViewBtnActive: {
    backgroundColor: tkColors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dailyViewBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  dailyViewBtnTextActive: {
    color: tkColors.navy,
  },
  // Individual score table styles
  indivTable: {
    borderWidth: 1,
    borderColor: tkColors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: tkColors.card,
  },
  indivTableHeader: {
    flexDirection: 'row',
    backgroundColor: tkColors.borderLight,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.border,
  },
  indivTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: tkColors.borderLight,
    backgroundColor: tkColors.card,
    alignItems: 'center',
    minHeight: 44,
  },
  indivTableRowFirst: {
    borderTopWidth: 1,
    borderTopColor: tkColors.border,
  },
  indivRowMVP: {
    backgroundColor: '#2D2006',
  },
  indivHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: tkColors.textSecondary,
    textAlign: 'center',
  },
  // 헤더 셀 스타일
  indivCellRankHeader: {
    width: 36,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indivCellNameHeader: {
    width: 72,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indivCellWLDHeader: {
    width: 36,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indivCellGameHeader: {
    width: 52,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 데이터 셀 스타일
  indivCellRankCol: {
    width: 36,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indivRankText: {
    fontSize: 13,
    fontWeight: '600',
    color: tkColors.textTertiary,
  },
  indivCellNameCol: {
    width: 72,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indivNameBadge: {
    backgroundColor: tkColors.divider,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },
  indivNameBadgeMale: {
    backgroundColor: tkColors.male.bg,
  },
  indivNameBadgeFemale: {
    backgroundColor: tkColors.female.bg,
  },
  indivNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: tkColors.text,
  },
  indivNameTextMale: {
    color: tkColors.male.text,
  },
  indivNameTextFemale: {
    color: tkColors.female.text,
  },
  indivCellWLDCol: {
    width: 36,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indivWLDText: {
    fontSize: 13,
    fontWeight: '700',
    color: tkColors.text,
  },
  indivWLDWin: {
    color: tkColors.success,
  },
  indivWLDDraw: {
    color: tkColors.textSecondary,
  },
  indivWLDLoss: {
    color: tkColors.error,
  },
  indivGamesContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 6,
  },
  indivGameCell: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    backgroundColor: tkColors.bg,
    minWidth: 36,
  },
  indivCellWin: {
    backgroundColor: tkColors.successBg,
  },
  indivCellDraw: {
    backgroundColor: tkColors.border,
  },
  indivCellLoss: {
    backgroundColor: tkColors.errorBg,
  },
  indivScoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: tkColors.textSecondary,
  },
  indivScoreWin: {
    color: tkColors.success,
    fontWeight: '700',
  },
  indivScoreLoss: {
    color: tkColors.error,
    fontWeight: '600',
  },
  indivScoreEmpty: {
    fontSize: 14,
    color: tkColors.textTertiary,
  },
  // New individual view styles for group mode
  indivRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.border,
  },
  mvpRow: {
    backgroundColor: '#2D2006',
  },
  indivNameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    gap: 4,
    marginRight: 4,
  },
  indivRank: {
    fontSize: 12,
    fontWeight: '700',
    color: tkColors.textTertiary,
    width: 18,
    textAlign: 'center',
  },
  mvpBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FCD34D',
    backgroundColor: '#2D2006',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginLeft: 4,
  },
  indivGamesCol: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 3,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  indivGameNum: {
    fontSize: 8,
    color: tkColors.textTertiary,
    textAlign: 'center',
    marginBottom: 1,
  },
  indivGameScore: {
    fontSize: 11,
    fontWeight: '700',
    color: tkColors.text,
    textAlign: 'center',
  },
  cellNoResult: {
    backgroundColor: tkColors.divider,
  },
  cellWin: {
    backgroundColor: tkColors.successBg,
  },
  cellDraw: {
    backgroundColor: tkColors.border,
  },
  cellLoss: {
    backgroundColor: tkColors.errorBg,
  },
  indivSummaryCol: {
    width: 70,
    alignItems: 'flex-end',
    marginLeft: 4,
    paddingRight: 2,
  },
  indivRecord: {
    fontSize: 11,
    fontWeight: '700',
    color: tkColors.text,
  },
  indivDiff: {
    fontSize: 10,
    fontWeight: '600',
    color: tkColors.textTertiary,
    marginTop: 1,
  },
  saveRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  saveJpgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: tkColors.card,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: tkColors.border,
  },
  saveJpgText: {
    ...typography.captionMedium,
    color: tkColors.textSecondary,
    marginLeft: 6,
  },
  // ── 점수 편집 관련 스타일 ──
  editAnalysisCard: {
    marginTop: spacing.md,
  },
  editAnalysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  editAnalysisTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tkColors.text,
    flex: 1,
  },
  editAnalysisSummary: {
    fontSize: 13,
    color: tkColors.textSecondary,
    lineHeight: 20,
  },
  aiBadge: {
    backgroundColor: '#8b5cf6',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  aiLoadingText: {
    fontSize: 11,
    color: '#8b5cf6',
  },
  editProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  editProgressText: {
    fontSize: 12,
    color: tkColors.textSecondary,
    fontWeight: '600',
    minWidth: 65,
  },
  editProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: tkColors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  editProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  editGroupHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: tkColors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  editScoreCard: {
    marginTop: spacing.xs,
  },
  editMatchRow: {
    paddingVertical: spacing.sm,
  },
  editMatchBorder: {
    borderTopWidth: 1,
    borderTopColor: tkColors.borderLight,
  },
  editMatchNo: {
    fontSize: 11,
    color: tkColors.textTertiary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  editMatchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editTeamCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  editScoreCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  editScoreBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: tkColors.border,
    backgroundColor: tkColors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editScoreBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: tkColors.text,
  },
  editScoreColon: {
    fontSize: 16,
    fontWeight: '700',
    color: tkColors.textSecondary,
  },
  editBtnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  editSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tkColors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
  },
  editSaveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tkColors.white,
  },
  editSectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tkColors.borderLight,
  },
  editSectionToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: tkColors.textSecondary,
  },
  editReorderCard: {
    marginBottom: spacing.md,
  },
  editReorderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tkColors.text,
    marginBottom: spacing.sm,
  },
  editSwapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  editSwapArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: tkColors.textSecondary,
  },
  editActionBtn: {
    backgroundColor: tkColors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  editActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: tkColors.white,
  },
  editDivider: {
    height: 1,
    backgroundColor: tkColors.borderLight,
    marginVertical: spacing.md,
  },
  editDeleteConfirm: {
    backgroundColor: tkColors.errorBg,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  editDeleteConfirmText: {
    fontSize: 13,
    color: tkColors.error,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  editDeleteConfirmBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // 점수 피커 모달
  scorePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorePickerContainer: {
    backgroundColor: tkColors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: 280,
  },
  scorePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tkColors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  scorePickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  scorePickerItem: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: tkColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorePickerItemActive: {
    backgroundColor: tkColors.primary,
    borderColor: tkColors.primary,
  },
  scorePickerItemText: {
    fontSize: 18,
    fontWeight: '700',
    color: tkColors.text,
  },
  scorePickerItemTextActive: {
    color: tkColors.white,
  },
  // Photo score recognition
  photoScoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tkColors.info,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: 8,
  },
  photoScoreBtnText: {
    color: tkColors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  // 빈 점수표 템플릿
  scoreTemplBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  scoreTemplBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: tkColors.card,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: tkColors.border,
    gap: 6,
  },
  scoreTemplBtnText: {
    ...typography.captionMedium,
    color: tkColors.textSecondary,
  },
  scoreTemplOffscreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
  },
  scoreTemplSheet: {
    width: 520,
    backgroundColor: '#ffffff',
    padding: 24,
    borderWidth: 2,
    borderColor: '#333',
  },
  scoreTemplTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  scoreTemplTable: {
    borderWidth: 1,
    borderColor: '#333',
  },
  scoreTemplRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#999',
    minHeight: 36,
    alignItems: 'center',
  },
  scoreTemplRowAlt: {
    backgroundColor: '#f5f5f5',
  },
  scoreTemplHeaderRow: {
    backgroundColor: '#e0e0e0',
    borderBottomColor: '#333',
    borderBottomWidth: 2,
  },
  scoreTemplHeaderText: {
    fontWeight: '700',
    fontSize: 13,
    color: '#222',
  },
  scoreTemplCell: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 12,
    color: '#222',
    textAlign: 'center',
  },
  scoreTemplNumCell: {
    width: 32,
    borderRightWidth: 1,
    borderRightColor: '#999',
  },
  scoreTemplNameCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#999',
    textAlign: 'center',
  },
  scoreTemplScoreCell: {
    width: 100,
    borderRightWidth: 1,
    borderRightColor: '#999',
  },
  scoreTemplScoreText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    color: '#666',
  },
  scoreTemplFooter: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  scoreRecogOverlay: {
    flex: 1,
    backgroundColor: tkColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreRecogModal: {
    backgroundColor: tkColors.card,
    borderRadius: 16,
    padding: 20,
    width: 340,
    maxWidth: '90%' as any,
  },
  scoreRecogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tkColors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  scoreRecogRawText: {
    fontSize: 11,
    color: tkColors.textTertiary,
    marginBottom: 12,
    textAlign: 'left',
    maxHeight: 80,
    overflow: 'hidden',
    backgroundColor: tkColors.bg,
    padding: 8,
    borderRadius: 6,
  },
  scoreRecogItem: {
    backgroundColor: tkColors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: 8,
  },
  scoreRecogItemWarn: {
    borderWidth: 1,
    borderColor: tkColors.warning,
  },
  scoreRecogMatchNo: {
    fontSize: 12,
    fontWeight: '600',
    color: tkColors.textSecondary,
    marginBottom: 2,
  },
  scoreRecogTeams: {
    fontSize: 13,
    color: tkColors.text,
    marginBottom: 4,
  },
  scoreRecogScore: {
    fontSize: 22,
    fontWeight: '700',
    color: tkColors.text,
    textAlign: 'center',
  },
  scoreRecogActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  scoreRecogCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: tkColors.border,
    alignItems: 'center',
  },
  scoreRecogCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: tkColors.textSecondary,
  },
  scoreRecogApplyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: tkColors.primary,
    alignItems: 'center',
  },
  scoreRecogApplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: tkColors.white,
  },
  // ── Score Tab Styles (copied from match.tsx, adapted) ──
  scProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scProgressLabel: {
    ...typography.bodyMedium,
    color: tkColors.textSecondary,
  },
  scProgressPercent: {
    ...typography.bodyMedium,
    color: tkColors.primary,
    fontWeight: '700',
  },
  scScoreCard: {
    marginTop: spacing.sm,
  },
  scGroupHeader: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: tkColors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  scMatchContainer: {
    paddingVertical: spacing.md,
  },
  scMatchBorder: {
    borderTopWidth: 1,
    borderTopColor: tkColors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.lg,
  },
  scMatchHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  scLockBtn: {
    marginLeft: 6,
    padding: 2,
  },
  scDeleteSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tkColors.error,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  scDeleteSessionBtnText: {
    color: tkColors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  scDeleteSessionWarning: {
    textAlign: 'center',
    color: tkColors.error,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 22,
  },
  scDeleteSessionConfirmBtn: {
    backgroundColor: tkColors.error,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  scDeleteSessionConfirmBtnText: {
    color: tkColors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  scDeleteSessionCancelBtn: {
    backgroundColor: tkColors.navyLight,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  scDeleteSessionCancelBtnText: {
    color: tkColors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  scMatchNo: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: tkColors.textSecondary,
  },
  scTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  scTeamCol1: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 2,
    minWidth: 0,
  },
  scTeamCol2: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 2,
    minWidth: 0,
  },
  scTeamName: {
    fontSize: 12,
    fontWeight: '600',
    color: tkColors.text,
    lineHeight: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: tkColors.bg,
    overflow: 'hidden',
    maxWidth: 70,
  },
  scTeamNameMale: {
    fontSize: 12,
    fontWeight: '700',
    color: tkColors.male.text,
    lineHeight: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: tkColors.male.bg,
    overflow: 'hidden',
    maxWidth: 70,
  },
  scTeamNameFemale: {
    fontSize: 12,
    fontWeight: '700',
    color: tkColors.female.text,
    lineHeight: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: tkColors.female.bg,
    overflow: 'hidden',
    maxWidth: 70,
  },
  scPlayerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    justifyContent: 'flex-end',
    flexWrap: 'nowrap',
  },
  scPlayerRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
  },
  scInputCol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    flexShrink: 0,
  },
  scDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tkColors.bg,
    borderWidth: 1,
    borderColor: tkColors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 36,
    gap: 4,
  },
  scDropdownText: {
    fontSize: 16,
    fontWeight: '700',
    color: tkColors.text,
  },
  scColon: {
    fontSize: 18,
    fontWeight: '700',
    color: tkColors.textTertiary,
    marginHorizontal: 4,
  },
  scProbText: {
    fontSize: 9,
    fontWeight: '600',
    color: tkColors.textTertiary,
    marginHorizontal: 1,
    minWidth: 22,
    textAlign: 'center',
  },
  scProbTextHigh: {
    color: tkColors.success,
    fontWeight: '700',
  },
  scRecordBtnSmall: {
    padding: 3,
    marginHorizontal: 1,
    backgroundColor: tkColors.primaryBg,
    borderRadius: 3,
  },
  scSideToggle: {
    flexDirection: 'row',
    marginHorizontal: 1,
  },
  scSideBtn: {
    paddingVertical: 1,
    paddingHorizontal: 3,
    backgroundColor: tkColors.bg,
    borderRadius: 2,
    marginHorizontal: 0,
  },
  scSideBtnActive: {
    backgroundColor: tkColors.primary,
  },
  scSideBtnText: {
    fontSize: 8,
    color: tkColors.textSecondary,
    fontWeight: '600',
  },
  scSideBtnTextActive: {
    color: tkColors.white,
  },
  scJpgWatermark: {
    backgroundColor: tkColors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: tkColors.divider,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  scJpgWatermarkText: {
    ...typography.body,
    fontWeight: '700',
    color: tkColors.text,
    fontSize: 14,
  },
  scHighlightRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  scHighlightEmoji: {
    fontSize: 14,
    width: 22,
    textAlign: 'center' as const,
  },
  scHighlightLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: tkColors.textSecondary,
    width: 55,
  },
  scHighlightValue: {
    fontSize: 13,
    color: tkColors.text,
    flex: 1,
  },
  scEditSectionHeader: {
    paddingVertical: spacing.md,
  },
  scEditSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tkColors.text,
  },
  scEditSectionContent: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tkColors.divider,
  },
  scEditSubTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: tkColors.text,
    marginBottom: spacing.xs,
  },
  scEditTeamLabel: {
    ...typography.captionMedium,
    fontWeight: '600',
    color: tkColors.textSecondary,
    marginBottom: 2,
  },
  scEditApplyBtn: {
    backgroundColor: tkColors.successBg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: tkColors.success,
  },
  scEditApplyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: tkColors.success,
  },
  scEditDeleteBtn: {
    backgroundColor: tkColors.errorBg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: tkColors.error,
  },
  scEditDeleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: tkColors.error,
  },
  scEditCaption: {
    ...typography.caption,
    color: tkColors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  scEditDivider: {
    height: 1,
    backgroundColor: tkColors.border,
    marginVertical: spacing.lg,
  },
  scEditDeleteWarning: {
    ...typography.captionMedium,
    color: tkColors.error,
    backgroundColor: tkColors.errorBg,
    padding: spacing.md,
    borderRadius: radius.sm,
    lineHeight: 20,
  },
  scEditCancelBtn: {
    backgroundColor: tkColors.bg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: 0,
  },
  scEditCancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: tkColors.textSecondary,
  },
  // Record Modal
  scRecordContainer: {
    backgroundColor: tkColors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: tkColors.border,
  },
  scRecordTitle: {
    ...typography.title,
    fontSize: 18,
    color: tkColors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  scRecordFilterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  scRecordFilterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: tkColors.bg,
    borderWidth: 1,
    borderColor: tkColors.border,
  },
  scRecordFilterBtnActive: {
    backgroundColor: tkColors.primary,
    borderColor: tkColors.primary,
  },
  scRecordFilterBtnText: {
    ...typography.captionMedium,
    color: tkColors.textSecondary,
  },
  scRecordFilterBtnTextActive: {
    color: tkColors.white,
  },
  scRecordSection: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.divider,
  },
  scRecordSectionTitle: {
    ...typography.bodyMedium,
    color: tkColors.textSecondary,
    marginBottom: spacing.sm,
  },
  scRecordStatText: {
    ...typography.bodyMedium,
    color: tkColors.text,
  },
  scRecordWinRateSmall: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  scRecordWinRateHigh: {
    color: tkColors.success,
  },
  scRecordWinRateLow: {
    color: tkColors.error,
  },
  scRecordNoData: {
    ...typography.caption,
    color: tkColors.textTertiary,
    fontStyle: 'italic',
  },
  scRecordOpponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tkColors.divider,
  },
  scRecordOpponentName: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: tkColors.text,
    flex: 1,
  },
  scRecordCloseBtn: {
    backgroundColor: tkColors.bg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  scRecordCloseBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: tkColors.textSecondary,
  },
});
