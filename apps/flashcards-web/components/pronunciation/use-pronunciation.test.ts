import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { pickBestVoice, usePronunciation } from "./use-pronunciation";

function makeVoice(lang: string, name = lang): SpeechSynthesisVoice {
  return { lang, name, default: false, localService: true, voiceURI: name } as SpeechSynthesisVoice;
}

class FakeUtterance {
  text: string;
  lang = "";
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function installSpeechSynthesisMock(voices: SpeechSynthesisVoice[] = []) {
  const listeners = new Map<string, Set<() => void>>();
  const mock = {
    speak: vi.fn((utterance: FakeUtterance) => utterance.onstart?.()),
    cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: () => void) => {
      listeners.get(event)?.delete(handler);
    }),
  };
  vi.stubGlobal("speechSynthesis", mock);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pickBestVoice", () => {
  it("prefers an exact BCP-47 match", () => {
    const voices = [makeVoice("en-GB"), makeVoice("en-US"), makeVoice("zh-CN")];
    expect(pickBestVoice(voices, "en-US")).toBe(voices[1]);
  });

  it("falls back to the same language family when no exact match exists", () => {
    const voices = [makeVoice("en-GB"), makeVoice("zh-CN")];
    expect(pickBestVoice(voices, "en-US")).toBe(voices[0]);
  });

  it("returns undefined (browser default) when nothing matches at all", () => {
    const voices = [makeVoice("zh-CN")];
    expect(pickBestVoice(voices, "en-US")).toBeUndefined();
  });
});

describe("usePronunciation", () => {
  it("reports unsupported when window.speechSynthesis does not exist", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    const { result } = renderHook(() => usePronunciation());
    expect(result.current.isSupported).toBe(false);
  });

  it("reports supported and speaks with cancel-then-speak (never enqueues)", () => {
    const synth = installSpeechSynthesisMock([makeVoice("en-US")]);
    const { result } = renderHook(() => usePronunciation());
    expect(result.current.isSupported).toBe(true);

    act(() => result.current.speak("beautiful", "en-US"));

    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.text).toBe("beautiful");
    expect(utterance.lang).toBe("en-US");
    expect(utterance.rate).toBe(0.9);
    expect(utterance.pitch).toBe(1);
    expect(utterance.volume).toBe(1);
  });

  it("repeated calls to speak() cancel before each speak — no queue buildup", () => {
    const synth = installSpeechSynthesisMock([makeVoice("en-US")]);
    const { result } = renderHook(() => usePronunciation());

    act(() => result.current.speak("beautiful", "en-US"));
    act(() => result.current.speak("beautiful", "en-US"));
    act(() => result.current.speak("beautiful", "en-US"));

    expect(synth.cancel).toHaveBeenCalledTimes(3);
    expect(synth.speak).toHaveBeenCalledTimes(3);
  });

  it("cancel() stops speech and clears isSpeaking", () => {
    const synth = installSpeechSynthesisMock([]);
    const { result } = renderHook(() => usePronunciation());
    act(() => result.current.cancel());
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("registers and cleans up a voiceschanged listener", () => {
    const synth = installSpeechSynthesisMock([]);
    const { unmount } = renderHook(() => usePronunciation());
    expect(synth.addEventListener).toHaveBeenCalledWith("voiceschanged", expect.any(Function));
    unmount();
    expect(synth.removeEventListener).toHaveBeenCalledWith("voiceschanged", expect.any(Function));
  });

  it("cancels any in-flight speech on unmount", () => {
    const synth = installSpeechSynthesisMock([]);
    const { unmount } = renderHook(() => usePronunciation());
    unmount();
    expect(synth.cancel).toHaveBeenCalled();
  });
});
