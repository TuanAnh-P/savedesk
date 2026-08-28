import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { api, ApiError, buildQueryString } from './client'
import type {
  CustomerDetail,
  CustomerFilters,
  CustomerListItem,
  ModelInfo,
  Outreach,
  OutreachStatus,
  Page,
} from '../types/api'

// Key factory: every cache key comes from here, so invalidation cannot miss a
// key because someone typed the string differently.
export const queryKeys = {
  customers: (filters: CustomerFilters) => ['customers', filters] as const,
  customer: (id: string) => ['customer', id] as const,
  modelInfo: () => ['model-info'] as const,
}

export function useCustomers(filters: CustomerFilters) {
  return useQuery({
    queryKey: queryKeys.customers(filters),
    queryFn: () =>
      api.get<Page<CustomerListItem>>(`/customers${buildQueryString(filters)}`),
    // Keeps the current page on screen while the next one loads, so paging and
    // filtering do not flash an empty table.
    placeholderData: keepPreviousData,
  })
}

export function useCustomer(customerId: string) {
  return useQuery({
    queryKey: queryKeys.customer(customerId),
    queryFn: () => api.get<CustomerDetail>(`/customers/${customerId}`),
    // A missing customer will not appear on a retry.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  })
}

export function useModelInfo() {
  return useQuery({
    queryKey: queryKeys.modelInfo(),
    queryFn: () => api.get<ModelInfo>('/model/info'),
    // The ruleset only changes on deploy.
    staleTime: Infinity,
  })
}

export function useUpdateOutreach(customerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: { status: OutreachStatus; note?: string }) =>
      api.patch<Outreach>(`/customers/${customerId}/outreach`, variables),

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customer(customerId) })
      const previous = queryClient.getQueryData<CustomerDetail>(
        queryKeys.customer(customerId),
      )

      // Show the new status immediately; onError puts it back if the API refuses.
      if (previous) {
        queryClient.setQueryData<CustomerDetail>(queryKeys.customer(customerId), {
          ...previous,
          outreach: { ...previous.outreach, status: variables.status },
        })
      }
      return { previous }
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.customer(customerId), context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customer(customerId) })
      // The list shows outreach status too, so it is now stale.
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
