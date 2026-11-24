import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import NativeBlurBackdrop from "./NativeBlurBackdrop";

const HOLD_DURATION_MS = 5_000;
const SCAN_PHASES = ["Processing", "Initializing", "Verifying", "Confirming", "Confirming"];

type Props = {
  visible: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function NativeHoldToConfirmDialog({
  visible,
  busy = false,
  errorMessage = null,
  onCancel,
  onConfirm,
}: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.max(216, Math.min(256, width - 40, height - 80));
  const center = size / 2;
  const radius = center - 6;
  const circumference = Math.PI * radius * 2;
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const cancelOnReleaseRef = useRef(false);
  const scanLine = useRef(new Animated.Value(0)).current;

  const clearScan = () => {
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    intervalRef.current = null;
    startedAtRef.current = null;
    cancelOnReleaseRef.current = false;
    setScanning(false);
    setProgress(0);
  };

  const beginScan = (cancelOnRelease: boolean) => {
    if (!visible || busy || intervalRef.current !== null) return;
    startedAtRef.current = Date.now();
    cancelOnReleaseRef.current = cancelOnRelease;
    setProgress(0);
    setScanning(true);
    intervalRef.current = setInterval(() => {
      if (startedAtRef.current === null) return;
      const nextProgress = Math.min((Date.now() - startedAtRef.current) / HOLD_DURATION_MS, 1);
      setProgress(nextProgress);
      if (nextProgress === 1) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        startedAtRef.current = null;
        cancelOnReleaseRef.current = false;
        setScanning(false);
        onConfirm();
      }
    }, 50);
  };

  const cancelEarly = () => {
    if (!cancelOnReleaseRef.current || intervalRef.current === null) return;
    clearScan();
  };

  const cancelDialog = () => {
    if (busy) return;
    clearScan();
    onCancel();
  };

  useEffect(() => {
    if (!visible && intervalRef.current !== null) clearScan();
  }, [visible]);

  useEffect(() => () => {
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (!scanning) {
      scanLine.setValue(0);
      return;
    }
    const scanAnimation = Animated.loop(Animated.sequence([
      Animated.timing(scanLine, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(scanLine, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    scanAnimation.start();
    return () => scanAnimation.stop();
  }, [scanLine, scanning]);

  const phaseIndex = Math.min(Math.floor(progress * SCAN_PHASES.length), SCAN_PHASES.length - 1);
  const phase = progress === 1 ? "Done" : scanning ? SCAN_PHASES[phaseIndex] : "Hold here to confirm";
  const step = Math.min(Math.floor(progress * SCAN_PHASES.length) + 1, SCAN_PHASES.length);
  const scanActive = scanning || progress === 1 || busy;
  const scanLineY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [-48, 48] });

  return (
    <Modal
      animationType="fade"
      onRequestClose={cancelDialog}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <NativeBlurBackdrop intensity={42} overlayColor="rgba(1,7,20,0.42)" />
        <Pressable
          accessibilityLabel="Cancel confirmation"
          disabled={busy}
          onPress={cancelDialog}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          accessibilityActions={[{ name: "activate", label: "Start simulated 5-second scan" }]}
          accessibilityHint="Hold the scanner for 5 seconds. Releasing early cancels. Screen readers can start the scan and wait."
          accessibilityLabel="Fingerprint scanner. Hold here to confirm."
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, selected: scanning }}
          disabled={busy}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "activate") beginScan(false);
          }}
          onPressIn={() => beginScan(true)}
          onPressOut={cancelEarly}
          style={({ pressed }) => [
            styles.scanner,
            {
              width: size,
              height: size,
              borderRadius: center,
              borderColor: scanActive ? "#ff6078" : "rgba(91,230,255,0.7)",
              backgroundColor: scanActive ? "rgba(35,5,14,0.98)" : "rgba(3,13,29,0.98)",
              shadowColor: scanActive ? "#ff2348" : "#20dfff",
              shadowRadius: scanActive ? 34 : 24,
            },
            pressed && !busy && styles.pressed,
          ]}
        >
          <View pointerEvents="none" style={[styles.innerRing, scanActive && styles.scanningInnerRing, { width: size * 0.84, height: size * 0.84, borderRadius: size * 0.42 }]} />
          <View pointerEvents="none" style={[styles.coreRing, scanActive && styles.scanningCoreRing, { width: size * 0.7, height: size * 0.7, borderRadius: size * 0.35 }]} />
          <Svg pointerEvents="none" height={size} style={StyleSheet.absoluteFill} viewBox={`0 0 ${size} ${size}`} width={size}>
            <Circle
              cx={center}
              cy={center}
              fill="none"
              r={radius}
              stroke={scanActive ? "rgba(255,70,100,0.3)" : "rgba(58,214,255,0.22)"}
              strokeWidth={2}
            />
            <Circle
              cx={center}
              cy={center}
              fill="none"
              r={radius}
              stroke={scanActive ? "#ff3858" : "#55e8ff"}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              strokeWidth={3}
            />
            <Circle
              cx={center}
              cy={center}
              fill="none"
              r={size * 0.39}
              stroke={scanActive ? "rgba(255,90,120,0.22)" : "rgba(95,182,255,0.2)"}
              strokeDasharray="2 8"
              strokeWidth={1}
            />
          </Svg>
          <View style={styles.scannerContent}>
            <Text style={[styles.phase, scanActive && styles.scanningPhase]}>{phase}</Text>
            {scanning || progress === 1 ? <Text style={[styles.step, scanActive && styles.scanningStep]}>STEP {String(step).padStart(2, "0")} / 05</Text> : null}
            {errorMessage ? <Text accessibilityRole="alert" numberOfLines={2} style={styles.error}>{errorMessage}</Text> : null}
            <View style={styles.fingerprintStage}>
              <Svg height={96} viewBox="0 0 24 24" width={96}>
                <Path d="M12 2.8a9.2 9.2 0 0 0-9.2 9.2" fill="none" stroke={scanActive ? "#ffb2bd" : "#baf7ff"} strokeLinecap="round" strokeWidth={1.4} />
                <Path d="M12 5.3a6.7 6.7 0 0 0-6.7 6.7c0 3.1-.5 5.7-1.6 8.2" fill="none" stroke={scanActive ? "#ff7189" : "#8beeff"} strokeLinecap="round" strokeWidth={1.4} />
                <Path d="M12 7.8a4.2 4.2 0 0 0-4.2 4.2c0 3.8-.5 6.8-1.7 9.2" fill="none" stroke={scanActive ? "#ffb2bd" : "#baf7ff"} strokeLinecap="round" strokeWidth={1.4} />
                <Path d="M12 10.3a1.7 1.7 0 0 0-1.7 1.7c0 4.2-.4 7.3-1.5 9.8" fill="none" stroke={scanActive ? "#ff7189" : "#8beeff"} strokeLinecap="round" strokeWidth={1.4} />
                <Path d="M12 2.8a9.2 9.2 0 0 1 9.2 9.2c0 4.1-.5 7.5-1.6 10" fill="none" stroke={scanActive ? "#ffb2bd" : "#baf7ff"} strokeLinecap="round" strokeWidth={1.4} />
                <Path d="M12 5.3a6.7 6.7 0 0 1 6.7 6.7c0 3.5-.3 6.5-1.2 9" fill="none" stroke={scanActive ? "#ff7189" : "#8beeff"} strokeLinecap="round" strokeWidth={1.4} />
                <Path d="M12 7.8a4.2 4.2 0 0 1 4.2 4.2c0 2.9-.2 5.2-.9 7.3" fill="none" stroke={scanActive ? "#ffb2bd" : "#baf7ff"} strokeLinecap="round" strokeWidth={1.4} />
              </Svg>
              {scanning ? <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} /> : null}
            </View>
            <Text style={[styles.simulated, scanActive && styles.scanningSimulated]}>FINGERPRINT SCAN</Text>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  scanner: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(91,230,255,0.7)",
    backgroundColor: "rgba(3,13,29,0.98)",
    shadowColor: "#20dfff",
    shadowOpacity: 0.62,
    shadowOffset: { width: 0, height: 0 },
    elevation: 22,
  },
  innerRing: { position: "absolute", borderWidth: 1, borderColor: "rgba(47,199,255,0.17)" },
  scanningInnerRing: { borderColor: "rgba(255,70,100,0.22)" },
  coreRing: { position: "absolute", borderWidth: 1, borderColor: "rgba(122,102,255,0.16)" },
  scanningCoreRing: { borderColor: "rgba(255,80,110,0.19)" },
  scannerContent: { alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  fingerprintStage: { width: 104, height: 104, alignItems: "center", justifyContent: "center", marginTop: 7 },
  scanLine: {
    position: "absolute",
    width: 98,
    height: 2,
    backgroundColor: "#ff425e",
    shadowColor: "#ff2348",
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  phase: { marginTop: 1, color: "#e5fcff", fontSize: 15, fontWeight: "900", letterSpacing: 1.5, textAlign: "center" },
  scanningPhase: { color: "#ff8b9d" },
  step: { marginTop: 5, color: "#48dff5", fontSize: 9, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  scanningStep: { color: "#ff506c" },
  error: { maxWidth: 205, marginTop: 7, color: "#fda4af", fontSize: 10, lineHeight: 14, textAlign: "center" },
  simulated: { marginTop: 7, color: "rgba(151,207,230,0.6)", fontSize: 7, fontWeight: "800", letterSpacing: 1.2, textAlign: "center" },
  scanningSimulated: { color: "rgba(255,130,150,0.7)" },
  pressed: { transform: [{ scale: 0.985 }] },
});
