export function StackTag({ tag, color }: { tag: string; color: string }) {
  return (
    <span
      className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded"
      style={{ color, background: `${color}18`, border: `1px solid ${color}40`, letterSpacing: '0.04em' }}
    >
      [{tag.toUpperCase()}]
    </span>
  );
}
