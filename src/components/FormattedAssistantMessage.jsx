function renderInline(text, keyPrefix) {
  const parts = String(text || "").split(/(\*[^*\n]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderParagraph(block, index) {
  const lines = block.split(/\n/);
  return (
    <p key={`p-${index}`}>
      {lines.map((line, lineIndex) => (
        <span key={`p-${index}-${lineIndex}`}>
          {lineIndex > 0 && <br />}
          {renderInline(line, `p-${index}-${lineIndex}`)}
        </span>
      ))}
    </p>
  );
}

function renderList(block, index) {
  return (
    <ul key={`ul-${index}`}>
      {block.split(/\n/).map((line, lineIndex) => (
        <li key={`li-${index}-${lineIndex}`}>
          {renderInline(line.replace(/^[-*]\s+/, ""), `li-${index}-${lineIndex}`)}
        </li>
      ))}
    </ul>
  );
}

export function FormattedAssistantMessage({ text }) {
  const blocks = String(text || "")
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) return null;

  return (
    <div className="av-msg-text">
      {blocks.map((block, index) => (
        /^[-*]\s+/m.test(block) ? renderList(block, index) : renderParagraph(block, index)
      ))}
    </div>
  );
}
