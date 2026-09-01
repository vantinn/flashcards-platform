import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PronunciationButton, type PronunciationButtonProps } from "./pronunciation-button";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import viDict from "@/lib/i18n/dictionaries/vi";

// I18nProvider calls useRouter() (for its setLocale()'s router.refresh(),
// never exercised here) — outside a real Next.js app it needs this stub, or
// rendering throws even though nothing in this test triggers a navigation.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

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

// The component reads its "Phát âm" label from the i18n context — tests
// assert the Vietnamese default, so every render is wrapped with that locale.
function renderButton(props: PronunciationButtonProps) {
  return render(
    <I18nProvider locale="vi" dict={viDict}>
      <PronunciationButton {...props} />
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PronunciationButton", () => {
  it("renders nothing for a Free-category set (language=null)", () => {
    installSpeechSynthesisMock();
    const { container } = renderButton({ text: "beautiful", language: null });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when speech synthesis is unsupported — no crash", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    expect(() => renderButton({ text: "beautiful", language: "en-US" })).not.toThrow();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a button with an accessible Vietnamese label when supported", () => {
    installSpeechSynthesisMock();
    renderButton({ text: "beautiful", language: "en-US" });
    expect(screen.getByRole("button", { name: "Phát âm beautiful" })).toBeInTheDocument();
  });

  it("clicking speaks the given text in the given language", () => {
    const synth = installSpeechSynthesisMock();
    renderButton({ text: "beautiful", language: "en-US" });

    fireEvent.click(screen.getByRole("button", { name: "Phát âm beautiful" }));

    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.text).toBe("beautiful");
    expect(utterance.lang).toBe("en-US");
  });

  it("repeated clicks cancel before each speak instead of queuing", () => {
    const synth = installSpeechSynthesisMock();
    renderButton({ text: "beautiful", language: "en-US" });
    const button = screen.getByRole("button", { name: "Phát âm beautiful" });

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(synth.cancel).toHaveBeenCalledTimes(3);
    expect(synth.speak).toHaveBeenCalledTimes(3);
  });

  it("cancels speech when the text prop changes (simulating a card change)", () => {
    const synth = installSpeechSynthesisMock();
    const { rerender } = renderButton({ text: "beautiful", language: "en-US" });
    synth.cancel.mockClear();

    rerender(
      <I18nProvider locale="vi" dict={viDict}>
        <PronunciationButton text="smart" language="en-US" />
      </I18nProvider>,
    );

    expect(synth.cancel).toHaveBeenCalled();
  });

  it("cancels speech on unmount", () => {
    const synth = installSpeechSynthesisMock();
    const { unmount } = renderButton({ text: "beautiful", language: "en-US" });
    synth.cancel.mockClear();

    unmount();

    expect(synth.cancel).toHaveBeenCalled();
  });

  it("renders icon-only (no visible 'Phát âm' text) in compact mode, but keeps the accessible label", () => {
    installSpeechSynthesisMock();
    renderButton({ text: "beautiful", language: "en-US", compact: true });
    const button = screen.getByRole("button", { name: "Phát âm beautiful" });
    expect(button).not.toHaveTextContent("Phát âm");
  });
});
