import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from "react-native";
import { useNativeTheme } from "../contexts/NativeThemeProvider";

const RIPPLE_SIZE = 72;

export default function NativeLiquidGlassTouchLayer({ children }: { children: ReactNode }) {
  const { theme } = useNativeTheme();
  const firstRing = useRef(new Animated.Value(0)).current;
  const secondRing = useRef(new Animated.Value(0)).current;
  const [touchPoint, setTouchPoint] = useState<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((event: GestureResponderEvent) => {
    if (theme !== "liquidGlass") return;
    const { locationX: x, locationY: y } = event.nativeEvent;
    setTouchPoint({ x, y });
    firstRing.setValue(0);
    secondRing.setValue(0);
    Animated.parallel([
      Animated.timing(firstRing, { toValue: 1, duration: 620, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(90),
        Animated.timing(secondRing, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ]).start();
  }, [firstRing, secondRing, theme]);

  return (
    <View onTouchStart={onTouchStart} style={styles.root}>
      {children}
      {theme === "liquidGlass" && touchPoint ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              styles.ripple,
              {
                left: touchPoint.x - RIPPLE_SIZE / 2,
                top: touchPoint.y - RIPPLE_SIZE / 2,
                opacity: firstRing.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.7, 0.42, 0] }),
                transform: [{ scale: firstRing.interpolate({ inputRange: [0, 1], outputRange: [0.18, 2.1] }) }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ripple,
              styles.rippleSecondary,
              {
                left: touchPoint.x - RIPPLE_SIZE / 2,
                top: touchPoint.y - RIPPLE_SIZE / 2,
                opacity: secondRing.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.45, 0.28, 0] }),
                transform: [{ scale: secondRing.interpolate({ inputRange: [0, 1], outputRange: [0.18, 2.1] }) }],
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  ripple: {
    position: "absolute",
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.78)",
    backgroundColor: "rgba(235,240,242,0.08)",
  },
  rippleSecondary: {
    borderWidth: 1,
    borderColor: "rgba(220,230,234,0.46)",
    backgroundColor: "transparent",
  },
});
