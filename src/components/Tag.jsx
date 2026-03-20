/**
 * Tag — AIA Design System non-actionable label component.
 * Use for segment labels (Rookie, Seasoned, New Recruit) and attribute badges.
 * NOT for status — use StatusIndicator for that.
 *
 * Variants:
 *   'rookie'   — medium salmon (new recruit, year 1)
 *   'seasoned' — warm grey (experienced advisor)
 *   'new'      — digital red (newly released / featured)
 *   'high'     — solid salmon (high emphasis)
 *   'medium'   — subdued salmon (medium emphasis)
 *   'default'  — warm grey (low emphasis)
 */

const TAG_VARIANTS = {
  rookie:   'bg-[#FF7A85]/15 text-[#E05068] border border-[#FF7A85]/30',
  seasoned: 'bg-[#F5F0EB] text-[#5A5048] border border-[#E8E0D8]',
  new:      'bg-[#D31145] text-white border border-[#D31145]',
  high:     'bg-[#FF7A85] text-white border border-[#FF7A85]',
  medium:   'bg-[#FF7A85]/15 text-[#E05068] border border-[#FF7A85]/30',
  default:  'bg-[#F5F0EB] text-[#5A5048] border border-[#E8E0D8]',
};

export default function Tag({ variant = 'default', children, className = '' }) {
  const variantClass = TAG_VARIANTS[variant] ?? TAG_VARIANTS.default;
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider leading-none whitespace-nowrap select-none',
        variantClass,
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  );
}
