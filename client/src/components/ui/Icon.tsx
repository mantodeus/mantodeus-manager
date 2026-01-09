/**
 * Centralized Icon System
 * 
 * All icons must be imported from this file, never directly from @heroicons/react.
 * This ensures consistency and makes future migrations easier.
 * 
 * Icons are from Heroicons Outline (@heroicons/react/24/outline)
 * Default size: h-5 w-5
 * Small: h-4 w-4
 * Large: h-6 w-6
 */

import React from 'react';
import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

// Re-export Heroicons Outline icons with Lucide-compatible names
export {
  // Arrows
  ArrowLeftIcon as ArrowLeft,
  ArrowRightIcon as ArrowRight,
  ChevronDownIcon as ChevronDown,
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
  ChevronUpIcon as ChevronUp,
  
  // Actions
  PencilIcon as Edit,
  PencilIcon as Edit2,
  PencilSquareIcon,
  TrashIcon as Trash,
  TrashIcon as Trash2,
  PlusIcon as Plus,
  XMarkIcon as X,
  XCircleIcon as XCircle,
  CheckIcon as Check,
  CheckCircleIcon as CheckCircle,
  CheckCircleIcon as CheckCircle2,
  ClipboardDocumentCheckIcon as CheckSquare,
  ArrowPathIcon as RotateCcw,
  ArrowPathRoundedSquareIcon,
  ArrowUturnLeftIcon as Undo,
  ArrowUturnLeftIcon as Undo2,
  
  // Files & Documents
  DocumentIcon as File,
  DocumentTextIcon as FileText,
  DocumentCheckIcon as FileCheck,
  DocumentArrowDownIcon as FileDown,
  FolderOpenIcon as FolderOpen,
  DocumentDuplicateIcon as Copy,
  ArrowDownTrayIcon as Download,
  ArrowUpTrayIcon as Upload,
  PaperClipIcon as Paperclip,
  ShareIcon as Share2,
  LinkIcon,
  LinkIcon as Link,
  CodeBracketIcon as Code,
  
  // Navigation & UI
  Bars3Icon as Menu,
  Bars3BottomLeftIcon as PanelLeft,
  MagnifyingGlassIcon as Search,
  Cog6ToothIcon as Settings,
  FunnelIcon as SlidersHorizontal,
  EllipsisVerticalIcon as MoreVertical,
  EyeIcon as Eye,
  HomeIcon as Home,
  
  // Status & Info
  InformationCircleIcon as Info,
  ExclamationCircleIcon as AlertCircle,
  ExclamationTriangleIcon as AlertTriangle,
  ClockIcon as Clock,
  SparklesIcon as Sparkles,
  QuestionMarkCircleIcon as HelpCircle,
  
  // People & Communication
  UserIcon as User,
  UsersIcon as Users,
  EnvelopeIcon as Mail,
  PhoneIcon as Phone,
  PaperAirplaneIcon as Send,
  
  // Business & Finance
  BuildingOffice2Icon as Building2,
  BriefcaseIcon as Briefcase,
  ReceiptPercentIcon as Receipt,
  CurrencyDollarIcon as DollarSign,
  CurrencyEuroIcon as CurrencyEuro,
  CreditCardIcon as CreditCard,
  
  // Calendar & Time
  CalendarIcon,
  CalendarDaysIcon,
  
  // Location
  MapPinIcon as MapPin,
  
  // Media
  PhotoIcon as Image,
  PhotoIcon as ImageIcon,
  CameraIcon as Camera,
  MagnifyingGlassPlusIcon as ZoomIn,
  MagnifyingGlassMinusIcon as ZoomOut,
  
  // Tools & Actions
  PencilIcon,
  PencilIcon as Pencil,
  ArrowsUpDownIcon as Move,
  TagIcon as Tag,
  ArchiveBoxIcon as Archive,
  ArrowPathIcon,
  
  // Layout & Structure
  ListBulletIcon as List,
  
  // Authentication
  ArrowRightOnRectangleIcon as LogIn,
  ArrowLeftOnRectangleIcon as LogOut,
  
  // External
  ArrowTopRightOnSquareIcon as ExternalLink,
  
  // Loading (spinning arrow path)
  ArrowPathIcon as Loader2,
  ArrowPathIcon as Loader2Icon,
  
  // Save
  CheckIcon as Save,
  
  // Additional
  PencilIcon as PencilLine,
  SwatchIcon as Palette,
  
  // Check icons
  CheckIcon as CheckIcon,
  
  // Chevron icons
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  
  // More
  EllipsisHorizontalIcon as MoreHorizontal,
  EllipsisHorizontalIcon as MoreHorizontalIcon,
  
  // Minus
  MinusIcon,
  
  // Search
  MagnifyingGlassIcon as SearchIcon,
  
  // Sun/Moon
  SunIcon as Sun,
  MoonIcon as Moon,
  
  // Bug/Ant
  BugAntIcon as BugAnt,
} from '@heroicons/react/24/outline';

// Calendar alias
export { CalendarIcon as Calendar } from '@heroicons/react/24/outline';

// Settings alias
export { Cog6ToothIcon as SettingsIcon } from '@heroicons/react/24/outline';

// Custom icons for text formatting (not available in Heroicons)
export const Bold = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg
    ref={ref}
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1}
    stroke="currentColor"
    className={props.className || "h-5 w-5"}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
  </svg>
));
Bold.displayName = 'Bold';

export const Italic = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg
    ref={ref}
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1}
    stroke="currentColor"
    className={props.className || "h-5 w-5"}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4M10 20h4M12 4v16" />
  </svg>
));
Italic.displayName = 'Italic';

export const Heading1 = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg
    ref={ref}
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1}
    stroke="currentColor"
    className={props.className || "h-5 w-5"}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h8M4 12h8M4 18h8M12 6v12" />
  </svg>
));
Heading1.displayName = 'Heading1';

export const Heading2 = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg
    ref={ref}
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1}
    stroke="currentColor"
    className={props.className || "h-5 w-5"}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h8M4 12h8M4 18h8M12 6v12M16 6h4M16 12h4" />
  </svg>
));
Heading2.displayName = 'Heading2';

// Specialized icons that don't exist in Heroicons - using closest alternatives
export { CloudIcon as CloudSun } from '@heroicons/react/24/outline';
export { ClipboardDocumentCheckIcon as ClipboardCheck } from '@heroicons/react/24/outline';
export { ClipboardDocumentIcon as ClipboardDocument } from '@heroicons/react/24/outline';
export { ClipboardDocumentListIcon as ClipboardDocumentList } from '@heroicons/react/24/outline';
export { DocumentCurrencyEuroIcon as DocumentCurrencyEuro } from '@heroicons/react/24/outline';
export { DocumentCurrencyPoundIcon as DocumentCurrencyPound } from '@heroicons/react/24/outline';
export { HomeModernIcon as HomeModern } from '@heroicons/react/24/outline';
export { WrenchScrewdriverIcon as Wrench } from '@heroicons/react/24/outline';
export { WrenchScrewdriverIcon as WrenchScrewdriver } from '@heroicons/react/24/outline';
export { PencilSquareIcon as PencilRuler } from '@heroicons/react/24/outline';
export { DocumentChartBarIcon as FileSpreadsheet } from '@heroicons/react/24/outline';
export { DocumentTextIcon as FileJson } from '@heroicons/react/24/outline';
export { BuildingOfficeIcon as HardHat } from '@heroicons/react/24/outline';

// Custom icons that don't exist in Heroicons
export const Circle = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg
    ref={ref}
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1}
    stroke="currentColor"
    className={props.className || "h-5 w-5"}
  >
    <circle cx="12" cy="12" r="10" />
  </svg>
));
Circle.displayName = 'Circle';

export const CircleIcon = Circle;

export const Eraser = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg
    ref={ref}
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1}
    stroke="currentColor"
    className={props.className || "h-5 w-5"}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
));
Eraser.displayName = 'Eraser';

export const History = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg
    ref={ref}
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1}
    stroke="currentColor"
    className={props.className || "h-5 w-5"}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
));
History.displayName = 'History';

export const GripVertical = React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
  <svg
    ref={ref}
    {...props}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1}
    stroke="currentColor"
    className={props.className || "h-5 w-5"}
  >
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
));
GripVertical.displayName = 'GripVertical';

export const GripVerticalIcon = GripVertical;

// Type for icon components (for compatibility with LucideIcon type)
export type IconComponent = React.ComponentType<IconProps>;
