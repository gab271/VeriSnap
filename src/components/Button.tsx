/**
 * Actions. Two weights only — anything more and the hierarchy stops meaning
 * something.
 *
 * Square corners, tracked uppercase labels: these read as the stamped controls on
 * an instrument or a form, not as app buttons. `primary` is a solid cyan block
 * (the one bright surface in the palette, so it is unmissable); `secondary` is a
 * hairline outline that recedes.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { palette, radius, space, type } from '@/theme/tokens';

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** `danger` is secondary weight, tinted — it must never be the easy button. */
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        primary && styles.primary,
        variant === 'secondary' && styles.secondary,
        danger && styles.danger,
        pressed && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? palette.ink : danger ? palette.vermilion : palette.cyan} />
      ) : (
        <Text
          style={[
            styles.label,
            primary && styles.labelPrimary,
            variant === 'secondary' && styles.labelSecondary,
            danger && styles.labelDanger,
          ]}
        >
          {label.toUpperCase()}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  primary: { backgroundColor: palette.cyan },
  secondary: { borderWidth: 1, borderColor: palette.rule },
  danger: { borderWidth: 1, borderColor: palette.vermilion },
  pressed: { opacity: 0.75 },
  inactive: { opacity: 0.45 },
  label: { ...type.label },
  labelPrimary: { color: palette.ink },
  labelSecondary: { color: palette.chalk },
  labelDanger: { color: palette.vermilion },
});
