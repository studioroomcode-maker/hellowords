import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme/tokens';

interface CardProps {
  children: ReactNode;
  title?: string;
  style?: StyleProp<ViewStyle>;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  noPadding?: boolean;
  variant?: 'default' | 'elevated' | 'accent';
}

export function Card({ children, title, style, headerLeft, headerRight, noPadding, variant = 'default' }: CardProps) {
  return (
    <View style={[
      styles.card,
      variant === 'elevated' && styles.elevated,
      variant === 'accent' && styles.accent,
      noPadding && styles.noPadding,
      style,
    ]}>
      {(title || headerLeft || headerRight) && (
        <View style={[styles.header, noPadding && styles.headerPadded]}>
          {headerLeft && <View style={styles.headerLeft}>{headerLeft}</View>}
          {title && <Text style={styles.title}>{title}</Text>}
          {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xl,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  accent: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  noPadding: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerPadded: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    letterSpacing: 0.3,
  },
  headerLeft: {
    marginRight: spacing.sm,
  },
  headerRight: {
    marginLeft: spacing.sm,
  },
});
