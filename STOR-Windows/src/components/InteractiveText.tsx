interface InteractiveTextProps {
  text: string;
  selectedWord: string;
  onSelectWord: (word: string) => void;
}

/** Split text into clickable tokens for English-like text (words + punctuation). */
function tokenize(text: string): { value: string; isWord: boolean }[] {
  const tokens: { value: string; isWord: boolean }[] = [];
  const pattern = /([a-zA-Z]+(?:'[a-zA-Z]+)?)|(\s+|[^\s\w]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const value = match[0];
    tokens.push({
      value,
      isWord: /^[a-zA-Z]/.test(value),
    });
  }

  return tokens;
}

export function isEnglishClickable(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.includes(" ") && /[a-zA-Z]{2,}/.test(trimmed);
}

export function InteractiveText({
  text,
  selectedWord,
  onSelectWord,
}: InteractiveTextProps) {
  const tokens = tokenize(text);

  return (
    <div className="interactive-text">
      {tokens.map((token, index) => {
        if (!token.isWord) {
          return (
            <span key={index} className="interactive-text-separator">
              {token.value}
            </span>
          );
        }

        const isSelected =
          selectedWord.toLowerCase() === token.value.toLowerCase();

        return (
          <span
            key={index}
            className={`interactive-text-token ${isSelected ? "selected" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectWord(token.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectWord(token.value);
              }
            }}
            title="点击选中该词"
          >
            {token.value}
          </span>
        );
      })}
    </div>
  );
}
