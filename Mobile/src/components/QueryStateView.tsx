import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

export interface QueryStateViewProps<T> {
  query: Pick<UseQueryResult<T>, 'data' | 'error' | 'isPending' | 'isError' | 'fetchStatus' | 'refetch'>;
  /** Render the data. Called whenever data exists (even if a background refetch failed). */
  children: (data: T) => ReactNode;
  /** Return true when the data should show the empty state (e.g. `d => d.items.length === 0`). */
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => unknown;
  loadingLabel?: string;
  loadingVariant?: 'spinner' | 'skeleton';
  errorTitle?: string;
}

/**
 * Standard loading / error / empty / offline handling for a react-query result:
 *   <QueryStateView query={q} isEmpty={d => d.members.length === 0} emptyTitle="No teammates yet">
 *     {(data) => <TeamList data={data} />}
 *   </QueryStateView>
 */
export function QueryStateView<T>({
  query,
  children,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
  loadingLabel,
  loadingVariant = 'spinner',
  errorTitle,
}: QueryStateViewProps<T>) {
  const retry = () => {
    void query.refetch();
  };

  if (query.data !== undefined) {
    if (isEmpty?.(query.data)) {
      return (
        <EmptyState title={emptyTitle} message={emptyMessage} actionLabel={emptyActionLabel} onAction={onEmptyAction} />
      );
    }
    return <>{children(query.data)}</>;
  }

  if (query.isError) {
    return <ErrorState error={query.error} title={errorTitle} onRetry={retry} />;
  }

  // No data yet and react-query paused the fetch because the device is offline.
  if (query.isPending && query.fetchStatus === 'paused') {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="You're offline"
        message="This information hasn't been saved on this device yet. Connect to the internet to load it."
        actionLabel="Try again"
        onAction={retry}
      />
    );
  }

  return <LoadingState label={loadingLabel} variant={loadingVariant} />;
}
