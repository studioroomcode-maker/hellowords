import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme/tokens';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  size?: 'small' | 'medium';
  style?: ViewStyle;
  disabled?: boolean;
}

export function Chip({
  label,
  selected = false,
  onPress,
  variant = 'default',
  size = 'medium',
  style,
  disabled = false,
}: ChipProps) {
  const variantStyles = {
    default: { bg: selected ? colors.primary : colors.navyLight, text: selected ? colors.black : colors.text },
    success: { bg: colors.successBg, text: colors.success },
    error: { bg: colors.errorBg, text: colors.error },
    warning: { bg: colors.warningBg, text: colors.warning },
    info: { bg: colors.infoBg, text: colors.info },
  };

  const v = variantStyles[variant];

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        size === 'small' && styles.chipSmall,
        { backgroundColor: v.bg },
        selected && variant === 'default' && styles.chipSelected,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.label,
        size === 'small' && styles.labelSmall,
        { color: v.text },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  chipSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipSelected: {
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.bodyMedium,
  },
  labelSmall: {
    ...typography.captionMedium,
  },
});
