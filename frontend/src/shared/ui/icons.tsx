import type { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

/** 線條圖示的共同外框；純裝飾，對輔助技術隱藏。 */
function Icon({ size = 18, children, ...props }: IconProps & { children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{children}</svg>;
}

export const FridgeIcon = (props: IconProps) => <Icon {...props}>
  <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M5 10h14M9 6v1.5M9 13v3" />
</Icon>;

export const SnowflakeIcon = (props: IconProps) => <Icon {...props}>
  <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
  <path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" />
</Icon>;

export const BoxIcon = (props: IconProps) => <Icon {...props}>
  <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" />
</Icon>;

export const MapPinIcon = (props: IconProps) => <Icon {...props}>
  <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.2" />
</Icon>;

export const SearchIcon = (props: IconProps) => <Icon {...props}>
  <circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" />
</Icon>;

export const PlusIcon = (props: IconProps) => <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;

export const PencilIcon = (props: IconProps) => <Icon {...props}>
  <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m13.5 8.5 3 3" />
</Icon>;

export const TrashIcon = (props: IconProps) => <Icon {...props}>
  <path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
</Icon>;

export const SwapIcon = (props: IconProps) => <Icon {...props}>
  <path d="M5 8h13l-3.5-3.5M19 16H6l3.5 3.5" />
</Icon>;

export const DotsIcon = (props: IconProps) => <Icon {...props}>
  <circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" />
  <circle cx="19" cy="12" r="1.2" fill="currentColor" />
</Icon>;
