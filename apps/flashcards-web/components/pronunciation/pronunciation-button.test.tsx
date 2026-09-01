import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PronunciationButton } from "./pronunciation-button";

class FakeUtterance {
  constructor(public text: string) {}
  lang = "";
  rate = 1;
  pitch = 1;
  volume = 1;
  voice = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

function installSpeechSynthesisMock() {
  const mock = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("speechSynthesis", mock);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return mock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PronunciationButton", () => {
  it("renders nothing for a Free-category set (language=null)", () => {
    installSpeechSynthesisMock();
    const { container } = render(<PronunciationButton text="beautiful" language={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when speech synthesis is unsupported — no crash", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    expect(() => render(<PronunciationButton text="beautiful" language="en-US" />)).not.toThrow();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a button with an accessible Vietnamese label when supported", () => {
    installSpeechSynthesisMock();
    render(<PronunciationButton text="beautiful" language="en-US" />);
    expect(screen.getByRole("button", { name: "Phát âm beautiful" })).toBeInTheDocument();
  });

  it("clicking speaks the given text in the given language", () => {
    const synth = installSpeechSynthesisMock();
    render(<PronunciationButton text="beautiful" language="en-US" />);

    fireEvent.click(screen.getByRole("button", { name: "Phát âm beautiful" }));

    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.text).toBe("beautiful");
    expect(utterance.lang).toBe("en-US");
  });

  it("repeated clicks cancel before each speak instead of queuing", () => {
    const synth = installSpeechSynthesisMock();
    render(<PronunciationButton text="beautiful" language="en-US" />);
    const button = screen.getByRole("button", { name: "Phát âm beautiful" });

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(synth.cancel).toHaveBeenCalledTimes(3);
    expect(synth.speak).toHaveBeenCalledTimes(3);
  });

  it("cancels speech when the text prop changes (simulating a card change)", () => {
    const synth = installSpeechSynthesisMock();
    const { rerender } = render(<PronunciationButton text="beautiful" language="en-US" />);
    synth.cancel.mockClear();

    rerender(<PronunciationButton text="smart" language="en-US" />);

    expect(synth.cancel).toHaveBeenCalled();
  });

  it("cancels speech on unmount", () => {
    const synth = installSpeechSynthesisMock();
    const { unmount } = render(<PronunciationButton text="beautiful" language="en-US" />);
    synth.cancel.mockClear();

    unmount();

    expect(synth.cancel).toHaveBeenCalled();
  });

  it("renders icon-only (no visible 'Phát âm' text) in compact mode, but keeps the accessible label", () => {
    installSpeechSynthesisMock();
    render(<PronunciationButton text="beautiful" language="en-US" compact />);
    const button = screen.getByRole("button", { name: "Phát âm beautiful" });
    expect(button).not.toHaveTextContent("Phát âm");
  });
});
