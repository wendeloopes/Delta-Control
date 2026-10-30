import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop, Path } from 'react-native-svg';

export type VoiceOrbState = 'idle' | 'listening' | 'processing' | 'success' | 'error';
type Props = {
  state: VoiceOrbState;
  level?: number;
  size?: number;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onPress?: () => void;
};

export default function VoiceOrb({ state, level = 0, size = 190, onPressIn, onPressOut, onPress }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const voice = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const listening = state === 'listening';
  const processing = state === 'processing';
  const error = state === 'error';

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => setReduceMotion(false));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  // The ribbons react to the microphone's measured input level, not to a free-running rotation.
  useEffect(() => {
    const target = listening ? Math.max(0, Math.min(1, level)) : 0;
    Animated.spring(voice, { toValue: target, speed: 22, bounciness: 5, useNativeDriver: true }).start();
  }, [level, listening, voice]);

  useEffect(() => {
    pulse.stopAnimation();
    if (reduceMotion) {
      pulse.setValue(0.25);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: listening ? 850 : processing ? 1500 : 3200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: listening ? 850 : processing ? 1500 : 3200, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [listening, processing, pulse, reduceMotion]);

  useEffect(() => {
    if (state !== 'error' && state !== 'success') {
      flash.stopAnimation();
      flash.setValue(0);
      return;
    }
    if (reduceMotion) { flash.setValue(0.35); return; }
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.delay(state === 'success' ? 210 : 510),
      Animated.timing(flash, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]).start();
  }, [flash, reduceMotion, state]);

  const waveY = voice.interpolate({ inputRange: [0, 1], outputRange: [0, -13] });
  const waveScale = voice.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.12] });
  const waveOpacity = voice.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0.62, 0.72, 1] });
  const haloOpacity = error || state === 'success' ? flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.62] }) : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, listening ? 0.55 : 0.32] });
  const scale = listening
    ? voice.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] })
    : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] });

  function pressIn() {
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      onPressIn?.();
    }, 250);
  }
  function pressOut() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (held.current) onPressOut?.();
    else onPress?.();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Falar um lançamento"
      accessibilityHint="Toque para iniciar ou parar. Segure para falar e solte para enviar."
      accessibilityState={{ busy: listening || processing }}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={styles.touch}
    >
      <Animated.View style={[styles.halo, { backgroundColor: error ? '#FF6685' : state === 'success' ? '#35F6A0' : '#644CFF', width: size + 72, height: size + 72, borderRadius: (size + 72) / 2, opacity: haloOpacity, transform: [{ scale }] }]} />
      <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
          <Svg width={size} height={size} viewBox="0 0 200 200">
            <Defs>
              <RadialGradient id="orbGlass" cx="48%" cy="43%" rx="58%" ry="58%">
                <Stop offset="0%" stopColor="#111322" stopOpacity="0.96" />
                <Stop offset="72%" stopColor="#03040A" stopOpacity="0.99" />
                <Stop offset="100%" stopColor="#10152B" stopOpacity="1" />
              </RadialGradient>
              <LinearGradient id="orbEdge" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#B8A5FF" />
                <Stop offset="38%" stopColor="#3D7BFF" />
                <Stop offset="70%" stopColor="#38F5FF" />
                <Stop offset="100%" stopColor="#6D56D9" />
              </LinearGradient>
            </Defs>
            <Circle cx="100" cy="100" r="96" fill="url(#orbGlass)" stroke="url(#orbEdge)" strokeWidth="1.5" />
            <Circle cx="100" cy="100" r="93" fill="none" stroke="#9AA8FF" strokeOpacity="0.12" strokeWidth="1" />
            <Circle cx="103" cy="8" r="2.3" fill="#FFFFFF" opacity="0.9" />
            <Circle cx="184" cy="81" r="1.7" fill="#A8B9FF" opacity="0.85" />
            <Circle cx="17" cy="74" r="1.4" fill="#43EFFF" opacity="0.75" />
          </Svg>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: waveOpacity, transform: [{ translateY: waveY }, { scaleY: waveScale }] }]}>
            <Svg width={size} height={size} viewBox="0 0 200 200">
              <Defs>
                <LinearGradient id="orbWaveA" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#F000FF" stopOpacity="0.95" />
                  <Stop offset="46%" stopColor="#FFFFFF" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#19EFFF" stopOpacity="0.95" />
                </LinearGradient>
                <LinearGradient id="orbWaveB" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#8B20FF" stopOpacity="0.05" />
                  <Stop offset="30%" stopColor="#F000FF" stopOpacity="0.92" />
                  <Stop offset="60%" stopColor="#B4FFFF" stopOpacity="0.9" />
                  <Stop offset="100%" stopColor="#00DFFF" stopOpacity="0.12" />
                </LinearGradient>
              </Defs>
              <Path d="M8 96 C38 67 55 71 83 91 C107 108 126 112 151 92 C169 78 184 82 192 97 C168 119 146 123 119 107 C91 91 72 87 49 103 C29 117 16 111 8 96Z" fill="url(#orbWaveB)" opacity="0.95" />
              <Path d="M5 101 C31 88 48 92 72 99 C95 106 109 108 132 99 C158 88 177 90 195 101 C173 111 155 112 131 105 C108 98 92 97 69 106 C43 116 23 112 5 101Z" fill="url(#orbWaveA)" />
              <Path d="M8 102 C44 98 57 101 81 104 C111 108 132 99 158 98 C173 98 184 100 192 103" fill="none" stroke="#FFFFFF" strokeOpacity="0.92" strokeWidth="2.2" />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { alignItems: 'center', justifyContent: 'center', width: 270, height: 270 },
  halo: { position: 'absolute', backgroundColor: '#644CFF' },
});
