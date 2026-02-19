import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme/tokens';

interface StatPillProps {
  label: string;
  value: string | number;
  color?: string;
  bgColor?: string;
  style?: ViewStyle;
  size?: 'small' | 'medium';
}

export function StatPill({
  label,
  value,
  color = colors.text,
  bgColor = colors.bg,
  style,
  size = 'medium',
}: StatPillProps) {
  return (
    <View style={[styles.container, { backgroundColor: bgColor }, size === 'small' && styles.containerSmall, style]}>
      <Text style={[styles.value, { color }, size === 'small' && styles.valueSmall]}>{value}</Text>
      <Text style={[styles.label, size === 'small' && styles.labelSmall]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    flex: 1,
  },
  containerSmall: {
    paddingVertical: spacing.sm,
  },
  value: {
    ...typography.stat,
  },
  valueSmall: {
    fontSize: 18,
    lineHeight: 24,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  labelSmall: {
    fontSize: 11,
  },
});
