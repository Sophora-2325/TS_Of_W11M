import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { InteractiveText, isEnglishClickable } from "./InteractiveText";
import { LanguageSegment } from "./ui/LanguageSegment";
import { ResultPanel } from "./ui/ResultPanel";
import { WindowHeader } from "./ui/WindowHeader";

interface OcrResult {
  text: string;
  defaultTargetLang: string;
}

interface HotkeyStatus {
  activeHotkey: string | null;
  error: string | null;
}

interface TextChunk {
  requestId: number;
  text: string;
}

const MAX_SELECTED_WORD_LEN = 30;

function resetLookupState(setters: {
  setSelectedWord: (value: string) => void;
  setLookupResult: (value: string) => void;
  setLookupError: (value: string | null) => void;
  setLookupCached: (value: boolean) => void;
  setLookupCopyNote: (value: string | null) => void;
  setExplainedFor: (value: string) => void;
}) {
  setters.setSelectedWord("");
  setters.setLookupResult("");
  setters.setLookupError(null);
  setters.setLookupCached(false);
  setters.setLookupCopyNote(null);
  setters.setExplainedFor("");
}

export function TranslationPopup() {
  const [originalText, setOriginalText] = useState("");
  const [translation, setTranslation] = useState("");
  const [selectedLang, setSelectedLang] = useState("zh");
  const [translatedFor, setTranslatedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [reselecting, setReselecting] = useState(false);
  const [pinned, setPinned] = useState(true);
  const [activeHotkey, setActiveHotkey] = useState<string | null>(null);
  const reselectingRef = useRef(false);
  const translateToken = useRef(0);
  const lookupToken = useRef(0);
  const translateStream = useRef(-1);
  const lookupStream = useRef(-1);

  const [selectedWord, setSelectedWord] = useState("");
  const [lookupLang, setLookupLang] = useState("zh");
  const [lookupResult, setLookupResult] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupCached, setLookupCached] = useState(false);
  const [lookupCopyNote, setLookupCopyNote] = useState<string | null>(null);
  const [explainedFor, setExplainedFor] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sawOcrEvent = useRef(false);
  const showEnglishClick = isEnglishClickable(originalText);

  const clearLookup = useCallback(() => {
    lookupToken.current += 1;
    lookupStream.current = -1;
    resetLookupState({
      setSelectedWord,
      setLookupResult,
      setLookupError,
      setLookupCached,
      setLookupCopyNote,
      setExplainedFor,
    });
  }, []);

  const syncSelectionFromTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;

    const selected = originalText.slice(start, end).trim();
    if (selected.length > 0 && selected.length <= MAX_SELECTED_WORD_LEN && selected !== selectedWord) {
      lookupToken.current += 1;
      lookupStream.current = -1;
      setLookupLoading(false);
      setSelectedWord(selected);
      setLookupResult("");
      setLookupError(null);
      setLookupCached(false);
      setLookupCopyNote(null);
      setExplainedFor("");
    }
  }, [originalText, selectedWord]);

  useEffect(() => {
    let alive = true;
    const refreshMeta = () => {
      invoke<HotkeyStatus>("get_hotkey_status")
        .then((status) => {
          if (alive) setActiveHotkey(status.activeHotkey);
        })
        .catch(() => undefined);
    };
    refreshMeta();
    window.addEventListener("focus", refreshMeta);

    invoke<OcrResult | null>("get_pending_ocr").then((result) => {
      if (!alive || sawOcrEvent.current || !result) return;
      setOriginalText(result.text);
      setSelectedLang(result.defaultTargetLang || "zh");
      setLookupLang(result.defaultTargetLang || "zh");
    });
    getCurrentWindow()
      .isAlwaysOnTop()
      .then((value) => {
        if (alive) setPinned(value);
      })
      .catch(() => {
        if (alive) setPinned(true);
      });

    const unlistenOcr = listen<OcrResult>("ocr-result", (event) => {
      sawOcrEvent.current = true;
      translateToken.current += 1;
      lookupToken.current += 1;
      translateStream.current = -1;
      lookupStream.current = -1;
      setOriginalText(event.payload.text);
      setSelectedLang(event.payload.defaultTargetLang || "zh");
      setLookupLang(event.payload.defaultTargetLang || "zh");
      setTranslation("");
      setTranslatedFor("");
      setError(null);
      setCached(false);
      setCopyNote(null);
      setLoading(false);
      resetLookupState({
        setSelectedWord,
        setLookupResult,
        setLookupError,
        setLookupCached,
        setLookupCopyNote,
        setExplainedFor,
      });
    });

    const unlistenTranslateChunk = listen<TextChunk>("translation-chunk", (event) => {
      if (event.payload.requestId !== translateToken.current) return;
      if (translateStream.current !== translateToken.current) return;
      setTranslation((prev) => prev + event.payload.text);
    });

    const unlistenLookupChunk = listen<TextChunk>("word-lookup-chunk", (event) => {
      if (event.payload.requestId !== lookupToken.current) return;
      if (lookupStream.current !== lookupToken.current) return;
      setLookupResult((prev) => prev + event.payload.text);
    });

    const unlistenPrepareError = listen<{ sessionId: string; message: string; surface: string }>(
      "overlay-prepare-error",
      (event) => {
        if (event.payload.surface === "popup") {
          setActionError(event.payload.message);
          reselectingRef.current = false;
          setReselecting(false);
        }
      },
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        getCurrentWindow().close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      alive = false;
      unlistenOcr.then((fn) => fn());
      unlistenTranslateChunk.then((fn) => fn());
      unlistenLookupChunk.then((fn) => fn());
      unlistenPrepareError.then((fn) => fn());
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("focus", refreshMeta);
    };
  }, []);

  const handleTranslate = async () => {
    if (!originalText.trim() || loading) {
      if (!originalText.trim()) setError("原文为空");
      return;
    }

    const token = ++translateToken.current;
    translateStream.current = token;
    const text = originalText;
    const lang = selectedLang;
    setTranslation("");
    setTranslatedFor("");
    setError(null);
    setLoading(true);
    setCached(false);
    setCopyNote(null);

    try {
      const result = await invoke<{ translation: string; cached: boolean }>(
        "translate_text_stream",
        { text, targetLang: lang, requestId: token },
      );
      if (token !== translateToken.current) return;
      translateStream.current = -1;
      setTranslation(result.translation);
      setCached(result.cached);
      setTranslatedFor(lang);
    } catch (err) {
      if (token !== translateToken.current) return;
      translateStream.current = -1;
      setError(String(err));
    } finally {
      if (token === translateToken.current) setLoading(false);
    }
  };

  const handleLookup = async () => {
    if (!selectedWord.trim() || lookupLoading) {
      if (!selectedWord.trim()) setLookupError("请先选中要查询的词语");
      return;
    }

    const token = ++lookupToken.current;
    lookupStream.current = token;
    const sentence = originalText;
    const word = selectedWord;
    const explainLang = lookupLang;
    setLookupResult("");
    setLookupError(null);
    setLookupLoading(true);
    setLookupCached(false);
    setLookupCopyNote(null);

    try {
      const result = await invoke<{ explanation: string; cached: boolean }>(
        "lookup_word_in_context",
        { sentence, word, explainLang, requestId: token },
      );
      if (token !== lookupToken.current) return;
      lookupStream.current = -1;
      setLookupResult(result.explanation);
      setLookupCached(result.cached);
      setExplainedFor(explainLang);
    } catch (err) {
      if (token !== lookupToken.current) return;
      lookupStream.current = -1;
      setLookupError(String(err));
    } finally {
      if (token === lookupToken.current) setLookupLoading(false);
    }
  };

  const handleWordClick = (word: string) => {
    lookupToken.current += 1;
    lookupStream.current = -1;
    setLookupLoading(false);
    setSelectedWord(word);
    setLookupResult("");
    setLookupError(null);
    setLookupCached(false);
    setLookupCopyNote(null);
    setExplainedFor("");
  };

  const handleOriginalTextChange = (value: string) => {
    translateToken.current += 1;
    translateStream.current = -1;
    setOriginalText(value);
    setTranslation("");
    setTranslatedFor("");
    setError(null);
    setCached(false);
    setCopyNote(null);
    setLoading(false);
    clearLookup();
  };

  const copyText = async (
    text: string,
    setNote: Dispatch<SetStateAction<string | null>>,
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote("已复制");
      window.setTimeout(() => setNote((current) => (current === "已复制" ? null : current)), 1600);
    } catch (err) {
      setNote(`复制失败：${String(err)}`);
    }
  };

  const handleReselect = async () => {
    if (reselectingRef.current) return;
    reselectingRef.current = true;
    setActionError(null);
    setReselecting(true);
    setError(null);
    try {
      await invoke("reopen_overlay");
    } catch (err) {
      setActionError(String(err));
    } finally {
      reselectingRef.current = false;
      setReselecting(false);
    }
  };

  const handleTogglePin = async () => {
    const next = !pinned;
    setActionError(null);
    try {
      await getCurrentWindow().setAlwaysOnTop(next);
      setPinned(await getCurrentWindow().isAlwaysOnTop());
    } catch (err) {
      setActionError(String(err));
    }
  };

  const translationStatus = loading
    ? "翻译中..."
    : error
      ? error
      : cached
        ? "译文来自缓存"
        : translatedFor && translatedFor !== selectedLang
          ? "译文对应此前选择的语言，点击「翻译」以更新。"
          : null;
  const lookupStatus = lookupLoading
    ? "查词中..."
    : lookupError
      ? lookupError
      : lookupCached
        ? "释义来自缓存"
        : explainedFor && explainedFor !== lookupLang
          ? "释义对应此前选择的语言，点击「查词」以更新。"
          : null;
  const hotkeyText = activeHotkey
    ? `按 ${activeHotkey} 框选屏幕文字`
    : "当前没有可用快捷键，可从托盘打开框选";

  return (
    <div className="popup-root">
      <WindowHeader
        subtitle="翻译与查词"
        pinned={pinned}
        onTogglePin={() => void handleTogglePin()}
        onMinimize={() => void getCurrentWindow().minimize()}
        onClose={() => void getCurrentWindow().close()}
      />

      <div className="panel-scroll">
        <section className="composer">
          <div className="section-heading">
            <h2>原文</h2>
            <p>PP-OCRv6 small</p>
          </div>
          <textarea
            ref={textareaRef}
            className="text-area"
            value={originalText}
            onChange={(event) => handleOriginalTextChange(event.target.value)}
            onSelect={syncSelectionFromTextarea}
            onMouseUp={syncSelectionFromTextarea}
            rows={5}
            placeholder="输入或粘贴要翻译的文字..."
            aria-label="原文"
          />
          <div className="composer-meta">
            <span>{showEnglishClick ? "单击下方单词，或在原文中拖选" : "在原文中拖选要查询的词语"}</span>
            <span>{originalText.length} 字</span>
          </div>
          {showEnglishClick && (
            <InteractiveText
              text={originalText}
              selectedWord={selectedWord}
              onSelectWord={handleWordClick}
            />
          )}
        </section>

        <section className="translate-controls">
          <div>
            <p className="control-label">翻译为</p>
            <LanguageSegment
              label="翻译为"
              value={selectedLang}
              disabled={loading}
              onChange={setSelectedLang}
            />
          </div>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void handleTranslate()}
            disabled={loading || !originalText.trim()}
          >
            {loading ? "翻译中..." : "翻译"}
          </button>
        </section>

        <ResultPanel
          title="译文"
          copyLabel="复制译文"
          canCopy={Boolean(translation) && !loading}
          copyNote={copyNote}
          onCopy={() => void copyText(translation, setCopyNote)}
          status={translationStatus}
          statusTone={error ? "error" : cached || translatedFor !== selectedLang ? "muted" : "info"}
          empty={!translation && !loading}
          emptyText="译文会显示在这里。"
        >
          {translation}
        </ResultPanel>

        <section className="lookup-section">
          <div className="section-heading">
            <h2>上下文查词</h2>
            <p>{selectedWord ? `当前选中：「${selectedWord}」` : "尚未选中词语"}</p>
          </div>
          <div className="translate-controls">
            <div>
              <p className="control-label">解释语言</p>
              <LanguageSegment
                label="解释语言"
                value={lookupLang}
                disabled={lookupLoading}
                onChange={setLookupLang}
              />
            </div>
            <button
              type="button"
              className="primary-btn"
              onClick={() => void handleLookup()}
              disabled={lookupLoading || !selectedWord.trim()}
            >
              {lookupLoading ? "查词中..." : "查词"}
            </button>
          </div>
          <ResultPanel
            title="词语释义"
            copyLabel="复制释义"
            canCopy={Boolean(lookupResult) && !lookupLoading}
            copyNote={lookupCopyNote}
            onCopy={() => void copyText(lookupResult, setLookupCopyNote)}
            status={lookupStatus}
            statusTone={lookupError ? "error" : "muted"}
            empty={!lookupResult && !lookupLoading}
            emptyText="选中词语并点击「查词」后，释义会显示在这里。"
          >
            {lookupResult}
          </ResultPanel>
        </section>
      </div>

      <footer className="panel-footer">
        <p>{hotkeyText}</p>
        {actionError && <p className="is-error">{actionError}</p>}
        <button
          type="button"
          className="primary-btn"
          onClick={() => void handleReselect()}
          disabled={reselecting}
        >
          {reselecting ? "准备框选..." : "重新框选"}
        </button>
      </footer>
    </div>
  );
}
