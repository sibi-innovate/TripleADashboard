import { MONTH_SHORT, CURRENT_MONTH_IDX } from '../constants';

export default function PeriodControl({
  value,
  onChange,
  showAreaFilter = true,
  area = 'all',
  onAreaChange,
}) {
  const { mode, monthIdx } = value;

  const handleModeToggle = (newMode) => {
    // Keep the current monthIdx when switching — YTD sums up to that month.
    // Previously this reset to 0 (January), causing YTD to show only Jan data.
    onChange({ mode: newMode, monthIdx });
  };

  const handleMonthClick = (idx) => {
    if (idx <= CURRENT_MONTH_IDX) {
      onChange({ mode, monthIdx: idx });
    }
  };

  const handleAreaClick = (newArea) => {
    onAreaChange?.(newArea);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Period Label */}
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#B0B3BC]">
        Period
      </span>

      {/* YTD / Monthly Toggle */}
      <div className="flex items-center gap-1 bg-[#F2F3F5] rounded-full p-1">
        <button
          onClick={() => handleModeToggle('ytd')}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
            mode === 'ytd'
              ? 'bg-white text-[#D31145] shadow-sm'
              : 'text-[#6B7180]'
          }`}
        >
          YTD
        </button>
        <button
          onClick={() => handleModeToggle('monthly')}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
            mode === 'monthly'
              ? 'bg-white text-[#D31145] shadow-sm'
              : 'text-[#6B7180]'
          }`}
        >
          Monthly
        </button>
      </div>

      {/* Month Pills (hidden when YTD) */}
      {mode === 'monthly' && (
        <>
          <div className="w-px h-5 bg-[#E8E9ED]" />
          <div className="flex flex-wrap gap-1">
            {MONTH_SHORT.map((month, idx) => {
              const isPast = idx <= CURRENT_MONTH_IDX;
              const isActive = idx === monthIdx;
              const isFuture = idx > CURRENT_MONTH_IDX;

              return (
                <button
                  key={idx}
                  onClick={() => handleMonthClick(idx)}
                  disabled={isFuture}
                  className={`px-2 py-1 rounded-full text-[11px] font-semibold transition-all ${
                    isFuture
                      ? 'border border-dashed text-[#B0B3BC] cursor-not-allowed pointer-events-none'
                      : isActive
                      ? 'bg-[#D31145] text-white border border-[#D31145]'
                      : 'border border-[#E8E9ED] bg-white text-[#6B7180]'
                  }`}
                >
                  {month}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Area Filter */}
      {showAreaFilter && (
        <>
          <div className="w-px h-5 bg-[#E8E9ED]" />
          <div className="flex flex-wrap gap-1">
            {['all', 'SCM2', 'SCM3'].map((areaOption) => {
              const isActive = area === areaOption;
              const displayLabel = areaOption === 'all' ? 'All' : areaOption;

              return (
                <button
                  key={areaOption}
                  onClick={() => handleAreaClick(areaOption)}
                  className={`px-2 py-1 rounded-full text-[11px] font-semibold transition-all ${
                    isActive
                      ? 'bg-[#1C1C28] text-white border border-[#1C1C28]'
                      : 'border border-[#E8E9ED] bg-white text-[#6B7180]'
                  }`}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
