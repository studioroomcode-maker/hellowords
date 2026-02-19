import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, FONT_FAMILY } from '../../theme/tokens';

export function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>Tennis Note</Text>
      <Text style={styles.footerCopyright}>
        Copyright 2026. Studioroom. All rights reserved.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
    paddingVertical: spacing.lg,
  },
  footerText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textTertiary,
    fontFamily: FONT_FAMILY,
  },
  footerCopyright: {
    fontSize: 12,
    color: colors.border,
    marginTop: spacing.xs,
  },
});
