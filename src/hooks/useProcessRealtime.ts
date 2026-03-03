import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface UseProcessRealtimeArgs {
  processId: string | null
  enabled?: boolean
  onGraphMutation: () => void
}

export function useProcessRealtime({
  processId,
  enabled = true,
  onGraphMutation,
}: UseProcessRealtimeArgs) {
  useEffect(() => {
    if (!enabled || !processId) return

    const channel = supabase
      .channel(`process-graph-${processId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'process_nodes', filter: `process_id=eq.${processId}` },
        onGraphMutation,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'process_edges', filter: `process_id=eq.${processId}` },
        onGraphMutation,
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, processId, onGraphMutation])
}
