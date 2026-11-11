import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Camera,
  Clock,
  Code,
  CornerDownLeft,
  FileText,
  GitBranch,
  Globe,
  Keyboard,
  ListChecks,
  LogOut,
  MousePointer2,
  MousePointerClick,
  Navigation,
  PanelsTopLeft,
  RefreshCw,
  Repeat,
  Upload,
  XSquare,
} from 'lucide-react';
import type { ElementType } from 'react';

export interface ComponentItem {
  type: string;
  icon: ElementType;
  category: 'browser' | 'flow' | 'data' | 'advanced';
}

export const COMPONENTS: ComponentItem[] = [
  { type: 'navigate', icon: Navigation, category: 'browser' },
  { type: 'click', icon: MousePointer2, category: 'browser' },
  { type: 'input', icon: Keyboard, category: 'browser' },
  { type: 'hover', icon: MousePointerClick, category: 'browser' },
  { type: 'press_key', icon: CornerDownLeft, category: 'browser' },
  { type: 'select_option', icon: ListChecks, category: 'browser' },
  { type: 'scroll', icon: Globe, category: 'browser' },
  { type: 'screenshot', icon: Camera, category: 'browser' },
  { type: 'reload', icon: RefreshCw, category: 'browser' },
  { type: 'go_back', icon: ArrowLeft, category: 'browser' },
  { type: 'go_forward', icon: ArrowRight, category: 'browser' },
  { type: 'select_tab', icon: PanelsTopLeft, category: 'browser' },
  { type: 'close_tab', icon: XSquare, category: 'browser' },
  { type: 'wait', icon: Clock, category: 'flow' },
  { type: 'condition', icon: GitBranch, category: 'flow' },
  { type: 'loop', icon: Repeat, category: 'flow' },
  { type: 'break_loop', icon: LogOut, category: 'flow' },
  { type: 'extract', icon: FileText, category: 'data' },
  { type: 'set_variable', icon: Braces, category: 'data' },
  { type: 'upload', icon: Upload, category: 'data' },
  { type: 'script', icon: Code, category: 'advanced' },
];

export function componentIcon(type: string): ElementType {
  return COMPONENTS.find((item) => item.type === type)?.icon ?? Code;
}
