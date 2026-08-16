import { useCallback, useEffect, useRef, useState } from 'react';
import type { BonusRoute, SpinResult } from '../engine';
import { AudioDirector } from './AudioDirector';
import { createFeatureCompleteCuePlan, createResultCuePlan, createRouteCuePlan, createSpinCuePlan } from './cue-plan';
import {
  DEFAULT_AUDIO_SETTINGS,
  loadAudioSettings,
  saveAudioSettings,
  type AudioPreviewCue,
  type AudioSettings,
  type AudioStatus,
} from './types';

export function useGameAudio() {
  const [settings, setSettings] = useState<AudioSettings>(() =>
    typeof window === 'undefined' ? DEFAULT_AUDIO_SETTINGS : loadAudioSettings(window.localStorage));
  const [status, setStatus] = useState<AudioStatus>('locked');
  const settingsRef = useRef(settings);
  const director = useRef<AudioDirector | undefined>(undefined);

  const getDirector = useCallback(() => {
    if (!director.current) director.current = new AudioDirector(settingsRef.current, setStatus);
    return director.current;
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    saveAudioSettings(window.localStorage, settings);
    director.current?.updateSettings(settings);
  }, [settings]);

  useEffect(() => () => director.current?.dispose(), []);

  const updateSettings = useCallback((patch: Partial<Omit<AudioSettings, 'version'>>) => {
    setSettings((current) => ({ ...current, ...patch, version: 2 }));
  }, []);

  const playSpin = useCallback((reducedMotion = false) => {
    getDirector().playPlan(createSpinCuePlan(reducedMotion));
  }, [getDirector]);

  const presentResult = useCallback((result: SpinResult, reducedMotion = false) => {
    getDirector().playPlan(createResultCuePlan(result, reducedMotion));
  }, [getDirector]);

  const chooseRoute = useCallback((route: BonusRoute) => {
    const audio = getDirector();
    audio.playPlan(createRouteCuePlan(route));
    audio.setFeatureRoute(route);
  }, [getDirector]);

  const finishFeature = useCallback(() => {
    const audio = getDirector();
    audio.playPlan(createFeatureCompleteCuePlan());
    audio.setFeatureRoute(undefined);
  }, [getDirector]);

  const clearFeatureAudio = useCallback(() => {
    director.current?.setFeatureRoute(undefined);
  }, []);

  const preview = useCallback((cue: AudioPreviewCue) => {
    getDirector().playPlan([{ cue, delayMs: 0, gain: 0.9 }]);
  }, [getDirector]);

  return { settings, status, updateSettings, playSpin, presentResult, chooseRoute, finishFeature, clearFeatureAudio, preview } as const;
}
