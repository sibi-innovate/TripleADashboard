export default function ProgressBar({
  value,
  color = '#D31145',
  height = 5,
  showLabel = false,
  className = '',
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div style={{ height }} className="flex-1 bg-[#F2F3F5] rounded-full overflow-hidden">
        <div
          style={{
            width: `${Math.min(100, value)}%`,
            background: color,
            height: '100%',
          }}
          className="rounded-full transition-all duration-500"
        />
      </div>
      {showLabel && (
        <span className="text-[10px] font-mono font-medium text-[#6B7180] w-8 text-right">
          {value.toFixed(0)}%
        </span>
      )}
    </div>
  );
}
