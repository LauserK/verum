import { useQuery } from '@tanstack/react-query'
import { getProfile, type Profile } from '@/lib/api'

export function useProfile() {
  return useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: getProfile,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}
