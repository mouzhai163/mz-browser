import type { SVGProps } from 'react';

import { cn } from '@/lib/utils';

type ClashIconProps = SVGProps<SVGSVGElement>;

const STROKE_WIDTH = 3.2;

export function ClashIcon({ className, ...props }: ClashIconProps) {
  return (
    <svg
      viewBox="8 4 32 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <path
        d="M27.19 42.5a89.0444 89.0444 0 0 1-14.6813-1.5725S13.94 12.3721 17.9209 5.5357c-.13-.297 2.9919 1.2125 4.4218 6.2665a25.5569 25.5569 0 0 1 4.8471-.47"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse
        cx="21.2404"
        cy="20.3089"
        rx="1.6708"
        ry="2.1301"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27.19 42.5a89.0444 89.0444 0 0 0 14.6813-1.5725S40.44 12.3721 36.4583 5.5357c.03-.2006-3.59 1.7549-4.4218 6.2665a25.5582 25.5582 0 0 0-4.8471-.47"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse
        cx="33.1398"
        cy="20.3089"
        rx="1.6708"
        ry="2.1301"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5083 40.927C10.5777 40.6 7.56 40.6178 6.4685 37.44c-1.0674-3.107.4377-6.6708 3.7411-7.0453"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeMiterlimit="5.7143"
      />
      <path
        d="M25.4634 26.3872a1.4666 1.4666 0 0 0 1.4726-1.4725"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeMiterlimit="5.7143"
      />
      <path
        d="M28.4091 26.3872a1.4666 1.4666 0 0 1-1.4726-1.4725"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeMiterlimit="5.7143"
      />
    </svg>
  );
}
