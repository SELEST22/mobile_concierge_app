import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const isDisabled = disabled || loading;
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.emergency : 'transparent';
  const textColor = variant === 'ghost' ? colors.primary : colors.white;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg },
        variant === 'ghost' && styles.ghost,
        (pressed || isDisabled) && styles.dim,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
  },
  ghost: { borderWidth: 1, borderColor: colors.primary },
  dim: { opacity: 0.6 },
  text: { fontSize: 16, fontWeight: '600' },
});
