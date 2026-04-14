export default function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center gap-2 mb-2.5 mt-5 first:mt-0">
      <span className="text-[10px] font-extrabold uppercase tracking-[1px] text-[#6B7180] whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-[#E8E9ED]" />
      {action && (
        <button
          onClick={action.onClick}
          className="text-[10px] font-bold text-[#D31145] flex items-center gap-1 whitespace-nowrap hover:opacity-80 transition-opacity"
        >
          {action.label}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
