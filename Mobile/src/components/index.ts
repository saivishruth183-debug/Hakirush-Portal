/**
 * Shared UI kit. Import from '@/components'.
 * All pressables are ≥48dp, have accessibilityRole/Label, and text wraps (no truncation).
 */
export { AppText, type AppTextProps, type TextColor } from './AppText';
export { Avatar, type AvatarProps } from './Avatar';
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { Card, type CardProps } from './Card';
export { confirm, type ConfirmOptions } from './confirm';
export { DateField, type DateFieldProps } from './DateField';
export { DetailRow, type DetailRowProps } from './DetailRow';
export { Divider } from './Divider';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export { FormSection, type FormSectionProps } from './FormSection';
export { Icon, type IconName, type IconProps } from './Icon';
export { IconButton, type IconButtonProps } from './IconButton';
export { ListRow, type ListRowLeft, type ListRowProps } from './ListRow';
export { LoadingState, type LoadingStateProps } from './LoadingState';
export { OfflineBanner, type OfflineBannerProps } from './OfflineBanner';
export { PlaceholderScreen, type PlaceholderScreenProps } from './PlaceholderScreen';
export { QueryStateView, type QueryStateViewProps } from './QueryStateView';
export { Screen, type ScreenProps } from './Screen';
export { SearchBar, type SearchBarProps } from './SearchBar';
export { SectionHeader, type SectionHeaderProps } from './SectionHeader';
export { SegmentedControl, type SegmentedControlProps, type SegmentOption } from './SegmentedControl';
export { SelectField, type SelectFieldProps, type SelectOption } from './SelectField';
export { Badge, StatusPill, statusTone, type StatusPillProps } from './StatusPill';
export { TextField, type TextFieldProps } from './TextField';
export { toast, ToastProvider, useToast, type ToastOptions, type ToastTone } from './Toast';
export { usePressGuard } from './usePressGuard';
