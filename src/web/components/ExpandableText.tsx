import { useState } from 'react';

interface Props {
  text: string;
  threshold?: number;
  className?: string;
}

/** 长文本展开 / 收起：超过阈值时折叠，点击切换。 */
export default function ExpandableText({ text, threshold = 200, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const needsToggle = text.length > threshold;
  const shown = expanded || !needsToggle ? text : `${text.slice(0, threshold)}…`;

  return (
    <div>
      <p className={className}>{shown}</p>
      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex min-h-9 items-center font-mono text-xs uppercase tracking-wide text-accent transition hover:text-accent-dark"
        >
          {expanded ? '收起' : '展开全部'}
        </button>
      )}
    </div>
  );
}
