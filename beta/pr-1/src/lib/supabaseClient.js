import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qgwuszmggenuysrghcdi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnd3Vzem1nZ2VudXlzcmdoY2RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1Nzk0MzAsImV4cCI6MjA3NzE1NTQzMH0.FAc4B8EdNiCVN3XGoZX90fnbumZFQwKhgxgNCoSxLcA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'X-Client-Info': 'diff-belgique-tp' } }
});

function handleError(error, context) {
  if (error) {
    const err = new Error(context ?? error.message);
    err.original = error;
    throw err;
  }
}

export async function getGameByCode(code) {
  const { data, error } = await supabase.from('games').select('*').eq('code', code).maybeSingle();
  handleError(error, 'Impossible de récupérer la partie');
  return data;
}

export async function createGameWithPlayers(code, names) {
  const { data: gameData, error: gameError } = await supabase
    .from('games')
    .insert({ code, name: 'Diff Belgique vs France' })
    .select()
    .single();
  handleError(gameError, "Création de la partie impossible");

  const payload = names.map((name) => ({ game_id: gameData.id, name, initial_score: 4 }));
  const { error: playersError } = await supabase.from('players').insert(payload);
  handleError(playersError, "Création des joueurs impossible");
  return gameData;
}

export async function fetchPlayers(gameId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true });
  handleError(error, 'Lecture des joueurs impossible');
  return data ?? [];
}

export async function fetchScores(gameId) {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('game_id', gameId);
  handleError(error, 'Lecture des scores impossible');
  return data ?? [];
}

export async function fetchPoints(gameId, limit = 200) {
  const { data, error } = await supabase
    .from('points')
    .select('*')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })
    .limit(limit);
  handleError(error, 'Lecture des points impossible');
  return data ?? [];
}

export async function addPoint({ gameId, playerId, delta, comment }) {
  const { data, error } = await supabase
    .from('points')
    .insert({
      game_id: gameId,
      player_id: playerId,
      delta,
      comment: comment ?? null
    })
    .select()
    .single();
  handleError(error, 'Ajout du point impossible');
  return data;
}

export async function deletePoint(pointId) {
  const { data, error } = await supabase
    .from('points')
    .delete()
    .eq('id', pointId)
    .select()
    .single();
  handleError(error, 'Suppression du point impossible');
  return data;
}

export function subscribePoints(gameId, callback) {
  const channel = supabase
    .channel('points-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'points', filter: `game_id=eq.${gameId}` },
      (payload) => callback(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
