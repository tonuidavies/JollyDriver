import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** extra bottom padding so content clears the tab bar / FAB */
  bottomPad?: number;
  /** apply the top safe-area inset (status bar / notch). Default true. */
  topPad?: boolean;
};

/**
 * Screen wrapper that guarantees content stays inside the safe area.
 * SDK 54 enables Android edge-to-edge by default, so we pad for the status
 * bar (top) and the gesture/nav bar (bottom) on every screen.
 */
export default function Screen({
  children,
  scroll = true,
  contentStyle,
  bottomPad = spacing.xl,
  topPad = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const edges = (topPad ? ['top', 'left', 'right'] : ['left', 'right']) as any;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.root} edges={edges}>
        <View style={[styles.content, { paddingBottom: bottomPad + insets.bottom }, contentStyle]}>
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.sm, paddingBottom: bottomPad + insets.bottom },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.marginMobile,
  },
});
