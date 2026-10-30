import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { parseCommand, ParsedCommand } from '../lib/parseCommand';

type VoiceState = 'idle' | 'listening' | 'processing' | 'success' | 'error';

export function useVoiceCommand(onCommand: (command: ParsedCommand) => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [level, setLevel] = useState(0);
  const transcriptRef = useRef('');
  const startCancelledRef = useRef(false);
  const startPendingRef = useRef(false);
  const ignoreEndRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const clearTimeoutRef = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
    startupTimerRef.current = null;
  };

  useSpeechRecognitionEvent('start', () => {
    if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
    startupTimerRef.current = null;
    setState('listening');
    setError('');
  });
  useSpeechRecognitionEvent('result', event => {
    const value = event.results?.map(result => result.transcript).join(' ').trim() ?? '';
    if (value) {
      transcriptRef.current = value;
      setTranscript(value);
      if (event.isFinal) setState('processing');
    }
  });
  useSpeechRecognitionEvent('volumechange', event => {
    const normalized = Math.max(0, Math.min(1, (event.value + 2) / 12));
    setLevel(normalized);
  });
  useSpeechRecognitionEvent('error', event => {
    clearTimeoutRef();
    if (event.error === 'aborted') return;
    setLevel(0);
    setState('error');
    setError(event.error === 'no-speech' || event.error === 'speech-timeout'
      ? 'Não ouvi nada, tente de novo'
      : event.error === 'not-allowed'
        ? 'Permita o microfone para lançar por voz'
        : 'Reconhecimento de voz indisponível agora');
  });
  useSpeechRecognitionEvent('end', () => {
    clearTimeoutRef();
    if (ignoreEndRef.current) { ignoreEndRef.current = false; return; }
    setLevel(0);
    const spoken = transcriptRef.current.trim();
    if (!spoken) {
      setState(current => current === 'error' ? current : 'error');
      setError(current => current || 'Não ouvi nada, tente de novo');
      return;
    }
    setState('processing');
    const parsed = parseCommand(spoken);
    if (!parsed) {
      setState('error');
      setError('Não entendi o lançamento. Você pode corrigir o texto.');
      return;
    }
    onCommandRef.current(parsed);
    setState('success');
  });

  const start = useCallback(async () => {
    if (state === 'listening' || state === 'processing' || startPendingRef.current) return true;
    startPendingRef.current = true;
    startCancelledRef.current = false;
    ignoreEndRef.current = false;
    setError('');
    setTranscript('');
    transcriptRef.current = '';
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (startCancelledRef.current) return false;
      if (!permission.granted) {
        setState('error');
        setError('Permita o microfone para lançar por voz');
        return false;
      }
      setState('listening');
      ExpoSpeechRecognitionModule.start({
        lang: 'pt-BR',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 150 },
        recordingOptions: { persist: false },
      });
      // Do not leave the interface pretending to listen if Android never starts its speech service.
      startupTimerRef.current = setTimeout(() => {
        startupTimerRef.current = null;
        try { ExpoSpeechRecognitionModule.abort(); } catch { /* service did not start */ }
        setLevel(0);
        setState('error');
        setError('O serviço de reconhecimento não iniciou. Verifique se há um serviço de voz instalado no Android.');
      }, 4500);
      timeoutRef.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), 15000);
      return true;
    } catch {
      setState('error');
      setError('Reconhecimento de voz indisponível agora');
      return false;
    } finally {
      startPendingRef.current = false;
    }
  }, [state]);

  const stop = useCallback(() => {
    startCancelledRef.current = true;
    clearTimeoutRef();
    setLevel(0);
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* recognition may already be closed */ }
  }, []);

  const cancel = useCallback(() => {
    startCancelledRef.current = true;
    ignoreEndRef.current = true;
    clearTimeoutRef();
    transcriptRef.current = '';
    setTranscript('');
    setLevel(0);
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* recognition may already be closed */ }
    setState('idle');
  }, []);

  useEffect(() => {
    if (state !== 'success') return;
    const timer = setTimeout(() => {
      setState('idle');
      setTranscript('');
      transcriptRef.current = '';
    }, 3000);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') cancel();
    });
    return () => {
      subscription.remove();
      clearTimeoutRef();
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore unmount cleanup */ }
    };
  }, [cancel]);

  const reset = useCallback(() => {
    setState('idle');
    setTranscript('');
    setError('');
    transcriptRef.current = '';
    setLevel(0);
  }, []);

  return { state, transcript, error, level, start, stop, cancel, reset, openSettings: () => Linking.openSettings() };
}
