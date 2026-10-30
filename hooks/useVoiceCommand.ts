import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { parseCommand, ParsedCommand } from '../lib/parseCommand';

type VoiceState = 'idle' | 'listening' | 'processing' | 'success' | 'error';

const STARTUP_TIMEOUT_MS = 7000;
const LISTENING_TIMEOUT_MS = 20000;

function messageForRecognitionError(code?: string, message?: string) {
  const detail = message?.trim();
  switch (code) {
    case 'not-allowed':
      return 'Permita o acesso ao microfone nas configurações do Android.';
    case 'no-speech':
    case 'speech-timeout':
      return 'Não detectei fala. Toque na esfera e fale novamente.';
    case 'language-not-supported':
      return 'O serviço de voz deste Android não oferece suporte a português (Brasil).';
    case 'service-not-allowed':
      return 'O serviço de reconhecimento de voz não está disponível neste aparelho.';
    case 'network':
      return 'O serviço de voz falhou por causa da conexão. Verifique a internet e tente novamente.';
    case 'aborted':
      return '';
    default:
      return detail ? `Falha no reconhecimento: ${detail}` : `Reconhecimento de voz indisponível (${code || 'erro desconhecido'}).`;
  }
}

export function useVoiceCommand(onCommand: (command: ParsedCommand) => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [level, setLevel] = useState(0);
  const transcriptRef = useRef('');
  const startCancelledRef = useRef(false);
  const startPendingRef = useRef(false);
  const ignoreEndRef = useRef(false);
  const activeRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
    startupTimerRef.current = null;
  }, []);

  useSpeechRecognitionEvent('start', () => {
    activeRef.current = true;
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
    // Android implementations may report dB values (roughly -2..10); clamp
    // the normalized result so silence stays near zero and speech is visible.
    const raw = Number(event.value);
    if (!Number.isFinite(raw)) return;
    const normalized = Math.max(0, Math.min(1, (raw + 2) / 12));
    setLevel(previous => Math.abs(previous - normalized) < 0.025 ? previous : normalized);
  });

  useSpeechRecognitionEvent('error', event => {
    activeRef.current = false;
    clearTimers();
    const text = messageForRecognitionError(event.error, event.message);
    setLevel(0);
    if (!text) return;
    setState('error');
    setError(text);
  });

  useSpeechRecognitionEvent('end', () => {
    activeRef.current = false;
    clearTimers();
    if (ignoreEndRef.current) {
      ignoreEndRef.current = false;
      return;
    }
    const spoken = transcriptRef.current.trim();
    setLevel(0);
    if (!spoken) {
      setState(current => current === 'error' ? current : 'error');
      setError(current => current || 'O reconhecimento terminou sem transcrever fala. Confira se o serviço de voz do Android está instalado e habilitado.');
      return;
    }
    setState('processing');
    const parsed = parseCommand(spoken);
    if (!parsed) {
      setState('error');
      setError('A fala foi capturada, mas não reconheci o lançamento. Tente: “gastei 32 no Uber”.');
      return;
    }
    onCommandRef.current(parsed);
    setState('success');
  });

  const start = useCallback(async () => {
    if (activeRef.current || startPendingRef.current || state === 'listening' || state === 'processing') return true;
    startPendingRef.current = true;
    startCancelledRef.current = false;
    ignoreEndRef.current = false;
    setError('');
    setTranscript('');
    transcriptRef.current = '';
    setLevel(0);

    try {
      // Some Android permission dialogs briefly change AppState. Do not cancel
      // this pending start until the permission promise has resolved.
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (startCancelledRef.current) return false;
      if (!permission.granted) {
        setState('error');
        setError('Permissão de microfone negada. Autorize o microfone nas configurações do Android.');
        return false;
      }

      const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) {
        setState('error');
        setError('O Android não encontrou um serviço de reconhecimento de voz. Instale/ative o app Google e o serviço de reconhecimento de fala nas configurações.');
        return false;
      }

      // Arm timers before start(): native events can arrive immediately.
      startupTimerRef.current = setTimeout(() => {
        startupTimerRef.current = null;
        if (activeRef.current) return;
        try { ExpoSpeechRecognitionModule.abort(); } catch { /* service may not have started */ }
        setLevel(0);
        setState('error');
        setError('O serviço de voz não confirmou a inicialização em 7 segundos. Verifique o serviço de reconhecimento do Android e tente novamente.');
      }, STARTUP_TIMEOUT_MS);

      timeoutRef.current = setTimeout(() => {
        try { ExpoSpeechRecognitionModule.stop(); } catch { /* recognition may already be closed */ }
      }, LISTENING_TIMEOUT_MS);

      setState('listening');
      ExpoSpeechRecognitionModule.start({
        lang: 'pt-BR',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
        androidIntentOptions: {
          EXTRA_LANGUAGE: 'pt-BR',
          EXTRA_LANGUAGE_PREFERENCE: 'pt-BR',
          EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE: false,
          EXTRA_PARTIAL_RESULTS: true,
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1800,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1200,
        },
        recordingOptions: { persist: false },
      });
      return true;
    } catch (cause) {
      clearTimers();
      activeRef.current = false;
      setLevel(0);
      setState('error');
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(`Não foi possível iniciar o reconhecimento de voz: ${detail}`);
      return false;
    } finally {
      startPendingRef.current = false;
    }
  }, [clearTimers, state]);

  const stop = useCallback(() => {
    startCancelledRef.current = true;
    clearTimers();
    setLevel(0);
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* recognition may already be closed */ }
  }, [clearTimers]);

  const cancel = useCallback(() => {
    // Do not cancel a permission/start request just because Android briefly
    // moves the activity to background while displaying its system dialog.
    if (startPendingRef.current) return;
    startCancelledRef.current = true;
    ignoreEndRef.current = true;
    activeRef.current = false;
    clearTimers();
    transcriptRef.current = '';
    setTranscript('');
    setLevel(0);
    try { ExpoSpeechRecognitionModule.abort(); } catch { /* recognition may already be closed */ }
    setState('idle');
  }, [clearTimers]);

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
      // Android permission/system sheets may report inactive; only cancel when
      // the app genuinely backgrounds and there is no pending startup.
      if (next === 'background' && !startPendingRef.current && activeRef.current) cancel();
    });
    return () => {
      subscription.remove();
      clearTimers();
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore unmount cleanup */ }
    };
  }, [cancel, clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    activeRef.current = false;
    setState('idle');
    setTranscript('');
    setError('');
    transcriptRef.current = '';
    setLevel(0);
  }, [clearTimers]);

  return { state, transcript, error, level, start, stop, cancel, reset, openSettings: () => Linking.openSettings() };
}
