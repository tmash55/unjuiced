import { useQuery } from '@tanstack/react-query'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  price_id: string
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at: string | null
  created_at: string
  updated_at: string
}

export function useSubscription() {
  return useQuery<Subscription | null>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await fetch('/api/me/subscription')
      if (!res.ok) {
        if (res.status === 404) return null // No subscription found
        throw new Error('Failed to fetch subscription')
      }
      return res.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

