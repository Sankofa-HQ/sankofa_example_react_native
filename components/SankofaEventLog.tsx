import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'screen' | 'track' | 'identify' | 'people' | 'reset';
  label: string;
  detail?: string;
}

interface Props {
  entries: LogEntry[];
}

const TYPE_CONFIG: Record<LogEntry['type'], { emoji: string; color: string; bg: string }> = {
  screen:   { emoji: '📍', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
  track:    { emoji: '📈', color: '#F5A623', bg: 'rgba(245,166,35,0.1)' },
  identify: { emoji: '👤', color: '#A78BFA', bg: 'rgba(167,139,250,0.1)' },
  people:   { emoji: '🧑‍💼', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
  reset:    { emoji: '🔄', color: '#F87171', bg: 'rgba(248,113,113,0.1)' },
};

export function SankofaEventLog({ entries }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  const onContentChange = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>⚡</Text>
        <Text style={styles.emptyText}>Events will appear here</Text>
        <Text style={styles.emptyHint}>Tap the buttons above to fire Sankofa events</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.list}
      onContentSizeChange={onContentChange}
      showsVerticalScrollIndicator={false}
    >
      {entries.map((entry) => {
        const cfg = TYPE_CONFIG[entry.type];
        return (
          <View key={entry.id} style={[styles.row, { backgroundColor: cfg.bg, borderLeftColor: cfg.color }]}>
            <View style={styles.rowHeader}>
              <Text style={styles.emoji}>{cfg.emoji}</Text>
              <Text style={[styles.label, { color: cfg.color }]}>{entry.label}</Text>
              <Text style={styles.time}>{entry.timestamp}</Text>
            </View>
            {entry.detail ? (
              <Text style={styles.detail}>{entry.detail}</Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  list: { padding: 12, gap: 8 },
  row: {
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emoji: { fontSize: 16 },
  label: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  time: {
    fontSize: 10,
    color: '#5A5A6E',
    fontVariant: ['tabular-nums'],
  },
  detail: {
    marginTop: 4,
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 24,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyIcon: { fontSize: 40, marginBottom: 4 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#E5E7EB' },
  emptyHint: { fontSize: 13, color: '#5A5A6E', textAlign: 'center' },
});
